import { useState } from 'react';
import Menu from '../../components/Menu';
import "./index.css";

const About = () => {
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false)

  const toggleMenu = () => {
    setIsMenuVisible(prevState => !prevState);
  }

  return (
    <>
      <div className="header">
        <div className="header-content">
          <div className="menu-icon" onClick={toggleMenu}>
            <img src="/assets/menu.svg"></img>
          </div>

          <div>
            <img src="/assets/header-title.svg"></img>
          </div>

          <div style={{ visibility: 'hidden' }}>
            lang
          </div>
        </div>
      </div>

      <Menu isMenuVisible={isMenuVisible} toggleMenu={toggleMenu} />

      <div className="about">
        <h1>About</h1>
        <p>Silent Pass is the next-generation decentralized dVPN designed to provide maximum privacy, security, and ease of use.</p>
        <p>Whether you're looking to browse the web safely or access content from anywhere, Silent Pass delivers a seamless experience without compromising your data.</p>
        <h2>Key Features</h2>
        <p>Decentralized VPN: Protect your privacy with no central servers—your data is never stored or tracked.</p>
        <p>Completely Free: Enjoy a secure dVPN without any fees or hidden charges.</p>
        <p>No Registration Needed: No email or phone number required. Simply download, click start, and you're connected!</p>
        <p>Secure & Private: Silent Pass ensures that your internet connection is encrypted, keeping you safe from prying eyes.</p>
      </div>
    </>
  );
};

export default About;