/**
 * Beamio address profile persistence (localStorage rows).
 * Orchestration: `@/utils/beamioTagDatabase` + `BeamioTagDatabaseProvider`.
 */

import { ethers } from 'ethers';

/** Aligns with `searchUsername` peer shape */
export type BeamioAddressProfileRecord = {
  addressLower: string;
  accountName?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  updatedAt: number;
};

const SP_LS_PREFIX = 'beamio:silentpass:';

export function beamioAddressProfileMapKey(walletPartitionLower: string): string {
  return `${SP_LS_PREFIX}eoa:${walletPartitionLower}:address-profiles:v1`;
}

export function loadAddressProfileMap(walletPartitionLower: string): Record<string, BeamioAddressProfileRecord> {
  if (typeof window === 'undefined' || !walletPartitionLower.trim()) return {};
  try {
    const raw = window.localStorage.getItem(beamioAddressProfileMapKey(walletPartitionLower));
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, BeamioAddressProfileRecord>;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

export function saveAddressProfileMap(
  walletPartitionLower: string,
  map: Record<string, BeamioAddressProfileRecord>,
): void {
  if (typeof window === 'undefined' || !walletPartitionLower.trim()) return;
  try {
    window.localStorage.setItem(beamioAddressProfileMapKey(walletPartitionLower), JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function pickPeerFromSearchUsernameResponse(
  res: unknown,
  addrLower: string,
): {
  accountName?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
} | null {
  if (!res || typeof res !== 'object') return null;
  const results = (res as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const rows = results as Array<{
    address?: string;
    username?: string;
    accountName?: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    image?: string;
  }>;
  const exact = rows.find((r) => (r?.address ?? '').toLowerCase() === addrLower);
  const withName = rows.find((r) => !!(r?.username ?? r?.accountName));
  const peer = exact ?? withName ?? rows[0];
  if (!peer) return null;
  return {
    accountName: typeof peer.accountName === 'string' ? peer.accountName : undefined,
    username: typeof peer.username === 'string' ? peer.username : undefined,
    first_name: typeof peer.first_name === 'string' ? peer.first_name : undefined,
    last_name: typeof peer.last_name === 'string' ? peer.last_name : undefined,
    firstName: typeof peer.firstName === 'string' ? peer.firstName : undefined,
    lastName: typeof peer.lastName === 'string' ? peer.lastName : undefined,
    image: typeof peer.image === 'string' ? peer.image : undefined,
  };
}

export function recordFromSearchPeer(
  addrLower: string,
  peer: ReturnType<typeof pickPeerFromSearchUsernameResponse>,
): BeamioAddressProfileRecord | null {
  if (!peer) return null;
  const scrubTag = (raw: string | undefined): string | undefined => {
    const t = raw?.trim();
    if (!t) return undefined;
    const plain = t.replace(/^@+/, '').trim();
    const lower = plain.toLowerCase();
    if (!plain || lower === 'unknow' || lower === 'unknown' || plain === '未知') return undefined;
    return t;
  };
  const accountName = scrubTag(peer.accountName);
  const username = scrubTag(peer.username);
  const has =
    accountName ||
    username ||
    peer.first_name?.trim() ||
    peer.last_name?.trim() ||
    peer.firstName?.trim() ||
    peer.lastName?.trim() ||
    peer.image?.trim();
  if (!has) return null;
  return {
    addressLower: addrLower,
    accountName,
    username,
    first_name: peer.first_name?.trim() || undefined,
    last_name: peer.last_name?.trim() || undefined,
    firstName: peer.firstName?.trim() || undefined,
    lastName: peer.lastName?.trim() || undefined,
    image: peer.image?.trim() || undefined,
    updatedAt: Date.now(),
  };
}

export function mergeProfileMap(
  prev: Record<string, BeamioAddressProfileRecord>,
  incoming: Record<string, BeamioAddressProfileRecord | null | undefined>,
): Record<string, BeamioAddressProfileRecord> {
  const next = { ...prev };
  for (const [k, v] of Object.entries(incoming)) {
    if (!k) continue;
    if (v == null) continue;
    next[k.toLowerCase()] = v;
  }
  return next;
}

export function beamioTagFromRecord(r: BeamioAddressProfileRecord | undefined | null): string {
  if (!r) return '';
  const u = r.accountName?.trim() || r.username?.trim();
  if (!u) return '';
  const plain = u.replace(/^@+/, '').trim();
  // search-users returns placeholder "unknow" for EOAs with no registry tag
  const lower = plain.toLowerCase();
  if (!plain || lower === 'unknow' || lower === 'unknown' || plain === '未知') return '';
  return u.startsWith('@') ? u : `@${u}`;
}

export function toBeamioCapsuleItem(r: BeamioAddressProfileRecord | undefined | null): {
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  accountName?: string;
  username?: string;
  image?: string;
} | null {
  if (!r) return null;
  const has =
    r.first_name ||
    r.last_name ||
    r.firstName ||
    r.lastName ||
    r.accountName ||
    r.username ||
    r.image;
  if (!has) return null;
  return {
    first_name: r.first_name,
    firstName: r.firstName,
    last_name: r.last_name,
    lastName: r.lastName,
    accountName: r.accountName,
    username: r.username,
    image: r.image,
  };
}

export function normalizeAddressKey(addr: string): string | null {
  const t = addr.trim();
  if (!t || !ethers.isAddress(t)) return null;
  return ethers.getAddress(t).toLowerCase();
}
