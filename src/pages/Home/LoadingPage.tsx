import React from "react";
import beamio_icon from '@/components/assets/32x32.svg'
import { useNavigate } from "react-router-dom"
// Simple mobile-style onboarding modal for Beamio
// TailwindCSS-based layout

type Props = {
	home: () => void
	// 可传入项目里的 t；若不传，使用组件内置的 t

}

export default function BeamioOnboardingModal({home}: Props) {
	const navigate = useNavigate()
	return (
		<div className="mt-10">
		{/* Phone frame background */}
		<div className="">
			{/* Status bar stub */}


			{/* Content */}
			<div className="flex flex-col h-[calc(100%-2.5rem)] px-5 pb-5">
			{/* Brand header */}
			<div className="flex items-center gap-2 mb-4 ml-4">
				
				<div className="flex flex-col">
				<img 
					src = {beamio_icon}
					className="w-12 h-12 object-contain"
				/>
				<span className="text-[10px] text-slate-400 uppercase tracking-[0.16em]">
					Onboarding
				</span>
				</div>
			</div>

			{/* Modal card */}
			<div className="mt-1 rounded-2xl bg-slate-50 border border-slate-100 p-4 flex flex-col gap-3 flex-1">
				{/* Icon */}
				<div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					className="w-5 h-5"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<rect x="3" y="5" width="18" height="14" rx="3" />
					<path d="M7 10h5" />
					<path d="M7 14h3" />
					<circle cx="17" cy="12" r="1.25" />
				</svg>
				</div>

				{/* Title & copy */}
				<div>
				<h1 className="text-lg font-semibold text-slate-900 mb-1">
					Your Beamio wallet is ready
				</h1>
				<p className="text-xs text-slate-600 leading-relaxed">
					We’ve created a <span className="font-medium">self-custodial USDC wallet on Base</span> for you.
					Only you control this wallet – Beamio can’t move your funds.
				</p>
				</div>

				{/* Bullets */}
				<ul className="mt-2 space-y-1.5 text-[11px] text-slate-600">
				<li className="flex items-start gap-2">
					<span className="mt-[2px] text-[10px] text-blue-500">•</span>
					<span>Built on <span className="font-medium">Base</span> for low-cost, gasless payments.</span>
				</li>
				<li className="flex items-start gap-2">
					<span className="mt-[2px] text-[10px] text-blue-500">•</span>
					<span><span className="font-medium">Non-custodial</span>: your USDC stays in your own wallet.</span>
				</li>
				<li className="flex items-start gap-2">
					<span className="mt-[2px] text-[10px] text-blue-500">•</span>
					<span>Supports <span className="font-medium">USDC on Base</span> today, more assets later.</span>
				</li>
				</ul>

				{/* Privacy note */}
				<div className="mt-2 rounded-xl bg-white border border-slate-100 px-3 py-2 flex items-start gap-2">
				<div className="mt-[2px] w-4 h-4 rounded-full border border-emerald-300 flex items-center justify-center text-[10px] text-emerald-600">
					✓
				</div>
				<p className="text-[10px] leading-snug text-slate-500">
					Beamio never takes custody of your funds. Payments go directly from your wallet to others on Base.
				</p>
				</div>

				{/* Spacer */}
				<div className="flex-1" />

				{/* Buttons */}
				<div className="mt-2 flex flex-col gap-2">
				<button 
					className="w-full h-10 rounded-full bg-blue-600 text-white text-sm font-medium shadow-sm active:translate-y-[1px]"
					onClick={() => 
						home()
					}
				>
					Start using Beamio
				</button>
				<button
					onClick={() => 
						navigate("/settings")
					}
					className="w-full h-9 rounded-full bg-transparent text-[11px] font-medium text-slate-500 border border-slate-200"
					>
						View wallet details
				</button>
				</div>
			</div>
			</div>
		</div>
		</div>
	)
}
