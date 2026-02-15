import React, { createContext, useContext, ReactNode, useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from "react";
import packageData from '../../package.json'
import ScanButton, { type  ScanButtonHandle } from "@/components/scanBtn/ScanButton"


type DaemonContext = {
	historyPayData: searchResult|null
	setHistoryPayData: (val: searchResult|null) => void
	scanRef: React.MutableRefObject<ScanButtonHandle | null>
	msgCountLockRef: React.MutableRefObject<boolean>
	seenMsgRef: React.MutableRefObject<Set<string>>
	messageCount: number
	setMessageCount: React.Dispatch<React.SetStateAction<number>>
	scanData: string
	setScanData: (val: string) => void
	scanIntent: '' | 'voucherPay' | 'payBill'
	setScanIntent: (val: '' | 'voucherPay' | 'payBill') => void
	voucherPayAmount: string
	setVoucherPayAmount: (val: string) => void
	voucherPayToAA: string
	setVoucherPayToAA: (val: string) => void
	voucherPayError: string
	setVoucherPayError: (val: string) => void
	chatHomeItem: searchResult|null
	setChatHomeItem: Dispatch<SetStateAction<searchResult | null>>
	charts: string[]
	setCharts: React.Dispatch<React.SetStateAction<string[]>>
	gossip: boolean
	setGossip: (val: boolean) => void
	allNodes: nodeInfo[]
	setAllNodes: (val: nodeInfo[]) => void
	navigateLeftButtonArray: INavigateLeftButtonArray[]
	setNavigateLeftButtonArray: Dispatch<SetStateAction<INavigateLeftButtonArray[]>>
	payMePayment: searchResult|null
	setPayMePayment: Dispatch<SetStateAction<searchResult | null>>
	showFooter: boolean
	setShowFooter: (val: boolean) => void
	beamioUsers: searchResult[]
	setbBeamioUsers: (val: searchResult[]) => void
	currencyData: currencyData
	setCurrencyData: (val: currencyData) => void
	paymentLinkCode: string
	setPaymentLinkCode: (val: string) => void
	redeemCode: string
	setRedeemCode: (val: string) => void
	myAddress: string
	setMyAddress: (val: string) => void
	listenningProcess: boolean
	setListenningProcess: (va: boolean) => void
	setSendToMemo: (val: string) => void
	sendToMemo: string
	darkModle: boolean
	setDarkModle: (val: boolean) => void
  version: string
  power: boolean;
  setPower: (val: boolean) => void;
  sRegion: number;
  setSRegion: (region: number) => void;
  allRegions: Region[];
  setAllRegions: (regions: Region[]) => void;
  closestRegion: nodes_info[];
  setClosestRegion: (region: nodes_info[]) => void;
  isRandom: boolean;
  setIsRandom: (val: boolean) => void;
  miningData: any;
  setMiningData: (data: any) => void;
  profiles: any;
  setProfiles: React.Dispatch<React.SetStateAction<profile[]>>
  isMiningUp: boolean;
  setIsMiningUp: (val: boolean) => void;
  setaAllNodes: (data: nodes_info[]) => void
  getAllNodes: nodes_info[]
  serverIpAddress: string
  setServerIpAddress: (ip: string) => void
  serverPort: string
  setServerPort: (port: string) => void
  serverPac: string
  setServerPac: (pac: string) => void
  _vpnTimeUsedInMin: React.MutableRefObject<number>
  isPassportInfoPopupOpen: boolean
  setIsPassportInfoPopupOpen: (val: boolean) => void
  activePassportUpdated: boolean
  setActivePassportUpdated: (val: boolean) => void
  activePassport: any
  setActivePassport: (val: any) => void
  isSelectPassportPopupOpen: any
  setIsSelectPassportPopupOpen: (val: any) => void
  randomSolanaRPC: nodes_info | null
  setRandomSolanaRPC: (val: nodes_info) => void;
  isIOS: boolean
  setIsIOS: (val: boolean) => void
  isLocalProxy: boolean
  setIsLocalProxy: (val: boolean)=> void
  globalProxy: boolean,
  setGlobalProxy: (val: boolean)=> void
  paymentKind: number,
  setPaymentKind: (val: number) => void
  successNFTID: string,
  setSuccessNFTID: (val: string) => void
  selectedPlan: "12" | "1" |'3' | string
  setSelectedPlan: (val: "12" | "1" |'3'| string ) => void
  airdropProcess: boolean,
  setAirdropProcess: (val: boolean) => void
  setAirdropSuccess: (val: boolean) => void
  airdropSuccess: boolean
  airdropTokens: number
  setAirdropTokens: (val: number) => void
  airdropProcessReff: boolean
  setAirdropProcessReff: (val: boolean) => void
  getWebFilter: boolean
  setGetWebFilter: (val:boolean) => void
  switchValue: boolean;
  setSwitchValue: (val: boolean) => void;
  webFilterRef:React.MutableRefObject<boolean>;
  quickLinksShow: boolean;
  setQuickLinksShow: (val: boolean) => void;
  duplicateAccount: any
  setDuplicateAccount: (profile: any) => void
  showReferralsInput: boolean,
  setShowReferralsInput: (val: boolean) => void;
  subscriptionVisible: boolean;
  setSubscriptionVisible: (val: boolean) => void;
  airdropVisible: boolean;
  setAirdropVisible: (val: boolean) => void;
  referralsVisible: boolean;
  setReferralsVisible: (val: boolean) => void;
  passportVisible: boolean;
  setPassportVisible: (val: boolean) => void;
  checkInVisible: boolean;
  setCheckInVisible: (val: boolean) => void;
  genesisVisible: boolean;
  setGenesisVisible: Dispatch<SetStateAction<boolean>>;
  isInitialLoading: boolean;
  setIsInitialLoading: (val: boolean) => void;
  statusVisible: boolean,
  setStatusVisible: (val: boolean) => void;
  checkinBalanceUP: boolean,
  setCheckinBalanceUP: (val: boolean) => void;
  ruleVisible: boolean,
  setRuleVisible: Dispatch<SetStateAction<boolean>>;
  hasNewVersion: boolean|string,
  setHasNewVersion: Dispatch<SetStateAction<boolean|string>>;
  setPrivacyMode: (val: boolean) => void;
  privacyMode: boolean;
  currentBlock: number
  setCurrentBlock: (val: number) => void
  beamio: beamio|null
  setBeamio : (val:beamio|null) => void
  usdcbalance : number

  setUsdcbalance: (val: number) => void
	usdcToUSD: number
	setUsdcToUSD: (val: number) => void


  paymentLink: any
  setPaymentLink: (val: any) => void
  setBeamioAppInstalled: (val:boolean) => void
	beamioAppInstalled: boolean
	setSecureCode: (val: string) => void,
	secureCode: string
	ignoreUrl: boolean
	setIgnoreUrl: (val: boolean) => void
	setPayTag: (val: string) => void
	payTag: string
	/** 扫码/链接解析得到的 BeamioUserCard redeem 参数，打开 redeem 面板并预填 */
	redeemFromUrl: { cardAddress?: string; redeemCode: string } | null
	setRedeemFromUrl: (val: { cardAddress?: string; redeemCode: string } | null) => void
	/** BeamioOnboardingModal Go To Home 后后台 redeem 的结果，从下往上滑出展示 */
	redeemResult: { success: boolean; tx?: string; error?: string } | null
	setRedeemResult: (val: { success: boolean; tx?: string; error?: string } | null) => void
};

type DaemonProps = {
  children: ReactNode;
};

const defaultContextValue: DaemonContext = {
	historyPayData: null,
	setHistoryPayData: (val: searchResult|null) => {},
	// ...
	scanRef: { current: null },
	// ...
	
	msgCountLockRef: { current: false },
	seenMsgRef: { current: new Set() },
	messageCount: 0,
	setMessageCount: (val: React.SetStateAction<number>) => {},
	scanData: '',
	setScanData: (val) => {},
	scanIntent: '',
	setScanIntent: () => {},
	voucherPayAmount: '',
	setVoucherPayAmount: () => {},
	voucherPayToAA: '',
	setVoucherPayToAA: () => {},
	voucherPayError: '',
	setVoucherPayError: () => {},
	chatHomeItem: null,
	setChatHomeItem: (val) => {},
	charts: [],
	setCharts: (_value: React.SetStateAction<string[]>) => {},
	gossip: false,
	setGossip: (val: boolean) => {},
	allNodes: [],
	setAllNodes: (val) => {},
	navigateLeftButtonArray: [],
	setNavigateLeftButtonArray: (_value: React.SetStateAction<INavigateLeftButtonArray[]>) => {},
	payMePayment:null,
	setPayMePayment: () => {},
	showFooter: true,
	setShowFooter: (val: boolean) => {},
	currencyData: {
		CAD: 0,
		USD: 0,
		JPY: 0,
		CNY: 0,
		USDC: 0,
		HKD: 0,
		EUR: 0,
		TWD: 0,
		SGD: 0
	},

	beamioUsers: [],
	setbBeamioUsers: (val: searchResult[]) => {},

	setCurrencyData: (val: currencyData) => {},
	paymentLinkCode: '',
	setPaymentLinkCode: (val: string) => {},
	redeemCode: '',
	setRedeemCode: (val: string) => {},
	myAddress: '',
	setMyAddress: (val: string) => {},
	usdcToUSD: 0,
	setUsdcToUSD: (val: number) => {},
	listenningProcess: false,
	setListenningProcess: (va: boolean) => {},
	setSendToMemo: (val: string) => {},
	sendToMemo: '',
	setPayTag: (val: string) => {},
	payTag: '',
	ignoreUrl: false,
	setIgnoreUrl: (val: boolean) => {},
	redeemFromUrl: null,
	setRedeemFromUrl: () => {},
	redeemResult: null,
	setRedeemResult: () => {},
	setSecureCode: (val: string) => {},
	secureCode: '',
	  setBeamioAppInstalled: () => {},
	beamioAppInstalled: true,
	darkModle: false,
	setDarkModle: () => {},
  power: false,
  setPower: () => { },
  sRegion: -1,
  setSRegion: () => { },
  allRegions: [],
  setAllRegions: () => { },
  closestRegion: [],
  setClosestRegion: () => { },
  isRandom: true,
  setIsRandom: () => { },
  miningData: null,
  setMiningData: () => { },
  profiles: null,
  setProfiles: (_value: React.SetStateAction<profile[]>) => {},
  isMiningUp: false,
  setIsMiningUp: () => { },
  setaAllNodes: () => { },
  getAllNodes: [],
  serverIpAddress: "127.0.0.1",
  setServerIpAddress: () => { },
  serverPort: "8888",
  setServerPort: () => { },
  serverPac: "",
  setServerPac: () => { },
  _vpnTimeUsedInMin: { current: 0 },
  isPassportInfoPopupOpen: false,
  setIsPassportInfoPopupOpen: () => { },
  activePassportUpdated: false,
  setActivePassportUpdated: () => { },
  activePassport: null,
  setActivePassport: () => { },
  isSelectPassportPopupOpen: false,
  setIsSelectPassportPopupOpen: () => { },
  setRandomSolanaRPC: () => { },
  randomSolanaRPC: null,
  isIOS: false,
  setIsIOS: () => {},
  isLocalProxy: false,
  setIsLocalProxy(val) {},
  globalProxy: false,
  setGlobalProxy: () => {},
  paymentKind: 0,
  setPaymentKind: () => {},
  successNFTID: '0',
  setSuccessNFTID: () => {},
  selectedPlan: "12",
  setSelectedPlan: () => {},
  setAirdropProcess: () => {},
  airdropProcess: false,
  setAirdropSuccess: () => {},
  airdropSuccess: false,
  airdropTokens: 0,
  setAirdropTokens: () => {},
  airdropProcessReff: false,
  setAirdropProcessReff: () => {},
  getWebFilter: false,
  setGetWebFilter: () => {},
  switchValue: true,
  setSwitchValue: () => {},
  webFilterRef:{ current: false },
  quickLinksShow: false,
  setQuickLinksShow: () => {},
  version: '1.21.1',
  duplicateAccount: null,
  setDuplicateAccount: () => {},
  showReferralsInput: false,
  setShowReferralsInput: () => {},
  subscriptionVisible: false,
  setSubscriptionVisible: () => {},
  airdropVisible: false,
  setAirdropVisible: () => {},
  referralsVisible: false,
  setReferralsVisible: () => {},
  passportVisible: false,
  setPassportVisible: () => {},
  checkInVisible: false,
  setCheckInVisible: () => {},
  genesisVisible: false,
  setGenesisVisible: () => {},
  isInitialLoading: false,
  setIsInitialLoading: () => {},
  statusVisible: true,
  setStatusVisible: () => {},
  checkinBalanceUP: false,
  setCheckinBalanceUP: (val: boolean) => {},
  ruleVisible: false,
  setRuleVisible: () => {},
  hasNewVersion: false,
  setHasNewVersion: () => {},
  setPrivacyMode: () => {},
  privacyMode: false,
  currentBlock: 0,
  setCurrentBlock: () => {},
  setBeamio: () => {},
	beamio: null,
	usdcbalance: 0,
	setUsdcbalance: () => {},
	paymentLink: null,
  setPaymentLink: () => {},
}

const Daemon = createContext<DaemonContext>(defaultContextValue);

export function useDaemonContext() {
  const context = useContext(Daemon);
  return context;
}

export function DaemonProvider({ children }: DaemonProps) {
	const [historyPayData, setHistoryPayData] = useState<searchResult | null>(null)
	const scanRef = useRef<ScanButtonHandle | null>(null)
	const seenMsgRef = useRef<Set<string>>(new Set())
	const msgCountLockRef = useRef(false) // 可选：避免同一帧重复统计
	const [messageCount, setMessageCount] = useState(0)
	const [scanData, setScanData] = useState('')
	const [scanIntent, setScanIntent] = useState<'' | 'voucherPay' | 'payBill'>('')
	const [voucherPayAmount, setVoucherPayAmount] = useState('')
	const [voucherPayToAA, setVoucherPayToAA] = useState('')
	const [voucherPayError, setVoucherPayError] = useState('')
	const [chatHomeItem,setChatHomeItem] = useState<searchResult | null>(null)
	const [charts, setCharts] = useState<string[]>([])
	const [gossip, setGossip] = useState(false)
	const [allNodes, setAllNodes] = useState<nodeInfo[]>([])
	const [navigateLeftButtonArray, setNavigateLeftButtonArray] = useState<INavigateLeftButtonArray[]>([])
	 const [payMePayment, setPayMePayment] = useState<searchResult | null>(null)
	const [paymentLinkCode, setPaymentLinkCode] = useState('')

	const [usdcToUSD, setUsdcToUSD] = useState(0)
	const [listenningProcess, setListenningProcess] = useState<boolean>(false)
	
	const [sendToMemo, setSendToMemo]= useState('')
	const [beamioAppInstalled, setBeamioAppInstalled] = useState(false)
	const [paymentLink, setPaymentLink] = useState(null)
	const [darkModle, setDarkModle] = useState<boolean>(false)
  const [version] = useState(packageData.version)
  const [power, setPower] = useState<boolean>(false);
  const [globalProxy, setGlobalProxy] = useState(false)
  const [isRandom, setIsRandom] = useState<boolean>(true);
  const [sRegion, setSRegion] = useState<number>(-1);
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [closestRegion, setClosestRegion] = useState<any>(null);
  const [miningData, setMiningData] = useState<any>(null);
  const [profilesState, setProfilesState] = useState<any>(null);
  const setProfiles = useCallback((value: React.SetStateAction<profile[]>) => {
    setProfilesState((prev: profile[] | null) => {
      const next = typeof value === 'function' ? (value as (prev: profile[] | null) => profile[])(prev) : value
      if (!next || !Array.isArray(next)) return next
      const first = next[0]
      if (next.length > 0 && Array.isArray(first) && typeof (first as any)?.keyID === 'undefined') {
        return (next as any[]).flat()
      }
      return next
    })
  }, [])
  const profiles = profilesState
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);
  const [getAllNodes, setaAllNodes] = useState<nodes_info[]>([]);
  const [serverIpAddress, setServerIpAddress] = useState<string>(defaultContextValue.serverIpAddress);
  const [serverPort, setServerPort] = useState<string>(defaultContextValue.serverPort);
  const [serverPac, setServerPac] = useState<string>("");
  const _vpnTimeUsedInMin = useRef<number>(0);
  const [isPassportInfoPopupOpen, setIsPassportInfoPopupOpen] = useState<boolean>(false);
  const [isSelectPassportPopupOpen, setIsSelectPassportPopupOpen] = useState<boolean>(false);
  const [activePassportUpdated, setActivePassportUpdated] = useState<boolean>(false);
  const [activePassport, setActivePassport] = useState<any>(null);
  const [randomSolanaRPC, setRandomSolanaRPC] = useState<nodes_info | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isLocalProxy, setIsLocalProxy] = useState(false);
  const [paymentKind, setPaymentKind] = useState(0)
  const [successNFTID, setSuccessNFTID] = useState('0')
  const [myAddress, setMyAddress] = useState('')
  const [selectedPlan, setSelectedPlan] = useState< '12' | '1' | string >('12');
  const [airdropProcess, setAirdropProcess] = useState(false)
  const [airdropSuccess, setAirdropSuccess] = useState(false)
  const [airdropTokens, setAirdropTokens] = useState(0)
  const [airdropProcessReff, setAirdropProcessReff] = useState(false)
  const [getWebFilter, setGetWebFilter] = useState(false)
  const webFilterRef=useRef(getWebFilter);
  const [switchValue, setSwitchValue] = useState(true);
  const [quickLinksShow, setQuickLinksShow] = useState(false);
  const [showReferralsInput, setShowReferralsInput] = useState(false);
  const firstLoad = useRef(true); //系统代理 第一次
  const firstLoad2 = useRef(true);  //快捷链接 第一次
  const firstLoad3 = useRef(true);  //过滤开启 第一次
  const [duplicateAccount, setDuplicateAccount] = useState(null)
  const [subscriptionVisible, setSubscriptionVisible] = useState<boolean>(false);
  const [airdropVisible, setAirdropVisible] = useState<boolean>(false);
  const [referralsVisible, setReferralsVisible] = useState<boolean>(false);
  const [passportVisible, setPassportVisible] = useState<boolean>(false);
  const [checkInVisible, setCheckInVisible] = useState<boolean>(false);
  const [genesisVisible, setGenesisVisible] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [statusVisible, setStatusVisible] = useState<boolean>(false);
  const [checkinBalanceUP, setCheckinBalanceUP] = useState<boolean>(false);
  const [ruleVisible, setRuleVisible] = useState<boolean>(false);
  const [hasNewVersion, setHasNewVersion] = useState<boolean|string>(false);
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [currentBlock,setCurrentBlock] = useState(0)
  const [beamio, setBeamio] = useState<beamio|null>(null)
  const [usdcbalance, setUsdcbalance] = useState(0)
  const [showFooter, setShowFooter] = useState(true)
	const [secureCode, setSecureCode] = useState('')
	const [redeemCode, setRedeemCode] = useState('')
	const [ignoreUrl, setIgnoreUrl] = useState(false)
	const [redeemFromUrl, setRedeemFromUrl] = useState<{ cardAddress?: string; redeemCode: string } | null>(null)
	const [redeemResult, setRedeemResult] = useState<{ success: boolean; tx?: string; error?: string } | null>(null)
	const [payTag, setPayTag] = useState('')
	const [beamioUsers, setbBeamioUsers] = useState<searchResult[]>([])
	const [currencyData, setCurrencyData] = useState({
		CAD: 0,
		USD: 0,
		JPY: 0,
		CNY: 0,
		USDC: 0,
		HKD: 0,
		SGD: 0,
		EUR: 0,
		TWD: 0
	})

  useEffect(() => {
    {
      const pac = `http://${serverIpAddress}:${serverPort}/pac`
      setServerPac(pac)
    }
  }, [serverIpAddress, serverPort])

  useEffect(()=>{
    let storage = window.localStorage;
    const systemProxy=(storage&&storage.systemProxy?JSON.parse(storage.systemProxy):true);
    setSwitchValue(systemProxy);

    const webFilter=(storage&&storage.webFilter?JSON.parse(storage.webFilter):false);
    setGetWebFilter(webFilter);

    const LOCAL_SHOW_KEY = 'silentpass_shortcut_show';
    const isShowLinks=(storage&&storage[LOCAL_SHOW_KEY]?JSON.parse(storage[LOCAL_SHOW_KEY]):false);
    setQuickLinksShow(isShowLinks);
  },[])

  useEffect(()=>{
    if(!firstLoad.current){
      let storage = window.localStorage;
      storage.systemProxy=JSON.stringify(switchValue);
    }
    firstLoad.current=false;
  },[switchValue])

  useEffect(()=>{
    if(!firstLoad3.current){
      let storage = window.localStorage;
      webFilterRef.current=getWebFilter;
      storage.webFilter=JSON.stringify(getWebFilter);
    }
    firstLoad3.current=false;
  },[getWebFilter])

  useEffect(()=>{
    if(!firstLoad2.current){
      const LOCAL_SHOW_KEY = 'silentpass_shortcut_show';
      let storage = window.localStorage;
      storage[LOCAL_SHOW_KEY]=JSON.stringify(quickLinksShow);
    }
    firstLoad2.current=false;
  },[quickLinksShow])

  return (
    <Daemon.Provider value={{ power, setPower, sRegion, setSRegion, allRegions, setAllRegions, setRuleVisible,hasNewVersion, setHasNewVersion, version, secureCode, setSecureCode,
				closestRegion, setClosestRegion, isRandom, setIsRandom, miningData, setMiningData, currentBlock,setCurrentBlock,paymentLink, setPaymentLink, redeemCode, setRedeemCode,
				profiles, setProfiles, isMiningUp, setIsMiningUp, getAllNodes, setaAllNodes, serverIpAddress,darkModle, setDarkModle, beamioAppInstalled, setBeamioAppInstalled,
				setServerIpAddress, serverPort, setServerPort, serverPac, setServerPac, _vpnTimeUsedInMin, privacyMode, setPrivacyMode, ignoreUrl, setIgnoreUrl, 				paymentLinkCode, setPaymentLinkCode, redeemFromUrl, setRedeemFromUrl, redeemResult, setRedeemResult,
				isPassportInfoPopupOpen, setIsPassportInfoPopupOpen, activePassportUpdated, setActivePassportUpdated,beamio, setBeamio,payTag, setPayTag, myAddress, setMyAddress,
				activePassport, setActivePassport, isSelectPassportPopupOpen, setIsSelectPassportPopupOpen, showReferralsInput, setShowReferralsInput, usdcToUSD, setUsdcToUSD,
				setRandomSolanaRPC, randomSolanaRPC, isIOS, setIsIOS, isLocalProxy, setIsLocalProxy, globalProxy, setGlobalProxy,usdcbalance, setUsdcbalance, currencyData, setCurrencyData,
				paymentKind, setPaymentKind, successNFTID, setSuccessNFTID, selectedPlan, setSelectedPlan, airdropProcess, setAirdropProcess,sendToMemo, setSendToMemo, charts, setCharts,
				airdropSuccess, setAirdropSuccess, airdropTokens, setAirdropTokens, airdropProcessReff, setAirdropProcessReff, getWebFilter, listenningProcess, setListenningProcess,
				setGetWebFilter,switchValue, setSwitchValue, webFilterRef, quickLinksShow, setQuickLinksShow, duplicateAccount, checkinBalanceUP, setCheckinBalanceUP, gossip, setGossip,
				beamioUsers, setbBeamioUsers, showFooter, setShowFooter, payMePayment, setPayMePayment, navigateLeftButtonArray, setNavigateLeftButtonArray, allNodes, setAllNodes,
				chatHomeItem,setChatHomeItem,scanData, setScanData, scanIntent, setScanIntent, voucherPayAmount, setVoucherPayAmount, voucherPayToAA, setVoucherPayToAA, voucherPayError, setVoucherPayError, messageCount, setMessageCount, msgCountLockRef, seenMsgRef, scanRef, historyPayData, setHistoryPayData,
        		setDuplicateAccount,subscriptionVisible, setSubscriptionVisible, airdropVisible, setAirdropVisible, referralsVisible, setReferralsVisible, passportVisible, 
				setPassportVisible, checkInVisible, setCheckInVisible, genesisVisible, setGenesisVisible, isInitialLoading, setIsInitialLoading, statusVisible, setStatusVisible, ruleVisible }}>
			{/* ✅ 常驻隐藏扫码组件：不占布局，但随时可 start */}
			<div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}>
			<ScanButton ref={scanRef} hidden />
			</div>

      {children}
    </Daemon.Provider>
  );
}
