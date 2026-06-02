/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { FFmpeg } from '@ffmpeg/ffmpeg';

const FFMPEG_LOAD_TIMEOUT_MS = 45_000;
/** One-shot fps extract for catalog picker (avoids 5× slow 4K seeks). */
const FFMPEG_EXTRACT_BATCH_TIMEOUT_MS = 50_000;
const FFMPEG_EXTRACT_FRAME_TIMEOUT_MS = 14_000;
const IPFS_VIDEO_RAW_MAX_BYTES = 50 * 1024 * 1024;

const FFMPEG_ENCODE_ATTEMPTS: ReadonlyArray<{ crf: number; maxWidth: number }> = [
  { crf: 32, maxWidth: 1280 },
  { crf: 35, maxWidth: 960 },
  { crf: 38, maxWidth: 720 },
];

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

type WorkerStreamCopyTrimMessage = {
  type: 'streamCopyTrim';
  id: number;
  fileName: string;
  fileBuffer: ArrayBuffer;
  sourceStartSec: number;
  clipSec: number;
};

type WorkerTranscodeMessage = {
  type: 'transcode';
  id: number;
  fileName: string;
  fileBuffer: ArrayBuffer;
  sourceStartSec: number;
  clipSec: number;
};

type WorkerMergeAudioMessage = {
  type: 'mergeAudio';
  id: number;
  fileName: string;
  sourceBuffer: ArrayBuffer;
  videoOnlyBuffer: ArrayBuffer;
  sourceStartSec: number;
  clipSec: number;
};

type WorkerInMessage =
  | WorkerInitMessage
  | WorkerExtractFramesMessage
  | WorkerStreamCopyTrimMessage
  | WorkerTranscodeMessage
  | WorkerMergeAudioMessage;

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

function postProgress(id: number, ratio: number): void {
  self.postMessage({ type: 'progress', id, ratio: Math.min(1, Math.max(0, ratio)) });
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

function frameTimeSec(count: number, index: number, safeDuration: number): number {
  if (count <= 1) return 0;
  return (index / (count - 1)) * Math.max(0, safeDuration - 0.05);
}

async function execFfmpegWithTimeout(
  instance: FFmpeg,
  args: string[],
  timeoutMs: number
): Promise<number> {
  return withTimeout(instance.exec(args), timeoutMs, 'Frame extract timed out.');
}

async function readExtractedFrameOutputs(
  instance: FFmpeg,
  msgId: number,
  count: number,
  safeDuration: number,
  namePrefix: string
): Promise<FrameThumbPayload[]> {
  const thumbs: FrameThumbPayload[] = [];
  for (let i = 0; i < count; i += 1) {
    const outputName = `${namePrefix}-${i + 1}.jpg`;
    try {
      const jpeg = await readFileBytes(instance, outputName);
      thumbs.push({ timeSec: frameTimeSec(count, i, safeDuration), jpeg });
      await instance.deleteFile(outputName).catch(() => undefined);
    } catch {
      /* missing output */
    }
  }
  return thumbs;
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
    postError(msg.id, 'Video processor is not ready.');
    return;
  }

  const ext = fileExt(msg.fileName);
  const inputName = `job-${msg.id}-in.${ext}`;
  const batchPrefix = `job-${msg.id}-batch`;

  await instance.writeFile(inputName, new Uint8Array(msg.fileBuffer));

  const scaleCrop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  let thumbs: FrameThumbPayload[] = [];

  try {
    for (let i = 1; i <= count; i += 1) {
      await instance.deleteFile(`${batchPrefix}-${i}.jpg`).catch(() => undefined);
    }

    const fpsArg = count <= 1 ? '1' : `${count}/${safeDuration}`;
    const batchExit = await execFfmpegWithTimeout(
      instance,
      [
        '-i',
        inputName,
        '-an',
        '-sn',
        '-dn',
        '-vf',
        `${scaleCrop},fps=${fpsArg}`,
        '-frames:v',
        String(count),
        '-q:v',
        String(ffmpegQv),
        `${batchPrefix}-%d.jpg`,
      ],
      FFMPEG_EXTRACT_BATCH_TIMEOUT_MS
    );

    if (batchExit === 0) {
      thumbs = await readExtractedFrameOutputs(instance, msg.id, count, safeDuration, batchPrefix);
    }

    const extractAtTimes = async (seekBeforeInput: boolean): Promise<void> => {
      for (let i = 0; i < count; i += 1) {
        postStatus(`Capturing preview frame ${i + 1} of ${count}…`);
        const t = frameTimeSec(count, i, safeDuration);
        const outputName = `job-${msg.id}-frame-${i}.jpg`;
        await instance.deleteFile(outputName).catch(() => undefined);

        const inputArgs = seekBeforeInput
          ? ['-ss', String(t), '-i', inputName]
          : ['-i', inputName, '-ss', String(t)];

        const exitCode = await execFfmpegWithTimeout(
          instance,
          [
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
          ],
          FFMPEG_EXTRACT_FRAME_TIMEOUT_MS
        );

        if (exitCode !== 0) continue;

        const jpeg = await readFileBytes(instance, outputName);
        thumbs.push({ timeSec: t, jpeg });
        await instance.deleteFile(outputName).catch(() => undefined);
      }
    };

    if (thumbs.length < count) {
      thumbs = [];
      await extractAtTimes(true);
    }
    if (thumbs.length === 0) {
      postStatus('Retrying frame extract (accurate seek)…');
      await extractAtTimes(false);
    }
  } finally {
    await instance.deleteFile(inputName).catch(() => undefined);
    for (let i = 1; i <= count; i += 1) {
      await instance.deleteFile(`${batchPrefix}-${i}.jpg`).catch(() => undefined);
    }
  }

  if (thumbs.length === 0) {
    postError(msg.id, 'Could not extract frames from this video.');
    return;
  }

  const transfers = thumbs.map((t) => t.jpeg.buffer);
  self.postMessage({ type: 'done', id: msg.id, kind: 'extractFrames', thumbs }, transfers);
}

async function handleStreamCopyTrim(msg: WorkerStreamCopyTrimMessage): Promise<void> {
  const instance = ffmpeg;
  if (!instance) {
    postError(msg.id, 'Video processor is not ready.');
    return;
  }

  postStatus('Trimming video (no re-encode)…');
  postProgress(msg.id, 0);

  const ext = fileExt(msg.fileName);
  const inputName = `job-${msg.id}-in.${ext}`;
  const outputName = `job-${msg.id}-out.mp4`;

  await instance.writeFile(inputName, new Uint8Array(msg.fileBuffer));

  const exitCode = await instance.exec([
    '-ss',
    String(msg.sourceStartSec),
    '-i',
    inputName,
    '-t',
    String(msg.clipSec),
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outputName,
  ]);

  postProgress(msg.id, 1);

  if (exitCode !== 0) {
    await instance.deleteFile(inputName).catch(() => undefined);
    await instance.deleteFile(outputName).catch(() => undefined);
    self.postMessage({ type: 'done', id: msg.id, kind: 'streamCopyTrim', mp4: null });
    return;
  }

  const mp4 = await readFileBytes(instance, outputName);
  await instance.deleteFile(inputName).catch(() => undefined);
  await instance.deleteFile(outputName).catch(() => undefined);

  if (mp4.byteLength > IPFS_VIDEO_RAW_MAX_BYTES) {
    self.postMessage({ type: 'done', id: msg.id, kind: 'streamCopyTrim', mp4: null });
    return;
  }

  self.postMessage({ type: 'done', id: msg.id, kind: 'streamCopyTrim', mp4 }, [mp4.buffer]);
}

async function handleTranscode(msg: WorkerTranscodeMessage): Promise<void> {
  const instance = ffmpeg;
  if (!instance) {
    postError(msg.id, 'Video processor is not ready.');
    return;
  }

  const ext = fileExt(msg.fileName);
  const inputName = `job-${msg.id}-in.${ext}`;
  const outputName = `job-${msg.id}-out.mp4`;

  await instance.writeFile(inputName, new Uint8Array(msg.fileBuffer));
  postStatus('Reading source video…');
  postProgress(msg.id, 0);

  let result: Uint8Array | null = null;

  try {
    for (let i = 0; i < FFMPEG_ENCODE_ATTEMPTS.length; i += 1) {
      const { crf, maxWidth } = FFMPEG_ENCODE_ATTEMPTS[i];
      postStatus(
        i === 0 ? 'Converting to MP4 (max 60s)…' : 'Optimizing video for upload…'
      );
      postProgress(msg.id, 0);

      const onProgress = ({ progress }: { progress?: number }) => {
        if (Number.isFinite(progress)) {
          postProgress(msg.id, Math.min(1, Math.max(0, progress as number)));
        }
      };
      instance.on('progress', onProgress);

      let exitCode: number;
      try {
        exitCode = await instance.exec([
          '-ss',
          String(msg.sourceStartSec),
          '-i',
          inputName,
          '-t',
          String(msg.clipSec),
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
        instance.off('progress', onProgress);
      }

      postProgress(msg.id, 1);
      if (exitCode !== 0) {
        throw new Error('Video conversion failed. Try a shorter clip or a different file.');
      }

      const candidate = await readFileBytes(instance, outputName);
      if (candidate.byteLength <= IPFS_VIDEO_RAW_MAX_BYTES) {
        result = candidate;
        break;
      }
      await instance.deleteFile(outputName).catch(() => undefined);
    }
  } finally {
    await instance.deleteFile(inputName).catch(() => undefined);
    await instance.deleteFile(outputName).catch(() => undefined);
  }

  if (!result) {
    postError(
      msg.id,
      'Could not prepare this clip. Keep the exported segment within 60 seconds and try again.'
    );
    return;
  }

  self.postMessage({ type: 'done', id: msg.id, kind: 'transcode', mp4: result }, [result.buffer]);
}

async function handleMergeAudio(msg: WorkerMergeAudioMessage): Promise<void> {
  const instance = ffmpeg;
  if (!instance) {
    postError(msg.id, 'Video processor is not ready.');
    return;
  }

  postStatus('Adding audio track…');

  const ext = fileExt(msg.fileName);
  const inputName = `job-${msg.id}-src.${ext}`;
  const videoName = `job-${msg.id}-vid.mp4`;
  const outputName = `job-${msg.id}-out.mp4`;

  await instance.writeFile(videoName, new Uint8Array(msg.videoOnlyBuffer));
  await instance.writeFile(inputName, new Uint8Array(msg.sourceBuffer));

  const exitCode = await instance.exec([
    '-i',
    videoName,
    '-ss',
    String(msg.sourceStartSec),
    '-i',
    inputName,
    '-t',
    String(msg.clipSec),
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

  await instance.deleteFile(videoName).catch(() => undefined);
  await instance.deleteFile(inputName).catch(() => undefined);

  if (exitCode !== 0) {
    await instance.deleteFile(outputName).catch(() => undefined);
    self.postMessage({
      type: 'done',
      id: msg.id,
      kind: 'mergeAudio',
      mp4: new Uint8Array(msg.videoOnlyBuffer),
    }, [msg.videoOnlyBuffer]);
    return;
  }

  const mp4 = await readFileBytes(instance, outputName);
  await instance.deleteFile(outputName).catch(() => undefined);

  const out =
    mp4.byteLength <= IPFS_VIDEO_RAW_MAX_BYTES ? mp4 : new Uint8Array(msg.videoOnlyBuffer);
  self.postMessage({ type: 'done', id: msg.id, kind: 'mergeAudio', mp4: out }, [out.buffer]);
}

async function dispatch(msg: WorkerInMessage): Promise<void> {
  if (msg.type === 'init') {
    await handleInit(msg);
    return;
  }

  if (!ffmpeg) {
    postError(msg.id, 'Video processor is not ready. Call init first.');
    return;
  }

  switch (msg.type) {
    case 'extractFrames':
      await handleExtractFrames(msg);
      break;
    case 'streamCopyTrim':
      await handleStreamCopyTrim(msg);
      break;
    case 'transcode':
      await handleTranscode(msg);
      break;
    case 'mergeAudio':
      await handleMergeAudio(msg);
      break;
    default:
      postError((msg as { id: number }).id, 'Unknown worker job.');
  }
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;
  jobChain = jobChain
    .then(() => dispatch(msg))
    .catch((err) => {
      postError(msg.id, err instanceof Error ? err.message : 'Video processor job failed.');
    });
};
