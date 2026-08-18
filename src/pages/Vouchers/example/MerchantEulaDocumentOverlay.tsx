import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { getCurrentBeamioUiLocale, useTu } from '@/locale/beamioLocale'
import { getBeamioEulaDocument, type BeamioEulaVariant } from '@/utils/beamioEulaDocuments'
import { MerchantLegalDocumentView } from '@/pages/Vouchers/example/MerchantLegalDocumentPanel'

export function MerchantEulaDocumentOverlay({
	open,
	variant,
	onClose,
}: {
	open: boolean
	variant: BeamioEulaVariant
	onClose: () => void
}) {
	const { tu } = useTu()
	const locale = getCurrentBeamioUiLocale()
	const doc = getBeamioEulaDocument(variant, locale)
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)

	useEffect(() => {
		if (!open) {
			setIsEntered(false)
			setIsClosing(false)
			return
		}
		setIsClosing(false)
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [open])

	const close = useCallback(() => {
		if (isClosing) return
		setIsClosing(true)
		window.setTimeout(onClose, 300)
	}, [isClosing, onClose])

	if (!open) return null

	return (
		<div className="fixed inset-0 z-[80] font-sans">
			<button
				type="button"
				aria-label={tu('programs_common_close')}
				tabIndex={-1}
				className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
					isClosing || !isEntered ? 'opacity-0' : 'opacity-100'
				}`}
				onClick={close}
			/>
			<div
				className="absolute inset-y-0 right-0 flex h-full w-full max-w-2xl flex-col bg-[#f5f7f9] shadow-2xl transition-transform duration-300 ease-out"
				style={{
					transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
				}}
			>
				<div
					className="relative flex shrink-0 items-center justify-between px-4 py-3"
					style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
				>
					<button
						type="button"
						tabIndex={-1}
						aria-label="Cancel"
						onClick={close}
						className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white/90 text-[#2c2f31] shadow-[0_2px_10px_rgba(0,0,0,0.16),0_1px_3px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white active:scale-[0.96]"
					>
						<ChevronLeft className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
					</button>
					<p className="pointer-events-none absolute inset-x-12 truncate text-center text-sm font-semibold text-[#2c2f31]">
						{tu('eula')}
					</p>
					<span className="h-9 w-9 shrink-0" aria-hidden />
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-16 sm:px-6">
					<MerchantLegalDocumentView
						doc={doc}
						eyebrow={variant === 'us' ? tu('eula_variant_us') : tu('eula_variant_row')}
					/>
				</div>
			</div>
		</div>
	)
}
