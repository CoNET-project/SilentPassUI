import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import {
  getLocalIpfsImageRecord,
  isIpfsFragmentImageUrl,
  parseFragmentHashFromUrl,
  putLocalIpfsImageFromDataUrl,
  resolveIpfsImageUrlToObjectUrl,
  warmIpfsImageUrls,
} from '@/utils/ipfsImageLibrary'

export type IpfsImageLibraryContextValue = {
  resolveObjectUrl: (url: string) => Promise<string>
  warmUrls: (urls: Array<string | undefined | null>) => void
  cacheUploadDataUrl: (hash: string, dataUrl: string) => void
  hasLocalHash: (hashOrUrl: string) => Promise<boolean>
}

const defaultValue: IpfsImageLibraryContextValue = {
  resolveObjectUrl: resolveIpfsImageUrlToObjectUrl,
  warmUrls: warmIpfsImageUrls,
  cacheUploadDataUrl: (hash, dataUrl) => {
    void putLocalIpfsImageFromDataUrl(hash, dataUrl).catch(() => {})
  },
  hasLocalHash: async (hashOrUrl) => {
    const hash = parseFragmentHashFromUrl(hashOrUrl) ?? hashOrUrl
    const rec = await getLocalIpfsImageRecord(hash).catch(() => null)
    return !!rec
  },
}

const IpfsImageLibraryContext = createContext<IpfsImageLibraryContextValue>(defaultValue)

export function useIpfsImageLibrary(): IpfsImageLibraryContextValue {
  return useContext(IpfsImageLibraryContext)
}

export function IpfsImageLibraryProvider({ children }: { children: ReactNode }) {
  const { beamio, profiles } = useDaemonContext()
  const { cardMap } = useMerchantCardDatabase()

  const resolveObjectUrl = useCallback(
    (url: string) => resolveIpfsImageUrlToObjectUrl(url),
    [],
  )

  const warmUrls = useCallback((urls: Array<string | undefined | null>) => {
    warmIpfsImageUrls(urls)
  }, [])

  const cacheUploadDataUrl = useCallback((hash: string, dataUrl: string) => {
    void putLocalIpfsImageFromDataUrl(hash, dataUrl).catch(() => {})
  }, [])

  const hasLocalHash = useCallback(async (hashOrUrl: string) => {
    const hash = parseFragmentHashFromUrl(hashOrUrl) ?? hashOrUrl
    const rec = await getLocalIpfsImageRecord(hash).catch(() => null)
    return !!rec
  }, [])

  useEffect(() => {
    const urls: string[] = []
    if (beamio?.image && isIpfsFragmentImageUrl(beamio.image)) urls.push(beamio.image)
    const profileImage = profiles?.[0]?.image
    if (profileImage && isIpfsFragmentImageUrl(profileImage)) urls.push(profileImage)
    for (const rec of Object.values(cardMap)) {
      const img = rec?.meta?.image ?? rec?.meta?.icon
      if (img && isIpfsFragmentImageUrl(img)) urls.push(img)
    }
    if (urls.length) warmIpfsImageUrls(urls)
  }, [beamio?.image, profiles, cardMap])

  const value: IpfsImageLibraryContextValue = {
    resolveObjectUrl,
    warmUrls,
    cacheUploadDataUrl,
    hasLocalHash,
  }

  return (
    <IpfsImageLibraryContext.Provider value={value}>
      {children}
    </IpfsImageLibraryContext.Provider>
  )
}
