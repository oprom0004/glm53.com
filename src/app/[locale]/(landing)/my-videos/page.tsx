import { redirect } from '@/core/i18n/navigation';
import { AccountShell } from '@/shared/blocks/account/account-shell';
import { TaskHistory } from '@/shared/blocks/account/task-history';
import { loadWanTaskHistory } from '@/shared/lib/task-history';
import { getUserInfo } from '@/shared/models/user';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function MyVideosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { locale } = await params;
  const user = await getUserInfo();
  if (!user)
    return redirect({ href: '/sign-in?callbackUrl=%2Fmy-videos', locale });
  const history = await loadWanTaskHistory(user.id, await searchParams);
  return (
    <AccountShell>
      <TaskHistory {...history} />
    </AccountShell>
  );
}
