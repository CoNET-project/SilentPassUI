import { ReactNode } from 'react'
import './index.css';

import { ReactComponent as ChevronArrow } from "./assets/right-chevron.svg";

import Switch from '../Switch';
import { useTranslation } from 'react-i18next';

interface ClickableItemProps {
  icon?: string;
  title: string;
  action?: () => void;
  children?: ReactNode;
  toggle?: boolean;
  theme?: boolean;
  chevron?: boolean;
  switchComp?: boolean;
  switchState?: boolean;
}

export default function ClickableItem({ icon, title, action, children, switchComp, switchState = false, toggle = false, theme = false, chevron = true }: ClickableItemProps) {
  const { t, i18n } = useTranslation();
  return (
    <div className="container" onClick={action}>
      <div className="def">
        {
          icon && (
            <div className="icon-wrapper">
              <img src={icon} alt="Icon" />
            </div>
          )
        }
        <p>{title}</p>
      </div>
      <div className="children">
        {title=='Language'?t('lang'):children}
        {
          chevron && (
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