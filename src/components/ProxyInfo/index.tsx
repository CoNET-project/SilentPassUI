import { useState } from 'react';
import ClickableItem from '../ClickableItem';

import proxyInfoIcon from "./assets/proxy-information.svg";
import Separator from '../Separator';
import Skeleton from '../Skeleton';
import sharedDevice from './assets/share_devices.png'

import './index.css';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { useTranslation } from 'react-i18next';

export default function ProxyInfo() {
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isProxyServerCopied, setIsProxyServerCopied] = useState<boolean>(false);
  const [isProxyPortCopied, setIsProxyPortCopied] = useState<boolean>(false);
  const [isPACCopied, setIsPACCopied] = useState<boolean>(false);

  const { serverPort, serverPac } = useDaemonContext();
    const { t, i18n } = useTranslation()
  

  const handleCopy = (text: string, setMethod: (val: boolean) => any) => {
    navigator.clipboard.writeText(text);

    setMethod(true);

    setTimeout(() => {
      setMethod(false);
    }, 2000);
  }

  return (
    <div className="option-group">
      <h3>{t('proxy-header')}</h3>
      <div className={`option-wrapper ${isDropdownOpen ? 'open' : ''}`}>
        <ClickableItem title={t('proxy-button-label')} icon={proxyInfoIcon} action={() => setIsDropdownOpen((prev) => !prev)} toggle={isDropdownOpen}></ClickableItem>
        <Separator />
        <ClickableItem title={t('proxy-server')} chevron={false}>
          
        </ClickableItem>
        <Separator />
        <ClickableItem title={t('proxy-port')} chevron={false}>
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
        </ClickableItem>
        <Separator />
        <ClickableItem title={t('proxy-pac')} chevron={false}>
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
        </ClickableItem>
      </div>
    </div>
  )
}