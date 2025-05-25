import Separator from '../../../components/Separator';

import { ReactComponent as SpToken } from '../assets/sp-token.svg';
import { ReactComponent as SolToken } from '../assets/solana-token.svg';

import { ReactComponent as WalletIcon } from '../assets/wallet-icon.svg';
import { ReactComponent as QuotesIcon } from '../assets/quotes-icon.svg';
import AccountList from '../../../components/AccountList';
import { useDaemonContext } from '../../../providers/DaemonProvider';
import { useTranslation } from 'react-i18next'

export default function SecondStep({ price, gasfee, updateCounter, spInUsd, solInUsd, SP_balance, SolBalance}: any) {
  const { profiles, selectedPlan } = useDaemonContext();
  const { t, i18n } = useTranslation()
  return (
    <div className="transaction-details">
      <AccountList showMainWallet={false} spInUsd={spInUsd} solInUsd={solInUsd} />

      <div className="transaction-info">
        <p>{t('Subscription-SecondStep-title')} </p>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ flex: 5, fontSize: '20px', fontWeight: '700' }}>{selectedPlan === '12' ? t('passport_Annually') : t('passport_Monthly')}</p>
              <p style={{ flex: 1, fontSize: '14px', fontWeight: '400', color: '#989899', whiteSpace: 'nowrap' }}>{selectedPlan === '1' ? '30' : '365'} {t('passport_day')}</p>
            </div>
            <span>{t('comp-RedeemPassport-1device')},{t('passport_unlimitBandweidth')} {price} $SP</span>
          </div>
        </div>
      </div>

	  
      <div className="transaction-info">

		<p className="title">{t('comp-comm-Paywith')}</p>

        <div className='simple-content'>
          <SpToken />
          <p>{t('comp-comm-Balance')}</p>
		  <p>{SP_balance} $SP </p>
        </div>
		<div className='simple-content'>
          <SolToken />
          <p>{t('comp-comm-Balance')}</p>
		  <p>{SolBalance.toFixed(6)} $Sol </p>
        </div>
      </div>

      {/* <div className="transaction-info">
        <p>Wallet</p>
        <div>
          <WalletIcon />
          <div>
            <p>Solana Wallet</p>
            <span>{profiles?.[1]?.keyID?.slice(0, 5)}...{profiles?.[1]?.keyID?.slice(-5)}</span>
          </div>
        </div>
      </div> */}

      <div className="summary">
        <div className="summary-heading">
          <p>{t('comp-comm-Summary')} </p>
          <div className="quotes">
            <QuotesIcon />
            <p>{t('comp-comm-QuoteUpdates')} {updateCounter >= 0 ? updateCounter : 0} {t('passport_secound')}</p>
          </div>
        </div>

        <div className="summary-table">
          <div>
            <p>{selectedPlan === '12' ? t('passport_Annually') : t('passport_Monthly')}</p>
            <p>{price} $SP</p>
          </div>

          <div>
            <p>{t('comp-comm-GASFee')}</p>
            <p>{parseFloat(gasfee).toFixed(6)} $SOL</p>
          </div>

          <Separator />

          <div>
            <p>{t('comp-comm-Total')} </p>
            <p>{parseFloat(price).toFixed(0)} $SP + {parseFloat(gasfee).toFixed(6)} $SOL</p>
          </div>
        </div>
      </div>
    </div>
  )
}