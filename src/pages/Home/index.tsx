import "./index.css";
import { mappedCountryCodes } from "../../utils/regions";
import { useEffect, useRef, useState } from "react";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getAllRegions } from "../../services/regions";
import BlobWrapper from '../../components/BlobWrapper';
import { maxNodes, currentScanNodeNumber } from '../../services/mining';
import { CoNET_Data } from '../../utils/globals';
import Header from '../../components/Header';
import CopyProxyInfo from '../../components/CopyProxyInfo';
import Footer from '../../components/Footer';
import RegionSelector from '../../components/RegionSelector';
import { useNavigate } from 'react-router-dom';
import { formatMinutesToHHMM, isPassportValid } from "../../utils/utils";
import { startSilentPass, stopSilentPass } from "../../api";
import PassportInfoPopup from "../../components/PassportInfoPopup";
import { getServerIpAddress } from "../../api"
import bannaer from './assets/bannerv1_en.gif'
import bannaer_cn from './assets/bannerv1_cn.gif'
import {airDropForSP, getirDropForSP} from '../../services/subscription'
import airdrop from './assets/airdrop_swing_SP.gif'
import airdropReff from './assets/airdropReff.gif'
import { useTranslation } from 'react-i18next'
import { useMemo } from "react";
import { LuCirclePower } from 'react-icons/lu';
import type { IconBaseProps } from 'react-icons';
import phoneImg from './assets/android.png'
import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faApple, faAndroid } from '@fortawesome/free-brands-svg-icons';
import { faHeadset } from '@fortawesome/free-solid-svg-icons';

const PowerIcon = LuCirclePower  as React.ComponentType<IconBaseProps>;



const GENERIC_ERROR = 'Error Starting Silent Pass. Please try using our iOS App or our desktop Proxy program.';
const PASSPORT_EXPIRED_ERROR = 'Passport has expired. Please renew your passport and try again.';
const WAIT_PASSPORT_LOAD_ERROR = 'Passport info is loading. Please wait a few seconds and try again.';


const VPN_URLS = ['vpn', 'vpn-beta'];

interface RenderButtonProps {
  errorMessage: string;
  isConnectionLoading: boolean;
  power: boolean;
  profile: any;
  _vpnTimeUsedInMin: number;
  handleTogglePower: () => void;
}

// --- 基礎按鈕樣式 (共用) ---
const BaseButton = styled.button`
  padding: 12px 24px;
  font-size: 18px;
  font-weight: bold;
  border-radius: 50px;
  border-width: 2px;
  border-style: solid;
  cursor: pointer;
  background: transparent;
  width:100%;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

`;

// --- iOS 按鈕樣式 ---
const IOSStyledButton = styled(BaseButton)`
  border-color: #FFFFFF;
  color: #FFFFFF;

  &:hover {
    background-color: #FFFFFF;
    color: #000;
  }
`;

// --- Android 按鈕樣式 ---
const AndroidStyledButton = styled(BaseButton)`
  border-color: #3DDC84;
  color: #3DDC84;

  &:hover {
    background-color: #3DDC84;
    color: white;
  }
`
// --- 客服按鈕樣式 (新) ---
const CustomerServiceButton = styled(BaseButton)`
	/* 使用中性灰色系，作為次要操作按鈕 */
	border-color: #888;
	color: #888;
	font-size: 16px; /* 可以讓文字稍微小一點，以區分主次 */

	&:hover {
		background-color: #888;
		color: white;
  }
`;

const Home = () => {
  const { power, setPower, profiles, sRegion, setSRegion, setAllRegions, allRegions, setIsRandom, getAllNodes, closestRegion} = useDaemonContext();
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initPercentage, setInitPercentage] = useState<number>(0);
  const [isProcessAirDrop, setIsProcessAirDrop] = useState(false)
  const { t, i18n } = useTranslation()

	// 2. 建立包含圖示和文字的 React 元件
	const IOSDownloadButton = () => {
		return (
			<IOSStyledButton>
				{/* Font Awesome 圖示 */}
				<FontAwesomeIcon icon={faApple} size="lg" />
				
				{/* 文字 */}
				<span>{t('download_page_ios')}</span>
			</IOSStyledButton>
		);
	};

	const AndroidDownloadButton = () => {
		return (
			<AndroidStyledButton>
				<FontAwesomeIcon icon={faAndroid} size="lg" />
				<span>{t('download_page_android')}</span>
			</AndroidStyledButton>
		);
	};

	// --- 客服按鈕樣式 (新) ---
	const ContactSupportButton = () => (
		<CustomerServiceButton>
			<FontAwesomeIcon icon={faHeadset} />
			<span>無法下載？聯繫客服</span>
		</CustomerServiceButton>
	);


  const _getAllRegions = async () => {
	
	const [tmpRegions] = await
	Promise.all([
		getAllRegions()
	])

	const treatedRegions = Array.from(new Set(tmpRegions.map((region: string) => {
		const separatedRegion = region.split(".");
		const code = separatedRegion[1];
		const country = mappedCountryCodes[code];

		return JSON.stringify({ code, country }); // Convert the object to a string for Set comparison
	}))).map((regionStr: any) => JSON.parse(regionStr)); // Convert the string back to an object
  };

  const iOSDownload = () => {
	window.open (`https://apps.apple.com/us/app/silent-pass-vpn/id6740261324`)
  }

  useEffect(() => {
	if (!closestRegion?.length) {
		return
	}
	setIsInitialLoading(false);
  }, [closestRegion])


  return (
    <>
      
        {isInitialLoading &&
			<div className='home' style={{ overflowX: 'hidden' }}>
				<div style={{ display: 'absolute', flexDirection: 'column', gap: '8px' }}>
					<button
						className="power"
					>
					
					<img className="loading-spinning" src="/assets/silent-pass-logo-grey.png" style={{ width: '85px', height: '85px' }} alt="" />
					</button>

					<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '400px' }}>
						<p className="not-connected">Welcome to Silent Pass {initPercentage} %</p>
					</div>
					{/* <p className="not-connected">{initPercentage}%</p> */}
				</div>
			</div>
        }
		{
			!isInitialLoading &&
			<div className='homeMain'>
				<div style={{height: '0.5rem'}}>
					<img src="/assets/header-title.svg"></img>
				</div>
				<h1 style={{paddingTop: '3rem'}}>
					<span>
						{
							t('download_page_title')
						}
					</span>
					
					
				</h1>
				<h1 style={{paddingTop: '1.5rem', fontSize:'2.5rem'}}>
					{
						t('download_page_title-1')
					}
				</h1>
				<h1 style={{paddingTop: '1.5rem'}}>
					<span>
						{
							t('download_page_title-2')
						}
					</span>
					
				</h1>
				<div style={{paddingTop: '2rem', }}>
					<img src={phoneImg} style={{width: '47.7vw'}}></img>
				</div>
				<div style={{paddingTop: '2rem'}} onClick={iOSDownload}>
					<IOSDownloadButton />
				</div>
				<div style={{paddingTop: '2rem'}}>
					<AndroidDownloadButton />
				</div>
				<div style={{paddingTop: '2rem'}}>
					<ContactSupportButton />
				</div>
			</div>
		}
		
	  	
    </>
  );
};

export default Home;
