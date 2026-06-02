import { useEffect, useState } from 'react'
import { isIpfsFragmentImageUrl, resolveIpfsImageUrlToObjectUrl } from '@/utils/ipfsImageLibrary'

export { resolveIpfsImageUrlToObjectUrl as urlToObjectUrl } from '@/utils/ipfsImageLibrary'

export const useObjectImgSrc = (src?: string) => {
  const [imgSrc, setImgSrc] = useState(() => {
    const s = String(src || '').trim()
    if (!s) return ''
    if (s.startsWith('data:image/') || s.startsWith('blob:')) return s
    if (!isIpfsFragmentImageUrl(s)) return s
    return ''
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

    let alive = true
    let objUrl = ''

    ;(async () => {
      try {
        objUrl = await resolveIpfsImageUrlToObjectUrl(s)
        if (alive) setImgSrc(objUrl)
      } catch {
        if (alive) setImgSrc('')
      }
    })()

    return () => {
      alive = false
      if (objUrl && objUrl.startsWith('blob:')) URL.revokeObjectURL(objUrl)
    }
  }, [src])

  return imgSrc
}
