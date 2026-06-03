import { ethers } from 'ethers';

/** Legacy issued-series kind label (read compat only). */
export const CARD_ISSUANCE_PRODUCTION_NFT_CATEGORY = 'productions' as const;

/** Catalog item global category — stored on metadata root `category` (same level as coupon `Coupon`). */
export const CATALOG_GLOBAL_CATEGORY_OPTIONS = [
  { id: 'Product', label: 'Product' },
  { id: 'Service', label: 'Service' },
  { id: 'Menu', label: 'Menu' },
  { id: 'ShareLink', label: 'Share link' },
  { id: 'SalesManagement', label: 'Sales Management' },
] as const;

export type CatalogGlobalCategoryId = (typeof CATALOG_GLOBAL_CATEGORY_OPTIONS)[number]['id'];

export const DEFAULT_CATALOG_GLOBAL_CATEGORY: CatalogGlobalCategoryId = 'Service';

export function isCatalogGlobalCategoryId(value: unknown): value is CatalogGlobalCategoryId {
  return (
    typeof value === 'string' &&
    CATALOG_GLOBAL_CATEGORY_OPTIONS.some((opt) => opt.id === value.trim())
  );
}

export function normalizeCatalogGlobalCategory(raw: unknown): CatalogGlobalCategoryId {
  if (isCatalogGlobalCategoryId(raw)) return raw.trim() as CatalogGlobalCategoryId;
  const legacy = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (legacy === CARD_ISSUANCE_PRODUCTION_NFT_CATEGORY) return DEFAULT_CATALOG_GLOBAL_CATEGORY;
  return DEFAULT_CATALOG_GLOBAL_CATEGORY;
}

export function catalogGlobalCategoryLabel(id: CatalogGlobalCategoryId): string {
  return CATALOG_GLOBAL_CATEGORY_OPTIONS.find((opt) => opt.id === id)?.label ?? id;
}

/** Sales Management catalog items: no price or package deals; claim method + total issuance like Coupons. */
export function isSalesManagementCatalogCategory(
  category: CatalogGlobalCategoryId
): boolean {
  return category === 'SalesManagement';
}

/** Share link catalog items: open-claim URL / QR only (no redeem codes, no list price). */
export function isShareLinkCatalogCategory(category: CatalogGlobalCategoryId): boolean {
  return category === 'ShareLink';
}

export function isCatalogPriceOptionalCategory(category: CatalogGlobalCategoryId): boolean {
  return isSalesManagementCatalogCategory(category) || isShareLinkCatalogCategory(category);
}

function productionRequiresRedeemFlagTruthy(raw: unknown): boolean {
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    return t === '1' || t === 'true' || t === 'yes';
  }
  return false;
}

/** Parse requiresRedeemCode from share metadata / issued-series hydration. */
export function parseProductionRequiresRedeemFromHydration(meta: Record<string, unknown>): boolean {
  if (
    productionRequiresRedeemFlagTruthy(meta.requiresRedeemCode) ||
    productionRequiresRedeemFlagTruthy(meta.redeemCodeRequired)
  ) {
    return true;
  }
  const beamioProduction = meta.beamioProduction;
  if (beamioProduction && typeof beamioProduction === 'object' && !Array.isArray(beamioProduction)) {
    const nested = beamioProduction as Record<string, unknown>;
    if (
      productionRequiresRedeemFlagTruthy(nested.requiresRedeemCode) ||
      productionRequiresRedeemFlagTruthy(nested.redeemCodeRequired)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Hydration / legacy rows: explicit metadata flags, or Sales Management category default (redeem code).
 * Live editor uses explicit `requiresRedeemCode` state — not this helper alone.
 */
export function resolveProductionRequiresRedeemCode(
  meta: Record<string, unknown>,
  globalCategory?: CatalogGlobalCategoryId
): boolean {
  if (parseProductionRequiresRedeemFromHydration(meta)) return true;
  const cat = globalCategory ?? normalizeCatalogGlobalCategory(meta.category);
  if (isShareLinkCatalogCategory(cat)) return false;
  return isSalesManagementCatalogCategory(cat);
}

export function parseProductionIssueLeftN(
  row: Pick<CardIssuanceProductionRow, 'issueLeft' | 'issueTotal' | 'issueTotalUnlimited'>
): number {
  const leftRaw = String(row.issueLeft ?? '').replace(/,/g, '').trim();
  const leftN = Number.parseInt(leftRaw, 10);
  if (Number.isFinite(leftN) && leftN >= 0) return leftN;
  if (row.issueTotalUnlimited) return CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX;
  return computeProductionIssueTotalN(row);
}

export const NEW_PRODUCTION_SERVICE_CATEGORY_DEFAULT_LABEL = 'New Category';

export const DRAFT_SERVICE_CATEGORY_ID_PREFIX = 'draft-';

export function isDraftServiceCategoryId(id: string): boolean {
  return id.startsWith(DRAFT_SERVICE_CATEGORY_ID_PREFIX);
}

export type ProductionServiceCategoryOption = {
  id: string;
  label: string;
};

export const DEFAULT_PRODUCTION_SERVICE_CATEGORY_OPTIONS: ProductionServiceCategoryOption[] = [
  { id: 'tcm-services', label: 'TCM Services' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'anti-aging', label: 'Anti-Aging' },
];

/** @deprecated Prefer `DEFAULT_PRODUCTION_SERVICE_CATEGORY_OPTIONS` */
export const PRODUCTION_SERVICE_CATEGORY_OPTIONS = DEFAULT_PRODUCTION_SERVICE_CATEGORY_OPTIONS;

export type ProductionServiceCategoryId = string;

/**
 * Base ERC-1155 NFT explorer (catalog issued series).
 * @see https://base.blockscout.com/token/{contract}/instance/{tokenId}
 */
export const BEAMIO_CATALOG_BLOCKSCOUT_NFT_EXPLORER = 'https://base.blockscout.com/token' as const;

/**
 * BaseScan NFT page works for issued series with zero mints; Blockscout `/instance/` does not.
 * @see https://basescan.org/nft/{contract}/{tokenId}
 */
export const BEAMIO_CATALOG_BASESCAN_NFT_EXPLORER = 'https://basescan.org/nft' as const;

export type CatalogNftExplorerKind = 'blockscout' | 'basescan';

export type CatalogNftExplorerLink = {
  url: string;
  explorer: CatalogNftExplorerKind;
};

function parseIssuedNftMintedCountBigInt(raw: string | number | undefined): bigint | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/,/g, '');
  if (!/^\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

/**
 * Blockscout only lists ERC-1155 instances after at least one mint (`issuedNftMintedCount > 0`).
 * Live series with zero mints must use BaseScan or the Blockscout instance SPA shows 404.
 */
export function catalogProductionNftExplorerLink(
  cardAddress: string | undefined,
  issuedTokenId: string | number | undefined,
  issuedNftMintedCount?: string | number | undefined
): CatalogNftExplorerLink | null {
  const tid = normalizeCatalogIssuedNftTokenIdForExplorer(issuedTokenId);
  if (!tid) return null;
  const card = cardAddress?.trim() ?? '';
  if (!card || !/^0x[a-fA-F0-9]{40}$/i.test(card)) return null;
  try {
    const cardNorm = ethers.getAddress(card);
    const minted = parseIssuedNftMintedCountBigInt(issuedNftMintedCount);
    if (minted != null && minted > 0n) {
      return {
        url: `${BEAMIO_CATALOG_BLOCKSCOUT_NFT_EXPLORER}/${cardNorm}/instance/${tid}`,
        explorer: 'blockscout',
      };
    }
    return {
      url: `${BEAMIO_CATALOG_BASESCAN_NFT_EXPLORER}/${cardNorm}/${tid}`,
      explorer: 'basescan',
    };
  } catch {
    return null;
  }
}

export function catalogProductionNftExplorerTitle(explorer: CatalogNftExplorerKind): string {
  return explorer === 'blockscout' ? 'View NFT on Blockscout' : 'View NFT on BaseScan';
}

/** On-chain `createIssuedNft` tokenIds (not share token #0–#99). */
export const CATALOG_ISSUED_NFT_TOKEN_ID_MIN = 100_000_000_000n;

/** Decimal tokenId string for Blockscout `/token/{card}/instance/{tokenId}` (no Number() — avoids wrong ids). */
export function normalizeCatalogIssuedNftTokenIdForExplorer(
  issuedTokenId: string | number | undefined
): string | null {
  const raw = String(issuedTokenId ?? '')
    .trim()
    .replace(/,/g, '');
  if (!/^\d+$/.test(raw)) return null;
  try {
    if (BigInt(raw) < CATALOG_ISSUED_NFT_TOKEN_ID_MIN) return null;
  } catch {
    return null;
  }
  return raw;
}

/** @deprecated Prefer {@link catalogProductionNftExplorerLink} (mint-aware Blockscout vs BaseScan). */
export function catalogProductionBaseScanNftUrl(
  cardAddress: string | undefined,
  issuedTokenId: string | number | undefined,
  issuedNftMintedCount?: string | number | undefined
): string | null {
  return catalogProductionNftExplorerLink(cardAddress, issuedTokenId, issuedNftMintedCount)?.url ?? null;
}

export function catalogProductionBaseScanNftLabel(issuedTokenId: string | number | undefined): string {
  const tid = normalizeCatalogIssuedNftTokenIdForExplorer(issuedTokenId);
  if (!tid) return 'NFT';
  return `NFT #${tid}`;
}

export const CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_DEFAULT = 10_000;
export const CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX = 9_999_999;

/** Max redeem codes per `createRedeemBatch` tx (contract calldata limit). */
export const CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX = 500;

/** @deprecated Use CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX */
export const CARD_ISSUANCE_COUPON_REDEEM_BATCH_MAX = CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX;

export function resolveRedeemRegisterBatchCount(
  issueLeftN: number,
  requestedCount?: number,
  qtyDraft?: string
): number {
  const leftCap = Math.min(Math.max(issueLeftN, 0), CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX);
  if (leftCap <= 0) return 0;
  if (requestedCount != null && Number.isFinite(requestedCount)) {
    return Math.min(Math.max(1, Math.floor(requestedCount)), leftCap);
  }
  const raw = String(qtyDraft ?? '1').replace(/,/g, '').trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return Math.min(1, leftCap);
  return Math.min(parsed, leftCap);
}

/** First on-chain redeem registration after issue: at most one batch (500). */
export function initialRedeemRegisterBatchCount(issueTotalN: number): number {
  const cap = Number.isFinite(issueTotalN) && issueTotalN >= 1 ? Math.floor(issueTotalN) : 0;
  return Math.min(cap, CARD_ISSUANCE_REDEEM_REGISTER_BATCH_MAX);
}

/** Editor / draft shape for a package deal linked to a base catalog item. */
export type CatalogPackageDealDraft = {
  id: string;
  packageSessions: string;
  packageBonusSessions: string;
  packageTotalPrice: string;
  issued?: boolean;
  issuedTokenId?: string;
};

export type CardIssuanceProductionRow = {
  id: string;
  name: string;
  subtitle: string;
  /** Root metadata `category` — Product | Service | Menu | ShareLink | SalesManagement. */
  globalCategory: CatalogGlobalCategoryId;
  /** Second-level metadata `itemCategory` (chip id). */
  itemCategory: ProductionServiceCategoryId;
  singleSessionPrice: string;
  packageDealEnabled: boolean;
  packageSessions: string;
  packageBonusSessions: string;
  packageTotalPrice: string;
  /** On-chain base item tokenId — metadata field `Package`. */
  packageParentTokenId?: string;
  /** Draft-only link before base item is issued. */
  packageParentProductionId?: string;
  issueTotal: string;
  /** When true, on-chain/metadata cap uses ISSUE_TOTAL_MAX; UI shows Unlimited. */
  issueTotalUnlimited: boolean;
  /** Open claim vs redeem code — only applies when effective price is 0. */
  requiresRedeemCode: boolean;
  issueLeft?: string;
  icon: string;
  backgroundColor: string;
  productionImage: string;
  /** Seconds to seek before playback in the stored background video (0 after source trim export). */
  productionImageStartSec?: number;
  /** MIME type for `productionImage` when not a raster image (e.g. video/mp4, application/pdf). */
  productionImageMime?: string;
  description: string;
  issued: boolean;
  issuedTokenId?: string;
  /** From `cardActiveIssuedProductionSeries` — drives Blockscout vs BaseScan explorer link. */
  issuedNftMintedCount?: string;
};

export type CardIssuanceProductionMetadataPayload = {
  id: string;
  name: string;
  subtitle?: string;
  itemCategory?: ProductionServiceCategoryId;
  singleSessionPrice?: number;
  packageDealEnabled?: boolean;
  packageSessions?: number;
  packageBonusSessions?: number;
  packageTotalPrice?: number;
  /** Base catalog item issued NFT tokenId. */
  Package?: string;
  packageParentTokenId?: string;
  issueTotal: number;
  issueTotalUnlimited?: boolean;
  requiresRedeemCode?: boolean;
  category: CatalogGlobalCategoryId;
  icon?: string;
  backgroundColor?: string;
  productionImage?: string;
  productionImageStartSec?: number;
  productionImageMime?: string;
  description?: string;
  issued?: boolean;
  issuedTokenId?: string;
};

export function makeCardIssuanceProductionRow(
  partial?: Partial<CardIssuanceProductionRow> & { id?: string }
): CardIssuanceProductionRow {
  return {
    id: partial?.id?.trim() || `production-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(partial?.name ?? ''),
    subtitle: String(partial?.subtitle ?? ''),
    globalCategory: normalizeCatalogGlobalCategory(partial?.globalCategory),
    itemCategory:
      partial?.itemCategory ??
      (partial as { serviceCategory?: ProductionServiceCategoryId })?.serviceCategory ??
      DEFAULT_PRODUCTION_SERVICE_CATEGORY_OPTIONS[0].id,
    singleSessionPrice: String(partial?.singleSessionPrice ?? '0'),
    packageDealEnabled: partial?.packageDealEnabled === true,
    packageSessions: String(partial?.packageSessions ?? '10'),
    packageBonusSessions: String(partial?.packageBonusSessions ?? '1'),
    packageTotalPrice: String(partial?.packageTotalPrice ?? '0'),
    issueTotal: String(partial?.issueTotal ?? CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_DEFAULT),
    issueTotalUnlimited: partial?.issueTotalUnlimited === true,
    requiresRedeemCode: partial?.requiresRedeemCode === true,
    icon: String(partial?.icon ?? ''),
    backgroundColor: String(partial?.backgroundColor ?? '#ea580c'),
    productionImage: String(partial?.productionImage ?? '').trim(),
    ...(partial?.productionImageStartSec != null &&
    Number.isFinite(Number(partial.productionImageStartSec)) &&
    Number(partial.productionImageStartSec) > 0
      ? { productionImageStartSec: Math.max(0, Number(partial.productionImageStartSec)) }
      : {}),
    ...(partial?.productionImageMime?.trim()
      ? { productionImageMime: partial.productionImageMime.trim() }
      : {}),
    description: String(partial?.description ?? ''),
    issued: partial?.issued === true,
    ...(partial?.issuedTokenId?.trim() ? { issuedTokenId: partial.issuedTokenId.trim() } : {}),
    ...(partial?.issuedNftMintedCount?.trim()
      ? { issuedNftMintedCount: partial.issuedNftMintedCount.trim() }
      : {}),
    ...(partial?.issueLeft != null && String(partial.issueLeft).trim()
      ? { issueLeft: String(partial.issueLeft).trim() }
      : {}),
    ...(partial?.packageParentTokenId?.trim()
      ? { packageParentTokenId: partial.packageParentTokenId.trim() }
      : {}),
    ...(partial?.packageParentProductionId?.trim()
      ? { packageParentProductionId: partial.packageParentProductionId.trim() }
      : {}),
  };
}

export function makeCatalogPackageDealDraftId(): string {
  return `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function packageDealDraftFromProductionRow(row: CardIssuanceProductionRow): CatalogPackageDealDraft {
  return {
    id: row.id,
    packageSessions: row.packageSessions,
    packageBonusSessions: row.packageBonusSessions,
    packageTotalPrice: row.packageTotalPrice,
    issued: row.issued,
    ...(row.issuedTokenId?.trim() ? { issuedTokenId: row.issuedTokenId.trim() } : {}),
  };
}

export function isCatalogPackageDealRow(
  row: Pick<
    CardIssuanceProductionRow,
    'packageDealEnabled' | 'packageParentTokenId' | 'packageParentProductionId'
  >
): boolean {
  return (
    row.packageDealEnabled === true ||
    Boolean(row.packageParentTokenId?.trim()) ||
    Boolean(row.packageParentProductionId?.trim())
  );
}

export function isCatalogBaseProductionRow(
  row: Pick<
    CardIssuanceProductionRow,
    'packageDealEnabled' | 'packageParentTokenId' | 'packageParentProductionId'
  >
): boolean {
  return !isCatalogPackageDealRow(row);
}

/** BigInt tokenId for sort; null when draft or not yet issued on-chain. */
export function catalogProductionNftTokenIdBigInt(
  issuedTokenId: string | number | undefined
): bigint | null {
  const tid = normalizeCatalogIssuedNftTokenIdForExplorer(issuedTokenId);
  if (!tid) return null;
  try {
    return BigInt(tid);
  } catch {
    return null;
  }
}

/** Catalog list: higher NFT # first; non-issued rows after all issued rows. */
export function compareCatalogProductionRowsByNftTokenIdDesc(
  a: Pick<CardIssuanceProductionRow, 'issuedTokenId' | 'name'>,
  b: Pick<CardIssuanceProductionRow, 'issuedTokenId' | 'name'>
): number {
  const aNft = catalogProductionNftTokenIdBigInt(a.issuedTokenId);
  const bNft = catalogProductionNftTokenIdBigInt(b.issuedTokenId);
  if (aNft != null && bNft != null) {
    if (aNft > bNft) return -1;
    if (aNft < bNft) return 1;
  } else if (aNft != null) return -1;
  else if (bNft != null) return 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export type CatalogProductionGlobalCategoryGroup = {
  globalCategory: CatalogGlobalCategoryId;
  rows: CardIssuanceProductionRow[];
};

/** Group base catalog rows by `globalCategory`; each group sorted by NFT # descending. */
export function groupCatalogBaseProductionsByGlobalCategory(
  productions: CardIssuanceProductionRow[]
): CatalogProductionGlobalCategoryGroup[] {
  const buckets = new Map<CatalogGlobalCategoryId, CardIssuanceProductionRow[]>();
  for (const row of productions) {
    if (!isCatalogBaseProductionRow(row)) continue;
    const cat = normalizeCatalogGlobalCategory(row.globalCategory);
    const list = buckets.get(cat) ?? [];
    list.push(row);
    buckets.set(cat, list);
  }
  const groups: CatalogProductionGlobalCategoryGroup[] = [];
  const seen = new Set<CatalogGlobalCategoryId>();
  for (const opt of CATALOG_GLOBAL_CATEGORY_OPTIONS) {
    const rows = buckets.get(opt.id);
    if (!rows?.length) continue;
    seen.add(opt.id);
    rows.sort(compareCatalogProductionRowsByNftTokenIdDesc);
    groups.push({ globalCategory: opt.id, rows });
  }
  for (const [cat, rows] of buckets) {
    if (seen.has(cat) || rows.length === 0) continue;
    rows.sort(compareCatalogProductionRowsByNftTokenIdDesc);
    groups.push({ globalCategory: cat, rows });
  }
  return groups;
}

export function catalogPackageDealsForBase(
  rows: CardIssuanceProductionRow[],
  base: CardIssuanceProductionRow
): CardIssuanceProductionRow[] {
  const baseToken = base.issuedTokenId?.trim() ?? '';
  const baseId = base.id;
  return rows.filter((row) => {
    if (!isCatalogPackageDealRow(row)) return false;
    const parentToken = row.packageParentTokenId?.trim() ?? '';
    const parentId = row.packageParentProductionId?.trim() ?? '';
    if (baseToken && parentToken && parentToken === baseToken) return true;
    if (parentId && parentId === baseId) return true;
    return false;
  });
}

export function resolvePackageParentTokenIdFromMeta(meta: Record<string, unknown>): string {
  const fromPackage = meta.Package;
  if (typeof fromPackage === 'string' && fromPackage.trim()) return fromPackage.trim();
  if (typeof fromPackage === 'number' && Number.isFinite(fromPackage)) return String(fromPackage);
  const fromSnake = meta.packageParentTokenId;
  if (typeof fromSnake === 'string' && fromSnake.trim()) return fromSnake.trim();
  if (typeof fromSnake === 'number' && Number.isFinite(fromSnake)) return String(fromSnake);
  return '';
}

export function computePackagePerSessionPrice(draft: CatalogPackageDealDraft): number | null {
  const sessionsN = Number.parseInt(String(draft.packageSessions).replace(/,/g, ''), 10);
  const totalN = parseProductionMoney(draft.packageTotalPrice);
  if (!Number.isFinite(sessionsN) || sessionsN <= 0 || totalN == null || totalN <= 0) return null;
  return totalN / sessionsN;
}

export function validateCatalogPackageDealDraft(draft: CatalogPackageDealDraft): string | null {
  if (draft.issued) return null;
  const totalN = parseProductionMoney(draft.packageTotalPrice);
  if (totalN == null || totalN <= 0) return 'Each package deal must have a total price greater than 0.';
  const sessionsN = Number.parseInt(String(draft.packageSessions).replace(/,/g, ''), 10);
  if (!Number.isFinite(sessionsN) || sessionsN < 1) {
    return 'Each package deal must include at least 1 session.';
  }
  const bonusRaw = String(draft.packageBonusSessions).replace(/,/g, '').trim();
  const bonusN = bonusRaw === '' ? 0 : Number.parseInt(bonusRaw, 10);
  if (!Number.isFinite(bonusN) || bonusN < 0) {
    return 'Package bonus sessions must be 0 or greater.';
  }
  return null;
}

export function buildPackageProductionRowFromBase(
  base: CardIssuanceProductionRow,
  draft: CatalogPackageDealDraft,
  parentTokenId: string
): CardIssuanceProductionRow {
  return makeCardIssuanceProductionRow({
    id: draft.id,
    name: base.name,
    subtitle: base.subtitle,
    globalCategory: base.globalCategory,
    itemCategory: base.itemCategory,
    singleSessionPrice: '0',
    packageDealEnabled: true,
    packageSessions: draft.packageSessions,
    packageBonusSessions: draft.packageBonusSessions,
    packageTotalPrice: draft.packageTotalPrice,
    packageParentTokenId: parentTokenId,
    issueTotal: base.issueTotal,
    issueTotalUnlimited: base.issueTotalUnlimited,
    icon: base.icon,
    backgroundColor: base.backgroundColor,
    productionImage: base.productionImage,
    ...(base.productionImageMime?.trim()
      ? { productionImageMime: base.productionImageMime.trim() }
      : {}),
    ...(base.productionImageStartSec != null && base.productionImageStartSec > 0
      ? { productionImageStartSec: base.productionImageStartSec }
      : {}),
    description: base.description,
    issued: draft.issued === true,
    ...(draft.issuedTokenId?.trim() ? { issuedTokenId: draft.issuedTokenId.trim() } : {}),
  });
}

export function buildPackageProductionDraftRowFromBase(
  base: CardIssuanceProductionRow,
  draft: CatalogPackageDealDraft
): CardIssuanceProductionRow {
  return makeCardIssuanceProductionRow({
    id: draft.id,
    name: base.name,
    subtitle: base.subtitle,
    globalCategory: base.globalCategory,
    itemCategory: base.itemCategory,
    singleSessionPrice: '0',
    packageDealEnabled: true,
    packageSessions: draft.packageSessions,
    packageBonusSessions: draft.packageBonusSessions,
    packageTotalPrice: draft.packageTotalPrice,
    packageParentProductionId: base.id,
    issueTotal: base.issueTotal,
    issueTotalUnlimited: base.issueTotalUnlimited,
    icon: base.icon,
    backgroundColor: base.backgroundColor,
    productionImage: base.productionImage,
    ...(base.productionImageMime?.trim()
      ? { productionImageMime: base.productionImageMime.trim() }
      : {}),
    ...(base.productionImageStartSec != null && base.productionImageStartSec > 0
      ? { productionImageStartSec: base.productionImageStartSec }
      : {}),
    description: base.description,
    issued: false,
  });
}

export function parseProductionMoney(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/,/g, '').trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function productionEffectiveChargeAmount(
  row: Pick<CardIssuanceProductionRow, 'packageDealEnabled' | 'singleSessionPrice' | 'packageTotalPrice'>
): number {
  if (row.packageDealEnabled) {
    return parseProductionMoney(row.packageTotalPrice) ?? 0;
  }
  return parseProductionMoney(row.singleSessionPrice) ?? 0;
}

/** Catalog list / editor display amount (legacy package rows use package total). */
export function catalogProductionDisplayPrice(
  row: Pick<CardIssuanceProductionRow, 'packageDealEnabled' | 'singleSessionPrice' | 'packageTotalPrice'>
): number | null {
  if (row.packageDealEnabled) {
    return parseProductionMoney(row.packageTotalPrice);
  }
  return parseProductionMoney(row.singleSessionPrice);
}

/** Free catalog items (price 0) may use open claim or redeem code; paid items cannot be claimed. */
export function productionClaimEligible(
  row: Pick<CardIssuanceProductionRow, 'packageDealEnabled' | 'singleSessionPrice' | 'packageTotalPrice'>
): boolean {
  return productionEffectiveChargeAmount(row) === 0;
}

export function isProductionIssueTotalUnlimited(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === '1' || raw === 'true';
}

export function resolveProductionIssueTotalUnlimitedFromHydration(
  meta: Record<string, unknown>,
  issueTotalFromChain?: string
): boolean {
  if (isProductionIssueTotalUnlimited(meta.issueTotalUnlimited)) return true;
  const chainRaw = String(issueTotalFromChain ?? '')
    .replace(/,/g, '')
    .trim();
  const chainN = chainRaw ? Number.parseInt(chainRaw, 10) : Number.NaN;
  return Number.isFinite(chainN) && chainN >= CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX;
}

export function productionIssueTotalDisplayLabel(
  row: Pick<CardIssuanceProductionRow, 'issueTotal' | 'issueTotalUnlimited'>
): string {
  if (row.issueTotalUnlimited) return 'Unlimited';
  const issueN = Number.parseInt(String(row.issueTotal).replace(/,/g, ''), 10);
  return Number.isFinite(issueN) ? issueN.toLocaleString() : String(row.issueTotal);
}

/** Business Catalogs preview: hide issuance row when supply is unlimited. */
export function catalogBusinessPreviewShowsIssuanceLine(
  row: Pick<CardIssuanceProductionRow, 'issueTotalUnlimited'>,
  ogSharePreviewLayout?: boolean
): boolean {
  if (!ogSharePreviewLayout) return true;
  return !row.issueTotalUnlimited;
}

export function computeProductionIssueTotalN(
  row: Pick<CardIssuanceProductionRow, 'issueTotal' | 'issueTotalUnlimited'>
): number {
  if (row.issueTotalUnlimited) return CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX;
  const issueRaw = String(row.issueTotal).replace(/,/g, '').trim();
  const issueN = Number.parseInt(issueRaw, 10);
  if (Number.isFinite(issueN) && issueN >= 1 && issueN <= CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_MAX) {
    return issueN;
  }
  return CARD_ISSUANCE_PRODUCTION_ISSUE_TOTAL_DEFAULT;
}

export function computeProductionPackageSavingsPerSession(args: {
  singleSessionPrice: number;
  packageSessions: number;
  packageTotalPrice: number;
}): number | null {
  const { singleSessionPrice, packageSessions, packageTotalPrice } = args;
  if (!(singleSessionPrice > 0 && packageSessions > 0 && packageTotalPrice > 0)) return null;
  const perSession = packageTotalPrice / packageSessions;
  const savings = singleSessionPrice - perSession;
  return Number.isFinite(savings) && savings > 0 ? savings : null;
}

export function buildCardIssuanceProductionMetadataPayload(
  rows: CardIssuanceProductionRow[]
): CardIssuanceProductionMetadataPayload[] | undefined {
  const out = rows
    .map((row): CardIssuanceProductionMetadataPayload | null => {
      const id = row.id.trim();
      const name = row.name.trim();
      if (!id || !name) return null;
      const issueTotalN = computeProductionIssueTotalN(row);
      const single = parseProductionMoney(row.singleSessionPrice);
      const pkgTotal = parseProductionMoney(row.packageTotalPrice);
      const pkgSessions = Number.parseInt(String(row.packageSessions).replace(/,/g, ''), 10);
      const pkgBonus = Number.parseInt(String(row.packageBonusSessions).replace(/,/g, ''), 10);
      const tileBg = effectiveTileBackgroundColorForMetadata({
        photo: row.productionImage,
        backgroundColor: row.backgroundColor,
      });
      const parentToken = row.packageParentTokenId?.trim() ?? '';
      const payload: CardIssuanceProductionMetadataPayload = {
        id,
        name,
        issueTotal: issueTotalN,
        ...(row.issueTotalUnlimited ? { issueTotalUnlimited: true } : {}),
        category: normalizeCatalogGlobalCategory(row.globalCategory),
        ...(row.subtitle.trim() ? { subtitle: row.subtitle.trim() } : {}),
        ...(row.itemCategory ? { itemCategory: row.itemCategory } : {}),
        ...(!row.packageDealEnabled && single != null ? { singleSessionPrice: single } : {}),
        ...(row.packageDealEnabled ? { packageDealEnabled: true } : {}),
        ...(row.packageDealEnabled && Number.isFinite(pkgSessions) ? { packageSessions: pkgSessions } : {}),
        ...(row.packageDealEnabled && Number.isFinite(pkgBonus) ? { packageBonusSessions: pkgBonus } : {}),
        ...(row.packageDealEnabled && pkgTotal != null ? { packageTotalPrice: pkgTotal } : {}),
        ...(parentToken ? { Package: parentToken, packageParentTokenId: parentToken } : {}),
        ...(row.icon.trim() ? { icon: row.icon.trim() } : {}),
        ...(tileBg ? { backgroundColor: tileBg } : {}),
        ...(row.productionImage.trim() ? { productionImage: row.productionImage.trim() } : {}),
        ...(row.productionImageStartSec != null &&
        Number.isFinite(row.productionImageStartSec) &&
        row.productionImageStartSec > 0
          ? { productionImageStartSec: row.productionImageStartSec }
          : {}),
        ...(row.productionImageMime?.trim()
          ? { productionImageMime: row.productionImageMime.trim() }
          : {}),
        ...(row.description.trim() ? { description: row.description.trim() } : {}),
        ...(row.requiresRedeemCode ? { requiresRedeemCode: true } : {}),
      };
      if (row.issued) payload.issued = true;
      const it = row.issuedTokenId?.trim();
      if (it) payload.issuedTokenId = it;
      return payload;
    })
    .filter((row): row is CardIssuanceProductionMetadataPayload => row != null);
  return out.length > 0 ? out : undefined;
}

export function buildProductionIssuedNftMetaProps(
  row: CardIssuanceProductionRow,
  options?: { publisherBeamioTag?: string }
): Record<string, unknown> {
  const publisherBeamioTag = options?.publisherBeamioTag?.trim().replace(/^@/, '') ?? '';
  const issueTotalN = computeProductionIssueTotalN(row);
  const single = parseProductionMoney(row.singleSessionPrice);
  const pkgTotal = parseProductionMoney(row.packageTotalPrice);
  const pkgSessions = Number.parseInt(String(row.packageSessions).replace(/,/g, ''), 10);
  const pkgBonus = Number.parseInt(String(row.packageBonusSessions).replace(/,/g, ''), 10);
  const tileBg = effectiveTileBackgroundColorForMetadata({
    photo: row.productionImage,
    backgroundColor: row.backgroundColor,
  });
  const parentToken = row.packageParentTokenId?.trim() ?? '';
  return {
    category: normalizeCatalogGlobalCategory(row.globalCategory),
    ...(row.requiresRedeemCode ? { requiresRedeemCode: true } : {}),
    beamioProduction: {
      productionId: row.id,
      name: row.name.trim(),
      ...(row.requiresRedeemCode ? { requiresRedeemCode: true } : {}),
      ...(row.subtitle.trim() ? { subtitle: row.subtitle.trim() } : {}),
      itemCategory: row.itemCategory,
      issueTotal: issueTotalN,
      ...(row.issueTotalUnlimited ? { issueTotalUnlimited: true } : {}),
      ...(!row.packageDealEnabled && single != null ? { singleSessionPrice: single } : {}),
      ...(row.packageDealEnabled ? { packageDealEnabled: true } : {}),
      ...(row.packageDealEnabled && Number.isFinite(pkgSessions) ? { packageSessions: pkgSessions } : {}),
      ...(row.packageDealEnabled && Number.isFinite(pkgBonus) ? { packageBonusSessions: pkgBonus } : {}),
      ...(row.packageDealEnabled && pkgTotal != null ? { packageTotalPrice: pkgTotal } : {}),
      ...(parentToken ? { Package: parentToken, packageParentTokenId: parentToken } : {}),
      ...(row.icon.trim() ? { icon: row.icon.trim() } : {}),
      ...(tileBg ? { backgroundColor: tileBg } : {}),
      ...(row.productionImage.trim() ? { productionImage: row.productionImage.trim() } : {}),
      ...(row.productionImageStartSec != null &&
      Number.isFinite(row.productionImageStartSec) &&
      row.productionImageStartSec > 0
        ? { productionImageStartSec: row.productionImageStartSec }
        : {}),
      ...(row.productionImageMime?.trim()
        ? { productionImageMime: row.productionImageMime.trim() }
        : {}),
      ...(row.description.trim() ? { description: row.description.trim() } : {}),
      ...(publisherBeamioTag ? { publisherBeamioTag } : {}),
    },
  };
}

export type ProductionBackgroundMediaKind = 'image' | 'video' | 'pdf';

export function productionBackgroundMediaKindFromMime(mime: unknown): ProductionBackgroundMediaKind {
  const m = typeof mime === 'string' ? mime.trim().toLowerCase() : '';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf') return 'pdf';
  return 'image';
}

export function resolveProductionBackgroundMediaKind(args: {
  url?: unknown;
  mime?: unknown;
}): ProductionBackgroundMediaKind {
  const mime = typeof args.mime === 'string' ? args.mime.trim().toLowerCase() : '';
  if (mime === 'video/youtube') return 'video';
  const mimeKind =
    typeof args.mime === 'string' && args.mime.trim()
      ? productionBackgroundMediaKindFromMime(args.mime)
      : null;
  if (mimeKind === 'video' || mimeKind === 'pdf') return mimeKind;
  const u = typeof args.url === 'string' ? args.url.trim().toLowerCase() : '';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'video';
  if (u.includes('.pdf') || u.includes('application/pdf')) return 'pdf';
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|&|$)/i.test(u)) return 'video';
  return mimeKind ?? 'image';
}

/** Infer stored mime when issued-series / share metadata omitted `productionImageMime` but URL is video. */
export function inferProductionImageMimeFromUrl(url: string): string | undefined {
  const u = url.trim();
  if (!u) return undefined;
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'video/youtube';
  const kind = resolveProductionBackgroundMediaKind({ url: u, mime: '' });
  if (kind === 'video') return 'video/mp4';
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'image') return 'image/jpeg';
  return undefined;
}

export function normalizeServiceCategoryLabelForHash(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Stable id derived from normalized category label (dedupe key). */
export function serviceCategoryHashIdFromLabel(label: string): string {
  const key = normalizeServiceCategoryLabelForHash(label);
  if (!key) return '';
  return ethers
    .keccak256(ethers.toUtf8Bytes(`beamio:serviceCategory:${key}`))
    .slice(2, 18);
}

export type FinalizeServiceCategoriesResult =
  | {
      ok: true;
      categories: ProductionServiceCategoryOption[];
      idMap: Map<string, string>;
    }
  | { ok: false; error: string };

/** Re-hash every category id from its label and reject duplicate names. */
export function finalizeServiceCategoriesByLabelHash(
  rows: ProductionServiceCategoryOption[]
): FinalizeServiceCategoriesResult {
  const hashKeysSeen = new Set<string>();
  const idSeen = new Set<string>();
  const categories: ProductionServiceCategoryOption[] = [];
  const idMap = new Map<string, string>();

  for (const row of rows) {
    const label = row.label.trim();
    if (!label) {
      return { ok: false, error: 'Category name is required.' };
    }
    const hashKey = normalizeServiceCategoryLabelForHash(label);
    if (hashKeysSeen.has(hashKey)) {
      return { ok: false, error: 'Duplicate category name is not allowed.' };
    }
    const newId = serviceCategoryHashIdFromLabel(label);
    if (!newId) {
      return { ok: false, error: 'Category name is invalid.' };
    }
    if (idSeen.has(newId)) {
      return { ok: false, error: 'Duplicate category is not allowed.' };
    }
    hashKeysSeen.add(hashKey);
    idSeen.add(newId);
    idMap.set(row.id, newId);
    categories.push({ id: newId, label });
  }

  return { ok: true, categories, idMap };
}

export function uniqueDefaultNewServiceCategoryLabel(
  existing: ProductionServiceCategoryOption[]
): string {
  const keys = new Set(existing.map((row) => normalizeServiceCategoryLabelForHash(row.label)));
  let label = NEW_PRODUCTION_SERVICE_CATEGORY_DEFAULT_LABEL;
  let n = 2;
  while (keys.has(normalizeServiceCategoryLabelForHash(label))) {
    label = `${NEW_PRODUCTION_SERVICE_CATEGORY_DEFAULT_LABEL} ${n}`;
    n += 1;
  }
  return label;
}

export function remapProductionRowsItemCategoryIds(
  rows: CardIssuanceProductionRow[],
  idMap: Map<string, string>
): CardIssuanceProductionRow[] {
  if (idMap.size === 0) return rows;
  let changed = false;
  const next = rows.map((row) => {
    const mapped = idMap.get(row.itemCategory);
    if (mapped && mapped !== row.itemCategory) {
      changed = true;
      return { ...row, itemCategory: mapped };
    }
    return row;
  });
  return changed ? next : rows;
}

/** @deprecated Use `remapProductionRowsItemCategoryIds`. */
export const remapProductionRowsServiceCategoryIds = remapProductionRowsItemCategoryIds;

/** Compare two category lists by normalized label set (order-independent). */
export function serviceCategoryListsEquivalent(
  a: ProductionServiceCategoryOption[],
  b: ProductionServiceCategoryOption[]
): boolean {
  if (a.length !== b.length) return false;
  const keysA = a.map((row) => normalizeServiceCategoryLabelForHash(row.label)).sort();
  const keysB = b.map((row) => normalizeServiceCategoryLabelForHash(row.label)).sort();
  return keysA.every((key, idx) => key === keysB[idx]);
}

export function normalizeItemCategoryList(raw: unknown): ProductionServiceCategoryOption[] {
  return normalizeServiceCategoryList(raw);
}

export function normalizeServiceCategoryList(raw: unknown): ProductionServiceCategoryOption[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: ProductionServiceCategoryOption[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

/**
 * Issued-series rows from API/DB may store catalog fields on the root, under `properties`, or in `beamioProduction`.
 */
/** Prefer non-empty text from series vs share-metadata row when merging hydration sources. */
export function mergeCatalogProductionHydrationRows(
  base: CardIssuanceProductionRow,
  incoming: CardIssuanceProductionRow
): CardIssuanceProductionRow {
  const pickStr = (a: string, b: string) => (b.trim() ? b : a);
  return {
    ...base,
    ...incoming,
    name: pickStr(base.name, incoming.name),
    subtitle: pickStr(base.subtitle, incoming.subtitle),
    description: pickStr(base.description, incoming.description),
    productionImage: pickStr(base.productionImage, incoming.productionImage),
    productionImageMime: (() => {
      const inc = incoming.productionImageMime?.trim() ?? '';
      if (inc) return inc;
      const baseMime = base.productionImageMime?.trim() ?? '';
      if (baseMime) return baseMime;
      const image = pickStr(base.productionImage, incoming.productionImage);
      return inferProductionImageMimeFromUrl(image) ?? '';
    })(),
    icon: pickStr(base.icon, incoming.icon),
    globalCategory: incoming.globalCategory ?? base.globalCategory,
    itemCategory: incoming.itemCategory || base.itemCategory,
    issued: base.issued || incoming.issued,
    issuedTokenId: incoming.issuedTokenId?.trim() ? incoming.issuedTokenId : base.issuedTokenId,
    issuedNftMintedCount: incoming.issuedNftMintedCount?.trim()
      ? incoming.issuedNftMintedCount
      : base.issuedNftMintedCount,
    issueLeft: incoming.issueLeft?.trim() ? incoming.issueLeft : base.issueLeft,
    requiresRedeemCode: base.requiresRedeemCode || incoming.requiresRedeemCode,
  };
}

export function flattenIssuedProductionSeriesMetadata(
  rootMeta: Record<string, unknown>
): Record<string, unknown> {
  const props =
    rootMeta.properties && typeof rootMeta.properties === 'object' && !Array.isArray(rootMeta.properties)
      ? (rootMeta.properties as Record<string, unknown>)
      : {};
  const fromProps =
    props.beamioProduction &&
    typeof props.beamioProduction === 'object' &&
    !Array.isArray(props.beamioProduction)
      ? (props.beamioProduction as Record<string, unknown>)
      : {};
  const fromRoot =
    rootMeta.beamioProduction &&
    typeof rootMeta.beamioProduction === 'object' &&
    !Array.isArray(rootMeta.beamioProduction)
      ? (rootMeta.beamioProduction as Record<string, unknown>)
      : {};
  const productionId =
    (typeof rootMeta.productionId === 'string' && rootMeta.productionId.trim()) ||
    (typeof fromRoot.productionId === 'string' && fromRoot.productionId.trim()) ||
    (typeof fromProps.productionId === 'string' && fromProps.productionId.trim()) ||
    (typeof rootMeta.id === 'string' && rootMeta.id.trim()) ||
    (typeof fromRoot.id === 'string' && fromRoot.id.trim()) ||
    (typeof fromProps.id === 'string' && fromProps.id.trim()) ||
    '';
  return {
    ...rootMeta,
    ...fromProps,
    ...fromRoot,
    ...(productionId ? { productionId, id: productionId } : {}),
  };
}

export function resolveProductionItemCategoryId(
  raw: unknown,
  options: ProductionServiceCategoryOption[]
): string {
  return resolveProductionServiceCategoryId(raw, options);
}

export function resolveProductionServiceCategoryId(
  raw: unknown,
  options: ProductionServiceCategoryOption[]
): string {
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (options.some((opt) => opt.id === id)) return id;
  return options[0]?.id ?? DEFAULT_PRODUCTION_SERVICE_CATEGORY_OPTIONS[0].id;
}

export function productionItemCategoryLabel(
  id: string,
  options: ProductionServiceCategoryOption[]
): string {
  return productionServiceCategoryLabel(id, options);
}

export function productionServiceCategoryLabel(
  id: string,
  options: ProductionServiceCategoryOption[]
): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

export function productionIconLooksLikeImageUrl(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('ipfs://') ||
    t.startsWith('data:image')
  );
}

export const PRODUCTION_ITEM_COLOR_PRESETS = [
  '#ea580c',
  '#94a3b8',
  '#f59e0b',
  '#6366f1',
  '#0051d1',
  '#9333ea',
  '#059669',
  '#ec4899',
] as const;

/** @see beamio-tile-background-photo-protocol.mdc */
export function hasTileBackgroundPhoto(photo: unknown): boolean {
  return typeof photo === 'string' && photo.trim().length > 0;
}

/** True when solid `backgroundColor` applies (no wide background photo). */
export function tileBackgroundColorApplies(photo: unknown): boolean {
  return !hasTileBackgroundPhoto(photo);
}

/** Business Catalog editor: hide tile color when background is (or will be) video. */
export function catalogEditorTileBackgroundColorApplies(args: {
  productionImage?: string;
  productionImageMime?: string;
  productionVideoDraftUrl?: string;
}): boolean {
  if (typeof args.productionVideoDraftUrl === 'string' && args.productionVideoDraftUrl.trim()) {
    return false;
  }
  const url = typeof args.productionImage === 'string' ? args.productionImage.trim() : '';
  if (!url) return tileBackgroundColorApplies(url);
  if (
    resolveProductionBackgroundMediaKind({
      url,
      mime: args.productionImageMime,
    }) === 'video'
  ) {
    return false;
  }
  return tileBackgroundColorApplies(url);
}

export function effectiveTileBackgroundColorForMetadata(args: {
  photo: unknown;
  backgroundColor: unknown;
}): string | undefined {
  if (!tileBackgroundColorApplies(args.photo)) return undefined;
  const raw = typeof args.backgroundColor === 'string' ? args.backgroundColor.trim() : '';
  return raw || undefined;
}
