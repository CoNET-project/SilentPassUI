import React from "react"

declare global {
	interface Window {
		CashTreesIOS?: unknown
	}
}

const isEmbeddedNativeWebView = () => {
	if (typeof window === "undefined") return false
	if (window.CashTreesIOS) return true
	const webkitBridge = (window as Window & {
		webkit?: {
			messageHandlers?: Record<string, unknown>
		}
	}).webkit
	return !!webkitBridge?.messageHandlers?.CashTreesIOS
}

/** init 期间全屏居中显示 logo，等 init 完成后再显示具体页面 */
const SplashScreen: React.FC = () => {
	const hideLogo = isEmbeddedNativeWebView()

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-slate-900"
			style={{
				backgroundColor: '#000414',
				paddingTop: 'env(safe-area-inset-top)',
				paddingBottom: 'env(safe-area-inset-bottom)',
				paddingLeft: 'env(safe-area-inset-left)',
				paddingRight: 'env(safe-area-inset-right)',
			}}
		>
			{hideLogo ? (
				<div className="flex items-center justify-center">
					<div className="relative flex h-12 w-12 items-center justify-center">
						<div className="absolute inset-0 rounded-full bg-[#1562f0]/15 blur-md" />
						<div className="h-10 w-10 rounded-full border-2 border-[#1b2744] border-t-[#1562f0] animate-spin" />
					</div>
				</div>
			) : (
				<img
					src={`${process.env.PUBLIC_URL || ''}/beamio-launch.png`}
					alt="Beamio"
					className="w-32 h-32 object-contain"
				/>
			)}
		</div>
	)
}

export default SplashScreen
