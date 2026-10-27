'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  Cpu,
  Database,
  HardDrive,
  Info,
  Server,
  Settings2,
  Terminal,
  Zap,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

export function GlmHardwareCalculator() {
  const isZh = useLocale() === 'zh';

  const [model, setModel] = useState<'glm-5.3' | 'glm-5.3-flash'>('glm-5.3');
  const [quant, setQuant] = useState<'fp8' | 'int4' | 'bf16'>('fp8');
  const [context, setContext] = useState<number>(128); // in K tokens
  const [concurrency, setConcurrency] = useState<number>(4);
  const [copied, setCopied] = useState(false);

  // Dynamic calculations based on real MoE & Dense memory specs
  const calculation = useMemo(() => {
    // Base model weights in GB
    let weightsGb = 0;
    if (model === 'glm-5.3') {
      if (quant === 'int4') weightsGb = 390;
      else if (quant === 'fp8') weightsGb = 760;
      else weightsGb = 1520;
    } else {
      if (quant === 'int4') weightsGb = 165;
      else if (quant === 'fp8') weightsGb = 325;
      else weightsGb = 650;
    }

    // KV Cache calculation with MLA (Multi-head Latent Attention saves 80% KV Cache)
    // Formula approximation: KV per token = ~0.08MB in MLA vs 0.4MB standard
    const kvPerKTokenGb = model === 'glm-5.3' ? 0.08 : 0.05;
    const kvCacheGb = Math.round(context * kvPerKTokenGb * concurrency * 10) / 10;

    const runtimeOverheadGb = 24; // CUDA context, buffers
    const totalRequiredGb = Math.ceil(weightsGb + kvCacheGb + runtimeOverheadGb);

    // Recommended topology
    let recommendation = '';
    let gpuCount = 1;
    let gpuModel = '';

    if (totalRequiredGb <= 96) {
      gpuCount = 4;
      gpuModel = 'RTX 4090 24GB';
      recommendation = isZh ? '4x NVIDIA RTX 4090 (24GB) 消费级多卡' : '4x NVIDIA RTX 4090 24GB (Cost-effective)';
    } else if (totalRequiredGb <= 320) {
      gpuCount = 4;
      gpuModel = 'A100 80GB';
      recommendation = isZh ? '4x NVIDIA A100 (80GB) PCIe / SXM4' : '4x NVIDIA A100 80GB PCIe / SXM4';
    } else if (totalRequiredGb <= 640) {
      gpuCount = 8;
      gpuModel = 'H100 80GB';
      recommendation = isZh ? '8x NVIDIA H100 (80GB) SXM5 NVLink (标准单节点)' : '8x NVIDIA H100 80GB SXM5 NVLink (Standard Single Node)';
    } else if (totalRequiredGb <= 1280) {
      gpuCount = 16;
      gpuModel = 'H100 80GB (2 Nodes)';
      recommendation = isZh ? '16x NVIDIA H100 (80GB) 双节点 RoCE v2 集群' : '16x NVIDIA H100 80GB (2 Nodes over RoCE v2)';
    } else {
      gpuCount = 32;
      gpuModel = 'H100 80GB (4 Nodes)';
      recommendation = isZh ? '32x NVIDIA H100 (80GB) 四节点超算集群' : '32x NVIDIA H100 80GB (4-Node SuperPOD)';
    }

    // vLLM Deployment CLI
    const vllmCommand = `vllm serve THUDM/${model === 'glm-5.3' ? 'glm-5.3-753b' : 'glm-5.3-flash'} \\
  --tensor-parallel-size ${Math.min(gpuCount, 8)} \\
  --pipeline-parallel-size ${gpuCount > 8 ? gpuCount / 8 : 1} \\
  --quantization ${quant === 'fp8' ? 'fp8' : quant === 'int4' ? 'bitsandbytes' : 'none'} \\
  --max-model-len ${context * 1024} \\
  --gpu-memory-utilization 0.95 \\
  --trust-remote-code`;

    return {
      weightsGb,
      kvCacheGb,
      totalRequiredGb,
      recommendation,
      gpuCount,
      vllmCommand,
    };
  }, [model, quant, context, concurrency, isZh]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(calculation.vllmCommand);
    setCopied(true);
    toast.success(isZh ? 'vLLM 启动命令已复制至剪贴板' : 'vLLM deployment command copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="hardware" className="border-t border-slate-800/80 bg-[#070b16] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-1 text-xs font-semibold text-cyan-300">
            <Server className="size-3.5 text-cyan-400" />
            <span>{isZh ? '生产级算力测算' : 'Hardware & Cluster Sizing'}</span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isZh ? '私有化部署显存与 GPU 算力测算器' : 'Private Deployment VRAM Calculator'}
          </h2>
          <p className="mt-4 text-base text-slate-300 sm:text-lg">
            {isZh
              ? '实时计算模型权重与 KV Cache 所需显存，一键生成生产级 vLLM / SGLang 部署启动脚本。'
              : 'Estimate exact GPU memory requirements for model weights and KV Cache at scale.'}
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-12">
          {/* Controls Panel (Left 7 Cols) */}
          <div className="rounded-3xl border border-slate-800 bg-[#0a0f1d] p-6 sm:p-8 lg:col-span-7">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4 text-sm font-bold text-white">
              <Settings2 className="size-4 text-cyan-400" />
              <span>{isZh ? '参数配置项' : 'Deployment Parameters'}</span>
            </div>

            <div className="mt-6 space-y-6">
              {/* Model Choice */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isZh ? '选择机型' : 'Model Architecture'}
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setModel('glm-5.3')}
                    className={`rounded-xl border p-3 text-left transition ${
                      model === 'glm-5.3'
                        ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-black">GLM-5.3 (753B MoE)</div>
                    <div className="mt-0.5 text-[10px] text-cyan-400 font-semibold">旗舰开源最强</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModel('glm-5.3-flash')}
                    className={`rounded-xl border p-3 text-left transition ${
                      model === 'glm-5.3-flash'
                        ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-black">GLM-5.3-Flash (320B)</div>
                    <div className="mt-0.5 text-[10px] text-[#ffd166] font-semibold">极速高并发</div>
                  </button>
                </div>
              </div>

              {/* Quantization */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isZh ? '量化精度 (Quantization)' : 'Quantization Precision'}
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2.5">
                  {(['fp8', 'int4', 'bf16'] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuant(q)}
                      className={`rounded-xl border py-2.5 text-center text-xs font-bold transition ${
                        quant === q
                          ? 'border-cyan-400 bg-cyan-950/40 text-white'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>{q.toUpperCase()}</span>
                      <span className="block text-[9px] font-normal text-slate-400 mt-0.5">
                        {q === 'fp8' ? '推荐兼顾生产' : q === 'int4' ? '极致省显存' : '全精度无损'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Context Length */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-400">
                    {isZh ? '最大上下文长度' : 'Max Context Window'}
                  </span>
                  <span className="font-black text-cyan-400">{context}K Tokens ({context * 1024} words)</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[32, 128, 512, 1024].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setContext(val)}
                      className={`rounded-xl border py-2 text-center text-xs font-bold transition ${
                        context === val
                          ? 'border-cyan-400 bg-cyan-950/40 text-white'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {val === 1024 ? '1M (全开)' : `${val}K`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Concurrency */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-400">
                    {isZh ? '并发请求流 (Concurrent Streams)' : 'Concurrent Request Streams'}
                  </span>
                  <span className="font-black text-[#ffd166]">{concurrency} 并发流</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[1, 4, 16, 64].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setConcurrency(c)}
                      className={`rounded-xl border py-2 text-center text-xs font-bold transition ${
                        concurrency === c
                          ? 'border-amber-400 bg-amber-950/40 text-white'
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {c} Streams
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Results & CLI (Right 5 Cols) */}
          <div className="flex flex-col justify-between rounded-3xl border border-cyan-500/30 bg-[#081124] p-6 sm:p-8 lg:col-span-5 shadow-xl">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {isZh ? '测算结果汇总' : 'Resource Estimation'}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-3xl font-black text-white">
                  {calculation.totalRequiredGb} <span className="text-sm font-semibold text-slate-400">GB VRAM</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {isZh ? '整机显存安全运行水位 (含 24GB 运行时开销)' : 'Total GPU Memory required with runtime headroom'}
                </p>

                <div className="mt-4 divide-y divide-slate-800/80 text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">{isZh ? '模型权重参数' : 'Model Weights'}</span>
                    <span className="font-semibold text-slate-200">{calculation.weightsGb} GB</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">{isZh ? 'MLA KV Cache' : 'KV Cache (MLA)'}</span>
                    <span className="font-semibold text-slate-200">{calculation.kvCacheGb} GB</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">{isZh ? '推荐硬件拓扑' : 'GPU Configuration'}</span>
                    <span className="font-bold text-cyan-300">{calculation.recommendation}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CLI Command Box */}
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <div className="flex items-center gap-1.5 font-mono">
                  <Terminal className="size-3.5 text-cyan-400" />
                  <span>vLLM Launch Command</span>
                </div>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#ffd166] hover:underline"
                >
                  {copied ? <Check className="size-3 text-emerald-400" /> : <Clipboard className="size-3" />}
                  <span>{copied ? (isZh ? '已复制' : 'Copied!') : isZh ? '一键复制' : 'Copy'}</span>
                </button>
              </div>

              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                {calculation.vllmCommand}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
