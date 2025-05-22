import { useEffect, useState, useRef } from 'react';
import './index.css';
import Separator from '../Separator';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';
import SPClubRewardTab from '../SPClubRewardTab'
import { ethers } from 'ethers'
import {getirDropForSPReff} from '../../services/subscription'
import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";
import { getPassportTitle, getExpirationDate } from '../../utils/utils';
import { currentPageInvitees, setCurrentPageInvitees } from '../../utils/globals';
import { getRefereesPage } from '../../services/wallets'
import SimpleLoadingRing from '../SimpleLoadingRing'
import { ReactComponent as GoldBadge } from './assets/gold-badge.svg';
import { ReactComponent as BlueBadge } from './assets/blue-badge.svg';
import { useTranslation } from 'react-i18next'

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
    "rfp": 1/31,
    "rsp": 0/31,
	"rcp": 0/31,
  })
  
  const nft = parseInt(profiles?.[0]?.activePassport?.nftID)
  const expiration = nft === 0 || getExpirationDate(profiles?.[0]?.activePassport?.expires, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour')) === '00:00:00' ? true : false
  const hasGuardianActive = Number(profiles?.[0]?.activePassport?.expires) > 32503690800000;
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
	const result = await getirDropForSPReff (inviter)
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
    if (currentPageInvitees > 0) {
      setCurrentPageInvitees(currentPageInvitees - 1)
      await getRefereesPage(profiles[0], currentPageInvitees)
      setShouldRerender(true)
    }
  }

  const handleNextPage = async () => {
    if (currentPageInvitees < Math.ceil(profiles?.[0]?.spClub?.totalReferees / 100)) {
      setCurrentPageInvitees(currentPageInvitees + 1)
      await getRefereesPage(profiles[0], currentPageInvitees)
      setShouldRerender(true)
    }
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
          <h3 style={{color: freePassportActive||expiration ? 'rgb(96,96,96)' : hasGuardianActive ? '#EFBF04': 'rgb(154,196,229)'}}>Referral Program {(freePassportActive||expiration) && <span style={{color: 'darkred'}}>!</span>} </h3>
		  { !freePassportActive && !expiration && (
			hasGuardianActive ? <GoldBadge /> : <BlueBadge />)
		  }
          <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
        </div>
      </div>

      <div className="info-card">
	        {
				(freePassportActive || expiration) &&
				<p style={{padding:'1rem', color: 'darkred'}}>Only subscribers may earn referral points.</p>
			}
        <div className="copy-div">
			
          {
			
		  	profiles?.[0]?.keyID ?
            <>
              <div className="copy-text">
                <p>{profiles[0].keyID.substring(0,6)+'...'+profiles[0].keyID.substring(profiles[0].keyID.length - 6)}</p>
              </div>
              <div className="button-list">
                <button onClick={() => handleCopy()}>
                  {
                    copied ? (
                      <img src="/assets/check.svg" alt="Copy icon" />
                    ) : (
                      <img src="/assets/copy-purple.svg" alt="Copy icon" />
                    )
                  }
                </button>
              </div>
            </>
            : <Skeleton width='100%' height='20px' />
          }
        </div>

        <div style={{ padding: "0 16px", marginBottom: "32px" }}>
          <p style={{ color: "#B1B1B2", fontSize: "12px", textAlign: "center", }}>Copy this to invite your friends to earn $SP</p>
        </div>

        {
          profiles?.[0]?.referrer ? (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", alignItems: "self-start", gap: "8px", marginBottom: '16px' }}>
              <p>Inviter's wallet address</p>
              {
                  <span style={{ color: '#989899' }}>{profiles[0].referrer.substring(0,6)+'...'+profiles[0].referrer.substring(profiles[0].referrer.length - 6)}
                  </span>
              }
            </div>
          ) : (
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", alignItems: "self-start", gap: "8px", marginBottom: '16px' }}>
              <p>Inviter's wallet address</p>
              <input className={inputError? 'wallet-address-input-error':''}
			    ref={inputRef}
                type="text" 
                style={{ width: "100%", background: "#3F3F40", borderRadius: "8px", padding: "8px", color: "#989899", border: 0 }}
                value={inviter} onChange={(e) => {
					setInputError(false)
					setInviter(e.target.value)
				}}
              />

              <button style={{
                marginTop: "16px", padding: "12px 0",
                display: "flex", justifyContent: "center",
                cursor: "pointer", width: "100%",
                background: "#282930", borderRadius: "16px",
                fontWeight: "bold",
              }} onClick={handleSetInviter}>{isRedeemProcessLoading ? <SimpleLoadingRing /> : "Confirm"}</button>
            </div>
          )
        }

        <Separator />

        <div className="info-wrapper">
			<SPClubRewardTab quotation = {quotation} setTokenGraph={setTokenGraph} animation = {animation}/>
          {/* <div className='token-assets-title'>
            <p className='title'>Rewards</p>
          </div>
          <div style={{ marginLeft: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p>Invitees</p>
            </div>
            <p>{profiles?.[0]?.spClub?.referees?.length}</p>
          </div>
          <div style={{ marginLeft: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <p>$SP</p>
            </div>
            <p>0</p>
          </div> */}
        </div>

        <Separator />

        <div className="info-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <p>Invitees <span style={{    color: "#9FBFE5FE"}}>{profiles?.[0].spClub?.totalReferees}</span></p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', paddingLeft: '16px', maxHeight: '100px', overflowY: 'auto', paddingRight: '10px' }}>
            {profiles?.[0]?.spClub
              ?
              profiles?.[0].spClub?.totalReferees > 0 ?
                profiles?.[0]?.spClub.referees?.map((referee: any) =>
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: '8px' }}>
                    {/* <p style={{ width: 'auto', fontSize: '16px', color: '#FFFFFF', fontWeight: 400 }}>{getPassportTitle(referee?.activePassport)}</p> */}
                    <p onClick={() => showAddress(referee.walletAddress)} style={{ width: 'auto', fontSize: '16px', color: '#9FBFE5FE', fontWeight: 400, cursor: "pointer" }}>{referee?.walletAddress?.slice(0, 5) + '...' + referee?.walletAddress?.slice(-5)}</p>
                  </div>
                ) :
                <p>No invitees</p>
              : <Skeleton width={'100%'} height={'20px'} />}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ cursor: 'pointer' }} onClick={handlePreviousPage}>
              <img src="/assets/chevron-blue.svg" alt="Back" width={16} height={16} />
            </div>
            <div>{currentPageInvitees + 1} of {Math.ceil(profiles?.[0]?.spClub?.totalReferees / 100)}</div>
            <div style={{ cursor: 'pointer' }} onClick={handleNextPage}>
              <img src="/assets/chevron-blue.svg" alt="Back" width={16} height={16} style={{ transform: 'rotate(180deg)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}