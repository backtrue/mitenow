import { en } from './en';
import { tw } from './tw';
import { jp } from './jp';
import type { Locale } from '@/lib/i18n';

export const translations = {
  en,
  tw,
  jp,
};

export function getTranslation(locale: Locale) {
  return translations[locale] || translations.en;
}
