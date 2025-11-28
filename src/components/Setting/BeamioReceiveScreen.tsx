import React, {useEffect, useState} from "react";
import { useDaemonContext } from '@/providers/DaemonProvider'
import bIcon from '@/components/assets/32x32.svg'
import { QRCodeCanvas } from "qrcode.react"
import CopyButton from '@/components/button/CopyButton'
import {formatAmountReadable, formatWithThousands, estimateGasUSDC, generateCODE, getBalance, AuthorizationSign} from '@/services/beamio'
// Beamio Receive screen: show wallet address & QR to receive USDC on Base
// This is a standalone "Receive" UI, separate from the Payments (Send / Request / Check) screen.

type prof = {
	colse: () => void
}

export default function BeamioReceiveScreen() {
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles } = useDaemonContext()
		const [walletAddress, setWalletAddress] = useState<string>('')
		const [usdcAmount, setUsdcAmount] = useState(0)
		const [usdcToUSD, setUsdcToUSD] = useState(0)

		const getBa = async () => {
			const temp = profiles?.[0]
	
			if (!temp?.keyID) return
	
			setWalletAddress(temp.keyID)
			const _ba = await getBalance(temp.keyID)
			if (!_ba) return
			const ba = _ba
			const eth = Number(ba.eth)
			const ethUsd = eth * Number(ba.oracle.eth.eth)
	
			const usdc = Number(ba.usdc)
			setUsdcAmount(usdc)
			const usdcToUSD = usdc * Number(ba.oracle.eth.usdc)
			setUsdcToUSD(usdcToUSD)
		}
	useEffect(() => {
		getBa()
		
	}, [])
  return (
		<div className="mt-12">
			{/* Content wrapper */}
			<div
				className="
				flex flex-col
				h-[calc(100%-2.5rem)]
				px-5 pb-5
				md:px-8 md:pb-6
				"
			>
				{/* Header */}
				<div
					className="
						flex items-center justify-between mb-4
						md:mb-6
					"
				>
					<div className="flex flex-col">
						<span
							className="
								text-[10px] uppercase tracking-[0.16em]
								text-slate-400 dark:text-slate-500
								md:text-[11px]
							"
						>
							Beamio
						</span>
						<h1
							className="
								text-sm font-semibold
								text-slate-900 dark:text-slate-50
								md:text-base
							"
						>
							Receive
						</h1>
					</div>

					<div className="flex flex-col items-end">
						<span
							className="
								text-[10px] uppercase tracking-[0.16em]
								text-slate-400 dark:text-slate-500
								md:text-[11px]
							"
						>
							USDC on Base
						</span>
						<span
							className="
								text-[11px] font-medium
								text-slate-900 dark:text-slate-50
								md:text-[12px]
							"
						>
							Only send on Base
						</span>
					</div>
				</div>

				{/* Intro text */}
				<p
					className="
						text-[11px] text-slate-500 dark:text-slate-400
						mb-3 leading-relaxed
						md:text-[12px] md:leading-normal md:mb-4
					"
				>
					Show your Beamio address or QR code to receive USDC on Base. This wallet is
					self-custodial – funds go directly to you.
				</p>

				{/* QR + address card */}
				<div
					className="
						mb-4 rounded-3xl
						border border-slate-200 dark:border-slate-700
						bg-slate-50 dark:bg-slate-900/40
						px-4 py-4 flex flex-col items-center
						md:px-6 md:py-6
					"
				>
				{/* QR placeholder / QR 实图可以替换这里 */}
					<div
						className="
						w-40 h-40 rounded-2xl
						bg-slate-200 dark:bg-slate-700
						flex items-center justify-center mb-3
						md:w-48 md:h-48 md:rounded-3xl
						"
					>
						<QRCodeCanvas
							value={walletAddress}
							size={160}
							level="H"
							includeMargin
							bgColor="transparent"
							fgColor="#000000"
							imageSettings={{
							src: bIcon,
							height: 40,
							width: 40,
							excavate: true,
							}}
							className="rounded-lg inline-block"
						/>
					</div>

					{/* Address */}
					<div className="w-full mb-2 md:mb-3">
						<span
						className="
							block text-[10px]
							text-slate-500 dark:text-slate-400
							mb-1 md:text-[11px]
						"
						>
							Your Beamio address
						</span>

						<div
						className="
							w-full flex items-center justify-between
							rounded-2xl
							border border-slate-200 dark:border-slate-700
							bg-white dark:bg-slate-900
							px-3 py-2
							md:px-4 md:py-3
						"
						>
						<span
							className="
							text-[11px] md:text-[12px]
							font-mono
							text-slate-900 dark:text-slate-50
							truncate
							"
						>
							{walletAddress}
						</span>

						<CopyButton value={walletAddress} />
						</div>
					</div>

					{/* Buttons */}
					{/* <div
						className="
						w-full flex gap-2 mt-2 text-[11px]
						md:text-[12px] md:gap-3
						"
					>
						
						<button
						className="
							flex-1 h-9 md:h-10
							rounded-full
							bg-slate-900 text-slate-50
							font-medium shadow-sm
							active:translate-y-[1px]
						"
						>
							Share address
						</button>

					
						<button
						className="
							flex-1 h-9 md:h-10
							rounded-full
							border border-slate-300 dark:border-slate-600
							bg-white dark:bg-slate-900
							text-slate-700 dark:text-slate-200
							font-medium
							active:translate-y-[1px]
						"
						>
							Save QR
						</button>
					</div> */}

					{/* Small hint */}
					<p
						className="
						mt-3 md:mt-4
						text-[10px] md:text-[11px]
						text-slate-500 dark:text-slate-400
						text-center leading-relaxed
						"
					>
						Only send <span className="font-medium">USDC on Base</span> to this address.
						Sending any other assets may result in loss of funds.
					</p>
					</div>

					{/* Safety / info card */}
					<div
						className="
							mt-auto rounded-2xl
							border border-emerald-100 dark:border-emerald-500/40
							bg-emerald-50 dark:bg-emerald-900/30
							px-3 py-2 md:px-4 md:py-3
							text-[10px] md:text-[11px]
							text-emerald-700 dark:text-emerald-200
						"
					>
						<p className="font-medium mb-1 md:mb-2">
							Beamio never takes custody of your funds.
						</p>
						<p>
							Payments go directly from other wallets to your Beamio wallet on Base. You keep
							full control of your keys.
						</p>
					</div>
			</div>
		</div>

	);
}
