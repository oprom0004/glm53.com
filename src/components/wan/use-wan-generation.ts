'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  WanUiMode,
  WanUiResolution,
  WanUiVersion,
} from './generator-copy';

export type WanGenerationPhase =
  | 'idle'
  | 'quoting'
  | 'uploading'
  | 'submitting'
  | 'polling'
  | 'succeeded'
  | 'failed';
export type Draft = {
  version: WanUiVersion;
  tier: 'standard' | 'prime';
  mode: WanUiMode;
  duration: number;
  resolution: WanUiResolution;
  ratio: 'adaptive' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  prompt: string;
  media: {
    type: 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video';
    file: File;
  }[];
};
export type Quote = {
  credits: number;
  normalizedInput: Omit<Draft, 'prompt' | 'media'> & {
    referenceVideos?: { url: string; token: string }[];
  };
  quoteVersion: string;
};
type PublicTask = {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  phase: string;
  costCredits: number;
  videoUrl?: string;
  errorCode?: string;
};
type Scope = {
  identity: string;
  userId?: string;
  version: WanUiVersion;
  controller: AbortController;
  busy: boolean;
  pendingId: string | null;
  deadline: number;
  timer?: ReturnType<typeof setTimeout>;
  uploadedVideos: WeakMap<File, Promise<{ url: string; token: string }>>;
};
const ACTIVE_PHASES = new Set([
  'quoting',
  'uploading',
  'submitting',
  'polling',
]);
const TASK_ID = /^wan-[a-f0-9]{64}$/;
// Only opaque task IDs, scoped to their owner/version; never persist prompts or files.
const pendingTasks = new Map<string, string>();
const storageKey = (scope: Scope) =>
  `wan-task:${encodeURIComponent(scope.userId!)}:${scope.version}`;
class RequestError extends Error {
  constructor(
    public code: string,
    public uncertain = false
  ) {
    super(code);
  }
}

async function api<T>(
  url: string,
  init: RequestInit,
  lifetime: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  lifetime.addEventListener('abort', cancel, { once: true });
  if (lifetime.aborted) controller.abort();
  const timer = setTimeout(
    cancel,
    url.endsWith('/upload-video')
      ? 180_000
      : url.endsWith('/generate')
        ? 60_000
        : 30_000
  );
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
    const result = await response.json();
    if (controller.signal.aborted)
      throw new RequestError('request_failed', true);
    if (!response.ok || result.code !== 0) {
      const code =
        response.status === 401
          ? 'unauthenticated'
          : typeof result.message === 'string'
            ? result.message
            : 'request_failed';
      throw new RequestError(
        code,
        response.status >= 500 || code === 'idempotency_conflict'
      );
    }
    return result.data as T;
  } catch (cause) {
    if (cause instanceof RequestError) throw cause;
    throw new RequestError('request_failed', true);
  } finally {
    clearTimeout(timer);
    lifetime.removeEventListener('abort', cancel);
  }
}

export function useWanGeneration({
  version,
  mode,
  userId,
  onRequireSignIn,
  onInsufficientCredits,
  onCreditsChanged,
}: {
  version: WanUiVersion;
  mode: WanUiMode;
  userId?: string;
  onRequireSignIn: () => void;
  onInsufficientCredits?: () => void;
  onCreditsChanged?: () => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<WanGenerationPhase>('idle');
  const [capabilities, setCapabilities] = useState<any>(null);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [capabilitiesError, setCapabilitiesError] = useState(false);
  const [capabilitiesRevision, setCapabilitiesRevision] = useState(0);
  const [task, setTask] = useState<PublicTask | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState('');
  const scopeRef = useRef<Scope | null>(null);
  const identity = `${userId || ''}\0${version}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const callbacks = useRef({
    onRequireSignIn,
    onInsufficientCredits,
    onCreditsChanged,
  });
  callbacks.current = {
    onRequireSignIn,
    onInsufficientCredits,
    onCreditsChanged,
  };
  const isCurrent = useCallback(
    (scope: Scope) =>
      scopeRef.current === scope &&
      currentIdentity.current === scope.identity &&
      !scope.controller.signal.aborted,
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    setCapabilities(null);
    setCapabilitiesLoading(true);
    setCapabilitiesError(false);
    void api<any>(
      `/api/ai/wan/capabilities?version=${encodeURIComponent(version)}&mode=${encodeURIComponent(mode)}`,
      { method: 'GET' },
      controller.signal
    )
      .then((value) => {
        if (!controller.signal.aborted) setCapabilities(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCapabilitiesError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCapabilitiesLoading(false);
      });
    return () => controller.abort();
  }, [mode, version, capabilitiesRevision]);

  const remember = useCallback(
    (scope: Scope, id: string | null) => {
      if (!isCurrent(scope)) return;
      scope.pendingId = id;
      setPendingId(id);
      const key = storageKey(scope);
      if (id) pendingTasks.set(key, id);
      else pendingTasks.delete(key);
      try {
        if (id) window.localStorage.setItem(key, id);
        else window.localStorage.removeItem(key);
      } catch {}
    },
    [isCurrent]
  );
  const report = useCallback(
    (scope: Scope, cause: unknown) => {
      if (!isCurrent(scope)) return;
      const code =
        cause instanceof RequestError ? cause.code : 'request_failed';
      setErrorCode(code);
      setPhase('failed');
      scope.busy = false;
      if (code === 'unauthenticated') callbacks.current.onRequireSignIn();
      if (code === 'insufficient_credits')
        callbacks.current.onInsufficientCredits?.();
    },
    [isCurrent]
  );
  const notifyCredits = useCallback(
    (scope: Scope) => {
      // Balance refresh is secondary: failure must never unlock or discard a live task.
      void Promise.resolve()
        .then(() => {
          if (isCurrent(scope)) return callbacks.current.onCreditsChanged?.();
        })
        .catch(() => undefined);
    },
    [isCurrent]
  );
  const accept = useCallback(
    (scope: Scope, next: PublicTask): boolean => {
      if (!isCurrent(scope)) return true;
      if (
        !next ||
        !TASK_ID.test(next.id) ||
        next.id !== scope.pendingId ||
        !['pending', 'processing', 'success', 'failed'].includes(next.status)
      )
        throw new RequestError('request_failed', true);
      setTask(next);
      setErrorCode(next.errorCode || '');
      if (next.status === 'success' || next.status === 'failed') {
        remember(scope, null);
        scope.busy = false;
        setPhase(next.status === 'success' ? 'succeeded' : 'failed');
        if (next.status === 'failed')
          setErrorCode(next.errorCode || 'generation_failed');
        notifyCredits(scope);
        return true;
      }
      if (next.phase === 'submission_unknown') {
        scope.busy = false;
        setPhase('failed');
        setErrorCode('submission_unknown');
        return true;
      }
      setPhase('polling');
      return false;
    },
    [isCurrent, notifyCredits, remember]
  );
  const poll = useCallback(
    async function queryTask(scope: Scope) {
      if (!isCurrent(scope) || !scope.pendingId) return;
      if (Date.now() >= scope.deadline) {
        report(scope, new RequestError('poll_timeout'));
        return;
      }
      try {
        const next = await api<PublicTask>(
          '/api/ai/wan/query',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: scope.pendingId }),
          },
          scope.controller.signal
        );
        if (!isCurrent(scope) || accept(scope, next)) return;
        scope.timer = setTimeout(() => void queryTask(scope), 15_000);
      } catch (cause) {
        if (!isCurrent(scope)) return;
        // A missing task immediately after a lost POST response does not prove the POST never arrived.
        report(
          scope,
          cause instanceof RequestError && cause.code === 'task_not_found'
            ? new RequestError('submission_unknown', true)
            : cause
        );
      }
    },
    [accept, isCurrent, report]
  );

  useEffect(() => {
    const scope: Scope = {
      identity,
      userId,
      version,
      controller: new AbortController(),
      busy: false,
      pendingId: null,
      deadline: Date.now() + 15 * 60_000,
      uploadedVideos: new WeakMap(),
    };
    scopeRef.current = scope;
    setPhase('idle');
    setTask(null);
    setPendingId(null);
    setErrorCode('');
    if (userId) {
      const key = storageKey(scope);
      let saved = pendingTasks.get(key);
      try {
        saved ||= window.localStorage.getItem(key) || undefined;
      } catch {}
      if (saved && TASK_ID.test(saved)) {
        scope.pendingId = saved;
        scope.busy = true;
        setPendingId(saved);
        setPhase('polling');
        void poll(scope);
      }
    }
    return () => {
      scope.controller.abort();
      clearTimeout(scope.timer);
    };
  }, [identity, poll, userId, version]);

  // Upload once per owner/file, including concurrent quote requests. Never generate here.
  const prepareQuote = useCallback(
    async (draft: Draft): Promise<Quote> => {
      const scope = scopeRef.current;
      if (
        !scope ||
        !isCurrent(scope) ||
        !scope.userId ||
        draft.version !== scope.version
      )
        throw new RequestError('unauthenticated');
      const referenceVideos: { url: string; token: string }[] = [];
      for (const item of draft.media.filter(
        (item) => item.type === 'reference_video'
      )) {
        if (!isCurrent(scope)) throw new RequestError('unauthenticated');
        let upload = scope.uploadedVideos.get(item.file);
        if (!upload) {
          const form = new FormData();
          form.append('file', item.file);
          upload = api<{ url: string; token: string }>(
            '/api/ai/wan/upload-video',
            { method: 'POST', body: form },
            scope.controller.signal
          )
            .then((value) => {
              if (!value?.url || !value.token)
                throw new RequestError('upload_failed');
              return value;
            })
            .catch((error) => {
              scope.uploadedVideos.delete(item.file);
              throw error;
            });
          scope.uploadedVideos.set(item.file, upload);
        }
        const uploaded = await upload;
        if (!isCurrent(scope)) throw new RequestError('unauthenticated');
        referenceVideos.push({ url: uploaded.url, token: uploaded.token });
      }
      const { version, tier, mode, duration, resolution, ratio } = draft;
      const quote = await api<Quote>(
        '/api/ai/wan/quote',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version,
            tier,
            mode,
            duration,
            resolution,
            ratio,
            ...(referenceVideos.length ? { referenceVideos } : {}),
          }),
        },
        scope.controller.signal
      );
      if (!isCurrent(scope)) throw new RequestError('unauthenticated');
      if (
        !Number.isSafeInteger(quote?.credits) ||
        quote.credits <= 0 ||
        !quote.normalizedInput ||
        typeof quote.quoteVersion !== 'string'
      )
        throw new RequestError('pricing_not_configured');
      return quote;
    },
    [isCurrent]
  );

  const generate = useCallback(
    async (draft: Draft, displayedQuote?: Quote) => {
      const scope = scopeRef.current;
      if (!scope || !isCurrent(scope) || scope.busy || scope.pendingId) return;
      if (!scope.userId) {
        report(scope, new RequestError('unauthenticated'));
        return;
      }
      if (draft.version !== scope.version) return;
      scope.busy = true;
      setPhase('quoting');
      setErrorCode('');
      setTask(null);
      let submitted = false;
      try {
        const quote = await prepareQuote(draft);
        if (!isCurrent(scope)) return;
        if (
          displayedQuote &&
          (quote.credits !== displayedQuote.credits ||
            quote.quoteVersion !== displayedQuote.quoteVersion)
        )
          throw new RequestError('price_changed');
        const media: { type: Draft['media'][number]['type']; url: string }[] = (
          quote.normalizedInput.referenceVideos ?? []
        ).map((item) => ({ type: 'reference_video', url: item.url }));
        for (const item of draft.media.filter(
          (item) => item.type !== 'reference_video'
        )) {
          if (!isCurrent(scope)) return;
          setPhase('uploading');
          const form = new FormData();
          form.append('file', item.file);
          const uploaded = await api<{ url: string }>(
            '/api/ai/wan/upload',
            { method: 'POST', body: form },
            scope.controller.signal
          );
          if (!isCurrent(scope)) return;
          if (!uploaded?.url) throw new RequestError('upload_failed');
          media.push({ type: item.type, url: uploaded.url });
        }
        if (!isCurrent(scope)) return;
        const requestId = crypto.randomUUID();
        // Matches submitWanVideo's existing server ID contract exactly, including NUL separator.
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(`${scope.userId}\0${requestId}`)
        );
        if (!isCurrent(scope)) return;
        const id =
          'wan-' +
          Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, '0')
          ).join('');
        remember(scope, id);
        setPhase('submitting');
        submitted = true;
        const next = await api<PublicTask>(
          '/api/ai/wan/generate',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...quote.normalizedInput,
              prompt: draft.prompt,
              media,
              requestId,
              expectedCredits: quote.credits,
              quoteVersion: quote.quoteVersion,
            }),
          },
          scope.controller.signal
        );
        if (!isCurrent(scope) || accept(scope, next)) return;
        notifyCredits(scope);
        scope.deadline = Date.now() + 15 * 60_000;
        scope.timer = setTimeout(() => void poll(scope), 15_000);
      } catch (cause) {
        if (!isCurrent(scope)) return;
        if (
          submitted &&
          (!(cause instanceof RequestError) || cause.uncertain)
        ) {
          report(scope, new RequestError('submission_unknown', true));
        } else {
          if (submitted) remember(scope, null);
          report(scope, cause);
        }
      }
    },
    [accept, isCurrent, notifyCredits, poll, prepareQuote, remember, report]
  );
  const resume = useCallback(() => {
    const scope = scopeRef.current;
    if (!scope || !isCurrent(scope) || !scope.pendingId || scope.busy) return;
    scope.busy = true;
    scope.deadline = Date.now() + 15 * 60_000;
    setPhase('polling');
    setErrorCode('');
    void poll(scope);
  }, [isCurrent, poll]);
  const isBusy = ACTIVE_PHASES.has(phase);
  return {
    phase,
    capabilities,
    capabilitiesLoading,
    capabilitiesError,
    refreshCapabilities: () => setCapabilitiesRevision((value) => value + 1),
    task,
    errorCode,
    isBusy,
    isLocked: isBusy || !!pendingId,
    canResume: !!pendingId && !isBusy,
    generate,
    prepareQuote,
    resume,
  };
}
