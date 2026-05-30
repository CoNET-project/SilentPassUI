import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Loader2, Pause, Pencil, Play, X } from 'lucide-react';
import {
  PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS,
  formatProductionVideoTimeSec,
} from '@/utils/productionBackgroundVideo';

const bizFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/40 focus-visible:ring-offset-2';

const FILMSTRIP_THUMB_COUNT = 14;
const FILMSTRIP_THUMB_WIDTH = 72;
const FILMSTRIP_THUMB_HEIGHT = 40;

type DragMode = 'move' | 'left' | 'right' | null;

export type ProductionVideoFilmstripTrimEditorProps = {
  videoSrc: string;
  durationSec: number;
  maxClipSec?: number;
  startSec: number;
  onStartSecChange: (value: number) => void;
  trimConfirmed: boolean;
  onTrimConfirm: () => void;
  onTrimEdit: () => void;
  onCancel: () => void;
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number;
  uploadMessage?: string;
};

function clampStartSec(startSec: number, durationSec: number, clipSec: number): number {
  const maxStart = Math.max(0, durationSec - clipSec);
  if (!Number.isFinite(startSec)) return 0;
  return Math.min(Math.max(0, startSec), maxStart);
}

async function waitForVideoEvent(video: HTMLVideoElement, event: keyof HTMLMediaElementEventMap): Promise<void> {
  if (event === 'loadedmetadata' && video.readyState >= 1) return;
  if (event === 'seeked' && !video.seeking) return;

  await new Promise<void>((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Video seek failed.'));
    };
    const cleanup = () => {
      video.removeEventListener(event, onOk);
      video.removeEventListener('error', onErr);
    };
    video.addEventListener(event, onOk);
    video.addEventListener('error', onErr);
  });
}

async function generateFilmstripThumbnails(videoSrc: string, durationSec: number, count: number): Promise<string[]> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = videoSrc;

  await waitForVideoEvent(video, 'loadedmetadata');

  const canvas = document.createElement('canvas');
  canvas.width = FILMSTRIP_THUMB_WIDTH;
  canvas.height = FILMSTRIP_THUMB_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const safeDuration = Math.max(0.25, durationSec);
  const thumbs: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0 : (i / (count - 1)) * Math.max(0, safeDuration - 0.05);
    video.currentTime = t;
    await waitForVideoEvent(video, 'seeked');
    ctx.drawImage(video, 0, 0, FILMSTRIP_THUMB_WIDTH, FILMSTRIP_THUMB_HEIGHT);
    thumbs.push(canvas.toDataURL('image/jpeg', 0.52));
  }

  video.removeAttribute('src');
  video.load();
  return thumbs;
}

function TrimActionButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'confirm' | 'neutral';
  children: ReactNode;
}) {
  const toneClass =
    props.tone === 'confirm'
      ? 'bg-[#0ea5e9] text-white hover:bg-[#0284c7]'
      : 'bg-white/15 text-white hover:bg-white/25';
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      title={props.label}
      className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass} ${bizFocusRingClass}`}
    >
      {props.children}
    </button>
  );
}

export function ProductionVideoFilmstripTrimEditor(props: ProductionVideoFilmstripTrimEditorProps) {
  const maxClipSec = props.maxClipSec ?? PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS;
  const durationSec = Math.max(0.25, props.durationSec);
  const clipSec = useMemo(
    () => Math.min(maxClipSec, Math.max(0.25, durationSec)),
    [durationSec, maxClipSec]
  );
  const startSec = clampStartSec(props.startSec, durationSec, clipSec);
  const endSec = startSec + clipSec;

  const previewRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    pointerId: number;
    startPointerSec: number;
    startSec: number;
  } | null>(null);

  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [scrubPreviewSec, setScrubPreviewSec] = useState<number | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const selectionLeftPct = (startSec / durationSec) * 100;
  const selectionWidthPct = (clipSec / durationSec) * 100;
  const selectMode = !props.trimConfirmed;
  const showUploadOverlay = Boolean(props.uploading && props.trimConfirmed);
  const uploadPct = Math.min(100, Math.max(0, props.uploadProgress ?? 0));

  const clampPlayheadSec = useCallback(
    (sec: number): number => {
      const maxPlayhead = Math.max(startSec, endSec - 0.05);
      return Math.min(maxPlayhead, Math.max(startSec, sec));
    },
    [endSec, startSec]
  );

  const suppressPauseRef = useRef(false);
  const seekingRef = useRef(false);

  const seekPlayhead = useCallback(
    (sec: number, opts?: { updateScrubLabel?: boolean; resumeIfPlaying?: boolean }) => {
      const inClip = clampPlayheadSec(sec);
      const video = previewRef.current;
      if (video) {
        try {
          video.currentTime = inClip;
        } catch {
          /* ignore */
        }
        if (opts?.resumeIfPlaying && playingRef.current) {
          suppressPauseRef.current = true;
          void video
            .play()
            .then(() => setPlaying(true))
            .catch(() => undefined)
            .finally(() => {
              suppressPauseRef.current = false;
            });
        }
      }
      if (opts?.updateScrubLabel) setScrubPreviewSec(inClip);
    },
    [clampPlayheadSec]
  );

  useEffect(() => {
    if (playing) return;
    seekPlayhead(scrubPreviewSec ?? startSec, { updateScrubLabel: false });
    if (!props.trimConfirmed && scrubPreviewSec == null) setScrubPreviewSec(null);
  }, [startSec, props.trimConfirmed, playing, scrubPreviewSec, seekPlayhead]);

  useEffect(() => {
    if (!props.trimConfirmed || playing) return;
    seekPlayhead(scrubPreviewSec ?? startSec, { updateScrubLabel: false });
  }, [props.trimConfirmed, startSec, playing, scrubPreviewSec, seekPlayhead]);

  useEffect(() => {
    if (!selectMode) return;
    let cancelled = false;
    setThumbsLoading(true);
    setThumbnails([]);
    void generateFilmstripThumbnails(props.videoSrc, durationSec, FILMSTRIP_THUMB_COUNT)
      .then((rows) => {
        if (!cancelled) setThumbnails(rows);
      })
      .catch(() => {
        if (!cancelled) setThumbnails([]);
      })
      .finally(() => {
        if (!cancelled) setThumbsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.videoSrc, durationSec, selectMode]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;

    const stopAtEnd = () => {
      const clipEnd = endSec;
      if (video.currentTime >= clipEnd - 0.05) {
        video.pause();
        video.currentTime = startSec;
        setScrubPreviewSec(startSec);
        setPlaying(false);
      }
      if (video.currentTime < startSec - 0.05) {
        video.currentTime = clampPlayheadSec(video.currentTime);
      }
    };

    video.addEventListener('timeupdate', stopAtEnd);
    return () => video.removeEventListener('timeupdate', stopAtEnd);
  }, [clampPlayheadSec, endSec, startSec]);

  const pointerSecFromClientX = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return startSec;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return startSec;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * durationSec;
    },
    [durationSec, startSec]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const seekFromTrackPointer = useCallback(
    (clientX: number, opts?: { moveClipToInclude?: boolean; resumeIfPlaying?: boolean }) => {
      const pointerSec = pointerSecFromClientX(clientX);
      if (opts?.moveClipToInclude && (pointerSec < startSec || pointerSec > endSec)) {
        const nextStart = clampStartSec(pointerSec, durationSec, clipSec);
        props.onStartSecChange(nextStart);
        seekPlayhead(pointerSec, { updateScrubLabel: true, resumeIfPlaying: opts?.resumeIfPlaying });
        return;
      }
      seekPlayhead(pointerSec, { updateScrubLabel: true, resumeIfPlaying: opts?.resumeIfPlaying });
    },
    [clipSec, durationSec, endSec, pointerSecFromClientX, props, seekPlayhead, startSec]
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId || props.disabled || props.trimConfirmed) return;

      const pointerSec = pointerSecFromClientX(event.clientX);
      if (drag.mode === 'move') {
        const delta = pointerSec - drag.startPointerSec;
        const nextStart = clampStartSec(drag.startSec + delta, durationSec, clipSec);
        props.onStartSecChange(nextStart);
        seekPlayhead(nextStart, { updateScrubLabel: true, resumeIfPlaying: playingRef.current });
        return;
      }
      if (drag.mode === 'left') {
        const nextStart = clampStartSec(pointerSec, durationSec, clipSec);
        props.onStartSecChange(nextStart);
        seekPlayhead(nextStart, { updateScrubLabel: true, resumeIfPlaying: playingRef.current });
        return;
      }
      if (drag.mode === 'right') {
        const nextStart = clampStartSec(pointerSec - clipSec, durationSec, clipSec);
        props.onStartSecChange(nextStart);
        seekPlayhead(nextStart + clipSec, { updateScrubLabel: true, resumeIfPlaying: playingRef.current });
      }
    };

    const onUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) endDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [
    clipSec,
    durationSec,
    endDrag,
    pointerSecFromClientX,
    props.disabled,
    props.onStartSecChange,
    props.trimConfirmed,
    seekPlayhead,
  ]);

  const handleTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (props.disabled || props.trimConfirmed) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-trim-selection]')) return;
      event.preventDefault();
      seekFromTrackPointer(event.clientX, {
        moveClipToInclude: true,
        resumeIfPlaying: playingRef.current,
      });
    },
    [props.disabled, props.trimConfirmed, seekFromTrackPointer]
  );

  const beginDrag = useCallback(
    (mode: DragMode, event: React.PointerEvent) => {
      if (props.disabled || props.trimConfirmed) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        mode,
        pointerId: event.pointerId,
        startPointerSec: pointerSecFromClientX(event.clientX),
        startSec,
      };
      if (mode === 'right') {
        seekPlayhead(endSec, { updateScrubLabel: true, resumeIfPlaying: playingRef.current });
      } else {
        seekPlayhead(startSec, { updateScrubLabel: true, resumeIfPlaying: playingRef.current });
      }
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    },
    [endSec, pointerSecFromClientX, props.disabled, props.trimConfirmed, seekPlayhead, startSec]
  );

  const togglePlay = useCallback(() => {
    const video = previewRef.current;
    if (!video || props.disabled) return;
    if (playing) {
      video.pause();
      setPlaying(false);
      return;
    }
    const resumeAt = scrubPreviewSec ?? video.currentTime;
    seekPlayhead(resumeAt, { updateScrubLabel: true });
    void video.play().then(() => setPlaying(true)).catch(() => undefined);
  }, [playing, props.disabled, scrubPreviewSec, seekPlayhead]);

  const previewTimeLabel = selectMode
    ? scrubPreviewSec != null
      ? formatProductionVideoTimeSec(scrubPreviewSec)
      : `${formatProductionVideoTimeSec(startSec)} – ${formatProductionVideoTimeSec(endSec)}`
    : `${formatProductionVideoTimeSec(clipSec)} clip`;

  return (
    <div className="overflow-hidden rounded-xl bg-[#0f172a]">
      <div className="relative aspect-[16/10] w-full bg-black sm:aspect-video">
        <video
          ref={previewRef}
          src={props.videoSrc}
          className="h-full w-full object-contain"
          playsInline
          preload="auto"
          controls={playing}
          onPlay={() => setPlaying(true)}
          onSeeking={() => {
            seekingRef.current = true;
          }}
          onSeeked={() => {
            seekingRef.current = false;
            const video = previewRef.current;
            if (!video) return;
            const clamped = clampPlayheadSec(video.currentTime);
            if (Math.abs(clamped - video.currentTime) > 0.01) {
              try {
                video.currentTime = clamped;
              } catch {
                /* ignore */
              }
            }
            setScrubPreviewSec(clamped);
            if (playingRef.current && video.paused) {
              suppressPauseRef.current = true;
              void video
                .play()
                .then(() => setPlaying(true))
                .catch(() => undefined)
                .finally(() => {
                  suppressPauseRef.current = false;
                });
            }
          }}
          onPause={() => {
            if (suppressPauseRef.current || seekingRef.current) return;
            setPlaying(false);
          }}
          onEnded={() => setPlaying(false)}
        />

        <div className="pointer-events-none absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          <div className="pointer-events-auto flex flex-col gap-2">
            {props.trimConfirmed ? (
              <>
                <TrimActionButton
                  label="Edit trim"
                  onClick={props.onTrimEdit}
                  disabled={props.disabled || props.uploading}
                >
                  <Pencil className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                </TrimActionButton>
                <TrimActionButton
                  label="Cancel"
                  onClick={props.onCancel}
                  disabled={props.disabled && !props.uploading}
                >
                  <X className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                </TrimActionButton>
              </>
            ) : (
              <>
                <TrimActionButton
                  label="Confirm trim"
                  tone="confirm"
                  onClick={props.onTrimConfirm}
                  disabled={props.disabled}
                >
                  <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />
                </TrimActionButton>
                <TrimActionButton label="Cancel" onClick={props.onCancel} disabled={props.disabled}>
                  <X className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                </TrimActionButton>
              </>
            )}
          </div>
        </div>

        {showUploadOverlay ? (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#0f172a]/80 px-6 text-center text-white"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <Loader2 className="h-8 w-8 animate-spin" strokeWidth={2} aria-hidden />
            <div className="w-full max-w-[260px]">
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-[#0ea5e9] transition-[width] duration-200"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-semibold text-white/85">{uploadPct}%</p>
            </div>
            <p className="text-[11px] font-bold leading-snug text-white">
              {props.uploadMessage || 'Converting and uploading…'}
            </p>
            <p className="text-[10px] font-medium text-white/75">
              Please wait — do not close this screen.
            </p>
          </div>
        ) : null}

        {selectMode ? (
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/90 via-black/75 to-transparent px-2 pb-2 pt-8 pr-14">
            <button
              type="button"
              onClick={togglePlay}
              disabled={props.disabled}
              className={`mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm disabled:opacity-50 ${bizFocusRingClass}`}
              aria-label={playing ? 'Pause preview' : 'Play preview'}
            >
              {playing ? (
                <Pause className="h-4 w-4" strokeWidth={2.4} fill="currentColor" aria-hidden />
              ) : (
                <Play className="ml-0.5 h-4 w-4" strokeWidth={2.4} fill="currentColor" aria-hidden />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div
                ref={trackRef}
                className="relative h-10 overflow-hidden rounded-md border border-white/10 bg-black/40"
                onPointerDown={handleTrackPointerDown}
              >
                <div className="absolute inset-0 flex">
                  {thumbsLoading ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-white/70" aria-hidden />
                    </div>
                  ) : thumbnails.length > 0 ? (
                    thumbnails.map((src, index) => (
                      <img
                        key={`filmstrip-${index}`}
                        src={src}
                        alt=""
                        className="h-full flex-1 object-cover"
                        draggable={false}
                      />
                    ))
                  ) : (
                    <div className="h-full w-full bg-[#1e293b]" />
                  )}
                </div>

                <div
                  className="pointer-events-none absolute inset-y-0 left-0 bg-black/55"
                  style={{ width: `${selectionLeftPct}%` }}
                />
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 bg-black/55"
                  style={{ width: `${Math.max(0, 100 - selectionLeftPct - selectionWidthPct)}%` }}
                />

                <div
                  data-trim-selection
                  className="absolute inset-y-0 box-border cursor-grab touch-none border-2 border-[#facc15] active:cursor-grabbing"
                  style={{
                    left: `${selectionLeftPct}%`,
                    width: `${selectionWidthPct}%`,
                  }}
                  onPointerDown={(event) => beginDrag('move', event)}
                >
                  <div
                    className="absolute inset-y-0 -left-1.5 z-10 w-4 cursor-ew-resize touch-none"
                    onPointerDown={(event) => beginDrag('left', event)}
                  />
                  <div
                    className="absolute inset-y-0 -right-1.5 z-10 w-4 cursor-ew-resize touch-none"
                    onPointerDown={(event) => beginDrag('right', event)}
                  />
                </div>
              </div>
              <p className="mt-1 text-[10px] font-medium text-white/75">
                {previewTimeLabel}
                {' · '}
                drag handles to set a {maxClipSec}s clip
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-10 pr-14">
            <button
              type="button"
              onClick={togglePlay}
              disabled={props.disabled}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm disabled:opacity-50 ${bizFocusRingClass}`}
              aria-label={playing ? 'Pause clip' : 'Play clip'}
            >
              {playing ? (
                <Pause className="h-4 w-4" strokeWidth={2.4} fill="currentColor" aria-hidden />
              ) : (
                <Play className="ml-0.5 h-4 w-4" strokeWidth={2.4} fill="currentColor" aria-hidden />
              )}
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/80">
              Trimmed preview · {formatProductionVideoTimeSec(startSec)} – {formatProductionVideoTimeSec(endSec)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
