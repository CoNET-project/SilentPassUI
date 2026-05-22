/**
 * Beamio Tag local database — EOA/AA ↔ @beamioTag (SilentPassUI).
 * Local-first; remote searchUsername only for missing/stale rows.
 */

import { ethers } from 'ethers';
import { rememberBeamioTagBasicMetadata } from './beamioTagBasicMetadataGlobalCache';
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

export const BEAMIO_TAG_PROFILE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
export const BEAMIO_TAG_FETCH_MAX_PER_TICK = 28;
export const BEAMIO_TAG_BACKGROUND_TICK_MS = 60_000;

export type SearchUsernameFn = (query: string) => Promise<{ results?: unknown } | null | undefined>;

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

/** Mirror into legacy global tag cache (addr/tag index) for SearchBar / History hooks. */
export function mirrorRecordToBeamioTagBasicMetadata(rec: BeamioAddressProfileRecord): void {
  const tag = rec.username ?? rec.accountName ?? '';
  if (!tag || tag === 'unknow') return;
  rememberBeamioTagBasicMetadata({
    username: tag.replace(/^@+/, ''),
    address: ethers.getAddress(rec.addressLower),
    image: rec.image ?? '',
    first_name: rec.first_name ?? rec.firstName ?? '',
    last_name: rec.last_name ?? rec.lastName ?? '',
    created_at: 0,
    follow_count: '',
    follower_count: '',
  });
}

export function searchResultFromProfileRecord(rec: BeamioAddressProfileRecord): searchResult {
  const addr = ethers.getAddress(rec.addressLower);
  const tag = (rec.username ?? rec.accountName ?? '').replace(/^@+/, '');
  return {
    address: addr,
    username: tag,
    first_name: rec.first_name ?? rec.firstName ?? '',
    last_name: rec.last_name ?? rec.lastName ?? '',
    image: rec.image ?? '',
    created_at: 0,
    follow_count: '',
    follower_count: '',
  };
}

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
  for (const rec of Object.values(incoming)) {
    mirrorRecordToBeamioTagBasicMetadata(rec);
  }
  return { map, changed: true };
}

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
