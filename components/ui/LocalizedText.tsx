'use client';

import { useLanguage } from '@/context/LanguageContext';

export function LocalizedText({ vi, en }: { vi: string; en: string }) {
  const { t } = useLanguage();
  return <>{t(vi, en)}</>;
}
