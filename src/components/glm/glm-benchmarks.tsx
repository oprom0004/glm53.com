'use client';

import React from 'react';
import { Award, BarChart3, CheckCircle2, ShieldCheck, Trophy, Zap } from 'lucide-react';
import { useLocale } from 'next-intl';

export function GlmBenchmarks() {
  const isZh = useLocale() === 'zh';

  const benchmarks = [
    {
      name: 'SWE-bench Verified',
      category: isZh ? '真实 GitHub 软件工程修复' : 'Real-world GitHub Bug Solving',
      glmScore: 58.4,
      claudeScore: 56.2,
      gptScore: 48.1,
      deepseekScore: 49.2,
      unit: '%',
      winner: true,
      description: isZh
        ? '从 2,294 个真实 GitHub 生产 Issue 中自动修复代码并通过全部回归单测，GLM-5.3 登顶开源榜首。'
        : 'Resolves real GitHub issues and passes full regression suites. GLM-5.3 leads all open models globally.',
    },
    {
      name: 'Terminal-Bench 3.0',
      category: isZh ? 'Linux / Docker 命令行工具链' : 'Shell & DevOps Automation',
      glmScore: 64.8,
      claudeScore: 61.2,
      gptScore: 54.0,
      deepseekScore: 55.4,
      unit: '%',
      winner: true,
      description: isZh
        ? '评估大模型在真实 Bash 终端中执行复杂运维脚本、容器调试与服务编排的成功率。'
        : 'Measures autonomous shell execution, container debugging, and cluster orchestration in headless environments.',
    },
    {
      name: 'CyberGym Security',
      category: isZh ? '漏洞挖掘与逆向安全攻防' : 'Vulnerability Analysis & Reverse Eng',
      glmScore: 78.2,
      claudeScore: 76.5,
      gptScore: 68.3,
      deepseekScore: 73.5,
      unit: '%',
      winner: true,
      description: isZh
        ? '针对缓冲区溢出、SQL 注入与跨站脚本漏洞的静态分析与 Exploit 溯源能力。'
        : 'Evaluates static binary disassembly, memory corruption analysis, and exploit patch generation.',
    },
    {
      name: 'HumanEval+ (0-Shot)',
      category: isZh ? '极客级单测覆盖与算法生成' : 'Algorithmic Edge-Case Synthesis',
      glmScore: 91.5,
      claudeScore: 92.0,
      gptScore: 88.4,
      deepseekScore: 89.2,
      unit: '%',
      winner: false,
      description: isZh
        ? '针对数百个算法难题生成代码，并通过严格的边界条件极限测试。'
        : 'Synthesizes error-free Python algorithmic solutions passing strict adversarial edge tests.',
    },
    {
      name: 'MATH-500 (Complex Proof)',
      category: isZh ? '竞赛级高等数学形式化推演' : 'Olympiad-Grade Math Proofs',
      glmScore: 92.4,
      claudeScore: 89.6,
      gptScore: 84.7,
      deepseekScore: 90.2,
      unit: '%',
      winner: true,
      description: isZh
        ? '涵盖代数、组合数学与数论，展现千亿级 MoE 专家的严密多步推导演算。'
        : 'Complex formal proofs across abstract algebra, combinatorics, and number theory.',
    },
    {
      name: '1M Needle-In-A-Haystack',
      category: isZh ? '百万字超长上下文无损召回' : '1M Long-Context Retrieval',
      glmScore: 99.8,
      claudeScore: 98.4,
      gptScore: 96.5,
      deepseekScore: 97.9,
      unit: '%',
      winner: true,
      description: isZh
        ? '在 100 万 Token 的极端文本深度下，多层级信息检索达到 99.8% 几乎零丢损。'
        : 'Multi-layer key-value retrieval across full 1,000,000 token context without mid-document degradation.',
    },
  ];

  return (
    <section id="benchmarks" className="border-t border-slate-800/80 bg-[#050811] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            <Trophy className="size-3.5 text-[#ffd166]" />
            <span>{isZh ? '权威公认跑分硬实力' : 'Benchmark Proof'}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isZh ? '硬核评测对决：数据证明开源新高度' : 'Head-to-Head Frontier Benchmarks'}
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {isZh
              ? '在权威的 SWE-bench、Terminal-Bench 与 1M 上下文长距召回测试中，GLM-5.3 展现出超越闭源模型的卓越水准。'
              : 'Directly validated against top proprietary and open models across industry-standard engineering benchmarks.'}
          </p>
        </div>

        {/* Legend */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-cyan-400" />
            <span className="text-white">GLM-5.3 (753B MoE)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-indigo-400" />
            <span className="text-slate-400">Claude 3.7 Sonnet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-amber-400" />
            <span className="text-slate-400">DeepSeek-V3</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-slate-500" />
            <span className="text-slate-400">GPT-4.5 / 4o</span>
          </div>
        </div>

        {/* Benchmark Cards Grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benchmarks.map((b) => (
            <div
              key={b.name}
              className={`flex flex-col justify-between rounded-3xl border p-6 transition-all ${
                b.winner
                  ? 'border-cyan-500/40 bg-[#081022] shadow-[0_10px_30px_rgba(77,227,255,0.06)] ring-1 ring-cyan-500/20'
                  : 'border-slate-800 bg-[#080d19]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-white">{b.name}</h3>
                    <p className="text-xs text-slate-400">{b.category}</p>
                  </div>
                  {b.winner && (
                    <span className="rounded-full bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-[#ffd166]">
                      🏆 #1
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-300">{b.description}</p>
              </div>

              {/* Progress Comparison Bars */}
              <div className="mt-6 space-y-2.5">
                {/* GLM-5.3 */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-white mb-1">
                    <span className="text-cyan-300">GLM-5.3</span>
                    <span>{b.glmScore}{b.unit}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300"
                      style={{ width: `${b.glmScore}%` }}
                    />
                  </div>
                </div>

                {/* Claude */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Claude 3.7</span>
                    <span>{b.claudeScore}{b.unit}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500/70"
                      style={{ width: `${b.claudeScore}%` }}
                    />
                  </div>
                </div>

                {/* DeepSeek */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>DeepSeek-V3</span>
                    <span>{b.deepseekScore}{b.unit}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/70"
                      style={{ width: `${b.deepseekScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
