import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionSource = readFileSync(new URL('../app/admin/content/actions.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/admin/content/page.tsx', import.meta.url), 'utf8');

test('admin content action authorizes before audited publication RPCs', () => {
  const authorization = actionSource.indexOf('await requireAdmin()');
  const eventRpc = actionSource.indexOf("supabase.rpc('update_event_publication'");
  const blogRpc = actionSource.indexOf("supabase.rpc('update_blog_post_publication'");
  assert.ok(authorization >= 0 && authorization < eventRpc && authorization < blogRpc);
  assert.doesNotMatch(actionSource, /\.update\(/);
  assert.match(actionSource, /revalidatePath\('\/admin\/content'\)/);
  assert.match(actionSource, /revalidatePath\('\/events'\)/);
  assert.match(actionSource, /revalidatePath\('\/blog'\)/);
});
test('admin content page is guarded, filtered, and paginated', () => {
  assert.match(pageSource, /await requireAdmin\(\)/);
  assert.match(pageSource, /PAGE_SIZE = 20/);
  assert.match(pageSource, /\.range\(from, from \+ PAGE_SIZE - 1\)/);
  assert.match(pageSource, /ContentPublicationForm/);
  assert.doesNotMatch(pageSource, /\.select\('\*'/);
});
