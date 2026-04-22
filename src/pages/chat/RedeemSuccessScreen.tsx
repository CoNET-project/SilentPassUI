import {ethers} from 'ethers'
import base_ex_dark from '@/components/assets/base-ex-dark.svg'
import base_ex from '@/components/assets/base-ex.svg'
import { useDaemonContext } from '@/providers/DaemonProvider'
import {AppButton} from '@/components/button/AppButton'

type Prof = {
	amount: string
	myAddress: string
	hash: string
	note: string
	viewClose: () => void
}

const BeamioBaseAddress = '0x6d7a526BFD03E90ea8D19eDB986577395a139872'

const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

const RedeemSuccessScreen = ({amount, myAddress, hash, note, viewClose}: Prof) => {
	const { darkModle } = useDaemonContext()
	return (
		<div className="flex flex-col h-full">

			<div className="flex-1 flex flex-col items-center px-6 pt-10 pb-20 overflow-auto">
				<div className="flex flex-col items-center gap-3 mb-6">
				<div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl">
					✓
				</div>
				<div className="text-center space-y-1">
					<div className="text-sm font-medium text-slate-600">Cashcode redeemed</div>
					<div className="text-2xl font-semibold text-slate-900">{amount} USDC</div>
					<p className="text-xs text-slate-500 max-w-sm">
					The funds have been released from the Cashcode smart contract to your Beamio wallet.
					</p>
				</div>
				</div>

				<div className="w-full max-w-xl space-y-4 text-sm">
				{/* You received */}
				<section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 space-y-2">
					<div className="flex items-center justify-between">
						<div className="flex flex-col gap-0.5">
							<span className="text-[11px] tracking-[0.16em] text-slate-500 uppercase">
								You received
							</span>
							<span className="text-xl font-semibold text-slate-900">{amount} USDC</span>
						</div>
						<div className="flex flex-col items-end gap-0.5 text-[11px] text-slate-500">
							<span>To: Your Beamio wallet</span>

							{/* 将地址与按钮放在同一行 */}
							{/* <div className="flex items-center gap-1">
								<span className="font-mono text-xs text-slate-700">{fmtAddr(myAddress)}</span>

								<a
								href={`https://basescan.org/address/${myAddress}`}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center justify-center rounded-md border border-blue-500 px-1.5 py-0.5 hover:bg-blue-600 hover:text-white transition-colors"
								aria-label="View on BaseScan"
								title="View on BaseScan"
								>
								<img
									src={darkModle ? base_ex_dark : base_ex}
									alt=""
									className="w-4 h-4"
								/>
								<span className="sr-only">View on BaseScan</span>
								</a>
							</div> */}
						</div>
					</div>
					<div className="mt-2 space-y-1">
					<div className="flex items-center justify-between text-[11px] text-slate-500 uppercase tracking-wide">
						<span>Note for you</span>
						<span className="normal-case text-slate-400">Visible to you and the sender</span>
					</div>
					<div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
						{note}
					</div>
					</div>
				</section>

				{/* From / To summary */}
				<section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
					<div className="flex items-center justify-between text-xs text-slate-500">

						{/* 左侧 */}
						<span>From</span>

						{/* 右侧：地址 + 按钮同行 */}
						<div className="flex items-center gap-1">
							<span className="font-mono text-xs text-slate-800">
							Cashcode contract · {fmtAddr(BeamioBaseAddress)}
							</span>

							<a
							href={`https://basescan.org/address/${BeamioBaseAddress}`}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center justify-center rounded-md border border-blue-500 px-1.5 py-0.5 hover:bg-blue-600 hover:text-white transition-colors"
							aria-label="View on BaseScan"
							title="View on BaseScan"
							>
							<img
								src={darkModle ? base_ex_dark : base_ex}
								alt=""
								className="w-4 h-4"
							/>
							<span className="sr-only">View on BaseScan</span>
							</a>
						</div>
						</div>
					<div className="flex items-center justify-between text-xs text-slate-500">

						{/* 左侧 */}
						<span>To</span>

						{/* 右侧：地址 + BaseScan 按钮，在同一行 */}
						<div className="flex items-center gap-1">
							<span className="font-mono text-xs text-slate-800">
							Your wallet · {fmtAddr(myAddress)}
							</span>

							<a
							href={`https://basescan.org/address/${myAddress}`}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center justify-center rounded-md border border-blue-500 px-1.5 py-0.5 hover:bg-blue-600 hover:text-white transition-colors"
							aria-label="View on BaseScan"
							title="View on BaseScan"
							>
							<img
								src={darkModle ? base_ex_dark : base_ex}
								alt=""
								className="w-4 h-4"
							/>
							<span className="sr-only">View on BaseScan</span>
							</a>
						</div>

						</div>
				</section>

				{/* Transaction details */}
				<section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
					<div className="flex items-center justify-between text-sm">
					<span className="font-medium text-slate-800">Transaction</span>
					<span className="text-[11px] text-slate-500">Completed on Base</span>
					</div>
					<div className="flex items-center justify-between text-xs text-slate-500">
  
					{/* 左侧标签 */}
					<span>Tx hash</span>

					{/* 右侧：哈希 + 按钮同行 */}
					<div className="flex items-center gap-1">
						<span className="font-mono text-[11px] text-slate-800">{fmtAddr(hash)}</span>

						<a
						href={`https://basescan.org/tx/${hash}`}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center justify-center rounded-md border border-blue-500 px-1.5 py-0.5 hover:bg-blue-600 hover:text-white transition-colors"
						aria-label="View on BaseScan"
						title="View on BaseScan"
						>
						<img
							src={darkModle ? base_ex_dark : base_ex}
							alt=""
							className="w-4 h-4"
						/>
						<span className="sr-only">View on BaseScan</span>
						</a>
					</div>

					</div>
					
				</section>

				<p className="text-[11px] text-slate-500 text-center mt-2">
					This Cashcode has been redeemed and can no longer be used.<br />The sender has already paid the Beamio fee and network fee for this transaction.
				</p>
				</div>
				<div className="px-6 pb-4 flex flex-col gap-3 max-w-xl w-full mx-auto">
				<AppButton
					fullWidth
					onClick={() => {
						viewClose()
					}}
				>
					Done
				</AppButton>
				
				
			</div>
			</div>

			
		</div>
	)
}

export default RedeemSuccessScreen