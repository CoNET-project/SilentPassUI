import { useEffect, useRef, useState } from "react";
import Home from '../../components/Home/Home';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {storeSystemData, MobileType, checkStorage} from '@/services/beamio'
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import SplashScreen from "@/components/SplashScreen"

const HomePage = ({}) => {
	const { isInitialLoading, setIsInitialLoading, setBeamio, setProfiles } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)
	const init = async () => {
		const CoNETData: encrypt_keys_object = await checkStorage()
		if (CoNETData && CoNETData?.beamio?.initialLoading) {
			setSplashVisible(false)
			return
		}
		setIsInitialLoading(true)
		setShowBeamioOnboardingModal(true)
	}

	const storageInit = async () => {
		setSplashVisible(false)
		setShowBeamioOnboardingModal(false)
		setIsInitialLoading(false)
		const temp = CoNET_Data
		if (!temp) {
			return
		}
		setBeamio(temp.beamio)
		setProfiles(temp.profiles)
		if (MobileType() === 'android') {
			window.close()
			window.open(window.location.href, '_blank', 'noopener,noreferrer')
		}
		
		
	}

	useEffect(() => {
		init()
  	}, [])
	
	return (
		<div className="w-full h-full">
			{splashVisible && <SplashScreen />}
			{showBeamioOnboardingModal ? (
				<BeamioOnboardingModal
					home={() => storageInit()}
					onInitComplete={() => setSplashVisible(false)}
				/>
			) : (
				<Home />
			)}
		</div>
	)
}

export default HomePage

