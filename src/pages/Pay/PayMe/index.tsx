import React, {useEffect, useState} from 'react'
import { BeamioLogoWhiteWhithBlueApp } from '@/components/BeamioLogo/BeamioLogoWhiteWhithBlueApp'
import { useDaemonContext } from '@/providers/DaemonProvider'
import {PayLogo} from './LogoPill'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/Footer/assets/B-icon-app.svg'
import {AuthorizationSign, getBalanceProcess, generateCODE} from '@/services/beamio'

const aptEndpoint = 'https://api.settleonbase.xyz'
const showPaylinkSite = 'https://beamio.app'
const displayName = (item: beamio|null) => {
	if (!item) return ''
	const lastname = item?.lastName?.split('\r\n')||''
	const fullName = `${item.firstName || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName
}





const PayMe = () => {

	const { beamio, setBeamio, profiles } = useDaemonContext()
	const [getBeamio, setGetBeamio] = useState<beamio|null>(null)
	const [successUrl, setSuccessUrl] = useState("")
	const [processError, setProcessError] = useState("")

	useEffect(() => {
		if (!beamio||getBeamio||!profiles?.length) return
		setGetBeamio({...beamio})
		if (!beamio?.payme) {
			const code = generateCODE ('')
			const showparams = new URLSearchParams({code: code.code}).toString()
			const showUrl = `${showPaylinkSite}?${showparams}`
			setSuccessUrl(showUrl)
			beamio.payme = code.code
			setBeamio(beamio)
			issueRequestLink(code, profiles[0], beamio)
		} else {
			const showparams = new URLSearchParams({code: beamio.payme}).toString()
			const showUrl = `${showPaylinkSite}?${showparams}`
			setSuccessUrl(showUrl)
		}
	},[])

	const issueRequestLink = async (code: {hash: string, code: string}, profile: profile, beamioData: beamio) => {
		const currency = beamioData.currency
		
			/**
			 * 
			 * 		UI test
			 * 
			 */
	
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setProcessError('RPC ERROR!')
		// }, 3000)

		const note = 'Please Pay me with Beamio'
		const showNote = note + `\r\n` + currency

		const params = new URLSearchParams({amount: '0', code: code.hash, note:showNote, address: profile.keyID }).toString()
		const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
		

		/**
			 * 
			 * 		UI test
			 * 
			 */
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setSuccessUrl(showUrl)
		// }, 1000)


		try {
			const res = await fetch(requestUrl, {method: 'GET'})

			
			if (res.status !== 200) {
				return setProcessError(`Beamio RPC Error!`)
			}
			

			

		} catch (ex) {
			
			return setProcessError(`Beamio RPC Error!`)
		}
		
	}

  return (
    <div className="mt-0 flex flex-col px-3 pt-3 pb-2 bg-transparent">
      <div className="mt-1 w-full bg-transparent">
        {/* Poster card */}
        <div
          className="
            relative
            mx-auto
            w-full
            max-w-[420px]
            
            overflow-hidden
            rounded-[28px]
            shadow-sm
            text-white
          "
          style={{
            background:
              'linear-gradient(180deg, #2F54D6 0%, #2C63EA 38%, #1F4FD0 100%)'
          }}
        >
          
          {/* Content */}
          <div className="relative h-full flex flex-col items-center pt-8 px-5 pb-4">
            
		  	<div className=" mb-4 text-center">
				<div className="text-[24px] font-extrabold text-white">
					{
						
					}
					{displayName(getBeamio)}
				</div>
				<div className="text-[24px] font-extrabold text-white">
					@{getBeamio?.accountName}
				</div>
			</div>
            {/* QR white card */}
            <div className="mt-0 w-full flex justify-center">
              <div
                className="
                  w-full
                  max-w-[330px]
                  rounded-[22px]
                  bg-white
                  shadow-xl
                  px-5
                  pt-5
                  pb-4
                "
              >
				
                {/* QR placeholder */}
                <div
                  className="
                    relative
                    w-full
                    aspect-square
                    rounded-[16px]
                    border
                    border-slate-200
                    bg-slate-50
                    overflow-hidden
                    flex
                    items-center
                    justify-center
                  "
                >
                  {/* Replace this with your real QR image */}
				  
                  <div className="relative inline-block">
						<QRCodeCanvas
							value={successUrl}
							size={320}
							level="H"
							includeMargin
							bgColor="white"
							fgColor="#000000"
							imageSettings={{
								src: bIcon,
								height: 88,
								width: 88,
								excavate: true,
							}}
							className="rounded-lg inline-block"
						/>

						{/* Center overlay */}
						
					</div>

                  {/* center mini icon */}
                  {/* <div className="relative rounded-[16px] shadow-sm">
                    <BeamioLogoWhiteWhithBlueApp size={58} />
                  </div> */}
                </div>

                {/* QR captions */}
                <div className="mt-4 text-center">
                  <div className="text-[22px] font-extrabold text-[#2F54D6]">
                    Scan to Pay
                  </div>
                </div>
              </div>
            </div>

            {/* Japanese line */}
            <div className="mt-6 text-center text-[20px] font-extrabold tracking-wide opacity-95 mb-2">
              	Pay with Beamio App
            </div>

            {/* Spacer */}
            <div className="flex-1" />
			<div className="pb-5 w-full flex justify-center">
				1) Open → 2) Tap Scan → 3) Scan this QR → 4) Enter amount → Confirm
			</div>

			<div className="mt-6 text-center text-[12px] font-extrabold tracking-wide opacity-95 mb-2">
              	In-App Scan Only
            </div>

            {/* Payment logos strip */}
            {/* <div className="pb-5 w-full flex justify-center">
              <div
                className="
                  w-full
                  max-w-[360px]
                  rounded-[18px]
                  bg-white/90
                  backdrop-blur
                  border
                  border-white/40
                  px-4
                  py-3
                  shadow-md
                "
              >
                <div className="flex items-center justify-center gap-6 ">
					<PayLogo type="usdc" size={36} />
					<PayLogo type="visa" size={48} />
					<PayLogo type="mastercard" size={48} />
					<PayLogo type="unionpay" size={48} />
					
				</div>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  )
}



export default PayMe
