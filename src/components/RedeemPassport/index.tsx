import { useNavigate } from "react-router-dom";
import "./index.css"; // Import external CSS file
import { useDaemonContext } from "../../providers/DaemonProvider";
import { ReactComponent as StripeIcon } from "./assets/stripe.svg";

export default function RedeemPassport() {
  const { selectedPlan, setSelectedPlan, monthlyQtd, setMonthlyQtd, annuallyQtd, setAnnuallyQtd, setPaymentKind } = useDaemonContext();
  const navigate = useNavigate();

	const isPurchaseDisabled = (selectedPlan === '1' && monthlyQtd === 0) || (selectedPlan === '12' && annuallyQtd === 0);

	function handlePurchase(type: 1 | 2) {
		if (isPurchaseDisabled) return

		setPaymentKind(type);
		navigate("/subscription");
	}

	function handleChooseOption(option: '1' | '12') {
		setSelectedPlan(option);
	}

	const monthlyPrice = monthlyQtd === 0 ? 2.99 : monthlyQtd === 5 ? 9.99 : monthlyQtd * 2.99
	const annuallyPrice = annuallyQtd === 0 ? 24.99 : annuallyQtd === 5 ? 99.99 : annuallyQtd * 24.99

  return (
    <>
      <div className="redeem-passport">
				<div className="passport-options">
					<h3>Choose plan</h3>
					<div className="option-list">
						<button className={`option ${selectedPlan === '1' ? 'selected' : ''}`} onClick={() => handleChooseOption('1')}>
							<div>
								<p>Monthly</p>
								<span>1 device</span>
							</div>
							<div className="qtd-selector">
								<button disabled={monthlyQtd === 0} onClick={() => setMonthlyQtd(monthlyQtd - 1)}>-</button>
								<p>{monthlyQtd}</p>
								<button disabled={monthlyQtd === 5} onClick={() => setMonthlyQtd(monthlyQtd + 1)}>+</button>
							</div>
							<div>
								<span>$USD</span>
								<p>{monthlyPrice}</p>
								<span className="pay-type">paid monthly</span>
							</div>
						</button>
						<button className={`option ${selectedPlan === '12' ? 'selected' : ''}`} onClick={() => handleChooseOption('12')}>
							<div>
								<p>Annually</p>
								<span>1 device</span>
							</div>
							<div className="qtd-selector">
								<button disabled={annuallyQtd === 0} onClick={() => setAnnuallyQtd(annuallyQtd - 1)}>-</button>
								<p>{annuallyQtd}</p>
								<button disabled={annuallyQtd === 5} onClick={() => setAnnuallyQtd(annuallyQtd + 1)}>+</button>
							</div>
							<div>
								<span>$USD</span>
								<p>{annuallyPrice}</p>
								<span className="pay-type">paid yearly</span>
							</div>
						</button>
					</div>
				</div>
				<button className="redeem-button purchase" onClick={() => handlePurchase(1)} disabled={isPurchaseDisabled}>
					Pay with $SP
				</button>
				<button className="redeem-button stripe" onClick={() => handlePurchase(2)} disabled={isPurchaseDisabled}>
					Pay with
					<StripeIcon />
				</button>
			</div>
    </>
  );
}
