import { r2ConfigsFromSettings } from '@/extensions/storage/r2';

import { hasCronAuthorization } from './cron-auth';
import { cleanupUploadParts } from './upload-parts-cleanup';
import { getWanVideoConfigs } from './wan-video-config';

export async function handleUploadPartsCron(
  request: Request,
  secret = process.env.CRON_SECRET,
  sweep = async () =>
    cleanupUploadParts(r2ConfigsFromSettings(await getWanVideoConfigs()))
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!hasCronAuthorization(request, secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  try {
    const result = await sweep();
    return Response.json(
      { ok: !result.failed, result },
      { status: result.failed ? 503 : 200, headers }
    );
  } catch {
    return Response.json(
      { error: 'upload_cleanup_unavailable' },
      { status: 503, headers }
    );
  }
}
