import { useEffect, useState } from 'react'
import { resolveIpfsImageUrlToObjectUrl } from '@/utils/ipfsImageLibrary'
import { syncImgSrcFor } from '@/utils/legacyAwareImgSrc'

export { resolveIpfsImageUrlToObjectUrl as urlToObjectUrl } from '@/utils/ipfsImageLibrary'

export const useObjectImgSrc = (src?: string) => {
  const [imgSrc, setImgSrc] = useState(() => syncImgSrcFor(src) ?? '')

  useEffect(() => {
    const sync = syncImgSrcFor(src)
    if (sync !== null) {
      setImgSrc(sync)
      return
    }
    const s = String(src || '').trim()

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
