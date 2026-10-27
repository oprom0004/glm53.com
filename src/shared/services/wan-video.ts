import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, notLike, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { aiTask } from '@/config/db/schema';
import { KieWanVideoProvider } from '@/extensions/ai/kie-wan-video';
import {
  PolarisVideoError,
  PolarisVideoProvider,
} from '@/extensions/ai/polaris-video';
import {
  createAITask,
  findAITaskById,
  updateAITaskById,
  type AITask,
} from '@/shared/models/ai_task';
import { paymentTransaction } from '@/shared/models/payment-transaction';

import {
  getWanProviderId,
  WAN_PROVIDER_IDS,
  wanProviderBaseUrl,
  wanProviderCredentials,
  type WanProviderId,
} from './wan-provider-settings';
import { getWanVideoConfigs } from './wan-video-config';
import { parseWanRequest, resolveWanVideoQuote } from './wan-video-contract';
import { getWanVideoStorage, WanVideoStorage } from './wan-video-storage';

export type PublicWanTask = {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  phase:
    | 'queued'
    | 'processing'
    | 'saving'
    | 'success'
    | 'failed'
    | 'submission_unknown'
    | 'storage_pending'
    | 'query_error';
  costCredits: number;
  videoUrl?: string;
  errorCode?: string;
};

type WanLedger = {
  fingerprint: string;
  providerModel?: string;
  providerBaseUrl?: string;
  phase: PublicWanTask['phase'];
  createdAtMs: number;
  nextPollAt: number;
  leaseUntil: number;
  lease?: string;
  sourceUrl?: string;
  videoUrl?: string;
  errorCode?: string;
};

export type WanDependencies = {
  configs: Record<string, string>;
  now?: () => number;
  provider: Pick<PolarisVideoProvider, 'generate' | 'query'>;
  storage: Pick<WanVideoStorage, 'validateInputUrl' | 'saveVideo'>;
};

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const terminal = (task: AITask) =>
  task.status === 'success' || task.status === 'failed';

function ledger(task: AITask): WanLedger {
  return JSON.parse(task.taskResult || '{}');
}

function publicTask(task: AITask): PublicWanTask {
  const state = ledger(task);
  return {
    id: task.id,
    status: task.status as PublicWanTask['status'],
    phase: state.phase,
    costCredits: task.costCredits,
    ...(task.status === 'success' && state.videoUrl
      ? { videoUrl: state.videoUrl }
      : {}),
    ...(state.errorCode ? { errorCode: state.errorCode } : {}),
  };
}

async function dependencies(
  providerId: WanProviderId,
  initialConfigs?: Record<string, string>
): Promise<WanDependencies> {
  const configs = initialConfigs || (await getWanVideoConfigs());
  let provider: WanDependencies['provider'];
  try {
    const credentials = wanProviderCredentials(configs, providerId);
    provider =
      providerId === 'kie-wan'
        ? new KieWanVideoProvider(credentials)
        : new PolarisVideoProvider(credentials);
  } catch {
    throw new Error('not_configured');
  }
  return {
    configs,
    provider,
    storage: getWanVideoStorage(configs),
  };
}

function replay(task: AITask, userId: string, fingerprint: string) {
  if (
    task.userId !== userId ||
    !WAN_PROVIDER_IDS.includes(task.provider as WanProviderId) ||
    ledger(task).fingerprint !== fingerprint
  ) {
    throw new Error('idempotency_conflict');
  }
  return publicTask(task);
}

export function classifyWanRecoveryState(input: {
  hasProviderTaskId: boolean;
  phase: PublicWanTask['phase'];
  ageMs: number;
}) {
  if (!input.hasProviderTaskId) {
    return { action: 'mark_submission_unknown' as const, refund: false };
  }
  if (['saving', 'storage_pending'].includes(input.phase)) {
    return { action: 'save' as const, refund: false };
  }
  return { action: 'query' as const, refund: false };
}

export async function submitWanVideo(
  userId: string,
  value: unknown,
  injected?: WanDependencies
): Promise<PublicWanTask> {
  if (!userId) throw new Error('unauthenticated');
  const request = parseWanRequest(value);
  const id = `wan-${digest(`${userId}\0${request.requestId}`)}`;
  const fingerprint = digest(JSON.stringify(request));
  const existing = await findAITaskById(id);
  if (existing) return replay(existing, userId, fingerprint);

  const config = injected?.configs || (await getWanVideoConfigs());
  const deps =
    injected ||
    (await dependencies(getWanProviderId(config, request.version), config));
  const quote = resolveWanVideoQuote(request, deps.configs, userId);
  if (
    quote.credits !== request.expectedCredits ||
    quote.quoteVersion !== request.quoteVersion
  ) {
    throw new Error('price_changed');
  }
  if (
    request.media.some(
      (item) => !deps.storage.validateInputUrl(userId, item.url, item.type)
    )
  ) {
    throw new Error('invalid_image');
  }

  const now = deps.now || Date.now;
  const state: WanLedger = {
    fingerprint,
    providerModel: quote.providerModel,
    providerBaseUrl: wanProviderBaseUrl(deps.configs, quote.provider),
    phase: 'queued',
    createdAtMs: now(),
    nextPollAt: now() + 60_000,
    leaseUntil: 0,
  };
  let task: AITask;
  try {
    task = await createAITask({
      id,
      userId,
      mediaType: 'video',
      provider: quote.provider,
      model: quote.model,
      prompt: request.prompt,
      scene:
        request.mode === 'text'
          ? 'text-to-video'
          : request.mode === 'image'
            ? 'image-to-video'
            : 'reference-to-video',
      options: JSON.stringify(request),
      status: 'processing',
      costCredits: quote.credits,
      taskResult: JSON.stringify(state),
    });
  } catch (error) {
    const duplicate = await findAITaskById(id);
    if (duplicate) return replay(duplicate, userId, fingerprint);
    if (
      error instanceof Error &&
      /insufficient|not enough/i.test(error.message)
    ) {
      throw new Error('insufficient_credits');
    }
    throw new Error('request_failed');
  }

  let providerTaskId: string;
  try {
    ({ taskId: providerTaskId } = await deps.provider.generate({
      model: quote.model,
      providerModel: quote.providerModel,
      prompt: request.prompt,
      media: request.media,
      ...(quote.inputVideoDuration
        ? { referenceVideoDuration: quote.inputVideoDuration }
        : {}),
      duration: request.duration,
      resolution: request.resolution,
      ratio: request.ratio,
    }));
  } catch (error) {
    const rejected =
      error instanceof PolarisVideoError && error.certainty === 'rejected';
    const next: WanLedger = {
      ...state,
      phase: rejected ? 'failed' : 'submission_unknown',
      errorCode: rejected ? 'generation_rejected' : 'submission_unknown',
    };
    task = await updateAITaskById(
      id,
      {
        status: rejected ? 'failed' : 'processing',
        taskResult: JSON.stringify(next),
        taskInfo: JSON.stringify({ errorCode: next.errorCode }),
      },
      rejected
        ? { requireNoProviderTaskId: true }
        : { expectedTaskResult: task.taskResult || '' }
    );
    return publicTask(task);
  }

  try {
    task = await paymentTransaction(async (tx: any) => {
      const [current] = await tx
        .select()
        .from(aiTask)
        .where(eq(aiTask.id, id))
        .for('update');
      if (
        !current ||
        terminal(current) ||
        (current.taskId && current.taskId !== providerTaskId)
      ) {
        throw new Error('request_failed');
      }
      const next: WanLedger = {
        ...ledger(current),
        phase: 'processing',
        nextPollAt: now() + 15_000,
        leaseUntil: 0,
        lease: undefined,
        errorCode: undefined,
      };
      const [saved] = await tx
        .update(aiTask)
        .set({ taskId: providerTaskId, taskResult: JSON.stringify(next) })
        .where(eq(aiTask.id, id))
        .returning();
      return saved;
    });
  } catch {
    console.error('wan_task_persistence_required', {
      localTaskId: id,
      providerTaskId,
    });
    throw new Error('request_failed');
  }
  return publicTask(task);
}

async function acquireTask(id: string, userId: string, now: number) {
  return paymentTransaction(
    async (tx: any): Promise<{ task: AITask; claimed: boolean }> => {
      const [task] = await tx
        .select()
        .from(aiTask)
        .where(eq(aiTask.id, id))
        .for('update');
      if (
        !task ||
        task.userId !== userId ||
        !WAN_PROVIDER_IDS.includes(task.provider as WanProviderId)
      ) {
        throw new Error('task_not_found');
      }
      const state = ledger(task);
      if (
        terminal(task) ||
        state.phase === 'submission_unknown' ||
        state.nextPollAt > now ||
        state.leaseUntil > now
      ) {
        return { task, claimed: false };
      }
      const next = {
        ...state,
        lease: randomUUID(),
        leaseUntil: now + 5 * 60_000,
      };
      const [claimed] = await tx
        .update(aiTask)
        .set({ taskResult: JSON.stringify(next) })
        .where(and(eq(aiTask.id, id), eq(aiTask.taskResult, task.taskResult)))
        .returning();
      return { task: claimed || task, claimed: Boolean(claimed) };
    }
  );
}

export async function refreshWanVideo(
  userId: string,
  taskId: string,
  injected?: WanDependencies
): Promise<PublicWanTask> {
  if (!userId) throw new Error('unauthenticated');
  if (!/^wan-[a-f0-9]{64}$/.test(taskId)) throw new Error('task_not_found');
  const now = injected?.now || Date.now;
  let { task, claimed } = await acquireTask(taskId, userId, now());
  if (!claimed) return publicTask(task);

  let state = ledger(task);
  const lease = state.lease;
  const write = async (
    changes: Partial<WanLedger>,
    status = 'processing',
    extra: Partial<AITask> = {}
  ) => {
    const next = { ...state, ...changes };
    task = await updateAITaskById(
      taskId,
      { ...extra, status, taskResult: JSON.stringify(next) },
      { expectedTaskResult: task.taskResult || '' }
    );
    state = ledger(task);
    return publicTask(task);
  };

  if (!task.taskId) {
    return write({
      phase: 'submission_unknown',
      errorCode: 'submission_unknown',
      leaseUntil: 0,
    });
  }

  let deps: WanDependencies;
  try {
    deps = injected || (await dependencies(task.provider as WanProviderId));
  } catch {
    return write({
      phase: 'query_error',
      errorCode: 'not_configured',
      nextPollAt: now() + 60_000,
      leaseUntil: 0,
    });
  }

  if (!state.sourceUrl) {
    let result: Awaited<ReturnType<PolarisVideoProvider['query']>>;
    try {
      // Never send an existing task to a different vendor after settings change.
      const currentBase = wanProviderBaseUrl(
        deps.configs,
        task.provider as WanProviderId
      );
      if (
        currentBase !==
        (state.providerBaseUrl ||
          wanProviderBaseUrl({}, task.provider as WanProviderId))
      ) {
        throw new Error('provider_changed');
      }
      result = await deps.provider.query(
        task.taskId,
        task.model as any,
        state.providerModel || task.model
      );
    } catch {
      return write({
        phase: 'query_error',
        errorCode: 'request_failed',
        nextPollAt: now() + 60_000,
        leaseUntil: 0,
      });
    }
    if (result.state === 'failed') {
      return write(
        { phase: 'failed', errorCode: 'generation_failed', leaseUntil: 0 },
        'failed',
        { taskInfo: JSON.stringify({ errorCode: 'generation_failed' }) }
      );
    }
    if (result.state === 'unknown') {
      return write({
        phase:
          now() - state.createdAtMs > 24 * 60 * 60_000
            ? 'submission_unknown'
            : 'query_error',
        errorCode: 'task_unavailable',
        nextPollAt: now() + 60_000,
        leaseUntil: 0,
      });
    }
    if (result.state !== 'succeeded' || !result.videoUrl) {
      return write({
        phase: 'processing',
        errorCode: undefined,
        nextPollAt: now() + 15_000,
        leaseUntil: 0,
      });
    }
    await write({
      phase: 'saving',
      sourceUrl: result.videoUrl,
      errorCode: undefined,
    });
    if (terminal(task) || !state.sourceUrl || state.lease !== lease) {
      return publicTask(task);
    }
  }

  let videoUrl: string;
  try {
    videoUrl = await deps.storage.saveVideo(userId, taskId, state.sourceUrl!);
  } catch {
    return write({
      phase: 'storage_pending',
      errorCode: 'storage_pending',
      nextPollAt: now() + 120_000,
      leaseUntil: 0,
    });
  }
  return write(
    {
      phase: 'success',
      videoUrl,
      sourceUrl: undefined,
      errorCode: undefined,
      leaseUntil: 0,
    },
    'success',
    {
      taskInfo: JSON.stringify({ status: 'success', videos: [{ videoUrl }] }),
    }
  );
}

export async function sweepWanVideos(
  injected?: WanDependencies,
  options: { maxTasks?: number } = {}
) {
  const maxTasks = options.maxTasks ?? 10;
  if (!Number.isInteger(maxTasks) || maxTasks < 1 || maxTasks > 10)
    throw new Error('Invalid recovery batch size');
  const result = { scanned: 0, processed: 0, failed: 0 };
  let cursor: Pick<AITask, 'id' | 'updatedAt'> | undefined;
  // Keyset pagination lets due tasks behind a page of active leases/backoffs run.
  // Bound scanning independently of the number of costly video transfers.
  for (let page = 0; page < 20; page++) {
    const tasks: AITask[] = await db()
      .select()
      .from(aiTask)
      .where(
        and(
          inArray(aiTask.provider, WAN_PROVIDER_IDS),
          inArray(aiTask.status, ['pending', 'processing']),
          notLike(aiTask.taskResult, '%"phase":"submission_unknown"%'),
          cursor
            ? or(
                gt(aiTask.updatedAt, cursor.updatedAt),
                and(
                  eq(aiTask.updatedAt, cursor.updatedAt),
                  gt(aiTask.id, cursor.id)
                )
              )
            : undefined
        )
      )
      .orderBy(asc(aiTask.updatedAt), asc(aiTask.id))
      .limit(50);
    for (const task of tasks) {
      result.scanned++;
      try {
        const state = ledger(task);
        const now = injected?.now?.() ?? Date.now();
        if (
          state.phase === 'submission_unknown' ||
          state.nextPollAt > now ||
          state.leaseUntil > now
        )
          continue;
        const refreshed = await refreshWanVideo(task.userId, task.id, injected);
        result.processed++;
        if (['query_error', 'storage_pending'].includes(refreshed.phase))
          result.failed++;
      } catch {
        result.processed++;
        result.failed++;
        console.error('wan_task_recovery_failed', { taskId: task.id });
      }
      if (result.processed >= maxTasks) return result;
    }
    if (tasks.length < 50) break;
    cursor = tasks[tasks.length - 1];
  }
  return result;
}
