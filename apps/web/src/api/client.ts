import type {
  AbuseReportSummary,
  AdminOverviewStats,
  AnalysisFinding,
  AnalysisResult,
  AuditLogEntry,
  CommunityReport,
  CreateCommunityReportInput,
  CreateAnalysisPayload,
  EvidenceInput,
  HistoryPage,
  IncidentInteraction,
  IncidentRecord,
  MyCommunityReport,
  PendingCommunityReport,
  RecommendedAction,
  ScamPatternSummary,
  TrustedEntitySummary,
  UrlInspectionResult,
  UserAccount,
} from '../types/analysis';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
let csrfToken: string | undefined;
let csrfRequest: Promise<string> | undefined;

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status = 0, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string; code?: string; requestId?: string };
}

async function parseJson(response: Response): Promise<unknown> {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (csrfRequest) return csrfRequest;
  csrfRequest = (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/api/auth/csrf`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
    } catch {
      const target = API_BASE || (import.meta.env.DEV ? 'http://localhost:4000' : 'configured backend');
      throw new ApiError(`Could not connect to the ScamBreak API server (${target}). Please make sure the backend is running and reachable.`, 0);
    }
    const payload = (await parseJson(response)) as ApiEnvelope<{ csrfToken?: string }> | undefined;
    const token = payload?.data?.csrfToken;
    if (!response.ok || !token) {
      throw new ApiError(payload?.error?.message ?? 'ScamBreak could not establish a secure browser session.', response.status);
    }
    csrfToken = token;
    return token;
  })().finally(() => {
    csrfRequest = undefined;
  });
  return csrfRequest;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase());
  const headers = new Headers({ Accept: 'application/json', ...(init.headers ?? {}) });
  if (unsafe && !headers.has('Authorization')) headers.set('X-CSRF-Token', await getCsrfToken());

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...init, headers });
  } catch {
    const target = API_BASE || (import.meta.env.DEV ? 'http://localhost:4000' : 'configured backend');
    throw new ApiError(`Could not reach the ScamBreak API service (${target}). Please check that the server is running.`, 0);
  }

  const payload = (await parseJson(response)) as ApiEnvelope<T> | undefined;
  if (!response.ok) {
    const error = payload?.error;
    if (response.status === 403 && error?.code === 'CSRF_TOKEN_INVALID') csrfToken = undefined;
    throw new ApiError(
      error?.message ?? 'The request could not be completed safely.',
      response.status,
      error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
    );
  }
  return (payload?.data ?? (payload as T)) as T;
}

type BackendAnalysis = {
  id: string;
  title?: string;
  status: AnalysisResult['status'];
  createdAt: string;
  updatedAt?: string;
  evidence: Array<{ id: string; type: string; label?: string; summary: string; extractionStatus: string }>;
  extractedEntities: Array<{
    id: string;
    kind: string;
    displayValue: string;
    classification: 'public' | 'internal' | 'private' | 'restricted';
    source: string;
    confidence: 'limited' | 'moderate' | 'strong';
  }>;
  findings: Array<{
    code: string;
    category: string;
    state: string;
    severity: AnalysisFinding['severity'];
    confidence: AnalysisFinding['confidence'];
    title: string;
    explanation: string;
    evidence: Array<{ excerpt: string }>;
    source: string;
  }>;
  riskAssessment: null | {
    level: AnalysisResult['riskAssessment']['level'];
    score: number | null;
    confidence: AnalysisResult['riskAssessment']['confidence'];
    rationale: string[];
    limitations: string[];
    engineVersion: string;
  };
  recommendedActions: Array<{ key: string; priority: RecommendedAction['priority']; title: string; description: string }>;
  verificationGuidance: Array<{ title: string; description: string; avoidUntrustedContact: boolean }>;
  patternIds: string[];
  limitations: string[];
};

function evidenceKind(type: string): AnalysisResult['evidence'][number]['kind'] {
  if (type === 'image') return 'image';
  if (type === 'url') return 'url';
  if (type === 'email') return 'email';
  if (type === 'manual') return 'structured';
  return 'text';
}

function analysisFromBackend(value: BackendAnalysis): AnalysisResult {
  return {
    publicId: value.id,
    title: value.title,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    evidence: value.evidence.map((item) => ({
      kind: evidenceKind(item.type),
      label: item.label ?? item.summary,
      status: item.extractionStatus === 'complete' ? 'complete' : item.extractionStatus === 'pending' ? 'pending' : item.extractionStatus === 'unavailable' ? 'unavailable' : 'failed',
    })),
    extractedEntities: value.extractedEntities.map((item) => ({
      type: item.kind,
      value: item.displayValue,
      privacyClass: item.classification,
      confidence: item.confidence,
    })),
    findings: value.findings.map((item) => ({
      id: item.code,
      category: item.category,
      title: item.title,
      severity: item.severity,
      confidence: item.confidence,
      detected: item.state === 'detected',
      explanation: item.explanation,
      evidence: item.evidence.map((reference) => reference.excerpt),
      source: item.source,
    })),
    riskAssessment: value.riskAssessment
      ? {
          level: value.riskAssessment.level,
          ...(value.riskAssessment.score === null ? {} : { score: value.riskAssessment.score }),
          confidence: value.riskAssessment.confidence,
          rationale: value.riskAssessment.rationale,
          limitations: value.riskAssessment.limitations,
          engineVersion: value.riskAssessment.engineVersion,
        }
      : {
          level: 'unclear',
          confidence: 'limited',
          rationale: ['The analysis is not complete.'],
          limitations: value.limitations,
          engineVersion: 'pending',
        },
    recommendedActions: value.recommendedActions.map((item) => ({
      id: item.key,
      priority: item.priority,
      title: item.title,
      description: item.description,
    })),
    verificationGuidance: value.verificationGuidance.map((item) => ({
      title: item.title,
      detail: item.description,
      ...(item.avoidUntrustedContact ? { warning: 'Do not use contact details supplied in the suspicious content.' } : {}),
    })),
    patternMatches: value.patternIds.map((id) => ({
      id,
      name: id.replace(/_/g, ' '),
      description: 'A reviewed scam-pattern definition matched the detected signals.',
      confidence: 'medium',
    })),
  };
}

async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.set('image', file, file.name);
  const result = await request<{ upload: { id: string } }>('/api/evidence/images', { method: 'POST', body });
  return result.upload.id;
}

function structuredText(evidence: EvidenceInput): string {
  const fields = evidence.metadata ?? {};
  return [
    fields.claimedOrganization ? `Claimed organization: ${fields.claimedOrganization}` : '',
    fields.sender ? `Sender: ${fields.sender}` : '',
    fields.paymentDestination ? `Payment destination: ${fields.paymentDestination}` : '',
    fields.amount ? `Amount: ${fields.amount}` : '',
    fields.deadline ? `Deadline: ${fields.deadline}` : '',
    fields.requestedAction ? `Requested action: ${fields.requestedAction}` : '',
  ].filter(Boolean).join('\n');
}

async function toBackendEvidence(evidence: EvidenceInput): Promise<Record<string, unknown>> {
  if (evidence.kind === 'image') {
    if (!evidence.file) throw new ApiError('Choose an image file before starting the analysis.', 400);
    return { type: 'image', channel: evidence.channel ?? 'unknown', filePublicId: await uploadImage(evidence.file), label: evidence.originalFilename ?? evidence.file.name };
  }
  if (evidence.kind === 'url') return { type: 'url', channel: evidence.channel ?? 'website', url: evidence.content?.trim(), label: 'Submitted URL' };
  if (evidence.kind === 'email') return { type: 'email', channel: evidence.channel ?? 'email', text: evidence.content?.trim(), label: 'Copied email' };
  if (evidence.kind === 'structured') return { type: 'manual', channel: evidence.channel ?? 'unknown', text: structuredText(evidence), label: 'Manual details' };
  return { type: 'message', channel: evidence.channel ?? 'sms', text: evidence.content?.trim(), label: 'Pasted message' };
}

export const analysisApi = {
  async create(payload: CreateAnalysisPayload): Promise<AnalysisResult> {
    const evidence = await Promise.all(payload.evidence.map(toBackendEvidence));
    const result = await request<{ analysis: BackendAnalysis }>('/api/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(payload.title?.trim() ? { title: payload.title.trim() } : {}),
        evidence,
        locale: navigator.language || 'en',
        allowExternalAiProcessing: Boolean(payload.allowExternalAiProcessing),
      }),
    });
    return analysisFromBackend(result.analysis);
  },

  async get(publicId: string): Promise<AnalysisResult> {
    const result = await request<{ analysis: BackendAnalysis }>(`/api/analyses/${encodeURIComponent(publicId)}`);
    return analysisFromBackend(result.analysis);
  },

  async list(cursor?: string): Promise<HistoryPage> {
    const query = new URLSearchParams({ limit: '20' });
    if (cursor) query.set('cursor', cursor);
    const result = await request<{
      items: Array<Pick<BackendAnalysis, 'id' | 'title' | 'status' | 'createdAt' | 'updatedAt'> & {
        riskLevel: AnalysisResult['riskAssessment']['level']; evidenceCount: number; findingCount: number;
      }>;
      nextCursor?: string;
    }>(`/api/analyses?${query}`);
    return {
      items: result.items.map((item) => ({
        publicId: item.id,
        title: item.title,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        evidence: [],
        extractedEntities: [],
        findings: [],
        riskAssessment: { level: item.riskLevel, confidence: 'limited', rationale: [], limitations: [], engineVersion: 'summary' },
        recommendedActions: [],
        verificationGuidance: [],
      })),
      page: 1,
      pageSize: result.items.length,
      total: result.items.length,
      nextCursor: result.nextCursor,
    };
  },

  async remove(publicId: string): Promise<void> {
    await request<void>(`/api/analyses/${encodeURIComponent(publicId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledgement: true }),
    });
  },

  async createIncident(interactions: IncidentInteraction[], notes?: string, analysisId?: string): Promise<{ id: string; responsePlan: RecommendedAction[] }> {
    const isLocalAnalysis = !analysisId || analysisId.startsWith('local-');
    const result = await request<{
      incident: {
        id: string;
        responsePlan: Array<RecommendedAction | { key?: string; id?: string; priority: RecommendedAction['priority']; title: string; description: string }>;
      };
    }>('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactions,
        ...(notes?.trim() ? { notes: notes.trim() } : {}),
        ...(!isLocalAnalysis ? { analysisId } : {})
      }),
    });
    const incident = result.incident;
    const responsePlan: RecommendedAction[] = (incident.responsePlan ?? []).map((action, index) => ({
      id: action.id ?? ('key' in action && action.key ? action.key : `action_${index}`),
      priority: action.priority,
      title: action.title,
      description: action.description,
    }));
    return { id: incident.id, responsePlan };
  },

  async listIncidents(): Promise<IncidentRecord[]> {
    const result = await request<{ incidents: IncidentRecord[] }>('/api/incidents');
    return result.incidents;
  },
};

export const authApi = {
  async me(): Promise<UserAccount | undefined> {
    try {
      const result = await request<{ user: UserAccount }>('/api/auth/me');
      return result.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return undefined;
      throw error;
    }
  },
  async register(input: { displayName: string; email: string; password: string }): Promise<UserAccount> {
    const result = await request<{ user: UserAccount }>('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    return result.user;
  },
  async login(input: { email: string; password: string }): Promise<UserAccount> {
    const result = await request<{ user: UserAccount }>('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
    return result.user;
  },
  async logout(): Promise<void> {
    await request<void>('/api/auth/logout', { method: 'POST' });
    csrfToken = undefined;
  },
};

export const accountApi = {
  async updateSettings(input: {
    displayName?: string;
    privacy?: Partial<NonNullable<UserAccount['privacy']>>;
  }): Promise<UserAccount> {
    const result = await request<{ user: UserAccount }>('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return result.user;
  },
};

export const intelligenceApi = {
  async community(): Promise<CommunityReport[]> {
    const result = await request<{ reports: CommunityReport[] }>('/api/community-reports?limit=50');
    return result.reports;
  },
  async myCommunityReports(): Promise<MyCommunityReport[]> {
    const result = await request<{ reports: MyCommunityReport[] }>('/api/community-reports/mine?limit=50');
    return result.reports;
  },
  async createCommunityReport(input: CreateCommunityReportInput): Promise<MyCommunityReport> {
    const result = await request<{ report: MyCommunityReport }>('/api/community-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return result.report;
  },
  async patterns(): Promise<ScamPatternSummary[]> {
    const result = await request<{ patterns: ScamPatternSummary[] }>('/api/patterns?limit=100');
    return result.patterns;
  },
  async verifyEntity(name: string, domain?: string): Promise<{ status: string; guidance: Array<{ title: string; description: string }> }> {
    const parameters = new URLSearchParams({ name });
    if (domain) parameters.set('domain', domain);
    const result = await request<{ verification: { status: string; guidance: Array<{ title: string; description: string }> } }>(`/api/entities/verify?${parameters}`);
    return result.verification;
  },
  async listEntities(): Promise<TrustedEntitySummary[]> {
    const result = await request<{ entities: TrustedEntitySummary[] }>('/api/entities?limit=100');
    return result.entities;
  },
  async submitAbuseReport(reportPublicId: string, reason: string, detail?: string): Promise<{ id: string; status: string }> {
    const result = await request<{ report: { id: string; status: string } }>(`/api/community-reports/${encodeURIComponent(reportPublicId)}/abuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, ...(detail?.trim() ? { detail: detail.trim() } : {}) }),
    });
    return result.report;
  },
};

export const urlAnalysisApi = {
  async inspect(url: string): Promise<UrlInspectionResult> {
    const result = await request<UrlInspectionResult>('/api/url-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return result;
  },
};

/** Restricted moderation endpoints. Responses deliberately omit raw evidence. */
export const moderationApi = {
  async pendingCommunityReports(): Promise<PendingCommunityReport[]> {
    const result = await request<{ reports: PendingCommunityReport[] }>('/api/admin/community/reports?limit=50');
    return result.reports;
  },
  async decideCommunityReport(input: {
    reportId: string;
    decision: 'published' | 'rejected';
    publicSummary?: string;
    moderationNote?: string;
  }): Promise<void> {
    await request<void>(`/api/admin/community/reports/${encodeURIComponent(input.reportId)}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: input.decision,
        ...(input.publicSummary?.trim() ? { publicSummary: input.publicSummary.trim() } : {}),
        ...(input.moderationNote?.trim() ? { moderationNote: input.moderationNote.trim() } : {}),
      }),
    });
  },
};

export const adminApi = {
  async overview(): Promise<AdminOverviewStats> {
    const result = await request<AdminOverviewStats>('/api/admin/overview');
    return result;
  },
  async auditLogs(limit = 50): Promise<AuditLogEntry[]> {
    const result = await request<{ entries: AuditLogEntry[] }>(`/api/admin/audit-logs?limit=${limit}`);
    return result.entries;
  },
  async abuseReports(limit = 50): Promise<AbuseReportSummary[]> {
    const result = await request<{ reports: AbuseReportSummary[] }>(`/api/admin/abuse-reports?limit=${limit}`);
    return result.reports;
  },
  async patterns(): Promise<ScamPatternSummary[]> {
    const result = await request<{ patterns: ScamPatternSummary[] }>('/api/admin/patterns');
    return result.patterns;
  },
  async entities(): Promise<TrustedEntitySummary[]> {
    const result = await request<{ entities: TrustedEntitySummary[] }>('/api/admin/entities?limit=100');
    return result.entities;
  },
  async upsertPattern(pattern: Record<string, unknown>): Promise<ScamPatternSummary> {
    const result = await request<{ pattern: ScamPatternSummary }>('/api/admin/patterns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pattern),
    });
    return result.pattern;
  },
  async createEntity(entity: Record<string, unknown>): Promise<{ id: string; name: string; verificationStatus: string }> {
    const result = await request<{ entity: { id: string; name: string; verificationStatus: string } }>('/api/admin/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entity),
    });
    return result.entity;
  },
  async updateEntity(entityId: string, entity: Record<string, unknown>): Promise<{ id: string; name: string; verificationStatus: string }> {
    const result = await request<{ entity: { id: string; name: string; verificationStatus: string } }>(`/api/admin/entities/${encodeURIComponent(entityId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entity),
    });
    return result.entity;
  },
};

/** Local demo mode is visibly labelled and disabled in a production build by default. */
export function localFallbackAllowed(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_DEMO === 'true';
}

export function canUseLocalFallback(error: unknown): boolean {
  if (!localFallbackAllowed() || !(error instanceof ApiError)) return false;
  return error.status === 0 || error.status === 404 || error.status >= 500;
}
