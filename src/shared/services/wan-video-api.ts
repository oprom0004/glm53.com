import { getUserInfo } from '@/shared/models/user';

import type { WanVersion } from './wan-models';
import { getWanProviderId } from './wan-provider-settings';
import {
  refreshWanVideo,
  submitWanVideo,
  type PublicWanTask,
} from './wan-video';
import { getWanVideoConfigs } from './wan-video-config';
import { quoteWanVideo, wanCapabilities } from './wan-video-contract';
import { getWanVideoStorage } from './wan-video-storage';

type WanApiAction =
  | 'capabilities'
  | 'quote'
  | 'upload'
  | 'upload-video'
  | 'generate'
  | 'query';
type WanApiDependencies = {
  getUser: () => Promise<{ id: string } | null | undefined>;
  getConfigs: typeof getWanVideoConfigs;
  upload?: (userId: string, file: File) => Promise<{ url: string }>;
  uploadVideo?: (
    userId: string,
    file: File
  ) => Promise<{ url: string; token: string; durationMs: number }>;
  submit?: (userId: string, value: unknown) => Promise<PublicWanTask>;
  refresh?: (userId: string, taskId: string) => Promise<PublicWanTask>;
};

const STATUS: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_params: 400,
  unsupported_model: 400,
  not_configured: 503,
  pricing_not_configured: 503,
  storage_not_configured: 503,
  insufficient_credits: 402,
  price_changed: 409,
  idempotency_conflict: 409,
  task_not_found: 404,
  upload_failed: 502,
  invalid_image: 400,
  invalid_reference_video: 400,
  reference_video_duration: 400,
  request_failed: 500,
};
const privateHeaders = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
};

export async function readWanBody(
  request: Request,
  maxBytes: number,
  timeoutMs = 20_000
) {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    throw new Error('invalid_params');
  }
  if (!request.body) throw new Error('invalid_params');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) throw new Error('invalid_params');
          chunks.push(value);
        }
        return Buffer.concat(chunks);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('invalid_params')),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
  }
}

async function readJsonBody(request: Request) {
  try {
    return JSON.parse(
      new TextDecoder().decode(await readWanBody(request, 128 * 1024))
    );
  } catch {
    throw new Error('invalid_params');
  }
}

export async function handleWanApi(
  action: WanApiAction,
  request: Request,
  deps: WanApiDependencies = {
    getUser: getUserInfo,
    getConfigs: getWanVideoConfigs,
  }
) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      throw new Error('forbidden');
    }
    if (action === 'capabilities') {
      const params = new URL(request.url).searchParams;
      const version = params.get('version') || '3.0';
      const mode = params.get('mode') || 'text';
      if (
        !['2.5', '2.6', '2.7', '3.0'].includes(version) ||
        !['text', 'image', 'reference'].includes(mode)
      ) {
        throw new Error('invalid_params');
      }
      return Response.json(
        {
          code: 0,
          data: wanCapabilities(
            await deps.getConfigs(),
            version as WanVersion,
            mode as 'text' | 'image' | 'reference'
          ),
        },
        { headers: privateHeaders }
      );
    }

    const user = await deps.getUser();
    if (!user) throw new Error('unauthenticated');

    let data:
      | PublicWanTask
      | { url: string }
      | ReturnType<typeof quoteWanVideo>;
    if (action === 'upload' || action === 'upload-video') {
      const video = action === 'upload-video';
      const invalidUpload = video ? 'invalid_reference_video' : 'invalid_image';
      const type = request.headers.get('content-type') || '';
      if (!type.startsWith('multipart/form-data;')) {
        throw new Error(invalidUpload);
      }
      let form: FormData;
      try {
        const body = await readWanBody(
          request,
          (video ? 101 : 11) * 1024 * 1024,
          video ? 120_000 : 20_000
        );
        form = await new Response(body, {
          headers: { 'Content-Type': type },
        }).formData();
      } catch {
        throw new Error(invalidUpload);
      }
      const entries = [...form.entries()];
      if (
        entries.length !== 1 ||
        entries[0][0] !== 'file' ||
        typeof entries[0][1] === 'string'
      ) {
        throw new Error(invalidUpload);
      }
      if (video) {
        const configs = await deps.getConfigs();
        if (getWanProviderId(configs, '3.0') !== 'kie-wan')
          throw new Error('unsupported_model');
        const uploaded = deps.uploadVideo
          ? await deps.uploadVideo(user.id, entries[0][1])
          : await getWanVideoStorage(configs).uploadReferenceVideo(
              user.id,
              entries[0][1]
            );
        return Response.json(
          { code: 0, data: uploaded },
          { headers: privateHeaders }
        );
      }
      data = deps.upload
        ? await deps.upload(user.id, entries[0][1])
        : await getWanVideoStorage(await deps.getConfigs()).uploadImage(
            user.id,
            entries[0][1]
          );
      return Response.json({ code: 0, data }, { headers: privateHeaders });
    }

    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      throw new Error('invalid_params');
    }
    const body = await readJsonBody(request);
    if (action === 'quote') {
      data = quoteWanVideo(body, await deps.getConfigs(), user.id);
    } else if (action === 'generate') {
      data = await (deps.submit || submitWanVideo)(user.id, body);
    } else {
      if (
        !body ||
        typeof body !== 'object' ||
        !('taskId' in body) ||
        typeof body.taskId !== 'string' ||
        Object.keys(body).length !== 1
      ) {
        throw new Error('invalid_params');
      }
      data = await (deps.refresh || refreshWanVideo)(user.id, body.taskId);
    }
    return Response.json({ code: 0, data }, { headers: privateHeaders });
  } catch (error) {
    const candidate = error instanceof Error ? error.message : '';
    const normalized =
      candidate === 'storage_pending' ? 'upload_failed' : candidate;
    const code = Object.hasOwn(STATUS, normalized)
      ? normalized
      : 'request_failed';
    return Response.json(
      { code: -1, message: code },
      { status: STATUS[code], headers: privateHeaders }
    );
  }
}
