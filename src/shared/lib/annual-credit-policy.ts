import { createHash } from 'node:crypto';

export const ANNUAL_ENTITLEMENT_SCENE = 'annual_entitlement_v1';
export const ANNUAL_MONTHLY_SCENE = 'annual_monthly_v1';
export type AnnualPeriod = { start: Date; end: Date };
export type AnnualCreditSnapshot = {
  version: 1;
  policy: 'annual-monthly-v1';
  orderNo: string;
  userId: string;
  subscriptionNo: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  monthlyCredits: number;
};
export type AnnualCreditWindow = { index: number; start: Date; end: Date };

export function addUtcMonthsClamped(anchor: Date, offset: number): Date {
  if (!Number.isFinite(+anchor) || !Number.isInteger(offset))
    throw new Error('Invalid annual period');
  const result = new Date(anchor);
  const day = anchor.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(anchor.getUTCMonth() + offset);
  const last = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(day, last));
  return result;
}

export function annualWindows(period: AnnualPeriod): AnnualCreditWindow[] {
  const { start, end } = period;
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    +end <= +addUtcMonthsClamped(start, 11) ||
    +end - +start > 367 * 86400000
  )
    throw new Error('Invalid annual period');
  return Array.from({ length: 12 }, (_, index) => ({
    index,
    start: addUtcMonthsClamped(start, index),
    end: index === 11 ? new Date(end) : addUtcMonthsClamped(start, index + 1),
  }));
}

export function currentAnnualWindow(
  period: AnnualPeriod,
  now: Date
): AnnualCreditWindow | undefined {
  return annualWindows(period).find(
    (window) => +now >= +window.start && +now < +window.end
  );
}

export function annualTransactionNo(
  orderNo: string,
  kind: 'entitlement' | number
): string {
  if (
    !orderNo ||
    (kind !== 'entitlement' &&
      (!Number.isInteger(kind) || kind < 0 || kind > 11))
  )
    throw new Error('Invalid annual transaction');
  return `annual-v1-${createHash('sha256').update(orderNo).digest('hex')}-${kind}`;
}

export function parseAnnualSnapshot(
  metadata: string | null
): AnnualCreditSnapshot | undefined {
  try {
    const s = JSON.parse(metadata || 'null');
    if (
      !s ||
      s.version !== 1 ||
      s.policy !== 'annual-monthly-v1' ||
      !Number.isSafeInteger(s.monthlyCredits) ||
      s.monthlyCredits <= 0
    )
      return undefined;
    for (const key of [
      'orderNo',
      'userId',
      'subscriptionNo',
      'provider',
      'periodStart',
      'periodEnd',
    ])
      if (typeof s[key] !== 'string' || !s[key].trim()) return undefined;
    const period = {
      start: new Date(s.periodStart),
      end: new Date(s.periodEnd),
    };
    if (
      period.start.toISOString() !== s.periodStart ||
      period.end.toISOString() !== s.periodEnd
    )
      return undefined;
    annualWindows(period);
    return s;
  } catch {
    return undefined;
  }
}
