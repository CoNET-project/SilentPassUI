import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ethers } from 'ethers'
import { checkStorageWithTimeout, bootstrapProfileLocaleCurrencyIfUnset } from '@/services/beamio'
import { initChat } from '@/services/chat'
import { setCoNET_Data } from '@/utils/globals'
import { useDaemonContext } from '@/providers/DaemonProvider'
import SplashScreen from '@/components/SplashScreen'
import { isWorkspaceAccessGranted } from '@/utils/beamioWorkspaceLock'
import { getSessionPrivateKeyArmor, hasSessionPrivateKeyArmor } from '@/utils/beamioSessionSecrets'

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
 */
export default function RequireUnlockedWallet() {
	const location = useLocation()
	const [gate, setGate] = useState<'checking' | 'ok' | 'unauth'>('checking')
	const {
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
		;(async () => {
			if (!isWorkspaceAccessGranted() || !hasSessionPrivateKeyArmor()) {
				if (!cancelled) setGate('unauth')
				return
			}
			const data = await checkStorageWithTimeout(undefined, false)
			if (cancelled) return
			const flat = ensureFlatProfiles((data as { profiles?: unknown } | null)?.profiles)
			if (!data || flat.length === 0 || !sessionKeyMatchesProfile(flat)) {
				setGate('unauth')
				return
			}
			const merged = { ...(data as object), profiles: flat }
			setCoNET_Data(merged as encrypt_keys_object)
			setProfiles(flat)
			const p0 = flat[0] as { keyID?: string }
			const eoa = p0?.keyID?.trim()
			if (eoa && ethers.isAddress(eoa)) {
				setMyAddress(ethers.getAddress(eoa))
			} else {
				setGate('unauth')
				return
			}
			const bo = (data as { beamio?: beamio })?.beamio
			const pk = getSessionPrivateKeyArmor()?.trim()
			if (bo && typeof bo === 'object') {
				let nextBo = bo
				if (pk) {
					nextBo = await bootstrapProfileLocaleCurrencyIfUnset(bo, pk)
					const updated = { ...(merged as encrypt_keys_object), beamio: nextBo }
					setCoNET_Data(updated)
				}
				setBeamio(nextBo)
				if (typeof nextBo.darkTheme === 'boolean') setDarkModle(nextBo.darkTheme)
			}
			setGate('ok')
			void initChat(setProfiles, setAllNodes, setGossip, gossip, (message) => {
				setCharts((prev: string[]) => [...prev, message])
			})
		})()
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- setters stable; gossip read at mount is correct for deep-link bootstrap
	}, [])

	if (gate === 'checking') return <SplashScreen />
	if (gate === 'unauth') return <Navigate to="/" replace state={{ from: location.pathname }} />
	return <Outlet />
}
