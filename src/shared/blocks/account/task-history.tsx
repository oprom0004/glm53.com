'use client';

import { useTransition } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Copy,
  ExternalLink,
  Film,
  ImagePlus,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

import { Link, useRouter } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import type { WanTaskHistoryItem } from '@/shared/lib/task-history';

import { ResultVideo } from './result-video';

export function TaskHistory({
  tasks,
  total,
  page,
  limit,
}: {
  tasks: WanTaskHistoryItem[];
  total: number;
  page: number;
  limit: number;
}) {
  const isZh = useLocale() === 'zh';
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const pages = Math.max(1, Math.ceil(total / limit));
  const generationLabels = {
    text: isZh ? '文生视频' : 'Text to Video',
    image: isZh ? '图生视频' : 'Image to Video',
    'first-last': isZh ? '首尾帧生成' : 'First & Last Frame',
    'reference-image': isZh ? '参考图片生成' : 'Image Reference',
    'reference-video': isZh ? '参考视频生成' : 'Video Reference',
    'reference-mixed': isZh ? '图片 + 视频参考' : 'Image + Video Reference',
    reference: isZh ? '参考素材生成' : 'Reference to Video',
  };
  const status = (value: string) =>
    ({
      processing: isZh ? '生成中' : 'Generating',
      pending: isZh ? '排队中' : 'Queued',
      success: isZh ? '已完成' : 'Completed',
      failed: isZh ? '生成失败' : 'Failed',
    })[value] || value;
  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(isZh ? '提示词已复制' : 'Prompt copied');
    } catch {
      toast.error(
        isZh ? '复制失败，请重试' : 'Could not copy. Please try again.'
      );
    }
  };
  return (
    <section>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-widest text-violet-600 dark:text-violet-300">
            <Film className="size-4" />
            {isZh ? '你的创作空间' : 'YOUR CREATIVE SPACE'}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {isZh ? '我的视频' : 'My Videos'}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-lg text-sm leading-6">
            {isZh
              ? '每一个想法，都可以成为下一个作品。在这里查看、播放和管理你的创作。'
              : 'Every idea starts something. Find your creations, follow their progress, and see what comes next.'}
          </p>
        </div>
        <Button
          asChild
          className="rounded-full bg-violet-600 px-5 text-white hover:bg-violet-500"
        >
          <Link href="/wan-3">
            <Plus className="size-4" />
            {isZh ? '创建视频' : 'Create video'}
          </Link>
        </Button>
      </div>
      <div className="border-border/60 mb-5 flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold">
            {isZh ? '全部视频' : 'All videos'}
          </span>
          <span className="rounded-full bg-violet-600/10 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            {total}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={refreshing}
          onClick={() => startTransition(() => router.refresh())}
        >
          <RefreshCw
            className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`}
          />
          {isZh ? '刷新' : 'Refresh'}
        </Button>
      </div>
      {tasks.length ? (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((task) => {
            const failed = task.status === 'failed';
            const completed = task.status === 'success';
            const Icon = completed ? CheckCircle2 : failed ? XCircle : Clock3;
            return (
              <li
                key={task.id}
                className="border-border/70 bg-card overflow-hidden rounded-2xl border shadow-sm transition hover:border-violet-500/30 hover:shadow-md"
              >
                <div className="bg-muted/50 relative aspect-video overflow-hidden">
                  {task.videoUrl ? (
                    <ResultVideo src={task.videoUrl} isZh={isZh} />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-500/5 to-violet-500/10">
                      <Icon
                        className={`size-8 ${failed ? 'text-destructive' : 'text-violet-500'}`}
                      />
                      <p className="text-muted-foreground text-xs">
                        {failed
                          ? isZh
                            ? '这次未能完成生成'
                            : 'This video could not be completed'
                          : isZh
                            ? '你的画面正在成形'
                            : 'Your scene is taking shape'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${failed ? 'bg-destructive/10 text-destructive' : completed ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-violet-600/10 text-violet-700 dark:text-violet-300'}`}
                    >
                      <Icon className="size-3" />
                      {status(task.status)}
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      Wan {task.version || '—'} · {task.resolution || '—'}
                      {task.duration ? ` · ${task.duration}s` : ''}
                    </span>
                  </div>
                  {(task.generationType || task.tier) && (
                    <div className="mb-3 flex flex-wrap gap-2 text-xs">
                      {task.generationType && (
                        <span className="rounded-md bg-violet-500/10 px-2 py-1 font-medium text-violet-700 dark:text-violet-300">
                          {generationLabels[task.generationType]}
                        </span>
                      )}
                      {task.tier && (
                        <span className="bg-muted text-muted-foreground rounded-md px-2 py-1">
                          {task.tier === 'prime' ? 'Prime' : 'Standard'}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="line-clamp-3 min-h-[3.75rem] text-sm leading-5">
                    {task.prompt || (isZh ? '无提示词' : 'No prompt')}
                  </p>
                  <p className="text-muted-foreground mt-3 text-[11px]">
                    {new Date(task.createdAt).toLocaleDateString(
                      isZh ? 'zh-CN' : 'en-US',
                      {
                        timeZone: 'UTC',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }
                    )}{' '}
                    · {task.costCredits} {isZh ? '积分' : 'credits'}
                  </p>
                  {failed && (
                    <Link
                      href="/settings/credits"
                      className="mt-3 inline-block text-xs text-violet-600 hover:underline dark:text-violet-300"
                    >
                      {isZh ? '查看积分返还记录' : 'View credit return history'}
                    </Link>
                  )}
                  <div className="border-border/50 mt-4 flex flex-wrap gap-2 border-t pt-3">
                    {task.videoUrl && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="rounded-full text-xs"
                      >
                        <a
                          href={task.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-3.5" />
                          {isZh ? '打开视频' : 'Open video'}
                        </a>
                      </Button>
                    )}
                    {task.prompt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-xs"
                        onClick={() => void copyPrompt(task.prompt!)}
                      >
                        <Copy className="size-3.5" />
                        {isZh ? '复制提示词' : 'Copy prompt'}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-border/60 bg-card overflow-hidden rounded-3xl border">
          <div className="relative flex flex-col items-center overflow-hidden px-5 py-14 text-center sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-4 h-64 w-80 rounded-full bg-violet-500/10 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="relative mb-9 flex h-32 w-60 items-center justify-center"
            >
              <div className="absolute top-4 left-4 h-24 w-32 -rotate-12 rounded-2xl border border-violet-500/20 bg-violet-500/5" />
              <div className="absolute top-4 right-4 h-24 w-32 rotate-12 rounded-2xl border border-violet-500/20 bg-violet-500/5" />
              <div className="bg-card relative flex h-28 w-36 items-center justify-center rounded-2xl border border-violet-500/25 shadow-lg shadow-violet-500/10">
                <Clapperboard className="size-11 text-violet-500" />
                <Sparkles className="absolute -top-3 -right-3 size-7 text-violet-400" />
              </div>
            </div>
            <h2 className="relative text-xl font-semibold tracking-tight sm:text-2xl">
              {isZh
                ? '你的第一部作品，从这里开始'
                : 'Your first creation starts here'}
            </h2>
            <p className="text-muted-foreground relative mt-3 max-w-sm text-sm leading-6">
              {isZh
                ? '写下一个想法，或上传一张图片。生成的视频会出现在这里，随时回来继续创作。'
                : 'Start with an idea or an image. Your generated videos will live here, ready to watch and build on.'}
            </p>
            <Button
              asChild
              className="relative mt-7 rounded-full bg-violet-600 px-6 text-white shadow-md shadow-violet-500/20 hover:bg-violet-500"
            >
              <Link href="/wan-3">
                <Sparkles className="size-4" />
                {isZh ? '创作第一个视频' : 'Create your first video'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="border-border/60 bg-border/60 grid gap-px border-t sm:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: isZh ? '从文字开始' : 'Start with words',
                text: isZh
                  ? '描述你的场景、动作和风格。'
                  : 'Describe a scene, movement, and mood.',
              },
              {
                icon: ImagePlus,
                title: isZh ? '让图片动起来' : 'Bring an image to life',
                text: isZh
                  ? '上传图片，为画面赋予动态。'
                  : 'Turn a still image into motion.',
              },
              {
                icon: Layers,
                title: isZh ? '用参考素材创作' : 'Create with references',
                text: isZh
                  ? '使用参考图片或视频引导生成。'
                  : 'Guide your video with reference images or clips.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-card px-5 py-6">
                <item.icon className="mb-3 size-5 text-violet-500" />
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-muted-foreground mt-2 text-xs leading-5">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      {total > limit && (
        <nav
          aria-label={isZh ? '视频分页' : 'Video pagination'}
          className="mt-7 flex items-center justify-between"
        >
          <Button
            asChild={page > 1}
            disabled={page <= 1}
            variant="outline"
            size="sm"
            className="rounded-full"
          >
            {page > 1 ? (
              <Link href={`/my-videos?page=${page - 1}&pageSize=${limit}`}>
                {isZh ? '上一页' : 'Previous'}
              </Link>
            ) : (
              <span>{isZh ? '上一页' : 'Previous'}</span>
            )}
          </Button>
          <span className="text-muted-foreground text-xs">
            {page} / {pages}
          </span>
          <Button
            asChild={page < pages}
            disabled={page >= pages}
            variant="outline"
            size="sm"
            className="rounded-full"
          >
            {page < pages ? (
              <Link href={`/my-videos?page=${page + 1}&pageSize=${limit}`}>
                {isZh ? '下一页' : 'Next'}
              </Link>
            ) : (
              <span>{isZh ? '下一页' : 'Next'}</span>
            )}
          </Button>
        </nav>
      )}
    </section>
  );
}
