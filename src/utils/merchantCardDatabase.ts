/**
 * Merchant program card metadata — display helpers + local-first types (SilentPassUI).
 * Network ensure / IDB truth live in BeamioTag Worker via beamioTagWorkerBridge.
 */

import { ethers } from 'ethers';
import {
  isCardExcludedFromDisplay,
  merchantIconUrlFromMetadataRoot,
  merchantProgramCardDisplayNameFromMetadataRoot,
  merchantProgramImageUrlFromMetadataRoot,
  type CardMetadataFromUri,
} from '@/services/BeamioCard';
import {
  peekCardBasicMetadata,
  rememberCardBasicMetadataTrusted,
} from '@/utils/cardBasicMetadataGlobalCache';
import { tu } from '@/locale/beamioLocale';
import { isGenericMerchantCardDisplayName } from '@/utils/isGenericMerchantCardDisplayName';
import {
  type MerchantCardRecord,
  normalizeCardAddressKey,
} from '@/utils/merchantCardRegistry';
import {
  ensureMerchantCards,
  getMerchantCardMirrorMap,
  mergeTrustedMerchantCards,
} from '@/services/beamioTagWorkerBridge';

export { isGenericMerchantCardDisplayName };
export type { MerchantCardRecord } from '@/utils/merchantCardRegistry';
export {
  loadMerchantCardMap,
  mergeMerchantCardMap,
  normalizeCardAddressKey,
  lookupMerchantCardLocal,
  buildMerchantLegacyImportMap,
} from '@/utils/merchantCardRegistry';

/** @deprecated LS is migration-only; Worker IDB is the write truth. No-op. */
export function saveMerchantCardMap(_map: Record<string, MerchantCardRecord>): void {
  /* intentional no-op — do not write parallel LS truth */
}

/** Background tick interval — Worker merchant tick (mirror constant for callers). */
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

/** Sync read from global card metadata cache (memory; Worker also mirrors here). */
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
  if (!merchantCardDisplayNameFromRecord(record)) return true;
  return false;
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
  const name = merchantProgramCardDisplayNameFromMetadataRoot(metadataRoot);
  const icon = merchantIconUrlFromMetadataRoot(metadataRoot);
  const image = merchantProgramImageUrlFromMetadataRoot(metadataRoot);
  return {
    ...(name ? { name } : {}),
    ...(icon ? { icon } : {}),
    ...(image ? { image } : {}),
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

/** Ensure via Worker; returns merged mirror map. */
export async function ensureMerchantCardMetadata(
  addresses: string[],
  opts?: {
    memMap?: Record<string, MerchantCardRecord>;
    maxPerTick?: number;
    now?: number;
    forceRefresh?: boolean;
  },
): Promise<EnsureMerchantCardsResult> {
  const before = { ...getMerchantCardMirrorMap(), ...(opts?.memMap ?? {}) };
  const map = await ensureMerchantCards(addresses, {
    maxPerTick: opts?.maxPerTick ?? MERCHANT_CARD_FETCH_MAX_PER_TICK,
    forceRefresh: opts?.forceRefresh,
  });
  const changed = Object.keys(map).some((k) => map[k]?.updatedAt !== before[k]?.updatedAt);
  return { map, changed };
}

/** Fire-and-forget trusted merge into Worker IDB. */
export async function mergeTrustedMerchantCardRecords(
  incoming: Record<string, MerchantCardRecord | null | undefined>,
): Promise<void> {
  await mergeTrustedMerchantCards(incoming);
}
