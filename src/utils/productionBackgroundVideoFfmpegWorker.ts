import { toBlobURL } from '@ffmpeg/util';
import type { ProductionVideoFrameThumbnail } from './productionBackgroundVideo';
import { CATALOG_VIDEO_OG_THUMB_FFMPEG_QV } from './catalogProductionVideoOgConstants';

const FFMPEG_WORKER_JOB_TIMEOUT_MS = 180_000;

type PendingJob = {
  onStatus?: (message: string) => void;
  onProgress?: (ratio: number) => void;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

type WorkerOutMessage =
  | { type: 'status'; message: string }
  | { type: 'progress'; id: number; ratio: number }
  | { type: 'done'; id: number; kind: string; thumbs?: Array<{ timeSec: number; jpeg: Uint8Array }>; mp4?: Uint8Array | null }
  | { type: 'error'; id: number; message: string };

function ffmpegCorePublicBase(): string {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/ffmpeg`;
}

let ffmpegCoreBlobUrlsPromise: Promise<{ coreURL: string; wasmURL: string }> | null = null;
let sharedWorker: Worker | null = null;
let workerInitPromise: Promise<void> | null = null;
let nextJobId = 1;
const pendingJobs = new Map<number, PendingJob>();

export function isProductionBackgroundVideoFfmpegWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

/** @deprecated Use {@link isProductionBackgroundVideoFfmpegWorkerSupported}. */
export const isProductionVideoIconFrameWorkerSupported = isProductionBackgroundVideoFfmpegWorkerSupported;

export async function resolveFfmpegCoreBlobUrlsForWorker(): Promise<{ coreURL: string; wasmURL: string }> {
  if (!ffmpegCoreBlobUrlsPromise) {
    ffmpegCoreBlobUrlsPromise = (async () => {
      const coreBase = ffmpegCorePublicBase();
      return {
        coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
      };
    })();
  }
  return ffmpegCoreBlobUrlsPromise;
}

function ensureSharedWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('./productionBackgroundVideoFfmpeg.worker.ts', import.meta.url),
      { type: 'module' }
    );
    sharedWorker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'status') {
        for (const job of pendingJobs.values()) {
          job.onStatus?.(msg.message);
        }
        return;
      }
      if (msg.type === 'progress') {
        pendingJobs.get(msg.id)?.onProgress?.(msg.ratio);
        return;
      }
      const pending = pendingJobs.get(msg.id);
      if (!pending) return;

      if (msg.type === 'error') {
        pendingJobs.delete(msg.id);
        pending.reject(new Error(msg.message));
        return;
      }

      if (msg.type === 'done') {
        pendingJobs.delete(msg.id);
        pending.resolve(msg);
      }
    };
    sharedWorker.onerror = () => {
      for (const [id, pending] of pendingJobs) {
        pending.reject(new Error('Video processor worker failed.'));
        pendingJobs.delete(id);
      }
    };
  }
  return sharedWorker;
}

export async function ensureProductionBackgroundVideoFfmpegWorkerReady(): Promise<void> {
  if (!isProductionBackgroundVideoFfmpegWorkerSupported()) {
    throw new Error('Web Workers are not available in this browser.');
  }
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    const { coreURL, wasmURL } = await resolveFfmpegCoreBlobUrlsForWorker();
    await postFfmpegWorkerJob<{ kind: string }>(
      { type: 'init', coreURL, wasmURL },
      { timeoutMs: 60_000, skipReadyCheck: true }
    );
  })().catch((err) => {
    workerInitPromise = null;
    throw err;
  });

  return workerInitPromise;
}

/** Preload wasm in the persistent worker (single ffmpeg.wasm instance). */
export function preloadProductionBackgroundVideoFfmpegWorker(): void {
  if (!isProductionBackgroundVideoFfmpegWorkerSupported()) return;
  void ensureProductionBackgroundVideoFfmpegWorkerReady().catch(() => undefined);
}

/** @deprecated Use {@link preloadProductionBackgroundVideoFfmpegWorker}. */
export const preloadProductionBackgroundVideoIconFrameWorker = preloadProductionBackgroundVideoFfmpegWorker;

async function postFfmpegWorkerJob<T extends { kind: string }>(
  payload: Record<string, unknown> & { type: string },
  options: {
    timeoutMs?: number;
    onStatus?: (message: string) => void;
    onProgress?: (ratio: number) => void;
    transfer?: Transferable[];
    skipReadyCheck?: boolean;
  } = {}
): Promise<T> {
  if (!options.skipReadyCheck) {
    await ensureProductionBackgroundVideoFfmpegWorkerReady();
  }

  const id = nextJobId++;
  const worker = ensureSharedWorker();

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingJobs.delete(id);
      reject(new Error('Video processor job timed out.'));
    }, options.timeoutMs ?? FFMPEG_WORKER_JOB_TIMEOUT_MS);

    pendingJobs.set(id, {
      onStatus: options.onStatus,
      onProgress: options.onProgress,
      resolve: (value) => {
        window.clearTimeout(timer);
        resolve(value as T);
      },
      reject: (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    });

    worker.postMessage({ ...payload, id }, options.transfer ?? []);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read frame.'));
    reader.readAsDataURL(blob);
  });
}

export async function extractProductionVideoOgFrameThumbnailsInWorker(args: {
  file: File;
  count: number;
  durationSec: number;
  width: number;
  height: number;
  ffmpegQv?: number;
  onStatus?: (message: string) => void;
  onFrame?: (frame: ProductionVideoFrameThumbnail, index: number, total: number) => void;
}): Promise<ProductionVideoFrameThumbnail[]> {
  const fileBuffer = await args.file.arrayBuffer();
  const durationSec =
    Number.isFinite(args.durationSec) && args.durationSec > 0 ? args.durationSec : 60;

  const done = await postFfmpegWorkerJob<{
    kind: string;
    thumbs: Array<{ timeSec: number; jpeg: Uint8Array }>;
  }>(
    {
      type: 'extractFrames',
      fileName: args.file.name || 'video.mp4',
      fileBuffer,
      count: args.count,
      durationSec,
      width: args.width,
      height: args.height,
      ffmpegQv: args.ffmpegQv ?? CATALOG_VIDEO_OG_THUMB_FFMPEG_QV,
    },
    { onStatus: args.onStatus, transfer: [fileBuffer] }
  );

  const rows: ProductionVideoFrameThumbnail[] = [];
  const total = Math.max(1, args.count);
  for (let i = 0; i < done.thumbs.length; i += 1) {
    const thumb = done.thumbs[i];
    const dataUrl = await blobToDataUrl(new Blob([new Uint8Array(thumb.jpeg)], { type: 'image/jpeg' }));
    const frame = { timeSec: thumb.timeSec, dataUrl };
    rows.push(frame);
    args.onFrame?.(frame, i, total);
  }
  return rows;
}

/** @deprecated Use {@link extractProductionVideoOgFrameThumbnailsInWorker}. */
export const extractProductionVideoIconFrameThumbnailsInWorker = extractProductionVideoOgFrameThumbnailsInWorker;

export async function ffmpegWorkerStreamCopyTrim(args: {
  file: File;
  sourceStartSec: number;
  clipSec: number;
  onStatus?: (message: string) => void;
  onProgress?: (ratio: number) => void;
}): Promise<Blob | null> {
  const fileBuffer = await args.file.arrayBuffer();
  const done = await postFfmpegWorkerJob<{ kind: string; mp4: Uint8Array | null }>(
    {
      type: 'streamCopyTrim',
      fileName: args.file.name || 'video.mp4',
      fileBuffer,
      sourceStartSec: args.sourceStartSec,
      clipSec: args.clipSec,
    },
    {
      onStatus: args.onStatus,
      onProgress: args.onProgress,
      transfer: [fileBuffer],
    }
  );
  if (!done.mp4 || done.mp4.byteLength === 0) return null;
  return new Blob([new Uint8Array(done.mp4)], { type: 'video/mp4' });
}

export async function ffmpegWorkerTranscode(args: {
  file: File;
  sourceStartSec: number;
  clipSec: number;
  onStatus?: (message: string) => void;
  onProgress?: (ratio: number) => void;
}): Promise<Blob> {
  const fileBuffer = await args.file.arrayBuffer();
  const done = await postFfmpegWorkerJob<{ kind: string; mp4: Uint8Array }>(
    {
      type: 'transcode',
      fileName: args.file.name || 'video.mp4',
      fileBuffer,
      sourceStartSec: args.sourceStartSec,
      clipSec: args.clipSec,
    },
    {
      onStatus: args.onStatus,
      onProgress: args.onProgress,
      transfer: [fileBuffer],
    }
  );
  return new Blob([new Uint8Array(done.mp4)], { type: 'video/mp4' });
}

export async function ffmpegWorkerMergeAudio(args: {
  sourceFile: File;
  videoOnlyBlob: Blob;
  sourceStartSec: number;
  clipSec: number;
  onStatus?: (message: string) => void;
}): Promise<Blob> {
  const sourceBuffer = await args.sourceFile.arrayBuffer();
  const videoOnlyBuffer = await args.videoOnlyBlob.arrayBuffer();
  const done = await postFfmpegWorkerJob<{ kind: string; mp4: Uint8Array }>(
    {
      type: 'mergeAudio',
      fileName: args.sourceFile.name || 'video.mp4',
      sourceBuffer,
      videoOnlyBuffer,
      sourceStartSec: args.sourceStartSec,
      clipSec: args.clipSec,
    },
    {
      onStatus: args.onStatus,
      transfer: [sourceBuffer, videoOnlyBuffer],
    }
  );
  return new Blob([new Uint8Array(done.mp4)], { type: 'video/mp4' });
}

export async function extractProductionVideoFrameThumbnailsInFfmpegWorker(args: {
  file: File;
  count: number;
  durationSec: number;
  width: number;
  height: number;
  ffmpegQv?: number;
  onStatus?: (message: string) => void;
}): Promise<ProductionVideoFrameThumbnail[]> {
  return extractProductionVideoOgFrameThumbnailsInWorker(args);
}
