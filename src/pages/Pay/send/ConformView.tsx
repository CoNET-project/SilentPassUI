import { AppButton } from "@/components/button/AppButton";
import React, {useRef, useState, useEffect} from "react"
import { Sparkles } from "lucide-react";

const remote = 'https://api.settleonbase.xyz'
const aptEndpoint = remote
const formatMoney = (n: number) =>
		n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })


type Props = {
	messageData: any
}


const ConformView = ({messageData}: Props) => {


	const data: IMessageData =messageData.data

	return (
		
		<div className="mt-2 w-full">
			<div className="flex items-center justify-between py-2.5 bg-white mb-4"> {/* py-3 -> 2.5 */}
				<span className="text-[14px] text-slate-500">Network fee</span>

					<div className="flex flex-col items-end">
						<div
							className={[
								"inline-flex items-center gap-2",
								"h-9 px-3 rounded-full",
								"bg-blue-50",
								"ring-1 ring-blue-200/70",
								"text-blue-600",
								"font-semibold text-[14px]",
								"shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
								"flex-shrink-0",
								"min-w-0"
							].join(" ")}
							>
							<Sparkles className="w-5 h-5 shrink-0" />
							<span className="inline max-w-[110px] truncate">
								Sponsored
							</span>
						</div>

						{/* {isSponsored && (
						<span className="text-[12px] text-[rgb(0_122_255)] leading-tight">
							Sponsored By @{fromBeamio?.username}
						</span>
						)} */}
					</div>
			</div>
			{
				data.fee && (<div className="flex items-center justify-between">
					<span>Beamio fee</span>
					<span className="font-medium text-slate-900">{data.fee} USDC</span>
				</div>)
			}
			
			<div className="pt-1 border-t border-dashed border-slate-200 text-[10px] text-slate-500">
				This is a direct wallet-to-wallet send on Base. Beamio sponsors the
				gas, so you only pay exactly {formatMoney(Number(data.amount))} USDC.
			</div>
			
		</div>
	)
}

export default ConformView