/**
 * 全应用入口门闸：本地未完成 Beamio 初始化（与 pages/Home/index 原逻辑一致）时，
 * 先 Splash + BeamioOnboardingModal，任意深层路由（/wallet、/Chat 等）均不可跳过。
 */
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { ethers } from 'ethers'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { checkStorage } from '@/services/beamio'
import SplashScreen from '@/components/SplashScreen'
import BeamioOnboardingModal from '@/pages/Home/LoadingPage'

/** 判定本地存储是否为"已完成注册的可用账号"。
 * 必须同时满足：
 *  1) profiles[0].keyID 是合法 EOA 地址（避免 IndexedDB 删除后 Cache Storage 兜底
 *     残留的不完整 profiles 让用户以"空 EOA"进入 App）；
 *  2) beamio.accountName 非空（Beamio 账号已在 CreateUsernamePinScreen 流程中
 *     创建并由 init 写回 storage）。
 *
 * 不能仅依赖 `beamio.initialLoading`：那是 AppShell.init 运行时设置的标记，
 * 在 CONET RPC 暂时失败 / 历史数据缺失时可能不存在，但账号本身仍是合法的。 */
const hasCompletedAccount = (data: encrypt_keys_object | null | undefined): boolean => {
	if (!data) return false
	const eoa = data.profiles?.[0]?.keyID
	if (!eoa || !ethers.isAddress(eoa)) return false
	const accountName = data.beamio?.accountName
	if (!accountName || typeof accountName !== 'string' || !accountName.trim()) return false
	return true
}

export default function AppEntryGate() {
	const { setIsInitialLoading } = useDaemonContext()
	const [showBeamioOnboardingModal, setShowBeamioOnboardingModal] = useState(false)
	const [splashVisible, setSplashVisible] = useState(true)

	const init = async () => {
		const CoNETData: encrypt_keys_object = await checkStorage()
		if (hasCompletedAccount(CoNETData)) {
			setSplashVisible(false)
			return
		}
		// 未完成注册（无 profiles / EOA 非法 / 无 Beamio 账号名）必须走 onboarding；
		// 同时立即关闭 splash，避免 modal 内部 init 卡住时 splash 一直遮挡。
		setIsInitialLoading(true)
		setShowBeamioOnboardingModal(true)
		setSplashVisible(false)
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
