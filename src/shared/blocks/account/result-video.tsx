'use client';

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RotateCcw } from 'lucide-react';

export function ResultVideo({
  src,
  isZh = false,
}: {
  src: string;
  isZh?: boolean;
}) {
  const [revision, setRevision] = useState(0);
  return (
    <div className="relative h-full w-full">
      <VideoPlayer key={`${src}:${revision}`} src={src} isZh={isZh} />
      <button
        type="button"
        className="absolute top-2 right-2 rounded-full bg-black/65 px-3 py-1.5 text-xs text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white"
        onClick={() => setRevision((value) => value + 1)}
      >
        {isZh ? '重新加载视频' : 'Reload video'}
      </button>
    </div>
  );
}

function VideoPlayer({ src, isZh }: { src: string; isZh: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    // A cached video's load event can happen before React hydrates the page.
    if (videoRef.current && videoRef.current.readyState >= 2) setLoading(false);
  }, []);

  const replay = async () => {
    const video = videoRef.current;
    if (!video) return;
    setFailed(false);
    if (video.error) video.load();
    try {
      await video.play();
      setFinished(false);
    } catch {
      setLoading(false);
      setFailed(true);
    }
  };

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="auto"
        src={src}
        aria-label={isZh ? '视频预览' : 'Video preview'}
        className="h-full w-full object-contain"
        onLoadedData={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setLoading(false);
          setFinished(false);
          setFailed(false);
        }}
        onEnded={(event) => {
          // Some embedded browsers lose the painted frame at end-of-stream.
          // Seek back into the video so a decoded frame is available for replay.
          event.currentTarget.currentTime = 0;
          setLoading(false);
          setFinished(true);
        }}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
      {loading && !failed && !finished && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/30 text-sm text-white"
          role="status"
        >
          <LoaderCircle className="size-5 animate-spin" />
          {isZh ? '视频加载中…' : 'Loading video…'}
        </div>
      )}
      {(finished || failed) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 text-white">
          {failed && (
            <p className="text-sm" role="alert">
              {isZh
                ? '视频加载失败，请重试'
                : 'Video could not load. Please try again.'}
            </p>
          )}
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/65 px-4 py-2 text-sm text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-white"
            onClick={() => void replay()}
          >
            <RotateCcw className="size-4" />
            {failed
              ? isZh
                ? '重试'
                : 'Retry video'
              : isZh
                ? '重新播放'
                : 'Replay video'}
          </button>
        </div>
      )}
    </div>
  );
}
