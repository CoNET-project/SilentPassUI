/**
 * Base 主网 RPC 模块
 * 使用 https://base-rpc.publicnode.com
 */
import { ethers } from 'ethers'

const BASE_NETWORK = { name: 'base', chainId: 8453 } as const

const BEAMIO_BASE_RPC = 'https://base-rpc.publicnode.com'

/** Base 主网 RPC 列表 */
export const BASE_RPC_URLS = [BEAMIO_BASE_RPC]

/** 检测是否为 RPC 配额/网络类错误（应触发切换） */
export const isRpcQuotaOrNetworkError = (err: unknown): boolean => {
	const msg = String((err as Error)?.message ?? err)
	const code = (err as { statusCode?: number; status?: number })?.statusCode ?? (err as { status?: number })?.status
	return (
		code === 429 ||
		/429|Too [Mm]any [Rr]equests/i.test(msg) ||
		/Exceeded the quota usage/i.test(msg) ||
		/-32001|-32005/i.test(msg) ||
		/BAD_DATA/i.test(msg) ||
		/missing response for request/i.test(msg) ||
		/JsonRpcProvider failed to detect network/i.test(msg) ||
		/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ERR_CONNECTION_CLOSED|net::/i.test(msg) ||
		/ERR_INCOMPLETE_CHUNKED_ENCODING/i.test(msg) ||
		/Failed to fetch|fetch failed/i.test(msg)
	)
}

/** @deprecated 不再使用 conet.network 节点作为 Base RPC，保留空实现以兼容调用方 */
export type BaseRpcNodeInfo = { domain: string }

/** @deprecated 不再使用 conet.network 节点 */
export function setBaseRpcNodeProvider(_getter: (() => BaseRpcNodeInfo[]) | null): void {
	// no-op
}

/** @deprecated 不再使用 conet.network 节点 */
export function setRpcDegradedGetter(_getter: (() => boolean) | null): void {
	// no-op
}

/** 获取当前有效 URL 列表（仅 BASE_RPC_URLS，不再包含 conet 节点） */
function getEffectiveUrls(): string[] {
	return BASE_RPC_URLS
}

/** 创建单个 JsonRpcProvider */
function createProvider(url: string): ethers.JsonRpcProvider {
	return new ethers.JsonRpcProvider(url, BASE_NETWORK, { staticNetwork: true })
}

/** 当前使用的 RPC 索引 */
let _currentIndex = 0

/** 获取当前 provider */
function getCurrentProvider(): ethers.JsonRpcProvider {
	const urls = getEffectiveUrls()
	if (!urls.length) return createProvider(BEAMIO_BASE_RPC)
	return createProvider(urls[_currentIndex] ?? urls[0])
}

/** 选取起始索引：多节点时从 0..n-1 随机分配 */
function pickRandomStartIndex(): void {
	const urls = getEffectiveUrls()
	_currentIndex = urls.length > 1 ? Math.floor(Math.random() * urls.length) : 0
}

/** 切换到下一个 RPC，返回新 provider */
export function switchToNextBaseRpc(): ethers.JsonRpcProvider {
	const urls = getEffectiveUrls()
	const n = Math.max(1, urls.length)
	_currentIndex = (_currentIndex + 1) % n
	return createProvider(urls[_currentIndex] ?? urls[0] ?? BEAMIO_BASE_RPC)
}

/** 获取当前 RPC URL（便于调试） */
export function getCurrentBaseRpcUrl(): string {
	const urls = getEffectiveUrls()
	return urls[_currentIndex] ?? urls[0] ?? BASE_RPC_URLS[0] ?? ''
}

/** 重置为第一个 RPC（可选） */
export function resetBaseRpcIndex(): void {
	_currentIndex = 0
	_hasPickedRandomStart = false
}

/** @deprecated 不再使用 conet.network 节点，立即 resolve */
export function waitForConetNodes(_maxWaitMs = 30000): Promise<void> {
	return Promise.resolve()
}

/**
 * 使用 Base RPC 执行任意异步操作，失败时自动切换节点重试（仅 BASE_RPC_URLS 内切换）
 */
/** 是否已在本次会话中做过随机起始（避免每次请求都重置，导致 429 后下次又打回故障节点） */
let _hasPickedRandomStart = false

export async function withBaseRpc<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
	const urls = getEffectiveUrls()
	// 首次或 url 数量变化时做一次随机起始，后续保持 _currentIndex（429 后 switchToNextBaseRpc 已递增，不重置）
	if (!_hasPickedRandomStart || _currentIndex >= urls.length) {
		pickRandomStartIndex()
		_hasPickedRandomStart = true
	}
	_currentIndex = Math.min(_currentIndex, urls.length - 1)
	const maxTries = Math.max(urls.length, 1)
	let lastError: unknown

	for (let i = 0; i < maxTries; i++) {
		const provider = getCurrentProvider()
		try {
			const result = await fn(provider)
			return result
		} catch (err) {
			lastError = err
			if (isRpcQuotaOrNetworkError(err) && i < maxTries - 1) {
				switchToNextBaseRpc()
				continue
			}
			throw err
		}
	}
	throw lastError
}

/** Provider 方法的包装器：对指定 provider 的 method 调用添加自动切换重试 */
export async function callWithBaseRpcRetry(
	_provider: ethers.JsonRpcProvider,
	method: string,
	...args: unknown[]
): Promise<unknown> {
	return withBaseRpc(async (p) => {
		const fn = (p as unknown as Record<string, (...a: unknown[]) => unknown>)[method]
		if (typeof fn !== 'function') {
			throw new Error(`Provider.${method} is not a function`)
		}
		return fn.apply(p, args)
	})
}

/** 创建带自动切换的 Base Provider（仅 BASE_RPC_URLS 内切换） */
function createSwitchableBaseProvider(): ethers.Provider {
	const base = getCurrentProvider()
	return new Proxy(base, {
		get(_, prop: string) {
			const val = (base as unknown as Record<string, unknown>)[prop]
			if (typeof val === 'function') {
				return (...args: unknown[]) =>
					withBaseRpc(async (p) => {
						const pb = p as unknown as Record<string, unknown>
						const fn = pb[prop]
						return typeof fn === 'function' ? (fn as (...a: unknown[]) => unknown).apply(p, args) : pb[prop]
					})
			}
			return val
		},
	}) as ethers.Provider
}

/** Base 主网 Provider（自动切换免费 RPC，供所有 RPC 交互使用） */
export const baseEndpoint = createSwitchableBaseProvider()
