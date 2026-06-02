/** @deprecated Import from `productionBackgroundVideoFfmpegWorker.ts` — ffmpeg.wasm lives in one persistent worker. */
export {
  ensureProductionBackgroundVideoFfmpegWorkerReady,
  extractProductionVideoIconFrameThumbnailsInWorker,
  extractProductionVideoOgFrameThumbnailsInWorker,
  isProductionVideoIconFrameWorkerSupported,
  preloadProductionBackgroundVideoIconFrameWorker,
  resolveFfmpegCoreBlobUrlsForWorker,
} from './productionBackgroundVideoFfmpegWorker';
