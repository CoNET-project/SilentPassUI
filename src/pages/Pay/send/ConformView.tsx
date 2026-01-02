import { AppButton } from "@/components/button/AppButton";
import React, {useRef, useState, useEffect} from "react"


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
			<div className="flex items-center justify-between">
				<span>Network fee</span>
				<span className="font-medium text-emerald-700">
				Paid by Beamio (0 gas)
				</span>
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