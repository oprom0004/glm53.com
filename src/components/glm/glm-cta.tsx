'use client';

import React from 'react';
import { ArrowRight, Bot, Cpu, Terminal, Zap } from 'lucide-react';
import { useLocale } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function GlmCta() {
  const isZh = useLocale() === 'zh';

  return (
    <section className="relative overflow-hidden border-t border-slate-800/80 bg-[#050811] py-20 md:py-28">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[350px] w-[650px] rounded-full bg-[radial-gradient(circle,_rgba(77,227,255,0.08)_0%,_transparent_70%)] blur-3xl" />
      </div>

      <div className="container relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
          <Zap className="size-3.5 text-[#ffd166]" />
          <span>{isZh ? '开启生产级推理新纪元' : 'Next-Generation Engineering AI'}</span>
        </div>

        <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
          {isZh ? '准备好体验 GLM-5.3 的真实生产力了吗？' : 'Experience GLM-5.3 Production AI Today'}
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg">
          {isZh
            ? '无论是跨数十个文件的代码库重构、百万字技术白皮书深度洞察，还是自主沙盒工具闭环，GLM-5.3 皆能提供从容有力的支撑。'
            : 'Whether refactoring complex repositories, parsing 1M-token documents, or running autonomous agents, GLM-5.3 delivers unprecedented power.'}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/chat"
            className="inline-flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500 px-6 text-sm font-bold text-slate-950 shadow-[0_0_25px_rgba(77,227,255,0.35)] transition hover:from-cyan-300 hover:to-cyan-400 hover:scale-105 active:scale-95"
          >
            <span>{isZh ? '立即进入对话工作台' : 'Launch Chat Studio'}</span>
            <ArrowRight className="size-4" />
          </Link>

          <a
            href="#hardware"
            className="inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-6 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            <Cpu className="size-4 text-[#ffd166]" />
            <span>{isZh ? '私有算力测算器' : 'Hardware Sizing'}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
