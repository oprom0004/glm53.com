'use client';

import { useEffect } from 'react';

import { useSession } from '@/core/auth/client';
import { useAppContext } from '@/shared/contexts/app';
import type { User } from '@/shared/models/user';

function sessionUserFrom(value: unknown): User | null {
  const candidate = (value as any)?.user ?? (value as any)?.data?.user;
  return candidate && typeof candidate === 'object'
    ? (candidate as User)
    : null;
}

/**
 * Wan pages use a purpose-built header instead of the theme header's SignUser
 * component. Keep the shared app session state synchronized without changing
 * the Lite header's visual treatment.
 */
export function WanSessionSync() {
  const { data: session, isPending } = useSession();
  const { user, setUser, setIsCheckSign, fetchConfigs, fetchUserInfo } =
    useAppContext();
  const sessionUser = sessionUserFrom(session);

  useEffect(() => {
    setIsCheckSign?.(isPending);
  }, [isPending, setIsCheckSign]);

  useEffect(() => {
    void fetchConfigs?.();
  }, [fetchConfigs]);

  useEffect(() => {
    if (isPending) return;
    if (sessionUser?.id && sessionUser.id !== user?.id) {
      setUser?.(sessionUser);
      void fetchUserInfo?.();
      return;
    }
    if (!sessionUser && user) setUser?.(null);
  }, [fetchUserInfo, isPending, sessionUser?.id, setUser, user]);

  return null;
}
