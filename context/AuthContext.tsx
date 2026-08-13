'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { currentWebPushFid } from '@/lib/notifications/firebase-client';
import { toSessionProfile, toUserProfile } from '@/lib/auth/types';
import type { AppMode } from '@/lib/env';
import type { Tier, UserProfile } from '@/lib/auth/types';

export type { Tier, UserProfile } from '@/lib/auth/types';

export interface PointsTransaction {
  id: string;
  type: 'topup' | 'spend' | 'cashback' | 'flash_sale' | 'redeem_reward';
  amount: number; // positive = credit, negative = debit
  description: string;
  createdAt: string;
  balanceAfter: number;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isAuthReady: boolean;
  loginWithPhone: (phone: string, otp: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  // Points system — 1 VND = 1 point
  addPoints: (amountSpent: number) => void;
  topUpPoints: (amountVnd: number) => void;
  topUpFlashSale: (amountVnd: number, bonusPoints: number) => void;
  spendPoints: (pointsToSpend: number) => boolean;
  cashbackPoints: (orderTotal: number, cashbackPercent: number) => void;
  redeemPoints: (pointsCost: number) => boolean;
  updateProfile: (updated: Partial<UserProfile>) => void;
  // Transactions history
  transactions: PointsTransaction[];
}

const DEFAULT_USER: UserProfile = {
  id: 'usr-8892',
  memberCode: 'BB-8892',
  name: 'Nguyễn Văn Bean',
  phone: '0987 654 321',
  email: 'khachhang@beanbus.vn',
  birthday: '1995-10-15',
  tier: 'Gold',
  points: 680000, // 680,000 points = 680,000đ value
  totalSpent: 2450000,
  joinedDate: '2025-11-10',
  role: 'member',
};

const INITIAL_TRANSACTIONS: PointsTransaction[] = [
  {
    id: 'txn-001',
    type: 'topup',
    amount: 200000,
    description: 'Nạp điểm qua Sepay QR',
    createdAt: '2026-08-05T10:30:00Z',
    balanceAfter: 500000,
  },
  {
    id: 'txn-002',
    type: 'flash_sale',
    amount: 70000,
    description: 'Flash Sale: Gói Hè Sôi Động — Nạp 50.000đ nhận 70.000 điểm',
    createdAt: '2026-08-06T14:00:00Z',
    balanceAfter: 570000,
  },
  {
    id: 'txn-003',
    type: 'spend',
    amount: -105000,
    description: 'Thanh toán đơn hàng BB-2026-8801 bằng điểm',
    createdAt: '2026-08-07T09:15:00Z',
    balanceAfter: 465000,
  },
  {
    id: 'txn-004',
    type: 'cashback',
    amount: 5000,
    description: 'Cashback 5% từ đơn hàng 100.000đ',
    createdAt: '2026-08-08T11:00:00Z',
    balanceAfter: 470000,
  },
  {
    id: 'txn-005',
    type: 'topup',
    amount: 210000,
    description: 'Nạp điểm qua Sepay QR',
    createdAt: '2026-08-09T08:00:00Z',
    balanceAfter: 680000,
  },
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode; mode: AppMode }> = ({
  children,
  mode,
}) => {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(mode === 'demo' ? DEFAULT_USER : null);
  const [isAuthReady, setIsAuthReady] = useState(mode === 'demo');
  const [transactions, setTransactions] = useState<PointsTransaction[]>(
    mode === 'demo' ? INITIAL_TRANSACTIONS : []
  );

  /* eslint-disable react-hooks/set-state-in-effect -- Hydrate mode-specific auth state after the client mounts. */
  useEffect(() => {
    if (mode === 'production') {
      const supabase = createBrowserSupabaseClient();
      let active = true;
      let loadVersion = 0;

      const loadProfile = async () => {
        const version = ++loadVersion;
        try {
          const { data: claimsData } = await supabase.auth.getClaims();
          const userId = claimsData?.claims?.sub;

          if (!userId) {
            if (active && version === loadVersion) setUser(null);
            return;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('id, member_number, full_name, phone, email, birthday, avatar_url, role, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle();

          if (active && version === loadVersion) setUser(profile ? toUserProfile(toSessionProfile(profile)) : null);
        } catch {
          if (active && version === loadVersion) setUser(null);
        } finally {
          if (active && version === loadVersion) setIsAuthReady(true);
        }
      };

      void loadProfile();
      const { data: listener } = supabase.auth.onAuthStateChange(() => {
        setIsAuthReady(false);
        window.setTimeout(() => void loadProfile(), 0);
      });

      return () => {
        active = false;
        loadVersion += 1;
        listener.subscription.unsubscribe();
      };
    }

    try {
      const savedUser = localStorage.getItem('beanbus_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        setUser(DEFAULT_USER);
        localStorage.setItem('beanbus_user', JSON.stringify(DEFAULT_USER));
      }

      const savedTxn = localStorage.getItem('beanbus_transactions');
      if (savedTxn) {
        setTransactions(JSON.parse(savedTxn));
      } else {
        setTransactions(INITIAL_TRANSACTIONS);
        localStorage.setItem('beanbus_transactions', JSON.stringify(INITIAL_TRANSACTIONS));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthReady(true);
    }
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveUser = (newUser: UserProfile | null) => {
    setUser(newUser);
    if (mode !== 'demo') return;

    if (newUser) {
      localStorage.setItem('beanbus_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('beanbus_user');
    }
  };

  const saveTransactions = (txns: PointsTransaction[]) => {
    if (mode !== 'demo') return;
    setTransactions(txns);
    localStorage.setItem('beanbus_transactions', JSON.stringify(txns));
  };

  const addTransaction = (
    type: PointsTransaction['type'],
    amount: number,
    description: string,
    balanceAfter: number
  ) => {
    const newTxn: PointsTransaction = {
      id: `txn-${Date.now()}`,
      type,
      amount,
      description,
      createdAt: new Date().toISOString(),
      balanceAfter,
    };
    const updated = [newTxn, ...transactions];
    saveTransactions(updated);
  };

  const loginWithPhone = async (phone: string, otp: string): Promise<boolean> => {
    if (mode !== 'demo') return false;
    if (otp.length >= 4) {
      const loggedUser: UserProfile = {
        ...DEFAULT_USER,
        phone,
      };
      saveUser(loggedUser);
      return true;
    }
    return false;
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    if (mode !== 'demo') return false;
    const loggedUser: UserProfile = {
      ...DEFAULT_USER,
      name: 'Nguyễn Tuấn Anh',
      email: 'tuananh.coffee@gmail.com',
    };
    saveUser(loggedUser);
    return true;
  };

  const logout = () => {
    if (mode === 'production') {
      void (async () => {
        try {
          if (user && process.env.NEXT_PUBLIC_ENABLE_WEB_PUSH === 'true') {
            const fid = currentWebPushFid();
            if (fid) {
              await fetch('/api/push/installations', {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ fid, scope: 'current-user' }),
              }).catch(() => undefined);
            }
          }
          await createBrowserSupabaseClient().auth.signOut();
        } finally {
          setUser(null);
          router.replace('/');
          router.refresh();
        }
      })();
      return;
    }

    saveUser(null);
  };

  const calculateTier = (totalSpent: number): Tier => {
    if (totalSpent >= 5000000) return 'Platinum';
    if (totalSpent >= 2000000) return 'Gold';
    if (totalSpent >= 500000) return 'Silver';
    return 'Bronze';
  };

  // Legacy: addPoints from spending real money (updates totalSpent + tier)
  const addPoints = (amountSpent: number) => {
    if (mode !== 'demo' || !user) return;
    const newTotalSpent = user.totalSpent + amountSpent;
    const newTier = calculateTier(newTotalSpent);
    const updated: UserProfile = {
      ...user,
      totalSpent: newTotalSpent,
      tier: newTier,
    };
    saveUser(updated);
  };

  // Top-up: pay VND via Sepay → receive equivalent points (1 VND = 1 point)
  const topUpPoints = (amountVnd: number) => {
    if (mode !== 'demo' || !user) return;
    const newPoints = user.points + amountVnd;
    const updated: UserProfile = {
      ...user,
      points: newPoints,
    };
    saveUser(updated);
    addTransaction('topup', amountVnd, `Nạp ${amountVnd.toLocaleString('vi-VN')}đ → ${amountVnd.toLocaleString('vi-VN')} điểm qua Sepay QR`, newPoints);
  };

  // Flash Sale top-up: pay priceVnd → receive bonusPoints (more than priceVnd)
  const topUpFlashSale = (amountVnd: number, bonusPoints: number) => {
    if (mode !== 'demo' || !user) return;
    const newPoints = user.points + bonusPoints;
    const updated: UserProfile = {
      ...user,
      points: newPoints,
    };
    saveUser(updated);
    addTransaction(
      'flash_sale',
      bonusPoints,
      `Flash Sale: Nạp ${amountVnd.toLocaleString('vi-VN')}đ → ${bonusPoints.toLocaleString('vi-VN')} điểm`,
      newPoints
    );
  };

  // Spend points on an order (1 point = 1 VND deducted from order total)
  const spendPoints = (pointsToSpend: number): boolean => {
    if (mode !== 'demo' || !user || user.points < pointsToSpend) return false;
    const newPoints = user.points - pointsToSpend;
    const updated: UserProfile = {
      ...user,
      points: newPoints,
    };
    saveUser(updated);
    addTransaction(
      'spend',
      -pointsToSpend,
      `Thanh toán ${pointsToSpend.toLocaleString('vi-VN')} điểm cho đơn hàng`,
      newPoints
    );
    return true;
  };

  // Cashback: after paying real money, receive cashback % as points
  const cashbackPoints = (orderTotal: number, cashbackPercent: number) => {
    if (mode !== 'demo' || !user || cashbackPercent <= 0) return;
    const cashback = Math.floor(orderTotal * cashbackPercent / 100);
    if (cashback <= 0) return;
    const newPoints = user.points + cashback;
    const updated: UserProfile = {
      ...user,
      points: newPoints,
    };
    saveUser(updated);
    addTransaction(
      'cashback',
      cashback,
      `Cashback ${cashbackPercent}% từ đơn ${orderTotal.toLocaleString('vi-VN')}đ → +${cashback.toLocaleString('vi-VN')} điểm`,
      newPoints
    );
  };

  // Redeem points for rewards (from reward catalog)
  const redeemPoints = (pointsCost: number): boolean => {
    if (mode !== 'demo' || !user || user.points < pointsCost) return false;
    const newPoints = user.points - pointsCost;
    const updated: UserProfile = {
      ...user,
      points: newPoints,
    };
    saveUser(updated);
    addTransaction(
      'redeem_reward',
      -pointsCost,
      `Đổi quà: -${pointsCost.toLocaleString('vi-VN')} điểm`,
      newPoints
    );
    return true;
  };

  const updateProfile = (updated: Partial<UserProfile>) => {
    if (mode !== 'demo' || !user) return;
    saveUser({ ...user, ...updated });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAuthReady,
        loginWithPhone,
        loginWithGoogle,
        logout,
        addPoints,
        topUpPoints,
        topUpFlashSale,
        spendPoints,
        cashbackPoints,
        redeemPoints,
        updateProfile,
        transactions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
