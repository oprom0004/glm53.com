'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Braces,
  Check,
  CheckCircle2,
  Code2,
  FileCode,
  FileSearch,
  FolderGit2,
  ListTodo,
  Play,
  Terminal,
  Workflow,
  Zap,
} from 'lucide-react';
import { useLocale } from 'next-intl';

import { Link } from '@/core/i18n/navigation';

export function GlmWorkflows() {
  const isZh = useLocale() === 'zh';
  const [activeTab, setActiveTab] = useState<'code' | 'doc' | 'agent' | 'plan'>('code');

  const tabs = [
    { id: 'code', label: isZh ? '全库代码重构与 Bug 修复' : 'Codebase Refactoring', icon: Code2 },
    { id: 'doc', label: isZh ? '百万字跨文档全景分析' : '1M Long-Doc Synthesis', icon: FileSearch },
    { id: 'agent', label: isZh ? '自主 Agent 与沙盒闭环' : 'Autonomous Tool Agent', icon: Terminal },
    { id: 'plan', label: isZh ? '复杂系统架构规划' : 'Architecture Blueprint', icon: ListTodo },
  ];

  return (
    <section id="workflows" className="border-t border-slate-800/80 bg-[#070b16] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            <Workflow className="size-3.5 text-cyan-400" />
            <span>{isZh ? '真实生产力落地场景' : 'Production Workflows'}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isZh ? '直面真实业务挑战，拒绝玩具级演示' : 'Tackle Hard Real-World Engineering'}
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {isZh
              ? 'GLM-5.3 专为开发者、架构师与技术专家打造，深入多文件工程、百万字材料与多步自主闭环。'
              : 'Engineered for developers and architects dealing with multi-file codebases and massive documentation.'}
          </p>
        </div>

        {/* Workflow Tabs */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2 border-b border-slate-800 pb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                  isActive
                    ? 'border border-cyan-500/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_15px_rgba(77,227,255,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents */}
        <div className="mt-8 rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 sm:p-10 shadow-2xl">
          {activeTab === 'code' && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-950/30 px-3 py-1 text-xs font-bold text-cyan-400">
                  {isZh ? 'SWE-bench 58.4% 顶级代码实力' : 'SWE-bench Top-Ranked Reasoning'}
                </span>
                <h3 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
                  {isZh ? '跨 50+ 源码文件，秒级排查并发死锁与内存泄露' : 'Multi-File Dependency & Race Condition Hunter'}
                </h3>
                <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                  {isZh
                    ? '不同于仅能生成单函数的轻量玩具，GLM-5.3 能一次性分析整套工程的代码依赖拓扑。理解各模块的生命周期与锁竞争逻辑，精确定位跨协程数据竞态，直接生成即插即用的 Unified Diff 补丁。'
                    : 'Unlike single-file snippets, GLM-5.3 parses entire project dependency trees. It tracks mutex contention and asynchronous leaks across dozens of files, producing clean git patches.'}
                </p>
                <ul className="mt-6 space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '自动分析 AST 语法树与符号引用，重构绝无遗漏' : 'Tracks AST symbol definitions across entire repo'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '生成标准化 git diff 格式补丁，一键合入代码库' : 'Exports industry-standard unified diff patches'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '配备配套单测用例，验证覆盖率达到 100%' : 'Generates accompanying unit regression tests'}</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    href="/chat?q=%E8%AF%B7%E5%B8%AE%E6%88%91%E6%8E%92%E6%9F%A5%E5%B9%B6%E5%8F%91%E4%BB%A3%E7%A0%81%E4%B8%AD%E7%9A%84%E5%86%85%E5%AD%98%E6%B3%84%E6%BC%8F&model=glm-5.3&mode=code"
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    <span>{isZh ? '在工作台中排查代码' : 'Launch Code Debugger'}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Code Mock Preview */}
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950 p-4 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <FileCode className="size-3.5 text-cyan-400" />
                    <span>src/engine/worker_pool.rs (git diff)</span>
                  </div>
                  <span className="text-[#ffd166]">GLM-5.3 Patch</span>
                </div>
                <div className="mt-3 space-y-1 text-slate-300 overflow-x-auto leading-relaxed">
                  <div className="text-slate-500">@@ -42,7 +42,9 @@ impl WorkerPool &#123;</div>
                  <div className="text-rose-400 bg-rose-950/30 px-1 -mx-1">-    let guard = self.mutex.lock().unwrap();</div>
                  <div className="text-emerald-400 bg-emerald-950/30 px-1 -mx-1">+    // GLM-5.3 Fix: Replaced blocking mutex with try_lock + Tokio atomic wait</div>
                  <div className="text-emerald-400 bg-emerald-950/30 px-1 -mx-1">+    let mut guard = self.channel.try_acquire_owned()?;</div>
                  <div className="text-emerald-400 bg-emerald-950/30 px-1 -mx-1">+    tokio::task::spawn(async move &#123; guard.process_queue().await &#125;);</div>
                  <div className="text-slate-400">     self.active_tasks.fetch_add(1, Ordering::SeqCst);</div>
                  <div className="text-slate-500 mt-2">// Result: 0 race conditions, zero deadlocks verified in cargo test</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'doc' && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="rounded-full border border-[#ffd166]/30 bg-amber-950/30 px-3 py-1 text-xs font-bold text-[#ffd166]">
                  {isZh ? '1,000,000 Tokens 极端长文本' : '1M Context Window'}
                </span>
                <h3 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
                  {isZh ? '吞吐 200 万字技术材料，毫秒级交叉印证' : 'Ingest Hundreds of Pages of Tech Specs & SEC Filings'}
                </h3>
                <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                  {isZh
                    ? '支持一次性丢入几十份 API 规范、法律合规文本或架构白皮书。GLM-5.3 基于 MLA 低秩注意力投影，在 1M 上下文内实现 99.8% 的极高精确召回率，精准抓出不同条文间的隐性冲突与参数不一致。'
                    : 'Feed entire legal contracts, RFC specifications, or multi-year financial statements. GLM-5.3 tracks subtle contradictions and inconsistencies across 1M tokens with near-perfect accuracy.'}
                </p>
                <ul className="mt-6 space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[#ffd166] flex-none" />
                    <span>{isZh ? '99.8% 大海捞针召回，杜绝幻觉遗漏' : '99.8% Needle-in-a-Haystack recall rate'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[#ffd166] flex-none" />
                    <span>{isZh ? '支持 Markdown、PDF、DOCX 及源文件混合批量分析' : 'Accepts multi-format doc streams simultaneously'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-[#ffd166] flex-none" />
                    <span>{isZh ? '自动生成结构化对照矩阵与风险研判建议' : 'Auto-synthesizes cross-reference comparison matrices'}</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    href="/chat?q=%E6%AF%94%E5%AF%B9%E6%9D%A1%E6%AC%BE%E5%86%B2%E7%AA%81&model=glm-5.3&mode=doc"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ffd166] px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-[#ffe29a]"
                  >
                    <span>{isZh ? '开始分析长文件' : 'Start Document Analysis'}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Doc Preview */}
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {isZh ? '跨文档一致性比对结果 (Token: 842,109)' : 'Cross-Doc Synthesis Report (Tokens: 842,109)'}
                  </span>
                  <span className="text-emerald-400 text-[10px] bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                    {isZh ? '比对完成 100%' : '100% Synced'}
                  </span>
                </div>
                <div className="mt-3 space-y-3 text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-[#0d1424] p-3">
                    <div className="text-[11px] font-bold text-cyan-400">⚠️ {isZh ? '核心参数差异检测' : 'Conflict Found'}</div>
                    <p className="mt-1 text-slate-400 text-[11px]">
                      {isZh
                        ? '《2026架构规约》第 142 页规定心跳超时为 5000ms，而《容灾演练手册》第 89 页依然采用旧版 15000ms，若按现状上线将导致节点脑裂误判。'
                        : 'Spec v2.6 defines heartbeat timeout as 5000ms, while Disaster Manual still specifies 15000ms, risking split-brain failures.'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#0d1424] p-3">
                    <div className="text-[11px] font-bold text-[#ffd166]">💡 {isZh ? '修复建议' : 'Actionable Fix'}</div>
                    <p className="mt-1 text-slate-400 text-[11px]">
                      {isZh
                        ? '统一在全局基础设施配置中心下发动态分布式租约 Lease TTL = 6000ms，并在所有微服务接入统一探测 SDK。'
                        : 'Unify lease TTL to 6000ms via distributed config management and upgrade probing SDKs.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agent' && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-950/30 px-3 py-1 text-xs font-bold text-cyan-400">
                  {isZh ? '原生自主 Agent 引擎' : 'Native Autonomous Sandbox Agent'}
                </span>
                <h3 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
                  {isZh ? '从编写代码到沙盒执行：自动闭环跑通测试' : 'Code, Execute, Intercept & Self-Heal in Sandbox'}
                </h3>
                <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                  {isZh
                    ? 'GLM-5.3 原生支持 Function Calling 与系统级 Shell/Docker 调用。模型会在隔离环境中执行脚本、解析 stderr 错误堆栈、自动调整参数并再次重试，直到测试全部通过后向您交付可靠成果。'
                    : 'GLM-5.3 issues shell commands and tests scripts in secure Docker containers natively. It analyzes stderr stack traces, updates its logic, and re-runs until all tests pass green.'}
                </p>
                <ul className="mt-6 space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '原生支持 Linux Shell、Python REPL 及 SQL 交互' : 'Native Linux CLI, Python REPL & SQL execution'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '自主拦截报错日志，无需人工干预多轮自我纠错' : 'Interprets stack traces and auto-retries fixes'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '可直接对接 GitHub CI/CD 与 Kubernetes 自动化运维' : 'Integrates directly into GitHub Actions & Kubernetes'}</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    href="/chat?q=%E6%89%A7%E8%A1%8C%E8%87%AA%E5%8A%A8%E5%8C%96%E6%B2%99%E7%9B%92%E6%B5%8B%E8%AF%95&model=glm-5.3"
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    <span>{isZh ? '启动 Agent 任务' : 'Deploy Autonomous Agent'}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Agent Terminal Preview */}
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950 p-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-cyan-400 motion-safe:animate-pulse" />
                    <span>glm-agent-sandbox: /workspace</span>
                  </div>
                  <span className="text-emerald-400">Step 3/3 SUCCESS</span>
                </div>
                <div className="mt-3 space-y-2 text-[11px] leading-relaxed">
                  <div className="text-slate-400">$ pytest tests/test_distributed_cache.py</div>
                  <div className="text-rose-400">FAILED: TimeoutError: Lock acquisition timed out at line 64</div>
                  <div className="text-cyan-400">⚡ GLM-5.3: Intercepted timeout. Patching lease expiration from 100ms -&gt; 500ms...</div>
                  <div className="text-slate-400">$ pytest tests/test_distributed_cache.py</div>
                  <div className="text-emerald-400">✓ test_distributed_cache.py: 18 passed in 1.42s (100% OK)</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plan' && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-950/30 px-3 py-1 text-xs font-bold text-cyan-400">
                  {isZh ? '企业级系统架构设计' : 'Enterprise System Blueprinting'}
                </span>
                <h3 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
                  {isZh ? '从单体到高可用微服务：端到端技术白皮书' : 'Zero-Downtime Microservice & Cloud Cutover Blueprints'}
                </h3>
                <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                  {isZh
                    ? '输入团队的现有业务体量、QPS 峰值与数据库容量，GLM-5.3 输出可执行的 6 个月技术升级实施方案，涵盖消息队列解耦、分库分表规则、灰度发布方案与应急回滚策略。'
                    : 'Provide traffic QPS peaks and database scale. GLM-5.3 synthesizes full migration roadmaps, message queue decoupling, sharding rules, and rollback playbooks.'}
                </p>
                <ul className="mt-6 space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '包含详细的架构拓扑图、Mermaid 图表与网络规划' : 'Outputs Mermaid topology charts and network plans'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '量化风险矩阵，明确每个阶段的 SLA 影响' : 'Quantified risk matrix with zero-downtime SLA'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-cyan-400 flex-none" />
                    <span>{isZh ? '一键生成技术立项报告与团队工时拆解' : 'One-click technical proposal and sprint breakdown'}</span>
                  </li>
                </ul>
                <div className="mt-8">
                  <Link
                    href="/chat?q=%E8%AF%B7%E4%B8%BA%E6%88%91%E4%BB%AC%E8%AE%BE%E8%AE%A1%E4%B8%80%E5%A5%97%E9%AB%98%E5%B9%B6%E5%8F%91%E6%9E%B6%E6%9E%84%E6%96%B9%E6%A1%88&model=glm-5.3"
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
                  >
                    <span>{isZh ? '生成系统方案' : 'Generate Architecture Plan'}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* Blueprint Preview */}
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950 p-5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-400">
                  <span className="font-semibold text-slate-200">
                    {isZh ? '架构改造计划拆解表 (Phase 1-4)' : 'Architecture Cutover Plan (Phase 1-4)'}
                  </span>
                  <span className="text-[#ffd166] text-[10px] bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                    6 Months Roadmap
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                  <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800 flex justify-between">
                    <div>
                      <span className="font-bold text-cyan-400">M1: </span>
                      <span>双写同步与 Canal CDC 增量捕获链路部署</span>
                    </div>
                    <span className="text-slate-500">0% Downtime</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800 flex justify-between">
                    <div>
                      <span className="font-bold text-cyan-400">M2-3: </span>
                      <span>只读流量切分至分库分表集群，校验一致性</span>
                    </div>
                    <span className="text-slate-500">Read-Only Cut</span>
                  </div>
                  <div className="rounded-lg bg-slate-900/60 p-2.5 border border-slate-800 flex justify-between">
                    <div>
                      <span className="font-bold text-cyan-400">M4-5: </span>
                      <span>核心写入流量灰度 10% -&gt; 50% -&gt; 100% 切换</span>
                    </div>
                    <span className="text-emerald-400">Canary Phase</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
