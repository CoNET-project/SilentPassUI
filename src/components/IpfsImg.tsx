import type { ImgHTMLAttributes } from 'react'
import { useObjectImgSrc } from '@/components/card/useObjectImgSrc'

/** `<img>` with local-first IPFS fragment resolution. */
export function IpfsImg({ src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const displaySrc = useObjectImgSrc(typeof src === 'string' ? src : undefined)
  if (!displaySrc) return null
  return <img {...rest} src={displaySrc} />
}
