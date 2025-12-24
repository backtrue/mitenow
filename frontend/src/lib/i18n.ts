/**
 * i18n Configuration and Utilities
 * Supports: en (English), tw (Traditional Chinese), jp (Japanese)
 */

export type Locale = 'en' | 'tw' | 'jp';

export const locales: Locale[] = ['en', 'tw', 'jp'];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  tw: '繁體中文',
  jp: '日本語',
};

/**
 * Detect locale from various sources
 */
export function detectLocale(
  pathname: string,
  acceptLanguage?: string,
  countryCode?: string
): Locale {
  // 1. Check URL path (/tw, /jp)
  const pathLocale = pathname.split('/')[1] as Locale;
  if (locales.includes(pathLocale)) {
    return pathLocale;
  }

  // 2. Check country code from IP (Cloudflare provides this)
  if (countryCode) {
    if (countryCode === 'TW' || countryCode === 'HK') return 'tw';
    if (countryCode === 'JP') return 'jp';
  }

  // 3. Check Accept-Language header
  if (acceptLanguage) {
    const lang = acceptLanguage.toLowerCase();
    if (lang.includes('zh-tw') || lang.includes('zh-hk')) return 'tw';
    if (lang.includes('ja') || lang.includes('jp')) return 'jp';
    if (lang.includes('zh-cn')) return 'tw'; // Fallback to TW for CN
  }

  return defaultLocale;
}

/**
 * Get locale from browser
 */
export function getBrowserLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;

  const lang = navigator.language.toLowerCase();
  
  if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk')) return 'tw';
  if (lang.startsWith('ja')) return 'jp';
  
  return defaultLocale;
}

/**
 * Store locale preference
 */
export function setLocalePreference(locale: Locale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('locale', locale);
}

/**
 * Get stored locale preference
 */
export function getLocalePreference(): Locale | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('locale');
  return stored && locales.includes(stored as Locale) ? (stored as Locale) : null;
}

/**
 * Get locale path prefix
 */
export function getLocalePath(locale: Locale): string {
  return locale === defaultLocale ? '' : `/${locale}`;
}

/**
 * Remove locale prefix from path
 */
export function removeLocalePrefix(pathname: string): string {
  const pathLocale = pathname.split('/')[1] as Locale;
  if (locales.includes(pathLocale)) {
    return pathname.substring(pathLocale.length + 1) || '/';
  }
  return pathname;
}
