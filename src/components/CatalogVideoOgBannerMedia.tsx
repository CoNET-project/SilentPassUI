import type { CSSProperties, ReactNode } from 'react';
import { IpfsImg } from '@/components/IpfsImg';
import { CatalogVideoOgBannerImageWithPlay } from '@/components/CatalogVideoOgBannerImageWithPlay';
import { CatalogVideoOgPlayOverlay } from '@/components/CatalogVideoOgPlayOverlay';
import { catalogVideoOgBannerShouldUseVideoElement } from '@/utils/catalogProductionVideoOg';
import {
  isProductionBackgroundYoutubeMedia,
  youtubeThumbnailUrlFromProductionUrl,
} from '@/utils/youtubeProductionVideo';
import {
  CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR,
  CATALOG_VIDEO_OG_BANNER_MEDIA_CLASSNAME,
  CATALOG_VIDEO_OG_BANNER_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME,
} from '@/utils/catalogProductionVideoOgConstants';

export type CatalogVideoOgBannerMediaProps = {
  /** Resolved banner (YouTube thumb, production video URL, or OG icon fallback). */
  bannerImageUrl: string;
  productionImage: string;
  productionImageMime?: string;
  backgroundColor?: string;
  className?: string;
  /** Fixed OG-scale banner (Business Catalogs preview); requires `bannerHeightPx`. */
  previewLayout?: boolean;
  bannerHeightPx?: number;
  /** Mark live video / thumb for Width·Height fit capture (preview editor only). */
  markBannerCaptureSource?: boolean;
  /** Hide play badge while a fit snapshot covers the banner. */
  suppressPlayOverlay?: boolean;
};

function CatalogVideoOgBannerShell(props: {
  className?: string;
  style?: CSSProperties;
  backgroundColor?: string;
  children: ReactNode;
}) {
  const style = props.backgroundColor
    ? { ...props.style, backgroundColor: props.backgroundColor }
    : props.style;
  return (
    <div className={props.className} style={style} aria-hidden>
      {props.children}
    </div>
  );
}

/** Full-width video / YouTube banner above catalog `videoOg` metadata row (JPEG + play badge). */
export function CatalogVideoOgBannerMedia(props: CatalogVideoOgBannerMediaProps) {
  const banner = props.bannerImageUrl.trim() || props.productionImage.trim();
  const bg = props.backgroundColor?.trim() || '#ea580c';
  const slotClassName = props.previewLayout
    ? props.className ?? CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME
    : props.className ?? CATALOG_VIDEO_OG_BANNER_SLOT_CLASSNAME;
  const slotStyle =
    props.previewLayout && props.bannerHeightPx != null && props.bannerHeightPx > 0
      ? { height: props.bannerHeightPx }
      : undefined;
  const isYoutube = isProductionBackgroundYoutubeMedia({
    url: props.productionImage,
    mime: props.productionImageMime,
  });
  const youtubeThumb =
    youtubeThumbnailUrlFromProductionUrl(props.productionImage) ??
    (isYoutube && banner ? banner : null);

  if (!banner && !youtubeThumb) {
    return (
      <CatalogVideoOgBannerShell
        className={slotClassName}
        style={slotStyle}
        backgroundColor={bg}
      >
        {!props.suppressPlayOverlay ? (
          <CatalogVideoOgPlayOverlay previewLayout={props.previewLayout} />
        ) : null}
      </CatalogVideoOgBannerShell>
    );
  }

  const captureAttr = props.markBannerCaptureSource
    ? { [CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR]: '' }
    : undefined;
  const showPlay =
    props.previewLayout && !props.suppressPlayOverlay ? <CatalogVideoOgPlayOverlay previewLayout /> : null;

  const rasterSrc = isYoutube || youtubeThumb ? (youtubeThumb ?? banner) : banner;

  if (isYoutube || youtubeThumb) {
    const src = youtubeThumb ?? banner;
    return (
      <CatalogVideoOgBannerShell className={slotClassName} style={slotStyle}>
        <IpfsImg
          src={src}
          alt=""
          className={CATALOG_VIDEO_OG_BANNER_MEDIA_CLASSNAME}
          draggable={false}
          {...captureAttr}
        />
        {showPlay}
      </CatalogVideoOgBannerShell>
    );
  }

  if (
    catalogVideoOgBannerShouldUseVideoElement({
      bannerImageUrl: banner,
      productionImage: props.productionImage,
      productionImageMime: props.productionImageMime,
    })
  ) {
    const videoSrc = props.productionImage.trim() || banner;
    return (
      <CatalogVideoOgBannerShell className={slotClassName} style={slotStyle}>
        <video
          src={videoSrc}
          className={CATALOG_VIDEO_OG_BANNER_MEDIA_CLASSNAME}
          muted
          playsInline
          preload="metadata"
          aria-hidden
          {...captureAttr}
        />
        {showPlay}
      </CatalogVideoOgBannerShell>
    );
  }

  return (
    <CatalogVideoOgBannerShell className={slotClassName} style={slotStyle}>
      <CatalogVideoOgBannerImageWithPlay imageUrl={rasterSrc} previewLayout={props.previewLayout} />
    </CatalogVideoOgBannerShell>
  );
}
