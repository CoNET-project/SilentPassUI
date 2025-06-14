// File is deprecated, moved to settings page

import {useState,useRef,useEffect,useCallback,CSSProperties} from 'react';
import ClickableItem from '../../components/ClickableItem';
import Footer from '../../components/Footer';
import './index.css';

import helpIcon from "./assets/help.svg";

import Separator from '../../components/Separator';
import { useMemo } from 'react';
import ProxyInfo from '../../components/ProxyInfo';
import { useNavigate } from 'react-router-dom';
import { Popup } from 'antd-mobile';

declare global {
  interface Window {
    Comm100API?: {
      open_chat_window?: () => void;
      [key: string]: any; // optional, to allow more properties if needed
    };
  }
}

type OptionGroup = {
  id: number;
  heading: string;
  items: {
    id: number;
    icon: string;
    title: string;
    divId?: string;
    childrenText?: string;
    action?: () => void;
  }[]
}

type OptionGroups = OptionGroup[];

export default function Support() {
  const navigate = useNavigate();
  



  const optionGroups = useMemo<OptionGroups>(() => ([
    {
      id: 2,
      heading: "Proxy",
      items: [],
    }, 
    {
      id: 3,
      heading: "About",
      items: [
        {
          id: 1,
          icon: helpIcon,
          title: "FAQ",
          action: () => navigate("/faq"),
        },
        // {
        //   id: 2,
        //   icon: helpIcon,
        //   title: "Config device",
        //   action: () => navigate("/config-device"),
        // }
      ]
    },
    {
      id: 4,
      heading: "Customer service",
      items: [
        {
          id: 5,
          icon: helpIcon,
          title: "Customer Service",
		  //@ts-ignore
          action: () => {window?.Comm100API?.open_chat_window?.();}
        },
      ]
    }
  ]), [navigate]);

  return (
	
    <div className="page-container">
      <h1>Support</h1>

      <div className="options">
        {

          optionGroups.map((optionGroup,i) => optionGroup.id === 2 ? <div key={i}><ProxyInfo /></div> : (
              <div className="option-group" key={i}>
                <h3>{optionGroup.heading}</h3>
                <div>
                  {optionGroup.items.map((item, index) => (
                    <div key={index}>
                      <div id={item&&item.divId?item.divId:''}><ClickableItem title={item.title} icon={item.icon} action={item?.action}>{item.childrenText && <p>{item.childrenText}</p>}</ClickableItem></div>
                      {index < optionGroup.items.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </div>
          ))
        }
      </div>

      
      

      <Footer />
    </div>
  )
}