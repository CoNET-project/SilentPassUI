import BackButton from '../../components/BackButton';

import SilentPassServiceTable from "./assets/silent-pass-service-table.svg";
import SilentPassBenefitsTable from "./assets/silent-pass-benefits-table.svg";

import "./index.css";
import { PROXY_PAC, PROXY_PORT, PROXY_SERVER } from '../../utils/constants';

const FAQ = () => {
  return (
    <div className="page-container text-display faq">
      <BackButton to="/support" />
      <h1>FAQ</h1>
      <div>
        <h3>What’s the Silent Pass service level and the benefits?</h3>
        <p>Service Levels and Benefits: (for both Proxy and VPN)</p>
        <img alt="Silent Pass Benefits Table" src={SilentPassBenefitsTable} />
        <p>Annual Silent Pass users are eligible to run Light Node on CoNET DePIN network without staking required within the Silent Pass service validity period, to earn $CONET token reward in return.  Please refer to Light Node session for details.</p>
      </div>
      <div>
        <h3>What’s the rate for Silent Pass service?</h3>
        <img alt="Silent Pass Service Table" src={SilentPassServiceTable} />
        <p>Silent Pass token is the only accepted token for service subscription.</p>
      </div>
      <div>
        <h3>What’s my Silent Pass Wallet? How can I get my Silent Pass Wallet?</h3>
        <p>Silent Pass Wallet are unique identity for each device. The Silent Pass Passport need to be transfer to your device’s Silent Pass wallet, then your Silent Pass service would be initiated.</p>
      </div>
      <div>
        <h3>What’s different of Silent Pass Proxy & Silent Pass VPN?</h3>
        <p>We offer 2 different Silent Pass services to better fit your need. </p>
        <ul>
          <li>Silent Pass Proxy is the application runs on your PC/laptop to provide VPN protection for your web browser.</li>
          <li>Silent Pass VPN APP can be download in apple store, it runs on your mobile/MAC/other devise to provide VPN protection for your entire device. It’s available for iPhone and MAC at this stage, Silent Pass Android APP coming soon.</li>
        </ul>
      </div>
      <h2>Silent Pass VPN</h2>
      <div>
        <h3>How can I use Silent Pass VPN?</h3>
        <p>Please refer to <a href="https://youtube.com/shorts/ZhhF7_uCrZ4" target="_blank">Tutorial Video</a> for step-by-step guidance.</p>
      </div>
      <div>
        <h3>How to transfer the Silent Pass Passport to other devices?</h3>
        <p>Silent Pass Passport can only be transferred thru CoNET Platform. Please log in the CoNET Platform with your Silent Pass wallet. Below are the steps to follow.</p>
        <ul>
          <li>Copy the 12 recovery phrases of your Silent Pass Wallet in APP.</li>
          <li>Log in the CoNET Platform by using the 12 recovery phrases.</li>
          <li>Transfer the Passports to other devices.</li>
        </ul>
      </div>
      <div>
        <h3>What’s the expire date for Guardian & CoNETian NFT holder?</h3>
        <ul>
          <li>If you are Guardian NFT holder, your Silent Pass service would be permanently for 5 devices for each Guardian NFT.  No expire date for your services.</li>
          <li>If you are CoNETian NFT holder, you will receive 5 Silent Pass Passport in your CoNETian Wallet. You can transfer the Passport to your Silent Pass Wallet to initiate the service. The service would valid for 1 year once you activate the passport in Silent Pass VPN or Silent Pass Proxy APP.</li>
        </ul>
      </div>
      <div>
        <h3>APP supported in beta version*</h3>
        <p>To provide better user experience, our R&D team keeps working on the development on improving service quality. On the latest Beta version, Silent Pass could protect your security on below APPs, more applications protecting would be provided in the upcoming official Version.</p>
      </div>
      <h2>Silent Pass Proxy</h2>
      <div>
        <p>Silent Pass Proxy can only run on your PC, laptop. It will provide privacy protection for your web browser.</p>
      </div>
      <div>
        <h3>How can I use Silent Pass Proxy?</h3>
        <ol>
          <li>Download and install the CoNET Daemons. Please refer to <a href="https://youtu.be/Zgsy10RBBNY?si=LgA19a8E6F_Zwm5B" target="_blank">Tutorial Video</a> for step-by-step guidance.</li>
          <li>
            Set up your PC:
            <ul>
              <li>If you are using Google Chrome, please add and pin the CoNET Platform Extension in your Chrome. Please refer to <a href="https://youtu.be/EcimpQrlTg0" target="_blank">Tutorial Video</a> for step-by-step guidance.</li>
              <li>If you are using web browser other than google chrome. You need to change your PC and browser proxy setting before use Silent Pass Proxy service. Please refer to <a href="https://youtu.be/jqjSDED8k2o" target="_blank">Tutorial Video</a> for step-by-step guidance.</li>
            </ul>
          </li>
        </ol>
      </div>
      <div>
        <h3>Silent Pass Proxy Server Setting Parameters</h3>
        <p>
          Support Windows 10~, Linux & MacOS <br />
          Local Proxy Auto-Config (PAC) Url: <br />
          {PROXY_PAC} <br />
          Proxy server: {PROXY_SERVER} <br />
          Port number: {PROXY_PORT} <br />
        </p>
      </div>
    </div>
  );
};

export default FAQ;