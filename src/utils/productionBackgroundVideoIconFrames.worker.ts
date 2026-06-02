/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { FFmpeg } from '@ffmpeg/ffmpeg';
type IconFramesWorkerExtractMessage = {
  type: 'extract';
  id: number;
  coreURL: string;
  wasmURL: string;
  fileName: string;
  fileBuffer: ArrayBuffer;
  count: number;
  durationSec: number;
  width: number;
  height: number;
  ffmpegQv: number;
};

type IconFramesWorkerInMessage = IconFramesWorkerExtractMessage;

type IconFramesWorkerThumbPayload = {
  timeSec: number;
  jpeg: Uint8Array;
};

let ffmpeg: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

const FFMPEG_LOAD_TIMEOUT_MS = 45_000;

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
        postStatus('Loading video processor…');
        const instance = new FFmpeg();
        await instance.load({ coreURL, wasmURL });
        ffmpeg = instance;
        return instance;
      })(),
      FFMPEG_LOAD_TIMEOUT_MS,
      'Video processor load timed out.'
    ).catch((err) => {
      ffmpegLoadPromise = null;
      throw err;
    });
  }
  return ffmpegLoadPromise;
}

async function readJpegOutput(instance: FFmpeg, outputName: string): Promise<Uint8Array> {
  const data = await instance.readFile(outputName);
  return data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
}

async function handleExtract(msg: IconFramesWorkerExtractMessage): Promise<void> {
  const count = Math.max(1, msg.count || 5);
  const width = msg.width > 0 ? msg.width : 480;
  const height = msg.height > 0 ? msg.height : 360;
  const ffmpegQv = msg.ffmpegQv > 0 ? msg.ffmpegQv : 3;
  const safeDuration = Math.max(0.25, msg.durationSec);

  postStatus('Extracting frames (background worker)…');
  const instance = await ensureFfmpeg(msg.coreURL, msg.wasmURL);

  const extMatch = msg.fileName.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  const inputName = `og-picker-input.${ext}`;

  await instance.writeFile(inputName, new Uint8Array(msg.fileBuffer));

  const scaleCrop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const thumbs: IconFramesWorkerThumbPayload[] = [];

  try {
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0 : (i / (count - 1)) * Math.max(0, safeDuration - 0.05);
      const outputName = `icon-picker-frame-${i}.jpg`;
      await instance.deleteFile(outputName).catch(() => undefined);

      const exitCode = await instance.exec([
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

      const jpeg = await readJpegOutput(instance, outputName);
      thumbs.push({ timeSec: t, jpeg });
      await instance.deleteFile(outputName).catch(() => undefined);
    }
  } finally {
    await instance.deleteFile(inputName).catch(() => undefined);
  }

  if (thumbs.length === 0) {
    postError(msg.id, 'Could not extract frames from this video.');
    return;
  }

  const transfers = thumbs.map((t) => t.jpeg.buffer);
  self.postMessage({ type: 'done', id: msg.id, thumbs }, transfers);
}

self.onmessage = (event: MessageEvent<IconFramesWorkerInMessage>) => {
  const msg = event.data;
  if (msg.type !== 'extract') return;
  void handleExtract(msg).catch((err) => {
    postError(msg.id, err instanceof Error ? err.message : 'Frame extraction failed.');
  });
};
