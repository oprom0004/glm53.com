import { useCallback, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ControllerRenderProps } from 'react-hook-form';

import { Button } from '@/shared/components/ui/button';
import { Input as InputComponent } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import { FormField } from '@/shared/types/blocks/form';

export function Input({
  field,
  formField,
  data,
  ...controlProps
}: {
  field: FormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
  data?: any;
} & ComponentProps<'input'>) {
  const controlRef = controlProps.ref;
  const [revealed, setRevealed] = useState(false);
  const t = useTranslations('common.form');
  const canReveal =
    field.type === 'password' && field.metadata?.revealSecret === true;
  const ref = useCallback(
    (node: HTMLInputElement | null) => {
      formField.ref(node);
      if (typeof controlRef === 'function') controlRef(node);
      else if (controlRef) controlRef.current = node;
    },
    [formField.ref, controlRef]
  );
  const input = (
    <InputComponent
      {...field.attributes}
      {...controlProps}
      name={formField.name}
      value={formField.value as string}
      onChange={formField.onChange}
      onBlur={formField.onBlur}
      disabled={formField.disabled || controlProps.disabled}
      type={canReveal && revealed ? 'text' : field.type || 'text'}
      placeholder={
        field.metadata?.configured ? '••••••••' : field.placeholder
      }
      className={cn(
        'bg-background placeholder:text-base-content/50 rounded-md',
        canReveal && 'pr-11',
        controlProps.className
      )}
      ref={ref}
    />
  );
  if (!canReveal) return input;

  return (
    <div className="relative">
      {input}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        aria-label={revealed ? t('hide_secret') : t('show_secret')}
        aria-pressed={revealed}
        aria-controls={controlProps.id}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
    </div>
  );
}
