import { describe, expect, it } from 'vitest';

import { evaluateStaticUrlSignals, normalizeSubmittedUrl, UrlInputError } from './urlSafety.service.js';

describe('URL safety boundary', () => {
  it('marks a loopback target unsafe for remote lookup', () => {
    const result = normalizeSubmittedUrl('http://127.0.0.1:8080/internal');
    expect(result.safeForRemoteLookup).toBe(false);
    expect(result.safetyIssues).toContain('private_or_reserved_host');
    expect(result.safetyIssues).toContain('non_standard_port');
    expect(evaluateStaticUrlSignals(result, 'evd_test').map((item) => item.code)).toContain('url_private_target_blocked');
  });

  it('does not accept non-web schemes', () => {
    expect(() => normalizeSubmittedUrl('file:///etc/passwd')).toThrow(UrlInputError);
    try {
      normalizeSubmittedUrl('file:///etc/passwd');
    } catch (error) {
      expect(error).toMatchObject({ code: 'unsupported_scheme' });
    }
  });

  it('flags a shortener without navigating to it', () => {
    const result = normalizeSubmittedUrl('https://bit.ly/account-check');
    expect(result.safeForRemoteLookup).toBe(true);
    expect(evaluateStaticUrlSignals(result, 'evd_test').map((item) => item.code)).toEqual(expect.arrayContaining(['url_shortener', 'url_sensitive_theme']));
  });
});
