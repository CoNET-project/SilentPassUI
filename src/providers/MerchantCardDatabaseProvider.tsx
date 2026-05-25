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
  merchantChargeCardAddressFromTxView,
  topupCardAddressFromTxView,
  type TxView,
} from '@/pages/History/recentActivityIndexerMerge';
import { isCardExcludedFromDisplay, type CardMetadataFromUri } from '@/services/BeamioCard';
import {
  type MerchantCardRecord,
  MERCHANT_CARD_BACKGROUND_TICK_MS,
  MERCHANT_CARD_FETCH_MAX_PER_TICK,
  ensureMerchantCardMetadata,
  loadMerchantCardMap,
  lookupMerchantCardLocal,
  mergeMerchantCardMap,
  merchantCardDisplayNameFromRecord,
  mirrorRecordToCardBasicMetadata,
  merchantCardNeedsRemoteRefresh,
  normalizeCardAddressKey,
  saveMerchantCardMap,
} from '@/utils/merchantCardDatabase';

export type MerchantCardDatabaseContextValue = {
  cardMap: Record<string, MerchantCardRecord>;
  cardMapRef: React.MutableRefObject<Record<string, MerchantCardRecord>>;
  lookupByAddress: (cardAddress: string | undefined) => MerchantCardRecord | undefined;
  peekMetadata: (cardAddress: string | undefined) => CardMetadataFromUri | null;
  resolveDisplayName: (cardAddress: string | undefined) => string;
  resolveImage: (cardAddress: string | undefined) => string;
  mergeTrustedCards: (incoming: Record<string, MerchantCardRecord | null | undefined>) => void;
  registerCardAddresses: (addresses: string[]) => void;
  ensureCardMetadataForAddresses: (
    addresses: string[],
    opts?: { maxPerTick?: number; forceRefresh?: boolean },
  ) => Promise<Record<string, MerchantCardRecord>>;
  /** Local-first read; refreshes stale/missing rows then returns metadata. */
  fetchCardMetadata: (cardAddress: string) => Promise<CardMetadataFromUri | null>;
};

const defaultValue: MerchantCardDatabaseContextValue = {
  cardMap: {},
  cardMapRef: { current: {} },
  lookupByAddress: () => undefined,
  peekMetadata: () => null,
  resolveDisplayName: () => '',
  resolveImage: () => '',
  mergeTrustedCards: () => {},
  registerCardAddresses: () => {},
  ensureCardMetadataForAddresses: async () => ({}),
  fetchCardMetadata: async () => null,
};

const MerchantCardDatabaseContext = createContext<MerchantCardDatabaseContextValue>(defaultValue);

export function useMerchantCardDatabase(): MerchantCardDatabaseContextValue {
  return useContext(MerchantCardDatabaseContext);
}

export function MerchantCardDatabaseProvider({ children }: { children: ReactNode }) {
  const { myBrandCards, myBrandCardDetails, recentActivityNoAaItems } = useDaemonContext();

  const [cardMap, setCardMap] = useState<Record<string, MerchantCardRecord>>(() =>
    typeof window !== 'undefined' ? loadMerchantCardMap() : {},
  );
  const cardMapRef = useRef(cardMap);
  useEffect(() => {
    cardMapRef.current = cardMap;
  }, [cardMap]);

  const registeredRef = useRef<Set<string>>(new Set());

  const mergeTrustedCards = useCallback(
    (incoming: Record<string, MerchantCardRecord | null | undefined>) => {
      if (Object.keys(incoming).length === 0) return;
      setCardMap((prev) => {
        const next = mergeMerchantCardMap(prev, incoming);
        saveMerchantCardMap(next);
        for (const rec of Object.values(incoming)) {
          if (rec) mirrorRecordToCardBasicMetadata(rec);
        }
        return next;
      });
    },
    [],
  );

  const registerCardAddresses = useCallback((addresses: string[]) => {
    const needFetch: string[] = [];
    for (const a of addresses) {
      const k = normalizeCardAddressKey(a);
      if (k && !isCardExcludedFromDisplay(k)) {
        registeredRef.current.add(k);
        if (merchantCardNeedsRemoteRefresh(cardMapRef.current[k])) needFetch.push(k);
      }
    }
    if (needFetch.length > 0) {
      void ensureMerchantCardMetadata(needFetch, {
        memMap: cardMapRef.current,
        maxPerTick: 4,
      }).then(({ map, changed }) => {
        if (changed) setCardMap(map);
      });
    }
  }, []);

  const ensureCardMetadataForAddresses = useCallback(
    async (addresses: string[], opts?: { maxPerTick?: number; forceRefresh?: boolean }) => {
      const { map, changed } = await ensureMerchantCardMetadata(addresses, {
        memMap: cardMapRef.current,
        maxPerTick: opts?.maxPerTick ?? MERCHANT_CARD_FETCH_MAX_PER_TICK,
        forceRefresh: opts?.forceRefresh,
      });
      if (changed) setCardMap(map);
      return map;
    },
    [],
  );

  const fetchCardMetadata = useCallback(
    async (cardAddress: string): Promise<CardMetadataFromUri | null> => {
      const key = normalizeCardAddressKey(cardAddress);
      if (!key || isCardExcludedFromDisplay(key)) return null;
      registerCardAddresses([key]);
      const cached = cardMapRef.current[key]?.meta ?? null;
      if (cached && !merchantCardNeedsRemoteRefresh(cardMapRef.current[key])) {
        return cached;
      }
      const map = await ensureCardMetadataForAddresses([key]);
      return map[key]?.meta ?? cached;
    },
    [ensureCardMetadataForAddresses, registerCardAddresses],
  );

  const lookupByAddress = useCallback(
    (cardAddress: string | undefined) => lookupMerchantCardLocal(cardMap, cardAddress),
    [cardMap],
  );

  const peekMetadata = useCallback(
    (cardAddress: string | undefined): CardMetadataFromUri | null => {
      const rec = lookupMerchantCardLocal(cardMap, cardAddress);
      return rec?.meta ?? null;
    },
    [cardMap],
  );

  const resolveDisplayName = useCallback(
    (cardAddress: string | undefined) =>
      merchantCardDisplayNameFromRecord(lookupMerchantCardLocal(cardMap, cardAddress)),
    [cardMap],
  );

  const resolveImage = useCallback(
    (cardAddress: string | undefined) => {
      const rec = lookupMerchantCardLocal(cardMap, cardAddress);
      const img = rec?.meta?.image;
      return typeof img === 'string' ? img.trim() : '';
    },
    [cardMap],
  );

  /** Seed registry from My Brands daemon feed (trusted metadata already fetched). */
  useEffect(() => {
    const incoming: Record<string, MerchantCardRecord | null | undefined> = {};
    for (const [rawKey, row] of Object.entries(myBrandCardDetails)) {
      const key = normalizeCardAddressKey(rawKey);
      if (!key || isCardExcludedFromDisplay(key)) continue;
      const meta = row?.meta;
      if (!meta) continue;
      incoming[key] = {
        addressLower: key,
        meta,
        updatedAt: Date.now(),
      };
    }
    if (Object.keys(incoming).length > 0) mergeTrustedCards(incoming);
  }, [myBrandCardDetails, mergeTrustedCards]);

  /** Register merchant charge cards from Recent Activity for background refresh. */
  useEffect(() => {
    const addrs: string[] = [];
    for (const tx of recentActivityNoAaItems) {
      const chargeAddr = merchantChargeCardAddressFromTxView(tx);
      if (chargeAddr) addrs.push(chargeAddr);
      const topupAddr = topupCardAddressFromTxView(tx);
      if (topupAddr) addrs.push(topupAddr);
    }
    if (addrs.length > 0) registerCardAddresses(addrs);
  }, [recentActivityNoAaItems, registerCardAddresses]);

  /** Background: every 5 minutes refresh stale/missing merchant card metadata (on-chain URI + API). */
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tickInFlight = false;

    const collectCandidates = (): string[] => {
      const out = new Set<string>(registeredRef.current);
      for (const c of myBrandCards) {
        const k = normalizeCardAddressKey(c.cardAddress);
        if (k && !isCardExcludedFromDisplay(k)) out.add(k);
      }
      for (const tx of recentActivityNoAaItems) {
        for (const addr of [merchantChargeCardAddressFromTxView(tx), topupCardAddressFromTxView(tx)]) {
          const k = normalizeCardAddressKey(addr);
          if (k) out.add(k);
        }
      }
      return [...out];
    };

    const tick = async () => {
      if (stopped || tickInFlight) {
        if (!stopped) {
          timer = setTimeout(() => {
            void tick();
          }, MERCHANT_CARD_BACKGROUND_TICK_MS);
        }
        return;
      }
      tickInFlight = true;
      try {
        const candidates = collectCandidates();
        if (candidates.length > 0) {
          await ensureCardMetadataForAddresses(candidates);
        }
      } finally {
        tickInFlight = false;
      }
      if (!stopped) {
        timer = setTimeout(() => {
          void tick();
        }, MERCHANT_CARD_BACKGROUND_TICK_MS);
      }
    };

    void tick();
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [myBrandCards, recentActivityNoAaItems, ensureCardMetadataForAddresses]);

  const value = useMemo(
    (): MerchantCardDatabaseContextValue => ({
      cardMap,
      cardMapRef,
      lookupByAddress,
      peekMetadata,
      resolveDisplayName,
      resolveImage,
      mergeTrustedCards,
      registerCardAddresses,
      ensureCardMetadataForAddresses,
      fetchCardMetadata,
    }),
    [
      cardMap,
      lookupByAddress,
      peekMetadata,
      resolveDisplayName,
      resolveImage,
      mergeTrustedCards,
      registerCardAddresses,
      ensureCardMetadataForAddresses,
      fetchCardMetadata,
    ],
  );

  return (
    <MerchantCardDatabaseContext.Provider value={value}>{children}</MerchantCardDatabaseContext.Provider>
  );
}
