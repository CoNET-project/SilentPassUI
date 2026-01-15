
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { useDaemonContext } from "@/providers/DaemonProvider"
import { } from '@/services/currency'


type IChat = {
	pgpKey: {

	}
}

const Home = () => {
	const { setDarkModle, profiles,
		power, setProfiles, setBeamio, setPaymentLink, setSecureCode,  secureCode, ignoreUrl, setMyAddress, myAddress, beamio, setCurrencyData,
		setPayTag, setSendToMemo, setUsdcbalance, listenningProcess, setListenningProcess, setUsdcToUSD, usdcToUSD, usdcbalance, setPaymentLinkCode,
		currencyData, setRedeemCode, setPayMePayment
	} = useDaemonContext()

	const init = async () => {
		const temp = CoNET_Data
		if (!temp || !profiles) {
			return
		}

		const profile1: profile = profiles[0]
		const chat: IChat = profile1?.chat 
		if (!chat) {

		}


  	}
	return (
		<div
			className="
				overflow-y-auto
				pt-[calc(env(safe-area-inset-top)+0.2rem)]
			"
		>
			
            
        </div>
	)
}

export default Home