/**
 * Mirror of `src/x402sdk/src/catalogProductionVideoOg.ts` — keep field mapping in sync.
 * Business Catalog video background → YouTube OG layout for list, share preview, and client meta.
 *
 * `row.icon` / `iconUrl` = catalog video OG **right thumbnail** (480×360 hqdefault parity), not a small item icon.
 * See `catalogProductionVideoOgConstants.ts` and `.cursor/rules/beamio-catalog-video-og-thumbnail.mdc`.
 */
import { youtubeThumbnailUrlFromProductionUrl } from '@/utils/youtubeProductionVideo';
import {
  resolveProductionBackgroundMediaKind,
  type CardIssuanceProductionRow,
} from '@/pages/Vouchers/example/cardIssuanceProductions';
import {
  CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT,
  CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH,
  CATALOG_VIDEO_OG_SHARE_LAYOUT_WIDTH_PX,
  CATALOG_VIDEO_OG_SHARE_METADATA_THUMB_PX,
  CATALOG_VIDEO_OG_SHARE_TICKET_PREVIEW_MAX_WIDTH_PX,
} from './catalogProductionVideoOgConstants';

export {
  CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT,
  CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH,
  CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY,
  CATALOG_VIDEO_OG_THUMB_FFMPEG_QV,
  CATALOG_VIDEO_OG_BANNER_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_OG_CARD_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_SHELL_CLASSNAME,
  CATALOG_VIDEO_OG_SHARE_BANNER_HEIGHT_PX,
  CATALOG_VIDEO_OG_SHARE_LAYOUT_WIDTH_PX,
  CATALOG_VIDEO_OG_SHARE_METADATA_THUMB_PX,
  CATALOG_VIDEO_OG_SHARE_TICKET_PREVIEW_MAX_WIDTH_PX,
  CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_BANNER_MEDIA_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_BANNER_MEDIA_CLASSNAME,
  CATALOG_VIDEO_OG_BELOW_BANNER_ROW_CLASSNAME,
  CATALOG_VIDEO_OG_BELOW_BANNER_ROW_EMBEDDED_CLASSNAME,
  CATALOG_VIDEO_OG_BELOW_BANNER_ROW_UNPADDED_CLASSNAME,
  CATALOG_VIDEO_OG_BELOW_BANNER_ROW_OG_PREVIEW_CLASSNAME,
  CATALOG_VIDEO_OG_RIGHT_THUMB_SLOT_CLASSNAME,
  CATALOG_VIDEO_OG_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME,
} from './catalogProductionVideoOgConstants';

export type CatalogProductionVideoOgLayout = 'default' | 'videoOg';

export type CatalogProductionSharePresentation = {
  layout: CatalogProductionVideoOgLayout;
  title: string;
  subtitle: string;
  publisherLine: string | null;
  iconUrl: string;
  bannerImageUrl: string;
  channelName: string;
};

export function catalogVideoOgSharePreviewScale(
  maxWidthPx: number = CATALOG_VIDEO_OG_SHARE_TICKET_PREVIEW_MAX_WIDTH_PX
): number {
  return maxWidthPx / CATALOG_VIDEO_OG_SHARE_LAYOUT_WIDTH_PX;
}

/**
 * Business Catalogs preview hero height — **4:3** (upload / OG thumb 480×360), not coupon ticket banner
 * ({@link CATALOG_VIDEO_OG_SHARE_BANNER_HEIGHT_PX} @ 1200px wide).
 */
export function catalogVideoOgPreviewBannerHeightPx(
  maxWidthPx: number = CATALOG_VIDEO_OG_SHARE_TICKET_PREVIEW_MAX_WIDTH_PX
): number {
  return Math.round(
    maxWidthPx * (CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT / CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH)
  );
}

/** Preview hero slot size at max ticket width (512×384). */
export function catalogVideoOgPreviewHeroDisplaySize(
  maxWidthPx: number = CATALOG_VIDEO_OG_SHARE_TICKET_PREVIEW_MAX_WIDTH_PX
): { width: number; height: number } {
  return {
    width: maxWidthPx,
    height: catalogVideoOgPreviewBannerHeightPx(maxWidthPx),
  };
}

/** Scaled 4:3 right thumb (OG metadata uses {@link CATALOG_VIDEO_OG_SHARE_METADATA_THUMB_PX} width @ 1200). */
export function catalogVideoOgPreviewRightThumbDisplaySize(
  maxWidthPx: number = CATALOG_VIDEO_OG_SHARE_TICKET_PREVIEW_MAX_WIDTH_PX
): { width: number; height: number } {
  const width = Math.round(CATALOG_VIDEO_OG_SHARE_METADATA_THUMB_PX * catalogVideoOgSharePreviewScale(maxWidthPx));
  const height = Math.round(
    width * (CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT / CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH)
  );
  return { width, height };
}

/** Any uploaded/imported background media URL (image, video, YouTube, PDF, …). */
export function catalogProductionHasUploadedBackgroundMedia(
  row: Pick<CardIssuanceProductionRow, 'productionImage'>
): boolean {
  return row.productionImage.trim().length > 0;
}

export function catalogProductionHasVideoBackgroundMedia(
  row: Pick<CardIssuanceProductionRow, 'productionImage' | 'productionImageMime'>
): boolean {
  if (!catalogProductionHasUploadedBackgroundMedia(row)) return false;
  return (
    resolveProductionBackgroundMediaKind({
      url: row.productionImage,
      mime: row.productionImageMime,
    }) === 'video'
  );
}

/** Static image background in Business Catalogs preview — same 4:3 hero as video OG thumb. */
export function catalogProductionBusinessPreviewHasHeroImage(
  row: Pick<CardIssuanceProductionRow, 'productionImage' | 'productionImageMime'>
): boolean {
  if (catalogProductionHasVideoBackgroundMedia(row)) return false;
  const url = row.productionImage.trim();
  if (!url) return false;
  return (
    resolveProductionBackgroundMediaKind({
      url,
      mime: row.productionImageMime,
    }) === 'image'
  );
}

export function formatCatalogProductionPublisherLine(
  publisherBeamioTag: string | undefined,
  channelOrDisplayName: string
): string | null {
  const name = channelOrDisplayName.trim();
  const rawTag = (publisherBeamioTag ?? '').trim().replace(/^@/, '');
  if (!rawTag && !name) return null;
  if (rawTag && name) return `@${rawTag} · ${name}`;
  if (rawTag) return `@${rawTag}`;
  return name;
}

function resolveCatalogVideoOgBannerImage(productionImage: string, iconUrl: string): string {
  const thumb = youtubeThumbnailUrlFromProductionUrl(productionImage);
  if (thumb) return thumb;
  if (iconUrl.trim()) return iconUrl.trim();
  return productionImage.trim();
}

/** True when the banner slot should render `<video>` (not catalog preview JPEG / IPFS image). */
export function catalogVideoOgBannerShouldUseVideoElement(args: {
  bannerImageUrl: string;
  productionImage: string;
  productionImageMime?: string;
}): boolean {
  const banner = args.bannerImageUrl.trim();
  const production = args.productionImage.trim();
  if (!banner) return false;

  const lower = banner.toLowerCase();
  if (lower.startsWith('data:image/')) return false;
  if (/\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(lower)) return false;
  if (youtubeThumbnailUrlFromProductionUrl(banner)) return false;

  const bannerIsProductionAsset =
    production.length > 0 &&
    (banner === production ||
      (banner.startsWith('blob:') && production.startsWith('blob:') && banner === production));

  if (!bannerIsProductionAsset) {
    return false;
  }

  return (
    /\.(mp4|webm|mov|m4v|ogv)(\?|&|$)/i.test(lower) ||
    lower.startsWith('blob:') ||
    lower.startsWith('data:video/') ||
    (args.productionImageMime?.trim().toLowerCase() ?? '').startsWith('video/')
  );
}

function resolveCatalogVideoOgIconUrl(productionImage: string, iconUrl: string): string {
  if (iconUrl.trim()) return iconUrl.trim();
  return youtubeThumbnailUrlFromProductionUrl(productionImage) ?? '';
}

export function resolveCatalogProductionSharePresentation(args: {
  row: Pick<
    CardIssuanceProductionRow,
    'name' | 'subtitle' | 'description' | 'productionImage' | 'productionImageMime' | 'icon'
  >;
  publisherBeamioTag?: string;
}): CatalogProductionSharePresentation {
  const channelName = args.row.name.trim();
  const videoTitle = args.row.subtitle.trim();
  const description = args.row.description.trim();
  const productionImage = args.row.productionImage.trim();
  const iconUrl = args.row.icon.trim();

  if (!catalogProductionHasVideoBackgroundMedia(args.row)) {
    return {
      layout: 'default',
      title: channelName || 'Catalog Item',
      subtitle: videoTitle,
      publisherLine: null,
      iconUrl,
      bannerImageUrl: productionImage,
      channelName,
    };
  }

  const resolvedIcon = resolveCatalogVideoOgIconUrl(productionImage, iconUrl);
  return {
    layout: 'videoOg',
    title: videoTitle || channelName || 'Catalog Item',
    subtitle: description,
    publisherLine: formatCatalogProductionPublisherLine(args.publisherBeamioTag, channelName),
    iconUrl: resolvedIcon,
    bannerImageUrl: resolveCatalogVideoOgBannerImage(productionImage, resolvedIcon),
    channelName,
  };
}

export function isCatalogProductionYoutubeOgRow(
  row: Pick<CardIssuanceProductionRow, 'productionImage' | 'productionImageMime'>
): boolean {
  return catalogProductionHasVideoBackgroundMedia(row);
}
