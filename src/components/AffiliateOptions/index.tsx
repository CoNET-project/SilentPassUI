import { useState } from 'react';
import './index.css'
import { useDaemonContext } from '../../providers/DaemonProvider';
import { useNavigate } from 'react-router-dom';
import ChoosePlan from '../ChoosePlan';

interface AffiliateOptionsProps {
  isAffiliate: boolean;
}

export default function AffiliateOptions({ isAffiliate }: AffiliateOptionsProps) {
  const navigate = useNavigate();

  const { profiles } = useDaemonContext();
  const [isKeyCopied, setIsKeyCopied] = useState<boolean>(false);

  function handleCopyKey() {
    navigator.clipboard.writeText(profiles[0].keyID)
    setIsKeyCopied(true)

    setTimeout(() => {
      setIsKeyCopied(false)
    }, 2000)
  }

  function subscribe() {
    navigate("/subscription");
  }

  return (
    <div className="affiliate-options">
      {
        isAffiliate ? <ChoosePlan /> : <div />
      }

      <div className="affiliate-footer">
        <button onClick={isAffiliate ? subscribe : handleCopyKey} disabled={!profiles?.[0]?.keyID} className="copy-button">
          <p>{isAffiliate ? "Pay with $SP" : "Copy public key"}</p>
          {
            !isAffiliate && (isKeyCopied ? (
              <img src="/assets/check.svg" alt="Copy icon" />
            ) : (
              <img src="/assets/copy-purple.svg" alt="Copy icon" />
            ))
          }
        </button>
        {
          !isAffiliate && (
            <p>Copy your CoNET wallet public key and submit it to the Silent Pass Team to complete your Affiliate Program registration.</p>
          )
        }
      </div>
    </div>
  )
}