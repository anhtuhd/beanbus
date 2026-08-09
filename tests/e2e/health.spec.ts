import { expect, test } from '@playwright/test';

test('health endpoint is uncached and preserves a safe correlation ID', async ({ request }) => {
  const response = await request.get('/api/health', {
    headers: { 'x-request-id': 'req_health_check_01' },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['x-request-id']).toBe('req_health_check_01');
  expect(await response.json()).toEqual({ status: 'ok', mode: 'demo' });
});
