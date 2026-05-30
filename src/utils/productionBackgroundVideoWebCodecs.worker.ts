/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

type WorkerInitMessage = {
  type: 'init';
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
};

type WorkerFrameMessage = {
  type: 'frame';
  frame: VideoFrame;
};

type WorkerFinishMessage = {
  type: 'finish';
};

type WorkerInMessage = WorkerInitMessage | WorkerFrameMessage | WorkerFinishMessage;

let encoder: VideoEncoder | null = null;
let muxer: Muxer<ArrayBufferTarget> | null = null;
let target: ArrayBufferTarget | null = null;
let framesEncoded = 0;

function postError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  self.postMessage({ type: 'error', message });
}

function postProgress(ratio: number): void {
  self.postMessage({ type: 'progress', ratio: Math.min(1, Math.max(0, ratio)) });
}

async function handleInit(msg: WorkerInitMessage): Promise<void> {
  framesEncoded = 0;
  target = new ArrayBufferTarget();
  muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: msg.width,
      height: msg.height,
    },
    fastStart: 'in-memory',
  });

  encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer?.addVideoChunk(chunk, meta);
    },
    error: (err) => postError(err),
  });

  const config: VideoEncoderConfig = {
    codec: 'avc1.42001E',
    width: msg.width,
    height: msg.height,
    bitrate: msg.bitrate,
    framerate: msg.framerate,
    latencyMode: 'realtime',
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'avc' },
  };

  const supported = await VideoEncoder.isConfigSupported(config);
  if (!supported.supported) {
    throw new Error('H.264 hardware encoder is not available in this browser.');
  }
  encoder.configure(supported.config ?? config);
}

async function handleFinish(): Promise<void> {
  if (!encoder || !muxer || !target) {
    throw new Error('Video encoder was not initialized.');
  }
  await encoder.flush();
  encoder.close();
  encoder = null;
  muxer.finalize();
  muxer = null;
  const buffer = target.buffer;
  target = null;
  self.postMessage({ type: 'done', buffer, byteLength: buffer.byteLength }, [buffer]);
}

self.onmessage = async (event: MessageEvent<WorkerInMessage & { totalFrames?: number }>) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      await handleInit(msg);
      postProgress(0);
      return;
    }
    if (msg.type === 'frame') {
      if (!encoder) throw new Error('Video encoder was not initialized.');
      encoder.encode(msg.frame);
      msg.frame.close();
      framesEncoded += 1;
      if (event.data.type === 'frame' && typeof event.data.totalFrames === 'number') {
        const total = event.data.totalFrames;
        if (total > 0) postProgress(framesEncoded / total);
      }
      return;
    }
    if (msg.type === 'finish') {
      postProgress(1);
      await handleFinish();
    }
  } catch (err) {
    postError(err);
  }
};

export type ProductionBackgroundVideoWorkerOutMessage =
  | { type: 'progress'; ratio: number }
  | { type: 'done'; buffer: ArrayBuffer; byteLength: number }
  | { type: 'error'; message: string };
