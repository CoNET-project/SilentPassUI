import { useNavigate, useSearchParams } from "react-router-dom";
import "./index.css"; // Import external CSS file
import { useDaemonContext } from "../../providers/DaemonProvider";
import { useEffect, useState } from 'react';
import {checkWallet} from '../../services/subscription'

export default function CryptoPayment() {
  const { selectedPlan, setSelectedPlan, monthlyQtd, annuallyQtd, setPaymentKind, agentWallet } = useDaemonContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vaildAddress, setVaildAddress] = useState(true)
  let ffcus = false
  useEffect(() => {
	if (ffcus) {
		return
	}
	ffcus = true
	const agentWallet = searchParams.get("wallet")
	
	if (agentWallet) {
		const test = checkWallet(agentWallet)
		if (!test) {
			setVaildAddress(false)
		}
	}


},[])

	function handlePurchase(type: 1 | 2) {

		setPaymentKind(type);
		navigate("/qrcode");
	}

	function handleChooseOption(option: '1' | '12') {
		setSelectedPlan(option);
	}

	// useEffect(() => {
	// 	const urlSearchParams = new URLSearchParams(document.location.search);

	// 	const type = urlSearchParams.get('type');
	// 	const qtd = urlSearchParams.get('qtd');

	// 	console.log("TYPE: ", type);
	// 	console.log("QTD: ", qtd);

	// 	if (!type) return;

	// 	if (Number(type) === 1) {
	// 		setSelectedPlan("1");

	// 		if (qtd) {
	// 			setMonthlyQtd(Number(qtd));
	// 		}
	// 	} else {
	// 		setSelectedPlan("12");

	// 		if (qtd) {
	// 			setAnnuallyQtd(Number(qtd));
	// 		}
	// 	}
	// }, [setAnnuallyQtd, setMonthlyQtd, setSelectedPlan])

	const monthlyPrice = monthlyQtd === 0 ? 2.99 : monthlyQtd === 5 ? 9.99 : monthlyQtd * 2.99
	const annuallyPrice = annuallyQtd === 0 ? 24.99 : annuallyQtd === 5 ? 99.99 : annuallyQtd * 24.99

  return (
      <div className="redeem-passport">
		<div className="passport-options">
			{
				!vaildAddress &&
				<>
					<p style={{color: 'darkred', fontWeight: '600'}}>The agent's address is incorrect. Please contact the agent before making payment.</p>
				</>
			}
			<h3>Choose Payment</h3>
			<div className="option-list">
			<button className={`option ${selectedPlan === '1' ? 'selected' : ''}`} onClick={() => handleChooseOption('1')}>
					<div>
						<p>Monthly</p>
						<span>1 device</span>
					</div>
					{/* <div className="qtd-selector">
						<button disabled={annuallyQtd === 0} onClick={() => setAnnuallyQtd(annuallyQtd - 1)}>-</button>
						<p>{annuallyQtd}</p>
						<button disabled={annuallyQtd === 5} onClick={() => setAnnuallyQtd(annuallyQtd + 1)}>+</button>
					</div> */}
					<div>
						<span>$USD</span>
						<p>{monthlyPrice}</p>
						<span className="pay-type">paid yearly</span>
					</div>
				</button>
				<button className={`option ${selectedPlan === '12' ? 'selected' : ''}`} onClick={() => handleChooseOption('12')}>
					<div>
						<p>Annually</p>
						<span>1 device</span>
					</div>
					{/* <div className="qtd-selector">
						<button disabled={annuallyQtd === 0} onClick={() => setAnnuallyQtd(annuallyQtd - 1)}>-</button>
						<p>{annuallyQtd}</p>
						<button disabled={annuallyQtd === 5} onClick={() => setAnnuallyQtd(annuallyQtd + 1)}>+</button>
					</div> */}
					<div>
						<span>$USD</span>
						<p>{annuallyPrice}</p>
						<span className="pay-type">paid yearly</span>
					</div>
				</button>
			</div>
		</div>
		<button className="redeem-button purchase" onClick={() => handlePurchase(1)} >
			Pay with BNB
		</button>
		<button className="redeem-button purchase" onClick={() => handlePurchase(2)} >
			Pay with BSC USDT
		</button>
	</div>
    
  )
}
