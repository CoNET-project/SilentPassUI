import { useEffect, useState } from 'react'
import { parseFragmentHashFromUrl } from '@/utils/ipfsImageLibrary'
import { resolveIpfsMediaUrlToObjectUrl } from '@/utils/ipfsMediaLibrary'

/** Session mirror avoids creating another object URL when the same hash remounts. */
const objectUrlByFragmentHash = new Map<string, string>()

export function useIpfsMediaSrc(src?: string | null): string {
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
  }, [src])

  return mediaSrc
}
