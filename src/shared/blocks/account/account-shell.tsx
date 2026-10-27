'use client';

import type { ReactNode } from 'react';
import { WanHeader } from '@/components/wan/wan-header';
import { ArrowUpRight, Coins, Film, Plus, Settings2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Link, usePathname } from '@/core/i18n/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { useAppContext } from '@/shared/contexts/app';

export function AccountShell({ children }: { children: ReactNode }) {
  const isZh = useLocale() === 'zh';
  const pathname = usePathname();
  const t = useTranslations('settings.sidebar');
  const { user } = useAppContext();
  const settings = t.raw('nav.items') as {
    title: string;
    url: string;
    icon: string;
  }[];
  const credits = user?.credits?.remainingCredits;
  const items = [
    { title: isZh ? '我的视频' : 'My Videos', url: '/my-videos', icon: 'Film' },
    ...settings,
  ];
  return (
    <div className="bg-background min-h-screen">
      <WanHeader />
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:w-56 lg:shrink-0 lg:self-start">
            <div className="mb-6 hidden items-center gap-3 lg:flex">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-600/10 font-semibold text-violet-600 dark:text-violet-300">
                {user?.name?.slice(0, 1).toUpperCase() || 'W'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {user?.name || (isZh ? '创作空间' : 'Your workspace')}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {isZh ? '让想法动起来' : 'Bring your ideas to life'}
                </p>
              </div>
            </div>
            <Link
              href="/wan-3"
              className="mb-6 hidden items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 lg:flex"
            >
              <Plus className="size-4" />
              {isZh ? '创建视频' : 'Create video'}
            </Link>
            <p className="text-muted-foreground mb-3 hidden px-3 text-[10px] font-semibold tracking-[0.18em] uppercase lg:block">
              {isZh ? '个人空间' : 'Workspace'}
            </p>
            <nav
              aria-label={isZh ? '个人空间导航' : 'Workspace navigation'}
              className="border-border/60 bg-card flex gap-1 overflow-x-auto rounded-2xl border p-1.5 [scrollbar-width:none] lg:flex-col lg:border-0 lg:bg-transparent lg:p-0 [&::-webkit-scrollbar]:hidden"
            >
              {items.map((item) => {
                const active =
                  pathname === item.url || pathname.startsWith(`${item.url}/`);
                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    aria-current={active ? 'page' : undefined}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-3 text-sm transition ${active ? 'bg-violet-600/10 font-semibold text-violet-700 dark:text-violet-300' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  >
                    <SmartIcon name={item.icon} size={17} />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-8 hidden rounded-2xl border border-violet-500/15 bg-violet-600/5 p-4 lg:block">
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <Coins className="size-4" />
                {isZh ? '可用积分' : 'Available credits'}
              </p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {typeof credits === 'number' ? credits.toLocaleString() : '—'}
              </p>
              <Link
                href="/pricing"
                className="mt-4 flex items-center justify-between text-xs font-semibold text-violet-600 dark:text-violet-300"
              >
                {isZh ? '获取更多积分' : 'Get more credits'}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </aside>
          <main className="min-w-0 flex-1">
            {pathname.startsWith('/settings') && (
              <div className="mb-7">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium text-violet-600 dark:text-violet-300">
                  <Settings2 className="size-4" />
                  {isZh ? '账户设置' : 'ACCOUNT SETTINGS'}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {settings.find((item) => pathname.startsWith(item.url))
                    ?.title || t('title')}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                  {isZh
                    ? '管理你的账户信息、积分和订阅。'
                    : 'Manage your account, credits, and subscription.'}
                </p>
              </div>
            )}
            {children}
            <footer className="text-muted-foreground border-border/50 mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs">
              <span>© {new Date().getFullYear()} WanAI 3.0</span>
              <Link
                href="/wan-3"
                className="flex items-center gap-1.5 hover:text-violet-600"
              >
                <Film className="size-3.5" />
                {isZh ? '返回创作' : 'Back to create'}
              </Link>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
