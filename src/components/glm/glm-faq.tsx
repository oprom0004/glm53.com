'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useLocale } from 'next-intl';

export function GlmFaq() {
  const isZh = useLocale() === 'zh';
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: isZh
        ? 'GLM-5.3 的 753B MoE 架构与传统 Dense 大模型有何本质区别？'
        : 'What makes the 753B MoE architecture different from traditional Dense models?',
      a: isZh
        ? 'Dense 模型在处理每个 Token 时都会激活全部千亿参数，计算开销极其庞大；而 GLM-5.3 采用 16 专家稀疏路由机制 (MoE)，每个 Token 仅动态激活最匹配的 48B 参数。这不仅保留了千亿级模型的深层知识与复杂推理上限，更将推理延迟和显存开销降低了 70% 以上，具备商业级的高吞吐。'
        : 'Dense models activate all parameters for every token, resulting in heavy computation. GLM-5.3 uses a 16-expert MoE design where only 48B active parameters are routed per token, achieving the reasoning depth of a 753B model with 70% lower inference latency and compute cost.',
    },
    {
      q: isZh
        ? '1,000,000 Tokens 的超长上下文在实际使用中会不会出现“中间迷失”？'
        : 'Does the 1,000,000 token context window suffer from "Lost-in-the-Middle"?',
      a: isZh
        ? '不会。GLM-5.3 结合了 Multi-Head Latent Attention (MLA) 与自适应 RoPE 频域外推，在业界标准的 Needle-In-A-Haystack（大海捞针）测试中，全深度召回率稳定在 99.8% 以上。无论是将 200 个源码文件整库打包，还是比对上百页技术规约，均能毫发不差地抓取任意位置的关键细节。'
        : 'No. GLM-5.3 pairs Multi-Head Latent Attention (MLA) with adaptive RoPE frequency extrapolation, achieving 99.8% recall on Needle-in-a-Haystack tests across all depth layers. It accurately extracts facts from anywhere within 1M tokens.',
    },
    {
      q: isZh
        ? 'SWE-bench Verified 达到 58.4%，对实际代码开发意味着什么？'
        : 'What does a 58.4% SWE-bench Verified score mean for daily engineering?',
      a: isZh
        ? 'SWE-bench Verified 是全球公认最严苛的真实代码评测：它直接拉取真实开源仓库（如 Django、Sympy、Scikit-learn）中真实合并过的 Issue，要求模型独立定位跨文件 Bug、编写补丁并跑通全部回归测试。58.4% 的成绩证明 GLM-5.3 已经超越了浅层语法补全，真正具备排查并发死锁、内存泄露与接口变更的生产级工程能力。'
        : 'SWE-bench Verified evaluates models on real GitHub issues across major libraries, requiring multi-file bug localization, patch generation, and regression pass. 58.4% ranks GLM-5.3 at the top of all open-source models, capable of true production troubleshooting.',
    },
    {
      q: isZh
        ? 'GLM-5.3-Flash 与 GLM-5.3 旗舰版应该如何抉择？'
        : 'How should I choose between GLM-5.3 Flagship and GLM-5.3-Flash?',
      a: isZh
        ? '如果您需要进行整套工程重构、跨数十个文件的架构规划或深度数学/算法推导，请优先选择 GLM-5.3 (753B)；若您用于日常 IDE 行内补全、实时微服务对话、高并发智能问答或消费级显卡部署，Flash (320B) 能为您提供 3 倍以上的极速吞吐与毫秒级首字延迟。'
        : 'Choose GLM-5.3 (753B) for whole-repo refactoring, 1M context document comparison, and complex algorithmic proofs. Choose Flash (320B) for real-time IDE completion, sub-180ms TTFT microservices, and cost-effective deployment.',
    },
    {
      q: isZh
        ? '开源权重支持商业化部署吗？是否需要支付授权费？'
        : 'Are model weights commercially permissive? Are there license fees?',
      a: isZh
        ? 'GLM-5.3 完全遵循 Apache 2.0 商业友好开源协议。个人、团队及企业均可免费下载官方开源权重，自由部署至私有内网或集成至商业产品中，完全闭环，无需向任何第三方上报或支付授权费用。'
        : 'GLM-5.3 is released under Apache 2.0. Individuals and enterprises can freely download weights, deploy in private VPCs, and integrate into commercial SaaS products without license fees.',
    },
    {
      q: isZh
        ? '永久积分包与月付订阅有何区别？未用完的点数会过期吗？'
        : 'What is the difference between Credit Packs and Subscriptions? Do credits expire?',
      a: isZh
        ? '永久积分包（Credit Packs）购买后点数永久有效，绝不过期，非常适合业务用量波动或间歇性项目的开发者；月付订阅则提供更充沛的每月算力额度、优先专属极速通道与无限制高并发，适合日常高频工作的工程团队。'
        : 'Permanent Credit Packs never expire—ideal for developers with fluctuating workloads. Monthly subscriptions offer larger token pools, priority routing, and unlimited concurrency for active engineering teams.',
    },
    {
      q: isZh
        ? '如何将 GLM-5.3 接入现有的 Cursor、VSCode 或 CI/CD 流水线？'
        : 'How do I connect GLM-5.3 to Cursor, VSCode, or CI/CD pipelines?',
      a: isZh
        ? 'GLM-5.3 完全兼容 OpenAI API 标准规范。您只需在 Cursor 或 VSCode Continue 插件中将 Base URL 设置为我们的平台端点，并填入您的 API Key，模型名称选择 glm-5.3 即可即刻无缝使用。'
        : 'GLM-5.3 provides 100% OpenAI-compatible endpoints. Simply configure the Base URL in Cursor, Continue, or LangChain, provide your API key, and specify model glm-5.3.',
    },
    {
      q: isZh
        ? '企业私有化部署最低需要什么规格的 GPU 算力？'
        : 'What is the minimum GPU requirement for on-premise deployment?',
      a: isZh
        ? 'GLM-5.3-Flash 在 INT4 量化下仅需 4 张 RTX 4090 (24GB) 即可平稳运行；而 GLM-5.3 旗舰版（753B MoE）在 FP8 生产精度下建议配备标准 8 卡 NVIDIA H100 80GB SXM5 单节点，或 4 卡 A100 80GB 进行 INT4 部署。您可以使用本站上方的【算力测算器】进行动态评估。'
        : 'GLM-5.3-Flash INT4 runs comfortably on 4x RTX 4090 (24GB). GLM-5.3 753B MoE FP8 is recommended for standard 8x H100 80GB SXM5 nodes. Use our interactive Hardware Calculator above for exact sizing.',
    },
  ];

  return (
    <section id="faq" className="border-t border-slate-800/80 bg-[#070b16] py-20 md:py-28">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            <HelpCircle className="size-3.5 text-cyan-400" />
            <span>{isZh ? '答疑解惑' : 'Frequently Asked Questions'}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isZh ? '常见技术与商业疑问解答' : 'Technical & Commercial FAQ'}
          </h2>
          <p className="mt-4 text-base text-slate-300">
            {isZh
              ? '深入了解 GLM-5.3 的架构设计、商用许可、API 兼容性与私有化落地。'
              : 'Everything you need to know about GLM-5.3 architecture, benchmarks, and licensing.'}
          </p>
        </div>

        <div className="mt-14 space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0f1d] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-white transition hover:text-cyan-300"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`size-4 flex-none text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-slate-800/80 px-5 pt-3 pb-5 text-xs sm:text-sm leading-relaxed text-slate-300">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
