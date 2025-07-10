import ClickableItem from '../../components/ClickableItem';
import Footer from '../../components/Footer';
import './index.css';

import helpIcon from "./assets/help.svg";
import languageIcon from "./assets/language.svg";
import systemProxi from './assets/applications.svg'

import adsBlockIcon from "./assets/ads-block.svg";
import extraRewardIcon from "./assets/extra-reward.svg";
import splitTunnelingIcon from "./assets/split-tunneling.svg";
import lockIcon from "./assets/lock-icon.svg";

import Separator from '../../components/Separator';
import { act, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ActivePassportInfo from '../../components/ActivePassportInfo';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { getPassportTitle } from '../../utils/utils';

import Languages from '../../components/Languages';
import { useTranslation } from 'react-i18next';

import Filter from './../../components/Rules/Filter';
import { Switch } from 'antd-mobile';
import ProxyInfo from '../../components/ProxyInfo';

type OptionGroup = {
  heading: string;
  items: {
    id: number;
    icon: string;
    title: string;
    childrenText?: string;
    action?: () => void;
    theme?: boolean;
  }[]
}

type OptionGroups = OptionGroup[];

export default function Settings() {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [visible2, setVisible2] = useState(false);
  const { activePassport, isLocalProxy, power,switchValue, setSwitchValue, quickLinksShow, setQuickLinksShow, isIOS } = useDaemonContext();


  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  function handleChangeTheme() {
    setTheme((prev) => prev === 'light' ? 'dark' : 'light')
  }

  const optionGroups = useMemo<OptionGroups>(() => ([
    {
      heading: t('Settings_General'),
      items: [
        {
          id: 1,
          icon: languageIcon,
          title: t('language'),
          childrenText: t(`${i18n.language}`),
          action: () => setVisible(true)
        },
        {
          id: 2,
          icon: helpIcon,
          title: t('faq'),
          action: () => navigate("/faq"),
        },
        {
          id: 5,
          icon: helpIcon,
          title: t('customer-service'),
		       //@ts-ignore
          action: () => {window?.Comm100API?.open_chat_window?.();}
        },
        
        /* {
          id: 2,
          icon: applicationIcon,
          title: "Applications",
          action: () => navigate("/applications")
        }, */
        // {
        //   id: 3,
        //   icon: themeIcon,
        //   title: "Theme",
        //   action: handleChangeTheme,
        //   theme: true,
        // }
      ]
    }, {
      heading: t('Settings_Passcode_Addon'),
      items: [
        {
          id: 3,
          icon: extraRewardIcon,
          title: t('Settings_Passcode_Reward'),
          childrenText: '',
		  action: () => navigate("/wallet"),
        },
        {
          id: 4,
          icon: splitTunnelingIcon,
          title: t('Settings_Passcode_WebsiteFilter'),
          action: () => setVisible2(true),
          childrenText: '',
		  
        },
      ]
    } 
    
  ]), [visible, navigate ]);

  const passportTitle = t(getPassportTitle(activePassport))

  const handleChangeSwitch=(val:boolean)=>{
      setSwitchValue(val)
      if(val && power){
        if (window?.webkit) {
          window?.webkit?.messageHandlers["startProxy"].postMessage("")
        }
      }else{
        if (window?.webkit) {
          window?.webkit?.messageHandlers["stopProxy"].postMessage("")
        }
      }
  }

  return (
    <div className="page-container">
      <h1>{t('Settings_Title')}</h1>
	  <p style={{color: '#676768', padding: '0.5rem 0'}}>Silent Pass UI v1.10.1</p>
      <div className="nft-info">
        <ActivePassportInfo />

        <div className="buttons">
          {/* <button onClick={() => navigate("/wallet")}>{t('wallet_title')}</button> */}
          {/* <button disabled={(passportTitle !== 'Annually' && passportTitle !== 'Guardian') ? false : true} onClick={() => navigate("/subscription")}>
            <img src="./assets/conet-outline-gray.svg" />
            <span>Upgrade Passport</span>
          </button> */}
        </div>
      </div>

      <div className="options">
        {
          
          optionGroups.map((optionGroup,index) => (
            <>
              <div className="option-group">
                <h3>{optionGroup.heading}</h3>
                <div>
                  
                  {optionGroup.items.map((item, index) => (
                    <>
                      <ClickableItem title={item.title} icon={item.icon} action={item?.action} switchState={item?.theme ? theme === 'light' : false} switchComp={item?.theme} theme={item?.theme} chevron={!item?.theme}>{item.childrenText && <p style={{}}>{item.childrenText}</p>}</ClickableItem>
                      {index < optionGroup.items.length - 1 && <Separator />}
                    </>
                  ))}
                  {
				  	index === 0 && isLocalProxy ? 
					<>
						<Separator />
						<div className="container">
							<div className="def">
								<div className="icon-wrapper">
									<img src={systemProxi} alt="Icon" />
								</div>
								<p>{t('system-proxy')}</p>
							</div>
							<div className="children">
								<Switch checked={switchValue} onChange={handleChangeSwitch} style={{'--height': '18px','--width': '38px'}} />
							</div>
						</div>
                  	</>:''
				  }
          {
            index === 1 ? 
          <>
            <Separator />
            <div className="container">
              <div className="def">
                <div className="icon-wrapper">
                  <img src={systemProxi} alt="Icon" />
                </div>
                <p>{t('quick-links')}</p>
              </div>
              <div className="children">
                <Switch checked={quickLinksShow} onChange={(val:boolean)=>{setQuickLinksShow(val)}} style={{'--height': '18px','--width': '38px'}} />
              </div>
            </div>
                    </>:''
          }
                </div>
              </div>
            </>
          ))
        }
        <div key={6}><ProxyInfo /></div>
      </div>

      <Footer />
      <Languages visible={visible} setVisible={setVisible} />
      <Filter visible={visible2} setVisible={setVisible2} />
    </div>
  )
}