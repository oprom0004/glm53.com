'use client';

import { useEffect, useState } from 'react';
import { UIMessage, UseChatHelpers } from '@ai-sdk/react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useRouter } from '@/core/i18n/navigation';
import { LocaleSelector } from '@/shared/blocks/common';
import { PromptInputMessage } from '@/shared/components/ai-elements/prompt-input';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';
import { useAppContext } from '@/shared/contexts/app';
import { useChatContext } from '@/shared/contexts/chat';

import { ChatInput } from './input';

export function ChatGenerator() {
  const router = useRouter();
  const locale = useLocale();

  const t = useTranslations('ai.chat.generator');

  const { user, setIsShowSignModal } = useAppContext();
  const { chats, setChats, setChat } = useChatContext();

  const [status, setStatus] = useState<UseChatHelpers<UIMessage>['status']>();
  const [error, setError] = useState<string | null>(null);

  const fetchNewChat = async (
    msg: PromptInputMessage,
    body: Record<string, any>
  ) => {
    setStatus('submitted');
    setError(null);

    try {
      const resp: Response = await fetch('/api/chat/new', {
        method: 'POST',
        body: JSON.stringify({ message: msg, body: body }),
      });
      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }
      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message);
      }

      const { id } = data;
      if (!id) {
        throw new Error('failed to create chat');
      }

      setChats([data, ...chats]);

      const path = `/chat/${id}`;
      router.push(path, {
        locale,
      });
      // setStatus(undefined);
      // setError(null);
    } catch (e: any) {
      const message =
        e instanceof Error ? e.message : 'request failed, please try again';
      setStatus('error');
      setError(message);
      toast.error(message);
      throw e instanceof Error ? e : new Error(message);
    }
  };

  const handleSubmit = async (
    message: PromptInputMessage,
    body: Record<string, any>
  ) => {
    // check user sign
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    // check user input
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }

    if (!body.model) {
      toast.error('please select a model');
      return;
    }

    await fetchNewChat(message, body);
  };

  useEffect(() => {
    setChat(null);
  }, []);

  const isZh = locale === 'zh';
  const suggestionChips = [
    {
      label: isZh ? '调试代码' : 'Debug Code',
      prompt: isZh
        ? '请帮我排查这段 Python 高并发异步代码中的死锁与内存泄漏风险，并给出最佳实践修复补丁：'
        : 'Analyze this concurrent async Python code for deadlocks and memory leaks, providing a production patch:',
    },
    {
      label: isZh ? '分析长文件' : 'Analyze Doc',
      prompt: isZh
        ? '我需要全景比对两份分布式系统白皮书，提取出共识机制与容灾设计的核心异同：'
        : 'Extract core consensus and disaster-recovery architectural differences between two whitepapers:',
    },
    {
      label: isZh ? '剖析 MoE 原理' : 'MoE Architecture',
      prompt: isZh
        ? '请从硬件与计算图层面剖析 MoE (混合专家网络) 为何能在 753B 参数下保持高吞吐推理？'
        : 'Explain how MoE achieves high throughput with low active VRAM on a 753B parameter model:',
    },
    {
      label: isZh ? '制定架构方案' : 'Formulate Plan',
      prompt: isZh
        ? '请为团队设计从单体平滑迁移至微服务与事件驱动架构的 6 个月落地方案，包含分库切分策略：'
        : 'Design an enterprise 6-month migration plan from monolith to event-driven microservices:',
    },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="bg-background sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-3">
        <SidebarTrigger className="size-7" />
        <div className="flex-1"></div>
        <LocaleSelector />
      </header>
      <div className="mx-auto -mt-12 flex h-screen w-full flex-1 flex-col items-center justify-center px-4 pb-6 md:max-w-3xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {t('subtitle')}
          </p>
        </div>
        <ChatInput
          error={error}
          handleSubmit={handleSubmit}
          textareaClassName="min-h-[115px]"
          onInputChange={() => {
            if (status === 'error') {
              setStatus(undefined);
            }
            if (error) {
              setError(null);
            }
          }}
          status={status}
        />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() =>
                handleSubmit(
                  { text: chip.prompt },
                  { model: 'z-ai/glm-5.3', reasoning: true }
                )
              }
              className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-slate-200"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
