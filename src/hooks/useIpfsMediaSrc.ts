import { useEffect, useState } from 'react'
import {
  LOCAL_LIBRARY_READ_TIMEOUT_MS,
  parseFragmentHashFromUrl,
  raceWithTimeout,
} from '@/utils/ipfsImageLibrary'
import {
  getLocalIpfsMediaRecord,
  resolveIpfsMediaUrlToObjectUrl,
} from '@/utils/ipfsMediaLibrary'

/** Session mirror avoids creating another object URL when the same hash remounts. */
const objectUrlByFragmentHash = new Map<string, string>()

function objectUrlFromRecord(blob: Blob, mime: string): string {
  const typed = blob.type === mime ? blob : new Blob([blob], { type: mime })
  return URL.createObjectURL(typed)
}

export type UseIpfsMediaSrcOptions = {
  /**
   * Play from the network while it downloads instead of waiting for the whole fragment.
   * Merchant videos are tens of MB, so a full download before the first frame leaves a
   * new visitor on a blank tile. A local hit is still preferred; nothing local is ever
   * deleted or overwritten by a failed read.
   */
  streamFirst?: boolean
}

export function useIpfsMediaSrc(
  src?: string | null,
  options: UseIpfsMediaSrcOptions = {},
): string {
  const streamFirst = options.streamFirst === true
  const [mediaSrc, setMediaSrc] = useState(() => {
    const trimmed = String(src || '').trim()
    if (!trimmed) return ''
    const hash = parseFragmentHashFromUrl(trimmed)
    if (!hash) return trimmed
    return objectUrlByFragmentHash.get(hash) ?? ''
  })

  useEffect(() => {
    const trimmed = String(src || '').trim()
    if (!trimmed) {
      setMediaSrc('')
      return
    }
    const hash = parseFragmentHashFromUrl(trimmed)
    if (!hash) {
      setMediaSrc(trimmed)
      return
    }
    const cached = objectUrlByFragmentHash.get(hash)
    if (cached) {
      setMediaSrc(cached)
      return
    }

    let active = true

    if (streamFirst) {
      // Local library first (bounded wait), otherwise stream the remote fragment as-is.
      void raceWithTimeout(
        getLocalIpfsMediaRecord(hash).catch(() => null),
        LOCAL_LIBRARY_READ_TIMEOUT_MS,
        null,
      ).then(record => {
        if (!active) return
        if (record) {
          const objUrl = objectUrlFromRecord(record.blob, record.mime)
          objectUrlByFragmentHash.set(hash, objUrl)
          setMediaSrc(objUrl)
          return
        }
        setMediaSrc(trimmed)
      })
      return () => {
        active = false
      }
    }

    void resolveIpfsMediaUrlToObjectUrl(trimmed)
      .then(resolved => {
        if (resolved.startsWith('blob:')) {
          objectUrlByFragmentHash.set(hash, resolved)
        }
        if (active) setMediaSrc(resolved)
      })
      .catch(() => {
        // A network failure is not a trusted empty result. Keep the remote URL as
        // this mount's fallback without deleting any previously cached record.
        if (active) setMediaSrc(trimmed)
      })

    return () => {
      active = false
    }
  }, [src, streamFirst])

  return mediaSrc
}
