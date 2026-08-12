'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppMode } from '@/lib/env';

export interface StoreSettings {
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  facebookUrl: string;
  instagramUrl: string;
  cashbackPercent: number;
}

export interface FlashSalePackage {
  id: string;
  name: string;
  priceVnd: number; // price in VND
  bonusPoints: number; // total points received (more than priceVnd)
  bonusPercent: number; // display bonus %
  startDate: string;
  endDate: string;
  maxQuantity: number;
  soldQuantity: number;
  isActive: boolean;
}

export interface StoreSettingsContextType {
  settings: StoreSettings;
  updateSettings: (partial: Partial<StoreSettings & { cashbackPercent: number }>) => void;
  flashSales: FlashSalePackage[];
  createFlashSale: (pkg: Omit<FlashSalePackage, 'id' | 'soldQuantity'>) => FlashSalePackage;
  updateFlashSale: (id: string, updates: Partial<FlashSalePackage>) => void;
  deleteFlashSale: (id: string) => void;
}

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  address: 'Số 25-27 Thanh Bình, Phường Lê Thanh Nghị, TP. Hải Phòng',
  phone: '0937 936 688',
  email: 'contact@beanbus.vn',
  openingHours: '07:00 – 23:00',
  facebookUrl: 'https://facebook.com/beanbus',
  instagramUrl: 'https://instagram.com/beanbus',
  cashbackPercent: 0,
};

const DEFAULT_FLASH_SALES: FlashSalePackage[] = [
  {
    id: 'flash-1',
    name: 'Gói Hè Sôi Động',
    priceVnd: 50000,
    bonusPoints: 70000,
    bonusPercent: 40,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    maxQuantity: 100,
    soldQuantity: 34,
    isActive: true,
  },
  {
    id: 'flash-2',
    name: 'Gói Tiết Kiệm',
    priceVnd: 100000,
    bonusPoints: 150000,
    bonusPercent: 50,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    maxQuantity: 50,
    soldQuantity: 12,
    isActive: true,
  },
];

const StoreSettingsContext = createContext<StoreSettingsContextType | undefined>(undefined);

export const StoreSettingsProvider: React.FC<{ children: React.ReactNode; mode?: AppMode }> = ({ children, mode = 'demo' }) => {
  const isDemo = mode === 'demo';
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [flashSales, setFlashSales] = useState<FlashSalePackage[]>(DEFAULT_FLASH_SALES);

  /* eslint-disable react-hooks/set-state-in-effect -- Prototype settings hydrate from browser storage until server persistence lands. */
  useEffect(() => {
    if (!isDemo) return;
    try {
      const savedSettings = localStorage.getItem('beanbus_store_settings');
      if (savedSettings) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(savedSettings) }));
      } else {
        localStorage.setItem('beanbus_store_settings', JSON.stringify(DEFAULT_STORE_SETTINGS));
      }

      const savedFlashSales = localStorage.getItem('beanbus_flash_sales');
      if (savedFlashSales) {
        setFlashSales(JSON.parse(savedFlashSales));
      } else {
        localStorage.setItem('beanbus_flash_sales', JSON.stringify(DEFAULT_FLASH_SALES));
      }
    } catch (e) {
      console.error('Error loading store settings or flash sales from localStorage:', e);
    }
  }, [isDemo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateSettings = (partial: Partial<StoreSettings & { cashbackPercent: number }>) => {
    if (!isDemo) return;
    setSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem('beanbus_store_settings', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving store settings to localStorage:', e);
      }
      return updated;
    });
  };

  const createFlashSale = (pkg: Omit<FlashSalePackage, 'id' | 'soldQuantity'>): FlashSalePackage => {
    const newPackage: FlashSalePackage = {
      ...pkg,
      id: `flash-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      soldQuantity: 0,
    };
    if (!isDemo) return newPackage;

    setFlashSales((prev) => {
      const updated = [...prev, newPackage];
      try {
        localStorage.setItem('beanbus_flash_sales', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving flash sales to localStorage:', e);
      }
      return updated;
    });

    return newPackage;
  };

  const updateFlashSale = (id: string, updates: Partial<FlashSalePackage>) => {
    if (!isDemo) return;
    setFlashSales((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      try {
        localStorage.setItem('beanbus_flash_sales', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving flash sales to localStorage:', e);
      }
      return updated;
    });
  };

  const deleteFlashSale = (id: string) => {
    if (!isDemo) return;
    setFlashSales((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem('beanbus_flash_sales', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving flash sales to localStorage:', e);
      }
      return updated;
    });
  };

  return (
    <StoreSettingsContext.Provider
      value={{
        settings,
        updateSettings,
        flashSales,
        createFlashSale,
        updateFlashSale,
        deleteFlashSale,
      }}
    >
      {children}
    </StoreSettingsContext.Provider>
  );
};

export const useStoreSettings = () => {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    throw new Error('useStoreSettings must be used within a StoreSettingsProvider');
  }
  return context;
};
