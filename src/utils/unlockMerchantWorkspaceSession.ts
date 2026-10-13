/**
 * Shared post-restore unlock (login / agent↔temp session switch).
 * Extracted from bizHome assembleEncryptKeysObject.
 */

import { ethers } from 'ethers'
import {
	getUserInfo,
	storeSystemData,
	bootstrapProfileLocaleCurrencyIfUnset,
	mergeLocalLocaleLanguageOntoChainProfile,
} from '@/services/beamio'
import { setCoNET_Data } from '@/utils/globals'
import { initChat } from '@/services/chat'
import { fetchTrustedCanonicalAaFromRpc } from '@/services/BeamioCard'
import { ensureConetAaForProfileAndPersist } from '@/utils/ensureConetAa'
import { conetDepinProvider } from '@/utils/constants'
import { markWorkspaceSessionUnlocked } from '@/utils/beamioWorkspaceLock'
import {
	hydrateProfilesWithSessionSecrets,
	ingestSessionPrivateKeyFromProfiles,
	getSessionPrivateKeyArmor,
} from '@/utils/beamioSessionSecrets'

export type UnlockMerchantWorkspaceDeps = {
	setProfiles: (val: profile[]) => void
	setAllNodes: (val: nodeInfo[]) => void
	setGossip: (val: boolean) => void
	gossip: boolean
	setBeamio: (val: beamio) => void
	setCharts: React.Dispatch<React.SetStateAction<string[]>>
	setMyAddress: (val: string) => void
	onProgress?: (step: number) => void
}

export async function unlockMerchantWorkspaceSession(
	temp: encrypt_keys_object,
	deps: UnlockMerchantWorkspaceDeps,
): Promise<boolean> {
	const {
		setProfiles,
		setAllNodes,
		setGossip,
		gossip,
		setBeamio,
		setCharts,
		setMyAddress,
		onProgress,
	} = deps

	const profiles = temp?.profiles
	if (!temp || !profiles?.length) return false

	if (!ingestSessionPrivateKeyFromProfiles(profiles)) return false
	markWorkspaceSessionUnlocked()
	const hydratedProfiles = hydrateProfilesWithSessionSecrets(profiles)
	temp.profiles = hydratedProfiles

	const USERINFO_POLL_MS = 1000
	const USERINFO_MAX_POLLS = 60
	const fallbackBeamio = temp.beamio?.accountName?.trim() ? temp.beamio : null

	const loadUserInfo = async (): Promise<beamio | null> => {
		if (fallbackBeamio) {
			const fresh = await getUserInfo(profiles[0].keyID).catch(() => null)
			if (fresh?.accountName?.trim()) return fresh
			return fallbackBeamio
		}
		for (let attempt = 0; attempt < USERINFO_MAX_POLLS; attempt++) {
			const userInfo = await getUserInfo(profiles[0].keyID).catch(() => null)
			if (userInfo?.accountName?.trim()) return userInfo
			if (attempt < USERINFO_MAX_POLLS - 1) {
				await new Promise((resolve) => setTimeout(resolve, USERINFO_POLL_MS))
			}
		}
		return null
	}

	const userInfo = await loadUserInfo()
	if (!userInfo?.accountName?.trim()) return false

	let bo: beamio = mergeLocalLocaleLanguageOntoChainProfile(userInfo, temp.beamio)
	bo.initialLoading = false
	temp.beamio = bo

	const pk = getSessionPrivateKeyArmor()?.trim() ?? profiles[0]?.privateKeyArmor?.trim()
	if (pk) {
		bo = await bootstrapProfileLocaleCurrencyIfUnset(bo, pk)
		temp.beamio = bo
	}

	try {
		const eoa0 = profiles[0]?.keyID?.trim()
		if (eoa0 && ethers.isAddress(eoa0)) {
			const r = await fetchTrustedCanonicalAaFromRpc(eoa0)
			if (r.trusted) {
				let nextProfiles = profiles
				let changed = false
				if (r.aa) {
					const chainAa = ethers.getAddress(r.aa)
					const cached = profiles[0].aaAccount?.trim()
					if (
						!cached ||
						!ethers.isAddress(cached) ||
						ethers.getAddress(cached).toLowerCase() !== chainAa.toLowerCase()
					) {
						nextProfiles = profiles.map((p, i) => (i === 0 ? { ...p, aaAccount: chainAa } : p))
						changed = true
					}
				} else {
					const cached = profiles[0].aaAccount?.trim()
					if (cached && ethers.isAddress(cached)) {
						const code = await conetDepinProvider.getCode(cached)
						if (!code || code === '0x' || code.length <= 2) {
							nextProfiles = profiles.map((p, i) => (i === 0 ? { ...p, aaAccount: undefined } : p))
							changed = true
						}
					}
				}
				if (changed) {
					temp.profiles = hydrateProfilesWithSessionSecrets(nextProfiles)
					setProfiles(temp.profiles)
				}
			}
		}
	} catch {
		/* keep last trusted */
	}

	try {
		const ensuredAa = await ensureConetAaForProfileAndPersist(temp.profiles[0], setProfiles)
		if (ensuredAa) {
			temp.profiles = hydrateProfilesWithSessionSecrets(
				(temp.profiles ?? []).map((p, i) => (i === 0 ? { ...p, aaAccount: ensuredAa } : p)),
			)
		}
	} catch {
		/* non-fatal */
	}

	setCoNET_Data(temp)
	setBeamio(bo)
	onProgress?.(2)

	await initChat(setProfiles, setAllNodes, setGossip, gossip, (message) => {
		setCharts((prev) => [...prev, message])
	})

	await storeSystemData()
	const finalProfiles = hydrateProfilesWithSessionSecrets(temp.profiles)
	temp.profiles = finalProfiles
	setCoNET_Data(temp)
	const eoa = finalProfiles[0]?.keyID?.trim()
	if (eoa && ethers.isAddress(eoa)) {
		setMyAddress(eoa)
	}
	setProfiles(finalProfiles)
	return true
}
