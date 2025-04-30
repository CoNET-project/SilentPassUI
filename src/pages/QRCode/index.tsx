import { ReactComponent as StripeIcon } from "./assets/stripe.svg"
import { useDaemonContext } from "../../providers/DaemonProvider";
import QRCode from '../../components/QRCode';
import LoadingRing from '../../components/LoadingRing'
import { useNavigate, useSearchParams } from "react-router-dom";
import BackButton from '../../components/BackButton'
import { ReactComponent as QuotesIcon } from './assets/quotes-icon.svg';
import { useEffect, useState } from 'react';
import {getCryptoPay, waitingPay} from '../../services/subscription'
import './index.css';

export default function CryptoPay() {
	const { selectedPlan, setSelectedPlan, monthlyQtd, setMonthlyQtd, annuallyQtd, setAnnuallyQtd, setPaymentKind, paymentKind, agentWallet } = useDaemonContext();

	const navigate = useNavigate();
	const [updateCounter, setUpdateCounter] = useState(new Date('1970/12/1 12:0:0'));
	const [timeoutProcess, setTimeoutProcess] = useState<NodeJS.Timeout>()
	const [cryptoName, setCryptoName] = useState(paymentKind === 1 ? 'BNB' : 'BNB USDT')
	const [serverAddress, setServerAddress] = useState('')
	const [showPrice, setShowPrice] = useState('')
	const [error, setError] = useState(false)
	let ffcus = false

	const setTimeElm = () => {
		setUpdateCounter((prev) => new Date(prev.getTime() - 1000))
	}

	const getData = async () => {
		console.log(cryptoName)
		const kkk = await getCryptoPay(agentWallet, cryptoName)
		if (!kkk) {
			return setError(true)
		}
		setServerAddress(kkk?.wallet)
		setShowPrice(kkk?.transferNumber)
		const waiting = await waitingPay (kkk?.uuid)
		
	}

	useEffect(() => {
		if (ffcus) {
			return
		}
		ffcus = true
		getData()
	},[])

	useEffect(() => {
		
		setTimeout (() => {
			setTimeElm()
		}, 1000)
	},[updateCounter])
	
	return (
	
   <div className="page-container">
	  <BackButton to='/' />
	  {
		serverAddress ?
		<>
			<div className="summary-heading">
				<p>Send payment</p>
				<div className="quotes">
					
					<p>{updateCounter.getMinutes()+':'+updateCounter.getSeconds()}</p>
					<QuotesIcon />
				</div>
			</div>
			<div className="qr-container">
				<div className="left">
					{
						serverAddress &&
						QRCode(serverAddress)
					}
				</div>
				<div className="right" style={{paddingLeft: '1rem'}}>
					<p>Only send {cryptoName} to this address</p>
				</div>
			</div>

			<div className="summary-heading" style={{fontSize: 'small'}}>
				<p>{serverAddress}</p>
			</div>
			<div className="summary-heading">
				<p>Total amount</p>
				<div className="quotes">
				<p>{showPrice} {cryptoName} </p>
			</div>
			</div>
		</> : 
			<LoadingRing /> 
		}

	</div>
  )

}