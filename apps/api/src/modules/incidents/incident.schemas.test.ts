import { describe, expect, it } from 'vitest';

import { createIncidentSchema } from './incident.schemas.js';

describe('incident validation schema', () => {
  it('accepts valid interactions without analysisId', () => {
    const parsed = createIncidentSchema.safeParse({
      interactions: ['shared_screen']
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.interactions).toEqual(['shared_screen']);
      expect(parsed.data.analysisId).toBeUndefined();
      expect(parsed.data.notes).toBeUndefined();
    }
  });

  it('accepts local analysisId without error', () => {
    const parsed = createIncidentSchema.safeParse({
      interactions: ['shared_screen', 'sent_money'],
      analysisId: 'local-509f1ac0-4428-4dc6-b129-1a4b19393523'
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.analysisId).toBe('local-509f1ac0-4428-4dc6-b129-1a4b19393523');
      expect(parsed.data.interactions).toEqual(['shared_screen', 'sent_money']);
    }
  });

  it('accepts server analysisId', () => {
    const parsed = createIncidentSchema.safeParse({
      interactions: ['shared_screen'],
      analysisId: 'anl_1234567890abcdef'
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.analysisId).toBe('anl_1234567890abcdef');
    }
  });

  it('handles empty notes string cleanly by converting to undefined', () => {
    const parsed = createIncidentSchema.safeParse({
      interactions: ['clicked_link'],
      notes: '   '
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.notes).toBeUndefined();
    }
  });

  it('rejects empty interactions array', () => {
    const parsed = createIncidentSchema.safeParse({
      interactions: []
    });

    expect(parsed.success).toBe(false);
  });
});
