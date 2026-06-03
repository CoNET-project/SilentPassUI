import {
  CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR,
  CATALOG_VIDEO_OG_BANNER_JPEG_QUALITY,
  CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_ATTR,
} from '@/utils/catalogProductionVideoOgConstants';

export type CouponStyleBannerFillMode = 'width' | 'height';

export type CatalogBannerPreviewSnapshot = {
  dataUrl: string;
  mode: CouponStyleBannerFillMode;
};

const COUPON_BANNER_BLUR_PX = 24;
/** Edge strip fraction sampled for ProgramsCouponBannerImage-style gutters. */
const COUPON_EDGE_STRIP_FRAC = 0.22;

export type CouponStyleBannerMediaSource = HTMLImageElement | HTMLVideoElement;

function sourcePixelSize(source: CouponStyleBannerMediaSource): { sw: number; sh: number } {
  if (source instanceof HTMLVideoElement) {
    return { sw: source.videoWidth, sh: source.videoHeight };
  }
  return { sw: source.naturalWidth, sh: source.naturalHeight };
}

function drawBlurredCover(
  ctx: CanvasRenderingContext2D,
  source: CouponStyleBannerMediaSource,
  sw: number,
  sh: number,
  outW: number,
  outH: number
): void {
  const scale = Math.max(outW / sw, outH / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (outW - dw) / 2;
  const dy = (outH - dh) / 2;
  ctx.save();
  ctx.filter = `blur(${COUPON_BANNER_BLUR_PX}px)`;
  ctx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

/** Height-first gutter — mirrors `ProgramsCouponBannerImage` left/right halves. */
function drawHorizontalEdgeGutters(
  ctx: CanvasRenderingContext2D,
  source: CouponStyleBannerMediaSource,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
  fgX: number,
  fgW: number
): void {
  const stripSw = Math.max(1, Math.min(sw, Math.round(sw * COUPON_EDGE_STRIP_FRAC)));
  ctx.save();
  ctx.filter = `blur(${COUPON_BANNER_BLUR_PX}px)`;
  if (fgX > 0) {
    ctx.drawImage(source, 0, 0, stripSw, sh, 0, 0, fgX, outH);
  }
  const rightX = fgX + fgW;
  if (rightX < outW) {
    const rightW = outW - rightX;
    ctx.drawImage(source, sw - stripSw, 0, stripSw, sh, rightX, 0, rightW, outH);
  }
  ctx.restore();
}

/** Width-first gutter — top/bottom halves (vertical analogue of coupon banner). */
function drawVerticalEdgeGutters(
  ctx: CanvasRenderingContext2D,
  source: CouponStyleBannerMediaSource,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
  fgY: number,
  fgH: number
): void {
  const stripSh = Math.max(1, Math.min(sh, Math.round(sh * COUPON_EDGE_STRIP_FRAC)));
  ctx.save();
  ctx.filter = `blur(${COUPON_BANNER_BLUR_PX}px)`;
  if (fgY > 0) {
    ctx.drawImage(source, 0, 0, sw, stripSh, 0, 0, outW, fgY);
  }
  const bottomY = fgY + fgH;
  if (bottomY < outH) {
    const bottomH = outH - bottomY;
    ctx.drawImage(source, 0, sh - stripSh, sw, stripSh, 0, bottomY, outW, bottomH);
  }
  ctx.restore();
}

/**
 * Rasterize into `outW`×`outH` (Business Catalogs preview: **4:3**, e.g. 512×384) with width/height fit + blurred gutters.
 * - `width`: foreground spans full width; top/bottom gaps use blurred top/bottom edge strips.
 * - `height`: foreground spans full height; left/right gaps use blurred left/right edge strips.
 */
export function drawCouponStyleBannerFill(
  ctx: CanvasRenderingContext2D,
  source: CouponStyleBannerMediaSource,
  outW: number,
  outH: number,
  mode: CouponStyleBannerFillMode
): void {
  const { sw, sh } = sourcePixelSize(source);
  if (sw <= 0 || sh <= 0) return;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, outW, outH);

  if (mode === 'width') {
    const scale = outW / sw;
    const fgW = outW;
    const fgH = sh * scale;
    const fgY = (outH - fgH) / 2;
    drawBlurredCover(ctx, source, sw, sh, outW, outH);
    drawVerticalEdgeGutters(ctx, source, sw, sh, outW, outH, fgY, fgH);
    ctx.drawImage(source, 0, 0, sw, sh, 0, fgY, fgW, fgH);
    return;
  }

  const scale = outH / sh;
  const fgH = outH;
  const fgW = sw * scale;
  const fgX = (outW - fgW) / 2;
  drawBlurredCover(ctx, source, sw, sh, outW, outH);
  drawHorizontalEdgeGutters(ctx, source, sw, sh, outW, outH, fgX, fgW);
  ctx.drawImage(source, 0, 0, sw, sh, fgX, 0, fgW, fgH);
}

export async function rasterizeCouponStyleBannerFill(
  source: CouponStyleBannerMediaSource,
  outW: number,
  outH: number,
  mode: CouponStyleBannerFillMode,
  jpegQuality = CATALOG_VIDEO_OG_BANNER_JPEG_QUALITY
): Promise<string> {
  const width = Math.max(1, Math.round(outW));
  const height = Math.max(1, Math.round(outH));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not capture banner snapshot.');

  drawCouponStyleBannerFill(ctx, source, width, height, mode);
  return canvas.toDataURL('image/jpeg', jpegQuality);
}

export function loadImageElementForCouponBannerCapture(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load banner media.'));
    img.src = url;
  });
}

/** Wait for a presentable frame on a preview `<video>`. */
export async function waitForVideoFrameReady(video: HTMLVideoElement, timeoutMs = 8_000): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Video frame not ready.')), timeoutMs);
    const done = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', done);
      video.removeEventListener('error', onErr);
      resolve();
    };
    const onErr = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', done);
      reject(new Error('Video failed to load.'));
    };
    video.addEventListener('loadeddata', done);
    video.addEventListener('error', onErr);
    if (video.readyState >= 2) done();
  });
}

const BANNER_CAPTURE_SOURCE_SELECTOR = `[${CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR}]`;
const BANNER_SNAPSHOT_PREVIEW_SELECTOR = `[${CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_ATTR}]`;

function firstBannerRasterImg(host: HTMLElement): HTMLImageElement | null {
  for (const img of host.querySelectorAll('img')) {
    if (!(img instanceof HTMLImageElement) || !img.src.trim()) continue;
    if (img.closest(BANNER_SNAPSHOT_PREVIEW_SELECTOR)) continue;
    return img;
  }
  return null;
}

export async function captureCouponStyleBannerFromHost(
  host: HTMLElement,
  mode: CouponStyleBannerFillMode,
  exportWidth: number,
  exportHeight: number
): Promise<string> {
  const marked = host.querySelector(BANNER_CAPTURE_SOURCE_SELECTOR);
  if (marked instanceof HTMLVideoElement) {
    await waitForVideoFrameReady(marked);
    return rasterizeCouponStyleBannerFill(marked, exportWidth, exportHeight, mode);
  }
  if (marked instanceof HTMLImageElement && marked.src) {
    if (marked.complete && marked.naturalWidth > 0) {
      return rasterizeCouponStyleBannerFill(marked, exportWidth, exportHeight, mode);
    }
    const loaded = await loadImageElementForCouponBannerCapture(marked.src);
    return rasterizeCouponStyleBannerFill(loaded, exportWidth, exportHeight, mode);
  }

  const video = host.querySelector('video');
  if (video instanceof HTMLVideoElement) {
    await waitForVideoFrameReady(video);
    return rasterizeCouponStyleBannerFill(video, exportWidth, exportHeight, mode);
  }

  const img = firstBannerRasterImg(host);
  if (img) {
    if (img.complete && img.naturalWidth > 0) {
      return rasterizeCouponStyleBannerFill(img, exportWidth, exportHeight, mode);
    }
    const loaded = await loadImageElementForCouponBannerCapture(img.src);
    return rasterizeCouponStyleBannerFill(loaded, exportWidth, exportHeight, mode);
  }

  throw new Error('No banner video or image to capture.');
}
