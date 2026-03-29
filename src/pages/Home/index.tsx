import { useEffect, useState } from "react";
import Home from '../../components/Home/Home';
import BeamioOnboardingModal from './LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { checkStorage, isStandalone } from '@/services/beamio'
import SplashScreen from "@/components/SplashScreen"
import InstallTerminalSheet, { getInstallTerminalSeen } from '@/components/InstallTerminalSheet'
import { refreshManifestThen } from '@/utils/updateManifestStartUrl'

/** CashTrees onboarding + shell brand primary（与 LoadingPage / RecoveryQRScreen / Home 对齐） */
export const SILENTPASS_BRAND_PRIMARY = '#1562f0' as const

const HomePage = ({}) => {
	const { isInitialLoading, setIsInitialLoading, setBeamio, setProfiles } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)
	const [showInstallSheet, setShowInstallSheet] = useState(false)
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

	// 首次进入 Home 时显示 Install Web App 引导（非 PWA、未见过）
	useEffect(() => {
		if (showBeamioOnboardingModal || splashVisible) return
		if (isStandalone || getInstallTerminalSeen()) return
		const t = setTimeout(() => {
			refreshManifestThen(() => setShowInstallSheet(true))
		}, 600)
		return () => clearTimeout(t)
	}, [showBeamioOnboardingModal, splashVisible])
	
	const beamioTag = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('beamioTag') || '') : ''

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
			{/* 首次进入 Home 时显示 Install Web App，引导添加到主屏幕 */}
			<InstallTerminalSheet
				open={showInstallSheet && !isStandalone}
				onClose={() => setShowInstallSheet(false)}
				onRemindLater={() => setShowInstallSheet(false)}
				beamioTag={beamioTag}
			/>
		</div>
	)
}

export default HomePage

