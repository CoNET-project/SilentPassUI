
import { useDaemonContext } from "../../providers/DaemonProvider";
import CryptoPayment from '../../components/CryptoPay';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from "react-router-dom";
import {clearWaiting} from '../../services/subscription'

export default function CryptoPay() {
	const { selectedPlan, setSelectedPlan, monthlyQtd, setMonthlyQtd, annuallyQtd, setAnnuallyQtd, setAgentWallet, agentWallet } = useDaemonContext();
	const [searchParams, setSearchParams] = useSearchParams();
	
	let ffcus = false
	const getLinkedWallet = () => {
		clearWaiting()

	}
	
	useEffect(() => {
		if (ffcus) {
			return
		}
		ffcus = true
		getLinkedWallet()

	},[])
	return (
		
		<div className="page-container">
			<div className="wallet-heading">
				<h1>Crypto Payment</h1>
			</div>
			<CryptoPayment />
		</div>
	)

}