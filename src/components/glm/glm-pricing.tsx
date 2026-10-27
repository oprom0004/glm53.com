'use client';

import React, { useState } from 'react';
import { Check, Coins, Loader2, Sparkles, Zap } from 'lucide-react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

import { useAppContext } from '@/shared/contexts/app';

export function GlmPricing() {
  const isZh = useLocale() === 'zh';
  const { user, setIsShowSignModal } = useAppContext();
  const [mode, setMode] = useState<'credits' | 'monthly' | 'annual'>('monthly');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const plans = [
    {
      id: 'starter',
      name: isZh ? 'Starter 入门包' : 'Starter Plan',
      tagline: isZh ? '适合独立开发者与个人日常调试' : 'For individual developers & engineers',
      badge: isZh ? '个人首选' : 'Individual',
      badgeColor: 'border-slate-700 bg-slate-800/60 text-slate-300',
      isFeatured: false,
      price: {
        credits: { amount: '$9.90', period: isZh ? '一次性购买 / 永久有效' : 'One-time / Never expires' },
        monthly: { amount: '$19', period: isZh ? '/ 月' : '/ month' },
        annual: { amount: '$15', period: isZh ? '/ 月 (按年结算 $180)' : '/ mo (Billed $180/yr)' },
      },
      tokens: {
        credits: isZh ? '5,000,000 Tokens (永久)' : '5,000,000 Tokens (Permanent)',
        monthly: isZh ? '15,000,000 Tokens / 月' : '15,000,000 Tokens / month',
        annual: isZh ? '20,000,000 Tokens / 月' : '20,000,000 Tokens / month',
      },
      features: isZh
        ? [
            '完整畅享 GLM-5.3 (753B) 与 Flash (320B)',
            '解锁 1,000,000 Tokens 完整上下文窗口',
            '标准排队通道，并发请求数上限 4',
            '支持单次代码仓库打包分析与 diff 导出',
          ]
        : [
            'Full access to GLM-5.3 (753B) & Flash (320B)',
            'Full 1M token context window unlocked',
            'Standard priority queue (up to 4 concurrency)',
            'Codebase packaging & unified diff export',
          ],
    },
    {
      id: 'pro',
      name: isZh ? 'Pro 开发者旗舰' : 'Pro Engineering',
      tagline: isZh ? '最受欢迎：高频代码重构与大型分析' : 'Most Popular: Intensive refactoring & projects',
      badge: isZh ? '🔥 绝大多数开发者推荐' : '🔥 Most Popular',
      badgeColor: 'border-cyan-500/40 bg-cyan-950/50 text-cyan-300',
      isFeatured: true,
      price: {
        credits: { amount: '$29.90', period: isZh ? '一次性购买 / 永久有效' : 'One-time / Never expires' },
        monthly: { amount: '$49', period: isZh ? '/ 月' : '/ month' },
        annual: { amount: '$39', period: isZh ? '/ 月 (按年结算 $468)' : '/ mo (Billed $468/yr)' },
      },
      tokens: {
        credits: isZh ? '20,000,000 Tokens (永久)' : '20,000,000 Tokens (Permanent)',
        monthly: isZh ? '50,000,000 Tokens / 月' : '50,000,000 Tokens / month',
        annual: isZh ? '60,000,000 Tokens / 月' : '60,000,000 Tokens / month',
      },
      features: isZh
        ? [
            '优先专属极速推理通道，首字响应缩减 50%',
            '不限并发数上限，满足高频 IDE 实时调用',
            '原生沙盒自主 Agent 工具执行（Bash/Docker）',
            '跨文件多文档深度比对与架构蓝图导出',
            '专属技术答疑通道与持续优先服务',
          ]
        : [
            'Dedicated high-speed priority queue (50% faster TTFT)',
            'Unlimited concurrency for continuous IDE integration',
            'Native autonomous sandbox tool execution (Bash/Docker)',
            'Cross-doc synthesis & architecture blueprint export',
            'Priority support & developer community channel',
          ],
    },
    {
      id: 'enterprise',
      name: isZh ? 'Enterprise 企业级' : 'Enterprise Scale',
      tagline: isZh ? '为企业研发团队打造的专属算力' : 'Dedicated compute for engineering orgs',
      badge: isZh ? '团队专线' : 'Dedicated SLA',
      badgeColor: 'border-amber-500/40 bg-amber-950/50 text-[#ffd166]',
      isFeatured: false,
      price: {
        credits: { amount: '$99.90', period: isZh ? '一次性购买 / 永久有效' : 'One-time / Never expires' },
        monthly: { amount: '$149', period: isZh ? '/ 月' : '/ month' },
        annual: { amount: '$119', period: isZh ? '/ 月 (按年结算 $1428)' : '/ mo (Billed $1428/yr)' },
      },
      tokens: {
        credits: isZh ? '80,000,000 Tokens (永久)' : '80,000,000 Tokens (Permanent)',
        monthly: isZh ? '200,000,000 Tokens / 月' : '200,000,000 Tokens / month',
        annual: isZh ? '250,000,000 Tokens / 月' : '250,000,000 Tokens / month',
      },
      features: isZh
        ? [
            '企业独占专用实例 (Dedicated Instance) 专线保障',
            '99.9% 高可用 SLA 承诺，故障急速响应',
            '团队多席位权限协同管理与全量调用审计日志',
            '支持私有内网 VPC 对等连接与定制微调权重',
            '企业对公银行电汇开票与专属客户经理',
          ]
        : [
            'Dedicated GPU instances with guaranteed throughput',
            '99.9% uptime SLA with 15-minute response',
            'Team RBAC seats, SSO integration & audit logs',
            'VPC peering & custom model fine-tuning support',
            'Invoicing, corporate wire transfer & dedicated TAM',
          ],
    },
  ];

  const handleCheckout = async (planId: string) => {
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    setLoadingTier(planId);
    try {
      const res = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: `${planId}-${mode}`,
          mode,
        }),
      });

      if (!res.ok) {
        throw new Error(isZh ? '结算发起失败，请稍后重试' : 'Failed to initiate checkout');
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.info(isZh ? '当前正在为您激活服务...' : 'Activating plan...');
      }
    } catch (e: any) {
      toast.error(e?.message || (isZh ? '支付请求错误' : 'Checkout error'));
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <section id="pricing" className="border-t border-slate-800/80 bg-[#050811] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            <Coins className="size-3.5 text-[#ffd166]" />
            <span>{isZh ? '透明灵活计费' : 'Flexible Pricing'}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isZh ? '选择适合您的算力方案' : 'Simple, Transparent Pricing'}
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {isZh
              ? '支持永久不失效的积分充值包，以及适合生产高频使用的月付/年付专业方案。'
              : 'Choose between permanent credit packs that never expire, or high-volume monthly plans.'}
          </p>

          {/* Billing Mode Switcher */}
          <div className="mt-8 inline-flex items-center rounded-2xl border border-slate-800 bg-[#0a0f1d] p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => setMode('monthly')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
                mode === 'monthly'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isZh ? '按月订阅' : 'Monthly'}
            </button>
            <button
              type="button"
              onClick={() => setMode('annual')}
              className={`relative rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
                mode === 'annual'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{isZh ? '按年订阅' : 'Annual'}</span>
              <span className="ml-1.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ffd166]">
                -20%
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode('credits')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
                mode === 'credits'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isZh ? '永久积分包' : 'Credit Packs'}
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-3xl border p-7 sm:p-8 transition-all ${
                plan.isFeatured
                  ? 'border-cyan-400/60 bg-[#0a1226] shadow-[0_20px_50px_rgba(77,227,255,0.12)] ring-1 ring-cyan-400/40'
                  : 'border-slate-800 bg-[#080d19]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-2xl font-black text-white">{plan.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{plan.tagline}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${plan.badgeColor}`}>
                  {plan.badge}
                </span>
              </div>

              {/* Price */}
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tight text-white">
                  {plan.price[mode].amount}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {plan.price[mode].period}
                </span>
              </div>

              {/* Token Allowance */}
              <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">
                  {isZh ? '算力额度' : 'Token Allowance'}
                </div>
                <div className="mt-0.5 text-sm font-bold text-cyan-300">
                  {plan.tokens[mode]}
                </div>
              </div>

              {/* Features List */}
              <ul className="mt-6 flex-1 space-y-2.5 text-xs sm:text-sm text-slate-300">
                {plan.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 flex-none text-cyan-400" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* Checkout Button */}
              <div className="mt-8 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={loadingTier === plan.id}
                  onClick={() => handleCheckout(plan.id)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs sm:text-sm font-bold transition disabled:opacity-50 ${
                    plan.isFeatured
                      ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(77,227,255,0.35)] hover:from-cyan-300 hover:to-cyan-400'
                      : 'border border-slate-700 bg-slate-800/60 text-white hover:bg-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  {loadingTier === plan.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <span>
                      {isZh
                        ? mode === 'credits'
                          ? '立即充值点数包'
                          : '立即开通订阅'
                        : 'Choose Plan'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
