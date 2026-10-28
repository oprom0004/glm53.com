'use client';

import React from 'react';
import { Bot, Github, Globe, Shield, Terminal, Twitter } from 'lucide-react';
import { useLocale } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function GlmFooter() {
  const isZh = useLocale() === 'zh';

  return (
    <footer className="border-t border-slate-800 bg-[#04060d] text-slate-400">
      <div className="container mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-5">
          {/* Brand Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
                <Bot className="size-4 font-bold" />
              </div>
              <span className="text-lg font-black text-white">GLM-5.3</span>
              <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-800/60 uppercase">
                753B MoE
              </span>
            </div>

            <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-400">
              {isZh
                ? 'GLM-5.3 拥有 753B MoE 稀疏架构与 100 万字长文本记忆，公认开源最强代码工程推理与自主 Agent 闭环能力。基于 Apache 2.0 全球商业友好协议开源。'
                : 'GLM-5.3 features 753B MoE architecture and 1,000,000 token context window, leading all open-source models in real-world SWE-bench engineering and autonomous tool execution.'}
            </p>

            <div className="mt-6 flex items-center gap-3 text-slate-400">
              <a
                href="https://github.com/THUDM"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-800 p-2 hover:border-slate-600 hover:text-white transition"
                aria-label="GitHub"
              >
                <Github className="size-4" />
              </a>
              <span className="text-[11px] font-mono text-slate-500">
                Apache 2.0 Permissive
              </span>
            </div>
          </div>

          {/* Col 1: Models */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              {isZh ? '机型与体验' : 'Models & Studio'}
            </h4>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <Link href="/chat?model=glm-5.3" className="hover:text-cyan-400 transition">
                  GLM-5.3 (753B MoE)
                </Link>
              </li>
              <li>
                <Link href="/chat?model=glm-5.3-flash" className="hover:text-cyan-400 transition">
                  GLM-5.3-Flash (320B)
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-cyan-400 transition">
                  {isZh ? '在线对话工作台' : 'Chat Workspace'}
                </Link>
              </li>
              <li>
                <a href="#models" className="hover:text-cyan-400 transition">
                  {isZh ? '双机型选型矩阵' : 'Model Comparison'}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 2: Engineering */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              {isZh ? '工程与算力' : 'Architecture'}
            </h4>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <a href="#architecture" className="hover:text-cyan-400 transition">
                  {isZh ? 'MoE 稀疏激活底座' : 'MoE Routing Engine'}
                </a>
              </li>
              <li>
                <a href="#benchmarks" className="hover:text-cyan-400 transition">
                  {isZh ? 'SWE-bench 评测跑分' : 'SWE-bench Verified'}
                </a>
              </li>
              <li>
                <a href="#hardware" className="hover:text-cyan-400 transition">
                  {isZh ? '显存与算力测算器' : 'Hardware Calculator'}
                </a>
              </li>
              <li>
                <a href="#workflows" className="hover:text-cyan-400 transition">
                  {isZh ? '生产力落地场景' : 'Workflows & Diffs'}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Commercial */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              {isZh ? '商业与支持' : 'Commercial'}
            </h4>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <a href="#pricing" className="hover:text-cyan-400 transition">
                  {isZh ? '定价方案与点数' : 'Pricing & Credits'}
                </a>
              </li>
              <li>
                <Link href="/docs" className="hover:text-cyan-400 transition">
                  {isZh ? '开发者文档' : 'Documentation'}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-cyan-400 transition">
                  {isZh ? '技术博客' : 'Engineering Blog'}
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-cyan-400 transition">
                  {isZh ? '常见问题 FAQ' : 'FAQ'}
                </a>
              </li>
              <li>
                <Link href="/terms-of-service" className="hover:text-cyan-400 transition">
                  {isZh ? '服务协议' : 'Terms of Service'}
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-cyan-400 transition">
                  {isZh ? '隐私政策' : 'Privacy Policy'}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between border-t border-slate-800/80 pt-6 text-[11px] text-slate-500 sm:flex-row">
          <p>© 2026 GLM-5.3 AI (glm53.com). All rights reserved.</p>
          <p className="mt-2 sm:mt-0 font-mono">
            Powered by Next.js 14 AI SaaS · Apache 2.0 Open Weights
          </p>
        </div>
      </div>
    </footer>
  );
}
