/**
 * useTranslation Hook
 * Provides translation function and current locale
 */

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import type { Locale } from '@/lib/i18n';
import { locales, defaultLocale, getBrowserLocale, getLocalePreference } from '@/lib/i18n';
import { getTranslation } from '@/locales';

export function useTranslation() {
  const pathname = usePathname();
  
  const locale = useMemo(() => {
    // Check URL path first
    const pathSegments = pathname.split('/');
    const pathLocale = pathSegments[1] as Locale;
    
    if (locales.includes(pathLocale)) {
      return pathLocale;
    }
    
    // Check localStorage preference
    const preference = getLocalePreference();
    if (preference) {
      return preference;
    }
    
    // Check browser language
    return getBrowserLocale();
  }, [pathname]);
  
  const t = useMemo(() => getTranslation(locale), [locale]);
  
  return { t, locale };
}

/**
 * Helper to interpolate variables in translation strings
 */
export function interpolate(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? String(vars[key]) : match;
  });
}
