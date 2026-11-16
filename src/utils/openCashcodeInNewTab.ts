import { resolveBeamioHttpHref } from './legacyBeamioLinks'

/**
 * 在新标签页打开 cashcode 链接。先经 resolveBeamioHttpHref 映射旧域，只打开 http(s) 地址；
 * 非 URL 文本、不识别或被拒绝的旧域链接不打开。返回是否已打开。open 可注入，便于测试。
 */
export function openCashcodeInNewTab(
	cashcodeUrl: string,
	open: (href: string) => unknown = (href) => window.open(href, '_blank', 'noopener,noreferrer'),
): boolean {
	const href = resolveBeamioHttpHref(cashcodeUrl)
	if (!href) return false
	open(href)
	return true
}
