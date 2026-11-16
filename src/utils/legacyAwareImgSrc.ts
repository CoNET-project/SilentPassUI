import { isIpfsFragmentImageUrl } from './ipfsImageLibrary'
import { resolveOutboundHref } from './legacyBeamioLinks'

/**
 * 图片地址的同步显示值（useObjectImgSrc 使用）。
 * - 空：''
 * - data:image/ 与 blob:：原样
 * - IPFS fragment（含旧域 fragment）：返回 null，由调用方经 IPFS 本地库取图，不请求旧域
 * - 其他：非旧域原样；旧域映射为 beamio.ca 后返回；映射失败（不识别或被拒绝）返回 ''，不加载
 */
export function syncImgSrcFor(src: string | undefined): string | null {
	const s = String(src || '').trim()
	if (!s) return ''
	if (s.startsWith('data:image/') || s.startsWith('blob:')) return s
	if (isIpfsFragmentImageUrl(s)) return null
	return resolveOutboundHref(s) ?? ''
}
