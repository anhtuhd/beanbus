import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const playwrightConfig = fs.readFileSync('playwright.config.ts', 'utf8');
const packageJson = fs.readFileSync('package.json', 'utf8');
const productionRequestsE2e = fs.readFileSync('tests/e2e/customer-requests-production.spec.ts', 'utf8');

test('CI quality job runs the committed quality gates', () => {
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /permissions:\n  contents: read/);
});

test('CI E2E job covers demo and production-gated flows', () => {
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /npm run test:e2e/);
  assert.match(workflow, /npm run test:e2e:auth/);
  assert.match(workflow, /npm run test:e2e:checkout-production/);
  assert.match(workflow, /npm run test:e2e:checkout-sepay/);
  assert.match(workflow, /npm run test:e2e:requests/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
});

test('Playwright does not silently reuse a differently configured local server', () => {
  assert.match(playwrightConfig, /PLAYWRIGHT_PORT \?\? '3101'/);
  assert.match(playwrightConfig, /PLAYWRIGHT_REUSE_SERVER === 'true'/);
  assert.match(playwrightConfig, /NEXT_DIST_DIR: '\.next-e2e'/);
  assert.match(packageJson, /PLAYWRIGHT_PORT=3101 NEXT_PUBLIC_APP_MODE=production/);
  assert.doesNotMatch(packageJson, /NEXT_PUBLIC_SITE_URL=http:\/\/127\.0\.0\.1:3100/);
  assert.match(productionRequestsE2e, /requiresPublishedEvents/);
  assert.match(productionRequestsE2e, /configured Supabase content runtime/);
  assert.match(productionRequestsE2e, /requiresPublishedCatalog/);
  assert.match(productionRequestsE2e, /configured published catalog/);
});

test('CI database job starts Supabase and executes SQL checks', () => {
  assert.match(workflow, /supabase\/setup-cli@v2/);
  assert.match(workflow, /supabase db start/);
  assert.match(workflow, /supabase db lint --local --level warning/);
  assert.match(workflow, /supabase test db/);
});
