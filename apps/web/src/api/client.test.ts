import { afterEach, describe, expect, it, vi } from 'vitest';

import { analysisApi } from './client';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('browser API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('obtains a CSRF token and sends analysis requests with browser credentials', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { csrfToken: 'csrf-test-token' } }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          analysis: {
            id: 'anl_1234567890abcdef',
            status: 'complete',
            createdAt: '2026-01-01T00:00:00.000Z',
            evidence: [],
            extractedEntities: [],
            findings: [],
            riskAssessment: {
              level: 'unclear', score: null, confidence: 'limited', rationale: [], limitations: [], engineVersion: 'analysis-engine/test'
            },
            recommendedActions: [],
            verificationGuidance: [],
            patternIds: [],
            limitations: []
          }
        }
      }));
    vi.stubGlobal('fetch', fetchMock);

    const analysis = await analysisApi.create({
      evidence: [{ clientId: 'evd_1', kind: 'text', content: 'Please verify your account now.' }]
    });

    expect(analysis.publicId).toBe('anl_1234567890abcdef');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/auth/csrf');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/analyses');
    const requestOptions = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(requestOptions.credentials).toBe('include');
    expect(new Headers(requestOptions.headers).get('x-csrf-token')).toBe('csrf-test-token');
  });

  it('inspects URLs defensively via urlAnalysisApi', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/csrf')) {
        return jsonResponse({ success: true, data: { csrfToken: 'csrf-test-token' } });
      }
      if (url.includes('/api/url-analysis')) {
        return jsonResponse({
          success: true,
          data: {
            findings: [],
            limitations: ['Static structural analysis only.'],
            providerResults: [],
            technicalSummary: { hostname: 'example.com', protocol: 'https:', safeForRemoteLookup: true, safetyIssues: [] }
          }
        });
      }
      return jsonResponse({ error: { message: 'Not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { urlAnalysisApi } = await import('./client');
    const result = await urlAnalysisApi.inspect('https://example.com/login');

    expect(result.technicalSummary?.hostname).toBe('example.com');
  });

  it('lists verified entities and submits abuse reports via intelligenceApi', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/csrf')) {
        return jsonResponse({ success: true, data: { csrfToken: 'csrf-test-token' } });
      }
      if (url.includes('/api/entities')) {
        return jsonResponse({
          success: true,
          data: {
            entities: [{
              id: 'ent_123',
              name: 'PayPal',
              aliases: ['paypal'],
              category: 'financial_services',
              officialDomains: ['paypal.com'],
              officialSupportChannels: [{ type: 'support_url', label: 'Support', value: 'https://paypal.com/help', verified: true }]
            }]
          }
        });
      }
      if (url.includes('/abuse')) {
        return jsonResponse({
          success: true,
          data: {
            report: { id: 'abs_123', status: 'open' }
          }
        });
      }
      return jsonResponse({ error: { message: 'Not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { intelligenceApi } = await import('./client');
    const entities = await intelligenceApi.listEntities();
    expect(entities.length).toBe(1);
    expect(entities[0]?.name).toBe('PayPal');

    const abuse = await intelligenceApi.submitAbuseReport('rep_456', 'inappropriate_content', 'Contains sensitive info');
    expect(abuse.id).toBe('abs_123');
    expect(abuse.status).toBe('open');
  });

  it('queries admin overview and audit logs via adminApi', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/csrf')) {
        return jsonResponse({ success: true, data: { csrfToken: 'csrf-test-token' } });
      }
      if (url.includes('/api/admin/overview')) {
        return jsonResponse({
          success: true,
          data: {
            moderation: { pendingReports: 3, openAbuseReports: 1 },
            system: { activePatterns: 10, verifiedEntities: 15, analysesByRisk: [{ level: 'high', count: 5 }] }
          }
        });
      }
      if (url.includes('/api/admin/audit-logs')) {
        return jsonResponse({
          success: true,
          data: {
            entries: [{
              id: 'adt_1',
              action: 'trusted_entity.create',
              resourceType: 'trusted_entity',
              outcome: 'success',
              createdAt: '2026-01-01T00:00:00.000Z'
            }]
          }
        });
      }
      return jsonResponse({ error: { message: 'Not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { adminApi } = await import('./client');
    const overview = await adminApi.overview();
    expect(overview.moderation.pendingReports).toBe(3);
    expect(overview.system.verifiedEntities).toBe(15);

    const logs = await adminApi.auditLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.action).toBe('trusted_entity.create');
  });

  it('omits local- analysisId when creating an incident and normalizes responsePlan actions', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/csrf')) {
        return jsonResponse({ success: true, data: { csrfToken: 'csrf-test-token' } });
      }
      if (url.includes('/api/incidents')) {
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({
          success: true,
          data: {
            incident: {
              id: 'inc_test1234567890',
              responsePlan: [
                {
                  key: 'end_screen_sharing',
                  priority: 'immediate',
                  title: 'End screen sharing',
                  description: 'Close session now'
                }
              ]
            }
          }
        });
      }
      return jsonResponse({ error: { message: 'Not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await analysisApi.createIncident(
      ['shared_screen'],
      '',
      'local-509f1ac0-4428-4dc6-b129-1a4b19393523'
    );

    expect(result.id).toBe('inc_test1234567890');
    expect(result.responsePlan[0]?.id).toBe('end_screen_sharing');
    expect(result.responsePlan[0]?.title).toBe('End screen sharing');
    expect(capturedBody).toBeDefined();
    expect(capturedBody?.interactions).toEqual(['shared_screen']);
    expect(capturedBody?.analysisId).toBeUndefined();
    expect(capturedBody?.notes).toBeUndefined();
  });

  it('passes server analysisId when creating an incident', async () => {
    let capturedBody: Record<string, unknown> | undefined;
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/csrf')) {
        return jsonResponse({ success: true, data: { csrfToken: 'csrf-test-token' } });
      }
      if (url.includes('/api/incidents')) {
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({
          success: true,
          data: {
            incident: {
              id: 'inc_test1234567890',
              responsePlan: []
            }
          }
        });
      }
      return jsonResponse({ error: { message: 'Not found' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    await analysisApi.createIncident(['shared_screen'], 'Notes test', 'anl_1234567890abcdef');

    expect(capturedBody).toBeDefined();
    expect(capturedBody?.analysisId).toBe('anl_1234567890abcdef');
    expect(capturedBody?.notes).toBe('Notes test');
  });
});
