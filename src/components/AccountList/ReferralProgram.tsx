import { useEffect, useState, useRef } from 'react';
import './index.css';
import Separator from '../Separator';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';
import SPClubRewardTab from '../SPClubRewardTab'
import { ethers } from 'ethers'
import { getirDropForSPReff } from '../../services/subscription'
import { getPassportTitle, getExpirationDate } from '../../utils/utils';
import { currentPageInvitees, setCurrentPageInvitees } from '../../utils/globals';
import { getRefereesPage } from '../../services/wallets'
import SimpleLoadingRing from '../SimpleLoadingRing'
import { ReactComponent as GoldBadge } from './assets/gold-badge.svg';
import { ReactComponent as BlueBadge } from './assets/blue-badge.svg';
import crown from './assets/crown_icon.gif';
import { ReactComponent as Crown } from './assets/crown.svg';
import { ReactComponent as GC } from './assets/GC.svg'
import gcImg from './assets/GC.png'
import { useTranslation } from 'react-i18next'
import ReferralCont from './ReferralCont';

const SP_EARNED_FROM_REFERRAL = 10

export default function ReferralProgram() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { profiles, airdropProcessReff, setAirdropSuccess, setAirdropTokens, setAirdropProcess, setAirdropProcessReff } = useDaemonContext();
  const [animation, setAnimation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shouldRerender, setShouldRerender] = useState(false);
  const [isRedeemProcessLoading, setIsRedeemProcessLoading] = useState(false)
  const [inputError, setInputError] = useState(false);
  const [inviter, setInviter] = useState('');
  const inputRef = useRef(null);
  const { t, i18n } = useTranslation()
  const [quotation, setQuotation] = useState({
    "rfp": 1 / 31,
    "rsp": 0 / 31,
    "rcp": 0 / 31,
  })

  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const nft = parseInt(profiles?.[0]?.activePassport?.nftID)
  const expiration = nft === 0 || getExpirationDate(profiles?.[0]?.activePassport?.expires, t('passport_unlimit'), t('passport_notUsed'), t('passport_day'), t('passport_hour')) === '00:00:00' ? true : false
  const hasGuardianActive = Number(profiles?.[0]?.activePassport?.expires) > 32503690800000;
  const hasCrownActive = Number(profiles?.[0]?.activePassport?.expires) > 4900000000;
  const freePassportActive = nft > 0 && Number(profiles[0].activePassport.expiresDays) <= 7 && Number(profiles[0].activePassport.expiresDays) > 0;

  const setTokenGraph = () => {

  }

  const showAddress = (address: string) => {
    const link = document.createElement('a');
    link.href = `https://mainnet.conet.network/address/${address}`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }


  const handleSetInviter = async () => {
    setIsRedeemProcessLoading(true)
    const result = await getirDropForSPReff(inviter)
    setIsRedeemProcessLoading(false)

    if (typeof result === 'boolean') {
      return setInputError(true)
    }

    setAirdropSuccess(true)
    setAirdropTokens(result)
    setIsOpen(false)
    setAirdropProcess(true)
    setAirdropProcessReff(false)
  }

  const handlePreviousPage = async () => {
    if (pageNo > 1) {
      setPageNo(pageNo - 1);
    }

    // if (currentPageInvitees > 0) {
    //   setCurrentPageInvitees(currentPageInvitees - 1)
    //   await getRefereesPage(profiles[0], currentPageInvitees)
    //   setShouldRerender(true)
    // }
  }
  const handleNextPage = async () => {
    if (pageNo < Math.ceil(profiles?.[0]?.spClub?.totalReferees / pageSize)) {
      setPageNo(pageNo + 1)
    }

    // if (currentPageInvitees < Math.ceil(profiles?.[0]?.spClub?.totalReferees / 100)) {
    //   setCurrentPageInvitees(currentPageInvitees + 1)
    //   await getRefereesPage(profiles[0], currentPageInvitees)
    //   setShouldRerender(true)
    // }
  }

  const paginateArray = (array: any[]) => {
    const totalItems = array.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    // 边界校验
    if (pageNo < 1 || pageNo > totalPages) {
      return [];
    }

    const startIndex = (pageNo - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);

    return array.slice(startIndex, endIndex);
  }

  useEffect(() => {
    if (shouldRerender) {
      setShouldRerender(false)
    }
  }, [shouldRerender])


  let first = true
  useEffect(() => {
    if (first) {
      first = false
      if (airdropProcessReff) {
        setIsOpen(true)
        //@ts-ignore
        inputRef?.current?.focus()
      }
    }
  }, [])

  function handleCopy() {
    navigator.clipboard.writeText(profiles?.[0]?.keyID);
    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const getAddress = (wallet: any) => {
    return ethers.getAddress(wallet?.keyID).slice(0, 7) + '...' + ethers.getAddress(wallet?.keyID).slice(-5);
  }

  return (
    <div className={`account-wrapper fit-content ${isOpen ? 'active' : ''}`}>
      <div className="account-main-card" onClick={() => {
        if (!isOpen) {
          setAnimation(true)
          setTimeout(() => {
            setAnimation(false)
          }, 2000)
        }
        setIsOpen((prev) => !prev)
      }}>
        {/* <div className="disabled account-main-card"> */}
        <div className="name">


          <h3 style={{ color: freePassportActive || expiration ? 'rgb(96,96,96)' : hasGuardianActive || hasCrownActive ? '#EFBF04' : 'rgb(154,196,229)' }}>{t('comp-accountlist-SpClub-detail3')} {(freePassportActive || expiration) && <span style={{ color: 'darkred' }}>!</span>} </h3>
          {!freePassportActive && !expiration && (
            hasGuardianActive ? <GoldBadge /> : hasCrownActive ? <GC style={{ width: '1.5rem' }} /> : <BlueBadge />)
          }



          <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
        </div>
      </div>

      <div className="info-card">
        {
          (freePassportActive || expiration) &&
          <p style={{ padding: '1rem', color: 'darkred' }}>{t('comp-accountlist-Referral-onlySubscribers')}</p>
        }
        <ReferralCont />
        
        <Separator />

        {/* <div className="info-wrapper">
			<SPClubRewardTab quotation = {quotation} setTokenGraph={setTokenGraph} animation = {animation}/>
        </div> 

        <Separator />*/}

        <div className="info-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <p>{t('comp-accountlist-Referral-Invitees')} <span style={{ color: "#9FBFE5FE" }}>{profiles?.[0].spClub?.totalReferees}</span></p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', paddingLeft: '16px', maxHeight: '100px', overflowY: 'auto', paddingRight: '10px' }}>
            {profiles?.[0]?.spClub
              ?
              profiles?.[0].spClub?.totalReferees > 0 ?
                paginateArray(profiles?.[0]?.spClub.referees)?.map((referee: any) =>
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: '8px' }}>
                    {/* <p style={{ width: 'auto', fontSize: '16px', color: '#FFFFFF', fontWeight: 400 }}>{getPassportTitle(referee?.activePassport)}</p> */}
                    <p onClick={() => showAddress(referee.walletAddress)} style={{ width: 'auto', fontSize: '16px', color: '#9FBFE5FE', fontWeight: 400, cursor: "pointer" }}>{referee?.walletAddress?.slice(0, 5) + '...' + referee?.walletAddress?.slice(-5)}</p>
                  </div>
                ) :
                <p>{t('comp-accountlist-Referral-noInvitees')} </p>
              : <Skeleton width={'100%'} height={'20px'} />}
          </div>

          {profiles?.[0].spClub?.totalReferees > 0 ? <div style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ cursor: 'pointer' }} onClick={handlePreviousPage}>
              <img src="/assets/chevron-blue.svg" alt="Back" width={16} height={16} style={pageNo === 1 ? { filter: 'grayscale(100%)' } : {}} />
            </div>
            <div>{pageNo} of {Math.ceil(profiles?.[0]?.spClub?.totalReferees / pageSize)}</div>
            <div style={{ cursor: 'pointer' }} onClick={handleNextPage}>
              <img src="/assets/chevron-blue.svg" alt="Back" width={16} height={16} style={pageNo >= Math.ceil(profiles?.[0]?.spClub?.totalReferees / pageSize) ? { filter: 'grayscale(100%)', transform: 'rotate(180deg)' } : { transform: 'rotate(180deg)' }} />
            </div>
          </div> : ''}
        </div>



      </div>
    </div>
  )
}