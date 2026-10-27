import { redirect } from '@/core/i18n/navigation';

export default async function LegacyVideosPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { locale } = await params;
  const { page, pageSize } = await searchParams;
  const query = new URLSearchParams();
  if (page) query.set('page', page);
  if (pageSize) query.set('pageSize', pageSize);
  redirect({ href: `/my-videos${query.size ? `?${query}` : ''}`, locale });
}
