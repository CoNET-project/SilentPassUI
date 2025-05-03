import { ReactComponent as StripeIcon } from "./assets/stripe.svg"
import { useDaemonContext } from "../../providers/DaemonProvider";
import QRCode from '../../components/QRCode';
import LoadingRing from '../../components/LoadingRing'
import { useNavigate, useSearchParams } from "react-router-dom";
import BackButton from '../../components/BackButton'
import { ReactComponent as QuotesIcon } from './assets/quotes-icon.svg';
import { useEffect, useState } from 'react';
import {getCryptoPay, waitingPaymentReady} from '../../services/subscription'
import './index.css';
import SuccessModal from './SuccessModal'

export default function CryptoPay() {
	const { selectedPlan, setSelectedPlan, monthlyQtd, setMonthlyQtd, annuallyQtd, setAnnuallyQtd, setPaymentKind, paymentKind, agentWallet } = useDaemonContext();

	const navigate = useNavigate();
	const [updateCounter, setUpdateCounter] = useState(new Date('1970/12/1 12:0:1'));
	const [timeoutProcess, setTimeoutProcess] = useState<NodeJS.Timeout>()
	const [cryptoName, setCryptoName] = useState(paymentKind === 1 ? 'BNB' : 'BSC USDT')
	const [serverAddress, setServerAddress] = useState('')
	const [showPrice, setShowPrice] = useState('')
	const [showLoading, setShowLoading] = useState(true)
	const [error, setError] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const [successInfo, setSuccessInfo] = useState('')

	let ffcus = false

	const setTimeElm = () => {
		if (updateCounter.getHours() === 0) {
			setError(true)
			return setErrorMessage(`Timeout Error!`)
		}
		setUpdateCounter((prev) => new Date(prev.getTime() - 1000))
	}

	const getData = async () => {

		const kkk = await getCryptoPay(agentWallet, cryptoName, selectedPlan)
		if (!kkk) {
			return setError(true)
		}
		
		setServerAddress(kkk?.wallet)
		setShowPrice(kkk?.transferNumber)
		setShowLoading(false)

		const waiting = await waitingPaymentReady (kkk?.wallet)
		if (!waiting?.status) {
			setError(true)
			return
		}
		setSuccessInfo(waiting.status)
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
		showLoading ?
			<LoadingRing /> 
		: error ? 
			<>
				<p>{errorMessage}</p>
				<p style={{color: 'darkred', paddingTop: '2rem'}}>Something Error!</p>
			</> : successInfo ?
			<SuccessModal onClose={() => navigate('/')} nftID={successInfo} /> :
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
		</>
		
	  }
	  

	</div>
  )

}