import {
  CATALOG_VIDEO_OG_BANNER_JPEG_QUALITY,
  CATALOG_VIDEO_OG_PLAY_BADGE_MAX_RADIUS_PX,
  CATALOG_VIDEO_OG_PLAY_BADGE_MIN_RADIUS_PX,
  CATALOG_VIDEO_OG_PLAY_BADGE_RADIUS_RATIO,
} from '@/utils/catalogProductionVideoOgConstants';

const compositeCache = new Map<string, string>();
const COMPOSITE_CACHE_MAX = 24;

function cacheComposite(key: string, dataUrl: string): string {
  if (compositeCache.size >= COMPOSITE_CACHE_MAX) {
    const first = compositeCache.keys().next().value;
    if (first) compositeCache.delete(first);
  }
  compositeCache.set(key, dataUrl);
  return dataUrl;
}

function loadImageForComposite(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load banner image'));
    img.src = url;
  });
}

/** Draw semi-transparent circle + play triangle + shadow (banner center). */
export function drawCatalogVideoOgPlayBadgeOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const min = Math.min(width, height);
  const r = Math.max(
    CATALOG_VIDEO_OG_PLAY_BADGE_MIN_RADIUS_PX,
    Math.min(CATALOG_VIDEO_OG_PLAY_BADGE_MAX_RADIUS_PX, min * CATALOG_VIDEO_OG_PLAY_BADGE_RADIUS_RATIO)
  );
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
  ctx.shadowBlur = r * 0.55;
  ctx.shadowOffsetY = r * 0.14;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
  ctx.fill();
  ctx.restore();

  const tri = r * 0.4;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.beginPath();
  ctx.moveTo(cx - tri * 0.38, cy - tri * 0.62);
  ctx.lineTo(cx - tri * 0.38, cy + tri * 0.62);
  ctx.lineTo(cx + tri * 0.74, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * Raster banner + centered play badge into one JPEG data URL (Business Catalogs preview).
 * Returns null when canvas is tainted / CORS blocks (caller should use CSS overlay fallback).
 */
export async function compositeCatalogVideoOgBannerWithPlayJpeg(
  imageUrl: string
): Promise<string | null> {
  const key = imageUrl.trim();
  if (!key) return null;
  const cached = compositeCache.get(key);
  if (cached) return cached;

  const img = await loadImageForComposite(key);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0, w, h);
    drawCatalogVideoOgPlayBadgeOnCanvas(ctx, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', CATALOG_VIDEO_OG_BANNER_JPEG_QUALITY);
    return cacheComposite(key, dataUrl);
  } catch {
    return null;
  }
}
