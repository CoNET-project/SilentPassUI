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

interface CryptoAsset {
  balance: string;
  network: string;
  decimal: number;
  contract: string;
  name: string;
  unlocked?: boolean;
}

interface conet_tokens {
  cCNTP: CryptoAsset;
  conet: CryptoAsset;
  conetDepin: CryptoAsset;
  conet_eth: CryptoAsset;
  eth: CryptoAsset;
  sol: CryptoAsset;
  sp: CryptoAsset;
}

interface freePassport {
  nftID: string;
  expires: string;
  expiresDays: string;
  premium: string;
}

type keyPairType = "ethereum" | "solana";

interface SolanaWallet {
  publicKey: string;
  privateKey: string;
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
  data?: any;
  type?: keyPairType;
  nodeID?: number;
  nodeIP_address?: string;
  nodeRegion?: string;
  activePassport?: freePassport;
  vpnTimeUsedInMin?: number;
  silentPassPassports?: passportInfo[];
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
};

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
  status: number;
  epoch: number;
  hash: string;
  rate: string;
  nodeWallet: string;
  currentCCNTP?: string;
  minerResponseHash?: string;
  userWallets: string[];
  nodeWallets?: string[];
  online: number;
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
