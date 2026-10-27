'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

import { Link as LocaleLink } from '@/core/i18n/navigation';
import { LocaleSelector } from '@/shared/blocks/common/locale-selector';
import { SignModal } from '@/shared/blocks/sign/sign-modal';
import { useAppContext } from '@/shared/contexts/app';

import { WanAccountMenu } from './wan-account-menu';
import { WanSessionSync } from './wan-session-sync';

export function WanHeader() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations('pages.index.page.navigation');
  const localeT = useTranslations('common.locale');
  const { user } = useAppContext();
  const isZh = useLocale() === 'zh';
  const sectionItems = [
    { href: '/#features', label: isZh ? '功能' : 'Features' },
    { href: '/#compare', label: isZh ? '模型对比' : 'Comparisons' },
    { href: '/#use-cases', label: isZh ? '应用场景' : 'Use Cases' },
    { href: '/#faq', label: isZh ? '常见问题' : 'FAQ' },
  ];
  const navItems = [
    { href: '/wan-3', label: t('wan3') },
    { href: '/wan-2-7', label: t('wan27') },
    { href: '/wan-2-6', label: t('wan26') },
    { href: '/wan-2-5', label: t('wan25') },
    { href: '/pricing', label: t('pricing') },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileMenuOpen(false);
      requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <WanSessionSync />
      <SignModal />
      {/* Top Announcement Bar */}
      <div className="flex items-center justify-center gap-2 border-b border-violet-500/20 bg-violet-600/10 px-4 py-2 text-center text-xs text-violet-700 sm:text-sm dark:text-violet-300">
        <span className="font-semibold">{t('announcement')}</span>
        <span className="hidden sm:inline">{t('announcement_detail')}</span>
        <LocaleLink
          href="/wan-3"
          className="ml-1 inline-flex items-center gap-1 font-bold underline hover:text-violet-600 dark:hover:text-violet-200"
        >
          {t('try_wan3')}
        </LocaleLink>
      </div>

      {/* Main Navbar */}
      <nav className="site-nav bg-background/80 border-border/50 sticky top-0 right-0 left-0 z-50 border-b backdrop-blur-md transition-all duration-300">
        <div className="mx-auto flex h-[58px] max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Menu Button & Brand */}
          <div className="flex items-center gap-2">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              aria-label={mobileMenuOpen ? t('close_menu') : t('open_menu')}
              aria-expanded={mobileMenuOpen}
              aria-controls="wan-mobile-navigation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-foreground/80 hover:bg-muted hover:text-foreground rounded-md p-2 transition-colors xl:hidden"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            <LocaleLink href="/" className="flex items-center gap-2">
              <div className="relative h-8 w-8 flex-shrink-0">
                <Image
                  src="/logo.webp"
                  alt="WanAI 3.0"
                  width={32}
                  height={32}
                  className="object-contain"
                  priority
                />
              </div>
              <span className="hidden text-xl leading-none font-bold text-violet-600 sm:inline dark:text-violet-400">
                WanAI 3.0
              </span>
            </LocaleLink>

            {/* Desktop Navigation Links */}
            <div className="ml-6 hidden items-center gap-1 xl:flex">
              <details className="group relative">
                <summary className="nav-link-item text-foreground/80 hover:bg-muted/60 cursor-pointer rounded-md px-3 py-2 text-sm font-medium hover:text-violet-600">
                  {isZh ? '视频生成' : 'AI Video'}
                </summary>
                <div className="bg-background border-border absolute left-0 z-50 mt-2 min-w-44 rounded-xl border p-2 shadow-lg">
                  {navItems
                    .filter((item) => item.href !== '/pricing')
                    .map((item) => (
                      <LocaleLink
                        key={item.href}
                        href={item.href}
                        className="hover:bg-muted block rounded-md px-3 py-2 text-sm"
                      >
                        {item.label}
                      </LocaleLink>
                    ))}
                  <LocaleLink
                    href="/#versions"
                    className="hover:bg-muted block rounded-md px-3 py-2 text-sm"
                  >
                    {isZh ? '全部版本' : 'All versions'}
                  </LocaleLink>
                </div>
              </details>
              {[...sectionItems, { href: '/pricing', label: t('pricing') }].map(
                (item) => (
                  <LocaleLink
                    key={item.href}
                    href={item.href}
                    className="nav-link-item text-foreground/80 hover:bg-muted/60 inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors hover:text-violet-600 dark:hover:text-violet-400"
                  >
                    {item.label}
                  </LocaleLink>
                )
              )}
            </div>
          </div>

          {/* Right: Theme Toggle & Action Buttons */}
          <div className="flex items-center gap-2">
            {mounted && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={t('toggle_theme')}
                className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer rounded-full p-2 transition-colors"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-[1.15rem] w-[1.15rem]" />
                ) : (
                  <Moon className="h-[1.15rem] w-[1.15rem]" />
                )}
              </button>
            )}

            <div className="hidden md:block">
              <Suspense fallback={null}>
                <LocaleSelector type="button" />
              </Suspense>
            </div>

            {user ? (
              <WanAccountMenu />
            ) : (
              <LocaleLink
                href={user ? '/my-videos' : '/sign-in'}
                className="text-foreground/75 hover:bg-muted hidden h-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors hover:text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex dark:hover:text-violet-300"
              >
                {user ? t('account') : t('sign_in')}
              </LocaleLink>
            )}

            <LocaleLink
              href="/wan-3"
              className="inline-flex h-9 items-center justify-center rounded-full bg-violet-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-500 hover:shadow-violet-500/25 sm:text-sm"
            >
              <span className="hidden sm:inline">{t('create')}</span>
              <span className="whitespace-nowrap sm:hidden">
                {isZh ? '✦ 创建视频' : '✦ Create'}
              </span>
            </LocaleLink>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <div
          id="wan-mobile-navigation"
          className={`${mobileMenuOpen ? 'block' : 'hidden'} border-border bg-background space-y-2 border-b px-4 py-4 xl:hidden`}
        >
          {navItems.map((item) => (
            <LocaleLink
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground hover:bg-muted block rounded-md px-3 py-2 text-base font-medium"
            >
              {item.label}
            </LocaleLink>
          ))}
          {sectionItems.map((item) => (
            <LocaleLink
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="text-foreground hover:bg-muted block rounded-md px-3 py-2 text-base font-medium"
            >
              {item.label}
            </LocaleLink>
          ))}
          <div className="flex items-center justify-between px-3 py-2 md:hidden">
            <span className="text-muted-foreground text-sm">
              {localeT('label')}
            </span>
            <Suspense fallback={null}>
              <LocaleSelector type="button" />
            </Suspense>
          </div>
          <LocaleLink
            href={user ? '/my-videos' : '/sign-in'}
            onClick={() => setMobileMenuOpen(false)}
            className="border-border hover:bg-muted mt-3 flex items-center rounded-md border-t px-3 pt-4 pb-2 text-base font-semibold text-violet-600 transition-colors dark:text-violet-300"
          >
            {user ? t('account') : t('sign_in')}
          </LocaleLink>
        </div>
      </nav>
    </>
  );
}
