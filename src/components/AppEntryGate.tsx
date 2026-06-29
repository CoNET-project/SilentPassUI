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
	hasLocalPlaintextMnemonic,
} from '@/utils/consumerWalletGate'
import { ensureEphemeralWalletForCouponClaim } from '@/utils/ephemeralCouponClaimWallet'
import { BEAMIO_WALLET_READY_EVENT } from '@/utils/beamioWalletReadyEvent'

const SPLASH_FORCE_DISMISS_MS = 12_000

export default function AppEntryGate() {
	const { setIsInitialLoading } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [requireWalletRecover, setRequireWalletRecover] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)

	const init = async () => {
		try {
			let CoNETData = await checkStorage()
			const provisioned = await ensureEphemeralWalletForCouponClaim()
			if (provisioned) CoNETData = provisioned

			const hasAccount = hasCompletedBeamioAccount(CoNETData)
			const needsRecover = consumerAppNeedsWalletRecover(CoNETData)
			const hasMnemonic = hasLocalPlaintextMnemonic(CoNETData)
			publishNativePwaLog(
				'info',
				`[AppEntryGate] storage hasAccount=${hasAccount} needsRecover=${needsRecover} hasMnemonic=${hasMnemonic}`,
			)
			if (hasAccount) {
				if (consumerAppNeedsWalletRecover(CoNETData)) {
					setRequireWalletRecover(true)
					setIsInitialLoading(true)
					setShowBeamioOnboardingModal(true)
					return
				}
				return
			}
			// 未完成注册（无 profiles / EOA 非法 / 无 Beamio 账号名）必须走 onboarding。
			setRequireWalletRecover(false)
			setIsInitialLoading(true)
			setShowBeamioOnboardingModal(true)
		} catch (err) {
			publishNativePwaLog(
				'error',
				`[AppEntryGate] init failed: ${err instanceof Error ? err.message : String(err)}`,
			)
			setRequireWalletRecover(false)
			setIsInitialLoading(true)
			setShowBeamioOnboardingModal(true)
		} finally {
			// 始终关闭 Splash：Firefox 等浏览器上 IndexedDB 偶发慢/挂起时，避免 #000414 全屏一直盖住主界面。
			setSplashVisible(false)
		}
	}

	useEffect(() => {
		const nativeShell = isCashTreesNativeWebView()
		const msg = `[PWA] AppEntryGate mounted nativeShell=${nativeShell}`
		console.log(msg, { nativeShell })
		publishNativePwaLog('info', msg)

		const splashTimer = window.setTimeout(() => {
			setSplashVisible(false)
			publishNativePwaLog('warn', `[AppEntryGate] splash force-dismiss after ${SPLASH_FORCE_DISMISS_MS}ms`)
		}, SPLASH_FORCE_DISMISS_MS)

		const onWalletReady = () => setSplashVisible(false)
		window.addEventListener(BEAMIO_WALLET_READY_EVENT, onWalletReady)

		void init()

		return () => {
			window.clearTimeout(splashTimer)
			window.removeEventListener(BEAMIO_WALLET_READY_EVENT, onWalletReady)
		}
	}, [])

	return (
		<div className="flex h-full min-h-[100dvh] w-full flex-col">
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
