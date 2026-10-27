import { AwsClient } from 'aws4fetch';
import { XMLParser } from 'fast-xml-parser';

import { R2Provider, type R2Configs } from '@/extensions/storage/r2';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PART_KEY =
  /^[a-f0-9]{64}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/(?:0|[1-9]\d*)$/;
type StorageRequest = (url: string, init: RequestInit) => Promise<Response>;

export function isExpiredUploadPart(
  key: string,
  modified: string,
  prefix: string,
  now: number
) {
  const timestamp = Date.parse(modified);
  return (
    key.startsWith(prefix) &&
    PART_KEY.test(key.slice(prefix.length)) &&
    Number.isFinite(timestamp) &&
    timestamp < now - MAX_AGE_MS
  );
}

async function readListing(response: Response) {
  if (!response.ok || !response.body) throw new Error('storage_list_failed');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error('storage_list_too_large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const xml = Buffer.concat(chunks).toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('invalid_storage_list');
  return new XMLParser({ parseTagValue: false, trimValues: false }).parse(xml)
    .ListBucketResult;
}

export async function cleanupUploadParts(
  configs: R2Configs,
  options: { request?: StorageRequest; now?: number; maxPages?: number } = {}
) {
  const validated = new R2Provider(configs).configs;
  // This directory is private to the chunk uploader; never accept a request prefix.
  const prefix = `${validated.uploadPath}/wan-upload-parts/`;
  const base = `${validated.endpoint}/${validated.bucket}`;
  const client = new AwsClient({
    accessKeyId: validated.accessKeyId,
    secretAccessKey: validated.secretAccessKey,
    region: 'auto',
    service: 's3',
    retries: 0,
  });
  const request = options.request ?? ((url, init) => client.fetch(url, init));
  const now = options.now ?? Date.now();
  const maxPages = options.maxPages ?? 10;
  if (
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 10 ||
    !Number.isFinite(now)
  ) {
    throw new Error('invalid_cleanup_options');
  }
  const deadline = Date.now() + 220_000;
  const result = {
    scanned: 0,
    deleted: 0,
    skipped: 0,
    failed: 0,
    hasMore: false,
  };
  let continuation: string | undefined;
  const tokens = new Set<string>();
  for (let page = 0; page < maxPages; page++) {
    const url = new URL(base);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    url.searchParams.set('max-keys', '500');
    if (continuation) url.searchParams.set('continuation-token', continuation);
    const listing = await readListing(
      await request(url.toString(), {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
      })
    );
    if (
      !listing ||
      listing.Prefix !== prefix ||
      !['true', 'false'].includes(listing.IsTruncated)
    ) {
      throw new Error('invalid_storage_list');
    }
    const items =
      listing.Contents == null
        ? []
        : Array.isArray(listing.Contents)
          ? listing.Contents
          : [listing.Contents];
    if (items.length > 500) throw new Error('invalid_storage_list');
    for (let offset = 0; offset < items.length; offset += 4) {
      if (Date.now() >= deadline) return { ...result, hasMore: true };
      await Promise.all(
        items
          .slice(offset, offset + 4)
          .map(async (item: { Key?: unknown; LastModified?: unknown }) => {
            result.scanned++;
            if (
              typeof item.Key !== 'string' ||
              typeof item.LastModified !== 'string' ||
              !isExpiredUploadPart(item.Key, item.LastModified, prefix, now)
            ) {
              result.skipped++;
              return;
            }
            try {
              const response = await request(
                `${base}/${item.Key.split('/').map(encodeURIComponent).join('/')}`,
                {
                  method: 'DELETE',
                  redirect: 'error',
                  signal: AbortSignal.timeout(15_000),
                }
              );
              if (!response.ok) throw new Error('storage_delete_failed');
              result.deleted++;
            } catch {
              result.failed++;
            }
          })
      );
    }
    if (listing.IsTruncated === 'false') return result;
    continuation = listing.NextContinuationToken;
    if (
      typeof continuation !== 'string' ||
      !continuation ||
      tokens.has(continuation)
    ) {
      throw new Error('invalid_storage_cursor');
    }
    tokens.add(continuation);
    if (Date.now() >= deadline) break;
  }
  return { ...result, hasMore: true };
}
