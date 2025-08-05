import "./Foot2.css";
import silentpassLogo from "./assets/silentpass-logo.svg";
import xIcon from "./assets/x.svg";
import telegramIcon from "./assets/telegram.svg";
import gitbookIcon from "./assets/gitbook.svg";
import youtubeIcon from "./assets/youtube.svg";

export default function Footer2() {
    return (
      <div className="footer2">
        <div className="footer2-1">
          <div className="footer2-2">
            <div className="footer2-row1">
              <img src={silentpassLogo} width={48} height={48} alt="Logo" />
              <span>support@silentpass.io</span>
              <ul>
                <li>
                  <a href="https://twitter.com/SilentPassVPN" target="_blank">
                    <img src={xIcon} width={32} height={32} alt="x" />
                  </a>
                </li>
                <li>
                  <a href="https://t.me/silentpassvpnofficial" target="_blank">
                    <img
                      src={telegramIcon}
                      width={28}
                      height={28}
                      alt="telegram"
                    />
                  </a>
                </li>
                <li>
                  <a href="https://docs.silentpass.io" target="_blank">
                    <img
                      src={gitbookIcon}
                      width={32}
                      height={32}
                      alt="gitbook"
                    />
                  </a>
                </li>
                <li>
                  <a
                    href={
                      true
                        ? "https://www.youtube.com/@SilentPassVPNChinese/videos"
                        : "https://www.youtube.com/@silentpassvpn"
                    }
                    target="_blank"
                  >
                    <img
                      src={youtubeIcon}
                      width={32}
                      height={32}
                      alt="youtube"
                    />
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer2-row2">
              <span>
                © {new Date().getFullYear()} CoNET.network. All rights reserved
              </span>

              <div className="right">
                <a
                  href="https://docs.silentpass.io/"
                  target="_blank"
                  style={{ color: "rgb(140, 141, 143) !important" }}
                >
                  <span>Read Docs</span>
                </a>

                <span>|</span>
                <a
                  href="/terms"
                  style={{ color: "rgb(140, 141, 143) !important" }}
                >
                  <span>Terms & Service</span>
                </a>

                <span>|</span>
                <a
                  href="/privacy-cookies"
                  style={{ color: "rgb(140, 141, 143) !important" }}
                >
                  <span>Privacy Policy</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
}
