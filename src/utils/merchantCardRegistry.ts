/**
 * Global merchant program card metadata registry (not EOA-partitioned).
 * Orchestration: `@/utils/merchantCardDatabase` + `MerchantCardDatabaseProvider`.
 */

import { ethers } from 'ethers';
import type { CardMetadataFromUri } from '@/services/BeamioCard';
import { mergeRicherMerchantCardMeta } from '@/utils/mergeRicherMerchantCardMeta';

export type MerchantCardRecord = {
  addressLower: string;
  meta: CardMetadataFromUri;
  /** Full API metadata JSON — used for businessName / storeName resolution. */
  metadataRoot?: Record<string, unknown> | null;
  updatedAt: number;
};

const LS_MAP_KEY = 'beamio:silentpass:global:merchant-card-metadata:v1';

export function normalizeCardAddressKey(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v || !ethers.isAddress(v)) return null;
  return ethers.getAddress(v).toLowerCase();
}

export function loadMerchantCardMap(): Record<string, MerchantCardRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LS_MAP_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, MerchantCardRecord>;
    if (!p || typeof p !== 'object') return {};
    const out: Record<string, MerchantCardRecord> = {};
    for (const [k, rec] of Object.entries(p)) {
      const key = normalizeCardAddressKey(k);
      if (!key || !rec || typeof rec !== 'object' || !rec.meta) continue;
      out[key] = {
        addressLower: key,
        meta: rec.meta,
        metadataRoot:
          rec.metadataRoot && typeof rec.metadataRoot === 'object' ? rec.metadataRoot : undefined,
        updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveMerchantCardMap(map: Record<string, MerchantCardRecord>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_MAP_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function mergeMerchantCardMap(
  prev: Record<string, MerchantCardRecord>,
  incoming: Record<string, MerchantCardRecord | null | undefined>,
): Record<string, MerchantCardRecord> {
  const next = { ...prev };
  for (const [rawKey, rec] of Object.entries(incoming)) {
    const key = normalizeCardAddressKey(rawKey) ?? normalizeCardAddressKey(rec?.addressLower);
    if (!key || !rec) continue;
    const prevRec = next[key];
    if (prevRec && rec.updatedAt <= prevRec.updatedAt && !rec.metadataRoot && prevRec.metadataRoot) {
      next[key] = {
        ...prevRec,
        meta: mergeRicherMerchantCardMeta(prevRec.meta, rec.meta) ?? rec.meta ?? prevRec.meta,
        updatedAt: Math.max(prevRec.updatedAt, rec.updatedAt),
      };
      continue;
    }
    next[key] = {
      addressLower: key,
      meta: mergeRicherMerchantCardMeta(prevRec?.meta, rec.meta) ?? rec.meta ?? prevRec?.meta ?? {},
      metadataRoot: rec.metadataRoot ?? prevRec?.metadataRoot,
      updatedAt: Math.max(prevRec?.updatedAt ?? 0, rec.updatedAt),
    };
  }
  return next;
}

export function lookupMerchantCardLocal(
  map: Record<string, MerchantCardRecord>,
  cardAddress: string | undefined,
): MerchantCardRecord | undefined {
  const key = normalizeCardAddressKey(cardAddress ?? '');
  if (!key) return undefined;
  return map[key];
}

const CARD_BASIC_META_LS_PREFIX = 'beamio:cardBasicMeta:v1:';

/**
 * One-time Worker IDB seed: global merchant LS + optional per-card basicMeta LS entries.
 * After import, LS is no longer the write truth (Worker IDB is).
 */
export function buildMerchantLegacyImportMap(): Record<string, MerchantCardRecord> {
  const fromGlobal = loadMerchantCardMap();
  const fromBasic: Record<string, MerchantCardRecord> = {};
  if (typeof window === 'undefined') return fromGlobal;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(CARD_BASIC_META_LS_PREFIX)) keys.push(k);
    }
    const now = Date.now();
    for (const k of keys) {
      const lower = k.slice(CARD_BASIC_META_LS_PREFIX.length).toLowerCase();
      const cardKey = normalizeCardAddressKey(lower);
      if (!cardKey) continue;
      try {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const p = JSON.parse(raw) as { v?: number; meta?: CardMetadataFromUri; savedAt?: number };
        if (p?.v !== 1 || !p.meta || typeof p.meta !== 'object') continue;
        fromBasic[cardKey] = {
          addressLower: cardKey,
          meta: p.meta,
          updatedAt: typeof p.savedAt === 'number' ? p.savedAt : now,
        };
      } catch {
        /* skip bad entry */
      }
    }
  } catch {
    /* ignore */
  }
  return mergeMerchantCardMap(fromGlobal, fromBasic);
}
