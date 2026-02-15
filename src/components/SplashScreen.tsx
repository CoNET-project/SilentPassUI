import React from "react"

/** init 期间全屏居中显示 logo，等 init 完成后再显示具体页面 */
const SplashScreen: React.FC = () => (
	<div
		className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-slate-900"
		style={{
			paddingTop: 'env(safe-area-inset-top)',
			paddingBottom: 'env(safe-area-inset-bottom)',
			paddingLeft: 'env(safe-area-inset-left)',
			paddingRight: 'env(safe-area-inset-right)',
		}}
	>
		<img src={`${process.env.PUBLIC_URL || ''}/logo512.png`} alt="Beamio" className="w-32 h-32 object-contain" />
	</div>
)

export default SplashScreen
