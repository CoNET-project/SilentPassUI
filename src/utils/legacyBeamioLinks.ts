/**
 * 旧域 beamio.app 链接的本地识别（纯函数，只做字符串解析与映射，不发起任何网络请求）。
 *
 * 已印刷的二维码与外链仍会带旧域地址，因此先在本地映射为新域的对应路径，之后再按新地址请求。
 *
 * 识别与映射范围（DM-BIZ-01 第二轮，总 PM 裁定）：只有 apex、www、biz 三类做映射。
 * - beamio.app 与 www.beamio.app 的 /biz 与 /biz/ 开头路径 → biz.beamio.ca/biz/…（/biz 映射为 /biz/，查询串与片段保留）
 * - beamio.app 与 www.beamio.app 其余路径 → beamio.ca（路径、查询串、片段原样保留）
 * - biz.beamio.app → biz.beamio.ca（路径、查询串、片段原样保留）
 * - 其他子域（cashtrees、api 等）没有对应目标：不识别，既不映射也不请求，按拒绝处理。
 *
 * 映射结果只指向 beamio.ca 或 biz.beamio.ca。调用方只能使用映射后的字符串，
 * 不得把原始旧链接交给 fetch、XMLHttpRequest、img、iframe、window.open 或 location。
 */

const CONSUMER_HOST = 'beamio.ca'
const BIZ_HOST = 'biz.beamio.ca'
const LEGACY_APEX = 'beamio.app'
const LEGACY_WWW = 'www.beamio.app'
const LEGACY_BIZ = 'biz.beamio.app'

/** 无协议的旧链接只在其后紧跟路径、查询或片段时识别，避免把裸域名误判为链接。 */
const SCHEMELESS_LEGACY_RE = /^(?:[a-z0-9-]+\.)*beamio\.app(?=[/?#])/i

/** 主机是否为旧域（beamio.app 或其子域）。 */
function isLegacyHostName(host: string): boolean {
	return host === LEGACY_APEX || host.endsWith(`.${LEGACY_APEX}`)
}

/** 旧主机与路径对应的新位置；不在 apex、www、biz 映射范围内（含其他子域）时返回 null。 */
function legacyLocationFor(host: string, pathname: string): { host: string; pathname: string } | null {
	if (host === LEGACY_BIZ) return { host: BIZ_HOST, pathname }
	if (host === LEGACY_APEX || host === LEGACY_WWW) {
		// apex 与 www 的 /biz 路径一致映射到 biz 主机（M1：beamio.ca/biz 实测 500）
		if (pathname === '/biz' || pathname === '/biz/') return { host: BIZ_HOST, pathname: '/biz/' }
		if (pathname.startsWith('/biz/')) return { host: BIZ_HOST, pathname }
		return { host: CONSUMER_HOST, pathname }
	}
	// 其他子域没有对应目标：不识别
	return null
}

const REFUSED = 'legacy beamio.app link refused'

/**
 * 若 raw 是旧域 beamio.app 系列的链接，返回等价的 https 链接（beamio.ca 或 biz.beamio.ca）；否则返回 null。
 * 拒绝：非 http(s) 协议、带用户名或密码、非默认端口、主机不是 beamio.app 或其子域（含 beamio.app.evil.com 这类后缀伪装）。
 */
export function mapLegacyBeamioLink(raw: string): string | null {
	if (typeof raw !== 'string') return null
	const s = raw.trim()
	if (!s) return null
	let candidate: string
	if (/^https?:\/\//i.test(s)) candidate = s
	else if (SCHEMELESS_LEGACY_RE.test(s)) candidate = `https://${s}`
	else return null
	let u: URL
	try {
		u = new URL(candidate)
	} catch {
		return null
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
	if (u.username !== '' || u.password !== '') return null
	if (u.port !== '') return null
	const host = u.hostname.toLowerCase().replace(/\.$/, '')
	const loc = legacyLocationFor(host, u.pathname)
	if (!loc) return null
	return `https://${loc.host}${loc.pathname}${u.search}${u.hash}`
}

/** 绝对地址的主机若为旧域，则以绝对解析为准（https:/beamio.app 在有 base 时会被当作相对路径）。 */
function resolveWithBase(input: string, base: string): URL {
	let absolute: URL | null = null
	try {
		absolute = new URL(input)
	} catch {
		absolute = null
	}
	if (absolute && isLegacyHostName(absolute.hostname.toLowerCase().replace(/\.$/, ''))) return absolute
	return new URL(input, base)
}

/**
 * 把输入解析为 URL，并保证结果的主机永不是旧域。
 * 与 new URL(input, base) 相同；若解析结果落在 beamio.app 或其子域上（包括协议相对 //beamio.app、
 * 反斜杠、制表符、单斜杠 https:/beamio.app 等形式），映射为新域，路径、查询、片段保留。
 * 旧域但不允许映射（带用户名或密码、非默认端口、非 http(s)、无映射目标）时抛出异常，调用方不得请求或导航。
 * 解析失败时与 new URL 一样抛出异常。
 */
export function resolveBeamioUrl(input: string, base?: string): URL {
	const mapped = mapLegacyBeamioLink(input)
	const u = mapped !== null
		? new URL(mapped)
		: base === undefined
			? new URL(input)
			: resolveWithBase(input, base)
	const host = u.hostname.toLowerCase().replace(/\.$/, '')
	if (!isLegacyHostName(host)) return u
	// 旧域主机：带用户名或密码、非默认端口、非 http(s)、或无映射目标的，一律拒绝（不映射、不请求）
	if (u.username !== '' || u.password !== '' || u.port !== '') throw new Error(REFUSED)
	if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(REFUSED)
	const loc = legacyLocationFor(host, u.pathname)
	if (loc === null) throw new Error(REFUSED)
	const out = new URL(u.href)
	out.protocol = 'https:'
	out.hostname = loc.host
	out.pathname = loc.pathname
	out.port = ''
	out.username = ''
	out.password = ''
	return out
}

/** 用于分享或打开外部链接：返回 http(s) 的 href（旧域已映射），其他输入返回 null。 */
export function resolveBeamioHttpHref(raw: string, base?: string): string | null {
	try {
		const u = resolveBeamioUrl(raw, base)
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
	} catch {
		return null
	}
}

/**
 * 输入的主机是否为旧域（beamio.app 或其子域），只做字符串与 URL 解析，不发请求。
 * 先按绝对地址解析（https:/beamio.app 这类形式需要如此），失败再以 beamio.ca 为 base 解析协议相对与相对形式。
 */
function mentionsLegacyHost(raw: string): boolean {
	const s = raw.trim()
	if (SCHEMELESS_LEGACY_RE.test(s)) return true
	let u: URL
	try {
		u = new URL(s)
	} catch {
		try {
			u = new URL(s, `https://${CONSUMER_HOST}`)
		} catch {
			return false
		}
	}
	const host = u.hostname.toLowerCase().replace(/\.$/, '')
	return host === LEGACY_APEX || host.endsWith(`.${LEGACY_APEX}`)
}

/**
 * 出站地址（window.open、location、a[href]、img、iframe、video 等）的统一入口。
 * - 非旧域输入：原样返回，行为与改造前相同；
 * - 旧域输入：映射后返回 https 新域地址；
 * - 旧域但无映射目标、带用户名或密码、非默认端口、非 http(s)：返回 null，调用方不得导航或加载。
 */
export function resolveOutboundHref(raw: string): string | null {
	if (typeof raw !== 'string') return null
	if (!mentionsLegacyHost(raw)) return raw
	return resolveBeamioHttpHref(raw, `https://${CONSUMER_HOST}`)
}

/**
 * 原生标签的 src／href（img、video、iframe、a）：非字符串返回 undefined；旧域映射后使用，
 * 不识别或被拒绝的旧域地址返回 undefined（不加载、不导航）。非旧域值原样返回。
 */
export function outboundSrc(raw: string | null | undefined): string | undefined {
	if (typeof raw !== 'string') return undefined
	return resolveOutboundHref(raw) ?? undefined
}
