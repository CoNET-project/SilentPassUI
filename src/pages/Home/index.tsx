import { useEffect, useState } from "react";
import { ethers } from 'ethers'
import Home from './bizHome';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { checkStorage, isStandalone } from '@/services/beamio'
import SplashScreen from "@/components/SplashScreen"
import { isWorkspaceScreenLocked } from '@/utils/beamioWorkspaceLock'

function ensureFlatProfiles(p: unknown): profile[] {
	if (!p || !Array.isArray(p)) return []
	if (p.length === 0) return []
	const first = (p as unknown[])[0]
	if (Array.isArray(first)) return (p as profile[][]).flat()
	return p as profile[]
}

function profileHasExistingWallet(data: encrypt_keys_object | null): boolean {
	const flat = ensureFlatProfiles(data?.profiles)
	const keyId = flat[0]?.keyID?.trim()
	return Boolean(keyId && ethers.isAddress(keyId))
}

const HomePage = ({}) => {
	const { isInitialLoading, setIsInitialLoading, setBeamio, setProfiles, beamio } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)
	const [showInstallSheet, setShowInstallSheet] = useState(false)
	const init = async () => {
		try {
			if (isWorkspaceScreenLocked()) {
				setShowBeamioOnboardingModal(false)
				return
			}
			const CoNETData: encrypt_keys_object | null = await checkStorage(false)
			// Existing merchant wallet on disk → biz gateway login (not create-wallet onboarding).
			if (profileHasExistingWallet(CoNETData) || (CoNETData && CoNETData?.beamio?.initialLoading)) {
				setShowBeamioOnboardingModal(false)
				return
			}

			setIsInitialLoading(true)
			setShowBeamioOnboardingModal(true)
		} finally {
			setSplashVisible(false)
		}
	}

	useEffect(() => {
		init()
  	}, [])

	
	const beamioTag = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('beamioTag') || '') : ''

	return (
		<div className="w-full h-full">
			{splashVisible && <SplashScreen />}
			{showBeamioOnboardingModal ? (
				<BeamioOnboardingModal
					home={() => {
						setShowBeamioOnboardingModal(false)
						setSplashVisible(false)
						setIsInitialLoading(false)
					}}
					onInitComplete={() => setSplashVisible(false)}
				/>
			) : (
				<Home />
			)}

		</div>
	)
}

export default HomePage

