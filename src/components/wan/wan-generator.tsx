'use client';

import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Image as ImageIcon,
  LoaderCircle,
  Play,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useLocale } from 'next-intl';

import { Link, useRouter } from '@/core/i18n/navigation';
import { ResultVideo } from '@/shared/blocks/account/result-video';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { kieWan2Limits } from '@/shared/services/kie-wan2-contract';

import {
  getWanGeneratorCopy,
  WAN_GENERATOR_CONFIGS,
  type WanUiMode,
  type WanUiResolution,
  type WanUiVersion,
} from './generator-copy';
import { SourcePreview } from './source-preview';
import { useWanGeneration, type Quote } from './use-wan-generation';

type Tier = 'standard' | 'prime';
type Ratio = 'adaptive' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
type SelectedMedia = {
  type: 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video';
  file: File;
};

const ratios: Ratio[] = ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'];
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function WanGenerator({ version = '3.0' }: { version?: WanUiVersion }) {
  const locale = useLocale();
  const router = useRouter();
  const copy = getWanGeneratorCopy(locale);
  const config = WAN_GENERATOR_CONFIGS[version];
  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();
  const [mode, setMode] = useState<WanUiMode>(config.modes[0]);
  const [tier, setTier] = useState<Tier>('standard');
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState<Ratio>(
    version === '3.0' ? '16:9' : 'adaptive'
  );
  const [resolution, setResolution] = useState<WanUiResolution>('720P');
  const [duration, setDuration] = useState(5);
  const [media, setMedia] = useState<SelectedMedia[]>([]);
  const [localError, setLocalError] = useState('');

  const generation = useWanGeneration({
    version,
    mode,
    userId: user?.id,
    onRequireSignIn: () => setIsShowSignModal?.(true),
    onInsufficientCredits: () => router.push('/pricing'),
    onCreditsChanged: fetchUserCredits,
  });
  const { prepareQuote } = generation;

  useEffect(() => {
    setMode(config.modes[0]);
    setTier('standard');
    setRatio(version === '3.0' ? '16:9' : 'adaptive');
    setResolution(config.resolutions.includes('720P') ? '720P' : '480P');
    setDuration(5);
    setMedia([]);
    setLocalError('');
  }, [config.modes, config.resolutions, version]);

  useEffect(() => {
    if (mode === 'text') setMedia([]);
    if (version !== '3.0') {
      setTier('standard');
      setRatio('adaptive');
      setMedia((current) =>
        current.filter((item) => item.type === 'first_frame')
      );
    }
  }, [mode, version]);

  const selectedTier = generation.capabilities?.tiers?.[tier];
  const defaultLimits =
    version === '3.0' ? undefined : kieWan2Limits(version, mode);
  const durationLimits = generation.capabilities?.duration ??
    defaultLimits?.duration ?? { min: 2, max: config.maxDuration, step: 1 };
  const maxPromptLength =
    generation.capabilities?.maxPromptLength ??
    defaultLimits?.maxPromptLength ??
    20_000;
  const availableRatios: Ratio[] =
    generation.capabilities?.ratios ??
    (version === '3.0' ? ratios : (defaultLimits?.ratios ?? ['adaptive']));
  const ratioKey = availableRatios.join(',');
  useEffect(() => {
    const allowed = ratioKey.split(',') as Ratio[];
    if (!allowed.includes(ratio)) setRatio(allowed[0]);
  }, [ratioKey, ratio]);
  useEffect(() => {
    if (
      duration < durationLimits.min ||
      duration > durationLimits.max ||
      (duration - durationLimits.min) % (durationLimits.step ?? 1)
    )
      setDuration(5);
  }, [duration, durationLimits.min, durationLimits.max, durationLimits.step]);
  const currentOption = selectedTier?.resolutions?.[resolution];
  const optionUnavailable =
    selectedTier?.enabled !== true || currentOption?.enabled !== true;

  const unavailableReason = currentOption?.reason || selectedTier?.reason;
  const unavailableMessage = generation.capabilitiesLoading
    ? copy.checkingAvailability
    : generation.capabilitiesError
      ? copy.availabilityFailed
      : copy.errors[unavailableReason as keyof typeof copy.errors] ||
        copy.unavailable;

  const draft = useMemo(
    () => ({
      version,
      tier,
      mode,
      duration,
      resolution,
      ratio,
      prompt: prompt.trim(),
      media,
    }),
    [duration, media, mode, prompt, ratio, resolution, tier, version]
  );

  const pricingDraft = useMemo(
    () => ({
      version,
      tier,
      mode,
      duration,
      resolution,
      ratio,
      prompt: '',
      media,
    }),
    [version, tier, mode, duration, resolution, ratio, media]
  );
  const [quoteState, setQuoteState] = useState<{
    draft: typeof pricingDraft;
    owner: string;
    quote?: Quote;
    error?: string;
  } | null>(null);
  const [quoteRevision, setQuoteRevision] = useState(0);
  useEffect(() => {
    if (generation.errorCode === 'price_changed')
      setQuoteRevision((value) => value + 1);
  }, [generation.errorCode]);
  const hasRequiredMedia =
    mode === 'text' ||
    (mode === 'image'
      ? media.some((item) => item.type === 'first_frame')
      : media.length > 0);
  const currentQuote =
    quoteState?.draft === pricingDraft && quoteState.owner === user?.id
      ? quoteState
      : null;
  useEffect(() => {
    if (!user?.id || optionUnavailable || !hasRequiredMedia) return;
    let active = true;
    const owner = user.id;
    setQuoteState(null);
    const timer = setTimeout(() => {
      void prepareQuote(pricingDraft)
        .then((quote) => {
          if (active) setQuoteState({ draft: pricingDraft, owner, quote });
        })
        .catch((cause: unknown) => {
          if (active)
            setQuoteState({
              draft: pricingDraft,
              owner,
              error: cause instanceof Error ? cause.message : 'request_failed',
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    user?.id,
    optionUnavailable,
    hasRequiredMedia,
    pricingDraft,
    quoteRevision,
    prepareQuote,
  ]);

  function validFile(file: File) {
    return (
      file.size > 0 &&
      file.size <= 10 * 1024 * 1024 &&
      allowedImageTypes.has(file.type)
    );
  }

  function selectSingle(
    event: ChangeEvent<HTMLInputElement>,
    type: SelectedMedia['type']
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !validFile(file)) {
      setLocalError(copy.fileInvalid);
      return;
    }
    setLocalError('');
    setMedia((current) => [
      ...current.filter((item) => item.type !== type),
      { type, file },
    ]);
  }

  function selectReferences(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length > 10) {
      setLocalError(copy.referenceLimit);
      return;
    }
    if (!files.length || files.some((file) => !validFile(file))) {
      setLocalError(copy.fileInvalid);
      return;
    }
    setLocalError('');
    setMedia((current) => [
      ...current.filter((item) => item.type === 'reference_video'),
      ...files.map((file) => ({ type: 'reference_image' as const, file })),
    ]);
  }

  function selectReferenceVideos(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    const existing = media.filter((item) => item.type === 'reference_video');
    if (existing.length + files.length > 5) {
      setLocalError(copy.referenceVideoLimit);
      return;
    }
    if (
      files.some(
        (file) =>
          file.size <= 0 ||
          file.size > 100 * 1024 * 1024 ||
          !/\.(mp4|mov)$/i.test(file.name)
      )
    ) {
      setLocalError(copy.errors.invalid_reference_video);
      return;
    }
    setLocalError('');
    setMedia((current) => [
      ...current,
      ...files.map((file) => ({ type: 'reference_video' as const, file })),
    ]);
  }

  async function generateVideo() {
    setLocalError('');
    if (!user) {
      setIsShowSignModal?.(true);
      return;
    }
    if (generation.isLocked) return;
    if (mode === 'text' && !prompt.trim()) {
      setLocalError(copy.promptRequired);
      return;
    }
    const minPromptLength =
      generation.capabilities?.minPromptLength ??
      defaultLimits?.minPromptLength ??
      (mode === 'text' ? 1 : 0);
    if (
      prompt.trim().length < minPromptLength ||
      prompt.length > maxPromptLength
    ) {
      setLocalError(
        !prompt.trim()
          ? copy.promptRequired
          : copy.promptLengthInvalid(minPromptLength, maxPromptLength)
      );
      return;
    }
    if (
      (mode === 'image' &&
        !media.some((item) => item.type === 'first_frame')) ||
      (mode === 'reference' && !media.length)
    ) {
      setLocalError(copy.imageRequired);
      return;
    }
    if (!currentQuote?.quote) return;
    await generation.generate(draft, currentQuote.quote);
  }

  const visibleError =
    localError ||
    (generation.errorCode
      ? copy.errors[generation.errorCode as keyof typeof copy.errors] ||
        copy.errors.request_failed
      : '');
  const phaseLabel = {
    idle: copy.ready,
    quoting: copy.quoting,
    uploading: copy.uploading,
    submitting: copy.submitting,
    polling: copy.polling,
    succeeded: copy.ready,
    failed: visibleError || copy.errors.request_failed,
  }[generation.phase];

  return (
    <section
      id="generator"
      className="bg-muted/30 pt-6 pb-16 md:pt-10 md:pb-24"
    >
      <div className="relative z-10 container mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-500/8 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-violet-700 uppercase dark:text-violet-200">
            {copy.eyebrow} · Wan {version}
          </span>
          <h1 className="text-foreground mt-4 text-3xl font-bold tracking-tight md:text-5xl">
            {copy.title(version)}
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm sm:text-base">
            {copy.description(version)}
          </p>
        </div>

        <div className="bg-card border-border/60 mt-8 rounded-2xl border p-4 shadow-sm sm:p-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <fieldset
              disabled={generation.isLocked}
              className="min-w-0 space-y-5"
            >
              <div
                className={`${config.modes.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} border-border/60 bg-muted/40 grid overflow-hidden rounded-full border p-1`}
                role="group"
                aria-label={copy.model}
              >
                {config.modes.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={mode === item}
                    onClick={() => {
                      if (item !== mode) {
                        setMedia([]);
                        setLocalError('');
                        setMode(item);
                      }
                    }}
                    className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                      mode === item
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {copy.modes[item]}
                  </button>
                ))}
              </div>

              {version === '3.0' && (
                <fieldset>
                  <legend className="text-foreground text-sm font-semibold">
                    {copy.model}
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {(['standard', 'prime'] as const).map((item) => {
                      const unavailable =
                        generation.capabilities?.tiers?.[item] &&
                        !generation.capabilities.tiers[item].enabled;
                      return (
                        <button
                          key={item}
                          type="button"
                          title={
                            unavailable
                              ? copy.errors[
                                  generation.capabilities?.tiers?.[item]
                                    ?.reason as keyof typeof copy.errors
                                ] || copy.unavailable
                              : undefined
                          }
                          aria-pressed={tier === item}
                          onClick={() => setTier(item)}
                          className={`flex min-h-16 items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                            tier === item
                              ? 'border-violet-600 bg-violet-600 text-white'
                              : 'border-border bg-muted/30 text-foreground hover:border-violet-400'
                          }`}
                        >
                          <span>
                            <span className="block text-sm font-semibold">
                              {copy[item]}
                            </span>
                            <span
                              className={`block text-xs ${tier === item ? 'text-white/80' : 'text-muted-foreground'}`}
                            >
                              {item === 'standard'
                                ? copy.standardHint
                                : copy.primeHint}
                            </span>
                          </span>
                          {tier === item && (
                            <CheckCircle2
                              className="size-4"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {mode === 'image' && (
                <div
                  className={`grid gap-3 ${version === '3.0' ? 'sm:grid-cols-2' : ''}`}
                >
                  <MediaPicker
                    label={copy.firstFrame}
                    requirement={copy.required}
                    help={copy.uploadHelp}
                    action={copy.upload}
                    file={
                      media.find((item) => item.type === 'first_frame')?.file
                    }
                    onChange={(event) => selectSingle(event, 'first_frame')}
                  />
                  {version === '3.0' && (
                    <MediaPicker
                      label={copy.lastFrame}
                      requirement={copy.optional}
                      help={copy.uploadHelp}
                      action={copy.upload}
                      file={
                        media.find((item) => item.type === 'last_frame')?.file
                      }
                      onChange={(event) => selectSingle(event, 'last_frame')}
                    />
                  )}
                </div>
              )}

              {mode === 'reference' && (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs">
                    {copy.referenceHelp}
                  </p>
                  <MediaPicker
                    label={copy.referenceImages}
                    requirement={copy.optional}
                    help={copy.uploadHelp}
                    action={copy.upload}
                    file={
                      media.find((item) => item.type === 'reference_image')
                        ?.file
                    }
                    count={
                      media.filter((item) => item.type === 'reference_image')
                        .length
                    }
                    multiple
                    onChange={selectReferences}
                  />
                  {generation.capabilities?.referenceVideo && (
                    <>
                      <MediaPicker
                        label={copy.referenceVideos}
                        requirement={copy.optional}
                        help={copy.videoUploadHelp}
                        action={copy.uploadVideo}
                        multiple
                        accept="video/mp4,video/quicktime,.mp4,.mov"
                        onChange={selectReferenceVideos}
                      />
                      <p className="text-muted-foreground text-xs">
                        {copy.referenceVideoBilling}
                      </p>
                    </>
                  )}
                </div>
              )}

              {media.length > 0 && (
                <ul
                  aria-label={copy.sourcePreviews}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {media.map((item, index) => {
                    const number = media
                      .slice(0, index + 1)
                      .filter((entry) => entry.type === item.type).length;
                    const label =
                      item.type === 'first_frame'
                        ? copy.firstFrame
                        : item.type === 'last_frame'
                          ? copy.lastFrame
                          : `${item.type === 'reference_video' ? 'Video' : 'Image'}${number}`;
                    return (
                      <SourcePreview
                        key={`${item.type}-${index}`}
                        file={item.file}
                        label={label}
                        video={item.type === 'reference_video'}
                        remove={copy.remove}
                        isZh={locale === 'zh'}
                        onRemove={() => {
                          setMedia((current) =>
                            current.filter((entry) => entry !== item)
                          );
                          setLocalError('');
                        }}
                      />
                    );
                  })}
                </ul>
              )}

              <div>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor={`wan-${version}-prompt`}
                    className="text-foreground text-sm font-semibold"
                  >
                    {copy.prompt}
                  </label>
                  <span className="text-muted-foreground text-xs">
                    {prompt.length} / {maxPromptLength.toLocaleString('en-US')}
                  </span>
                </div>
                <textarea
                  id={`wan-${version}-prompt`}
                  value={prompt}
                  maxLength={maxPromptLength}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={copy.promptPlaceholder}
                  className="border-border/60 bg-muted/30 text-foreground placeholder:text-muted-foreground dark:border-input dark:bg-background mt-2 min-h-28 w-full resize-none rounded-xl border p-3 text-sm transition outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div className="space-y-4">
                {availableRatios.length > 1 && (
                  <OptionGroup label={copy.ratio}>
                    {availableRatios.map((item) => (
                      <OptionButton
                        key={item}
                        active={ratio === item}
                        onClick={() => setRatio(item)}
                      >
                        {item}
                      </OptionButton>
                    ))}
                  </OptionGroup>
                )}

                <OptionGroup label={copy.resolution}>
                  {config.resolutions.map((item) => {
                    return (
                      <OptionButton
                        key={item}
                        active={resolution === item}
                        onClick={() => setResolution(item)}
                      >
                        {item}
                      </OptionButton>
                    );
                  })}
                </OptionGroup>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <label htmlFor={`wan-${version}-duration`}>
                      {copy.duration}
                    </label>
                    <span className="text-violet-600 dark:text-violet-400">
                      {duration} {copy.seconds}
                    </span>
                  </div>
                  <input
                    id={`wan-${version}-duration`}
                    type="range"
                    min={durationLimits.min}
                    max={durationLimits.max}
                    step={durationLimits.step ?? 1}
                    value={duration}
                    onChange={(event) =>
                      setDuration(Number(event.target.value))
                    }
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-sm bg-violet-100 accent-violet-600 dark:bg-violet-950"
                  />
                  <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
                    <span>{durationLimits.min}s</span>
                    <span>{durationLimits.max}s</span>
                  </div>
                </div>
              </div>

              {optionUnavailable && (
                <p
                  className="text-sm text-amber-700 dark:text-amber-300"
                  role="status"
                >
                  {unavailableMessage}
                  {!generation.capabilitiesLoading && (
                    <button
                      type="button"
                      className="ml-2 underline underline-offset-4"
                      onClick={generation.refreshCapabilities}
                    >
                      {copy.retryAvailability}
                    </button>
                  )}
                </p>
              )}
              {visibleError && (
                <p className="text-destructive text-sm" role="alert">
                  {visibleError}
                </p>
              )}

              {!optionUnavailable && (
                <div
                  className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 text-sm"
                  aria-live="polite"
                  data-testid="generation-price"
                >
                  {!user ? (
                    copy.signInForPrice
                  ) : !hasRequiredMedia ? (
                    copy.addMediaForPrice
                  ) : currentQuote?.error ? (
                    <>
                      <p className="text-destructive">
                        {copy.errors[
                          currentQuote.error as keyof typeof copy.errors
                        ] || copy.errors.request_failed}
                      </p>
                      <button
                        type="button"
                        className="mt-2 text-violet-600 underline"
                        onClick={() => setQuoteRevision((value) => value + 1)}
                      >
                        {copy.retryPrice}
                      </button>
                    </>
                  ) : currentQuote?.quote ? (
                    <>
                      <p className="font-semibold">
                        {copy.generationCost(currentQuote.quote.credits)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {user.credits
                          ? `${copy.balance(user.credits.remainingCredits)} · `
                          : ''}
                        {copy.chargeOnGenerate}
                      </p>
                    </>
                  ) : (
                    <p>
                      {media.some((item) => item.type === 'reference_video')
                        ? copy.checkingVideoPrice
                        : copy.checkingPrice}
                    </p>
                  )}
                </div>
              )}

              <Button
                type="button"
                size="lg"
                aria-busy={generation.isBusy}
                className="h-12 w-full cursor-pointer rounded-full bg-violet-600 text-white shadow-md shadow-violet-500/20 hover:bg-violet-500"
                disabled={
                  generation.isLocked ||
                  isCheckSign ||
                  (!!user &&
                    (optionUnavailable ||
                      (hasRequiredMedia && !currentQuote?.quote)))
                }
                onClick={generateVideo}
              >
                {generation.isBusy ? (
                  <LoaderCircle
                    className="motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}
                {isCheckSign
                  ? copy.signingIn
                  : generation.isBusy
                    ? phaseLabel
                    : copy.generate}
              </Button>
            </fieldset>

            <div className="space-y-4">
              <div className="bg-background border-border/60 rounded-xl border p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-foreground text-sm font-semibold">
                    {copy.result}
                  </p>
                  <span className="text-muted-foreground text-right text-xs">
                    {resolution} · {ratio} · {duration}s
                  </span>
                </div>
                <div className="relative mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black">
                  {generation.task?.videoUrl ? (
                    <ResultVideo
                      src={generation.task.videoUrl}
                      isZh={locale === 'zh'}
                    />
                  ) : generation.isBusy ? (
                    <div className="flex flex-col items-center gap-3 p-5 text-center text-white">
                      <LoaderCircle
                        className="size-10 text-violet-400 motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold">{phaseLabel}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-5 text-center text-white/70">
                      <Play className="size-10" aria-hidden="true" />
                      <p className="text-sm">{phaseLabel}</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex min-h-7 items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground" role="status">
                    {phaseLabel}
                  </span>
                  {generation.task?.videoUrl && (
                    <a
                      href={generation.task.videoUrl}
                      download
                      className="inline-flex items-center gap-1.5 font-semibold text-violet-600 hover:underline dark:text-violet-300"
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                      {copy.download}
                    </a>
                  )}
                  {generation.canResume && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={generation.resume}
                    >
                      {copy.resume}
                    </Button>
                  )}
                </div>
                {generation.canResume && (
                  <Link
                    href="/my-videos"
                    className="mt-2 inline-block text-xs text-violet-600 hover:underline dark:text-violet-300"
                  >
                    {copy.history}
                  </Link>
                )}
              </div>

              <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <ImageIcon
                    className="size-4 text-violet-500"
                    aria-hidden="true"
                  />
                  <p className="text-foreground text-sm font-semibold">
                    Wan {version}
                  </p>
                </div>
                <p className="text-muted-foreground mt-2 text-xs leading-5">
                  {copy.description(version)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OptionGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-foreground text-xs font-semibold">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function OptionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-violet-600 bg-violet-600 text-white'
          : 'border-border bg-muted/30 text-foreground hover:border-violet-400'
      }`}
    >
      {children}
    </button>
  );
}

function MediaPicker({
  label,
  requirement,
  help,
  action,
  file,
  count,
  multiple,
  onChange,
  accept = 'image/jpeg,image/png,image/webp',
}: {
  label: string;
  requirement: string;
  help: string;
  action: string;
  file?: File;
  count?: number;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
}) {
  return (
    <div>
      <p className="text-foreground text-xs font-semibold">
        {label} · {requirement}
      </p>
      <label className="border-border bg-muted/20 mt-1.5 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-3 text-center transition-colors focus-within:ring-2 focus-within:ring-violet-500/70 hover:border-violet-400 hover:bg-violet-500/5">
        {file ? (
          <span className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-300">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {count && count > 1 ? `${count} · ${file.name}` : file.name}
          </span>
        ) : (
          <>
            <Upload className="size-5 text-violet-500" aria-hidden="true" />
            <span className="text-foreground mt-1 text-xs font-medium">
              {action}
            </span>
            <span className="text-muted-foreground text-[11px]">{help}</span>
          </>
        )}
        <input
          type="file"
          accept={accept}
          aria-label={label}
          multiple={multiple}
          className="sr-only"
          onChange={onChange}
        />
      </label>
    </div>
  );
}
