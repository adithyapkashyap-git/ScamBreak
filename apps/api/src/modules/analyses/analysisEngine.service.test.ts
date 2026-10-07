import { describe, expect, it } from 'vitest';

import { AnalysisEngine } from './analysisEngine.service.js';

describe('AnalysisEngine', () => {
  it('runs multiple independent defensive signals and produces a structured action plan', async () => {
    const engine = new AnalysisEngine();
    const result = await engine.analyze({
      locale: 'en',
      evidence: [{
        publicId: 'evd_test',
        type: 'message',
        channel: 'sms',
        text: 'Urgent! Your bank account will be suspended today. Send your OTP and pay ₹500 through https://bit.ly/verify-now.',
      }],
    });

    const codes = result.findings.filter((finding) => finding.state === 'detected').map((finding) => finding.code);
    expect(codes).toEqual(expect.arrayContaining(['urgency_pressure', 'credential_or_otp_request', 'unusual_payment_request', 'url_shortener']));
    expect(result.risk.level).toBe('critical');
    expect(result.safeActions.map((item) => item.key)).toEqual(expect.arrayContaining(['do_not_share_credentials', 'do_not_pay', 'do_not_click']));
    expect(result.limitations.join(' ')).toContain('No external reputation provider');
  });
});
