/**
 * Full list of My Brands (BeamioUserCard) — route `/myBrands` (deep link / direct nav).
 * Slide-in matches MyBrandsFullScreenDrawer + Recent Activity "View all".
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { MyBrandsListSection } from './MyBrandsListSection'

export default function MyBrandsPage() {
	const navigate = useNavigate()

	return (
		<motion.div
			className="min-h-[100dvh] bg-[#F2F2F7] pb-28 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
			initial={{ x: '100%' }}
			animate={{ x: 0 }}
			transition={{ type: 'spring', damping: 30, stiffness: 300 }}
		>
			<header className="fixed left-0 right-0 top-0 z-40 flex items-center gap-2 border-b border-slate-200/60 bg-slate-50/90 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-200/70 active:scale-95 dark:hover:bg-slate-800/80"
					aria-label="Back"
				>
					<ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
				</button>
				<h1 className="min-w-0 flex-1 pr-10 text-center text-base font-bold tracking-tight">My Brands</h1>
			</header>

			<main className="mx-auto max-w-2xl px-4 pb-8 pt-[calc(3.25rem+env(safe-area-inset-top))]">
				<MyBrandsListSection />
			</main>
		</motion.div>
	)
}
