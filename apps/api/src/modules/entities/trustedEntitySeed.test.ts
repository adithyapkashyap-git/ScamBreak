import { describe, expect, it } from 'vitest';

import { builtInTrustedEntities } from './trustedEntitySeed.service.js';

describe('builtInTrustedEntities', () => {
  it('contains essential trusted entities with valid official domains', () => {
    expect(builtInTrustedEntities.length).toBeGreaterThanOrEqual(10);

    for (const entity of builtInTrustedEntities) {
      expect(entity.name).toBeDefined();
      expect(entity.name.length).toBeGreaterThan(1);
      expect(entity.officialDomains.length).toBeGreaterThan(0);
      expect(entity.verificationSource.length).toBeGreaterThan(5);

      for (const domain of entity.officialDomains) {
        expect(domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/i);
        expect(domain).not.toContain('http');
      }

      for (const channel of entity.officialSupportChannels) {
        expect(['website', 'phone', 'email', 'app', 'in_person']).toContain(channel.type);
        expect(channel.verified).toBe(true);
      }
    }
  });

  it('includes key brands for impersonation protection', () => {
    const names = builtInTrustedEntities.map((e) => e.name);
    expect(names).toContain('PayPal');
    expect(names).toContain('Amazon');
    expect(names).toContain('United States Postal Service');
    expect(names).toContain('Apple');
    expect(names).toContain('Microsoft');
    expect(names).toContain('Internal Revenue Service');
  });
});
