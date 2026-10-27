'use client';

import { useEffect, useState } from 'react';

export function SourcePreview({
  file,
  label,
  video,
  remove,
  onRemove,
  isZh,
}: {
  file: File;
  label: string;
  video: boolean;
  remove: string;
  onRemove: () => void;
  isZh: boolean;
}) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    const source = URL.createObjectURL(file);
    setUrl(source);
    setFailed(false);
    setDuration(null);
    return () => URL.revokeObjectURL(source);
  }, [file]);
  return (
    <li className="border-border/60 bg-background min-w-0 overflow-hidden rounded-xl border">
      <div className="bg-muted/40 flex aspect-video items-center justify-center overflow-hidden">
        {failed ? (
          <p className="text-muted-foreground p-3 text-xs">
            {isZh
              ? '浏览器无法预览此文件，请检查文件格式。'
              : 'This browser cannot preview this file. Check its format.'}
          </p>
        ) : (
          url &&
          (video ? (
            <video
              key={url}
              src={url}
              controls
              playsInline
              preload="metadata"
              aria-label={label}
              className="h-full w-full object-contain"
              onError={() => setFailed(true)}
              onLoadedMetadata={(event) => {
                const value = event.currentTarget.duration;
                if (Number.isFinite(value)) setDuration(value);
              }}
            />
          ) : (
            // Local object URLs cannot use the Next.js image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="h-full w-full object-contain"
              onError={() => setFailed(true)}
            />
          ))
        )}
      </div>
      <div className="space-y-1 p-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <strong>{label}</strong>
          <button
            type="button"
            className="text-violet-600 underline"
            aria-label={`${remove} ${label}`}
            onClick={onRemove}
          >
            {remove}
          </button>
        </div>
        <p className="text-muted-foreground truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-muted-foreground">
          {(file.size / 1024 / 1024).toFixed(2)} MB
          {duration !== null ? ` · ${Number(duration.toFixed(2))}s` : ''}
        </p>
      </div>
    </li>
  );
}
