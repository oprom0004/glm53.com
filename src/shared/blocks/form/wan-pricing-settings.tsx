'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Form as FormProvider,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import {
  parseWanCatalog,
  validateWanCatalogDraft,
  WanCatalogValidationError,
  type WanCatalog,
  type WanCatalogDraft,
} from '@/shared/lib/wan-product-catalog';
import {
  parseWanVideoPricingResponse,
  validateWanVideoRates,
  WanVideoRateValidationError,
  type WanVideoPricing,
} from '@/shared/lib/wan-video-rate-config';
import { WAN_PRICE_FIELDS } from '@/shared/services/wan-video-pricing';

type DraftForm = { products: WanCatalogDraft; rates: Record<string, string> };
type Issue =
  | 'pricing_invalid'
  | 'pricing_conflict'
  | 'pricing_environment_override'
  | 'pricing_unknown'
  | 'pricing_unavailable'
  | 'pricing_forbidden'
  | 'pricing_unauthorized';

const PricingNavigationContext = createContext<{
  allowNavigation: RefObject<boolean>;
  hasPending: boolean;
  setPending: (id: string, pending: boolean) => void;
} | null>(null);

/** Separate save actions share one page-wide leave decision and pending warning. */
export function PricingNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const allowNavigation = useRef(false);
  const [pendingForms, setPendingForms] = useState<Set<string>>(
    () => new Set()
  );
  const setPending = useCallback((id: string, pending: boolean) => {
    setPendingForms((previous) => {
      if (previous.has(id) === pending) return previous;
      const next = new Set(previous);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({
      allowNavigation,
      hasPending: pendingForms.size > 0,
      setPending,
    }),
    [pendingForms, setPending]
  );
  return (
    <PricingNavigationContext.Provider value={value}>
      {children}
    </PricingNavigationContext.Provider>
  );
}

function draftFor(catalog: WanCatalog): DraftForm {
  return {
    rates: {},
    products: Object.fromEntries(
      catalog.products.map((product) => [
        product.id,
        {
          price: (product.amount / 100).toFixed(2),
          credits: String(product.credits),
        },
      ])
    ),
  };
}

/** Normalize response values through the same catalog validator used by the server. */
function responseCatalog(value: unknown): WanCatalog {
  if (!value || typeof value !== 'object')
    throw new Error('pricing_unavailable');
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.products) || data.products.length !== 9)
    throw new Error('pricing_unavailable');
  const products = Object.fromEntries(
    data.products.map((product: unknown) => {
      if (!product || typeof product !== 'object')
        throw new Error('pricing_unavailable');
      const p = product as Record<string, unknown>;
      if (typeof p.id !== 'string') throw new Error('pricing_unavailable');
      return [p.id, { amount: p.amount, credits: p.credits }];
    })
  );
  return parseWanCatalog(
    JSON.stringify({ version: 1, revision: data.revision, products })
  );
}

/** Product catalog and video rates share validation feedback, CAS recovery and navigation guards. */
export function WanPricingSettings({
  catalog,
  videoPricing,
}: {
  catalog: WanCatalog;
  videoPricing?: WanVideoPricing;
}) {
  const t = useTranslations('admin.pricing');
  const locale = useLocale();
  const router = useRouter();
  const video = videoPricing !== undefined;
  const form = useForm<DraftForm>({
    defaultValues: { ...draftFor(catalog), rates: videoPricing?.rates ?? {} },
  });
  const [savedVideo, setSavedVideo] = useState(videoPricing);
  const [savedCatalog, setSavedCatalog] = useState(catalog);
  const [busy, setBusy] = useState<'save' | 'reload' | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [mustReload, setMustReload] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'reloaded' | null>(null);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const navigationTrigger = useRef<HTMLElement | null>(null);
  const keepEditing = useRef<HTMLButtonElement | null>(null);
  const focusError = useRef<FieldPath<DraftForm> | null>(null);
  const localAllowNavigation = useRef(false);
  const navigation = useContext(PricingNavigationContext);
  const allowNavigation = navigation?.allowNavigation ?? localAllowNavigation;
  const hasPending = navigation?.hasPending ?? busy !== null;
  const setPending = navigation?.setPending;
  const formId = useId();
  const forbidden =
    issue === 'pricing_forbidden' || issue === 'pricing_unauthorized';
  const dirty = form.formState.isDirty;

  useEffect(() => {
    setPending?.(formId, busy !== null);
    return () => setPending?.(formId, false);
  }, [formId, busy, setPending]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  // Server validation arrives while the fieldset is disabled. Focus after commit.
  useEffect(() => {
    if (!busy && focusError.current) {
      const name = focusError.current;
      focusError.current = null;
      form.setFocus(name);
    }
  });

  // App links are guarded without rewriting history; page/tab closes use beforeunload.
  useEffect(() => {
    if (!dirty && !busy) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (allowNavigation.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      if (
        allowNavigation.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return;
      const target = new URL(anchor.href, window.location.href);
      if (
        !['http:', 'https:'].includes(target.protocol) ||
        target.href === window.location.href
      )
        return;
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search &&
        target.hash
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigationTrigger.current = anchor;
      setLeavingTo(target.href);
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty, busy, allowNavigation]);

  function showFieldErrors(errors: Record<string, string>) {
    let first: FieldPath<DraftForm> | undefined;
    if (video) {
      for (const { name } of WAN_PRICE_FIELDS) {
        if (!errors[name]) continue;
        const path = `rates.${name}` as const;
        form.setError(path, {
          type: 'validate',
          message: t('video.invalid_rate'),
        });
        first ??= path;
      }
      if (first) focusError.current = first;
      return;
    }
    for (const product of savedCatalog.products) {
      for (const key of ['price', 'credits'] as const) {
        if (!errors[`${product.id}.${key}`]) continue;
        const name = `products.${product.id}.${key}` as const;
        form.setError(name, {
          type: 'validate',
          message: t(
            `errors.${key === 'price' ? 'invalid_price' : 'invalid_credits'}`
          ),
        });
        first ??= name;
      }
    }
    if (first) focusError.current = first;
  }

  async function save(values: DraftForm) {
    if (request.current || mustReload || forbidden) return;
    form.clearErrors();
    setNotice(null);
    try {
      if (video) validateWanVideoRates(values.rates);
      else validateWanCatalogDraft(values.products);
    } catch (error) {
      if (
        error instanceof WanCatalogValidationError ||
        error instanceof WanVideoRateValidationError
      )
        showFieldErrors(error.fieldErrors);
      setIssue('pricing_invalid');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const current = () => mounted.current && request.current === controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setBusy('save');
    setIssue(null);
    try {
      const response = await fetch(
        video ? '/api/admin/video-pricing' : '/api/admin/pricing',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            video
              ? {
                  expectedRevision: savedVideo!.revision,
                  rates: values.rates,
                }
              : {
                  expectedRevision: savedCatalog.revision,
                  products: values.products,
                }
          ),
          signal: controller.signal,
        }
      );
      const result = await response.json();
      if (!current()) return;
      if (controller.signal.aborted) throw new Error('pricing_unknown');
      if (response.ok && result.code === 0) {
        if (video) {
          const next = parseWanVideoPricingResponse(result.data);
          setSavedVideo(next);
          form.reset({ products: {}, rates: next.rates });
        } else {
          const next = responseCatalog(result.data);
          setSavedCatalog(next);
          form.reset(draftFor(next));
        }
        setNotice('saved');
        toast.success(t(video ? 'video.saved' : 'saved'));
        return;
      }
      if (result.message === 'pricing_invalid') {
        if (result.fieldErrors && typeof result.fieldErrors === 'object')
          showFieldErrors(result.fieldErrors);
        setIssue('pricing_invalid');
      } else if (
        result.message === 'pricing_conflict' ||
        result.message === 'pricing_environment_override'
      ) {
        setMustReload(true);
        setIssue(result.message);
      } else if (
        result.message === 'pricing_forbidden' ||
        result.message === 'pricing_unauthorized'
      ) {
        setIssue(result.message);
      } else {
        setMustReload(true);
        setIssue('pricing_unknown');
      }
    } catch {
      if (current()) {
        setMustReload(true);
        setIssue('pricing_unknown');
      }
    } finally {
      clearTimeout(timeout);
      if (current()) {
        request.current = null;
        setBusy(null);
      }
    }
  }

  async function reload() {
    if (request.current || forbidden) return;
    const controller = new AbortController();
    request.current = controller;
    const current = () => mounted.current && request.current === controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    setBusy('reload');
    setNotice(null);
    try {
      const response = await fetch(
        video ? '/api/admin/video-pricing' : '/api/payment/catalog',
        {
          cache: 'no-store',
          signal: controller.signal,
        }
      );
      const result = await response.json();
      if (response.status === 401 || response.status === 403) {
        if (current())
          setIssue(
            response.status === 401
              ? 'pricing_unauthorized'
              : 'pricing_forbidden'
          );
        return;
      }
      if (!response.ok || result.code !== 0 || controller.signal.aborted)
        throw new Error('pricing_unavailable');
      if (!current()) return;
      if (video) {
        const next = parseWanVideoPricingResponse(result.data);
        setSavedVideo(next);
        form.reset({ products: {}, rates: next.rates });
      } else {
        const next = responseCatalog(result.data);
        setSavedCatalog(next);
        form.reset(draftFor(next));
      }
      setIssue(null);
      setMustReload(false);
      setNotice('reloaded');
    } catch {
      if (current()) setIssue('pricing_unavailable');
    } finally {
      clearTimeout(timeout);
      if (current()) {
        request.current = null;
        setBusy(null);
      }
    }
  }

  return (
    <>
      <Card
        id={video ? 'video-rates' : 'product-pricing'}
        className="mb-8 max-w-5xl scroll-mt-20"
      >
        <CardHeader>
          <CardTitle>{t(video ? 'video.title' : 'title')}</CardTitle>
          <CardDescription>
            {t(video ? 'video.description' : 'description')}
          </CardDescription>
          <p className="text-muted-foreground mt-2 text-sm">
            {t(video ? 'video.policy' : 'stripe_note')}
          </p>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form
              noValidate
              onSubmit={form.handleSubmit(save)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  (event.nativeEvent.isComposing || event.keyCode === 229)
                )
                  event.preventDefault();
              }}
              aria-busy={busy !== null}
              className="space-y-8"
            >
              {video
                ? [
                    'wan25',
                    'wan26',
                    'wan27',
                    'wan30_standard',
                    'wan30_prime',
                  ].map((group) => (
                    <fieldset
                      key={group}
                      data-video-group={group}
                      disabled={busy !== null || forbidden}
                      className="min-w-0 space-y-4 border-t pt-4"
                    >
                      <legend className="pr-3 text-base font-semibold">
                        {t(`video.groups.${group}`)}
                      </legend>
                      <div className="grid gap-6 md:grid-cols-3">
                        {WAN_PRICE_FIELDS.filter(({ name }) =>
                          name.startsWith(`polaris_${group}_`)
                        ).map(({ name }) => (
                          <FormField
                            key={name}
                            control={form.control}
                            name={`rates.${name}`}
                            render={({ field }) => (
                              <FormItem className="min-w-0 scroll-mt-24">
                                <FormLabel>
                                  {name.includes('_text_')
                                    ? `${t('video.text')} · `
                                    : name.includes('_image_')
                                      ? `${t('video.image')} · `
                                      : ''}
                                  {name.match(/_(480|720|1080)p_/)?.[1]}P ·{' '}
                                  {t('video.unit')}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="text"
                                    inputMode="text"
                                    autoComplete="off"
                                    maxLength={13}
                                    readOnly={
                                      name in (savedVideo?.overrides ?? {})
                                    }
                                    aria-readonly={
                                      name in (savedVideo?.overrides ?? {})
                                    }
                                    onChange={(event) => {
                                      field.onChange(event);
                                      form.clearErrors(field.name);
                                      setNotice(null);
                                    }}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {t(
                                    name in (savedVideo?.overrides ?? {})
                                      ? 'video.environment_override'
                                      : 'video.rate_tip'
                                  )}
                                </FormDescription>
                                <div className="min-h-5">
                                  <FormMessage />
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </fieldset>
                  ))
                : (['monthly', 'annual', 'credits'] as const).map((mode) => (
                    <fieldset
                      key={mode}
                      data-pricing-mode={mode}
                      disabled={busy !== null || forbidden}
                      className="min-w-0 space-y-4 border-t pt-4"
                    >
                      <legend className="pr-3 text-base font-semibold">
                        {t(`modes.${mode}.title`)}
                      </legend>
                      <p className="text-muted-foreground text-sm">
                        {t(`modes.${mode}.description`)}
                      </p>
                      <div className="grid gap-6 md:grid-cols-3">
                        {savedCatalog.products
                          .filter((product) => product.mode === mode)
                          .map((product) => (
                            <section
                              key={product.id}
                              className="min-w-0 space-y-3"
                              aria-label={t(`tiers.${product.tier}`)}
                            >
                              <h3 className="font-medium">
                                {t(`tiers.${product.tier}`)}
                              </h3>
                              {(['price', 'credits'] as const).map((key) => (
                                <FormField
                                  key={key}
                                  control={form.control}
                                  name={`products.${product.id}.${key}`}
                                  render={({ field }) => (
                                    <FormItem className="scroll-mt-24">
                                      <FormLabel>
                                        {t(`modes.${mode}.${key}`)}
                                      </FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          type="text"
                                          inputMode={
                                            key === 'price'
                                              ? 'decimal'
                                              : 'numeric'
                                          }
                                          autoComplete="off"
                                          maxLength={key === 'price' ? 9 : 10}
                                          required
                                          onChange={(event) => {
                                            field.onChange(event);
                                            form.clearErrors(field.name);
                                            setNotice(null);
                                          }}
                                        />
                                      </FormControl>
                                      <FormDescription className="sr-only">
                                        {t(
                                          `errors.${key === 'price' ? 'invalid_price' : 'invalid_credits'}`
                                        )}
                                      </FormDescription>
                                      <div className="min-h-5">
                                        <FormMessage />
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </section>
                          ))}
                      </div>
                    </fieldset>
                  ))}
              <div className="bg-card space-y-3 border-t pt-4 pb-2 md:sticky md:bottom-0">
                <div className="min-h-6 text-sm">
                  {issue ? (
                    <div role="alert" className="flex items-start gap-2">
                      <AlertCircle
                        aria-hidden="true"
                        className="text-destructive mt-0.5 size-4 shrink-0"
                      />
                      <div className="space-y-2">
                        <p>{t(`errors.${issue}`)}</p>
                        {mustReload && (
                          <p className="text-muted-foreground">
                            {t('reload_warning')}
                          </p>
                        )}
                        {issue === 'pricing_unauthorized' && (
                          <a
                            className="cursor-pointer underline underline-offset-4"
                            href={`${locale === 'en' ? '' : `/${locale}`}/sign-in?callbackUrl=${encodeURIComponent(`${locale === 'en' ? '' : `/${locale}`}/admin/settings/pricing`)}`}
                          >
                            {t('sign_in')}
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p role="status" aria-live="polite">
                      {notice
                        ? t(
                            video && notice === 'saved' ? 'video.saved' : notice
                          )
                        : dirty
                          ? t('unsaved')
                          : t(video ? 'video.ready' : 'ready')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="submit"
                    disabled={busy !== null || mustReload || forbidden}
                    aria-busy={busy === 'save'}
                    className="h-11 cursor-pointer active:opacity-90 disabled:cursor-not-allowed"
                  >
                    <span className="size-4" aria-hidden="true">
                      {busy === 'save' && (
                        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                      )}
                    </span>
                    {t(video ? 'video.save' : 'save')}
                  </Button>
                  {mustReload && (
                    <Button
                      type="button"
                      variant="outline"
                      data-action="reload-pricing"
                      disabled={busy !== null || forbidden}
                      aria-busy={busy === 'reload'}
                      onClick={reload}
                      className="h-auto min-h-11 cursor-pointer whitespace-normal active:opacity-90 disabled:cursor-not-allowed"
                    >
                      <span className="size-4" aria-hidden="true">
                        {busy === 'reload' && (
                          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                        )}
                      </span>
                      {t('reload')}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
      <Dialog
        open={leavingTo !== null}
        onOpenChange={(open) => {
          if (!open) setLeavingTo(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            keepEditing.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            navigationTrigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('leave_title')}</DialogTitle>
            <DialogDescription>
              {hasPending ? t('leave_pending') : t('leave_description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={keepEditing}
              type="button"
              className="cursor-pointer"
              onClick={() => setLeavingTo(null)}
            >
              {t('keep_editing')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                if (!leavingTo) return;
                allowNavigation.current = true;
                const target = new URL(leavingTo);
                setLeavingTo(null);
                request.current?.abort();
                if (target.origin === window.location.origin)
                  router.push(
                    `${target.pathname}${target.search}${target.hash}`
                  );
                else window.location.assign(target.href);
              }}
            >
              {t('leave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
