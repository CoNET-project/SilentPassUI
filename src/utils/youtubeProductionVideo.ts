/** Client-side YouTube URL helpers (mirrors server semantics). */

export const PRODUCTION_BACKGROUND_YOUTUBE_MIME = 'video/youtube';

export function parseYoutubeVideoId(raw: string): string | null {
  const input = String(raw ?? '').trim();
  if (!input) return null;
  try {
    const url = input.startsWith('http') ? new URL(input) : new URL(`https://${input}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0]?.trim();
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v')?.trim();
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const shorts = url.pathname.match(/^\/shorts\/([\w-]{6,})/);
      if (shorts?.[1]) return shorts[1];
      const embed = url.pathname.match(/^\/embed\/([\w-]{6,})/);
      if (embed?.[1]) return embed[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function isYoutubeProductionVideoUrl(raw: string): boolean {
  return parseYoutubeVideoId(raw) != null;
}

export function normalizeYoutubeProductionVideoUrl(raw: string): string | null {
  const id = parseYoutubeVideoId(raw);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}

export function youtubeEmbedUrlFromProductionUrl(raw: string): string | null {
  const id = parseYoutubeVideoId(raw);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0`;
}

export function youtubeThumbnailUrlFromProductionUrl(raw: string): string | null {
  const id = parseYoutubeVideoId(raw);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export {
  CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT as YOUTUBE_HQDEFAULT_THUMB_HEIGHT,
  CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH as YOUTUBE_HQDEFAULT_THUMB_WIDTH,
  CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY as CATALOG_VIDEO_OG_THUMB_JPEG_QUALITY,
  CATALOG_VIDEO_OG_THUMB_FFMPEG_QV,
} from './catalogProductionVideoOgConstants';

export function isProductionBackgroundYoutubeMedia(args: {
  url?: unknown;
  mime?: unknown;
}): boolean {
  const mime = typeof args.mime === 'string' ? args.mime.trim().toLowerCase() : '';
  if (mime === PRODUCTION_BACKGROUND_YOUTUBE_MIME) return true;
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  return url.length > 0 && isYoutubeProductionVideoUrl(url);
}

export const BEAMIO_YOUTUBE_PRODUCTION_VIDEO_API_BASE = 'https://beamio.app/api/youtubeProductionVideo';

export type YoutubeProductionVideoValidateResponse = {
  ok: boolean;
  videoId?: string;
  normalizedUrl?: string;
  embedUrl?: string;
  title?: string;
  channelUsername?: string;
  description?: string;
  error?: string;
};
