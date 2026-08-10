import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actionForms = [
  'app/account/AccountClient.tsx',
  'app/account/RewardRedeemForm.tsx',
  'app/account/orders/ReorderOrderForm.tsx',
  'app/admin/catalog/ProductEditorForm.tsx',
  'app/admin/catalog/ProductStatusForm.tsx',
  'app/admin/content/BlogEditorForm.tsx',
  'app/admin/content/ContentPublicationForm.tsx',
  'app/admin/content/EventEditorForm.tsx',
  'app/admin/loyalty/LoyaltyPolicyForm.tsx',
  'app/admin/members/MemberRoleForm.tsx',
  'app/admin/orders/OrderStatusForm.tsx',
  'app/admin/requests/RequestStatusForm.tsx',
  'app/admin/rewards/RewardEditorForm.tsx',
  'app/admin/stored-value/FlashSaleCampaignForm.tsx',
  'app/admin/stored-value/StoredValuePolicyForm.tsx',
  'app/admin/stored-value/TopupPackageForm.tsx',
  'app/admin/vouchers/VoucherEditorForm.tsx',
];

test('action feedback announces errors assertively and successes politely', () => {
  for (const file of actionForms) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /role=\{(?:state|profileState|reorderState)\.status === 'error' \? 'alert' : 'status'\}/, file);
    assert.match(source, /aria-live=\{(?:state|profileState|reorderState)\.status === 'error' \? 'assertive' : 'polite'\}/, file);
  }
});
