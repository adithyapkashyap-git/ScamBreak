import { describe, expect, it } from 'vitest';

import type { FindingInput } from './analysis.types.js';
import { scoreFindings } from './riskScoring.service.js';

const finding = (overrides: Partial<FindingInput> = {}): FindingInput => ({
  code: 'example',
  category: 'payment',
  state: 'detected',
  severity: 'high',
  confidence: 'strong',
  title: 'Example finding',
  explanation: 'An evidence-backed finding.',
  evidence: [{ evidencePublicId: 'evd_test', excerpt: 'Safe excerpt.' }],
  recommendedActionKeys: ['do_not_pay'],
  source: 'rule',
  ...overrides,
});

describe('scoreFindings', () => {
  it('prioritizes a strong credential request without calling it a probability', () => {
    const result = scoreFindings([
      finding({ code: 'credential_or_otp_request', category: 'credential_theft', severity: 'critical' }),
      finding({ code: 'urgency_pressure', category: 'pressure', severity: 'medium' }),
    ]);

    expect(result.level).toBe('critical');
    expect(result.score).toBeGreaterThan(0);
    expect(result.contributions.map((item) => item.findingCode)).toContain('credential_or_otp_request');
    expect(result.limitations.join(' ')).toContain('not a statistically validated probability');
  });

  it('does not turn an absence of detected signals into a legitimate verdict', () => {
    const result = scoreFindings([
      finding({ state: 'not_detected', evidence: [], severity: 'info', confidence: 'limited' }),
    ]);

    expect(result.level).toBe('unclear');
    expect(result.score).toBeNull();
    expect(result.limitations.join(' ')).toContain('can prove');
  });

  it('caps semantic AI contribution below independently evidenced findings', () => {
    const result = scoreFindings([
      finding({ code: 'semantic_suspicious', source: 'ai', severity: 'high', confidence: 'moderate' }),
    ]);
    expect(result.contributions[0]?.points).toBeLessThanOrEqual(8);
  });
});
