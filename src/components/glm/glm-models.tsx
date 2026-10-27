'use client';

import React from 'react';
import { ArrowRight, Check, Cpu, Gauge, Layers, ShieldCheck, Zap } from 'lucide-react';
import { useLocale } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function GlmModels() {
  const isZh = useLocale() === 'zh';

  const models = [
    {
      id: 'glm-5.3',
      name: 'GLM-5.3 (753B MoE)',
      tagline: isZh ? '全能开源旗舰 · 最强代码与逻辑之王' : 'Flagship MoE · Frontier Reasoning & Code',
      badge: isZh ? '旗舰主力推荐' : 'Flagship Recommended',
      badgeColor: 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300',
      isFeatured: true,
      specs: [
        { label: isZh ? '模型总参数' : 'Total Parameters', value: '753 Billion' },
        { label: isZh ? '动态激活参数' : 'Active Parameters', value: '48 Billion / Token' },
        { label: isZh ? '上下文窗口' : 'Context Window', value: '1,000,000 Tokens' },
        { label: isZh ? 'SWE-bench Verified' : 'SWE-bench Verified', value: '58.4% (开源第一)' },
        { label: isZh ? '推理速度' : 'Inference Throughput', value: '~45 tokens/s (FP8)' },
      ],
      features: isZh
        ? [
            '100 万字极长记忆，整套前后端工程源码一次性完整装载推演',
            'SWE-bench Verified 登顶全球开源第一，精准定位跨文件竞态缺陷',
            '原生原生自主沙盒环境调用：Bash、Docker、Python REPL 深度闭环',
            '完整开源权重开放，支持企业私有内网 8 卡集群与专线部署',
          ]
        : [
            '1M context window: ingest entire full-stack repositories at once',
            'Top-tier 58.4% SWE-bench Verified coding reasoning',
            'Native autonomous sandboxed tool-calling (Bash, Docker, Python)',
            'Open weights under Apache 2.0 with private on-prem deployment',
          ],
      ctaText: isZh ? '使用 GLM-5.3 对话' : 'Launch GLM-5.3',
      ctaHref: '/chat?model=glm-5.3',
    },
    {
      id: 'glm-5.3-flash',
      name: 'GLM-5.3-Flash (320B)',
      tagline: isZh ? '极速高吞吐 · 实时交互与微服务首选' : 'Ultra-Fast High Throughput · Low Latency',
      badge: isZh ? '极速生产机型' : 'High Speed',
      badgeColor: 'border-amber-500/40 bg-amber-950/40 text-[#ffd166]',
      isFeatured: false,
      specs: [
        { label: isZh ? '模型总参数' : 'Total Parameters', value: '320 Billion' },
        { label: isZh ? '动态激活参数' : 'Active Parameters', value: '32 Billion / Token' },
        { label: isZh ? '上下文窗口' : 'Context Window', value: '128,000 Tokens' },
        { label: isZh ? '首字延迟 (TTFT)' : 'Time-to-First-Token', value: '< 180ms' },
        { label: isZh ? '推理速度' : 'Inference Throughput', value: '140+ tokens/s' },
      ],
      features: isZh
        ? [
            '3 倍于旗舰模型的极速吞吐，毫秒级首字响应，打造无卡顿 IDE 补全',
            '12.8 万字标准上下文，轻松应对 100 页技术规约或实时日志流审计',
            '针对移动端与边缘企业微服务深度蒸馏，计算资源开销大幅缩减 65%',
            '消费级 4x RTX 4090 (INT4) 或 2x 80GB GPU 即可稳定跑满企业并发',
          ]
        : [
            '3x throughput with sub-180ms time-to-first-token response',
            '128K context window for real-time document search and log parsing',
            'Optimized distillation cutting deployment compute cost by 65%',
            'Runs on standard 4x RTX 4090 (INT4) or dual 80GB accelerators',
          ],
      ctaText: isZh ? '使用 Flash 极速版' : 'Launch Flash Mode',
      ctaHref: '/chat?model=glm-5.3-flash',
    },
  ];

  return (
    <section id="models" className="border-t border-slate-800/80 bg-[#070b16] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            <Cpu className="size-3.5 text-cyan-400" />
            <span>{isZh ? '双子核心架构矩阵' : 'Dual Model Matrix'}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isZh ? '按需挑选最适合您业务的 GLM-5.3 机型' : 'Choose the Perfect GLM-5.3 Model'}
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {isZh
              ? '从攻克世界级复杂代码难题的 753B 旗舰，到超低首字延迟的 Flash 极速版，全场景覆盖。'
              : 'From 753B MoE frontier reasoning to low-latency Flash deployment, built for production scale.'}
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {models.map((model) => (
            <div
              key={model.id}
              className={`flex flex-col rounded-3xl border p-7 sm:p-9 transition-all ${
                model.isFeatured
                  ? 'border-cyan-500/50 bg-[#0a1122] shadow-[0_15px_50px_rgba(77,227,255,0.1)] ring-1 ring-cyan-500/30'
                  : 'border-slate-800 bg-[#080d19] shadow-sm hover:border-slate-700'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white sm:text-3xl">{model.name}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-300">{model.tagline}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${model.badgeColor}`}>
                  {model.badge}
                </span>
              </div>

              {/* Specs Table */}
              <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
                <div className="divide-y divide-slate-800/60 text-xs">
                  {model.specs.map((spec) => (
                    <div key={spec.label} className="flex items-center justify-between py-2">
                      <span className="text-slate-400">{spec.label}</span>
                      <span className="font-semibold text-slate-100">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Checklist */}
              <div className="mt-6 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isZh ? '核心能力亮点' : 'Key Capabilities'}
                </h4>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-300">
                  {model.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 flex-none text-cyan-400" />
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <div className="mt-8 pt-4 border-t border-slate-800/80">
                <Link
                  href={model.ctaHref}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
                    model.isFeatured
                      ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(77,227,255,0.35)] hover:from-cyan-300 hover:to-cyan-400'
                      : 'border border-slate-700 bg-slate-800/60 text-white hover:bg-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <span>{model.ctaText}</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
