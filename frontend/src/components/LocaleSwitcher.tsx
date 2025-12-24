'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { locales, localeNames, removeLocalePrefix, getLocalePath, setLocalePreference } from '@/lib/i18n';

export function LocaleSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  
  const currentLocale = (pathname.split('/')[1] as Locale) || 'en';
  
  const handleLocaleChange = (newLocale: Locale) => {
    const pathWithoutLocale = removeLocalePrefix(pathname);
    const newPath = `${getLocalePath(newLocale)}${pathWithoutLocale}`;
    
    setLocalePreference(newLocale);
    router.push(newPath);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{localeNames[currentLocale]}</span>
      </button>
      
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-20">
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => handleLocaleChange(locale)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                  locale === currentLocale
                    ? 'text-violet-600 dark:text-violet-400 font-medium'
                    : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {localeNames[locale]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
