import ClickableItem from '../../components/ClickableItem';
import Footer from '../../components/Footer';
import './index.css';

import languageIcon from "./assets/language.svg";
import adsBlockIcon from "./assets/ads-block.svg";
import extraRewardIcon from "./assets/extra-reward.svg";
import splitTunnelingIcon from "./assets/split-tunneling.svg";
import lockIcon from "./assets/lock-icon.svg";

import Separator from '../../components/Separator';
import { act, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActivePassportInfo from '../../components/ActivePassportInfo';
import { useDaemonContext } from '../../providers/DaemonProvider';
import { getPassportTitle } from '../../utils/utils';

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
  const { activePassport } = useDaemonContext();

  const navigate = useNavigate();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  function handleChangeTheme() {
    setTheme((prev) => prev === 'light' ? 'dark' : 'light')
  }

  const optionGroups = useMemo<OptionGroups>(() => ([
    {
      heading: "General",
      items: [
        {
          id: 1,
          icon: languageIcon,
          title: "Language",
          childrenText: "English",
          action: () => navigate("/languages")
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
      heading: "Passcode",
      items: [
        {
          id: 1,
          icon: lockIcon,
          title: "Turn passcode on",
          // action: () => navigate("/passcode/new"),
          childrenText: "soon",
        },
        {
          id: 2,
          icon: lockIcon,
          title: "Change passcode",
          // action: () => navigate("/passcode/change"),
          childrenText: "soon",
        }
      ]
    }, {
      heading: "Add-on",
      items: [
        {
          id: 1,
          icon: adsBlockIcon,
          title: "Ads Block",
          childrenText: "soon",
        },
        {
          id: 2,
          icon: extraRewardIcon,
          title: "Extra Reward",
          childrenText: "soon",
        },
        {
          id: 3,
          icon: splitTunnelingIcon,
          title: "Split Tunelling",
          childrenText: "soon",
        },
      ]
    },
  ]), [navigate]);

  const passportTitle = getPassportTitle(activePassport)

  return (
    <div className="page-container">
      <h1>Settings</h1>
      <div className="nft-info">
        <ActivePassportInfo />

        <div className="buttons">
          <button onClick={() => navigate("/wallet")}>My Account</button>
          <button disabled={(passportTitle !== 'Premium' && passportTitle !== 'Guardian') ? false : true} onClick={() => navigate("/subscription")}>
            <img src="./assets/conet-outline-gray.svg" />
            <span>Upgrade Passport</span>
          </button>
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
                      <ClickableItem title={item.title} icon={item.icon} action={item?.action} switchState={item?.theme ? theme === 'light' : false} switchComp={item?.theme} theme={item?.theme} chevron={!item?.theme}>{item.childrenText && <p>{item.childrenText}</p>}</ClickableItem>
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
    </div>
  )
}