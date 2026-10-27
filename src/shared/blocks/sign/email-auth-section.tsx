'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';

export function EmailAuthSection({
  children,
  defaultExpanded = false,
  disabled = false,
}: {
  children: ReactNode;
  defaultExpanded?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations('common.sign');
  const [expanded, setExpanded] = useState(defaultExpanded);
  const id = useId();
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) content.current?.querySelector('input')?.focus();
  }, [expanded]);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">{t('auth_or')}</span>
        <span className="bg-border h-px flex-1" />
      </div>
      <Button
        type="button"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground h-11 w-full gap-2 text-sm"
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        <Mail className="size-4" aria-hidden="true" />
        {t('continue_with_email')}
        <ChevronDown
          className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>
      <div id={id} ref={content} hidden={!expanded}>
        {expanded && <div className="grid gap-6">{children}</div>}
      </div>
    </div>
  );
}
