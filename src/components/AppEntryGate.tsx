/**
 * 全应用入口门闸：本地未完成 Beamio 初始化（与 pages/Home/index 原逻辑一致）时，
 * 先 Splash + BeamioOnboardingModal，任意深层路由（/wallet、/Chat 等）均不可跳过。
 */
import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { checkStorageWithTimeout } from '@/services/beamio'
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
const EPHEMERAL_WALLET_TIMEOUT_MS = 8_000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((resolve) => {
			window.setTimeout(() => resolve(fallback), ms)
		}),
	])
}

export default function AppEntryGate() {
	const { setIsInitialLoading } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [requireWalletRecover, setRequireWalletRecover] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)
	// 门闸是否已判定「可进入主 App」。判定完成前绝不渲染 <Outlet/>（不依赖 Splash 遮挡）。
	const [gateDecided, setGateDecided] = useState(false)
	// 门闸已读到的本地存储快照（含超时降级结果），下传给 onboarding 弹窗避免二次读 IndexedDB 再次挂起。
	const [bootCoNETData, setBootCoNETData] = useState<encrypt_keys_object | null>(null)
	const [bootResolved, setBootResolved] = useState(false)
	// 任一终态（进入 App / onboarding / recover）已确定；用于 Splash 兜底时安全降级。
	const decisionMadeRef = useRef(false)

	const enterApp = () => {
		decisionMadeRef.current = true
		setGateDecided(true)
		setSplashVisible(false)
	}

	const goOnboarding = (needRecover: boolean) => {
		decisionMadeRef.current = true
		setBootResolved(true)
		setRequireWalletRecover(needRecover)
		setIsInitialLoading(true)
		setShowBeamioOnboardingModal(true)
	}

	const init = async () => {
		try {
			// checkStorage / ephemeral 读本地都加超时；私密模式挂起时按未注册处理。
			let CoNETData = await checkStorageWithTimeout()
			const provisioned = await withTimeout(
				ensureEphemeralWalletForCouponClaim().catch(() => null),
				EPHEMERAL_WALLET_TIMEOUT_MS,
				null,
			)
			if (provisioned) CoNETData = provisioned
			setBootCoNETData(CoNETData)

			const hasAccount = hasCompletedBeamioAccount(CoNETData)
			const needsRecover = consumerAppNeedsWalletRecover(CoNETData)
			const hasMnemonic = hasLocalPlaintextMnemonic(CoNETData)
			publishNativePwaLog(
				'info',
				`[AppEntryGate] storage hasAccount=${hasAccount} needsRecover=${needsRecover} hasMnemonic=${hasMnemonic}`,
			)
			if (hasAccount) {
				if (needsRecover) {
					// 设备上有账号但本地无明文助记词：必须 BeamioTag + 密码 recover，不可进主 App。
					goOnboarding(true)
					return
				}
				enterApp()
				return
			}
			// 未完成注册（无 profiles / EOA 非法 / 无 Beamio 账号名 / 本地读超时）必须走 onboarding。
			goOnboarding(false)
		} catch (err) {
			publishNativePwaLog(
				'error',
				`[AppEntryGate] init failed: ${err instanceof Error ? err.message : String(err)}`,
			)
			goOnboarding(false)
		}
	}

	useEffect(() => {
		const nativeShell = isCashTreesNativeWebView()
		const msg = `[PWA] AppEntryGate mounted nativeShell=${nativeShell}`
		console.log(msg, { nativeShell })
		publishNativePwaLog('info', msg)

		const splashTimer = window.setTimeout(() => {
			setSplashVisible(false)
			// 兜底：若到此仍未判定（如 IndexedDB 完全挂起），安全降级到 onboarding，
			// 而不是撤掉 Splash 暴露默认 /home（无 EOA 的 App 壳）。
			if (!decisionMadeRef.current) {
				publishNativePwaLog(
					'warn',
					`[AppEntryGate] splash force-dismiss after ${SPLASH_FORCE_DISMISS_MS}ms → fallback onboarding`,
				)
				goOnboarding(false)
			} else {
				publishNativePwaLog('warn', `[AppEntryGate] splash force-dismiss after ${SPLASH_FORCE_DISMISS_MS}ms`)
			}
		}, SPLASH_FORCE_DISMISS_MS)

		const onWalletReady = () => setSplashVisible(false)
		window.addEventListener(BEAMIO_WALLET_READY_EVENT, onWalletReady)

		void init()

		return () => {
			window.clearTimeout(splashTimer)
			window.removeEventListener(BEAMIO_WALLET_READY_EVENT, onWalletReady)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="flex h-full min-h-[100dvh] w-full flex-col">
			<EmbeddedPwaUpdateBanner />
			{splashVisible && <SplashScreen />}
			{showBeamioOnboardingModal ? (
				<BeamioOnboardingModal
					requireWalletRecover={requireWalletRecover}
					bootResolved={bootResolved}
					bootCoNETData={bootCoNETData}
					home={() => {
						setShowBeamioOnboardingModal(false)
						setRequireWalletRecover(false)
						setSplashVisible(false)
						setIsInitialLoading(false)
						// onboarding / recover 成功后允许进入主 App。
						setGateDecided(true)
					}}
					onInitComplete={() => setSplashVisible(false)}
				/>
			) : gateDecided ? (
				<div className="flex min-h-0 w-full flex-1 flex-col">
					<Outlet />
				</div>
			) : null}
		</div>
	)
}
