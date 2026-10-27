import {
  getAITasks,
  getAITasksCount,
  type AITask,
} from '@/shared/models/ai_task';

export type WanTaskHistoryItem = {
  id: string;
  prompt: string | null;
  model: string;
  status: string;
  costCredits: number;
  createdAt: Date;
  version?: string;
  resolution?: string;
  duration?: number;
  videoUrl?: string;
  errorCode?: string;
  generationType?:
    | 'text'
    | 'image'
    | 'first-last'
    | 'reference-image'
    | 'reference-video'
    | 'reference-mixed'
    | 'reference';
  tier?: 'standard' | 'prime';
};

const safeErrorCodes = new Set([
  'generation_rejected',
  'generation_failed',
  'submission_unknown',
  'storage_failed',
  'query_error',
  'not_configured',
]);

function object(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : {};
  } catch {
    return {};
  }
}

function safeHttpUrl(value: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function getWanTaskHistoryItem(
  task: Pick<
    AITask,
    | 'id'
    | 'prompt'
    | 'model'
    | 'status'
    | 'costCredits'
    | 'createdAt'
    | 'options'
    | 'taskInfo'
  >
): WanTaskHistoryItem {
  const options = object(task.options);
  const info = object(task.taskInfo);
  const media = Array.isArray(options.media) ? options.media : [];
  const has = (type: string) =>
    media.some(
      (item: unknown) =>
        !!item &&
        typeof item === 'object' &&
        'type' in item &&
        item.type === type
    );
  const generationType: WanTaskHistoryItem['generationType'] =
    options.mode === 'text'
      ? 'text'
      : options.mode === 'image'
        ? has('last_frame')
          ? 'first-last'
          : 'image'
        : options.mode === 'reference'
          ? has('reference_video')
            ? has('reference_image')
              ? 'reference-mixed'
              : 'reference-video'
            : has('reference_image')
              ? 'reference-image'
              : 'reference'
          : undefined;
  const firstVideo = Array.isArray(info.videos)
    ? info.videos[0]?.videoUrl
    : info.videoUrl;
  const errorCode =
    typeof info.errorCode === 'string' && safeErrorCodes.has(info.errorCode)
      ? info.errorCode
      : undefined;
  return {
    id: task.id,
    prompt: task.prompt,
    model: task.model,
    status: task.status,
    costCredits: task.costCredits,
    createdAt: task.createdAt,
    version: typeof options.version === 'string' ? options.version : undefined,
    resolution:
      typeof options.resolution === 'string' ? options.resolution : undefined,
    duration: Number.isSafeInteger(options.duration)
      ? options.duration
      : undefined,
    videoUrl: safeHttpUrl(firstVideo),
    errorCode,
    ...(generationType ? { generationType } : {}),
    ...(['standard', 'prime'].includes(options.tier)
      ? { tier: options.tier as 'standard' | 'prime' }
      : {}),
  };
}

export function getTaskHistoryQuery(params: {
  page?: string;
  pageSize?: string;
}) {
  const positive = (
    value: string | undefined,
    fallback: number,
    max: number
  ) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0
      ? Math.min(parsed, max)
      : fallback;
  };
  return {
    page: positive(params.page, 1, 100_000),
    limit: positive(params.pageSize, 12, 50),
  };
}

type HistoryDependencies = {
  getTasks: typeof getAITasks;
  getCount: typeof getAITasksCount;
};

export async function loadWanTaskHistory(
  userId: string,
  params: { page?: string; pageSize?: string },
  dependencies: HistoryDependencies = {
    getTasks: getAITasks,
    getCount: getAITasksCount,
  }
) {
  if (!userId) throw new Error('unauthenticated');
  const { page, limit } = getTaskHistoryQuery(params);
  const [rows, total] = await Promise.all([
    dependencies.getTasks({
      userId,
      provider: ['polaris', 'kie-wan'],
      mediaType: 'video',
      page,
      limit,
    }),
    dependencies.getCount({
      userId,
      provider: ['polaris', 'kie-wan'],
      mediaType: 'video',
    }),
  ]);
  return {
    tasks: rows.map(getWanTaskHistoryItem),
    total,
    page,
    limit,
  };
}
