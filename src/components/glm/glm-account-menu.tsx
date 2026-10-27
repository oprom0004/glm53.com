'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ChevronDown, Coins, LogOut, MessageSquare, Settings, Shield } from 'lucide-react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

import { signOut } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useAppContext } from '@/shared/contexts/app';

export function GlmAccountMenu() {
  const { user, setUser } = useAppContext();
  const isZh = useLocale() === 'zh';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const leaveMenu = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || !open) return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  const changeOpen = (value: boolean) => {
    cancelClose();
    setOpen(value);
  };

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={changeOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          onPointerEnter={cancelClose}
          onPointerLeave={leaveMenu}
          type="button"
          aria-label={isZh ? '账户菜单' : 'Account menu'}
          className="flex h-9 items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/20 px-2 text-sm text-slate-200 transition hover:bg-cyan-950/40 hover:border-cyan-400/50"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-slate-950 shadow-[0_0_12px_rgba(77,227,255,0.4)]">
            {user.name?.slice(0, 1).toUpperCase() || 'G'}
          </span>
          <span className="hidden max-w-24 truncate sm:block font-medium">
            {user.name || (isZh ? '账户' : 'Account')}
          </span>
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 border-slate-800 bg-[#0a0f1d] text-slate-200 shadow-xl"
        onPointerEnter={cancelClose}
        onPointerLeave={leaveMenu}
      >
        <div className="border-b border-slate-800/80 px-3 py-2 text-xs">
          <p className="font-semibold text-slate-100">{user.name || (isZh ? '用户' : 'User')}</p>
          <p className="truncate text-slate-400">{user.email}</p>
        </div>
        <DropdownMenuItem asChild className="hover:bg-slate-800/60 focus:bg-slate-800/60 cursor-pointer">
          <Link href="/chat" className="flex items-center gap-2 text-sm">
            <MessageSquare className="size-4 text-cyan-400" />
            <span>{isZh ? '对话工作台' : 'Chat Workspace'}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="hover:bg-slate-800/60 focus:bg-slate-800/60 cursor-pointer">
          <Link href="/pricing" className="flex items-center gap-2 text-sm">
            <Coins className="size-4 text-[#ffd166]" />
            <span>{isZh ? '算力点数 / 订阅' : 'Credits & Subscription'}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="hover:bg-slate-800/60 focus:bg-slate-800/60 cursor-pointer">
          <Link href="/settings" className="flex items-center gap-2 text-sm">
            <Settings className="size-4 text-slate-400" />
            <span>{isZh ? '账户偏好设置' : 'Account Settings'}</span>
          </Link>
        </DropdownMenuItem>
        {user.isAdmin && (
          <DropdownMenuItem asChild className="hover:bg-slate-800/60 focus:bg-slate-800/60 cursor-pointer">
            <Link href="/admin" className="flex items-center gap-2 text-sm">
              <Shield className="size-4 text-emerald-400" />
              <span>{isZh ? '管理后台' : 'Admin Portal'}</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-slate-800/80" />
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 text-sm text-rose-400 hover:bg-slate-800/60 focus:bg-slate-800/60"
          onClick={async () => {
            try {
              await signOut();
              setUser?.(null);
              toast.success(isZh ? '已安全退出登录' : 'Signed out successfully');
              router.refresh();
            } catch (err: any) {
              toast.error(err?.message || 'Sign out failed');
            }
          }}
        >
          <LogOut className="size-4" />
          <span>{isZh ? '退出登录' : 'Sign Out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
