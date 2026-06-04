import { ethers } from 'ethers';

export const CATALOG_ISSUED_NFT_TOKEN_ID_MIN = 100_000_000_000n;

const BEAMIO_SERIES_METADATA_ORIGIN = 'https://beamio.app';

/** `/api/seriesSharedMetadata` — coupon/catalog redeem display name source. */
export async function fetchBeamioSeriesSharedMetadata(
  cardAddress: string,
  tokenId: string | number | bigint
): Promise<Record<string, unknown> | null> {
  try {
    const card = ethers.getAddress(cardAddress);
    const tid = typeof tokenId === 'bigint' ? tokenId.toString() : String(tokenId).trim();
    if (!tid) return null;
    const url = `${BEAMIO_SERIES_METADATA_ORIGIN}/api/seriesSharedMetadata?${new URLSearchParams({
      card,
      tokenId: tid,
    })}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      metadata?: Record<string, unknown> | null;
      sharedSeriesMetadata?: Record<string, unknown> | null;
    };
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      return body.metadata;
    }
    if (
      body.sharedSeriesMetadata &&
      typeof body.sharedSeriesMetadata === 'object' &&
      !Array.isArray(body.sharedSeriesMetadata)
    ) {
      return body.sharedSeriesMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

export function issuedNftClaimRouteIdentity(route: unknown): {
  cardAddress: string;
  tokenId: string;
} {
  const card = indexerRouteCardAddress(route);
  const tid = indexerRouteMaxPositiveTokenId(route);
  if (!card || tid == null || tid < CATALOG_ISSUED_NFT_TOKEN_ID_MIN) {
    return { cardAddress: '', tokenId: '' };
  }
  return { cardAddress: card, tokenId: tid.toString() };
}

export function issuedNftClaimNeedsSeriesTitleResolve(title: unknown): boolean {
  const t = String(title ?? '').trim();
  if (!t) return true;
  if (isGenericIssuedNftClaimActivityTitle(t)) return true;
  if (isIndexerRedeemLedgerPlaceholderTitle(t)) return true;
  return false;
}

const BEAMIO_COUPON_NFT_CATEGORY = 'Coupon';
const CATALOG_GLOBAL_IDS = ['Product', 'Service', 'Menu', 'ShareLink', 'SalesManagement'] as const;

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

/** SilentPassUI Recent Activity `TxView.type` for issued-NFT coupon/catalog claims. */
export type IndexerConsumerIssuedNftClaimType = 'claim_coupon' | 'claim_catalog';

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
    if (!source && !topupCategory && !title && !distributionKind && !globalCategory && !couponId && !productionId) {
      return null;
    }
    return { source, topupCategory, title, distributionKind, globalCategory, couponId, productionId };
  } catch {
    return null;
  }
}

function isCouponGlobalCategory(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === BEAMIO_COUPON_NFT_CATEGORY.toLowerCase();
}

function isCatalogGlobalCategoryId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  return CATALOG_GLOBAL_IDS.some((id) => id === t) || t.toLowerCase() === 'productions';
}

/** `beamio_nft_series.metadata_json` or `/api/seriesSharedMetadata` metadata object. */
export function seriesMetadataProductKind(
  meta: Record<string, unknown> | null | undefined
): IndexerIssuedNftRedeemProductKind | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const rootCat = meta.category;
  if (rootCat != null && String(rootCat).trim() !== '') {
    if (isCouponGlobalCategory(rootCat)) return 'coupon';
    if (isCatalogGlobalCategoryId(rootCat)) return 'catalog';
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

const INDEXER_REDEEM_PLACEHOLDER_TITLE_RE =
  /^redeem\s+(?:new|upgrade(?:\s+new)?|top\s*-?\s*up)\s+card$/i;

/** Indexer `displayJson.title` from cardRedeem accounting — not the coupon/catalog product name. */
export function isIndexerRedeemLedgerPlaceholderTitle(title: unknown): boolean {
  const t = String(title ?? '').trim();
  if (!t) return false;
  return INDEXER_REDEEM_PLACEHOLDER_TITLE_RE.test(t);
}

function metadataNestedRecord(
  parent: Record<string, unknown> | null,
  key: 'beamioCoupon' | 'beamioProduction'
): Record<string, unknown> | null {
  if (!parent) return null;
  const direct = parent[key];
  if (direct != null && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }
  return null;
}

/** Generic fallback titles before `/api/seriesSharedMetadata` resolves. */
export function isGenericIssuedNftClaimActivityTitle(title: unknown): boolean {
  const t = String(title ?? '').trim();
  return /^claim\s+(?:coupon|catalog)s?$/i.test(t);
}

/** Coupon/catalog product name only (no `Claim` prefix). */
export function extractSeriesMetadataProductName(
  meta: Record<string, unknown> | null | undefined,
  product: IndexerIssuedNftRedeemProductKind
): string {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return '';
  const props =
    meta.properties && typeof meta.properties === 'object' && !Array.isArray(meta.properties)
      ? (meta.properties as Record<string, unknown>)
      : null;
  const beamioCoupon =
    metadataNestedRecord(meta, 'beamioCoupon') ?? metadataNestedRecord(props, 'beamioCoupon');
  const beamioProduction =
    metadataNestedRecord(meta, 'beamioProduction') ?? metadataNestedRecord(props, 'beamioProduction');
  const candidates =
    product === 'catalog'
      ? [
          beamioProduction?.name,
          beamioProduction?.title,
          meta.name,
          meta.title,
          beamioCoupon?.name,
          beamioCoupon?.title,
        ]
      : [
          beamioCoupon?.name,
          beamioCoupon?.title,
          meta.name,
          meta.title,
          beamioProduction?.name,
          beamioProduction?.title,
        ];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Consumer Recent Activity list title: `Claim {productName}` from series metadata. */
export function readSeriesMetadataDisplayTitle(
  meta: Record<string, unknown> | null | undefined,
  product: IndexerIssuedNftRedeemProductKind
): string {
  const productName = extractSeriesMetadataProductName(meta, product);
  if (productName) return `Claim ${productName}`;
  return product === 'catalog' ? 'Claim Catalog' : 'Claim Coupon';
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

/** `displayJson.source === cardRedeem'` + redeem*Card txCategory (paged indexer may omit `route[]`). */
export function isIndexerCardRedeemLedgerRow(args: {
  txCategory?: unknown;
  displayJson?: unknown;
}): boolean {
  const redeem = parseIndexerCardRedeemDisplayJson(
    typeof args.displayJson === 'string' ? args.displayJson : ''
  );
  if (!redeem || redeem.source !== 'cardRedeem') return false;
  return indexerTxIsCardRedeemLedgerCategory(args.txCategory);
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
  if (maxToken != null) return maxToken >= CATALOG_ISSUED_NFT_TOKEN_ID_MIN;
  if (redeem.distributionKind || redeem.couponId || redeem.productionId) return true;
  if (redeem.globalCategory) {
    return isCouponGlobalCategory(redeem.globalCategory) || isCatalogGlobalCategoryId(redeem.globalCategory);
  }
  return false;
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
  if (redeem?.distributionKind) return redeem.distributionKind;
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
    // Paged indexer rows often omit route[] / subordinate; consumer wallet redeem is still an app claim.
    return 'app';
  }
  return 'in_store';
}

export function indexerRowNeedsRouteForIssuedNftClaimClassify(args: {
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
  if (
    redeem.globalCategory &&
    (isCouponGlobalCategory(redeem.globalCategory) || isCatalogGlobalCategoryId(redeem.globalCategory))
  ) {
    return false;
  }
  if (redeem.couponId || redeem.productionId) return false;
  const maxToken = indexerRouteMaxPositiveTokenId(args.route);
  return maxToken != null && maxToken >= CATALOG_ISSUED_NFT_TOKEN_ID_MIN;
}

/** Consumer Recent Activity row for issued-NFT `cardRedeem` (app claim coupon/catalog). */
export function mapIndexerIssuedNftConsumerClaimActivity(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
  seriesMetadata?: Record<string, unknown> | null;
}): { type: IndexerConsumerIssuedNftClaimType; title: string } | null {
  if (!isIndexerIssuedNftCardRedeemTx(args)) return null;
  if (!classifyIndexerIssuedNftRedeemChannel(args)) return null;
  const product = classifyIndexerIssuedNftRedeemProductKind({
    displayJson: args.displayJson,
    seriesMetadata: args.seriesMetadata,
  });
  if (!product) return null;
  const title = readSeriesMetadataDisplayTitle(args.seriesMetadata, product);
  if (product === 'catalog') return { type: 'claim_catalog', title };
  return { type: 'claim_coupon', title };
}

export function isIndexerConsumerIssuedNftClaimType(type: string): type is IndexerConsumerIssuedNftClaimType {
  return type === 'claim_coupon' || type === 'claim_catalog';
}

/** @deprecated Issued-NFT redeems are shown as Claim Coupon/Catalog — no longer hidden. */
export function shouldHideIndexerIssuedNftRedeemFromConsumerActivity(_args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
}): boolean {
  return false;
}

export function isIndexerCatalogRedeemClaimTx(args: {
  txCategory?: unknown;
  displayJson?: unknown;
  route?: unknown;
  payer?: unknown;
  payee?: unknown;
  subordinate?: unknown;
  topAdmin?: unknown;
}): boolean {
  if (classifyIndexerIssuedNftRedeemChannel(args) !== 'app') return false;
  return classifyIndexerIssuedNftRedeemProductKind({ displayJson: args.displayJson }) === 'catalog';
}
