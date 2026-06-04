import { AnimatePresence, motion } from 'framer-motion';
import { IpfsImg } from '@/components/IpfsImg';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Gift,
  ImagePlus,
  Link2,
  Loader2,
  Package,
  Pencil,
  Play,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_DEFAULT,
  CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX,
  CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX,
  CATALOG_GLOBAL_CATEGORY_OPTIONS,
  PRODUCTION_ITEM_COLOR_PRESETS,
  catalogGlobalCategoryLabel,
  groupCatalogBaseProductionsByGlobalCategory,
  catalogPackageDealsForBase,
  catalogProductionBaseScanNftLabel,
  catalogProductionNftExplorerLink,
  catalogProductionNftExplorerTitle,
  catalogProductionDisplayPrice,
  computePackagePerSessionPrice,
  isCatalogBaseProductionRow,
  isCatalogPriceOptionalCategory,
  isSalesManagementCatalogCategory,
  isShareLinkCatalogCategory,
  parseProductionIssueLeftN,
  resolveProductionBackgroundMediaKind,
  catalogEditorTileBackgroundColorApplies,
  type CardIssuanceProductionRow,
  type CatalogGlobalCategoryId,
  type CatalogPackageDealDraft,
  type ProductionServiceCategoryId,
  type ProductionServiceCategoryOption,
} from './cardIssuanceProductions';
import { IPFS_PRODUCTION_BACKGROUND_ACCEPT } from '@/utils/ipfsCardImageUpload';
import {
  ProgramsIssuedItemClaimWalletsSection,
  type ProgramsIssuedItemClaimWalletsView,
} from './programsIssuedItemClaimWallets';
import {
  isProductionBackgroundYoutubeMedia,
  isYoutubeProductionVideoUrl,
  youtubeEmbedUrlFromProductionUrl,
} from '@/utils/youtubeProductionVideo';
import {
  PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS,
  formatProductionVideoTimeSec,
  isUploadedProductionBackgroundVideo,
} from '@/utils/productionBackgroundVideo';
import type { ProductionVideoFrameThumbnail } from '@/utils/productionBackgroundVideo';
import { ProductionVideoFilmstripTrimEditor } from './ProductionVideoFilmstripTrimEditor';
import {
  createNumericInputWheelNonPassiveRefCallback,
  preventNumericInputStepKeys,
  preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys';
import { catalogProductionHasVideoBackgroundMedia } from '@/utils/catalogProductionVideoOg';
import {
  buildBusinessCatalogEditorPreviewRow,
  BusinessCatalogListItemPreviewCard,
  BusinessCatalogListItemPreviewContent,
  BusinessCatalogVideoOgListItemBody,
} from './businessCatalogListItemPreview';

const bizFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/40 focus-visible:ring-offset-2';

const CATALOG_PRODUCTION_REDEEM_PAGE_SIZE = 10;

function formatCatalogProductionRedeemDate(ts: number | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return '—';
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export type CatalogProductionRedeemItemView = {
  code: string;
  hash: string;
  createdAt?: number;
  redeemedAt?: number;
};

function ClickToPlayProductionVideo(props: {
  src: string;
  startSec?: number;
  className?: string;
  showControlsAfterPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const startSec = props.startSec != null && Number.isFinite(props.startSec) ? Math.max(0, props.startSec) : 0;

  useEffect(() => {
    setHasStartedPlayback(false);
  }, [props.src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasStartedPlayback) return;
    try {
      video.currentTime = startSec;
    } catch {
      /* ignore seek before metadata */
    }
  }, [startSec, hasStartedPlayback, props.src]);

  const handleOverlayPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.currentTime = startSec;
    } catch {
      /* ignore */
    }
    void video
      .play()
      .then(() => {
        setHasStartedPlayback(true);
      })
      .catch(() => undefined);
  }, [startSec]);

  const showNativeControls = props.showControlsAfterPlay !== false && hasStartedPlayback;

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        src={props.src}
        className={props.className ?? 'h-full w-full object-cover'}
        playsInline
        preload="metadata"
        controls={showNativeControls}
        onPlay={() => setHasStartedPlayback(true)}
        onEnded={() => undefined}
      />
      {!hasStartedPlayback ? (
        <button
          type="button"
          onClick={handleOverlayPlay}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-white transition hover:bg-black/45 ${bizFocusRingClass}`}
          aria-label="Play video"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#2c2f31] shadow-md">
            <Play className="ml-0.5 h-6 w-6" strokeWidth={2.4} fill="currentColor" aria-hidden />
          </span>
          {startSec > 0 ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">
              Starts at {formatProductionVideoTimeSec(startSec)}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

function ProductionBackgroundMediaDeleteButton(props: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-45 ${bizFocusRingClass}`}
      aria-label="Remove background media"
    >
      <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );
}

function ProductionBackgroundMediaPreview(props: {
  url: string;
  mime?: string;
  startSec?: number;
  className?: string;
  imgClassName?: string;
}) {
  const kind = resolveProductionBackgroundMediaKind({ url: props.url, mime: props.mime });
  if (isProductionBackgroundYoutubeMedia({ url: props.url, mime: props.mime })) {
    const embedUrl = youtubeEmbedUrlFromProductionUrl(props.url);
    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          title="YouTube background video"
          className={props.className ?? 'h-full w-full border-0'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      );
    }
  }
  if (kind === 'video') {
    return (
      <ClickToPlayProductionVideo
        src={props.url}
        startSec={props.startSec}
        className={props.className ?? 'h-full w-full object-cover'}
      />
    );
  }
  if (kind === 'pdf') {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[#eef1f3] px-3 text-[#595c5e] ${props.className ?? ''}`}
      >
        <FileText className="h-8 w-8 shrink-0" strokeWidth={2} aria-hidden />
        <span className="text-center text-[11px] font-semibold">PDF uploaded</span>
        <a
          href={props.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-bold text-[#ea580c] underline"
        >
          Open PDF
        </a>
      </div>
    );
  }
  return (
    <IpfsImg
      src={props.url}
      alt=""
      className={props.imgClassName ?? props.className ?? 'h-full w-full object-cover'}
    />
  );
}

export type ProgramsProductionsPanelProps = {
  catalogOpen: boolean;
  /** Upper kicker above the catalog title (sidebar section label). */
  sectionKicker?: string;
  onCloseCatalog: () => void;
  editorOpen: boolean;
  editingId: string | null;
  onCloseEditor: () => void;
  onOpenCreate: () => void;
  onOpenEdit: (id: string) => void;
  onOpenShare?: (id: string) => void;
  /** BeamioUserCard address — used for Blockscout NFT links on live catalog items. */
  programCardAddress?: string;
  /** Merchant @beamioTag for video catalog rows (publisher line under YouTube OG body). */
  catalogPublisherBeamioTag?: string;
  productions: CardIssuanceProductionRow[];
  serviceCategories: ProductionServiceCategoryOption[];
  onUpdateServiceCategoryLabel: (categoryId: string, label: string) => boolean | Promise<boolean>;
  onAddServiceCategory: () => { id: string; label: string };
  onDiscardDraftServiceCategory: (categoryId: string) => void;
  serviceCategoryEditError: string;
  serviceCategorySavingId: string | null;
  globalCategory: CatalogGlobalCategoryId;
  setGlobalCategory: (v: CatalogGlobalCategoryId) => void;
  icon: string;
  iconUploading: boolean;
  onIconFileChange: React.ChangeEventHandler<HTMLInputElement>;
  onSelectVideoFrameAsIcon?: (frame: ProductionVideoFrameThumbnail) => void | Promise<void>;
  onCaptureCatalogBannerSnapshot?: (args: {
    dataUrl: string;
    mode: 'width' | 'height';
  }) => void | Promise<void>;
  catalogBannerPreviewSnapshot?: { dataUrl: string; mode: 'width' | 'height' } | null;
  bannerCaptureDisabled?: boolean;
  onClearIcon: () => void;
  productionImage: string;
  productionImageMime?: string;
  productionImageStartSec?: number;
  productionImageUploading: boolean;
  onProductionImageFileChange: React.ChangeEventHandler<HTMLInputElement>;
  onProductionBackgroundMediaFile?: (file: File) => void | Promise<void>;
  onImportYoutubeProductionVideo?: (url: string) => void | Promise<void>;
  onClearProductionImage: () => void;
  productionVideoDraftUrl?: string;
  productionVideoDraftFile?: File | null;
  /** Set when picked video exceeds 60s — drives trim UI (source of truth from pick handler). */
  productionVideoClipEditRequired?: boolean;
  productionVideoTrimConfirmed?: boolean;
  onProductionVideoTrimConfirm?: () => void;
  onProductionVideoTrimEdit?: () => void;
  productionVideoUploadProgress?: number;
  productionVideoSourceDurationSec?: number;
  productionVideoStartSec?: number;
  setProductionVideoStartSec?: (value: number) => void;
  productionVideoProcessingMessage?: string;
  /** True while ffmpeg/WebCodecs converts background video (not during IPFS upload). */
  productionVideoFfmpegBusy?: boolean;
  onCancelProductionVideoDraft?: () => void;
  onConfirmProductionVideoUpload?: () => void;
  backgroundColor: string;
  setBackgroundColor: (v: string) => void;
  moneyPrefix: string;
  name: string;
  setName: (v: string) => void;
  subtitle: string;
  setSubtitle: (v: string) => void;
  itemCategory: ProductionServiceCategoryId;
  setItemCategory: (v: ProductionServiceCategoryId) => void;
  price: string;
  setPrice: (v: string) => void;
  packageDeals: CatalogPackageDealDraft[];
  onAddPackageDeal: () => void;
  onUpdatePackageDeal: (
    id: string,
    patch: Partial<Pick<CatalogPackageDealDraft, 'packageSessions' | 'packageBonusSessions' | 'packageTotalPrice'>>
  ) => void;
  onRemovePackageDeal: (id: string) => void;
  issueTotal: string;
  setIssueTotal: (v: string) => void;
  issueTotalUnlimited: boolean;
  setIssueTotalUnlimited: (v: boolean) => void;
  requiresRedeemCode: boolean;
  setRequiresRedeemCode: (v: boolean) => void;
  description: string;
  setDescription: (v: string) => void;
  editorError: string;
  publishing: boolean;
  editingIssued: boolean;
  onSubmit: () => void;
  onDeleteDraft: (id: string) => void;
  productionRedeemRowsByProductionId?: Map<string, CatalogProductionRedeemItemView[]>;
  onRegisterProductionRedeemCodes?: (productionId: string) => void;
  productionRedeemBatchQty?: Record<string, string>;
  onProductionRedeemBatchQtyChange?: (productionId: string, value: string) => void;
  productionRedeemRegisteringId?: string | null;
  productionRedeemStatuses?: Record<string, 'pending' | 'redeemed'>;
  productionRedeemStatusLoading?: boolean;
  onOpenProductionRedeemShare?: (productionId: string, row: CatalogProductionRedeemItemView) => void;
  productionRedeemCopiedHash?: string | null;
  onProductionRedeemCodeCopied?: (hash: string) => void;
  /** Aligns with coupon redeem grace before showing Redeemed from local `redeemedAt`. */
  productionRedeemChainConfirmGraceMs?: number;
  getProductionClaimWalletView?: (productionId: string) => ProgramsIssuedItemClaimWalletsView;
  onLoadProductionClaimWallets?: (productionId: string, tokenId: string, page: number) => void;
};

export function ProgramsProductionsPanel(props: ProgramsProductionsPanelProps) {
  const {
    catalogOpen,
    sectionKicker = 'Business',
    onCloseCatalog,
    editorOpen,
    editingId,
    onCloseEditor,
    onOpenCreate,
    onOpenEdit,
    onOpenShare,
    programCardAddress,
    catalogPublisherBeamioTag,
    productions,
    serviceCategories,
    onUpdateServiceCategoryLabel,
    onAddServiceCategory,
    onDiscardDraftServiceCategory,
    serviceCategoryEditError,
    serviceCategorySavingId,
    globalCategory,
    setGlobalCategory,
    icon,
    iconUploading,
    onIconFileChange,
    onSelectVideoFrameAsIcon,
    onCaptureCatalogBannerSnapshot,
    catalogBannerPreviewSnapshot = null,
    bannerCaptureDisabled = false,
    onClearIcon,
    productionImage,
    productionImageMime,
    productionImageStartSec,
    productionImageUploading,
    onProductionImageFileChange,
    onProductionBackgroundMediaFile,
    onImportYoutubeProductionVideo,
    onClearProductionImage,
    productionVideoDraftUrl = '',
    productionVideoDraftFile = null,
    productionVideoClipEditRequired = false,
    productionVideoTrimConfirmed = false,
    onProductionVideoTrimConfirm,
    onProductionVideoTrimEdit,
    productionVideoUploadProgress = 0,
    productionVideoSourceDurationSec = 0,
    productionVideoStartSec = 0,
    setProductionVideoStartSec,
    productionVideoProcessingMessage = '',
    productionVideoFfmpegBusy = false,
    onCancelProductionVideoDraft,
    backgroundColor,
    setBackgroundColor,
    moneyPrefix,
    name,
    setName,
    subtitle,
    setSubtitle,
    itemCategory,
    setItemCategory,
    price,
    setPrice,
    packageDeals,
    onAddPackageDeal,
    onUpdatePackageDeal,
    onRemovePackageDeal,
    issueTotal,
    setIssueTotal,
    issueTotalUnlimited,
    setIssueTotalUnlimited,
    requiresRedeemCode,
    setRequiresRedeemCode,
    description,
    setDescription,
    editorError,
    publishing,
    editingIssued,
    onSubmit,
    onDeleteDraft,
    productionRedeemRowsByProductionId,
    onRegisterProductionRedeemCodes,
    productionRedeemBatchQty = {},
    onProductionRedeemBatchQtyChange,
    productionRedeemRegisteringId = null,
    productionRedeemStatuses = {},
    productionRedeemStatusLoading = false,
    onOpenProductionRedeemShare,
    productionRedeemCopiedHash = null,
    onProductionRedeemCodeCopied,
    productionRedeemChainConfirmGraceMs = 3 * 60_000,
    getProductionClaimWalletView,
    onLoadProductionClaimWallets,
  } = props;

  const [productionRedeemPageById, setProductionRedeemPageById] = useState<Record<string, number>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState('');
  const productionImageFileRef = useRef<HTMLInputElement>(null);
  const [backgroundMediaDragOver, setBackgroundMediaDragOver] = useState(false);
  const backgroundMediaDragDepthRef = useRef(0);
  const [youtubeImportUrl, setYoutubeImportUrl] = useState('');
  const productionVideoNeedsClipEdit = productionVideoClipEditRequired;
  const productionVideoDraftPending = Boolean(productionVideoDraftUrl.trim());
  const productionBackgroundUploadLocked = productionImageUploading;

  const backgroundMediaDropDisabled =
    productionBackgroundUploadLocked || editingIssued || !onProductionBackgroundMediaFile;

  const handleBackgroundMediaDragEnter = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (backgroundMediaDropDisabled) return;
      e.preventDefault();
      e.stopPropagation();
      backgroundMediaDragDepthRef.current += 1;
      setBackgroundMediaDragOver(true);
    },
    [backgroundMediaDropDisabled]
  );

  const handleBackgroundMediaDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (backgroundMediaDropDisabled) return;
      e.preventDefault();
      e.stopPropagation();
      backgroundMediaDragDepthRef.current = Math.max(0, backgroundMediaDragDepthRef.current - 1);
      if (backgroundMediaDragDepthRef.current === 0) setBackgroundMediaDragOver(false);
    },
    [backgroundMediaDropDisabled]
  );

  const handleBackgroundMediaDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (backgroundMediaDropDisabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    },
    [backgroundMediaDropDisabled]
  );

  const handleBackgroundMediaDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      backgroundMediaDragDepthRef.current = 0;
      setBackgroundMediaDragOver(false);
      if (backgroundMediaDropDisabled) return;
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      void onProductionBackgroundMediaFile(file);
    },
    [backgroundMediaDropDisabled, onProductionBackgroundMediaFile]
  );
  const productionBackgroundBlocksCatalogSubmit =
    productionBackgroundUploadLocked ||
    (productionVideoDraftPending &&
      productionVideoNeedsClipEdit &&
      !productionImage.trim());
  const issueTotalWheelRef = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), []);
  const numericNoSpinnerClass =
    '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]';
  const backgroundColorPickerValue =
    backgroundColor.trim().startsWith('#') ? backgroundColor.trim() : `#${backgroundColor.trim() || 'ea580c'}`;
  const salesManagementCatalog = isSalesManagementCatalogCategory(globalCategory);
  const shareLinkCatalog = isShareLinkCatalogCategory(globalCategory);
  const catalogPriceOptional = isCatalogPriceOptionalCategory(globalCategory);

  const uploadedBackgroundVideo = isUploadedProductionBackgroundVideo({
    productionImage,
    productionImageMime,
    productionVideoDraftUrl,
  });
  const catalogTileBackgroundColorEditorVisible = catalogEditorTileBackgroundColorApplies({
    productionImage,
    productionImageMime,
    productionVideoDraftUrl,
  });
  const catalogBaseProductionCount = useMemo(
    () => productions.filter(isCatalogBaseProductionRow).length,
    [productions]
  );
  const catalogProductionGroupsByGlobalCategory = useMemo(
    () => groupCatalogBaseProductionsByGlobalCategory(productions),
    [productions]
  );

  const catalogEditorPreviewRow = useMemo(
    () =>
      buildBusinessCatalogEditorPreviewRow({
        editingId,
        name,
        subtitle,
        description,
        globalCategory,
        itemCategory,
        icon,
        backgroundColor,
        productionImage,
        productionImageMime,
        productionVideoDraftUrl,
        price,
        issueTotal,
        issueTotalUnlimited,
        requiresRedeemCode,
        editingIssued,
        catalogPriceOptional,
      }),
    [
      editingId,
      name,
      subtitle,
      description,
      globalCategory,
      itemCategory,
      icon,
      backgroundColor,
      productionImage,
      productionImageMime,
      productionVideoDraftUrl,
      price,
      issueTotal,
      issueTotalUnlimited,
      requiresRedeemCode,
      editingIssued,
      catalogPriceOptional,
    ]
  );

  useEffect(() => {
    if (!editorOpen) {
      setEditingCategoryId(null);
      setEditingCategoryLabel('');
      setYoutubeImportUrl('');
    }
  }, [editorOpen]);

  useEffect(() => {
    if (
      productionImage.trim() &&
      isProductionBackgroundYoutubeMedia({ url: productionImage, mime: productionImageMime })
    ) {
      setYoutubeImportUrl('');
    }
  }, [productionImage, productionImageMime]);

  const youtubeImportUrlValid = isYoutubeProductionVideoUrl(youtubeImportUrl);

  const runYoutubeProductionVideoImport = useCallback(() => {
    const url = youtubeImportUrl.trim();
    if (
      !url ||
      !onImportYoutubeProductionVideo ||
      productionBackgroundUploadLocked ||
      !isYoutubeProductionVideoUrl(url)
    ) {
      return;
    }
    void onImportYoutubeProductionVideo(url);
  }, [
    onImportYoutubeProductionVideo,
    productionBackgroundUploadLocked,
    youtubeImportUrl,
  ]);

  const hasBackgroundMediaContent =
    Boolean(productionImage.trim()) || Boolean(productionVideoDraftUrl?.trim());
  const showBackgroundMediaYoutubeImport =
    Boolean(onImportYoutubeProductionVideo) &&
    !hasBackgroundMediaContent &&
    !(productionVideoNeedsClipEdit && productionVideoDraftPending && !productionImage.trim()) &&
    !(productionImageUploading && !productionVideoDraftUrl && !productionImage.trim());

  const cancelCategoryEdit = useCallback(() => {
    if (editingCategoryId) {
      onDiscardDraftServiceCategory(editingCategoryId);
    }
    setEditingCategoryId(null);
    setEditingCategoryLabel('');
  }, [editingCategoryId, onDiscardDraftServiceCategory]);

  const saveCategoryEdit = useCallback(
    async (categoryId: string) => {
      const label = editingCategoryLabel.trim();
      if (!label) return;
      const ok = await onUpdateServiceCategoryLabel(categoryId, label);
      if (ok) {
        setEditingCategoryId(null);
        setEditingCategoryLabel('');
      }
    },
    [editingCategoryLabel, onUpdateServiceCategoryLabel]
  );

  const handleAddServiceCategory = useCallback(() => {
    const created = onAddServiceCategory();
    setEditingCategoryId(created.id);
    setEditingCategoryLabel(created.label);
  }, [onAddServiceCategory]);

  return (
    <AnimatePresence>
      {catalogOpen ? (
        <>
          <motion.button
            type="button"
            aria-label="Close productions catalog"
            className="fixed inset-0 z-[94] bg-[#2c2f31]/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseCatalog}
          />
          <motion.div
            className="fixed inset-0 z-[95] flex w-full flex-col bg-[#f8fafc] shadow-[-24px_0_64px_rgba(0,0,0,0.14)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className="shrink-0 border-b border-[#e5e9eb]/80 bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={onCloseCatalog}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#abadaf]/30 bg-white text-[#747779] ${bizFocusRingClass}`}
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ea580c]">{sectionKicker}</p>
                    <h2 className="font-manrope text-lg font-extrabold tracking-tight text-[#2c2f31] sm:text-xl">
                      Catalogs
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenCreate}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-full bg-[#ea580c] px-4 text-xs font-bold text-white shadow-sm ${bizFocusRingClass}`}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                    Add
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                {catalogBaseProductionCount === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#abadaf]/40 bg-white p-8 text-center">
                    <Package className="mx-auto h-10 w-10 text-[#ea580c]/70" strokeWidth={1.6} aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-[#2c2f31]">No item in your catalog yet</p>
                
                    <button
                      type="button"
                      onClick={onOpenCreate}
                      className={`mt-4 inline-flex items-center gap-2 rounded-full bg-[#ea580c] px-5 py-2.5 text-sm font-bold text-white ${bizFocusRingClass}`}
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                      Add item
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {catalogProductionGroupsByGlobalCategory.map(({ globalCategory: groupCategory, rows }) => (
                      <section key={groupCategory}>
                        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                          {catalogGlobalCategoryLabel(groupCategory)}
                          <span className="ml-2 font-semibold text-[#abadaf]">({rows.length})</span>
                        </h3>
                        <ul className="space-y-3">
                          {rows.map((row) => {
                      const packageRows = catalogPackageDealsForBase(productions, row);
                      const nftExplorerLink =
                        row.issued && row.issuedTokenId?.trim()
                          ? catalogProductionNftExplorerLink(
                              programCardAddress,
                              row.issuedTokenId,
                              row.issuedNftMintedCount
                            )
                          : null;
                      const catalogVideoOgListLayout = catalogProductionHasVideoBackgroundMedia(row);
                      return (
                        <li
                          key={row.id}
                          className="overflow-hidden rounded-2xl border border-[#ea580c]/15 bg-white shadow-sm"
                        >
                          {catalogVideoOgListLayout ? (
                            <button
                              type="button"
                              onClick={() => onOpenEdit(row.id)}
                              className={`block w-full text-left ${bizFocusRingClass}`}
                            >
                              <BusinessCatalogVideoOgListItemBody
                                row={row}
                                serviceCategories={serviceCategories}
                                moneyPrefix={moneyPrefix}
                                catalogPublisherBeamioTag={catalogPublisherBeamioTag}
                              />
                            </button>
                          ) : null}
                          <div
                            className={`flex w-full flex-wrap items-center gap-2 ${catalogVideoOgListLayout ? 'px-4 pb-4 pt-2' : 'items-start gap-3 p-4'}`}
                          >
                            {!catalogVideoOgListLayout ? (
                            <button
                              type="button"
                              onClick={() => onOpenEdit(row.id)}
                              className={`flex min-w-0 flex-1 items-start gap-3 text-left ${bizFocusRingClass}`}
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-3">
                                <BusinessCatalogListItemPreviewContent
                                  row={row}
                                  serviceCategories={serviceCategories}
                                  moneyPrefix={moneyPrefix}
                                  catalogPublisherBeamioTag={catalogPublisherBeamioTag}
                                />
                              </div>
                            {row.issued ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                                Live
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
                                Draft
                              </span>
                            )}
                            </button>
                            ) : (
                              <>
                            {row.issued ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-800">
                                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                                Live
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
                                Draft
                              </span>
                            )}
                              </>
                            )}
                            {nftExplorerLink ? (
                              <a
                                href={nftExplorerLink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-2.5 py-1 text-[10px] font-bold tracking-tight text-[#334155] transition-colors hover:border-[#94a3b8] hover:bg-white ${bizFocusRingClass}`}
                                aria-label={`View ${catalogProductionBaseScanNftLabel(row.issuedTokenId)} on ${nftExplorerLink.explorer === 'blockscout' ? 'Blockscout' : 'BaseScan'}`}
                                title={catalogProductionNftExplorerTitle(nftExplorerLink.explorer)}
                              >
                                {catalogProductionBaseScanNftLabel(row.issuedTokenId)}
                                <ExternalLink className="h-3 w-3 opacity-70" strokeWidth={2.2} aria-hidden />
                              </a>
                            ) : null}
                            {row.issued && !row.requiresRedeemCode && onOpenShare ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenShare(row.id);
                                }}
                                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#ea580c] transition-colors hover:bg-[#ea580c]/10 ${bizFocusRingClass}`}
                                aria-label={`Show claim URL and QR for catalog item ${row.name}`}
                                title="Claim URL and QR"
                              >
                                <QrCode className="h-4 w-4" strokeWidth={2.1} aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          {packageRows.length > 0 ? (
                            <ul className="border-t border-[#ea580c]/10 bg-[#fafbfc] px-3 py-2 space-y-1.5">
                              {packageRows.map((pkg) => {
                                const pkgPrice = catalogProductionDisplayPrice(pkg);
                                const sessionsLabel = pkg.packageSessions.trim()
                                  ? `${pkg.packageSessions.trim()} sessions`
                                  : 'Package';
                                return (
                                  <li
                                    key={pkg.id}
                                    className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[#e5e9eb]"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#ea580c]">
                                        Package deal
                                      </p>
                                      <p className="text-xs font-semibold text-[#595c5e]">
                                        {sessionsLabel}
                                        {pkg.packageBonusSessions.trim() &&
                                        Number.parseInt(pkg.packageBonusSessions, 10) > 0
                                          ? ` (+${pkg.packageBonusSessions.trim()} free)`
                                          : ''}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                      {pkgPrice != null ? (
                                        <p className="text-xs font-bold text-[#2c2f31]">
                                          {moneyPrefix}
                                          {pkgPrice.toFixed(2)}
                                        </p>
                                      ) : null}
                                      {pkg.issued ? (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                                          Live
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700">
                                          Draft
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                          {row.requiresRedeemCode && row.issued && onRegisterProductionRedeemCodes ? (
                            (() => {
                              const redeemRows =
                                productionRedeemRowsByProductionId?.get(row.id) ?? [];
                              const productionIssueLeftN = parseProductionIssueLeftN(row);
                              const canRegisterProductionRedeem = productionIssueLeftN > 0;
                              const productionRedeemRegistering =
                                productionRedeemRegisteringId === row.id;
                              const productionRedeemBatchMax = Math.min(
                                productionIssueLeftN,
                                CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX
                              );
                              const productionRedeemBatchQtyRaw =
                                productionRedeemBatchQty[row.id] ?? '1';
                              const redeemPageCount = Math.max(
                                1,
                                Math.ceil(redeemRows.length / CATALOG_PRODUCTION_REDEEM_PAGE_SIZE)
                              );
                              const redeemPageRaw = productionRedeemPageById[row.id] ?? 1;
                              const redeemPage = Math.min(
                                Math.max(1, redeemPageRaw),
                                redeemPageCount
                              );
                              const redeemRowsPage = redeemRows.slice(
                                (redeemPage - 1) * CATALOG_PRODUCTION_REDEEM_PAGE_SIZE,
                                redeemPage * CATALOG_PRODUCTION_REDEEM_PAGE_SIZE
                              );
                              return (
                                <div className="border-t border-[#ea580c]/10 bg-white/70 px-3 py-3 sm:px-4 sm:py-3.5">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#595c5e]">
                                      Redeem codes
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      {productionRedeemStatusLoading && redeemRows.length > 0 ? (
                                        <Loader2
                                          className="h-3.5 w-3.5 animate-spin text-[#ea580c]"
                                          aria-hidden
                                        />
                                      ) : null}
                                      {canRegisterProductionRedeem ? (
                                        <>
                                          <input
                                            type="number"
                                            min={1}
                                            max={productionRedeemBatchMax}
                                            inputMode="numeric"
                                            autoComplete="off"
                                            enterKeyHint="done"
                                            value={productionRedeemBatchQtyRaw}
                                            disabled={productionRedeemRegistering}
                                            onChange={(e) =>
                                              onProductionRedeemBatchQtyChange?.(
                                                row.id,
                                                e.target.value
                                              )
                                            }
                                            onKeyDown={preventNumericInputStepKeys}
                                            onWheel={preventNumericInputWheelStep}
                                            className="h-7 w-12 rounded-lg border border-[#ea580c]/20 bg-white px-1.5 text-center text-[11px] font-semibold text-[#2c2f31] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-60"
                                            aria-label={`Batch count for ${row.name} redeem registration`}
                                            title={`Register up to ${productionRedeemBatchMax.toLocaleString()} codes per batch`}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => onRegisterProductionRedeemCodes(row.id)}
                                            disabled={productionRedeemRegistering}
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#ea580c] text-white shadow-sm transition-colors hover:bg-[#c2410c] disabled:opacity-60 ${bizFocusRingClass}`}
                                            aria-label={`Register redeem codes for ${row.name}`}
                                            title="Register redeem codes (batch)"
                                          >
                                            {productionRedeemRegistering ? (
                                              <Loader2
                                                className="h-3.5 w-3.5 animate-spin"
                                                strokeWidth={2.4}
                                                aria-hidden
                                              />
                                            ) : (
                                              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
                                            )}
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                  {redeemRows.length === 0 ? (
                                    <p className="text-[11px] font-medium leading-relaxed text-[#747779]">
                                      {canRegisterProductionRedeem
                                        ? `No redeem codes stored on this device yet. Enter a batch count (max ${CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX.toLocaleString()} per on-chain batch) and press + to register more while issuance remains.`
                                        : 'No redeem codes stored on this device. Codes are saved locally when this item is published live with redeem registration.'}
                                    </p>
                                  ) : (
                                    <>
                                      <div className="overflow-x-auto rounded-lg border border-[#ea580c]/10">
                                        <table className="min-w-full text-left text-[11px]">
                                          <thead className="bg-[#fff7ed] text-[9px] font-bold uppercase tracking-wider text-[#595c5e]">
                                            <tr>
                                              <th className="px-2.5 py-2 sm:px-3">Code</th>
                                              <th className="px-2.5 py-2 sm:px-3">Generated</th>
                                              <th className="px-2.5 py-2 sm:px-3">Status</th>
                                              <th className="px-2.5 py-2 sm:px-3">Redeemed</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-[#ea580c]/8 bg-white">
                                            {redeemRowsPage.map((redeemRow) => {
                                              const status =
                                                productionRedeemStatuses[redeemRow.hash] ??
                                                (redeemRow.redeemedAt &&
                                                (!redeemRow.createdAt ||
                                                  Date.now() - redeemRow.createdAt >=
                                                    productionRedeemChainConfirmGraceMs)
                                                  ? 'redeemed'
                                                  : 'pending');
                                              const statusLabel =
                                                status === 'pending' ? 'Available' : 'Redeemed';
                                              const statusClass =
                                                status === 'pending'
                                                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                                                  : 'bg-slate-100 text-slate-600 ring-slate-200';
                                              return (
                                                <tr
                                                  key={redeemRow.hash}
                                                  role={onOpenProductionRedeemShare ? 'button' : undefined}
                                                  tabIndex={onOpenProductionRedeemShare ? 0 : undefined}
                                                  onClick={
                                                    onOpenProductionRedeemShare
                                                      ? () => onOpenProductionRedeemShare(row.id, redeemRow)
                                                      : undefined
                                                  }
                                                  onKeyDown={
                                                    onOpenProductionRedeemShare
                                                      ? (e) => {
                                                          if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            onOpenProductionRedeemShare(row.id, redeemRow);
                                                          }
                                                        }
                                                      : undefined
                                                  }
                                                  className={
                                                    onOpenProductionRedeemShare
                                                      ? 'cursor-pointer transition-colors hover:bg-[#ea580c]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ea580c]/35'
                                                      : undefined
                                                  }
                                                  aria-label={
                                                    onOpenProductionRedeemShare
                                                      ? `Show redeem URL and QR for code ${redeemRow.code}`
                                                      : undefined
                                                  }
                                                >
                                                  <td className="px-2.5 py-2 sm:px-3">
                                                    <div className="flex min-w-[9rem] items-center gap-1.5">
                                                      <span className="truncate font-mono text-[10px] text-[#2c2f31] sm:text-[11px]">
                                                        {redeemRow.code}
                                                      </span>
                                                      {onProductionRedeemCodeCopied ? (
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            void navigator.clipboard
                                                              .writeText(redeemRow.code)
                                                              .then(() => {
                                                                onProductionRedeemCodeCopied(redeemRow.hash);
                                                              });
                                                          }}
                                                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#ea580c] transition-colors hover:bg-[#ea580c]/10 ${bizFocusRingClass}`}
                                                          aria-label={`Copy redeem code ${redeemRow.code}`}
                                                          title="Copy code"
                                                        >
                                                          {productionRedeemCopiedHash === redeemRow.hash ? (
                                                            <Check
                                                              className="h-3 w-3 text-emerald-500"
                                                              strokeWidth={2.5}
                                                              aria-hidden
                                                            />
                                                          ) : (
                                                            <Copy
                                                              className="h-3 w-3 opacity-70"
                                                              strokeWidth={2}
                                                              aria-hidden
                                                            />
                                                          )}
                                                        </button>
                                                      ) : null}
                                                    </div>
                                                  </td>
                                                  <td className="whitespace-nowrap px-2.5 py-2 text-[#595c5e] sm:px-3">
                                                    {formatCatalogProductionRedeemDate(redeemRow.createdAt)}
                                                  </td>
                                                  <td className="px-2.5 py-2 sm:px-3">
                                                    <span
                                                      className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${statusClass}`}
                                                    >
                                                      {statusLabel}
                                                    </span>
                                                  </td>
                                                  <td className="whitespace-nowrap px-2.5 py-2 text-[#595c5e] sm:px-3">
                                                    {status === 'redeemed'
                                                      ? formatCatalogProductionRedeemDate(redeemRow.redeemedAt)
                                                      : '—'}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                      {redeemPageCount > 1 ? (
                                        <div className="mt-2 flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            disabled={redeemPage <= 1}
                                            onClick={() =>
                                              setProductionRedeemPageById((prev) => ({
                                                ...prev,
                                                [row.id]: Math.max(1, redeemPage - 1),
                                              }))
                                            }
                                            className={`rounded-lg px-2 py-1 text-[10px] font-bold text-[#595c5e] disabled:opacity-40 ${bizFocusRingClass}`}
                                          >
                                            Prev
                                          </button>
                                          <span className="text-[10px] font-semibold text-[#747779]">
                                            {redeemPage} / {redeemPageCount}
                                          </span>
                                          <button
                                            type="button"
                                            disabled={redeemPage >= redeemPageCount}
                                            onClick={() =>
                                              setProductionRedeemPageById((prev) => ({
                                                ...prev,
                                                [row.id]: Math.min(redeemPageCount, redeemPage + 1),
                                              }))
                                            }
                                            className={`rounded-lg px-2 py-1 text-[10px] font-bold text-[#595c5e] disabled:opacity-40 ${bizFocusRingClass}`}
                                          >
                                            Next
                                          </button>
                                        </div>
                                      ) : null}
                                    </>
                                  )}
                                </div>
                              );
                            })()
                          ) : null}
                          {row.issued &&
                          row.issuedTokenId?.trim() &&
                          getProductionClaimWalletView &&
                          onLoadProductionClaimWallets ? (
                            <ProgramsIssuedItemClaimWalletsSection
                              theme="catalog"
                              mintedCount={row.issuedNftMintedCount}
                              view={getProductionClaimWalletView(row.id)}
                              onPageChange={(page) => {
                                onLoadProductionClaimWallets(row.id, row.issuedTokenId!.trim(), page);
                              }}
                              onRequestLoad={(page) => {
                                onLoadProductionClaimWallets(row.id, row.issuedTokenId!.trim(), page);
                              }}
                            />
                          ) : null}
                          {!row.issued ? (
                            <div className="border-t border-[#ea580c]/10 px-4 py-2">
                              <button
                                type="button"
                                onClick={() => onDeleteDraft(row.id)}
                                className={`text-xs font-semibold text-[#b31b25] ${bizFocusRingClass}`}
                              >
                                Remove draft
                              </button>
                            </div>
                          ) : null}
                        </li>
                      );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {editorOpen ? (
                <>
                  <motion.button
                    type="button"
                    aria-label="Close service editor"
                    className={`absolute inset-0 z-[2] bg-[#2c2f31]/25 ${
                      productionBackgroundUploadLocked ? 'pointer-events-none' : ''
                    }`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={productionBackgroundUploadLocked ? undefined : onCloseEditor}
                    aria-disabled={productionBackgroundUploadLocked}
                  />
                  <motion.div
                    className="absolute inset-0 z-[3] flex flex-col bg-[#f8fafc]"
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                  >
                    <header className="shrink-0 border-b border-[#e5e9eb]/80 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={onCloseEditor}
                          disabled={productionBackgroundUploadLocked}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[#747779] disabled:cursor-not-allowed disabled:opacity-40 ${bizFocusRingClass}`}
                          aria-label="Back"
                        >
                          <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
                        </button>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2c2f31]">
                          {editingId ? 'Edit item' : 'Add item'}
                        </p>
                        <button
                          type="button"
                          onClick={onSubmit}
                          disabled={publishing || iconUploading || productionBackgroundBlocksCatalogSubmit}
                          className={`text-xs font-bold uppercase tracking-wider text-[#ea580c] disabled:opacity-50 ${bizFocusRingClass}`}
                        >
                          {publishing ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-5">
                      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-[#abadaf]/15 bg-[#f8fafc]/95 px-4 pb-4 pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#f8fafc]/80 sm:-mx-5 sm:px-5">
                        <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                          Business Catalogs preview
                        </span>
                        <BusinessCatalogListItemPreviewCard
                          row={catalogEditorPreviewRow}
                          serviceCategories={serviceCategories}
                          moneyPrefix={moneyPrefix}
                          catalogPublisherBeamioTag={catalogPublisherBeamioTag}
                          globalCategoryHint={catalogGlobalCategoryLabel(globalCategory)}
                          bannerCaptureDisabled={bannerCaptureDisabled}
                          catalogBannerPreviewSnapshot={catalogBannerPreviewSnapshot}
                          onCaptureBannerSnapshot={onCaptureCatalogBannerSnapshot}
                        />
                      </div>

                      {editingIssued ? (
                        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-900">
                          This item is live on-chain. Name
                          {salesManagementCatalog
                            ? ', claim method, and total issuance'
                            : catalogPriceOptional
                              ? ''
                              : ', price, and total issuance'}{' '}
                          are locked. You can still update optional background media
                          {catalogTileBackgroundColorEditorVisible ? ', tile background color' : ''}, and description.
                        </div>
                      ) : null}

                      <section className="mb-5">
                        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                          Global Category
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {CATALOG_GLOBAL_CATEGORY_OPTIONS.map((opt) => {
                            const active = globalCategory === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={editingIssued}
                                onClick={() => setGlobalCategory(opt.id)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                                  active
                                    ? 'border-[#1562f0] bg-[#1562f0]/10 text-[#1562f0]'
                                    : 'border-[#e5e9eb] bg-white text-[#747779]'
                                } ${editingIssued ? 'cursor-not-allowed opacity-60' : ''} ${bizFocusRingClass}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      <section className="mb-5 space-y-4">
                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                            Background media (optional)
                          </label>
                          <input
                            ref={productionImageFileRef}
                            type="file"
                            accept={IPFS_PRODUCTION_BACKGROUND_ACCEPT}
                            className="hidden"
                            onChange={onProductionImageFileChange}
                          />
                          <div
                            className={`overflow-hidden rounded-2xl border-2 border-dashed border-[#abadaf]/40 bg-[#eef1f3] transition-[box-shadow,background-color] ${
                              backgroundMediaDragOver && !backgroundMediaDropDisabled
                                ? 'bg-[#ea580c]/[0.06] ring-2 ring-[#ea580c]/45 ring-offset-2'
                                : ''
                            }`}
                            onDragEnter={handleBackgroundMediaDragEnter}
                            onDragLeave={handleBackgroundMediaDragLeave}
                            onDragOver={handleBackgroundMediaDragOver}
                            onDrop={handleBackgroundMediaDrop}
                          >
                            {productionVideoDraftUrl ? (
                              <div className="p-3">
                                {productionVideoNeedsClipEdit &&
                                productionVideoDraftPending &&
                                !productionImage.trim() ? (
                                  <ProductionVideoFilmstripTrimEditor
                                    videoSrc={productionVideoDraftUrl}
                                    sourceFile={productionVideoDraftFile}
                                    durationSec={productionVideoSourceDurationSec}
                                    maxClipSec={PRODUCTION_BACKGROUND_VIDEO_MAX_SECONDS}
                                    startSec={productionVideoStartSec}
                                    onStartSecChange={(value) => setProductionVideoStartSec?.(value)}
                                    trimConfirmed={productionVideoTrimConfirmed}
                                    onTrimConfirm={() => onProductionVideoTrimConfirm?.()}
                                    onTrimEdit={() => onProductionVideoTrimEdit?.()}
                                    onCancel={() => onCancelProductionVideoDraft?.()}
                                    disabled={productionImageUploading && !productionVideoTrimConfirmed}
                                    uploading={productionImageUploading}
                                    uploadProgress={productionVideoUploadProgress}
                                    uploadMessage={productionVideoProcessingMessage}
                                  />
                                ) : (
                                  <div className="relative h-[140px] w-full overflow-hidden rounded-xl bg-[#0f172a]/90">
                                    <ClickToPlayProductionVideo
                                      src={productionVideoDraftUrl}
                                      startSec={productionVideoStartSec}
                                      className="h-full w-full object-contain"
                                      showControlsAfterPlay={!productionImageUploading}
                                    />
                                    {productionImageUploading ? (
                                      <div
                                        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0f172a]/75 px-4 text-center text-white"
                                        role="status"
                                        aria-live="polite"
                                        aria-busy="true"
                                      >
                                        <Loader2 className="h-8 w-8 animate-spin" strokeWidth={2} aria-hidden />
                                        <span className="text-[11px] font-bold">
                                          {productionVideoProcessingMessage || 'Converting and uploading…'}
                                        </span>
                                        <span className="text-[10px] font-medium text-white/80">
                                          Please wait — do not close this screen.
                                        </span>
                                      </div>
                                    ) : (
                                      <ProductionBackgroundMediaDeleteButton
                                        disabled={
                                          productionBackgroundUploadLocked ||
                                          productionImageUploading
                                        }
                                        onClick={() => {
                                          onCancelProductionVideoDraft?.();
                                          if (productionImageFileRef.current) {
                                            productionImageFileRef.current.value = '';
                                          }
                                        }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : !productionImage ? (
                              productionImageUploading && !productionVideoDraftUrl ? (
                                <div
                                  className="flex min-h-[96px] w-full flex-col items-center justify-center px-4 py-5"
                                  role="status"
                                  aria-live="polite"
                                  aria-busy="true"
                                >
                                  <Loader2 className="h-7 w-7 animate-spin text-[#747779]" strokeWidth={2} aria-hidden />
                                  <span className="mt-2 text-center text-[11px] font-bold text-[#747779]">
                                    {productionVideoProcessingMessage || 'Importing video…'}
                                  </span>
                                  {productionVideoUploadProgress > 0 ? (
                                    <div className="mt-3 w-full max-w-xs">
                                      <div className="h-2 overflow-hidden rounded-full bg-[#d5d9dc]">
                                        <div
                                          className="h-full rounded-full bg-[#ea580c] transition-[width] duration-300"
                                          style={{ width: `${productionVideoUploadProgress}%` }}
                                        />
                                      </div>
                                      <p className="mt-1 text-center text-[10px] font-semibold text-[#595c5e]">
                                        {productionVideoUploadProgress}%
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => productionImageFileRef.current?.click()}
                                  disabled={productionBackgroundUploadLocked}
                                  className={`flex min-h-[96px] w-full cursor-pointer flex-col items-center justify-center px-4 py-5 transition-colors hover:bg-[#dfe3e6] disabled:cursor-not-allowed disabled:opacity-60 ${bizFocusRingClass} ${
                                    showBackgroundMediaYoutubeImport ? 'border-b border-[#abadaf]/40' : ''
                                  }`}
                                >
                                  <ImagePlus className="h-7 w-7 text-[#747779]" strokeWidth={2} aria-hidden />
                                  <span className="mt-2 text-center text-[11px] font-bold text-[#747779]">
                                    Upload or drag image, video (max 60s), or PDF here. Default: solid color below.
                                  </span>
                                </button>
                              )
                            ) : (
                              <div className="relative h-[120px] w-full overflow-hidden bg-[#0f172a]/90">
                                <ProductionBackgroundMediaPreview
                                  url={productionImage}
                                  mime={productionImageMime}
                                  startSec={productionImageStartSec}
                                  className="h-full w-full opacity-95"
                                  imgClassName="h-full w-full object-cover opacity-95"
                                />
                                <ProductionBackgroundMediaDeleteButton
                                  disabled={productionBackgroundUploadLocked || productionImageUploading}
                                  onClick={() => {
                                    onClearProductionImage();
                                    if (productionImageFileRef.current) {
                                      productionImageFileRef.current.value = '';
                                    }
                                  }}
                                />
                              </div>
                            )}

                            {showBackgroundMediaYoutubeImport ? (
                              <div className="border-t border-[#abadaf]/40 bg-white px-3 py-3">
                                <label
                                  htmlFor="production-youtube-url"
                                  className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]"
                                >
                                  <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                                  Import from YouTube
                                </label>
                                <div className="relative">
                                  <input
                                    id="production-youtube-url"
                                    type="url"
                                    inputMode="url"
                                    autoComplete="off"
                                    enterKeyHint="go"
                                    placeholder="https://www.youtube.com/watch?v=…"
                                    value={youtubeImportUrl}
                                    onChange={(e) => setYoutubeImportUrl(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key !== 'Enter') return;
                                      e.preventDefault();
                                      runYoutubeProductionVideoImport();
                                    }}
                                    disabled={productionBackgroundUploadLocked}
                                    className={`min-h-10 w-full rounded-full border border-[#e5e9eb] bg-[#f8fafb] py-2 pl-3 pr-11 text-xs font-medium text-[#2c2f31] placeholder:text-[#abadaf] disabled:opacity-60 ${bizFocusRingClass}`}
                                  />
                                  <button
                                    type="button"
                                    disabled={productionBackgroundUploadLocked || !youtubeImportUrlValid}
                                    onClick={runYoutubeProductionVideoImport}
                                    aria-label="Import from YouTube"
                                    className={`absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#ea580c] transition-colors hover:bg-[#ea580c]/10 disabled:cursor-not-allowed disabled:opacity-40 ${bizFocusRingClass}`}
                                  >
                                    {productionBackgroundUploadLocked ? (
                                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} aria-hidden />
                                    ) : (
                                      <Search className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {catalogTileBackgroundColorEditorVisible ? (
                        <div className="space-y-2">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                            Tile background color
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {PRODUCTION_ITEM_COLOR_PRESETS.map((hex) => {
                              const selected =
                                backgroundColor.trim().toLowerCase() === hex.toLowerCase() ||
                                backgroundColorPickerValue.toLowerCase() === hex.toLowerCase();
                              return (
                                <button
                                  key={`production-color-${hex}`}
                                  type="button"
                                  aria-label={`Select color ${hex}`}
                                  onClick={() => setBackgroundColor(hex)}
                                  className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition-all hover:scale-110 ${
                                    selected ? 'ring-[#ea580c]/35' : 'ring-transparent'
                                  }`}
                                  style={{ backgroundColor: hex }}
                                />
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={backgroundColorPickerValue}
                              onChange={(e) => setBackgroundColor(e.target.value)}
                              className="h-10 w-12 rounded-xl border border-[#dfe3e6] bg-transparent p-1"
                              aria-label="Choose custom tile color"
                            />
                            <input
                              type="text"
                              value={backgroundColor}
                              onChange={(e) => setBackgroundColor(e.target.value)}
                              placeholder="#ea580c"
                              autoComplete="off"
                              className={`min-w-0 flex-1 rounded-2xl border-none bg-[#eef1f3] px-4 py-3 text-sm font-mono text-[#2c2f31] placeholder:text-[#abadaf] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ea580c]/20 ${bizFocusRingClass}`}
                            />
                          </div>
                        </div>
                        ) : null}
                      </section>

                      <section className="mb-5">
                        <label className="mb-1 block text-xs font-semibold text-[#2c2f31]">Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={editingIssued}
                          placeholder="e.g. Signature Guasha Facial"
                          autoComplete="off"
                          className="mb-3 w-full rounded-xl border-none bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-[#e5e9eb] disabled:opacity-60"
                        />
                        <label className="mb-1 block text-xs font-semibold text-[#2c2f31]">Subtitle</label>
                        <input
                          type="text"
                          value={subtitle}
                          onChange={(e) => setSubtitle(e.target.value)}
                          disabled={editingIssued}
                          placeholder="Optional short line under the title"
                          autoComplete="off"
                          className="w-full rounded-xl border-none bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-[#e5e9eb] disabled:opacity-60"
                        />
                      </section>

                      <section className="mb-5">
                        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                          Item Category
                        </h3>
                        <div className="flex items-start gap-2">
                          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                          {serviceCategories.map((opt) => {
                            const active = itemCategory === opt.id;
                            const isEditing = editingCategoryId === opt.id;
                            const saving = serviceCategorySavingId === opt.id;
                            if (isEditing) {
                              return (
                                <div
                                  key={opt.id}
                                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#ea580c] bg-white py-1 pl-3 pr-1 shadow-sm ring-1 ring-[#ea580c]/20"
                                >
                                  <input
                                    type="text"
                                    value={editingCategoryLabel}
                                    onChange={(e) => setEditingCategoryLabel(e.target.value)}
                                    autoComplete="off"
                                    enterKeyHint="done"
                                    disabled={saving}
                                    className="min-w-0 w-28 max-w-[9rem] border-none bg-transparent text-xs font-bold text-[#2c2f31] focus:outline-none disabled:opacity-60 sm:w-36 sm:max-w-[11rem]"
                                    aria-label="Category name"
                                  />
                                  <button
                                    type="button"
                                    disabled={saving || !editingCategoryLabel.trim()}
                                    onClick={() => void saveCategoryEdit(opt.id)}
                                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ea580c] text-white disabled:cursor-not-allowed disabled:opacity-50 ${bizFocusRingClass}`}
                                    aria-label="Save category"
                                  >
                                    {saving ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} aria-hidden />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={cancelCategoryEdit}
                                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#747779] disabled:opacity-50 ${bizFocusRingClass}`}
                                    aria-label="Cancel category edit"
                                  >
                                    <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div
                                key={opt.id}
                                className={`inline-flex items-center rounded-full border transition-colors ${
                                  active
                                    ? 'border-[#ea580c] bg-[#ea580c]/10 text-[#ea580c]'
                                    : 'border-[#e5e9eb] bg-white text-[#747779]'
                                } ${editingIssued ? 'opacity-60' : ''}`}
                              >
                                <button
                                  type="button"
                                  disabled={editingIssued}
                                  onClick={() => setItemCategory(opt.id)}
                                  className={`px-3 py-1.5 text-xs font-bold ${bizFocusRingClass}`}
                                >
                                  {opt.label}
                                </button>
                                <button
                                  type="button"
                                  disabled={editingIssued || saving}
                                  onClick={() => {
                                    setEditingCategoryId(opt.id);
                                    setEditingCategoryLabel(opt.label);
                                  }}
                                  className={`mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-current/70 transition-colors hover:bg-black/5 hover:text-[#ea580c] disabled:cursor-not-allowed disabled:opacity-40 ${bizFocusRingClass}`}
                                  aria-label={`Edit ${opt.label}`}
                                >
                                  {saving ? (
                                    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.2} aria-hidden />
                                  ) : (
                                    <Pencil className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                          </div>
                          <button
                            type="button"
                            disabled={
                              editingIssued ||
                              Boolean(serviceCategorySavingId) ||
                              Boolean(editingCategoryId)
                            }
                            onClick={handleAddServiceCategory}
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[#ea580c]/45 bg-white text-[#ea580c] shadow-sm transition-colors hover:border-[#ea580c] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-50 ${bizFocusRingClass}`}
                            aria-label="Add category"
                          >
                            <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                          </button>
                        </div>
                        {serviceCategoryEditError ? (
                          <p className="mt-2 text-[11px] font-medium text-amber-800">{serviceCategoryEditError}</p>
                        ) : null}
                        <p className="mt-2 text-[10px] font-medium leading-relaxed text-[#747779]">
                          Item categories are shared across catalog items and saved to metadata{' '}
                          <span className="font-semibold">itemCategory</span>.
                        </p>
                      </section>

                      {!catalogPriceOptional ? (
                        <section className="mb-5 space-y-3">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">Price</h3>
                          <p className="text-[11px] text-[#747779]">
                            Catalog items must have a price greater than 0. Member claim / redeem codes apply to Coupons
                            only, not catalog items.
                          </p>
                          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#e5e9eb]">
                            <div className="flex items-center gap-2 rounded-xl bg-[#f1f5f9] px-3 py-2.5">
                              <span className="text-sm font-bold text-[#747779]">{moneyPrefix}</span>
                              <input
                                type="number"
                                min={0.01}
                                step={0.01}
                                inputMode="decimal"
                                autoComplete="off"
                                disabled={editingIssued}
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                onKeyDown={preventNumericInputStepKeys}
                                onWheel={preventNumericInputWheelStep}
                                className="min-w-0 flex-1 border-none bg-transparent text-lg font-extrabold text-[#2c2f31] focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={editingIssued && packageDeals.every((d) => d.issued)}
                            onClick={onAddPackageDeal}
                            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#ea580c]/45 bg-white px-3 py-2.5 text-sm font-semibold text-[#ea580c] transition-colors hover:border-[#ea580c] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-50 ${bizFocusRingClass}`}
                          >
                            <Plus className="h-4 w-4" strokeWidth={2.4} aria-hidden />
                            Package deal
                          </button>
                          {packageDeals.length > 0 ? (
                            <ul className="space-y-3">
                              {packageDeals.map((deal) => {
                                const perSession = computePackagePerSessionPrice(deal);
                                const dealLocked = deal.issued === true;
                                return (
                                  <li
                                    key={deal.id}
                                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#e5e9eb]"
                                  >
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2">
                                        <Gift className="mt-0.5 h-5 w-5 text-[#ea580c]" strokeWidth={2} aria-hidden />
                                        <div>
                                          <p className="text-xs font-bold text-[#2c2f31]">Package deal</p>
                                          <p className="text-[11px] text-[#747779]">
                                            {dealLocked
                                              ? 'Live on-chain — sessions and price are locked.'
                                              : 'Bundle sessions at one total price'}
                                          </p>
                                        </div>
                                      </div>
                                      {!dealLocked ? (
                                        <button
                                          type="button"
                                          onClick={() => onRemovePackageDeal(deal.id)}
                                          className={`shrink-0 rounded-full p-1.5 text-[#747779] hover:bg-[#eef1f3] ${bizFocusRingClass}`}
                                          aria-label="Remove package deal"
                                        >
                                          <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                                        </button>
                                      ) : null}
                                    </div>
                                    <div className="mb-3 grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#747779]">
                                          Sessions
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX}
                                          inputMode="numeric"
                                          disabled={dealLocked}
                                          value={deal.packageSessions}
                                          onChange={(e) =>
                                            onUpdatePackageDeal(deal.id, { packageSessions: e.target.value })
                                          }
                                          onKeyDown={preventNumericInputStepKeys}
                                          onWheel={preventNumericInputWheelStep}
                                          className={`w-full rounded-lg bg-[#f1f5f9] px-3 py-2 text-sm font-bold text-[#2c2f31] ${numericNoSpinnerClass}`}
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#747779]">
                                          Bonus (+ free)
                                        </label>
                                        <input
                                          type="number"
                                          min={0}
                                          inputMode="numeric"
                                          disabled={dealLocked}
                                          value={deal.packageBonusSessions}
                                          onChange={(e) =>
                                            onUpdatePackageDeal(deal.id, { packageBonusSessions: e.target.value })
                                          }
                                          onKeyDown={preventNumericInputStepKeys}
                                          onWheel={preventNumericInputWheelStep}
                                          className={`w-full rounded-lg bg-[#f1f5f9] px-3 py-2 text-sm font-bold text-[#ea580c] ${numericNoSpinnerClass}`}
                                        />
                                      </div>
                                    </div>
                                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#747779]">
                                      Total package price
                                    </label>
                                    <div className="flex items-center gap-2 rounded-xl bg-[#f1f5f9] px-3 py-2.5">
                                      <span className="text-sm font-bold text-[#747779]">{moneyPrefix}</span>
                                      <input
                                        type="number"
                                        min={0.01}
                                        step={0.01}
                                        inputMode="decimal"
                                        disabled={dealLocked}
                                        value={deal.packageTotalPrice}
                                        onChange={(e) =>
                                          onUpdatePackageDeal(deal.id, { packageTotalPrice: e.target.value })
                                        }
                                        onKeyDown={preventNumericInputStepKeys}
                                        onWheel={preventNumericInputWheelStep}
                                        className={`min-w-0 flex-1 border-none bg-transparent text-lg font-extrabold text-[#2c2f31] focus:outline-none ${numericNoSpinnerClass}`}
                                      />
                                    </div>
                                    {perSession != null ? (
                                      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                                        Effective: {moneyPrefix}
                                        {perSession.toFixed(2)} / session
                                      </p>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : null}
                        </section>
                      ) : null}

                      {salesManagementCatalog ? (
                        <section className="mb-5 space-y-4">
                          <div>
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                              How members claim
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingIssued) return;
                                  setRequiresRedeemCode(false);
                                }}
                                disabled={editingIssued}
                                className={`rounded-2xl px-3 py-3 text-center text-sm font-semibold transition-colors ${bizFocusRingClass} ${
                                  !requiresRedeemCode
                                    ? 'bg-[#1562f0] text-white shadow-sm shadow-[#1562f0]/25'
                                    : 'bg-[#eef1f3] text-[#595c5e] hover:bg-[#e4e7ea]'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                Open claim
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingIssued) return;
                                  setRequiresRedeemCode(true);
                                }}
                                disabled={editingIssued}
                                className={`rounded-2xl px-3 py-3 text-center text-sm font-semibold transition-colors ${bizFocusRingClass} ${
                                  requiresRedeemCode
                                    ? 'bg-[#1562f0] text-white shadow-sm shadow-[#1562f0]/25'
                                    : 'bg-[#eef1f3] text-[#595c5e] hover:bg-[#e4e7ea]'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                Redeem code
                              </button>
                            </div>
                            <p className="mt-1 text-[11px] text-[#abadaf]">
                              {requiresRedeemCode
                                ? `Members enter a redeem code to claim. Codes are registered on-chain in batches of up to ${CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX.toLocaleString()} (contract limit); register more from the catalog list as needed.`
                                : 'Members can claim without entering a secret redeem code, within your issuance cap.'}
                            </p>
                          </div>
                          <div>
                            <label
                              className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]"
                              htmlFor="programs-production-sales-issue-total"
                            >
                              Total issuance
                            </label>
                            <input
                              ref={issueTotalWheelRef}
                              id="programs-production-sales-issue-total"
                              type="number"
                              inputMode="numeric"
                              autoComplete="off"
                              min={1}
                              max={CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX}
                              value={issueTotal}
                              onKeyDown={preventNumericInputStepKeys}
                              onKeyDownCapture={preventNumericInputStepKeys}
                              onWheel={preventNumericInputWheelStep}
                              disabled={editingIssued}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/,/g, '');
                                if (raw === '') {
                                  setIssueTotal('');
                                  return;
                                }
                                setIssueTotal(raw.split('.')[0].replace(/\D/g, ''));
                              }}
                              placeholder={String(CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_DEFAULT)}
                              className={`block w-full rounded-2xl border-none bg-[#eef1f3] px-4 py-3 text-sm text-[#2c2f31] placeholder:text-[#abadaf] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 disabled:cursor-not-allowed disabled:opacity-60 ${bizFocusRingClass} ${numericNoSpinnerClass}`}
                            />
                            <p className="mt-1 text-[11px] text-[#abadaf]">
                              Maximum redemptions for this catalog item (1–
                              {CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX.toLocaleString()}). With Redeem code, only up
                              to {CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX.toLocaleString()} codes are registered per
                              on-chain batch at issue; add more later from the catalog list.
                            </p>
                          </div>
                        </section>
                      ) : null}

                      {!salesManagementCatalog && !shareLinkCatalog ? (
                        <section className="mb-5 space-y-3">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                            Total issuance
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={editingIssued}
                              onClick={() => setIssueTotalUnlimited(true)}
                              className={`rounded-2xl px-3 py-3 text-center text-sm font-semibold transition-colors ${bizFocusRingClass} ${
                                issueTotalUnlimited
                                  ? 'bg-[#ea580c] text-white shadow-sm shadow-[#ea580c]/25'
                                  : 'bg-[#eef1f3] text-[#595c5e] hover:bg-[#e4e7ea]'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              Unlimited
                            </button>
                            <button
                              type="button"
                              disabled={editingIssued}
                              onClick={() => setIssueTotalUnlimited(false)}
                              className={`rounded-2xl px-3 py-3 text-center text-sm font-semibold transition-colors ${bizFocusRingClass} ${
                                !issueTotalUnlimited
                                  ? 'bg-[#ea580c] text-white shadow-sm shadow-[#ea580c]/25'
                                  : 'bg-[#eef1f3] text-[#595c5e] hover:bg-[#e4e7ea]'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              Set quantity
                            </button>
                          </div>
                          {issueTotalUnlimited ? (
                            <p className="text-[11px] text-[#747779]">
                              No practical cap — up to {CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX.toLocaleString()} units
                              can be issued on-chain.
                            </p>
                          ) : (
                            <div>
                              <label
                                className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]"
                                htmlFor="programs-production-issue-total"
                              >
                                Quantity
                              </label>
                              <input
                                ref={issueTotalWheelRef}
                                id="programs-production-issue-total"
                                type="number"
                                inputMode="numeric"
                                autoComplete="off"
                                min={1}
                                max={CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX}
                                value={issueTotal}
                                onKeyDown={preventNumericInputStepKeys}
                                onKeyDownCapture={preventNumericInputStepKeys}
                                onWheel={preventNumericInputWheelStep}
                                disabled={editingIssued}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  if (raw === '') {
                                    setIssueTotal('');
                                    return;
                                  }
                                  setIssueTotal(raw.split('.')[0].replace(/\D/g, ''));
                                }}
                                placeholder={String(CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_DEFAULT)}
                                className={`block w-full rounded-2xl border-none bg-[#eef1f3] px-4 py-3 text-sm text-[#2c2f31] placeholder:text-[#abadaf] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ea580c]/20 disabled:cursor-not-allowed disabled:opacity-60 ${bizFocusRingClass} ${numericNoSpinnerClass}`}
                              />
                              <p className="mt-1 text-[11px] text-[#abadaf]">
                                Maximum units issued for this item (whole number, 1–
                                {CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX.toLocaleString()}).
                              </p>
                            </div>
                          )}
                        </section>
                      ) : null}

                      <section className="mb-4">
                        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                          Description
                        </h3>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={4}
                          placeholder="Briefly describe the service, benefits, and duration…"
                          className="w-full resize-none rounded-xl border-none bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-[#e5e9eb] focus:outline-none focus:ring-2 focus:ring-[#ea580c]/25"
                        />
                      </section>

                      {editorError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                          {editorError}
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 border-t border-[#e5e9eb]/80 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
                      {productionImageUploading &&
                      productionVideoNeedsClipEdit &&
                      productionVideoUploadProgress > 0 ? (
                        <div className="mb-3">
                          <div className="h-2 overflow-hidden rounded-full bg-[#eef1f3]">
                            <div
                              className="h-full rounded-full bg-[#0ea5e9] transition-[width] duration-200"
                              style={{ width: `${productionVideoUploadProgress}%` }}
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-[#595c5e]">
                            <span className="min-w-0 truncate">
                              {productionVideoProcessingMessage || 'Uploading video…'}
                            </span>
                            <span className="shrink-0">{productionVideoUploadProgress}%</span>
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={onSubmit}
                        disabled={publishing || iconUploading || productionBackgroundBlocksCatalogSubmit}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ea580c] py-4 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 ${bizFocusRingClass}`}
                      >
                        {publishing || iconUploading || productionBackgroundBlocksCatalogSubmit ? (
                          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.4} aria-hidden />
                        ) : (
                          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                        )}
                        {productionImageUploading
                          ? productionVideoProcessingMessage
                            ? `${productionVideoProcessingMessage}${productionVideoUploadProgress > 0 ? ` (${productionVideoUploadProgress}%)` : ''}`
                            : 'Converting video…'
                          : iconUploading
                            ? 'Uploading…'
                            : productionVideoNeedsClipEdit &&
                                productionVideoDraftPending &&
                                !productionImage.trim()
                              ? productionVideoTrimConfirmed
                                ? 'Uploading video…'
                                : 'Confirm trim with check to continue'
                              : publishing
                                ? 'Saving…'
                                : editingId
                                  ? 'Save changes'
                                  : 'Add item to catalog'}
                      </button>
                    </div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
