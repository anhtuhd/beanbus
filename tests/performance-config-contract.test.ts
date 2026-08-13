import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  regions?: string[];
};

test('Vercel functions run near the Supabase ap-northeast-1 database', () => {
  assert.deepEqual(vercelConfig.regions, ['hnd1']);
});
