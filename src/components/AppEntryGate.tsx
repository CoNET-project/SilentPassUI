/**
 * 全应用入口门闸：本地未完成 Beamio 初始化（与 pages/Home/index 原逻辑一致）时，
 * 先 Splash + BeamioOnboardingModal，任意深层路由（/wallet、/Chat 等）均不可跳过。
 */
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { checkStorage } from '@/services/beamio'
import SplashScreen from '@/components/SplashScreen'
import BeamioOnboardingModal from '@/pages/Home/LoadingPage'

export default function AppEntryGate() {
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
		void init()
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
					<Outlet />
				</div>
			)}
		</div>
	)
}
