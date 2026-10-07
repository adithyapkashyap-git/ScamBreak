import { describe, expect, it } from 'vitest';

import { createCommunityReportSchema, moderationDecisionSchema } from './community.schemas.js';

const analysisId = 'anl_1234567890abcdef';

describe('community report validation', () => {
  it('requires either a linked private analysis or private moderator context', () => {
    const parsed = createCommunityReportSchema.safeParse({
      category: 'job_recruitment',
      shareSignalKinds: []
    });

    expect(parsed.success).toBe(false);
  });

  it('permits explicit, bounded opt-in signal sharing from a completed analysis', () => {
    const parsed = createCommunityReportSchema.safeParse({
      analysisId,
      category: 'job_recruitment',
      shareSignalKinds: ['domain', 'payment_handle']
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.shareSignalKinds).toEqual(['domain', 'payment_handle']);
    }
  });

  it('requires a moderator-authored public summary before publication', () => {
    expect(moderationDecisionSchema.safeParse({ decision: 'published' }).success).toBe(false);
    expect(moderationDecisionSchema.safeParse({
      decision: 'published',
      publicSummary: 'A reviewed report describes a recurring job-fee pressure pattern.'
    }).success).toBe(true);
    expect(moderationDecisionSchema.safeParse({ decision: 'rejected' }).success).toBe(true);
  });
});
