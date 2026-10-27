'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, Cpu, Menu, Sparkles, Terminal, X } from 'lucide-react';
import { useLocale } from 'next-intl';

import { Link as LocaleLink } from '@/core/i18n/navigation';
import { LocaleSelector } from '@/shared/blocks/common/locale-selector';
import { SignModal } from '@/shared/blocks/sign/sign-modal';
import { useAppContext } from '@/shared/contexts/app';
import { WanSessionSync } from '@/components/wan/wan-session-sync';
import { GlmAccountMenu } from './glm-account-menu';

export function GlmHeader() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const { user, setIsShowSignModal } = useAppContext();
  const isZh = useLocale() === 'zh';

  const navItems = [
    { href: '/#models', label: isZh ? '机型选型' : 'Models' },
    { href: '/#architecture', label: isZh ? '架构底座' : 'Architecture' },
    { href: '/#workflows', label: isZh ? '生产力场景' : 'Workflows' },
    { href: '/#benchmarks', label: isZh ? '基准评测' : 'Benchmarks' },
    { href: '/#hardware', label: isZh ? '部署测算器' : 'Hardware Sizing' },
    { href: '/#pricing', label: isZh ? '定价方案' : 'Pricing' },
    { href: '/#faq', label: isZh ? '常见问题' : 'FAQ' },
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

  return (
    <>
      <WanSessionSync />
      <SignModal />

      {/* Top Announcement Bar */}
      <div className="relative z-50 flex items-center justify-center gap-2 border-b border-cyan-500/20 bg-[#050b18] px-4 py-2 text-center text-xs text-slate-300 sm:text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-cyan-400">
          <Terminal className="size-3.5 text-cyan-400" />
          <span>{isZh ? 'GLM-5.3 旗舰版' : 'GLM-5.3 Frontier MoE'}</span>
        </span>
        <span className="hidden text-slate-400 sm:inline">
          {isZh
            ? '· 753B MoE 架构 / 100 万字记忆 / 开源最强代码推理'
            : '· 753B MoE Architecture / 1M Context Window / Leading Code Reasoning'}
        </span>
        <LocaleLink
          href="/chat"
          className="ml-2 inline-flex items-center gap-1 font-semibold text-[#ffd166] transition hover:text-[#ffe29a] hover:underline"
        >
          <span>{isZh ? '立即体验' : 'Try Free'}</span>
          <ArrowRight className="size-3" />
        </LocaleLink>
      </div>

      {/* Main Navbar */}
      <nav className="sticky top-0 right-0 left-0 z-40 border-b border-slate-800/80 bg-[#050811]/90 backdrop-blur-md transition-all duration-300">
        <div className="mx-auto flex h-[62px] max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile Menu Button & Brand */}
          <div className="flex items-center gap-3">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="glm-mobile-navigation"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors lg:hidden"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <LocaleLink href="/" className="flex items-center gap-2.5 group">
              <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-[0_0_20px_rgba(77,227,255,0.35)] transition-transform group-hover:scale-105">
                <Bot className="size-5 text-slate-950 font-bold" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black tracking-tight text-white">GLM-5.3</span>
                  <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-800/60 uppercase">
                    753B MoE
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 -mt-1 hidden sm:block">
                  Frontier Open Intelligence
                </span>
              </div>
            </LocaleLink>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <LocaleLink
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-300 transition-colors hover:text-cyan-400"
              >
                {item.label}
              </LocaleLink>
            ))}
          </div>

          {/* Right: Controls & CTA */}
          <div className="flex items-center gap-3">
            <LocaleSelector />

            {mounted && user ? (
              <GlmAccountMenu />
            ) : (
              <button
                type="button"
                onClick={() => setIsShowSignModal(true)}
                className="hidden sm:inline-flex h-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/60 px-4 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                {isZh ? '登录 / 注册' : 'Sign In'}
              </button>
            )}

            <LocaleLink
              href="/chat"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 px-4 text-xs font-bold text-slate-950 shadow-[0_0_20px_rgba(77,227,255,0.3)] transition hover:from-cyan-400 hover:to-cyan-300 hover:shadow-[0_0_25px_rgba(77,227,255,0.5)] active:scale-95"
            >
              <span>{isZh ? '进入工作台' : 'Launch Studio'}</span>
              <ArrowRight className="size-3.5" />
            </LocaleLink>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            id="glm-mobile-navigation"
            className="border-b border-slate-800 bg-[#070c18] px-4 pt-2 pb-6 lg:hidden"
          >
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <LocaleLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800/60 hover:text-cyan-400 transition"
                >
                  {item.label}
                </LocaleLink>
              ))}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                {!user && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsShowSignModal(true);
                    }}
                    className="w-full text-center py-2 text-sm font-medium text-slate-300 hover:text-white"
                  >
                    {isZh ? '登录或创建账号' : 'Sign In / Register'}
                  </button>
                )}
                <LocaleLink
                  href="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm shadow-md"
                >
                  {isZh ? '立即进入对话工作台' : 'Launch Chat Studio'}
                </LocaleLink>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
