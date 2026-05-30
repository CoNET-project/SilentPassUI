import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  encodeProductionBackgroundVideoWebCodecs,
  isWebCodecsProductionVideoEncodeSupported,
  WEBCODECS_MAX_WIDTH,
} from './productionBackgroundVideoWebCodecs';

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

/** Warm up ffmpeg.wasm (same-origin core from public/ffmpeg). Call on any video pick. */
export function preloadProductionBackgroundVideoProcessor(onStatus?: (message: string) => void): void {
  void loadFfmpeg(onStatus).catch(() => undefined);
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
}
