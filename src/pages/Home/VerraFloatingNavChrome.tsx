import { IpfsImg } from '@/components/IpfsImg';
import { ChevronLeft } from 'lucide-react'
import { tu } from '@/locale/beamioLocale'

const APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`

const FLOATING_BACK_BTN: Record<'create' | 'restore', string> = {
	create:
		'border border-[#1a1c1f]/10 bg-[#f3f3f8]/92 text-[#1a1c1f] shadow-sm backdrop-blur-md hover:bg-[#f3f3f8]',
	restore:
		'border border-[#1a1c1f]/10 bg-[#f9f9fe]/92 text-[#1a1c1f] shadow-sm backdrop-blur-md hover:bg-[#f9f9fe]',
}

/** 无整宽顶栏：左侧浮动返回，右侧仅显示 app icon。 */
export function VerraFloatingNavChrome({
	onBack,
	tone = 'create',
	compact = false,
}: {
	onBack: () => void
	tone?: 'create' | 'restore'
	compact?: boolean
}) {
	return (
		<div
			className={[
				'pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between gap-3 px-4 sm:px-6',
				compact ? 'pt-[max(0.5rem,env(safe-area-inset-top))]' : 'pt-[max(0.75rem,env(safe-area-inset-top))]',
			].join(' ')}
		>
			<button
				type="button"
				onClick={onBack}
				className={[
					'pointer-events-auto shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35',
					compact ? 'flex h-9 w-9 items-center justify-center' : 'flex h-10 w-10 items-center justify-center',
					FLOATING_BACK_BTN[tone],
				].join(' ')}
				aria-label={tu('back')}
			>
				<ChevronLeft className={compact ? 'h-5 w-5' : 'h-6 w-6'} strokeWidth={2} aria-hidden />
			</button>
			<IpfsImg
				src={APP_LOGO_SRC}
				alt="Beamio"
				className={[
					'pointer-events-none shrink-0 object-contain',
					compact ? 'h-8 w-8 rounded-[9px]' : 'h-9 w-9 rounded-[10px]',
				].join(' ')}
				draggable={false}
			/>
		</div>
	)
}
