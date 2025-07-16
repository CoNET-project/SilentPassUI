import ClickableItem from '../../components/ClickableItem';
import Footer from '../../components/Footer';
import './index.css';
import { useDaemonContext } from "../../providers/DaemonProvider";
import helpIcon from "./assets/help.svg";

import Separator from '../../components/Separator';
import { useMemo } from 'react';
import ProxyInfo from '../../components/ProxyInfo';
import { useNavigate } from 'react-router-dom';

type OptionGroup = {
  id: number;
  heading: string;
  items: {
    id: number;
    icon: string;
    title: string;
    childrenText?: string;
    action?: () => void;
  }[]
}

type OptionGroups = OptionGroup[];

export default function Support() {
  const navigate = useNavigate();
	  const { version } = useDaemonContext()
  const optionGroups = useMemo<OptionGroups>(() => ([
    {
      id: 2,
      heading: "Proxy",
      items: [],
    }, {
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
    }
  ]), [navigate]);

  return (
    <div className="page-container">
      <h1>Support</h1>
	<p style={{textAlign: 'left', color: 'rgb(177, 177, 178)', fontSize: '0.6rem'}}>{version}</p>
      <div className="options">
        {
          optionGroups.map((optionGroup) => optionGroup.id === 2 ? <ProxyInfo /> : (
            <>
              <div className="option-group">
                <h3>{optionGroup.heading}</h3>
                <div>
                  {optionGroup.items.map((item, index) => (
                    <>
                      <ClickableItem title={item.title} icon={item.icon} action={item?.action}>{item.childrenText && <p>{item.childrenText}</p>}</ClickableItem>
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