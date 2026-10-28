'use client';

import { useEffect, useState } from 'react';
import { UIMessage, UseChatHelpers } from '@ai-sdk/react';
import { BrainCircuitIcon, GlobeIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/shared/components/ai-elements/prompt-input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useChatContext } from '@/shared/contexts/chat';
import { cn } from '@/shared/lib/utils';
import { ChatModel } from '@/shared/types/chat';

export function ChatInput({
  handleSubmit,
  status,
  error,
  onInputChange,
  className,
  textareaClassName,
}: {
  handleSubmit: (
    message: PromptInputMessage,
    body: Record<string, any>
  ) => void | Promise<void>;
  status?: UseChatHelpers<UIMessage>['status'];
  error?: string | null;
  onInputChange?: (value: string) => void;
  className?: string;
  textareaClassName?: string;
}) {
  const t = useTranslations('ai.chat.generator');

  // GLM-5.3 models
  const models: ChatModel[] = [
    {
      title: 'GLM-5.3 (753B MoE)',
      name: 'z-ai/glm-5.3',
    },
    {
      title: 'GLM-5.3-Flash (320B)',
      name: 'z-ai/glm-5.3-flash',
    },
    {
      title: 'DeepSeek-V3',
      name: 'deepseek/deepseek-chat',
    },
    {
      title: 'Claude 3.7 Sonnet',
      name: 'anthropic/claude-3.7-sonnet',
    },
    {
      title: 'GPT-4o',
      name: 'openai/gpt-4o',
    },
  ];

  const [model, setModel] = useState<string>(models[0].name);
  const [input, setInput] = useState('');
  const [webSearch, setWebSearch] = useState(false);
  const [reasoning, setReasoning] = useState(false);

  // Initialize from search query if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      const m = params.get('model');
      if (q) setInput(q);
      if (m === 'glm-5.3-flash') setModel('z-ai/glm-5.3-flash');
    }
  }, []);
  const selectedModelLabel =
    models.find((item) => item.name === model)?.title ?? models[0]?.title ?? '';

  return (
    <div className="w-full">
      <PromptInput
        onSubmit={async (message) => {
          try {
            handleSubmit(message, { model, webSearch, reasoning });
            setInput('');
          } catch (err) {
            // Allow parent to control error display/state. Do not clear input.
          }
        }}
        className={cn("mt-4", className)}
        globalDrop
        multiple
      >
        {/* <PromptInputHeader>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
      </PromptInputHeader> */}
        <PromptInputBody>
          <PromptInputTextarea
            className={cn(
              "min-h-[110px] overflow-hidden p-4 text-sm sm:text-base ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed",
              textareaClassName
            )}
            placeholder={t('input_placeholder')}
            onChange={(e) => {
              const value = e.target.value;
              setInput(value);
              onInputChange?.(value);
            }}
            value={input}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {/* <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputButton
            variant={webSearch ? 'default' : 'ghost'}
            onClick={() => setWebSearch(!webSearch)}
          >
            <GlobeIcon size={16} />
            <span>Search</span>
          </PromptInputButton> */}
            <div className="flex items-center">
              <Switch
                id="prompt-reasoning-switch"
                checked={reasoning}
                onCheckedChange={setReasoning}
                // className="peer sr-only"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label
                    htmlFor="prompt-reasoning-switch"
                    className="text-muted-foreground hover:text-foreground peer-data-[state=checked]:text-primary inline-flex cursor-pointer items-center rounded-md p-2 transition-colors"
                  >
                    <BrainCircuitIcon size={16} />
                  </Label>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>Reasoning</TooltipContent>
              </Tooltip>
            </div>
            <PromptInputSelect
              onValueChange={(value) => {
                setModel(value);
              }}
              value={model}
            >
              <PromptInputSelectTrigger>
                <PromptInputSelectValue>
                  {selectedModelLabel}
                </PromptInputSelectValue>
              </PromptInputSelectTrigger>
              <PromptInputSelectContent>
                {models.map((model) => (
                  <PromptInputSelectItem key={model.name} value={model.name}>
                    {model.title}
                  </PromptInputSelectItem>
                ))}
              </PromptInputSelectContent>
            </PromptInputSelect>
          </PromptInputTools>
          <PromptInputSubmit
            disabled={!input || status === 'submitted'}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
      {error ? (
        <p className="text-destructive mt-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
