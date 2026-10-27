import {
  assertKieWan2Options,
  assertKieWan2Prompt,
  KIE_WAN2_MODELS,
} from '@/shared/services/kie-wan2-contract';
import {
  normalizeProviderBaseUrl,
  wanApiUrl,
} from '@/shared/services/provider-endpoint';
import { wanModelVersion, type WanModel } from '@/shared/services/wan-models';
import { KIE_WAN_MODELS } from '@/shared/services/wan-provider-settings';

import {
  isSafeHttpsUrl,
  PolarisVideoError,
  readWanProviderJson,
  validateWanVideoInput,
  type PolarisQueryResult,
  type PolarisVideoInput,
} from './polaris-video';

// Use the same rejection/unknown distinction as Polaris so the ledger never
// refunds an ambiguous submission or automatically submits it a second time.
const REJECTED = new Set([400, 401, 402, 403, 404, 405, 413, 415, 422, 429]);
const validTaskId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{1,200}$/.test(value);
const object = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export class KieWanVideoProvider {
  #apiKey: string;
  #baseUrl: string;
  #request: typeof fetch;

  constructor(
    configs: { apiKey: string; baseUrl?: string },
    request: typeof fetch = fetch
  ) {
    this.#apiKey = configs.apiKey?.trim() || '';
    if (
      !this.#apiKey ||
      !/^[\x21-\x7e]+$/.test(this.#apiKey) ||
      /^Bearer\b/i.test(this.#apiKey)
    ) {
      throw new PolarisVideoError('invalid_api_key', 'rejected');
    }
    this.#baseUrl = normalizeProviderBaseUrl(
      configs.baseUrl || 'https://api.kie.ai/api/v1'
    );
    this.#request = request;
  }

  async generate(input: PolarisVideoInput): Promise<{ taskId: string }> {
    validateWanVideoInput(input, true);
    const version = wanModelVersion(input.model);
    const image =
      input.media?.some((item) => item.type === 'first_frame') ?? false;
    const model =
      version === '3.0'
        ? this.#model(input.model)
        : KIE_WAN2_MODELS[version][image ? 'image' : 'text'];
    if (input.providerModel && input.providerModel !== model) {
      throw new PolarisVideoError('invalid_input', 'rejected');
    }
    const media = input.media || [];
    const references = media
      .filter((item) => item.type === 'reference_image')
      .map((item) => item.url);
    const first = media.find((item) => item.type === 'first_frame')?.url;
    const videos = media
      .filter((item) => item.type === 'reference_video')
      .map((item) => item.url);
    const last = media.find((item) => item.type === 'last_frame')?.url;
    if (last && !first)
      throw new PolarisVideoError('invalid_input', 'rejected');
    let payload: Record<string, unknown> = {
      prompt: input.prompt,
      duration: input.duration,
      resolution: input.resolution,
      aspect_ratio: input.ratio,
      audio: true,
      ...(first ? { first_frame_url: first } : {}),
      ...(last ? { last_frame_url: last } : {}),
      ...(references.length ? { reference_image_urls: references } : {}),
      ...(videos.length ? { reference_video_urls: videos } : {}),
    };
    if (version !== '3.0') {
      try {
        assertKieWan2Options({
          ...input,
          version,
          mode: image ? 'image' : 'text',
        });
        assertKieWan2Prompt(version, image ? 'image' : 'text', input.prompt);
      } catch {
        throw new PolarisVideoError('invalid_input', 'rejected');
      }
      payload = {
        prompt: input.prompt,
        resolution: input.resolution.toLowerCase(),
        duration: version === '2.7' ? input.duration : String(input.duration),
        nsfw_checker: true,
      };
      if (version === '2.5') {
        Object.assign(
          payload,
          first
            ? { image_url: first }
            : {
                aspect_ratio: input.ratio === 'adaptive' ? '16:9' : input.ratio,
              },
          { enable_prompt_expansion: true }
        );
      } else if (version === '2.6') {
        Object.assign(
          payload,
          { multi_shots: false },
          first ? { image_urls: [first] } : {}
        );
      } else {
        Object.assign(
          payload,
          { prompt_extend: true, watermark: false },
          first
            ? { first_frame_url: first }
            : { ratio: input.ratio === 'adaptive' ? '16:9' : input.ratio }
        );
      }
    }
    const result = await this.#requestJson('/api/v1/jobs/createTask', 'POST', {
      model,
      input: payload,
    });
    if (
      !object(result) ||
      result.code !== 200 ||
      !validTaskId(result.data?.taskId)
    ) {
      this.#responseError(result, true);
    }
    return { taskId: (result as any).data.taskId };
  }

  async query(
    taskId: string,
    model: WanModel,
    providerModel?: string
  ): Promise<PolarisQueryResult> {
    if (!validTaskId(taskId))
      throw new PolarisVideoError('invalid_task_id', 'rejected');
    const version = wanModelVersion(model);
    const expectedModel =
      version === '3.0' ? this.#model(model) : providerModel;
    if (
      version !== '3.0' &&
      (!expectedModel ||
        !Object.values(KIE_WAN2_MODELS[version]).some(
          (value) => value === expectedModel
        ))
    )
      throw new PolarisVideoError('invalid_input', 'rejected');
    if (providerModel && providerModel !== expectedModel)
      throw new PolarisVideoError('invalid_input', 'rejected');
    const result = await this.#requestJson(
      `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      'GET'
    );
    if (!object(result) || result.code !== 200)
      this.#responseError(result, false);
    const data = (result as any).data;
    if (
      !object(data) ||
      data.taskId !== taskId ||
      data.model !== expectedModel
    ) {
      return { state: 'unknown' };
    }
    if (['waiting', 'queuing', 'generating'].includes(data.state))
      return { state: 'processing' };
    if (data.state === 'fail') return { state: 'failed' };
    if (data.state === 'success') {
      try {
        const output = JSON.parse(data.resultJson);
        if (
          Array.isArray(output.resultUrls) &&
          output.resultUrls.length === 1 &&
          isSafeHttpsUrl(output.resultUrls[0])
        ) {
          return { state: 'succeeded', videoUrl: output.resultUrls[0] };
        }
      } catch {
        /* A malformed response cannot make a task terminal. */
      }
    }
    return { state: 'unknown' };
  }

  #model(model: WanModel) {
    if (model === 'wan3.0-video') return KIE_WAN_MODELS.standard;
    if (model === 'wan3.0-video-prime') return KIE_WAN_MODELS.prime;
    throw new PolarisVideoError('invalid_input', 'rejected');
  }

  #responseError(result: unknown, submitting: boolean): never {
    const rejected =
      submitting &&
      object(result) &&
      REJECTED.has(result.code) &&
      !result.data?.taskId;
    throw new PolarisVideoError(
      rejected ? 'request_rejected' : 'invalid_response',
      rejected ? 'rejected' : 'unknown'
    );
  }

  async #requestJson(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown
  ): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await this.#request(wanApiUrl(this.#baseUrl, path), {
            method,
            headers: {
              Authorization: `Bearer ${this.#apiKey}`,
              Accept: 'application/json',
              ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal,
            redirect: 'error',
            cache: 'no-store',
          });
          if (!response.ok) {
            void response.body?.cancel().catch(() => undefined);
            const rejected = method === 'POST' && REJECTED.has(response.status);
            throw new PolarisVideoError(
              rejected ? 'request_rejected' : 'unavailable',
              rejected ? 'rejected' : 'unknown'
            );
          }
          return readWanProviderJson(response, controller.signal);
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new PolarisVideoError('timeout', 'unknown'));
          }, 30_000);
        }),
      ]);
    } catch (error) {
      if (error instanceof PolarisVideoError) throw error;
      throw new PolarisVideoError('unavailable', 'unknown');
    } finally {
      clearTimeout(timer);
    }
  }
}
