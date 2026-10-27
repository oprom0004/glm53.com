'use client';

import { CalendarDays, Coins, ReceiptText } from 'lucide-react';
import { useLocale } from 'next-intl';

export function AccountOverview({
  overview,
}: {
  overview: {
    subscription: {
      planName?: string | null;
      status: string;
      currentPeriodEnd?: Date | string | null;
    } | null;
    remainingCredits: number;
    paymentCount: number;
  };
}) {
  const isZh = useLocale() === 'zh';
  const cards = [
    {
      icon: Coins,
      label: isZh ? '可用积分' : 'Available credits',
      value: overview.remainingCredits.toLocaleString(),
    },
    {
      icon: ReceiptText,
      label: isZh ? '支付记录' : 'Payment records',
      value: overview.paymentCount.toLocaleString(),
    },
    {
      icon: CalendarDays,
      label: isZh ? '当前订阅' : 'Current subscription',
      value: overview.subscription?.planName || (isZh ? '暂无' : 'None'),
      detail: overview.subscription?.currentPeriodEnd
        ? `${isZh ? '当前周期至' : 'Current period until'} ${new Date(
            overview.subscription.currentPeriodEnd
          ).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { timeZone: 'UTC' })}`
        : undefined,
    },
  ];
  return (
    <section aria-labelledby="account-overview-title">
      <div className="mb-4">
        <h2 id="account-overview-title" className="text-xl font-semibold">
          {isZh ? '账户概览' : 'Account overview'}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {isZh
            ? '普通积分、订阅状态与支付记录。'
            : 'Ordinary credits, subscription status, and payment history.'}
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-card border-border/60 min-w-0 rounded-xl border p-5 shadow-sm"
          >
            <dt className="text-muted-foreground flex items-center gap-2 text-xs">
              <card.icon className="size-4" aria-hidden="true" />
              {card.label}
            </dt>
            <dd className="text-foreground mt-3 text-xl font-semibold break-words">
              {card.value}
            </dd>
            {card.detail && (
              <p className="text-muted-foreground mt-1 text-xs">{card.detail}</p>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
