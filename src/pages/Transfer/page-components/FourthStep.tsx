import Separator from '../../../components/Separator';
import { getPassportTitle } from '../../../utils/utils';
import { CoNET_Data } from "../../../utils/globals";
import { useTranslation } from 'react-i18next'

interface FourthStep {
  gasFee: string;
  selectedNftId: string;
}

export default function FourthStep({ gasFee, selectedNftId }: FourthStep) {
  const choosenPassport = CoNET_Data?.profiles[0].silentPassPassports?.find((passport) => passport.nftID === Number(selectedNftId));
  const { t, i18n } = useTranslation()
  return (
    <div className="step-container">
      <div className="purchase-success">
        <img src="/assets/purchase-check.svg" />
        <div>
          <p>The transaction</p>
          <p>was successful</p>
        </div>
      </div>
      <div className="purchase-details">
        <div className="detail">
          <p>{t(getPassportTitle(choosenPassport))} Passport</p>
          <p>1</p>
        </div>
        <div className="detail">
          <p>GAS fee</p>
          <p>{gasFee} SP</p>
        </div>
        <Separator />
        <div className="detail">
          <p>Total</p>
          <p>{gasFee} SP</p>
        </div>
      </div>
    </div>
  )
}