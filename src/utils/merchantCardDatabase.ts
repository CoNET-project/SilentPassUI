/**
 * Merchant program card metadata — global local-first DB (SilentPassUI).
 * Background daemon refreshes on-chain URI metadata every 5 minutes.
 */

import { ethers } from 'ethers';
import { beamioApi } from '@/utils/constants';
import {
  getCardMetadataFromApi,
  getCardMetadataFromUri,
  isCardExcludedFromDisplay,
  merchantProgramCardDisplayNameFromMetadataRoot,
  type CardMetadataFromUri,
} from '@/services/BeamioCard';
import {
  peekCardBasicMetadata,
  rememberCardBasicMetadataTrusted,
} from '@/utils/cardBasicMetadataGlobalCache';
import { tu } from '@/locale/beamioLocale'
import {
  type MerchantCardRecord,
  loadMerchantCardMap,
  mergeMerchantCardMap,
  normalizeCardAddressKey,
  saveMerchantCardMap,
} from '@/utils/merchantCardRegistry';

export type { MerchantCardRecord } from '@/utils/merchantCardRegistry';
export {
  loadMerchantCardMap,
  mergeMerchantCardMap,
  normalizeCardAddressKey,
  lookupMerchantCardLocal,
  saveMerchantCardMap,
} from '@/utils/merchantCardRegistry';

/** Background tick interval — refresh stale card metadata from chain/API. */
export const MERCHANT_CARD_BACKGROUND_TICK_MS = 5 * 60 * 1000;
export const MERCHANT_CARD_STALE_MS = 5 * 60 * 1000;
export const MERCHANT_CARD_FETCH_MAX_PER_TICK = 16;

export function merchantCardDisplayNameFromRecord(rec: MerchantCardRecord | undefined | null): string {
  if (!rec) return '';
  if (rec.metadataRoot) {
    const fromRoot = merchantProgramCardDisplayNameFromMetadataRoot(rec.metadataRoot);
    if (fromRoot && !isGenericMerchantCardDisplayName(fromRoot)) return fromRoot;
  }
  const name = String(rec.meta?.name ?? '').trim();
  if (name && !isGenericMerchantCardDisplayName(name)) return name;
  return '';
}

/** Placeholder titles — not merchant program display names. */
export function isGenericMerchantCardDisplayName(name: string | undefined | null): boolean {
  const t = String(name ?? '').trim();
  if (!t) return true;
  if (/^beamio$/i.test(t)) return true;
  if (/^(?:qr\s+)?merchant\s+payment$/i.test(t)) return true;
  if (/^user\s+card$/i.test(t)) return true;
  return false;
}

/** Merchant program display name: DB → directory → displayJson cardName (Charge / Top-up shared). */
export function pickMerchantProgramDisplayName(opts: {
  displayNameFromDb?: string;
  directoryName?: string;
  displayJsonCardName?: string;
}): string {
  const db = String(opts.displayNameFromDb ?? '').trim();
  if (db && !isGenericMerchantCardDisplayName(db)) return db;
  const directory = String(opts.directoryName ?? '').trim();
  if (directory && !isGenericMerchantCardDisplayName(directory)) return directory;
  const json = String(opts.displayJsonCardName ?? '').trim();
  if (json && !isGenericMerchantCardDisplayName(json)) return json.replace(/\s*card\s*$/i, '').trim();
  return db || directory || json || '';
}

export type MerchantChargeTitleOpts = {
  cardAddress?: string;
  displayNameFromDb?: string;
  directoryName?: string;
  displayJsonCardName?: string;
  /** On-chain/API metadata.name — preferred when DB row is still warming. */
  metadataName?: string;
};

/** Sync read from global card metadata cache (localStorage + memory). */
export function resolveMerchantCardMetadataName(cardAddress: string | undefined): string {
  const key = normalizeCardAddressKey(cardAddress);
  if (!key) return '';
  const name = String(peekCardBasicMetadata(key)?.name ?? '').trim();
  if (name && !isGenericMerchantCardDisplayName(name)) return name;
  return '';
}

/** Merchant program name for Charge rows (icon / subtitle), without list prefix. */
export function merchantChargeProgramDisplayName(opts: MerchantChargeTitleOpts): string {
  const fromArg = String(opts.metadataName ?? '').trim();
  const fromGlobal = resolveMerchantCardMetadataName(opts.cardAddress);
  const meta =
    fromArg && !isGenericMerchantCardDisplayName(fromArg)
      ? fromArg
      : fromGlobal;
  return pickMerchantProgramDisplayName({
    displayNameFromDb:
      meta && !isGenericMerchantCardDisplayName(meta) ? meta : opts.displayNameFromDb,
    directoryName: opts.directoryName,
    displayJsonCardName: opts.displayJsonCardName,
  });
}

/** Recent Activity Charge list title — `Payment to {merchant metadata.name}`. */
export function pickMerchantChargeListTitle(opts: MerchantChargeTitleOpts): string {
  const program = merchantChargeProgramDisplayName(opts);
  if (program) return `${tu('payment_to')} ${program}`;
  return '';
}

/** Indexer displayJson titles that must not stick once card metadata is known. */
export function isIndexerMerchantChargePlaceholderTitle(text: string | undefined | null): boolean {
  const t = String(text ?? '').trim();
  if (!t) return true;
  if (t === tu('merchant_payment')) return true;
  if (/^(?:qr\s+)?merchant\s+payment$/i.test(t)) return true;
  return false;
}

/** Recent Activity Top-up list title — `Top-up: {merchant name}` (same name source as Charge). */
export function pickMerchantTopupListTitle(opts: {
  displayNameFromDb?: string;
  directoryName?: string;
  displayJsonCardName?: string;
  fallbackTitle?: string;
}): string {
  const program = pickMerchantProgramDisplayName({
    displayNameFromDb: opts.displayNameFromDb,
    directoryName: opts.directoryName,
    displayJsonCardName: opts.displayJsonCardName,
  });
  if (program) return `Top-up: ${program}`;
  const m = String(opts.fallbackTitle ?? '').match(
    /^(?:Buy|Upgrade to|Reload|Top-up:?)\s+(.+?)(?:\s+Card(?:\s*·.*)?)?$/i,
  );
  const fromTitle = m?.[1]?.replace(/\s*·.*$/, '').trim() ?? '';
  if (fromTitle && !isGenericMerchantCardDisplayName(fromTitle)) return `Top-up: ${fromTitle}`;
  return '';
}

export function merchantCardNeedsRemoteRefresh(
  record: MerchantCardRecord | undefined | null,
  now = Date.now(),
): boolean {
  if (!record) return true;
  if (!record.updatedAt || now - record.updatedAt > MERCHANT_CARD_STALE_MS) return true;
  if (!merchantCardDisplayNameFromRecord(record) && !record.meta?.image) return true;
  return false;
}

const fetchInFlight = new Map<string, Promise<MerchantCardRecord | null>>();

async function fetchMetadataRootFromApi(cardChecksum: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${beamioApi}/api/cardMetadata?cardAddress=${encodeURIComponent(cardChecksum)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { metadata?: Record<string, unknown> | null };
    if (data?.metadata && typeof data.metadata === 'object') return data.metadata;
    return null;
  } catch {
    return null;
  }
}

/** Trusted remote fetch: on-chain URI first, API fallback; merges into one record. */
export async function fetchMerchantCardMetadataRemote(
  cardAddress: string,
): Promise<MerchantCardRecord | null> {
  const key = normalizeCardAddressKey(cardAddress);
  if (!key || isCardExcludedFromDisplay(key)) return null;

  const inflight = fetchInFlight.get(key);
  if (inflight) return inflight;

  const task = (async () => {
    const checksum = ethers.getAddress(key);
    const [fromChain, fromApi, metadataRoot] = await Promise.all([
      getCardMetadataFromUri(checksum, { bypassMemoryCache: true }),
      getCardMetadataFromApi(checksum, { bypassMemoryCache: true }),
      fetchMetadataRootFromApi(checksum),
    ]);

    const meta: CardMetadataFromUri = { ...(fromApi ?? {}), ...(fromChain ?? {}) };
    if (!meta.name && !meta.image && !metadataRoot && !fromChain && !fromApi) return null;

    return {
      addressLower: key,
      meta,
      metadataRoot,
      updatedAt: Date.now(),
    } satisfies MerchantCardRecord;
  })();

  fetchInFlight.set(key, task);
  try {
    return await task;
  } finally {
    fetchInFlight.delete(key);
  }
}

export function mirrorRecordToCardBasicMetadata(rec: MerchantCardRecord): void {
  if (!rec.meta || typeof rec.meta !== 'object') return;
  rememberCardBasicMetadataTrusted(rec.addressLower, rec.meta);
}

export type EnsureMerchantCardsResult = {
  map: Record<string, MerchantCardRecord>;
  changed: boolean;
};

function cardMetadataFromRoot(
  metadataRoot: Record<string, unknown> | null | undefined,
  cardOwner?: string | null,
): CardMetadataFromUri | null {
  if (!metadataRoot || typeof metadataRoot !== 'object') return null;
  const share =
    metadataRoot.shareTokenMetadata != null && typeof metadataRoot.shareTokenMetadata === 'object'
      ? (metadataRoot.shareTokenMetadata as Record<string, unknown>)
      : null;
  return {
    name: (share?.name ?? metadataRoot.name) as string | undefined,
    image: (share?.image ?? metadataRoot.image) as string | undefined,
    ...(Array.isArray(metadataRoot.tiers) &&
      metadataRoot.tiers.length > 0 && { tiers: metadataRoot.tiers as CardMetadataFromUri['tiers'] }),
    ...(cardOwner && { cardOwner }),
  };
}

/** Trusted `/api/latestCards` row → global merchant card record (local-first seed). */
export function merchantCardRecordFromLatestCardsRaw(raw: unknown): MerchantCardRecord | null {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const key = normalizeCardAddressKey(String(r.cardAddress ?? ''));
  if (!key || isCardExcludedFromDisplay(key)) return null;
  const metadataRoot =
    r.metadata != null && typeof r.metadata === 'object'
      ? (r.metadata as Record<string, unknown>)
      : null;
  const meta = cardMetadataFromRoot(metadataRoot);
  if (!meta && !metadataRoot) return null;
  const ownerRaw = r.cardOwner ?? r.card_owner;
  let cardOwner: string | undefined;
  if (typeof ownerRaw === 'string' && ownerRaw.trim() && ethers.isAddress(ownerRaw.trim())) {
    try {
      cardOwner = ethers.getAddress(ownerRaw.trim());
    } catch {
      cardOwner = undefined;
    }
  }
  return {
    addressLower: key,
    meta: { ...(meta ?? {}), ...(cardOwner && !meta?.cardOwner ? { cardOwner } : {}) },
    metadataRoot,
    updatedAt: Date.now(),
  };
}

export async function ensureMerchantCardMetadata(
  addresses: string[],
  opts?: {
    memMap?: Record<string, MerchantCardRecord>;
    maxPerTick?: number;
    now?: number;
    forceRefresh?: boolean;
  },
): Promise<EnsureMerchantCardsResult> {
  const maxPerTick = opts?.maxPerTick ?? MERCHANT_CARD_FETCH_MAX_PER_TICK;
  const now = opts?.now ?? Date.now();
  const disk = loadMerchantCardMap();
  let map = { ...disk, ...(opts?.memMap ?? {}) };

  const unique = new Set<string>();
  for (const a of addresses) {
    const k = normalizeCardAddressKey(a);
    if (k && !isCardExcludedFromDisplay(k)) unique.add(k);
  }

  const need: string[] = [];
  for (const lower of unique) {
    if (opts?.forceRefresh || merchantCardNeedsRemoteRefresh(map[lower], now)) need.push(lower);
  }

  const chunk = need.slice(0, maxPerTick);
  const incoming: Record<string, MerchantCardRecord> = {};
  for (const lower of chunk) {
    const rec = await fetchMerchantCardMetadataRemote(lower);
    if (rec) incoming[lower] = rec;
  }

  if (Object.keys(incoming).length === 0) {
    return { map, changed: false };
  }

  map = mergeMerchantCardMap(map, incoming);
  saveMerchantCardMap(map);
  for (const rec of Object.values(incoming)) {
    mirrorRecordToCardBasicMetadata(rec);
  }
  return { map, changed: true };
}
