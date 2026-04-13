import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ethers } from 'ethers'
import { checkStorage } from '@/services/beamio'
import { initChat } from '@/services/chat'
import { setCoNET_Data } from '@/utils/globals'
import { useDaemonContext } from '@/providers/DaemonProvider'
import SplashScreen from '@/components/SplashScreen'
import { isWorkspaceScreenLocked } from '@/utils/beamioWorkspaceLock'

/** Match `beamio.ts` `storeSystemData` flattening so `CoNET_Data.profiles` is always a flat `profile[]`. */
function ensureFlatProfiles(p: unknown): profile[] {
	if (!p || !Array.isArray(p)) return []
	if (p.length === 0) return []
	const first = (p as unknown[])[0]
	if (Array.isArray(first)) return (p as profile[][]).flat()
	return p as profile[]
}

function isUnlockedWalletPayload(data: unknown, flat: profile[]): boolean {
	if (!data || flat.length === 0) return false
	const p0 = flat[0] as { privateKeyArmor?: string; keyID?: string }
	if (!p0) return false
	const pk = p0.privateKeyArmor?.trim()
	if (!pk) return false
	let derived: string
	try {
		derived = new ethers.Wallet(pk).address
	} catch {
		return false
	}
	if (p0.keyID && ethers.isAddress(p0.keyID) && p0.keyID.toLowerCase() !== derived.toLowerCase()) {
		return false
	}
	return true
}

/**
 * 深链进入受保护页面前：必须从本地存储恢复钱包并校验私钥可用，否则重定向到 `/` 走 Beamio 解锁 /创建流程。
 * 与 `LoadingPage` / `bizHome.assembleEncryptKeysObject` 一致地写入 `profiles`、`CoNET_Data`；在 gossip 未启动时补跑 `initChat`。
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
			if (isWorkspaceScreenLocked()) {
				if (!cancelled) setGate('unauth')
				return
			}
			const data = await checkStorage(false)
			if (cancelled) return
			const flat = ensureFlatProfiles((data as { profiles?: unknown } | null)?.profiles)
			if (!isUnlockedWalletPayload(data, flat)) {
				setGate('unauth')
				return
			}
			const merged = { ...(data as object), profiles: flat }
			setCoNET_Data(merged as encrypt_keys_object)
			setProfiles(flat)
			const p0 = flat[0] as { keyID?: string; privateKeyArmor?: string }
			const eoa = p0?.keyID?.trim()
			if (eoa && ethers.isAddress(eoa)) {
				setMyAddress(ethers.getAddress(eoa))
			} else {
				try {
					const pk = p0?.privateKeyArmor?.trim()
					if (!pk) {
						setGate('unauth')
						return
					}
					setMyAddress(ethers.getAddress(new ethers.Wallet(pk).address))
				} catch {
					setGate('unauth')
					return
				}
			}
			const bo = (data as { beamio?: beamio })?.beamio
			if (bo && typeof bo === 'object') {
				setBeamio(bo)
				if (typeof bo.darkTheme === 'boolean') setDarkModle(bo.darkTheme)
			}
			setGate('ok')
			void initChat(setProfiles, setAllNodes, setGossip, gossip, (message) => {
				setCharts((prev: string[]) => [...prev, message])
			})
		})()
		return () => {
			cancelled = true
		}
		// Intentionally once per layout mount: avoid re-running when `gossip` flips after initChat.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- setters stable; gossip read at mount is correct for deep-link bootstrap
	}, [])

	if (gate === 'checking') return <SplashScreen />
	if (gate === 'unauth') return <Navigate to="/" replace state={{ from: location.pathname }} />
	return <Outlet />
}
