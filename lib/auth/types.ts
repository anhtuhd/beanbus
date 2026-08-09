import type { Database, ProfileRow } from '@/lib/supabase/database.types';

export type AppRole = Database['public']['Enums']['app_role'];
export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export type SessionProfile = {
  id: string;
  memberCode: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  avatar?: string;
  role: AppRole;
  joinedDate: string;
};

export type UserProfile = SessionProfile & {
  tier: Tier;
  points: number;
  totalSpent: number;
};

export function toSessionProfile(profile: ProfileRow): SessionProfile {
  return {
    id: profile.id,
    memberCode: `BB-${String(profile.member_number).padStart(8, '0')}`,
    name: profile.full_name || 'Thành viên Beanbus',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    birthday: profile.birthday ?? '',
    avatar: profile.avatar_url ?? undefined,
    role: profile.role,
    joinedDate: profile.created_at,
  };
}

export function toUserProfile(profile: SessionProfile): UserProfile {
  return {
    ...profile,
    tier: 'Bronze',
    points: 0,
    totalSpent: 0,
  };
}
