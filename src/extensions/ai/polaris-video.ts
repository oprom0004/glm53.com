import {
  isProviderModelId,
  normalizeProviderBaseUrl,
  wanApiUrl,
} from '@/shared/services/provider-endpoint';
import {
  isValidWanDuration,
  isWan2Model,
  wanModelVersion,
  type WanModel,
} from '@/shared/services/wan-models';

export type PolarisVideoInput = {
  model: WanModel;
  providerModel?: string;
  prompt: string;
  media?: {
    type: 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video';
    url: string;
  }[];
  duration: number;
  referenceVideoDuration?: number;
  resolution: '480P' | '720P' | '1080P';
  ratio: 'adaptive' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
};

type ErrorCode =
  | 'invalid_api_key'
  | 'invalid_base_url'
  | 'invalid_input'
  | 'invalid_task_id'
  | 'request_rejected'
  | 'unavailable'
  | 'timeout'
  | 'invalid_response';

export class PolarisVideoError extends Error {
  readonly code: ErrorCode;
  readonly certainty: 'rejected' | 'unknown';

  constructor(code: ErrorCode, certainty: 'rejected' | 'unknown') {
    super(code);
    this.name = 'PolarisVideoError';
    this.code = code;
    this.certainty = certainty;
  }
}

export type PolarisQueryResult = {
  state: 'processing' | 'succeeded' | 'failed' | 'unknown';
  videoUrl?: string;
};

const ORIGIN = 'https://api.polariscore.ai';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const REJECTED_HTTP_STATUSES = new Set([
  400, 401, 403, 404, 405, 413, 415, 422,
]);
const TASK_ID = /^task_[A-Za-z0-9_-]{1,200}$/;
const VIDEO_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,200}$/;

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTaskId(value: unknown): value is string {
  return typeof value === 'string' && TASK_ID.test(value);
}

export function isSafeHttpsUrl(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    /[\u0000-\u0020\u007f\\]/.test(value) ||
    /^https:\/\/[^/?#]*@/i.test(value)
  ) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function validateWanVideoInput(
  input: PolarisVideoInput,
  allowWan2Ratio = false
) {
  if (
    !isObject(input) ||
    (input.providerModel !== undefined &&
      !isProviderModelId(input.providerModel)) ||
    (!['wan3.0-video', 'wan3.0-video-prime'].includes(input.model) &&
      !isWan2Model(input.model)) ||
    typeof input.prompt !== 'string' ||
    input.prompt.length > 20_000 ||
    !isValidWanDuration(wanModelVersion(input.model), input.duration) ||
    !['480P', '720P', '1080P'].includes(input.resolution) ||
    !['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'].includes(input.ratio) ||
    (input.media !== undefined && !Array.isArray(input.media))
  ) {
    throw new PolarisVideoError('invalid_input', 'rejected');
  }

  const media = input.media ?? [];
  if (
    isWan2Model(input.model) &&
    ((!allowWan2Ratio && input.ratio !== 'adaptive') ||
      media.length > 1 ||
      media.some((item) => !item || item.type !== 'first_frame'))
  ) {
    throw new PolarisVideoError('invalid_input', 'rejected');
  }
  if (media.length > 15 || (!input.prompt.trim() && media.length === 0)) {
    throw new PolarisVideoError('invalid_input', 'rejected');
  }

  let firstFrames = 0;
  let lastFrames = 0;
  let references = 0;
  let referenceVideos = 0;
  for (const item of media) {
    if (!isObject(item) || !isSafeHttpsUrl(item.url)) {
      throw new PolarisVideoError('invalid_input', 'rejected');
    }
    if (item.type === 'first_frame') firstFrames++;
    else if (item.type === 'last_frame') lastFrames++;
    else if (item.type === 'reference_image') references++;
    else if (item.type === 'reference_video') referenceVideos++;
    else throw new PolarisVideoError('invalid_input', 'rejected');
  }
  if (
    firstFrames > 1 ||
    lastFrames > 1 ||
    references > 10 ||
    referenceVideos > 5 ||
    ((references > 0 || referenceVideos > 0) && firstFrames + lastFrames > 0) ||
    (referenceVideos > 0 &&
      (!Number.isFinite(input.referenceVideoDuration) ||
        input.referenceVideoDuration! < referenceVideos ||
        input.referenceVideoDuration! > 15 ||
        input.duration + input.referenceVideoDuration! > 30))
  ) {
    throw new PolarisVideoError('invalid_input', 'rejected');
  }
}

function isTimeout(error: unknown) {
  return (
    error instanceof Error &&
    ['TimeoutError', 'AbortError'].includes(error.name)
  );
}

export async function readWanProviderJson(
  response: Response,
  signal: AbortSignal
) {
  const reader = response.body?.getReader();
  if (!reader) throw new PolarisVideoError('invalid_response', 'unknown');
  const cancel = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener('abort', cancel, { once: true });
  try {
    let bytes = 0;
    let text = '';
    const decoder = new TextDecoder('utf-8', { fatal: true });
    while (true) {
      if (signal.aborted) throw new PolarisVideoError('timeout', 'unknown');
      const { done, value } = await reader.read();
      if (signal.aborted) throw new PolarisVideoError('timeout', 'unknown');
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        throw new PolarisVideoError('invalid_response', 'unknown');
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof PolarisVideoError) throw error;
    throw new PolarisVideoError(
      signal.aborted || isTimeout(error) ? 'timeout' : 'invalid_response',
      'unknown'
    );
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
}

// This adapter deliberately owns no persistence, billing, retries or output
// download. Those effects are coordinated by the idempotent Wan service.
export class PolarisVideoProvider {
  #apiKey: string;
  #baseUrl: string;
  #request: typeof fetch;

  constructor(
    configs: { apiKey: string; baseUrl?: string },
    request: typeof fetch = fetch
  ) {
    const key = typeof configs.apiKey === 'string' ? configs.apiKey.trim() : '';
    if (!key || !/^[\x21-\x7e]+$/.test(key)) {
      throw new PolarisVideoError('invalid_api_key', 'rejected');
    }
    try {
      this.#baseUrl = normalizeProviderBaseUrl(configs.baseUrl ?? ORIGIN);
    } catch {
      throw new PolarisVideoError('invalid_base_url', 'rejected');
    }
    this.#apiKey = key;
    this.#request = request;
  }

  async generate(input: PolarisVideoInput): Promise<{ taskId: string }> {
    validateWanVideoInput(input);
    if (input.media?.some((item) => item.type === 'reference_video'))
      throw new PolarisVideoError('invalid_input', 'rejected');
    if (isWan2Model(input.model)) {
      const response = await this.#requestJson('/v1/videos', 'POST', {
        model: input.providerModel || input.model,
        prompt: input.prompt,
        ...(input.media?.length ? { image: input.media[0].url } : {}),
        duration: input.duration,
        metadata: { resolution: input.resolution.toLowerCase(), fps: 24, n: 1 },
      });
      if (!isObject(response)) {
        throw new PolarisVideoError('invalid_response', 'unknown');
      }
      const taskId = response.id ?? response.task_id;
      if (
        typeof taskId !== 'string' ||
        !VIDEO_ID.test(taskId) ||
        (response.id !== undefined && response.id !== taskId) ||
        (response.task_id !== undefined && response.task_id !== taskId) ||
        (response.model !== undefined &&
          response.model !== (input.providerModel || input.model))
      ) {
        throw new PolarisVideoError('invalid_response', 'unknown');
      }
      return { taskId };
    }

    const response = await this.#requestJson(
      '/api/v1/services/aigc/video-generation/video-synthesis',
      'POST',
      {
        model: input.providerModel || input.model,
        input: {
          prompt: input.prompt,
          ...(input.media ? { media: input.media } : {}),
        },
        parameters: {
          resolution: input.resolution,
          ratio: input.ratio,
          duration: input.duration,
          audio: true,
          prompt_extend: true,
          watermark: false,
        },
      }
    );
    if (!isObject(response)) {
      throw new PolarisVideoError('invalid_response', 'unknown');
    }
    const id = response.id;
    const upstreamTaskId = response.task_id;
    if (
      (id !== undefined && !isTaskId(id)) ||
      (upstreamTaskId !== undefined && !isTaskId(upstreamTaskId)) ||
      (id !== undefined &&
        upstreamTaskId !== undefined &&
        id !== upstreamTaskId)
    ) {
      throw new PolarisVideoError('invalid_response', 'unknown');
    }
    const providerTaskId = upstreamTaskId ?? id;
    if (!isTaskId(providerTaskId)) {
      throw new PolarisVideoError('invalid_response', 'unknown');
    }
    return { taskId: providerTaskId };
  }

  async query(
    taskId: string,
    model: WanModel = 'wan3.0-video',
    providerModel: string = model
  ): Promise<PolarisQueryResult> {
    const wan2 = isWan2Model(model);
    if (wan2 ? !VIDEO_ID.test(taskId) : !isTaskId(taskId)) {
      throw new PolarisVideoError('invalid_task_id', 'rejected');
    }
    const response = await this.#requestJson(
      wan2 ? `/v1/videos/${taskId}` : `/api/v1/tasks/${taskId}`,
      'GET'
    );
    // The ID prefix does not determine the response envelope. Compatible
    // gateways may return flat video objects even for IDs beginning with task_.
    if (wan2 && isObject(response) && 'id' in response) {
      if (
        !isObject(response) ||
        response.id !== taskId ||
        (response.model !== undefined && response.model !== providerModel)
      ) {
        return { state: 'unknown' };
      }
      if (['queued', 'in_progress'].includes(response.status)) {
        return { state: 'processing' };
      }
      if (response.status === 'failed') return { state: 'failed' };
      if (response.status === 'completed') {
        const videoUrl = response.video_url ?? response.url;
        if (isSafeHttpsUrl(videoUrl)) return { state: 'succeeded', videoUrl };
      }
      return { state: 'unknown' };
    }

    if (
      !isObject(response) ||
      response.code !== 'success' ||
      !isObject(response.data) ||
      response.data.task_id !== taskId
    ) {
      return { state: 'unknown' };
    }
    const data = response.data;
    const output =
      isObject(data.data) && isObject(data.data.output)
        ? data.data.output
        : undefined;
    const upstreamStatus = output?.task_status;
    if (
      data.status === 'IN_PROGRESS' &&
      [undefined, 'PENDING', 'RUNNING'].includes(upstreamStatus)
    ) {
      return { state: 'processing' };
    }
    if (
      data.status === 'FAILURE' &&
      ['FAILED', 'CANCELED'].includes(upstreamStatus)
    ) {
      return { state: 'failed' };
    }
    if (
      data.status === 'SUCCESS' &&
      [undefined, 'SUCCEEDED'].includes(upstreamStatus)
    ) {
      const videoUrl = data.result_url || output?.video_url;
      if (isSafeHttpsUrl(videoUrl)) return { state: 'succeeded', videoUrl };
    }
    return { state: 'unknown' };
  }

  async #requestJson(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown
  ): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new PolarisVideoError('timeout', 'unknown'));
      }, REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await this.#request(wanApiUrl(this.#baseUrl, path), {
            method,
            headers: {
              Authorization: `Bearer ${this.#apiKey}`,
              Accept: 'application/json',
              ...(method === 'POST'
                ? { 'Content-Type': 'application/json' }
                : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            redirect: 'error',
            cache: 'no-store',
            signal: controller.signal,
          });
          if (!response.ok) {
            void response.body?.cancel().catch(() => undefined);
            const rejected =
              method === 'POST' && REJECTED_HTTP_STATUSES.has(response.status);
            throw new PolarisVideoError(
              rejected ? 'request_rejected' : 'unavailable',
              rejected ? 'rejected' : 'unknown'
            );
          }
          return readWanProviderJson(response, controller.signal);
        })(),
        deadline,
      ]);
    } catch (error) {
      if (error instanceof PolarisVideoError) throw error;
      throw new PolarisVideoError(
        controller.signal.aborted || isTimeout(error)
          ? 'timeout'
          : 'unavailable',
        'unknown'
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
