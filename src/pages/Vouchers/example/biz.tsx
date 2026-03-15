import React, { useState, useCallback, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ethers } from 'ethers';
import { useDaemonContext } from '@/providers/DaemonProvider';
import BeamioMeMainScreen from '@/components/Setting';
import { searchUsername } from '@/services/beamio';
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
 ShieldCheck,
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
 Check
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

/** 指定商户卡地址 - 必须使用此卡 */
const FIXED_USER_CARD_CONTRACT_ADDRESS = '0x48952F9EA1231b59e5c5FA1a99BC657B122CFDfD'
const BASE_RPC_URL = 'https://1rpc.io/base'
const BEAMIO_APP_URL = 'https://beamio.app'
const baseRpcProvider = new ethers.JsonRpcProvider(BASE_RPC_URL)
const BIZ_CACHE_PREFIX = 'beamio:biz-example:'
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
 const { beamio, profiles, myAddress } = useDaemonContext();
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
                address={fmtAddr(profiles?.[0]?.aaAccount)}
                fullAddress={profiles?.[0]?.aaAccount ?? ''}
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
         <NavItem icon={Wallet} label="Payouts & Bank" isActive={activeTab === 'Payouts'} onClick={() => setActiveTab('Payouts')} collapsed={isSidebarCollapsed} />
        
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
            {showFixedCardMetadata && (
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
              <div className="bg-white rounded-[32px] p-12 shadow-sm border border-slate-100 min-h-[320px] flex items-center justify-center text-center">
                <div className="max-w-lg">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-500">
                    <ShieldCheck size={30} />
                  </div>
                  <p className="text-[28px] font-semibold text-black tracking-tight">Admin access required to view merchant summary</p>
                  {linkedMerchantLookupDone && fixedCardAdmins.length > 0 && (
                    <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left">
                      <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-2">Card admins (connect with one)</p>
                      {fixedCardAdmins.map((a) => (
                        <p key={a} className="text-[13px] font-mono text-slate-700 mb-1">{a}</p>
                      ))}
                      <p className="text-[11px] text-slate-400 mt-3">Your addresses: AA {fmtAddr(profiles?.[0]?.aaAccount)} · KeyID {fmtAddr(profiles?.[0]?.keyID)} · EOA {fmtAddr(myAddress)}</p>
                      <button
                        type="button"
                        onClick={clearCardCacheAndRetry}
                        className="mt-3 text-[12px] font-semibold text-slate-500 hover:text-slate-700"
                      >
                        Clear cache & retry
                      </button>
                    </div>
                  )}
                  {linkedMerchantLookupDone && fixedCardAdmins.length === 0 && (
                    <div className="mt-4">
                      <p className="text-[14px] text-slate-500 mb-2">Could not fetch admin list.</p>
                      <button
                        type="button"
                        onClick={clearCardCacheAndRetry}
                        className="text-[13px] font-semibold text-[#1562f0] hover:underline"
                      >
                        Clear cache & retry
                      </button>
                    </div>
                  )}
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
             {/* Row 1: Operations Metrics */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
               {/* Metric 1: Gross Sales */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} className="text-slate-700" />
                     </div>
                    <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[12px] font-bold">Cumulative</span>
                   </div>
                   <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Gross Sales</p>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${totalSales.toFixed(2)}</p>
                 </div>
                
                 {/* The Split Breakdown */}
                 <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
                    <div className="bg-emerald-50/50 px-4 py-3 rounded-2xl border border-emerald-100 flex-1">
                       <span className="text-[10px] text-emerald-600 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Ticket size={12}/> $CTree</span>
                       <span className="text-[16px] font-black text-slate-800">${salesCTree.toFixed(2)}</span>
                    </div>
                    <div className="bg-blue-50/50 px-4 py-3 rounded-2xl border border-blue-100 flex-1">
                       <span className="text-[10px] text-blue-500 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Coins size={12}/> USDC</span>
                       <span className="text-[16px] font-black text-slate-800">${salesUSDC.toFixed(2)}</span>
                    </div>
                 </div>
               </div>


               {/* Metric 2: Tips Collected */}
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


                 <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
                    <div className="bg-emerald-50/50 px-4 py-3 rounded-2xl border border-emerald-100 flex-1">
                       <span className="text-[10px] text-emerald-600 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Ticket size={12}/> $CTree</span>
                       <span className="text-[16px] font-black text-slate-800">${tipsCTree.toFixed(2)}</span>
                    </div>
                    <div className="bg-blue-50/50 px-4 py-3 rounded-2xl border border-blue-100 flex-1">
                       <span className="text-[10px] text-blue-500 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Coins size={12}/> USDC</span>
                       <span className="text-[16px] font-black text-slate-800">${tipsUSDC.toFixed(2)}</span>
                    </div>
                 </div>
               </div>


               {/* Metric 3: Top-Ups Sold */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 relative overflow-hidden group flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                        <ArrowUpFromLine size={24} className="text-white" />
                     </div>
                   </div>
                   <div className="flex items-center gap-2 mb-1">
                     <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">In-Store Top-Ups Sold</p>
                     <div className="group/tooltip relative">
                       <Info size={14} className="text-slate-300 cursor-help" />
                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-20">
                         Top-ups processed at POS where you received CAD cash/card. App self-reloads are excluded.
                       </div>
                     </div>
                   </div>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${topUpsIssued.toFixed(2)}</p>
                 </div>
                
                 <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                       <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-widest">Voucher Liability Issued</span>
                       <span className="text-[16px] font-black text-slate-800">{topUpsIssued.toFixed(2)} $CTree</span>
                    </div>
                 </div>
               </div>
             </div>


             {/* Row 2: Wallets & Settlement Pools */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
               {/* CashTrees Settlement Pool */}
               <div className="bg-gradient-to-br from-zinc-900 to-black rounded-[32px] p-8 shadow-xl relative overflow-hidden text-white flex flex-col justify-between border border-white/10">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                 <div className="relative z-10 mb-8">
                   <div className="flex items-center justify-between mb-4">
                     <p className="text-[13px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                       <Ticket size={16}/> CashTrees Settlement
                     </p>
                     <span className="bg-white/10 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/10">Net Balance</span>
                   </div>
                   <div className="flex items-baseline gap-2 mb-4">
                     <p className="text-[56px] font-light tracking-tighter leading-none">${netSettlementBalance.toFixed(2)}</p>
                     <span className="text-xl text-slate-400">CAD</span>
                   </div>


                   <div className="flex items-center gap-3 text-[13px] font-medium text-slate-400">
                      <span className="text-white">+${totalCTreeReceived.toFixed(2)} Recv</span>
                      <span>-</span>
                      <span className="text-rose-400">-${topUpsIssued.toFixed(2)} Issued</span>
                   </div>
                 </div>


                 <button
                   onClick={() => setIsPayoutModalOpen(true)}
                   className="relative z-10 w-full bg-white text-black py-4 rounded-[16px] font-bold text-[15px] hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 shadow-lg"
                 >
                   <Landmark size={18} /> Request CAD Settlement
                 </button>
               </div>


               {/* Direct USDC Wallet */}
               <div className="bg-gradient-to-br from-blue-900 to-[#0f172a] rounded-[32px] p-8 shadow-xl relative overflow-hidden text-white flex flex-col justify-between border border-blue-800/30">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                 <div className="relative z-10 mb-8">
                   <div className="flex items-center justify-between mb-4">
                     <p className="text-[13px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                       <Coins size={16}/> Direct Crypto Revenue
                     </p>
                     <span className="bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-blue-500/30">Self-Custody</span>
                   </div>
                   <div className="flex items-baseline gap-2 mb-4">
                     <p className="text-[56px] font-light tracking-tighter leading-none">${totalUSDCBalance.toFixed(2)}</p>
                     <span className="text-xl text-blue-300">USDC</span>
                   </div>


                   <p className="text-[13px] font-medium text-blue-200/60 leading-relaxed max-w-sm">
                     Direct payments routed to your AA wallet. CashTrees does not settle this balance.
                   </p>
                 </div>


                 <button
                   className="relative z-10 w-full bg-[#1562f0] text-white py-4 rounded-[16px] font-bold text-[15px] hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50"
                 >
                   Off-ramp via Coinbase <ExternalLink size={16} />
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


         {/* --- STAFF TERMINALS TAB (NEW) --- */}
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

         {activeTab === 'Payouts' && (
           <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-in fade-in">
             <Settings size={48} className="mb-4 opacity-20" />
             <p className="text-[15px] font-medium">This module is active in production build.</p>
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
   </div>
 );


 return renderDashboard();
}

