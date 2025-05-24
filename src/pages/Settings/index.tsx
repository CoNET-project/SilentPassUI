import ClickableItem from '../../components/ClickableItem';
import Footer from '../../components/Footer';
import './index.css';

import languageIcon from "./assets/language.svg";
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
  const { activePassport } = useDaemonContext();

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
      heading: t('Settings_Passcode'),
      items: [
        {
          id: 1,
          icon: lockIcon,
          title: t('Settings_Passcode_on'),
          // action: () => navigate("/passcode/new"),
          childrenText: t('Settings_Passcode_soon'),
        },
        {
          id: 2,
          icon: lockIcon,
          title: t('Settings_Passcode_change'),
          // action: () => navigate("/passcode/change"),
          childrenText: t('Settings_Passcode_soon'),
        }
      ]
    }, {
      heading: t('Settings_Passcode_Addon'),
      items: [
        {
          id: 1,
          icon: adsBlockIcon,
          title: t('Settings_Passcode_Ads'),
          childrenText: t('Settings_Passcode_soon'),
        },
        {
          id: 2,
          icon: extraRewardIcon,
          title: t('Settings_Passcode_Reward'),
          childrenText: '',
		  action: () => navigate("/wallet"),
        },
        {
          id: 3,
          icon: splitTunnelingIcon,
          title: t('Settings_Passcode_WebsiteFilter'),
          childrenText: '',
		  
        },
      ]
    },
  ]), [visible, navigate ]);

  const passportTitle = getPassportTitle(activePassport, t('passport_Freemium'), t('passport_Guardian'), t('passport_Annually'),t('passport_Quarter'),t('passport_Monthly'))

  return (
    <div className="page-container">
      <h1>{t('Settings_Title')}</h1>
      <div className="nft-info">
        <ActivePassportInfo />

        <div className="buttons">
          <button onClick={() => navigate("/wallet")}>{t('wallet_title')}</button>
          {/* <button disabled={(passportTitle !== 'Annually' && passportTitle !== 'Guardian') ? false : true} onClick={() => navigate("/subscription")}>
            <img src="./assets/conet-outline-gray.svg" />
            <span>Upgrade Passport</span>
          </button> */}
        </div>
      </div>

      <div className="options">
        {
          optionGroups.map((optionGroup) => (
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
                </div>
              </div>
            </>
          ))
        }
      </div>

      <Footer />
      <Languages visible={visible} setVisible={setVisible} />
    </div>
  )
}