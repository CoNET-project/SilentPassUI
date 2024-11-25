import { useNavigate } from 'react-router-dom';

type MenuProps = {
  isMenuVisible: boolean;
  toggleMenu: () => void;
}

export default function Menu({ isMenuVisible, toggleMenu }: MenuProps) {
  const navigate = useNavigate();

  return (
    <div className={`menu ${isMenuVisible ? 'menu-visible' : ''}`}>
      <div className="menu-content">
        <div>
          <img src="/assets/header-title.svg"></img>
        </div>

        <div className="menu-container">
          <a className="menu-item" href="https://conet.network/" target="_blank" rel="noreferrer">
            <img src="/assets/site-icon.svg" width={24} height={24} />
            Open CoNET Website
          </a>

          <a className="menu-item" href="https://t.me/conet_network" target="_blank" rel="noreferrer">
            <img src="/assets/telegram-icon.svg" width={24} height={24} />
            Join Telegram Group
          </a>

          <a className="menu-item" href="https://twitter.com/CoNET_Network" target="_blank" rel="noreferrer">
            <img src="/assets/twitter-icon.svg" width={24} height={24} />
            Follow us on Twitter
          </a>

          <a className="menu-item" href="https://discord.gg/JrpMBFkewd" target="_blank" rel="noreferrer">
            <img src="/assets/discord-icon.svg" width={24} height={24} />
            Join Discord Server
          </a>

          <button className="menu-item" onClick={() => navigate("/about")}>
          <img src="/assets/about.svg" width={24} height={24} />
            About
          </button>

          {/* <div className="menu-item">
            <img src="/assets/info-icon.svg" width={24} height={24} />
            About
          </div> */}
        </div>

        <div className="menu-footer">
          <div className="menu-footer-content">
            <div className="menu-item" onClick={() => {
              toggleMenu()
              navigate('/')
            }}>
              <img src="/assets/exit-icon.svg" width={24} height={24} />
              Return to homepage
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}