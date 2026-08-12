import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const functionDeployWorkflow = fs.readFileSync('.github/workflows/deploy-supabase-functions.yml', 'utf8');
const sepayReconciliationWorkflow = fs.readFileSync('.github/workflows/sepay-reconciliation.yml', 'utf8');
const playwrightConfig = fs.readFileSync('playwright.config.ts', 'utf8');
const packageJson = fs.readFileSync('package.json', 'utf8');
const productionRequestsE2e = fs.readFileSync('tests/e2e/customer-requests-production.spec.ts', 'utf8');
const productionLiveE2e = fs.readFileSync('tests/e2e/production-live.spec.ts', 'utf8');

test('CI quality job runs the committed quality gates', () => {
  assert.match(workflow, /push:\n    branches: \[main, 'codex\/\*\*'\]/);
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
  assert.match(workflow, /NEXT_PUBLIC_APP_MODE: demo/);
  assert.match(workflow, /NEXT_PUBLIC_ENABLE_SEPAY: 'false'/);
  assert.match(workflow, /NEXT_PUBLIC_ENABLE_STORED_VALUE: 'false'/);
  assert.match(workflow, /PLAYWRIGHT_REUSE_SERVER: 'false'/);
  assert.match(workflow, /npx playwright install --with-deps chromium/);
  assert.match(workflow, /npm run test:e2e -- --workers=1/);
  assert.match(workflow, /npm run test:e2e:auth/);
  assert.match(workflow, /npm run test:e2e:checkout-production/);
  assert.match(workflow, /npm run test:e2e:checkout-sepay/);
  assert.match(workflow, /npm run test:e2e:requests/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
});

test('CI exposes a manual production smoke workflow without production credentials', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /production_base_url:/);
  assert.match(workflow, /live-smoke:/);
  assert.match(workflow, /PLAYWRIGHT_BASE_URL:/);
  assert.match(workflow, /PLAYWRIGHT_LIVE: ['"]true['"]/);
  assert.match(workflow, /npm run test:e2e:live/);
  assert.match(packageJson, /PLAYWRIGHT_BASE_URL:-https:\/\/www\.beanbus\.store/);
  assert.match(productionLiveE2e, /new URL\(liveBaseUrl!\)\.protocol/);
  assert.match(productionLiveE2e, /toBe\('https:'\)/);
});

test('Playwright does not silently reuse a differently configured local server', () => {
  assert.match(playwrightConfig, /PLAYWRIGHT_PORT \?\? '3101'/);
  assert.match(playwrightConfig, /PLAYWRIGHT_BASE_URL/);
  assert.match(playwrightConfig, /useExternalServer/);
  assert.match(playwrightConfig, /PLAYWRIGHT_REUSE_SERVER === 'true'/);
  assert.match(playwrightConfig, /NEXT_DIST_DIR: '\.next-e2e'/);
  assert.match(packageJson, /PLAYWRIGHT_PORT=3101 NEXT_PUBLIC_APP_MODE=production/);
  assert.match(packageJson, /test:e2e:live/);
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
  assert.match(workflow, /tee pgtap-output\.log/);
  assert.match(workflow, /name: pgtap-output/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.match(workflow, /title=pgTAP failure/);
});

test('Supabase function deployment is manual, scoped, and secret-backed', () => {
  assert.match(functionDeployWorkflow, /workflow_dispatch:/);
  assert.match(functionDeployWorkflow, /SUPABASE_ACCESS_TOKEN: \$\{\{ secrets\.SUPABASE_ACCESS_TOKEN \}\}/);
  assert.match(functionDeployWorkflow, /SUPABASE_PROJECT_REF: \$\{\{ vars\.SUPABASE_PROJECT_REF \}\}/);
  assert.match(functionDeployWorkflow, /test -n "\$SUPABASE_ACCESS_TOKEN"/);
  assert.match(functionDeployWorkflow, /--no-verify-jwt/);
  assert.match(functionDeployWorkflow, /dispatch-notification-emails/);
  assert.match(functionDeployWorkflow, /resend-webhook/);
  assert.match(functionDeployWorkflow, /email-unsubscribe/);
  assert.match(functionDeployWorkflow, /environment: production/);
});

test('SePay reconciliation has a disabled-by-default external scheduler', () => {
  assert.match(sepayReconciliationWorkflow, /schedule:\n    - cron: ['"]\*\/15 \* \* \* \*['"]/);
  assert.match(sepayReconciliationWorkflow, /workflow_dispatch:/);
  assert.match(sepayReconciliationWorkflow, /SEPAY_RECONCILIATION_ENABLED == ['"]true['"]/);
  assert.match(sepayReconciliationWorkflow, /BEANBUS_CRON_SECRET/);
  assert.match(sepayReconciliationWorkflow, /Authorization: Bearer \$CRON_SECRET/);
  assert.match(sepayReconciliationWorkflow, /https:\/\/www\.beanbus\.store\/api\/cron\/sepay-reconciliation/);
  assert.doesNotMatch(sepayReconciliationWorkflow, /NEXT_PUBLIC_ENABLE_SEPAY.*true/);
});
