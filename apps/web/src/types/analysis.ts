export type EvidenceKind = 'text' | 'url' | 'image' | 'email' | 'structured';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'unclear';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AnalysisStatus = 'draft' | 'queued' | 'processing' | 'complete' | 'failed' | 'deleted';

export interface StructuredEvidenceFields {
  claimedOrganization?: string;
  sender?: string;
  paymentDestination?: string;
  amount?: string;
  deadline?: string;
  requestedAction?: string;
}

export type EvidenceChannel =
  | 'sms'
  | 'email'
  | 'chat'
  | 'social_media'
  | 'marketplace'
  | 'phone_call'
  | 'website'
  | 'unknown';

export interface EvidenceInput {
  clientId: string;
  kind: EvidenceKind;
  channel?: EvidenceChannel;
  content?: string;
  originalFilename?: string;
  file?: File;
  metadata?: StructuredEvidenceFields;
}

export interface ExtractedEntity {
  type: string;
  value: string;
  normalizedValue?: string;
  sourceEvidenceId?: string;
  confidence?: number | 'limited' | 'moderate' | 'strong';
  privacyClass?: 'public' | 'internal' | 'private' | 'restricted';
}

export interface AnalysisFinding {
  id: string;
  category: string;
  title: string;
  severity: FindingSeverity;
  confidence: 'high' | 'medium' | 'low' | 'limited' | 'moderate' | 'strong';
  detected: boolean;
  explanation: string;
  evidence: string[];
  source: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score?: number;
  confidence: 'high' | 'medium' | 'low' | 'limited' | 'moderate' | 'strong';
  rationale: string[];
  limitations: string[];
  engineVersion: string;
}

export interface RecommendedAction {
  id: string;
  priority: 'do_now' | 'immediate' | 'today' | 'next' | 'monitor';
  title: string;
  description: string;
  completed?: boolean;
}

export interface VerificationGuidance {
  title: string;
  detail: string;
  warning?: string;
}

export interface EvidenceSummary {
  kind: EvidenceKind;
  label: string;
  extractedText?: string;
  status: 'received' | 'processed' | 'complete' | 'pending' | 'failed' | 'unavailable';
}

export interface AnalysisResult {
  publicId: string;
  title?: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt?: string;
  localOnly?: boolean;
  evidence: EvidenceSummary[];
  extractedEntities: ExtractedEntity[];
  findings: AnalysisFinding[];
  riskAssessment: RiskAssessment;
  recommendedActions: RecommendedAction[];
  verificationGuidance: VerificationGuidance[];
  patternMatches?: Array<{
    id: string;
    name: string;
    description: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

export interface CreateAnalysisPayload {
  title?: string;
  evidence: EvidenceInput[];
  incidentContext?: string[];
  allowExternalAiProcessing?: boolean;
}

export interface HistoryPage {
  items: AnalysisResult[];
  page: number;
  pageSize: number;
  total: number;
  nextCursor?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'moderator' | 'admin';
  status: string;
  privacy?: {
    analysisRetentionDays: number;
    allowCommunityReportPrompts: boolean;
  };
}

export interface CommunityReport {
  id: string;
  category: string;
  patternId?: string;
  occurredOn?: string;
  summary: string;
  publishedAt: string;
  sharedDomains: string[];
}

export interface MyCommunityReport {
  id: string;
  category: string;
  patternId?: string;
  moderationStatus: 'pending' | 'published' | 'rejected';
  occurredOn?: string;
  createdAt: string;
}

export type CommunitySignalKind = 'domain' | 'phone' | 'email' | 'payment_handle';

export interface CreateCommunityReportInput {
  analysisId: string;
  category: string;
  patternId?: string;
  occurredOn?: string;
  /** Private moderator context. It is never shown in the public feed. */
  description?: string;
  /** Every signal is selected explicitly by the account owner. */
  shareSignalKinds: CommunitySignalKind[];
}

export interface PendingCommunityReport {
  id: string;
  category: string;
  patternId?: string;
  occurredOn?: string;
  /** Restricted to moderator/admin responses; never render in public views. */
  privateDescription?: string;
  signalKinds: CommunitySignalKind[];
  createdAt: string;
}

export interface ScamPatternSummary {
  id: string;
  category: string;
  name: string;
  description: string;
  severity: FindingSeverity;
  applicableChannels: string[];
  aliases: string[];
  version: string;
}

export type IncidentInteraction =
  | 'clicked_link'
  | 'entered_password'
  | 'shared_otp'
  | 'installed_app'
  | 'shared_screen'
  | 'sent_money'
  | 'shared_financial_details'
  | 'shared_identity_document'
  | 'contacted_sender';

export interface TrustedEntitySummary {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  officialDomains: string[];
  officialApps?: Array<{ platform: string; identifier: string }>;
  officialSupportChannels: Array<{ type: string; label: string; value: string; verified: boolean }>;
  lastVerifiedAt?: string;
}

export interface IncidentRecord {
  id: string;
  interactions: string[];
  status: string;
  createdAt: string;
}

export interface UrlInspectionResult {
  findings: AnalysisFinding[];
  limitations: string[];
  providerResults: Array<{ provider: string; status: string; verdict?: string; reference?: string }>;
  technicalSummary?: {
    hostname: string;
    protocol: string;
    safeForRemoteLookup: boolean;
    safetyIssues: string[];
  };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: string;
  requestId?: string;
  createdAt: string;
}

export interface AbuseReportSummary {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
}

export interface AdminOverviewStats {
  moderation: { pendingReports: number; openAbuseReports: number };
  system: {
    activePatterns: number;
    verifiedEntities: number;
    analysesByRisk: Array<{ level: string; count: number }>;
  };
}

