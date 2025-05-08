import { useState } from 'react';
import Skeleton from '../Skeleton';

import { ReactComponent as ChevronArrow } from "./assets/right-chevron.svg";
import { useDaemonContext } from '../../providers/DaemonProvider';
import sharedDevice from './assets/share_devices.png'
type CopyProxyInfoProps = {

}

export default function CopyProxyInfo({ }: CopyProxyInfoProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isProxyServerCopied, setIsProxyServerCopied] = useState<boolean>(false);
  const [isProxyPortCopied, setIsProxyPortCopied] = useState<boolean>(false);
  const [isPACCopied, setIsPACCopied] = useState<boolean>(false);

  const { serverIpAddress, serverPort, serverPac } = useDaemonContext();

  const handleCopy = (text: string, setMethod: (val: boolean) => any) => {
    navigator.clipboard.writeText(text);

    setMethod(true);

    setTimeout(() => {
      setMethod(false);
    }, 2000);
  }

  return (
    <div className={`wallet-info-container ${isOpen ? 'open' : ''}`}>
      <div className="wallet-info-heading" onClick={() => setIsOpen((prev) => !prev)}>
        <img src = {sharedDevice} width="44px" />
        <ChevronArrow />
      </div>
      <hr />
      <div className="wallet-info">
        <p>Server:</p>
        {
          true ? (
            <button onClick={() => handleCopy(serverIpAddress, setIsProxyServerCopied)}>
              <p>{serverIpAddress}</p>
              {
                isProxyServerCopied ? (
                  <img src="/assets/check.svg" alt="Copy icon" />
                ) : (
                  <img src="/assets/copy-purple.svg" alt="Copy icon" />
                )
              }
            </button>
          ) : (
            <Skeleton width="100px" height="24px" />
          )
        }
      </div>

      <div className="wallet-info">
        <p>Port:</p>
        {
          true ? (
            <button onClick={() => handleCopy(serverPort, setIsProxyPortCopied)}>
              <p>{serverPort}</p>
              {
                isProxyPortCopied ? (
                  <img src="/assets/check.svg" alt="Copy icon" />
                ) : (
                  <img src="/assets/copy-purple.svg" alt="Copy icon" />
                )
              }
            </button>
          ) : (
            <Skeleton width="100px" height="24px" />
          )
        }
      </div>

      <div className="wallet-info">
        <p>PAC:</p>
        {
          true ? (
            <button onClick={() => handleCopy(serverPac, setIsPACCopied)}>
              <p>{serverPac}</p>
              {
                isPACCopied ? (
                  <img src="/assets/check.svg" alt="Copy icon" />
                ) : (
                  <img src="/assets/copy-purple.svg" alt="Copy icon" />
                )
              }
            </button>
          ) : (
            <Skeleton width="100px" height="24px" />
          )
        }
      </div>
    </div>
  )
}