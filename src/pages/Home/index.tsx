import { useEffect, useState } from "react";
import Home from './bizHome';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { checkStorage, isStandalone } from '@/services/beamio'
import SplashScreen from "@/components/SplashScreen"
import { isWorkspaceScreenLocked } from '@/utils/beamioWorkspaceLock'

const HomePage = ({}) => {
	const { isInitialLoading, setIsInitialLoading, setBeamio, setProfiles, beamio } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)
	const [showInstallSheet, setShowInstallSheet] = useState(false)
	const init = async () => {
		if (isWorkspaceScreenLocked()) {
			setSplashVisible(false)
			setShowBeamioOnboardingModal(false)
			return
		}
		const CoNETData: encrypt_keys_object = await checkStorage(false)
		if (CoNETData && CoNETData?.beamio?.initialLoading) {
			setSplashVisible(false)
			return
		}
		
		setIsInitialLoading(true)
		setShowBeamioOnboardingModal(true)
		setSplashVisible(false) // Hide splash so BeamioOnboardingModal (Create/Restore) is visible
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

