/** Minimal WebCodecs typings for TS 4.9 (full types ship in newer lib.dom). */
declare class VideoFrame {
  constructor(image: CanvasImageSource | OffscreenCanvas, init?: { timestamp?: number; duration?: number });
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly timestamp: number;
  readonly duration?: number;
  close(): void;
}

declare class EncodedVideoChunk {
  constructor(init: {
    type: 'key' | 'delta';
    timestamp: number;
    duration?: number;
    data: BufferSource;
  });
}

interface VideoDecoderConfig {
  codec: string;
  codedWidth?: number;
  codedHeight?: number;
  description?: BufferSource;
}

interface VideoDecoderInit {
  output: (frame: VideoFrame) => void;
  error: (error: DOMException) => void;
}

declare class VideoDecoder {
  constructor(init: VideoDecoderInit);
  configure(config: VideoDecoderConfig): void;
  decode(chunk: EncodedVideoChunk): void;
  flush(): Promise<void>;
  close(): void;
}

interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  latencyMode?: 'quality' | 'realtime';
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  avc?: { format: 'avc' | 'annexb' };
}

interface VideoEncoderInit {
  output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
  error: (error: DOMException) => void;
}

interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig;
  svc?: unknown;
  alphaSideData?: BufferSource;
}

interface VideoEncoderSupport {
  supported?: boolean;
  config?: VideoEncoderConfig;
}

declare class VideoEncoder {
  constructor(init: VideoEncoderInit);
  static isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport>;
  configure(config: VideoEncoderConfig): void;
  encode(frame: VideoFrame, options?: { keyFrame?: boolean }): void;
  flush(): Promise<void>;
  close(): void;
}
