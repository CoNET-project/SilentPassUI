
import { ReactNode } from 'react'
import './index.css';

import { ReactComponent as ChevronArrow } from "./assets/right-chevron.svg";

import Switch from '../Switch';
import ReactCountryFlag from 'react-country-flag';
import RuleButton from './../Rules/RuleButton';

interface RegionSelectorProps {
  regionCode: string;
  icon?: string;
  title: string;
  action?: () => void;
  children?: ReactNode;
  toggle?: boolean;
  theme?: boolean;
  showArrow?: boolean;
  switchComp?: boolean;
  switchState?: boolean;
}

export default function RegionSelector({ regionCode, icon, title, action, children, switchComp, switchState = false, toggle = false, theme = false, showArrow = true }: RegionSelectorProps) {
  return (
    <div className="container-region" style={{ cursor: showArrow ? 'pointer' : 'not-allowed' }} onClick={action}>
      <div className="def">
        <div className="flag-icon-wrapper">
          <ReactCountryFlag
            countryCode={regionCode}
            svg
            aria-label="United States"
            style={{
              width: "100%",
              height: "100%",
              fontSize: "2em",
            }}
          />
        </div>
        {/* <p>{title}</p> */}
      </div>
      <div className="children">
        <RuleButton />
        {children}
        {
          showArrow && (
            <div className={`chevron ${toggle ? 'rotated' : ''}`}>
              <ChevronArrow />
            </div>
          )
        }
        {
          switchComp && <Switch state={switchState} icon={theme ? (switchState ? "/assets/dark-theme-icon.svg" : "/assets/light-theme-icon.svg") : undefined} />
        }
      </div>
    </div>
  )
}
