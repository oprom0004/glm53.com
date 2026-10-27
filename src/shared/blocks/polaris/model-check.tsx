'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

const errorCodes = new Set([
  'unauthenticated',
  'forbidden',
  'missing_key',
  'invalid_base_url',
  'invalid_api_key',
  'invalid_key',
  'access_denied',
  'rate_limited',
  'unavailable',
  'timeout',
  'invalid_response',
]);

export function PolarisModelCheck() {
  const t = useTranslations('admin.settings.polaris.check');
  const id = useId();
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    []
  );

  async function check() {
    if (active.current) return;

    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError('');
    setModels(null);

    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/api/admin/polaris/models', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.error === 'string' && errorCodes.has(result.error)
            ? result.error
            : 'unavailable'
        );
      }
      if (
        !Array.isArray(result.models) ||
        result.models.length > 200 ||
        !result.models.every(
          (model: unknown) => typeof model === 'string' && model.length <= 200
        )
      ) {
        throw new Error('invalid_response');
      }
      if (active.current === controller && !controller.signal.aborted) {
        setModels(result.models);
      }
    } catch (cause) {
      if (active.current !== controller) return;
      const code = controller.signal.aborted
        ? 'timeout'
        : cause instanceof Error && errorCodes.has(cause.message)
          ? cause.message
          : 'unavailable';
      setError(code);
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <Card className="mb-8 md:max-w-xl" aria-labelledby={`${id}-title`}>
      <CardHeader>
        <CardTitle>
          <h2 id={`${id}-title`}>{t('title')}</h2>
        </CardTitle>
        <CardDescription id={`${id}-help`}>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          disabled={busy}
          aria-busy={busy}
          aria-describedby={`${id}-help`}
          onClick={check}
        >
          {busy ? (
            <LoaderCircle
              className="motion-safe:animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Search aria-hidden="true" />
          )}
          {t('button')}
        </Button>
        <p role="status" className="text-muted-foreground min-h-5 text-sm">
          {busy
            ? t('loading')
            : models
              ? models.length
                ? t('success', { count: models.length })
                : t('empty')
              : t('idle')}
        </p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {t(`errors.${error}`)}
          </p>
        )}
        {models && models.length > 0 && (
          <div
            role="region"
            aria-label={t('list_label')}
            tabIndex={0}
            className="border-border focus-visible:outline-ring max-h-72 overflow-auto rounded-md border p-3 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ul className="space-y-2 text-sm">
              {models.map((model) => (
                <li key={model}>
                  <code className="break-all">{model}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
