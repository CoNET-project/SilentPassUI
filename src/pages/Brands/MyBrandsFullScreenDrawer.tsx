/**
 * Full-screen My Brands — same slide-from-right + scroll-fade back as Recent Activity "View all".
 */

import React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { CAPSULE_BTN_CLASS } from '@/utils/uiCommon'
import { MyBrandsListSection } from './MyBrandsListSection'

export function MyBrandsFullScreenDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { opacity: backBtnOpacity, onScroll: onDrawerScroll, setRef: setDrawerScrollRef } =
		useScrollCapsuleOpacity(open)

	return createPortal(
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-[#F2F2F7] dark:bg-slate-950"
					initial={{ x: '100%' }}
					animate={{ x: 0 }}
					exit={{ x: '100%' }}
					transition={{ type: 'spring', damping: 30, stiffness: 300 }}
				>
					<button
						type="button"
						onClick={onClose}
						className={`fixed left-4 z-10 ${CAPSULE_BTN_CLASS}`}
						style={{
							top: 'max(1rem, env(safe-area-inset-top))',
							opacity: backBtnOpacity,
							pointerEvents: backBtnOpacity < 0.05 ? 'none' : 'auto',
						}}
						aria-label="Back"
					>
						<ChevronLeft className="h-6 w-6 text-slate-900 dark:text-slate-100" strokeWidth={2.6} />
					</button>

					<div
						ref={setDrawerScrollRef}
						onScroll={onDrawerScroll}
						className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
					>
						<div className="shrink-0" style={{ minHeight: 'calc(env(safe-area-inset-top) + 5rem)' }} />
						<div className="mx-auto max-w-2xl">
							<h2 className="mb-4 text-base font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
								My Brands
							</h2>
							<MyBrandsListSection />
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body
	)
}
