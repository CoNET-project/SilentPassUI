import React from "react"
import { BIZ_PUBLIC_LOGO512 } from "@/pages/Home/brandUi"

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
		<img src={BIZ_PUBLIC_LOGO512} alt="" className="h-32 w-32 object-contain" />
	</div>
)

export default SplashScreen
