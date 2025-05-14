
import {QRCodeSVG} from 'qrcode.react'

export default function QRCode (receiveWallet: string) {

	return (
		
		<div className="redeem-passport">
			
			<QRCodeSVG value = {receiveWallet} level='L' marginSize={2} style={{width: "6rem"}}/>
		</div>
	)

}