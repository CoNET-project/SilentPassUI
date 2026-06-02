import { Play } from 'lucide-react';
import { IpfsImg } from '@/components/IpfsImg';
import {
  CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_RIGHT_THUMB_SLOT_CLASSNAME,
} from '@/utils/catalogProductionVideoOgConstants';

export type CatalogVideoOgRightThumbnailProps = {
  imageUrl?: string | null;
  placeholderBackgroundColor?: string;
  placeholderClassName?: string;
  className?: string;
  /** OG-scale Business Catalogs preview (fixed px, not `w-14`). */
  previewLayout?: boolean;
  displayWidthPx?: number;
  displayHeightPx?: number;
};

/** Catalog `videoOg` layout — right-side preview image (YouTube OG / hqdefault parity). */
export function CatalogVideoOgRightThumbnail(props: CatalogVideoOgRightThumbnailProps) {
  const src = props.imageUrl?.trim() ?? '';
  const sizeStyle =
    props.previewLayout && props.displayWidthPx != null && props.displayHeightPx != null
      ? { width: props.displayWidthPx, height: props.displayHeightPx }
      : undefined;
  const slotClass = props.className
    ?? (props.previewLayout
      ? CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_SLOT_CLASSNAME
      : CATALOG_VIDEO_OG_RIGHT_THUMB_SLOT_CLASSNAME);
  const placeholderClass = props.placeholderClassName
    ?? (props.previewLayout
      ? CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME
      : CATALOG_VIDEO_OG_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME);

  if (src) {
    return (
      <div className={slotClass} style={sizeStyle}>
        <IpfsImg src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      </div>
    );
  }

  return (
    <div
      className={placeholderClass}
      style={{
        ...sizeStyle,
        backgroundColor: props.placeholderBackgroundColor?.trim() || '#ea580c',
      }}
    >
      <Play className="h-6 w-6" strokeWidth={2} aria-hidden />
    </div>
  );
}
