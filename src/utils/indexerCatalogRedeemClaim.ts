import { ethers } from 'ethers';
import { isCatalogGlobalCategoryId, normalizeCatalogGlobalCategory } from '@/pages/Vouchers/example/cardIssuanceProductions';

/** On-chain issued coupon/catalog NFT ids (not membership tier band [100, 1e11)). */
export const CATALOG_ISSUED_NFT_TOKEN_ID_MIN = 100_000_000_000n;

const BEAMIO_COUPON_NFT_CATEGORY = 'Coupon';

const MEMBERSHIP_TIER_TOKEN_ID_MIN = 100n;

const REDEEM_LEDGER_CATEGORY_LOWER = new Set(
  [
    'redeemNewCard',
    'redeemUpgradeNewCard',
    'redeemTopupCard',
  ].map((name) => ethers.keccak256(ethers.toUtf8Bytes(name)).toLowerCase())
);

export type IndexerCardRedeemDisplayMeta = {
  source: string;
  topupCategory: string;
  title: string;
  distributionKind?: 'coupon' | 'catalog';
  globalCategory?: string;
  couponId?: string;
  productionId?: string;
};

export type IndexerIssuedNftRedeemChannel = 'app' | 'in_store';

export type IndexerIssuedNftRedeemProductKind = 'coupon' | 'catalog';

export type IndexerIssuedNftRedeemBizActivityType =
  | 'Claim Coupons'
  | 'Claim Catalogs'
  | 'In-Store Redeem';

export function parseIndexerCardRedeemDisplayJson(displayJson: string): IndexerCardRedeemDisplayMeta | null {
  try {
    const j = JSON.parse(displayJson || '{}') as Record<string, unknown>;
    const source = String(j.source ?? '').trim();
    const topupCategory = String(j.topupCategory ?? '').trim();
    const title = String(j.title ?? '').trim();
    const distributionKindRaw = String(j.distributionKind ?? '').trim().toLowerCase();
    const distributionKind =
      distributionKindRaw === 'coupon' || distributionKindRaw === 'catalog'
        ? (distributionKindRaw as 'coupon' | 'catalog')
        : undefined;
    const globalCategory = String(j.globalCategory ?? '').trim() || undefined;
    const couponId = String(j.couponId ?? '').trim() || undefined;
    const productionId = String(j.productionId ?? '').trim() || undefined;
    if (!source && !topupCategory && !title && !distributionKind && !globalCategory) return null;
    return {
      source,
      topupCategory,
      title,
      distributionKind,
      globalCategory,
      couponId,
      productionId,
    };
  } catch {
    return null;
  }
}

function isCouponGlobalCategory(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === BEAMIO_COUPON_NFT_CATEGORY.toLowerCase();
}

/** `beamio_nft_series.metadata_json` or `/api/seriesSharedMetadata` metadata object. */
export function seriesMetadataProductKind(
  meta: Record<string, unknown> | null | undefined
): IndexerIssuedNftRedeemProductKind | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const rootCat = meta.category;
  if (rootCat != null && String(rootCat).trim() !== '') {
    if (isCouponGlobalCategory(rootCat)) return 'coupon';
    if (isCatalogGlobalCategoryId(rootCat) || String(rootCat).trim().toLowerCase() === 'productions') {
      return 'catalog';
    }
  }
  const props = meta.properties;
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    const propCat = (props as Record<string, unknown>).category;
    if (propCat != null && String(propCat).trim() !== '') {
      if (isCouponGlobalCategory(propCat)) return 'coupon';
      if (isCatalogGlobalCategoryId(propCat)) return 'catalog';
    }
    const beamioCoupon = (props as Record<string, unknown>).beamioCoupon;
    if (beamioCoupon != null && typeof beamioCoupon === 'object' && !Array.isArray(beamioCoupon)) {
      return 'coupon';
    }
    const beamioProduction = (props as Record<string, unknown>).beamioProduction;
    if (beamioProduction != null && typeof beamioProduction === 'object' && !Array.isArray(beamioProduction)) {
      return 'catalog';
    }
  }
  if (typeof meta.couponId === 'string' && meta.couponId.trim()) return 'coupon';
  if (typeof meta.productionId === 'string' && meta.productionId.trim()) return 'catalog';
  const id = typeof meta.id === 'string' ? meta.id.trim() : '';
  if (id && (meta.issueTotal != null || meta.issuedTokenId != null || meta.requiresRedeemCode != null)) {
    return 'coupon';
  }
  if (id && meta.singleSessionPrice != null) return 'catalog';
  return null;
}

export function mergeIssuedNftRedeemDistributionIntoDisplayJson(
  displayJson: string,
  fields: {
    distributionKind: IndexerIssuedNftRedeemProductKind;
    globalCategory: string;
    couponId?: string;
    productionId?: string;
  }
): string {
  try {
    const j = JSON.parse(displayJson || '{}') as Record<string, unknown>;
    return JSON.stringify({
      ...j,
      distributionKind: fields.distributionKind,
      globalCategory: fields.globalCategory,
      ...(fields.couponId ? { couponId: fields.couponId } : {}),
      ...(fields.productionId ? { productionId: fields.productionId } : {}),
    });
  } catch {
    return displayJson;
  }
}

export function normalizeIndexerTxCategoryHex(cat: unknown): string {
  if (cat == null) return '';
  if (typeof cat === 'string') {
    const s = cat.trim();
    if (!s) return '';
    if (s.startsWith('0x')) return s.toLowerCase();
    try {
      return ethers.hexlify(s as ethers.BytesLike).toLowerCase();
    } catch {
      try {
        return `0x${BigInt(s).toString(16).padStart(64, '0')}`.toLowerCase();
      } catch {
        return '';
      }
    }
  }
  try {
    return ethers.hexlify(cat as ethers.BytesLike).toLowerCase();
  } catch {
    return '';
  }
}

export function normalizeIndexerLedgerAddress(addr: unknown): string {
  if (typeof addr !== 'string' || !addr.trim() || !ethers.isAddress(addr)) return '';
  return ethers.getAddress(addr).toLowerCase();
}

function routeItemTokenIdBigint(item: unknown): bigint | null {
  if (!item || typeof item !== 'object') return null;
  const raw = (item as { tokenId?: unknown }).tokenId;
  try {
    if (typeof raw === 'bigint') return raw;
    if (typeof raw === 'number' && Number.isFinite(raw)) return BigInt(Math.trunc(raw));
    if (typeof raw === 'string' && raw.trim()) return BigInt(raw.trim());
  } catch {
    return null;
  }
  return null;
}

export function indexerRouteCardAddress(route: unknown): string {
  if (!Array.isArray(route) || route.length === 0) return '';
  for (const item of route) {
    if (!item || typeof item !== 'object') continue;
    const asset = (item as { asset?: unknown }).asset;
    if (typeof asset === 'string' && ethers.isAddress(asset)) {
      return ethers.getAddress(asset);
    }
  }
  return '';
}

export function indexerRouteMaxPositiveTokenId(route: unknown): bigint | null {
  if (!Array.isArray(route) || route.length === 0) return null;
  let max = 0n;
  for (const item of route) {
    const tid = routeItemTokenIdBigint(item);
    if (tid != null && tid > max) max = tid;
  }
  return max > 0n ? max : null;
}

export function indexerTxIsCardRedeemLedgerCategory(txCategory: unknown): boolean {
  const cat = normalizeIndexerTxCategoryHex(txCategory);
  return cat !== '' && REDEEM_LEDGER_CATEGORY_LOWER.has(cat);
}

export function isIndexerIssuedNftCardRedeemTx(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
}): boolean {
  const redeem = parseIndexerCardRedeemDisplayJson(
    typeof args.displayJson === 'string' ? args.displayJson : ''
  );
  if (!redeem || redeem.source !== 'cardRedeem') return false;
  if (!indexerTxIsCardRedeemLedgerCategory(args.txCategory)) return false;
  const maxToken = indexerRouteMaxPositiveTokenId(args.route);
  if (maxToken == null) return false;
  return maxToken >= CATALOG_ISSUED_NFT_TOKEN_ID_MIN;
}

export function isIndexerInStoreRedeemLedgerSubordinate(args: {
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
}): boolean {
  const zero = ethers.ZeroAddress.toLowerCase();
  const payer = normalizeIndexerLedgerAddress(args.payer);
  const payee = normalizeIndexerLedgerAddress(args.payee);
  const subordinate = normalizeIndexerLedgerAddress(args.subordinate);
  const topAdmin = normalizeIndexerLedgerAddress(args.topAdmin);

  if (!subordinate || subordinate === zero) return false;
  if (payer && subordinate === payer) return false;
  if (payee && subordinate === payee) return false;

  if (payer && topAdmin && topAdmin === payer && subordinate !== payer) return true;
  if (payer && !topAdmin && subordinate !== payer) return true;
  return false;
}

export function classifyIndexerIssuedNftRedeemProductKind(args: {
  displayJson?: unknown;
  seriesMetadata?: Record<string, unknown> | null;
}): IndexerIssuedNftRedeemProductKind | null {
  const redeem = parseIndexerCardRedeemDisplayJson(
    typeof args.displayJson === 'string' ? args.displayJson : ''
  );
  if (redeem?.distributionKind === 'coupon' || redeem?.distributionKind === 'catalog') {
    return redeem.distributionKind;
  }
  if (redeem?.globalCategory) {
    if (isCouponGlobalCategory(redeem.globalCategory)) return 'coupon';
    if (isCatalogGlobalCategoryId(redeem.globalCategory)) return 'catalog';
  }
  if (redeem?.couponId) return 'coupon';
  if (redeem?.productionId) return 'catalog';
  return seriesMetadataProductKind(args.seriesMetadata ?? null);
}

export function classifyIndexerIssuedNftRedeemChannel(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
}): IndexerIssuedNftRedeemChannel | null {
  const redeem = parseIndexerCardRedeemDisplayJson(
    typeof args.displayJson === 'string' ? args.displayJson : ''
  );
  if (!redeem || redeem.source !== 'cardRedeem') return null;
  if (!indexerTxIsCardRedeemLedgerCategory(args.txCategory)) return null;

  const maxToken = indexerRouteMaxPositiveTokenId(args.route);
  const inStore = isIndexerInStoreRedeemLedgerSubordinate(args);

  if (maxToken != null) {
    if (maxToken < CATALOG_ISSUED_NFT_TOKEN_ID_MIN) return null;
    if (maxToken >= MEMBERSHIP_TIER_TOKEN_ID_MIN && maxToken < CATALOG_ISSUED_NFT_TOKEN_ID_MIN) {
      return null;
    }
    return inStore ? 'in_store' : 'app';
  }

  if (!inStore) {
    const payer = normalizeIndexerLedgerAddress(args.payer);
    const sub = normalizeIndexerLedgerAddress(args.subordinate);
    if (payer && sub && sub === payer) return 'app';
    return null;
  }
  return 'in_store';
}

/** Merchant ledger / Transactions row type for issued-NFT `cardRedeem`. */
export function mapIndexerIssuedNftRedeemBizActivityType(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
  seriesMetadata?: Record<string, unknown> | null;
}): IndexerIssuedNftRedeemBizActivityType | null {
  const channel = classifyIndexerIssuedNftRedeemChannel(args);
  if (!channel) return null;
  const product = classifyIndexerIssuedNftRedeemProductKind({
    displayJson: args.displayJson,
    seriesMetadata: args.seriesMetadata,
  });
  if (!product) return null;
  if (channel === 'in_store') return 'In-Store Redeem';
  return product === 'coupon' ? 'Claim Coupons' : 'Claim Catalogs';
}

/** @deprecated Use {@link mapIndexerIssuedNftRedeemBizActivityType} === 'Claim Catalogs'. */
export function isIndexerCatalogRedeemClaimTx(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
  seriesMetadata?: Record<string, unknown> | null;
}): boolean {
  return mapIndexerIssuedNftRedeemBizActivityType(args) === 'Claim Catalogs';
}

export function isIndexerInStoreCatalogRedeemTx(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
  seriesMetadata?: Record<string, unknown> | null;
}): boolean {
  return mapIndexerIssuedNftRedeemBizActivityType(args) === 'In-Store Redeem';
}

export function indexerRowNeedsRouteForCatalogRedeemClassify(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
}): boolean {
  const redeem = parseIndexerCardRedeemDisplayJson(
    typeof args.displayJson === 'string' ? args.displayJson : ''
  );
  if (!redeem || redeem.source !== 'cardRedeem') return false;
  if (!indexerTxIsCardRedeemLedgerCategory(args.txCategory)) return false;
  const route = args.route;
  return !Array.isArray(route) || route.length === 0;
}

export function indexerRowNeedsIssuedNftRedeemDistributionEnrich(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
}): boolean {
  const redeem = parseIndexerCardRedeemDisplayJson(
    typeof args.displayJson === 'string' ? args.displayJson : ''
  );
  if (!redeem || redeem.source !== 'cardRedeem') return false;
  if (!indexerTxIsCardRedeemLedgerCategory(args.txCategory)) return false;
  if (redeem.distributionKind) return false;
  if (redeem.globalCategory && (isCouponGlobalCategory(redeem.globalCategory) || isCatalogGlobalCategoryId(redeem.globalCategory))) {
    return false;
  }
  const maxToken = indexerRouteMaxPositiveTokenId(args.route);
  return maxToken != null && maxToken >= CATALOG_ISSUED_NFT_TOKEN_ID_MIN;
}

export function globalCategoryLabelForIssuedNftRedeem(
  product: IndexerIssuedNftRedeemProductKind,
  globalCategory?: string
): string {
  if (product === 'coupon') return BEAMIO_COUPON_NFT_CATEGORY;
  const normalized = normalizeCatalogGlobalCategory(globalCategory);
  return normalized;
}

/** `createIssuedNftCoupon:bunitService` / `createIssuedNftCatalog:bunitService` indexer row. */
export function resolveCreateIssuedNftBunitProductKind(displayJson: string): IndexerIssuedNftRedeemProductKind {
  try {
    const j = JSON.parse(displayJson || '{}') as Record<string, unknown>;
    const dk = String(j.distributionKind ?? '').trim().toLowerCase();
    if (dk === 'catalog' || dk === 'coupon') return dk as IndexerIssuedNftRedeemProductKind;

    const title = String(j.title ?? '').trim().toLowerCase();
    if (title.includes('catalogs fee') || title.includes('create catalogs')) return 'catalog';
    if (title === 'create coupon' || title.includes('create coupon')) return 'coupon';

    const productionId = String(j.productionId ?? '').trim();
    if (productionId) return 'catalog';
    const couponId = String(j.couponId ?? '').trim();
    if (couponId) return 'coupon';

    const beamioProduction = j.beamioProduction;
    if (beamioProduction != null && typeof beamioProduction === 'object' && !Array.isArray(beamioProduction)) {
      return 'catalog';
    }
    const beamioCoupon = j.beamioCoupon;
    if (beamioCoupon != null && typeof beamioCoupon === 'object' && !Array.isArray(beamioCoupon)) {
      return 'coupon';
    }

    const gc = String(j.globalCategory ?? j.category ?? '').trim();
    if (gc) {
      if (isCouponGlobalCategory(gc)) return 'coupon';
      if (isCatalogGlobalCategoryId(gc) || gc.toLowerCase() === 'productions') return 'catalog';
    }
  } catch {
    /* ignore */
  }

  const classified = classifyIndexerIssuedNftRedeemProductKind({ displayJson });
  if (classified) return classified;
  return 'coupon';
}

export const TX_BUINT_CREATE_ISSUED_NFT_COUPON_SERVICE = ethers.keccak256(
  ethers.toUtf8Bytes('createIssuedNftCoupon:bunitService')
);
export const TX_BUINT_CREATE_ISSUED_NFT_CATALOG_SERVICE = ethers.keccak256(
  ethers.toUtf8Bytes('createIssuedNftCatalog:bunitService')
);

export function isCreateIssuedNftBunitIndexerCategory(cat: unknown): boolean {
  const h = normalizeIndexerTxCategoryHex(cat);
  return (
    h === TX_BUINT_CREATE_ISSUED_NFT_COUPON_SERVICE.toLowerCase() ||
    h === TX_BUINT_CREATE_ISSUED_NFT_CATALOG_SERVICE.toLowerCase()
  );
}

export type CreateIssuedNftBunitTxDisplayType = 'Create Coupon' | 'Create Catalogs';

export function createIssuedNftBunitTxDisplayType(
  kind: IndexerIssuedNftRedeemProductKind
): CreateIssuedNftBunitTxDisplayType {
  return kind === 'catalog' ? 'Create Catalogs' : 'Create Coupon';
}

/** Merchant Transactions ledger headline (English). */
export function createIssuedNftBunitLedgerTitle(kind: IndexerIssuedNftRedeemProductKind): string {
  return kind === 'catalog' ? 'Create Catalogs fee' : 'Create Coupon';
}

export function txDisplayRowLedgerTypeTitle(type: CreateIssuedNftBunitTxDisplayType | string): string {
  if (type === 'Create Catalogs') return 'Create Catalogs fee';
  return type;
}

export function isCreateIssuedNftBuintLedgerRowType(
  type: string
): type is CreateIssuedNftBunitTxDisplayType {
  return type === 'Create Coupon' || type === 'Create Catalogs';
}

/** Card owner EOA (B-Unit fee payer) on `createIssuedNft* :bunitService` indexer rows. */
export function resolveCreateIssuedNftBuintOwnerAddressLower(raw: Record<string, unknown>): string {
  try {
    const payer = typeof raw.payer === 'string' && ethers.isAddress(raw.payer) ? ethers.getAddress(raw.payer).toLowerCase() : ''
    if (payer) return payer
    const dj = typeof raw.displayJson === 'string' ? raw.displayJson.trim() : ''
    if (dj) {
      const o = JSON.parse(dj) as { beneficiary?: unknown }
      if (typeof o.beneficiary === 'string' && ethers.isAddress(o.beneficiary)) {
        return ethers.getAddress(o.beneficiary).toLowerCase()
      }
    }
  } catch {
    /* ignore */
  }
  return ''
}

/** Ledger subtitle: program card owner @beamioTag (not Anonymous). */
export function resolveCreateIssuedNftBuintLedgerBeamioTag(
  tx: { type: string; beamioTag?: string | null; raw: Record<string, unknown> },
  resolveTag: (addressLower: string) => string
): string {
  if (!isCreateIssuedNftBuintLedgerRowType(tx.type)) return tx.beamioTag?.trim() ? tx.beamioTag : ''
  const lower = resolveCreateIssuedNftBuintOwnerAddressLower(tx.raw)
  if (!lower) return tx.beamioTag?.trim() ? tx.beamioTag : ''
  const tag = resolveTag(lower).trim()
  if (tag) return tag.startsWith('@') ? tag : `@${tag.replace(/^@/, '')}`
  return tx.beamioTag?.trim() ? tx.beamioTag : ''
}
