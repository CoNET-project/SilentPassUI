import { useState } from 'react';
import Separator from '../Separator';
import { CoNET_Data } from '../../utils/globals';
import Skeleton from '../Skeleton';
import CodeButton from './CodeButton';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";
import { ethers } from 'ethers';
import {aesGcmEncrypt} from '../../services/subscription'
import { useTranslation } from 'react-i18next'
import styles from './copyAccountInfo.module.css';

let copyTimeoutId: NodeJS.Timeout;

export default function CopyAccountInfo({ wallet, showRecoveryPhrase = false, isEthers = true }: any) {
  const [copied, setCopied] = useState({
    address: "",
    info: "",
  });

  const [isAddressHidden, setIsAddressHidden] = useState(false);
  const [isKeyHidden, setIsKeyHidden] = useState(true);
  const [isWordsHidden, setIsWordsHidden] = useState(true);
  const { t, i18n } = useTranslation()

  function handleCopy(info: string) {
    let value = '';

    if (info === 'address')
      value = wallet.keyID
    else if (info === 'key')
      value = wallet.privateKeyArmor
    else if (info === 'words')
      value = "https://backup.silentpass.io/?words=" + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')

    navigator.clipboard.writeText(value);
    setCopied({ address: value, info });

    if (copyTimeoutId)
      clearTimeout(copyTimeoutId)

    copyTimeoutId = setTimeout(() => setCopied({
      address: '',
      info: '',
    }), 3000);
  }

  const getAddress = (wallet: any) => {
    if (isEthers) {
      return ethers.getAddress(wallet?.keyID).slice(0, 7) + '...' + ethers.getAddress(wallet?.keyID).slice(-5);
    }
    return wallet?.keyID.slice(0, 7) + '...' + wallet?.keyID.slice(-5);
  }
  const getWholeAddress = (wallet: any) => {
    if (isEthers) {
      return ethers.getAddress(wallet?.keyID);
    }
    return wallet?.keyID;
  }
//	profiles?.[1]?.tokens?.sp?.balance
  return (
	
    <>
      <div className={styles.copyDiv}>
        {wallet?.keyID ?
          <>
            <div className={styles.copyDivLt}>
              <div className={styles.copyText}>
                <p>{t(/^0x/.test(wallet?.keyID) ? 'comp-comm-wallet-address': 'comp-comm-wallet-address-1')} </p>
                {
                  isAddressHidden ?
                    <div style={{ filter: 'blur(3px)' }}>
                      <span>{getAddress(wallet)}
                      </span>
                    </div>
                    :
                    <span>{getAddress(wallet)}
                    </span>
                }
              </div>
              <CodeButton copyVal={getWholeAddress(wallet)} isEthers={isEthers} />
            </div>
            <div className={styles.buttonList}>
              <button onClick={() => handleCopy("address")}>
                {
                  (copied.address === wallet?.keyID && copied.info === "address") ? (
                    <img src="/assets/check.svg" alt="Copy icon" />
                  ) : (
                    <img src="/assets/copy-purple.svg" alt="Copy icon" />
                  )
                }
              </button>
              <button className={isAddressHidden ? styles.hidden : ""} onClick={() => setIsAddressHidden((prev) => !prev)}>
                {
                  isAddressHidden ? <VisibilityOffIcon /> : <VisibilityOnIcon />
                }
              </button>
            </div>
          </>
          : <Skeleton width='100%' height='20px' />
        }
      </div>
      <Separator />
      <div className={styles.copyDiv}>
        {wallet?.privateKeyArmor ?
          <>
            <div className={styles.copyText}>
              <p>{t('comp-comm-privatekey')} </p>
              {
                isKeyHidden ?
                  <div style={{ filter: 'blur(3px)' }}>
                    <span>{wallet.privateKeyArmor.slice(0, 7)}...{wallet.privateKeyArmor.slice(-5)}
                    </span>
                  </div>
                  : <span>{wallet.privateKeyArmor.slice(0, 7)}...{wallet.privateKeyArmor.slice(-5)}
                  </span>
              }
            </div>
            <div className={styles.buttonList}>
              <button onClick={() => handleCopy("key")}>
                {
                  (copied.address === wallet?.privateKeyArmor && copied.info === "key") ? (
                    <img src="/assets/check.svg" alt="Copy icon" />
                  ) : (
                    <img src="/assets/copy-purple.svg" alt="Copy icon" />
                  )
                }
              </button>
              <button className={isKeyHidden ? styles.hidden : ""} onClick={() => setIsKeyHidden((prev) => !prev)}>
                {
                  isKeyHidden ? <VisibilityOffIcon /> : <VisibilityOnIcon />
                }
              </button>
            </div>
          </>
          : <Skeleton width='100%' height='20px' />
        }
      </div>

      {showRecoveryPhrase && <>
        <Separator />
        <div className={styles.copyDiv}>
          {CoNET_Data?.mnemonicPhrase ?
            <>
		
              {/* <div className={styles.copyText}>
                <p>{t('comp-comm-RecoveryPhrase')} </p>
                {
                  isWordsHidden ?
                    <div style={{ filter: 'blur(3px)', wordBreak:'break-all' }}>
                      <a href={"https://backup.silentpass.io/?words=" + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')} target="_blank">{"https://backup.silentpass.io/?words=" + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')}</a>
                      <span style={{marginTop:'3px'}}>{t('comp-comm-RecoveryPhrase-info')}</span>
                    </div>
                    :
                    <div style={{wordBreak:'break-all'}}>
                      <a href={"https://backup.silentpass.io/?words=" + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')} target="_blank">{"https://backup.silentpass.io/?words=" + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')}</a>
                      <span style={{marginTop:'3px'}}>{t('comp-comm-RecoveryPhrase-info')}</span>
                    </div>
                }
              </div>
              <div className={styles.buttonList}>
                <button onClick={() => handleCopy("words")}>
                  {
                    (copied.address === ("https://backup.silentpass.io/?words=" + (CoNET_Data?.mnemonicPhrase || '').replace(/\s+/g, '_')) && copied.info === "words") ? (
                      <img src="/assets/check.svg" alt="Copy icon" />
                    ) : (
                      <img src="/assets/copy-purple.svg" alt="Copy icon" />
                    )
                  }
                </button>
                <button className={isWordsHidden ? styles.hidden : ""} onClick={() => setIsWordsHidden((prev) => !prev)}>
                  {
                    isWordsHidden ? <VisibilityOffIcon /> : <VisibilityOnIcon />
                  }
                </button>
              </div> */}
            </>
            : <Skeleton width='20px' height='20px' />
          }
        </div>
      </>
      }
    </>
  )
}