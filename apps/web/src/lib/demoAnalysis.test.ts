import { describe, expect, it } from 'vitest';
import { createLocalDemoAnalysis } from './demoAnalysis';

describe('createLocalDemoAnalysis', () => {
  it('raises structured independent signals for an urgent OTP payment message', () => {
    const result = createLocalDemoAnalysis({
      evidence: [{ clientId: 't1', kind: 'text', content: 'Urgent: your PayPal account will be suspended. Send your OTP and pay ₹500 today at https://paypal-security.example/verify.' }],
    });

    expect(result.localOnly).toBe(true);
    expect(result.riskAssessment.level).toMatch(/high|critical/);
    expect(result.findings.map((finding) => finding.category)).toEqual(expect.arrayContaining(['urgency', 'credential_request', 'payment_request', 'impersonation']));
    expect(result.verificationGuidance[0]?.warning).toContain('Do not use');
  });

  it('does not call a low-signal message legitimate', () => {
    const result = createLocalDemoAnalysis({
      evidence: [{ clientId: 't2', kind: 'text', content: 'Can we talk later this week?' }],
    });

    expect(result.riskAssessment.level).toBe('unclear');
    expect(result.riskAssessment.limitations.join(' ')).toContain('not proof');
  });
});
