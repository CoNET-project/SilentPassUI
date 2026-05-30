import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/** Max catalog background clip length after local standardization. */
export const PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS = 60;

/** Raw MP4 ceiling before base64 (~4/3) for fragment JSON limit (70mb). Internal encode target only. */
const IPFS_VIDEO_RAW_MAX_BYTES = 50 * 1024 * 1024;

const VIDEO_ENCODE_ATTEMPTS: ReadonlyArray<{ crf: number; maxWidth: number }> = [
  { crf: 28, maxWidth: 1280 },
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

/** Warm up ffmpeg.wasm while the user trims (same-origin core from public/ffmpeg). */
export function preloadProductionBackgroundVideoProcessor(onStatus?: (message: string) => void): void {
  void loadFfmpeg(onStatus).catch(() => undefined);
}

export function fileLooksLikeProductionBackgroundVideo(file: File): boolean {
  const mime = (file.type || '').trim().toLowerCase();
  if (mime.startsWith('video/')) return true;
  const name = file.name.toLowerCase();
  return /\.(mp4|webm|mov|m4v|ogv|mkv)$/.test(name);
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

/**
 * Transcode to H.264/AAC MP4, extract up to 60s from `startSec`, max width 1280px.
 */
export async function standardizeProductionBackgroundVideo(args: {
  file: File;
  startSec: number;
  onStatus?: (message: string) => void;
  /** FFmpeg encode progress within the current attempt (0–1). */
  onConvertProgress?: (ratio: number) => void;
}): Promise<StandardizedProductionBackgroundVideo> {
  const sourceDurationSec = await probeProductionBackgroundVideoDurationSec(args.file);
  const sourceStartSec = clampProductionVideoStartSec(args.startSec, sourceDurationSec);
  const clipSec = productionVideoClipDurationSec(sourceStartSec, sourceDurationSec);
  if (clipSec < 0.25) {
    throw new Error('Selected clip is too short. Pick an earlier start time.');
  }

  const ffmpeg = await loadFfmpeg(args.onStatus);
  const extMatch = args.file.name.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  const inputName = `input.${ext}`;
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(args.file));
  args.onStatus?.('Reading source video…');
  args.onConvertProgress?.(0);

  let blob: Blob | null = null;
  for (let i = 0; i < VIDEO_ENCODE_ATTEMPTS.length; i += 1) {
    const { crf, maxWidth } = VIDEO_ENCODE_ATTEMPTS[i];
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
    ffmpeg.on('progress', onFfmpegProgress);

    let exitCode: number;
    try {
      exitCode = await ffmpeg.exec([
        '-ss',
        String(sourceStartSec),
        '-i',
        inputName,
        '-t',
        String(clipSec),
        '-vf',
        `scale='min(${maxWidth},iw)':-2`,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
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
      ffmpeg.off('progress', onFfmpegProgress);
    }

    args.onConvertProgress?.(1);
    if (exitCode !== 0) {
      throw new Error('Video conversion failed. Try a shorter clip or a different file.');
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const candidate = new Blob([bytes], { type: 'video/mp4' });
    if (candidate.size <= IPFS_VIDEO_RAW_MAX_BYTES) {
      blob = candidate;
      break;
    }
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }

  if (!blob) {
    throw new Error(
      `Could not prepare this clip. Keep the exported segment within ${PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS} seconds and try again.`
    );
  }

  const baseName = args.file.name.replace(/\.[^.]+$/, '') || 'background';
  const outFile = new File([blob], `${baseName}-clip.mp4`, {
    type: 'video/mp4',
    lastModified: Date.now(),
  });

  await ffmpeg.deleteFile(inputName).catch(() => undefined);
  await ffmpeg.deleteFile(outputName).catch(() => undefined);

  return {
    file: outFile,
    sourceStartSec,
    durationSec: clipSec,
  };
}
