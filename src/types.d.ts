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
  conet: CryptoAsset;
  cCNTP: CryptoAsset;
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
  nodeID?: number;
  nodeIP_address?: string;
  nodeRegion?: string;
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
