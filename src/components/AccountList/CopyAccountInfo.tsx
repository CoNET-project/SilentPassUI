import { useState } from 'react';
import Separator from '../Separator';
import { CoNET_Data } from '../../utils/globals';
import Skeleton from '../Skeleton';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";

let copyTimeoutId: NodeJS.Timeout;

export default function CopyAccountInfo({ wallet, showRecoveryPhrase = false }: any) {
  const [copied, setCopied] = useState({
    address: "",
    info: "",
  });

  const [isAddressHidden, setIsAddressHidden] = useState(true);
  const [isKeyHidden, setIsKeyHidden] = useState(true);
  const [isWordsHidden, setIsWordsHidden] = useState(true);

  function handleCopy(info: string) {
    let value = '';

    if (info === 'address')
      value = wallet.keyID
    else if (info === 'key')
      value = wallet.privateKeyArmor
    else if (info === 'words')
      value = CoNET_Data?.mnemonicPhrase || ''

    navigator.clipboard.writeText(value);
    setCopied({ address: value, info });

    if (copyTimeoutId)
      clearTimeout(copyTimeoutId)

    copyTimeoutId = setTimeout(() => setCopied({
      address: '',
      info: '',
    }), 3000);
  }

  return (
    <>
      <div className="copy-div">
        {wallet?.keyID ?
          <>
            <div className="copy-text">
              <p>Wallet Address</p>
              {
                isAddressHidden ?
                  <div style={{ filter: 'blur(3px)' }}>
                    <span>{wallet.privateKeyArmor.slice(0, 5)}...{wallet.privateKeyArmor.slice(-5)}
                    </span>
                  </div>
                  :
                  <span>{wallet.privateKeyArmor.slice(0, 5)}...{wallet.privateKeyArmor.slice(-5)}
                  </span>
              }
            </div>
            <div className="button-list">
              <button onClick={() => handleCopy("address")}>
                {
                  (copied.address === wallet?.keyID && copied.info === "address") ? (
                    <img src="/assets/check.svg" alt="Copy icon" />
                  ) : (
                    <img src="/assets/copy-purple.svg" alt="Copy icon" />
                  )
                }
              </button>
              <button className={isAddressHidden ? "hidden" : ""} onClick={() => setIsAddressHidden((prev) => !prev)}>
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
      <div className="copy-div">
        {wallet?.privateKeyArmor ?
          <>
            <div className="copy-text">
              <p>Private Key</p>
              {
                isKeyHidden ?
                  <div style={{ filter: 'blur(3px)' }}>
                    <span>{wallet.privateKeyArmor.slice(0, 5)}...{wallet.privateKeyArmor.slice(-5)}
                    </span>
                  </div>
                  : <span>{wallet.privateKeyArmor.slice(0, 5)}...{wallet.privateKeyArmor.slice(-5)}
                  </span>
              }
            </div>
            <div className="button-list">
              <button onClick={() => handleCopy("key")}>
                {
                  (copied.address === wallet?.privateKeyArmor && copied.info === "key") ? (
                    <img src="/assets/check.svg" alt="Copy icon" />
                  ) : (
                    <img src="/assets/copy-purple.svg" alt="Copy icon" />
                  )
                }
              </button>
              <button className={isKeyHidden ? "hidden" : ""} onClick={() => setIsKeyHidden((prev) => !prev)}>
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
        <div className="copy-div">
          {CoNET_Data?.mnemonicPhrase ?
            <>
              <div className="copy-text">
                <p>Recovery Phrase</p>
                {
                  isWordsHidden ?
                    <div style={{ filter: 'blur(3px)' }}>
                      <span>{CoNET_Data?.mnemonicPhrase || ''}</span>
                    </div>
                    :
                    <span>{CoNET_Data?.mnemonicPhrase || ''}</span>
                }
              </div>
              <div className="button-list">
                <button onClick={() => handleCopy("words")}>
                  {
                    (copied.address === CoNET_Data?.mnemonicPhrase && copied.info === "words") ? (
                      <img src="/assets/check.svg" alt="Copy icon" />
                    ) : (
                      <img src="/assets/copy-purple.svg" alt="Copy icon" />
                    )
                  }
                </button>
                <button className={isWordsHidden ? "hidden" : ""} onClick={() => setIsWordsHidden((prev) => !prev)}>
                  {
                    isWordsHidden ? <VisibilityOffIcon /> : <VisibilityOnIcon />
                  }
                </button>
              </div>
            </>
            : <Skeleton width='20px' height='20px' />
          }
        </div>
      </>
      }
    </>
  )
}