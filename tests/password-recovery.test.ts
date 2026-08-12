import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRecoveryCapability,
  verifyRecoveryCapability,
} from '../lib/auth/password-recovery.ts';

test('password recovery capability is signed and bound to its user', async () => {
  const previousSecret = process.env.PASSWORD_RECOVERY_SECRET;
  process.env.PASSWORD_RECOVERY_SECRET = 'password-recovery-test-secret';

  try {
    const capability = await createRecoveryCapability('user-a');
    assert.equal(await verifyRecoveryCapability(capability, 'user-a'), true);
    assert.equal(await verifyRecoveryCapability(capability, 'user-b'), false);
    assert.equal(await verifyRecoveryCapability(`${capability}tampered`, 'user-a'), false);
  } finally {
    if (previousSecret === undefined) delete process.env.PASSWORD_RECOVERY_SECRET;
    else process.env.PASSWORD_RECOVERY_SECRET = previousSecret;
  }
});
