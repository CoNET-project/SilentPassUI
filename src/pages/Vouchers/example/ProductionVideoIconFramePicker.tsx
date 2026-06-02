import { useCallback, useEffect, useRef, useState } from 'react';
import { IpfsImg } from '@/components/IpfsImg';
import { Check, Loader2 } from 'lucide-react';
import {
  PRODUCTION_VIDEO_OG_FRAME_PICKER_COUNT,
  captureProductionVideoOgPickerBootstrapFrame,
  formatProductionVideoTimeSec,
  generateProductionVideoOgPickerFramesFromStandardizedClip,
  type ProductionVideoFrameThumbnail,
} from '@/utils/productionBackgroundVideo';
import {
  CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT,
  CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY,
  CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH,
} from '@/utils/catalogProductionVideoOgConstants';

const bizFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/40 focus-visible:ring-offset-2';

export type ProductionVideoIconFramePickerProps = {
  videoSrc: string;
  sourceFile?: File | null;
  durationSec?: number;
  /** Main ffmpeg worker is transcoding — show t=0 browser frame, defer batch extract. */
  backgroundVideoFfmpegBusy?: boolean;
  backgroundMediaUploading?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  onSelectFrame: (frame: ProductionVideoFrameThumbnail) => void;
};

function sourceFileCacheKey(file: File | null | undefined): string {
  if (!file) return '';
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function emptyFrameSlots(count: number): Array<ProductionVideoFrameThumbnail | null> {
  return Array.from({ length: count }, () => null);
}

function frameSlotsFromRows(
  rows: ProductionVideoFrameThumbnail[],
  count: number
): Array<ProductionVideoFrameThumbnail | null> {
  return Array.from({ length: count }, (_, index) => rows[index] ?? null);
}

function filledFrameCount(slots: Array<ProductionVideoFrameThumbnail | null>): number {
  return slots.filter((slot) => slot != null).length;
}

/** OG-style frame strip (YouTube hqdefault 480×360) — embed at bottom of Item icon section. */
export function ProductionVideoIconFramePicker(props: ProductionVideoIconFramePickerProps) {
  const {
    videoSrc,
    sourceFile,
    durationSec,
    backgroundVideoFfmpegBusy = false,
    disabled,
    uploading,
    onSelectFrame,
  } = props;
  const slotCount = PRODUCTION_VIDEO_OG_FRAME_PICKER_COUNT;
  const [frameSlots, setFrameSlots] = useState<Array<ProductionVideoFrameThumbnail | null>>(() =>
    emptyFrameSlots(slotCount)
  );
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Capturing preview at start of video…');
  const [loadError, setLoadError] = useState('');
  const [selectingTimeSec, setSelectingTimeSec] = useState<number | null>(null);
  const [pickedTimeSec, setPickedTimeSec] = useState<number | null>(null);

  const sourceFileRef = useRef(sourceFile);
  sourceFileRef.current = sourceFile;
  const durationSecRef = useRef(durationSec);
  durationSecRef.current = durationSec;
  const videoSrcRef = useRef(videoSrc);
  videoSrcRef.current = videoSrc;
  const bootstrapDoneKeyRef = useRef('');
  const bootstrapFrameRef = useRef<ProductionVideoFrameThumbnail | null>(null);

  const videoSrcKey = videoSrc.trim();
  const extractDepsKey = sourceFileCacheKey(sourceFile) || videoSrcKey;

  const extractGenerationRef = useRef(0);
  const cachedFramesRef = useRef<{ key: string; frames: ProductionVideoFrameThumbnail[] } | null>(null);

  const applyFrameAtIndex = useCallback((frame: ProductionVideoFrameThumbnail, index: number) => {
    setFrameSlots((prev) => {
      const next = Array.from({ length: slotCount }, (_, i) => prev[i] ?? null);
      next[index] = frame;
      return next;
    });
  }, [slotCount]);

  useEffect(() => {
    const generation = extractGenerationRef.current + 1;
    extractGenerationRef.current = generation;

    if (!extractDepsKey) {
      setFrameSlots(emptyFrameSlots(slotCount));
      setLoading(false);
      setLoadError('');
      cachedFramesRef.current = null;
      bootstrapDoneKeyRef.current = '';
      bootstrapFrameRef.current = null;
      return;
    }

    const cached = cachedFramesRef.current;
    if (cached?.key === extractDepsKey && cached.frames.length >= slotCount) {
      setFrameSlots(frameSlotsFromRows(cached.frames, slotCount));
      setLoadError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    void (async () => {
      const thumbOpts = {
        width: CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH,
        height: CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT,
        jpegQuality: CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY,
      };
      let hasPartialFrame = false;

      if (backgroundVideoFfmpegBusy) {
        if (extractGenerationRef.current === generation) {
          setFrameSlots(emptyFrameSlots(slotCount));
        }
        const busyBootstrapKey = videoSrcRef.current.trim();
        if (busyBootstrapKey && bootstrapDoneKeyRef.current !== busyBootstrapKey) {
          bootstrapDoneKeyRef.current = busyBootstrapKey;
          bootstrapFrameRef.current = null;
          if (extractGenerationRef.current === generation) {
            setLoadingMessage('Capturing preview at start of video…');
          }
          const boot = await captureProductionVideoOgPickerBootstrapFrame({
            videoUrl: busyBootstrapKey,
            sourceFile: null,
            ...thumbOpts,
          });
          if (extractGenerationRef.current === generation && boot) {
            bootstrapFrameRef.current = boot;
            hasPartialFrame = true;
            applyFrameAtIndex(boot, 0);
          }
        } else if (bootstrapFrameRef.current) {
          hasPartialFrame = true;
          if (extractGenerationRef.current === generation) {
            applyFrameAtIndex(bootstrapFrameRef.current, 0);
          }
        }
        if (extractGenerationRef.current === generation) {
          setLoadingMessage('Waiting for video encoding…');
          setLoading(true);
        }
        return;
      }

      bootstrapDoneKeyRef.current = '';
      bootstrapFrameRef.current = null;

      const playbackSrc = videoSrcRef.current.trim();
      if (!playbackSrc && !sourceFileRef.current) {
        if (extractGenerationRef.current === generation) {
          setLoadError('Could not load preview frames from this video.');
          setLoading(false);
        }
        return;
      }

      try {
        if (extractGenerationRef.current === generation) {
          setFrameSlots(emptyFrameSlots(slotCount));
          setLoadingMessage('Capturing preview frames from encoded video…');
        }
        const d = durationSecRef.current;
        const resolvedDuration =
          d != null && Number.isFinite(d) && d > 0 ? d : undefined;
        const rows = await generateProductionVideoOgPickerFramesFromStandardizedClip({
          videoSrc: playbackSrc,
          standardizedFile: sourceFileRef.current ?? null,
          count: slotCount,
          durationSec: resolvedDuration,
          ...thumbOpts,
          onStatus: (message) => {
            if (extractGenerationRef.current === generation) setLoadingMessage(message);
          },
          onFrame: (frame, index) => {
            if (extractGenerationRef.current !== generation) return;
            hasPartialFrame = true;
            applyFrameAtIndex(frame, index);
          },
        });
        if (extractGenerationRef.current !== generation) return;
        if (rows.length === 0) {
          if (!hasPartialFrame) {
            setLoadError('Could not load preview frames from this video.');
          }
          return;
        }
        cachedFramesRef.current = { key: extractDepsKey, frames: rows };
        setFrameSlots(frameSlotsFromRows(rows, slotCount));
        setLoadError('');
      } catch {
        if (extractGenerationRef.current !== generation) return;
        if (!hasPartialFrame) {
          setLoadError('Could not load preview frames from this video.');
        }
      } finally {
        if (extractGenerationRef.current === generation) setLoading(false);
      }
    })();
  }, [applyFrameAtIndex, extractDepsKey, backgroundVideoFfmpegBusy, slotCount]);

  useEffect(() => {
    setPickedTimeSec(null);
    setSelectingTimeSec(null);
  }, [extractDepsKey]);

  const handlePick = (frame: ProductionVideoFrameThumbnail) => {
    if (disabled || uploading) return;
    setSelectingTimeSec(frame.timeSec);
    void Promise.resolve(onSelectFrame(frame))
      .then(() => {
        setPickedTimeSec(frame.timeSec);
      })
      .finally(() => {
        setSelectingTimeSec((prev) => (prev === frame.timeSec ? null : prev));
      });
  };

  if (!extractDepsKey) return null;

  const filledCount = filledFrameCount(frameSlots);
  const showStrip = loading || filledCount > 0 || Boolean(loadError);

  return (
    <div
      className="border-t border-[#abadaf]/35 bg-[#f8fafb] px-3 py-3"
      role="group"
      aria-label="Optional catalog preview thumbnails from background video"
    >
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
        Catalog preview image (optional)
      </p>
      <p className="mb-2 text-[10px] font-medium leading-snug text-[#abadaf]">
        Same quality as YouTube OG — 480×360, used on the right in list and share layout. Frames are captured in
        parallel and appear as each finishes.
      </p>
      {loadError && filledCount === 0 ? (
        <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-medium text-amber-900">{loadError}</p>
      ) : showStrip ? (
        <>
          <div className="grid grid-cols-5 gap-1.5" role="menu">
            {Array.from({ length: slotCount }, (_, index) => {
              const frame = frameSlots[index];
              if (!frame) {
                return (
                  <div
                    key={`slot-loading-${index}`}
                    className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#eef1f3] ring-2 ring-transparent"
                    role="status"
                    aria-label={`Preview frame ${index + 1} loading`}
                    aria-busy="true"
                  >
                    <Loader2
                      className="h-5 w-5 animate-spin text-[#747779]"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                );
              }
              const isSelected =
                pickedTimeSec != null && Math.abs(pickedTimeSec - frame.timeSec) < 0.02;
              const isSelecting = selectingTimeSec != null && selectingTimeSec === frame.timeSec;
              return (
                <button
                  key={`${frame.timeSec}-${frame.dataUrl.slice(0, 24)}`}
                  type="button"
                  role="menuitemradio"
                  disabled={disabled || uploading || loading}
                  onClick={() => handlePick(frame)}
                  className={`group relative aspect-[4/3] overflow-hidden rounded-lg ring-2 transition ${
                    isSelected
                      ? 'ring-[#ea580c] ring-offset-1'
                      : 'ring-transparent hover:ring-[#ea580c]/35'
                  } disabled:cursor-not-allowed disabled:opacity-50 ${bizFocusRingClass}`}
                  aria-label={`Use frame at ${formatProductionVideoTimeSec(frame.timeSec)} as catalog preview image`}
                  aria-checked={isSelected}
                >
                  <IpfsImg
                    src={frame.dataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-0.5 py-0.5 text-center text-[8px] font-bold tabular-nums text-white">
                    {formatProductionVideoTimeSec(frame.timeSec)}
                  </span>
                  {isSelecting ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <Loader2 className="h-5 w-5 animate-spin text-white" strokeWidth={2} aria-hidden />
                    </span>
                  ) : null}
                  {isSelected && !isSelecting ? (
                    <span className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#ea580c] text-white shadow-sm">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {loading ? (
            <p
              className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] font-semibold text-[#747779]"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden />
              {loadingMessage}
              {filledCount > 0 ? (
                <span className="tabular-nums text-[#abadaf]">
                  ({filledCount}/{slotCount})
                </span>
              ) : null}
            </p>
          ) : null}
          {loadError && filledCount > 0 ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-center text-[10px] font-medium text-amber-900">
              {loadError}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
