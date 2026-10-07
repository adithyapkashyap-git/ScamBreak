import { describe, expect, it } from 'vitest';

import { matchScamPatterns } from './patternMatching.service.js';
import { builtInPatternTaxonomy } from './patternTaxonomy.js';
import type { FindingInput, ExtractedEntityInput } from '../analyses/analysis.types.js';

describe('matchScamPatterns', () => {
  it('matches bank payment impersonation pattern when channel is unknown', () => {
    const findings: FindingInput[] = [
      {
        code: 'authority_impersonation_language',
        category: 'impersonation',
        state: 'detected',
        severity: 'high',
        confidence: 'moderate',
        title: 'Authority impersonation',
        explanation: 'Claimed bank authority.',
        evidence: [],
        recommendedActionKeys: ['contact_independently'],
        source: 'rule',
      },
      {
        code: 'urgency_pressure',
        category: 'pressure',
        state: 'detected',
        severity: 'medium',
        confidence: 'moderate',
        title: 'Urgency detected',
        explanation: 'Act now.',
        evidence: [],
        recommendedActionKeys: ['pause_and_verify'],
        source: 'rule',
      },
    ];

    const entities: ExtractedEntityInput[] = [
      {
        kind: 'payment_handle',
        value: 'scam@upi',
        normalizedValue: 'scam@upi',
        displayValue: 'sc•••@upi',
        classification: 'restricted',
        sourceEvidencePublicId: 'evd_1',
        source: 'deterministic',
        confidence: 'strong',
      },
    ];

    const matches = matchScamPatterns({
      findings,
      entities,
      channels: ['unknown'],
      evidencePublicIds: ['evd_1'],
      definitions: builtInPatternTaxonomy,
    });

    const matchIds = matches.map((m) => m.patternId);
    expect(matchIds).toContain('bank_payment_impersonation');
    const bankMatch = matches.find((m) => m.patternId === 'bank_payment_impersonation');
    expect(bankMatch?.finding.severity).toBe('high');
    expect(bankMatch?.matchedIndicators).toEqual(expect.arrayContaining(['authority_impersonation_language', 'entity:payment_handle']));
  });

  it('rejects match when required allFindingCodes are missing', () => {
    // bank_payment_impersonation requires urgency_pressure in allFindingCodes
    const findings: FindingInput[] = [
      {
        code: 'authority_impersonation_language',
        category: 'impersonation',
        state: 'detected',
        severity: 'high',
        confidence: 'moderate',
        title: 'Authority impersonation',
        explanation: 'Claimed bank authority.',
        evidence: [],
        recommendedActionKeys: [],
        source: 'rule',
      },
    ];

    const matches = matchScamPatterns({
      findings,
      entities: [],
      channels: ['sms'],
      evidencePublicIds: ['evd_1'],
      definitions: builtInPatternTaxonomy,
    });

    expect(matches.find((m) => m.patternId === 'bank_payment_impersonation')).toBeUndefined();
  });
});
