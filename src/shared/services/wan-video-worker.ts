import { sweepWanVideos } from './wan-video';

const globalWorker = globalThis as typeof globalThis & {
  wanVideoWorkerStarted?: boolean;
};

export function startWanVideoWorker() {
  if (
    globalWorker.wanVideoWorkerStarted ||
    // Serverless instances cannot keep a reliable timer between requests.
    process.env.VERCEL === '1' ||
    process.env.WAN_VIDEO_WORKER_ENABLED === 'false'
  ) {
    return;
  }
  globalWorker.wanVideoWorkerStarted = true;

  const run = async () => {
    await runWanVideoWorkerOnce();
    setTimeout(run, 20_000).unref();
  };
  setTimeout(run, 10_000).unref();
}

export async function runWanVideoWorkerOnce(
  sweep: () => Promise<{ failed: number } | void> = sweepWanVideos
) {
  try {
    const result = await sweep();
    return !result?.failed;
  } catch {
    console.error('wan_video_recovery_unavailable');
    return false;
  }
}
