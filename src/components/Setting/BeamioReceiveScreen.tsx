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
const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
export default function BeamioReceiveScreen() {
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles } = useDaemonContext()
		const [walletAddress, setWalletAddress] = useState<string>('')
		const [account, setAccount ] = useState(beamio?.accountName)
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
					{/* Beamio @account */}
					<div className="text-center mb-2">
						<p className="text-[13px] font-medium text-slate-900 dark:text-slate-100">
							Beamio
						</p>

						<p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
							@{account}
						</p>
					</div>

					{/* QR Code */}
					<div
					className="
						w-40 h-40 rounded-2xl
						bg-slate-200 dark:bg-slate-700
						flex items-center justify-center mb-1
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
					{/* Beamio @account - horizontal */}
					<div className="flex items-center justify-center mt-0.5 mb-6">
					
						<span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
							{fmtAddr(walletAddress)}
						</span>
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

				{/* 2) Receive by redeeming a Cashcode */}
					<section className="rounded-3xl bg-white border border-slate-100 shadow-sm px-4 pt-4 pb-5">
					<div className="flex items-center justify-between mb-3">
						<div className="flex flex-col">
						<span className="text-xs font-medium text-slate-700">Redeem a Cashcode</span>
						<span className="text-[10px] text-slate-400">One-time digital check into this wallet</span>
						</div>
					</div>

					{/* Cashcode input */}
					<div className="flex flex-col gap-2">
						<label className="text-[11px] text-slate-500" htmlFor="cashcode-input">
						Cashcode
						</label>
						<div className="flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-2">
						<input
							id="cashcode-input"
							type="text"
							placeholder="Paste or type your Beamio Cashcode"
							className="flex-1 bg-transparent text-[11px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
						/>
						<button className="text-[11px] font-medium text-blue-600 hover:text-blue-700">Paste</button>
						</div>
					</div>

					{/* Security code input */}
					<div className="flex flex-col gap-2 mt-3">
						<div className="flex items-baseline justify-between">
						<label className="text-[11px] text-slate-500" htmlFor="security-code-input-1">
							Security code (optional)
						</label>
						<span className="text-[10px] text-slate-400">3-3 digits (if required)</span>
						</div>
						<div className="flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-2">
						<input
							id="security-code-input-1"
							type="text"
							inputMode="numeric"
							maxLength={3}
							placeholder="123"
							className="w-14 text-center bg-transparent text-[13px] font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none"
						/>
						<span className="text-[12px] text-slate-400">-</span>
						<input
							id="security-code-input-2"
							type="text"
							inputMode="numeric"
							maxLength={3}
							placeholder="456"
							className="w-14 text-center bg-transparent text-[13px] font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none"
						/>
						</div>
					</div>

					{/* Helper copy */}
					<p className="text-[11px] text-slate-500 leading-snug mt-2">
						Cashcodes are one-time digital checks. To redeem, paste your Cashcode and, if the creator set one, enter the 3-3 security code. If there is no security code for this Cashcode, you can leave those fields empty. When you redeem, the USDC that was locked in the Cashcode moves into this wallet. The Beamio service fee (0.8%, min 0.02 USDC, max 2 USDC) was already paid by the person who created the Cashcode, so you receive the full amount.
					</p>

					{/* Redeem button */}
					<button className="w-full mt-3 rounded-full bg-slate-900 text-white text-xs font-medium py-2.5 hover:bg-slate-800">
						Redeem Cashcode
					</button>
					</section>

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
