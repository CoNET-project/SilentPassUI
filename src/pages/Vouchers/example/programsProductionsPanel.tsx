import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Gift,
  ImagePlus,
  Loader2,
  Package,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_DEFAULT,
  CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX,
  CATALOG_GLOBAL_CATEGORY_OPTIONS,
  PRODUCTION_ITEM_COLOR_PRESETS,
  catalogGlobalCategoryLabel,
  catalogPackageDealsForBase,
  catalogProductionDisplayPrice,
  computePackagePerSessionPrice,
  isCatalogBaseProductionRow,
  productionIconLooksLikeImageUrl,
  productionIssueTotalDisplayLabel,
  productionItemCategoryLabel,
  tileBackgroundColorApplies,
  type CardIssuanceProductionRow,
  type CatalogGlobalCategoryId,
  type CatalogPackageDealDraft,
  type ProductionServiceCategoryId,
  type ProductionServiceCategoryOption,
} from './cardIssuanceProductions';
import {
  createNumericInputWheelNonPassiveRefCallback,
  preventNumericInputStepKeys,
  preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys';

const bizFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ea580c]/40 focus-visible:ring-offset-2';

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
  onClearIcon: () => void;
  productionImage: string;
  productionImageUploading: boolean;
  onProductionImageFileChange: React.ChangeEventHandler<HTMLInputElement>;
  onClearProductionImage: () => void;
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
  description: string;
  setDescription: (v: string) => void;
  editorError: string;
  publishing: boolean;
  editingIssued: boolean;
  onSubmit: () => void;
  onDeleteDraft: (id: string) => void;
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
    onClearIcon,
    productionImage,
    productionImageUploading,
    onProductionImageFileChange,
    onClearProductionImage,
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
    description,
    setDescription,
    editorError,
    publishing,
    editingIssued,
    onSubmit,
    onDeleteDraft,
  } = props;

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState('');
  const iconFileRef = useRef<HTMLInputElement>(null);
  const productionImageFileRef = useRef<HTMLInputElement>(null);
  const issueTotalWheelRef = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), []);
  const numericNoSpinnerClass =
    '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]';
  const backgroundColorPickerValue =
    backgroundColor.trim().startsWith('#') ? backgroundColor.trim() : `#${backgroundColor.trim() || 'ea580c'}`;

  useEffect(() => {
    if (!editorOpen) {
      setEditingCategoryId(null);
      setEditingCategoryLabel('');
    }
  }, [editorOpen]);

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
                {productions.filter(isCatalogBaseProductionRow).length === 0 ? (
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
                  <ul className="space-y-3">
                    {productions.filter(isCatalogBaseProductionRow).map((row) => {
                      const displayPrice = catalogProductionDisplayPrice(row);
                      const packageRows = catalogPackageDealsForBase(productions, row);
                      return (
                        <li
                          key={row.id}
                          className="overflow-hidden rounded-2xl border border-[#ea580c]/15 bg-white shadow-sm"
                        >
                          <button
                            type="button"
                            onClick={() => onOpenEdit(row.id)}
                            className={`flex w-full items-start gap-3 p-4 text-left ${bizFocusRingClass}`}
                          >
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white"
                              style={
                                row.productionImage.trim()
                                  ? {
                                      backgroundImage: `url(${row.productionImage})`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                    }
                                  : { backgroundColor: row.backgroundColor || '#ea580c' }
                              }
                            >
                              {productionIconLooksLikeImageUrl(row.icon) ? (
                                <img src={row.icon} alt="" className="h-full w-full object-cover" />
                              ) : row.productionImage.trim() ? null : (
                                <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-manrope text-base font-bold text-[#2c2f31]">{row.name}</p>
                              {row.subtitle.trim() ? (
                                <p className="truncate text-sm text-[#747779]">{row.subtitle}</p>
                              ) : null}
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#ea580c]">
                                {catalogGlobalCategoryLabel(row.globalCategory)} ·{' '}
                                {productionItemCategoryLabel(row.itemCategory, serviceCategories)}
                              </p>
                              {displayPrice != null ? (
                                <p className="mt-1 text-xs font-semibold text-[#595c5e]">
                                  {moneyPrefix}
                                  {displayPrice.toFixed(2)}
                                </p>
                              ) : null}
                              <p className="mt-0.5 text-[10px] font-semibold text-[#747779]">
                                Issuance: {productionIssueTotalDisplayLabel(row)}
                                {row.issued && row.issueLeft?.trim()
                                  ? ` · ${Number.parseInt(row.issueLeft.replace(/,/g, ''), 10).toLocaleString()} left`
                                  : ''}
                              </p>
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
                )}
              </div>
            </div>

            <AnimatePresence>
              {editorOpen ? (
                <>
                  <motion.button
                    type="button"
                    aria-label="Close service editor"
                    className="absolute inset-0 z-[2] bg-[#2c2f31]/25"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onCloseEditor}
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
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[#747779] ${bizFocusRingClass}`}
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
                          disabled={publishing || iconUploading || productionImageUploading}
                          className={`text-xs font-bold uppercase tracking-wider text-[#ea580c] disabled:opacity-50 ${bizFocusRingClass}`}
                        >
                          {publishing ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 sm:px-5">
                      {editingIssued ? (
                        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-900">
                          This item is live on-chain. Name, price, and total issuance are locked. You can still update the
                          item icon,
                          optional background photo, background color, and description.
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
                            Item icon
                          </label>
                          <input
                            ref={iconFileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onIconFileChange}
                          />
                          {!icon ? (
                            <button
                              type="button"
                              onClick={() => iconFileRef.current?.click()}
                              disabled={iconUploading}
                              className={`flex min-h-[112px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#abadaf]/40 bg-[#eef1f3] transition-colors hover:bg-[#dfe3e6] disabled:cursor-not-allowed disabled:opacity-60 ${bizFocusRingClass}`}
                            >
                              {iconUploading ? (
                                <Loader2 className="h-7 w-7 animate-spin text-[#747779]" strokeWidth={2} aria-hidden />
                              ) : (
                                <ImagePlus className="h-7 w-7 text-[#747779]" strokeWidth={2} aria-hidden />
                              )}
                              <span className="mt-2 text-[11px] font-bold text-[#747779]">
                                {iconUploading ? 'Uploading…' : 'Upload icon (PNG, JPEG, or SVG)'}
                              </span>
                            </button>
                          ) : (
                            <div className="relative h-[112px] w-full overflow-hidden rounded-2xl border-2 border-dashed border-[#abadaf]/40 bg-[#eef1f3]">
                              <img src={icon} alt="" className="h-full w-full object-contain" />
                              <button
                                type="button"
                                onClick={() => {
                                  onClearIcon();
                                  if (iconFileRef.current) iconFileRef.current.value = '';
                                }}
                                className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2c2f31]/45 text-white backdrop-blur-[2px] transition hover:bg-[#2c2f31]/60 ${bizFocusRingClass}`}
                                aria-label="Remove item icon"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">
                            Background photo (optional)
                          </label>
                          <input
                            ref={productionImageFileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onProductionImageFileChange}
                          />
                          {!productionImage ? (
                            <button
                              type="button"
                              onClick={() => productionImageFileRef.current?.click()}
                              disabled={productionImageUploading}
                              className={`flex min-h-[96px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#abadaf]/40 bg-[#eef1f3] transition-colors hover:bg-[#dfe3e6] disabled:cursor-not-allowed disabled:opacity-60 ${bizFocusRingClass}`}
                            >
                              {productionImageUploading ? (
                                <Loader2 className="h-7 w-7 animate-spin text-[#747779]" strokeWidth={2} aria-hidden />
                              ) : (
                                <ImagePlus className="h-7 w-7 text-[#747779]" strokeWidth={2} aria-hidden />
                              )}
                              <span className="mt-2 text-center text-[11px] font-bold text-[#747779]">
                                {productionImageUploading
                                  ? 'Uploading…'
                                  : 'Upload wide banner (PNG or JPEG). Default: solid color below.'}
                              </span>
                            </button>
                          ) : (
                            <div className="relative h-[120px] w-full overflow-hidden rounded-2xl border-2 border-dashed border-[#abadaf]/40 bg-[#0f172a]/90">
                              <img src={productionImage} alt="" className="h-full w-full object-cover opacity-95" />
                              <button
                                type="button"
                                onClick={() => {
                                  onClearProductionImage();
                                  if (productionImageFileRef.current) productionImageFileRef.current.value = '';
                                }}
                                className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2c2f31]/45 text-white backdrop-blur-[2px] transition hover:bg-[#2c2f31]/60 ${bizFocusRingClass}`}
                                aria-label="Remove background photo"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </button>
                            </div>
                          )}
                        </div>

                        {tileBackgroundColorApplies(productionImage) ? (
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
                      <button
                        type="button"
                        onClick={onSubmit}
                        disabled={publishing || iconUploading || productionImageUploading}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ea580c] py-4 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 ${bizFocusRingClass}`}
                      >
                        {publishing || iconUploading || productionImageUploading ? (
                          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.4} aria-hidden />
                        ) : (
                          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                        )}
                        {iconUploading || productionImageUploading
                          ? 'Uploading…'
                          : publishing
                            ? 'Saving…'
                            : editingId && editingIssued
                              ? 'Save changes'
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
