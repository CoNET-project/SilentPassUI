import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { CoNET_Data, setCoNET_Data } from '@/utils/globals';
import { storeSystemData, getBalance, formatWithThousands } from '@/services/beamio';
import BeamioMeMainScreen from '@/components/Setting';
import { searchUsername, getOracleCadUsdcFromConet } from '@/services/beamio';
import { checkRedeemAdminCodeValid, isCardAdmin, postCardRedeemAdmin, getAAAccount, postCardAddAdminByAdmin, postCardAddAdmin, encodeAddAdminWithMintLimit, signExecuteForAdmin, signExecuteForOwner } from '@/services/BeamioCard';
import { conetDepinProvider, baseEndpoint, baseRpcProviderDirect } from '@/utils/constants';
import { BEAMIO_INDEXER_DIAMOND, BEAMIO_USER_CARD_ASSET_ADDRESS } from '@/config/chainAddresses';
import { parseRedeemAdminFromUrl } from '@/utils/parseRedeemAdminFromUrl';
import { generateRegisterPOSNonce, signRemovePOS, removePOSApi } from '@/services/merchantPOS';
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
 ShieldCheck,
 RefreshCw,
 Leaf,
 Loader2,
 ArrowRight,
 Menu,
 CalendarDays
} from 'lucide-react';

const getImg = (avatarSeed: string | undefined) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || '@Beamio')}`;

const USDC_ICON_URL = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png';
const BASE_ICON_URL = 'https://beamio.app/app/static/media/base-logo.275b67e94556e30ce59b.png';

/** USDC on Base 复合图标：主圆标 + 右下 Base 角标（beamio-usdc-base-composite-icon） */
const UsdcBaseCompositeIcon = ({ size = 16, badgeSize }: { size?: number; badgeSize?: number }) => {
  const bs = badgeSize ?? Math.round(size * 0.625);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size, minWidth: size, minHeight: size }}>
      <img src={USDC_ICON_URL} alt="USDC" className="block w-full h-full rounded-full object-contain" />
      <img src={BASE_ICON_URL} alt="Base" className="block absolute -bottom-0.5 -right-0.5 rounded-full border border-white bg-white" style={{ width: bs, height: bs }} />
    </div>
  );
};

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

/** Display row for Transactions table */
type TxDisplayRow = {
  id: string
  dateStr: string
  time: string
  type: 'Charge' | 'In-Store Top-Up' | 'Tip'
  subtotal: number
  tip: number
  total: number
  method: string
  ctreeAmount: number
  usdcAmount: number
  source: 'APP' | 'NFC'
  beamioTag: string | null
  status: string
  hash: string
  terminal: string
  /** top-level admin for reporting (admin topup flows) */
  topAdmin?: string
  /** subordinate that processed this tx (admin topup flows) */
  subordinate?: string
}

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
const FIXED_USER_CARD_CONTRACT_ADDRESS = BEAMIO_USER_CARD_ASSET_ADDRESS
const CONET_BUINT_ADDRESS = '0x4A3E59519eE72B9Dcf376f0617fF0a0a5a1ef879'
const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const
const BEAMIO_APP_URL = 'https://beamio.app'
/** Use baseEndpoint (CoNET fallback) for stats; baseRpcProviderDirect for isAdmin (avoid CoNET 0x BAD_DATA) */
const BIZ_CACHE_PREFIX = 'beamio:biz-example:'
/** Fallback when CoNET oracle fetch fails */
const ORACLE_CAD_USDC_FALLBACK = 0.740
/** Set to false to hide the Linked Merchant Card panel */
const SHOW_LINKED_MERCHANT_CARD_PANEL = false
const USER_CARD_ADMIN_READ_ABI = [
  'function owner() view returns (address)',
  'function isAdmin(address) view returns (bool)',
  'function getAdminListWithMetadata() view returns (address[] admins, string[] metadatas, address[] parents)',
  'function getAdminSubordinatesWithMetadata(address admin) view returns (address[] subordinates, string[] metadatas, address[] parents)',
  'function getAdminStatsFull(address admin, uint8 periodType, uint256 anchorTs, uint256 cumulativeStartTs) view returns (uint256 cumulativeMint, uint256 cumulativeBurn, uint256 cumulativeTransfer, uint256 cumulativeTransferAmount, uint256 cumulativeRedeemMint, uint256 cumulativeUSDCMint, uint256 cumulativeIssued, uint256 cumulativeUpgraded, uint256 periodMint, uint256 periodBurn, uint256 periodTransfer, uint256 periodTransferAmount, uint256 periodRedeemMint, uint256 periodUSDCMint, uint256 periodIssued, uint256 periodUpgraded, uint256 mintCounterFromClear, uint256 burnCounterFromClear, uint256 transferCounterFromClear, uint256 transferAmountFromClear, uint256 redeemMintCounterFromClear, uint256 usdcMintCounterFromClear, address[] subordinates)',
  'function getAdminAirdropLimit(address admin) view returns (address admin, address parent, uint256 limit, uint256 usedFromClear, uint256 remainingAvailable, bool unlimited)',
  'function getGlobalStatsFull(uint8 periodType, uint256 anchorTs, uint256 cumulativeStartTs) view returns (uint256 cumulativeMint, uint256 cumulativeBurn, uint256 cumulativeTransfer, uint256 cumulativeTransferAmount, uint256 cumulativeRedeemMint, uint256 cumulativeUSDCMint, uint256 cumulativeIssued, uint256 cumulativeUpgraded, uint256 periodMint, uint256 periodBurn, uint256 periodTransfer, uint256 periodTransferAmount, uint256 periodRedeemMint, uint256 periodUSDCMint, uint256 periodIssued, uint256 periodUpgraded, uint256 adminCount)',
] as const

const TX_PAGE_TUPLE = 'tuple(bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, tuple(uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, tuple(uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists, address topAdmin, address subordinate)';

/** BeamioIndexerDiamond ActionFacet: getAccountTransactionsByCurrentPeriodOffsetPaged */
const INDEXER_ACTION_ABI = [
  `function getAccountTransactionsByCurrentPeriodOffsetPaged(address account, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
] as const

/** BeamioIndexerDiamond BeamioUserCardStatsFacet: getAssetTransactionsByCurrentPeriodOffsetAndAccountModePaged (asset=card, account=0 for all) */
const INDEXER_ASSET_STATS_ABI = [
  `function getAssetTransactionsByCurrentPeriodOffsetAndAccountModePaged(address asset, address account, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter, uint8 accountMode, uint256 chainIdFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
  `function getAssetTransactionsByTopAdminAndCurrentPeriodOffsetAndAccountModePaged(address asset, address topAdmin, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter, uint8 accountMode, uint256 chainIdFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
  `function getAssetTransactionsBySubordinateAndCurrentPeriodOffsetAndAccountModePaged(address asset, address subordinate, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter, uint8 accountMode, uint256 chainIdFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
] as const

/** BeamioIndexerDiamond ActionFacet: getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged (7 params, no chainIdFilter) */
const INDEXER_ACCOUNT_ABI = [
  `function getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged(address account, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter, uint8 accountMode) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
] as const

const CHAIN_ID_FILTER_ALL = ethers.MaxUint256

const PERIOD_DAY = 1
/** keccak256("merchant_pay:tip_updated") - tip transactions */
const TX_MERCHANT_PAY_TIP_UPDATED = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:tip_updated'))
const TX_MERCHANT_PAY_CONFIRMED = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:confirmed'))
const TX_CATEGORY_ZERO = ethers.ZeroHash

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

/** Unified Base overview feeder: 15s interval, single batch to reduce RPC load */
const FEEDER_INTERVAL_MS = 15_000;

/** In-memory fetch cache: 30s TTL, per-key dedup, global serialization (only one RPC process at a time) */
const FETCH_TTL_MS = 30_000;
const fetchCache = new Map<string, { value: unknown; fetchedAt: number }>();
const fetchInProgress = new Map<string, Promise<unknown>>();
let globalFetchQueue: Promise<void> = Promise.resolve();

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = fetchCache.get(key) as { value: T; fetchedAt: number } | undefined;
  if (cached && (now - cached.fetchedAt) < FETCH_TTL_MS) {
    return cached.value;
  }

  const existing = fetchInProgress.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const run = async (): Promise<T> => {
    await globalFetchQueue;
    const result = await fetcher();
    return result;
  };

  const promise = run()
    .then((value) => {
      fetchCache.set(key, { value, fetchedAt: Date.now() });
      fetchInProgress.delete(key);
      return value;
    })
    .catch((err) => {
      fetchInProgress.delete(key);
      throw err;
    });

  globalFetchQueue = globalFetchQueue.then(() => promise).then((): void => undefined, (): void => undefined);
  fetchInProgress.set(key, promise);
  return promise as Promise<T>;
}

/** Invalidate cache for a key (e.g. after redeem admin) */
function invalidateFetchCache(prefix: string) {
  for (const k of fetchCache.keys()) {
    if (k.startsWith(prefix)) fetchCache.delete(k);
  }
  for (const k of fetchInProgress.keys()) {
    if (k.startsWith(prefix)) fetchInProgress.delete(k);
  }
}

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

type AaRefreshStatus = 'idle' | 'loading' | 'success' | 'error';

const AddressRow = ({ label, icon: Icon, address, fullAddress, onRefresh, refreshStatus = 'idle' }: { label: string; icon: LucideIcon; address: string; fullAddress: string; onRefresh?: () => void; refreshStatus?: AaRefreshStatus }) => {
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
  const isRefreshDisabled = refreshStatus !== 'idle';
  const renderRefreshButton = () => {
    if (refreshStatus === 'loading') {
      return <Loader2 size={14} className="shrink-0 animate-spin text-slate-400" />;
    }
    if (refreshStatus === 'success') {
      return <Check size={14} className="shrink-0 text-emerald-500" />;
    }
    if (refreshStatus === 'error') {
      return <AlertTriangle size={14} className="shrink-0 text-amber-500" />;
    }
    return <RefreshCw size={14} className="shrink-0" />;
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-tight flex items-center gap-1 shrink-0 leading-none whitespace-nowrap"><Icon size={11} className="shrink-0" /> {label}</span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden justify-end">
        <span className={`text-[11px] font-mono font-bold bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm truncate leading-none inline-flex items-center min-w-0 ${hasAddress ? 'text-[#1562f0]' : 'text-slate-400'}`}>{address}</span>
        {hasAddress ? (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex items-center justify-center"
            title="Copy"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        ) : onRefresh && (
          <button
            type="button"
            onClick={isRefreshDisabled ? undefined : onRefresh}
            disabled={isRefreshDisabled}
            className={`shrink-0 p-1 rounded-md flex items-center justify-center transition-colors ${isRefreshDisabled ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            title={refreshStatus === 'loading' ? 'Fetching...' : refreshStatus === 'success' ? 'Success' : refreshStatus === 'error' ? 'Failed' : 'Retry fetch AA'}
          >
            {renderRefreshButton()}
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
 const [timeFilter, setTimeFilter] = useState('Today');
 const [oracleCadUsdc, setOracleCadUsdc] = useState<number | null>(null);
 const [activeLedger, setActiveLedger] = useState<'All' | 'AA' | 'EOA'>('All');
 const [txSearchTerm, setTxSearchTerm] = useState('');
 const [txFilterTerminal, setTxFilterTerminal] = useState('All');
 const [txFilterType, setTxFilterType] = useState('All');
 const fixedCardAdminsCacheKey = `card-admins:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:v2`;
 const linkedMerchantAdminsCacheKey = `linked-merchants:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:v2`;
 const fixedCardMetadataCacheKey = `card-metadata:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`;
 // Prefer non-empty keyID; empty string must not block myAddress (?? only skips null/undefined).
 const currentEoa = ((profiles?.[0]?.keyID?.trim() || myAddress?.trim()) || '').toLowerCase();
 const linkedTerminalsCacheKey = `eoa:${currentEoa}:linked-terminals:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`;
 const [fixedCardAdmins, setFixedCardAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(fixedCardAdminsCacheKey) ?? []);
 const [linkedMerchantAdmins, setLinkedMerchantAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) ?? []);
 const [fixedCardMetadata, setFixedCardMetadata] = useState<FixedUserCardMetadata | null>(() => loadTrustedCache<FixedUserCardMetadata>(fixedCardMetadataCacheKey));
 const [merchantOwnerProfile, setMerchantOwnerProfile] = useState<BeamioProfile>(null);
 const grossSalesCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:global-gross-sales`;
 const cumulativeMintCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:cumulative-mint`;
 const adminStatsTodayCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:global-stats-today`;
 const adminTipsTodayCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:tips-today`;
 const [grossSalesTotal, setGrossSalesTotal] = useState<number | null>(() => loadTrustedCache<number>(grossSalesCacheKey));
 const [cumulativeMintTotal, setCumulativeMintTotal] = useState<number | null>(() => loadTrustedCache<number>(cumulativeMintCacheKey));
 const [adminStatsToday, setAdminStatsToday] = useState<{ grossSales: number; topUps: number } | null>(null);
 const [adminNetworkSummaryToday, setAdminNetworkSummaryToday] = useState<{ cadVol: number; txCount: number; usdc: number; vouchers: number } | null>(null);
 const [adminTipsToday, setAdminTipsToday] = useState<number | null>(null);
 const [adminMintLimitQuota, setAdminMintLimitQuota] = useState<number | null>(null);
 const [adminMintCounterFromClear, setAdminMintCounterFromClear] = useState<number | null>(null);
 const [protocolFuelReserveBalance, setProtocolFuelReserveBalance] = useState<number | null>(null);
 const [protocolFuelConsumptionToday, setProtocolFuelConsumptionToday] = useState<number | null>(null);
 const [overviewRefreshTrigger, setOverviewRefreshTrigger] = useState(0);
 const [overviewRefreshing, setOverviewRefreshing] = useState(false);
 const [linkedMerchantLookupDone, setLinkedMerchantLookupDone] = useState(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) !== null);
 const [adminRetryCount, setAdminRetryCount] = useState(0);
 const [redeemAdminInProgress, setRedeemAdminInProgress] = useState(false);
 const [aaRefreshStatus, setAaRefreshStatus] = useState<AaRefreshStatus>('idle');
 const [indexerTransactions, setIndexerTransactions] = useState<TxDisplayRow[]>([]);
 const [indexerTransactionsLoading, setIndexerTransactionsLoading] = useState(false);
 /** Chain-verified admin status (EOA-scoped): local cache first, chain fetch as backup (beamio-ai-onchain-fetch) */
 const isAdminTrustedCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:is-admin`;
 const [isCurrentUserCardAdmin, setIsCurrentUserCardAdmin] = useState<boolean | null>(() =>
   currentEoa && ethers.isAddress(currentEoa) ? (loadTrustedCache<boolean>(isAdminTrustedCacheKey) ?? null) : null
 );

 // Store Wallets, Market, Messages, Partner Alliances
 const [joinedAlliances, setJoinedAlliances] = useState<AllianceId[]>([]);
 const [alliancesDb, setAlliancesDb] = useState(INITIAL_ALLIANCES_DB);
 const [isJoinAllianceModalOpen, setIsJoinAllianceModalOpen] = useState(false);
 const [applyingAlliance, setApplyingAlliance] = useState<AllianceId | null>(null);
 const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
 const [activeContact, setActiveContact] = useState('c1');
 const [chatInput, setChatInput] = useState('');

 const [eoaUsdcBalance, setEoaUsdcBalance] = useState<string | null>(null);
 const [aaUsdcBalance, setAaUsdcBalance] = useState<string | null>(null);
 const [aaBUnits, setAaBUnits] = useState<number | null>(null);
 const [subordinateBalances, setSubordinateBalances] = useState<Record<string, string | null>>({});

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
   invalidateFetchCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`);
   invalidateFetchCache('indexer:tips');
   invalidateFetchCache('eoa:');
     const keys = [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, grossSalesCacheKey, cumulativeMintCacheKey, adminStatsTodayCacheKey, adminTipsTodayCacheKey, linkedTerminalsCacheKey, isAdminTrustedCacheKey];
     keys.forEach((k) => window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${k}`));
     Object.keys(window.localStorage).filter((k) => (k.startsWith(BIZ_CACHE_PREFIX + 'card:') && (k.includes('mint-limit-quota') || k.includes('quota-and-mint-counter'))) || (k.startsWith(BIZ_CACHE_PREFIX) && k.includes('buint:balance:'))).forEach((k) => window.localStorage.removeItem(k));
     setFixedCardAdmins([]);
     setLinkedMerchantAdmins([]);
     setIsCurrentUserCardAdmin(null);
     setTerminals([]);
     setLinkedMerchantLookupDone(false);
     setGrossSalesTotal(null);
     setCumulativeMintTotal(null);
     setAdminStatsToday(null);
     setAdminTipsToday(null);
     setAdminMintLimitQuota(null);
     setAdminMintCounterFromClear(null);
     setProtocolFuelReserveBalance(null);
     setProtocolFuelConsumptionToday(null);
     setAdminRetryCount((c) => c + 1);
   } catch {
     setAdminRetryCount((c) => c + 1);
   }
 }, [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, grossSalesCacheKey, cumulativeMintCacheKey, adminStatsTodayCacheKey, adminTipsTodayCacheKey, linkedTerminalsCacheKey, isAdminTrustedCacheKey]);

 const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
 const [payoutStep, setPayoutStep] = useState(1);
  // New state for sidebar toggle
 const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

 useEffect(() => {
   const handleResize = () => {
     if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
   };
   window.addEventListener('resize', handleResize);
   return () => window.removeEventListener('resize', handleResize);
 }, []);

 /** Oracle CAD/USDC from CoNET BeamioOracle — fetch on mount and every 10 min */
 useEffect(() => {
   const fetchOracle = () => {
     getOracleCadUsdcFromConet().then((rate) => {
       if (rate != null) setOracleCadUsdc(rate);
     });
   };
   fetchOracle();
   const interval = setInterval(fetchOracle, 10 * 60 * 1000);
   return () => clearInterval(interval);
 }, []);

 /** Reset metrics state when EOA changes: avoid showing previous EOA's cached data (beamio-ai-onchain-fetch: cache key must include EOA, invalidate on switch) */
 const prevEoaRef = React.useRef<string | null>(null);
 useEffect(() => {
   if (prevEoaRef.current !== null && prevEoaRef.current !== currentEoa) {
     const oldEoa = prevEoaRef.current;
     invalidateFetchCache('eoa:');
     invalidateFetchCache('aa:');
     invalidateFetchCache('indexer:tx');
     invalidateFetchCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`);
     try {
       Object.keys(window.localStorage)
         .filter((k) => k.startsWith(`${BIZ_CACHE_PREFIX}eoa:${oldEoa}:`))
         .forEach((k) => window.localStorage.removeItem(k));
       // Clear card-level admin caches on EOA switch: production may reuse localStorage from previous user,
       // causing isFixedUserCardAdmin to show admin content to non-admin when cache + stale identity align.
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${fixedCardAdminsCacheKey}`);
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${linkedMerchantAdminsCacheKey}`);
     } catch { /* ignore */ }
     setFixedCardAdmins([]);
     setLinkedMerchantAdmins([]);
     setLinkedMerchantLookupDone(false);
     setGrossSalesTotal(null);
     setCumulativeMintTotal(null);
     setAdminStatsToday(null);
     setAdminNetworkSummaryToday(null);
     setAdminTipsToday(null);
     setAdminMintLimitQuota(null);
     setAdminMintCounterFromClear(null);
     setProtocolFuelReserveBalance(null);
     setProtocolFuelConsumptionToday(null);
     setIndexerTransactions([]);
     setTerminals([]);
     setSubordinateBalances({});
     setTerminalStats({});
     setAaUsdcBalance(null);
     setAaBUnits(null);
     setIsCurrentUserCardAdmin(null);
     setAdminRetryCount((c) => c + 1);
   }
   prevEoaRef.current = currentEoa;
 }, [currentEoa, fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey]);

 const handleTabChange = useCallback((tab: string) => {
   setActiveTab(tab);
   setIsMobileMenuOpen(false);
 }, []);


 /** 终端记录类型 */
 type TerminalRecord = { id: string; tag: string; name: string; eoa: string; status: string; lastActive: string };
 // 新增：终端管理状态（链上 + 本地存储）
 const [terminals, setTerminals] = useState<TerminalRecord[]>(() => loadTrustedCache<TerminalRecord[]>(linkedTerminalsCacheKey) ?? []);
 const [terminalsLoading, setTerminalsLoading] = useState(false);
 type TerminalStats = { transferAmountFromClear: number; remainingAvailable: number; mintCounterFromClear: number }; // remainingAvailable in E6 display units
 const [terminalStats, setTerminalStats] = useState<Record<string, TerminalStats | null>>({});
 const [isAddTerminalOpen, setIsAddTerminalOpen] = useState(false);
 const [newTerminalTag, setNewTerminalTag] = useState('');
 const [linkTerminalLoading, setLinkTerminalLoading] = useState(false);
 const [linkTerminalError, setLinkTerminalError] = useState<string | null>(null);
 const [deleteTerminalToRemove, setDeleteTerminalToRemove] = useState<{ id: string; tag: string; name: string; eoa: string } | null>(null);
 const [removeTerminalLoading, setRemoveTerminalLoading] = useState(false);
 const [removeTerminalError, setRemoveTerminalError] = useState<string | null>(null);
 const [newDeviceName, setNewDeviceName] = useState('');
 const [newTerminalMintLimit, setNewTerminalMintLimit] = useState('1000');
 const [deviceHandleResolved, setDeviceHandleResolved] = useState<{ username: string; address: string; image?: string } | null>(null);
 const [deviceHandleError, setDeviceHandleError] = useState<string | null>(null);
 const [deviceHandleChecking, setDeviceHandleChecking] = useState(false);
 const deviceValidateAbortRef = useRef<boolean>(false);

 const validateDeviceHandle = useCallback(async (raw: string) => {
   const trimmed = raw.trim().replace(/^@/, '');
   if (!trimmed) {
     setDeviceHandleError(null);
     setDeviceHandleResolved(null);
     return;
   }
   deviceValidateAbortRef.current = false;
   setDeviceHandleChecking(true);
   setDeviceHandleError(null);
   setDeviceHandleResolved(null);
   try {
     const isAddressSearch = ethers.isAddress(trimmed);
     const searchKey = isAddressSearch ? ethers.getAddress(trimmed) : trimmed;
     const res = await searchUsername(searchKey);
     if (deviceValidateAbortRef.current) return;
     const results = res?.results ?? [];
     const norm = trimmed.toLowerCase();
     let match: { username?: string; accountName?: string; address?: string; image?: string } | undefined;
     if (isAddressSearch) {
       match = results.find((r: { address?: string }) => {
         const a = (r?.address ?? '').toLowerCase();
         return a === norm;
       }) ?? results[0];
       if (match && !match.address) (match as { address?: string }).address = searchKey;
     } else {
       match = results.find((r: { username?: string; accountName?: string }) => {
         const u = (r?.username ?? r?.accountName ?? '').toLowerCase();
         return u === norm;
       });
     }
     if (match) {
       const addr = (match as { address?: string }).address;
       if (addr && ethers.isAddress(addr)) {
         setDeviceHandleResolved({
           username: match.username ?? match.accountName ?? (isAddressSearch ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : trimmed),
           address: addr,
           image: match.image,
         });
         setDeviceHandleError(null);
         return;
       }
       setDeviceHandleResolved({
         username: match.username ?? match.accountName ?? trimmed,
         address: addr ?? '',
         image: match.image,
       });
       setDeviceHandleError(null);
     } else if (isAddressSearch) {
       setDeviceHandleResolved({
         username: `${searchKey.slice(0, 6)}…${searchKey.slice(-4)}`,
         address: searchKey,
       });
       setDeviceHandleError(null);
     } else {
       setDeviceHandleResolved(null);
       setDeviceHandleError('Not found');
     }
   } catch {
     if (!deviceValidateAbortRef.current) {
       setDeviceHandleResolved(null);
       setDeviceHandleError('Not found');
     }
   } finally {
     if (!deviceValidateAbortRef.current) setDeviceHandleChecking(false);
   }
 }, []);

 const closeAddTerminalModal = useCallback(() => {
   setIsAddTerminalOpen(false);
   setNewTerminalTag('');
   setNewDeviceName('');
   setNewTerminalMintLimit('1000');
   setLinkTerminalError(null);
   setDeviceHandleError(null);
   setDeviceHandleResolved(null);
 }, []);

 const merchant = profiles?.[0]?.keyID ?? myAddress;
 const adminCandidateAddresses = [
   profiles?.[0]?.aaAccount,
   profiles?.[0]?.keyID,
   myAddress,
 ].filter((address): address is string => !!address && ethers.isAddress(address))
   .map((address) => ethers.getAddress(address));
 const normalizedAdminCandidates = adminCandidateAddresses.map((address) => address.toLowerCase());
 /** First linked identity in fixedCardAdmins (EOA preferred, then AA) so UI matches isAdmin when only AA is listed. */
 const effectiveAdminAddress = useMemo(() => {
  const adminSet = new Set(fixedCardAdmins.map((a) => ethers.getAddress(a).toLowerCase()));
  const tryMatch = (raw: string | undefined | null) => {
   const t = typeof raw === 'string' ? raw.trim() : '';
   if (!t || !ethers.isAddress(t)) return null;
   const a = ethers.getAddress(t);
   return adminSet.has(a.toLowerCase()) ? a : null;
  };
  return (
   tryMatch(profiles?.[0]?.keyID) ??
   tryMatch(myAddress) ??
   tryMatch(profiles?.[0]?.aaAccount) ??
   null
  );
 }, [fixedCardAdmins, profiles?.[0]?.keyID, profiles?.[0]?.aaAccount, myAddress]);

 const handleRefreshAA = useCallback(async () => {
   const p0 = profiles?.[0];
   const eoa = (p0?.keyID?.trim() || myAddress?.trim()) || '';
   if (!eoa || !ethers.isAddress(eoa)) {
     setAaRefreshStatus('error');
     setTimeout(() => setAaRefreshStatus('idle'), 3000);
     return;
   }
   setAaRefreshStatus('loading');
   try {
     const profileForFetch = p0?.keyID?.trim() ? p0 : { ...(p0 ?? {}), keyID: myAddress };
     const chainAa = await getAAAccount(profileForFetch);
     if (!chainAa || !ethers.isAddress(chainAa)) {
       if (process.env.NODE_ENV !== 'production') console.warn('[handleRefreshAA] getAAAccount returned no valid AA for eoa:', eoa, 'chainAa:', chainAa);
       setAaRefreshStatus('error');
       setTimeout(() => setAaRefreshStatus('idle'), 3000);
       return;
     }
     if (p0) {
       const nextProfiles = (profiles ?? []).map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
       setProfiles(nextProfiles);
       const temp = CoNET_Data;
       if (temp?.profiles?.length) {
         temp.profiles = temp.profiles.map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
         setCoNET_Data(temp);
         try {
           await storeSystemData();
         } catch (e) {
           if (process.env.NODE_ENV !== 'production') console.warn('[handleRefreshAA] storeSystemData failed (non-fatal):', e);
         }
       }
     } else {
       setProfiles([{ keyID: myAddress, aaAccount: chainAa } as profile]);
       const temp = CoNET_Data;
       if (temp) {
         temp.profiles = [{ keyID: myAddress, aaAccount: chainAa } as profile];
         setCoNET_Data(temp);
         try {
           await storeSystemData();
         } catch (e) {
           if (process.env.NODE_ENV !== 'production') console.warn('[handleRefreshAA] storeSystemData failed (non-fatal):', e);
         }
       }
     }
     setAaRefreshStatus('success');
     setTimeout(() => setAaRefreshStatus('idle'), 3000);
   } catch (e) {
     if (process.env.NODE_ENV !== 'production') console.warn('[handleRefreshAA] error:', e);
     setAaRefreshStatus('error');
     setTimeout(() => setAaRefreshStatus('idle'), 3000);
   }
 }, [profiles, setProfiles, myAddress]);

 // On entry: if profiles[0] exists but aaAccount is empty, or myAddress exists without profile, fetch AA from chain and update
 useEffect(() => {
   const p0 = profiles?.[0];
   const eoa = (p0?.keyID?.trim() || myAddress?.trim()) || '';
   if (!eoa || !ethers.isAddress(eoa)) return;
   if (p0?.aaAccount?.trim()) return;
   let cancelled = false;
   const run = async (retryCount = 0) => {
     if (cancelled) return;
     try {
       const profileForFetch = p0?.keyID?.trim() ? p0 : { ...(p0 ?? {}), keyID: myAddress };
       const chainAa = await getAAAccount(profileForFetch);
       if (cancelled) return;
       if (!chainAa) {
         if (retryCount === 0) setTimeout(() => run(1), 2500);
         return;
       }
       if (p0) {
         const nextProfiles = (profiles ?? []).map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
         setProfiles(nextProfiles);
         const temp = CoNET_Data;
         if (temp?.profiles?.length) {
           temp.profiles = temp.profiles.map((p: profile, i: number) => (i === 0 ? { ...p, aaAccount: chainAa } : p));
           setCoNET_Data(temp);
           await storeSystemData();
         }
       } else {
         setProfiles([{ keyID: myAddress, aaAccount: chainAa } as profile]);
         const temp = CoNET_Data;
         if (temp) {
           temp.profiles = [{ keyID: myAddress, aaAccount: chainAa } as profile];
           setCoNET_Data(temp);
           await storeSystemData();
         }
       }
     } catch {
       if (retryCount === 0) setTimeout(() => run(1), 2500);
     }
   };
   void run();
   return () => { cancelled = true; };
 }, [profiles, setProfiles, myAddress]);

 /** Fetch subordinate admins from chain: owner sees parent=0 admins; admin sees parent=userEOA admins. Uses only trusted chain data; removes items not on chain.
  * Unique id = EOA address (always). If subordinate is AA, resolve owner() to get EOA.
  * Merges cached items not yet on chain (optimistic updates) so newly added terminals show immediately. */
const fetchTerminals = useCallback(async (opts?: { silent?: boolean }) => {
  const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
  if (!userEOA || !ethers.isAddress(userEOA)) {
    setTerminals([]);
    return;
  }
  if (!opts?.silent) setTerminalsLoading(true);
  try {
    const card = new ethers.Contract(FIXED_USER_CARD_CONTRACT_ADDRESS, USER_CARD_ADMIN_READ_ABI, baseEndpoint);
    const cardOwner = await card.owner() as string;
    const userAA = profiles?.[0]?.aaAccount?.trim();
    const isOwner =
      (cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userEOA)) ||
      (userAA && cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userAA));
    const parentAdmin = isOwner ? ethers.ZeroAddress : ethers.getAddress(userEOA);
    const [subordinates, metadatas] = await card.getAdminSubordinatesWithMetadata(parentAdmin) as [string[], string[]];
    const seen = new Set<string>();
    const fromChain: TerminalRecord[] = [];
    for (let idx = 0; idx < (subordinates ?? []).length; idx++) {
      const addr = (subordinates ?? [])[idx];
      if (!addr || !ethers.isAddress(addr)) continue;
      let eoa: string;
      const code = await baseEndpoint.getCode(addr);
      if (code && code !== '0x' && code.length > 2) {
        try {
          const ownerRes = await baseEndpoint.call({ to: addr, data: '0x8da5cb5b' });
          if (ownerRes && typeof ownerRes === 'string' && ownerRes.length >= 66) {
            eoa = ethers.getAddress('0x' + ownerRes.slice(-40));
          } else {
            eoa = ethers.getAddress(addr);
          }
        } catch {
          eoa = ethers.getAddress(addr);
        }
      } else {
        eoa = ethers.getAddress(addr);
      }
      const id = eoa.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      let name = 'POS Terminal';
      let tag = fmtAddr(eoa);
      try {
        const metaStr = metadatas?.[idx];
        const meta = typeof metaStr === 'string' && metaStr ? JSON.parse(metaStr) : null;
        if (meta?.deviceName) name = meta.deviceName;
        if (meta?.handle) tag = meta.handle.startsWith('@') ? meta.handle : `@${meta.handle}`;
      } catch {
        /* ignore */
      }
      fromChain.push({
        id,
        tag,
        name,
        eoa: fmtAddr(eoa),
        status: 'Active',
        lastActive: 'On-chain',
      });
    }
    const chainIds = new Set(fromChain.map((t) => t.id.toLowerCase()));
    const cached = loadTrustedCache<TerminalRecord[]>(linkedTerminalsCacheKey) ?? [];
    const merged = [...fromChain];
    for (const c of cached) {
      if (c?.id && ethers.isAddress(c.id) && !chainIds.has(c.id.toLowerCase())) {
        merged.push(c);
        chainIds.add(c.id.toLowerCase());
      }
    }
    saveTrustedCache(linkedTerminalsCacheKey, merged);
    setTerminals(merged);
  } catch {
    const cached = loadTrustedCache<TerminalRecord[]>(linkedTerminalsCacheKey);
    if (cached?.length) setTerminals(cached);
    else setTerminals([]);
  } finally {
    if (!opts?.silent) setTerminalsLoading(false);
  }
}, [profiles, myAddress, linkedTerminalsCacheKey]);

 useEffect(() => {
   fetchTerminals();
 }, [fetchTerminals, adminRetryCount]);

 // Fetch real EOA USDC balance for The Vault
 useEffect(() => {
   const eoaAddr = (profiles?.[0]?.keyID ?? myAddress)?.trim();
   if (!eoaAddr || !ethers.isAddress(eoaAddr)) {
     setEoaUsdcBalance(null);
     return;
   }
   let cancelled = false;
   void fetchWithCache(`eoa:usdc:${eoaAddr.toLowerCase()}`, () => getBalance(eoaAddr)).then((b) => {
     if (!cancelled && b?.usdc != null) setEoaUsdcBalance(b.usdc);
   });
   return () => { cancelled = true; };
 }, [profiles, myAddress, overviewRefreshTrigger]);

 // Fetch AA USDC balance for Smart Terminal panel
 useEffect(() => {
   const aaAddr = profiles?.[0]?.aaAccount?.trim();
   if (!aaAddr || !ethers.isAddress(aaAddr)) {
     setAaUsdcBalance(null);
     return;
   }
   let cancelled = false;
   void fetchWithCache(`aa:usdc:${aaAddr.toLowerCase()}`, () => getBalance(aaAddr)).then((b) => {
     if (!cancelled && b?.usdc != null) setAaUsdcBalance(b.usdc);
   });
   return () => { cancelled = true; };
 }, [profiles, overviewRefreshTrigger]);

 // Fetch AA B-Units (Protocol Fuel) for Smart Terminal panel
 useEffect(() => {
   const aaAddr = profiles?.[0]?.aaAccount?.trim();
   if (!aaAddr || !ethers.isAddress(aaAddr)) {
     setAaBUnits(null);
     return;
   }
   let cancelled = false;
   const cacheKey = `aa:${aaAddr.toLowerCase()}:buint:balance`;
   void fetchWithCache(cacheKey, async () => {
     const buint = new ethers.Contract(CONET_BUINT_ADDRESS, ERC20_BALANCE_ABI, conetDepinProvider);
     const raw = await buint.balanceOf(aaAddr) as bigint;
     return Number(raw) / 1_000_000;
   }).then((balance) => {
     if (!cancelled) setAaBUnits(balance);
   });
   return () => { cancelled = true; };
 }, [profiles, overviewRefreshTrigger]);

 // Fetch USDC balance for each subordinate admin (terminals)
 useEffect(() => {
   const addrs = terminals.filter((t) => t.id && ethers.isAddress(t.id)).map((t) => ethers.getAddress(t.id));
   if (addrs.length === 0) {
     setSubordinateBalances({});
     return;
   }
   let cancelled = false;
   void Promise.all(
     addrs.map((addr) =>
       fetchWithCache(`eoa:usdc:${addr.toLowerCase()}`, () => getBalance(addr)).then((b) => ({ addr, usdc: b?.usdc ?? null }))
     )
   ).then((results) => {
     if (cancelled) return;
     const next: Record<string, string | null> = {};
     results.forEach(({ addr, usdc }) => { next[addr.toLowerCase()] = usdc; });
     setSubordinateBalances(next);
   });
   return () => { cancelled = true; };
 }, [terminals, overviewRefreshTrigger]);

 // Fetch terminal stats: transferAmountFromClear, remainingAvailable, mintCounterFromClear per admin
 useEffect(() => {
   const addrs = terminals.filter((t) => t.id && ethers.isAddress(t.id)).map((t) => ethers.getAddress(t.id));
   if (addrs.length === 0) {
     setTerminalStats({});
     return;
   }
   let cancelled = false;
   const card = new ethers.Contract(FIXED_USER_CARD_CONTRACT_ADDRESS, USER_CARD_ADMIN_READ_ABI, baseEndpoint);
   void Promise.all(
     addrs.map(async (addr) => {
       const key = addr.toLowerCase();
       const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
       let transferAmountFromClear = 0;
       let mintCounterFromClear = 0;
       let remainingAvailable = 0;
       try {
         const statsRes = await fetchWithCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin-stats:${key}:90d`, async () => {
           try {
             return await card.getAdminStatsFull(addr, 0, 0, ninetyDaysAgo) as { transferAmountFromClear: bigint; mintCounterFromClear: bigint };
           } catch {
             const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI]);
             const calldata = iface.encodeFunctionData('getAdminStatsFull', [addr, 0, 0, ninetyDaysAgo]);
             const hex = await baseEndpoint.call({ to: FIXED_USER_CARD_CONTRACT_ADDRESS, data: calldata });
             const raw = (hex as string).replace(/^0x/, '');
             if (raw.length >= 1344) {
               const transferHex = raw.substring(1280, 1344);
               const mintHex = raw.substring(1088, 1152);
               return {
                 transferAmountFromClear: BigInt('0x' + transferHex),
                 mintCounterFromClear: BigInt('0x' + mintHex),
               };
             }
             throw new Error('Short response');
           }
         });
         transferAmountFromClear = amountE6ToDisplayNumber(statsRes.transferAmountFromClear);
         mintCounterFromClear = amountE6ToDisplayNumber(statsRes.mintCounterFromClear);
       } catch {
         /* getAdminStatsFull may fail on some card implementations; keep 0 */
       }
       try {
         const limitRes = await fetchWithCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin-limit:${key}`, () =>
           card.getAdminAirdropLimit(addr) as Promise<{ remainingAvailable: bigint }>
         );
         const rem = limitRes.remainingAvailable;
         remainingAvailable = rem >= BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : amountE6ToDisplayNumber(rem);
       } catch {
         /* getAdminAirdropLimit may fail; keep 0 */
       }
       return {
         addr: key,
         transferAmountFromClear,
         mintCounterFromClear,
         remainingAvailable,
       };
     })
   ).then((results) => {
     if (cancelled) return;
     const next: Record<string, TerminalStats | null> = {};
     results.forEach((r) => {
       next[r.addr] = {
         transferAmountFromClear: r.transferAmountFromClear,
         remainingAvailable: r.remainingAvailable,
         mintCounterFromClear: r.mintCounterFromClear,
       };
     });
     setTerminalStats(next);
   }).catch(() => {
     if (!cancelled) setTerminalStats({});
   });
   return () => { cancelled = true; };
 }, [terminals, overviewRefreshTrigger]);

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

   const cardKey = `card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admins:v2`;
   void fetchWithCache(cardKey, async () => {
     const card = new ethers.Contract(
       FIXED_USER_CARD_CONTRACT_ADDRESS,
       USER_CARD_ADMIN_READ_ABI,
       baseEndpoint
     );
     try {
       const [owner, adminResult] = await Promise.all([
         card.owner() as Promise<string>,
         card.getAdminListWithMetadata() as Promise<[string[], string[], string[]]>,
       ]);
       const [admins] = adminResult;
       const ownerAddr = owner && owner !== ethers.ZeroAddress ? ethers.getAddress(owner) : null;
       const adminsNorm = (admins ?? []).map((a: string) => ethers.getAddress(a));
       const seen = new Set<string>();
       const allAdmins: string[] = [];
       if (ownerAddr) {
         seen.add(ownerAddr.toLowerCase());
         allAdmins.push(ownerAddr);
       }
       for (const a of adminsNorm) {
         if (!seen.has(a.toLowerCase())) {
           seen.add(a.toLowerCase());
           allAdmins.push(a);
         }
       }
       for (const adminAddr of [ownerAddr, ...adminsNorm].filter(Boolean)) {
         try {
           const [subs] = await card.getAdminSubordinatesWithMetadata(adminAddr) as [string[]];
           for (const s of subs ?? []) {
             if (s && ethers.isAddress(s) && !seen.has(ethers.getAddress(s).toLowerCase())) {
               seen.add(ethers.getAddress(s).toLowerCase());
               allAdmins.push(ethers.getAddress(s));
             }
           }
         } catch { /* ignore */ }
       }
       const nextLinkedMerchantAdmins = adminsNorm.filter((address) => address.toLowerCase() !== (ownerAddr ?? '').toLowerCase());
       return { admins: allAdmins, linkedMerchantAdmins: nextLinkedMerchantAdmins };
     } catch {
       const fallbackChecks = await Promise.all(
         adminCandidateAddresses.map(async (address) => ({
           address,
           isAdmin: await card.isAdmin(address) as boolean,
         }))
       );
       const fallbackAdmins = fallbackChecks
         .filter((entry) => entry.isAdmin)
         .map((entry) => entry.address);
       if (fallbackAdmins.length > 0) {
         return { admins: fallbackAdmins, linkedMerchantAdmins: fallbackAdmins };
       }
       throw new Error('fallback failed');
     }
   }).then((result) => {
     if (cancelled) return;
     setFixedCardAdmins(result.admins);
     setLinkedMerchantAdmins(result.linkedMerchantAdmins);
     setLinkedMerchantLookupDone(true);
     saveTrustedCache(fixedCardAdminsCacheKey, result.admins);
     saveTrustedCache(linkedMerchantAdminsCacheKey, result.linkedMerchantAdmins);
   }).catch(() => {
     if (cancelled) return;
     if (cachedAllAdmins !== null) setFixedCardAdmins(cachedAllAdmins);
     if (cachedAdmins !== null) {
       setLinkedMerchantAdmins(cachedAdmins);
       setLinkedMerchantLookupDone(true);
     }
   });

   return () => { cancelled = true; };
 }, [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, adminRetryCount, profiles?.[0]?.keyID, profiles?.[0]?.aaAccount, myAddress]);

 /** Admin status: local cache first (fast show/hide), chain fetch as backup. Only write cache on chain success (trusted). */
 useEffect(() => {
   if (!currentEoa || !ethers.isAddress(currentEoa)) {
     setIsCurrentUserCardAdmin(false);
     return;
   }
   let cancelled = false;
   const cached = loadTrustedCache<boolean>(isAdminTrustedCacheKey);
   if (cached !== null) setIsCurrentUserCardAdmin(cached);
   const fetchKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:is-admin`;
   void fetchWithCache(fetchKey, async () => {
     const card = new ethers.Contract(FIXED_USER_CARD_CONTRACT_ADDRESS, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
     const addrs = [
       profiles?.[0]?.aaAccount,
       profiles?.[0]?.keyID,
       myAddress,
     ].filter((a): a is string => !!a && ethers.isAddress(a)).map((a) => ethers.getAddress(a));
     if (addrs.length === 0) return false;
     const checks = await Promise.all(addrs.map((addr) => card.isAdmin(addr) as Promise<boolean>));
     return checks.some(Boolean);
   }).then((ok) => {
     if (!cancelled) {
       setIsCurrentUserCardAdmin(ok);
       saveTrustedCache(isAdminTrustedCacheKey, ok);
     }
   }).catch(() => {
     if (!cancelled && cached === null) setIsCurrentUserCardAdmin(false);
   });
   return () => { cancelled = true; };
 }, [currentEoa, isAdminTrustedCacheKey, profiles?.[0]?.aaAccount, profiles?.[0]?.keyID, myAddress, overviewRefreshTrigger, adminRetryCount]);

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

 /** Init: resolve EOA from same source as left menu (Owner EOA capsule), then start 15s feeder */
 const [feederEoa, setFeederEoa] = useState<string | null>(null);
 useEffect(() => {
   const menuEoa = (profiles?.[0]?.keyID?.trim() || myAddress?.trim() || '').trim();
   const resolved = menuEoa && ethers.isAddress(menuEoa) ? ethers.getAddress(menuEoa) : (fixedCardMetadata?.cardOwner && ethers.isAddress(fixedCardMetadata.cardOwner) ? ethers.getAddress(fixedCardMetadata.cardOwner) : null);
   if (resolved) setFeederEoa(resolved);
 }, [profiles?.[0]?.keyID, myAddress, fixedCardMetadata?.cardOwner]);

 /** Unified Base overview feeder: single batch every 15s; only starts when feederEoa is set (init complete) */
 const feederInProgressRef = useRef(false);
 const feederCancelledRef = useRef(false);
 const feederAccountRef = useRef('');
 feederAccountRef.current = feederEoa ?? '';
 useEffect(() => {
   if (activeTab !== 'Overview') return;
   if (!feederEoa || !ethers.isAddress(feederEoa)) return;
   feederCancelledRef.current = false;
   const account = feederEoa;
   const effectiveAdmin = effectiveAdminAddress ?? '';
   const quotaAddrForCache =
    effectiveAdmin && ethers.isAddress(effectiveAdmin)
     ? ethers.getAddress(effectiveAdmin)
     : account && ethers.isAddress(account)
       ? ethers.getAddress(account)
       : '';

   // Load trusted cache for immediate display
   const cachedGrossSales = loadTrustedCache<number>(grossSalesCacheKey);
   const cachedCumulativeMint = loadTrustedCache<number>(cumulativeMintCacheKey);
   const cachedStatsToday = loadTrustedCache<{ grossSales: number; topUps: number }>(adminStatsTodayCacheKey);
   const cachedMetadata = loadTrustedCache<FixedUserCardMetadata>(fixedCardMetadataCacheKey);
   const networkSummaryCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${effectiveAdmin.toLowerCase()}:network-summary-today`;
   /** Prefer resolved effective admin for quota key; fall back to feeder EOA before fixedCardAdmins loads */
   const quotaCacheKey = `card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${quotaAddrForCache.toLowerCase()}:quota-and-mint-counter`;
   const buintBalanceCacheKey = `eoa:${account.toLowerCase()}:buint:balance`;
   const aa = profiles?.[0]?.aaAccount?.trim();
   const accountsToQuery = account && ethers.isAddress(account) ? [ethers.getAddress(account)] : [];
   if (aa && ethers.isAddress(aa) && account && ethers.getAddress(aa).toLowerCase() !== ethers.getAddress(account).toLowerCase()) {
     accountsToQuery.push(ethers.getAddress(aa));
   }
   const aaForKey = aa && ethers.isAddress(aa) ? ethers.getAddress(aa).toLowerCase() : '';
   const consumptionCacheKey = `eoa:${account.toLowerCase()}${aaForKey ? `:aa:${aaForKey}` : ''}:buint:consumption-today`;
   const cachedNetworkSummary = loadTrustedCache<{ cadVol: number; txCount: number; usdc: number; vouchers: number }>(networkSummaryCacheKey);
   const cachedQuota = loadTrustedCache<{ quota: number; mintCounterFromClear: number }>(quotaCacheKey);
   const cachedBuintBalance = loadTrustedCache<number>(buintBalanceCacheKey);
   const cachedConsumption = loadTrustedCache<number>(consumptionCacheKey);
   const cachedTips = loadTrustedCache<number>(adminTipsTodayCacheKey);

   if (cachedGrossSales !== null) setGrossSalesTotal(cachedGrossSales);
   if (cachedCumulativeMint !== null) setCumulativeMintTotal(cachedCumulativeMint);
   if (cachedStatsToday !== null) setAdminStatsToday(cachedStatsToday);
   if (cachedMetadata != null) setFixedCardMetadata(cachedMetadata);
   if (cachedNetworkSummary != null) setAdminNetworkSummaryToday(cachedNetworkSummary);
   if (cachedQuota != null) {
     setAdminMintLimitQuota(cachedQuota.quota);
     setAdminMintCounterFromClear(cachedQuota.mintCounterFromClear);
   }
   if (cachedBuintBalance != null) setProtocolFuelReserveBalance(cachedBuintBalance);
   if (cachedConsumption != null) setProtocolFuelConsumptionToday(cachedConsumption);
   if (cachedTips !== null) setAdminTipsToday(cachedTips);

   const runFeeder = async () => {
     if (feederInProgressRef.current) return;
     feederInProgressRef.current = true;
     const account = feederAccountRef.current || feederEoa;
     const card = new ethers.Contract(FIXED_USER_CARD_CONTRACT_ADDRESS, USER_CARD_ADMIN_READ_ABI, baseEndpoint);
     const buint = new ethers.Contract(CONET_BUINT_ADDRESS, ERC20_BALANCE_ABI, conetDepinProvider);
     const indexerAccount = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ACCOUNT_ABI, conetDepinProvider);
     const indexerAsset = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ASSET_STATS_ABI, conetDepinProvider);
     const ACCOUNT_MODE_ALL = 0;

     const feederWork = async () => {
       await globalFetchQueue;

       // 0. Card metadata (HTTP, merged into 15s refresh)
       if (!feederCancelledRef.current) {
         try {
           const apiRes = await fetch(
             `${BEAMIO_APP_URL}/api/cardMetadata?cardAddress=${encodeURIComponent(FIXED_USER_CARD_CONTRACT_ADDRESS)}`
           );
           let parsed: FixedUserCardMetadata | null = null;
           if (apiRes.ok) {
             const apiData = await apiRes.json() as { cardOwner?: string; metadata?: unknown };
             parsed = parseFixedUserCardMetadata(apiData.metadata, typeof apiData.cardOwner === 'string' ? apiData.cardOwner : undefined);
           }
           if (!parsed) {
             const normalizedCardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase().replace(/^0x/, '');
             const metadataResource = `0x${normalizedCardAddress}${'0'.repeat(64)}.json`;
             const metadataRes = await fetch(`${BEAMIO_APP_URL}/api/metadata/${metadataResource}`);
             if (metadataRes.ok) {
               const metadataJson = await metadataRes.json();
               parsed = parseFixedUserCardMetadata(metadataJson);
             }
           }
           if (parsed && !feederCancelledRef.current) {
             setFixedCardMetadata(parsed);
             saveTrustedCache(fixedCardMetadataCacheKey, parsed);
           }
         } catch {
           if (!feederCancelledRef.current && cachedMetadata != null) setFixedCardMetadata(cachedMetadata);
         }
       }

       // 1. Global stats (gross sales, cumulative mint, admin stats today)
       // cumulativeStartTs=0 → ~5y hourly loop → gas/RPC fail; fallback used same 0 → catch throws → cumulativeRes null → cumulativeRes! aborts entire feeder (steps 2–6 never run).
       const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 86400;
       type CumulativeRes = { cumulativeTransferAmount: bigint; cumulativeMint: bigint };
       type TodayRes = { periodTransferAmount: bigint; periodUSDCMint: bigint };
       let cumulativeRes: CumulativeRes | null = null;
       let todayRes: TodayRes | null = null;
       try {
         const [c0, c1] = await Promise.all([
           card.getGlobalStatsFull(0, 0, ninetyDaysAgo) as Promise<CumulativeRes & { periodTransferAmount: bigint; periodUSDCMint: bigint }>,
           card.getGlobalStatsFull(PERIOD_DAY, 0, ninetyDaysAgo) as Promise<TodayRes>,
         ]);
         cumulativeRes = { cumulativeTransferAmount: c0.cumulativeTransferAmount, cumulativeMint: c0.cumulativeMint };
         todayRes = { periodTransferAmount: c1.periodTransferAmount, periodUSDCMint: c1.periodUSDCMint };
       } catch {
         try {
           const [admins, , parents] = (await card.getAdminListWithMetadata()) as [string[], string[], string[]];
           const owner = (await card.owner()) as string;
           const zero = ethers.ZeroAddress;
           const rootAdmins = admins.filter((_, i) => {
             const p = (parents?.[i] ?? zero) as string;
             return !p || p === zero || p.toLowerCase() === owner.toLowerCase();
           });
           const sum = (a: bigint, b: bigint) => a + b;
           let cumTransferAmount = 0n, cumMint = 0n, periodTransferAmount = 0n, periodUSDCMint = 0n;
           for (const admin of rootAdmins) {
             const [s0, s1] = await Promise.all([
               card.getAdminStatsFull(admin, 0, 0, ninetyDaysAgo) as Promise<{ cumulativeTransferAmount: bigint; cumulativeMint: bigint }>,
               card.getAdminStatsFull(admin, PERIOD_DAY, 0, ninetyDaysAgo) as Promise<{ periodTransferAmount: bigint; periodUSDCMint: bigint }>,
             ]);
             cumTransferAmount = sum(cumTransferAmount, s0.cumulativeTransferAmount);
             cumMint = sum(cumMint, s0.cumulativeMint);
             periodTransferAmount = sum(periodTransferAmount, s1.periodTransferAmount);
             periodUSDCMint = sum(periodUSDCMint, s1.periodUSDCMint);
           }
           cumulativeRes = { cumulativeTransferAmount: cumTransferAmount, cumulativeMint: cumMint };
           todayRes = { periodTransferAmount, periodUSDCMint };
         } catch {
           /* keep cumulativeRes/todayRes null; do not throw — later steps must still run */
         }
       }
       if (!feederCancelledRef.current && cumulativeRes && todayRes) {
         const grossSalesTotal = amountE6ToDisplayNumber(cumulativeRes.cumulativeTransferAmount);
         const cumulativeMintTotal = amountE6ToDisplayNumber(cumulativeRes.cumulativeMint);
         const statsToday = { grossSales: amountE6ToDisplayNumber(todayRes.periodTransferAmount), topUps: amountE6ToDisplayNumber(todayRes.periodUSDCMint) };
         setGrossSalesTotal(grossSalesTotal);
         setCumulativeMintTotal(cumulativeMintTotal);
         setAdminStatsToday(statsToday);
         saveTrustedCache(grossSalesCacheKey, grossSalesTotal);
         saveTrustedCache(cumulativeMintCacheKey, cumulativeMintTotal);
         saveTrustedCache(adminStatsTodayCacheKey, statsToday);
       }

       // 2. Admin network summary (when admin)
       if (effectiveAdmin && ethers.isAddress(effectiveAdmin) && !feederCancelledRef.current) {
         try {
           const res = await card.getAdminStatsFull(effectiveAdmin, PERIOD_DAY, 0, ninetyDaysAgo) as { periodTransferAmount: bigint; periodTransfer: bigint; periodUSDCMint: bigint; periodMint: bigint };
           const summary = {
             cadVol: amountE6ToDisplayNumber(res.periodTransferAmount),
             txCount: Number(res.periodTransfer),
             usdc: amountE6ToDisplayNumber(res.periodUSDCMint),
             vouchers: amountE6ToDisplayNumber(res.periodMint),
           };
           if (!feederCancelledRef.current) {
             setAdminNetworkSummaryToday(summary);
             saveTrustedCache(networkSummaryCacheKey, summary);
           }
         } catch {
           if (!feederCancelledRef.current && cachedNetworkSummary != null) setAdminNetworkSummaryToday(cachedNetworkSummary);
         }
       } else if (!effectiveAdmin || !ethers.isAddress(effectiveAdmin)) {
         setAdminNetworkSummaryToday(null);
       }

       // 3. Admin quota and mintCounterFromClear — same address as Issued $CTree UI (effective admin, else feeder EOA)
       const baseAcct = feederAccountRef.current || feederEoa;
       const eaResolved = effectiveAdmin && ethers.isAddress(effectiveAdmin) ? ethers.getAddress(effectiveAdmin) : '';
       const quotaAccount =
        eaResolved || (baseAcct && ethers.isAddress(baseAcct) ? ethers.getAddress(baseAcct) : '');
       if (quotaAccount && ethers.isAddress(quotaAccount) && !feederCancelledRef.current) {
         const step3QuotaCacheKey = `card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${ethers.getAddress(quotaAccount).toLowerCase()}:quota-and-mint-counter`;
         const step3CachedQuota = loadTrustedCache<{ quota: number; mintCounterFromClear: number }>(step3QuotaCacheKey);
         const cardDirect = new ethers.Contract(FIXED_USER_CARD_CONTRACT_ADDRESS, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
         try {
           const adminLower = ethers.getAddress(quotaAccount).toLowerCase();
           const fetchStatsWithRawFallback = async (): Promise<{ mintCounterFromClear: bigint }> => {
             try {
               const r = await cardDirect.getAdminStatsFull(quotaAccount, 0, 0, ninetyDaysAgo) as { mintCounterFromClear: bigint };
               return r;
             } catch {
               const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI]);
               const calldata = iface.encodeFunctionData('getAdminStatsFull', [quotaAccount, 0, 0, ninetyDaysAgo]);
               const hex = await baseRpcProviderDirect.call({ to: FIXED_USER_CARD_CONTRACT_ADDRESS, data: calldata });
               const raw = (hex as string).replace(/^0x/, '');
               if (raw.length >= 1344) {
                 const structOffset = Number(BigInt('0x' + raw.slice(0, 64)));
                 const base = structOffset / 32;
                 const mintHex = raw.slice((base + 16) * 64, (base + 17) * 64);
                 return { mintCounterFromClear: BigInt('0x' + mintHex) };
               }
               throw new Error('AdminStatsFull raw parse failed');
             }
           };
           const [adminListRes, statsRes] = await Promise.all([
             cardDirect.getAdminListWithMetadata().catch(() => null) as Promise<[string[], string[]] | null>,
             fetchStatsWithRawFallback(),
           ]);
           const [admins, metadatas] = adminListRes ?? [[], []];
           const idx = admins.findIndex((a: string) => a.toLowerCase() === adminLower);
           let quotaDisplay = 0;
           if (idx >= 0 && metadatas[idx]) {
             try {
               const meta = JSON.parse(metadatas[idx]) as { mintLimit?: number | string; mintLimitE6?: number | string };
               const ml = meta.mintLimit, ml6 = meta.mintLimitE6;
               if (typeof ml === 'number' && ml > 0) quotaDisplay = ml;
               else if (typeof ml === 'string' && /^\d+(\.\d+)?$/.test(ml)) quotaDisplay = parseFloat(ml);
               else if (typeof ml6 === 'number' && ml6 > 0) quotaDisplay = ml6 / 1_000_000;
               else if (typeof ml6 === 'string' && /^\d+$/.test(ml6)) quotaDisplay = parseInt(ml6, 10) / 1_000_000;
             } catch { /* ignore */ }
           }
           if (quotaDisplay <= 0) {
             const limitRes = await cardDirect.getAdminAirdropLimit(quotaAccount) as { limit: bigint; unlimited: boolean };
             quotaDisplay = limitRes.unlimited ? Number.MAX_SAFE_INTEGER : amountE6ToDisplayNumber(limitRes.limit);
           }
           const mintCounterFromClear = amountE6ToDisplayNumber(statsRes.mintCounterFromClear);
           const result = { quota: quotaDisplay, mintCounterFromClear };
           if (process.env.NODE_ENV !== 'production') {
             console.warn('[feeder] Issued $CTree: fetched', { quotaAccount: quotaAccount.slice(0, 10) + '…', quota: result.quota, mintCounterFromClear: result.mintCounterFromClear, idx, adminsLen: admins.length });
           }
           if (!feederCancelledRef.current) {
             setAdminMintLimitQuota(result.quota);
             setAdminMintCounterFromClear(result.mintCounterFromClear);
             saveTrustedCache(step3QuotaCacheKey, result);
           }
         } catch (e) {
           if (process.env.NODE_ENV !== 'production') {
             console.warn('[feeder] Issued $CTree quota fetch failed:', e);
           }
           if (!feederCancelledRef.current && step3CachedQuota != null) {
             setAdminMintLimitQuota(step3CachedQuota.quota);
             setAdminMintCounterFromClear(step3CachedQuota.mintCounterFromClear);
           }
         }
       } else if (!quotaAccount || !ethers.isAddress(quotaAccount)) {
         setAdminMintLimitQuota(null);
         setAdminMintCounterFromClear(null);
       }

       // 4. Protocol Fuel Reserve (BUint balance)
       if (account && ethers.isAddress(account) && !feederCancelledRef.current) {
         try {
           const raw = await buint.balanceOf(account) as bigint;
           const balance = Number(raw) / 1_000_000;
           if (!feederCancelledRef.current) {
             setProtocolFuelReserveBalance(balance);
             saveTrustedCache(buintBalanceCacheKey, balance);
           }
         } catch {
           if (!feederCancelledRef.current && cachedBuintBalance != null) setProtocolFuelReserveBalance(cachedBuintBalance);
         }
       } else {
         setProtocolFuelReserveBalance(null);
       }

       // 5. Protocol Fuel Consumption today
       if (accountsToQuery.length > 0 && !feederCancelledRef.current) {
         try {
           let totalUnits6 = 0n;
           for (const acc of accountsToQuery) {
             try {
               const [, , , page] = await indexerAccount.getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged(acc, PERIOD_DAY, 0, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL) as [bigint, bigint, bigint, Array<{ fees?: { bServiceUnits6?: bigint } }>];
               for (const tx of page ?? []) totalUnits6 += tx?.fees?.bServiceUnits6 ?? 0n;
             } catch { /* ignore */ }
           }
           const consumption = Number(totalUnits6) / 1_000_000;
           if (!feederCancelledRef.current) {
             setProtocolFuelConsumptionToday(consumption);
             saveTrustedCache(consumptionCacheKey, consumption);
           }
         } catch {
           if (!feederCancelledRef.current && cachedConsumption != null) setProtocolFuelConsumptionToday(cachedConsumption);
         }
       }

       // 6. Admin tips today
       if (effectiveAdmin && ethers.isAddress(effectiveAdmin) && !feederCancelledRef.current) {
         try {
           let totalTips6 = 0n;
           let pageOffset = 0;
           const pageLimit = 100;
           while (true) {
             const [total, , , page] = await indexerAsset.getAssetTransactionsByCurrentPeriodOffsetAndAccountModePaged(
               FIXED_USER_CARD_CONTRACT_ADDRESS, ethers.ZeroAddress, PERIOD_DAY, 0, pageOffset, pageLimit,
               TX_MERCHANT_PAY_TIP_UPDATED, ACCOUNT_MODE_ALL, CHAIN_ID_FILTER_ALL
             ) as [bigint, bigint, bigint, Array<{ finalRequestAmountUSDC6: bigint }>];
             for (const tx of page ?? []) totalTips6 += tx.finalRequestAmountUSDC6;
             if (!page || page.length < pageLimit || pageOffset + page.length >= Number(total)) break;
             pageOffset += page.length;
           }
           const nextTips = amountE6ToDisplayNumber(totalTips6);
           if (!feederCancelledRef.current) {
             setAdminTipsToday(nextTips);
             saveTrustedCache(adminTipsTodayCacheKey, nextTips);
           }
         } catch {
           if (!feederCancelledRef.current && cachedTips !== null) setAdminTipsToday(cachedTips);
         }
       } else if (!effectiveAdmin || !ethers.isAddress(effectiveAdmin)) {
         setAdminTipsToday(null);
       }
     };

     try {
       const feederPromise = feederWork();
       globalFetchQueue = globalFetchQueue.then(() => feederPromise).then((): void => undefined, (): void => undefined);
       await feederPromise;
     } catch {
       /* keep trusted cache on failure */
     } finally {
       feederInProgressRef.current = false;
     }
   };

   void runFeeder();
   const id = setInterval(runFeeder, FEEDER_INTERVAL_MS);
   return () => {
     feederCancelledRef.current = true;
     clearInterval(id);
   };
 }, [
   activeTab,
   feederEoa,
   overviewRefreshTrigger,
   effectiveAdminAddress,
   fixedCardAdmins,
   currentEoa,
   grossSalesCacheKey,
   cumulativeMintCacheKey,
   adminStatsTodayCacheKey,
   adminTipsTodayCacheKey,
   fixedCardMetadataCacheKey,
   fixedCardMetadata?.cardOwner,
   profiles?.[0]?.keyID,
   profiles?.[0]?.aaAccount,
   myAddress,
 ]);

 // Fetch BeamioIndexerDiamond transactions: admin UI shows only this admin's accounting (account-based, excludes subordinates).
 useEffect(() => {
   if (!effectiveAdminAddress || !ethers.isAddress(effectiveAdminAddress)) {
     setIndexerTransactions([]);
     return;
   }
   let cancelled = false;
   setIndexerTransactionsLoading(true);
   const userAA = profiles?.[0]?.aaAccount?.trim();
   const userAAAddr = userAA && ethers.isAddress(userAA) ? ethers.getAddress(userAA) : '';
   const txKey = `eoa:${currentEoa}:indexer:tx:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${effectiveAdminAddress.toLowerCase()}${userAAAddr ? `:aa:${userAAAddr.toLowerCase()}` : ''}`;
   void fetchWithCache(txKey, async () => {
     const ACCOUNT_MODE_ALL = 0;
     const indexerAccount = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ACCOUNT_ABI, conetDepinProvider);
     const indexerAsset = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ASSET_STATS_ABI, conetDepinProvider);
     type TxRow = { id: string; txCategory: string; displayJson: string; timestamp: bigint; payer: string; payee: string; finalRequestAmountFiat6: bigint; finalRequestAmountUSDC6: bigint; meta?: { afterNotePayer?: string; afterNotePayee?: string }; exists?: boolean; topAdmin?: string; subordinate?: string };
     const seen = new Set<string>();
     const all: Array<{ id: string; txCategory: string; displayJson: string; timestamp: string; payer: string; payee: string; finalRequestAmountFiat6: string; finalRequestAmountUSDC6: string; meta?: { afterNotePayer?: string; afterNotePayee?: string }; topAdmin?: string; subordinate?: string }> = [];
     const addPage = (page: TxRow[] | undefined) => {
       for (const tx of page ?? []) {
         if (!tx?.exists || !tx?.id) continue;
         const id = String(tx.id);
         if (seen.has(id)) continue;
         seen.add(id);
         const topAdmin = tx.topAdmin && tx.topAdmin !== ethers.ZeroAddress ? tx.topAdmin : undefined;
         const subordinate = tx.subordinate && tx.subordinate !== ethers.ZeroAddress ? tx.subordinate : undefined;
         all.push({ id: String(tx.id), txCategory: String(tx.txCategory), displayJson: tx.displayJson ?? '', timestamp: String(tx.timestamp), payer: tx.payer, payee: tx.payee, finalRequestAmountFiat6: String(tx.finalRequestAmountFiat6 ?? 0n), finalRequestAmountUSDC6: String(tx.finalRequestAmountUSDC6 ?? 0n), meta: tx.meta, topAdmin, subordinate });
       }
     };
     const queryAccount = async (account: string) => {
       for (const periodOffset of [0, 1, 2]) {
         try {
           const [total, , , page] = await indexerAccount.getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged(account, PERIOD_DAY, periodOffset, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL) as [bigint, bigint, bigint, TxRow[]];
           addPage(page);
           if (Number(total) <= 100) return;
         } catch { return; }
       }
     };
     await queryAccount(effectiveAdminAddress);
     if (userAAAddr && userAAAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase()) await queryAccount(userAAAddr);
     const myAddr = (typeof myAddress === 'string' && ethers.isAddress(myAddress)) ? ethers.getAddress(myAddress) : '';
     if (myAddr && myAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase() && myAddr.toLowerCase() !== userAAAddr.toLowerCase()) await queryAccount(myAddr);
     const queryAssetByAccount = async (account: string) => {
       for (const periodOffset of [0, 1, 2]) {
         try {
           const [total, , , page] = await indexerAsset.getAssetTransactionsByCurrentPeriodOffsetAndAccountModePaged(FIXED_USER_CARD_CONTRACT_ADDRESS, account, PERIOD_DAY, periodOffset, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL, CHAIN_ID_FILTER_ALL) as [bigint, bigint, bigint, TxRow[]];
           addPage(page);
           if (Number(total) <= 100) return;
         } catch { return; }
       }
     };
    await queryAssetByAccount(effectiveAdminAddress);
    if (userAAAddr && userAAAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase()) await queryAssetByAccount(userAAAddr);
    if (myAddr && myAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase() && myAddr.toLowerCase() !== userAAAddr.toLowerCase()) await queryAssetByAccount(myAddr);
    const queryAssetByTopAdmin = async (topAdmin: string) => {
      for (const periodOffset of [0, 1, 2]) {
        try {
          const [total, , , page] = await indexerAsset.getAssetTransactionsByTopAdminAndCurrentPeriodOffsetAndAccountModePaged(FIXED_USER_CARD_CONTRACT_ADDRESS, topAdmin, PERIOD_DAY, periodOffset, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL, CHAIN_ID_FILTER_ALL) as [bigint, bigint, bigint, TxRow[]];
          addPage(page);
          if (Number(total) <= 100) return;
        } catch { return; }
      }
    };
    const queryAssetBySubordinate = async (subordinate: string) => {
      for (const periodOffset of [0, 1, 2]) {
        try {
          const [total, , , page] = await indexerAsset.getAssetTransactionsBySubordinateAndCurrentPeriodOffsetAndAccountModePaged(FIXED_USER_CARD_CONTRACT_ADDRESS, subordinate, PERIOD_DAY, periodOffset, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL, CHAIN_ID_FILTER_ALL) as [bigint, bigint, bigint, TxRow[]];
          addPage(page);
          if (Number(total) <= 100) return;
        } catch { return; }
      }
    };
    await queryAssetByTopAdmin(effectiveAdminAddress);
    await queryAssetBySubordinate(effectiveAdminAddress);
    if (userAAAddr && userAAAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase()) {
      await queryAssetByTopAdmin(userAAAddr);
      await queryAssetBySubordinate(userAAAddr);
    }
    if (myAddr && myAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase() && myAddr.toLowerCase() !== userAAAddr.toLowerCase()) {
      await queryAssetByTopAdmin(myAddr);
      await queryAssetBySubordinate(myAddr);
    }
    return all.sort((a, b) => Number(BigInt(b.timestamp) - BigInt(a.timestamp))).slice(0, 50);
   }).then((rows) => {
     if (cancelled) return;
     const TX_TOPUP = new Set([
       ethers.keccak256(ethers.toUtf8Bytes('usdcTopupCard')),
       ethers.keccak256(ethers.toUtf8Bytes('newCard')),
       ethers.keccak256(ethers.toUtf8Bytes('upgradeNewCard')),
       ethers.keccak256(ethers.toUtf8Bytes('topupCard')),
       ethers.keccak256(ethers.toUtf8Bytes('redeemNewCard')),
       ethers.keccak256(ethers.toUtf8Bytes('redeemUpgradeNewCard')),
       ethers.keccak256(ethers.toUtf8Bytes('redeemTopupCard')),
     ]);
     const mapped: TxDisplayRow[] = rows.map((tx, idx) => {
       const cat = String(tx.txCategory ?? '');
       const isTip = cat === TX_MERCHANT_PAY_TIP_UPDATED;
       const isTopUp = TX_TOPUP.has(cat as `0x${string}`);
       const type: TxDisplayRow['type'] = isTip ? 'Tip' : isTopUp ? 'In-Store Top-Up' : 'Charge';
       const total6 = Number(tx.finalRequestAmountUSDC6 ?? '0') / 1_000_000;
       const totalFiat = Number(tx.finalRequestAmountFiat6 ?? '0') / 1_000_000;
       const total = total6 > 0 ? total6 : totalFiat;
       let display: { handle?: string; source?: string; title?: string; terminal?: string } = {};
       try {
         if (tx.displayJson) display = JSON.parse(tx.displayJson) as typeof display;
       } catch { /* ignore */ }
       const handle = display.handle?.replace(/^@/, '') ? `@${display.handle!.replace(/^@/, '')}` : null;
       const source: 'APP' | 'NFC' = (display.source ?? '').toLowerCase().includes('nfc') ? 'NFC' : 'APP';
       const terminal = display.terminal ?? (display.handle ? display.handle : '—');
       const d = new Date(Number(tx.timestamp ?? 0) * 1000);
       const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
       const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
       const hashShort = typeof tx.id === 'string' && tx.id.length >= 10 ? `${tx.id.slice(0, 6)}...${tx.id.slice(-4)}` : '—';
       let method = 'USDC';
       let ctreeAmount = 0;
       let usdcAmount = total;
       if (isTopUp) {
         method = 'Issued $CTree';
         ctreeAmount = total;
         usdcAmount = 0;
       } else if (type === 'Charge') {
         method = total > 0 ? '$CTree or USDC' : 'USDC';
         ctreeAmount = 0;
         usdcAmount = total;
       } else if (isTip) {
         method = 'Tip';
         ctreeAmount = 0;
         usdcAmount = total;
       }
       return {
         id: `TX-${1000 + rows.length - idx}`,
         dateStr,
         time,
         type,
         subtotal: isTip ? 0 : total,
         tip: isTip ? total : 0,
         total,
         method,
         ctreeAmount,
         usdcAmount,
         source,
         beamioTag: handle,
         status: 'Settled',
         hash: hashShort,
         terminal: typeof terminal === 'string' ? terminal : '—',
         topAdmin: tx.topAdmin && tx.topAdmin !== ethers.ZeroAddress ? tx.topAdmin : undefined,
         subordinate: tx.subordinate && tx.subordinate !== ethers.ZeroAddress ? tx.subordinate : undefined,
       };
     });
     setIndexerTransactions(mapped);
   }).catch(() => {
     if (!cancelled) setIndexerTransactions([]);
   }).finally(() => {
     if (!cancelled) setIndexerTransactionsLoading(false);
   });
   return () => { cancelled = true; };
 }, [effectiveAdminAddress, profiles?.[0]?.aaAccount, myAddress, currentEoa, overviewRefreshTrigger]);

 const isFixedUserCardAdmin = fixedCardAdmins.some((address) => normalizedAdminCandidates.includes(address.toLowerCase()));
 /** Chain-verified admin for UI: only true when chain confirms; avoids persisted-session/cache showing admin to non-admin on production */
 const isAdminForUI = isCurrentUserCardAdmin === true;
 const hasLinkedMerchant = linkedMerchantAdmins.length > 0;
 /** When user is admin (incl. owner), always show panels. linkedMerchantAdmins excludes owner, so owner-only would wrongly hide. */
 const hideTransactionsPanel = linkedMerchantLookupDone && !hasLinkedMerchant && !isAdminForUI;
 const showFixedCardMetadata = activeTab === 'Overview' && isAdminForUI;
 const showOverviewSummary = isAdminForUI;

 const handleOverviewRefresh = useCallback(() => {
   invalidateFetchCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`);
   invalidateFetchCache('indexer:tips');
   invalidateFetchCache('indexer:tx');
   invalidateFetchCache('eoa:');
   invalidateFetchCache('aa:');
   try {
     [grossSalesCacheKey, cumulativeMintCacheKey, adminStatsTodayCacheKey, adminTipsTodayCacheKey].forEach((k) =>
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${k}`)
     );
     const adminSummaryPrefix = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:`;
     Object.keys(window.localStorage)
       .filter((k) =>
         k.startsWith(`${BIZ_CACHE_PREFIX}${adminSummaryPrefix}`) ||
         (k.startsWith(`${BIZ_CACHE_PREFIX}card:`) && (k.includes('quota-and-mint-counter') || k.includes('mint-limit-quota'))) ||
         (k.startsWith(BIZ_CACHE_PREFIX) && (k.includes('buint:balance') || k.includes('buint:consumption')))
       )
       .forEach((k) => window.localStorage.removeItem(k));
   } catch { /* ignore */ }
   setOverviewRefreshing(true);
   setOverviewRefreshTrigger((t) => t + 1);
   setTimeout(() => setOverviewRefreshing(false), 2500);
 }, [currentEoa, grossSalesCacheKey, cumulativeMintCacheKey, adminStatsTodayCacheKey, adminTipsTodayCacheKey]);

 useEffect(() => {
   if (hideTransactionsPanel && activeTab === 'Transactions') {
     setActiveTab('Overview');
   }
 }, [activeTab, hideTransactionsPanel]);


 // --- Financial Data: always use real data; show 0 when not available (no AA / not admin) ---
 // Panel 1: cumulativeTransferAmount (all-time gross sales)
 const totalSales = grossSalesTotal ?? 0;
 const totalTips = adminTipsToday ?? 0;
 // Panel 3: cumulativeMint (all-time in-store top-ups issued)
 const topUpsIssued = cumulativeMintTotal ?? 0;
const topUpsQuota = adminMintLimitQuota ?? 0; // denominator: mint limit from chain
const topUpsUsedFromClear = adminMintCounterFromClear ?? 0; // numerator: mintCounterFromClear from chain

const protocolFuelReserve = protocolFuelReserveBalance ?? 0; // B-Units from CoNET BUint.balanceOf
const protocolFuelConsumptionTodayVal = protocolFuelConsumptionToday ?? 0; // Today's consumption from indexer

 // Chain gives totals; show in $CTree capsule. When not admin / no data, show 0.
 const salesCTree = totalSales;
 const salesUSDC = 0;
 const tipsCTree = totalTips;
 const tipsUSDC = 0;


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
    
     {isMobileMenuOpen && (
       <div
         className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
         onClick={() => setIsMobileMenuOpen(false)}
         aria-hidden="true"
       />
     )}

     {/* --- Sidebar --- */}
     <aside
       className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out
         ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'}
         lg:relative lg:translate-x-0 ${isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72'}`}
     >
       <div className={`p-6 pb-6 ${isSidebarCollapsed ? 'lg:flex lg:justify-center' : ''}`}>
         <div className={`flex items-center justify-between mb-6 ${isSidebarCollapsed && !isMobileMenuOpen ? 'lg:justify-center' : ''}`}>
           <div
             className="flex items-center gap-4 cursor-pointer group"
             onClick={() => window.innerWidth >= 1024 && setIsSidebarCollapsed(!isSidebarCollapsed)}
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
           <button
             type="button"
             onClick={() => setIsMobileMenuOpen(false)}
             className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
             aria-label="Close menu"
           >
             <X size={20} />
           </button>
         </div>
         {(!isSidebarCollapsed || isMobileMenuOpen) && (
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 overflow-hidden whitespace-nowrap">
              <AddressRow
                label="Smart AA"
                icon={Cpu}
                address={(() => { const a = profiles?.[0]?.aaAccount?.trim(); return a && ethers.isAddress(a) ? fmtAddr(ethers.getAddress(a)) : 'Locked'; })()}
                fullAddress={(() => { const a = profiles?.[0]?.aaAccount?.trim(); return a && ethers.isAddress(a) ? ethers.getAddress(a) : ''; })()}
                onRefresh={(() => { 
					const a = profiles?.[0]?.aaAccount?.trim(); 
					return !(a && ethers.isAddress(a)) ? handleRefreshAA : undefined; 
				})()}
                refreshStatus={(() => { const a = profiles?.[0]?.aaAccount?.trim(); return !(a && ethers.isAddress(a)) ? aaRefreshStatus : 'idle'; })()}
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
         {(!isSidebarCollapsed || isMobileMenuOpen) && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-2 whitespace-nowrap">Store Management</p>}
         <NavItem icon={LayoutDashboard} label="Daily Dashboard" isActive={activeTab === 'Overview'} onClick={() => handleTabChange('Overview')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         {!hideTransactionsPanel && (
           <NavItem icon={Receipt} label="Transactions" isActive={activeTab === 'Transactions'} onClick={() => handleTabChange('Transactions')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         )}
         <NavItem icon={Wallet} label="Store Wallets" isActive={activeTab === 'Wallets'} onClick={() => handleTabChange('Wallets')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         <NavItem icon={Store} label="Market" isActive={activeTab === 'Market'} onClick={() => handleTabChange('Market')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         <NavItem icon={MessageSquare} label="Messages" isActive={activeTab === 'Messages'} onClick={() => handleTabChange('Messages')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         <NavItem icon={Hexagon} label="Partner Alliances" isActive={activeTab === 'Alliances'} onClick={() => handleTabChange('Alliances')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
        
         <div className={(isSidebarCollapsed && !isMobileMenuOpen) ? 'mt-6' : 'mt-8'}></div>
         {(!isSidebarCollapsed || isMobileMenuOpen) && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 whitespace-nowrap">Configuration</p>}
         <NavItem icon={Users} label="Staff Terminals" isActive={activeTab === 'Staff'} onClick={() => handleTabChange('Staff')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         <NavItem icon={Settings} label="Store Settings" isActive={activeTab === 'Settings'} onClick={() => handleTabChange('Settings')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
       </nav>


       <div className="p-6">
         <button
           onClick={() => { window.location.href = '/' }}
           className={`w-full flex items-center ${(isSidebarCollapsed && !isMobileMenuOpen) ? 'justify-center px-0' : 'justify-center gap-2 px-4'} py-3 rounded-2xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors font-semibold text-[15px]`}
           title="Lock Wallet"
         >
           <LogOut size={18} className="shrink-0" />
           {!isSidebarCollapsed && <span className="whitespace-nowrap">Lock Wallet</span>}
         </button>
       </div>
     </aside>


     {/* --- Main Content Area --- */}
     <main className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 ease-in-out min-w-0">
       <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-10 sticky top-0 z-10 shrink-0 gap-4">
         <div className="flex items-center gap-3 min-w-0">
           <button
             type="button"
             onClick={() => setIsMobileMenuOpen(true)}
             className="lg:hidden p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
             aria-label="Open menu"
           >
             <Menu size={22} />
           </button>
           <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight truncate">{activeTab}</h2>
         </div>
         <div className="flex items-center gap-4 sm:gap-6">
           {/* ORACLE LIVE FEED SIMULATOR */}
           <div className="hidden lg:flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">
             <RefreshCw size={12} className="text-[#1562f0] animate-[spin_4s_linear_infinite]" />
             <span className="text-[11px] font-bold text-slate-500 tracking-wider">ORACLE: 1 CAD ≈ {(oracleCadUsdc ?? ORACLE_CAD_USDC_FALLBACK).toFixed(2)} USDC</span>
           </div>
           {/* GLOBAL TIME FILTER SELECTION */}
           <div className="hidden sm:flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-xl px-2 py-1.5 shadow-sm">
             <CalendarDays size={14} className="text-slate-400 ml-1" />
             <select
               value={timeFilter}
               onChange={(e) => setTimeFilter(e.target.value)}
               className="bg-transparent text-[14px] font-medium text-slate-700 focus:outline-none cursor-pointer appearance-none pl-1 pr-6"
               style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1em 1em' }}
             >
               <option value="Today">Today, {dateString}</option>
               <option value="This Week">This Week</option>
               <option value="This Month">This Month</option>
               <option value="This Quarter">This Quarter</option>
               <option value="This Year">This Year</option>
             </select>
           </div>
           {activeTab === 'Overview' && isAdminForUI && (
             <button
               type="button"
               onClick={handleOverviewRefresh}
               disabled={overviewRefreshing}
               className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
               title="Refresh panel data"
             >
               <RefreshCw size={20} className={overviewRefreshing ? 'animate-spin' : ''} />
             </button>
           )}
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


       <div className="flex-1 min-h-0 relative overflow-y-auto p-4 sm:p-10">
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
          {/* When no AA account: show Welcome panel */}
          {!profiles?.[0]?.aaAccount?.trim() && (
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
                      onClick={() => setActiveTab('Market')}
                      className="bg-white text-[#1562f0] px-6 py-3 rounded-[14px] font-semibold text-[14px] hover:bg-slate-50 transition-colors shadow-sm border border-[#1562f0]/20"
                    >
                      Buy Fuel Pack
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('Alliances')}
                      className="bg-[#1562f0] border border-white/30 text-white px-6 py-3 rounded-[14px] font-semibold text-[14px] hover:bg-white/10 transition-colors shadow-sm"
                    >
                      Join Alliance
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Always show metrics panels */}
          <div className="space-y-8">
             {/* Row 1: Panels 1-4, 2 per row */}
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {/* Panel 1: Total Gross Sales */}
               <div className="bg-white rounded-[48px] p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} className="text-slate-700" />
                     </div>
                     <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[12px] font-medium">Today</span>
                   </div>
                   <p className="text-[13px] text-slate-500 mb-1">Total Gross Sales (CAD Base)</p>
                   <p className="text-[40px] font-semibold text-black tracking-tighter leading-none">${totalSales.toFixed(2)}</p>
                 </div>
                 <div className="mt-4 flex flex-wrap gap-3">
                   <div className="bg-blue-50/50 px-3 py-2 rounded-2xl flex flex-col gap-0.5 shrink-0 min-w-[140px]">
                     <div className="flex items-center gap-1">
                       <img src={USDC_ICON_URL} alt="USDC" className="w-[10px] h-[10px] rounded-full shrink-0 object-cover" />
                       <span className="text-[11px] font-semibold text-blue-600">USDC Payments</span>
                     </div>
                     <span className="text-[16px] font-bold text-blue-600">${salesUSDC.toFixed(2)}</span>
                     <span className="text-[10px] text-slate-500">≈ ${(salesUSDC * 1.35).toFixed(2)} CAD</span>
                   </div>
                   {isAdminForUI && (
                   <div className="bg-emerald-50/50 px-3 py-2 rounded-2xl flex flex-col gap-0.5 shrink-0 min-w-[140px]">
                     <div className="flex items-center gap-1">
					 <Ticket size={12} className="text-emerald-600" />
                       <span className="text-[11px] font-semibold text-emerald-600">$CTree</span>
                     </div>
                     <span className="text-[16px] font-bold text-black">${salesCTree.toFixed(2)}</span>
                     <span className="text-[10px] text-slate-500">≈ ${salesCTree.toFixed(2)} CAD</span>
                   </div>
                   )}
                 </div>
               </div>

               {/* Panel 2: Tips Collected */}
               <div className="bg-white rounded-[48px] p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                        <Heart size={24} className="text-rose-500 fill-rose-100" />
                     </div>
                   </div>
                   <p className="text-[13px] text-slate-500 mb-1">Tips Collected (CAD Base)</p>
                   <p className="text-[40px] font-semibold text-black tracking-tighter leading-none">${totalTips.toFixed(2)}</p>
                 </div>
                 <div className="mt-4 flex flex-wrap gap-3">
                   <div className="bg-blue-50/50 px-3 py-2 rounded-2xl flex flex-col gap-0.5 shrink-0 min-w-[140px]">
                     <div className="flex items-center gap-1">
                       <img src={USDC_ICON_URL} alt="USDC" className="w-[10px] h-[10px] rounded-full shrink-0 object-cover" />
                       <span className="text-[11px] font-semibold text-blue-600">USDC Payments</span>
                     </div>
                     <span className="text-[16px] font-bold text-blue-600">${tipsUSDC.toFixed(2)}</span>
                     <span className="text-[10px] text-slate-500">≈ ${(tipsUSDC * 1.35).toFixed(2)} CAD</span>
                   </div>
                   {isAdminForUI && (
                   <div className="bg-emerald-50/50 px-3 py-2 rounded-2xl flex flex-col gap-0.5 shrink-0 min-w-[140px]">
                     <div className="flex items-center gap-1">
                       <Ticket size={12} className="text-emerald-600" />
                       <span className="text-[11px] font-semibold text-emerald-600">$CTree</span>
                     </div>
                     <span className="text-[16px] font-bold text-black">${tipsCTree.toFixed(2)}</span>
                     <span className="text-[10px] text-slate-500">≈ ${tipsCTree.toFixed(2)} CAD</span>
                   </div>
                   )}
                 </div>
               </div>

               {/* Panel 3: In-Store Top-Ups */}
               <div className="bg-white rounded-[48px] p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                        <ArrowUpFromLine size={24} className="text-emerald-600" />
                     </div>
                   </div>
                   <p className="text-[13px] text-slate-500 mb-1">In-Store Top-Ups</p>
                   <p className="text-[40px] font-semibold text-black tracking-tighter leading-none">${topUpsIssued.toFixed(2)}</p>
                 </div>
                 <div className="mt-6 pt-6 border-t border-slate-100">
                   {isAdminForUI ? (
                     effectiveAdminAddress ? (
                       <div className="bg-rose-50 px-4 py-3 rounded-2xl flex items-center justify-between">
                         <div className="flex flex-col gap-0.5">
                           <span className="text-[12px] font-semibold text-slate-700">Issued $CTree</span>
                           <span className="text-[12px] font-medium text-rose-600">
                             Quota: ${(topUpsUsedFromClear / 1000).toFixed(1)}k / {topUpsQuota >= 1e15 ? 'Unlimited' : `$${(topUpsQuota / 1000).toFixed(0)}k`}
                           </span>
                         </div>
                         <span className="text-[18px] font-bold text-rose-600">${topUpsUsedFromClear.toFixed(2)}</span>
                       </div>
                     ) : (
                       <p className="text-[12px] text-slate-500 text-center font-medium">—</p>
                     )
                   ) : (
                     <p className="text-[12px] text-slate-400 text-center">No active issuing networks.</p>
                   )}
                 </div>
               </div>

               {/* Panel 4: Protocol Fuel Reserve */}
               <div className="bg-gradient-to-br from-zinc-900 to-black rounded-[48px] p-10 shadow-xl border border-white/10 flex flex-col justify-between text-white">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/30">
                        <Fuel size={24} className="text-amber-500" />
                     </div>
                     <span className="bg-transparent border border-amber-500/50 text-amber-500 px-2.5 py-1 rounded-full text-[12px] font-medium flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> ACTIVE
                     </span>
                   </div>
                   <p className="text-[13px] text-slate-400 mb-1">Protocol Fuel Reserve</p>
                   <p className="text-[40px] font-bold text-white tracking-tighter leading-none">{protocolFuelReserve.toLocaleString()}</p>
                 </div>
                 <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                   <p className="text-[13px] text-slate-400">Today&apos;s Consumption</p>
                   <p className="text-[16px] font-semibold text-amber-500">{protocolFuelConsumptionTodayVal >= 0 ? '' : '-'}{Math.abs(protocolFuelConsumptionTodayVal).toLocaleString()} Units</p>
                 </div>
                 <button
                   type="button"
                   onClick={() => { setActiveTab('Market'); setSelectedProduct('fuel'); }}
                   className="mt-6 w-full bg-transparent border-2 border-amber-500 text-amber-500 py-4 rounded-[16px] font-bold text-[15px] hover:bg-amber-500/10 transition-colors"
                 >
                   Top Up Fuel
                 </button>
               </div>
             </div>

             {/* Row 2: Panels 5-6, 2 per row — only when user has AA */}
             {profiles?.[0]?.aaAccount && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {/* Panel 5: Direct Crypto Revenue */}
               <div className="bg-white rounded-[48px] p-10 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <UsdcBaseCompositeIcon size={32} badgeSize={20} />
                     </div>
                     <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-[12px] font-medium">Self-Custody</span>
                   </div>
                   <p className="text-[13px] text-slate-500 mb-1">Direct Crypto Revenue</p>
                   <div className="flex items-baseline gap-2 mb-4">
                     <p className="text-[40px] font-semibold text-black tracking-tighter leading-none">${totalUSDCBalance.toFixed(2)}</p>
                     <span className="text-[14px] font-medium text-slate-500 uppercase">USDC</span>
                   </div>
                   <p className="text-[13px] font-medium text-slate-500 leading-relaxed max-w-sm">
                     Direct payments routed to your AA wallet. CashTrees does not settle this balance.
                   </p>
                 </div>
                 <button
                   type="button"
                   className="w-full bg-slate-50 text-slate-700 py-4 rounded-[16px] font-semibold text-[15px] hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all flex items-center justify-center gap-2"
                 >
                   Off-ramp via Coinbase <ExternalLink size={18} />
                 </button>
               </div>

               {/* Panel 6: CashTrees Settlement */}
               <div className="bg-slate-900 rounded-[48px] p-10 shadow-xl border border-slate-800 flex flex-col justify-between text-white relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-[#1562f0]/20 rounded-full blur-[80px] -mr-10 -mt-10 pointer-events-none" />
                 <div className="relative z-10">
                   <div className="flex justify-between items-start mb-6">
                     <p className="text-[14px] font-semibold text-[#1562f0] flex items-center gap-2">
                       <Ticket size={18} /> CashTrees Settlement
                     </p>
                     <span className="bg-white/10 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[12px] font-medium border border-white/5">Net Balance</span>
                   </div>
                   <div className="flex items-baseline gap-2 mb-6">
                     <p className="text-5xl sm:text-[56px] font-light tracking-tight leading-none">${netSettlementBalance.toFixed(2)}</p>
                     <span className="text-xl sm:text-2xl text-slate-400 font-light">CAD</span>
                   </div>
                   <div className="flex items-center gap-3 text-[14px] font-medium text-slate-400 bg-black/20 p-4 rounded-[20px] w-max backdrop-blur-sm border border-white/5">
                     <span className="text-white">+${totalCTreeReceived.toFixed(2)} Recv</span>
                     <span className="text-slate-600">|</span>
                     <span className="text-rose-400">-${topUpsIssued.toFixed(2)} Issued</span>
                   </div>
                 </div>
                 <button
                   type="button"
                   onClick={() => setIsPayoutModalOpen(true)}
                   className="relative z-10 w-full bg-[#1562f0] text-white py-4 rounded-[20px] font-semibold text-[17px] hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(21,98,240,0.3)] active:scale-[0.98] mt-6"
                 >
                   <Landmark size={20} /> Request CAD Settlement
                 </button>
               </div>
             </div>
             )}
           </div>
          </div>
        )}


        {activeTab === 'Transactions' && !hideTransactionsPanel && (() => {
           const txList = indexerTransactions;
           const filteredTx = txList.filter((tx) => {
             if (activeLedger === 'AA' && !profiles?.[0]?.aaAccount) return false;
             const isVaultTx = tx.terminal?.toLowerCase().includes('vault') || tx.terminal === 'The Vault';
             const matchLedger = activeLedger === 'All' || (activeLedger === 'EOA' && isVaultTx) || (activeLedger === 'AA' && !isVaultTx);
             const matchSearch = !txSearchTerm.trim() || tx.id.toLowerCase().includes(txSearchTerm.toLowerCase()) || tx.hash.toLowerCase().includes(txSearchTerm.toLowerCase()) || (tx.beamioTag && tx.beamioTag.toLowerCase().includes(txSearchTerm.toLowerCase()));
             const matchType = txFilterType === 'All' || tx.type === txFilterType;
             const matchTerminal = txFilterTerminal === 'All' || tx.terminal === txFilterTerminal || (txFilterTerminal === 'The Vault' && tx.terminal?.toLowerCase().includes('vault'));
             return matchLedger && matchSearch && matchType && matchTerminal;
           });
           const summaryTxCount = isAdminForUI && adminNetworkSummaryToday ? adminNetworkSummaryToday.txCount : 0;
           const summaryTotalCAD = isAdminForUI && adminNetworkSummaryToday ? adminNetworkSummaryToday.cadVol : 0;
           const summaryTotalUSDC = isAdminForUI && adminNetworkSummaryToday ? adminNetworkSummaryToday.usdc : 0;
           const summaryTotalVouchers = isAdminForUI && adminNetworkSummaryToday ? adminNetworkSummaryToday.vouchers : 0;

           return (
           <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300">
              <div className="flex bg-white/60 backdrop-blur-xl p-1.5 rounded-[20px] w-max mb-2 sm:mb-4 border border-slate-200/50 shadow-sm">
                <button type="button" onClick={() => setActiveLedger('All')} className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all ${activeLedger === 'All' ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}>
                  All Ledgers
                </button>
                <button type="button" onClick={() => setActiveLedger('AA')} disabled={!profiles?.[0]?.aaAccount} className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeLedger === 'AA' ? 'bg-white text-[#1562f0] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  <Zap size={16} className={!profiles?.[0]?.aaAccount ? 'opacity-50' : ''} /> Smart Terminal (AA)
                  {!profiles?.[0]?.aaAccount && <Lock size={12} className="ml-1 opacity-50" />}
                </button>
                <button type="button" onClick={() => setActiveLedger('EOA')} className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeLedger === 'EOA' ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Shield size={16} className={activeLedger === 'EOA' ? 'text-emerald-500' : ''} /> The Vault (EOA)
                </button>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input type="text" placeholder="Search receipt, hash..." value={txSearchTerm} onChange={(e) => setTxSearchTerm(e.target.value)} className="pl-12 pr-4 py-3.5 sm:py-3 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-[20px] sm:rounded-2xl w-full sm:w-80 text-[15px] font-medium focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 focus:border-[#1562f0] transition-all shadow-sm" />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                  <select value={txFilterTerminal} onChange={(e) => setTxFilterTerminal(e.target.value)} className="bg-white/80 backdrop-blur-xl border border-slate-200/80 px-4 py-3.5 sm:py-3 rounded-[20px] sm:rounded-2xl text-[14px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 cursor-pointer appearance-none shrink-0">
                    <option value="All">All Terminals</option>
                    {terminals.map((t) => (
                      <option key={t.tag} value={t.tag}>{t.name} ({t.tag})</option>
                    ))}
                    <option value="The Vault">The Vault (EOA)</option>
                  </select>
                  <select value={txFilterType} onChange={(e) => setTxFilterType(e.target.value)} className="bg-white/80 backdrop-blur-xl border border-slate-200/80 px-4 py-3.5 sm:py-3 rounded-[20px] sm:rounded-2xl text-[14px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 cursor-pointer appearance-none shrink-0">
                    <option value="All">All Actions</option>
                    <option value="Charge">Charge</option>
                    <option value="In-Store Top-Up">Top-Up</option>
                    <option value="Tip">Tip</option>
                  </select>
                  <button type="button" className="flex items-center justify-center gap-2 bg-white/80 backdrop-blur-xl border border-slate-200/80 px-5 py-3.5 sm:py-3 rounded-[20px] sm:rounded-2xl text-[14px] font-semibold text-slate-700 shadow-sm shrink-0">
                    <Filter size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl border border-slate-200/50 rounded-[20px] p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <Activity size={14} className="text-[#1562f0]" />
                    {txFilterTerminal === 'All' ? `Network Summary (${timeFilter})` : `${txFilterTerminal} Summary (${timeFilter})`}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-[28px] font-light text-slate-900 tracking-tight">${summaryTotalCAD.toFixed(2)}</span>
                    <span className="text-[14px] font-medium text-slate-500">CAD Vol.</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
                  <div className="bg-white rounded-[14px] px-4 py-2.5 border border-slate-200/60 flex flex-col flex-1 sm:flex-none">
                    <span className="text-[11px] text-slate-400 font-semibold mb-0.5">Transactions</span>
                    <span className="text-[15px] font-bold text-slate-800">{summaryTxCount}</span>
                  </div>
                  <div className="bg-white rounded-[14px] px-4 py-2.5 border border-slate-200/60 flex flex-col flex-1 sm:flex-none">
                    <span className="text-[11px] text-[#1562f0] font-semibold mb-0.5 flex items-center gap-1"><Coins size={10} /> USDC</span>
                    <span className="text-[15px] font-bold text-slate-800">{summaryTotalUSDC.toFixed(2)}</span>
                  </div>
                  <div className="bg-white rounded-[14px] px-4 py-2.5 border border-slate-200/60 flex flex-col flex-1 sm:flex-none">
                    <span className="text-[11px] text-emerald-500 font-semibold mb-0.5 flex items-center gap-1"><Ticket size={10} /> Vouchers</span>
                    <span className="text-[15px] font-bold text-slate-800">{summaryTotalVouchers.toFixed(2)}</span>
                  </div>
                </div>
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
                      {indexerTransactionsLoading ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-16 text-center text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                              Loading transactions...
                            </span>
                          </td>
                        </tr>
                      ) : filteredTx.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-16 text-center text-slate-500">
                            <div className="space-y-2">
                              <Search size={32} className="mx-auto text-slate-300" />
                              <p className="text-[15px] font-medium">{(txSearchTerm || txFilterTerminal !== 'All' || txFilterType !== 'All' || activeLedger !== 'All') ? 'No transactions found for the current filters.' : 'No transactions yet.'}</p>
                              {!txSearchTerm && txFilterTerminal === 'All' && txFilterType === 'All' && activeLedger === 'All' && (
                                <p className="text-[12px] text-slate-400 max-w-md mx-auto">Transactions will appear here when you process Charges at your terminal. Ensure the POS sends payee as your AA address.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                      filteredTx.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                          
                           {/* Column 1: Tx Info */}
                           <td className="px-8 py-6">
                             <div className="flex items-center gap-3 mb-1">
                               {tx.type === 'Charge' ? (
                                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0"><ArrowDownToLine size={14}/></div>
                               ) : tx.type === 'Tip' ? (
                                 <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0"><Heart size={14}/></div>
                               ) : (
                                 <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><ArrowUpFromLine size={14}/></div>
                               )}
                               <div className="font-bold text-[15px] text-black whitespace-nowrap">{tx.type}</div>
                             </div>
                             <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 mt-2 pl-11 whitespace-nowrap flex-wrap">
                               <span>{tx.dateStr || dateString}, {tx.time}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               <span>{tx.id}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               {/* 更新：展示终端来源 */}
                               <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded" title="Processed by terminal">
                                 <MonitorSmartphone size={10}/> {tx.terminal}
                               </span>
                               {/* Top Admin: 展示 admin topup 记账的 topAdmin */}
                               {tx.topAdmin && (
                                 <>
                                   <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                   <span className="flex items-center gap-1 text-slate-600" title="Top Admin (reporting)">
                                     Top Admin:
                                   </span>
                                   <AddressCapsule address={tx.topAdmin} className="bg-slate-100 border-slate-200 text-slate-700" />
                                 </>
                               )}
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
                               {tx.method === 'Tip' ? (
                                 <div className="flex items-center gap-2 text-[13px] font-bold text-rose-600 whitespace-nowrap">
                                   <Heart size={14} className="text-rose-500 shrink-0" /> Tip: ${tx.usdcAmount.toFixed(2)}
                                 </div>
                               ) : tx.method === 'Mixed' ? (
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
                               ) : tx.method === '$CTree or USDC' ? (
                                 <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                                     <Coins size={14} className="text-blue-500 shrink-0" /> USDC: ${tx.usdcAmount.toFixed(2)}
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
                             <div className={`font-bold text-[18px] whitespace-nowrap ${tx.type.includes('Top-Up') ? 'text-emerald-600' : tx.type === 'Tip' ? 'text-rose-600' : 'text-black'}`}>
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
                      )))}
                   </tbody>
                </table>
              </div>
           </div>
           );
         })()}

         {/* --- STORE WALLETS TAB --- */}
         {activeTab === 'Wallets' && (
           <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Store Wallets</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Manage your Tethered Hybrid Architecture: The Vault (EOA) & Smart Terminal (AA).</p>
             </div>

             <div className="flex flex-col gap-6 lg:gap-8">
                <div className="flex flex-wrap gap-6 lg:gap-8">
                <div className="bg-slate-900 rounded-[32px] p-6 sm:p-8 shadow-2xl text-white relative overflow-hidden flex flex-col justify-between border border-slate-800/50 min-w-[500px] flex-1">
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
                           <p className="text-[48px] sm:text-[56px] font-light tracking-tight leading-none">{eoaUsdcBalance != null ? formatWithThousands(eoaUsdcBalance) : '—'}</p>
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

             {/* Smart Terminal Locked — shown when user has no AA account, to the right of The Vault */}
             {!profiles?.[0]?.aaAccount && (
               <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden min-w-[500px] flex-1">
                 <div className="w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
                   <Lock size={32} className="text-slate-400" />
                 </div>
                 <h3 className="text-[24px] font-bold text-slate-900 mb-3 tracking-tight">Smart Terminal Locked</h3>
                 <p className="text-[15px] font-medium text-slate-500 max-w-md mb-8 leading-relaxed">
                   Your AA wallet is currently inactive to prevent attacks. Unlock zero-gas ecosystem routing by purchasing a Fuel Pack or joining an Alliance.
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

             {/* Smart Terminal (AA) — shown when user has AA account, to the right of The Vault */}
             {profiles?.[0]?.aaAccount && (
               <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between relative overflow-hidden min-w-[500px] flex-1">
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
                   <div className="bg-slate-50/80 rounded-[24px] p-5 sm:p-6 border border-slate-100/50 shrink-0 min-w-[200px] sm:min-w-[240px] w-max">
                     <p className="text-[13px] font-medium text-slate-500 mb-1">Liquid Reserve</p>
                     <div className="flex items-baseline gap-1.5 mb-0.5">
                       <p className="text-3xl sm:text-[32px] font-semibold text-slate-900 tracking-tight">${aaUsdcBalance != null ? (parseFloat(aaUsdcBalance) / (oracleCadUsdc ?? ORACLE_CAD_USDC_FALLBACK)).toFixed(2) : '—'}</p>
                       <span className="text-[14px] text-slate-500 font-medium">CAD</span>
                     </div>
                     <span className="text-[11px] text-[#1562f0] font-medium">{aaUsdcBalance != null ? parseFloat(aaUsdcBalance).toFixed(2) : '—'} USDC</span>
                   </div>
                   {joinedAlliances.map((aId) => {
                     const alliance = alliancesDb[aId];
                     return (
                       <div key={aId} className={`${alliance.themeLightBg} rounded-[24px] p-5 sm:p-6 border border-white/50 shrink-0 min-w-[200px] sm:min-w-[240px] w-max`}>
                         <p className={`text-[13px] font-medium ${alliance.themeText} mb-1 truncate`}>{alliance.id} Vouchers</p>
                         <div className="flex items-baseline gap-1.5 mb-0.5">
                           <p className="text-3xl sm:text-[32px] font-semibold text-slate-900 tracking-tight">{alliance.aaBalance.toFixed(2)}</p>
                           <span className={`text-[14px] ${alliance.themeText} font-medium`}>{alliance.token}</span>
                         </div>
                         <span className={`text-[11px] ${alliance.themeText} opacity-70 font-medium`}>≈ ${alliance.aaBalance.toFixed(2)} CAD</span>
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
                       <p className="text-[18px] font-mono font-semibold text-white tracking-tight">{aaBUnits != null ? aaBUnits.toLocaleString() : '—'} B-Units</p>
                     </div>
                   </div>
                   <button type="button" onClick={() => { setActiveTab('Market'); setSelectedProduct('fuel'); }} className="w-full sm:w-auto text-[14px] font-semibold bg-orange-500 text-white px-5 py-2.5 rounded-[12px] hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 active:scale-[0.98]">
                     Refill
                   </button>
                 </div>
                 <div className="relative flex items-center py-4 mt-6">
                   <div className="flex-grow border-t border-slate-100"></div>
                   <span className="flex-shrink-0 mx-4 text-slate-300">
                     <ArrowRightLeft size={18} className="text-slate-300" />
                   </span>
                   <div className="flex-grow border-t border-slate-100"></div>
                 </div>
                 <button type="button" className="w-full bg-slate-50 text-slate-700 py-4 sm:py-5 rounded-[20px] text-[16px] font-semibold transition-all border border-slate-200 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-2 active:scale-[0.98]">
                   Transfer Funds
                 </button>
               </div>
             )}
                </div>

             {/* Subordinate admin Smart Terminal cards: one full card per subordinate */}
             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
             {terminals.map((term) => {
               const addr = term.id?.toLowerCase();
               const bal = addr ? subordinateBalances[addr] : null;
               return (
                 <div key={term.id} className="bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between relative overflow-hidden">
                   <div className="flex justify-between items-start mb-8">
                     <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center border border-slate-100/80">
                         <Zap size={28} className="text-[#1562f0]" />
                       </div>
                       <div>
                         <h4 className="text-[20px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">Smart Terminal <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">ERC-4337</span></h4>
                         <p className="text-[13px] text-slate-500 font-medium mt-1">{term.name}</p>
                         <div className="mt-1"><AddressCapsule address={term.id} className="bg-slate-100/80 border-slate-200/80 text-slate-700" /></div>
                       </div>
                     </div>
                   </div>
                   <div className="mb-6">
                     <p className="text-[13px] font-medium text-slate-500 mb-2">Liquid Reserve (Base L2)</p>
                     <div className="flex items-baseline gap-2">
                       <p className="text-[40px] sm:text-[48px] font-light tracking-tight leading-none">{bal != null ? formatWithThousands(bal) : '—'}</p>
                       <span className="text-xl text-slate-500 font-light">USDC</span>
                     </div>
                   </div>
                   <div className="bg-slate-900 rounded-[24px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800 shadow-inner">
                     <div className="flex items-center gap-4 text-white">
                       <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                         <Fuel size={20} className="text-orange-500" />
                       </div>
                       <div>
                         <p className="text-[12px] font-medium text-slate-400 mb-0.5">Protocol Fuel</p>
                         <p className="text-[18px] font-mono font-semibold text-white tracking-tight">—</p>
                       </div>
                     </div>
                   </div>
                   <div className="mt-6">
                     <button className="w-full bg-slate-50 text-slate-700 py-4 sm:py-5 rounded-[20px] text-[16px] font-semibold transition-all border border-slate-200 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-2 active:scale-[0.98]">
                       Transfer Funds
                     </button>
                   </div>
                 </div>
               );
             })}
             </div>

             {isAdminForUI && joinedAlliances.length === 0 && (
               <div className="pt-8 mt-8 border-t border-slate-200/60">
                 <div
                   onClick={() => setActiveTab('Alliances')}
                   className="bg-white rounded-[32px] border border-slate-200 border-dashed p-8 cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-4 group"
                 >
                   <div className="w-14 h-14 rounded-2xl bg-[#1562f0]/10 flex items-center justify-center shrink-0 group-hover:bg-[#1562f0]/15 transition-colors">
                     <Hexagon size={24} className="text-[#1562f0]" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <h4 className="text-[18px] font-semibold text-slate-900">Partner Alliances</h4>
                     <p className="text-[14px] text-slate-500 mt-1">Manage your Merchant License NFTs and join new alliances.</p>
                   </div>
                   <ChevronRight size={20} className="text-slate-400 shrink-0" />
                 </div>
               </div>
             )}

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
           </div>
         )}

         {/* --- MARKET TAB --- */}
         {activeTab === 'Market' && (
           <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Market</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Acquire physical infrastructure and protocol fuel for your node.</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Starter Fuel Pack */}
                
                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80 flex flex-col h-full">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5 flex-grow">
                    <div>
                      <div className="flex justify-between items-center mb-10">
                        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Starter</span>
                        <span className="text-[13px] font-mono font-medium text-slate-400">Unlimited</span>
                      </div>
                      <div className="flex justify-center mb-10 relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="w-28 h-28 bg-[#1a1c23] border border-emerald-500/30 rounded-[28px] flex flex-col items-center justify-center gap-2 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative z-10">
                          <Zap size={36} className="text-emerald-500" strokeWidth={1.5} />
                          <div className="text-center">
                            <div className="text-[18px] font-bold text-emerald-500 leading-none">100</div>
                            <div className="text-[9px] font-bold text-emerald-500/70 tracking-widest uppercase mt-1">B-Units</div>
                          </div>
                        </div>
                      </div>
                      <h4 className="text-[28px] font-semibold text-white tracking-tight leading-tight">Starter Fuel Pack</h4>
                      <p className="text-[14px] font-medium text-emerald-500/80 mt-2 uppercase tracking-widest">AA Account Activation</p>
                    </div>
                    <div className="mt-10 flex items-center justify-between bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pricing</p>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white">$1</p>
                          <span className="text-[13px] font-medium text-slate-500">USDC</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedProduct('starter')} className="bg-emerald-500 text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95">
                        View
                      </button>
                    </div>
                  </div>
                </div>
                

                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80 flex flex-col h-full">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5 flex-grow">
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

                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80 flex flex-col h-full">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-[#1562f0]/15 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5 flex-grow">
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

             {!isAdminForUI && (
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

             {isAdminForUI && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {(Object.keys(alliancesDb) as AllianceId[]).map((aId) => {
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
             )}
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
           <div className="max-w-[1400px] mx-auto animate-in fade-in duration-300 relative">
             {!isAdminForUI && (
               <div className="flex flex-col items-start justify-center min-h-[400px] py-12">
                 <div className="w-full max-w-[400px] bg-white rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-100 flex flex-col items-center text-center p-10">
                   <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-6 shadow-sm">
                     <Lock size={28} className="text-slate-400" />
                   </div>
                   <h3 className="text-[22px] font-bold text-slate-900 mb-3 tracking-tight">Smart Terminal Locked</h3>
                   <p className="text-[14px] font-medium text-slate-500 max-w-[360px] leading-relaxed mb-8">
                     Staff terminals operate on zero-gas AA routing. Unlock your Smart Terminal by purchasing a Fuel Pack or joining an Alliance before linking devices.
                   </p>
                   <div className="flex flex-wrap justify-center gap-3">
                     <button onClick={() => setActiveTab('Market')} className="bg-orange-500 text-white px-6 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-orange-400 transition-colors shadow-md flex items-center gap-2">
                       <Fuel size={18} /> Buy Fuel
                     </button>
                     <button onClick={() => setActiveTab('Alliances')} className="bg-[#1562f0] text-white px-6 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-blue-600 transition-colors shadow-md flex items-center gap-2">
                       <Hexagon size={18} /> Join Alliance
                     </button>
                   </div>
                 </div>
               </div>
             )}

             {isAdminForUI && (
           <div className="space-y-6">
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
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Transfer Amount</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Remaining</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Mint Counter</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {terminalsLoading ? (
                        <tr>
                          <td colSpan={7} className="px-8 py-16 text-center text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                              Loading terminals...
                            </span>
                          </td>
                        </tr>
                      ) : terminals.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-8 py-16 text-center text-slate-500">
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
                             <AddressCapsule address={term.id} className="bg-slate-100 border-slate-200 text-slate-700" />
                           </td>
                           <td className="px-6 py-6 text-right">
                             <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-[12px] font-semibold">
                               {terminalStats[term.id.toLowerCase()] != null
                                 ? `$${terminalStats[term.id.toLowerCase()]!.transferAmountFromClear.toFixed(2)}`
                                 : '—'}
                             </span>
                           </td>
                           <td className="px-6 py-6 text-right">
                             <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-[12px] font-semibold">
                               {terminalStats[term.id.toLowerCase()] != null
                                 ? terminalStats[term.id.toLowerCase()]!.remainingAvailable >= Number.MAX_SAFE_INTEGER
                                   ? '∞'
                                   : terminalStats[term.id.toLowerCase()]!.remainingAvailable.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                 : '—'}
                             </span>
                           </td>
                           <td className="px-6 py-6 text-right">
                             <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-[12px] font-semibold">
                               {terminalStats[term.id.toLowerCase()] != null
                                 ? terminalStats[term.id.toLowerCase()]!.mintCounterFromClear.toFixed(2)
                                 : '—'}
                             </span>
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
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={closeAddTerminalModal}></div>
         <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 text-[#1562f0] rounded-2xl flex items-center justify-center">
                     <LinkIcon size={24} />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-black">Link New Terminal</h2>
               </div>
               <button onClick={closeAddTerminalModal} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-black transition-colors">
                 <X size={20} />
               </button>
            </div>


            <div className="space-y-5 mb-8">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <p className="text-[13px] font-medium text-slate-600 leading-snug">
                  Install the POS App on the new device. Retrieve its generated BeamioTag and public EOA address to authorize it for this store.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2">Device Name</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="e.g. POS Terminal 1"
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-semibold text-[15px] text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2">Top-Up Limit (CAD)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newTerminalMintLimit}
                  onChange={(e) => setNewTerminalMintLimit(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-semibold text-[15px] text-slate-900"
                />
                <p className="text-[11px] text-slate-500 mt-1 ml-1">Max in-store top-up amount this terminal can process per transaction.</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2">Terminal Beamio Tag / EOA Address</label>
                {deviceHandleResolved && deviceHandleResolved.address ? (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <img src={deviceHandleResolved.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${deviceHandleResolved.username}`} alt="" className="w-8 h-8 rounded-full border border-emerald-200 object-cover" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono font-bold text-emerald-700">@{deviceHandleResolved.username}</span>
                      <span className="text-[10px] text-slate-500 font-mono" title={deviceHandleResolved.address}>{fmtAddr(deviceHandleResolved.address)}</span>
                    </div>
                    <button type="button" onClick={() => { setDeviceHandleResolved(null); setNewTerminalTag(''); setDeviceHandleError(null); }} className="ml-auto p-1 rounded-lg hover:bg-emerald-100 text-emerald-600" aria-label="Clear"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    {!newTerminalTag.startsWith('0x') && (
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                    )}
                    <input
                      type="text"
                      value={newTerminalTag}
                      onChange={(e) => {
                        setNewTerminalTag(e.target.value);
                        setDeviceHandleResolved(null);
                        setDeviceHandleError(null);
                        setLinkTerminalError(null);
                      }}
                      onBlur={() => {
                        deviceValidateAbortRef.current = false;
                        validateDeviceHandle(newTerminalTag);
                      }}
                      onFocus={() => { deviceValidateAbortRef.current = true; }}
                      onKeyDown={(e) => e.key === 'Enter' && validateDeviceHandle(newTerminalTag)}
                      placeholder="@handle or 0x..."
                      className={`w-full pr-14 py-3.5 bg-white border rounded-2xl focus:outline-none focus:ring-2 font-semibold text-[15px] text-slate-900 font-mono placeholder:text-slate-400 ${newTerminalTag.startsWith('0x') ? 'pl-4' : 'pl-9'} ${deviceHandleError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 focus:border-[#1562f0] focus:ring-[#1562f0]/20'}`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {deviceHandleChecking ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <>
                          {deviceHandleError && <span className="text-rose-500 text-xs font-medium">{deviceHandleError}</span>}
                          <button
                            type="button"
                            onClick={() => validateDeviceHandle(newTerminalTag)}
                            className="p-2 rounded-lg hover:bg-slate-200/80 text-slate-500 hover:text-slate-700 transition-colors"
                            title="Search"
                            aria-label="Search handle"
                          >
                            <Search className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {linkTerminalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[13px] font-medium text-rose-700">
                  {linkTerminalError}
                </div>
              )}

            </div>


            <button
              onClick={async () => {
                const pos = deviceHandleResolved?.address;
                const raw = ((newTerminalTag ?? '') as string).trim();
                if (!pos && !raw) return;
                setLinkTerminalError(null);
                setLinkTerminalLoading(true);
                try {
                  const pk = profiles?.[0]?.privateKeyArmor;
                  if (!pk) {
                    throw new Error('Wallet not connected. Connect with card owner or admin to register device.');
                  }
                  const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
                  if (!userEOA || !ethers.isAddress(userEOA)) {
                    throw new Error('Wallet address not available.');
                  }
                  let adminEOA: string;
                  if (pos && ethers.isAddress(pos)) {
                    adminEOA = ethers.getAddress(pos);
                  } else if (ethers.isAddress(raw)) {
                    adminEOA = ethers.getAddress(raw);
                  } else {
                    const tagRaw = raw as string;
                    const tag = tagRaw.startsWith('@') ? tagRaw.slice(1) : tagRaw;
                    const res = await searchUsername(tag);
                    const peer = res?.results?.[0];
                    if (!peer?.address || !ethers.isAddress(peer.address)) {
                      throw new Error(`Could not resolve @${tag} to an address. Check the Beamio Tag.`);
                    }
                    adminEOA = ethers.getAddress(peer.address);
                  }
                  const cardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS;
                  const metadata = JSON.stringify({
                    deviceName: newDeviceName.trim() || (deviceHandleResolved?.username ? `@${deviceHandleResolved.username}` : 'POS Terminal'),
                    handle: deviceHandleResolved?.username ? `@${deviceHandleResolved.username}` : '',
                  });
                  const limitNum = Math.max(1, parseFloat(String(newTerminalMintLimit).replace(/[^0-9.]/g, '')) || 1000);
                  const mintLimitPoints6 = BigInt(Math.round(limitNum * 1_000_000));
                  const data = encodeAddAdminWithMintLimit(adminEOA, 1, metadata, mintLimitPoints6);
                  const now = Math.floor(Date.now() / 1000);
                  const deadline = now + 300;
                  const nonce = ethers.hexlify(ethers.randomBytes(32));
                  const card = new ethers.Contract(cardAddress, USER_CARD_ADMIN_READ_ABI, baseEndpoint);
                  const cardOwner = (await card.owner()) as string;
                  const userAA = profiles?.[0]?.aaAccount?.trim();
                  const isOwner =
                    (cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userEOA)) ||
                    (userAA && cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userAA));
                  const isAdminUser = await isCardAdmin(cardAddress, userEOA);
                  if (!isAdminUser && !isOwner) {
                    throw new Error('Wallet must be card owner or admin to register device.');
                  }
                  let res: { success: boolean; error?: string; hash?: string; txHash?: string };
                  if (isOwner && cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userEOA)) {
                    const ownerSignature = await signExecuteForOwner(pk, cardAddress, data, deadline, nonce);
                    res = await postCardAddAdmin({
                      cardAddress,
                      data,
                      deadline,
                      nonce,
                      ownerSignature,
                      adminEOA,
                    });
                  } else if (isAdminUser) {
                    const adminSignature = await signExecuteForAdmin(pk, cardAddress, data, deadline, nonce);
                    res = await postCardAddAdminByAdmin({
                      cardAddress,
                      data,
                      deadline,
                      nonce,
                      adminSignature,
                      adminEOA,
                    });
                  } else {
                    throw new Error('Card owner is AA. Add your EOA as admin first via redeem code, then register device.');
                  }
                  if (!res.success) {
                    throw new Error(res.error ?? 'Failed to register device as admin');
                  }
                  const newTerminal: TerminalRecord = {
                    id: adminEOA.toLowerCase(),
                    tag: deviceHandleResolved?.username ? `@${deviceHandleResolved.username}` : fmtAddr(adminEOA),
                    name: newDeviceName.trim() || (deviceHandleResolved?.username ? `@${deviceHandleResolved.username}` : 'POS Terminal'),
                    eoa: fmtAddr(adminEOA),
                    status: 'Active',
                    lastActive: 'On-chain',
                  };
                  const cached = loadTrustedCache<TerminalRecord[]>(linkedTerminalsCacheKey) ?? [];
                  const next = [...cached.filter((t) => t.id.toLowerCase() !== adminEOA.toLowerCase()), newTerminal];
                  saveTrustedCache(linkedTerminalsCacheKey, next);
                  setTerminals(next);
                  closeAddTerminalModal();
                  invalidateFetchCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`);
                  try {
                    window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${fixedCardAdminsCacheKey}`);
                  } catch { /* ignore */ }
                  setTimeout(() => fetchTerminals({ silent: true }), 15_000);
                } catch (e: unknown) {
                  setLinkTerminalError((e as Error)?.message ?? 'Failed to register device');
                } finally {
                  setLinkTerminalLoading(false);
                }
              }}
              disabled={linkTerminalLoading || (!deviceHandleResolved?.address && !newTerminalTag?.trim())}
              className="w-full bg-black text-white py-4 rounded-[16px] font-semibold text-[16px] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {linkTerminalLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Registering...
                </>
              ) : (
                <>Registration Device <ArrowRight size={18}/></>
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
                   const posLower = pos.toLowerCase();
                   const cached = loadTrustedCache<TerminalRecord[]>(linkedTerminalsCacheKey) ?? [];
                   const afterRemove = cached.filter((t) => t.id.toLowerCase() !== posLower);
                   saveTrustedCache(linkedTerminalsCacheKey, afterRemove);
                   setTerminals(afterRemove);
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
            <div className={`relative h-48 sm:h-56 shrink-0 bg-gradient-to-b ${selectedProduct === 'fuel' ? 'from-orange-900/40' : selectedProduct === 'starter' ? 'from-emerald-900/40' : 'from-blue-900/40'} to-[#0f1115]`}>
              <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white border border-white/10 transition-colors z-10"><X size={22} /></button>
              <div className="absolute bottom-6 left-8 right-8">
                 <span className={`inline-block px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase mb-3 border ${selectedProduct === 'fuel' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : selectedProduct === 'starter' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                    {selectedProduct === 'fuel' ? 'Merchant Prepaid' : selectedProduct === 'starter' ? 'AA Activation' : 'Hardware + License'}
                 </span>
                 <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-1">
                    {selectedProduct === 'fuel' ? 'Limited Fuel Pack' : selectedProduct === 'starter' ? 'Starter Fuel Pack' : 'Genesis Node Pack'}
                 </h2>
                 <p className="text-[15px] font-medium text-slate-400">
                    {selectedProduct === 'fuel' ? 'The Store Clearing Fuel' : selectedProduct === 'starter' ? 'The perfect entry to smart routing' : 'The Infrastructure Backbone'}
                 </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 pt-4 pb-32 scrollbar-hide space-y-8">
              <div className="flex gap-4">
                <div className="flex-1 bg-white/5 rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : selectedProduct === 'starter' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}>
                    {selectedProduct === 'fuel' ? <Database size={20} /> : selectedProduct === 'starter' ? <Zap size={20} /> : <Cpu size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{selectedProduct === 'fuel' ? 'Volume' : selectedProduct === 'starter' ? 'Volume' : 'Security'}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">{selectedProduct === 'fuel' ? '100k B-Units' : selectedProduct === 'starter' ? '100 B-Units' : 'ATECC608 Vault'}</p>
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : selectedProduct === 'starter' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                    {selectedProduct === 'fuel' ? <Sparkles size={20} /> : selectedProduct === 'starter' ? <Cpu size={20} /> : <Activity size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{selectedProduct === 'fuel' ? 'Discount' : selectedProduct === 'starter' ? 'AA Account' : 'Yield'}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">{selectedProduct === 'fuel' ? '50% Tech Off' : selectedProduct === 'starter' ? 'Unlocked' : '5% Network'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#16181d] rounded-[24px] p-6 border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <Lock size={16} className="text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{selectedProduct === 'fuel' ? 'The Merchant Arsenal' : selectedProduct === 'starter' ? 'Entry Arsenal' : 'The Tangible Edge'}</span>
                </div>
                <div className="space-y-6">
                  {selectedProduct === 'fuel' ? (
                    <div className="flex gap-4">
                      <Database size={20} className="text-orange-500 shrink-0 mt-0.5" />
                      <div><h4 className="text-[15px] font-bold text-white mb-1">100,000 B-Units Pre-load</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">System value of $1,000 USDC. Instant clearing fuel to process your daily retail volume.</p></div>
                    </div>
                  ) : selectedProduct === 'starter' ? (
                    <div className="flex gap-4">
                      <Zap size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div><h4 className="text-[15px] font-bold text-white mb-1">100 B-Units + AA Activation</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">Unlock your Smart Terminal with zero-gas ecosystem routing. The perfect entry to smart routing.</p></div>
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
                <div className="flex items-baseline gap-1.5"><p className="text-[32px] font-bold text-white leading-none">{selectedProduct === 'fuel' ? '499' : selectedProduct === 'starter' ? '1' : '999'}</p><span className="text-[14px] font-medium text-slate-500">USDC</span></div>
              </div>
              <button onClick={handleMarketPurchase} className={`flex items-center gap-2 px-8 py-4 rounded-[16px] font-semibold text-[16px] text-white transition-all shadow-lg active:scale-95 ${selectedProduct === 'fuel' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20' : selectedProduct === 'starter' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' : 'bg-[#1562f0] hover:bg-blue-500 shadow-[#1562f0]/20'}`}>
                {selectedProduct === 'fuel' ? 'Secure Fuel' : selectedProduct === 'starter' ? 'Activate AA' : 'Secure Node'} <ChevronRight size={18} />
              </button>
            </div>
         </div>
       </div>
     )}
   </div>
 );


 return renderDashboard();
}

