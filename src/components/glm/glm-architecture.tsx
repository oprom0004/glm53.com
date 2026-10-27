'use client';

import React from 'react';
import { Box, Braces, Cpu, Database, Eye, GitBranch, Layers, ShieldCheck, Terminal, Workflow } from 'lucide-react';
import { useLocale } from 'next-intl';

export function GlmArchitecture() {
  const isZh = useLocale() === 'zh';

  const pillars = [
    {
      icon: Cpu,
      title: isZh ? '753B MoE 稀疏动态路由' : '753B Sparse MoE Architecture',
      subtitle: isZh ? '16 专家动态路由 · 48B 极速激活' : '16 routed experts · 48B active per token',
      description: isZh
        ? '每个输入 Token 仅触发最擅长该知识域的 Top-2 专家网络，在保持 753B 千亿级世界知识深度的同时，单 Token 计算开销与延迟锐降 70%，兼具超强泛化与极速吞吐。'
        : 'Routes each token dynamically to Top-2 specialized experts, maintaining 753B parameter world knowledge while slashing computation overhead and latency by 70%.',
      highlight: isZh ? '单 Token 仅激活 48B 参数' : 'Only 48B active per token',
    },
    {
      icon: Database,
      title: isZh ? '1M 上下文与 MLA 显存压缩' : '1M Context & MLA KV Compression',
      subtitle: isZh ? '低秩隐空间投影 · KV 显存立省 82%' : 'Low-rank latent projection · 82% KV Cache saving',
      description: isZh
        ? '独创 Multi-Head Latent Attention (MLA) 与自适应 RoPE 频域外推，实现 1,000,000 Tokens（约 200 万字）超长文本的精准检索。大海捞针测试达成 99.8% 召回率，彻底告别长文档中间信息丢失。'
        : 'Combines Multi-Head Latent Attention (MLA) with adaptive RoPE extrapolation. Ingests 1M tokens with 99.8% Needle-in-a-Haystack recall, eradicating lost-in-the-middle degradation.',
      highlight: isZh ? '99.8% 大海捞针全域召回率' : '99.8% Needle-in-Haystack Recall',
    },
    {
      icon: Terminal,
      title: isZh ? '原生自主沙盒工具闭环' : 'Native Tool-Calling & Sandbox Execution',
      subtitle: isZh ? '内置状态推演 · 自动排查纠错' : 'Direct Bash, Docker & API self-healing loop',
      description: isZh
        ? '无需笨重的第三方 Agent 胶水层，GLM-5.3 原生具备多轮命令行执行、Docker 沙盒操作、测试用例捕获与错误日志自我纠正机制，实现从“提出方案”到“跑通测试”的完整自主生产力。'
        : 'Executes Bash commands, Docker containers, and REST APIs natively without glue code, inspecting error traces and auto-refining patches until test suites pass green.',
      highlight: isZh ? '原生自愈闭环 Agent 引擎' : 'Self-healing Autonomous Loop',
    },
    {
      icon: Braces,
      title: isZh ? 'AST 语法树感知与代码拓扑' : 'AST-Aware Full-Repo Graph Reasoning',
      subtitle: isZh ? '全工程符号级追踪 · 杜绝盲目修改' : 'Symbol-level cross-file dependency graph',
      description: isZh
        ? '将整个工程的代码抽象语法树 (AST) 与依赖关系图谱注入推理注意力层，理解跨模块接口契约、类型推演与继承关系。重构多文件时绝不破坏全局引用，输出生产级无缝补丁。'
        : 'Embeds codebase ASTs and dependency graphs directly into reasoning attention, tracking type inference, imports, and interface contracts across hundreds of files without regression.',
      highlight: isZh ? '跨文件拓扑无缝重构' : 'Zero-Regression Codebase Refactoring',
    },
  ];

  return (
    <section id="architecture" className="border-t border-slate-800/80 bg-[#050811] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            <Layers className="size-3.5 text-cyan-400" />
            <span>{isZh ? '底层工程创新' : 'Architectural Deep Dive'}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isZh ? '不妥协的工程底座：为何 GLM-5.3 如此强悍' : 'Built for True Production Scale'}
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {isZh
              ? '从 MoE 动态稀疏路由到 1M 极长上下文 MLA 显存压缩，每一行架构设计皆为高可靠生产落地打造。'
              : 'Every architectural breakthrough is purpose-built to solve real-world memory bottlenecks and complex logic.'}
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:gap-8">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-3xl border border-slate-800/80 bg-[#080d1a] p-7 sm:p-8 transition-all hover:border-cyan-500/40 hover:bg-[#0a1122] hover:shadow-[0_10px_35px_rgba(77,227,255,0.06)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 transition-colors group-hover:bg-cyan-500 group-hover:text-slate-950">
                    <Icon className="size-6" />
                  </div>
                  <span className="rounded-full border border-amber-500/30 bg-amber-950/30 px-3 py-1 text-[11px] font-bold text-[#ffd166]">
                    {item.highlight}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-white sm:text-2xl">{item.title}</h3>
                <p className="mt-1 text-xs font-semibold text-cyan-400/90">{item.subtitle}</p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
