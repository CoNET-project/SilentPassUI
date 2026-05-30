import { createFile, MP4BoxBuffer, type Sample, type Track } from 'mp4box';
import type { ProductionBackgroundVideoWorkerOutMessage } from './productionBackgroundVideoWebCodecs.worker';

const WEBCODECS_TARGET_FPS = 24;
export const WEBCODECS_MAX_WIDTH = 1280;

export function isWebCodecsProductionVideoEncodeSupported(): boolean {
  const g = globalThis as Record<string, unknown>;
  return (
    typeof g.VideoEncoder !== 'undefined' &&
    typeof g.VideoFrame !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof g.OffscreenCanvas !== 'undefined'
  );
}

function waitVideoEvent(video: HTMLVideoElement, event: 'loadedmetadata' | 'seeked'): Promise<void> {
  if (event === 'loadedmetadata' && video.readyState >= 1) return Promise.resolve();
  if (event === 'seeked' && !video.seeking) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Video frame extraction failed.'));
    };
    const cleanup = () => {
      video.removeEventListener(event, onOk);
      video.removeEventListener('error', onErr);
    };
    video.addEventListener(event, onOk);
    video.addEventListener('error', onErr);
  });
}

function evenDimension(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function scaledVideoDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number
): { width: number; height: number } {
  if (sourceWidth <= maxWidth) {
    return { width: evenDimension(sourceWidth), height: evenDimension(sourceHeight) };
  }
  const scale = maxWidth / sourceWidth;
  return {
    width: evenDimension(maxWidth),
    height: evenDimension(sourceHeight * scale),
  };
}

function scaleFrameForEncode(frame: VideoFrame, maxWidth: number): VideoFrame {
  const { width, height } = scaledVideoDimensions(
    frame.displayWidth,
    frame.displayHeight,
    maxWidth
  );
  if (width === frame.displayWidth && height === frame.displayHeight) return frame;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  if (!ctx) {
    frame.close();
    throw new Error('Could not scale video frame.');
  }
  ctx.drawImage(frame as unknown as CanvasImageSource, 0, 0, width, height);
  const scaled = new VideoFrame(canvas, {
    timestamp: frame.timestamp,
    duration: frame.duration ?? undefined,
  });
  frame.close();
  return scaled;
}

function sampleTimeUs(sample: Sample): number {
  return Math.round((sample.cts / sample.timescale) * 1_000_000);
}

function sampleDurationUs(sample: Sample): number {
  return Math.round((sample.duration / sample.timescale) * 1_000_000);
}

function getDecoderDescription(track: Track, sample: Sample): Uint8Array | undefined {
  const description = sample.description ?? track;
  const record = description as { avcC?: { data?: Uint8Array }; hvcC?: { data?: Uint8Array } };
  if (record.avcC?.data) return record.avcC.data;
  if (record.hvcC?.data) return record.hvcC.data;
  return undefined;
}

function isH264OrHevcCodec(codec: string): boolean {
  const normalized = codec.trim().toLowerCase();
  return normalized.startsWith('avc1') || normalized.startsWith('hvc1') || normalized.startsWith('hev1');
}

function fileLooksLikeMp4Container(file: File): boolean {
  const mime = (file.type || '').trim().toLowerCase();
  if (mime === 'video/mp4' || mime === 'video/quicktime') return true;
  return /\.(mp4|m4v|mov)$/i.test(file.name);
}

async function probeVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.src = url;
  try {
    await waitVideoEvent(video, 'loadedmetadata');
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error('Could not read video dimensions.');
    }
    return { width: video.videoWidth, height: video.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function postFrameToWorker(
  worker: Worker,
  frame: VideoFrame,
  totalFrames: number
): void {
  worker.postMessage({ type: 'frame', frame, totalFrames }, [frame as unknown as Transferable]);
}

async function decodeMp4SamplesToWorker(args: {
  file: File;
  startSec: number;
  clipSec: number;
  maxWidth: number;
  worker: Worker;
  onProgress?: (ratio: number) => void;
}): Promise<void> {
  const buffer = await args.file.arrayBuffer();
  const startUs = Math.round(args.startSec * 1_000_000);
  const endUs = Math.round((args.startSec + args.clipSec) * 1_000_000);
  const totalFramesEstimate = Math.max(1, Math.ceil(args.clipSec * WEBCODECS_TARGET_FPS));

  await new Promise<void>((resolve, reject) => {
    const file = createFile();
    let track: Track | null = null;
    let decoder: VideoDecoder | null = null;
    let framesSent = 0;
    let decoderConfigured = false;
    let settled = false;

    const finishOk = async () => {
      if (settled) return;
      settled = true;
      try {
        if (decoder) {
          await decoder.flush();
          decoder.close();
        }
      } catch {
        /* ignore */
      }
      resolve();
    };

    const finishErr = (err: unknown) => {
      if (settled) return;
      settled = true;
      try {
        decoder?.close();
      } catch {
        /* ignore */
      }
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    file.onError = (_module, message) => finishErr(new Error(message));

    file.onReady = (info) => {
      track = info.videoTracks[0] ?? null;
      if (!track) {
        finishErr(new Error('No video track found.'));
        return;
      }
      if (!isH264OrHevcCodec(track.codec)) {
        finishErr(new Error('Unsupported video codec for WebCodecs.'));
        return;
      }
      file.setExtractionOptions(track.id, null, { nbSamples: 512 });
      file.start();
    };

    file.onSamples = (_id, _user, samples) => {
      if (!track || settled) return;
      for (const sample of samples) {
        const tsUs = sampleTimeUs(sample);
        if (tsUs + sampleDurationUs(sample) < startUs) continue;
        if (tsUs >= endUs) {
          file.stop();
          void finishOk();
          return;
        }

        if (!decoderConfigured) {
          const description = getDecoderDescription(track, sample);
          decoder = new VideoDecoder({
            output: (frame) => {
              const ts = frame.timestamp;
              if (ts < startUs || ts >= endUs) {
                frame.close();
                return;
              }
              const scaled = scaleFrameForEncode(frame, args.maxWidth);
              framesSent += 1;
              postFrameToWorker(args.worker, scaled, totalFramesEstimate);
              args.onProgress?.(Math.min(0.95, framesSent / totalFramesEstimate));
            },
            error: (err) => finishErr(err),
          });
          decoder.configure({
            codec: track.codec,
            codedWidth: track.video?.width ?? track.track_width,
            codedHeight: track.video?.height ?? track.track_height,
            description,
          });
          decoderConfigured = true;
        }

        if (!decoder || !sample.data) continue;
        decoder.decode(
          new EncodedVideoChunk({
            type: sample.is_sync ? 'key' : 'delta',
            timestamp: tsUs,
            duration: sampleDurationUs(sample),
            data: sample.data,
          })
        );

        if (track.nb_samples > 0 && sample.number >= track.nb_samples - 1) {
          file.stop();
          void finishOk();
          return;
        }
      }
    };

    const mp4Buffer = MP4BoxBuffer.fromArrayBuffer(buffer, 0);
    file.appendBuffer(mp4Buffer);
    file.flush();
  });
}

async function decodeViaVideoElementToWorker(args: {
  file: File;
  startSec: number;
  clipSec: number;
  maxWidth: number;
  worker: Worker;
  onProgress?: (ratio: number) => void;
}): Promise<void> {
  const url = URL.createObjectURL(args.file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    await waitVideoEvent(video, 'loadedmetadata');
    const frameStepSec = 1 / WEBCODECS_TARGET_FPS;
    const totalFrames = Math.max(1, Math.ceil(args.clipSec * WEBCODECS_TARGET_FPS));

    for (let i = 0; i < totalFrames; i += 1) {
      const t = args.startSec + i * frameStepSec;
      if (t >= args.startSec + args.clipSec) break;
      video.currentTime = t;
      await waitVideoEvent(video, 'seeked');
      const raw = new VideoFrame(video, { timestamp: Math.round(t * 1_000_000) });
      const scaled = scaleFrameForEncode(raw, args.maxWidth);
      postFrameToWorker(args.worker, scaled, totalFrames);
      args.onProgress?.((i + 1) / totalFrames);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

function createEncodeWorker(): Worker {
  return new Worker(new URL('./productionBackgroundVideoWebCodecs.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export async function encodeProductionBackgroundVideoWebCodecs(args: {
  file: File;
  startSec: number;
  clipSec: number;
  maxWidth?: number;
  onProgress?: (ratio: number) => void;
}): Promise<Blob> {
  if (!isWebCodecsProductionVideoEncodeSupported()) {
    throw new Error('WebCodecs is not supported in this browser.');
  }

  const maxWidth = args.maxWidth ?? WEBCODECS_MAX_WIDTH;
  const sourceDimensions = await probeVideoDimensions(args.file);
  const outputDimensions = scaledVideoDimensions(
    sourceDimensions.width,
    sourceDimensions.height,
    maxWidth
  );

  const supported = await VideoEncoder.isConfigSupported({
    codec: 'avc1.42001E',
    width: outputDimensions.width,
    height: outputDimensions.height,
    bitrate: 2_500_000,
    framerate: WEBCODECS_TARGET_FPS,
    avc: { format: 'avc' },
  });
  if (!supported.supported) {
    throw new Error('H.264 encoder is not supported in this browser.');
  }

  const worker = createEncodeWorker();

  return new Promise<Blob>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      worker.terminate();
    };

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const succeed = (buffer: ArrayBuffer) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(new Blob([buffer], { type: 'video/mp4' }));
    };

    worker.onmessage = (event: MessageEvent<ProductionBackgroundVideoWorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        args.onProgress?.(msg.ratio);
        return;
      }
      if (msg.type === 'done') {
        succeed(msg.buffer);
        return;
      }
      if (msg.type === 'error') {
        fail(new Error(msg.message));
      }
    };

    worker.onerror = (event) => {
      fail(new Error(event.message || 'Video encoder worker failed.'));
    };

    void (async () => {
      try {
        worker.postMessage({
          type: 'init',
          width: outputDimensions.width,
          height: outputDimensions.height,
          framerate: WEBCODECS_TARGET_FPS,
          bitrate: 2_500_000,
        });

        if (fileLooksLikeMp4Container(args.file)) {
          try {
            await decodeMp4SamplesToWorker({
              file: args.file,
              startSec: args.startSec,
              clipSec: args.clipSec,
              maxWidth,
              worker,
              onProgress: args.onProgress,
            });
          } catch {
            await decodeViaVideoElementToWorker({
              file: args.file,
              startSec: args.startSec,
              clipSec: args.clipSec,
              maxWidth,
              worker,
              onProgress: args.onProgress,
            });
          }
        } else {
          await decodeViaVideoElementToWorker({
            file: args.file,
            startSec: args.startSec,
            clipSec: args.clipSec,
            maxWidth,
            worker,
            onProgress: args.onProgress,
          });
        }

        worker.postMessage({ type: 'finish' });
      } catch (err) {
        fail(err);
      }
    })();
  });
}
