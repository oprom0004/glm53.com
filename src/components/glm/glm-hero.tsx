'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Code,
  CornerDownLeft,
  FileSearch,
  FileText,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLocale } from 'next-intl';

import { useRouter } from '@/core/i18n/navigation';

export function GlmHero() {
  const router = useRouter();
  const isZh = useLocale() === 'zh';

  const [activeMode, setActiveMode] = useState<'chat' | 'doc' | 'code'>('chat');
  const [selectedModel, setSelectedModel] = useState<'glm-5.3' | 'glm-5.3-flash'>('glm-5.3');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const humanChips = [
    {
      id: 'debug',
      icon: Code,
      label: isZh ? '调试代码' : 'Debug Code',
      prompt: isZh
        ? '请帮我排查这段 Python 高并发异步代码中的内存泄漏与死锁风险，并给出符合最佳工程实践的完整修复补丁：'
        : 'Please analyze this concurrent async Python code for memory leaks and deadlocks, providing a production-ready patch:',
    },
    {
      id: 'doc',
      icon: FileSearch,
      label: isZh ? '分析长文件' : 'Analyze Long Files',
      prompt: isZh
        ? '我需要全景比对两份百万字级别的系统技术白皮书，提取出在分布式一致性协议与容灾机制上的核心差异：'
        : 'Compare two comprehensive system technical whitepapers and extract key differences in distributed consensus and disaster recovery:',
    },
    {
      id: 'reason',
      icon: Lightbulb,
      label: isZh ? '复杂问题解惑' : 'Deep Q&A',
      prompt: isZh
        ? '请从底层硬件原理到应用层框架，深入剖析 MoE (混合专家网络) 架构为何能在超大参数下保持单 Token 推理的高吞吐与低显存开销？'
        : 'Explain deeply from hardware execution to ML frameworks how MoE architecture achieves high throughput and low active VRAM for 753B parameters:',
    },
    {
      id: 'plan',
      icon: ListTodo,
      label: isZh ? '制定计划' : 'Formulate Plan',
      prompt: isZh
        ? '请为我们团队设计一套从单体旧系统平滑迁移至微服务与事件驱动架构的 6 个月落地方案，包含数据库切分与灰度回滚策略：'
        : 'Design a 6-month enterprise migration blueprint from monolith to microservices and event-driven architecture with DB zero-downtime cutover:',
    },
  ];

  const handleLaunch = (textToSubmit?: string) => {
    const text = textToSubmit !== undefined ? textToSubmit : promptText;
    const targetPrompt = text.trim() || (isZh ? '你好，GLM-5.3！请介绍你的核心优势。' : 'Hello GLM-5.3! Please introduce your core capabilities.');
    const encoded = encodeURIComponent(targetPrompt);
    router.push(`/chat?q=${encoded}&model=${selectedModel}&mode=${activeMode}`);
  };

  const handleChipClick = (chipPrompt: string) => {
    setPromptText(chipPrompt);
    handleLaunch(chipPrompt);
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32 bg-[#050811]">
      {/* Background Subtle Tech Ambient Gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[550px] w-[900px] rounded-full bg-[radial-gradient(circle,_rgba(77,227,255,0.08)_0%,_transparent_65%)] blur-3xl" />
        <div className="absolute top-60 right-[10%] h-[350px] w-[500px] rounded-full bg-[radial-gradient(circle,_rgba(255,209,102,0.05)_0%,_transparent_65%)] blur-3xl" />
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #4de3ff 1px, transparent 0)`,
            backgroundSize: '36px 36px',
          }}
        />
      </div>

      <div className="container relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Authoritative Clean Headline - STRICTLY NO CHILDISH PILL BADGES */}
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl md:text-7xl lg:leading-[1.12]">
            <span>GLM-5.3</span>
            <span className="block mt-2 text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-amber-200 sm:text-4xl md:text-5xl">
              {isZh ? '新一代开源前沿大语言模型' : 'Next-Gen Open Frontier Intelligence'}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg sm:leading-8 font-normal">
            {isZh
              ? '卓越的代码编写能力，拥有 100 万字长文本记忆，更支持全自动化运行与任务拆解。'
              : 'Unsurpassed code reasoning, 1,000,000-token context recall, and native autonomous tool calling for mission-critical engineering.'}
          </p>
        </div>

        {/* Central Action Launcher Prompt Bar (Matching User Reference) */}
        <div className="mx-auto mt-10 max-w-3xl">
          <div className="relative rounded-2xl border border-slate-700/80 bg-[#0a0f1d]/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-cyan-500/20 backdrop-blur-xl transition-all focus-within:border-cyan-400 focus-within:ring-cyan-400/40">
            {/* Top Bar inside Box: Mode Switchers & Model Dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-2 pb-2.5">
              {/* Left: Mode Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveMode('chat')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeMode === 'chat'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <MessageSquare className="size-3.5" />
                  <span>{isZh ? '对话' : 'Chat'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('doc')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeMode === 'doc'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <FileText className="size-3.5" />
                  <span>{isZh ? '分析长文件' : 'Analyze Doc'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('code')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    activeMode === 'code'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Code className="size-3.5" />
                  <span>{isZh ? '编写代码' : 'Code'}</span>
                </button>
              </div>

              {/* Right: Model Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white transition"
                >
                  <Zap className="size-3 text-[#ffd166]" />
                  <span>{selectedModel === 'glm-5.3' ? 'GLM-5.3 (753B MoE)' : 'GLM-5.3-Flash (320B)'}</span>
                  <ChevronDown className="size-3 text-slate-400" />
                </button>

                {modelDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-30 w-64 rounded-xl border border-slate-700 bg-[#0d1527] p-1.5 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel('glm-5.3');
                        setModelDropdownOpen(false);
                      }}
                      className="w-full text-left rounded-lg p-2 hover:bg-slate-800/80 transition flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span>GLM-5.3 (753B)</span>
                        <span className="text-[10px] text-cyan-400 font-normal">旗舰版 · 1M 上下文</span>
                      </div>
                      <p className="text-[11px] text-slate-400">最强复杂逻辑与全代码库重构</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModel('glm-5.3-flash');
                        setModelDropdownOpen(false);
                      }}
                      className="w-full text-left rounded-lg p-2 hover:bg-slate-800/80 transition flex flex-col gap-0.5 mt-1"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span>GLM-5.3-Flash (320B)</span>
                        <span className="text-[10px] text-[#ffd166] font-normal">极速高吞吐</span>
                      </div>
                      <p className="text-[11px] text-slate-400">3x 推理速度，超低首字延迟</p>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="relative mt-2">
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleLaunch();
                  }
                }}
                rows={3}
                placeholder={
                  isZh
                    ? '让人工智能编写代码、排查错误、分析超长文件或制定方案...'
                    : 'Ask GLM-5.3 to write code, debug errors, analyze 1M-token docs, or plan architectures...'
                }
                className="w-full resize-none bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />

              {/* Bottom Send Action */}
              <div className="flex items-center justify-between px-3 pt-1 pb-1">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>Enter</span>
                  <CornerDownLeft className="size-3 text-slate-400" />
                  <span className="hidden sm:inline">{isZh ? '直接发送' : 'to send'}</span>
                </span>

                <button
                  type="button"
                  onClick={() => handleLaunch()}
                  className="flex size-9 items-center justify-center rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(77,227,255,0.4)] transition hover:scale-105 hover:from-cyan-300 hover:to-cyan-400 active:scale-95"
                  aria-label="Send prompt"
                >
                  <ArrowRight className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* 4 Universal Human Action Chips (Below Input Box) */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {humanChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleChipClick(chip.prompt)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-cyan-400/60 hover:bg-cyan-950/30 hover:text-cyan-300 active:scale-95 shadow-sm"
                >
                  <Icon className="size-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Authoritative Metric Showcase Bar below Hero */}
        <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-slate-800/80 bg-[#080d1a]/80 p-6 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:divide-x sm:divide-slate-800 text-center">
            <div className="px-3">
              <div className="text-2xl font-black text-white sm:text-3xl">753B</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                {isZh ? 'MoE 总参数 (48B 激活)' : 'Total MoE (48B Active)'}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">千亿参数底座兼顾极速单 Token</p>
            </div>

            <div className="px-3">
              <div className="text-2xl font-black text-white sm:text-3xl">1,000,000</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#ffd166]">
                {isZh ? 'Tokens 上下文' : 'Tokens Context Window'}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">大海捞针 99.8% 无损召回率</p>
            </div>

            <div className="px-3">
              <div className="text-2xl font-black text-white sm:text-3xl">58.4%</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                {isZh ? 'SWE-bench Verified' : 'SWE-bench Verified'}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">登顶全球公认开源代码推理第一</p>
            </div>

            <div className="px-3">
              <div className="text-2xl font-black text-white sm:text-3xl">Apache 2.0</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                {isZh ? '全球商业友好开源' : 'Commercial Open Source'}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">支持全权私有化本地集群闭环部署</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
