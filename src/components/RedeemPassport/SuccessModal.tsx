import { ReactComponent as ClapHands } from './assets/clap-hands.svg';
import { ReactComponent as Strokes1 } from './assets/strokes-1.svg';
import { ReactComponent as Strokes2 } from './assets/strokes-2.svg';
import { useTranslation } from 'react-i18next'

import "./index.css"; // Use the same CSS file for styling

interface SuccessModalProps {
  onClose: () => void;
  nftID: number|string;
}

export default function SuccessModal({ nftID, onClose }: SuccessModalProps) {
	const { t, i18n } = useTranslation()
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <Strokes1 />
          <Strokes2 />
        </div>
        <div className="modal-icon">
          <ClapHands />
        </div>
        <div className="modal-body">
          <h2>Silent Pass Passport</h2>
		   <h2>{t('comp-RedeemPassport-SuccessModal-title')}</h2>
          <p>
            {t('comp-RedeemPassport-SuccessModal-detail-1')}<strong>{t('comp-RedeemPassport-SuccessModal-detail-2')}</strong>{t('comp-RedeemPassport-SuccessModal-detail-3')}
          </p>
          <p className="passport-id">{t('comp-RedeemPassport-SuccessModal-NFT')} <span>#{nftID}</span></p>
        </div>
        <div className="modal-footer">
          <button className="modal-button close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
