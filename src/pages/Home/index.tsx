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
import { getRandomNodeDomain} from '../../services/mining'
import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faApple, faAndroid } from '@fortawesome/free-brands-svg-icons';
import { faHeadset } from '@fortawesome/free-solid-svg-icons';
import { Popup } from 'antd-mobile';

const PowerIcon = LuCirclePower  as React.ComponentType<IconBaseProps>;
declare var TCPlayer: any;


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
  const { power, setPower, profiles, sRegion, setSRegion, setAllRegions, allRegions, setIsRandom, getAllNodes, closestRegion, channelPartners} = useDaemonContext();
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [initPercentage, setInitPercentage] = useState<number>(0);
  const [isProcessAirDrop, setIsProcessAirDrop] = useState(false)
  const { t, i18n } = useTranslation()

	const [appId] = useState('1360684569')
	const [winVideo] = useState({fileID:'1397757909729444876',psign:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6MTM2MDY4NDU2OSwiZmlsZUlkIjoiMTM5Nzc1NzkwOTcyOTQ0NDg3NiIsImN1cnJlbnRUaW1lU3RhbXAiOjE3NTE3ODY2OTAsImNvbnRlbnRJbmZvIjp7ImF1ZGlvVmlkZW9UeXBlIjoiUmF3QWRhcHRpdmUiLCJyYXdBZGFwdGl2ZURlZmluaXRpb24iOjEwLCJpbWFnZVNwcml0ZURlZmluaXRpb24iOjEwfSwidXJsQWNjZXNzSW5mbyI6eyJkb21haW4iOiIxMzYwNjg0NTY5LnZvZC1xY2xvdWQuY29tIiwic2NoZW1lIjoiSFRUUFMifX0.tSs0rx1BwrvGprbnH6uI8IUVqPQe1Kr9AvwuxbXnPbs'})
	const [iosVideo] = useState({fileID:'5145403693511802507',psign:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6MTM2MDY4NDU2OSwiZmlsZUlkIjoiNTE0NTQwMzY5MzUxMTgwMjUwNyIsImN1cnJlbnRUaW1lU3RhbXAiOjE3NTM5Mzk2NjMsImNvbnRlbnRJbmZvIjp7ImF1ZGlvVmlkZW9UeXBlIjoiUmF3QWRhcHRpdmUiLCJyYXdBZGFwdGl2ZURlZmluaXRpb24iOjEwLCJpbWFnZVNwcml0ZURlZmluaXRpb24iOjEwfSwidXJsQWNjZXNzSW5mbyI6eyJkb21haW4iOiIxMzYwNjg0NTY5LnZvZC1xY2xvdWQuY29tIiwic2NoZW1lIjoiSFRUUFMifX0.vNIjphJdTXriRQ_qh2eQMKwhAk0JDMUTWt8KecLlo1o'})
	const [macOSVideo] = useState({fileID:'1397757909729719037',psign:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6MTM2MDY4NDU2OSwiZmlsZUlkIjoiMTM5Nzc1NzkwOTcyOTcxOTAzNyIsImN1cnJlbnRUaW1lU3RhbXAiOjE3NTE3ODY4MzAsImNvbnRlbnRJbmZvIjp7ImF1ZGlvVmlkZW9UeXBlIjoiUmF3QWRhcHRpdmUiLCJyYXdBZGFwdGl2ZURlZmluaXRpb24iOjEwLCJpbWFnZVNwcml0ZURlZmluaXRpb24iOjEwfSwidXJsQWNjZXNzSW5mbyI6eyJkb21haW4iOiIxMzYwNjg0NTY5LnZvZC1xY2xvdWQuY29tIiwic2NoZW1lIjoiSFRUUFMifX0.O0YBe1TFTKcqjgwmnXwXhqgojmJgVhoxiCaOXRkK_JA'})
	const [androidVideo] = useState({fileID:'1397757909729661224',psign:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6MTM2MDY4NDU2OSwiZmlsZUlkIjoiMTM5Nzc1NzkwOTcyOTY2MTIyNCIsImN1cnJlbnRUaW1lU3RhbXAiOjE3NTE3ODY0OTgsImNvbnRlbnRJbmZvIjp7ImF1ZGlvVmlkZW9UeXBlIjoiUmF3QWRhcHRpdmUiLCJyYXdBZGFwdGl2ZURlZmluaXRpb24iOjEwLCJpbWFnZVNwcml0ZURlZmluaXRpb24iOjEwfSwidXJsQWNjZXNzSW5mbyI6eyJkb21haW4iOiIxMzYwNjg0NTY5LnZvZC1xY2xvdWQuY29tIiwic2NoZW1lIjoiSFRUUFMifX0._OK2c_wV7BUPv2bb28xnEub5GR3lScArSJpxB39t5Kc'})
	const [tcWin,setTcWin]=useState(null)
	const [visibleVideoWin,setVisibleVideoWin]=useState(false)
	const [tcIos,setTcIos]=useState(null)
	const [visibleVideoIos,setVisibleVideoIos]=useState(false)
	const [tcMacOS,setTcMacOS]=useState(null)
    const [visibleVideoMacOS,setVisibleVideoMacOS]=useState(false)
	const [tcAndroid,setTcAndroid]=useState(null)
    const [visibleVideoAndroid,setVisibleVideoAndroid]=useState(false)

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
			<span>{t('download_page_support')}</span>
		</CustomerServiceButton>
	);

  const supportClick = () => {
		window.open (`https://vue.comm100.com/chatwindow.aspx?siteId=90007504&planId=efd822ce-7299-4fda-9fc1-252dd2f01fc5#`)
  }
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


  	const androidDownload = () => {
		const downloadLink = channelPartners ? `https://${getRandomNodeDomain()}/download/${channelPartners}/Android.apk`: `https://${getRandomNodeDomain()}/download/Android.apk`
		window.open (downloadLink)
	}

	const winDownload = () => {
		const downloadLink = channelPartners ? `https://${getRandomNodeDomain()}/download/${channelPartners}/SilentPassProxy.exe`: `https://${getRandomNodeDomain()}/download/SilentPassProxy.exe`
		window.open (downloadLink)
	}

	const macMDownload = () => {
		const downloadLink = channelPartners ? `https://${getRandomNodeDomain()}/download/${channelPartners}/SilentPassProxyMacOS-M-cpu.dmg`: `https://${getRandomNodeDomain()}/download/SilentPassProxyMacOS-M-cpu.dmg`
		window.open (downloadLink)
	}

	const macDownload = () => {
		const downloadLink = channelPartners ? `https://${getRandomNodeDomain()}/download/${channelPartners}/SilentPassProxyMacOS-Inter-cpu.dmg`: `https://${getRandomNodeDomain()}/download/SilentPassProxyMacOS-Inter-cpu.dmg`
		window.open (downloadLink)
	}

	const playWinVideo=() => {
		if(tcWin==null){
			const tc = TCPlayer('videoIdWin',{
				appID: appId,
				fileID: winVideo.fileID,
				psign: winVideo.psign,
			});
			tc.play()
			setTcWin(tc)
		}else{
			tcWin.play()
		}
	}

	const playIosVideo=() => {
		if(tcIos==null){
			const tc = TCPlayer('videoIdIos',{
				appID: appId,
				fileID: iosVideo.fileID,
				psign: iosVideo.psign,
			});
			tc.play()
			setTcIos(tc)
		}else{
			tcIos.play()
		}
	}

	const playMacOSVideo=() => {
		if(tcMacOS==null){
			const tc = TCPlayer('videoIdMacOS',{
				appID: appId,
				fileID: macOSVideo.fileID,
				psign: macOSVideo.psign,
			});
			tc.play()
			setTcMacOS(tc)
		}else{
			tcMacOS.play()
		}
	}
	
	const playAndroidVideo=() => {
		if(tcAndroid==null){
			const tc = TCPlayer('videoIdAndroid',{
				appID: appId,
				fileID: androidVideo.fileID,
				psign: androidVideo.psign,
			});
			tc.play()
			setTcAndroid(tc)
		}else{
			tcAndroid.play()
		}
	}

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
				<div style={{paddingTop: '2rem'}} onClick={androidDownload}>
					<AndroidDownloadButton />
				</div>
				<div style={{paddingTop: '2rem'}} onClick={supportClick}>
					<ContactSupportButton />
				</div>
			</div>
		}
		
		<div className='downloadLinks'>
			<div><a onClick={winDownload}>{t('download_page_windows_download')}</a></div>
			<div><a onClick={macDownload}>{t('download_page_windows_MacOS')}</a></div>
			<div><a onClick={macMDownload}>{t('download_page_windows_MacOS_M')}</a></div>
		</div>

		<div className='videoBtnsContainer'>
			<div onClick={()=>{setVisibleVideoWin(true)}} className='videoBtn'>windows安装教程</div>
			<div onClick={()=>{setVisibleVideoIos(true)}} className='videoBtn'>ios安装教程</div>
			<div onClick={()=>{setVisibleVideoMacOS(true)}} className='videoBtn'>MacOS安装教程</div>
			<div onClick={()=>{setVisibleVideoAndroid(true)}} className='videoBtn'>android安装教程</div>
		</div>


		<Popup
			showCloseButton={true}
			visible={visibleVideoWin}
			onMaskClick={() => {setVisibleVideoWin(false);if(tcWin)tcWin.pause()}}
			onClose={() => {setVisibleVideoWin(false);if(tcWin)tcWin.pause()}}
			position='bottom'
			bodyStyle={{ height: '80vh' }}
			afterShow={playWinVideo}
			className={'popupContainer'}
		>
			<div className={'videoContainer'}>
				<video id='videoIdWin' style={{height:'100%',width:'100%'}} preload="auto" playsInline={true} webkit-playsinline="true" x5-playsinline="true"></video>
			</div>
		</Popup>

		<Popup
			showCloseButton={true}
			visible={visibleVideoIos}
			onMaskClick={() => {setVisibleVideoIos(false);if(tcIos)tcIos.pause()}}
			onClose={() => {setVisibleVideoIos(false);if(tcIos)tcIos.pause()}}
			position='bottom'
			bodyStyle={{ height: '80vh' }}
			afterShow={playIosVideo}
			className={'popupContainer'}
		>
			<div className={'videoContainer'}>
				<video id='videoIdIos' style={{height:'100%',width:'100%'}} preload="auto" playsInline={true} webkit-playsinline="true" x5-playsinline="true"></video>
			</div>
		</Popup>

		<Popup
			showCloseButton={true}
			visible={visibleVideoMacOS}
			onMaskClick={() => {setVisibleVideoMacOS(false);if(tcMacOS)tcMacOS.pause()}}
			onClose={() => {setVisibleVideoMacOS(false);if(tcMacOS)tcMacOS.pause()}}
			position='bottom'
			bodyStyle={{ height: '80vh' }}
			afterShow={playMacOSVideo}
			className={'popupContainer'}
		>
			<div className={'videoContainer'}>
				<video id='videoIdMacOS' style={{height:'100%',width:'100%'}} preload="auto" playsInline={true} webkit-playsinline="true" x5-playsinline="true"></video>
			</div>
		</Popup>

		<Popup
			showCloseButton={true}
			visible={visibleVideoAndroid}
			onMaskClick={() => {setVisibleVideoAndroid(false);if(tcAndroid)tcAndroid.pause()}}
			onClose={() => {setVisibleVideoAndroid(false);if(tcAndroid)tcAndroid.pause()}}
			position='bottom'
			bodyStyle={{ height: '80vh' }}
			afterShow={playAndroidVideo}
			className={'popupContainer'}
		>
			<div className={'videoContainer'}>
				<video id='videoIdAndroid' style={{height:'100%',width:'100%'}} preload="auto" playsInline={true} webkit-playsinline="true" x5-playsinline="true"></video>
			</div>
		</Popup>
    </>
  );
};

export default Home;
