import { useEffect, useRef, useState } from "react";
import { ethers } from 'ethers'
import Home from './bizHome';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { checkStorageWithTimeout } from '@/services/beamio'
import SplashScreen from "@/components/SplashScreen"
import { isWorkspaceScreenLocked } from '@/utils/beamioWorkspaceLock'

/** Safari Private: IndexedDB/PouchDB may never resolve — force leave splash (align SilentPassUI AppEntryGate). */
const SPLASH_FORCE_DISMISS_MS = 12_000

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
	const { setIsInitialLoading } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)
	const [bootCoNETData, setBootCoNETData] = useState<encrypt_keys_object | null>(null)
	const [bootResolved, setBootResolved] = useState(false)
	const decisionMadeRef = useRef(false)

	const enterBizHome = () => {
		decisionMadeRef.current = true
		setShowBeamioOnboardingModal(false)
		setSplashVisible(false)
	}

	const goOnboarding = (data: encrypt_keys_object | null) => {
		decisionMadeRef.current = true
		setBootCoNETData(data)
		setBootResolved(true)
		setIsInitialLoading(true)
		setShowBeamioOnboardingModal(true)
		setSplashVisible(false)
	}

	const init = async () => {
		try {
			if (isWorkspaceScreenLocked()) {
				enterBizHome()
				return
			}
			const CoNETData = await checkStorageWithTimeout(undefined, false)
			setBootCoNETData(CoNETData)
			setBootResolved(true)
			// Existing merchant wallet on disk → biz gateway login (not create-wallet onboarding).
			if (profileHasExistingWallet(CoNETData) || (CoNETData && CoNETData?.beamio?.initialLoading)) {
				enterBizHome()
				return
			}
			goOnboarding(CoNETData)
		} catch (err) {
			console.warn(
				'[HomePage] init failed → onboarding',
				err instanceof Error ? err.message : String(err),
			)
			goOnboarding(null)
		}
	}

	useEffect(() => {
		const splashTimer = window.setTimeout(() => {
			setSplashVisible(false)
			if (!decisionMadeRef.current) {
				console.warn(
					`[HomePage] splash force-dismiss after ${SPLASH_FORCE_DISMISS_MS}ms → fallback onboarding`,
				)
				goOnboarding(null)
			}
		}, SPLASH_FORCE_DISMISS_MS)

		void init()

		return () => {
			window.clearTimeout(splashTimer)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="w-full h-full">
			{splashVisible && <SplashScreen />}
			{showBeamioOnboardingModal ? (
				<BeamioOnboardingModal
					bootResolved={bootResolved}
					bootCoNETData={bootCoNETData}
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
