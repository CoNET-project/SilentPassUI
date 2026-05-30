import {
  BEAMIO_YOUTUBE_PRODUCTION_VIDEO_API_BASE,
  normalizeYoutubeProductionVideoUrl,
  type YoutubeProductionVideoValidateResponse,
} from './youtubeProductionVideo';

export type ValidateProductionBackgroundYoutubeProgress = {
  percent: number;
  message: string;
};

export async function validateProductionBackgroundYoutubeVideo(args: {
  url: string;
  apiBase?: string;
  onProgress?: (progress: ValidateProductionBackgroundYoutubeProgress) => void;
  signal?: AbortSignal;
}): Promise<{ normalizedUrl: string; title: string; videoId: string; embedUrl: string }> {
  const normalized = normalizeYoutubeProductionVideoUrl(args.url);
  if (!normalized) {
    throw new Error('Enter a valid YouTube URL (youtube.com or youtu.be).');
  }

  const apiBase = (args.apiBase ?? BEAMIO_YOUTUBE_PRODUCTION_VIDEO_API_BASE).replace(/\/$/, '');
  args.onProgress?.({ percent: 15, message: 'Checking YouTube video…' });

  const resp = await fetch(`${apiBase}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: normalized }),
    signal: args.signal,
  });

  const data = (await resp.json().catch(() => null)) as YoutubeProductionVideoValidateResponse | null;
  if (!resp.ok || !data?.ok || !data.normalizedUrl || !data.videoId) {
    throw new Error(data?.error ?? 'This YouTube video could not be verified.');
  }

  args.onProgress?.({ percent: 100, message: data.title ? `Ready: ${data.title}` : 'YouTube video ready' });

  return {
    normalizedUrl: data.normalizedUrl,
    title: data.title ?? '',
    videoId: data.videoId,
    embedUrl: data.embedUrl ?? `https://www.youtube.com/embed/${data.videoId}?rel=0`,
  };
}
