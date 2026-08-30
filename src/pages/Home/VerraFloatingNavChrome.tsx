import { useTranslation } from 'react-i18next'
import { IpfsImg } from '@/components/IpfsImg'
import { BeamioLocalePicker } from '@/components/locale/BeamioLocalePicker'
import { ChevronLeft } from 'lucide-react'
import { tu } from '@/locale/beamioLocale'
import { applyBeamioUiLanguageFromProfile } from '@/locale/i18n'
import type { BeamioUiLocale } from '@/utils/beamioProfileLocaleCurrency'

const APP_LOGO_SRC = `${process.env.PUBLIC_URL ?? ''}/logo192.png`

const FLOATING_BACK_BTN: Record<'create' | 'restore', string> = {
	create:
		'border border-[#151c27]/10 bg-white/90 text-[#151c27] shadow-sm backdrop-blur-md hover:bg-white',
	restore:
		'border border-[#1a1c1f]/10 bg-[#f9f9fe]/92 text-[#1a1c1f] shadow-sm backdrop-blur-md hover:bg-[#f9f9fe]',
}

/** Create: Back · Beamio · locale. Restore: Back · app logo (no center title bar). */
export function VerraFloatingNavChrome({
	onBack,
	tone = 'create',
	compact = false,
}: {
	onBack: () => void
	tone?: 'create' | 'restore'
	compact?: boolean
}) {
	const { i18n } = useTranslation()
	const locale = (i18n.language === 'en' ? 'en' : 'zh-CN') as BeamioUiLocale

	if (tone === 'create') {
		return (
			<header
				className={[
					'pointer-events-none fixed inset-x-0 top-0 z-50 flex h-16 w-full items-center justify-between bg-[#f9f9ff]/80 px-6 backdrop-blur-xl',
					'pt-[env(safe-area-inset-top)]',
					compact ? 'h-14' : 'h-16',
				].join(' ')}
				style={{ height: `calc(${compact ? '3.5rem' : '4rem'} + env(safe-area-inset-top, 0px))` }}
			>
				<button
					type="button"
					onClick={onBack}
					tabIndex={-1}
					className={[
						'pointer-events-auto shrink-0 rounded-full transition-opacity hover:opacity-80 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35',
						compact ? 'flex h-9 w-9 items-center justify-center' : 'flex h-10 w-10 items-center justify-center',
						FLOATING_BACK_BTN.create,
					].join(' ')}
					aria-label={tu('back')}
				>
					<ChevronLeft className={compact ? 'h-5 w-5' : 'h-6 w-6'} strokeWidth={2} aria-hidden />
				</button>
				<div
					className={[
						'pointer-events-none absolute inset-x-16 flex items-center justify-center font-bold tracking-tight text-[#151c27]',
						compact ? 'text-[20px] leading-7' : 'text-[22px] leading-7',
					].join(' ')}
					style={{ top: 'env(safe-area-inset-top, 0px)', bottom: 0 }}
				>
					Beamio
				</div>
				<div className="pointer-events-auto shrink-0">
					<BeamioLocalePicker
						variant="create"
						menuAlign="right"
						locale={locale}
						onSelect={async (next) => {
							await applyBeamioUiLanguageFromProfile(next)
						}}
					/>
				</div>
			</header>
		)
	}

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
				tabIndex={-1}
				className={[
					'pointer-events-auto shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3]/35',
					compact ? 'flex h-9 w-9 items-center justify-center' : 'flex h-10 w-10 items-center justify-center',
					FLOATING_BACK_BTN.restore,
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
