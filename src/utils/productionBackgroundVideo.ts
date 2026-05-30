import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/** Max catalog background clip length after local standardization. */
export const PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS = 60;

const FFMPEG_CORE_ST_BASE = 'https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/esm';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

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

export async function probeProductionBackgroundVideoDurationSec(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read video metadata.'));
    });
    const durationSec = video.duration;
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('Invalid video duration.');
    }
    return durationSec;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadFfmpeg(onStatus?: (message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      onStatus?.('Loading video processor…');
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_ST_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_ST_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }
  return ffmpegLoadPromise;
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
  args.onStatus?.('Converting to MP4 (max 60s)…');

  const exitCode = await ffmpeg.exec([
    '-ss',
    String(sourceStartSec),
    '-i',
    inputName,
    '-t',
    String(clipSec),
    '-vf',
    "scale='min(1280,iw)':-2",
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '28',
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
  if (exitCode !== 0) {
    throw new Error('Video conversion failed. Try a shorter clip or a different file.');
  }

  const data = await ffmpeg.readFile(outputName);
  const bytes =
    data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
  const blob = new Blob([bytes], { type: 'video/mp4' });
  if (blob.size > 37 * 1024 * 1024) {
    throw new Error('Converted video is too large. Use a shorter clip.');
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
