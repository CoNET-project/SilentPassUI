import { ReactComponent as SpToken } from '../assets/sp-token.svg';

import { ReactComponent as WalletIcon } from '../assets/wallet-icon.svg';
import { ReactComponent as QuotesIcon } from '../assets/quotes-icon.svg';
import { useDaemonContext } from '../../../providers/DaemonProvider';
import { getPassportTitle } from '../../../utils/utils';
import Separator from '../../../components/Separator';
import { useTranslation } from 'react-i18next'
import { CoNET_Data } from "../../../utils/globals";
import Skeleton from '../../../components/Skeleton';

interface SecondStepProps {
  selectedNftId: string;
  updateCounter: number;
  gasFee: string;
}

export default function SecondStep({ selectedNftId, updateCounter, gasFee }: SecondStepProps) {
  const { profiles } = useDaemonContext();
  const { t, i18n } = useTranslation()
  const choosenPassport = CoNET_Data?.profiles[0].silentPassPassports?.find((passport) => passport.nftID === Number(selectedNftId));
  const passTitle = getPassportTitle(choosenPassport, t('passport_Freemium'), t('passport_Guardian'), t('passport_Annually'),t('passport_Quarter'),t('passport_Monthly'), t('passport_Infinite'))
  return (
    <>
      <div className="transaction-details">
        <div className="transaction-info">
          <p>Amount</p>
          <div className='simple-content'>
            <SpToken />
            <p>1 {passTitle} Passport</p>
          </div>
        </div>

        <div className="transaction-info">
          <p>Wallet</p>
          <div>
            <WalletIcon />
            <div>
              <p>Silent Pass Account</p>
              <span>{profiles?.[0]?.keyID?.slice(0, 5)}...{profiles?.[0]?.keyID?.slice(-5)}</span>
            </div>
          </div>
        </div>

        <div className="summary">
          <div className="summary-heading">
            <p>Summary</p>
            <div className="quotes">
              <QuotesIcon />
              <p>Quote updates in {updateCounter >= 0 ? updateCounter : 0}s</p>
            </div>
          </div>

          <div className="summary-table">
            <div>
              <p>{passTitle} Passport </p>
              <p>1</p>
            </div>

            <div>
              <p>GAS Fee</p>
              {gasFee ? <p>{gasFee} $ETH</p> : <Skeleton height="19px" width="160px" />}
            </div>

            <Separator />

            <div>
              <p>Total</p>
              {gasFee ? <p>{gasFee} $ETH</p> : <Skeleton height="19px" width="160px" />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}