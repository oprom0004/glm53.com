'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useRouter } from '@/core/i18n/navigation';
import { Button as AppButton } from '@/shared/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { useAppContext } from '@/shared/contexts/app';
import {
  parsePurchaseMode,
  pricingCallback,
  safeCheckoutUrl,
  safePaymentCallback,
} from '@/shared/lib/pricing-selection';
import {
  parseWanCatalog,
  WAN_PRODUCTS,
  type PurchaseMode,
  type WanCatalog,
  type WanProduct,
} from '@/shared/lib/wan-product-catalog';

const modes = ['credits', 'monthly', 'annual'] as const;
const checkoutErrors = [
  'checkout_in_progress',
  'checkout_expired_retry',
  'checkout_needs_review',
  'checkout_retry',
  'plan_not_configured',
  'payment_unavailable',
  'pricing_changed',
] as const;
type CheckoutError =
  | (typeof checkoutErrors)[number]
  | 'checkout_error'
  | 'pricing_refresh_error';

export function WanPricing({
  catalog: initialCatalog,
}: {
  catalog: WanCatalog;
}) {
  const locale = useLocale();
  const t = useTranslations('pages.pricing.messages');
  const router = useRouter();
  const { user } = useAppContext();
  const [mode, setMode] = useState<PurchaseMode>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<CheckoutError | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string>();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [pricingStale, setPricingStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pricingUpdated, setPricingUpdated] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const requests = useRef<AbortController | null>(null);
  const attempts = useRef<Record<string, string>>({});
  const currentUser = useRef(user?.id);
  currentUser.current = user?.id;
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const sync = () =>
      setMode(
        parsePurchaseMode(
          new URLSearchParams(window.location.search).get('purchase')
        )
      );
    sync();
    window.addEventListener('popstate', sync);
    return () => {
      mounted.current = false;
      requests.current?.abort();
      window.removeEventListener('popstate', sync);
    };
  }, []);
  useEffect(() => {
    requests.current?.abort();
    requests.current = null;
    setLoadingPlan(null);
    setRefreshing(false);
    setError((value) =>
      value === 'pricing_changed' || value === 'pricing_refresh_error'
        ? value
        : null
    );
    setResumeUrl(undefined);
  }, [user?.id]);
  useEffect(() => {
    setCatalog(initialCatalog);
  }, [initialCatalog]);

  function selectMode(value: string) {
    if (requests.current) return;
    const next = parsePurchaseMode(value);
    setMode(next);
    const url = new URL(window.location.href);
    url.searchParams.set('purchase', next);
    url.hash ||= '#pricing';
    window.history.pushState(
      window.history.state,
      '',
      url.pathname + url.search + url.hash
    );
  }
  function attemptFor(key: string) {
    if (!attempts.current[key]) {
      try {
        const saved = window.localStorage.getItem('wanai-purchase:' + key);
        if (saved && /^[0-9a-f-]{36}$/i.test(saved))
          attempts.current[key] = saved;
      } catch {}
      attempts.current[key] ||= crypto.randomUUID();
      try {
        window.localStorage.setItem(
          'wanai-purchase:' + key,
          attempts.current[key]
        );
      } catch {}
    }
    return attempts.current[key];
  }
  function forgetAttempt(key: string) {
    delete attempts.current[key];
    try {
      window.localStorage.removeItem('wanai-purchase:' + key);
    } catch {}
  }
  function signIn() {
    router.push(
      '/sign-in?callbackUrl=' + encodeURIComponent(pricingCallback(mode))
    );
  }
  async function checkout(product: WanProduct) {
    if (requests.current || pricingStale) return;
    if (!user) {
      signIn();
      return;
    }
    const userId = user.id;
    const key = `${userId}:${product.id}`;
    const controller = new AbortController();
    requests.current = controller;
    const isCurrent = () =>
      mounted.current &&
      currentUser.current === userId &&
      requests.current === controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setLoadingPlan(product.id);
    setError(null);
    setResumeUrl(undefined);
    setPricingUpdated(false);
    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          productId: product.id,
          catalogRevision: catalog.revision,
          ...(product.mode === 'credits' ? { requestId: attemptFor(key) } : {}),
          locale,
          returnPath: `${locale === 'zh' ? '/zh' : ''}/settings/${product.mode === 'credits' ? 'credits' : 'billing'}`,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!isCurrent()) return;
      if (controller.signal.aborted) throw new Error('checkout_retry');
      if (response.status === 401) {
        signIn();
        return;
      }
      if (!response.ok || result.code !== 0) {
        if (result.message === 'subscription_already_exists') {
          router.push('/settings/billing');
          return;
        }
        const message =
          result.message === 'stripe_not_configured'
            ? 'payment_unavailable'
            : checkoutErrors.includes(result.message)
              ? (result.message as CheckoutError)
              : 'checkout_error';
        if (message === 'checkout_expired_retry') forgetAttempt(key);
        if (message === 'pricing_changed') setPricingStale(true);
        setError(message);
        if (message === 'checkout_in_progress')
          setResumeUrl(safeCheckoutUrl(result.data?.checkoutUrl));
        return;
      }
      if (result.data?.kind === 'paid') {
        const destination = safePaymentCallback(
          result.data.callbackUrl,
          window.location.origin
        );
        if (!destination) throw new Error('checkout_error');
        forgetAttempt(key);
        window.location.assign(destination);
        return;
      }
      const destination = safeCheckoutUrl(result.data?.checkoutUrl);
      if (!destination) throw new Error('checkout_error');
      window.location.assign(destination);
    } catch {
      if (isCurrent()) setError('checkout_retry');
    } finally {
      clearTimeout(timeout);
      if (isCurrent()) {
        requests.current = null;
        setLoadingPlan(null);
      }
    }
  }
  async function refreshPricing() {
    if (requests.current) return;
    const userId = user?.id;
    const controller = new AbortController();
    requests.current = controller;
    const isCurrent = () =>
      mounted.current &&
      currentUser.current === userId &&
      requests.current === controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setRefreshing(true);
    try {
      const response = await fetch('/api/payment/catalog', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const result = await response.json();
      if (!isCurrent()) return;
      if (
        controller.signal.aborted ||
        !response.ok ||
        result.code !== 0 ||
        !Array.isArray(result.data?.products) ||
        result.data.products.length !== WAN_PRODUCTS.length ||
        new Set(result.data.products.map((product: WanProduct) => product.id))
          .size !== WAN_PRODUCTS.length
      )
        throw new Error('pricing_refresh_error');
      const next = parseWanCatalog(
        JSON.stringify({
          version: 1,
          revision: result.data.revision,
          products: Object.fromEntries(
            result.data.products.map((product: WanProduct) => [
              product.id,
              { amount: product.amount, credits: product.credits },
            ])
          ),
        })
      );
      setCatalog(next);
      setPricingStale(false);
      setError(null);
      setPricingUpdated(true);
      title.current?.focus({ preventScroll: true });
    } catch {
      if (isCurrent()) setError('pricing_refresh_error');
    } finally {
      clearTimeout(timeout);
      if (isCurrent()) {
        requests.current = null;
        setRefreshing(false);
      }
    }
  }
  const money = (amount: number, decimals = 2) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount / 100);

  const annualPlans = catalog.products.filter((p) => p.mode === 'annual');
  const annualSaving = annualPlans.length
    ? Math.min(
        ...annualPlans.map((annual) => {
          const monthly = catalog.products.find(
            (p) => p.mode === 'monthly' && p.tier === annual.tier
          );
          return monthly && monthly.credits === annual.credits
            ? Math.floor(
                ((monthly.amount * 12 - annual.amount) * 100) /
                  (monthly.amount * 12)
              )
            : 0;
        })
      )
    : 0;

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="border-border/40 border-t py-20 md:py-28"
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-500/8 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-violet-700 uppercase dark:text-violet-200">
            {t('eyebrow')}
          </span>
          <h2
            id="pricing-title"
            ref={title}
            tabIndex={-1}
            className="text-foreground mt-4 text-3xl font-bold tracking-tight md:text-5xl"
          >
            {t('title')}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 min-h-18 max-w-xl text-sm leading-6 sm:text-base">
            {t(`${mode}_description`)}
          </p>
        </div>
        <Tabs value={mode} onValueChange={selectMode} className="mt-6">
          <div className="flex justify-center">
            <TabsList
              aria-label={t('purchase_mode')}
              className="h-auto min-h-11 max-w-full rounded-full p-1"
            >
              {modes.map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  data-mode={value}
                  disabled={loadingPlan !== null || refreshing}
                  className="min-h-10 cursor-pointer rounded-full px-3 sm:px-5"
                >
                  {t(`mode_${value}`)}
                  {value === 'annual' && annualSaving > 0 && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                      {t('save_discount', { percent: annualSaving })}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {modes.map((value) => (
            <TabsContent key={value} value={value} className="mt-12">
              <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
                {catalog.products
                  .filter((product) => product.mode === value)
                  .map((product) => {
                    const featured = product.tier === 'creator';
                    const annual = product.mode === 'annual';
                    const pack = product.mode === 'credits';
                    const monthly = annual
                      ? catalog.products.find(
                          (candidate) =>
                            candidate.mode === 'monthly' &&
                            candidate.tier === product.tier
                        )
                      : undefined;
                    const saving =
                      monthly &&
                      monthly.credits === product.credits &&
                      product.amount < monthly.amount * 12
                        ? Math.round(
                            (1 - product.amount / (monthly.amount * 12)) * 100
                          )
                        : 0;
                    const name =
                      product.tier[0].toUpperCase() + product.tier.slice(1);
                    const credits = product.credits.toLocaleString(locale);
                    const features = [
                      t(
                        pack
                          ? 'credit_permanent'
                          : annual
                            ? 'annual_credit_validity'
                            : 'credit_period_validity'
                      ),
                      t('all_models'),
                      t(`feature_${product.tier}`),
                    ];
                    return (
                      <article
                        key={product.id}
                        data-plan={product.tier}
                        data-product-id={product.id}
                        className={`relative flex min-w-0 flex-col rounded-2xl border p-6 shadow-sm ${featured ? 'border-violet-500 bg-violet-600 text-white shadow-violet-500/20' : 'border-border/60 bg-card text-foreground'}`}
                      >
                        {featured && (
                          <span className="absolute -top-3 left-6 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">
                            {t('popular')}
                          </span>
                        )}
                        <h3 className="text-lg font-bold">{name}</h3>
                        {annual && saving > 0 && monthly && (
                          <p
                            className={`mt-4 text-sm ${featured ? 'text-white/80' : 'text-muted-foreground'}`}
                          >
                            <s>
                              {money(monthly.amount)} {t('month_unit')}
                            </s>
                            <span className="ml-2 font-semibold">
                              {t('save_about', { percent: saving })}
                            </span>
                          </p>
                        )}
                        <div className="mt-5 flex flex-wrap items-end gap-2">
                          {annual && (
                            <span className="text-sm">
                              {t('approximately')}
                            </span>
                          )}
                          <span className="text-4xl font-bold tracking-tight">
                            {annual
                              ? money(product.amount / 12)
                              : money(product.amount)}
                          </span>
                          <span
                            className={
                              featured
                                ? 'text-white/75'
                                : 'text-muted-foreground'
                            }
                          >
                            {t(pack ? 'one_time' : 'month_unit')}
                          </span>
                        </div>
                        <p
                          className={`mt-2 text-sm ${featured ? 'text-white/80' : 'text-muted-foreground'}`}
                        >
                          {t(
                            pack
                              ? 'pack_credits_summary'
                              : annual
                                ? 'annual_credits_summary'
                                : 'credits_summary',
                            { count: credits }
                          )}
                        </p>
                        <p
                          className={`mt-3 min-h-12 text-sm leading-6 ${featured ? 'text-white/85' : 'text-muted-foreground'}`}
                        >
                          {annual
                            ? t('annual_billing_detail', {
                                amount: money(product.amount),
                                monthly: money(product.amount / 12),
                              })
                            : t(pack ? 'single_billing' : 'monthly_billing')}
                        </p>
                        <ul className="mt-6 flex-1 space-y-3 text-sm">
                          {features.map((feature) => (
                            <li
                              key={feature}
                              className="flex items-start gap-2.5"
                            >
                              <Check
                                className="mt-0.5 size-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <AppButton
                          type="button"
                          onClick={() => checkout(product)}
                          disabled={
                            loadingPlan !== null || refreshing || pricingStale
                          }
                          aria-busy={loadingPlan === product.id}
                          className={`mt-8 h-11 w-full cursor-pointer rounded-full ${featured ? 'bg-white text-violet-700 hover:bg-violet-50' : 'bg-violet-600 text-white hover:bg-violet-500'}`}
                        >
                          {loadingPlan === product.id ? (
                            <LoaderCircle
                              className="motion-safe:animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Sparkles aria-hidden="true" />
                          )}
                          {t(pack ? 'buy_credits_button' : 'subscribe_button', {
                            plan: name,
                          })}
                        </AppButton>
                      </article>
                    );
                  })}
              </div>
              <p className="text-muted-foreground mx-auto mt-7 max-w-3xl text-center text-sm leading-6">
                {t(`${value}_note`)}
              </p>
            </TabsContent>
          ))}
        </Tabs>
        <div className="mt-5 min-h-14 text-center text-sm">
          {error && (
            <div role="alert">
              <p className="text-destructive">{t(error)}</p>
              {pricingStale && (
                <AppButton
                  type="button"
                  variant="outline"
                  data-refresh-pricing
                  disabled={refreshing}
                  aria-busy={refreshing}
                  onClick={refreshPricing}
                  className="mt-2 min-h-11 cursor-pointer"
                >
                  <RefreshCw
                    className={
                      refreshing ? 'motion-safe:animate-spin' : undefined
                    }
                    aria-hidden="true"
                  />
                  {t('refresh_pricing')}
                </AppButton>
              )}
              {resumeUrl && (
                <AppButton asChild variant="link" className="mt-1">
                  <a data-resume-checkout href={resumeUrl}>
                    {t('resume_checkout')}
                  </a>
                </AppButton>
              )}
            </div>
          )}
          {pricingUpdated && <p role="status">{t('pricing_updated')}</p>}
        </div>
        <p className="text-muted-foreground text-center text-xs">
          {t('price_currency')} · {t('trust_checkout')}
        </p>
      </div>
    </section>
  );
}
