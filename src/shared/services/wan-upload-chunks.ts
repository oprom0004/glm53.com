import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { AwsClient } from 'aws4fetch';

import { r2ConfigsFromSettings, R2Provider } from '@/extensions/storage/r2';
import { getUserInfo } from '@/shared/models/user';

import { wanUploadSigningKey } from './wan-upload-signing';
import { readWanBody } from './wan-video-api';
import { getWanVideoConfigs } from './wan-video-config';
import { getWanVideoStorage } from './wan-video-storage';

export const WAN_UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;
type Ticket = {
  user: string;
  id: string;
  size: number;
  mime: string;
  kind: 'image' | 'video';
  hash: string;
  extension: string;
  expires: number;
};
const signature = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function createUploadTicket(
  user: string,
  input: any,
  secret: string,
  now = Date.now()
) {
  if (!secret || !user) throw new Error('not_configured');
  const video = input?.kind === 'video';
  if (
    !['image', 'video'].includes(input?.kind) ||
    !Number.isSafeInteger(input.size) ||
    input.size <= 0 ||
    input.size > (video ? 100 : 10) * 1024 * 1024 ||
    !/^[a-f0-9]{64}$/.test(input.hash || '')
  )
    throw new Error('invalid_params');
  const types: Record<string, string> = video
    ? { 'video/mp4': 'mp4', 'video/quicktime': 'mov' }
    : { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!Object.hasOwn(types, input.mime)) throw new Error('invalid_params');
  const ticket: Ticket = {
    user,
    id: randomUUID(),
    size: input.size,
    mime: input.mime,
    kind: input.kind,
    hash: input.hash,
    extension: types[input.mime],
    expires: now + 30 * 60_000,
  };
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function readUploadTicket(
  token: string,
  user: string,
  secret: string,
  now = Date.now()
): Ticket {
  if (!secret || token.length > 4096) throw new Error('invalid_params');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('invalid_params');
  const actual = Buffer.from(parts[1]);
  const expected = Buffer.from(signature(parts[0], secret));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error('invalid_params');
  const ticket: Ticket = JSON.parse(
    Buffer.from(parts[0], 'base64url').toString()
  );
  if (ticket.user !== user || ticket.expires <= now)
    throw new Error('invalid_params');
  return ticket;
}

export function uploadChunkSize(ticket: Pick<Ticket, 'size'>, index: number) {
  const count = Math.ceil(ticket.size / WAN_UPLOAD_CHUNK_BYTES);
  if (!Number.isInteger(index) || index < 0 || index >= count)
    throw new Error('invalid_params');
  return Math.min(
    WAN_UPLOAD_CHUNK_BYTES,
    ticket.size - index * WAN_UPLOAD_CHUNK_BYTES
  );
}

export function verifyUploadBody(
  ticket: Pick<Ticket, 'size' | 'hash'>,
  body: Buffer
) {
  if (
    body.length !== ticket.size ||
    createHash('sha256').update(body).digest('hex') !== ticket.hash
  )
    throw new Error('invalid_params');
}

export async function handleWanChunkUpload(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return Response.json(
        { code: -1, message: 'forbidden' },
        { status: 403, headers }
      );
    const user = await getUserInfo();
    if (!user)
      return Response.json(
        { code: -1, message: 'unauthenticated' },
        { status: 401, headers }
      );
    const secret = wanUploadSigningKey();
    const action = new URL(request.url).searchParams.get('action');
    if (action === 'start') {
      const input = JSON.parse((await readWanBody(request, 2048)).toString());
      const token = createUploadTicket(user.id, input, secret);
      return Response.json(
        { code: 0, data: { token, chunkBytes: WAN_UPLOAD_CHUNK_BYTES } },
        { headers }
      );
    }
    const ticket = readUploadTicket(
      request.headers.get('x-upload-token') || '',
      user.id,
      secret
    );
    const configs = await getWanVideoConfigs();
    const provider = new R2Provider(r2ConfigsFromSettings(configs));
    const key = (index: number) =>
      `wan-upload-parts/${createHash('sha256').update(user.id).digest('hex')}/${ticket.id}/${index}`;
    if (action === 'part') {
      const rawIndex = new URL(request.url).searchParams.get('index') || '';
      if (!/^\d+$/.test(rawIndex)) throw new Error('invalid_params');
      const index = Number(rawIndex);
      const size = uploadChunkSize(ticket, index);
      const body = await readWanBody(request, size, 60_000);
      if (body.length !== size) throw new Error('invalid_params');
      const result = await provider.uploadFile({
        key: key(index),
        body,
        contentType: 'application/octet-stream',
      });
      if (!result.success) throw new Error('upload_failed');
      return Response.json({ code: 0, data: { ok: true } }, { headers });
    }
    if (action !== 'finish') throw new Error('invalid_params');
    const client = new AwsClient({
      accessKeyId: provider.configs.accessKeyId,
      secretAccessKey: provider.configs.secretAccessKey,
      region: 'auto',
      service: 's3',
      retries: 1,
    });
    const location = (index: number) =>
      `${provider.configs.endpoint}/${provider.configs.bucket}/${provider.configs.uploadPath}/${key(index)}`;
    const count = Math.ceil(ticket.size / WAN_UPLOAD_CHUNK_BYTES);
    const parts: Buffer[] = [];
    // Four small reads at a time; never accept a client-supplied fetch URL.
    for (let offset = 0; offset < count; offset += 4) {
      parts.push(
        ...(await Promise.all(
          Array.from({ length: Math.min(4, count - offset) }, async (_, n) => {
            const index = offset + n;
            const response = await client.fetch(location(index), {
              redirect: 'error',
              signal: AbortSignal.timeout(30_000),
            });
            if (!response.ok || !response.body)
              throw new Error('upload_failed');
            const body = await readWanBody(
              new Request('https://upload.internal', {
                method: 'POST',
                body: response.body,
                duplex: 'half',
              } as RequestInit),
              uploadChunkSize(ticket, index),
              30_000
            );
            if (body.length !== uploadChunkSize(ticket, index))
              throw new Error('upload_failed');
            return body;
          })
        ))
      );
    }
    const body = Buffer.concat(parts);
    verifyUploadBody(ticket, body);
    const file = new File(
      [new Uint8Array(body)],
      `upload.${ticket.extension}`,
      { type: ticket.mime }
    );
    const storage = getWanVideoStorage(configs);
    const data =
      ticket.kind === 'video'
        ? await storage.uploadReferenceVideo(user.id, file)
        : await storage.uploadImage(user.id, file);
    // Remove completed staging objects; the daily upload-parts cron cleans
    // abandoned parts after 24 hours within this isolated prefix.
    await Promise.allSettled(
      Array.from({ length: count }, (_, index) =>
        client.fetch(location(index), {
          method: 'DELETE',
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        })
      )
    );
    return Response.json({ code: 0, data }, { headers });
  } catch (error) {
    const code =
      error instanceof Error &&
      [
        'invalid_params',
        'invalid_image',
        'invalid_reference_video',
        'reference_video_duration',
        'not_configured',
        'storage_not_configured',
      ].includes(error.message)
        ? error.message
        : 'upload_failed';
    return Response.json(
      { code: -1, message: code },
      {
        status:
          code.startsWith('invalid') || code === 'reference_video_duration'
            ? 400
            : 503,
        headers,
      }
    );
  }
}
