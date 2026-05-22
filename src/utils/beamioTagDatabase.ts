/**
 * Beamio Tag local database — EOA/AA ↔ @beamioTag profile metadata.
 * Local-first (localStorage per logged-in wallet partition); remote `searchUsername` only for missing/stale rows.
 */

import { ethers } from 'ethers';
import {
  type BeamioAddressProfileRecord,
  beamioTagFromRecord,
  loadAddressProfileMap,
  mergeProfileMap,
  normalizeAddressKey,
  pickPeerFromSearchUsernameResponse,
  recordFromSearchPeer,
  saveAddressProfileMap,
} from './beamioAddressProfileRegistry';

export type { BeamioAddressProfileRecord } from './beamioAddressProfileRegistry';
export {
  beamioTagFromRecord,
  loadAddressProfileMap,
  mergeProfileMap,
  normalizeAddressKey,
  pickPeerFromSearchUsernameResponse,
  recordFromSearchPeer,
  saveAddressProfileMap,
  toBeamioCapsuleItem,
} from './beamioAddressProfileRegistry';

/** Profiles older than this may be refreshed by background daemon (not on every UI read). */
export const BEAMIO_TAG_PROFILE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** Background tick: max remote lookups per minute batch. */
export const BEAMIO_TAG_FETCH_MAX_PER_TICK = 28;

export type SearchUsernameFn = (query: string) => Promise<{ results?: unknown } | null | undefined>;

/** Logged-in CoNET EOA for LS partition — aligns with `eoa:${...}:*` trusted cache keys. */
export function walletStoragePartitionLower(
  profileKeyId: string | undefined,
  myAddr: string | undefined,
): string | null {
  const raw = (profileKeyId ?? myAddr ?? '').trim();
  if (!raw || !ethers.isAddress(raw)) return null;
  return ethers.getAddress(raw).toLowerCase();
}

export function plainBeamioTagSeed(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/^@+/, '');
}

export function isWalletAddressLike(value: string | undefined): boolean {
  const v = (value ?? '').trim();
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export function lookupProfileLocal(
  map: Record<string, BeamioAddressProfileRecord>,
  address: string | undefined,
): BeamioAddressProfileRecord | undefined {
  const key = normalizeAddressKey(address ?? '');
  if (!key) return undefined;
  return map[key];
}

export function resolveBeamioTagLocal(
  map: Record<string, BeamioAddressProfileRecord>,
  address: string | undefined,
): string {
  return beamioTagFromRecord(lookupProfileLocal(map, address));
}

export function profileNeedsRemoteRefresh(
  record: BeamioAddressProfileRecord | undefined | null,
  now = Date.now(),
): boolean {
  if (!record) return true;
  if (!beamioTagFromRecord(record)) return true;
  if (!record.updatedAt || now - record.updatedAt > BEAMIO_TAG_PROFILE_STALE_MS) return true;
  return false;
}

/** Merge trusted `searchUsername` peers into map; returns changed entries only. */
export function ingestSearchUsernameResponse(
  map: Record<string, BeamioAddressProfileRecord>,
  res: unknown,
  opts?: { contextAddress?: string },
): Record<string, BeamioAddressProfileRecord> {
  const incoming: Record<string, BeamioAddressProfileRecord> = {};
  const ctxKey = opts?.contextAddress ? normalizeAddressKey(opts.contextAddress) : null;

  if (ctxKey) {
    const peer = pickPeerFromSearchUsernameResponse(res, ctxKey);
    const rec = recordFromSearchPeer(ctxKey, peer);
    if (rec) incoming[ctxKey] = rec;
  }

  const results = (res as { results?: unknown })?.results;
  if (Array.isArray(results)) {
    for (const row of results as Array<{ address?: string }>) {
      const addr = typeof row?.address === 'string' ? row.address : '';
      const key = normalizeAddressKey(addr);
      if (!key || incoming[key]) continue;
      const peer = pickPeerFromSearchUsernameResponse({ results: [row] }, key);
      const rec = recordFromSearchPeer(key, peer);
      if (rec) incoming[key] = rec;
    }
  }

  if (Object.keys(incoming).length === 0) return {};
  return mergeProfileMap(map, incoming);
}

const fetchInFlight = new Map<string, Promise<BeamioAddressProfileRecord | null>>();

function fetchInflightKey(partition: string, addrLower: string): string {
  return `${partition}:${addrLower}`;
}

/** Remote fetch single address; dedupes concurrent requests. Untrusted failure → null (does not clear local). */
export async function fetchAddressProfileRemote(
  partition: string,
  address: string,
  searchUsername: SearchUsernameFn,
): Promise<BeamioAddressProfileRecord | null> {
  const key = normalizeAddressKey(address);
  if (!key || !partition.trim()) return null;

  const inflightKey = fetchInflightKey(partition, key);
  const existing = fetchInFlight.get(inflightKey);
  if (existing) return existing;

  const task = (async () => {
    try {
      const res = await searchUsername(ethers.getAddress(key));
      const peer = pickPeerFromSearchUsernameResponse(res, key);
      return recordFromSearchPeer(key, peer);
    } catch {
      return null;
    } finally {
      fetchInFlight.delete(inflightKey);
    }
  })();

  fetchInFlight.set(inflightKey, task);
  return task;
}

export type EnsureProfilesResult = {
  map: Record<string, BeamioAddressProfileRecord>;
  changed: boolean;
};

/**
 * Local-first ensure: only remote-fetch addresses missing tag or stale.
 * Persists merged map when partition is set.
 */
export async function ensureAddressProfiles(
  partition: string,
  addresses: string[],
  searchUsername: SearchUsernameFn,
  opts?: {
    memMap?: Record<string, BeamioAddressProfileRecord>;
    maxPerTick?: number;
    now?: number;
  },
): Promise<EnsureProfilesResult> {
  const maxPerTick = opts?.maxPerTick ?? BEAMIO_TAG_FETCH_MAX_PER_TICK;
  const now = opts?.now ?? Date.now();
  const disk = partition.trim() ? loadAddressProfileMap(partition) : {};
  let map = { ...disk, ...(opts?.memMap ?? {}) };

  const unique = new Set<string>();
  for (const a of addresses) {
    const k = normalizeAddressKey(a);
    if (k) unique.add(k);
  }

  const need: string[] = [];
  for (const lower of unique) {
    if (profileNeedsRemoteRefresh(map[lower], now)) need.push(lower);
  }

  const chunk = need.slice(0, maxPerTick);
  const incoming: Record<string, BeamioAddressProfileRecord> = {};
  for (const lower of chunk) {
    const rec = await fetchAddressProfileRemote(partition, lower, searchUsername);
    if (rec) incoming[lower] = rec;
  }

  if (Object.keys(incoming).length === 0) {
    return { map, changed: false };
  }

  map = mergeProfileMap(map, incoming);
  if (partition.trim()) saveAddressProfileMap(partition, map);
  return { map, changed: true };
}

/** Resolve DiceBear / avatar seed: tag only — never raw wallet address. */
export function resolveAvatarSeedFromDb(
  map: Record<string, BeamioAddressProfileRecord>,
  preferred: string | undefined,
  address?: string,
): string {
  const preferredPlain = plainBeamioTagSeed(preferred);
  if (preferredPlain && !isWalletAddressLike(preferredPlain)) return preferredPlain;

  const addressCandidates = [address, isWalletAddressLike(preferredPlain) ? preferredPlain : undefined].filter(
    Boolean,
  ) as string[];
  for (const addr of addressCandidates) {
    const tag = plainBeamioTagSeed(beamioTagFromRecord(lookupProfileLocal(map, addr)));
    if (tag) return tag;
  }
  return '@Beamio';
}

export function avatarImgUrlFromDb(
  map: Record<string, BeamioAddressProfileRecord>,
  preferred: string | undefined,
  address?: string,
): string {
  const seed = resolveAvatarSeedFromDb(map, preferred, address);
  return `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(seed)}`;
}

/** Filter local DB by @beamioTag prefix (for typeahead before remote search). */
export function searchLocalProfilesByTagPrefix(
  map: Record<string, BeamioAddressProfileRecord>,
  query: string,
  limit = 12,
): BeamioAddressProfileRecord[] {
  const q = plainBeamioTagSeed(query).toLowerCase();
  if (q.length < 2) return [];
  const out: BeamioAddressProfileRecord[] = [];
  for (const rec of Object.values(map)) {
    const tag = plainBeamioTagSeed(rec.accountName ?? rec.username).toLowerCase();
    if (!tag || !tag.includes(q)) continue;
    out.push(rec);
    if (out.length >= limit) break;
  }
  return out;
}

export function recordFromProfileFields(
  address: string,
  fields: {
    accountName?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    image?: string;
  },
): BeamioAddressProfileRecord | null {
  const key = normalizeAddressKey(address);
  if (!key) return null;
  return recordFromSearchPeer(key, fields);
}
