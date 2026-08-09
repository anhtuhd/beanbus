import assert from 'node:assert/strict';
import test from 'node:test';
import { toSessionProfile, toUserProfile } from '../lib/auth/types.ts';
import type { ProfileRow } from '../lib/supabase/database.types.ts';

const profile: ProfileRow = {
  avatar_url: null,
  birthday: null,
  created_at: '2026-08-09T00:00:00Z',
  email: 'member@beanbus.test',
  full_name: 'Beanbus Member',
  id: '11111111-1111-4111-8111-111111111111',
  member_number: 42,
  phone: '+84987654321',
  role: 'member',
  updated_at: '2026-08-09T00:00:00Z',
};

test('profile DTO exposes only the account fields the UI needs', () => {
  assert.deepEqual(toSessionProfile(profile), {
    id: profile.id,
    memberCode: 'BB-00000042',
    name: 'Beanbus Member',
    phone: '+84987654321',
    email: 'member@beanbus.test',
    birthday: '',
    avatar: undefined,
    role: 'member',
    joinedDate: profile.created_at,
  });
});

test('new production profiles do not receive browser-created loyalty value', () => {
  const user = toUserProfile(toSessionProfile(profile));

  assert.equal(user.points, 0);
  assert.equal(user.totalSpent, 0);
  assert.equal(user.tier, 'Bronze');
});
