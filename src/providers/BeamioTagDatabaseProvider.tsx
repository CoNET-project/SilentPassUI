import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDaemonContext } from '@/providers/DaemonProvider';
import {
  type BeamioAddressProfileRecord,
  avatarImgUrlFromDb,
  beamioTagFromRecord,
  lookupProfileLocal,
  normalizeAddressKey,
  plainBeamioTagSeed,
  recordFromProfileFields,
  resolveAvatarSeedFromDb,
  resolveBeamioTagLocal,
  searchLocalProfilesByTagPrefix,
  searchResultFromProfileRecord,
  toBeamioCapsuleItem,
  walletStoragePartitionLower,
} from '@/utils/beamioTagDatabase';
import {
  ensureBeamioTagProfiles,
  getBeamioTagMirrorMap,
  ingestBeamioTagSearchResponse,
  initBeamioTagWorker,
  mergeBeamioTagTrusted,
  onBeamioTagProfilesUpdated,
  searchBeamioTagLocalSync,
  searchBeamioTagRemote,
  setBeamioTagWarmTargets,
} from '@/services/beamioTagWorkerBridge';

export type BeamioTagDatabaseContextValue = {
  partition: string | null;
  profileMap: Record<string, BeamioAddressProfileRecord>;
  profileMapRef: React.MutableRefObject<Record<string, BeamioAddressProfileRecord>>;
  lookupByAddress: (address: string | undefined) => BeamioAddressProfileRecord | undefined;
  resolveTag: (address: string | undefined) => string;
  resolveTagPlain: (address: string | undefined) => string;
  toCapsuleItem: (address: string | undefined) => ReturnType<typeof toBeamioCapsuleItem>;
  resolvePeerSearchResult: (address: string | undefined) => searchResult | null;
  resolveAvatarSeed: (preferred: string | undefined, address?: string) => string;
  avatarImgUrl: (preferred: string | undefined, address?: string) => string;
  mergeTrustedProfiles: (incoming: Record<string, BeamioAddressProfileRecord | null | undefined>) => void;
  ingestSearchResponse: (res: unknown, contextAddress?: string) => void;
  searchRemoteAndIngest: (query: string) => Promise<{ results?: unknown } | null | undefined>;
  ensureProfilesForAddresses: (
    addresses: string[],
    opts?: { maxPerTick?: number },
  ) => Promise<Record<string, BeamioAddressProfileRecord>>;
  searchLocalByTagPrefix: (query: string, limit?: number) => BeamioAddressProfileRecord[];
};

const defaultValue: BeamioTagDatabaseContextValue = {
  partition: null,
  profileMap: {},
  profileMapRef: { current: {} },
  lookupByAddress: () => undefined,
  resolveTag: () => '',
  resolveTagPlain: () => '',
  toCapsuleItem: () => null,
  resolvePeerSearchResult: () => null,
  resolveAvatarSeed: () => '@Beamio',
  avatarImgUrl: () => 'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio',
  mergeTrustedProfiles: () => {},
  ingestSearchResponse: () => {},
  searchRemoteAndIngest: async () => null,
  ensureProfilesForAddresses: async () => ({}),
  searchLocalByTagPrefix: () => [],
};

const BeamioTagDatabaseContext = createContext<BeamioTagDatabaseContextValue>(defaultValue);

export function useBeamioTagDatabase(): BeamioTagDatabaseContextValue {
  return useContext(BeamioTagDatabaseContext);
}

/**
 * Thin React mirror of BeamioTag Worker serverDB.
 * Fetch / IDB / 60s warm tick live in the Worker — not on the main thread.
 */
export function BeamioTagDatabaseProvider({ children }: { children: ReactNode }) {
  const { profiles, myAddress } = useDaemonContext();
  const partition = useMemo(
    () => walletStoragePartitionLower(profiles?.[0]?.keyID, myAddress),
    [profiles?.[0]?.keyID, myAddress],
  );

  const [profileMap, setProfileMap] = useState<Record<string, BeamioAddressProfileRecord>>({});
  const profileMapRef = useRef(profileMap);
  useEffect(() => {
    profileMapRef.current = profileMap;
  }, [profileMap]);

  useEffect(() => {
    return onBeamioTagProfilesUpdated((ev) => {
      setProfileMap({ ...ev.snapshot });
    });
  }, []);

  useEffect(() => {
    if (!partition) {
      setProfileMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      await initBeamioTagWorker(partition);
      if (cancelled) return;
      setProfileMap({ ...getBeamioTagMirrorMap() });
    })();
    return () => {
      cancelled = true;
    };
  }, [partition]);

  const mergeTrustedProfiles = useCallback(
    (incoming: Record<string, BeamioAddressProfileRecord | null | undefined>) => {
      if (!partition || Object.keys(incoming).length === 0) return;
      setProfileMap((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(incoming)) {
          if (!v) continue;
          next[k.toLowerCase()] = v;
        }
        return next;
      });
      void mergeBeamioTagTrusted(incoming);
    },
    [partition],
  );

  useEffect(() => {
    if (!partition) return;
    const p0 = profiles?.[0];
    if (!p0) return;
    const incoming: Record<string, BeamioAddressProfileRecord | null | undefined> = {};
    const seedFields = {
      accountName: (p0 as { accountName?: string }).accountName ?? (p0 as { username?: string }).username,
      username: (p0 as { username?: string }).username ?? (p0 as { accountName?: string }).accountName,
      first_name: (p0 as { first_name?: string }).first_name,
      last_name: (p0 as { last_name?: string }).last_name,
      firstName: (p0 as { firstName?: string }).firstName,
      lastName: (p0 as { lastName?: string }).lastName,
      image: (p0 as { image?: string }).image,
    };
    if (p0.keyID && normalizeAddressKey(p0.keyID)) {
      incoming[normalizeAddressKey(p0.keyID)!] = recordFromProfileFields(p0.keyID, seedFields);
    }
    const aa = (p0 as { aaAccount?: string }).aaAccount;
    if (aa && normalizeAddressKey(aa)) {
      incoming[normalizeAddressKey(aa)!] = recordFromProfileFields(aa, seedFields);
    }
    mergeTrustedProfiles(incoming);
  }, [partition, profiles?.[0]?.keyID, (profiles?.[0] as { aaAccount?: string })?.aaAccount, mergeTrustedProfiles]);

  /** Push warm targets to Worker daemon (Worker owns the 60s tick). */
  useEffect(() => {
    if (!partition) return;
    const out = new Set<string>();
    const p0 = profiles?.[0];
    if (p0?.keyID && normalizeAddressKey(p0.keyID)) out.add(normalizeAddressKey(p0.keyID)!);
    const aa = (p0 as { aaAccount?: string })?.aaAccount;
    if (aa && normalizeAddressKey(aa)) out.add(normalizeAddressKey(aa)!);
    if (myAddress && normalizeAddressKey(myAddress)) out.add(normalizeAddressKey(myAddress)!);
    for (const chat of p0?.chats ?? []) {
      if (chat?.address && normalizeAddressKey(chat.address)) {
        out.add(normalizeAddressKey(chat.address)!);
      }
    }
    void setBeamioTagWarmTargets([...out]);
  }, [partition, profiles, myAddress]);

  const lookupByAddress = useCallback(
    (address: string | undefined) => lookupProfileLocal(profileMap, address),
    [profileMap],
  );

  const resolveTag = useCallback(
    (address: string | undefined) => resolveBeamioTagLocal(profileMap, address),
    [profileMap],
  );

  const resolveTagPlain = useCallback(
    (address: string | undefined) => plainBeamioTagSeed(resolveBeamioTagLocal(profileMap, address)),
    [profileMap],
  );

  const toCapsuleItem = useCallback(
    (address: string | undefined) => toBeamioCapsuleItem(lookupProfileLocal(profileMap, address)),
    [profileMap],
  );

  const resolvePeerSearchResult = useCallback(
    (address: string | undefined) => {
      const rec = lookupProfileLocal(profileMap, address);
      if (!rec || !beamioTagFromRecord(rec)) return null;
      return searchResultFromProfileRecord(rec);
    },
    [profileMap],
  );

  const resolveAvatarSeed = useCallback(
    (preferred: string | undefined, address?: string) =>
      resolveAvatarSeedFromDb(profileMap, preferred, address),
    [profileMap],
  );

  const avatarImgUrl = useCallback(
    (preferred: string | undefined, address?: string) =>
      avatarImgUrlFromDb(profileMap, preferred, address),
    [profileMap],
  );

  const ingestSearchResponse = useCallback(
    (res: unknown, contextAddress?: string) => {
      if (!partition) return;
      void ingestBeamioTagSearchResponse(res, contextAddress);
    },
    [partition],
  );

  const searchRemoteAndIngest = useCallback(async (query: string) => {
    const trimmed = query.trim().replace(/^@/, '');
    if (!trimmed) return null;
    try {
      const res = await searchBeamioTagRemote(trimmed);
      return res;
    } catch {
      return null;
    }
  }, []);

  const ensureProfilesForAddresses = useCallback(
    async (addresses: string[], opts?: { maxPerTick?: number }) => {
      if (!partition) return profileMapRef.current;
      const map = await ensureBeamioTagProfiles(addresses, opts);
      setProfileMap({ ...getBeamioTagMirrorMap() });
      return map;
    },
    [partition],
  );

  const searchLocalByTagPrefix = useCallback(
    (query: string, limit?: number) => {
      const fromMirror = searchBeamioTagLocalSync(query, limit);
      if (fromMirror.length > 0) return fromMirror;
      return searchLocalProfilesByTagPrefix(profileMap, query, limit);
    },
    [profileMap],
  );

  const value = useMemo(
    (): BeamioTagDatabaseContextValue => ({
      partition,
      profileMap,
      profileMapRef,
      lookupByAddress,
      resolveTag,
      resolveTagPlain,
      toCapsuleItem,
      resolvePeerSearchResult,
      resolveAvatarSeed,
      avatarImgUrl,
      mergeTrustedProfiles,
      ingestSearchResponse,
      searchRemoteAndIngest,
      ensureProfilesForAddresses,
      searchLocalByTagPrefix,
    }),
    [
      partition,
      profileMap,
      lookupByAddress,
      resolveTag,
      resolveTagPlain,
      toCapsuleItem,
      resolvePeerSearchResult,
      resolveAvatarSeed,
      avatarImgUrl,
      mergeTrustedProfiles,
      ingestSearchResponse,
      searchRemoteAndIngest,
      ensureProfilesForAddresses,
      searchLocalByTagPrefix,
    ],
  );

  return (
    <BeamioTagDatabaseContext.Provider value={value}>{children}</BeamioTagDatabaseContext.Provider>
  );
}

export { beamioTagFromRecord };
