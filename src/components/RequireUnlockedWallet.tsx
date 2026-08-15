import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ethers } from 'ethers'
import {
	checkStorageWithTimeout,
	bootstrapProfileLocaleCurrencyIfUnset,
	raceWithTimeout,
} from '@/services/beamio'
import { initChat } from '@/services/chat'
import { getCoNET_Data, setCoNET_Data } from '@/utils/globals'
import { useDaemonContext } from '@/providers/DaemonProvider'
import SplashScreen from '@/components/SplashScreen'
import { isWorkspaceAccessGranted } from '@/utils/beamioWorkspaceLock'
import { getSessionPrivateKeyArmor, hasSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'

/** Safari Private: never leave the centered logo splash waiting on IndexedDB / postBeamio. */
const GATE_HARD_TIMEOUT_MS = 12_000
const BOOTSTRAP_TIMEOUT_MS = 8_000

/** Match `beamio.ts` `storeSystemData` flattening so `CoNET_Data.profiles` is always a flat `profile[]`. */
function ensureFlatProfiles(p: unknown): profile[] {
	if (!p || !Array.isArray(p)) return []
	if (p.length === 0) return []
	const first = (p as unknown[])[0]
	if (Array.isArray(first)) return (p as profile[][]).flat()
	return p as profile[]
}

function sessionKeyMatchesProfile(flat: profile[]): boolean {
	const p0 = flat[0] as { keyID?: string } | undefined
	if (!p0?.keyID?.trim() || !ethers.isAddress(p0.keyID)) return false
	const pk = getSessionPrivateKeyArmor()?.trim()
	if (!pk) return false
	try {
		const derived = new ethers.Wallet(pk).address
		return derived.toLowerCase() === ethers.getAddress(p0.keyID).toLowerCase()
	} catch {
		return false
	}
}

/**
 * 深链进入受保护页面前：必须完成本会话 biz gateway 密码解锁，且会话内存中持有私钥，否则重定向到 `/`。
 * 磁盘 profile 元数据不含 privateKeyArmor（见 beamio-private-key-session-memory-only.mdc）。
 * Safari 隐私窗口 IndexedDB 常空/挂起：已解锁会话 + 内存/Daemon profile 即可放行，不得等盘。
 */
export default function RequireUnlockedWallet() {
	const location = useLocation()
	const [gate, setGate] = useState<'checking' | 'ok' | 'unauth'>('checking')
	const {
		profiles,
		setProfiles,
		setMyAddress,
		setBeamio,
		setDarkModle,
		setAllNodes,
		setGossip,
		gossip,
		setCharts,
	} = useDaemonContext()

	useEffect(() => {
		let cancelled = false
		let settled = false

		const finish = (next: 'ok' | 'unauth') => {
			if (cancelled || settled) return
			settled = true
			setGate(next)
		}

		const trySource = (src: encrypt_keys_object | null | undefined) => {
			if (!src) return null
			const flat = ensureFlatProfiles((src as { profiles?: unknown }).profiles)
			if (!flat.length || !sessionKeyMatchesProfile(flat)) return null
			return { data: src, flat }
		}

		const pickSource = (disk: encrypt_keys_object | null) => {
			const memory = getCoNET_Data()
			const daemonFlat = ensureFlatProfiles(profiles)
			const fromDisk = trySource(disk)
			if (fromDisk) return fromDisk
			const fromMemory = trySource(memory)
			if (fromMemory) return fromMemory
			if (daemonFlat.length && sessionKeyMatchesProfile(daemonFlat)) {
				return {
					data: (memory ?? { profiles: daemonFlat }) as encrypt_keys_object,
					flat: daemonFlat,
				}
			}
			return null
		}

		const hydrateOk = (data: encrypt_keys_object, flat: profile[]) => {
			if (cancelled || settled) return
			const merged = { ...(data as object), profiles: flat } as encrypt_keys_object
			setCoNET_Data(merged)
			setProfiles(flat)
			const p0 = flat[0] as { keyID?: string }
			const eoa = p0?.keyID?.trim()
			if (!eoa || !ethers.isAddress(eoa)) {
				finish('unauth')
				return
			}
			setMyAddress(ethers.getAddress(eoa))
			const bo = (merged as { beamio?: beamio }).beamio
			const pk = getSessionPrivateKeyArmor()?.trim()
			if (bo && typeof bo === 'object') {
				setBeamio(bo)
				if (typeof bo.darkTheme === 'boolean') setDarkModle(bo.darkTheme)
				if (pk) {
					void raceWithTimeout(
						bootstrapProfileLocaleCurrencyIfUnset(bo, pk),
						BOOTSTRAP_TIMEOUT_MS,
						bo,
					)
						.then((nextBo) => {
							if (cancelled) return
							const updated = { ...(getCoNET_Data() ?? merged), beamio: nextBo }
							setCoNET_Data(updated)
							setBeamio(nextBo)
							if (typeof nextBo.darkTheme === 'boolean') setDarkModle(nextBo.darkTheme)
						})
						.catch(() => {
							/* locale write is best-effort; do not keep splash */
						})
				}
			}
			finish('ok')
			void initChat(setProfiles, setAllNodes, setGossip, gossip, (message) => {
				setCharts((prev: string[]) => [...prev, message])
			})
		}

		const hardTimer = window.setTimeout(() => {
			console.warn(
				`[RequireUnlockedWallet] gate timed out after ${GATE_HARD_TIMEOUT_MS}ms — using session memory if present`,
			)
			const fallback = pickSource(null)
			if (fallback) hydrateOk(fallback.data, fallback.flat)
			else finish('unauth')
		}, GATE_HARD_TIMEOUT_MS)

		;(async () => {
			try {
				if (!isWorkspaceAccessGranted() || !hasSessionPrivateKeyArmor()) {
					finish('unauth')
					return
				}
				const disk = await checkStorageWithTimeout(undefined, false)
				if (cancelled) return
				const picked = pickSource(disk)
				if (!picked) {
					finish('unauth')
					return
				}
				hydrateOk(picked.data, picked.flat)
			} catch (err) {
				console.warn(
					'[RequireUnlockedWallet] gate failed',
					err instanceof Error ? err.message : String(err),
				)
				const fallback = pickSource(null)
				if (fallback) hydrateOk(fallback.data, fallback.flat)
				else finish('unauth')
			} finally {
				window.clearTimeout(hardTimer)
			}
		})()

		return () => {
			cancelled = true
			window.clearTimeout(hardTimer)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- setters stable; gossip/profiles read at mount for deep-link bootstrap
	}, [])

	if (gate === 'checking') return <SplashScreen />
	if (gate === 'unauth') return <Navigate to="/" replace state={{ from: location.pathname }} />
	return <Outlet />
}
