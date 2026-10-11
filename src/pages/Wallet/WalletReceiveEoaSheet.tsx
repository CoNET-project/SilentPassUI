import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import ReceiveFundsPanel from '@/components/ReceiveFundsPanel'

/**
 * /wallet Receive Funds — shared Base USDC receive panel (Wallet QR | Request amount).
 */
export default function WalletReceiveEoaSheet({
	eoa,
	open,
	onClose,
	setShowFooter,
}: {
	eoa: string
	open: boolean
	onClose: () => void
	setShowFooter: (show: boolean) => void
}) {
	useEffect(() => {
		if (!open) return
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [open, setShowFooter])

	const close = useCallback(() => {
		onClose()
	}, [onClose])

	return createPortal(
		<AnimatePresence>
			{open ? (
				<>
					<motion.div
						key="wallet-receive-eoa-backdrop"
						className="fixed inset-0 z-[10020] bg-black/40 backdrop-blur-md dark:bg-black/50"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						role="button"
						tabIndex={-1}
						aria-label="Close"
						onClick={close}
					/>
					<motion.div
						key="wallet-receive-eoa-sheet"
						role="dialog"
						aria-modal="true"
						aria-labelledby="wallet-receive-eoa-title"
						className="fixed bottom-0 left-0 right-0 z-[10021] flex max-h-[92dvh] flex-col items-center overflow-hidden overscroll-contain rounded-t-2xl bg-white pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-[0_-20px_50px_rgba(0,0,0,0.14)] dark:bg-slate-900"
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 32, stiffness: 320 }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-hidden">
							<div className="flex shrink-0 justify-center px-5 pb-3 pt-2">
								<div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-600" />
							</div>
							<span id="wallet-receive-eoa-title" className="sr-only">
								Receive USDC
							</span>
							<ReceiveFundsPanel eoa={eoa} onBack={close} initialMode="request-amount" />
						</div>
					</motion.div>
				</>
			) : null}
		</AnimatePresence>,
		document.body,
	)
}
