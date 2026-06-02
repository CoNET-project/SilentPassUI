/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
/**
 * Dedicated ffmpeg worker for catalog preview frame picker only.
 * Runs in parallel with {@link productionBackgroundVideoFfmpeg.worker.ts} (transcode)
 * so 4K uploads do not queue picker extract behind encode.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';

const FFMPEG_LOAD_TIMEOUT_MS = 45_000;

type WorkerInitMessage = {
  type: 'init';
  id: number;
  coreURL: string;
  wasmURL: string;
};

type WorkerExtractFramesMessage = {
  type: 'extractFrames';
  id: number;
  fileName: string;
  fileBuffer: ArrayBuffer;
  count: number;
  durationSec: number;
  width: number;
  height: number;
  ffmpegQv: number;
};

type WorkerInMessage = WorkerInitMessage | WorkerExtractFramesMessage;

type FrameThumbPayload = { timeSec: number; jpeg: Uint8Array };

let ffmpeg: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;
let jobChain: Promise<void> = Promise.resolve();

function postError(id: number, message: string): void {
  self.postMessage({ type: 'error', id, message });
}

function postStatus(message: string): void {
  self.postMessage({ type: 'status', message });
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    void work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function ensureFfmpeg(coreURL: string, wasmURL: string): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = withTimeout(
      (async () => {
        postStatus('Loading preview frame processor…');
        const instance = new FFmpeg();
        await instance.load({ coreURL, wasmURL });
        ffmpeg = instance;
        return instance;
      })(),
      FFMPEG_LOAD_TIMEOUT_MS,
      'Preview frame processor load timed out.'
    ).catch((err) => {
      ffmpegLoadPromise = null;
      throw err;
    });
  }
  return ffmpegLoadPromise;
}

async function readFileBytes(instance: FFmpeg, outputName: string): Promise<Uint8Array> {
  const data = await instance.readFile(outputName);
  return data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
}

function fileExt(fileName: string): string {
  const extMatch = fileName.match(/\.([a-z0-9]+)$/i);
  return extMatch?.[1]?.toLowerCase() || 'mp4';
}

async function handleInit(msg: WorkerInitMessage): Promise<void> {
  await ensureFfmpeg(msg.coreURL, msg.wasmURL);
  self.postMessage({ type: 'done', id: msg.id, kind: 'init' });
}

async function handleExtractFrames(msg: WorkerExtractFramesMessage): Promise<void> {
  const count = Math.max(1, msg.count || 5);
  const width = msg.width > 0 ? msg.width : 480;
  const height = msg.height > 0 ? msg.height : 360;
  const ffmpegQv = msg.ffmpegQv > 0 ? msg.ffmpegQv : 3;
  const safeDuration = Math.max(0.25, msg.durationSec);

  postStatus('Extracting preview frames…');
  const instance = ffmpeg;
  if (!instance) {
    postError(msg.id, 'Preview frame processor is not ready.');
    return;
  }

  const ext = fileExt(msg.fileName);
  const inputName = `picker-${msg.id}-in.${ext}`;

  await instance.writeFile(inputName, new Uint8Array(msg.fileBuffer));

  const scaleCrop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const thumbs: FrameThumbPayload[] = [];

  const extractAtTimes = async (seekBeforeInput: boolean): Promise<void> => {
    for (let i = 0; i < count; i += 1) {
      postStatus(`Capturing preview frame ${i + 1} of ${count}…`);
      const t = count <= 1 ? 0 : (i / (count - 1)) * Math.max(0, safeDuration - 0.05);
      const outputName = `picker-${msg.id}-frame-${i}.jpg`;
      await instance.deleteFile(outputName).catch(() => undefined);

      const inputArgs = seekBeforeInput
        ? ['-ss', String(t), '-i', inputName]
        : ['-i', inputName, '-ss', String(t)];

      const exitCode = await instance.exec([
        ...inputArgs,
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

      const jpeg = await readFileBytes(instance, outputName);
      thumbs.push({ timeSec: t, jpeg });
      await instance.deleteFile(outputName).catch(() => undefined);
    }
  };

  try {
    await extractAtTimes(true);
    if (thumbs.length === 0) {
      postStatus('Retrying frame extract (accurate seek)…');
      await extractAtTimes(false);
    }
  } finally {
    await instance.deleteFile(inputName).catch(() => undefined);
  }

  if (thumbs.length === 0) {
    postError(msg.id, 'Could not extract frames from this video.');
    return;
  }

  const transfers = thumbs.map((t) => t.jpeg.buffer);
  self.postMessage({ type: 'done', id: msg.id, kind: 'extractFrames', thumbs }, transfers);
}

async function dispatch(msg: WorkerInMessage): Promise<void> {
  if (msg.type === 'init') {
    await handleInit(msg);
    return;
  }

  if (!ffmpeg) {
    postError(msg.id, 'Preview frame processor is not ready. Call init first.');
    return;
  }

  if (msg.type === 'extractFrames') {
    await handleExtractFrames(msg);
    return;
  }

  postError((msg as { id: number }).id, 'Unknown picker extract job.');
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  jobChain = jobChain
    .then(() => dispatch(msg))
    .catch((err) => {
      postError(msg.id, err instanceof Error ? err.message : 'Preview frame job failed.');
    });
};
