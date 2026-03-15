import React, { useState, useCallback, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { CoNET_Data, setCoNET_Data } from '@/utils/globals';
import { storeSystemData } from '@/services/beamio';
import BeamioMeMainScreen from '@/components/Setting';
import { searchUsername } from '@/services/beamio';
import { checkRedeemAdminCodeValid, isCardAdmin, postCardRedeemAdmin, getAAAccount } from '@/services/BeamioCard';
import { parseRedeemAdminFromUrl } from '@/utils/parseRedeemAdminFromUrl';
import { signRegisterPOS, generateRegisterPOSNonce, registerPOSApi, signRemovePOS, removePOSApi, getMerchantPOSListFromCoNET } from '@/services/merchantPOS';
import {
 LayoutDashboard,
 Receipt,
 Wallet,
 Users,
 Settings,
 LogOut,
 TrendingUp,
 Search,
 Filter,
 CheckCircle2,
 ArrowRightLeft,
 Building2,
 Ticket,
 Coins,
 X,
 ArrowDownToLine,
 ArrowUpFromLine,
 Activity,
 KeyRound,
 Cpu,
 Heart,
 Landmark,
 ExternalLink,
 Info,
 Smartphone,
 Nfc,
 MessageSquare,
 Send,
 Crown,
 MonitorSmartphone, // 新增：用于终端图标
 Plus,              // 新增：用于添加按钮
 Trash2,            // 新增：用于删除按钮
 Link as LinkIcon,  // 新增：用于关联图标
 Copy,
 Check,
 Fuel,
 Store,
 Shield,
 Zap,
 Lock,
 QrCode,
 Database,
 Hexagon,
 Award,
 CreditCard,
 Paperclip,
 MoreVertical,
 AlertTriangle,
 ChevronRight,
 Sparkles,
 Box,
 ShieldCheck
} from 'lucide-react';

const getImg = (avatarSeed: string | undefined) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || '@Beamio')}`;

/** beamio 表示 name 的 protocol，与 Home displayName 一致；兼容 first_name/last_name 与 firstName/lastName */
const displayName = (item: { firstName?: string; lastName?: string; first_name?: string; last_name?: string; accountName?: string } | null | undefined) => {
  if (!item) return ''
  const first = (item as { firstName?: string; first_name?: string }).firstName ?? (item as { first_name?: string }).first_name ?? ''
  const lastRaw = (item as { lastName?: string; last_name?: string }).lastName ?? (item as { last_name?: string }).last_name ?? ''
  const lastname = String(lastRaw || '').split('\r\n') || []
  const fullName = `${first || ''} ${/^\{/.test(lastname[0] || '') ? '' : lastname[0] || ''}`.trim()
  const tag = (item as { accountName?: string; username?: string }).accountName ?? (item as { username?: string }).username
  return fullName || tag || ''
}

/** Beamio 胶囊：左侧头像，右侧 first_name + last_name 及 @beamioTag */
type BeamioProfile = { first_name?: string; firstName?: string; last_name?: string; lastName?: string; accountName?: string; username?: string; image?: string } | null
const BeamioCapsule = ({ item, fallbackAddress, className = '' }: { item: BeamioProfile; fallbackAddress?: string; className?: string }) => {
  const tag = item ? ((item as { accountName?: string }).accountName ?? (item as { username?: string }).username) : undefined
  const beamioTag = tag ? `@${tag}` : undefined
  if (item && (displayName(item) || beamioTag)) {
    return (
      <div className={`inline-flex items-center gap-3 rounded-full pl-1 pr-4 py-1.5 ${className}`}>
        <img
          src={item.image ? item.image : getImg(tag)}
          alt={beamioTag ?? ''}
          className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
        />
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[13px] font-semibold text-white truncate max-w-full leading-tight">
            {displayName(item) || '—'}
          </span>
          {beamioTag && (
            <span className="text-[11px] font-medium text-white/70 truncate max-w-full leading-tight">
              {beamioTag}
            </span>
          )}
        </div>
      </div>
    )
  }
  if (fallbackAddress && fallbackAddress.length >= 10) {
    return <AddressCapsule address={fallbackAddress} className={className} />
  }
  return <span className="text-[13px] text-white/60">Unavailable</span>
}

// --- Precise Mock Data reflecting the exact Discount & Source logic ---
// 更新：每条记录增加了 `terminal` 字段，用于追溯是哪台终端完成的收款
const MOCK_TRANSACTIONS = [
 {
   id: 'TX-1042', time: '14:22 PM', type: 'Charge', subtotal: 85.00, tip: 15.00, total: 100.00,
   method: 'Mixed', ctreeAmount: 40.00, usdcAmount: 60.00,
   source: 'APP', beamioTag: '@alice_chen', status: 'Settled', hash: '0x1a...f9', terminal: '@ut_reg1'
 },
 {
   id: 'TX-1043', time: '15:05 PM', type: 'In-Store Top-Up', subtotal: 100.00, tip: 0.00, total: 100.00,
   method: 'Issued $CTree', ctreeAmount: 100.00, usdcAmount: 0,
   source: 'NFC', beamioTag: null, status: 'Settled', hash: '0x2b...e4', terminal: '@ut_reg1'
 },
 {
   id: 'TX-1044', time: '16:10 PM', type: 'Charge', subtotal: 12.50, tip: 2.00, total: 14.50,
   method: '$CTree (Green Tier)', ctreeAmount: 14.50, usdcAmount: 0,
   source: 'NFC', beamioTag: null, status: 'Settled', hash: '0x3c...d1', terminal: '@ut_kiosk2'
 },
 {
   id: 'TX-1045', time: '16:45 PM', type: 'Charge', subtotal: 45.00, tip: 5.00, total: 50.00,
   method: 'USDC (No Discount)', ctreeAmount: 0, usdcAmount: 50.00,
   source: 'APP', beamioTag: '@bobby_s', status: 'Settled', hash: '0x4d...c2', terminal: '@ut_reg1'
 },
 {
   id: 'TX-1046', time: '17:30 PM', type: 'Charge', subtotal: 75.00, tip: 10.00, total: 85.00,
   method: '$CTree (Black Tier)', ctreeAmount: 85.00, usdcAmount: 0,
   source: 'APP', beamioTag: '@char_w', status: 'Settled', hash: '0x5e...b3', terminal: '@ut_kiosk2'
 },
];

// Alliance database for Store Wallets, Partner Alliances
const INITIAL_ALLIANCES_DB = {
  CashTrees: {
    id: 'CashTrees',
    name: 'CashTrees Network',
    nftName: 'CashTrees Partner Card',
    token: '$CTree',
    nftBg: 'bg-[#4854e8]',
    nftBorder: 'border-[#5d68eb]',
    themeLightBg: 'bg-emerald-50',
    themeText: 'text-emerald-600',
    sales: 14000.00,
    tips: 1200.00,
    topUps: 50000.00,
    aaBalance: 1400.00,
    canTopUp: true,
    mintQuota: 50000.00,
    privileges: [
      { title: 'Full Access: $CTree', desc: 'Process payments, issue cards, and handle upgrades at POS.' },
      { title: 'CAD Trust Settlement', desc: 'Unlock fiat payouts via local MSB.' },
      { title: 'Membership Routing', desc: 'Auto-apply VIP tier discounts.' }
    ]
  },
  CCSA: {
    id: 'CCSA',
    name: 'CCSA Alliance',
    nftName: 'CCSA Franchise Node',
    token: '$CCSA',
    nftBg: 'bg-[#581c87]',
    nftBorder: 'border-[#7e22ce]',
    themeLightBg: 'bg-purple-50',
    themeText: 'text-purple-600',
    sales: 450.00,
    tips: 50.00,
    topUps: 120.00,
    aaBalance: 380.00,
    canTopUp: true,
    mintQuota: 10000.00,
    privileges: [
      { title: 'Full Access: $CCSA', desc: 'Process payments, issue cards, and handle upgrades at POS.' },
      { title: 'B2B Supply Chain', desc: 'Pay wholesale suppliers in $CCSA.' },
      { title: 'Cross-Store Discounts', desc: 'Shared loyalty across 100+ stores.' }
    ]
  },
  SenPho: {
    id: 'SenPho',
    name: 'Sen Pho Franchise',
    nftName: 'Sen Pho Master License',
    token: '$PHO',
    nftBg: 'bg-[#991b1b]',
    nftBorder: 'border-[#b91c1c]',
    themeLightBg: 'bg-red-50',
    themeText: 'text-red-600',
    sales: 850.00,
    tips: 110.00,
    topUps: 0.00,
    aaBalance: 660.00,
    canTopUp: false,
    mintQuota: null as number | null,
    privileges: [
      { title: 'Consumption Only: $PHO', desc: 'Process payments. Top-ups and upgrades disabled.' },
      { title: 'HQ Franchise Settlement', desc: 'Direct corporate treasury payouts.' },
      { title: 'Inventory Purchasing', desc: 'Use $PHO for wholesale ingredients.' }
    ]
  },
  UrbanPlay: {
    id: 'UrbanPlay',
    name: 'UrbanPlay Pass',
    nftName: 'UrbanPlay Vendor Node',
    token: '$UPASS',
    nftBg: 'bg-[#0f766e]',
    nftBorder: 'border-[#0d9488]',
    themeLightBg: 'bg-teal-50',
    themeText: 'text-teal-600',
    sales: 120.00,
    tips: 0.00,
    topUps: 0.00,
    aaBalance: 120.00,
    canTopUp: false,
    mintQuota: null as number | null,
    privileges: [
      { title: 'Consumption Only: $UPASS', desc: 'Process payments. Top-ups and upgrades disabled.' },
      { title: 'Event Ticketing', desc: 'Validate Class-B NFT tickets.' }
    ]
  }
};

type AllianceId = keyof typeof INITIAL_ALLIANCES_DB;

const MOCK_CONTACTS = [
  { id: 'c1', tag: '@cashtrees_support', name: 'CashTrees Network', type: 'Alliance', lastMessage: 'Your KYB application is approved.', time: '10:42 AM', unread: 0, avatarBg: 'bg-[#4854e8]', avatarText: 'CT' },
  { id: 'c2', tag: '@alice_chen', name: 'Alice Chen', type: 'Customer', lastMessage: 'Thanks for the great service today!', time: 'Yesterday', unread: 2, avatarBg: 'bg-emerald-500', avatarText: 'AC' },
  { id: 'c3', tag: '@senpho_wholesale', name: 'Sen Pho Supply', type: 'Supplier', lastMessage: 'Invoice #882 paid via $PHO.', time: 'Tuesday', unread: 0, avatarBg: 'bg-rose-500', avatarText: 'SP' }
];

const MOCK_MESSAGES = [
  { id: 'm1', sender: 'them', text: 'Hello, we received your Partner NFT application.', time: '10:30 AM' },
  { id: 'm2', sender: 'me', text: 'Great, what else is needed for the KYB process?', time: '10:35 AM' },
  { id: 'm3', sender: 'them', text: 'Nothing else. Your business details have been verified via CoNET.', time: '10:40 AM' },
  { id: 'm4', sender: 'them', text: 'Your KYB application is approved. The Alliance NFT has been minted directly to your Smart Terminal.', time: '10:42 AM' }
];

/** 指定商户卡地址 - 必须使用此卡 */
const FIXED_USER_CARD_CONTRACT_ADDRESS = '0x02BAe511632354584b198951B42eC73BACBc4E98'
const BASE_RPC_URL = 'https://1rpc.io/base'
const BEAMIO_APP_URL = 'https://beamio.app'
const baseRpcProvider = new ethers.JsonRpcProvider(BASE_RPC_URL)
const BIZ_CACHE_PREFIX = 'beamio:biz-example:'
/** Set to false to hide the Linked Merchant Card panel */
const SHOW_LINKED_MERCHANT_CARD_PANEL = false
const USER_CARD_ADMIN_READ_ABI = [
  'function owner() view returns (address)',
  'function isAdmin(address) view returns (bool)',
  'function getAdminListWithMetadata() view returns (address[] admins, string[] metadatas, address[] parents)',
  'function getAdminStatsFull(address admin, uint8 periodType, uint256 anchorTs, uint256 cumulativeStartTs) view returns (uint256 cumulativeMint, uint256 cumulativeBurn, uint256 cumulativeTransfer, uint256 cumulativeTransferAmount, uint256 cumulativeRedeemMint, uint256 cumulativeUSDCMint, uint256 cumulativeIssued, uint256 cumulativeUpgraded, uint256 periodMint, uint256 periodBurn, uint256 periodTransfer, uint256 periodTransferAmount, uint256 periodRedeemMint, uint256 periodUSDCMint, uint256 periodIssued, uint256 periodUpgraded, uint256 mintCounterFromClear, uint256 burnCounterFromClear, uint256 transferCounterFromClear, uint256 redeemMintCounterFromClear, uint256 usdcMintCounterFromClear, address[] subordinates)',
] as const

type FixedUserCardMetadata = {
  name?: string
  description?: string
  image?: string
  cardOwner?: string
}

const firstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

const parseFixedUserCardMetadata = (raw: unknown, cardOwner?: string): FixedUserCardMetadata | null => {
  if (!raw || typeof raw !== 'object') return null;
  const meta = raw as Record<string, unknown>;
  const share = meta.shareTokenMetadata && typeof meta.shareTokenMetadata === 'object'
    ? meta.shareTokenMetadata as Record<string, unknown>
    : null;

  const parsed: FixedUserCardMetadata = {
    name: firstNonEmptyString(share?.name, meta.name),
    description: firstNonEmptyString(share?.description, meta.description),
    image: firstNonEmptyString(share?.image, meta.image),
    ...(cardOwner ? { cardOwner } : {}),
  };

  return parsed.name || parsed.description || parsed.image || parsed.cardOwner ? parsed : null;
}

const amountE6ToDisplayNumber = (value: bigint): number => Number(value) / 1_000_000

function loadTrustedCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${BIZ_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: T };
    return parsed?.value ?? null;
  } catch {
    return null;
  }
}

function saveTrustedCache<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${BIZ_CACHE_PREFIX}${key}`,
      JSON.stringify({ value, updatedAt: Date.now() })
    );
  } catch {
    // Ignore storage failures.
  }
}

const fmtAddr = (a: string | undefined) => (a && a.length >= 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : (a || '—'));

/** 地址胶囊：短缩地址 + 右侧 copy 图标，点击复制到剪贴板，成功后显示绿色 check */
const AddressCapsule = ({ address, className = '' }: { address: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const short = fmtAddr(address);
  const handleCopy = useCallback(async () => {
    if (!address || address.length < 10) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [address]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full font-mono text-[11px] font-semibold border transition-colors ${className}`}
      title="Copy address"
    >
      <span className="truncate">{short}</span>
      {copied ? <Check size={12} className="shrink-0 text-emerald-500" /> : <Copy size={12} className="shrink-0 opacity-70 hover:opacity-100" />}
    </button>
  );
};

const AddressRow = ({ label, icon: Icon, address, fullAddress }: { label: string; icon: LucideIcon; address: string; fullAddress: string }) => {
  const [copied, setCopied] = useState(false);
  const hasAddress = !!fullAddress && fullAddress.length >= 10;
  const handleCopy = useCallback(async () => {
    if (!hasAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [fullAddress, hasAddress]);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tight flex items-center gap-1 shrink-0 leading-none whitespace-nowrap"><Icon size={11} className="shrink-0" /> {label}</span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden justify-end">
        <span className={`text-[11px] font-mono font-bold bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm truncate leading-none inline-flex items-center min-w-0 ${hasAddress ? 'text-[#1562f0]' : 'text-slate-400'}`}>{address}</span>
        {hasAddress && (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex items-center justify-center"
            title="Copy"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default function MerchantOS() {
 const { beamio, profiles, myAddress, setProfiles } = useDaemonContext();
 const navigate = useNavigate();
 const [activeTab, setActiveTab] = useState('Overview');
 const fixedCardAdminsCacheKey = `card-admins:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`;
 const linkedMerchantAdminsCacheKey = `linked-merchants:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`;
 const fixedCardMetadataCacheKey = `card-metadata:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`;
 const [fixedCardAdmins, setFixedCardAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(fixedCardAdminsCacheKey) ?? []);
 const [linkedMerchantAdmins, setLinkedMerchantAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) ?? []);
 const [fixedCardMetadata, setFixedCardMetadata] = useState<FixedUserCardMetadata | null>(() => loadTrustedCache<FixedUserCardMetadata>(fixedCardMetadataCacheKey));
 const [merchantOwnerProfile, setMerchantOwnerProfile] = useState<BeamioProfile>(null);
 const grossSalesCacheKey = `gross-sales:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:${(profiles?.[0]?.aaAccount ?? '').toLowerCase()}`
 const [grossSalesTotal, setGrossSalesTotal] = useState<number | null>(() => loadTrustedCache<number>(grossSalesCacheKey));
 const [linkedMerchantLookupDone, setLinkedMerchantLookupDone] = useState(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) !== null);
 const [adminRetryCount, setAdminRetryCount] = useState(0);
 const [redeemAdminInProgress, setRedeemAdminInProgress] = useState(false);

 // Store Wallets, Market, Messages, Partner Alliances
 const [joinedAlliances, setJoinedAlliances] = useState<AllianceId[]>([]);
 const [alliancesDb, setAlliancesDb] = useState(INITIAL_ALLIANCES_DB);
 const [isJoinAllianceModalOpen, setIsJoinAllianceModalOpen] = useState(false);
 const [applyingAlliance, setApplyingAlliance] = useState<AllianceId | null>(null);
 const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
 const [activeContact, setActiveContact] = useState('c1');
 const [chatInput, setChatInput] = useState('');

 const isAaUnlocked = !!(profiles?.[0]?.aaAccount?.trim());
 const eoaBalance = isAaUnlocked ? 5420.00 : 0.00;
 const aaUsdcBalance = isAaUnlocked ? 125.50 : 0.00;
 const aaBUnits = isAaUnlocked ? 13300 : 20;

 const handleApplyAlliance = useCallback((aId: AllianceId) => {
   setApplyingAlliance(aId);
   setTimeout(() => {
     setJoinedAlliances((prev) => [...prev, aId]);
     setApplyingAlliance(null);
     setIsJoinAllianceModalOpen(false);
     setActiveTab('Messages');
     setActiveContact('c1');
   }, 2500);
 }, []);

 const handleMarketPurchase = useCallback(() => {
   setSelectedProduct(null);
   setActiveTab('Wallets');
 }, []);

 const handleRemitToAlliance = useCallback((aId: AllianceId) => {
   setAlliancesDb((prev) => ({
     ...prev,
     [aId]: { ...prev[aId], topUps: 0 }
   }));
 }, []);

 const clearCardCacheAndRetry = useCallback(() => {
   try {
     const keys = [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, grossSalesCacheKey];
     keys.forEach((k) => window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${k}`));
     setFixedCardAdmins([]);
     setLinkedMerchantAdmins([]);
     setLinkedMerchantLookupDone(false);
     setAdminRetryCount((c) => c + 1);
   } catch {
     setAdminRetryCount((c) => c + 1);
   }
 }, [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, grossSalesCacheKey]);

 const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
 const [payoutStep, setPayoutStep] = useState(1);
  // New state for sidebar toggle
 const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);


 // 新增：终端管理状态（从 CoNET 合约获取）
 const [terminals, setTerminals] = useState<Array<{ id: string; tag: string; name: string; eoa: string; status: string; lastActive: string }>>([]);
 const [terminalsLoading, setTerminalsLoading] = useState(false);
 const [isAddTerminalOpen, setIsAddTerminalOpen] = useState(false);
 const [newTerminalTag, setNewTerminalTag] = useState('');
 const [linkTerminalLoading, setLinkTerminalLoading] = useState(false);
 const [linkTerminalError, setLinkTerminalError] = useState<string | null>(null);
 const [deleteTerminalToRemove, setDeleteTerminalToRemove] = useState<{ id: string; tag: string; name: string; eoa: string } | null>(null);
 const [removeTerminalLoading, setRemoveTerminalLoading] = useState(false);
 const [removeTerminalError, setRemoveTerminalError] = useState<string | null>(null);

 const merchant = profiles?.[0]?.keyID ?? myAddress;
 const adminCandidateAddresses = [
   profiles?.[0]?.aaAccount,
   profiles?.[0]?.keyID,
   myAddress,
 ].filter((address): address is string => !!address && ethers.isAddress(address))
   .map((address) => ethers.getAddress(address));
 const normalizedAdminCandidates = adminCandidateAddresses.map((address) => address.toLowerCase());
 const effectiveAdminAddress = fixedCardAdmins.find((address) => normalizedAdminCandidates.includes(address.toLowerCase())) ?? null;

 // On entry: if profiles[0] exists but aaAccount is empty, fetch from chain and update
 useEffect(() => {
   const p0 = profiles?.[0];
   if (!p0 || p0.aaAccount?.trim()) return;
   const eoa = (p0.keyID?.trim() || myAddress?.trim()) || '';
   if (!eoa || !ethers.isAddress(eoa)) return;
   let cancelled = false;
   const run = async () => {
     try {
       const profileForFetch = p0.keyID?.trim() ? p0 : { ...p0, keyID: myAddress };
       const chainAa = await getAAAccount(profileForFetch);
       if (cancelled || !chainAa) return;
       const nextProfiles = profiles.map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
       setProfiles(nextProfiles);
       const temp = CoNET_Data;
       if (temp?.profiles?.length) {
         temp.profiles = temp.profiles.map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
         setCoNET_Data(temp);
         await storeSystemData();
       }
     } catch {
       // Keep last trusted; RPC failure does not overwrite
     }
   };
   void run();
   return () => { cancelled = true; };
 }, [profiles, setProfiles, myAddress]);

 const fetchTerminals = useCallback(async () => {
   if (!merchant || !ethers.isAddress(merchant)) {
     setTerminals([]);
     return;
   }
   setTerminalsLoading(true);
   try {
     const posList = await getMerchantPOSListFromCoNET(merchant);
     setTerminals(posList.map((pos, idx) => ({
       id: pos,
       tag: fmtAddr(pos),
       name: `POS Terminal ${idx + 1}`,
       eoa: fmtAddr(pos),
       status: 'Active',
       lastActive: 'On-chain',
     })));
   } catch {
     setTerminals([]);
   } finally {
     setTerminalsLoading(false);
   }
 }, [merchant]);

 useEffect(() => {
   fetchTerminals();
 }, [fetchTerminals]);

 // URL 带 redeemAdmin 时：校验 code 有效、EOA 非 admin 后，向 endpoint 完成 redeem admin，成功后刷新 admin 列表
 useEffect(() => {
   const params = parseRedeemAdminFromUrl();
   if (!params) return;
   const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
   if (!userEOA || !ethers.isAddress(userEOA)) return;
   if (params.cardAddress.toLowerCase() !== FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()) return;

   let cancelled = false;
   const run = async () => {
     setRedeemAdminInProgress(true);
     try {
       const valid = await checkRedeemAdminCodeValid(params.cardAddress, params.redeemCode);
       if (cancelled || !valid) return;
       const alreadyAdmin = await isCardAdmin(params.cardAddress, userEOA);
       if (cancelled || alreadyAdmin) return;
       const res = await postCardRedeemAdmin(params.cardAddress, params.redeemCode, userEOA);
       if (cancelled) return;
       if (res.success) {
         clearCardCacheAndRetry();
         // Redeem admin may create AA account; fetch and persist
         const p0 = profiles?.[0];
         if (p0) {
           try {
             const chainAa = await getAAAccount(p0);
             if (!cancelled && chainAa) {
               const nextProfiles = profiles.map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
               setProfiles(nextProfiles);
               const temp = CoNET_Data;
               if (temp?.profiles?.length) {
                 temp.profiles = temp.profiles.map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
                 setCoNET_Data(temp);
                 await storeSystemData();
               }
             }
           } catch {
             // Keep last trusted; RPC failure does not overwrite
           }
         }
       } else if (res.error) {
         console.warn('[MerchantOS] redeemAdmin failed:', res.error);
       }
     } finally {
       if (!cancelled) setRedeemAdminInProgress(false);
     }
   };
   void run();
   return () => { cancelled = true; };
 }, [profiles, profiles?.[0]?.keyID, myAddress, setProfiles, clearCardCacheAndRetry]);

 useEffect(() => {
   let cancelled = false;
   const cachedAllAdmins = loadTrustedCache<string[]>(fixedCardAdminsCacheKey);
   const cachedAdmins = loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey);

   if (cachedAllAdmins !== null) {
     setFixedCardAdmins(cachedAllAdmins);
   }

   if (cachedAdmins !== null) {
     setLinkedMerchantAdmins(cachedAdmins);
     setLinkedMerchantLookupDone(true);
   }

   const loadLinkedMerchantAdmins = async () => {
    const card = new ethers.Contract(
      FIXED_USER_CARD_CONTRACT_ADDRESS,
      USER_CARD_ADMIN_READ_ABI,
      baseRpcProvider
    );

     try {
       const [owner, adminResult] = await Promise.all([
         card.owner() as Promise<string>,
         card.getAdminListWithMetadata() as Promise<[string[], string[], string[]]>,
       ]);
       const [admins] = adminResult;
       const nextLinkedMerchantAdmins = admins.filter((address) => address.toLowerCase() !== owner.toLowerCase());

       if (cancelled) return;

       setFixedCardAdmins(admins);
       setLinkedMerchantAdmins(nextLinkedMerchantAdmins);
       setLinkedMerchantLookupDone(true);
       saveTrustedCache(fixedCardAdminsCacheKey, admins);
       saveTrustedCache(linkedMerchantAdminsCacheKey, nextLinkedMerchantAdmins);
     } catch {
      try {
        const fallbackChecks = await Promise.all(
          adminCandidateAddresses.map(async (address) => ({
            address,
            isAdmin: await card.isAdmin(address) as boolean,
          }))
        );
        const fallbackAdmins = fallbackChecks
          .filter((entry) => entry.isAdmin)
          .map((entry) => entry.address);

        if (cancelled) return;

        if (fallbackAdmins.length > 0) {
          setFixedCardAdmins(fallbackAdmins);
          setLinkedMerchantAdmins(fallbackAdmins);
          setLinkedMerchantLookupDone(true);
          saveTrustedCache(fixedCardAdminsCacheKey, fallbackAdmins);
          saveTrustedCache(linkedMerchantAdminsCacheKey, fallbackAdmins);
          return;
        }
      } catch {
        // Fall through to trusted cache.
      }

      if (cancelled) return;
      if (cachedAllAdmins !== null) {
        setFixedCardAdmins(cachedAllAdmins);
      }
      if (cachedAdmins !== null) {
        setLinkedMerchantAdmins(cachedAdmins);
        setLinkedMerchantLookupDone(true);
       }
     }
   };

   void loadLinkedMerchantAdmins();

   return () => {
     cancelled = true;
   };
 }, [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, adminRetryCount]);

 useEffect(() => {
   let cancelled = false;
   const cachedMetadata = loadTrustedCache<FixedUserCardMetadata>(fixedCardMetadataCacheKey);

   if (cachedMetadata) {
     setFixedCardMetadata(cachedMetadata);
   }

   const loadFixedCardMetadata = async () => {
     const normalizedCardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase().replace(/^0x/, '');
     const metadataResource = `0x${normalizedCardAddress}${'0'.repeat(64)}.json`;

     try {
       const apiRes = await fetch(
         `${BEAMIO_APP_URL}/api/cardMetadata?cardAddress=${encodeURIComponent(FIXED_USER_CARD_CONTRACT_ADDRESS)}`
       );
       if (apiRes.ok) {
         const apiData = await apiRes.json() as { cardOwner?: string; metadata?: unknown };
         const parsed = parseFixedUserCardMetadata(apiData.metadata, typeof apiData.cardOwner === 'string' ? apiData.cardOwner : undefined);
         if (parsed && !cancelled) {
           setFixedCardMetadata(parsed);
           saveTrustedCache(fixedCardMetadataCacheKey, parsed);
           return;
         }
       }
     } catch {
       // Fall through to ERC-1155 metadata endpoint.
     }

     try {
       const metadataRes = await fetch(`${BEAMIO_APP_URL}/api/metadata/${metadataResource}`);
       if (!metadataRes.ok) return;
       const metadataJson = await metadataRes.json();
       const parsed = parseFixedUserCardMetadata(metadataJson);
       if (!parsed || cancelled) return;
       setFixedCardMetadata(parsed);
       saveTrustedCache(fixedCardMetadataCacheKey, parsed);
     } catch {
       if (!cancelled && cachedMetadata) {
         setFixedCardMetadata(cachedMetadata);
       }
     }
   };

   void loadFixedCardMetadata();

   return () => {
     cancelled = true;
   };
 }, [fixedCardMetadataCacheKey]);

 useEffect(() => {
   const owner = fixedCardMetadata?.cardOwner;
   if (!owner || !ethers.isAddress(owner)) {
     setMerchantOwnerProfile(null);
     return;
   }
   let cancelled = false;
   const load = async () => {
     try {
       const res = await searchUsername(owner);
       const peer = res?.results?.[0];
       if (cancelled) return;
       setMerchantOwnerProfile(peer ?? null);
     } catch {
       if (!cancelled) setMerchantOwnerProfile(null);
     }
   };
   void load();
   return () => { cancelled = true; };
 }, [fixedCardMetadata?.cardOwner]);

 useEffect(() => {
   let cancelled = false;
   const cachedGrossSales = loadTrustedCache<number>(grossSalesCacheKey);

   if (cachedGrossSales !== null) {
     setGrossSalesTotal(cachedGrossSales);
   }

   if (!effectiveAdminAddress || !ethers.isAddress(effectiveAdminAddress)) {
     return () => {
       cancelled = true;
     };
   }

   const loadGrossSales = async () => {
     try {
       const card = new ethers.Contract(
         FIXED_USER_CARD_CONTRACT_ADDRESS,
         USER_CARD_ADMIN_READ_ABI,
         baseRpcProvider
       );
       const stats = await card.getAdminStatsFull(effectiveAdminAddress, 0, 0, 0) as { cumulativeTransferAmount: bigint };
       const nextGrossSalesTotal = amountE6ToDisplayNumber(stats.cumulativeTransferAmount);

       if (cancelled) return;

       setGrossSalesTotal(nextGrossSalesTotal);
       saveTrustedCache(grossSalesCacheKey, nextGrossSalesTotal);
     } catch {
       if (!cancelled && cachedGrossSales !== null) {
         setGrossSalesTotal(cachedGrossSales);
       }
     }
   };

   void loadGrossSales();

   return () => {
     cancelled = true;
   };
 }, [effectiveAdminAddress, grossSalesCacheKey]);

 const hasLinkedMerchant = linkedMerchantAdmins.length > 0;
 const hideTransactionsPanel = linkedMerchantLookupDone && !hasLinkedMerchant;
 const isFixedUserCardAdmin = fixedCardAdmins.some((address) => normalizedAdminCandidates.includes(address.toLowerCase()));
 const showFixedCardMetadata = activeTab === 'Overview' && isFixedUserCardAdmin;
 const showOverviewSummary = isFixedUserCardAdmin;

 useEffect(() => {
   if (hideTransactionsPanel && activeTab === 'Transactions') {
     setActiveTab('Overview');
   }
 }, [activeTab, hideTransactionsPanel]);


 // --- Financial Mock Data Logic ---
 const salesCTree = 1200.00;
 const salesUSDC = 645.50;
 const totalSales = grossSalesTotal ?? 0;


 const tipsCTree = 200.00;
 const tipsUSDC = 142.00;
 const totalTips = tipsCTree + tipsUSDC;


 const topUpsIssued = 850.00;


 const totalCTreeReceived = salesCTree + tipsCTree;
 const netSettlementBalance = totalCTreeReceived - topUpsIssued;
 const totalUSDCBalance = salesUSDC + tipsUSDC;


 const today = new Date();
 const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


 const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  collapsed: boolean;
}) => (
   <button
     onClick={onClick}
     className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-2xl transition-all ${
       isActive
         ? 'bg-[#1562f0] text-white shadow-md'
         : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
     }`}
     title={collapsed ? label : undefined}
   >
     <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
     {!collapsed && <span className="font-semibold text-[15px] whitespace-nowrap">{label}</span>}
   </button>
 );


 const renderPayoutDrawer = () => {
   if (!isPayoutModalOpen) return null;


   const allianceFee = netSettlementBalance * 0.03;
   const finalBankAmount = netSettlementBalance - allianceFee;


   return (
     <div className="fixed inset-0 z-50 flex justify-end">
       <div
         className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
         onClick={() => isPayoutModalOpen && payoutStep !== 2 && setIsPayoutModalOpen(false)}
       />
      
       <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
         <div className="px-8 pt-8 pb-6 border-b border-slate-100 flex justify-between items-center bg-white">
           <h2 className="text-2xl font-bold tracking-tight text-black">CAD Settlement</h2>
           <button
             onClick={() => setIsPayoutModalOpen(false)}
             disabled={payoutStep === 2}
             className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-black transition-colors disabled:opacity-50"
           >
             <X size={20} />
           </button>
         </div>


         <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
           {payoutStep === 1 && (
             <div className="space-y-6 animate-in fade-in">
               <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
                 <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-2">Net Settlement Due</p>
                 <p className="text-5xl font-light text-black tracking-tighter mb-1">${netSettlementBalance.toFixed(2)}</p>
                 <p className="text-[14px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block mt-2">
                   CashTrees owes you CAD
                 </p>
               </div>


               <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
                 <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                   <Activity size={18} className="text-[#1562f0]" />
                   <span className="font-semibold text-[15px] text-black">Net Calculation ($CTree)</span>
                 </div>
                
                 <div className="p-6 space-y-4">
                   <div className="flex justify-between items-center">
                     <span className="text-[14px] text-slate-500 font-medium">$CTree Received (Sales & Tips)</span>
                     <span className="text-[15px] font-semibold text-black">+${totalCTreeReceived.toFixed(2)}</span>
                   </div>
                  
                   <div className="flex justify-between items-center">
                     <span className="text-[14px] text-slate-500 font-medium">$CTree Issued (In-Store Top-Ups)</span>
                     <span className="text-[15px] font-semibold text-rose-500">-${topUpsIssued.toFixed(2)}</span>
                   </div>
                  
                   <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-slate-400">
                     <span className="text-[14px] font-medium flex items-center gap-1.5">
                       Alliance Fee <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-500">3.0%</span>
                     </span>
                     <span className="text-[15px] font-semibold">-${allianceFee.toFixed(2)}</span>
                   </div>


                   <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                     <span className="text-[15px] font-bold text-black">Final Transfer to Bank</span>
                     <span className="text-[20px] font-bold text-[#1562f0]">${finalBankAmount.toFixed(2)}</span>
                   </div>
                 </div>
               </div>


               <div className="bg-blue-50 rounded-[20px] p-5 flex items-start gap-3 border border-blue-100">
                 <Landmark size={20} className="text-blue-600 mt-0.5" />
                 <div>
                   <p className="text-[14px] font-semibold text-blue-900">Fiat Bank Transfer</p>
                   <p className="text-[13px] text-blue-700/80 font-medium mt-1 leading-snug">
                     CashTrees will deposit CAD via EFT to your connected RBC account ending in *8821.
                   </p>
                 </div>
               </div>
             </div>
           )}


           {payoutStep === 2 && (
             <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
               <div className="w-20 h-20 border-4 border-slate-100 border-t-[#1562f0] rounded-full animate-spin mb-6"></div>
               <h3 className="text-xl font-bold text-black mb-2">Initiating Settlement...</h3>
               <p className="text-[15px] text-slate-500 font-medium text-center">
                 Burning Net $CTree and<br/>notifying CashTrees Treasury.
               </p>
             </div>
           )}


           {payoutStep === 3 && (
             <div className="h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
               <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                 <CheckCircle2 size={48} className="text-emerald-600" strokeWidth={2.5} />
               </div>
               <h3 className="text-2xl font-bold text-black mb-2 tracking-tight">Settlement Requested</h3>
               <p className="text-[15px] text-slate-500 font-medium text-center mb-8">
                 ${finalBankAmount.toFixed(2)} CAD transfer has been queued by CashTrees.
               </p>
               <div className="bg-white border border-slate-200 rounded-[16px] p-4 w-full flex justify-between items-center shadow-sm">
                  <span className="text-[13px] text-slate-500 font-medium">Clearance Hash</span>
                  <span className="text-[13px] font-mono text-[#1562f0] font-semibold">0x8f2a...9c4b</span>
               </div>
             </div>
           )}
         </div>


         <div className="p-6 bg-white border-t border-slate-100">
           {payoutStep === 1 ? (
             <button
               onClick={() => {
                 setPayoutStep(2);
                 setTimeout(() => setPayoutStep(3), 2500);
               }}
               className="w-full bg-black text-white py-4 rounded-[16px] font-semibold text-[17px] active:scale-[0.98] transition-all shadow-md flex justify-center items-center gap-2"
             >
               Confirm & Request CAD
             </button>
           ) : payoutStep === 3 ? (
             <button
               onClick={() => {
                 setIsPayoutModalOpen(false);
                 setTimeout(() => { setPayoutStep(1); }, 300);
               }}
               className="w-full bg-black text-white py-4 rounded-[16px] font-semibold text-[17px] active:scale-[0.98] transition-all shadow-md"
             >
               Done
             </button>
           ) : null}
         </div>
       </div>
     </div>
   );
 };


 const renderDashboard = () => (
   <div className="flex h-screen bg-[#f5f5f7] font-sans text-slate-900 overflow-hidden selection:bg-[#1562f0]/20">
    
     {/* --- Sidebar --- */}
     <aside
       className={`bg-white border-r border-slate-200 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-24' : 'w-72'}`}
     >
       <div className={`p-6 pb-6 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
         <div
           className="flex items-center gap-4 mb-6 cursor-pointer group"
           onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
           title="Toggle Sidebar"
         >
           <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md border border-slate-100 shrink-0 group-hover:shadow-lg transition-all bg-white flex items-center justify-center">
              {beamio ? (
                <img
                  src={beamio.image ? beamio.image : getImg(beamio.accountName)}
                  alt={beamio.accountName || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500 text-lg">?</div>
              )}
           </div>
           {!isSidebarCollapsed && (
             <div className="whitespace-nowrap overflow-hidden">
               <h1 className="font-bold text-[18px] tracking-tight leading-tight">
                 {displayName(beamio) || 'User'}
               </h1>
               <p className="text-[12px] font-semibold text-[#86868b] mt-0.5">
                 @{beamio?.accountName ?? 'Beamio'}
               </p>
             </div>
           )}
         </div>
        
         {!isSidebarCollapsed && (
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 overflow-hidden whitespace-nowrap">
              <AddressRow
                label="Smart AA"
                icon={Cpu}
                address={(() => { const a = profiles?.[0]?.aaAccount?.trim(); return a && ethers.isAddress(a) ? fmtAddr(ethers.getAddress(a)) : 'Locked'; })()}
                fullAddress={(() => { const a = profiles?.[0]?.aaAccount?.trim(); return a && ethers.isAddress(a) ? ethers.getAddress(a) : ''; })()}
              />
              <div className="h-[1px] w-full bg-slate-200/50"></div>
              <AddressRow
                label="Owner EOA"
                icon={KeyRound}
                address={fmtAddr(profiles?.[0]?.keyID ?? myAddress)}
                fullAddress={profiles?.[0]?.keyID ?? myAddress ?? ''}
              />
           </div>
         )}
       </div>


       <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
         {!isSidebarCollapsed && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-2 whitespace-nowrap">Store Management</p>}
         <NavItem icon={LayoutDashboard} label="Daily Dashboard" isActive={activeTab === 'Overview'} onClick={() => setActiveTab('Overview')} collapsed={isSidebarCollapsed} />
         {!hideTransactionsPanel && (
           <NavItem icon={Receipt} label="Transactions" isActive={activeTab === 'Transactions'} onClick={() => setActiveTab('Transactions')} collapsed={isSidebarCollapsed} />
         )}
         <NavItem icon={Wallet} label="Store Wallets" isActive={activeTab === 'Wallets'} onClick={() => setActiveTab('Wallets')} collapsed={isSidebarCollapsed} />
         <NavItem icon={Store} label="Market" isActive={activeTab === 'Market'} onClick={() => setActiveTab('Market')} collapsed={isSidebarCollapsed} />
         <NavItem icon={MessageSquare} label="Messages" isActive={activeTab === 'Messages'} onClick={() => setActiveTab('Messages')} collapsed={isSidebarCollapsed} />
         <NavItem icon={Hexagon} label="Partner Alliances" isActive={activeTab === 'Alliances'} onClick={() => setActiveTab('Alliances')} collapsed={isSidebarCollapsed} />
        
         <div className={isSidebarCollapsed ? 'mt-6' : 'mt-8'}></div>
         {!isSidebarCollapsed && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 whitespace-nowrap">Configuration</p>}
         <NavItem icon={Users} label="Staff Terminals" isActive={activeTab === 'Staff'} onClick={() => setActiveTab('Staff')} collapsed={isSidebarCollapsed} />
         <NavItem icon={Settings} label="Store Settings" isActive={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} collapsed={isSidebarCollapsed} />
       </nav>


       <div className="p-6">
         <button
           onClick={() => { window.location.href = '/' }}
           className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-2 px-4'} py-3 rounded-2xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors font-semibold text-[15px]`}
           title="Lock Wallet"
         >
           <LogOut size={18} className="shrink-0" />
           {!isSidebarCollapsed && <span className="whitespace-nowrap">Lock Wallet</span>}
         </button>
       </div>
     </aside>


     {/* --- Main Content Area --- */}
     <main className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 ease-in-out">
       <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-10 sticky top-0 z-10 shrink-0">
         <h2 className="text-2xl font-bold text-black tracking-tight">{activeTab}</h2>
         <div className="flex items-center gap-6">
           <span className="text-[13px] font-semibold text-slate-500">{dateString}</span>
           {activeTab !== 'Settings' && (
             <>
               <div className="h-6 w-[1px] bg-slate-200"></div>
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200">
                    <span className="text-[13px] font-bold text-emerald-700">UT</span>
                 </div>
               </div>
             </>
           )}
         </div>
       </header>


       <div className="flex-1 min-h-0 relative overflow-y-auto p-10">
        {activeTab === 'Overview' && (
          <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
            {SHOW_LINKED_MERCHANT_CARD_PANEL && showFixedCardMetadata && (
              <div className="flex justify-end">
                <div className="w-full max-w-xl h-[280px] relative rounded-[32px] overflow-hidden border border-slate-800 shadow-[0_0_30px_rgba(21,98,240,0.15)] bg-gradient-to-br from-slate-950 via-slate-900 to-[#0a0a0c]">
                  {fixedCardMetadata?.image ? (
                    <img
                      src={fixedCardMetadata.image}
                      alt={fixedCardMetadata?.name || 'Merchant card'}
                      className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-screen"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/45 to-[#0a0a0c]" />
                  <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-[#1562f0]/25 blur-[70px]" />
                  <div className="absolute -left-10 bottom-8 w-40 h-40 rounded-full bg-emerald-500/10 blur-[90px]" />

                  <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 border border-white/15 backdrop-blur-sm shrink-0 flex items-center justify-center">
                          {fixedCardMetadata?.image ? (
                            <img
                              src={fixedCardMetadata.image}
                              alt={fixedCardMetadata?.name || 'Merchant card'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 size={22} className="text-white/70" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="inline-flex bg-[#1562f0]/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-[0.18em]">
                            Linked Merchant Card
                          </span>
                          <div className="mt-2">
                            <AddressCapsule address={FIXED_USER_CARD_CONTRACT_ADDRESS} className="bg-white/10 border-white/15 text-white/80 hover:bg-white/15" />
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/8 backdrop-blur-md rounded-2xl border border-white/10 px-3 py-2 text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Status</p>
                        <p className="text-[13px] font-semibold text-emerald-300 mt-1">Franchise Merchant</p>
                      </div>
                    </div>

                    <div className="max-w-md">
                      <p className="text-white text-[32px] font-extrabold tracking-tight leading-tight">
                        {fixedCardMetadata?.name || 'Merchant Card'}
                      </p>
                      <p className="text-white/65 text-[13px] mt-3 leading-relaxed line-clamp-3">
                        {fixedCardMetadata?.description || 'Metadata loaded from the linked Beamio merchant card.'}
                      </p>
                    </div>

                    <BeamioCapsule item={merchantOwnerProfile} fallbackAddress={fixedCardMetadata?.cardOwner} className="bg-white/8 border border-white/10" />
                  </div>
                </div>
              </div>
            )}
          {!showOverviewSummary ? (
            <div>
              <div className="bg-[#1562f0] rounded-[32px] p-8 sm:p-12 shadow-lg shadow-[#1562f0]/20 relative overflow-hidden min-h-[280px] flex flex-col justify-center">
                {redeemAdminInProgress && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/20 text-white px-3 py-1.5 rounded-full text-[13px] font-medium">
                    <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Redeeming admin access...
                  </div>
                )}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="relative z-10 max-w-2xl">
                  <h3 className="text-[22px] sm:text-[28px] font-bold text-white tracking-tight mb-3">Welcome to Beamio Web3 POS!</h3>
                  <p className="text-[15px] text-white/90 leading-relaxed mb-6">
                    Your EOA Vault is ready. You can currently send/receive direct USDC payments. <strong className="font-semibold">Your Smart Terminal (AA) is locked.</strong> To unlock zero-gas routing, VIP memberships, and voucher economies, purchase a Fuel Pack or join an Alliance.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/settings')}
                      className="bg-white text-[#1562f0] px-6 py-3 rounded-[14px] font-semibold text-[14px] hover:bg-slate-50 transition-colors shadow-sm border border-[#1562f0]/20"
                    >
                      Buy Fuel Pack
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/vouchers-example')}
                      className="bg-[#1562f0] border border-white/30 text-white px-6 py-3 rounded-[14px] font-semibold text-[14px] hover:bg-white/10 transition-colors shadow-sm"
                    >
                      Join Alliance
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : hideTransactionsPanel ? (
            <div>
              <div className="bg-white rounded-[32px] p-12 shadow-sm border border-slate-100 min-h-[320px] flex items-center justify-center text-center">
                <div className="max-w-lg">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-500">
                    <Building2 size={30} />
                  </div>
                  <p className="text-[28px] font-semibold text-black tracking-tight">Not associated with any linked merchant</p>
                </div>
              </div>
            </div>
          ) : (
           <div className="space-y-8">
             {/* Row 1: Operations Metrics - 4 panels */}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
               {/* Panel 1: Total Gross Sales */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} className="text-slate-700" />
                     </div>
                     <span className="bg-sky-100 text-sky-600 px-2.5 py-1 rounded-full text-[12px] font-medium">Today</span>
                   </div>
                   <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Gross Sales</p>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${totalSales.toFixed(2)}</p>
                 </div>
                 <div className="mt-6 pt-6 border-t border-slate-100">
                   <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                       <span className="text-[12px] font-bold text-blue-600">$</span>
                     </div>
                     <div>
                       <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-widest">USDC</span>
                       <span className="text-[16px] font-black text-slate-800">${salesUSDC.toFixed(2)}</span>
                     </div>
                   </div>
                 </div>
               </div>

               {/* Panel 2: Tips Collected */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                        <Heart size={24} className="text-rose-500 fill-rose-100" />
                     </div>
                   </div>
                   <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tips Collected</p>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${totalTips.toFixed(2)}</p>
                 </div>
                 <div className="mt-6 pt-6 border-t border-slate-100">
                   <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 flex items-center gap-2">
                     <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                       <span className="text-[12px] font-bold text-blue-600">$</span>
                     </div>
                     <div>
                       <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-widest">USDC</span>
                       <span className="text-[16px] font-black text-slate-800">${tipsUSDC.toFixed(2)}</span>
                     </div>
                   </div>
                 </div>
               </div>

               {/* Panel 3: In-Store Top-Ups */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                        <ArrowUpFromLine size={24} className="text-emerald-600" />
                     </div>
                   </div>
                   <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">In-Store Top-Ups</p>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${topUpsIssued.toFixed(2)}</p>
                 </div>
                 <div className="mt-6 pt-6 border-t border-slate-100">
                   <p className="text-[12px] text-slate-400 text-center">No active issuing networks.</p>
                 </div>
               </div>

               {/* Panel 4: Protocol Fuel Reserve */}
               <div className="bg-gradient-to-br from-zinc-900 to-black rounded-[32px] p-8 shadow-xl border border-white/10 flex flex-col justify-between text-white">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                        <Fuel size={24} className="text-amber-500" />
                     </div>
                     <span className="bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-full text-[12px] font-medium flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> LOCKED
                     </span>
                   </div>
                   <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Protocol Fuel Reserve</p>
                   <p className="text-[40px] font-bold text-white tracking-tighter leading-none">{20}</p>
                 </div>
                 <div className="mt-6 pt-6 border-t border-white/10">
                   <p className="text-[13px] text-slate-400 mb-2">Today&apos;s Consumption</p>
                   <p className="text-[16px] font-semibold text-amber-500">0 Units</p>
                 </div>
                 <button
                   type="button"
                   onClick={() => { setActiveTab('Market'); setSelectedProduct('fuel'); }}
                   className="mt-6 w-full bg-amber-500 text-black py-4 rounded-[16px] font-bold text-[15px] hover:bg-amber-400 transition-colors"
                 >
                   Top Up Fuel
                 </button>
               </div>
             </div>
           </div>
          )}
          </div>
        )}


        {activeTab === 'Transactions' && !hideTransactionsPanel && (
           <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-2">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Search receipt ID, hash..." className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl w-80 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all shadow-sm" />
                </div>
                <button className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-3 rounded-2xl text-[14px] font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
                  <Filter size={16} /> Filter by Date
                </button>
              </div>


              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                   <thead>
                     <tr className="bg-slate-50/80 text-left border-b border-slate-100">
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Transaction Info</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Source / Customer</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Routing Breakdown</th>
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Net Value</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     
                      {MOCK_TRANSACTIONS.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                          
                           {/* Column 1: Tx Info */}
                           <td className="px-8 py-6">
                             <div className="flex items-center gap-3 mb-1">
                               {tx.type === 'Charge' ? (
                                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0"><ArrowDownToLine size={14}/></div>
                               ) : (
                                 <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><ArrowUpFromLine size={14}/></div>
                               )}
                               <div className="font-bold text-[15px] text-black whitespace-nowrap">{tx.type}</div>
                             </div>
                             <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 mt-2 pl-11 whitespace-nowrap">
                               <span>{dateString}, {tx.time}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               <span>{tx.id}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               {/* 更新：展示终端来源 */}
                               <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded" title="Processed by terminal">
                                 <MonitorSmartphone size={10}/> {tx.terminal}
                               </span>
                             </div>
                           </td>


                           {/* Column 2: Source & Customer Engagement */}
                           <td className="px-6 py-6">
                             <div className="flex flex-col gap-2">
                               <div className="flex items-center gap-2">
                                 {tx.source === 'APP' ? (
                                   <Smartphone size={16} className="text-[#1562f0] shrink-0"/>
                                 ) : (
                                   <Nfc size={16} className="text-slate-400 shrink-0"/>
                                 )}
                                 <span className={`text-[13px] font-bold whitespace-nowrap ${tx.source === 'APP' ? 'text-[#1562f0]' : 'text-slate-600'}`}>
                                   {tx.source === 'APP' ? 'Beamio App' : 'NFC Card'}
                                 </span>
                               </div>
                               {tx.beamioTag ? (
                                 <div className="flex items-center gap-3">
                                   <span className="text-[12px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-600 whitespace-nowrap">
                                     {tx.beamioTag}
                                   </span>
                                   {/* Action buttons appear on hover for App users */}
                                   <div className="hidden lg:group-hover:flex items-center gap-1">
                                     <button className="p-1.5 bg-[#1562f0]/10 text-[#1562f0] rounded-md hover:bg-[#1562f0] hover:text-white transition-colors tooltip-trigger" title="Send Message">
                                       <MessageSquare size={14} />
                                     </button>
                                     <button className="p-1.5 bg-[#1562f0]/10 text-[#1562f0] rounded-md hover:bg-[#1562f0] hover:text-white transition-colors tooltip-trigger" title="Send Smart Receipt">
                                       <Send size={14} />
                                     </button>
                                   </div>
                                 </div>
                               ) : (
                                 <span className="text-[12px] font-medium text-slate-400 italic whitespace-nowrap">Anonymous Customer</span>
                               )}
                             </div>
                           </td>


                           {/* Column 3: Exact Routing Breakdown */}
                           <td className="px-6 py-6">
                             <div className="space-y-1.5">
                               {tx.method === 'Mixed' ? (
                                 <>
                                   <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                                     <Ticket size={14} className="text-slate-400 shrink-0" /> $CTree: ${tx.ctreeAmount.toFixed(2)} <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-400">No Discount</span>
                                   </div>
                                   <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                                     <Coins size={14} className="text-blue-500 shrink-0" /> USDC: ${tx.usdcAmount.toFixed(2)}
                                   </div>
                                 </>
                               ) : tx.method === 'Issued $CTree' ? (
                                 <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-700 whitespace-nowrap">
                                     <ArrowUpFromLine size={14} className="text-emerald-500 shrink-0" /> Issued $CTree: ${tx.ctreeAmount.toFixed(2)}
                                 </div>
                               ) : tx.method.includes('No Discount') ? (
                                 <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                                     <Coins size={14} className="text-blue-500 shrink-0" /> USDC (No Discount): ${tx.usdcAmount.toFixed(2)}
                                 </div>
                               ) : tx.method.includes('Black Tier') ? (
                                 <div className="flex items-center gap-2 text-[13px] font-bold text-[#34C759] whitespace-nowrap">
                                     <Crown size={14} className="text-yellow-500 shrink-0" /> $CTree (Black Tier): ${tx.ctreeAmount.toFixed(2)}
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2 text-[13px] font-bold text-[#34C759] whitespace-nowrap">
                                     <Ticket size={14} className="text-[#34C759] shrink-0" /> $CTree (Green Tier): ${tx.ctreeAmount.toFixed(2)}
                                 </div>
                               )}
                             </div>
                           </td>


                           {/* Column 4: Totals & Tips */}
                           <td className="px-8 py-6 text-right">
                             <div className={`font-bold text-[18px] whitespace-nowrap ${tx.type.includes('Top-Up') ? 'text-emerald-600' : 'text-black'}`}>
                               {tx.type.includes('Top-Up') ? '+' : ''}${tx.total.toFixed(2)}
                             </div>
                             {tx.tip > 0 ? (
                               <div className="text-[11px] font-bold text-slate-500 mt-1 whitespace-nowrap">Incl. <span className="text-rose-500">${tx.tip.toFixed(2)}</span> Tip</div>
                             ) : (
                               <div className="text-[11px] font-bold text-slate-400 mt-1 whitespace-nowrap">No Tip</div>
                             )}
                             {/* Small hash row */}
                             <div className="flex justify-end items-center gap-1.5 mt-2">
                               <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                               <span className="text-[10px] font-mono text-slate-300 hover:text-[#1562f0] cursor-pointer transition-colors whitespace-nowrap">{tx.hash}</span>
                             </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
           </div>
         )}

         {/* --- STORE WALLETS TAB --- */}
         {activeTab === 'Wallets' && (
           <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Store Wallets</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Manage your Tethered Hybrid Architecture: The Vault (EOA) & Smart Terminal (AA).</p>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                <div className="bg-slate-900 rounded-[32px] p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden flex flex-col justify-between border border-slate-800/50 xl:col-span-1">
                   <div className="absolute top-0 right-0 w-80 h-80 bg-[#1562f0]/20 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
                   <div className="relative z-10">
                     <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-[20px] flex items-center justify-center border border-white/10">
                              <Shield size={28} className="text-[#1562f0]" />
                           </div>
                           <div>
                              <h4 className="text-[20px] font-semibold text-white tracking-tight flex items-center gap-2">The Vault <span className="text-[11px] bg-[#1562f0]/20 text-[#1562f0] px-2 py-0.5 rounded-md border border-[#1562f0]/30 font-bold">EOA</span></h4>
                              <p className="text-[13px] text-slate-400 font-mono mt-1">{fmtAddr(profiles?.[0]?.keyID ?? myAddress)}</p>
                           </div>
                        </div>
                     </div>
                     <div className="mb-4">
                        <p className="text-[13px] font-medium text-slate-400 mb-2">Cold Storage (Base L2)</p>
                        <div className="flex items-baseline gap-2">
                           <p className="text-[48px] sm:text-[56px] font-light tracking-tight leading-none">{eoaBalance.toFixed(2)}</p>
                           <span className="text-xl text-slate-500 font-light">USDC</span>
                        </div>
                     </div>
                   </div>
                   <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
                      <button className="bg-[#1562f0] text-white py-3 rounded-[16px] text-[14px] font-semibold transition-all hover:bg-blue-600 shadow-[0_8px_20px_rgba(21,98,240,0.3)] active:scale-[0.98] flex flex-col items-center justify-center gap-1">
                         <div className="flex items-center gap-1.5"><Send size={16} /> P2P Send</div>
                         <span className="text-[10px] bg-blue-900/30 px-1.5 rounded">2 B-Units</span>
                      </button>
                      <button className="bg-white/10 backdrop-blur-md text-white py-3 rounded-[16px] text-[14px] font-semibold transition-all hover:bg-white/20 border border-white/5 active:scale-[0.98] flex flex-col items-center justify-center gap-1">
                         <div className="flex items-center gap-1.5"><QrCode size={16} /> Receive</div>
                         <span className="text-[10px] bg-white/10 px-1.5 rounded">0.8% Fee (Min 2)</span>
                      </button>
                      <button className="bg-white/10 backdrop-blur-md text-white py-3 rounded-[16px] text-[14px] font-semibold transition-all hover:bg-white/20 border border-white/5 active:scale-[0.98] flex flex-col items-center justify-center gap-1">
                         <div className="flex items-center gap-1.5"><Landmark size={16} /> Coinbase</div>
                         <span className="text-[10px] bg-white/10 px-1.5 rounded">On/Off Ramp</span>
                      </button>
                   </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between relative overflow-hidden xl:col-span-2">
                   {!isAaUnlocked && (
                     <div className="absolute inset-0 backdrop-blur-xl bg-[#f5f5f7]/80 z-20 flex flex-col items-center justify-center text-center p-8 rounded-[32px]">
                       <div className="w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
                         <Lock size={32} className="text-slate-400" />
                       </div>
                       <h3 className="text-[24px] font-bold text-slate-900 mb-3 tracking-tight">Smart Terminal Locked</h3>
                       <p className="text-[15px] font-medium text-slate-500 max-w-md mb-8 leading-relaxed">
                         Your AA wallet is currently inactive. Unlock zero-gas ecosystem routing by purchasing a Fuel Pack or joining an Alliance.
                       </p>
                       <div className="flex gap-4">
                         <button onClick={() => setActiveTab('Market')} className="bg-orange-500 text-white px-6 py-3.5 rounded-[16px] font-semibold text-[15px] hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20 active:scale-95 flex items-center gap-2">
                           <Fuel size={18} /> Buy Fuel
                         </button>
                         <button onClick={() => setActiveTab('Alliances')} className="bg-[#1562f0] text-white px-6 py-3.5 rounded-[16px] font-semibold text-[15px] hover:bg-blue-600 transition-colors shadow-lg shadow-[#1562f0]/20 active:scale-95 flex items-center gap-2">
                           <Hexagon size={18} /> Join Alliance
                         </button>
                       </div>
                     </div>
                   )}

                   <div className={`relative z-10 ${!isAaUnlocked ? 'opacity-30 blur-sm pointer-events-none select-none' : ''}`}>
                     <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center border border-slate-100/80">
                              <Zap size={28} className="text-[#1562f0]" />
                           </div>
                           <div>
                              <h4 className="text-[20px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">Smart Terminal <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">ERC-4337</span></h4>
                              <p className="text-[13px] text-slate-400 font-mono mt-1">{fmtAddr(profiles?.[0]?.aaAccount)}</p>
                           </div>
                        </div>
                     </div>

                     <div className="flex flex-nowrap gap-4 sm:gap-5 mb-8 overflow-x-auto scrollbar-hide pb-2">
                        <div className="bg-slate-50/80 rounded-[24px] p-5 sm:p-6 border border-slate-100/50 shrink-0 w-[160px] sm:w-[180px]">
                           <p className="text-[13px] font-medium text-slate-500 mb-2">Liquid Reserve</p>
                           <div className="flex items-baseline gap-1">
                              <p className="text-3xl sm:text-[32px] font-semibold text-slate-900 tracking-tight">{aaUsdcBalance.toFixed(2)}</p>
                              <span className="text-[14px] text-slate-500 font-medium">USDC</span>
                           </div>
                        </div>
                        {joinedAlliances.map((aId) => {
                          const alliance = alliancesDb[aId];
                          return (
                            <div key={aId} className={`${alliance.themeLightBg} rounded-[24px] p-5 sm:p-6 border border-white/50 shrink-0 w-[160px] sm:w-[180px]`}>
                               <p className={`text-[13px] font-medium ${alliance.themeText} mb-2`}>{alliance.id} Vouchers</p>
                               <div className="flex items-baseline gap-1">
                                  <p className="text-3xl sm:text-[32px] font-semibold text-slate-900 tracking-tight">{alliance.aaBalance.toFixed(2)}</p>
                                  <span className={`text-[14px] ${alliance.themeText} font-medium`}>{alliance.token}</span>
                               </div>
                            </div>
                          );
                        })}
                     </div>

                     <div className="bg-slate-900 rounded-[24px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800 shadow-inner">
                        <div className="flex items-center gap-4 text-white">
                           <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                              <Fuel size={20} className="text-orange-500" />
                           </div>
                           <div>
                              <p className="text-[12px] font-medium text-slate-400 mb-0.5">Protocol Fuel</p>
                              <p className="text-[18px] font-mono font-semibold text-white tracking-tight">{aaBUnits.toLocaleString()} B-Units</p>
                           </div>
                        </div>
                        <button onClick={() => { setActiveTab('Market'); setSelectedProduct('fuel'); }} className="w-full sm:w-auto text-[14px] font-semibold bg-orange-500 text-white px-5 py-2.5 rounded-[12px] hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                           Refill
                        </button>
                     </div>
                   </div>

                   <div className={`relative z-10 mt-8 ${!isAaUnlocked ? 'opacity-30 blur-sm pointer-events-none select-none' : ''}`}>
                     <div className="relative flex items-center py-4">
                        <div className="flex-grow border-t border-slate-100"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-300">
                           <ArrowRightLeft size={18} className="text-slate-300" />
                        </span>
                        <div className="flex-grow border-t border-slate-100"></div>
                     </div>
                     <button className="w-full bg-slate-50 text-slate-700 py-4 sm:py-5 rounded-[20px] text-[16px] font-semibold transition-all border border-slate-200 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-2 active:scale-[0.98]">
                        Transfer Funds
                     </button>
                   </div>
                </div>
             </div>

             {joinedAlliances.length > 0 && (
               <div className="pt-8 mt-8 border-t border-slate-200/60">
                 <h4 className="text-[18px] font-semibold text-slate-900 mb-6">Alliance Fiat Settlements</h4>
                 <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                   <div className="overflow-x-auto scrollbar-hide">
                     <table className="w-full min-w-[900px]">
                       <thead className="bg-slate-50/80 border-b border-slate-100/80">
                         <tr>
                           <th className="px-8 py-5 text-[12px] font-semibold text-slate-500 text-left">Alliance Network</th>
                           <th className="px-6 py-5 text-[12px] font-semibold text-slate-500 text-right">Gross Received</th>
                           <th className="px-6 py-5 text-[12px] font-semibold text-slate-500 text-right">Liability & Quota</th>
                           <th className="px-6 py-5 text-[12px] font-semibold text-slate-500 text-right">Net Settleable (CAD)</th>
                           <th className="px-8 py-5 text-[12px] font-semibold text-slate-500 text-center">Action</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100/80">
                         {joinedAlliances.map((aId) => {
                           const alliance = alliancesDb[aId];
                           const totalReceived = alliance.sales + alliance.tips;
                           const netBalance = totalReceived - alliance.topUps;
                           const isQuotaExceeded = alliance.mintQuota != null && alliance.topUps >= alliance.mintQuota;
                           return (
                             <tr key={`settle-${aId}`} className="hover:bg-slate-50/50 transition-colors">
                               <td className="px-8 py-5">
                                 <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center ${alliance.themeLightBg} ${alliance.themeText} border border-white/50 shadow-sm`}>
                                     <Ticket size={20} />
                                   </div>
                                   <div>
                                     <div className="font-semibold text-slate-900 text-[15px]">{alliance.name}</div>
                                     <div className="text-[13px] text-slate-500 font-medium mt-0.5">{alliance.token}</div>
                                   </div>
                                 </div>
                               </td>
                               <td className="px-6 py-5 text-right font-medium text-slate-600 text-[15px]">+${totalReceived.toFixed(2)}</td>
                               <td className="px-6 py-5 text-right font-medium text-[15px]">
                                 {alliance.canTopUp ? (
                                   <div className="flex flex-col items-end gap-1.5">
                                     <span className={`${isQuotaExceeded ? 'text-rose-600' : 'text-slate-800'} font-bold`}>-${alliance.topUps.toFixed(2)}</span>
                                     {alliance.mintQuota != null && (
                                       <div className="w-28 bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                          <div className={`h-full rounded-full transition-all duration-500 ${isQuotaExceeded ? 'bg-rose-500' : alliance.topUps >= alliance.mintQuota * 0.8 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (alliance.topUps / alliance.mintQuota) * 100)}%` }}></div>
                                       </div>
                                     )}
                                     {isQuotaExceeded && (
                                       <span className="flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                         <AlertTriangle size={10} /> Quota Exceeded
                                       </span>
                                     )}
                                   </div>
                                 ) : (
                                   <span className="inline-block text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md tracking-wide uppercase">Consumption Only</span>
                                 )}
                               </td>
                               <td className="px-6 py-5 text-right">
                                 <div className={`font-bold text-[18px] leading-none ${netBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                                   {netBalance >= 0 ? `$${netBalance.toFixed(2)}` : `-$${Math.abs(netBalance).toFixed(2)}`}
                                 </div>
                                 <div className="text-[11px] text-slate-400 font-medium mt-1">{netBalance >= 0 ? 'Due to You' : 'Due to Alliance'}</div>
                               </td>
                               <td className="px-8 py-5 text-center">
                                 {netBalance >= 0 ? (
                                   <button className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all ${alliance.themeLightBg} ${alliance.themeText} hover:brightness-95 active:scale-[0.98] w-full flex items-center justify-center gap-2`}>
                                     <Landmark size={16} /> Request Payout
                                   </button>
                                 ) : (
                                   <button onClick={() => handleRemitToAlliance(aId)} className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all ${isQuotaExceeded ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-[0_4px_15px_rgba(244,63,94,0.3)]' : 'bg-slate-800 text-white hover:bg-slate-700'} active:scale-[0.98] w-full flex items-center justify-center gap-2`}>
                                     {isQuotaExceeded ? <Lock size={16} /> : <ArrowRightLeft size={16} />}
                                     {isQuotaExceeded ? 'Remit to Unlock' : 'Remit Fiat'}
                                   </button>
                                 )}
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}

         {/* --- MARKET TAB --- */}
         {activeTab === 'Market' && (
           <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Market</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Acquire physical infrastructure and protocol fuel for your node.</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5">
                    <div>
                      <div className="flex justify-between items-center mb-10">
                        <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Package A</span>
                        <span className="text-[13px] font-mono font-medium text-slate-400">842 / 1000</span>
                      </div>
                      <div className="flex justify-center mb-10 relative">
                        <div className="w-28 h-28 bg-[#1a1c23] border border-orange-500/30 rounded-[28px] flex flex-col items-center justify-center gap-2 shadow-[0_0_40px_rgba(249,115,22,0.15)] relative z-10">
                          <Database size={36} className="text-orange-500" strokeWidth={1.5} />
                          <div className="text-center">
                            <div className="text-[18px] font-bold text-orange-500 leading-none">100k</div>
                            <div className="text-[9px] font-bold text-orange-500/70 tracking-widest uppercase mt-1">B-Units</div>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[28px] font-semibold text-white tracking-tight leading-tight">Limited Fuel Pack</h4>
                      <p className="text-[14px] font-medium text-orange-500/80 mt-2 uppercase tracking-widest">The Store Clearing Fuel</p>
                    </div>
                    <div className="mt-10 flex items-center justify-between bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pricing</p>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white">$499</p>
                          <span className="text-[13px] font-medium text-slate-500">USDC</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedProduct('fuel')} className="bg-orange-500 text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20 active:scale-95">
                        View
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-[#1562f0]/15 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5">
                    <div>
                      <div className="flex justify-between items-center mb-10">
                        <span className="bg-[#1562f0]/10 text-[#1562f0] border border-[#1562f0]/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Package B</span>
                        <span className="text-[13px] font-mono font-medium text-slate-400">247 / 300</span>
                      </div>
                      <div className="flex justify-center mb-10 relative">
                        <div className="w-28 h-28 bg-[#1a1c23] border border-[#1562f0]/30 rounded-[28px] flex items-center justify-center shadow-[0_0_40px_rgba(21,98,240,0.15)] relative z-10">
                          <Activity size={40} className="text-[#1562f0]" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h4 className="text-[28px] font-semibold text-white tracking-tight leading-tight">Genesis Node Pack</h4>
                      <p className="text-[14px] font-medium text-[#1562f0]/80 mt-2 uppercase tracking-widest">The Infrastructure Backbone</p>
                    </div>
                    <div className="mt-10 flex items-center justify-between bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pricing</p>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white">$999</p>
                          <span className="text-[13px] font-medium text-slate-500">USDC</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedProduct('node')} className="bg-[#1562f0] text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-blue-500 transition-colors shadow-lg shadow-[#1562f0]/20 active:scale-95">
                        View
                      </button>
                    </div>
                  </div>
                </div>
             </div>
           </div>
         )}

         {/* --- PARTNER ALLIANCES TAB --- */}
         {activeTab === 'Alliances' && (
           <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Partner Alliances</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Manage your Ecosystem NFTs (ERC-1155) that grant routing logic and settlement privileges.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {joinedAlliances.map((aId) => {
                  const alliance = alliancesDb[aId];
                  return (
                    <div key={aId} className={`${alliance.nftBg} rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.25)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border ${alliance.nftBorder}`}>
                      <div className="h-full p-8 relative z-10 flex flex-col">
                        <div className="flex justify-between items-start mb-8 relative">
                          <div className="w-16 h-16 rounded-[20px] border border-white/30 bg-white/10 flex items-center justify-center backdrop-blur-md relative z-20">
                            <CreditCard size={28} className="text-white" strokeWidth={1.5} />
                          </div>
                          <span className="bg-[#c8f7d9] text-[#127a3a] px-4 py-1.5 rounded-[8px] text-[13px] font-bold tracking-wide shadow-sm z-20">Active</span>
                        </div>
                        <div className="mt-8 mb-8">
                          <p className="text-[11px] font-bold text-white/80 uppercase tracking-widest mb-2">Merchant License NFT</p>
                          <h4 className="text-[28px] font-extrabold text-white tracking-tight leading-tight whitespace-pre-line">
                            {alliance.nftName.replace(' Partner', '\nPartner').replace(' Franchise', '\nFranchise')}
                          </h4>
                        </div>
                        <div className="flex-1 space-y-6 mb-4">
                          <div>
                            <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-4">Granted Privileges</p>
                            <ul className="space-y-4">
                              {alliance.privileges.map((priv: { title: string; desc: string }, i: number) => (
                                <li key={i} className="flex items-start gap-3">
                                  <CheckCircle2 size={18} className="text-white shrink-0 mt-0.5 opacity-90" />
                                  <div>
                                    <span className="text-[14px] font-semibold text-white block leading-none mb-1">
                                      {priv.title.includes('Full Access:') ? (
                                        <><span className="text-[#5eead4]">Full Access:</span> {priv.title.split('Full Access:')[1]}</>
                                      ) : priv.title.includes('Consumption Only:') ? (
                                        <><span className="text-orange-400">Consumption Only:</span> {priv.title.split('Consumption Only:')[1]}</>
                                      ) : (
                                        priv.title
                                      )}
                                    </span>
                                    <span className="text-[12px] font-medium text-white/70">{priv.desc}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-auto pt-5 border-t border-white/20 flex items-center justify-between">
                          <span className="text-[12px] font-medium text-white/70">Contract: <span className="font-mono text-white">0x...</span></span>
                          <button className="text-[13px] font-semibold text-white hover:text-white/80 transition-colors flex items-center gap-1">
                            View on Base <ExternalLink size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {Object.keys(alliancesDb).length > joinedAlliances.length && (
                  <div
                    onClick={() => setIsJoinAllianceModalOpen(true)}
                    className="bg-white/50 backdrop-blur-xl rounded-[32px] p-8 border border-slate-200 border-dashed flex flex-col items-center justify-center text-center min-h-[380px] hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Plus size={24} className="text-[#1562f0]" />
                    </div>
                    <h4 className="text-[18px] font-semibold text-slate-900 mb-2">Join New Alliance</h4>
                    <p className="text-[14px] font-medium text-slate-500 max-w-[220px] leading-relaxed">
                      Discover and apply for Partner NFTs via KYB to unlock new business networks.
                    </p>
                  </div>
                )}
             </div>
           </div>
         )}

         {/* --- MESSAGES TAB --- */}
         {activeTab === 'Messages' && (
           <div className="max-w-[1400px] mx-auto h-[calc(100vh-160px)] sm:h-[calc(100vh-200px)] flex flex-col sm:flex-row gap-6 animate-in fade-in duration-300">
             <div className="w-full sm:w-[340px] flex flex-col bg-white/80 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shrink-0 overflow-hidden">
               <div className="p-6 border-b border-slate-100/80 bg-white/50">
                 <h3 className="text-[20px] font-bold text-slate-900 tracking-tight mb-4">Messages</h3>
                 <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input type="text" placeholder="Search CoNET tags..." className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/60 rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[13px] text-slate-900" />
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto scrollbar-hide">
                 {MOCK_CONTACTS.map((contact) => (
                   <div
                     key={contact.id}
                     onClick={() => setActiveContact(contact.id)}
                     className={`p-4 border-b border-slate-50 cursor-pointer transition-colors flex items-center gap-4 ${activeContact === contact.id ? 'bg-[#1562f0]/5 border-l-4 border-l-[#1562f0]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                   >
                     <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center text-white font-bold tracking-wider shrink-0 shadow-sm ${contact.avatarBg}`}>
                       {contact.avatarText}
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-center mb-1">
                         <h4 className="text-[15px] font-semibold text-slate-900 truncate">{contact.name}</h4>
                         <span className="text-[11px] font-medium text-slate-400 shrink-0">{contact.time}</span>
                       </div>
                       <p className={`text-[13px] truncate ${contact.unread > 0 ? 'text-slate-900 font-semibold' : 'text-slate-500 font-medium'}`}>
                         {contact.lastMessage}
                       </p>
                     </div>
                     {contact.unread > 0 && (
                       <div className="w-5 h-5 rounded-full bg-[#1562f0] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                         {contact.unread}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             </div>

             <div className="flex-1 flex flex-col bg-white/80 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
               <div className="h-20 px-6 sm:px-8 border-b border-slate-100/80 bg-white/50 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-[16px] bg-[#4854e8] flex items-center justify-center text-white font-bold tracking-wider shadow-sm">CT</div>
                   <div>
                     <h4 className="text-[16px] font-bold text-slate-900 tracking-tight">CashTrees Network</h4>
                     <p className="text-[12px] font-medium text-slate-500">@cashtrees_support • Alliance Operator</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100/50">
                     <Lock size={12} className="text-emerald-600" />
                     <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-widest">E2E Encrypted</span>
                   </div>
                   <button className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors">
                     <MoreVertical size={20} />
                   </button>
                 </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#f8f9fb] space-y-6">
                 <div className="flex justify-center mb-8">
                   <div className="bg-slate-200/50 px-3 py-1 rounded-full text-[11px] font-semibold text-slate-500 uppercase tracking-widest">CoNET L1 Secure Routing</div>
                 </div>
                 {MOCK_MESSAGES.map((msg) => (
                   <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                     <div className={`max-w-[80%] sm:max-w-[70%] p-4 rounded-[20px] ${msg.sender === 'me' ? 'bg-[#1562f0] text-white rounded-tr-[4px] shadow-[0_4px_15px_rgba(21,98,240,0.2)]' : 'bg-white text-slate-800 rounded-tl-[4px] shadow-sm border border-slate-100'}`}>
                       <p className="text-[14.5px] font-medium leading-relaxed">{msg.text}</p>
                     </div>
                     <span className="text-[11px] font-medium text-slate-400 mt-2 px-1">{msg.time} {msg.sender === 'me' && '• Read'}</span>
                   </div>
                 ))}
                 {applyingAlliance && activeContact === 'c1' && (
                   <div className="flex flex-col items-start">
                     <div className="bg-white p-4 rounded-[20px] rounded-tl-[4px] shadow-sm border border-slate-100 flex items-center gap-1.5">
                       <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                       <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                       <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                     </div>
                   </div>
                 )}
               </div>

               <div className="p-4 sm:p-6 bg-white border-t border-slate-100/80 shrink-0">
                 <div className="flex items-center gap-3">
                   <button className="p-3 text-slate-400 hover:text-[#1562f0] hover:bg-blue-50 rounded-full transition-colors shrink-0">
                     <Paperclip size={20} />
                   </button>
                   <div className="flex-1 relative">
                     <input
                       type="text"
                       placeholder="Type an encrypted message..."
                       value={chatInput}
                       onChange={(e) => setChatInput(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && chatInput.trim()) setChatInput(''); }}
                       className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200/60 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[15px] text-slate-900"
                     />
                     <button onClick={() => setChatInput('')} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all ${chatInput.trim() ? 'bg-[#1562f0] text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>
                       <Send size={18} className={chatInput.trim() ? 'translate-x-0.5' : ''} />
                     </button>
                   </div>
                 </div>
                 <div className="text-center mt-3">
                   <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">0 Gas Fee • Powered by CoNET L1</span>
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* --- STAFF TERMINALS TAB --- */}
         {activeTab === 'Staff' && (
           <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-black tracking-tight">Staff Terminals</h3>
                  <p className="text-[13px] font-medium text-slate-500 mt-1">Manage linked POS devices and their EOA authorizations.</p>
                </div>
                <button
                  onClick={() => setIsAddTerminalOpen(true)}
                  className="flex items-center gap-2 bg-[#1562f0] text-white px-6 py-3.5 rounded-2xl text-[14px] font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <Plus size={18} strokeWidth={2.5} /> Link New Terminal
                </button>
              </div>


              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                   <thead>
                     <tr className="bg-slate-50/80 text-left border-b border-slate-100">
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Terminal Identity</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Linked EOA Address</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {terminalsLoading ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-16 text-center text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                              Loading from CoNET...
                            </span>
                          </td>
                        </tr>
                      ) : terminals.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-16 text-center text-slate-500">
                            No terminals linked yet. Click &quot;Link New Terminal&quot; to add one.
                          </td>
                        </tr>
                      ) : (
                      terminals.map((term) => (
                        <tr key={term.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="px-8 py-6">
                             <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                                 <MonitorSmartphone size={20} />
                               </div>
                               <div>
                                 <div className="font-bold text-[15px] text-black">{term.tag}</div>
                                 <div className="text-[12px] font-medium text-slate-500 mt-0.5">{term.name}</div>
                               </div>
                             </div>
                           </td>
                           <td className="px-6 py-6">
                             <div className="flex items-center gap-2">
                               <KeyRound size={14} className="text-slate-400" />
                               <span className="font-mono text-[13px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                 {term.eoa}
                               </span>
                             </div>
                           </td>
                           <td className="px-6 py-6 text-center">
                             <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide">
                               <CheckCircle2 size={12} /> {term.status}
                             </span>
                             <div className="text-[11px] font-medium text-slate-400 mt-2">Last active: {term.lastActive}</div>
                           </td>
                           <td className="px-8 py-6 text-right">
                             <button
                               onClick={() => setDeleteTerminalToRemove(term)}
                               className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-colors"
                               title="Revoke Authorization"
                             >
                               <Trash2 size={18} />
                             </button>
                           </td>
                        </tr>
                      )))}
                   </tbody>
                </table>
              </div>
           </div>
         )}


         {activeTab === 'Settings' && (
           <div className="absolute inset-0 z-10 overflow-hidden animate-in fade-in duration-300">
             <BeamioMeMainScreen embedInPanel />
           </div>
         )}

       </div>
     </main>


     {renderPayoutDrawer()}


     {/* --- ADD TERMINAL MODAL --- */}
     {isAddTerminalOpen && (
       <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsAddTerminalOpen(false)}></div>
         <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 text-[#1562f0] rounded-2xl flex items-center justify-center">
                     <LinkIcon size={24} />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-black">Link New Terminal</h2>
               </div>
               <button onClick={() => setIsAddTerminalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-black transition-colors">
                 <X size={20} />
               </button>
            </div>


            <div className="space-y-5 mb-8">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <p className="text-[13px] font-medium text-slate-600 leading-snug">
                  Install the POS App on the new device. Retrieve its generated BeamioTag and public EOA address to authorize it for this store.
                </p>
              </div>


              <div className="space-y-1.5">
                 <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Terminal Beamio Tag / EOA Address</label>
                 <input
                   type="text"
                   value={newTerminalTag}
                   onChange={(e) => { setNewTerminalTag(e.target.value); setLinkTerminalError(null); }}
                   placeholder="e.g. @ut_reg3 or 0x..."
                   className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-semibold text-[15px] text-slate-900 font-mono"
                 />
              </div>

              {linkTerminalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-medium text-rose-700">
                  {linkTerminalError}
                </div>
              )}

            </div>


            <button
              onClick={async () => {
                const raw = ((newTerminalTag ?? '') as string).trim();
                if (!raw) return;
                setLinkTerminalError(null);
                setLinkTerminalLoading(true);
                try {
                  const merchant = profiles?.[0]?.keyID ?? myAddress;
                  if (!merchant || !ethers.isAddress(merchant)) {
                    throw new Error('Merchant EOA not found. Please unlock your wallet first.');
                  }
                  const privateKey = profiles?.[0]?.privateKeyArmor;
                  if (!privateKey) {
                    throw new Error('Private key not available. Please unlock your wallet.');
                  }
                  const pkHex = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
                  let pos: string;
                  if (ethers.isAddress(raw)) {
                    pos = ethers.getAddress(raw);
                  } else {
                    const tagRaw = raw as string;
                    const tag = tagRaw.startsWith('@') ? tagRaw.slice(1) : tagRaw;
                    const res = await searchUsername(tag);
                    const peer = res?.results?.[0];
                    if (!peer?.address || !ethers.isAddress(peer.address)) {
                      throw new Error(`Could not resolve @${tag} to an address. Check the Beamio Tag.`);
                    }
                    pos = ethers.getAddress(peer.address);
                  }
                  const deadline = Math.floor(Date.now() / 1000) + 60 * 15;
                  const nonce = generateRegisterPOSNonce();
                  const signature = await signRegisterPOS(pkHex, merchant, pos, deadline, nonce);
                  const result = await registerPOSApi({ merchant, pos, deadline, nonce, signature });
                  if (!result.success) {
                    throw new Error(result.error ?? 'Register failed');
                  }
                  setIsAddTerminalOpen(false);
                  setNewTerminalTag('');
                  await fetchTerminals();
                } catch (e: unknown) {
                  setLinkTerminalError((e as Error)?.message ?? 'Failed to link terminal');
                } finally {
                  setLinkTerminalLoading(false);
                }
              }}
              disabled={linkTerminalLoading || !newTerminalTag?.trim()}
              className="w-full bg-black text-white py-4 rounded-[16px] font-semibold text-[16px] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {linkTerminalLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authorizing...
                </>
              ) : (
                'Authorize & Link'
              )}
            </button>
         </div>
       </div>
     )}

     {/* --- DELETE TERMINAL CONFIRMATION MODAL --- */}
     {deleteTerminalToRemove && (
       <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !removeTerminalLoading && (setDeleteTerminalToRemove(null), setRemoveTerminalError(null))} />
         <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                 <Trash2 size={24} />
               </div>
               <h2 className="text-xl font-bold tracking-tight text-black">Revoke Terminal</h2>
             </div>
             <button onClick={() => !removeTerminalLoading && (setDeleteTerminalToRemove(null), setRemoveTerminalError(null))} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-black transition-colors disabled:opacity-50">
               <X size={20} />
             </button>
           </div>
           <p className="text-[15px] text-slate-600 mb-4">
             Are you sure you want to revoke authorization for <span className="font-mono font-semibold text-slate-800">{deleteTerminalToRemove.eoa}</span>? This will remove the terminal from your store.
           </p>
           {removeTerminalError && (
             <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-medium text-rose-700">
               {removeTerminalError}
             </div>
           )}
           <div className="flex gap-3">
             <button
               onClick={() => !removeTerminalLoading && (setDeleteTerminalToRemove(null), setRemoveTerminalError(null))}
               disabled={removeTerminalLoading}
               className="flex-1 py-3.5 rounded-2xl text-[15px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
             >
               Cancel
             </button>
             <button
               onClick={async () => {
                 if (!deleteTerminalToRemove || !merchant) return;
                 setRemoveTerminalError(null);
                 setRemoveTerminalLoading(true);
                 try {
                   const privateKey = profiles?.[0]?.privateKeyArmor;
                   if (!privateKey) throw new Error('Private key not available. Please unlock your wallet.');
                   const pkHex = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
                   const pos = deleteTerminalToRemove.id;
                   const deadline = Math.floor(Date.now() / 1000) + 60 * 15;
                   const nonce = generateRegisterPOSNonce();
                   const signature = await signRemovePOS(pkHex, merchant, pos, deadline, nonce);
                   const result = await removePOSApi({ merchant, pos, deadline, nonce, signature });
                   if (!result.success) throw new Error(result.error ?? 'Remove failed');
                   setDeleteTerminalToRemove(null);
                   await fetchTerminals();
                 } catch (e: unknown) {
                   setRemoveTerminalError((e as Error)?.message ?? 'Failed to revoke terminal');
                 } finally {
                   setRemoveTerminalLoading(false);
                 }
               }}
               disabled={removeTerminalLoading}
               className="flex-1 py-3.5 rounded-2xl text-[15px] font-semibold bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
             >
               {removeTerminalLoading ? (
                 <>
                   <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   Revoking...
                 </>
               ) : (
                 'Revoke'
               )}
             </button>
           </div>
         </div>
       </div>
     )}

     {/* --- JOIN NEW ALLIANCE MODAL --- */}
     {isJoinAllianceModalOpen && (
       <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsJoinAllianceModalOpen(false)}></div>
         <div className="relative bg-white/90 backdrop-blur-3xl rounded-t-[32px] sm:rounded-[40px] shadow-2xl w-full max-w-md p-6 sm:p-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
            <div className="flex justify-between items-center mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#1562f0]/10 text-[#1562f0] rounded-[20px] flex items-center justify-center">
                     <Hexagon size={24} />
                  </div>
                  <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">Ecosystem Alliances</h2>
                    <p className="text-[13px] text-slate-500 font-medium">Apply via chat to unlock routing.</p>
                  </div>
               </div>
               <button onClick={() => setIsJoinAllianceModalOpen(false)} className="p-2.5 bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
                 <X size={20} />
               </button>
            </div>
            <div className="space-y-4 mb-8">
              {(Object.keys(alliancesDb) as AllianceId[])
                .filter((id) => !joinedAlliances.includes(id))
                .map((aId) => {
                  const alliance = alliancesDb[aId];
                  return (
                    <div key={aId} className="border border-slate-200 rounded-[20px] p-5 hover:border-[#1562f0]/50 hover:bg-[#1562f0]/5 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-slate-900 text-[16px]">{alliance.name}</h4>
                          <p className="text-[12px] font-medium text-slate-500 mt-0.5">Token: {alliance.token}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center text-white ${alliance.nftBg}`}>
                          <Award size={18} />
                        </div>
                      </div>
                      <button
                        onClick={() => handleApplyAlliance(aId)}
                        disabled={applyingAlliance === aId}
                        className={`w-full py-3 rounded-[12px] font-semibold text-[14px] transition-all flex items-center justify-center gap-2 ${applyingAlliance === aId ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-black text-white hover:bg-slate-800 active:scale-[0.98]'}`}
                      >
                        {applyingAlliance === aId ? (
                          <><div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin"></div> Awaiting KYB Approval...</>
                        ) : (
                          <><MessageSquare size={16} /> Apply via Beamio Chat</>
                        )}
                      </button>
                      <p className="text-[11px] text-slate-400 text-center font-medium mt-2">Requires business verification (KYB) by the operator.</p>
                    </div>
                  );
                })}
            </div>
         </div>
       </div>
     )}

     {/* --- PRODUCT MARKET DETAIL MODAL --- */}
     {selectedProduct && (
       <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 sm:py-12 font-sans">
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedProduct(null)}></div>
         <div className="relative bg-[#0f1115] w-full max-w-[500px] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[40px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-white/10">
            <div className={`relative h-48 sm:h-56 shrink-0 bg-gradient-to-b ${selectedProduct === 'fuel' ? 'from-orange-900/40' : 'from-blue-900/40'} to-[#0f1115]`}>
              <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white border border-white/10 transition-colors z-10"><X size={22} /></button>
              <div className="absolute bottom-6 left-8 right-8">
                 <span className={`inline-block px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase mb-3 border ${selectedProduct === 'fuel' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                    {selectedProduct === 'fuel' ? 'Merchant Prepaid' : 'Hardware + License'}
                 </span>
                 <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-1">
                    {selectedProduct === 'fuel' ? 'Limited Fuel Pack' : 'Genesis Node Pack'}
                 </h2>
                 <p className="text-[15px] font-medium text-slate-400">
                    {selectedProduct === 'fuel' ? 'The Store Clearing Fuel' : 'The Infrastructure Backbone'}
                 </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 pt-4 pb-32 scrollbar-hide space-y-8">
              <div className="flex gap-4">
                <div className="flex-1 bg-white/5 rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                    {selectedProduct === 'fuel' ? <Database size={20} /> : <Cpu size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{selectedProduct === 'fuel' ? 'Volume' : 'Security'}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">{selectedProduct === 'fuel' ? '100k B-Units' : 'ATECC608 Vault'}</p>
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                    {selectedProduct === 'fuel' ? <Sparkles size={20} /> : <Activity size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{selectedProduct === 'fuel' ? 'Discount' : 'Yield'}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">{selectedProduct === 'fuel' ? '50% Tech Off' : '5% Network'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#16181d] rounded-[24px] p-6 border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <Lock size={16} className="text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{selectedProduct === 'fuel' ? 'The Merchant Arsenal' : 'The Tangible Edge'}</span>
                </div>
                <div className="space-y-6">
                  {selectedProduct === 'fuel' ? (
                    <div className="flex gap-4">
                      <Database size={20} className="text-orange-500 shrink-0 mt-0.5" />
                      <div><h4 className="text-[15px] font-bold text-white mb-1">100,000 B-Units Pre-load</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">System value of $1,000 USDC. Instant clearing fuel to process your daily retail volume.</p></div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <Box size={20} className="text-[#1562f0] shrink-0 mt-0.5" />
                      <div><h4 className="text-[15px] font-bold text-white mb-1">Desktop API Gateway</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">Screenless black-box design with internal 300g weights for physical stability.</p></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 bg-gradient-to-t from-[#0f1115] via-[#0f1115] to-transparent pt-12 flex items-center justify-between border-t border-white/5">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                <div className="flex items-baseline gap-1.5"><p className="text-[32px] font-bold text-white leading-none">{selectedProduct === 'fuel' ? '499' : '999'}</p><span className="text-[14px] font-medium text-slate-500">USDC</span></div>
              </div>
              <button onClick={handleMarketPurchase} className={`flex items-center gap-2 px-8 py-4 rounded-[16px] font-semibold text-[16px] text-white transition-all shadow-lg active:scale-95 ${selectedProduct === 'fuel' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20' : 'bg-[#1562f0] hover:bg-blue-500 shadow-[#1562f0]/20'}`}>
                {selectedProduct === 'fuel' ? 'Secure Fuel' : 'Secure Node'} <ChevronRight size={18} />
              </button>
            </div>
         </div>
       </div>
     )}
   </div>
 );


 return renderDashboard();
}

