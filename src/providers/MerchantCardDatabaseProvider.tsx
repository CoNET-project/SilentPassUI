import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import {
  merchantChargeCardAddressFromTxView,
  topupCardAddressFromTxView,
} from '@/pages/History/recentActivityIndexerMerge'
import { isCardExcludedFromDisplay, type CardMetadataFromUri } from '@/services/BeamioCard'
import {
  type MerchantCardRecord,
  MERCHANT_CARD_FETCH_MAX_PER_TICK,
  merchantCardDisplayNameFromRecord,
  merchantCardNeedsRemoteRefresh,
  normalizeCardAddressKey,
  lookupMerchantCardLocal,
} from '@/utils/merchantCardDatabase'
import { pickNonFactoryMerchantAssetUrl } from '@/utils/isFactoryDefaultMerchantAssetUrl'
import {
  ensureMerchantCards,
  getMerchantCardMirrorMap,
  initMerchantCards,
  mergeTrustedMerchantCards,
  onMerchantCardsUpdated,
  setMerchantWarmTargets,
} from '@/services/beamioTagWorkerBridge'

/**
 * Merchant program card hook — mirrors BeamioTag Worker `merchantCards` store.
 * Naming parallels `useBeamioTagDatabase` (ensure* / mergeTrusted* / resolve*).
 */
export type MerchantCardDatabaseContextValue = {
  cardMap: Record<string, MerchantCardRecord>
  cardMapRef: React.MutableRefObject<Record<string, MerchantCardRecord>>
  /** Card contract address → record (parallel to Tag `lookupByAddress`). */
  lookupByAddress: (cardAddress: string | undefined) => MerchantCardRecord | undefined
  /** Sync merchant program display name (parallel to Tag `resolveTag`). */
  resolveName: (cardAddress: string | undefined) => string
  resolveImage: (cardAddress: string | undefined) => string
  peekMetadata: (cardAddress: string | undefined) => CardMetadataFromUri | null
  /** Parallel to Tag `mergeTrustedProfiles`. */
  mergeTrustedCards: (incoming: Record<string, MerchantCardRecord | null | undefined>) => void
  /** Register warm targets + kick ensure for stale rows. */
  registerCardAddresses: (addresses: string[]) => void
  /** Parallel to Tag `ensureProfilesForAddresses`. */
  ensureCardsForAddresses: (
    addresses: string[],
    opts?: { maxPerTick?: number; forceRefresh?: boolean },
  ) => Promise<Record<string, MerchantCardRecord>>
  /** Single-card local-first ensure → metadata (replaces legacy `fetchCardMetadata`). */
  ensureCardMetadata: (cardAddress: string) => Promise<CardMetadataFromUri | null>
}

const defaultValue: MerchantCardDatabaseContextValue = {
  cardMap: {},
  cardMapRef: { current: {} },
  lookupByAddress: () => undefined,
  resolveName: () => '',
  resolveImage: () => '',
  peekMetadata: () => null,
  mergeTrustedCards: () => {},
  registerCardAddresses: () => {},
  ensureCardsForAddresses: async () => ({}),
  ensureCardMetadata: async () => null,
}

const MerchantCardDatabaseContext = createContext<MerchantCardDatabaseContextValue>(defaultValue)

export function useMerchantCardDatabase(): MerchantCardDatabaseContextValue {
  return useContext(MerchantCardDatabaseContext)
}

/**
 * Thin React mirror of BeamioTag Worker merchantCards store.
 * Fetch / IDB / 5min warm tick live in the Worker — not on the main thread.
 */
export function MerchantCardDatabaseProvider({ children }: { children: ReactNode }) {
  const { myBrandCards, myBrandCardDetails, recentActivityNoAaItems } = useDaemonContext()

  const [cardMap, setCardMap] = useState<Record<string, MerchantCardRecord>>(() =>
    typeof window !== 'undefined' ? getMerchantCardMirrorMap() : {},
  )
  const cardMapRef = useRef(cardMap)
  useEffect(() => {
    cardMapRef.current = cardMap
  }, [cardMap])

  const registeredRef = useRef<Set<string>>(new Set())

  /** Boot Worker merchant store (LS → IDB once) and subscribe mirror. */
  useEffect(() => {
    let cancelled = false
    void initMerchantCards().then(() => {
      if (!cancelled) setCardMap({ ...getMerchantCardMirrorMap() })
    })
    const unsub = onMerchantCardsUpdated((ev) => {
      if (!cancelled) setCardMap({ ...ev.snapshot })
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const mergeTrustedCards = useCallback(
    (incoming: Record<string, MerchantCardRecord | null | undefined>) => {
      if (Object.keys(incoming).length === 0) return
      setCardMap((prev) => {
        const next = { ...prev }
        for (const [raw, rec] of Object.entries(incoming)) {
          const key = normalizeCardAddressKey(raw) ?? normalizeCardAddressKey(rec?.addressLower)
          if (!key || !rec) continue
          next[key] = {
            addressLower: key,
            meta: { ...(prev[key]?.meta ?? {}), ...rec.meta },
            metadataRoot: rec.metadataRoot ?? prev[key]?.metadataRoot,
            updatedAt: Math.max(prev[key]?.updatedAt ?? 0, rec.updatedAt),
          }
        }
        return next
      })
      void mergeTrustedMerchantCards(incoming)
    },
    [],
  )

  const syncWarmTargets = useCallback(
    (extra?: string[]) => {
      const out = new Set<string>(registeredRef.current)
      for (const c of myBrandCards) {
        const k = normalizeCardAddressKey(c.cardAddress)
        if (k && !isCardExcludedFromDisplay(k)) out.add(k)
      }
      for (const tx of recentActivityNoAaItems) {
        for (const addr of [merchantChargeCardAddressFromTxView(tx), topupCardAddressFromTxView(tx)]) {
          const k = normalizeCardAddressKey(addr)
          if (k) out.add(k)
        }
      }
      if (extra) {
        for (const a of extra) {
          const k = normalizeCardAddressKey(a)
          if (k) out.add(k)
        }
      }
      void setMerchantWarmTargets([...out])
    },
    [myBrandCards, recentActivityNoAaItems],
  )

  const registerCardAddresses = useCallback(
    (addresses: string[]) => {
      const needFetch: string[] = []
      for (const a of addresses) {
        const k = normalizeCardAddressKey(a)
        if (k && !isCardExcludedFromDisplay(k)) {
          registeredRef.current.add(k)
          if (merchantCardNeedsRemoteRefresh(cardMapRef.current[k])) needFetch.push(k)
        }
      }
      syncWarmTargets(addresses)
      if (needFetch.length > 0) {
        void ensureMerchantCards(needFetch, { maxPerTick: 4 }).then((map) => {
          setCardMap(map)
        })
      }
    },
    [syncWarmTargets],
  )

  const ensureCardsForAddresses = useCallback(
    async (addresses: string[], opts?: { maxPerTick?: number; forceRefresh?: boolean }) => {
      const map = await ensureMerchantCards(addresses, {
        maxPerTick: opts?.maxPerTick ?? MERCHANT_CARD_FETCH_MAX_PER_TICK,
        forceRefresh: opts?.forceRefresh,
      })
      setCardMap(map)
      syncWarmTargets(addresses)
      return map
    },
    [syncWarmTargets],
  )

  const ensureCardMetadata = useCallback(
    async (cardAddress: string): Promise<CardMetadataFromUri | null> => {
      const key = normalizeCardAddressKey(cardAddress)
      if (!key || isCardExcludedFromDisplay(key)) return null
      registerCardAddresses([key])
      const cached = cardMapRef.current[key]?.meta ?? null
      if (cached && !merchantCardNeedsRemoteRefresh(cardMapRef.current[key])) {
        return cached
      }
      const map = await ensureCardsForAddresses([key])
      return map[key]?.meta ?? cached
    },
    [ensureCardsForAddresses, registerCardAddresses],
  )

  const lookupByAddress = useCallback(
    (cardAddress: string | undefined) => lookupMerchantCardLocal(cardMap, cardAddress),
    [cardMap],
  )

  const peekMetadata = useCallback(
    (cardAddress: string | undefined): CardMetadataFromUri | null => {
      const rec = lookupMerchantCardLocal(cardMap, cardAddress)
      return rec?.meta ?? null
    },
    [cardMap],
  )

  const resolveName = useCallback(
    (cardAddress: string | undefined) =>
      merchantCardDisplayNameFromRecord(lookupMerchantCardLocal(cardMap, cardAddress)),
    [cardMap],
  )

  const resolveImage = useCallback(
    (cardAddress: string | undefined) => {
      const rec = lookupMerchantCardLocal(cardMap, cardAddress)
      return pickNonFactoryMerchantAssetUrl(rec?.meta?.icon, rec?.meta?.image) ?? ''
    },
    [cardMap],
  )

  /** Seed registry from My Brands daemon feed (trusted metadata already fetched). */
  useEffect(() => {
    const incoming: Record<string, MerchantCardRecord | null | undefined> = {}
    for (const [rawKey, row] of Object.entries(myBrandCardDetails)) {
      const key = normalizeCardAddressKey(rawKey)
      if (!key || isCardExcludedFromDisplay(key)) continue
      const meta = row?.meta
      if (!meta) continue
      incoming[key] = {
        addressLower: key,
        meta,
        updatedAt: Date.now(),
      }
    }
    if (Object.keys(incoming).length > 0) mergeTrustedCards(incoming)
  }, [myBrandCardDetails, mergeTrustedCards])

  /** Register merchant charge cards from Recent Activity for background refresh. */
  useEffect(() => {
    const addrs: string[] = []
    for (const tx of recentActivityNoAaItems) {
      const chargeAddr = merchantChargeCardAddressFromTxView(tx)
      if (chargeAddr) addrs.push(chargeAddr)
      const topupAddr = topupCardAddressFromTxView(tx)
      if (topupAddr) addrs.push(topupAddr)
    }
    if (addrs.length > 0) registerCardAddresses(addrs)
  }, [recentActivityNoAaItems, registerCardAddresses])

  /** Keep Worker warm targets in sync (Worker owns 5min tick). */
  useEffect(() => {
    syncWarmTargets()
  }, [syncWarmTargets])

  const value = useMemo(
    (): MerchantCardDatabaseContextValue => ({
      cardMap,
      cardMapRef,
      lookupByAddress,
      resolveName,
      resolveImage,
      peekMetadata,
      mergeTrustedCards,
      registerCardAddresses,
      ensureCardsForAddresses,
      ensureCardMetadata,
    }),
    [
      cardMap,
      lookupByAddress,
      resolveName,
      resolveImage,
      peekMetadata,
      mergeTrustedCards,
      registerCardAddresses,
      ensureCardsForAddresses,
      ensureCardMetadata,
    ],
  )

  return (
    <MerchantCardDatabaseContext.Provider value={value}>{children}</MerchantCardDatabaseContext.Provider>
  )
}
