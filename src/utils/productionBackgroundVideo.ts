import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  encodeProductionBackgroundVideoWebCodecs,
  isWebCodecsProductionVideoEncodeSupported,
  WEBCODECS_MAX_WIDTH,
} from './productionBackgroundVideoWebCodecs';
import {
  extractProductionVideoFrameThumbnailsInFfmpegWorker,
  extractProductionVideoOgFrameThumbnailsInWorker,
  ffmpegWorkerMergeAudio,
  ffmpegWorkerStreamCopyTrim,
  ffmpegWorkerTranscode,
  isProductionBackgroundVideoFfmpegWorkerSupported,
  preloadProductionBackgroundVideoFfmpegWorker,
} from './productionBackgroundVideoFfmpegWorker';
import {
  CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT,
  CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY,
  CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH,
  CATALOG_VIDEO_OG_THUMB_FFMPEG_QV,
  PRODUCTION_VIDEO_OG_FRAME_PICKER_COUNT,
  PRODUCTION_VIDEO_OG_PICKER_CAPTURE_TIMEOUT_MS,
  PRODUCTION_VIDEO_OG_PICKER_FFMPEG_TIMEOUT_MS,
  PRODUCTION_VIDEO_OG_PICKER_SEEK_TIMEOUT_MS,
} from './catalogProductionVideoOgConstants';

/** Max catalog background clip length after local standardization. */
export const PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS = 60;

/** Raw MP4 ceiling before base64 (~4/3) for fragment JSON limit (70mb). Internal encode target only. */
export const IPFS_VIDEO_RAW_MAX_BYTES = 50 * 1024 * 1024;

const FFMPEG_ENCODE_ATTEMPTS: ReadonlyArray<{ crf: number; maxWidth: number }> = [
  { crf: 32, maxWidth: 1280 },
  { crf: 35, maxWidth: 960 },
  { crf: 38, maxWidth: 720 },
];

function ffmpegCorePublicBase(): string {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/ffmpeg`;
}

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;
/** ffmpeg.wasm is single-flight — background encode and icon frame extract must not overlap. */
let ffmpegExclusiveTail: Promise<void> = Promise.resolve();

export function runWithFfmpegExclusive<T>(work: () => Promise<T>): Promise<T> {
  const run = ffmpegExclusiveTail.then(work, work);
  ffmpegExclusiveTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Main-thread ffmpeg.wasm is loading or ready (background encode / preload). */
export function isMainThreadFfmpegInFlight(): boolean {
  return ffmpegLoadPromise != null || ffmpegInstance != null;
}

/** Prefer persistent worker (single ffmpeg.wasm); main thread only as fallback. */
export function shouldUseProductionBackgroundVideoFfmpegWorker(): boolean {
  return isProductionBackgroundVideoFfmpegWorkerSupported();
}

/** @deprecated Use {@link shouldUseProductionBackgroundVideoFfmpegWorker}. */
export function shouldUseOgFrameExtractWorker(): boolean {
  return shouldUseProductionBackgroundVideoFfmpegWorker();
}

function wrapFfmpegLoadError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return new Error(
      'Could not load the video processor. Refresh the page and try again. If this persists, check your network or ad blocker.'
    );
  }
  return err instanceof Error ? err : new Error(msg || 'Video processor failed to load.');
}

async function loadFfmpeg(onStatus?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      onStatus?.('Loading video processor…');
      const ffmpeg = new FFmpeg();
      const coreBase = ffmpegCorePublicBase();
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      } catch (err) {
        ffmpegLoadPromise = null;
        throw wrapFfmpegLoadError(err);
      }
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }
  return ffmpegLoadPromise;
}

/** Warm up ffmpeg.wasm in the persistent worker. Call on any video pick. */
export function preloadProductionBackgroundVideoProcessor(onStatus?: (message: string) => void): void {
  preloadProductionBackgroundVideoFfmpegWorker();
  if (!isProductionBackgroundVideoFfmpegWorkerSupported()) {
    void loadFfmpeg(onStatus).catch(() => undefined);
  }
}

export function fileLooksLikeProductionBackgroundVideo(file: File): boolean {
  const mime = (file.type || '').trim().toLowerCase();
  if (mime.startsWith('video/')) return true;
  const name = file.name.toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogv|mkv)$/.test(name);
}

function fileLooksLikeMp4Container(file: File): boolean {
  const mime = (file.type || '').trim().toLowerCase();
  if (mime === 'video/mp4' || mime === 'video/quicktime') return true;
  return /\.(mp4|m4v|mov)$/i.test(file.name);
}

export {
  PRODUCTION_VIDEO_OG_FRAME_PICKER_COUNT,
  PRODUCTION_VIDEO_OG_FRAME_PICKER_COUNT as PRODUCTION_VIDEO_ICON_FRAME_PICKER_COUNT,
  PRODUCTION_VIDEO_OG_PICKER_CAPTURE_TIMEOUT_MS,
  PRODUCTION_VIDEO_OG_PICKER_FFMPEG_TIMEOUT_MS,
  PRODUCTION_VIDEO_OG_PICKER_SEEK_TIMEOUT_MS,
} from './catalogProductionVideoOgConstants';

export type ProductionVideoFrameThumbnail = {
  timeSec: number;
  dataUrl: string;
};

export type ProductionVideoFrameExtractCallbacks = {
  onStatus?: (message: string) => void;
  /** After each thumbnail is ready (may complete out of order when parallel seeks are used). */
  onFrame?: (frame: ProductionVideoFrameThumbnail, index: number, total: number) => void;
};

/** Above this, `<video>` + canvas seek/draw is unreliable (e.g. 4096×2304). */
const PRODUCTION_VIDEO_CANVAS_FRAME_MAX_DIMENSION = 2048;

const PRODUCTION_VIDEO_READY_TIMEOUT_MS = 45_000;
const PRODUCTION_VIDEO_SEEK_TIMEOUT_MS = 25_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read frame.'));
    reader.readAsDataURL(blob);
  });
}

async function waitForProductionVideoElementEvent(
  video: HTMLVideoElement,
  event: keyof HTMLMediaElementEventMap,
  timeoutMs?: number
): Promise<void> {
  if (event === 'loadedmetadata' && video.readyState >= 1) return;

  await new Promise<void>((resolve, reject) => {
    const timer =
      timeoutMs != null && timeoutMs > 0
        ? window.setTimeout(() => {
            cleanup();
            reject(new Error('Video load timeout.'));
          }, timeoutMs)
        : undefined;
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(event === 'loadedmetadata' ? 'Video load failed.' : 'Video seek failed.'));
    };
    const cleanup = () => {
      if (timer != null) window.clearTimeout(timer);
      video.removeEventListener(event, onOk);
      video.removeEventListener('error', onErr);
    };
    video.addEventListener(event, onOk);
    video.addEventListener('error', onErr);
  });
}

/** Wait until at least one decodable frame exists (needed before seek on large uploads). */
async function waitForProductionVideoElementReady(
  video: HTMLVideoElement,
  timeoutMs = PRODUCTION_VIDEO_READY_TIMEOUT_MS
): Promise<void> {
  if (video.readyState >= 2) return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      if (video.readyState >= 2) {
        settled = true;
        cleanup();
        resolve();
      }
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Video load failed.'));
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('canplay', finish);
      video.removeEventListener('loadedmetadata', finish);
      video.removeEventListener('error', fail);
      window.clearTimeout(timer);
    };
    video.addEventListener('loadeddata', finish);
    video.addEventListener('canplay', finish);
    video.addEventListener('loadedmetadata', finish);
    video.addEventListener('error', fail);
    const timer = window.setTimeout(() => {
      if (video.readyState >= 1) finish();
      else fail();
    }, timeoutMs);
  });
}

/** Warm decoder so later seeks return distinct frames (not only keyframe 0). */
async function primeProductionVideoForPickerCapture(video: HTMLVideoElement): Promise<void> {
  video.pause();
  try {
    video.currentTime = 0;
    await waitForProductionVideoElementEvent(video, 'seeked', 8_000);
  } catch {
    /* continue */
  }
  try {
    await Promise.race([
      video.play(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 300)),
    ]);
    video.pause();
    await waitForProductionVideoPresentedFrame(video, 2_500);
  } catch {
    video.pause();
  }
}

async function seekProductionVideoElement(
  video: HTMLVideoElement,
  timeSec: number,
  timeoutMs = PRODUCTION_VIDEO_SEEK_TIMEOUT_MS,
  paintOptions?: { quickCaptureMode?: boolean }
): Promise<void> {
  const target = Math.max(0, timeSec);
  const atTarget = Math.abs(video.currentTime - target) < 0.08;
  const skipSeek = atTarget && video.readyState >= 2 && !paintOptions?.quickCaptureMode;

  if (!skipSeek) {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video seek timeout.'));
    }, timeoutMs);

    const onSeeked = () => {
      if (Math.abs(video.currentTime - target) > 0.2) return;
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Video seek failed.'));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onErr);
    try {
      video.currentTime = target;
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error('Video seek failed.'));
    }
  });
  }

  await waitForProductionVideoFramePaint(video, paintOptions);
}

/** Catalog picker: wait for a presented frame after seek (RVFC + timeout). */
const PRODUCTION_VIDEO_PICKER_FRAME_PAINT_MAX_MS = 4_000;

async function waitForProductionVideoPresentedFrame(
  video: HTMLVideoElement,
  maxWaitMs: number
): Promise<void> {
  const rvfc = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    }
  ).requestVideoFrameCallback;

  if (typeof rvfc === 'function') {
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let handle: number | undefined;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve();
        };
        const timer = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          if (handle != null && typeof video.cancelVideoFrameCallback === 'function') {
            video.cancelVideoFrameCallback(handle);
          }
          reject(new Error('Video frame paint timeout.'));
        }, maxWaitMs);
        handle = rvfc.call(video, finish);
      });
      return;
    } catch {
      /* decode fallback below */
    }
  }

  await new Promise<void>((resolve) => window.setTimeout(resolve, 200));
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForProductionVideoFramePaint(
  video: HTMLVideoElement,
  options?: { quickCaptureMode?: boolean }
): Promise<void> {
  if (options?.quickCaptureMode === true) {
    await waitForProductionVideoPresentedFrame(video, PRODUCTION_VIDEO_PICKER_FRAME_PAINT_MAX_MS);
    return;
  }

  const waitAnimationFrames = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const rvfc = (
    video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    }
  ).requestVideoFrameCallback;
  if (typeof rvfc === 'function') {
    await waitForProductionVideoPresentedFrame(video, 8_000).catch(() => waitAnimationFrames());
    return;
  }
  await waitAnimationFrames();
}

async function drawProductionVideoFrameCoverCropForPicker(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outW: number,
  outH: number
): Promise<void> {
  if (typeof createImageBitmap !== 'function') {
    drawProductionVideoFrameCoverCrop(ctx, video, outW, outH);
    return;
  }
  const bitmap = await createImageBitmap(video);
  try {
    const vw = bitmap.width;
    const vh = bitmap.height;
    if (!vw || !vh) {
      ctx.drawImage(bitmap, 0, 0, outW, outH);
      return;
    }
    const scale = Math.max(outW / vw, outH / vh);
    const srcW = outW / scale;
    const srcH = outH / scale;
    const sx = (vw - srcW) / 2;
    const sy = (vh - srcH) / 2;
    ctx.drawImage(bitmap, sx, sy, srcW, srcH, 0, 0, outW, outH);
  } finally {
    bitmap.close();
  }
}

function productionVideoOgPickerFrameTimes(count: number, safeDurationSec: number): number[] {
  return Array.from({ length: count }, (_, index) =>
    count <= 1 ? 0 : (index / (count - 1)) * Math.max(0, safeDurationSec - 0.05)
  );
}

function createDetachedCaptureVideo(videoSrc: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.src = videoSrc;
  return video;
}

function releaseDetachedCaptureVideo(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute('src');
  video.load();
}

async function prepareDetachedCaptureVideo(
  video: HTMLVideoElement,
  quickCaptureMode: boolean
): Promise<void> {
  await waitForProductionVideoElementEvent(
    video,
    'loadedmetadata',
    PRODUCTION_VIDEO_READY_TIMEOUT_MS
  );
  if (quickCaptureMode) {
    await waitForProductionVideoElementReady(video, 20_000).catch(() => undefined);
    await primeProductionVideoForPickerCapture(video);
  } else {
    await waitForProductionVideoElementReady(video);
  }
}

async function resolveCaptureDurationSec(
  probeVideo: HTMLVideoElement,
  durationSec: number | undefined,
  quickCaptureMode: boolean
): Promise<number> {
  let resolved = durationSec;
  if (resolved == null || !Number.isFinite(resolved) || resolved <= 0) {
    resolved = readVideoDurationSec(probeVideo) ?? 0;
  }
  if (!Number.isFinite(resolved) || resolved <= 0) {
    if (quickCaptureMode) {
      resolved = readVideoDurationSec(probeVideo) ?? 60;
    } else {
      resolved = await probeVideoDurationSecWithSeekFallback(probeVideo);
    }
  }
  return Math.max(0.25, resolved);
}

async function captureFrameThumbnailFromPreparedVideo(
  video: HTMLVideoElement,
  args: {
    timeSec: number;
    safeDuration: number;
    width: number;
    height: number;
    jpegQuality: number;
    seekTimeoutMs: number;
    quickCaptureMode: boolean;
    nudgeAgainstDataUrl?: string;
  }
): Promise<ProductionVideoFrameThumbnail> {
  const { safeDuration, width, height, jpegQuality, seekTimeoutMs, quickCaptureMode } = args;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not extract frames from this video.');

  const paintOpts = quickCaptureMode ? { quickCaptureMode: true as const } : undefined;
  let t = args.timeSec;
  await seekProductionVideoElement(video, t, seekTimeoutMs, paintOpts);
  if (quickCaptureMode) {
    await drawProductionVideoFrameCoverCropForPicker(ctx, video, width, height);
  } else {
    drawProductionVideoFrameCoverCrop(ctx, video, width, height);
  }
  let dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);

  const ref = args.nudgeAgainstDataUrl;
  if (
    quickCaptureMode &&
    ref &&
    ref.length > 64 &&
    ref.length === dataUrl.length &&
    ref.slice(0, 4096) === dataUrl.slice(0, 4096)
  ) {
    const nudge = Math.min(t + 0.15, Math.max(0, safeDuration - 0.05));
    if (Math.abs(nudge - t) > 0.05) {
      await seekProductionVideoElement(video, nudge, seekTimeoutMs, paintOpts);
      await drawProductionVideoFrameCoverCropForPicker(ctx, video, width, height);
      dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      t = nudge;
    }
  }

  return { timeSec: t, dataUrl };
}

/** One `<video>` per timestamp — parallel seeks (OG picker; count is small, e.g. 5). */
async function generateProductionVideoFrameThumbnailsParallelSeek(
  videoSrc: string,
  options: {
    count: number;
    safeDuration: number;
    width: number;
    height: number;
    jpegQuality: number;
    seekTimeoutMs: number;
    quickCaptureMode: boolean;
  } & ProductionVideoFrameExtractCallbacks
): Promise<ProductionVideoFrameThumbnail[]> {
  const { count, safeDuration, width, height, jpegQuality, seekTimeoutMs, quickCaptureMode } = options;
  const times = productionVideoOgPickerFrameTimes(count, safeDuration);
  const slots: Array<ProductionVideoFrameThumbnail | undefined> = Array.from(
    { length: count },
    () => undefined
  );

  options.onStatus?.('Capturing preview frames in parallel…');

  await Promise.all(
    times.map(async (timeSec, index) => {
      options.onStatus?.(`Capturing preview frame ${index + 1} of ${count}…`);
      const video = createDetachedCaptureVideo(videoSrc);
      try {
        await prepareDetachedCaptureVideo(video, quickCaptureMode);
        const frame = await captureFrameThumbnailFromPreparedVideo(video, {
          timeSec,
          safeDuration,
          width,
          height,
          jpegQuality,
          seekTimeoutMs,
          quickCaptureMode,
        });
        slots[index] = frame;
        options.onFrame?.(frame, index, count);
      } finally {
        releaseDetachedCaptureVideo(video);
      }
    })
  );

  const thumbs = slots.filter((frame): frame is ProductionVideoFrameThumbnail => frame != null);
  if (thumbs.length === 0) {
    throw new Error('Could not extract frames from this video.');
  }

  if (quickCaptureMode && count > 1 && slots[0]) {
    const ref0 = slots[0].dataUrl;
    for (let index = 1; index < count; index += 1) {
      const existing = slots[index];
      if (
        !existing ||
        existing.dataUrl.length <= 64 ||
        existing.dataUrl.slice(0, 4096) !== ref0.slice(0, 4096)
      ) {
        continue;
      }
      const video = createDetachedCaptureVideo(videoSrc);
      try {
        await prepareDetachedCaptureVideo(video, true);
        const fixed = await captureFrameThumbnailFromPreparedVideo(video, {
          timeSec: times[index],
          safeDuration,
          width,
          height,
          jpegQuality,
          seekTimeoutMs,
          quickCaptureMode: true,
          nudgeAgainstDataUrl: ref0,
        });
        slots[index] = fixed;
        options.onFrame?.(fixed, index, count);
      } finally {
        releaseDetachedCaptureVideo(video);
      }
    }
  }

  return times.map((_, index) => {
    const frame = slots[index];
    if (!frame) throw new Error('Could not extract frames from this video.');
    return frame;
  });
}

function productionVideoExceedsCanvasFrameLimit(video: HTMLVideoElement): boolean {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return false;
  return (
    w > PRODUCTION_VIDEO_CANVAS_FRAME_MAX_DIMENSION || h > PRODUCTION_VIDEO_CANVAS_FRAME_MAX_DIMENSION
  );
}

/** Center crop + cover (matches ffmpeg `scale=…:force_original_aspect_ratio=increase,crop=…`). */
function drawProductionVideoFrameCoverCrop(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outW: number,
  outH: number
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    ctx.drawImage(video, 0, 0, outW, outH);
    return;
  }
  const scale = Math.max(outW / vw, outH / vh);
  const srcW = outW / scale;
  const srcH = outH / scale;
  const sx = (vw - srcW) / 2;
  const sy = (vh - srcH) / 2;
  ctx.drawImage(video, sx, sy, srcW, srcH, 0, 0, outW, outH);
}

async function readFfmpegImageOutputBlob(ffmpeg: FFmpeg, outputName: string): Promise<Blob> {
  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  return new Blob([bytes], { type: 'image/jpeg' });
}

async function generateProductionVideoFrameThumbnailsViaFfmpegImpl(
  file: File,
  options: {
    count?: number;
    durationSec?: number;
    width?: number;
    height?: number;
    ffmpegQv?: number;
  } & ProductionVideoFrameExtractCallbacks
): Promise<ProductionVideoFrameThumbnail[]> {
  const count = Math.max(1, options.count ?? 12);
  const width = options.width ?? 96;
  const height = options.height ?? 96;
  const ffmpegQv = options.ffmpegQv ?? 8;

  let durationSec = options.durationSec;
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec <= 0) {
    durationSec = await probeProductionBackgroundVideoDurationSec(file);
  }
  const safeDuration = Math.max(0.25, durationSec);

  options.onStatus?.('Extracting preview frames…');
  const ffmpeg = await loadFfmpeg(options.onStatus);

  const extMatch = file.name.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  const inputName = `og-picker-input.${ext}`;

  if (file.size > 32 * 1024 * 1024) {
    options.onStatus?.('Preparing large video for frame extract…');
  }
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const scaleCrop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const thumbs: ProductionVideoFrameThumbnail[] = [];

  try {
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : (i / (count - 1)) * Math.max(0, safeDuration - 0.05);
      options.onStatus?.(`Capturing preview frame ${i + 1} of ${count}…`);
      const outputName = `icon-picker-frame-${i}.jpg`;
      await ffmpeg.deleteFile(outputName).catch(() => undefined);

      const exitCode = await ffmpeg.exec([
        '-ss',
        String(t),
        '-i',
        inputName,
        '-an',
        '-sn',
        '-dn',
        '-frames:v',
        '1',
        '-vf',
        scaleCrop,
        '-q:v',
        String(ffmpegQv),
        outputName,
      ]);

      if (exitCode !== 0) continue;

      const blob = await readFfmpegImageOutputBlob(ffmpeg, outputName);
      const dataUrl = await blobToDataUrl(blob);
      const frame = { timeSec: t, dataUrl };
      thumbs.push(frame);
      options.onFrame?.(frame, i, count);
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
  }

  if (thumbs.length === 0) {
    throw new Error('Could not extract frames from this video.');
  }
  return thumbs;
}

/** Filmstrip / in-player canvas fallback — must not overlap background standardize. */
async function generateProductionVideoFrameThumbnailsViaFfmpeg(
  file: File,
  options: {
    count?: number;
    durationSec?: number;
    width?: number;
    height?: number;
    ffmpegQv?: number;
  } & ProductionVideoFrameExtractCallbacks
): Promise<ProductionVideoFrameThumbnail[]> {
  if (shouldUseProductionBackgroundVideoFfmpegWorker()) {
    let durationSec = options.durationSec;
    if (durationSec == null || !Number.isFinite(durationSec) || durationSec <= 0) {
      durationSec = await probeProductionBackgroundVideoDurationSec(file);
    }
    try {
      return await extractProductionVideoFrameThumbnailsInFfmpegWorker({
        file,
        count: Math.max(1, options.count ?? 12),
        durationSec,
        width: options.width ?? 96,
        height: options.height ?? 96,
        ffmpegQv: options.ffmpegQv ?? 8,
        onStatus: options.onStatus,
      });
    } catch {
      /* fallback */
    }
  }
  return runWithFfmpegExclusive(() => generateProductionVideoFrameThumbnailsViaFfmpegImpl(file, options));
}

async function generateProductionVideoFrameThumbnailsFromVideoElement(
  videoSrc: string,
  options: {
    count?: number;
    durationSec?: number;
    width?: number;
    height?: number;
    jpegQuality?: number;
    sourceFile?: File | null;
    /** OG picker outputs 480×360; allow canvas when source exceeds 2048px (browser decodes like preview banner). */
    allowHighResolutionSource?: boolean;
    seekTimeoutMs?: number;
    quickCaptureMode?: boolean;
  } & ProductionVideoFrameExtractCallbacks
): Promise<ProductionVideoFrameThumbnail[]> {
  const count = Math.max(1, options.count ?? 12);
  const width = options.width ?? 96;
  const height = options.height ?? 96;
  const jpegQuality = options.jpegQuality ?? 0.72;
  const quickCaptureMode = options.quickCaptureMode === true;
  const seekTimeoutMs = options.seekTimeoutMs ?? PRODUCTION_VIDEO_SEEK_TIMEOUT_MS;

  const probeVideo = createDetachedCaptureVideo(videoSrc);
  try {
    await prepareDetachedCaptureVideo(probeVideo, quickCaptureMode);

    if (
      options.sourceFile &&
      productionVideoExceedsCanvasFrameLimit(probeVideo) &&
      !options.allowHighResolutionSource
    ) {
      return generateProductionVideoFrameThumbnailsViaFfmpeg(options.sourceFile, {
        count,
        durationSec: options.durationSec,
        width,
        height,
        onStatus: options.onStatus,
        onFrame: options.onFrame,
      });
    }

    const safeDuration = await resolveCaptureDurationSec(
      probeVideo,
      options.durationSec,
      quickCaptureMode
    );

    const sharedCapture = {
      count,
      safeDuration,
      width,
      height,
      jpegQuality,
      seekTimeoutMs,
      quickCaptureMode,
      onStatus: options.onStatus,
      onFrame: options.onFrame,
    };

    if (quickCaptureMode && count > 1) {
      return generateProductionVideoFrameThumbnailsParallelSeek(videoSrc, sharedCapture);
    }

    const video = probeVideo;
    const times = productionVideoOgPickerFrameTimes(count, safeDuration);
    const thumbs: ProductionVideoFrameThumbnail[] = [];
    for (let index = 0; index < count; index += 1) {
      const timeSec = times[index];
      options.onStatus?.(
        quickCaptureMode
          ? `Capturing preview frame ${index + 1} of ${count}…`
          : 'Extracting preview frames…'
      );
      try {
        const prev = thumbs[thumbs.length - 1];
        const frame = await captureFrameThumbnailFromPreparedVideo(video, {
          timeSec,
          safeDuration,
          width,
          height,
          jpegQuality,
          seekTimeoutMs,
          quickCaptureMode,
          nudgeAgainstDataUrl:
            quickCaptureMode && prev && index > 0 ? prev.dataUrl : undefined,
        });
        thumbs.push(frame);
        options.onFrame?.(frame, index, count);
      } catch (err) {
        if (thumbs.length > 0) break;
        throw err;
      }
    }
    if (thumbs.length === 0) {
      throw new Error('Could not extract frames from this video.');
    }
    return thumbs;
  } finally {
    releaseDetachedCaptureVideo(probeVideo);
  }
}

/** Uploaded MP4/WebM background (not YouTube URL). */
export function isUploadedProductionBackgroundVideo(args: {
  productionImage: string;
  productionImageMime?: string;
  productionVideoDraftUrl?: string;
}): boolean {
  if (args.productionVideoDraftUrl?.trim()) return true;
  const image = args.productionImage.trim();
  if (!image) return false;
  const mime = (args.productionImageMime ?? '').trim().toLowerCase();
  if (mime === 'video/youtube') return false;
  const lower = image.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return false;
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|&|$)/i.test(image);
}

export async function probeProductionBackgroundVideoDurationFromUrl(videoSrc: string): Promise<number> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = videoSrc;
  try {
    await waitForProductionVideoElementEvent(
      video,
      'loadedmetadata',
      PRODUCTION_VIDEO_READY_TIMEOUT_MS
    );
    const d = readVideoDurationSec(video);
    if (d != null && d > 0 && productionBackgroundVideoNeedsClipEdit(d)) {
      return d;
    }
    await waitForProductionVideoElementReady(video).catch(() => undefined);
    const metadataDuration = readVideoDurationSec(video);
    if (metadataDuration != null && metadataDuration > 0) {
      try {
        const seekDuration = await probeVideoDurationSecWithSeekFallback(video);
        return Math.max(metadataDuration, seekDuration);
      } catch {
        return metadataDuration;
      }
    }
    return await probeVideoDurationSecWithSeekFallback(video);
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

const PRODUCTION_VIDEO_ICON_FRAME_EXTRACT_TIMEOUT_MS = 180_000;
/** Instant t=0 preview while 4K transcode runs on the main ffmpeg worker. */
const PRODUCTION_VIDEO_OG_PICKER_BOOTSTRAP_TIMEOUT_MS = 18_000;

function withProductionVideoFrameExtractTimeout<T>(
  work: Promise<T>,
  timeoutMs = PRODUCTION_VIDEO_ICON_FRAME_EXTRACT_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Frame extraction timed out.'));
    }, timeoutMs);
    void work.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function generateProductionVideoOgFrameThumbnailsViaVideoElement(args: {
  sourceFile?: File | null;
  videoUrl?: string;
  count: number;
  durationSec?: number;
  width: number;
  height: number;
  jpegQuality: number;
  quickCaptureMode?: boolean;
  seekTimeoutMs?: number;
} & ProductionVideoFrameExtractCallbacks): Promise<ProductionVideoFrameThumbnail[]> {
  const file = args.sourceFile ?? null;
  const trimmedUrl = (args.videoUrl ?? '').trim();
  const objectUrl = !trimmedUrl && file ? URL.createObjectURL(file) : '';
  const videoSrc = trimmedUrl || objectUrl;
  if (!videoSrc) return [];

  try {
    args.onStatus?.('Capturing preview frames from video…');
    return await generateProductionVideoFrameThumbnailsFromVideoElement(videoSrc, {
      count: args.count,
      durationSec: args.durationSec,
      width: args.width,
      height: args.height,
      jpegQuality: args.jpegQuality,
      sourceFile: null,
      allowHighResolutionSource: true,
      quickCaptureMode: args.quickCaptureMode,
      seekTimeoutMs: args.seekTimeoutMs,
      onStatus: args.onStatus,
      onFrame: args.onFrame,
    });
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function generateProductionVideoOgFrameThumbnailsViaFfmpeg(args: {
  file: File;
  count: number;
  durationSec: number;
  width: number;
  height: number;
  ffmpegQv: number;
} & ProductionVideoFrameExtractCallbacks): Promise<ProductionVideoFrameThumbnail[]> {
  if (shouldUseProductionBackgroundVideoFfmpegWorker()) {
    try {
      return await extractProductionVideoOgFrameThumbnailsInWorker({
        file: args.file,
        count: args.count,
        durationSec: args.durationSec,
        width: args.width,
        height: args.height,
        ffmpegQv: args.ffmpegQv,
        onStatus: args.onStatus,
        onFrame: args.onFrame,
      });
    } catch {
      /* main-thread ffmpeg fallback */
    }
  }

  return runWithFfmpegExclusive(() =>
    generateProductionVideoFrameThumbnailsViaFfmpegImpl(args.file, {
      count: args.count,
      durationSec: args.durationSec,
      width: args.width,
      height: args.height,
      ffmpegQv: args.ffmpegQv,
      onStatus: args.onStatus,
    })
  );
}

/** Browser-only first frame at t=0 while background-video transcode is in flight. */
export async function captureProductionVideoOgPickerBootstrapFrame(args: {
  sourceFile?: File | null;
  videoUrl?: string;
  width?: number;
  height?: number;
  jpegQuality?: number;
}): Promise<ProductionVideoFrameThumbnail | null> {
  const videoUrl = (args.videoUrl ?? '').trim();
  if (!videoUrl && !args.sourceFile) return null;

  const rows = await withProductionVideoFrameExtractTimeout(
    generateProductionVideoOgFrameThumbnailsViaVideoElement({
      sourceFile: args.sourceFile ?? null,
      videoUrl: videoUrl || undefined,
      count: 1,
      durationSec: 0.25,
      width: args.width ?? CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH,
      height: args.height ?? CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT,
      jpegQuality: args.jpegQuality ?? CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY,
      quickCaptureMode: true,
      seekTimeoutMs: 8_000,
      onStatus: () => undefined,
    }),
    PRODUCTION_VIDEO_OG_PICKER_BOOTSTRAP_TIMEOUT_MS
  ).catch(() => [] as ProductionVideoFrameThumbnail[]);

  return rows[0] ?? null;
}

/** Resolve playback URL for the ffmpeg-standardized catalog background clip (≤1280p). */
export function resolveProductionVideoStandardizedClipPlaybackUrl(args: {
  videoSrc: string;
  standardizedFile?: File | null;
}): { url: string; revokeWhenDone: boolean } {
  const trimmed = args.videoSrc.trim();
  if (trimmed.startsWith('blob:')) {
    return { url: trimmed, revokeWhenDone: false };
  }
  const file = args.standardizedFile ?? null;
  if (file && fileLooksLikeProductionBackgroundVideo(file)) {
    return { url: URL.createObjectURL(file), revokeWhenDone: true };
  }
  return { url: trimmed, revokeWhenDone: false };
}

/** Five OG picker frames from the post-transcode MP4 — browser only, no second ffmpeg pass. */
export async function generateProductionVideoOgPickerFramesFromStandardizedClip(args: {
  videoSrc: string;
  standardizedFile?: File | null;
  count?: number;
  durationSec?: number;
  width?: number;
  height?: number;
  jpegQuality?: number;
} & ProductionVideoFrameExtractCallbacks): Promise<ProductionVideoFrameThumbnail[]> {
  const { url, revokeWhenDone } = resolveProductionVideoStandardizedClipPlaybackUrl({
    videoSrc: args.videoSrc,
    standardizedFile: args.standardizedFile ?? null,
  });
  if (!url) return [];
  try {
    return await generateProductionVideoOgFrameThumbnails({
      videoUrl: url,
      sourceFile: null,
      pickerStandardizedClip: true,
      count: args.count,
      durationSec: args.durationSec,
      width: args.width,
      height: args.height,
      jpegQuality: args.jpegQuality,
      onStatus: args.onStatus,
      onFrame: args.onFrame,
    });
  } finally {
    if (revokeWhenDone) URL.revokeObjectURL(url);
  }
}

/**
 * Catalog video OG right thumbnail — YouTube `hqdefault` resolution (480×360, 4:3 cover crop).
 * Not icon-sized; uploads to item `icon` field for list / share OG layout parity.
 */
export async function generateProductionVideoOgFrameThumbnails(args: {
  sourceFile?: File | null;
  videoUrl?: string;
  count?: number;
  durationSec?: number;
  width?: number;
  height?: number;
  jpegQuality?: number;
  ffmpegQv?: number;
  /** Catalog preview image picker — prefer ffmpeg worker on `sourceFile`, then browser fallback. */
  pickerCapture?: boolean;
  /** After transcode: try main ffmpeg worker first (single wasm instance). */
  pickerFfmpegOnly?: boolean;
  /** Browser canvas batch only (standardized clip URL / file). */
  pickerBrowserOnly?: boolean;
  /**
   * Catalog picker batch — decode the **already standardized** MP4 (blob / 1280p clip) in `<video>`.
   * Never re-runs ffmpeg.wasm on the file buffer.
   */
  pickerStandardizedClip?: boolean;
} & ProductionVideoFrameExtractCallbacks): Promise<ProductionVideoFrameThumbnail[]> {
  const file = args.sourceFile ?? null;
  const count = Math.max(1, args.count ?? PRODUCTION_VIDEO_OG_FRAME_PICKER_COUNT);
  const width = args.width ?? CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH;
  const height = args.height ?? CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT;
  const jpegQuality = args.jpegQuality ?? CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY;
  const ffmpegQv = args.ffmpegQv ?? CATALOG_VIDEO_OG_THUMB_FFMPEG_QV;
  const videoUrl = (args.videoUrl ?? '').trim();
  const pickerCapture = args.pickerCapture === true;
  const pickerFfmpegOnly = args.pickerFfmpegOnly === true;
  const pickerBrowserOnly = args.pickerBrowserOnly === true;
  const pickerStandardizedClip = args.pickerStandardizedClip === true;

  const captureTimeoutMs = pickerCapture
    ? PRODUCTION_VIDEO_OG_PICKER_CAPTURE_TIMEOUT_MS
    : PRODUCTION_VIDEO_ICON_FRAME_EXTRACT_TIMEOUT_MS;
  const ffmpegTimeoutMs = pickerCapture
    ? PRODUCTION_VIDEO_OG_PICKER_FFMPEG_TIMEOUT_MS
    : PRODUCTION_VIDEO_ICON_FRAME_EXTRACT_TIMEOUT_MS;

  let durationSec = args.durationSec;
  const hasDuration =
    durationSec != null && Number.isFinite(durationSec) && durationSec > 0;

  if (!hasDuration) {
    if (pickerCapture && videoUrl) {
      durationSec = undefined;
    } else if (file) {
      try {
        durationSec = await withProductionVideoFrameExtractTimeout(
          probeProductionBackgroundVideoDurationSec(file),
          12_000
        );
      } catch {
        durationSec = 60;
      }
    } else if (videoUrl) {
      try {
        durationSec = await withProductionVideoFrameExtractTimeout(
          probeProductionBackgroundVideoDurationFromUrl(videoUrl),
          12_000
        );
      } catch {
        durationSec = 60;
      }
    }
  }

  const shared = {
    sourceFile: file,
    videoUrl,
    count,
    durationSec,
    width,
    height,
    jpegQuality,
    quickCaptureMode: pickerCapture || pickerStandardizedClip,
    seekTimeoutMs:
      pickerCapture || pickerStandardizedClip ? PRODUCTION_VIDEO_OG_PICKER_SEEK_TIMEOUT_MS : undefined,
    onStatus: args.onStatus,
    onFrame: args.onFrame,
  };

  if (pickerStandardizedClip) {
    const clipUrl = videoUrl;
    if (!clipUrl) return [];
    args.onStatus?.('Capturing preview frames from encoded video…');
    try {
      const rows = await withProductionVideoFrameExtractTimeout(
        generateProductionVideoOgFrameThumbnailsViaVideoElement({
          sourceFile: null,
          videoUrl: clipUrl,
          count,
          durationSec,
          width,
          height,
          jpegQuality,
          quickCaptureMode: true,
          seekTimeoutMs: PRODUCTION_VIDEO_OG_PICKER_SEEK_TIMEOUT_MS,
          onStatus: args.onStatus,
          onFrame: args.onFrame,
        }),
        captureTimeoutMs
      );
      if (rows.length > 0) return rows;
    } catch {
      /* ignore */
    }
    return [];
  }

  const tryVideoElement = () =>
    withProductionVideoFrameExtractTimeout(
      generateProductionVideoOgFrameThumbnailsViaVideoElement(shared),
      captureTimeoutMs
    );

  const tryFfmpeg =
    file != null
      ? () =>
          withProductionVideoFrameExtractTimeout(
            generateProductionVideoOgFrameThumbnailsViaFfmpeg({
              file,
              count,
              durationSec: Math.max(0.25, durationSec ?? 60),
              width,
              height,
              ffmpegQv,
              onStatus: args.onStatus,
            }),
            ffmpegTimeoutMs
          )
      : null;

  if (pickerBrowserOnly) {
    try {
      args.onStatus?.('Capturing preview frames from video…');
      const canvasRows = await tryVideoElement();
      if (canvasRows.length > 0) return canvasRows;
    } catch {
      /* ignore */
    }
    return [];
  }

  if (pickerFfmpegOnly) {
    if (tryFfmpeg) {
      args.onStatus?.('Extracting preview frames (video processor)…');
      try {
        const ffmpegRows = await tryFfmpeg();
        if (ffmpegRows.length > 0) return ffmpegRows;
      } catch {
        /* browser fallback below */
      }
    }
    try {
      args.onStatus?.('Capturing preview frames from video…');
      const canvasRows = await tryVideoElement();
      if (canvasRows.length > 0) return canvasRows;
    } catch {
      /* ignore */
    }
    return [];
  }

  if (pickerCapture) {
    if (tryFfmpeg) {
      try {
        args.onStatus?.('Extracting preview frames (video processor)…');
        const ffmpegRows = await tryFfmpeg();
        if (ffmpegRows.length > 0) return ffmpegRows;
      } catch {
        /* browser fallback */
      }
    }
    try {
      args.onStatus?.('Capturing preview frames from video…');
      const canvasRows = await tryVideoElement();
      if (canvasRows.length > 0) return canvasRows;
    } catch {
      /* ignore */
    }
    if (tryFfmpeg) {
      try {
        return await tryFfmpeg();
      } catch {
        return [];
      }
    }
    return [];
  }

  if (tryFfmpeg) {
    try {
      const ffmpegRows = await tryFfmpeg();
      if (ffmpegRows.length > 0) return ffmpegRows;
    } catch {
      /* canvas fallback */
    }
  }

  try {
    const canvasRows = await tryVideoElement();
    if (canvasRows.length > 0) return canvasRows;
  } catch {
    /* optional second ffmpeg attempt */
  }

  if (tryFfmpeg) {
    try {
      return await tryFfmpeg();
    } catch {
      return [];
    }
  }

  if (!videoUrl) return [];
  return withProductionVideoFrameExtractTimeout(
    generateProductionVideoFrameThumbnails(videoUrl, {
      count,
      durationSec,
      width,
      height,
      jpegQuality,
      onStatus: args.onStatus,
    }),
    captureTimeoutMs
  );
}

/** @deprecated Use {@link generateProductionVideoOgFrameThumbnails}. */
export const generateProductionVideoIconFrameThumbnails = generateProductionVideoOgFrameThumbnails;

/** Evenly spaced JPEG frames from a video URL or blob URL (catalog item icon picker, filmstrip). */
export async function generateProductionVideoFrameThumbnails(
  videoSrc: string,
  options: {
    count?: number;
    durationSec?: number;
    width?: number;
    height?: number;
    jpegQuality?: number;
    /** Original upload file — enables ffmpeg.wasm fallback for 4K+ and failed canvas seeks. */
    sourceFile?: File | null;
    onStatus?: (message: string) => void;
  } = {}
): Promise<ProductionVideoFrameThumbnail[]> {
  const src = videoSrc.trim();
  if (!src) return [];

  const file = options.sourceFile ?? null;
  if (file) {
    try {
      return await generateProductionVideoFrameThumbnailsFromVideoElement(src, {
        ...options,
        sourceFile: file,
      });
    } catch {
      return generateProductionVideoFrameThumbnailsViaFfmpeg(file, options);
    }
  }

  return generateProductionVideoFrameThumbnailsFromVideoElement(src, options);
}

export function formatProductionVideoTimeSec(totalSec: number): string {
  const safe = Number.isFinite(totalSec) && totalSec > 0 ? totalSec : 0;
  const whole = Math.floor(safe);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function clampProductionVideoStartSec(startSec: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const maxStart = Math.max(0, durationSec - 0.25);
  if (!Number.isFinite(startSec)) return 0;
  return Math.min(Math.max(0, startSec), maxStart);
}

export function productionVideoClipDurationSec(startSec: number, durationSec: number): number {
  const start = clampProductionVideoStartSec(startSec, durationSec);
  const remaining = Math.max(0, durationSec - start);
  return Math.min(PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS, remaining);
}

/** True when user must pick a 60s segment before upload (strictly longer than max clip). */
export function productionBackgroundVideoNeedsClipEdit(durationSec: number): boolean {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  return durationSec > PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS + 0.05;
}

function readVideoDurationSec(video: HTMLVideoElement): number | null {
  const raw = video.duration;
  if (Number.isFinite(raw) && raw > 0) return raw;
  if (video.seekable.length > 0) {
    const end = video.seekable.end(video.seekable.length - 1);
    if (Number.isFinite(end) && end > 0) return end;
  }
  return null;
}

async function probeVideoDurationSecWithSeekFallback(video: HTMLVideoElement): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Could not read video duration.'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onErr);
    try {
      video.currentTime = Number.MAX_SAFE_INTEGER;
    } catch {
      cleanup();
      reject(new Error('Could not read video duration.'));
    }
  });

  const afterSeek = readVideoDurationSec(video) ?? video.currentTime;
  if (!Number.isFinite(afterSeek) || afterSeek <= 0) {
    throw new Error('Invalid video duration.');
  }
  return afterSeek;
}

/** Large local uploads often have wrong short metadata — seek to end before trusting ≤60s. */
export async function probeProductionBackgroundVideoDurationSec(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        const durationSec = readVideoDurationSec(video);
        if (durationSec != null) {
          settled = true;
          cleanup();
          resolve();
        }
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Could not read video metadata.'));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', finish);
        video.removeEventListener('durationchange', finish);
        video.removeEventListener('loadeddata', finish);
        video.removeEventListener('error', fail);
        window.clearTimeout(timer);
      };
      video.addEventListener('loadedmetadata', finish);
      video.addEventListener('durationchange', finish);
      video.addEventListener('loadeddata', finish);
      video.addEventListener('error', fail);
      const timer = window.setTimeout(() => {
        if (readVideoDurationSec(video) != null) finish();
        else fail();
      }, 8000);
    });

    const metadataDuration = readVideoDurationSec(video);
    if (metadataDuration != null && productionBackgroundVideoNeedsClipEdit(metadataDuration)) {
      return metadataDuration;
    }

    const seekDuration = await probeVideoDurationSecWithSeekFallback(video);
    if (metadataDuration != null) {
      return Math.max(metadataDuration, seekDuration);
    }
    return seekDuration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type StandardizedProductionBackgroundVideo = {
  file: File;
  /** Trim start applied during export (seconds in the original upload). */
  sourceStartSec: number;
  /** Exported clip duration (≤ 60s). */
  durationSec: number;
};

function buildClipFileName(sourceName: string): string {
  const baseName = sourceName.replace(/\.[^.]+$/, '') || 'background';
  return `${baseName}-clip.mp4`;
}

function blobToOutputFile(blob: Blob, sourceName: string): File {
  return new File([blob], buildClipFileName(sourceName), {
    type: 'video/mp4',
    lastModified: Date.now(),
  });
}

function canPassthroughMp4WithoutProcessing(args: {
  file: File;
  sourceStartSec: number;
  clipSec: number;
  sourceDurationSec: number;
}): boolean {
  if (!fileLooksLikeMp4Container(args.file)) return false;
  if (args.file.size > IPFS_VIDEO_RAW_MAX_BYTES) return false;
  if (args.sourceStartSec !== 0) return false;
  return args.clipSec >= args.sourceDurationSec - 0.05;
}

async function readFfmpegOutputBlob(ffmpeg: FFmpeg, outputName: string): Promise<Blob> {
  const data = await ffmpeg.readFile(outputName);
  const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  return new Blob([bytes], { type: 'video/mp4' });
}

async function tryFfmpegStreamCopyTrim(args: {
  ffmpeg: FFmpeg;
  file: File;
  sourceStartSec: number;
  clipSec: number;
  onStatus?: (message: string) => void;
  onConvertProgress?: (ratio: number) => void;
}): Promise<Blob | null> {
  if (!fileLooksLikeMp4Container(args.file)) return null;

  args.onStatus?.('Trimming video (no re-encode)…');
  args.onConvertProgress?.(0);

  const extMatch = args.file.name.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  const inputName = `input.${ext}`;
  const outputName = 'output-copy.mp4';

  await args.ffmpeg.writeFile(inputName, await fetchFile(args.file));

  const exitCode = await args.ffmpeg.exec([
    '-ss',
    String(args.sourceStartSec),
    '-i',
    inputName,
    '-t',
    String(args.clipSec),
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outputName,
  ]);

  args.onConvertProgress?.(1);
  if (exitCode !== 0) {
    await args.ffmpeg.deleteFile(inputName).catch(() => undefined);
    await args.ffmpeg.deleteFile(outputName).catch(() => undefined);
    return null;
  }

  const blob = await readFfmpegOutputBlob(args.ffmpeg, outputName);
  await args.ffmpeg.deleteFile(inputName).catch(() => undefined);
  await args.ffmpeg.deleteFile(outputName).catch(() => undefined);

  if (blob.size > IPFS_VIDEO_RAW_MAX_BYTES) return null;
  return blob;
}

async function mergeAudioWithFfmpeg(args: {
  ffmpeg: FFmpeg;
  videoOnlyBlob: Blob;
  sourceFile: File;
  sourceStartSec: number;
  clipSec: number;
  onStatus?: (message: string) => void;
}): Promise<Blob> {
  args.onStatus?.('Adding audio track…');
  const extMatch = args.sourceFile.name.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  const inputName = `source.${ext}`;
  const videoName = 'video-only.mp4';
  const outputName = 'output-with-audio.mp4';

  await args.ffmpeg.writeFile(videoName, await fetchFile(args.videoOnlyBlob));
  await args.ffmpeg.writeFile(inputName, await fetchFile(args.sourceFile));

  const exitCode = await args.ffmpeg.exec([
    '-i',
    videoName,
    '-ss',
    String(args.sourceStartSec),
    '-i',
    inputName,
    '-t',
    String(args.clipSec),
    '-map',
    '0:v:0',
    '-map',
    '1:a:0?',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-shortest',
    '-movflags',
    '+faststart',
    outputName,
  ]);

  await args.ffmpeg.deleteFile(videoName).catch(() => undefined);
  await args.ffmpeg.deleteFile(inputName).catch(() => undefined);

  if (exitCode !== 0) {
    await args.ffmpeg.deleteFile(outputName).catch(() => undefined);
    return args.videoOnlyBlob;
  }

  const blob = await readFfmpegOutputBlob(args.ffmpeg, outputName);
  await args.ffmpeg.deleteFile(outputName).catch(() => undefined);
  return blob.size <= IPFS_VIDEO_RAW_MAX_BYTES ? blob : args.videoOnlyBlob;
}

async function tryWebCodecsEncode(args: {
  file: File;
  sourceStartSec: number;
  clipSec: number;
  onStatus?: (message: string) => void;
  onConvertProgress?: (ratio: number) => void;
}): Promise<Blob | null> {
  if (!isWebCodecsProductionVideoEncodeSupported()) return null;

  args.onStatus?.('Encoding with hardware accelerator…');
  args.onConvertProgress?.(0);

  try {
    let videoOnly = await encodeProductionBackgroundVideoWebCodecs({
      file: args.file,
      startSec: args.sourceStartSec,
      clipSec: args.clipSec,
      maxWidth: WEBCODECS_MAX_WIDTH,
      onProgress: (ratio) => args.onConvertProgress?.(ratio),
    });

    if (videoOnly.size > IPFS_VIDEO_RAW_MAX_BYTES) return null;

    if (fileLooksLikeMp4Container(args.file)) {
      if (shouldUseProductionBackgroundVideoFfmpegWorker()) {
        videoOnly = await ffmpegWorkerMergeAudio({
          sourceFile: args.file,
          videoOnlyBlob: videoOnly,
          sourceStartSec: args.sourceStartSec,
          clipSec: args.clipSec,
          onStatus: args.onStatus,
        });
      } else {
        const ffmpeg = await loadFfmpeg(args.onStatus);
        videoOnly = await mergeAudioWithFfmpeg({
          ffmpeg,
          videoOnlyBlob: videoOnly,
          sourceFile: args.file,
          sourceStartSec: args.sourceStartSec,
          clipSec: args.clipSec,
          onStatus: args.onStatus,
        });
      }
    }

    args.onConvertProgress?.(1);
    if (videoOnly.size > IPFS_VIDEO_RAW_MAX_BYTES) return null;
    return videoOnly;
  } catch {
    return null;
  }
}

async function ffmpegTranscodeFallback(args: {
  ffmpeg: FFmpeg;
  file: File;
  sourceStartSec: number;
  clipSec: number;
  onStatus?: (message: string) => void;
  onConvertProgress?: (ratio: number) => void;
}): Promise<Blob> {
  const extMatch = args.file.name.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  const inputName = `input.${ext}`;
  const outputName = 'output.mp4';

  await args.ffmpeg.writeFile(inputName, await fetchFile(args.file));
  args.onStatus?.('Reading source video…');
  args.onConvertProgress?.(0);

  let blob: Blob | null = null;
  for (let i = 0; i < FFMPEG_ENCODE_ATTEMPTS.length; i += 1) {
    const { crf, maxWidth } = FFMPEG_ENCODE_ATTEMPTS[i];
    const workflowMessage =
      i === 0
        ? `Converting to MP4 (max ${PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS}s)…`
        : 'Optimizing video for upload…';
    args.onStatus?.(workflowMessage);
    args.onConvertProgress?.(0);

    const onFfmpegProgress = ({ progress }: { progress?: number }) => {
      if (args.onConvertProgress && Number.isFinite(progress)) {
        args.onConvertProgress(Math.min(1, Math.max(0, progress as number)));
      }
    };
    args.ffmpeg.on('progress', onFfmpegProgress);

    let exitCode: number;
    try {
      exitCode = await args.ffmpeg.exec([
        '-ss',
        String(args.sourceStartSec),
        '-i',
        inputName,
        '-t',
        String(args.clipSec),
        '-vf',
        `scale='min(${maxWidth},iw)':-2`,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-crf',
        String(crf),
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-pix_fmt',
        'yuv420p',
        outputName,
      ]);
    } finally {
      args.ffmpeg.off('progress', onFfmpegProgress);
    }

    args.onConvertProgress?.(1);
    if (exitCode !== 0) {
      throw new Error('Video conversion failed. Try a shorter clip or a different file.');
    }

    const candidate = await readFfmpegOutputBlob(args.ffmpeg, outputName);
    if (candidate.size <= IPFS_VIDEO_RAW_MAX_BYTES) {
      blob = candidate;
      break;
    }
    await args.ffmpeg.deleteFile(outputName).catch(() => undefined);
  }

  await args.ffmpeg.deleteFile(inputName).catch(() => undefined);
  await args.ffmpeg.deleteFile(outputName).catch(() => undefined);

  if (!blob) {
    throw new Error(
      `Could not prepare this clip. Keep the exported segment within ${PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS} seconds and try again.`
    );
  }
  return blob;
}

/**
 * Standardize to H.264/AAC MP4, extract up to 60s from `startSec`, max width 1280px.
 * Uses passthrough → stream copy → WebCodecs worker → ffmpeg.wasm fallback.
 */
export async function standardizeProductionBackgroundVideo(args: {
  file: File;
  startSec: number;
  /** Skip re-probe when caller already measured duration. */
  sourceDurationSec?: number;
  onStatus?: (message: string) => void;
  /** Encode progress within the current attempt (0–1). */
  onConvertProgress?: (ratio: number) => void;
}): Promise<StandardizedProductionBackgroundVideo> {
  const sourceDurationSec =
    args.sourceDurationSec != null && Number.isFinite(args.sourceDurationSec) && args.sourceDurationSec > 0
      ? args.sourceDurationSec
      : await probeProductionBackgroundVideoDurationSec(args.file);

  const sourceStartSec = clampProductionVideoStartSec(args.startSec, sourceDurationSec);
  const clipSec = productionVideoClipDurationSec(sourceStartSec, sourceDurationSec);
  if (clipSec < 0.25) {
    throw new Error('Selected clip is too short. Pick an earlier start time.');
  }

  if (
    canPassthroughMp4WithoutProcessing({
      file: args.file,
      sourceStartSec,
      clipSec,
      sourceDurationSec,
    })
  ) {
    args.onStatus?.('Video ready (no conversion needed).');
    args.onConvertProgress?.(1);
    return {
      file: args.file,
      sourceStartSec,
      durationSec: clipSec,
    };
  }

  if (shouldUseProductionBackgroundVideoFfmpegWorker()) {
    const copyBlob = await ffmpegWorkerStreamCopyTrim({
      file: args.file,
      sourceStartSec,
      clipSec,
      onStatus: args.onStatus,
      onProgress: args.onConvertProgress,
    }).catch(() => null);

    if (copyBlob) {
      return {
        file: blobToOutputFile(copyBlob, args.file.name),
        sourceStartSec,
        durationSec: clipSec,
      };
    }

    const webCodecsBlob = await tryWebCodecsEncode({
      file: args.file,
      sourceStartSec,
      clipSec,
      onStatus: args.onStatus,
      onConvertProgress: args.onConvertProgress,
    });

    if (webCodecsBlob) {
      return {
        file: blobToOutputFile(webCodecsBlob, args.file.name),
        sourceStartSec,
        durationSec: clipSec,
      };
    }

    const transcodeBlob = await ffmpegWorkerTranscode({
      file: args.file,
      sourceStartSec,
      clipSec,
      onStatus: args.onStatus,
      onProgress: args.onConvertProgress,
    });

    return {
      file: blobToOutputFile(transcodeBlob, args.file.name),
      sourceStartSec,
      durationSec: clipSec,
    };
  }

  return runWithFfmpegExclusive(async () => {
    const copyBlob = await tryFfmpegStreamCopyTrim({
      ffmpeg: await loadFfmpeg(args.onStatus),
      file: args.file,
      sourceStartSec,
      clipSec,
      onStatus: args.onStatus,
      onConvertProgress: args.onConvertProgress,
    }).catch(() => null);

    if (copyBlob) {
      return {
        file: blobToOutputFile(copyBlob, args.file.name),
        sourceStartSec,
        durationSec: clipSec,
      };
    }

    const webCodecsBlob = await tryWebCodecsEncode({
      file: args.file,
      sourceStartSec,
      clipSec,
      onStatus: args.onStatus,
      onConvertProgress: args.onConvertProgress,
    });

    if (webCodecsBlob) {
      return {
        file: blobToOutputFile(webCodecsBlob, args.file.name),
        sourceStartSec,
        durationSec: clipSec,
      };
    }

    const ffmpeg = await loadFfmpeg(args.onStatus);
    const transcodeBlob = await ffmpegTranscodeFallback({
      ffmpeg,
      file: args.file,
      sourceStartSec,
      clipSec,
      onStatus: args.onStatus,
      onConvertProgress: args.onConvertProgress,
    });

    return {
      file: blobToOutputFile(transcodeBlob, args.file.name),
      sourceStartSec,
      durationSec: clipSec,
    };
  });
}
