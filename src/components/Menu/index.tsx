import { useNavigate } from 'react-router-dom';
import "./index.css";
import { useEffect, useState } from 'react';
import copy from 'copy-to-clipboard';
import { FaCheck } from "react-icons/fa6";

type MenuProps = {
  isMenuVisible: boolean;
  toggleMenu: () => void;
}

const WEBSITE_LINK = "https://conet.network/";
const TELEGRAM_LINK = "https://t.me/conet_network";
const TWITTER_LINK = "https://twitter.com/CoNET_Network";
const DISCORD_LINK = "https://discord.gg/JrpMBFkewd";

export default function Menu({ isMenuVisible, toggleMenu }: MenuProps) {
  const navigate = useNavigate();
  const [copiedWebsiteLink, setCopiedWebsiteLink] = useState<boolean>(false);
  const [copiedTelegramLink, setCopiedTelegramLink] = useState<boolean>(false);
  const [copiedTwitterLink, setCopiedTwitterLink] = useState<boolean>(false);
  const [copiedDiscordLink, setCopiedDiscordLink] = useState<boolean>(false);


  const copyText = (type: string) => {
    if (type === "website") {
      copy(WEBSITE_LINK);
      setCopiedWebsiteLink(true);
      return;
    }
    if (type === "telegram") {
      copy(TELEGRAM_LINK);
      setCopiedTelegramLink(true);
      return;
    }
    if (type === "twitter") {
      copy(TWITTER_LINK);
      setCopiedTwitterLink(true);
      return;
    }
    if (type === "discord") {
      copy(DISCORD_LINK);
      setCopiedDiscordLink(true);
      return;
    }
  };

  useEffect(() => {
    if (copiedWebsiteLink) {
      setTimeout(() => {
        setCopiedWebsiteLink(false);
      }, 4000);
    }
    if (copiedTelegramLink) {
      setTimeout(() => {
        setCopiedTelegramLink(false);
      }, 4000);
    }
    if (copiedTwitterLink) {
      setTimeout(() => {
        setCopiedTwitterLink(false);
      }, 4000);
    }
    if (copiedDiscordLink) {
      setTimeout(() => {
        setCopiedDiscordLink(false);
      }, 4000);
    }
  }, [copiedWebsiteLink, copiedTelegramLink, copiedTwitterLink, copiedDiscordLink]);

  return (
    <div className={`menu ${isMenuVisible ? 'menu-visible' : ''}`}>
      <div className="menu-content">
        <div>
          <img src="/assets/header-title.svg"></img>
        </div>

        <div className="menu-container">
          <div>
            <a className="menu-item" href="https://conet.network/" target="_blank" rel="noreferrer">
              <img src="/assets/site-icon.svg" width={24} height={24} />
              Open CoNET Website
            </a>
            <span style={{ marginLeft: '40px', width: '100%', display: 'flex', flexDirection: 'row', gap: '8px' }}>
              {WEBSITE_LINK}

              <button
                style={{ backgroundColor: 'transparent', border: 'none', padding: '0px', display: 'flex', alignItems: 'end' }}
                onClick={() => copyText("website")}
              >
                {copiedWebsiteLink ? (
                  <FaCheck color='#FFFFFF' />
                ) : (
                  <img
                    src='/assets/copy-white.svg'
                    height={16}
                    width={16}
                    alt="Copy Link"
                  />
                )}
              </button>
            </span>
          </div>

          <div>
            <a className="menu-item" href="https://t.me/conet_network" target="_blank" rel="noreferrer">
              <img src="/assets/telegram-icon.svg" width={24} height={24} />
              Join Telegram Group
            </a>
            <span style={{ marginLeft: '40px', width: '100%', display: 'flex', flexDirection: 'row', gap: '8px' }}>
              {TELEGRAM_LINK}

              <button
                style={{ backgroundColor: 'transparent', border: 'none', padding: '0px', display: 'flex', alignItems: 'end' }}
                onClick={() => copyText("telegram")}
              >
                {copiedTelegramLink ? (
                  <FaCheck color='#FFFFFF' />
                ) : (
                  <img
                    src='/assets/copy-white.svg'
                    height={16}
                    width={16}
                    alt="Copy Link"
                  />
                )}
              </button>
            </span>
          </div>

          <div>
            <a className="menu-item" href="https://twitter.com/CoNET_Network" target="_blank" rel="noreferrer">
              <img src="/assets/twitter-icon.svg" width={24} height={24} />
              Follow us on Twitter
            </a>
            <span style={{ marginLeft: '40px', width: '100%', display: 'flex', flexDirection: 'row', gap: '8px' }}>
              {TWITTER_LINK}

              <button
                style={{ backgroundColor: 'transparent', border: 'none', padding: '0px', display: 'flex', alignItems: 'end' }}
                onClick={() => copyText("twitter")}
              >
                {copiedTwitterLink ? (
                  <FaCheck color='#FFFFFF' />
                ) : (
                  <img
                    src='/assets/copy-white.svg'
                    height={16}
                    width={16}
                    alt="Copy Link"
                  />
                )}
              </button>
            </span>
          </div>

          <div>
            <a className="menu-item" href="https://discord.gg/JrpMBFkewd" target="_blank" rel="noreferrer">
              <img src="/assets/discord-icon.svg" width={24} height={24} />
              Join Discord Server
            </a>
            <span style={{ marginLeft: '40px', width: '100%', display: 'flex', flexDirection: 'row', gap: '8px' }}>
              {DISCORD_LINK}

              <button
                style={{ backgroundColor: 'transparent', border: 'none', padding: '0px', display: 'flex', alignItems: 'end' }}
                onClick={() => copyText("discord")}
              >
                {copiedDiscordLink ? (
                  <FaCheck color='#FFFFFF' />
                ) : (
                  <img
                    src='/assets/copy-white.svg'
                    height={16}
                    width={16}
                    alt="Copy Link"
                  />
                )}
              </button>
            </span>
          </div>

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
    </div >
  )
}