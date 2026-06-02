import type { ProductionVideoFrameThumbnail } from './productionBackgroundVideo';
import { CATALOG_VIDEO_OG_THUMB_FFMPEG_QV } from './catalogProductionVideoOgConstants';
import {
  isProductionBackgroundVideoFfmpegWorkerSupported,
  resolveFfmpegCoreBlobUrlsForWorker,
} from './productionBackgroundVideoFfmpegWorker';

const PICKER_EXTRACT_JOB_TIMEOUT_MS = 90_000;

type PendingJob = {
  onStatus?: (message: string) => void;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

type WorkerOutMessage =
  | { type: 'status'; message: string }
  | { type: 'done'; id: number; kind: string; thumbs?: Array<{ timeSec: number; jpeg: Uint8Array }> }
  | { type: 'error'; id: number; message: string };

let pickerExtractWorker: Worker | null = null;
let pickerWorkerInitPromise: Promise<void> | null = null;
let nextJobId = 1;
const pendingJobs = new Map<number, PendingJob>();

function ensurePickerExtractWorker(): Worker {
  if (!pickerExtractWorker) {
    pickerExtractWorker = new Worker(
      new URL('./productionBackgroundVideoOgPickerExtract.worker.ts', import.meta.url),
      { type: 'module' }
    );
    pickerExtractWorker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'status') {
        for (const job of pendingJobs.values()) {
          job.onStatus?.(msg.message);
        }
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
    pickerExtractWorker.onerror = () => {
      for (const [id, pending] of pendingJobs) {
        pending.reject(new Error('Preview frame worker failed.'));
        pendingJobs.delete(id);
      }
    };
  }
  return pickerExtractWorker;
}

export function isProductionVideoOgPickerExtractWorkerSupported(): boolean {
  return isProductionBackgroundVideoFfmpegWorkerSupported();
}

async function postPickerExtractJob<T extends { kind: string }>(
  payload: Record<string, unknown> & { type: string },
  options: {
    timeoutMs?: number;
    onStatus?: (message: string) => void;
    transfer?: Transferable[];
    skipReadyCheck?: boolean;
  } = {}
): Promise<T> {
  if (!options.skipReadyCheck) {
    await ensureProductionVideoOgPickerExtractWorkerReady();
  }

  const id = nextJobId++;
  const worker = ensurePickerExtractWorker();

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingJobs.delete(id);
      reject(new Error('Preview frame extraction timed out.'));
    }, options.timeoutMs ?? PICKER_EXTRACT_JOB_TIMEOUT_MS);

    pendingJobs.set(id, {
      onStatus: options.onStatus,
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

/**
 * @deprecated Unused — a second ffmpeg.wasm instance hangs on 4K frame 1.
 * Catalog picker uses the main {@link productionBackgroundVideoFfmpegWorker} after transcode.
 */
export async function ensureProductionVideoOgPickerExtractWorkerReady(): Promise<void> {
  if (!isProductionVideoOgPickerExtractWorkerSupported()) {
    throw new Error('Web Workers are not available in this browser.');
  }
  if (pickerWorkerInitPromise) return pickerWorkerInitPromise;

  pickerWorkerInitPromise = (async () => {
    const { coreURL, wasmURL } = await resolveFfmpegCoreBlobUrlsForWorker();
    await postPickerExtractJob<{ kind: string }>(
      { type: 'init', coreURL, wasmURL },
      { timeoutMs: 60_000, skipReadyCheck: true }
    );
  })().catch((err) => {
    pickerWorkerInitPromise = null;
    throw err;
  });

  return pickerWorkerInitPromise;
}

export async function extractProductionVideoOgPickerFramesInDedicatedWorker(args: {
  file: File;
  count: number;
  durationSec: number;
  width: number;
  height: number;
  ffmpegQv?: number;
  onStatus?: (message: string) => void;
}): Promise<ProductionVideoFrameThumbnail[]> {
  const fileBuffer = await args.file.arrayBuffer();
  const durationSec =
    Number.isFinite(args.durationSec) && args.durationSec > 0 ? args.durationSec : 60;

  const done = await postPickerExtractJob<{
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
  for (const thumb of done.thumbs) {
    const dataUrl = await blobToDataUrl(new Blob([new Uint8Array(thumb.jpeg)], { type: 'image/jpeg' }));
    rows.push({ timeSec: thumb.timeSec, dataUrl });
  }
  return rows;
}
