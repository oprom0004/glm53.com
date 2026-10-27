import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

import type { StorageProvider } from '@/extensions/storage';

import { normalizeOutputHosts } from './provider-endpoint';
import { getStorageServiceWithConfigs } from './storage';
import {
  inspectReferenceVideo,
  REFERENCE_VIDEO_MAX_BYTES,
  signReferenceVideo,
} from './wan-reference-video';

const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 128 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const IMAGE_FILENAME = new RegExp(`^${UUID}\\.(jpg|png|webp)$`);
const TASK_ID = new RegExp(`^(?:${UUID}|(?:wan-)?[0-9a-f]{16,128})$`, 'i');
const OUTPUT_HOST = /^[a-z0-9-]+\.oss-[a-z0-9-]+\.aliyuncs\.com$/;
const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'iso7',
  'iso8',
  'iso9',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'M4VH',
  'M4VP',
  'MSNV',
  'dash',
]);

function userNamespace(userId: string) {
  if (!userId) throw new Error('invalid_user');
  return createHash('sha256').update(userId).digest('hex');
}

function secureUrl(value: string) {
  if (!value || /[\\\s\x00-\x1f\x7f]/.test(value)) {
    throw new Error('invalid_url');
  }
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    value.includes('#')
  ) {
    throw new Error('invalid_url');
  }
  return url;
}

function imageExtension(body: Buffer, mime: string) {
  if (
    mime === 'image/jpeg' &&
    body.length >= 3 &&
    body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
  ) {
    return 'jpg';
  }
  if (
    mime === 'image/png' &&
    body.length >= 8 &&
    body.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  ) {
    return 'png';
  }
  if (
    mime === 'image/webp' &&
    body.length >= 16 &&
    body.toString('latin1', 0, 4) === 'RIFF' &&
    body.toString('latin1', 8, 12) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(body.toString('latin1', 12, 16))
  ) {
    return 'webp';
  }
  throw new Error('invalid_image');
}

function isMp4(body: Buffer) {
  if (body.length < 16 || body.toString('latin1', 4, 8) !== 'ftyp') {
    return false;
  }
  const size = body.readUInt32BE(0);
  if (size < 16 || size > body.length || size % 4 !== 0) return false;
  if (MP4_BRANDS.has(body.toString('latin1', 8, 12))) return true;
  for (let offset = 16; offset < size; offset += 4) {
    if (MP4_BRANDS.has(body.toString('latin1', offset, offset + 4))) {
      return true;
    }
  }
  return false;
}

async function readVideo(response: Response) {
  if (!response.body) throw new Error('invalid_video');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > VIDEO_LIMIT) throw new Error('video_too_large');
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const body = Buffer.concat(chunks, size);
  if (!isMp4(body)) throw new Error('invalid_video');
  return body;
}

export class WanVideoStorage {
  constructor(
    private readonly provider: StorageProvider,
    private readonly request: typeof fetch = fetch,
    private readonly outputHosts: string[] = []
  ) {
    if (!provider.getPublicUrl) throw new Error('storage_not_configured');
  }

  private publicUrl(key: string) {
    const result = this.provider.getPublicUrl!({ key });
    const url = secureUrl(result);
    if (
      result.includes('?') ||
      result.includes('%') ||
      url.href !== result ||
      !url.pathname.endsWith(`/${key}`)
    ) {
      throw new Error('invalid_public_url');
    }
    return result;
  }

  validateInputUrl(userId: string, value: string, type?: string): boolean {
    try {
      const url = secureUrl(value);
      if (value.includes('?') || value.includes('%') || url.href !== value) {
        return false;
      }
      const filename = url.pathname.split('/').at(-1) || '';
      if (
        !(type === 'reference_video'
          ? new RegExp(`^${UUID}\\.(mp4|mov)$`).test(filename)
          : IMAGE_FILENAME.test(filename))
      )
        return false;
      const key = `wan-inputs/${userNamespace(userId)}/${filename}`;
      return value === this.publicUrl(key);
    } catch {
      return false;
    }
  }

  async uploadReferenceVideo(userId: string, file: File) {
    if (
      !userId ||
      !file ||
      file.size <= 0 ||
      file.size > REFERENCE_VIDEO_MAX_BYTES ||
      !/\.(mp4|mov)$/i.test(file.name) ||
      ![
        'video/mp4',
        'video/quicktime',
        'application/octet-stream',
        '',
      ].includes(file.type)
    )
      throw new Error('invalid_reference_video');
    const body = Buffer.from(await file.arrayBuffer());
    if (body.length !== file.size) throw new Error('invalid_reference_video');
    const metadata = inspectReferenceVideo(body);
    const extension = file.name.toLowerCase().endsWith('.mov') ? 'mov' : 'mp4';
    const key = `wan-inputs/${userNamespace(userId)}/${randomUUID()}.${extension}`;
    const url = this.publicUrl(key);
    const token = signReferenceVideo(userId, url, metadata.durationMs);
    try {
      const result = await this.provider.uploadFile({
        key,
        body,
        contentType: extension === 'mov' ? 'video/quicktime' : 'video/mp4',
        disposition: 'inline',
      });
      if (!result?.success || result.url !== url) throw new Error();
    } catch {
      throw new Error('upload_failed');
    }
    return { url, token, ...metadata };
  }

  async uploadImage(userId: string, file: File): Promise<{ url: string }> {
    let body: Buffer;
    let extension: string;
    try {
      if (!userId || !file || file.size <= 0 || file.size > IMAGE_LIMIT) {
        throw new Error('invalid_image');
      }
      body = Buffer.from(await file.arrayBuffer());
      if (
        !body.length ||
        body.length > IMAGE_LIMIT ||
        body.length !== file.size
      ) {
        throw new Error('invalid_image');
      }
      extension = imageExtension(body, file.type);
      const image = sharp(body, {
        limitInputPixels: 64_000_000,
        failOn: 'error',
      });
      const metadata = await image.metadata();
      const { width, height } = metadata;
      if (
        !width ||
        !height ||
        width < 240 ||
        height < 240 ||
        width > 8000 ||
        height > 8000 ||
        Math.max(width / height, height / width) > 8 ||
        (metadata.pages ?? 1) > 1
      )
        throw new Error('invalid_image');
      // Decode the entire image: a valid header alone does not prove it is usable.
      // Preserve the original bytes and metadata when uploading accepted images.
      const statistics = await image.stats();
      if (!statistics.isOpaque) throw new Error('invalid_image');
    } catch {
      throw new Error('invalid_image');
    }

    try {
      const key = `wan-inputs/${userNamespace(userId)}/${randomUUID()}.${extension}`;
      const url = this.publicUrl(key);
      const result = await this.provider.uploadFile({
        key,
        body,
        contentType: file.type,
        disposition: 'inline',
      });
      if (!result?.success || result.url !== url) {
        throw new Error('upload_failed');
      }
      return { url };
    } catch {
      throw new Error('storage_pending');
    }
  }

  async saveVideo(userId: string, taskId: string, sourceUrl: string) {
    try {
      if (!TASK_ID.test(taskId)) throw new Error('invalid_task');
      const key = `wan-videos/${userNamespace(userId)}/${taskId}.mp4`;
      const url = this.publicUrl(key);
      const source = secureUrl(sourceUrl);
      if (
        (!OUTPUT_HOST.test(source.hostname) &&
          source.hostname !== 'tempfile.aiquickdraw.com' &&
          !this.outputHosts.includes(source.hostname)) ||
        source.hostname.includes('-internal')
      ) {
        throw new Error('invalid_source');
      }
      if (await this.provider.exists?.({ key })) return url;
      const response = await this.request(sourceUrl, {
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok || response.redirected) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error('download_failed');
      }
      const mime = response.headers
        .get('content-type')
        ?.split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (mime !== 'video/mp4' && mime !== 'application/octet-stream') {
        await response.body?.cancel().catch(() => undefined);
        throw new Error('invalid_video');
      }
      const body = await readVideo(response);
      const result = await this.provider.uploadFile({
        key,
        body,
        contentType: 'video/mp4',
        disposition: 'inline',
      });
      if (!result?.success || result.url !== url) {
        throw new Error('upload_failed');
      }
      return url;
    } catch {
      throw new Error('storage_pending');
    }
  }
}

export function getWanVideoStorage(configs: Record<string, string>) {
  try {
    const provider = getStorageServiceWithConfigs(configs).getProvider('r2');
    if (!provider) throw new Error('storage_not_configured');
    return new WanVideoStorage(
      provider,
      fetch,
      normalizeOutputHosts(configs.wan_video_output_hosts || '')
    );
  } catch {
    throw new Error('storage_not_configured');
  }
}
