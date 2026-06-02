/**
 * Catalog video OG right thumbnail — single source for bizSite (mirror in x402sdk / homepage).
 * Matches YouTube `https://img.youtube.com/vi/{id}/hqdefault.jpg` (480×360, 4:3).
 */

export const CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH = 480;
export const CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT = 360;

/** Canvas `toDataURL` quality when extracting frames from uploaded background video. */
export const CATALOG_VIDEO_OG_RIGHT_THUMB_JPEG_QUALITY = 0.88;

/** ffmpeg `-q:v` for OG frame extract from upload (2–5 ≈ high; 8 ≈ filmstrip only). */
export const CATALOG_VIDEO_OG_THUMB_FFMPEG_QV = 3;

export const PRODUCTION_VIDEO_OG_FRAME_PICKER_COUNT = 5;

/** Catalog preview image picker — browser `<video>`+canvas capture (4K-friendly). */
export const PRODUCTION_VIDEO_OG_PICKER_CAPTURE_TIMEOUT_MS = 60_000;

/** Picker ffmpeg (5× 480×360) on standardized clip; browser fallback if exceeded. */
export const PRODUCTION_VIDEO_OG_PICKER_FFMPEG_TIMEOUT_MS = 90_000;

/** Per-seek timeout when capturing picker frames from large uploads. */
export const PRODUCTION_VIDEO_OG_PICKER_SEEK_TIMEOUT_MS = 10_000;

/**
 * Catalog share OG raster width (`couponClaimShare` OG_WIDTH). Preview scales from this.
 * @see src/x402sdk/src/endpoint/couponClaimShare.ts
 */
export const CATALOG_VIDEO_OG_SHARE_LAYOUT_WIDTH_PX = 1200;

/** In-app share ticket max width (homepage `max-w-lg` / 32rem). */
export const CATALOG_VIDEO_OG_SHARE_TICKET_PREVIEW_MAX_WIDTH_PX = 512;

/** Banner capsule height on 1200px-wide OG (`OG_BANNER_CAPSULE_H`). */
export const CATALOG_VIDEO_OG_SHARE_BANNER_HEIGHT_PX = 258;

/** Right metadata thumb on 1200px-wide videoOg OG (`iconSize`). */
export const CATALOG_VIDEO_OG_SHARE_METADATA_THUMB_PX = 112;

/** Business Catalogs preview shell — do not grow past share-ticket OG scale. */
export const CATALOG_VIDEO_OG_PREVIEW_SHELL_CLASSNAME = 'mx-auto w-full max-w-[32rem]';

/**
 * Floating OG ticket surface (Add item preview) — white card + shadow; no outer orange editor chrome.
 */
export const CATALOG_VIDEO_OG_PREVIEW_OG_CARD_CLASSNAME =
  `${CATALOG_VIDEO_OG_PREVIEW_SHELL_CLASSNAME} overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.14),0_1px_3px_rgba(15,23,42,0.08)]`;

/**
 * Top banner in list / full-width contexts (16:9 fluid).
 */
export const CATALOG_VIDEO_OG_BANNER_SLOT_CLASSNAME =
  'relative w-full aspect-video overflow-hidden bg-[#0f172a]';

/** Fixed-height banner inside {@link CATALOG_VIDEO_OG_PREVIEW_SHELL_CLASSNAME}. */
export const CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME =
  'relative w-full overflow-hidden bg-[#0f172a]';

export const CATALOG_VIDEO_OG_BANNER_MEDIA_CLASSNAME = 'absolute inset-0 h-full w-full object-cover';

/** Width/Height fit snapshot in Business Catalogs preview — show full raster (blur gutters), no crop. */
export const CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_CLASSNAME =
  'absolute inset-0 z-[10] h-full w-full object-contain';

/** Capture source for coupon-style banner raster (video or YouTube thumb). */
export const CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR = 'data-beamio-catalog-banner-capture-source';

/** Overlay JPEG from Width/Height fit — must not be used as the next capture source. */
export const CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_ATTR = 'data-beamio-catalog-banner-snapshot-preview';

/** JPEG quality for banner + play badge canvas export (Business Catalogs preview). */
export const CATALOG_VIDEO_OG_BANNER_JPEG_QUALITY = 0.88;

/** Play badge radius ≈ min(w,h) × ratio, clamped (canvas + CSS overlay). */
export const CATALOG_VIDEO_OG_PLAY_BADGE_RADIUS_RATIO = 0.11;
export const CATALOG_VIDEO_OG_PLAY_BADGE_MIN_RADIUS_PX = 22;
export const CATALOG_VIDEO_OG_PLAY_BADGE_MAX_RADIUS_PX = 52;

export const CATALOG_VIDEO_OG_PLAY_OVERLAY_BADGE_CLASSNAME =
  'flex h-[clamp(2.75rem,11vw,3.25rem)] w-[clamp(2.75rem,11vw,3.25rem)] items-center justify-center rounded-full bg-black/45 shadow-[0_4px_18px_rgba(0,0,0,0.45)] backdrop-blur-[2px]';

export const CATALOG_VIDEO_OG_PREVIEW_PLAY_OVERLAY_BADGE_CLASSNAME =
  'flex h-11 w-11 items-center justify-center rounded-full bg-black/45 shadow-[0_4px_18px_rgba(0,0,0,0.45)] backdrop-blur-[2px]';

/**
 * Metadata + right thumbnail row **below** the banner (YouTube OG parity).
 */
export const CATALOG_VIDEO_OG_BELOW_BANNER_ROW_CLASSNAME =
  'flex w-full items-start gap-3 px-4 pb-4 pt-3';

/** Same row inside catalog list `p-4` shell (no extra horizontal padding). */
export const CATALOG_VIDEO_OG_BELOW_BANNER_ROW_EMBEDDED_CLASSNAME =
  'flex min-w-0 flex-1 items-start gap-3';

/** Share / ticket metadata below banner (parent supplies outer padding). */
export const CATALOG_VIDEO_OG_BELOW_BANNER_ROW_UNPADDED_CLASSNAME =
  'flex w-full items-start gap-3';

/** Business Catalogs preview (`ogSharePreviewLayout`): text only, no right thumbnail column. */
export const CATALOG_VIDEO_OG_BELOW_BANNER_ROW_OG_PREVIEW_CLASSNAME =
  'w-full px-4 pb-4 pt-3';

/**
 * In-app display slot (list, Business Catalogs preview): 56px wide, 4:3 (not square icon).
 * Stored / uploaded asset must be {@link CATALOG_VIDEO_OG_RIGHT_THUMB_WIDTH}×{@link CATALOG_VIDEO_OG_RIGHT_THUMB_HEIGHT} or higher.
 */
export const CATALOG_VIDEO_OG_RIGHT_THUMB_SLOT_CLASSNAME =
  'relative w-14 shrink-0 aspect-[4/3] overflow-hidden rounded-xl bg-[#0f172a]/90 ring-1 ring-[#e5e9eb]';

export const CATALOG_VIDEO_OG_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME =
  'flex w-14 shrink-0 aspect-[4/3] items-center justify-center rounded-xl text-white ring-1 ring-[#e5e9eb]';

export const CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_SLOT_CLASSNAME =
  'relative shrink-0 overflow-hidden rounded-xl bg-[#0f172a]/90 ring-1 ring-[#e5e9eb]';

export const CATALOG_VIDEO_OG_PREVIEW_RIGHT_THUMB_PLACEHOLDER_SLOT_CLASSNAME =
  'flex shrink-0 items-center justify-center rounded-xl text-white ring-1 ring-[#e5e9eb]';
