import { Play } from 'lucide-react';
import {
  CATALOG_VIDEO_OG_PLAY_OVERLAY_BADGE_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_PLAY_OVERLAY_BADGE_CLASSNAME,
} from '@/utils/catalogProductionVideoOgConstants';

/** CSS fallback when canvas JPEG composite is unavailable (e.g. YouTube thumb CORS). */
export function CatalogVideoOgPlayOverlay(props: { previewLayout?: boolean }) {
  const badgeClass = props.previewLayout
    ? CATALOG_VIDEO_OG_PREVIEW_PLAY_OVERLAY_BADGE_CLASSNAME
    : CATALOG_VIDEO_OG_PLAY_OVERLAY_BADGE_CLASSNAME;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center"
      aria-hidden
    >
      <div className={badgeClass}>
        <Play className="ml-0.5 h-[42%] w-[42%] fill-white text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]" strokeWidth={0} />
      </div>
    </div>
  );
}
