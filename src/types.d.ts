interface Region {
	code: string;
	country: string;
  }
  
  interface ClosestRegion {
	node: nodes_info;
	delay: number;
  }
  
  interface keyPair {
	keyID: string;
	publicKeyArmor?: string;
	privateKeyArmor?: string;
	keyObj?: {
	  publicKeyObj: any;
	  privateKeyObj: any;
	};
  }
  
  type pgpKeyPair = {
	privateKeyArmor: string;
	publicKeyArmor: string;
	publicKeyObj?: any;
	privateKeyObj?: any;
  };


  interface Staking {
	totalAmount: number
	claimedAmount: number
	startTime: Date
	releaseDuration: number
	claimableAmount: number
	lockedAmount: number
  }
  interface CryptoAsset {
	balance: string;
	network: string;
	decimal: number;
	contract: string;
	name: string;
	unlocked?: boolean;
	usd?: string
	balance1?: number
	staking?: Staking[]
  }
  
  interface conet_tokens {
	cCNTP: CryptoAsset;
	conet: CryptoAsset;
	conetDepin: CryptoAsset;
	conet_eth: CryptoAsset;
	eth: CryptoAsset;
	sol: CryptoAsset;
	sp: CryptoAsset;
	sGB: CryptoAsset;
	usdt: CryptoAsset;
  }
  
  interface freePassport {
	nftID: string;
	expires: string;
	expiresDays: string;
	premium: boolean;
  }
  
  type keyPairType = "ethereum" | "solana";
  
  interface SolanaWallet {
	publicKey: string;
	privateKey: string;
  }

  type chatData = {
		address: string
		messages: ChatMessage[]
		beamio: searchResult
		chatData: {
			privateArmored: string;
			publicArmored: string;
			routersArmoreds: string;
			online: boolean;
			routePgpKeyID: string;
		}
		pin: boolean
		hide: boolean
		unreadCount: number
		tag: 'red'|'green'|'blue'|'grey'
		muted: boolean
		lastReadTs?: number
	}
  
  interface profile extends keyPair {
	isPrimary?: boolean;
	pgpKey?: pgpKeyPair;
	privateKeyArmor: string;
	emailAddr?: string;
	hdPath: string | null;
	index: number;
	tokens: conet_tokens;
	isNode: boolean;
	referrer: string | null | undefined;
	spClub?: SpClub;
	SpClubPoints?: SpClubPoints
	spChannel?:SpClub
	airdropEvent?: IAirdrop
	data?: any;
	type?: keyPairType;
	nodeID?: number;
	nodeIP_address?: string;
	nodeRegion?: string;
	activePassport?: freePassport;
	vpnTimeUsedInMin?: number;
	silentPassPassports?: passportInfo[];
	webFilter?: boolean
	chats?: chatData[]
	chatManager?: IChat
	aaAccount?: string
  }
  
  interface SpClubReferees {
	walletAddress: string;
	activePassport: string//freePassport;
  }

  interface spChannelPoints {
	totalChannelPartnersNewUser: number
	totalChannelPartnersRedeem: number
	totalChannelPartnersSubscription: number
	totalChannelPartnersGenesis: number
	totalChannelPartnersDailyUser: number
	totalChannelPartnersBandwidth: number
	totalChannelPartnersDownloadLink: number
	bandwidthChannelPartners: number
	subscriptionChannelPartners: number
	genesisChannelPartners: number
	newUserChannelPartners: number
	redeemChannelPartners: number
	downloadhannelPartners: number
  }

  
type paymentCard = {
		amount: number
		currency: ICurrency
		title: string
		timeStamp: number
		usdcAmount: number
		cashcodeUrl: string
		/** 卡片类型：不传或 payment 为普通支付，cashcode 由 cashcodeUrl 决定，membershipActivated 为会员已激活 */
		cardType?: "payment" | "cashcode" | "membershipActivated"
		/** 仅 membershipActivated：状态胶囊文案，如 "Confirmed on-chain" */
		statusLabel?: string
		/** 辅助字段：交易 hash（如链上 tx hash），可用于 View Invoice 等 */
		hash?: string
	}


  interface SpClubPoints {
	SPHolderPoint: number
	RefferentSPHolderPoint: number
	SubscriptionPoint: number
	RefferentSubscriptionPoint: number
	ClaimableSubscriptionPoint: number
	ClaimableRefferentSubscriptionPoint: number
  }

	type currencyData = {
		CAD: number
		USD: number
		JPY: number
		CNY: number
		USDC: number
		HKD: number
		SGD: number
		TWD: number
		EUR: number
	}

	type ICurrency = 'CAD'|'USD'|'JPY'|'CNY'|'USDC'|'HKD'|'EUR'|'SGD'|'TWD'
	type ILanguage = 'en'
  
  interface SpClub {
	memberId: string;
	referrer: string;
	referees: SpClubReferees[];
	totalReferees: number;

  }

	type beamioAddedSetup = {
		language: ILanguage
		currency: ICurrency
		tax: string
	}

	type searchkeywork = {
		keyward: string
		type: 'search'|'beamio'
		beamio?: searchResult
	}

	type ISearch = {
		searchKeywords: searchkeywork[]
		searchBeamios: searchkeywork[]
	}

	type searchResult = {
		address: string
		created_at: number
		first_name: string
		image: string
		last_name: string
		username: string
		follow_count: string
		follower_count: string
	}


  
  type encrypt_keys_object = {
	profiles: profile[];
	isReady: boolean;
	ver: number;
	preferences?: any;
	encryptedString?: string;
	passcode?: Passcode;
	mnemonicPhrase: string;
	fragmentClass?: FragmentClass;
	nonce: number;
	fx168Order?: fx168_Order[];
	upgradev2?: boolean;
	webFilter: boolean;
	recoveryWords?:string;
	duplicateCode?: string
	duplicateCodeHash?: string
	duplicatePassword?: string
	duplicateMnemonicPhrase?: string
	duplicateAccount?:profile
	_duplicateCode?:string
	ChannelPartners?: string
	referrals?: string
	beamio: beamio
	search?: ISearch
  }
  
  interface passportInfoFromChain {
	nftIDs: BigInt[];
	expires: BigInt[];
	expiresDays: BigInt[];
	premium: boolean[];
  }
  
  interface passportInfo {
	walletAddress: string;
	nftID: number;
	expires: number;
	expiresDays: number;
	premium: boolean;
	network: string;
  }
  
  type Passcode = {
	status: PasscodeStatus;
  };
  
  interface FragmentClass {
	mainFragmentName: string;
	failures: number;
  }
  
  interface fx168_Order {
	publishTx?: string;
	timestamp: number;
	status: "pending" | "active" | "problem";
	uuid: string;
	nodes: number;
  }
  
  type nodes_info = {
	country: string;
	customs_review_total?: number;
	ip_addr: string;
	last_online: boolean;
	lat?: number;
	lon?: number;
	outbound_total?: number;
	region: string;
	armoredPublicKey: string;
	publicKeyObj?: any;
	domain?: string;
	nftNumber: number;
  };
  
  interface nodeResponse {
	status?: number;
	epoch?: number;
	hash?: string;
	rate?: string;
	nodeWallet?: string;
	currentCCNTP?: string;
	minerResponseHash?: string;
	userWallets?: string[];
	totalUsers: string;
	nodeWallets?: string[];
	online?: string;
  }
  
  type SICommandObj_Command =
	| "getCoNETCashAccount"
	| "regiestRecipient"
	| "connecting"
	| "SaaS_Proxy"
	| "SaaS_Sock5"
	| "SaaS_Sock5_Data_Entry"
	| "mining"
	| "mining_validator";
  
  interface SICommandObj {
	command: SICommandObj_Command;
	responseError?: string | null;
	responseData?: any[];
	algorithm: "aes-256-cbc";
	Securitykey: string;
	requestData: any[];
	walletAddress: string;
  }
  
  interface Window {
	webkit: {
	  messageHandlers: {
		[handlerName: string]: {
		  postMessage: (message: any) => void;
		};
	  };
	};
  }


type IAirdrop = {
	isNewUser: boolean
	isGenesis: boolean
	startTimestamp?: Date
	stopTimestamp: Date
	maxGB: string
	currentWeekGB: string
	totalUserGB: string
	currectPassport: number
	currectThreshold: number
	currectThresholdGB: string
	totalThresholdGB: string
}
  
  type Native_node = {
	country: string;
	ip_addr: string;
	region: string;
	armoredPublicKey: string;
	nftNumber: string;
  };
  
  type Native_StartVPNObj = {
	entryNodes: Native_node[];
	privateKey: string;
	exitNode: Native_node[];
  };
  
  interface spOracle {
	sp249: string;
	sp2499: string;
	sp999: string;
	sp9999: string;
	so: string;
  }
  
  interface ICoNET_DL_masterSetup {
	SP_purchase: string;
	solanaManager: string;
	SP_Oracle: string;
	ethEndpoint: string;
	SilentPassAirdrop: string[];
	mainnet_passport_airdrop: string;
	conetian_eth_airdrop: string;
	epochManagre: string;
	LayerMinus: [];
	constGAMEAccount: string[];
	cancun_Guardiner_init: string;
	cancun_CONETian_Init: string;
	ETH_Manager: string[];
	conetDePINAdmin_scan: string[];
	conetDePINEthAdmin: string[];
	conetDePINAdmin: string[];
	conetFaucetAdmin_1: string[];
	constGAMEAccount: string[];
  
	GossipNodeAdmin: string[];
	//			new Admin
	oracleManager: string;
	conetNodeAdmin: string[];
	conetCNTPAdmin: string[];
	guardianAmin: string[];
	guardianReferralAdmin: string[];
	gameCNTPAdmin: string[];
	claimableAdminNew: string;
	guardianBuyADMIN: string[];
	initManager: string[];
	conetPointAdmin: string;
	GuardianReferralsFree: string;
	cusdtAdmin: string;
	cnptReferralAdmin: string;
	conetStorageAdmin: string;
	conetFaucetAdmin: string[];
	newFaucetAdmin: string[];
	conetFaucetAdmin2;
	claimableAdmin: string;
	claimableAdminForNode: string;
	GuardianAdmin: string;
	GuardianReferrals: string;
	"13b995b1fDotCa": {
	  Key: string;
	  cert: string;
	};
	Cassandra: {
	  databaseEndPoints: string[];
	  auth: {
		username: string;
		password: string;
	  };
	  certificate: ICoNET_certificate;
	  keyspace: string;
	};
	seguroWebhook: {
	  path: string;
	  Secret_key: string;
	  endpointSecret: string;
	};
	CoNETPubSub: {
	  port_number: number;
	  certificate: ICoNET_certificate;
	  client: ICoNET_certificate;
	};
	master_wallet_public: string;
	cloudflare: {
	  X_Auth_Email: string;
	  X_Auth_Key: string;
	  endpoint: string;
	  zoneID: string;
	  domainname: string;
	  path: string;
	};
	ssl: {
	  certificate: string;
	  key: string;
	};
	passwd: string;
	PORT: number;
	CoinMarketCapAPIKey: string;
	storagePATH: string[];
  }
interface airDropStatus {
	isReadyForSP: boolean
	isReadyForReferees: boolean
}


type AuthorizationPayload = {
	x402Version: number
	scheme: 'exact'
	network: 'base' | string
	payload: {
		signature: `0x${string}`
		authorization: {
			from: string
			to: string
			value: string
			validAfter: string
			validBefore: string
			nonce: `0x${string}`
		}
	}
}

type Argon2idParams = {
	memoryKB: number   // 内存（KB）
	iterations: number // 迭代次数
	parallelism: number
	hashLen: number    // 输出长度（字节）
}

type Handler = (payload: any) => void

type Argon2idHash = {
	algo: 'argon2id'
	v: number
	m: number
	t: number
	p: number
	salt: string // base64
	hash: string // base64
}


  type beamio = {
		accountName: string
		image: string
		darkTheme: boolean
		isUSDCFaucet: boolean
		isETHFaucet: boolean
		initialLoading: boolean
		firstName?: string
		lastName?: string
		createdAt?: number
		language: ILanguage
		currency: ICurrency
		address?: string
		payme?: string
		pgpPublicKeyID?: string
		pgpPublicKeyArmor?: string
		tax?: string
		
  }

	type IMessageDataAccountInfo = {
		accountName: string
		address: string
		firstName: string
		lastName: string
		image: string
	}

type IMessageData = {
	receive: IMessageDataAccountInfo
	sender: IMessageDataAccountInfo
	node: string
	sginTatle: 'send'
	reqUrl: string
	amount: string
	fee?: string
	usdcAmount?: string
	currencyAmount: string
}

type PaymentLinkLockMode = "FIAT_LOCKED" | "USDC_LOCKED";


type HistoryFilter =
  | 'all'
  | 'sent'
  | 'received'
  | 'pending'
  | 'completed'
  | 'reject'
  | 'paid'
  | 'deposited'
  | 'payme'
  | 'active'


type IImageCard = {
	title: string
	detail: string
	image: string,
	currency: ICurrency
	currencyAmount: string
}

type payMe = {
	currency: ICurrency
	currencyAmount: string
	currencyTip?: string
	currencyDiscount?: string
	currencyDiscountAmount?: string
	tip?: number
	parentHash?: string
	oneTimeMode?: boolean
	code?: string
	title?: string
	currencyTax?: string
	usdcAmount?: number
	depositHash?: string
}

type IRequestCurrencyDetail = {
	requestCurrency: ICurrency
	requestCurrencyAmount?: number
	requestUSDAmount?: number

	totalPayCurrency: number
	totalPayUSDC: number
	feeCurrency: number
	feeUSDC: number
	receivedCurrency: number
	receivedUSDC: number
	currencyTip: number
	USDCTip: number
	rate: number
	taxCurrency?: number
	taxUSDC?: number
	code?: string
	title?: string
	textNote?: string
}

type paymentType = 'payme'|'onetime'|'reusable'


type INavigateLeftButtonArray = {
	title: string
	action: Array<() => void>
}

type Mode = "pay" | "request" | 'cashcode'

type initBeamioPGPKeysRet = {
	privateKey: string
	publicKey: string
	keyID: string
	routes: string
}

type TransferHistork = {
	date: number
	amount: number
	address: string
	hash: string
	note: string
	type: HistoryFilter
	security?: string
	passcode?: string
	redeemHash?: string
	mode: Mode
	type1: HistoryFilter|''
	fee: number
	preAmount: number
	card?: IImageCard
	requestCurrency?: ICurrency
	requestDetail?: IRequestCurrencyDetail
	group?: paymentType
	payme?: payMe
}

type LinksHistory = {
	to: string
    successAuthorizationHash: string
    chianID: bigint
    erc3009Address: string
    node: string
    amount: bigint
    decimals: bigint
    issueTimestamp: bigint
    payHash: string
    payTimestamp: string
    from: string
    payAmount: string
	
}

type Transfer = {
	to: string
	timestamp: bigint
	from: string
	amount: string
	finisedHash: string
	note: string
}

interface nodeInfo {
	region: string
	ip_addr: string
	armoredPublicKey: string
	nftNumber: number
	domain: string
	lastEposh?: number
    owner?: string
}

type IChat = {
	pgpKey: initBeamioPGPKeysRet
	router: string
}

type ChatMessage = {
	id: string
	from: "me" | "them"
	text: string
	createdAt: number
	status?: "sending" | "sent" | "failed"
	paymentCard?: paymentCard
}

type CheckHistory = {
	from: string
    successAuthorizationHash: string
    chianID: bigint
    erc3009Address: string
    node: string
    amount: bigint
    decimals: bigint
    createTimestamp: bigint 
    depositHash: string
    depositTimestamp: bigint 
    to: string
    payHash: string
}

type IGtCheckMemooo = {
	payHash: string
	from: string
	amount: bigint
	depositHash: string
	chianID: bigint
	erc3009Address: string
	decimals: bigint
	node: string
	createTimestamp: bigint
}

type MyCardAssets = {
	address: string
	cardAddress: string
	points: string
	cardOwner: searchResult | null
	cardCurrency: ICurrency
	usdcBalance?: string
	nfts: {
		tokenId: string
		attribute: string
		tier: string
		expiry: string
		isExpired: boolean
	}[]
}

type BeamioAction = {
	actionId: bigint,
    actionType: bigint, // mint | burn | transfer
    card: string,
    from: string,
    to: string,
    amount: bigint,
    timestamp: bigint,
    title: string,
    note: string,
    tax: bigint,
    tip: bigint,
    beamioFee1: bigint,
    beamioFee2: bigint,
    cardServiceFee: bigint,
    afterTatchNoteByFrom: string,
    afterTatchNoteByTo: string,
    afterTatchNoteByCardOwner: string
}


enum BeamioActionTypeEnum {
	TOKEN_MINT = 1,
	TOKEN_BURN = 2,
	TOKEN_TRANSFER = 3
}

type BeamioActionResponse = {
	action: BeamioActionType
	cardAddress: string
	from: string
	to: string
	amount: string
	timestamp: number
	title: string
	note: string
	tax: number
	tip: number
	beamioFee1: number
	beamioFee2: number
	cardServiceFee: number
	afterTatchNoteByFrom: string
	afterTatchNoteByTo: string
	afterTatchNoteByCardOwner: string
	payMe: payMe|undefined
}