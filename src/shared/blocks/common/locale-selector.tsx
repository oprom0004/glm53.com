'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Globe, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { usePathname, useRouter } from '@/core/i18n/navigation';
import { localeNames } from '@/config/locale';
import { Button as AppButton } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cacheSet } from '@/shared/lib/cache';

export function LocaleSelector({
  type = 'icon',
}: {
  type?: 'icon' | 'button';
}) {
  const currentLocale = useLocale();
  const t = useTranslations('common.locale');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSwitchLanguage = (value: string) => {
    if (value !== currentLocale) {
      // Update localStorage to sync with locale detector
      try {
        cacheSet('locale', value);
      } catch {
        // Restricted browser storage must not prevent language navigation.
      }
      const query = searchParams?.toString?.() ?? '';
      const href = `${pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      router.push(href, {
        locale: value,
      });
    }
  };

  // Return a placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <AppButton
        aria-label={t('switch_language')}
        variant={type === 'icon' ? 'ghost' : 'outline'}
        size={type === 'icon' ? 'icon' : 'sm'}
        className={
          type === 'icon' ? 'h-auto w-auto p-0' : 'hover:bg-primary/10'
        }
        disabled
      >
        {type === 'icon' ? (
          <Languages size={18} aria-hidden="true" />
        ) : (
          <>
            <Globe size={16} aria-hidden="true" />
            {localeNames[currentLocale]}
          </>
        )}
      </AppButton>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {type === 'icon' ? (
          <AppButton
            aria-label={t('switch_language')}
            variant="ghost"
            size="icon"
            className="h-auto w-auto cursor-pointer p-0"
          >
            <Languages size={18} aria-hidden="true" />
          </AppButton>
        ) : (
          <AppButton
            aria-label={t('switch_language')}
            variant="outline"
            size="sm"
            className="hover:bg-primary/10 cursor-pointer"
          >
            <Globe size={16} aria-hidden="true" />
            {localeNames[currentLocale]}
          </AppButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label={t('label')}>
        <DropdownMenuRadioGroup
          value={currentLocale}
          onValueChange={handleSwitchLanguage}
        >
          {Object.keys(localeNames).map((locale) => (
            <DropdownMenuRadioItem
              key={locale}
              value={locale}
              className="cursor-pointer"
            >
              <span lang={locale}>{localeNames[locale]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
