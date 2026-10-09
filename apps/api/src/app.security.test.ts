import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('HTTP security baseline', () => {
  it('exposes a no-store liveness check with security headers', async () => {
    const response = await request(createApp()).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { status: 'ok' } });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects a state-changing browser request without a CSRF token before account handling', async () => {
    const response = await request(createApp())
      .post('/api/auth/register')
      .send({ displayName: 'Test User', email: 'test@example.com', password: 'very-long-test-password' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('issues a signed CSRF token and accepts it in header without cookies (cross-site/mobile scenario)', async () => {
    const app = createApp();
    const csrfRes = await request(app).get('/api/auth/csrf');
    expect(csrfRes.status).toBe(200);
    const token = csrfRes.body.data.csrfToken;
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    // Send request with X-CSRF-Token header but NO cookie (simulating mobile browser with blocked 3rd-party cookies)
    const postRes = await request(app)
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ displayName: '', email: 'invalid-email', password: 'short' });

    // Should pass CSRF middleware and reach request validation (status 400), NOT rejected with 403 CSRF_TOKEN_INVALID
    expect(postRes.status).toBe(400);
    expect(postRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a tampered or invalid CSRF token without cookies', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/auth/register')
      .set('X-CSRF-Token', 'tampered.token.signature')
      .send({ displayName: 'Test', email: 'test@example.com', password: 'password123' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });
});
