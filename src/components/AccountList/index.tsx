import { useState } from 'react';
import './index.css';
import Separator from '../Separator';
import CopyAccountInfo from './CopyAccountInfo';
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

import { ReactComponent as ConetToken } from './assets/conet-token.svg';
import { ReactComponent as ConetEthToken } from './assets/conet-eth-token.svg';
import { ReactComponent as SolanaToken } from './assets/solana-token.svg';
import { ReactComponent as SpToken } from './assets/sp-token.svg';
import PassportInfo from '../PassportInfo';
import SelectActivePassportPopup from '../SelectActivePassportPopup';
import { refreshSolanaBalances, storeSystemData } from '../../services/wallets';
import { CoNET_Data } from '../../utils/globals';
import { useNavigate } from 'react-router-dom';
import SendButton from './SendButton';

interface AccountListProps {
    showMainWallet?: boolean;
    simplifiedView?: boolean;
    spInUsd?: number;
    solInUsd?: number;
}

export default function AccountList({ showMainWallet = true, simplifiedView = false, spInUsd = 0, solInUsd = 0 }: AccountListProps) {
    const [openAccountList, setOpenAccountList] = useState<string[]>([]);
    const { profiles, activePassport, setProfiles, randomSolanaRPC, getAllNodes, isIOS } = useDaemonContext();

    const [mainAccountAddressCopied, setMainAccountAddressCopied] = useState(false);
    const [solanaAccountAddressCopied, setSolanaAccountAddressCopied] = useState(false);
    const [passportToChange, setPassportToChange] = useState();
    const [isRefreshingSolanaBalances, setIsRefreshingSolanaBalances] = useState(false);

    const { isSelectPassportPopupOpen, setIsSelectPassportPopupOpen } = useDaemonContext();

    const navigate = useNavigate();

    function toggleAccount(accountAddress: string) {
        setOpenAccountList((prev) => (
            prev.includes(accountAddress) ? prev.filter((item) => item !== accountAddress) : [...prev, accountAddress]
        ))
    }

    function handleCopy(e: any, account: 'main' | 'solana') {
        e.preventDefault();

        if (account === 'main') {
            navigator.clipboard.writeText(profiles?.[0]?.keyID);
            setMainAccountAddressCopied(true);
        }

        if (account === 'solana') {
            navigator.clipboard.writeText(profiles?.[1]?.keyID);
            setSolanaAccountAddressCopied(true);
        }

        setTimeout(() => {
            setMainAccountAddressCopied(false);
            setSolanaAccountAddressCopied(false);
        }, 2000)
    }

    async function handleRefreshSolanaBalances() {
        setIsRefreshingSolanaBalances(true);

        try {
      
            await refreshSolanaBalances()

            storeSystemData()

            const tmpData = CoNET_Data;

            if (!tmpData) {
                return;
            }

            tmpData.profiles[1] = profiles?.[1];

            setProfiles(tmpData.profiles);
        } catch (ex) {
            console.log(ex);
        }

        setTimeout(() => setIsRefreshingSolanaBalances(false), 2000);
    }

    const renderRefreshButton = () => {
        if (!profiles?.[1]?.keyID) {
            return <p className='refresh disabled'>Refresh</p>
        }

        if (isRefreshingSolanaBalances) {
            return <p className='refresh'>Refreshing...</p>
        }

        return <p className='refresh' onClick={handleRefreshSolanaBalances}>Refresh</p>
    }

    return (
        <div className="account-list">
            {showMainWallet &&
                <div className={`account-wrapper ${simplifiedView ? 'simplified' : ''} ${openAccountList.includes(profiles?.[0]?.keyID) ? 'active' : ''}`}>
                    <div className="account-main-card" onClick={() => toggleAccount(profiles?.[0]?.keyID)}>
                        <div className="name">
                            <h3>Main Wallet</h3>
                            <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
                        </div>
                        {
                            simplifiedView && (
                                <div className="copy">
                                    {
                                        profiles?.[0].keyID ? (
                                          <p>{profiles?.[0]?.keyID?.slice(0, 5)}...{profiles?.[0]?.keyID?.slice(-5)}</p>
                                        ) : (
                                          <Skeleton width="100%" height="20px" />
                                        )
                                    }
                                    <button onClick={(e) => handleCopy(e, 'main')}>
                                        {
                                            mainAccountAddressCopied ? (
                                                <img src="/assets/check.svg" alt="Copy icon" />
                                            ) : (
                                                <img src="/assets/copy-purple.svg" alt="Copy icon" />
                                            )
                                        }
                                  </button>
                                </div>
                            )
                        }
                    </div>
                    <div className="info-card">
                        <div className="info-wrapper">
                            <div className='token-assets-title'>
                                <p className='title'>Token assets</p>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ConetToken />
                                    <p>$CONET</p>
                                </div>
                                <p>{profiles?.[0]?.tokens?.conetDepin?.balance || (0.0).toFixed(6)}</p>
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ConetEthToken />
                                    <p>$ETH</p>
                                </div>
                                <p>{profiles?.[0]?.tokens?.conet_eth?.balance || (0.0).toFixed(6)}</p>
                            </div>
                        </div>
                        {
                            !simplifiedView && (
                                <>
                                    <Separator />
                                    <div className="info-wrapper" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        <p>Silent Pass Passport</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
                                            {(profiles?.[0]?.silentPassPassports && profiles?.[0]?.activePassport)
                                                ? [...profiles?.[0]?.silentPassPassports]
                                                    .sort((a: any, b: any) => {
                                                        const isAActive = a?.nftID === activePassport?.nftID;
                                                        const isBActive = b?.nftID === activePassport?.nftID;
                                                        return isAActive === isBActive ? 0 : isAActive ? -1 : 1;
                                                    })
                                                    .map((passport: any) => (
                                                        <PassportInfo key={passport.nftID} passportInfo={passport} selectedValue={activePassport} onChange={() => {
                                                            setIsSelectPassportPopupOpen(true)
                                                            setPassportToChange(passport)
                                                        }} />
                                                    ))
                                                : <Skeleton width={'100%'} height={'20px'} />}
                                        </div>
                                    </div>

                                    <Separator />

                                    <CopyAccountInfo wallet={profiles?.[0]} showRecoveryPhrase={true} isEthers={true} />

                                    {/* 
                                    <Separator />

                                    <div>
                                        <button className='disabled'>
                                            <img src="/assets/conet-gray.svg" alt="Platform" />
                                            <p>Open CONET Platform</p>
                                        </button>
                                        <p>*Open CoNET Platform - Redeem Silent Pass passport and transfer Silent Pass passport to Silent Pass Account (public wallet address) if user has guardian NFT or CoNETian NFT.</p>
                                    </div>
                                    */}
                                </>
                            )
                        }
                    </div>
                </div>
            }

            {/* 
            {
                !simplifiedView && !isIOS && (
                    <div className="cta-buttons" style={{ marginBottom: "0px" }}>
                        <div className="highlight-1">
                            <button onClick={() => navigate('/transfer')}>
                                <p>Transfer Silent Pass Passport</p>
                            </button>
                        </div>
                    </div>
                )
            } 
            */}

            <div className={`account-wrapper solana ${simplifiedView ? 'simplified' : ''} ${openAccountList.includes("123") ? 'active' : ''}`}>
                <div className="account-main-card" onClick={() => toggleAccount("123")}>
                    <div className="name">
                        <h3>Solana Wallet</h3>
                        <img height='16px' width='16px' className="chevron" src="./assets/right-chevron.svg" />
                    </div>
                    {
                        simplifiedView && (
                            <div className="copy">
                                {
                                    profiles?.[1].keyID ? (
                                        <p>{profiles?.[1]?.keyID?.slice(0, 5)}...{profiles?.[1]?.keyID?.slice(-5)}</p>
                                    ) : (
                                        <Skeleton width="100%" height="20px" />
                                    )
                                }
                                <button onClick={(e) => handleCopy(e, 'solana')}>
                                    {
                                        solanaAccountAddressCopied ? (
                                            <img src="/assets/check.svg" alt="Copy icon" />
                                        ) : (
                                            <img src="/assets/copy-purple.svg" alt="Copy icon" />
                                        )
                                    }
                                </button>
                            </div>
                        )
                    }
                </div>

                <div className="info-card">
                    <div className="info-wrapper">
                        <div className='token-assets-title'>
                            <p className='title'>Token assets</p>
                            {renderRefreshButton()}
                        </div>
                        


                        <div className="token-assets-item">
                            <div className="token-assets-item-lt">
                                <div className="token-assets-item-label">
                                    <div className="token-assets-item-label-name">
                                        <SpToken width={20} height={20}/>
                                        {
                                            simplifiedView ? (
                                                <div>
                                                    <p>Silent Pass</p>
                                                    <p>{profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</p>
                                                </div>
                                            ) : (
                                                <p>$SP</p>
                                            )
                                        }
                                    </div>
                                    {
                                        !simplifiedView && 
                                            <div className='asset-second-line'>
                                                <p>{profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2)}</p>
                                            </div>
                                    }
                                </div>
                                <SendButton type={'$SP'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={simplifiedView ? (spInUsd * parseFloat(profiles?.[1]?.tokens?.sp?.usd || '0')).toFixed(2) :profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)} balance={simplifiedView?(profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)):(profiles?.[1]?.tokens?.sp?.balance || (0.0).toFixed(2))} />
                            </div>
                            <div className="token-assets-item-val">
                                {
                                    simplifiedView ? (
                                        <p>${(spInUsd * parseFloat(profiles?.[1]?.tokens?.sp?.usd || '0')).toFixed(2)}</p>
                                    ) : (
                        
                                       <p>${profiles?.[1]?.tokens?.sp?.usd || (0.0).toFixed(2)}</p>
                    
                                    )
                                }
                            </div>
                        </div>

                        <div className="token-assets-item">
                            <div className="token-assets-item-lt">
                                <div className="token-assets-item-label">
                                    <div className="token-assets-item-label-name">
                                        <SolanaToken width={20} height={20}/>
                                        {
                                            simplifiedView ? (
                                                <div>
                                                    <p>Solana</p>
                                                    <p>{profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)}</p>
                                                </div>
                                            ) : (
                                                <p>$SOL</p>
                                            )
                                        }
                                    </div>
                                    {
                                        !simplifiedView && 
                                            <div className='asset-second-line'>
                                                <p>{profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)}</p>
                                            </div>
                                    }
                                </div>
                                <SendButton type={'$SOL'} wallet={profiles?.[1]} isEthers={false} handleRefreshSolanaBalances={handleRefreshSolanaBalances} usd={simplifiedView ? (solInUsd * parseFloat(profiles?.[1]?.tokens?.sol?.balance || '0')).toFixed(2) :profiles?.[1]?.tokens?.sol?.usd || (0.0).toFixed(2)} balance={profiles?.[1]?.tokens?.sol?.balance || (0.0).toFixed(6)} />
                            </div>
                            <div className="token-assets-item-val">
                                {
                                    simplifiedView ? (
                                        <p>${(solInUsd * parseFloat(profiles?.[1]?.tokens?.sol?.balance || '0')).toFixed(2)}</p>
                                    ) : (
                                        <p>${profiles?.[1]?.tokens?.sol?.usd || (0.0).toFixed(2)}</p>
                                    )
                                }
                            </div>
                        </div>


                        
      
                    </div>
                    {
                        !simplifiedView && (
                            <>
                                <Separator />
                                <CopyAccountInfo wallet={profiles?.[1]} isEthers={false} />
                            </>
                        )
                    }
                </div>
    
            </div>

            {
                isSelectPassportPopupOpen && (
                    <SelectActivePassportPopup
                        newPassport={passportToChange}
                    />
                )
            }
        </div>
    )
}