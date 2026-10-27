'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/shared/lib/utils';

// Marketing previews only. Generated user results keep their native player.
export function WanDemoVideo({
  src,
  label,
  className,
  fit = 'cover',
  poster = '/og/wan-30-ai.jpg',
}: {
  src: string;
  label: string;
  className?: string;
  fit?: 'cover' | 'contain';
  poster?: string;
}) {
  const t = useTranslations('common.media');
  const videoRef = useRef<HTMLVideoElement>(null);
  const toggleRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current!;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const canObserve = typeof IntersectionObserver !== 'undefined';
    let visible = false;
    let manual = false;
    let userPaused = false;
    let isPlaying = false;
    let wantsPlayback = false;
    let disposed = false;

    const stop = () => {
      video.pause();
      isPlaying = false;
      if (!disposed) setPlaying(false);
    };
    const syncPlayback = () => {
      wantsPlayback =
        visible &&
        document.visibilityState !== 'hidden' &&
        !userPaused &&
        (manual || (!motion.matches && !connection?.saveData));
      if (!wantsPlayback) return stop();
      // No src/source in SSR or offscreen DOM: preload alone cannot prevent
      // autoplay downloads. Retain loaded sources so scrolling reuses buffers.
      if (video.getAttribute('src') !== src) video.setAttribute('src', src);
      void video
        .play()
        ?.then(() => {
          if (disposed || !wantsPlayback) video.pause();
        })
        .catch(() => {
          if (!disposed) {
            isPlaying = false;
            setPlaying(false);
          }
        });
    };
    const onPlaying = () => {
      isPlaying = true;
      setPlaying(true);
    };
    const onPause = () => {
      isPlaying = false;
      if (!disposed) setPlaying(false);
    };
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    const observer = canObserve
      ? new IntersectionObserver(
          (entries) => {
            // Fast scrolling can queue multiple crossings before one callback.
            const entry = entries[entries.length - 1];
            if (!entry) return;
            const nextVisible =
              entry.isIntersecting && entry.intersectionRatio >= 0.15;
            if (visible !== nextVisible) {
              visible = nextVisible;
              syncPlayback();
            }
          },
          { threshold: [0, 0.15] }
        )
      : undefined;
    observer?.observe(video);
    document.addEventListener('visibilitychange', syncPlayback);
    motion.addEventListener('change', syncPlayback);
    toggleRef.current = () => {
      userPaused = isPlaying;
      manual = true;
      if (!canObserve) visible = true;
      syncPlayback();
    };
    return () => {
      disposed = true;
      wantsPlayback = false;
      stop();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      motion.removeEventListener('change', syncPlayback);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      toggleRef.current = () => {};
    };
  }, [src]);

  return (
    <div className={cn('relative overflow-hidden bg-black', className)}>
      <video
        ref={videoRef}
        aria-label={label}
        loop
        muted
        playsInline
        preload="none"
        poster={poster}
        className={cn(
          'h-full w-full',
          fit === 'contain' ? 'object-contain' : 'object-cover'
        )}
      />
      <button
        type="button"
        aria-label={playing ? t('pause') : t('play')}
        onClick={() => toggleRef.current()}
        className="absolute right-3 bottom-3 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        {playing ? (
          <Pause size={16} aria-hidden="true" />
        ) : (
          <Play size={16} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
