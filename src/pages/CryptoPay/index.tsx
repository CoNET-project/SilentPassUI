import { ReactComponent as StripeIcon } from "./assets/stripe.svg"
import { useDaemonContext } from "../../providers/DaemonProvider";
import CryptoPayment from '../../components/cryptoPay';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from "react-router-dom";
import {clearWaiting} from '../../services/subscription'
export default function CryptoPay() {
	const { selectedPlan, setSelectedPlan, monthlyQtd, setMonthlyQtd, annuallyQtd, setAnnuallyQtd, setAgentWallet, agentWallet } = useDaemonContext();
	const [searchParams, setSearchParams] = useSearchParams();
	let ffcus = false
	const getLinkedWallet = () => {
		const agentWallet = searchParams.get("wallet")
		if (agentWallet) {
			setAgentWallet(agentWallet)
		}
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