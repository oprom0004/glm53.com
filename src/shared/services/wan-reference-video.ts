import { createHmac, timingSafeEqual } from 'node:crypto';
import { createFile, type Movie, type MP4BoxBuffer } from 'mp4box';

import { wanUploadSigningKey } from './wan-upload-signing';

export const REFERENCE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export type ReferenceVideoReceipt = { url: string; token: string };

export function inspectReferenceVideo(body: Buffer) {
  try {
    if (!body.length || body.length > REFERENCE_VIDEO_MAX_BYTES)
      throw new Error();
    // Reject incomplete containers before the parser can accept an early moov.
    let offset = 0;
    let hasMedia = false;
    while (offset < body.length) {
      if (offset + 8 > body.length) throw new Error();
      let size = body.readUInt32BE(offset);
      const type = body.toString('latin1', offset + 4, offset + 8);
      let header = 8;
      if (size === 1) {
        if (offset + 16 > body.length) throw new Error();
        size = Number(body.readBigUInt64BE(offset + 8));
        header = 16;
      } else if (size === 0) size = body.length - offset;
      if (
        !Number.isSafeInteger(size) ||
        size < header ||
        offset + size > body.length
      )
        throw new Error();
      if (type === 'mdat' && size > header) hasMedia = true;
      offset += size;
    }
    if (!hasMedia) throw new Error();
    const file = createFile();
    let info: Movie | undefined;
    let invalid = false;
    file.onError = () => {
      invalid = true;
    };
    file.onReady = (value) => {
      info = value;
    };
    const data = Uint8Array.from(body).buffer as MP4BoxBuffer;
    data.fileStart = 0;
    file.appendBuffer(data);
    file.flush();
    if (invalid || !info || info.isFragmented || info.videoTracks.length !== 1)
      throw new Error();
    const track = info.videoTracks[0];
    const width = track.video?.width ?? 0;
    const height = track.video?.height ?? 0;
    if (
      width < 240 ||
      height < 240 ||
      width > 4096 ||
      height > 4096 ||
      Math.max(width / height, height / width) > 8
    )
      throw new Error();
    let seconds = info.duration / info.timescale;
    for (const item of info.tracks) {
      seconds = Math.max(seconds, item.movie_duration / item.movie_timescale);
      const samples = file.getTrackSamplesInfo(item.id);
      if (!samples?.length) throw new Error();
      for (const sample of samples) {
        if (
          sample.offset < 0 ||
          sample.size <= 0 ||
          sample.offset + sample.size > body.length
        )
          throw new Error();
      }
    }
    const durationMs = Math.ceil(seconds * 1000 - 1e-6);
    if (!Number.isFinite(durationMs) || durationMs < 1000 || durationMs > 15000)
      throw new Error();
    return { durationMs, width, height };
  } catch {
    throw new Error('invalid_reference_video');
  }
}

// A dedicated key avoids coupling reference uploads to legacy login secrets.
function signingKey() {
  return wanUploadSigningKey();
}

export function signReferenceVideo(
  userId: string,
  url: string,
  durationMs: number
) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose: 'wan-reference-video-v1',
      userId,
      url,
      durationMs,
    })
  ).toString('base64url');
  const signature = createHmac('sha256', signingKey())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function referenceVideoDuration(
  receipts: ReferenceVideoReceipt[],
  userId?: string
) {
  if (!receipts.length) return 0;
  if (!userId || receipts.length > 5)
    throw new Error('invalid_reference_video');
  let total = 0;
  for (const receipt of receipts) {
    try {
      const parts = receipt.token.split('.');
      if (parts.length !== 2) throw new Error();
      const expected = createHmac('sha256', signingKey())
        .update(parts[0])
        .digest();
      const signature = Buffer.from(parts[1], 'base64url');
      if (
        signature.length !== expected.length ||
        !timingSafeEqual(signature, expected)
      )
        throw new Error();
      const payload = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8')
      );
      if (
        payload.purpose !== 'wan-reference-video-v1' ||
        payload.userId !== userId ||
        payload.url !== receipt.url ||
        !Number.isInteger(payload.durationMs) ||
        payload.durationMs < 1000 ||
        payload.durationMs > 15000
      )
        throw new Error();
      total += payload.durationMs;
    } catch {
      throw new Error('invalid_reference_video');
    }
  }
  if (total > 15000) throw new Error('reference_video_duration');
  return total / 1000;
}
