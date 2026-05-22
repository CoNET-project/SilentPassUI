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
import { searchUsername } from '@/services/beamio';
import { useDaemonContext } from '@/providers/DaemonProvider';
import {
  type BeamioAddressProfileRecord,
  BEAMIO_TAG_FETCH_MAX_PER_TICK,
  avatarImgUrlFromDb,
  beamioTagFromRecord,
  ensureAddressProfiles,
  ingestSearchUsernameResponse,
  loadAddressProfileMap,
  lookupProfileLocal,
  mergeProfileMap,
  normalizeAddressKey,
  plainBeamioTagSeed,
  recordFromProfileFields,
  resolveAvatarSeedFromDb,
  resolveBeamioTagLocal,
  saveAddressProfileMap,
  searchLocalProfilesByTagPrefix,
  toBeamioCapsuleItem,
  walletStoragePartitionLower,
} from '@/utils/beamioTagDatabase';

export type BeamioTagDatabaseContextValue = {
  /** Current wallet partition (logged-in EOA lower). */
  partition: string | null;
  /** In-memory + persisted EOA/AA → profile map. */
  profileMap: Record<string, BeamioAddressProfileRecord>;
  profileMapRef: React.MutableRefObject<Record<string, BeamioAddressProfileRecord>>;
  lookupByAddress: (address: string | undefined) => BeamioAddressProfileRecord | undefined;
  resolveTag: (address: string | undefined) => string;
  resolveTagPlain: (address: string | undefined) => string;
  toCapsuleItem: (address: string | undefined) => ReturnType<typeof toBeamioCapsuleItem>;
  resolveAvatarSeed: (preferred: string | undefined, address?: string) => string;
  avatarImgUrl: (preferred: string | undefined, address?: string) => string;
  /** Trusted merge + persist (remote success only). */
  mergeTrustedProfiles: (incoming: Record<string, BeamioAddressProfileRecord | null | undefined>) => void;
  /** Parse + merge full searchUsername JSON (user search / compose). */
  ingestSearchResponse: (res: unknown, contextAddress?: string) => void;
  /** Remote search + trusted ingest; use for explicit user lookup flows. */
  searchRemoteAndIngest: (query: string) => Promise<{ results?: unknown } | null | undefined>;
  /** Background daemon: fetch only missing/stale tags. */
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
  resolveAvatarSeed: () => '@Beamio',
  avatarImgUrl: () =>
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio',
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
    if (!partition) {
      setProfileMap({});
      return;
    }
    setProfileMap(loadAddressProfileMap(partition));
  }, [partition]);

  const mergeTrustedProfiles = useCallback(
    (incoming: Record<string, BeamioAddressProfileRecord | null | undefined>) => {
      if (!partition || Object.keys(incoming).length === 0) return;
      setProfileMap((prev) => {
        const next = mergeProfileMap(prev, incoming);
        saveAddressProfileMap(partition, next);
        return next;
      });
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
      const merged = ingestSearchUsernameResponse(profileMapRef.current, res, {
        contextAddress,
      });
      if (Object.keys(merged).length === 0) return;
      mergeTrustedProfiles(merged);
    },
    [partition, mergeTrustedProfiles],
  );

  const searchRemoteAndIngest = useCallback(
    async (query: string) => {
      const trimmed = query.trim().replace(/^@/, '');
      if (!trimmed) return null;
      try {
        const res = await searchUsername(trimmed);
        ingestSearchResponse(res, trimmed);
        return res;
      } catch {
        return null;
      }
    },
    [ingestSearchResponse],
  );

  const ensureProfilesForAddresses = useCallback(
    async (addresses: string[], opts?: { maxPerTick?: number }) => {
      if (!partition) return profileMapRef.current;
      const { map, changed } = await ensureAddressProfiles(partition, addresses, searchUsername, {
        memMap: profileMapRef.current,
        maxPerTick: opts?.maxPerTick ?? BEAMIO_TAG_FETCH_MAX_PER_TICK,
      });
      if (changed) setProfileMap(map);
      return map;
    },
    [partition],
  );

  const searchLocalByTagPrefix = useCallback(
    (query: string, limit?: number) => searchLocalProfilesByTagPrefix(profileMap, query, limit),
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
