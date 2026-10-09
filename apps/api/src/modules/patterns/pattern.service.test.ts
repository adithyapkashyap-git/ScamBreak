import { describe, expect, it, vi } from 'vitest';

import { loadActivePatternDefinitions } from './pattern.service.js';
import { ScamPattern } from './scamPattern.model.js';

describe('loadActivePatternDefinitions', () => {
  it('safely handles pattern records with missing optional indicators and channels', async () => {
    const mockPatterns = [
      {
        patternId: 'kyc_account_warning',
        category: 'kyc_account_warning',
        name: 'KYC warning',
        description: 'Test KYC warning description',
        indicators: {
          anyFindingCodes: ['account_security_warning'],
          // allFindingCodes is intentionally omitted / undefined
          entityKinds: ['url'],
          minMatchedIndicators: 1,
        },
        severity: 'high',
        applicableChannels: ['sms', 'chat'],
        recommendedProtectiveActions: ['do_not_click'],
        aliases: ['kyc alert'],
        examples: [],
        version: '1.0.0',
      },
      {
        patternId: 'lottery_prize_lure',
        category: 'lottery_scam',
        name: 'Lottery Prize Lure',
        description: 'Lottery scam description',
        indicators: {
          anyFindingCodes: ['advance_fee_lure', 'unrealistic_promise'],
          // entityKinds is intentionally omitted / undefined
          minMatchedIndicators: 2,
        },
        severity: 'critical',
        applicableChannels: ['sms'],
        version: '1.0.0',
      },
      {
        patternId: 'invalid_missing_channels',
        category: 'invalid',
        name: 'Invalid Pattern',
        description: 'Should be ignored because channels are empty',
        indicators: {
          anyFindingCodes: ['urgency'],
          minMatchedIndicators: 1,
        },
        severity: 'low',
        applicableChannels: [],
        version: '1.0.0',
      },
    ];

    vi.spyOn(ScamPattern, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockPatterns),
        }),
      }),
    } as unknown as ReturnType<typeof ScamPattern.find>);

    const definitions = await loadActivePatternDefinitions();

    expect(definitions).toHaveLength(2);

    const kyc = definitions.find((d) => d.patternId === 'kyc_account_warning');
    expect(kyc).toBeDefined();
    expect(kyc?.indicators.allFindingCodes).toBeUndefined();
    expect(kyc?.indicators.entityKinds).toEqual(['url']);
    expect(kyc?.indicators.anyFindingCodes).toEqual(['account_security_warning']);
    expect(kyc?.applicableChannels).toEqual(['sms', 'chat']);

    const lottery = definitions.find((d) => d.patternId === 'lottery_prize_lure');
    expect(lottery).toBeDefined();
    expect(lottery?.indicators.allFindingCodes).toBeUndefined();
    expect(lottery?.indicators.entityKinds).toBeUndefined();
    expect(lottery?.indicators.anyFindingCodes).toEqual(['advance_fee_lure', 'unrealistic_promise']);
    expect(lottery?.recommendedProtectiveActions).toEqual([]);
    expect(lottery?.aliases).toEqual([]);
  });
});
