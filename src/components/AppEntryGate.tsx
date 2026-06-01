/**
 * 全应用入口门闸：本地未完成 Beamio 初始化（与 pages/Home/index 原逻辑一致）时，
 * 先 Splash + BeamioOnboardingModal，任意深层路由（/wallet、/Chat 等）均不可跳过。
 */
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { checkStorage } from '@/services/beamio'
import SplashScreen from '@/components/SplashScreen'
import { EmbeddedPwaUpdateBanner } from '@/components/EmbeddedPwaUpdateBanner'
import BeamioOnboardingModal from '@/pages/Home/LoadingPage'
import { isCashTreesNativeWebView } from '@/utils/cashTreesNativeNfc'
import { publishNativePwaLog } from '@/utils/cashTreesNativePwaLog'
import {
	consumerAppNeedsWalletRecover,
	hasCompletedBeamioAccount,
} from '@/utils/consumerWalletGate'

export default function AppEntryGate() {
	const { setIsInitialLoading } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [requireWalletRecover, setRequireWalletRecover] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)

	const init = async () => {
		const CoNETData = await checkStorage()
		if (hasCompletedBeamioAccount(CoNETData)) {
			if (consumerAppNeedsWalletRecover(CoNETData)) {
				setRequireWalletRecover(true)
				setIsInitialLoading(true)
				setShowBeamioOnboardingModal(true)
				setSplashVisible(false)
				return
			}
			setSplashVisible(false)
			return
		}
		// 未完成注册（无 profiles / EOA 非法 / 无 Beamio 账号名）必须走 onboarding；
		// 同时立即关闭 splash，避免 modal 内部 init 卡住时 splash 一直遮挡。
		setRequireWalletRecover(false)
		setIsInitialLoading(true)
		setShowBeamioOnboardingModal(true)
		setSplashVisible(false)
	}

	useEffect(() => {
		const nativeShell = isCashTreesNativeWebView()
		const msg = `[PWA] AppEntryGate mounted nativeShell=${nativeShell}`
		console.log(msg, { nativeShell })
		publishNativePwaLog('info', msg)
		void init()
	}, [])

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<EmbeddedPwaUpdateBanner />
			{splashVisible && <SplashScreen />}
			{showBeamioOnboardingModal ? (
				<BeamioOnboardingModal
					requireWalletRecover={requireWalletRecover}
					home={() => {
						setShowBeamioOnboardingModal(false)
						setRequireWalletRecover(false)
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
