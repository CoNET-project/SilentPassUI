import { useEffect, useState } from 'react'

import "./index.css";
import SpClubCongratsPopup from '../SpClubCongratsPopup';
import SimpleLoadingRing from '../SimpleLoadingRing';
import { joinSpClub } from '../../api';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { getSpClubMemberId } from '../../services/wallets';
import { isPassportValid } from '../../utils/utils';
import { ReactComponent as CrownBadge } from './assets/crown.svg'
import { useNavigate } from "react-router-dom";

const OneDayInSeconds = 86400;

interface plan {
	total: string
	publicKey: string
	Solana: string
}

export default function SpClub() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCongratsPopupOpen, setIsCongratsPopupOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [memberId, setMemberId] = useState<string>('0');
  const [referrer, setReferrer] = useState<string>('');
  const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);
	const navigate = useNavigate()
  const { miningData, profiles, setIsPassportInfoPopupOpen, activePassportUpdated, setSelectedPlan } = useDaemonContext();

  useEffect(() => {
    const passportExpiration = profiles?.[0]?.activePassport?.expires
    if (passportExpiration) {
      const timeLeft = passportExpiration - Math.floor(Date.now() / 1000)
      setPassportTimeLeft(timeLeft)
    }
  }, [activePassportUpdated, profiles])

  const fetchMemberIdWithRetry = async (startTime = Date.now()): Promise<string | null> => {
    const _memberId = await getSpClubMemberId(profiles[0]);

    if (_memberId.toString() !== '0') {
      return _memberId.toString();
    }

    if (Date.now() - startTime >= 60000) { // Stop after 1 minute
      return null;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
    return fetchMemberIdWithRetry(startTime); // Recursive call with startTime
  };

  const handleJoinClub = async () => {
    setIsLoading(true)

    try {
      const result = await joinSpClub(profiles[0], profiles[1], referrer);

      if (result !== false) {
        const _memberId = await fetchMemberIdWithRetry()

        if (_memberId === null) throw new Error("Couldn't fetch memberId")

        setMemberId(_memberId);
        setIsCongratsPopupOpen(true)
      }
    } catch (error) {
      console.log(error);
    }

    setTimeout(() => setIsLoading(false), 2000)
  }

    const startSubscription = () => {
		if (!profiles ||profiles.length < 2) {
			return
		}

		const planObj: plan = {
			publicKey: profiles[0].keyID,
			Solana: profiles[1].keyID,
			total: '3100'
		}
		setSelectedPlan('3100')
		const base64VPNMessage = btoa(JSON.stringify(planObj));
		
		window?.webkit?.messageHandlers["pay"]?.postMessage(base64VPNMessage)
		
		navigate("/subscription")
	
  }

  const renderCardContent = () => {
    if (profiles?.[0]?.spClub?.memberId && profiles?.[0]?.spClub?.memberId !== '0') {
      return (
        <div className="info-wrapper" style={{
          gap: '16px'
        }}>
          <div>
            <p style={{ fontSize: '14px', color: '#FFFFFF' }}>Member ID</p>
            <p style={{ fontSize: '16px', color: '#989899' }}>{profiles?.[0]?.spClub?.memberId.toString()}</p>
          </div>

          {
            profiles?.[0]?.spClub?.referrer && profiles?.[0]?.spClub?.referrer?.toString() !== '' &&
            <div>
              <p style={{ fontSize: '14px', color: '#FFFFFF' }}>Inviter</p>
              <p style={{ fontSize: '16px', color: '#989899' }}>{profiles?.[0]?.spClub?.referrer?.toString().slice(0, 5) + '...' + profiles?.[0]?.spClub?.referrer?.toString().slice(-5)}</p>
            </div>
          }

          {
            !isPassportValid(parseInt(profiles?.[0]?.spClub?.expires)) &&
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <p style={{ fontSize: '16px', color: '#FFFFFF', textAlign: 'center' }}>Passport Expired.</p>
              <p style={{ fontSize: '12px', color: '#989899', textAlign: 'center' }}>Buy another passport to reactivate your club membership.</p>
            </div>
          }
        </div>
      )
    }

    return (
      <div className="info-wrapper" style={{ gap: '24px' }}>
        <div>
          <p>Input you inviter's wallet address</p>
          <input value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="wallet address" style={{ color: '#FFFFFF' }} />
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '24px', flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ width: '100%', height: '1px', background: '#FFFFFF' }} />

          <div>
            <p style={{ fontSize: '20px' }}>or</p>
          </div>

          <div style={{ width: '100%', height: '1px', background: '#FFFFFF' }} />

        </div>

        <div style={{ width: '100%' }}>
          <p style={{ width: '100%', textAlign: 'center', fontSize: '16px' }}>Get Silent Pass Passport and join the club</p>
        </div>

        <button style={{ cursor: 'pointer' }} onClick={handleJoinClub}>
          {isLoading ? <SimpleLoadingRing /> :
            <p>Join Club</p>
          }
        </button>
      </div>
    )
  }

  return (
    <>
      <div className={`account-wrapper referral-program fit-content ${isOpen ? 'active' : ''}`}>
        <div className="account-main-card" onClick={() => setIsOpen((prev) => !prev)}>
          {/* <div className="disabled account-main-card"> */}
          <div className="name">
            <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', alignItems: 'center' }}>
              <h3>Join SP Club</h3>
              {/* <div
                style={{
                  width: '12px',
                  height: '12px',
                }}
                className={`circle ${passportTimeLeft < OneDayInSeconds ? passportTimeLeft <= 0 ? "red" : "yellow" : "green"}`}></div> */}
            </div>
            <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
          </div>
        </div>
        <div className="info-card">
			<div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px"}}>
				<div className="passport-options" style={{gap:"2px"}}>
					<div style={{display: 'flex', alignItems:'center'}}>
						<CrownBadge style={{width: "60px"}}/>
						<span style={{fontSize: 'x-large', color: 'gold', fontWeight: 'bold'}}>Genesis Circle NFT</span>
					</div>
					<p style={{textAlign: 'left' }}>
						Unlock Lifetime Access to Silent Pass VPN
					</p>
					<p style={{textAlign: 'left'}}>
						Your exclusive NFT Passport for unlimited private browsing.
					</p>
					<div style={{display: 'flex', alignItems:'center', justifyContent: 'center'}}>
						<span style={{fontSize: 'small'}}>One-Time Payment</span>
						<span style={{color: 'gold', fontWeight: 'bold', paddingLeft: '3rem', fontSize: 'large', paddingRight: '0.2rem'}}>$</span>
						<span style={{fontSize: 'xx-large', color: 'gold', fontWeight: 'bold'}}>41.99</span>
					</div>
					<p style={{color: '#989899'}}>
						1 Device · No Renewal · Lifetime Access
					</p>
					<button className='buttonPay' style={{}} onClick={startSubscription}>Start Purchase</button>
					<p style={{padding: '0.5rem 0', textAlign: 'left' }}>
						Purchase Information
					</p>
					<p style={{color: '#989899', textAlign: 'left'}}>
						This is a one-time purchase.
						
					</p>
					<p style={{color: '#989899', textAlign: 'left'}}>
						No subscription or renewal.
						
					</p>
					<p style={{color: '#989899', textAlign: 'left'}}>
						Includes lifetime VPN access for one device.
					</p>
					<p style={{color: '#989899', textAlign: 'left'}}>
						Payment will be charged to your Apple ID at confirmation.
					</p>
					<p style={{color: '#989899', textAlign: 'left'}}>
						By purchasing, you agree to Apple’s Terms of Use and Privacy Policy.
					</p>
					

				</div>
			</div>
          
        </div>
      </div>

      {
        isCongratsPopupOpen && (
          <SpClubCongratsPopup setIsCongratsPopupOpen={setIsCongratsPopupOpen} memberId={memberId} />
        )
      }
    </>
  )
}