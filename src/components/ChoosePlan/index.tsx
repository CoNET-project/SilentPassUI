import { useState } from 'react'

import './index.css';

export default function ChoosePlan() {
  const [monthly, setMonthly] = useState(0);
  const [yearly, setYearly] = useState(0);
  return (
    <div className="choose-plan-container">
      <h2>Choose plan</h2>
      <div className="choose-plan-options">
        <div className="plan-option">
          <div>
            <p>Monthly</p>
            <span>Premium</span>
          </div>
          <div>
            <button onClick={() => setMonthly((prev) => prev === 0 ? 0 : prev - 1)} disabled={monthly === 0}>-</button>
            <div>{monthly}</div>
            <button onClick={() => setMonthly((prev) => prev + 1)}>+</button>
          </div>
          <div>
            <span>$USD</span>
            <p>{monthly !== 0 ? (9.99 * monthly).toFixed(2) : 9.99}</p>
          </div>
        </div>
        <div className="plan-option">
          <div>
            <p>Yearly</p>
            <span>Premium</span>
          </div>
          <div>
            <button onClick={() => setYearly((prev) => prev === 0 ? 0 : prev - 1)} disabled={yearly === 0}>-</button>
            <div>{yearly}</div>
            <button onClick={() => setYearly((prev) => prev + 1)}>+</button>
          </div>
          <div>
            <span>$USD</span>
            <p>{yearly !== 0 ? (24.99 * yearly).toFixed(2) : 24.99}</p>
          </div>
        </div>
      </div>
    </div>
  )
}