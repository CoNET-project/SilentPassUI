import { AnimatePresence, motion } from "motion/react"
import BackButton from '../../components/BackButton';
import SilentPassServiceTable from "./assets/silent-pass-service-table.svg";
import SilentPassBenefitsTable from "./assets/silent-pass-benefits-table.svg";

import "./index.css";
import { useState } from "react";

const FAQ = () => {
  const [dropdownOpen, setDropdownOpen] = useState<number>(0)

  const handleDropdownClick = (dropDownId: number) => {
    if (dropdownOpen !== dropDownId)
      setDropdownOpen(dropDownId)
    else {
      setDropdownOpen(0)
    }
  }

  return (
    <div className="page-container text-display faq">
      <BackButton to="/support" />

      <h1>FAQ</h1>

      {/* What’s the Silent Pass service level and the benefits? */}
      <AnimatePresence>
        <div
          className='faq-item'
          onClick={() => {
            handleDropdownClick(1)
          }}
        >
          <div className="title-wrapper">
            <h3>What’s the Silent Pass service level?</h3>
            {dropdownOpen === 1 ?
              <img className="chevron" width='24px' src="/assets/up-chevron.svg" /> :
              <img className="chevron" width='24px' src="/assets/down-chevron.svg" />
            }
          </div>

          {dropdownOpen === 1 &&
            <motion.div className='faq-item-content'
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              <p>Service Levels and Benefits: <br /> (for both Proxy and VPN)</p>
              <img alt="Silent Pass Benefits Table" src={SilentPassBenefitsTable} />
            </motion.div>
          }
        </div>
      </AnimatePresence>

      <div className='divider' />

      {/* What’s the rate for Silent Pass service? */}
      <AnimatePresence>
        <div
          className='faq-item'
          onClick={() => {
            handleDropdownClick(2)
          }}
        >
          <div className="title-wrapper">
            <h3>What’s the rate for Silent Pass service?</h3>
            {dropdownOpen === 2 ?
              <img className="chevron" width='24px' src="/assets/up-chevron.svg" /> :
              <img className="chevron" width='24px' src="/assets/down-chevron.svg" />
            }
          </div>

          {dropdownOpen === 2 &&
            <motion.div
              className='faq-item-content'
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              <img alt="Silent Pass Service Table" src={SilentPassServiceTable} />
            </motion.div>
          }
        </div>
      </AnimatePresence>

      <div className='divider' />

      {/* What’s my Silent Pass Wallet? How can I get my Silent Pass Wallet? */}
      <AnimatePresence>
        <div
          className='faq-item'
          onClick={() => {
            handleDropdownClick(3)
          }}
        >
          <div className='faq-item' >
            <div className="title-wrapper">
              <h3>What’s my Silent Pass Wallet? How can I get my Silent Pass Wallet?</h3>
              {dropdownOpen === 3 ?
                <img className="chevron" width='24px' src="/assets/up-chevron.svg" /> :
                <img className="chevron" width='24px' src="/assets/down-chevron.svg" />
              }
            </div>

            {dropdownOpen === 3 &&
              <motion.div
                className='faq-item-content'
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
              >
                <p>Silent Pass Wallet are unique identity for each device. The Silent Pass Passport could be purchased within the APP, or be transferred to your wallet, then your Silent Pass service would be initiated.</p>
                <p>Please refer to <a href="https://youtube.com/shorts/O6l3r_qpqzo?feature=share" target="_blank">Tutorial Video</a> for how to get your Silent Pass wallet address.</p>
              </motion.div>
            }
          </div>
        </div>
      </AnimatePresence>

      <div className='divider' />

      {/* How to check the expire date of my Silent Pass Service? */}
      <AnimatePresence>
        <div
          className='faq-item'
          onClick={() => {
            handleDropdownClick(6)
          }}
        >
          <div className="title-wrapper">
            <h3>How to check the expire date of my Silent Pass Service?</h3>
            {dropdownOpen === 6 ?
              <img className="chevron" width='24px' src="/assets/up-chevron.svg" /> :
              <img className="chevron" width='24px' src="/assets/down-chevron.svg" />
            }
          </div>

          {dropdownOpen === 6 &&
            <motion.div
              className='faq-item-content'
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              <p>Please refer to <a href="https://youtu.be/0YmHHe4PEkk?feature=shared">Tutorial Video</a> for step-by-step guidance.</p>
            </motion.div>
          }
        </div>
      </AnimatePresence>

      <div className='divider' />

      <AnimatePresence>
        <div
          className='faq-item'
          onClick={() => {
            handleDropdownClick(6)
          }}
        >
          <div className="title-wrapper">
            <h3>What if my Silent Pass Service expired?</h3>
            {dropdownOpen === 6 ?
              <img className="chevron" width='24px' src="/assets/up-chevron.svg" /> :
              <img className="chevron" width='24px' src="/assets/down-chevron.svg" />
            }
          </div>

          {dropdownOpen === 6 &&
            <motion.div
              className='faq-item-content'
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              <p>Silent Pass continues to offer free services to you at this stage. When the Passport NFT you are using expires, you have opportunity to get a monthly Passport NFT to continue using Silent Pass services for free trial.</p>
            </motion.div>
          }
        </div>
      </AnimatePresence>

      <div className='divider' />

      <h2 className='title'>Silent Pass VPN</h2>

      {/* How can I use Silent Pass VPN? */}
      <AnimatePresence>
        <div
          className='faq-item'
          onClick={() => {
            handleDropdownClick(9)
          }}
        >
          <div className="title-wrapper">
            <h3>How can I use Silent Pass VPN?</h3>
            {dropdownOpen === 9 ?
              <img className="chevron" width='24px' src="/assets/up-chevron.svg" /> :
              <img className="chevron" width='24px' src="/assets/down-chevron.svg" />
            }
          </div>

          {dropdownOpen === 9 &&
            <motion.div
              className='faq-item-content'
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              <p>Please refer to <a href="https://www.youtube.com/shorts/ZhhF7_uCrZ4" target="_blank">Tutorial Video</a> for step-by-step guidance.</p>
            </motion.div>
          }
        </div>
      </AnimatePresence>

      <div className='divider' />

      {/* How can I use Telegram under Silent Pass VPN Protection? */}
      <AnimatePresence>
        <div
          className='faq-item'
          onClick={() => {
            handleDropdownClick(10)
          }}
        >
          <div className="title-wrapper">
            <h3>How can I use Telegram under Silent Pass VPN Protection?</h3>
            {dropdownOpen === 10 ?
              <img className="chevron" width='24px' src="/assets/up-chevron.svg" /> :
              <img className="chevron" width='24px' src="/assets/down-chevron.svg" />
            }
          </div>

          {dropdownOpen === 10 &&
            <motion.div
              className='faq-item-content'
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              <p>After the Silent Pass APP had been run on your device, you need to setup your Telegram proxy setting to use Telegram APP. </p>
              <ol>
                <li>Run Silent Pass APP on your device.</li>
                <li>Run Telegram APP on your device.</li>
                <li>Change Telegram Proxy Setting, Telegram Setting {'=>'} Data and Storage {'=>'} Proxy</li>
                <li>Add Proxy, Proxy information could be found in the Silent Pass VPN APP homepage</li>
              </ol>
              <p>Please refer to <a href="https://www.youtube.com/watch?v=15fJpywnFFM" target="_blank">Tutorial Video</a> for step-by-step guidance.</p>
            </motion.div>
          }
        </div>
      </AnimatePresence>
    </div>
  );
};

export default FAQ;