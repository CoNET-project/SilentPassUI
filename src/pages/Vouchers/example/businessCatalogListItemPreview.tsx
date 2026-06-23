import { useCallback, useEffect, useState } from 'react';
import { IpfsImg } from '@/components/IpfsImg';
import { Check, FileText, Sparkles } from 'lucide-react';
import { useTu } from '@/locale/beamioLocale';
import { CatalogVideoOgBannerMedia } from '@/components/CatalogVideoOgBannerMedia';
import { CatalogVideoOgPreviewBannerCaptureOverlay } from '@/components/CatalogVideoOgPreviewBannerCaptureOverlay';
import { CatalogVideoOgRightThumbnail } from '@/components/CatalogVideoOgRightThumbnail';
import type { CatalogBannerPreviewSnapshot } from '@/utils/couponStyleBannerFillCanvas';
import {
  catalogProductionDisplayPrice,
  effectiveTileBackgroundColorForMetadata,
  isCatalogPriceOptionalCategory,
  makeCardIssuanceProductionRow,
  catalogBusinessPreviewShowsIssuanceLine,
  productionIssueTotalDisplayLabel,
  productionItemCategoryLabel,
  resolveProductionBackgroundMediaKind,
  type CardIssuanceProductionRow,
  type CatalogGlobalCategoryId,
  type ProductionServiceCategoryOption,
} from './cardIssuanceProductions';
import {
  catalogProductionBusinessPreviewHasHeroImage,
  catalogProductionHasUploadedBackgroundMedia,
  catalogProductionHasVideoBackgroundMedia,
  catalogVideoOgBannerShouldUseVideoElement,
  CATALOG_VIDEO_OG_BELOW_BANNER_ROW_CLASSNAME,
  CATALOG_VIDEO_OG_BELOW_BANNER_ROW_EMBEDDED_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_OG_CARD_CLASSNAME,
  catalogVideoOgPreviewHeroDisplaySize,
  resolveCatalogProductionSharePresentation,
} from '@/utils/catalogProductionVideoOg';
import {
  CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR,
  CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_ATTR,
  CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_CLASSNAME,
  CATALOG_VIDEO_OG_BELOW_BANNER_ROW_OG_PREVIEW_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_BANNER_MEDIA_CLASSNAME,
  CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME,
} from '@/utils/catalogProductionVideoOgConstants';
import {
  isProductionBackgroundYoutubeMedia,
  youtubeThumbnailUrlFromProductionUrl,
} from '@/utils/youtubeProductionVideo';

export type BusinessCatalogVideoOgPreviewDetailsProps = {
  row: CardIssuanceProductionRow;
  publisherBeamioTag?: string;
  itemCategoryLabel: string;
  displayPrice: number | null;
  moneyPrefix: string;
  showPrice: boolean;
  /** Catalog Distribution / open-claim share ticket — allow 3-line description clamp. */
  shareDistributionTicket?: boolean;
  /** Add item → Business Catalogs preview: no right thumb, unlimited hides issuance. */
  ogSharePreviewLayout?: boolean;
  /** Solid tile color (no background photo) — paints whole preview card. */
  tileBackgroundColor?: string;
};

/** OG ticket shell — white by default; tile color fills entire Business Catalogs preview. */
export function catalogPreviewOgCardSurface(tileBackgroundColor?: string): {
  className: string;
  style?: { backgroundColor: string };
} {
  const shell =
    'mx-auto w-full max-w-[32rem] overflow-hidden rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.14),0_1px_3px_rgba(15,23,42,0.08)]';
  if (tileBackgroundColor?.trim()) {
    return { className: shell, style: { backgroundColor: tileBackgroundColor.trim() } };
  }
  return { className: `${shell} bg-white` };
}

/** Text block for `videoOg` — pairs with {@link CatalogVideoOgRightThumbnail} in below-banner row. */
export function BusinessCatalogVideoOgPreviewDetails(props: BusinessCatalogVideoOgPreviewDetailsProps) {
  const {
    row,
    publisherBeamioTag,
    itemCategoryLabel,
    displayPrice,
    moneyPrefix,
    showPrice,
    shareDistributionTicket,
    ogSharePreviewLayout,
    tileBackgroundColor,
  } = props;
  const { tu } = useTu();
  const onTileBackground = Boolean(tileBackgroundColor?.trim());
  const showIssuanceLine = catalogBusinessPreviewShowsIssuanceLine(row, ogSharePreviewLayout);
  const presentation = resolveCatalogProductionSharePresentation({ row, publisherBeamioTag });
  const titleText = presentation.title;
  const descriptionText = presentation.subtitle;
  const publisherLine = presentation.publisherLine;
  const descriptionClampClass = shareDistributionTicket ? 'line-clamp-3' : 'line-clamp-2';

  return (
    <div className="min-w-0 flex-1 text-left">
      {titleText ? (
        <p
          className={`line-clamp-2 font-manrope text-base font-bold leading-snug ${
            onTileBackground ? 'text-white drop-shadow-sm' : 'text-[#2c2f31]'
          }`}
        >
          {titleText}
        </p>
      ) : null}
      {descriptionText ? (
        <p
          className={`mt-0.5 ${descriptionClampClass} text-sm leading-snug ${
            onTileBackground ? 'text-white/90 drop-shadow-sm' : 'text-[#747779]'
          }`}
          title={descriptionText}
        >
          {descriptionText}
        </p>
      ) : null}
      {publisherLine ? (
        <p
          className={`mt-1 truncate text-xs font-medium ${
            onTileBackground ? 'text-white/85 drop-shadow-sm' : 'text-[#595c5e]'
          }`}
        >
          {publisherLine}
        </p>
      ) : null}
      <p
        className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${
          onTileBackground ? 'text-white/85 drop-shadow-sm' : 'text-[#ea580c]'
        }`}
      >
        {itemCategoryLabel}
      </p>
      {showPrice && displayPrice != null ? (
        <p
          className={`mt-1 text-xs font-semibold ${
            onTileBackground ? 'text-white/90 drop-shadow-sm' : 'text-[#595c5e]'
          }`}
        >
          {moneyPrefix}
          {displayPrice.toFixed(2)}
        </p>
      ) : null}
      {showIssuanceLine ? (
        <p
          className={`mt-0.5 text-[10px] font-semibold ${
            onTileBackground ? 'text-white/80' : 'text-[#747779]'
          }`}
        >
          {tu('programs_preview_issuance')} {productionIssueTotalDisplayLabel(row)}
          {row.issued && row.issueLeft?.trim()
            ? ` · ${Number.parseInt(row.issueLeft.replace(/,/g, ''), 10).toLocaleString()} ${tu('programs_coupon_left').toLowerCase()}`
            : ''}
        </p>
      ) : null}
      {row.requiresRedeemCode ? (
        <p
          className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${
            onTileBackground ? 'text-white/90 drop-shadow-sm' : 'text-[#ea580c]'
          }`}
        >
          {tu('programs_preview_redeem_code')}
        </p>
      ) : null}
    </div>
  );
}

/** Metadata row below banner; list/share may include right OG thumb — not Business Catalogs preview. */
export function BusinessCatalogVideoOgBelowBannerRow(
  props: BusinessCatalogVideoOgPreviewDetailsProps & {
    embeddedInListShell?: boolean;
    /** Add item → Business Catalogs preview: text only under banner (no right icon). */
    ogSharePreviewLayout?: boolean;
  }
) {
  const { embeddedInListShell, ogSharePreviewLayout, ...details } = props;
  const previewLayout = Boolean(ogSharePreviewLayout);
  const showRightThumbnail = !previewLayout;

  const presentation = showRightThumbnail
    ? resolveCatalogProductionSharePresentation({
        row: props.row,
        publisherBeamioTag: props.publisherBeamioTag,
      })
    : null;

  return (
    <div
      className={
        previewLayout
          ? CATALOG_VIDEO_OG_BELOW_BANNER_ROW_OG_PREVIEW_CLASSNAME
          : embeddedInListShell
            ? CATALOG_VIDEO_OG_BELOW_BANNER_ROW_EMBEDDED_CLASSNAME
            : CATALOG_VIDEO_OG_BELOW_BANNER_ROW_CLASSNAME
      }
    >
      <BusinessCatalogVideoOgPreviewDetails {...details} ogSharePreviewLayout={previewLayout} />
      {showRightThumbnail && presentation ? (
        <CatalogVideoOgRightThumbnail
          imageUrl={presentation.iconUrl || null}
          placeholderBackgroundColor={details.row.backgroundColor || '#ea580c'}
        />
      ) : null}
    </div>
  );
}

/**
 * Full Business Catalog `videoOg` preview: banner on top, metadata below (no right icon under banner).
 */
export function BusinessCatalogVideoOgPreviewBlock(
  props: BusinessCatalogVideoOgPreviewDetailsProps & {
    bannerCaptureDisabled?: boolean;
    catalogBannerPreviewSnapshot?: CatalogBannerPreviewSnapshot | null;
    onCaptureBannerSnapshot?: (args: CatalogBannerPreviewSnapshot) => void | Promise<void>;
  }
) {
  const { bannerCaptureDisabled, catalogBannerPreviewSnapshot, onCaptureBannerSnapshot, ...details } = props;
  const { tu } = useTu();
  const ogCard = catalogPreviewOgCardSurface(details.tileBackgroundColor);
  const presentation = resolveCatalogProductionSharePresentation({
    row: details.row,
    publisherBeamioTag: details.publisherBeamioTag,
  });

  const heroSize = catalogVideoOgPreviewHeroDisplaySize();
  const bannerExportWidth = heroSize.width;
  const bannerHeightPx = heroSize.height;

  const [liveSnapshot, setLiveSnapshot] = useState<CatalogBannerPreviewSnapshot | null>(
    catalogBannerPreviewSnapshot ?? null
  );
  /** Sync parent snapshot (frame picker + Width/Height fit capture); local capture still sets liveSnapshot first. */
  useEffect(() => {
    setLiveSnapshot(catalogBannerPreviewSnapshot ?? null);
  }, [catalogBannerPreviewSnapshot?.dataUrl, catalogBannerPreviewSnapshot?.mode]);

  const handleCaptureBannerSnapshot = useCallback(
    async (args: CatalogBannerPreviewSnapshot) => {
      setLiveSnapshot(args);
      await onCaptureBannerSnapshot?.(args);
    },
    [onCaptureBannerSnapshot]
  );

  const snapshot = liveSnapshot;
  const hasSnapshot = Boolean(snapshot?.dataUrl?.trim());

  const snapshotLabel =
    snapshot?.mode === 'width'
      ? tu('programs_preview_width_fit')
      : snapshot?.mode === 'height'
        ? tu('programs_preview_height_fit')
        : '';

  const hasCapturableBannerMedia = catalogProductionHasUploadedBackgroundMedia(details.row);
  const showBannerCaptureControls = Boolean(onCaptureBannerSnapshot) && hasCapturableBannerMedia;

  const productionVideoSrc = details.row.productionImage.trim();
  const bannerUsesLiveVideo = catalogVideoOgBannerShouldUseVideoElement({
    bannerImageUrl: presentation.bannerImageUrl,
    productionImage: details.row.productionImage,
    productionImageMime: details.row.productionImageMime,
  });
  const hiddenCaptureVideo =
    showBannerCaptureControls &&
    !isProductionBackgroundYoutubeMedia({
      url: productionVideoSrc,
      mime: details.row.productionImageMime,
    }) &&
    productionVideoSrc.length > 0 &&
    !bannerUsesLiveVideo;

  const captureSourceAttr = { [CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR]: '' };

  const bannerSlotClassName = details.tileBackgroundColor?.trim()
    ? `${CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME} !bg-transparent`
    : CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME;

  const bannerMedia = (
    <div className={bannerSlotClassName}>
      {hiddenCaptureVideo ? (
        <video
          {...captureSourceAttr}
          src={productionVideoSrc}
          className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-0"
          muted
          playsInline
          preload="auto"
          aria-hidden
        />
      ) : null}
      <CatalogVideoOgBannerMedia
        previewLayout
        bannerImageUrl={presentation.bannerImageUrl}
        productionImage={details.row.productionImage}
        productionImageMime={details.row.productionImageMime}
        backgroundColor={details.row.backgroundColor}
        markBannerCaptureSource={showBannerCaptureControls && bannerUsesLiveVideo}
        suppressPlayOverlay={hasSnapshot}
      />
      {showBannerCaptureControls && hasSnapshot && snapshot ? (
        <div
          {...{ [CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_ATTR]: '' }}
          className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0f172a]"
          role="img"
          aria-label={`Banner snapshot preview (${snapshotLabel})`}
        >
          <IpfsImg
            key={`${snapshot.mode}:${snapshot.dataUrl.length}`}
            src={snapshot.dataUrl}
            alt=""
            className={CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_CLASSNAME}
            draggable={false}
          />
          {snapshotLabel ? (
            <p className="absolute bottom-2 left-2 z-[11] rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              {snapshotLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={ogCard.className} style={ogCard.style}>
      {showBannerCaptureControls ? (
        <CatalogVideoOgPreviewBannerCaptureOverlay
          exportWidth={bannerExportWidth}
          exportHeight={bannerHeightPx}
          disabled={bannerCaptureDisabled}
          activeSnapshotMode={snapshot?.mode ?? null}
          onCaptured={handleCaptureBannerSnapshot}
        >
          {bannerMedia}
        </CatalogVideoOgPreviewBannerCaptureOverlay>
      ) : (
        bannerMedia
      )}
      <BusinessCatalogVideoOgBelowBannerRow {...details} ogSharePreviewLayout />
    </div>
  );
}

/** Static image background — 4:3 hero (upload parity), metadata below. */
export function BusinessCatalogImageHeroPreviewBlock(
  props: BusinessCatalogVideoOgPreviewDetailsProps & {
    bannerCaptureDisabled?: boolean;
    catalogBannerPreviewSnapshot?: CatalogBannerPreviewSnapshot | null;
    onCaptureBannerSnapshot?: (args: CatalogBannerPreviewSnapshot) => void | Promise<void>;
  }
) {
  const { bannerCaptureDisabled, catalogBannerPreviewSnapshot, onCaptureBannerSnapshot, ...details } = props;
  const { tu } = useTu();
  const imageUrl = details.row.productionImage.trim();
  const ogCard = catalogPreviewOgCardSurface(details.tileBackgroundColor);
  const heroSize = catalogVideoOgPreviewHeroDisplaySize();
  const hasCapturableBannerMedia = catalogProductionHasUploadedBackgroundMedia(details.row);
  const showBannerCaptureControls = Boolean(onCaptureBannerSnapshot) && hasCapturableBannerMedia;

  const [liveSnapshot, setLiveSnapshot] = useState<CatalogBannerPreviewSnapshot | null>(
    catalogBannerPreviewSnapshot ?? null
  );
  useEffect(() => {
    setLiveSnapshot(catalogBannerPreviewSnapshot ?? null);
  }, [catalogBannerPreviewSnapshot?.dataUrl, catalogBannerPreviewSnapshot?.mode]);

  const handleCaptureBannerSnapshot = useCallback(
    async (args: CatalogBannerPreviewSnapshot) => {
      setLiveSnapshot(args);
      await onCaptureBannerSnapshot?.(args);
    },
    [onCaptureBannerSnapshot]
  );

  const snapshot = liveSnapshot;
  const hasSnapshot = Boolean(snapshot?.dataUrl?.trim());
  const snapshotLabel =
    snapshot?.mode === 'width'
      ? tu('programs_preview_width_fit')
      : snapshot?.mode === 'height'
        ? tu('programs_preview_height_fit')
        : '';
  const captureSourceAttr = { [CATALOG_VIDEO_OG_BANNER_CAPTURE_SOURCE_ATTR]: '' };

  const bannerMedia = (
    <div className={CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME}>
      {imageUrl ? (
        <IpfsImg
          src={imageUrl}
          alt=""
          className={CATALOG_VIDEO_OG_PREVIEW_BANNER_MEDIA_CLASSNAME}
          draggable={false}
          {...(showBannerCaptureControls ? captureSourceAttr : {})}
        />
      ) : null}
      {showBannerCaptureControls && hasSnapshot && snapshot ? (
        <div
          {...{ [CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_ATTR]: '' }}
          className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0f172a]"
          role="img"
          aria-label={`Banner snapshot preview (${snapshotLabel})`}
        >
          <IpfsImg
            key={`${snapshot.mode}:${snapshot.dataUrl.length}`}
            src={snapshot.dataUrl}
            alt=""
            className={CATALOG_VIDEO_OG_BANNER_SNAPSHOT_PREVIEW_CLASSNAME}
            draggable={false}
          />
          {snapshotLabel ? (
            <p className="absolute bottom-2 left-2 z-[11] rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              {snapshotLabel}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={ogCard.className} style={ogCard.style}>
      {showBannerCaptureControls ? (
        <CatalogVideoOgPreviewBannerCaptureOverlay
          exportWidth={heroSize.width}
          exportHeight={heroSize.height}
          disabled={bannerCaptureDisabled}
          activeSnapshotMode={snapshot?.mode ?? null}
          onCaptured={handleCaptureBannerSnapshot}
        >
          {bannerMedia}
        </CatalogVideoOgPreviewBannerCaptureOverlay>
      ) : (
        bannerMedia
      )}
      <BusinessCatalogVideoOgBelowBannerRow {...details} ogSharePreviewLayout />
    </div>
  );
}

/**
 * Catalog Distribution / QR modal — same 4:3 hero as Business Catalogs preview (no below-banner right thumb).
 * See `beamio-catalog-video-og-thumbnail.mdc`.
 */
export function CatalogVideoOgOpenClaimSharePreview(props: BusinessCatalogVideoOgPreviewDetailsProps) {
  const presentation = resolveCatalogProductionSharePresentation({
    row: props.row,
    publisherBeamioTag: props.publisherBeamioTag,
  });

  return (
    <div className={`${CATALOG_VIDEO_OG_PREVIEW_OG_CARD_CLASSNAME} mx-auto w-full max-w-[32rem]`}>
      <div className={CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME}>
        <CatalogVideoOgBannerMedia
          previewLayout
          bannerImageUrl={presentation.bannerImageUrl}
          productionImage={props.row.productionImage}
          productionImageMime={props.row.productionImageMime}
          backgroundColor={props.row.backgroundColor}
        />
      </div>
      <BusinessCatalogVideoOgBelowBannerRow
        {...props}
        ogSharePreviewLayout
        shareDistributionTicket
      />
    </div>
  );
}

/** Catalog list + editor preview: video banner + metadata (Business Catalogs preview rules). */
export function BusinessCatalogVideoOgListItemBody(props: {
  row: CardIssuanceProductionRow;
  serviceCategories: ProductionServiceCategoryOption[];
  moneyPrefix: string;
  catalogPublisherBeamioTag?: string;
}) {
  const { row, serviceCategories, moneyPrefix, catalogPublisherBeamioTag } = props;
  const displayPrice = catalogProductionDisplayPrice(row);
  const itemCategoryLabel = productionItemCategoryLabel(row.itemCategory, serviceCategories);
  const showCatalogPrice = displayPrice != null && !isCatalogPriceOptionalCategory(row.globalCategory);
  const presentation = resolveCatalogProductionSharePresentation({
    row,
    publisherBeamioTag: catalogPublisherBeamioTag,
  });

  return (
    <>
      <div className={CATALOG_VIDEO_OG_PREVIEW_BANNER_SLOT_CLASSNAME}>
        <CatalogVideoOgBannerMedia
          previewLayout
          bannerImageUrl={presentation.bannerImageUrl}
          productionImage={row.productionImage}
          productionImageMime={row.productionImageMime}
          backgroundColor={row.backgroundColor}
        />
      </div>
      <BusinessCatalogVideoOgBelowBannerRow
        ogSharePreviewLayout
        row={row}
        publisherBeamioTag={catalogPublisherBeamioTag}
        itemCategoryLabel={itemCategoryLabel}
        displayPrice={displayPrice}
        moneyPrefix={moneyPrefix}
        showPrice={showCatalogPrice}
      />
    </>
  );
}

export function BusinessCatalogListItemPreviewContent(props: {
  row: CardIssuanceProductionRow;
  serviceCategories: ProductionServiceCategoryOption[];
  moneyPrefix: string;
  catalogPublisherBeamioTag?: string;
}) {
  const { row, serviceCategories, moneyPrefix, catalogPublisherBeamioTag } = props;
  const { tu } = useTu();
  const displayPrice = catalogProductionDisplayPrice(row);
  const backgroundKind = resolveProductionBackgroundMediaKind({
    url: row.productionImage,
    mime: row.productionImageMime,
  });
  const hasBackgroundMedia = row.productionImage.trim().length > 0;
  const youtubeOgListLayout = catalogProductionHasVideoBackgroundMedia(row);
  const itemCategoryLabel = productionItemCategoryLabel(row.itemCategory, serviceCategories);
  const showCatalogPrice = displayPrice != null && !isCatalogPriceOptionalCategory(row.globalCategory);
  const showIssuanceLine = catalogBusinessPreviewShowsIssuanceLine(row, true);

  if (youtubeOgListLayout) {
    return (
      <BusinessCatalogVideoOgBelowBannerRow
        ogSharePreviewLayout
        embeddedInListShell
        row={row}
        publisherBeamioTag={catalogPublisherBeamioTag}
        itemCategoryLabel={itemCategoryLabel}
        displayPrice={displayPrice}
        moneyPrefix={moneyPrefix}
        showPrice={showCatalogPrice}
      />
    );
  }

  return (
    <>
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white"
        style={
          backgroundKind === 'image' && hasBackgroundMedia
            ? {
                backgroundImage: `url(${row.productionImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { backgroundColor: row.backgroundColor || '#ea580c' }
        }
      >
        {backgroundKind === 'video' && hasBackgroundMedia ? (
          isProductionBackgroundYoutubeMedia({
            url: row.productionImage,
            mime: row.productionImageMime,
          }) ? (
            <IpfsImg
              src={youtubeThumbnailUrlFromProductionUrl(row.productionImage) ?? ''}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              aria-hidden
            />
          ) : (
            <video
              src={row.productionImage}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
              aria-hidden
            />
          )
        ) : null}
        {backgroundKind === 'pdf' && hasBackgroundMedia ? (
          <FileText className="relative z-[1] h-5 w-5" strokeWidth={2} aria-hidden />
        ) : null}
        {hasBackgroundMedia && backgroundKind !== 'pdf' ? null : !hasBackgroundMedia ? (
          <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-manrope text-base font-bold text-[#2c2f31]">
          {row.name.trim() || tu('programs_preview_catalog_item')}
        </p>
        {row.subtitle.trim() ? (
          <p className="truncate text-sm text-[#747779]">{row.subtitle}</p>
        ) : null}
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#ea580c]">
          {itemCategoryLabel}
        </p>
        {showCatalogPrice ? (
          <p className="mt-1 text-xs font-semibold text-[#595c5e]">
            {moneyPrefix}
            {displayPrice!.toFixed(2)}
          </p>
        ) : null}
        {showIssuanceLine ? (
          <p className="mt-0.5 text-[10px] font-semibold text-[#747779]">
            {tu('programs_preview_issuance')} {productionIssueTotalDisplayLabel(row)}
            {row.issued && row.issueLeft?.trim()
              ? ` · ${Number.parseInt(row.issueLeft.replace(/,/g, ''), 10).toLocaleString()} ${tu('programs_coupon_left').toLowerCase()}`
              : ''}
          </p>
        ) : null}
        {row.requiresRedeemCode ? (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ea580c]">
            {tu('programs_preview_redeem_code')}
          </p>
        ) : null}
      </div>
    </>
  );
}

export type BusinessCatalogEditorPreviewDraft = {
  editingId: string | null;
  name: string;
  subtitle: string;
  description: string;
  globalCategory: CatalogGlobalCategoryId;
  itemCategory: CardIssuanceProductionRow['itemCategory'];
  icon: string;
  backgroundColor: string;
  productionImage: string;
  productionImageMime?: string;
  productionVideoDraftUrl?: string;
  price: string;
  issueTotal: string;
  issueTotalUnlimited: boolean;
  requiresRedeemCode: boolean;
  editingIssued: boolean;
  catalogPriceOptional: boolean;
};

export function buildBusinessCatalogEditorPreviewRow(
  draft: BusinessCatalogEditorPreviewDraft
): CardIssuanceProductionRow {
  const productionImage = draft.productionImage.trim() || draft.productionVideoDraftUrl?.trim() || '';
  const productionImageMime =
    draft.productionImageMime?.trim() ||
    (productionImage && draft.productionVideoDraftUrl?.trim() && !draft.productionImage.trim()
      ? 'video/mp4'
      : undefined);

  return makeCardIssuanceProductionRow({
    id: draft.editingId ?? 'catalog-editor-preview',
    name: draft.name,
    subtitle: draft.subtitle,
    description: draft.description,
    globalCategory: draft.globalCategory,
    itemCategory: draft.itemCategory,
    icon: draft.icon,
    backgroundColor: draft.backgroundColor,
    productionImage,
    ...(productionImageMime ? { productionImageMime } : {}),
    singleSessionPrice: draft.catalogPriceOptional ? '0' : draft.price.trim() || '0',
    issueTotal: draft.issueTotal,
    issueTotalUnlimited: draft.issueTotalUnlimited,
    requiresRedeemCode: draft.requiresRedeemCode,
    issued: draft.editingIssued,
  });
}

function BusinessCatalogListItemStatusChip(props: { issued: boolean }) {
  const { tu } = useTu();
  return props.issued ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      {tu('programs_catalog_live')}
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
      {tu('programs_catalog_draft')}
    </span>
  );
}

export function BusinessCatalogListItemPreviewCard(props: {
  row: CardIssuanceProductionRow;
  serviceCategories: ProductionServiceCategoryOption[];
  moneyPrefix: string;
  catalogPublisherBeamioTag?: string;
  globalCategoryHint?: string;
  bannerCaptureDisabled?: boolean;
  catalogBannerPreviewSnapshot?: CatalogBannerPreviewSnapshot | null;
  onCaptureBannerSnapshot?: (args: CatalogBannerPreviewSnapshot) => void | Promise<void>;
}) {
  const {
    row,
    serviceCategories,
    moneyPrefix,
    catalogPublisherBeamioTag,
    globalCategoryHint,
    bannerCaptureDisabled,
    catalogBannerPreviewSnapshot,
    onCaptureBannerSnapshot,
  } = props;
  const { tu } = useTu();
  const displayPrice = catalogProductionDisplayPrice(row);
  const itemCategoryLabel = productionItemCategoryLabel(row.itemCategory, serviceCategories);
  const showCatalogPrice = displayPrice != null && !isCatalogPriceOptionalCategory(row.globalCategory);
  const videoOgPreview = catalogProductionHasVideoBackgroundMedia(row);
  const imageHeroPreview = catalogProductionBusinessPreviewHasHeroImage(row);
  const tileBackgroundColor = effectiveTileBackgroundColorForMetadata({
    photo: row.productionImage,
    backgroundColor: row.backgroundColor,
  });
  const colorOnlyCatalogPreview = Boolean(tileBackgroundColor) && !videoOgPreview && !imageHeroPreview;
  const compactPreviewCard = catalogPreviewOgCardSurface(tileBackgroundColor);

  const videoOgDetails: BusinessCatalogVideoOgPreviewDetailsProps = {
    row,
    publisherBeamioTag: catalogPublisherBeamioTag,
    itemCategoryLabel,
    displayPrice,
    moneyPrefix,
    showPrice: showCatalogPrice,
    tileBackgroundColor,
  };

  return (
    <div role="region" aria-label={tu('programs_catalog_preview_label')} className="w-full">
      {videoOgPreview || colorOnlyCatalogPreview ? (
        <div className="relative mx-auto w-full max-w-[32rem]">
          <BusinessCatalogVideoOgPreviewBlock
            {...videoOgDetails}
            bannerCaptureDisabled={bannerCaptureDisabled}
            catalogBannerPreviewSnapshot={catalogBannerPreviewSnapshot}
            onCaptureBannerSnapshot={onCaptureBannerSnapshot}
          />
          <div className="pointer-events-none absolute right-3 top-3 z-10">
            <BusinessCatalogListItemStatusChip issued={row.issued} />
          </div>
        </div>
      ) : imageHeroPreview ? (
        <div className="relative mx-auto w-full max-w-[32rem]">
          <BusinessCatalogImageHeroPreviewBlock
            {...videoOgDetails}
            bannerCaptureDisabled={bannerCaptureDisabled}
            catalogBannerPreviewSnapshot={catalogBannerPreviewSnapshot}
            onCaptureBannerSnapshot={onCaptureBannerSnapshot}
          />
          <div className="pointer-events-none absolute right-3 top-3 z-10">
            <BusinessCatalogListItemStatusChip issued={row.issued} />
          </div>
        </div>
      ) : (
        <div
          className={`${compactPreviewCard.className} relative flex w-full items-start gap-3 p-4`}
          style={compactPreviewCard.style}
        >
          <div className="min-w-0 flex-1">
            <BusinessCatalogVideoOgPreviewDetails {...videoOgDetails} ogSharePreviewLayout />
          </div>
          <BusinessCatalogListItemStatusChip issued={row.issued} />
        </div>
      )}
      {globalCategoryHint ? (
        <p className="mx-auto mt-2 max-w-[32rem] text-[10px] font-semibold text-[#747779]">
          {tu('programs_preview_listed_under', { category: globalCategoryHint })}
        </p>
      ) : null}
    </div>
  );
}
