import { useEffect, useState } from "react";
import Home from '../../components/Home/Home';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { checkStorage } from '@/services/beamio'
import SplashScreen from "@/components/SplashScreen"

/** CashTrees onboarding + shell brand primary（与 LoadingPage / RecoveryQRScreen / Home 对齐） */
export const SILENTPASS_BRAND_PRIMARY = '#1562f0' as const

const HomePage = ({}) => {
	const { setIsInitialLoading } = useDaemonContext()
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

	useEffect(() => {
		init()
  	}, [])
	
	return (
		<div className="flex min-h-0 h-full w-full flex-col">
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
				<div className="flex min-h-0 w-full flex-1 flex-col">
					<Home />
				</div>
			)}
		</div>
	)
}

export default HomePage
