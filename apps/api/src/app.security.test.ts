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
});
