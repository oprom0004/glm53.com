'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';

import { ChevronDown, Coins, Film, LogOut, Settings, Shield } from 'lucide-react';
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

export function WanAccountMenu() {
  const { user, setUser } = useAppContext();
  const isZh = useLocale() === 'zh';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const leaveMenu = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || !open) return;
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };
  const changeOpen = (value: boolean) => { cancelClose(); setOpen(value); };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  if (!user) return null;
  return (
    <DropdownMenu open={open} onOpenChange={changeOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          onPointerEnter={cancelClose}
          onPointerLeave={leaveMenu}
          type="button"
          aria-label={isZh ? '账户菜单' : 'Account menu'}
          className="flex h-9 items-center gap-2 rounded-full border border-violet-500/20 bg-violet-600/5 px-2 text-sm transition hover:bg-violet-600/10"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
            {user.name?.slice(0, 1).toUpperCase() || 'W'}
          </span>
          <span className="hidden max-w-24 truncate sm:block">
            {user.name || (isZh ? '账户' : 'Account')}
          </span>
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onPointerEnter={cancelClose} onPointerLeave={leaveMenu} align="end" className="w-60 rounded-2xl p-2">
        <div className="px-2 py-3">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {user.email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my-videos">
            <Film className="size-4" />
            {isZh ? '我的视频' : 'My Videos'}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/credits">
            <Coins className="size-4" />
            {isZh ? '我的积分' : 'My credits'}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <Settings className="size-4" />
            {isZh ? '账户设置' : 'Account settings'}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield className="size-4" />
              {isZh ? '管理后台' : 'Admin dashboard'}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={async () => {
            try {
              const result = await signOut();
              if (result.error) throw new Error('sign_out_failed');
              setUser(null);
              router.replace('/');
              router.refresh();
            } catch {
              toast.error(
                isZh
                  ? '退出失败，请重试。'
                  : 'Could not sign out. Please try again.'
              );
            }
          }}
        >
          <LogOut className="size-4" />
          {isZh ? '退出登录' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
