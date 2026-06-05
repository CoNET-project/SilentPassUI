import { useEffect, useState } from 'react'
import {
  isIpfsFragmentImageUrl,
  parseFragmentHashFromUrl,
  resolveIpfsImageUrlToObjectUrl,
} from '@/utils/ipfsImageLibrary'

export { resolveIpfsImageUrlToObjectUrl as urlToObjectUrl } from '@/utils/ipfsImageLibrary'

/** Session cache: avoid revoke/remount flicker when list rows re-render. */
const objectUrlByFragmentHash = new Map<string, string>()

function cachedObjectUrlForIpfsUrl(url: string): string {
  const hash = parseFragmentHashFromUrl(url)
  if (!hash) return ''
  return objectUrlByFragmentHash.get(hash) ?? ''
}

function rememberObjectUrlForIpfsUrl(url: string, objUrl: string): void {
  const hash = parseFragmentHashFromUrl(url)
  if (!hash || !objUrl.startsWith('blob:')) return
  objectUrlByFragmentHash.set(hash, objUrl)
}

function isCachedObjectUrl(objUrl: string): boolean {
  if (!objUrl.startsWith('blob:')) return false
  for (const cached of objectUrlByFragmentHash.values()) {
    if (cached === objUrl) return true
  }
  return false
}

export const useObjectImgSrc = (src?: string) => {
  const [imgSrc, setImgSrc] = useState(() => {
    const s = String(src || '').trim()
    if (!s) return ''
    if (s.startsWith('data:image/') || s.startsWith('blob:')) return s
    if (!isIpfsFragmentImageUrl(s)) return s
    return cachedObjectUrlForIpfsUrl(s)
  })

  useEffect(() => {
    const s = String(src || '').trim()
    if (!s) {
      setImgSrc('')
      return
    }

    if (s.startsWith('data:image/') || s.startsWith('blob:')) {
      setImgSrc(s)
      return
    }

    if (!isIpfsFragmentImageUrl(s)) {
      setImgSrc(s)
      return
    }

    const cached = cachedObjectUrlForIpfsUrl(s)
    if (cached) {
      setImgSrc(cached)
      return
    }

    let alive = true
    let objUrl = ''

    ;(async () => {
      try {
        objUrl = await resolveIpfsImageUrlToObjectUrl(s)
        if (!objUrl) {
          if (alive) setImgSrc('')
          return
        }
        rememberObjectUrlForIpfsUrl(s, objUrl)
        if (alive) setImgSrc(objUrl)
      } catch {
        if (alive) setImgSrc('')
      }
    })()

    return () => {
      alive = false
      if (objUrl && objUrl.startsWith('blob:') && !isCachedObjectUrl(objUrl)) {
        URL.revokeObjectURL(objUrl)
      }
    }
  }, [src])

  return imgSrc
}
