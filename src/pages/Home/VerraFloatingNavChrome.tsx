import { ChevronLeft } from 'lucide-react'
import { VerraBrandLockup } from '@/components/branding/VerraBrandLockup'

const FLOATING_BACK_BTN: Record<'create' | 'restore', string> = {
	create:
		'border border-[#1a1c1f]/10 bg-[#f3f3f8]/92 text-[#1a1c1f] shadow-sm backdrop-blur-md hover:bg-[#f3f3f8]',
	restore:
		'border border-[#1a1c1f]/10 bg-[#f9f9fe]/92 text-[#1a1c1f] shadow-sm backdrop-blur-md hover:bg-[#f9f9fe]',
}

/** 无整宽顶栏：左侧浮动返回，右侧 Verra 品牌，与页面底色一致 */
export function VerraFloatingNavChrome({
	onBack,
	tone = 'create',
}: {
	onBack: () => void
	tone?: 'create' | 'restore'
}) {
	return (
		<div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
			<button
				type="button"
				onClick={onBack}
				className={[
					'pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35',
					FLOATING_BACK_BTN[tone],
				].join(' ')}
				aria-label="Back"
			>
				<ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden />
			</button>
			<VerraBrandLockup variant="onLight" size="standard" className="pointer-events-none shrink-0 pt-0.5" />
		</div>
	)
}
