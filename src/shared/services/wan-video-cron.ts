import { hasCronAuthorization } from './cron-auth';
import { sweepWanVideos } from './wan-video';

export async function handleWanVideoCron(
  request: Request,
  secret = process.env.CRON_SECRET,
  sweep: () => Promise<{
    scanned: number;
    processed: number;
    failed: number;
  } | void> = () => sweepWanVideos(undefined, { maxTasks: 1 })
) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!hasCronAuthorization(request, secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }
  try {
    // One persisted task per invocation keeps query + download + upload within
    // the function budget. Task leases also protect overlapping invocations.
    const result = await sweep();
    return Response.json(
      { ok: !result?.failed, result },
      {
        status: result?.failed ? 503 : 200,
        headers,
      }
    );
  } catch {
    return Response.json(
      { error: 'recovery_unavailable' },
      { status: 503, headers }
    );
  }
}
