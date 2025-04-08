import { useEffect, useState } from 'react';
import BackButton from '../../components/BackButton';
import ProxyInfo from '../../components/ProxyInfo';

import applicationIcon from './assets/application.svg';

import './index.css';
import ClickableItem from '../../components/ClickableItem';
import Separator from '../../components/Separator';
import Footer from '../../components/Footer';
import { useNavigate } from 'react-router-dom';

export default function Applications() {
  const [applications, setApplications] = useState({
    chrome: false,
    facebook: false,
    instagram: false,
    telegram: false,
    safari: false,
    x: false,
    whatsapp: false,
    youtube: false,
  })

  const navigate = useNavigate();

  useEffect(() => navigate("/"), [navigate]);

  return (
    <div className="page-container">
      <BackButton to="/settings" />
      <h1>Applications</h1>

      <div className="application-list">
        <ClickableItem
          title="Chrome"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.chrome} switchComp
          action={() => setApplications((prev) => ({ ...prev, chrome: !prev.chrome }))} />
        <Separator />
        <ClickableItem
          title="Facebook"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.facebook} switchComp
          action={() => setApplications((prev) => ({ ...prev, facebook: !prev.facebook }))} />
        <ClickableItem
          title="Instagram"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.instagram} switchComp
          action={() => setApplications((prev) => ({ ...prev, instagram: !prev.instagram }))} />
        <Separator />
        <ClickableItem
          title="Telegram"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.telegram} switchComp
          action={() => setApplications((prev) => ({ ...prev, telegram: !prev.telegram }))} />
        <ClickableItem
          title="Safari"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.safari} switchComp
          action={() => setApplications((prev) => ({ ...prev, safari: !prev.safari }))} />
        <ClickableItem
          title="X"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.x} switchComp
          action={() => setApplications((prev) => ({ ...prev, x: !prev.x }))} />
        <ClickableItem
          title="WhatsApp"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.whatsapp} switchComp
          action={() => setApplications((prev) => ({ ...prev, whatsapp: !prev.whatsapp }))} />
        <ClickableItem
          title="Youtube"
          icon={applicationIcon}
          chevron={false}
          switchState={applications.youtube} switchComp
          action={() => setApplications((prev) => ({ ...prev, youtube: !prev.youtube }))} />
      </div>

      <ProxyInfo />

      <div className="how-to-setup">
        <h3>How to setup</h3>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
          ut labore et dolore magna aliqua. Ut enim ad minim veniam,quis nostrud exercitation ullamco
          laboris nisi ut aliquip ex ea commodo consequat.
        </p>
      </div>

      <Footer />
    </div>
  )
}