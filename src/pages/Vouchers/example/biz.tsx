import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { CoNET_Data, setCoNET_Data } from '@/utils/globals';
import { storeSystemData, getBalance, formatWithThousands, purchaseBUnitFromBase, postToIPFS } from '@/services/beamio';
import BeamioMeMainScreen from '@/components/Setting';
import { searchUsername, getOracleCadUsdcFromConet } from '@/services/beamio';
import {
  checkRedeemAdminCodeValid,
  isCardAdmin,
  postCardRedeemAdmin,
  getAAAccount,
  fetchTrustedCanonicalAaFromRpc,
  postCardAddAdminByAdmin,
  postCardAddAdmin,
  encodeAdminManagerAdd,
  encodeAddAdminWithMintLimit,
  signExecuteForAdmin,
  signClearAdminMintCounter,
  postCardClearAdminMintCounter,
  signExecuteForOwner,
  getCardMetadataFromApi,
  getCardMetadataFrom1155Json,
  getCardMetadataFromUri,
  getNftMetadataFromApi,
  getCardsOfOwnerWithDetailsForProfile,
  signBUnitRefuel3009,
  createBeamioCard,
  fetchCardsByCategory,
  getCardOwner,
  type CardMetadataFromUri,
  type CardTierMetadata,
  type TierMetadata,
  type UserCardInfo,
} from '@/services/BeamioCard';
import { conetDepinProvider, baseEndpoint, baseRpcProviderDirect, CONET_MAINNET_WSS } from '@/utils/constants';
import { BASE_CARD_FACTORY, BEAMIO_INDEXER_DIAMOND, BEAMIO_USER_CARD_ASSET_ADDRESS } from '@/config/chainAddresses';
import { resolveBeamioAaForEoaWithFallback } from '@/utils/resolveBeamioAaFromCardFactory';
import { parseRedeemAdminFromUrl } from '@/utils/parseRedeemAdminFromUrl';
import {
  IPFS_GET_FRAGMENT,
  IPFS_UPLOAD_JPEG_RETRY_MAX_BYTES,
  IPFS_UPLOAD_TARGET_MAX_BYTES,
  blobToDataUrl,
  compressToJpeg,
  resizeToFitLimit,
} from '@/utils/ipfsCardImageUpload';
import {
  CHARGE_BUINT_LEDGER_MAX_ENTRIES,
  loadChargeBUnitLedgerMap,
  mergeChargeBUnitLedgerEntries,
  trimChargeBUnitLedgerMap,
  saveChargeBUnitLedgerMapImmediate,
  saveChargeBUnitLedgerMapDebounced,
  sumChargeLedgerBUnitsInWindow,
  sumChargeLedgerBUnitsForLocalCalendarDay,
  type ChargeBUnitLedgerEntry,
  type ChargeLedgerFilterCtx,
} from './bizChargeBUnitLedger';
import {
  TIPS_COLLECTED_LEDGER_MAX_ENTRIES,
  loadTipsCollectedLedgerMap,
  mergeTipsCollectedLedgerEntries,
  trimTipsCollectedLedgerMap,
  saveTipsCollectedLedgerMapImmediate,
  saveTipsCollectedLedgerMapDebounced,
  sumTipsCollectedLedgerValuesInWindow,
  sumTipsCollectedLedgerValuesForLocalCalendarDay,
  type TipsCollectedLedgerEntry,
} from './bizTipsCollectedLedger';
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
 Minus,             // Tier description expand/collapse
 Trash2,            // 新增：用于删除按钮
 RefreshCcw,
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
 ImagePlus,
 Paperclip,
 MoreVertical,
 AlertTriangle,
 SlidersHorizontal,
 ChevronRight,
 Sparkles,
 Box,
 ShieldCheck,
 RefreshCw,
 Leaf,
 Loader2,
 ArrowRight,
 Menu,
 CalendarDays,
 Code,
 UserPlus,
 BadgeInfo,
 Ban,
 Fingerprint,
 Layers,
 Medal,
 Rocket,
 Gem,
 Star,
 Plane,
 Gamepad2,
 ShoppingBag,
 UtensilsCrossed,
 Clapperboard,
} from 'lucide-react';

const getImg = (avatarSeed: string | undefined) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || '@Beamio')}`;

const USDC_ICON_URL = 'https://assets.coingecko.com/coins/images/6319/small/usdc.png';
const BASE_ICON_URL = 'https://beamio.app/app/static/media/base-logo.275b67e94556e30ce59b.png';

/** PWA / public brand mark (`public/logo512.png`; respects `homepage` e.g. `/biz`) */
const BIZ_PUBLIC_LOGO512 = `${process.env.PUBLIC_URL ?? ''}/logo512.png`;

/**
 * Merchant OS brand blue — primary + hover/active for solid CTAs, shadows use RGB of `#1562f0`.
 * Focus: use `bizFocusRingClass` on inputs/selects; dark panels use `bizGlowBlurClass` / brand-tinted gradients.
 */
const BIZ_UI_PRIMARY = '#1562f0';
/** Tailwind: visible focus ring (offset for contrast on light UI) */
const bizFocusRingClass =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

/** Filled primary: blue field, white label, blue glow */
const bizUiPrimarySolid =
  'bg-[#1562f0] text-white hover:bg-[#2b74f5] active:bg-[#0d4ec4] shadow-[0_14px_32px_rgba(21,98,240,0.38)] active:shadow-[0_10px_24px_rgba(21,98,240,0.28)]';

/** Spinner / inline loader accent */
const bizUiPrimaryLoader = 'text-[#1562f0]';

/** Text & icon accent on light backgrounds (dark blue, readable on white/slate-50) */
const bizUiPrimaryAccent = 'text-blue-900';

/** Soft radial/blur highlight for dark cards (Settlement, linked card) */
const bizGlowBlurClass = 'bg-[#1562f0]/28';

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

/** Display row for Transactions table (without nested tip to avoid recursive type) */
type TxDisplayRowCore = {
  /** Receipt row label e.g. TX-1001 */
  id: string
  /** Indexer `Transaction.id` (bytes32 hex, lowercase). Unique for localStorage keys e.g. `${BIZ_CACHE_PREFIX}topup:${indexerTxId}` */
  indexerTxId: string
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
  /** B-Units protocol fee (from indexer fees.bServiceUnits6, display units) */
  bUnits: number
  /** Indexer Transaction.originalPaymentHash (bytes32 hex); main payment is zero hash */
  originalPaymentHash?: string
  /** top-level admin for reporting (admin topup flows) */
  topAdmin?: string
  /** subordinate that processed this tx (admin topup flows) */
  subordinate?: string
  /**
   * Full indexer `Transaction` (readme-shaped JSON from `indexerPageTupleToTransactionJson`).
   * `route` is [] when not returned by paged facet ABI. Shown inside modal with the rest of this row.
   */
  raw: Record<string, unknown>
}

/** Parent Charge may embed merged TX_TIP line (readme `originalPaymentHash` → parent `id`) */
type TxDisplayRow = TxDisplayRowCore & {
  tipRaw?: TxDisplayRowCore
}

/** Normalized row after indexer page fetch or WSS + getTransactionFullByTxId → map to TxDisplayRow */
type IndexerFetchedTxRow = {
  id: string
  originalPaymentHash: string
  txCategory: string
  displayJson: string
  timestamp: string
  payer: string
  payee: string
  finalRequestAmountFiat6: string
  finalRequestAmountUSDC6: string
  meta?: {
    afterNotePayer?: string
    afterNotePayee?: string
    requestAmountFiat6?: bigint
    requestAmountUSDC6?: bigint
    currencyFiat?: number
  }
  topAdmin?: string
  subordinate?: string
  bServiceUnits6: string
  raw: Record<string, unknown>
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
    tiers: [
      { id: 'ct_green', name: 'Green Card', discount: 10, iconType: 'emerald' as const },
      { id: 'ct_black', name: 'Black VIP', discount: 20, iconType: 'yellow' as const },
    ],
    privileges: [
      { title: 'Full Access: $CTree', desc: 'Process payments, issue cards, and handle upgrades at POS.' },
      { title: 'CAD Trust Settlement', desc: 'Unlock fiat payouts via local MSB.' },
      { title: 'Membership Routing', desc: 'Auto-apply VIP tier discounts.' }
    ]
  }
};

type AllianceId = keyof typeof INITIAL_ALLIANCES_DB;

/** Default alliance row for `BEAMIO_USER_CARD_ASSET_ADDRESS` in this example UI */
const ALLIANCE_ID_FOR_FIXED_USER_CARD: AllianceId = 'CashTrees';

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

/** Members & Loyalty (demo rows; not on-chain) */
type BizLoyaltyMemberRow = {
  id: string
  tag: string
  address: string
  tier: string
  balance: number
  ltv: number
  lastActive: string
  store: string
  status: 'Active' | 'Suspended'
}

const BIZ_LOYALTY_BRANCHES = ['All Stores (Network View)', 'Main Store', 'Franchise North'] as const

const INITIAL_BIZ_LOYALTY_MEMBERS: BizLoyaltyMemberRow[] = [
  { id: 'blm001', tag: '@alice_chen', address: '0x1A4…9F21', tier: 'Green Card', balance: 50.0, ltv: 850.0, lastActive: '2 hrs ago', store: 'Main Store', status: 'Active' },
  { id: 'blm002', tag: '@senpho_wholesale', address: '0x3C8…E4A1', tier: 'Black VIP', balance: 45.0, ltv: 3200.0, lastActive: 'Yesterday', store: 'Franchise North', status: 'Active' },
  { id: 'blm003', tag: '@cashtrees_support', address: '0x9E2…1B7C', tier: 'Standard', balance: 12.5, ltv: 45.0, lastActive: '3 days ago', store: 'Main Store', status: 'Active' },
]

const ISSUE_CARD_MIN_BUINTS = 200

/** 指定商户卡地址 - 必须使用此卡 */
const FIXED_USER_CARD_CONTRACT_ADDRESS = BEAMIO_USER_CARD_ASSET_ADDRESS
const CONET_BUINT_ADDRESS = '0x4A3E59519eE72B9Dcf376f0617fF0a0a5a1ef879'
const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const
/** ERC-1155 `POINTS_ID` on BeamioUserCard is 0 — AA-held points balance for voucher display */
const BEAMIO_USER_CARD_ERC1155_BALANCE_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
] as const
const BEAMIO_APP_URL = 'https://beamio.app'
/** BeamioUserCard read: prefer baseRpcProviderDirect for stats/isAdmin (avoids baseEndpoint proxy decode issues; Issued $CTree path already uses direct). */
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
  'function adminParent(address admin) view returns (address)',
  'function getGlobalStatsFull(uint8 periodType, uint256 anchorTs, uint256 cumulativeStartTs) view returns (uint256 cumulativeMint, uint256 cumulativeBurn, uint256 cumulativeTransfer, uint256 cumulativeTransferAmount, uint256 cumulativeRedeemMint, uint256 cumulativeUSDCMint, uint256 cumulativeIssued, uint256 cumulativeUpgraded, uint256 periodMint, uint256 periodBurn, uint256 periodTransfer, uint256 periodTransferAmount, uint256 periodRedeemMint, uint256 periodUSDCMint, uint256 periodIssued, uint256 periodUpgraded, uint256 adminCount, uint256 cumulativeAdminToAdminTransfer, uint256 cumulativeAdminToAdminTransferAmount, uint256 periodAdminToAdminTransfer, uint256 periodAdminToAdminTransferAmount, uint256 lifetimeAdminToAdminTransferCount, uint256 lifetimeAdminToAdminTransferAmount)',
] as const

/** BeamioUserCard: `tiers(uint256)` + global `currency` (BeamioCurrency.CurrencyType, uint8) */
const USER_CARD_TIERS_AND_CURRENCY_READ_ABI = [
  'function tiers(uint256) view returns (uint256 minUsdc6, uint256 attr, uint256 tierExpirySeconds, bool upgradeByBalance)',
  'function currency() view returns (uint8)',
] as const

type BeamioUserCardChainTier = {
  index: number
  minUsdc6: bigint
  attr: bigint
  tierExpirySeconds: bigint
  upgradeByBalance: boolean
}

async function fetchBeamioUserCardTiersAndCurrencyFromChain(
  cardAddress: string,
  provider: ethers.Provider
): Promise<{ tiers: BeamioUserCardChainTier[]; currencyType: number }> {
  const addr = ethers.getAddress(cardAddress)
  const c = new ethers.Contract(addr, USER_CARD_TIERS_AND_CURRENCY_READ_ABI, provider)
  const rows: BeamioUserCardChainTier[] = []
  for (let i = 0; i < 64; i++) {
    try {
      const r = await c.tiers(i)
      rows.push({
        index: i,
        minUsdc6: BigInt(r[0].toString()),
        attr: BigInt(r[1].toString()),
        tierExpirySeconds: BigInt(r[2].toString()),
        upgradeByBalance: Boolean(r[3]),
      })
    } catch {
      break
    }
  }
  rows.sort((a, b) => {
    if (a.minUsdc6 < b.minUsdc6) return -1
    if (a.minUsdc6 > b.minUsdc6) return 1
    return a.index - b.index
  })
  let currencyType = 0
  try {
    currencyType = Number(await c.currency())
  } catch {
    currencyType = 0
  }
  if (!Number.isFinite(currencyType) || currencyType < 0) currencyType = 0
  return { tiers: rows, currencyType }
}

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

/** BeamioIndexerDiamond ActionFacet: account + topAdmin ledger (topAdmin 列表含 route 仅为 USDC 的 TX_TIP，不经由卡 asset 索引) */
const INDEXER_ACCOUNT_ABI = [
  `function getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged(address account, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter, uint8 accountMode) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
  `function getTopAdminTransactionsByCurrentPeriodOffsetAndAccountModePaged(address topAdmin, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter, uint8 accountMode) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
] as const

const CHAIN_ID_FILTER_ALL = ethers.MaxUint256

/** Align with `AdminStatsPeriodLib` / indexer `periodType` */
const PERIOD_HOUR = 0
const PERIOD_DAY = 1
const PERIOD_WEEK = 2
const PERIOD_MONTH = 3
const PERIOD_QUARTER = 4
const PERIOD_YEAR = 5

type OverviewTimeFilter = 'Today' | 'This Week' | 'This Month' | 'This Quarter' | 'This Year'

const OVERVIEW_TIME_FILTERS: readonly OverviewTimeFilter[] = ['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'] as const

function overviewTimeFilterToPeriodType(tf: string): number {
  switch (tf) {
    case 'This Week':
      return PERIOD_WEEK
    case 'This Month':
      return PERIOD_MONTH
    case 'This Quarter':
      return PERIOD_QUARTER
    case 'This Year':
      return PERIOD_YEAR
    case 'Today':
    default:
      return PERIOD_DAY
  }
}

/** Local calendar date `YYYY-MM-DD` (client timezone). */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Unix seconds at local midnight for the same calendar day as `reference`. */
function getLocalCalendarDayStartUnixSec(reference: Date): number {
  const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  return Math.floor(d.getTime() / 1000)
}

/**
 * Inclusive period start (unix seconds) for Overview time filter.
 * `Today` = client local midnight (matches gross sales). Other ranges = UTC-aligned like indexer `StatsFacet` / `PERIOD_*`.
 */
function overviewPeriodStartUnixSec(timeFilter: OverviewTimeFilter, anchorSec: number): number {
  if (timeFilter === 'Today') {
    return getLocalCalendarDayStartUnixSec(new Date(anchorSec * 1000))
  }
  if (timeFilter === 'This Week') {
    const daysSinceEpoch = Math.floor(anchorSec / 86400)
    const mondayIndex = (daysSinceEpoch + 3) % 7
    return (daysSinceEpoch - mondayIndex) * 86400
  }
  const d = new Date(anchorSec * 1000)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  if (timeFilter === 'This Month') {
    return Math.floor(Date.UTC(y, m, 1) / 1000)
  }
  if (timeFilter === 'This Quarter') {
    const qStartMonth = Math.floor(m / 3) * 3
    return Math.floor(Date.UTC(y, qStartMonth, 1) / 1000)
  }
  if (timeFilter === 'This Year') {
    return Math.floor(Date.UTC(y, 0, 1) / 1000)
  }
  return getLocalCalendarDayStartUnixSec(new Date(anchorSec * 1000))
}

type BizNetworkSummaryRow = {
  cadVol: number
  txCount: number
  usdc: number
  vouchers: number
  /** Present when `timeFilter === 'Today'`: must match `formatLocalYmd(new Date())` for trusted cache */
  localDayKey?: string
}

function overviewPeriodConsumptionCaption(tf: string): string {
  switch (tf) {
    case 'This Week':
      return "This Week's Consumption"
    case 'This Month':
      return "This Month's Consumption"
    case 'This Quarter':
      return "This Quarter's Consumption"
    case 'This Year':
      return "This Year's Consumption"
    case 'Today':
    default:
      return "Today's Consumption"
  }
}
/** keccak256("merchant_pay:tip_updated") - legacy tip transactions */
const TX_MERCHANT_PAY_TIP_UPDATED = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:tip_updated'))
/** keccak256("TX_TIP") - NFC Container / Charge 独立小费行（与 x402sdk MemberCard 一致） */
const TX_TIP_LEDGER_CATEGORY = ethers.keccak256(ethers.toUtf8Bytes('TX_TIP'))
const TX_MERCHANT_PAY_CONFIRMED = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:confirmed'))
const TX_CATEGORY_ZERO = ethers.ZeroHash

/** Top-Up style txCategory hashes (same as indexer fetch mapping) */
const INDEXER_TX_TOPUP_CATEGORIES = new Set([
  ethers.keccak256(ethers.toUtf8Bytes('usdcTopupCard')),
  ethers.keccak256(ethers.toUtf8Bytes('newCard')),
  ethers.keccak256(ethers.toUtf8Bytes('upgradeNewCard')),
  ethers.keccak256(ethers.toUtf8Bytes('topupCard')),
  ethers.keccak256(ethers.toUtf8Bytes('redeemNewCard')),
  ethers.keccak256(ethers.toUtf8Bytes('redeemUpgradeNewCard')),
  ethers.keccak256(ethers.toUtf8Bytes('redeemTopupCard')),
] as const)

/** B-Unit Airdrop ↔ indexer rows (readme 2.3 + MemberCard consume kinds) — not merchant Charge/Top-Up. */
const TX_BUINT_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('buintClaim'))
const TX_BUINT_USDC = ethers.keccak256(ethers.toUtf8Bytes('buintUSDC'))
const TX_BUINT_BURN = ethers.keccak256(ethers.toUtf8Bytes('buintBurn'))
const TX_BUINT_REQUEST_ACCOUNTING = ethers.keccak256(ethers.toUtf8Bytes('requestAccounting'))
const TX_BUINT_SEND_USDC = ethers.keccak256(ethers.toUtf8Bytes('sendUSDC'))
const TX_BUINT_X402_SEND = ethers.keccak256(ethers.toUtf8Bytes('x402Send'))
const TX_BUINT_NFC_TOPUP_SERVICE = ethers.keccak256(ethers.toUtf8Bytes('nfcTopup:bunitService'))

const INDEXER_BUINT_LEDGER_CATEGORY_HEX_LOWER = new Set([
  TX_BUINT_CLAIM.toLowerCase(),
  TX_BUINT_USDC.toLowerCase(),
  TX_BUINT_BURN.toLowerCase(),
  TX_BUINT_REQUEST_ACCOUNTING.toLowerCase(),
  TX_BUINT_SEND_USDC.toLowerCase(),
  TX_BUINT_X402_SEND.toLowerCase(),
  TX_BUINT_NFC_TOPUP_SERVICE.toLowerCase(),
])

function normalizeIndexerTxCategoryHex(cat: unknown): string {
  if (cat == null) return ''
  if (typeof cat === 'string') {
    const s = cat.trim()
    if (!s) return ''
    if (s.startsWith('0x')) return s.toLowerCase()
    try {
      return ethers.hexlify(s as ethers.BytesLike).toLowerCase()
    } catch {
      try {
        return (`0x${BigInt(s).toString(16).padStart(64, '0')}`).toLowerCase()
      } catch {
        return ''
      }
    }
  }
  try {
    return ethers.hexlify(cat as ethers.BytesLike).toLowerCase()
  } catch {
    return ''
  }
}

function isIndexerBuintLedgerCategory(cat: unknown): boolean {
  const h = normalizeIndexerTxCategoryHex(cat)
  return h !== '' && INDEXER_BUINT_LEDGER_CATEGORY_HEX_LOWER.has(h)
}

function isIndexerBuintConsumePayee(payee: unknown): boolean {
  const p = typeof payee === 'string' && ethers.isAddress(payee) ? ethers.getAddress(payee).toLowerCase() : ''
  return p === CONET_BUINT_ADDRESS.toLowerCase()
}

/** Exclude from Merchant OS Transactions: B-Unit claim / USDC mint / consume (any registered kind). */
function isIndexerFetchedRowBunitLedger(tx: { txCategory: string; payee: string }): boolean {
  if (isIndexerBuintLedgerCategory(tx.txCategory)) return true
  return isIndexerBuintConsumePayee(tx.payee)
}

function txDisplayRowIsIndexerBunitLedger(r: TxDisplayRow): boolean {
  const raw = r.raw as { txCategory?: unknown; payee?: unknown }
  if (isIndexerBuintLedgerCategory(raw.txCategory)) return true
  return isIndexerBuintConsumePayee(raw.payee)
}

const INDEXER_READ_FULL_AND_EVENT_ABI = [
  `function getTransactionFullByTxId(bytes32 txId) view returns (tuple(bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, address topAdmin, address subordinate, tuple(address asset, uint256 amountE6, uint8 assetType, uint8 source, uint256 tokenId, uint8 itemCurrencyType, uint256 offsetInRequestCurrencyE6)[] route, tuple(uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, tuple(uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta) full_)`,
  'event TransactionRecordSynced(uint256 indexed actionId, bytes32 indexed txId, bytes32 indexed txCategory, address payer, address payee)',
] as const

/** localStorage: EOA-scoped inbound tx from WSS (beamio-chain-fetch EOA 隔离) */
const INDEXER_INBOUND_TX_CACHE_KEY = (eoaLower: string) => `indexer:inboundTx:v1:${eoaLower}`

type FixedUserCardMetadata = {
  name?: string
  description?: string
  image?: string
  cardOwner?: string
  /** `shareTokenMetadata.Symbol` or `symbol` — card points token label for dashboard */
  currencySymbol?: string
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

  const symRaw = firstNonEmptyString(
    typeof share?.Symbol === 'string' ? share.Symbol : undefined,
    typeof share?.symbol === 'string' ? share.symbol : undefined,
    typeof meta.Symbol === 'string' ? meta.Symbol : undefined,
    typeof meta.symbol === 'string' ? meta.symbol : undefined
  );

  const parsed: FixedUserCardMetadata = {
    name: firstNonEmptyString(share?.name, meta.name),
    description: firstNonEmptyString(share?.description, meta.description),
    image: firstNonEmptyString(share?.image, meta.image),
    ...(cardOwner ? { cardOwner } : {}),
    ...(symRaw ? { currencySymbol: symRaw } : {}),
  };

  return parsed.name || parsed.description || parsed.image || parsed.cardOwner || parsed.currencySymbol ? parsed : null;
}

/** Fallback label when card metadata has no `Symbol` (e.g. infra CashTrees asset). */
const DASHBOARD_DEFAULT_POINTS_SYMBOL = '$CTree';

function normalizeDashboardPointsSymbol(raw: string | undefined | null): string {
  const t = (raw ?? '').trim();
  if (!t) return DASHBOARD_DEFAULT_POINTS_SYMBOL;
  return t.startsWith('$') ? t : `$${t}`;
}

const amountE6ToDisplayNumber = (value: bigint): number => Number(value) / 1_000_000

/**
 * `getAdminStatsFull` returns `AdminStatsFullView` (struct with trailing `address[]`); RPC hex starts with a word offset to the tuple.
 * ethers v6 `Contract.getAdminStatsFull` often throws BAD_DATA — same layout as `scripts/fetchAdminStats.mjs` `parseStatsFull`.
 */
function parseGetAdminStatsFullReturnHex(rawHex: string): {
  cumulativeMint: bigint
  cumulativeTransfer: bigint
  cumulativeTransferAmount: bigint
  cumulativeUSDCMint: bigint
  periodMint: bigint
  periodBurn: bigint
  periodTransfer: bigint
  periodTransferAmount: bigint
  periodRedeemMint: bigint
  periodUSDCMint: bigint
  periodIssued: bigint
  periodUpgraded: bigint
  mintCounterFromClear: bigint
  burnCounterFromClear: bigint
  transferCounterFromClear: bigint
  transferAmountFromClear: bigint
  redeemMintCounterFromClear: bigint
  usdcMintCounterFromClear: bigint
} | null {
  if (!rawHex || typeof rawHex !== 'string') return null
  const hex = rawHex.replace(/^0x/, '')
  if (hex.length < 64 * 8) return null
  const u256 = (wordIndex: number) => BigInt('0x' + hex.slice(wordIndex * 64, (wordIndex + 1) * 64))
  const structOffset = Number(u256(0))
  if (!Number.isFinite(structOffset) || structOffset % 32 !== 0) return null
  const base = structOffset / 32
  const minWords = base + 23
  if (hex.length < minWords * 64) return null
  return {
    cumulativeMint: u256(base + 0),
    cumulativeTransfer: u256(base + 2),
    cumulativeTransferAmount: u256(base + 3),
    cumulativeUSDCMint: u256(base + 5),
    periodMint: u256(base + 8),
    periodBurn: u256(base + 9),
    periodTransfer: u256(base + 10),
    periodTransferAmount: u256(base + 11),
    periodRedeemMint: u256(base + 12),
    periodUSDCMint: u256(base + 13),
    periodIssued: u256(base + 14),
    periodUpgraded: u256(base + 15),
    mintCounterFromClear: u256(base + 16),
    burnCounterFromClear: u256(base + 17),
    transferCounterFromClear: u256(base + 18),
    transferAmountFromClear: u256(base + 19),
    redeemMintCounterFromClear: u256(base + 20),
    usdcMintCounterFromClear: u256(base + 21),
  }
}

async function callGetAdminStatsFullParsed(
  cardAddress: string,
  admin: string,
  periodType: number,
  provider: ethers.Provider,
  anchorTs: bigint = 0n,
  cumulativeStartTs: bigint = 0n
): Promise<ReturnType<typeof parseGetAdminStatsFullReturnHex>> {
  const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI])
  const data = iface.encodeFunctionData('getAdminStatsFull', [admin, periodType, anchorTs, cumulativeStartTs])
  const raw = await provider.call({ to: cardAddress, data })
  return parseGetAdminStatsFullReturnHex(typeof raw === 'string' ? raw : '')
}

/**
 * `getGlobalStatsFull` on deployed Base cards often returns **17** static words (through `adminCount`) with no leading offset;
 * newer modules may return 23 words behind a `0x20` offset. Supports both.
 */
function parseGetGlobalStatsFullReturnHex(rawHex: string): {
  cumulativeMint: bigint
  cumulativeTransfer: bigint
  cumulativeTransferAmount: bigint
  cumulativeUSDCMint: bigint
  periodMint: bigint
  periodTransfer: bigint
  periodTransferAmount: bigint
  periodUSDCMint: bigint
  cumulativeIssued: bigint
  cumulativeUpgraded: bigint
  periodIssued: bigint
  periodUpgraded: bigint
} | null {
  if (!rawHex || typeof rawHex !== 'string') return null
  const hex = rawHex.replace(/^0x/, '')
  if (hex.length < 17 * 64) return null
  const nWords = hex.length / 64
  if (!Number.isInteger(nWords)) return null
  const u256 = (wordIndex: number) => BigInt('0x' + hex.slice(wordIndex * 64, (wordIndex + 1) * 64))
  let base = 0
  if (nWords > 17) {
    const head = u256(0)
    if (head === 32n || head === 64n) base = Number(head) / 32
  }
  if (hex.length < (base + 17) * 64) return null
  return {
    cumulativeMint: u256(base + 0),
    cumulativeTransfer: u256(base + 2),
    cumulativeTransferAmount: u256(base + 3),
    cumulativeUSDCMint: u256(base + 5),
    periodMint: u256(base + 8),
    periodTransfer: u256(base + 10),
    periodTransferAmount: u256(base + 11),
    periodUSDCMint: u256(base + 13),
    cumulativeIssued: u256(base + 6),
    cumulativeUpgraded: u256(base + 7),
    periodIssued: u256(base + 14),
    periodUpgraded: u256(base + 15),
  }
}

async function callGetGlobalStatsFullParsed(
  cardAddress: string,
  periodType: number,
  provider: ethers.Provider,
  anchorTs: bigint = 0n,
  cumulativeStartTs: bigint = 0n
): Promise<ReturnType<typeof parseGetGlobalStatsFullReturnHex>> {
  const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI])
  const data = iface.encodeFunctionData('getGlobalStatsFull', [periodType, anchorTs, cumulativeStartTs])
  const raw = await provider.call({ to: cardAddress, data })
  return parseGetGlobalStatsFullReturnHex(typeof raw === 'string' ? raw : '')
}

/**
 * Overview "Today": sum `getAdminStatsFull(..., PERIOD_HOUR, anchor in hour h)` for each UTC hour index
 * overlapping the client-local calendar day [local midnight, now]. Each hourly call already aggregates
 * the admin subtree on `BEAMIO_USER_CARD_ASSET_ADDRESS` (same as `getAdminStatsFull` period stats).
 */
async function aggregateAdminNetworkSummaryLocalTodayFromHourlyBuckets(
  cardAddress: string,
  admin: string,
  provider: ethers.Provider
): Promise<BizNetworkSummaryRow | null> {
  const nowSec = Math.floor(Date.now() / 1000)
  const startSec = getLocalCalendarDayStartUnixSec(new Date())
  if (nowSec < startSec) return null
  const startHour = Math.floor(startSec / 3600)
  const endHour = Math.floor(nowSec / 3600)
  const hours: number[] = []
  for (let h = startHour; h <= endHour; h++) hours.push(h)
  const results = await Promise.all(
    hours.map((h) =>
      callGetAdminStatsFullParsed(
        cardAddress,
        admin,
        PERIOD_HOUR,
        provider,
        BigInt(h * 3600 + 1800),
        0n
      )
    )
  )
  let periodTransferAmount = 0n
  let periodTransfer = 0n
  let periodUSDCMint = 0n
  let periodMint = 0n
  for (const p of results) {
    if (!p) continue
    periodTransferAmount += p.periodTransferAmount
    periodTransfer += p.periodTransfer
    periodUSDCMint += p.periodUSDCMint
    periodMint += p.periodMint
  }
  return {
    cadVol: amountE6ToDisplayNumber(periodTransferAmount),
    txCount: Number(periodTransfer),
    usdc: amountE6ToDisplayNumber(periodUSDCMint),
    vouchers: amountE6ToDisplayNumber(periodMint),
    localDayKey: formatLocalYmd(new Date()),
  }
}

/**
 * Overview "Today" (global / full card): sum `getGlobalStatsFull(..., PERIOD_HOUR, ...)` over local-calendar-day hours.
 */
async function aggregateGlobalNetworkSummaryLocalTodayFromHourlyBuckets(
  cardAddress: string,
  provider: ethers.Provider
): Promise<BizNetworkSummaryRow | null> {
  const nowSec = Math.floor(Date.now() / 1000)
  const startSec = getLocalCalendarDayStartUnixSec(new Date())
  if (nowSec < startSec) return null
  const startHour = Math.floor(startSec / 3600)
  const endHour = Math.floor(nowSec / 3600)
  const hours: number[] = []
  for (let h = startHour; h <= endHour; h++) hours.push(h)
  const results = await Promise.all(
    hours.map((h) =>
      callGetGlobalStatsFullParsed(
        cardAddress,
        PERIOD_HOUR,
        provider,
        BigInt(h * 3600 + 1800),
        0n
      )
    )
  )
  let periodTransferAmount = 0n
  let periodTransfer = 0n
  let periodUSDCMint = 0n
  let periodMint = 0n
  for (const p of results) {
    if (!p) continue
    periodTransferAmount += p.periodTransferAmount
    periodTransfer += p.periodTransfer
    periodUSDCMint += p.periodUSDCMint
    periodMint += p.periodMint
  }
  return {
    cadVol: amountE6ToDisplayNumber(periodTransferAmount),
    txCount: Number(periodTransfer),
    usdc: amountE6ToDisplayNumber(periodUSDCMint),
    vouchers: amountE6ToDisplayNumber(periodMint),
    localDayKey: formatLocalYmd(new Date()),
  }
}

/** Linked POS / subordinate admin row — filled only by the overview feeder tick (Overview + Staff tabs). */
type BizTerminalChainStats = {
  transferAmountFromClear: number
  mintCounterFromClear: number
  remainingAvailable: number
}

async function fetchBizTerminalChainStats(
  card: ethers.Contract,
  provider: ethers.Provider,
  cardAddress: string,
  addr: string
): Promise<BizTerminalChainStats> {
  let transferAmountFromClear = 0;
  let mintCounterFromClear = 0;
  let remainingAvailable = 0;
  try {
    let statsRes: { transferAmountFromClear: bigint; mintCounterFromClear: bigint };
    try {
      statsRes = (await card.getAdminStatsFull(addr, 0, 0, 0)) as {
        transferAmountFromClear: bigint;
        mintCounterFromClear: bigint;
      };
    } catch {
      const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI]);
      const calldata = iface.encodeFunctionData('getAdminStatsFull', [addr, 0, 0, 0]);
      const hex = await provider.call({ to: cardAddress, data: calldata });
      const raw = (hex as string).replace(/^0x/, '');
      if (raw.length < 1344) throw new Error('Short response');
      const transferHex = raw.substring(1280, 1344);
      const mintHex = raw.substring(1088, 1152);
      statsRes = {
        transferAmountFromClear: BigInt(`0x${transferHex}`),
        mintCounterFromClear: BigInt(`0x${mintHex}`),
      };
    }
    transferAmountFromClear = amountE6ToDisplayNumber(statsRes.transferAmountFromClear);
    mintCounterFromClear = amountE6ToDisplayNumber(statsRes.mintCounterFromClear);
  } catch {
    /* getAdminStatsFull may fail on some cards */
  }
  try {
    const limitRes = (await card.getAdminAirdropLimit(addr)) as { remainingAvailable: bigint; unlimited: boolean };
    if (limitRes.unlimited) {
      remainingAvailable = Number.MAX_SAFE_INTEGER;
    } else {
      const rem = limitRes.remainingAvailable;
      remainingAvailable =
        rem >= BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : amountE6ToDisplayNumber(rem);
    }
  } catch {
    /* getAdminAirdropLimit may fail */
  }
  return { transferAmountFromClear, mintCounterFromClear, remainingAvailable };
}

/** Match chain tier index to card metadata `tiers` entry (by `index` field or array position). */
function resolveTierMetadataDisplayName(metaList: CardTierMetadata[] | null | undefined, chainTierIndex: number): string {
  if (metaList && metaList.length > 0) {
    const byIndex = metaList.find((t) => typeof t.index === 'number' && Number(t.index) === chainTierIndex);
    const fromMeta = (byIndex?.name ?? metaList[chainTierIndex]?.name)?.trim();
    if (fromMeta) return fromMeta;
  }
  return `Membership Tier ${chainTierIndex + 1}`;
}

async function fetchCardTierMetadataListForRouting(cardAddress: string): Promise<CardTierMetadata[]> {
  const a = await getCardMetadataFromApi(cardAddress);
  if (a?.tiers && a.tiers.length > 0) return a.tiers;
  const b = await getCardMetadataFrom1155Json(cardAddress);
  return b?.tiers && b.tiers.length > 0 ? b.tiers : [];
}

/** Subordinate entry from `getAdminSubordinatesWithMetadata` → EOA for adminManager + API `adminEOA` */
async function resolveSubordinateAdminEoa(addr: string, provider: ethers.Provider): Promise<string> {
  if (!addr || !ethers.isAddress(addr)) throw new Error('Invalid subordinate address');
  const raw = ethers.getAddress(addr);
  const code = await provider.getCode(raw);
  if (code && code !== '0x' && code.length > 2) {
    try {
      const ownerRes = await provider.call({ to: raw, data: '0x8da5cb5b' });
      if (ownerRes && typeof ownerRes === 'string' && ownerRes.length >= 66) {
        return ethers.getAddress(`0x${ownerRes.slice(-40)}`);
      }
    } catch {
      /* use raw */
    }
  }
  return raw;
}

type TierRoutingDiscountsV1 = {
  schemaVersion: 1;
  infrastructureCard: string;
  currencyType: number;
  updatedAt: number;
  /** Sales / VAT tax rate in percent (0–100), e.g. 8.25. Devices read `tierRoutingDiscounts.taxRatePercent`. */
  taxRatePercent: number;
  tiers: Array<{
    chainTierIndex: number;
    tierId: string;
    discountPercent: number;
    minUsdc6: string;
  }>;
};

function mergeTerminalAdminMetadataJson(existingJson: string | undefined, tierRouting: TierRoutingDiscountsV1): string {
  let base: Record<string, unknown> = {};
  if (existingJson && typeof existingJson === 'string' && existingJson.trim()) {
    try {
      const parsed = JSON.parse(existingJson) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  return JSON.stringify({ ...base, tierRoutingDiscounts: tierRouting });
}

/** Parse `tierRoutingDiscounts` from subordinate admin metadata JSON; must match infrastructure card. */
function tryParseTierRoutingFromAdminMetadataJson(
  metaJson: string,
  infrastructureCardAddress: string
): { taxRatePercent: number; tierDiscountsById: Record<string, number> } | null {
  const want = ethers.getAddress(infrastructureCardAddress);
  let root: unknown;
  try {
    root = JSON.parse(metaJson);
  } catch {
    return null;
  }
  if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
  const trRaw = (root as Record<string, unknown>).tierRoutingDiscounts;
  if (!trRaw || typeof trRaw !== 'object' || Array.isArray(trRaw)) return null;
  const tr = trRaw as Record<string, unknown>;
  const ver = tr.schemaVersion;
  if (ver !== undefined && ver !== null && Number(ver) !== 1) return null;
  const infra = tr.infrastructureCard;
  if (typeof infra !== 'string' || !ethers.isAddress(infra)) return null;
  if (ethers.getAddress(infra) !== want) return null;

  let taxRatePercent = 0;
  const tTax = tr.taxRatePercent;
  if (typeof tTax === 'number' && Number.isFinite(tTax)) taxRatePercent = tTax;
  else if (typeof tTax === 'string' && tTax.trim()) {
    const n = Number(tTax);
    if (Number.isFinite(n)) taxRatePercent = n;
  }
  taxRatePercent = Math.min(100, Math.max(0, Math.round(taxRatePercent * 100) / 100));

  const tierDiscountsById: Record<string, number> = {};
  const tiers = tr.tiers;
  if (Array.isArray(tiers)) {
    for (const row of tiers) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const dp = r.discountPercent;
      let discount = NaN;
      if (typeof dp === 'number' && Number.isFinite(dp)) discount = dp;
      else if (typeof dp === 'string' && dp.trim()) {
        const n = Number(dp);
        if (Number.isFinite(n)) discount = n;
      }
      if (!Number.isFinite(discount)) continue;
      discount = Math.min(100, Math.max(0, Math.round(discount)));
      const idx = r.chainTierIndex;
      const tid = r.tierId;
      if (typeof idx === 'number' && Number.isInteger(idx)) {
        tierDiscountsById[`chain-tier-${idx}`] = discount;
      }
      if (typeof tid === 'string' && tid.startsWith('chain-tier-')) {
        tierDiscountsById[tid] = discount;
      }
    }
  }
  return { taxRatePercent, tierDiscountsById };
}

function pickTierRoutingFromSubordinateMetadatas(
  metadatas: string[],
  infrastructureCardAddress: string
): { taxRatePercent: number; tierDiscountsById: Record<string, number> } | null {
  for (const m of metadatas) {
    if (typeof m !== 'string' || !m.trim()) continue;
    const p = tryParseTierRoutingFromAdminMetadataJson(m, infrastructureCardAddress);
    if (p) return p;
  }
  return null;
}

/** Transaction.id without 0x, first 6 hex chars (In-Store Top-Up subtitle tx segment) */
const indexerTxIdBodyPrefix6 = (indexerTxId: string | undefined): string => {
  if (!indexerTxId || typeof indexerTxId !== 'string') return '------'
  const body = indexerTxId.startsWith('0x') ? indexerTxId.slice(2) : indexerTxId
  const hexOnly = body.replace(/[^0-9a-fA-F]/g, '')
  if (hexOnly.length === 0) return '------'
  return hexOnly.slice(0, 6).toLowerCase()
}

/** Same predicates as Transactions tab `filteredTx` (ledger / search / type / terminal). */
type BizTxTableFilterCtx = {
  activeLedger: 'All' | 'AA' | 'EOA'
  txSearchTerm: string
  txFilterType: string
  txFilterTerminal: string
  hasAaAccount: boolean
}

function bizTxMatchesTransactionTableFilters(tx: TxDisplayRow, ctx: BizTxTableFilterCtx): boolean {
  if (txDisplayRowIsIndexerBunitLedger(tx)) return false
  if (ctx.activeLedger === 'AA' && !ctx.hasAaAccount) return false
  const isVaultTx = tx.terminal?.toLowerCase().includes('vault') || tx.terminal === 'The Vault'
  const matchLedger =
    ctx.activeLedger === 'All' || (ctx.activeLedger === 'EOA' && isVaultTx) || (ctx.activeLedger === 'AA' && !isVaultTx)
  const q = ctx.txSearchTerm.toLowerCase()
  const topUpShortLabel = tx.type.includes('Top-Up')
    ? `TX-${indexerTxIdBodyPrefix6(tx.indexerTxId)}`.toLowerCase()
    : ''
  const tipRawId = tx.tipRaw?.indexerTxId?.toLowerCase() ?? ''
  const matchSearch =
    !ctx.txSearchTerm.trim() ||
    tx.id.toLowerCase().includes(q) ||
    tx.indexerTxId.toLowerCase().includes(q) ||
    indexerTxIdBodyPrefix6(tx.indexerTxId).includes(q.replace(/^0x/, '')) ||
    (tipRawId && (tipRawId.includes(q) || indexerTxIdBodyPrefix6(tipRawId).includes(q.replace(/^0x/, '')))) ||
    (topUpShortLabel && topUpShortLabel.includes(q)) ||
    tx.hash.toLowerCase().includes(q) ||
    (tx.beamioTag && tx.beamioTag.toLowerCase().includes(q))
  const matchType = ctx.txFilterType === 'All' || tx.type === ctx.txFilterType
  const matchTerminal =
    ctx.txFilterTerminal === 'All' ||
    tx.terminal === ctx.txFilterTerminal ||
    (ctx.txFilterTerminal === 'The Vault' && Boolean(tx.terminal?.toLowerCase().includes('vault')))
  return Boolean(matchLedger && matchSearch && matchType && matchTerminal)
}

/**
 * Tips ledger row vs Transactions filters + merged table (Charge embeds absorbed TX_TIP).
 * Orphan tips match as `Tip`; absorbed tips follow parent Charge visibility.
 */
function tipsLedgerEntryMatchesTableFilters(
  e: TipsCollectedLedgerEntry,
  ctx: BizTxTableFilterCtx,
  mergedRows: TxDisplayRow[]
): boolean {
  const syn: TxDisplayRow = {
    id: e.displayId,
    indexerTxId: e.indexerTxId,
    type: 'Tip',
    dateStr: '',
    time: '',
    subtotal: 0,
    tip: e.usdcAmount,
    total: e.usdcAmount,
    method: 'Tip',
    ctreeAmount: 0,
    usdcAmount: e.usdcAmount,
    source: 'NFC',
    beamioTag: e.beamioTag,
    status: 'Settled',
    hash: e.hash,
    terminal: e.terminal,
    bUnits: 0,
    originalPaymentHash: e.parentChargeIndexerTxLower || undefined,
    raw: {},
  }
  const parentLower = e.parentChargeIndexerTxLower
  if (ctx.txFilterType === 'Charge') {
    if (!parentLower) return false
    const p = mergedRows.find(
      (r) =>
        r.type === 'Charge' && !txDisplayRowIsIndexerBunitLedger(r) && r.indexerTxId.toLowerCase() === parentLower
    )
    if (!p) return false
    return bizTxMatchesTransactionTableFilters(p, { ...ctx, txFilterType: 'Charge' })
  }
  if (ctx.txFilterType === 'Tip') {
    if (parentLower) return false
    return bizTxMatchesTransactionTableFilters(syn, { ...ctx, txFilterType: 'Tip' })
  }
  if (parentLower) {
    const p = mergedRows.find(
      (r) =>
        r.type === 'Charge' && !txDisplayRowIsIndexerBunitLedger(r) && r.indexerTxId.toLowerCase() === parentLower
    )
    if (p) return bizTxMatchesTransactionTableFilters(p, ctx)
  }
  return bizTxMatchesTransactionTableFilters(syn, ctx)
}

/** Recursively stringify bigint / nested Result-like objects for JSON display */
function jsonSafeIndexerValue(v: unknown): unknown {
  if (v === null || v === undefined) return v
  if (typeof v === 'bigint') return v.toString()
  if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(jsonSafeIndexerValue)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(o)) {
      if (/^\d+$/.test(key)) continue
      out[key] = jsonSafeIndexerValue(o[key])
    }
    return out
  }
  return String(v)
}

function indexerAddrToJson(a: unknown): string {
  if (a === null || a === undefined || a === ethers.ZeroAddress) return ethers.ZeroAddress
  if (typeof a === 'string' && ethers.isAddress(a)) return ethers.getAddress(a)
  try {
    return ethers.getAddress(String(a))
  } catch {
    return typeof a === 'string' ? a : ethers.ZeroAddress
  }
}

function indexerBytes32ToHex(b: unknown): string {
  if (b === null || b === undefined) return ethers.ZeroHash
  if (typeof b === 'string' && b.startsWith('0x')) return b
  try {
    return ethers.hexlify(b as ethers.BytesLike)
  } catch {
    return ethers.ZeroHash
  }
}

function indexerUintToDecimalString(u: unknown): string {
  if (u === null || u === undefined) return '0'
  if (typeof u === 'bigint') return u.toString()
  if (typeof u === 'number') return Number.isFinite(u) ? String(Math.trunc(u)) : '0'
  if (typeof u === 'string' && /^\d+$/.test(u)) return u
  try {
    return BigInt(String(u)).toString()
  } catch {
    return '0'
  }
}

/**
 * Normalize indexer `TransactionMeta` from ABI tuple (array), ethers Result, or readme object.
 * Order matches TX_PAGE_TUPLE: requestAmountFiat6, requestAmountUSDC6, currencyFiat, …
 */
function parseIndexerMetaTuple(meta: unknown): {
  requestAmountFiat6: string
  requestAmountUSDC6: string
  currencyFiat: string
  discountAmountFiat6: string
  discountRateBps: string
  taxAmountFiat6: string
  taxRateBps: string
  afterNotePayer: string
  afterNotePayee: string
} {
  const empty = () => ({
    requestAmountFiat6: '0',
    requestAmountUSDC6: '0',
    currencyFiat: '0',
    discountAmountFiat6: '0',
    discountRateBps: '0',
    taxAmountFiat6: '0',
    taxRateBps: '0',
    afterNotePayer: '',
    afterNotePayee: '',
  })
  if (meta == null) return empty()
  if (Array.isArray(meta)) {
    const m = meta
    return {
      requestAmountFiat6: indexerUintToDecimalString(m[0]),
      requestAmountUSDC6: indexerUintToDecimalString(m[1]),
      currencyFiat: indexerUintToDecimalString(m[2]),
      discountAmountFiat6: indexerUintToDecimalString(m[3]),
      discountRateBps: indexerUintToDecimalString(m[4]),
      taxAmountFiat6: indexerUintToDecimalString(m[5]),
      taxRateBps: indexerUintToDecimalString(m[6]),
      afterNotePayer: typeof m[7] === 'string' ? m[7] : String(m[7] ?? ''),
      afterNotePayee: typeof m[8] === 'string' ? m[8] : String(m[8] ?? ''),
    }
  }
  if (typeof meta === 'object') {
    const o = meta as Record<string, unknown>
    const num = (name: string, idx: number) => indexerUintToDecimalString(o[name] ?? o[String(idx)])
    const str = (name: string, idx: number) => {
      const v = o[name] ?? o[String(idx)]
      return typeof v === 'string' ? v : String(v ?? '')
    }
    if (
      o.requestAmountFiat6 !== undefined ||
      o.requestAmountUSDC6 !== undefined ||
      o.currencyFiat !== undefined ||
      o['0'] !== undefined
    ) {
      return {
        requestAmountFiat6: num('requestAmountFiat6', 0),
        requestAmountUSDC6: num('requestAmountUSDC6', 1),
        currencyFiat: num('currencyFiat', 2),
        discountAmountFiat6: num('discountAmountFiat6', 3),
        discountRateBps: num('discountRateBps', 4),
        taxAmountFiat6: num('taxAmountFiat6', 5),
        taxRateBps: num('taxRateBps', 6),
        afterNotePayer: str('afterNotePayer', 7),
        afterNotePayee: str('afterNotePayee', 8),
      }
    }
  }
  return empty()
}

/** `TransactionMeta.currencyFiat` when it matches `USDC` in `BEAMIO_FIAT_CURRENCY_LABELS` (readme BeamioCurrency). */
function tipTxDisplayRowToLedgerAmounts(tx: Pick<TxDisplayRow, 'raw' | 'usdcAmount' | 'total'>): {
  finalRequestFiat6Human: number
  finalRequestUsdc6Human: number
  currencyFiat: number
  usdcAmount: number
} {
  const raw = tx.raw as Record<string, unknown>
  const finalRequestFiat6Human = parseIndexerUintE6Field(raw.finalRequestAmountFiat6)
  const finalRequestUsdc6Human = parseIndexerUintE6Field(raw.finalRequestAmountUSDC6)
  const meta = parseIndexerMetaTuple(raw.meta)
  let cfi = Number.parseInt(meta.currencyFiat, 10)
  if (!Number.isFinite(cfi) || cfi < 0) cfi = -1
  const usdcAmount =
    finalRequestUsdc6Human > 0
      ? finalRequestUsdc6Human
      : finalRequestFiat6Human > 0
        ? finalRequestFiat6Human
        : Number.isFinite(tx.usdcAmount)
          ? tx.usdcAmount
          : Number.isFinite(tx.total)
            ? tx.total
            : 0
  return { finalRequestFiat6Human, finalRequestUsdc6Human, currencyFiat: cfi, usdcAmount }
}

/**
 * Map indexer paged tuple → readme `Transaction`-shaped JSON (CoNETIndexTaskdiamond readme).
 * `route` is not part of TX_PAGE_TUPLE; emitted as [].
 */
function indexerPageTupleToTransactionJson(tx: {
  id: unknown
  originalPaymentHash?: unknown
  chainId?: unknown
  txCategory?: unknown
  displayJson?: unknown
  timestamp?: unknown
  payer?: unknown
  payee?: unknown
  finalRequestAmountFiat6?: unknown
  finalRequestAmountUSDC6?: unknown
  isAAAccount?: unknown
  fees?: unknown
  meta?: unknown
  exists?: unknown
  topAdmin?: unknown
  subordinate?: unknown
}): Record<string, unknown> {
  const fees = tx.fees !== undefined && tx.fees !== null ? jsonSafeIndexerValue(tx.fees) : {}
  const meta = parseIndexerMetaTuple(tx.meta)
  return {
    id: indexerBytes32ToHex(tx.id),
    originalPaymentHash: indexerBytes32ToHex(tx.originalPaymentHash),
    chainId: indexerUintToDecimalString(tx.chainId),
    txCategory: indexerBytes32ToHex(tx.txCategory),
    displayJson: typeof tx.displayJson === 'string' ? tx.displayJson : '',
    timestamp: indexerUintToDecimalString(tx.timestamp),
    payer: indexerAddrToJson(tx.payer),
    payee: indexerAddrToJson(tx.payee),
    finalRequestAmountFiat6: indexerUintToDecimalString(tx.finalRequestAmountFiat6),
    finalRequestAmountUSDC6: indexerUintToDecimalString(tx.finalRequestAmountUSDC6),
    isAAAccount: Boolean(tx.isAAAccount),
    route: [],
    topAdmin: indexerAddrToJson(tx.topAdmin),
    subordinate: indexerAddrToJson(tx.subordinate),
    fees,
    meta,
    exists: Boolean(tx.exists),
  }
}

function transactionFullToFetchedRow(full: unknown): IndexerFetchedTxRow | null {
  if (full == null || typeof full !== 'object') return null
  const f = full as Record<string, unknown>
  const idHex = indexerBytes32ToHex(f.id)
  if (!idHex || idHex === ethers.ZeroHash) return null
  const feesRec =
    f.fees && typeof f.fees === 'object' ? (f.fees as Record<string, unknown>) : {}
  const bServiceUnits6 = indexerUintToDecimalString(feesRec.bServiceUnits6 ?? 0)
  const txTop = f.topAdmin
  const txSub = f.subordinate
  const topAdmin =
    typeof txTop === 'string' && ethers.isAddress(txTop) && txTop !== ethers.ZeroAddress
      ? ethers.getAddress(txTop)
      : undefined
  const subordinate =
    typeof txSub === 'string' && ethers.isAddress(txSub) && txSub !== ethers.ZeroAddress
      ? ethers.getAddress(txSub)
      : undefined
  const txLike = {
    id: f.id,
    originalPaymentHash: f.originalPaymentHash,
    chainId: f.chainId,
    txCategory: f.txCategory,
    displayJson: f.displayJson,
    timestamp: f.timestamp,
    payer: f.payer,
    payee: f.payee,
    finalRequestAmountFiat6: f.finalRequestAmountFiat6,
    finalRequestAmountUSDC6: f.finalRequestAmountUSDC6,
    isAAAccount: f.isAAAccount,
    fees: f.fees,
    meta: f.meta,
    exists: true,
    topAdmin: f.topAdmin,
    subordinate: f.subordinate,
  }
  const raw = indexerPageTupleToTransactionJson(txLike as Parameters<typeof indexerPageTupleToTransactionJson>[0])
  return {
    id: idHex,
    originalPaymentHash: indexerBytes32ToHex(f.originalPaymentHash),
    txCategory: indexerBytes32ToHex(f.txCategory),
    displayJson: typeof f.displayJson === 'string' ? f.displayJson : '',
    timestamp: indexerUintToDecimalString(f.timestamp),
    payer: indexerAddrToJson(f.payer),
    payee: indexerAddrToJson(f.payee),
    finalRequestAmountFiat6: indexerUintToDecimalString(f.finalRequestAmountFiat6),
    finalRequestAmountUSDC6: indexerUintToDecimalString(f.finalRequestAmountUSDC6),
    meta: f.meta as IndexerFetchedTxRow['meta'],
    topAdmin,
    subordinate,
    bServiceUnits6,
    raw,
  }
}

function transactionFullMatchesUserWatch(full: Record<string, unknown>, watchLower: Set<string>): boolean {
  for (const c of [full.payer, full.payee, full.topAdmin, full.subordinate]) {
    if (c == null) continue
    const a = typeof c === 'string' ? c : String(c)
    if (!ethers.isAddress(a) || a === ethers.ZeroAddress) continue
    if (watchLower.has(ethers.getAddress(a).toLowerCase())) return true
  }
  return false
}

function mapIndexerFetchedRowsToDisplay(rows: IndexerFetchedTxRow[]): TxDisplayRow[] {
  return rows.map((tx, idx) => {
    const bUnits = Number(tx.bServiceUnits6 ?? '0') / 1_000_000
    const cat = String(tx.txCategory ?? '')
    const catLower = cat.toLowerCase()
    const isTip =
      cat === TX_MERCHANT_PAY_TIP_UPDATED || catLower === TX_TIP_LEDGER_CATEGORY.toLowerCase()
    const isTopUp = INDEXER_TX_TOPUP_CATEGORIES.has(cat as `0x${string}`)
    const type: TxDisplayRow['type'] = isTip ? 'Tip' : isTopUp ? 'In-Store Top-Up' : 'Charge'
    const total6 = Number(tx.finalRequestAmountUSDC6 ?? '0') / 1_000_000
    const totalFiat = Number(tx.finalRequestAmountFiat6 ?? '0') / 1_000_000
    let total = total6 > 0 ? total6 : totalFiat
    let display: { handle?: string; source?: string; title?: string; terminal?: string } = {}
    try {
      if (tx.displayJson) display = JSON.parse(tx.displayJson) as typeof display
    } catch { /* ignore */ }
    const handle = display.handle?.replace(/^@/, '') ? `@${display.handle!.replace(/^@/, '')}` : null
    const srcLower = (display.source ?? '').toLowerCase()
    const source: 'APP' | 'NFC' =
      srcLower.includes('nfc') || srcLower === 'container' || srcLower === 'open-container' ? 'NFC' : 'APP'
    const terminal = display.terminal ?? (display.handle ? display.handle : '—')
    const d = new Date(Number(tx.timestamp ?? 0) * 1000)
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    const hashShort = typeof tx.id === 'string' && tx.id.length >= 10 ? `${tx.id.slice(0, 6)}...${tx.id.slice(-4)}` : '—'
    const indexerTxId = (() => {
      const s = String(tx.id)
      if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase()
      try {
        return ethers.hexlify(s as ethers.BytesLike).toLowerCase()
      } catch {
        return s.toLowerCase()
      }
    })()
    let method = 'USDC'
    let ctreeAmount = 0
    let usdcAmount = total
    if (isTopUp) {
      method = 'Issued $CTree'
      const usdcPaid = Number(BigInt(tx.finalRequestAmountUSDC6 ?? '0')) / 1_000_000
      const metaIssued = parseIndexerUintE6Field(parseIndexerMetaTuple(tx.meta).requestAmountFiat6)
      const issuedTree =
        metaIssued > 0 ? metaIssued : (usdcPaid > 0 ? usdcPaid : Number(tx.finalRequestAmountFiat6 ?? '0') / 1_000_000)
      ctreeAmount = issuedTree
      usdcAmount = usdcPaid
      total = issuedTree
    } else if (type === 'Charge') {
      method = total > 0 ? '$CTree or USDC' : 'USDC'
      ctreeAmount = 0
      usdcAmount = total
    } else if (isTip) {
      method = 'Tip'
      ctreeAmount = 0
      usdcAmount = total
    }
    const raw = tx.raw
    return {
      id: `TX-${1000 + rows.length - idx}`,
      indexerTxId,
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
      bUnits,
      originalPaymentHash: tx.originalPaymentHash,
      topAdmin: tx.topAdmin && tx.topAdmin !== ethers.ZeroAddress ? tx.topAdmin : undefined,
      subordinate: tx.subordinate && tx.subordinate !== ethers.ZeroAddress ? tx.subordinate : undefined,
      raw,
    }
  })
}

/** Indexer `Transaction.timestamp`: seconds on wire; readme allows ms — normalize to unix seconds. */
function normalizeIndexerTimestampToUnixSec(raw: unknown): number {
  let n = 0
  try {
    n = Number(typeof raw === 'bigint' ? raw : BigInt(String(raw ?? '0')))
  } catch {
    return 0
  }
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n > 1_000_000_000_000) n = Math.floor(n / 1000)
  return Math.floor(n)
}

function txDisplayRowTimestampSec(r: TxDisplayRow): number {
  return normalizeIndexerTimestampToUnixSec((r.raw as { timestamp?: unknown }).timestamp)
}

/** Display B-Units from `fees.bServiceUnits6`: Charge row + merged TX_TIP child (`tipRaw`) when present. */
function chargeDisplayRowBUnitsTotal(tx: TxDisplayRow): number {
  if (tx.type !== 'Charge') return 0
  const main = Number.isFinite(tx.bUnits) ? tx.bUnits : 0
  const tipExtra = tx.tipRaw && Number.isFinite(tx.tipRaw.bUnits) ? tx.tipRaw.bUnits : 0
  return main + tipExtra
}

/** Ingest Charge rows into the semi-permanent B-Unit ledger (excludes B-Unit indexer ledger categories). */
function txRowsToChargeBUnitLedgerEntries(rows: TxDisplayRow[]): ChargeBUnitLedgerEntry[] {
  const out: ChargeBUnitLedgerEntry[] = []
  for (const tx of rows) {
    if (tx.type !== 'Charge') continue
    if (txDisplayRowIsIndexerBunitLedger(tx)) continue
    out.push({
      indexerTxId: tx.indexerTxId.toLowerCase(),
      timestampSec: txDisplayRowTimestampSec(tx),
      bUnits: chargeDisplayRowBUnitsTotal(tx),
      terminal: typeof tx.terminal === 'string' ? tx.terminal : '—',
      displayId: tx.id,
      hash: tx.hash,
      beamioTag: tx.beamioTag,
      tipIndexerTxIdLower: (tx.tipRaw?.indexerTxId ?? '').toLowerCase(),
    })
  }
  return out
}

/** Pre-merge `Tip` rows only — accurate per TX_TIP id before `mergeTipRowsIntoParentCharges`. */
function buildTipsCollectedLedgerEntriesFromPremergeTips(rows: TxDisplayRow[]): TipsCollectedLedgerEntry[] {
  const out: TipsCollectedLedgerEntry[] = []
  const z = ethers.ZeroHash.toLowerCase()
  for (const tx of rows) {
    if (tx.type !== 'Tip') continue
    if (txDisplayRowIsIndexerBunitLedger(tx)) continue
    const oph = (tx.originalPaymentHash ?? '').toLowerCase().trim()
    const parent = oph && oph !== z ? oph : ''
    const amt = tipTxDisplayRowToLedgerAmounts(tx)
    out.push({
      indexerTxId: tx.indexerTxId.toLowerCase(),
      timestampSec: txDisplayRowTimestampSec(tx),
      finalRequestFiat6Human: amt.finalRequestFiat6Human,
      finalRequestUsdc6Human: amt.finalRequestUsdc6Human,
      currencyFiat: amt.currencyFiat,
      usdcAmount: amt.usdcAmount,
      terminal: typeof tx.terminal === 'string' ? tx.terminal : '—',
      displayId: tx.id,
      hash: tx.hash,
      beamioTag: tx.beamioTag,
      parentChargeIndexerTxLower: parent,
    })
  }
  return out
}

/**
 * After merge: orphan `Tip` rows + `Charge.tipRaw` (fills ledger when only merged inbound cache exists).
 * `useEffect` should only insert **new** ids so fetch-time premerge stays authoritative for amounts.
 */
function buildTipsCollectedLedgerEntriesFromMerged(rows: TxDisplayRow[]): TipsCollectedLedgerEntry[] {
  const out: TipsCollectedLedgerEntry[] = []
  const z = ethers.ZeroHash.toLowerCase()
  for (const tx of rows) {
    if (txDisplayRowIsIndexerBunitLedger(tx)) continue
    if (tx.type === 'Tip') {
      const oph = (tx.originalPaymentHash ?? '').toLowerCase().trim()
      const parent = oph && oph !== z ? oph : ''
      const amt = tipTxDisplayRowToLedgerAmounts(tx)
      out.push({
        indexerTxId: tx.indexerTxId.toLowerCase(),
        timestampSec: txDisplayRowTimestampSec(tx),
        finalRequestFiat6Human: amt.finalRequestFiat6Human,
        finalRequestUsdc6Human: amt.finalRequestUsdc6Human,
        currencyFiat: amt.currencyFiat,
        usdcAmount: amt.usdcAmount,
        terminal: typeof tx.terminal === 'string' ? tx.terminal : '—',
        displayId: tx.id,
        hash: tx.hash,
        beamioTag: tx.beamioTag,
        parentChargeIndexerTxLower: parent,
      })
    }
    if (tx.type === 'Charge' && tx.tipRaw && tx.tip > 0) {
      const tr = tx.tipRaw
      if (txDisplayRowIsIndexerBunitLedger(tr as TxDisplayRow)) continue
      const oph = (tr.originalPaymentHash ?? '').toLowerCase().trim()
      const parent = oph && oph !== z ? oph : ''
      const amt = tipTxDisplayRowToLedgerAmounts(tr as TxDisplayRow)
      out.push({
        indexerTxId: tr.indexerTxId.toLowerCase(),
        timestampSec: txDisplayRowTimestampSec(tr as TxDisplayRow),
        finalRequestFiat6Human: amt.finalRequestFiat6Human,
        finalRequestUsdc6Human: amt.finalRequestUsdc6Human,
        currencyFiat: amt.currencyFiat,
        usdcAmount: amt.usdcAmount,
        terminal: typeof tr.terminal === 'string' ? tr.terminal : '—',
        displayId: tr.id,
        hash: tr.hash,
        beamioTag: tr.beamioTag,
        parentChargeIndexerTxLower: parent,
      })
    }
  }
  return out
}

/** Drop `tipRaw` for nesting under parent (TX_TIP child row). */
function txDisplayRowWithoutTipRaw(r: TxDisplayRow): TxDisplayRowCore {
  const { tipRaw: _t, ...rest } = r
  return rest
}

/**
 * TX_TIP rows: `originalPaymentHash` = parent main payment `id` (readme).
 * Merge into parent Charge: set `tipRaw`, `tip`, `total` = subtotal + tip; remove standalone tip rows.
 */
function mergeTipRowsIntoParentCharges(rows: TxDisplayRow[]): TxDisplayRow[] {
  const zero = ethers.ZeroHash.toLowerCase()
  const charges = rows.filter((r) => r.type === 'Charge')
  const tips = rows.filter((r) => r.type === 'Tip')
  const rest = rows.filter((r) => r.type !== 'Charge' && r.type !== 'Tip')
  const absorbedTipKeys = new Set<string>()
  const mergedCharges: TxDisplayRow[] = []

  for (const p of charges) {
    const pid = p.indexerTxId.toLowerCase()
    const matching = tips.filter((t) => {
      const oph = (t.originalPaymentHash ?? '').toLowerCase().trim()
      return oph && oph !== zero && oph === pid
    })
    if (matching.length === 0) {
      mergedCharges.push(p)
      continue
    }
    for (const t of matching) absorbedTipKeys.add(t.indexerTxId.toLowerCase())
    const tipTotalUSDC = matching.reduce((s, t) => s + (Number.isFinite(t.usdcAmount) ? t.usdcAmount : 0), 0)
    const [primaryTip] = [...matching].sort((a, b) => txDisplayRowTimestampSec(b) - txDisplayRowTimestampSec(a))
    mergedCharges.push({
      ...p,
      tipRaw: txDisplayRowWithoutTipRaw(primaryTip),
      tip: tipTotalUSDC,
      total: p.subtotal + tipTotalUSDC,
    })
  }

  const orphanTips = tips.filter((t) => !absorbedTipKeys.has(t.indexerTxId.toLowerCase()))
  const combined = [...rest, ...mergedCharges, ...orphanTips]
  combined.sort((a, b) => {
    const ta = txDisplayRowTimestampSec(a)
    const tb = txDisplayRowTimestampSec(b)
    if (tb !== ta) return tb - ta
    return b.indexerTxId.localeCompare(a.indexerTxId)
  })
  return combined
}

function mergeRenumberTxDisplays(fetched: TxDisplayRow[], cachedInbound: TxDisplayRow[]): TxDisplayRow[] {
  const byId = new Map<string, TxDisplayRow>()
  for (const r of fetched) byId.set(r.indexerTxId.toLowerCase(), r)
  for (const r of cachedInbound) {
    const k = r.indexerTxId.toLowerCase()
    if (!byId.has(k)) byId.set(k, r)
  }
  const list = [...byId.values()].sort((a, b) => {
    const ta = Number(BigInt(String((a.raw as { timestamp?: string }).timestamp ?? '0')))
    const tb = Number(BigInt(String((b.raw as { timestamp?: string }).timestamp ?? '0')))
    if (tb !== ta) return tb - ta
    return b.indexerTxId.localeCompare(a.indexerTxId)
  })
  const capped = list.slice(0, 80)
  return capped.map((r, idx) => ({ ...r, id: `TX-${1000 + capped.length - idx}` }))
}

function loadInboundTxDisplayCache(eoaLower: string): TxDisplayRow[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(`${BIZ_CACHE_PREFIX}${INDEXER_INBOUND_TX_CACHE_KEY(eoaLower)}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { rows?: TxDisplayRow[] }
    return Array.isArray(parsed?.rows) ? parsed.rows : []
  } catch {
    return []
  }
}

function saveInboundTxDisplayCache(eoaLower: string, rows: TxDisplayRow[]) {
  if (typeof window === 'undefined') return
  try {
    const capped = rows.slice(0, 80)
    window.localStorage.setItem(
      `${BIZ_CACHE_PREFIX}${INDEXER_INBOUND_TX_CACHE_KEY(eoaLower)}`,
      JSON.stringify({ rows: capped })
    )
  } catch {
    /* quota */
  }
}

/** Parse indexer / readme JSON uint string (wei e6) → decimal number */
function parseIndexerUintE6Field(v: unknown): number {
  if (v === null || v === undefined) return 0
  const s = typeof v === 'bigint' ? v.toString() : typeof v === 'string' ? v : String(v)
  try {
    return Number(BigInt(s)) / 1_000_000
  } catch {
    return 0
  }
}

/** `TransactionMeta.currencyFiat` / `BeamioCurrency.CurrencyType` */
const BEAMIO_FIAT_CURRENCY_LABELS = ['CAD', 'USD', 'JPY', 'CNY', 'USDC', 'HKD', 'EUR', 'SGD', 'TWD'] as const
/** Index of `USDC` in `BEAMIO_FIAT_CURRENCY_LABELS` — tips with other `currencyFiat` are not “USDC Payments” (readme). */
const BEAMIO_CURRENCY_TYPE_USDC = BEAMIO_FIAT_CURRENCY_LABELS.indexOf('USDC')
function beamioFiatCurrencyLabel(code: unknown): string {
  const n = typeof code === 'number' && Number.isFinite(code) ? code : Number(code)
  if (!Number.isFinite(n) || n < 0 || n >= BEAMIO_FIAT_CURRENCY_LABELS.length) return 'CAD'
  return BEAMIO_FIAT_CURRENCY_LABELS[n]
}

/** `TransactionMeta.discountRateBps` → display percent (1000 bps = 10%). Returns null if absent or zero. */
function discountRateBpsToPercentOffLabel(bpsRaw: unknown): string | null {
  const n = typeof bpsRaw === 'bigint' ? Number(bpsRaw) : typeof bpsRaw === 'string' ? Number.parseInt(bpsRaw, 10) : Number(bpsRaw)
  if (!Number.isFinite(n) || n <= 0) return null
  const pct = n / 100
  if (!Number.isFinite(pct) || pct <= 0) return null
  if (Number.isInteger(pct)) return String(pct)
  const rounded = Math.round(pct * 10) / 10
  return String(rounded).replace(/\.0$/, '')
}

const BEAMIO_USER_CARD_OWNERSHIP_ABI = [
  'function getOwnership(address user) view returns (uint256 pt, tuple(uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)',
  'function getOwnershipByEOA(address userEOA) view returns (uint256 pt, tuple(uint256 tokenId, uint256 attribute, uint256 tierIndexOrMax, uint256 expiry, bool isExpired)[] nfts)',
  'function activeMembershipId(address user) view returns (uint256)',
  'function tiers(uint256) view returns (uint256 minUsdc6, uint256 attr, uint256 tierExpirySeconds, bool upgradeByBalance)',
] as const

function normalizeNftBackgroundHex(input: string | undefined | null): string | null {
  if (input == null || typeof input !== 'string') return null
  const s = input.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const h = s.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
  }
  return null
}

async function readBeamioUserCardTiersLength(card: ethers.Contract): Promise<number> {
  const c = card as ethers.Contract & { tiers: (i: bigint) => Promise<unknown> }
  let n = 0
  for (let i = 0; i < 64; i++) {
    try {
      await c.tiers(BigInt(i))
      n = i + 1
    } catch {
      break
    }
  }
  return n
}

/** Matches BeamioUserCard `_findBestValidMembership`: max `tiers[tierIdx].minUsdc6` among trackable NFTs. */
async function pickInfraTierTokenIdByMaxMinUsdc6(
  card: ethers.Contract,
  nfts: readonly { tokenId: bigint; tierIndexOrMax: bigint; isExpired: boolean }[]
): Promise<bigint | null> {
  const MAX = ethers.MaxUint256
  const alive = nfts.filter((n) => !n.isExpired && n.tokenId !== 0n)
  if (alive.length === 0) return null
  const tiersLen = await readBeamioUserCardTiersLength(card)
  const c = card as ethers.Contract & { tiers: (i: bigint) => Promise<[bigint, bigint, bigint, boolean]> }
  let bestId: bigint | null = null
  let bestMin = -1n
  let fallbackId: bigint | null = null
  for (const n of alive) {
    const tierIdx = n.tierIndexOrMax
    if (tierIdx === MAX || tierIdx >= BigInt(tiersLen)) {
      if (fallbackId === null) fallbackId = n.tokenId
      continue
    }
    let minU: bigint
    try {
      const row = await c.tiers(tierIdx)
      minU = BigInt(row[0].toString())
    } catch {
      continue
    }
    if (bestId === null || minU > bestMin) {
      bestId = n.tokenId
      bestMin = minU
    }
  }
  if (bestId != null) return bestId
  return fallbackId
}

/** Same account the card uses for active membership: payer AA, or EOA → UserCard._aaFactory path AA. */
async function resolveMembershipAccountForCard(
  payerAddress: string,
  provider: ethers.Provider,
  isContract: boolean
): Promise<string | null> {
  const norm = ethers.getAddress(payerAddress)
  if (isContract) return norm
  try {
    return await resolveBeamioAaForEoaWithFallback(provider, norm)
  } catch {
    return null
  }
}

async function resolveInfraTierTokenIdForPayer(
  payerAddress: string,
  provider: ethers.Provider,
  cardAddress: string,
  isContract: boolean,
  nfts: { tokenId: bigint; tierIndexOrMax: bigint; isExpired: boolean }[]
): Promise<bigint | null> {
  const card = new ethers.Contract(cardAddress, BEAMIO_USER_CARD_OWNERSHIP_ABI, provider)
  const acct = await resolveMembershipAccountForCard(payerAddress, provider, isContract)
  if (acct) {
    try {
      const raw = await card.activeMembershipId(acct)
      const tid = BigInt(String(raw))
      if (tid > 0n) return tid
    } catch {
      /* fall through */
    }
  }
  return await pickInfraTierTokenIdByMaxMinUsdc6(card, nfts)
}

function infraTierCapsulePresentation(bgHex: string | undefined): { wrap: React.CSSProperties; fg: string } {
  const hex = bgHex ? normalizeNftBackgroundHex(bgHex) ?? undefined : undefined
  if (!hex) {
    return {
      wrap: {
        backgroundColor: 'color-mix(in srgb, rgb(16 185 129) 14%, white)',
        borderColor: 'color-mix(in srgb, rgb(5 150 105) 32%, rgb(226 232 240))',
        borderWidth: 1,
        borderStyle: 'solid',
      },
      fg: 'rgb(6 95 70)',
    }
  }
  return {
    wrap: {
      backgroundColor: `color-mix(in srgb, ${hex} 24%, white)`,
      borderColor: `color-mix(in srgb, ${hex} 50%, rgb(148 163 184))`,
      borderWidth: 1,
      borderStyle: 'solid',
    },
    fg: `color-mix(in srgb, ${hex} 35%, rgb(15 23 42))`,
  }
}

async function fetchPayerInfraTierCapsuleMeta(
  payerAddress: string,
  provider: ethers.Provider,
  cardAddress: string
): Promise<{ name: string; backgroundColor?: string } | null> {
  const addr = ethers.getAddress(payerAddress)
  const card = new ethers.Contract(cardAddress, BEAMIO_USER_CARD_OWNERSHIP_ABI, provider)
  let nfts: { tokenId: bigint; tierIndexOrMax: bigint; isExpired: boolean }[] = []
  let isContract = false
  try {
    const code = await provider.getCode(addr)
    isContract = Boolean(code && code !== '0x' && code.length > 2)
    const [, rawList] = isContract
      ? ((await card.getOwnership(addr)) as unknown as [bigint, { tokenId: bigint; tierIndexOrMax: bigint; isExpired: boolean }[]])
      : ((await card.getOwnershipByEOA(addr)) as unknown as [bigint, { tokenId: bigint; tierIndexOrMax: bigint; isExpired: boolean }[]])
    nfts = (rawList ?? []).map((row) => {
      const o = row as Record<string, unknown> | unknown[]
      const tokenId =
        o != null && typeof o === 'object' && !Array.isArray(o) && o.tokenId != null
          ? BigInt(String(o.tokenId))
          : Array.isArray(o) && o[0] != null
            ? BigInt(String(o[0]))
            : 0n
      const tierIndexOrMax =
        o != null && typeof o === 'object' && !Array.isArray(o) && o.tierIndexOrMax != null
          ? BigInt(String(o.tierIndexOrMax))
          : Array.isArray(o) && o[2] != null
            ? BigInt(String(o[2]))
            : ethers.MaxUint256
      const isExpired =
        o != null && typeof o === 'object' && !Array.isArray(o)
          ? Boolean(o.isExpired)
          : Array.isArray(o)
            ? Boolean(o[4])
            : false
      return { tokenId, tierIndexOrMax, isExpired }
    })
  } catch {
    return null
  }
  const tid = await resolveInfraTierTokenIdForPayer(addr, provider, cardAddress, isContract, nfts)
  if (tid == null) return null
  const meta = await getNftMetadataFromApi(cardAddress, Number(tid))
  const name = (meta?.name ?? '').trim() || `Tier #${tid.toString()}`
  const bg = normalizeNftBackgroundHex(meta?.backgroundColor)
  return { name, ...(bg ? { backgroundColor: bg } : {}) }
}

/** `finalRequestAmountFiat6` is in `meta.currencyFiat`; approximate CAD using the same oracle as this page (1 CAD ≈ cadOracle USDC). Already-CAD amounts pass through. */
function approximateCadFromFinalRequestFiat6(
  finalFiatAmount: number,
  currencyLabel: string,
  cadOracle: number
): number {
  if (!Number.isFinite(finalFiatAmount) || finalFiatAmount <= 0) return 0
  if (!Number.isFinite(cadOracle) || cadOracle <= 0) return 0
  if (currencyLabel === 'CAD') return finalFiatAmount
  return finalFiatAmount / cadOracle
}

/** Tips panel CAD: prefer root `finalRequestAmountFiat6` + `currencyFiat`; USDC-denominated tips use `finalRequestAmountUSDC6` when fiat leg is zero. */
function tipsLedgerEntryApproxCad(e: TipsCollectedLedgerEntry, cadOracle: number): number {
  const label = beamioFiatCurrencyLabel(e.currencyFiat)
  if (e.finalRequestFiat6Human > 0) {
    return approximateCadFromFinalRequestFiat6(e.finalRequestFiat6Human, label, cadOracle)
  }
  if (e.currencyFiat === BEAMIO_CURRENCY_TYPE_USDC && e.finalRequestUsdc6Human > 0) {
    if (!Number.isFinite(cadOracle) || cadOracle <= 0) return 0
    return e.finalRequestUsdc6Human / cadOracle
  }
  if (e.currencyFiat < 0 && e.usdcAmount > 0 && Number.isFinite(cadOracle) && cadOracle > 0) {
    return e.usdcAmount / cadOracle
  }
  return 0
}

/** USDC Payments chip: only when `currencyFiat` is USDC; amount from `finalRequestAmountUSDC6` (readme). */
function tipsLedgerEntryUsdcPaymentHuman(e: TipsCollectedLedgerEntry): number {
  if (e.currencyFiat !== BEAMIO_CURRENCY_TYPE_USDC) return 0
  return Number.isFinite(e.finalRequestUsdc6Human) ? e.finalRequestUsdc6Human : 0
}

function tipsLedgerEntryNonUsdcCadOnly(e: TipsCollectedLedgerEntry, cadOracle: number): number {
  if (e.currencyFiat === BEAMIO_CURRENCY_TYPE_USDC) return 0
  return tipsLedgerEntryApproxCad(e, cadOracle)
}

/** Append " Card" when the display name does not already end with "Card" (case-insensitive). */
function tierDisplayNameWithCardSuffix(rawName: string): string {
  const t = rawName.trim()
  if (!t) return 'Membership Card'
  if (/card$/i.test(t)) return t
  return `${t} Card`
}

/** Tier `minUsdc6` (6-decimal fixed) with card global `currency` label */
function formatMinUsdc6WithCurrencyLabel(minUsdc6: bigint, currencyType: number): string {
  const num = amountE6ToDisplayNumber(minUsdc6)
  const formatted = num.toLocaleString(undefined, { maximumFractionDigits: 6 })
  return `${formatted} ${beamioFiatCurrencyLabel(currencyType)}`
}

/** Unified Base overview feeder: 6s interval, single batch to reduce RPC load (Overview + Staff tabs). */
const FEEDER_INTERVAL_MS = 6_000;
/** Tabs where the feeder runs; other tabs do not start this interval (avoids duplicate RPC with per-control effects). */
const BIZ_OVERVIEW_FEEDER_TABS = new Set(['Overview', 'Staff']);

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
        <span className={`text-[11px] font-mono font-bold bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm truncate leading-none inline-flex items-center min-w-0 ${hasAddress ? bizUiPrimaryAccent : 'text-slate-400'}`}>{address}</span>
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

/** Fixed to `BeamioCurrency.CurrencyType.CAD` (enum index 0). See `src/BeamioUserCard/BeamioCurrency.sol`. */
const CARD_ISSUANCE_BEAMIO_CURRENCY = 'CAD' as const;
const CARD_ISSUANCE_MIN_TOPUP_MIN = 10;
const CARD_ISSUANCE_MAX_TOPUP_MAX = 1000;
/** Default maximum top-up (whole dollars only, no decimals). */
const CARD_ISSUANCE_MAX_TOPUP_DEFAULT = 100;
/** Default minimum top-up (whole dollars only, no decimals). */
const CARD_ISSUANCE_MIN_TOPUP_DEFAULT = 10;
/** Max length for Card Issuance configuration text (card description, tier description, etc.). */
const CARD_ISSUANCE_CONFIGURATION_MAX_CHARS = 200;

const CARD_ISSUANCE_FACTORY_LATEST_ABI = ['function latestCardOfOwner(address) view returns (address)'] as const;

/** Prefer factory.latestCardOfOwner(AA) then EOA; fallback to last entry from merged cardsOfOwner list. */
async function pickPrimaryIssuedCardAddressForBiz(
  profile: { aaAccount?: string | null; keyID?: string | null },
  ownedCards: UserCardInfo[],
  provider: ethers.Provider
): Promise<string | null> {
  if (!ownedCards.length) return null;
  const setAddrs = new Set(ownedCards.map((c) => c.cardAddress.toLowerCase()));
  try {
    const factory = new ethers.Contract(BASE_CARD_FACTORY, CARD_ISSUANCE_FACTORY_LATEST_ABI, provider);
    const aa = profile?.aaAccount?.trim();
    const eoa = profile?.keyID?.trim();
    for (const owner of [aa, eoa]) {
      if (!owner || !ethers.isAddress(owner)) continue;
      const lc = await factory.latestCardOfOwner(ethers.getAddress(owner));
      if (lc && lc !== ethers.ZeroAddress) {
        const a = ethers.getAddress(lc);
        if (setAddrs.has(a.toLowerCase())) return a;
      }
    }
  } catch {
    /* use fallback */
  }
  return ownedCards[ownedCards.length - 1]?.cardAddress ?? null;
}

/** On-chain `BeamioUserCard.upgradeType()` (fixed at deploy). Labels align with Card Issuance Setup form. */
const CARD_ISSUANCE_UPGRADE_TYPE_UI: Record<0 | 1 | 2, { title: string; detail: string }> = {
  0: {
    title: 'Single Top-up',
    detail: 'Single top-up or redeem amount reaches the next tier threshold.',
  },
  1: {
    title: 'Current Balance',
    detail: 'Total balance reaches the next tier threshold.',
  },
  2: {
    title: 'Cumulative Spend',
    detail: 'When cumulative spending reaches the next tier threshold.',
  },
};

/** Card Identity — merchant program categories (aligned with market Example horizontal chips) */
type CardIssuanceCategoryOption = {
  id: string;
  label: string;
  Icon: LucideIcon;
  circleClass: string;
};

const CARD_ISSUANCE_CATEGORY_OPTIONS: CardIssuanceCategoryOption[] = [
  { id: 'travel', label: 'Travel', Icon: Plane, circleClass: 'bg-blue-50 text-blue-600' },
  { id: 'gaming', label: 'Gaming', Icon: Gamepad2, circleClass: 'bg-purple-50 text-purple-600' },
  { id: 'shopping', label: 'Shopping', Icon: ShoppingBag, circleClass: 'bg-orange-50 text-orange-600' },
  { id: 'food', label: 'Food', Icon: UtensilsCrossed, circleClass: 'bg-red-50 text-red-600' },
  { id: 'movies', label: 'Movies', Icon: Clapperboard, circleClass: 'bg-emerald-50 text-emerald-600' },
];

type CardIssuanceTierRule = 'single' | 'cumulative' | 'balance';
type CardIssuanceTierPreset = 'silver' | 'gold' | 'platinum' | 'custom';
type CardIssuanceTierRow = {
  id: string;
  name: string;
  preset: CardIssuanceTierPreset;
  threshold: string;
  discountPercent: string;
  /** Optional ERC-1155 tier metadata description; omitted on-chain when empty. */
  tierDescription: string;
  /** When true, tier description textarea is shown (opened via +). */
  tierDescriptionOpen: boolean;
};
const defaultCardIssuanceTiers = (): CardIssuanceTierRow[] => [
  { id: 'tier-silver', name: 'Silver', preset: 'silver', threshold: '10', discountPercent: '5', tierDescription: '', tierDescriptionOpen: false },
  { id: 'tier-gold', name: 'Gold', preset: 'gold', threshold: '50', discountPercent: '7.5', tierDescription: '', tierDescriptionOpen: false },
  { id: 'tier-platinum', name: 'Platinum', preset: 'platinum', threshold: '100', discountPercent: '10', tierDescription: '', tierDescriptionOpen: false },
];
const CardIssuanceTierIdentityIcon = ({ preset }: { preset: CardIssuanceTierPreset }) => {
  const box = 'h-10 w-10 rounded-xl flex items-center justify-center shrink-0';
  if (preset === 'silver') {
    return (
      <div className={`${box} bg-slate-200`}>
        <Star className="w-5 h-5 text-slate-500" strokeWidth={2} aria-hidden />
      </div>
    );
  }
  if (preset === 'gold') {
    return (
      <div className={`${box} bg-amber-100`}>
        <Medal className="w-5 h-5 text-amber-500" strokeWidth={2} aria-hidden />
      </div>
    );
  }
  if (preset === 'platinum') {
    return (
      <div className={`${box} bg-blue-100`}>
        <Gem className="w-5 h-5 text-blue-600" strokeWidth={2} aria-hidden />
      </div>
    );
  }
  return (
    <div className={`${box} bg-sky-100`}>
      <Sparkles className="w-5 h-5 text-sky-600" strokeWidth={2} aria-hidden />
    </div>
  );
};

export default function MerchantOS() {
 const { beamio, profiles, myAddress, setProfiles } = useDaemonContext();
 const navigate = useNavigate();
 const [activeTab, setActiveTab] = useState('Overview');
 const [cardIssuanceProgramName, setCardIssuanceProgramName] = useState('VERRA');
 const [cardIssuanceCurrencySymbol, setCardIssuanceCurrencySymbol] = useState('$VERRA');
 const [cardIssuanceMinTopup, setCardIssuanceMinTopup] = useState(String(CARD_ISSUANCE_MIN_TOPUP_DEFAULT));
 const [cardIssuanceMaxTopup, setCardIssuanceMaxTopup] = useState(String(CARD_ISSUANCE_MAX_TOPUP_DEFAULT));
 const [cardIssuanceTierRule, setCardIssuanceTierRule] = useState<CardIssuanceTierRule>('single');
 const [cardIssuanceTiers, setCardIssuanceTiers] = useState<CardIssuanceTierRow[]>(() => defaultCardIssuanceTiers());
 const [cardIssuanceShareImageUrl, setCardIssuanceShareImageUrl] = useState('');
 const [cardIssuanceShareImageUploading, setCardIssuanceShareImageUploading] = useState(false);
 /** Single category id (e.g. travel); stored in metadata `shareTokenMetadata.categories` as one-element array */
 const [cardIssuanceCategoryId, setCardIssuanceCategoryId] = useState<string>('');
 /** Card-level metadata description (`shareTokenMetadata.description`). */
 const [cardIssuanceDescription, setCardIssuanceDescription] = useState('');
 const [cardIssuanceCreateLoading, setCardIssuanceCreateLoading] = useState(false);
 const [cardIssuanceCreateError, setCardIssuanceCreateError] = useState('');
  const [cardIssuanceCreateResult, setCardIssuanceCreateResult] = useState<{ cardAddress: string; hash?: string } | null>(
    null
  );
  const [cardIssuanceCategoryIndexSummary, setCardIssuanceCategoryIndexSummary] = useState<string | null>(null);
  const [cardIssuanceOwnerAdminNotice, setCardIssuanceOwnerAdminNotice] = useState<{
    kind: 'ok' | 'warn';
    text: string;
  } | null>(null);
 const cardIssuanceIconFileRef = useRef<HTMLInputElement>(null);
 const [cardIssuanceOnchainFetch, setCardIssuanceOnchainFetch] = useState<'idle' | 'loading' | 'done'>('idle');
 const [cardIssuanceExistingCard, setCardIssuanceExistingCard] = useState<{
   cardAddress: string;
   userCard: UserCardInfo;
   meta: CardMetadataFromUri | null;
   /** On-chain `upgradeType`: 0 | 1 | 2 */
   upgradeType: number;
 } | null>(null);
 const [cardIssuanceOnChainRefreshNonce, setCardIssuanceOnChainRefreshNonce] = useState(0);
 /** Profile is owner of ≥1 BeamioUserCard (via factory / cardsOfOwner); Staff tab hides «Smart Terminal Locked» for issuers. */
 const [profileOwnsIssuedBeamioCard, setProfileOwnsIssuedBeamioCard] = useState(false);
 const [profileOwnsIssuedBeamioCardFetched, setProfileOwnsIssuedBeamioCardFetched] = useState(false);
 /** Primary BeamioUserCard owned by profile (factory / cardsOfOwner); Staff terminals + registration use this instead of infra when set. */
 const [merchantOwnCardAddress, setMerchantOwnCardAddress] = useState<string | null>(null);
 const cardIssuanceTierRuleLabels: Record<CardIssuanceTierRule, string> = {
   single: 'Single Top-up',
   cumulative: 'Cumulative Spend',
   balance: 'Current Balance',
 };
 const cardIssuancePreviewBrand = useMemo(() => {
   const raw = (cardIssuanceCurrencySymbol || '').trim().replace(/^\$/, '');
   return (raw || 'VERRA').toUpperCase();
 }, [cardIssuanceCurrencySymbol]);
 const cardIssuancePreviewProgram = cardIssuanceProgramName.trim() || 'VERRA';
 const bizNumericNoSpinnerClass =
   '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]';

 const buildCardIssuanceTiersPayload = useCallback((): TierMetadata[] | undefined => {
   if (cardIssuanceTiers.length === 0) return undefined;
   const valid = cardIssuanceTiers
     .filter((t) => t.name.trim() !== '')
     .map((t, idx) => {
       const raw = t.threshold.replace(/,/g, '').trim();
       const minInt = Number.parseInt(raw, 10);
       const minFloat = parseFloat(raw);
       const minUnits =
         Number.isFinite(minInt) && Number.isFinite(minFloat) && minFloat === minInt ? minInt : idx + 1;
       const discount = t.discountPercent.trim();
       const customDesc = t.tierDescription.trim();
       const discountLine = discount ? `${discount}% discount` : undefined;
       const description = customDesc || discountLine || undefined;
       return {
         minUsdc6: Math.round(minUnits * 1e6),
         name: t.name.trim(),
         ...(description ? { description } : {}),
       };
     });
   if (valid.length === 0) return undefined;
   valid.sort((a, b) => b.minUsdc6 - a.minUsdc6);
   return valid.map((t, idx) => ({
     index: idx,
     minUsdc6: String(t.minUsdc6),
     attr: idx,
     name: t.name,
     ...(t.description ? { description: t.description } : {}),
   }));
 }, [cardIssuanceTiers]);

 const handleCardIssuanceIconPick: React.ChangeEventHandler<HTMLInputElement> = useCallback(
   async (e) => {
     const input = e.currentTarget;
     const file = input.files?.[0];
     input.value = '';
     if (!file || !file.type.startsWith('image/')) return;
     const isSvg = file.type === 'image/svg+xml';
     const p0 = profiles?.[0];
     if (!p0?.privateKeyArmor) {
       setCardIssuanceCreateError('Profile not available for upload. Open Settings and ensure your wallet is ready.');
       return;
     }
     setCardIssuanceCreateError('');
     setCardIssuanceShareImageUploading(true);
     try {
       let blob: Blob = file;
       if (!isSvg && file.size > IPFS_UPLOAD_TARGET_MAX_BYTES) {
         blob = await resizeToFitLimit(file, IPFS_UPLOAD_TARGET_MAX_BYTES);
       }
       let dataUrl = await blobToDataUrl(blob);
       let hash: string | null = null;
       try {
         hash = await postToIPFS(p0, dataUrl);
       } catch (err: any) {
         const msg = err?.message ?? String(err);
         if (typeof msg === 'string' && msg.includes('413') && !isSvg) {
           blob = await compressToJpeg(blob, IPFS_UPLOAD_JPEG_RETRY_MAX_BYTES);
           dataUrl = await blobToDataUrl(blob);
           hash = await postToIPFS(p0, dataUrl);
         } else {
           throw err;
         }
       }
       if (hash) {
         setCardIssuanceShareImageUrl(`${IPFS_GET_FRAGMENT}${hash}&t=${Date.now()}`);
       } else {
         setCardIssuanceCreateError('Card icon upload failed.');
       }
     } catch (err: any) {
       setCardIssuanceCreateError(err?.message ?? 'Card icon upload failed.');
     } finally {
       setCardIssuanceShareImageUploading(false);
     }
   },
   [profiles]
 );

 const handlePublishCardIssuance = useCallback(async () => {
   setCardIssuanceCreateError('');
   setCardIssuanceCreateResult(null);
   setCardIssuanceCategoryIndexSummary(null);
   setCardIssuanceOwnerAdminNotice(null);
   const ownerRaw = (profiles?.[0]?.aaAccount ?? profiles?.[0]?.keyID ?? '').trim();
   if (!ownerRaw) {
     setCardIssuanceCreateError('Owner address not loaded. Ensure your account is ready in Settings.');
     return;
   }
   let owner: string;
   try {
     owner = ethers.getAddress(ownerRaw);
   } catch {
     setCardIssuanceCreateError('Owner address is invalid.');
     return;
   }
   const metaName = cardIssuanceProgramName.trim();
   if (!metaName) {
     setCardIssuanceCreateError('Card name is required.');
     return;
   }
   const tiersPayload = buildCardIssuanceTiersPayload();
   if (cardIssuanceTiers.length > 0 && (!tiersPayload || tiersPayload.length === 0)) {
     setCardIssuanceCreateError('Each tier must have a name.');
     return;
   }
   for (const row of cardIssuanceTiers) {
     const tierName = row.name.trim();
     if (!tierName) continue;
     const tr = row.threshold.replace(/,/g, '').trim();
     if (tr === '') {
       setCardIssuanceCreateError(`Tier "${tierName}": threshold is required.`);
       return;
     }
     const tInt = Number.parseInt(tr, 10);
     const tFloat = parseFloat(tr);
     if (!Number.isFinite(tFloat) || !Number.isFinite(tInt) || tFloat !== tInt) {
       setCardIssuanceCreateError(`Tier "${tierName}": threshold must be a whole number (no decimals).`);
       return;
     }
   }
   const minTopupRaw = cardIssuanceMinTopup.replace(/,/g, '').trim();
   if (minTopupRaw === '') {
     setCardIssuanceCreateError('Minimum top-up is required.');
     return;
   }
   const minTopupN = Number.parseInt(minTopupRaw, 10);
   const minTopupAsFloat = parseFloat(minTopupRaw);
   if (
     !Number.isFinite(minTopupAsFloat) ||
     !Number.isFinite(minTopupN) ||
     minTopupAsFloat !== minTopupN
   ) {
     setCardIssuanceCreateError('Minimum top-up must be a whole number (no decimals).');
     return;
   }
   const maxTopupRaw = cardIssuanceMaxTopup.replace(/,/g, '').trim();
   if (maxTopupRaw === '') {
     setCardIssuanceCreateError('Maximum top-up is required.');
     return;
   }
   const maxTopupN = Number.parseInt(maxTopupRaw, 10);
   const maxTopupAsFloat = parseFloat(maxTopupRaw);
   if (minTopupN < CARD_ISSUANCE_MIN_TOPUP_MIN) {
     setCardIssuanceCreateError(
       `Minimum top-up must be at least ${CARD_ISSUANCE_MIN_TOPUP_MIN} ${CARD_ISSUANCE_BEAMIO_CURRENCY}.`
     );
     return;
   }
   if (
     !Number.isFinite(maxTopupAsFloat) ||
     !Number.isFinite(maxTopupN) ||
     maxTopupAsFloat !== maxTopupN
   ) {
     setCardIssuanceCreateError('Maximum top-up must be a whole number (no decimals).');
     return;
   }
   if (maxTopupN > CARD_ISSUANCE_MAX_TOPUP_MAX) {
     setCardIssuanceCreateError(
       `Maximum top-up must not exceed ${CARD_ISSUANCE_MAX_TOPUP_MAX} ${CARD_ISSUANCE_BEAMIO_CURRENCY}.`
     );
     return;
   }
   if (minTopupN > maxTopupN) {
     setCardIssuanceCreateError('Minimum top-up cannot be greater than maximum top-up.');
     return;
   }
   setCardIssuanceCreateLoading(true);
   try {
     const res = await createBeamioCard({
       cardOwner: owner,
       currency: CARD_ISSUANCE_BEAMIO_CURRENCY,
       unitPriceHuman: '1',
       ...(cardIssuanceTierRule === 'balance'
         ? { upgradeType: 1 }
         : cardIssuanceTierRule === 'cumulative'
           ? { upgradeType: 2 }
           : {}),
       shareTokenMetadata: {
         name: metaName,
         ...(cardIssuanceCurrencySymbol.trim() ? { Symbol: cardIssuanceCurrencySymbol.trim() } : {}),
         ...(cardIssuanceShareImageUrl.trim() ? { image: cardIssuanceShareImageUrl.trim() } : {}),
         ...(cardIssuanceCategoryId.trim() ? { categories: [cardIssuanceCategoryId.trim()] } : {}),
         ...(cardIssuanceDescription.trim() ? { description: cardIssuanceDescription.trim() } : {}),
       },
       ...(tiersPayload && tiersPayload.length > 0 ? { tiers: tiersPayload } : {}),
     });
     if (res.success && res.cardAddress) {
       setCardIssuanceCreateResult({ cardAddress: res.cardAddress, hash: res.hash });
       setCardIssuanceOnChainRefreshNonce((n) => n + 1);
       setProfileOwnsIssuedBeamioCard(true);
       setProfileOwnsIssuedBeamioCardFetched(true);
       const categoryIdForIndex = cardIssuanceCategoryId.trim();
       const profileForPost = profiles?.[0];
       void (async () => {
         const createdAddr = res.cardAddress;
         if (!createdAddr) {
           return;
         }
         const cardAddrNorm = ethers.getAddress(createdAddr);
         try {
           const pk = profileForPost?.privateKeyArmor;
           if (!pk) {
             setCardIssuanceOwnerAdminNotice({
               kind: 'warn',
               text: 'Wallet key not available; owner admin registration was skipped. Add your owner EOA as admin manually if needed.',
             });
           } else {
               const chainOwner = await getCardOwner(cardAddrNorm);
               const signerAddr = new ethers.Wallet(pk).address;
               if (ethers.getAddress(signerAddr) !== ethers.getAddress(chainOwner)) {
                 setCardIssuanceOwnerAdminNotice({
                   kind: 'warn',
                   text: 'Auto admin registration skipped: your signing wallet must match the card on-chain owner().',
                 });
               } else {
                 const nowSec = Math.floor(Date.now() / 1000);
                 const deadline = nowSec + 3600;
                 const nonce = ethers.hexlify(ethers.randomBytes(32));
                 const data = encodeAdminManagerAdd(chainOwner, 1, 'program-owner');
                 /** Factory executeForAdmin rewrites adminManager calldata to adminManagerByAdmin(..., signer). */
                 const adminSignature = await signExecuteForAdmin(pk, cardAddrNorm, data, deadline, nonce);
                 const addRes = await postCardAddAdminByAdmin({
                   cardAddress: cardAddrNorm,
                   data,
                   deadline,
                   nonce,
                   adminSignature,
                   adminEOA: chainOwner,
                 });
                 if (addRes.success) {
                   setCardIssuanceOwnerAdminNotice({
                     kind: 'ok',
                     text: 'Owner EOA registered as card admin (executeForAdmin → adminManagerByAdmin on-chain).',
                   });
                 } else {
                   setCardIssuanceOwnerAdminNotice({
                     kind: 'warn',
                     text: addRes.error ?? 'Failed to register owner as admin.',
                   });
                 }
               }
             }
         } catch (e: unknown) {
           setCardIssuanceOwnerAdminNotice({
             kind: 'warn',
             text: e instanceof Error ? e.message : 'Owner admin registration failed.',
           });
         }
         if (categoryIdForIndex) {
           try {
             const groups = await fetchCardsByCategory({ scanLimit: 1200, limitPerCategory: 120 });
             const g = groups.find((x) => x.categoryId === categoryIdForIndex);
             setCardIssuanceCategoryIndexSummary(
               g
                 ? `Category “${categoryIdForIndex}” now lists ${g.items.length} program card(s) on the index (GET /api/cardsByCategory).`
                 : `Category “${categoryIdForIndex}” was saved. The category index may update after a short cache refresh (about 30 seconds).`
             );
           } catch {
             setCardIssuanceCategoryIndexSummary(null);
           }
         }
       })();
     } else {
       setCardIssuanceCreateError(res.error ?? 'Create card failed.');
     }
   } catch (e: any) {
     setCardIssuanceCreateError(e?.message ?? String(e));
   } finally {
     setCardIssuanceCreateLoading(false);
   }
 }, [
   profiles,
   cardIssuanceProgramName,
   cardIssuanceCurrencySymbol,
   cardIssuanceTiers,
   cardIssuanceTierRule,
   cardIssuanceShareImageUrl,
   cardIssuanceCategoryId,
   cardIssuanceDescription,
   cardIssuanceMinTopup,
   cardIssuanceMaxTopup,
   buildCardIssuanceTiersPayload,
 ]);

 useEffect(() => {
   if (activeTab !== 'Card Issuance Setup') {
     return;
   }
   const p0 = profiles?.[0];
   if (!p0) {
     setCardIssuanceExistingCard(null);
     setCardIssuanceOnchainFetch('done');
     return;
   }
   let cancelled = false;
   setCardIssuanceOnchainFetch('loading');
   void (async () => {
     try {
       const { cards, trusted } = await getCardsOfOwnerWithDetailsForProfile(p0);
       if (cancelled) return;
       if (!trusted || cards.length === 0) {
         setCardIssuanceExistingCard(null);
         return;
       }
       const primary = await pickPrimaryIssuedCardAddressForBiz(p0, cards, baseRpcProviderDirect);
       if (cancelled) return;
       if (!primary) {
         setCardIssuanceExistingCard(null);
         return;
       }
       const userCard =
         cards.find((c) => c.cardAddress.toLowerCase() === primary.toLowerCase()) ?? cards[0];
       const meta =
         (await getCardMetadataFromApi(primary)) ??
         (await getCardMetadataFrom1155Json(primary)) ??
         (await getCardMetadataFromUri(primary));
       if (cancelled) return;
       let upgradeType = -1;
       try {
         const card = new ethers.Contract(
           primary,
           ['function upgradeType() view returns (uint8)'],
           baseRpcProviderDirect
         );
         const raw = await card.upgradeType();
         upgradeType = Number(raw);
       } catch {
         upgradeType = -1;
       }
       if (cancelled) return;
       setCardIssuanceExistingCard({ cardAddress: primary, userCard, meta, upgradeType });
     } catch {
       if (!cancelled) setCardIssuanceExistingCard(null);
     } finally {
       if (!cancelled) setCardIssuanceOnchainFetch('done');
     }
   })();
   return () => {
     cancelled = true;
   };
 }, [
   activeTab,
   profiles?.[0]?.keyID,
   profiles?.[0]?.aaAccount,
   profiles?.[0]?.privateKeyArmor,
   cardIssuanceOnChainRefreshNonce,
 ]);

 useEffect(() => {
   const p0 = profiles?.[0];
   if (!p0 || (!p0.keyID?.trim() && !p0.aaAccount?.trim() && !p0.privateKeyArmor)) {
     setProfileOwnsIssuedBeamioCard(false);
     setProfileOwnsIssuedBeamioCardFetched(true);
     setMerchantOwnCardAddress(null);
     return;
   }
   let cancelled = false;
   setProfileOwnsIssuedBeamioCardFetched(false);
   void (async () => {
     try {
       const { cards, trusted } = await getCardsOfOwnerWithDetailsForProfile(p0);
       if (cancelled) return;
       setProfileOwnsIssuedBeamioCard(cards.length > 0);
       setProfileOwnsIssuedBeamioCardFetched(true);
       if (!trusted || cards.length === 0) {
         setMerchantOwnCardAddress(null);
         return;
       }
       const primary = await pickPrimaryIssuedCardAddressForBiz(p0, cards, baseRpcProviderDirect);
       if (cancelled) return;
       setMerchantOwnCardAddress(primary ? ethers.getAddress(primary) : null);
     } catch {
       if (!cancelled) {
         setProfileOwnsIssuedBeamioCard(false);
         setProfileOwnsIssuedBeamioCardFetched(true);
         setMerchantOwnCardAddress(null);
       }
     }
   })();
   return () => {
     cancelled = true;
   };
 }, [profiles?.[0]?.keyID, profiles?.[0]?.aaAccount, profiles?.[0]?.privateKeyArmor, cardIssuanceOnChainRefreshNonce]);

 const [timeFilter, setTimeFilter] = useState<OverviewTimeFilter>('Today');
 const [oracleCadUsdc, setOracleCadUsdc] = useState<number | null>(null);
 const [activeLedger, setActiveLedger] = useState<'All' | 'AA' | 'EOA'>('All');
 const [txSearchTerm, setTxSearchTerm] = useState('');
 const [txFilterTerminal, setTxFilterTerminal] = useState('All');
 const [txFilterType, setTxFilterType] = useState('All');
 const currentEoa = (profiles?.[0]?.keyID ?? myAddress ?? '').toLowerCase();
 /** Staff / POS / Overview chain reads: merchant-issued BeamioUserCard when present; else infra `BEAMIO_USER_CARD_ASSET_ADDRESS`. */
 const staffProgramBeamioCardAddress = useMemo(
   () => merchantOwnCardAddress ?? FIXED_USER_CARD_CONTRACT_ADDRESS,
   [merchantOwnCardAddress],
 );
 const fixedCardAdminsCacheKey = `card-admins:${staffProgramBeamioCardAddress.toLowerCase()}:v2`;
 const linkedMerchantAdminsCacheKey = `linked-merchants:${staffProgramBeamioCardAddress.toLowerCase()}:v2`;
 const fixedCardMetadataCacheKey = `card-metadata:${staffProgramBeamioCardAddress.toLowerCase()}`;
 const overviewPeriodType = useMemo(() => overviewTimeFilterToPeriodType(timeFilter), [timeFilter]);
 const linkedTerminalsCacheKey = `eoa:${currentEoa}:linked-terminals:${staffProgramBeamioCardAddress.toLowerCase()}`;
 const [fixedCardAdmins, setFixedCardAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(fixedCardAdminsCacheKey) ?? []);
 const [linkedMerchantAdmins, setLinkedMerchantAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) ?? []);
 const [fixedCardMetadata, setFixedCardMetadata] = useState<FixedUserCardMetadata | null>(() => loadTrustedCache<FixedUserCardMetadata>(fixedCardMetadataCacheKey));
 /** Points / voucher token label on Daily Dashboard (metadata `Symbol` or issuance form fallback for own card). */
 const dashboardPointsCurrencySymbol = useMemo(() => {
   const fromMeta = fixedCardMetadata?.currencySymbol?.trim();
   if (fromMeta) return normalizeDashboardPointsSymbol(fromMeta);
   if (merchantOwnCardAddress && (cardIssuanceCurrencySymbol || '').trim()) {
     return normalizeDashboardPointsSymbol(cardIssuanceCurrencySymbol);
   }
   return DASHBOARD_DEFAULT_POINTS_SYMBOL;
 }, [fixedCardMetadata?.currencySymbol, merchantOwnCardAddress, cardIssuanceCurrencySymbol]);
 const [merchantOwnerProfile, setMerchantOwnerProfile] = useState<BeamioProfile>(null);
 const [adminNetworkSummaryToday, setAdminNetworkSummaryToday] = useState<{ cadVol: number; txCount: number; usdc: number; vouchers: number } | null>(null);
 /** Chain cumulative admin subtree stats (not tied to Overview date filter) — same shape as period summary */
 const [adminNetworkSummaryLifetime, setAdminNetworkSummaryLifetime] = useState<{
   cadVol: number
   txCount: number
   usdc: number
   vouchers: number
 } | null>(null);
 /** All-time tip USDC (human) from indexer, multi-year scan — CashTrees Settlement panel only */
 const [adminTipsLifetimeUSDC, setAdminTipsLifetimeUSDC] = useState<number | null>(null);
 const [adminMintLimitQuota, setAdminMintLimitQuota] = useState<number | null>(null);
 const [adminMintCounterFromClear, setAdminMintCounterFromClear] = useState<number | null>(null);
 const [protocolFuelReserveBalance, setProtocolFuelReserveBalance] = useState<number | null>(null);
 const [overviewRefreshTrigger, setOverviewRefreshTrigger] = useState(0);
 /** Refetch CoNET indexer tx list when entering Transactions or on a 30s tick there (Overview feeder uses Base card stats, not this list). */
 const [txListPollTick, setTxListPollTick] = useState(0);
 const [overviewRefreshing, setOverviewRefreshing] = useState(false);
 const [linkedMerchantLookupDone, setLinkedMerchantLookupDone] = useState(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) !== null);
 const [adminRetryCount, setAdminRetryCount] = useState(0);
 const [redeemAdminInProgress, setRedeemAdminInProgress] = useState(false);
 const [aaRefreshStatus, setAaRefreshStatus] = useState<AaRefreshStatus>('idle');
 const [indexerTransactions, setIndexerTransactions] = useState<TxDisplayRow[]>([]);
 /** Same filter pipeline as Transactions table `filteredTx`. Protocol Fuel consumption uses `chargeBUnitLedgerRef` (semi-persistent), not this slice alone. */
 const transactionsFilteredForTable = useMemo(() => {
   const ctx: BizTxTableFilterCtx = {
     activeLedger,
     txSearchTerm,
     txFilterType,
     txFilterTerminal,
     hasAaAccount: Boolean(profiles?.[0]?.aaAccount?.trim()),
   }
   return indexerTransactions.filter((tx) => bizTxMatchesTransactionTableFilters(tx, ctx))
 }, [indexerTransactions, activeLedger, txSearchTerm, txFilterType, txFilterTerminal, profiles])
 /** Sum Charge `fees.bServiceUnits6` from semi-persistent `chargeBUnitLedgerRef` ∩ table filters ∩ Overview `timeFilter` window. */
 const chargeBUnitLedgerRef = useRef<Map<string, ChargeBUnitLedgerEntry>>(new Map())
 const [chargeBUnitLedgerEpoch, setChargeBUnitLedgerEpoch] = useState(0)

 const overviewLocalCalendarDayKey = formatLocalYmd(new Date())
 const protocolFuelConsumptionDisplayUnits = useMemo(() => {
   const endSec = Math.floor(Date.now() / 1000)
   const ctx: ChargeLedgerFilterCtx = {
     activeLedger,
     txSearchTerm,
     txFilterType,
     txFilterTerminal,
     hasAaAccount: Boolean(profiles?.[0]?.aaAccount?.trim()),
   }
   if (timeFilter === 'Today') {
     return sumChargeLedgerBUnitsForLocalCalendarDay(chargeBUnitLedgerRef.current, ctx, overviewLocalCalendarDayKey)
   }
   const startSec = overviewPeriodStartUnixSec(timeFilter, endSec)
   return sumChargeLedgerBUnitsInWindow(chargeBUnitLedgerRef.current, ctx, startSec, endSec)
 }, [
   chargeBUnitLedgerEpoch,
   timeFilter,
   overviewLocalCalendarDayKey,
   activeLedger,
   txSearchTerm,
   txFilterType,
   txFilterTerminal,
   profiles,
   overviewRefreshTrigger,
 ])
 const tipsCollectedLedgerRef = useRef<Map<string, TipsCollectedLedgerEntry>>(new Map())
 const [tipsCollectedLedgerEpoch, setTipsCollectedLedgerEpoch] = useState(0)
 const tipsCollectedOverviewSums = useMemo(() => {
   const endSec = Math.floor(Date.now() / 1000)
   const cadOracle = oracleCadUsdc ?? ORACLE_CAD_USDC_FALLBACK
   const ctx: BizTxTableFilterCtx = {
     activeLedger,
     txSearchTerm,
     txFilterType,
     txFilterTerminal,
     hasAaAccount: Boolean(profiles?.[0]?.aaAccount?.trim()),
   }
   const merged = indexerTransactions
   const include = (entry: TipsCollectedLedgerEntry) => tipsLedgerEntryMatchesTableFilters(entry, ctx, merged)
   const map = tipsCollectedLedgerRef.current
   if (timeFilter === 'Today') {
     return {
       cadTotal: sumTipsCollectedLedgerValuesForLocalCalendarDay(
         map,
         overviewLocalCalendarDayKey,
         include,
         (e) => tipsLedgerEntryApproxCad(e, cadOracle)
       ),
       usdcPayments: sumTipsCollectedLedgerValuesForLocalCalendarDay(
         map,
         overviewLocalCalendarDayKey,
         include,
         tipsLedgerEntryUsdcPaymentHuman
       ),
       nonUsdcCad: sumTipsCollectedLedgerValuesForLocalCalendarDay(
         map,
         overviewLocalCalendarDayKey,
         include,
         (e) => tipsLedgerEntryNonUsdcCadOnly(e, cadOracle)
       ),
     }
   }
   const startSec = overviewPeriodStartUnixSec(timeFilter, endSec)
   return {
     cadTotal: sumTipsCollectedLedgerValuesInWindow(map, startSec, endSec, include, (e) =>
       tipsLedgerEntryApproxCad(e, cadOracle)
     ),
     usdcPayments: sumTipsCollectedLedgerValuesInWindow(map, startSec, endSec, include, tipsLedgerEntryUsdcPaymentHuman),
     nonUsdcCad: sumTipsCollectedLedgerValuesInWindow(map, startSec, endSec, include, (e) =>
       tipsLedgerEntryNonUsdcCadOnly(e, cadOracle)
     ),
   }
 }, [
   tipsCollectedLedgerEpoch,
   timeFilter,
   overviewLocalCalendarDayKey,
   activeLedger,
   txSearchTerm,
   txFilterType,
   txFilterTerminal,
   profiles,
   indexerTransactions,
   overviewRefreshTrigger,
   oracleCadUsdc,
 ])
 const [indexerTransactionsLoading, setIndexerTransactionsLoading] = useState(false);
 /** Background refetch while a local list is already shown (do not replace table with spinner). */
 const [indexerTransactionsRefreshing, setIndexerTransactionsRefreshing] = useState(false);
 /** Row keys (indexerTxId) that should play slide-in-from-right on this paint; cleared after animation. */
 const [txSlideInKeys, setTxSlideInKeys] = useState<string[]>([]);
 const indexerTxListCountRef = useRef(0);
 useEffect(() => {
   indexerTxListCountRef.current = indexerTransactions.length;
 }, [indexerTransactions.length]);

 /** Semi-persistent Charge B-Unit ledger: load from localStorage + merge inbound tx cache on EOA (immutable chain facts). */
 useEffect(() => {
   if (!currentEoa || !ethers.isAddress(currentEoa)) {
     chargeBUnitLedgerRef.current = new Map()
     tipsCollectedLedgerRef.current = new Map()
     setChargeBUnitLedgerEpoch((n) => n + 1)
     setTipsCollectedLedgerEpoch((n) => n + 1)
     return
   }
   const e = currentEoa.toLowerCase()
   chargeBUnitLedgerRef.current = loadChargeBUnitLedgerMap(e)
   const fromInbound = txRowsToChargeBUnitLedgerEntries(loadInboundTxDisplayCache(e))
   if (fromInbound.length > 0) {
     const changed = mergeChargeBUnitLedgerEntries(chargeBUnitLedgerRef.current, fromInbound)
     trimChargeBUnitLedgerMap(chargeBUnitLedgerRef.current, CHARGE_BUINT_LEDGER_MAX_ENTRIES)
     if (changed) saveChargeBUnitLedgerMapImmediate(e, chargeBUnitLedgerRef.current)
   }
   setChargeBUnitLedgerEpoch((n) => n + 1)

   tipsCollectedLedgerRef.current = loadTipsCollectedLedgerMap(e)
   const tipsInbound = buildTipsCollectedLedgerEntriesFromMerged(loadInboundTxDisplayCache(e))
   const tipsMap = tipsCollectedLedgerRef.current
   const tipsOnlyNew = tipsInbound.filter((row) => !tipsMap.has(row.indexerTxId.toLowerCase()))
   if (tipsOnlyNew.length > 0) {
     mergeTipsCollectedLedgerEntries(tipsMap, tipsOnlyNew)
     trimTipsCollectedLedgerMap(tipsMap, TIPS_COLLECTED_LEDGER_MAX_ENTRIES)
     saveTipsCollectedLedgerMapImmediate(e, tipsMap)
   }
   setTipsCollectedLedgerEpoch((n) => n + 1)
 }, [currentEoa])

 /** Upsert indexer/WSS Charge rows into ledger; debounced persist. */
 useEffect(() => {
   if (!currentEoa || !ethers.isAddress(currentEoa)) return
   const e = currentEoa.toLowerCase()
   const incoming = txRowsToChargeBUnitLedgerEntries(indexerTransactions)
   if (incoming.length === 0) return
   const changed = mergeChargeBUnitLedgerEntries(chargeBUnitLedgerRef.current, incoming)
   if (!changed) return
   trimChargeBUnitLedgerMap(chargeBUnitLedgerRef.current, CHARGE_BUINT_LEDGER_MAX_ENTRIES)
   saveChargeBUnitLedgerMapDebounced(e, chargeBUnitLedgerRef.current)
   setChargeBUnitLedgerEpoch((n) => n + 1)
 }, [indexerTransactions, currentEoa])

 /** Semi-persistent tips ledger: new ids only (fetch premerge is authoritative for per–TX_TIP amounts). */
 useEffect(() => {
   if (!currentEoa || !ethers.isAddress(currentEoa)) return
   const e = currentEoa.toLowerCase()
   const incoming = buildTipsCollectedLedgerEntriesFromMerged(indexerTransactions)
   const map = tipsCollectedLedgerRef.current
   const onlyNew = incoming.filter((row) => !map.has(row.indexerTxId.toLowerCase()))
   if (onlyNew.length === 0) return
   const changed = mergeTipsCollectedLedgerEntries(map, onlyNew)
   if (!changed) return
   trimTipsCollectedLedgerMap(map, TIPS_COLLECTED_LEDGER_MAX_ENTRIES)
   saveTipsCollectedLedgerMapDebounced(e, map)
   setTipsCollectedLedgerEpoch((n) => n + 1)
 }, [indexerTransactions, currentEoa])

 const [rawTxJsonModal, setRawTxJsonModal] = useState<TxDisplayRow | null>(null);
 /** Transactions table: payer/payee address (lowercase) → @beamioTag from searchUsername (Top-Up / Charge / Tip) */
 const [txReportingBeamioTagByAddress, setTxReportingBeamioTagByAddress] = useState<Record<string, string>>({});
 /** Charge payer → program/staff BeamioUserCard tier capsule (metadata.name + background_color from per-NFT JSON) */
 const [chargePayerInfraTierCapsuleByPayer, setChargePayerInfraTierCapsuleByPayer] = useState<
   Record<string, { name: string; backgroundColor?: string } | null>
 >({});
 /** Chain-verified admin status (EOA-scoped): local cache first, chain fetch as backup (beamio-ai-onchain-fetch) */
 const isAdminTrustedCacheKey = `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:is-admin`;
 const [isCurrentUserCardAdmin, setIsCurrentUserCardAdmin] = useState<boolean | null>(() =>
   currentEoa && ethers.isAddress(currentEoa) ? (loadTrustedCache<boolean>(isAdminTrustedCacheKey) ?? null) : null
 );
 /** First chain address in EOA-first order (keyID → myAddress → aaAccount) with `isAdmin` true — dashboard / indexer stats align with EOA owner–admin model. */
 const [chainResolvedStatsAdminAddress, setChainResolvedStatsAdminAddress] = useState<string | null>(null);

 // Store Wallets, Market, Messages, Partner Alliances
 const [joinedAlliances, setJoinedAlliances] = useState<AllianceId[]>([]);
 const [alliancesDb, setAlliancesDb] = useState(INITIAL_ALLIANCES_DB);
 const [isJoinAllianceModalOpen, setIsJoinAllianceModalOpen] = useState(false);
 const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
 const [configAllianceId, setConfigAllianceId] = useState<AllianceId | null>(null);
 const [tempDiscounts, setTempDiscounts] = useState<Record<string, number>>({});
 /** POS tax rate (%) written into `tierRoutingDiscounts.taxRatePercent` for Smart Terminal metadata */
 const [routingTaxRatePercent, setRoutingTaxRatePercent] = useState(0);
 /** After on-chain tiers load, hydrate form from `getAdminSubordinatesWithMetadata` (same parentAdmin as deploy). */
 const routingModalHydratedFromChainRef = useRef(false);
 const routingHydrateAsyncGenRef = useRef(0);
 const lastRoutingHydrateWalletTagRef = useRef<string | null>(null);
 /** On-chain BeamioUserCard tiers when routing modal is open for `ALLIANCE_ID_FOR_FIXED_USER_CARD` */
 const [routingModalChainTiers, setRoutingModalChainTiers] = useState<BeamioUserCardChainTier[] | null>(null);
 /** `BeamioUserCard.currency()` uint8 — aligns with `BeamioCurrency.CurrencyType` */
 const [routingModalChainCurrencyType, setRoutingModalChainCurrencyType] = useState<number | null>(null);
 /** Card JSON `tiers` (name/description from metadata API / 0x{card}0.json) */
 const [routingModalCardTiersMeta, setRoutingModalCardTiersMeta] = useState<CardTierMetadata[] | null>(null);
 const [routingModalTiersLoading, setRoutingModalTiersLoading] = useState(false);
 const [routingModalTiersError, setRoutingModalTiersError] = useState<string | null>(null);
 const [routingRulesDeployLoading, setRoutingRulesDeployLoading] = useState(false);
 const [routingRulesDeployError, setRoutingRulesDeployError] = useState<string | null>(null);
 const [applyingAlliance, setApplyingAlliance] = useState<AllianceId | null>(null);
 const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
 const [customFuelAmount, setCustomFuelAmount] = useState('');
 const [marketRefuelProcessing, setMarketRefuelProcessing] = useState(false);
 const [marketRefuelSuccess, setMarketRefuelSuccess] = useState<string | null>(null);
 const [marketRefuelError, setMarketRefuelError] = useState<string | null>(null);
 const marketCustomFuelUsdc = useMemo(() => {
   const v = Number(String(customFuelAmount).replace(/,/g, '.'));
   return Number.isFinite(v) ? v : NaN;
 }, [customFuelAmount]);
 const [activeContact, setActiveContact] = useState('c1');
 const [chatInput, setChatInput] = useState('');

 const [membersLoyaltyBranch, setMembersLoyaltyBranch] = useState<string>(BIZ_LOYALTY_BRANCHES[0]);
 const [membersLoyaltyRows, setMembersLoyaltyRows] = useState<BizLoyaltyMemberRow[]>(INITIAL_BIZ_LOYALTY_MEMBERS);
 const [membersLoyaltySearch, setMembersLoyaltySearch] = useState('');
 const [isIssueCardModalOpen, setIsIssueCardModalOpen] = useState(false);
 const [issueCardStep, setIssueCardStep] = useState(1);
 const [issueTarget, setIssueTarget] = useState('');
 const [issueType, setIssueType] = useState<'PREPAID' | 'VIP_TIER'>('PREPAID');
 const [issueValue, setIssueValue] = useState('');
 const [issueExpiry, setIssueExpiry] = useState('Never');
 const [issueTokenSymbol, setIssueTokenSymbol] = useState('$CTree');
 const [isCreatingTier, setIsCreatingTier] = useState(false);
 const [newTierName, setNewTierName] = useState('');
 const [newTierDiscount, setNewTierDiscount] = useState('');

 const [eoaUsdcBalance, setEoaUsdcBalance] = useState<string | null>(null);
 const [aaUsdcBalance, setAaUsdcBalance] = useState<string | null>(null);
 /** `balanceOf(AA, 0)` on `BEAMIO_USER_CARD_ASSET_ADDRESS` (points token), human units (÷1e6) */
 const [aaUserCardPointsToken0Balance, setAaUserCardPointsToken0Balance] = useState<number | null>(null);
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

 const closeMarketProductModal = useCallback(() => {
   setSelectedProduct(null);
   setMarketRefuelProcessing(false);
   setMarketRefuelSuccess(null);
   setMarketRefuelError(null);
 }, []);

 const resetMarketRefuelSuccess = useCallback(() => {
   setMarketRefuelSuccess(null);
   setMarketRefuelError(null);
 }, []);

 const handleRemitToAlliance = useCallback((aId: AllianceId) => {
   setAlliancesDb((prev) => ({
     ...prev,
     [aId]: { ...prev[aId], topUps: 0 }
   }));
 }, []);

 const handleOpenConfig = useCallback((aId: AllianceId) => {
   setConfigAllianceId(aId);
   setRoutingRulesDeployError(null);
   const initial: Record<string, number> = {};
   const row = alliancesDb[aId];
   if (row.tiers?.length) {
     row.tiers.forEach((t) => {
       initial[t.id] = t.discount;
     });
   }
   setTempDiscounts(initial);
   setRoutingTaxRatePercent(0);
   setIsConfigModalOpen(true);
 }, [alliancesDb]);

 useEffect(() => {
   if (!isConfigModalOpen || configAllianceId !== ALLIANCE_ID_FOR_FIXED_USER_CARD) {
     routingModalHydratedFromChainRef.current = false;
     lastRoutingHydrateWalletTagRef.current = null;
     setRoutingModalChainTiers(null);
     setRoutingModalChainCurrencyType(null);
     setRoutingModalCardTiersMeta(null);
     setRoutingModalTiersLoading(false);
     setRoutingModalTiersError(null);
     return;
   }
   let cancelled = false;
   setRoutingModalTiersLoading(true);
   setRoutingModalTiersError(null);
   setRoutingModalCardTiersMeta(null);

   const routingTierMetaKey = `card:${staffProgramBeamioCardAddress.toLowerCase()}:routing-tier-metadata`
   void fetchWithCache(routingTierMetaKey, () =>
     fetchCardTierMetadataListForRouting(staffProgramBeamioCardAddress)
   )
     .then((metaTiers) => {
       if (!cancelled) setRoutingModalCardTiersMeta(metaTiers.length > 0 ? metaTiers : null);
     })
     .catch(() => {
       if (!cancelled) setRoutingModalCardTiersMeta(null);
     });

   const routingOnchainTiersKey = `card:${staffProgramBeamioCardAddress.toLowerCase()}:onchain-tiers`
   void fetchWithCache(routingOnchainTiersKey, () =>
     fetchBeamioUserCardTiersAndCurrencyFromChain(staffProgramBeamioCardAddress, baseRpcProviderDirect)
   )
     .then(({ tiers: rows, currencyType }) => {
       if (!cancelled) {
         setRoutingModalChainTiers(rows);
         setRoutingModalChainCurrencyType(currencyType);
         setRoutingModalTiersLoading(false);
       }
     })
     .catch((e: unknown) => {
       if (!cancelled) {
         setRoutingModalTiersError(e instanceof Error ? e.message : 'Failed to load on-chain tiers');
         setRoutingModalChainTiers(null);
         setRoutingModalChainCurrencyType(null);
         setRoutingModalTiersLoading(false);
       }
     });
   return () => {
     cancelled = true;
   };
    }, [isConfigModalOpen, configAllianceId, staffProgramBeamioCardAddress]);

 useEffect(() => {
   if (!isConfigModalOpen || configAllianceId !== ALLIANCE_ID_FOR_FIXED_USER_CARD || !routingModalChainTiers?.length) return;
   setTempDiscounts((prev) => {
     const next = { ...prev };
     routingModalChainTiers.forEach((ct) => {
       const id = `chain-tier-${ct.index}`;
       if (next[id] === undefined) next[id] = 0;
     });
     return next;
   });
 }, [isConfigModalOpen, configAllianceId, routingModalChainTiers]);

 /** Load routing tax + tier discounts from first matching subordinate metadata on chain (fallback: local defaults / 0). */
 useEffect(() => {
   if (!isConfigModalOpen || configAllianceId !== ALLIANCE_ID_FOR_FIXED_USER_CARD) return;
   if (routingModalTiersLoading || routingModalTiersError || !routingModalChainTiers?.length) return;

   const walletTag = `${(profiles?.[0]?.keyID ?? myAddress ?? '').toLowerCase()}|${(profiles?.[0]?.aaAccount ?? '').toLowerCase()}`;
   if (walletTag !== lastRoutingHydrateWalletTagRef.current) {
     lastRoutingHydrateWalletTagRef.current = walletTag;
     routingModalHydratedFromChainRef.current = false;
   }
   if (routingModalHydratedFromChainRef.current) return;

   const tiersSnapshot = routingModalChainTiers;
   const myGen = ++routingHydrateAsyncGenRef.current;

   void (async () => {
     try {
       const cardAddress = staffProgramBeamioCardAddress;
       const card = new ethers.Contract(cardAddress, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
       const cardOwner = ((await card.owner()) as string)?.trim();
       if (myGen !== routingHydrateAsyncGenRef.current) return;
       const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
       const userAA = profiles?.[0]?.aaAccount?.trim();

       let parentAdmin: string = ethers.ZeroAddress;
       if (userEOA && ethers.isAddress(userEOA)) {
         const ownerNorm = cardOwner && ethers.isAddress(cardOwner) ? ethers.getAddress(cardOwner) : '';
         const isOwner =
           (!!ownerNorm && ownerNorm === ethers.getAddress(userEOA)) ||
           (!!userAA &&
             ethers.isAddress(userAA) &&
             !!ownerNorm &&
             ownerNorm === ethers.getAddress(userAA));
         if (!isOwner) {
           const ok = await isCardAdmin(cardAddress, userEOA);
           if (ok) parentAdmin = ethers.getAddress(userEOA);
         }
       }

       if (myGen !== routingHydrateAsyncGenRef.current) return;
       const [, metadatas] = (await card.getAdminSubordinatesWithMetadata(parentAdmin)) as [string[], string[]];
       const picked = pickTierRoutingFromSubordinateMetadatas(
         (metadatas ?? []).map((m) => (typeof m === 'string' ? m : '')),
         cardAddress
       );

       if (myGen !== routingHydrateAsyncGenRef.current) return;
       routingModalHydratedFromChainRef.current = true;

       if (picked) {
         setRoutingTaxRatePercent(picked.taxRatePercent);
         setTempDiscounts((prev) => {
           const next = { ...prev };
           for (const ct of tiersSnapshot) {
             const id = `chain-tier-${ct.index}`;
             if (picked.tierDiscountsById[id] !== undefined) next[id] = picked.tierDiscountsById[id]!;
             else if (next[id] === undefined) next[id] = 0;
           }
           return next;
         });
       } else {
         setTempDiscounts((prev) => {
           const next = { ...prev };
           for (const ct of tiersSnapshot) {
             const id = `chain-tier-${ct.index}`;
             if (next[id] === undefined) next[id] = 0;
           }
           return next;
         });
       }
     } catch {
       if (myGen !== routingHydrateAsyncGenRef.current) return;
       routingModalHydratedFromChainRef.current = true;
       setTempDiscounts((prev) => {
         const next = { ...prev };
         for (const ct of tiersSnapshot) {
           const id = `chain-tier-${ct.index}`;
           if (next[id] === undefined) next[id] = 0;
         }
         return next;
       });
     }
   })();

   return () => {
     routingHydrateAsyncGenRef.current += 1;
   };
 }, [
   isConfigModalOpen,
   configAllianceId,
   routingModalChainTiers,
   routingModalTiersLoading,
   routingModalTiersError,
   profiles,
   myAddress,
   staffProgramBeamioCardAddress,
 ]);

 const clearCardCacheAndRetry = useCallback(() => {
   try {
   invalidateFetchCache(`card:${staffProgramBeamioCardAddress.toLowerCase()}`);
   invalidateFetchCache('indexer:tips');
   invalidateFetchCache('eoa:');
     const keys = [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, linkedTerminalsCacheKey, isAdminTrustedCacheKey];
     keys.forEach((k) => window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${k}`));
     Object.keys(window.localStorage).filter((k) => (k.startsWith(BIZ_CACHE_PREFIX + 'card:') && (k.includes('mint-limit-quota') || k.includes('quota-and-mint-counter'))) || (k.startsWith(BIZ_CACHE_PREFIX) && k.includes('buint:balance:'))).forEach((k) => window.localStorage.removeItem(k));
     setFixedCardAdmins([]);
     setLinkedMerchantAdmins([]);
     setIsCurrentUserCardAdmin(null);
     setTerminals([]);
     setLinkedMerchantLookupDone(false);
     setAdminNetworkSummaryToday(null);
     setAdminNetworkSummaryLifetime(null);
     setAdminTipsLifetimeUSDC(null);
     setAdminMintLimitQuota(null);
     setAdminMintCounterFromClear(null);
     setProtocolFuelReserveBalance(null);
     setAdminRetryCount((c) => c + 1);
     try {
       Object.keys(window.localStorage)
         .filter(
           (k) =>
             k.startsWith(`${BIZ_CACHE_PREFIX}eoa:${currentEoa}:`) &&
             (k.includes('network-summary:lifetime') || k.includes(':tips:lifetime'))
         )
         .forEach((k) => window.localStorage.removeItem(k));
     } catch { /* ignore */ }
   } catch {
     setAdminRetryCount((c) => c + 1);
   }
 }, [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, linkedTerminalsCacheKey, isAdminTrustedCacheKey, currentEoa, staffProgramBeamioCardAddress]);

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
     invalidateFetchCache(`card:${staffProgramBeamioCardAddress.toLowerCase()}`);
     try {
       Object.keys(window.localStorage)
         .filter((k) => k.startsWith(`${BIZ_CACHE_PREFIX}eoa:${oldEoa}:`))
         .forEach((k) => window.localStorage.removeItem(k));
       // Clear card-level admin caches on EOA switch: production may reuse localStorage from previous user,
       // causing isFixedUserCardAdmin to show admin content to non-admin when cache + stale identity align.
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${fixedCardAdminsCacheKey}`);
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${linkedMerchantAdminsCacheKey}`);
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${INDEXER_INBOUND_TX_CACHE_KEY(oldEoa.toLowerCase())}`);
     } catch { /* ignore */ }
     setFixedCardAdmins([]);
     setLinkedMerchantAdmins([]);
     setLinkedMerchantLookupDone(false);
     setAdminNetworkSummaryToday(null);
     setAdminNetworkSummaryLifetime(null);
     setAdminTipsLifetimeUSDC(null);
     setAdminMintLimitQuota(null);
     setAdminMintCounterFromClear(null);
     setProtocolFuelReserveBalance(null);
     setIndexerTransactions([]);
     setTerminals([]);
     setSubordinateBalances({});
     setTerminalStats({});
     setAaUsdcBalance(null);
     setIsCurrentUserCardAdmin(null);
     setAdminRetryCount((c) => c + 1);
   }
   prevEoaRef.current = currentEoa;
 }, [currentEoa, fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, staffProgramBeamioCardAddress]);

 const handleTabChange = useCallback((tab: string) => {
   setActiveTab(tab);
   setIsMobileMenuOpen(false);
 }, []);


 /** 终端记录类型 */
 type TerminalRecord = { id: string; tag: string; name: string; eoa: string; status: string; lastActive: string };
 // 新增：终端管理状态（链上 + 本地存储）
 const [terminals, setTerminals] = useState<TerminalRecord[]>(() => loadTrustedCache<TerminalRecord[]>(linkedTerminalsCacheKey) ?? []);
 const [terminalsLoading, setTerminalsLoading] = useState(false);
 const [terminalStats, setTerminalStats] = useState<Record<string, BizTerminalChainStats | null>>({});
 const terminalsRef = useRef(terminals);
 terminalsRef.current = terminals;
 const [isAddTerminalOpen, setIsAddTerminalOpen] = useState(false);
 const [newTerminalTag, setNewTerminalTag] = useState('');
 const [linkTerminalLoading, setLinkTerminalLoading] = useState(false);
 const [linkTerminalError, setLinkTerminalError] = useState<string | null>(null);
 const [deleteTerminalToRemove, setDeleteTerminalToRemove] = useState<{ id: string; tag: string; name: string; eoa: string } | null>(null);
 const [removeTerminalLoading, setRemoveTerminalLoading] = useState(false);
 const [removeTerminalError, setRemoveTerminalError] = useState<string | null>(null);
 const [resetTerminalLimitModal, setResetTerminalLimitModal] = useState<TerminalRecord | null>(null);
 const [resetTerminalLimitLoading, setResetTerminalLimitLoading] = useState(false);
 const [resetTerminalLimitError, setResetTerminalLimitError] = useState<string | null>(null);
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
   profiles?.[0]?.keyID,
   myAddress,
   profiles?.[0]?.aaAccount,
 ].filter((address): address is string => !!address && ethers.isAddress(address))
   .map((address) => ethers.getAddress(address));
 const normalizedAdminCandidates = adminCandidateAddresses.map((address) => address.toLowerCase());
 /** Card owner (metadata API or admin list slot 0 when owner is prepended there). Prefer this root for dashboard when the wallet controls owner. */
 const programCardOwnerAddress = useMemo(() => {
   if (fixedCardMetadata?.cardOwner && ethers.isAddress(fixedCardMetadata.cardOwner)) {
     return ethers.getAddress(fixedCardMetadata.cardOwner);
   }
   if (fixedCardAdmins[0] && ethers.isAddress(fixedCardAdmins[0])) {
     return ethers.getAddress(fixedCardAdmins[0]);
   }
   return null;
 }, [fixedCardMetadata?.cardOwner, fixedCardAdmins]);
 const walletIdentityAddresses = useMemo(() => {
   const raw = [profiles?.[0]?.keyID, myAddress, profiles?.[0]?.aaAccount].filter(
     (x): x is string => !!x && ethers.isAddress(x)
   ).map((x) => ethers.getAddress(x));
   const out: string[] = [];
   for (const a of raw) {
     if (!out.some((o) => o.toLowerCase() === a.toLowerCase())) out.push(a);
   }
   return out;
 }, [profiles?.[0]?.aaAccount, profiles?.[0]?.keyID, myAddress]);
 /** Admin root for `getAdminStatsFull` / indexer: EOA-first chain winner, or card owner when the wallet controls owner (EOA). */
 const effectiveAdminAddress = useMemo(() => {
   const controlsOwner =
     programCardOwnerAddress != null &&
     walletIdentityAddresses.some((w) => w.toLowerCase() === programCardOwnerAddress.toLowerCase());
   if (controlsOwner) return programCardOwnerAddress;
   return chainResolvedStatsAdminAddress;
 }, [programCardOwnerAddress, walletIdentityAddresses, chainResolvedStatsAdminAddress]);

 /** Latest `handleRefreshAA` for deferred calls (e.g. post–B-Unit refuel) without stale closures */
 const handleRefreshAARef = useRef<(() => Promise<void>) | undefined>(undefined);

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

 handleRefreshAARef.current = handleRefreshAA;

 const handleMarketPurchase = useCallback(async () => {
   if (selectedProduct === 'starter' || selectedProduct === 'custom_fuel') {
     const pk = profiles?.[0]?.privateKeyArmor;
     const account = (profiles?.[0]?.keyID ?? myAddress)?.trim();
     if (!pk || !account) {
       setMarketRefuelError('Wallet not ready. Please unlock or sign in.');
       return;
     }
     const amountHuman =
       selectedProduct === 'starter' ? '1' : String(customFuelAmount).replace(/,/g, '.').trim();
     let need6: bigint;
     try {
       need6 = ethers.parseUnits(amountHuman, 6);
     } catch {
       setMarketRefuelError('Invalid USDC amount');
       return;
     }
     if (need6 < 1_000_000n) {
       setMarketRefuelError('Minimum purchase is 1 USDC');
       return;
     }
     const bal = await getBalance(account);
     if (!bal?.usdc) {
       setMarketRefuelError('Unable to verify USDC balance. Please try again.');
       return;
     }
     let avail6: bigint;
     try {
       avail6 = ethers.parseUnits(String(bal.usdc).trim(), 6);
     } catch {
       setMarketRefuelError('Unable to verify USDC balance. Please try again.');
       return;
     }
     if (avail6 < need6) {
       setMarketRefuelError(
         `Insufficient USDC on Base. You have ${ethers.formatUnits(avail6, 6)} USDC; this refill requires ${ethers.formatUnits(need6, 6)} USDC.`
       );
       return;
     }
     setMarketRefuelError(null);
     setMarketRefuelSuccess(null);
     setMarketRefuelProcessing(true);
     try {
       const payload = await signBUnitRefuel3009(pk, amountHuman);
       const result = await purchaseBUnitFromBase(payload);
       if (result.success) {
         setMarketRefuelSuccess(result.txHash ?? '');
         setOverviewRefreshTrigger((t) => t + 1);
         const pollMs = 5000;
         const pollCount = 24;
         for (let i = 0; i < pollCount; i++) {
           window.setTimeout(() => {
             setOverviewRefreshTrigger((t) => t + 1);
           }, (i + 1) * pollMs);
         }
         const aaTrim = profiles?.[0]?.aaAccount?.trim();
         const lacksAa = !aaTrim || !ethers.isAddress(aaTrim);
         if (lacksAa) {
           window.setTimeout(() => {
             void handleRefreshAARef.current?.();
           }, 3000);
         }
       } else {
         setMarketRefuelError(result.error ?? 'Refuel failed');
       }
     } catch (e) {
       setMarketRefuelError((e as Error)?.message ?? 'Refuel failed');
     } finally {
       setMarketRefuelProcessing(false);
     }
     return;
   }
   setSelectedProduct((prev) => {
     if (prev === 'custom_fuel') setCustomFuelAmount('');
     return null;
   });
   setActiveTab('Wallets');
 }, [selectedProduct, profiles, myAddress, customFuelAmount]);

 // On entry: trusted RPC 与本地 aaAccount 比对；不一致则更新；链上无 AA 时清除无 bytecode 的错误缓存
 useEffect(() => {
   const p0 = profiles?.[0];
   const eoa = (p0?.keyID?.trim() || myAddress?.trim()) || '';
   if (!eoa || !ethers.isAddress(eoa)) return;
   let cancelled = false;
   const run = async (retryCount = 0) => {
     if (cancelled) return;
     try {
       const r = await fetchTrustedCanonicalAaFromRpc(eoa);
       if (cancelled) return;
       if (!r.trusted) {
         if (retryCount === 0) setTimeout(() => run(1), 2500);
         return;
       }

       const persist = async (nextProfiles: profile[]) => {
         setProfiles(nextProfiles);
         const temp = CoNET_Data;
         if (temp) {
           temp.profiles = nextProfiles;
           setCoNET_Data(temp);
           await storeSystemData();
         }
       };

       if (r.aa) {
         const chainAa = ethers.getAddress(r.aa);
         const cached = p0?.aaAccount?.trim();
         if (
           cached &&
           ethers.isAddress(cached) &&
           ethers.getAddress(cached).toLowerCase() === chainAa.toLowerCase()
         ) {
           return;
         }
         if (p0) {
           const nextProfiles = (profiles ?? []).map((p: profile, i: number) =>
             i === 0 ? { ...p, aaAccount: chainAa } : p
           );
           await persist(nextProfiles);
         } else if (myAddress && ethers.isAddress(myAddress)) {
           await persist([{ keyID: ethers.getAddress(myAddress), aaAccount: chainAa } as profile]);
         }
         return;
       }

       const cached = p0?.aaAccount?.trim();
       if (!cached || !ethers.isAddress(cached)) return;
       const code = await baseEndpoint.getCode(cached);
       if (cancelled) return;
       if (code && code !== '0x' && code.length > 2) return;
       if (p0) {
         const nextProfiles = (profiles ?? []).map((p: profile, i: number) =>
           i === 0 ? { ...p, aaAccount: undefined } : p
         );
         await persist(nextProfiles);
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
    const card = new ethers.Contract(staffProgramBeamioCardAddress, USER_CARD_ADMIN_READ_ABI, baseEndpoint);
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
}, [profiles, myAddress, linkedTerminalsCacheKey, staffProgramBeamioCardAddress]);

 /** Map Staff terminal row (EOA id) to on-chain subordinate address (AA or EOA) for adminParent / clear counter. */
 const resolveTerminalChainSubordinate = useCallback(
   async (terminalEoaId: string): Promise<string> => {
     const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
     if (!userEOA || !ethers.isAddress(userEOA)) {
       throw new Error('Wallet not connected.');
     }
     const card = new ethers.Contract(staffProgramBeamioCardAddress, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
     const cardOwner = (await card.owner()) as string;
     const userAA = profiles?.[0]?.aaAccount?.trim();
     const isOwner =
       (cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userEOA)) ||
       (userAA && cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userAA));
     const parentAdmin = isOwner ? ethers.ZeroAddress : ethers.getAddress(userEOA);
     const [subordinates] = (await card.getAdminSubordinatesWithMetadata(parentAdmin)) as [string[]];
     const want = terminalEoaId.toLowerCase();
     for (const subAddr of subordinates ?? []) {
       if (!subAddr || !ethers.isAddress(subAddr)) continue;
       const e = await resolveSubordinateAdminEoa(subAddr, baseRpcProviderDirect);
       if (e.toLowerCase() === want) {
         return ethers.getAddress(subAddr);
       }
     }
     return ethers.getAddress(terminalEoaId);
   },
   [profiles, myAddress, staffProgramBeamioCardAddress],
 );

 const handleSignDeployRules = useCallback(async () => {
   if (!configAllianceId) return;
   const cid = configAllianceId;
   setRoutingRulesDeployError(null);

   setAlliancesDb((prev) => {
     if (cid === ALLIANCE_ID_FOR_FIXED_USER_CARD && routingModalChainTiers && routingModalChainTiers.length > 0) {
       const iconTypes = ['emerald', 'yellow'] as const;
       const updatedTiers = routingModalChainTiers.map((ct, i) => {
         const id = `chain-tier-${ct.index}`;
         return {
           id,
           name: tierDisplayNameWithCardSuffix(resolveTierMetadataDisplayName(routingModalCardTiersMeta, ct.index)),
           discount: tempDiscounts[id] ?? 0,
           iconType: iconTypes[i % 2],
         };
       });
       return { ...prev, [cid]: { ...prev[cid], tiers: updatedTiers } };
     }
     const updatedTiers = prev[cid].tiers.map((t) => ({
       ...t,
       discount: tempDiscounts[t.id] ?? t.discount,
     }));
     return { ...prev, [cid]: { ...prev[cid], tiers: updatedTiers } };
   });

   if (cid !== ALLIANCE_ID_FOR_FIXED_USER_CARD || !routingModalChainTiers?.length) {
     setIsConfigModalOpen(false);
     return;
   }

   const pk = profiles?.[0]?.privateKeyArmor;
   if (!pk) {
     setRoutingRulesDeployError('Wallet not connected. Connect with the merchant card owner or an admin.');
     return;
   }
   const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
   if (!userEOA || !ethers.isAddress(userEOA)) {
     setRoutingRulesDeployError('Wallet address not available.');
     return;
   }

   setRoutingRulesDeployLoading(true);
   try {
     const cardAddress = staffProgramBeamioCardAddress;
     const card = new ethers.Contract(cardAddress, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
     const cardOwner = (await card.owner()) as string;
     const userAA = profiles?.[0]?.aaAccount?.trim();
     const isOwner =
       (cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userEOA)) ||
       (userAA && cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userAA));
     const isAdminUser = await isCardAdmin(cardAddress, userEOA);
     if (!isAdminUser && !isOwner) {
       throw new Error('Wallet must be card owner or admin to deploy routing metadata.');
     }

     const parentAdmin = isOwner ? ethers.ZeroAddress : ethers.getAddress(userEOA);
     const [subordinates, metadatas] = (await card.getAdminSubordinatesWithMetadata(parentAdmin)) as [string[], string[]];
     const currencyType = routingModalChainCurrencyType ?? 0;
     const taxClamped = Math.min(100, Math.max(0, Number(routingTaxRatePercent)));
     const taxRatePercent = Number.isFinite(taxClamped) ? Math.round(taxClamped * 100) / 100 : 0;
     const tierPayload: TierRoutingDiscountsV1 = {
       schemaVersion: 1,
       infrastructureCard: ethers.getAddress(cardAddress),
       currencyType,
       updatedAt: Math.floor(Date.now() / 1000),
       taxRatePercent,
       tiers: routingModalChainTiers.map((ct) => {
         const tid = `chain-tier-${ct.index}`;
         return {
           chainTierIndex: ct.index,
           tierId: tid,
           discountPercent: tempDiscounts[tid] ?? 0,
           minUsdc6: ct.minUsdc6.toString(),
         };
       }),
     };

     for (let idx = 0; idx < (subordinates ?? []).length; idx++) {
       const subAddr = (subordinates ?? [])[idx];
       if (!subAddr || !ethers.isAddress(subAddr)) continue;
       const terminalEOA = await resolveSubordinateAdminEoa(subAddr, baseRpcProviderDirect);
       if (terminalEOA.toLowerCase() === ethers.getAddress(userEOA).toLowerCase()) continue;

       const existingMeta = (metadatas ?? [])[idx];
       const metaStr = typeof existingMeta === 'string' ? existingMeta : '';
       const newMetadata = mergeTerminalAdminMetadataJson(metaStr, tierPayload);

       const limRes = (await card.getAdminAirdropLimit(terminalEOA)) as { limit: bigint; unlimited: boolean };
       let mintLimitPoints6 = BigInt(limRes.limit.toString());
       if (mintLimitPoints6 === 0n) mintLimitPoints6 = BigInt(1000 * 1_000_000);

       const data = encodeAddAdminWithMintLimit(terminalEOA, 1, newMetadata, mintLimitPoints6);
       const now = Math.floor(Date.now() / 1000);
       const deadline = now + 300;
       const nonce = ethers.hexlify(ethers.randomBytes(32));

       let res: { success: boolean; error?: string; hash?: string; txHash?: string };
       if (isOwner && cardOwner && ethers.getAddress(cardOwner) === ethers.getAddress(userEOA)) {
         const ownerSignature = await signExecuteForOwner(pk, cardAddress, data, deadline, nonce);
         res = await postCardAddAdmin({
           cardAddress,
           data,
           deadline,
           nonce,
           ownerSignature,
           adminEOA: terminalEOA,
         });
       } else if (isAdminUser) {
         const adminSignature = await signExecuteForAdmin(pk, cardAddress, data, deadline, nonce);
         res = await postCardAddAdminByAdmin({
           cardAddress,
           data,
           deadline,
           nonce,
           adminSignature,
           adminEOA: terminalEOA,
         });
       } else {
         throw new Error('Card owner is AA. Add your EOA as admin first, then deploy routing.');
       }
       if (!res.success) {
         throw new Error(res.error ?? `Failed to update metadata for terminal ${terminalEOA.slice(0, 10)}…`);
       }
     }

     invalidateFetchCache(`card:${staffProgramBeamioCardAddress.toLowerCase()}`);
     try {
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${fixedCardAdminsCacheKey}`);
     } catch {
       /* ignore */
     }
     void fetchTerminals({ silent: true });
     setIsConfigModalOpen(false);
   } catch (e: unknown) {
     setRoutingRulesDeployError(e instanceof Error ? e.message : 'Failed to deploy routing metadata');
   } finally {
     setRoutingRulesDeployLoading(false);
   }
 }, [
   configAllianceId,
   tempDiscounts,
   routingTaxRatePercent,
   routingModalChainTiers,
   routingModalCardTiersMeta,
   routingModalChainCurrencyType,
   profiles,
   myAddress,
   fetchTerminals,
   fixedCardAdminsCacheKey,
   staffProgramBeamioCardAddress,
 ]);

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

 // Alliance voucher row: AA balance of ERC-1155 id 0 (points) on program BeamioUserCard (issued card or infra fallback)
 useEffect(() => {
   const aaAddr = profiles?.[0]?.aaAccount?.trim();
   if (!aaAddr || !ethers.isAddress(aaAddr)) {
     setAaUserCardPointsToken0Balance(null);
     return;
   }
   let cancelled = false;
   const key = `aa:beamioUserCard:balanceOf0:${ethers.getAddress(aaAddr).toLowerCase()}:${staffProgramBeamioCardAddress.toLowerCase()}`;
   void fetchWithCache(key, async () => {
     const card = new ethers.Contract(
       staffProgramBeamioCardAddress,
       BEAMIO_USER_CARD_ERC1155_BALANCE_ABI,
       baseRpcProviderDirect
     );
     const raw = await card.balanceOf(ethers.getAddress(aaAddr), 0n);
     return amountE6ToDisplayNumber(BigInt(raw.toString()));
   })
     .then((n) => {
       if (!cancelled && Number.isFinite(n)) setAaUserCardPointsToken0Balance(n);
     })
     .catch(() => {
       if (!cancelled) setAaUserCardPointsToken0Balance(null);
     });
   return () => {
     cancelled = true;
   };
 }, [profiles, overviewRefreshTrigger, staffProgramBeamioCardAddress]);

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

 // URL 带 redeemAdmin 时：校验 code 有效、EOA 非 admin 后，向 endpoint 完成 redeem admin，成功后刷新 admin 列表
 useEffect(() => {
   const params = parseRedeemAdminFromUrl();
   if (!params) return;
   const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
   if (!userEOA || !ethers.isAddress(userEOA)) return;
   if (params.cardAddress.toLowerCase() !== staffProgramBeamioCardAddress.toLowerCase()) return;

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
 }, [profiles, profiles?.[0]?.keyID, myAddress, setProfiles, clearCardCacheAndRetry, staffProgramBeamioCardAddress]);

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

   const cardKey = `card:${staffProgramBeamioCardAddress.toLowerCase()}:admins:v2`;
   void fetchWithCache(cardKey, async () => {
     const card = new ethers.Contract(
       staffProgramBeamioCardAddress,
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
 }, [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, adminRetryCount, profiles?.[0]?.keyID, profiles?.[0]?.aaAccount, myAddress, staffProgramBeamioCardAddress]);

 /** Admin status: local cache first (fast show/hide), chain fetch as backup. Only write cache on chain success (trusted). */
 useEffect(() => {
   if (!currentEoa || !ethers.isAddress(currentEoa)) {
     setIsCurrentUserCardAdmin(false);
     setChainResolvedStatsAdminAddress(null);
     return;
   }
   let cancelled = false;
   const cached = loadTrustedCache<boolean>(isAdminTrustedCacheKey);
   if (cached !== null) setIsCurrentUserCardAdmin(cached);
   setChainResolvedStatsAdminAddress(null);
   const fetchKey = `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:is-admin:v2`;
   void fetchWithCache(fetchKey, async () => {
     const card = new ethers.Contract(staffProgramBeamioCardAddress, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
     const addrs = [
       profiles?.[0]?.keyID,
       myAddress,
       profiles?.[0]?.aaAccount,
     ].filter((a): a is string => !!a && ethers.isAddress(a)).map((a) => ethers.getAddress(a));
     if (addrs.length === 0) return { ok: false as const, winner: null as string | null };
     const checks = await Promise.all(addrs.map((addr) => card.isAdmin(addr) as Promise<boolean>));
     const idx = checks.findIndex(Boolean);
     return { ok: idx >= 0, winner: idx >= 0 ? addrs[idx]! : null };
   }).then((result) => {
     if (!cancelled) {
       setIsCurrentUserCardAdmin(result.ok);
       setChainResolvedStatsAdminAddress(result.winner);
       saveTrustedCache(isAdminTrustedCacheKey, result.ok);
     }
   }).catch(() => {
     if (!cancelled && cached === null) {
       setIsCurrentUserCardAdmin(false);
       setChainResolvedStatsAdminAddress(null);
     }
   });
   return () => { cancelled = true; };
 }, [currentEoa, isAdminTrustedCacheKey, profiles?.[0]?.aaAccount, profiles?.[0]?.keyID, myAddress, overviewRefreshTrigger, adminRetryCount, staffProgramBeamioCardAddress]);

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

 /** Init: resolve EOA from same source as left menu (Owner EOA capsule), then start 6s feeder */
 const [feederEoa, setFeederEoa] = useState<string | null>(null);
 useEffect(() => {
   const menuEoa = (profiles?.[0]?.keyID ?? myAddress ?? '').trim();
   const resolved = menuEoa && ethers.isAddress(menuEoa) ? ethers.getAddress(menuEoa) : (fixedCardMetadata?.cardOwner && ethers.isAddress(fixedCardMetadata.cardOwner) ? ethers.getAddress(fixedCardMetadata.cardOwner) : null);
   if (resolved) setFeederEoa(resolved);
 }, [profiles?.[0]?.keyID, myAddress, fixedCardMetadata?.cardOwner]);

 /** Unified Base overview feeder: every 6s on Overview + Staff tabs. Card metadata without login; Daily Dashboard network summary uses card-level `getGlobalStatsFull` (all admins). Staff terminal stats remain per-admin. */
 const feederInProgressRef = useRef(false);
 const feederCancelledRef = useRef(false);
 const feederAccountRef = useRef('');
 /** Full indexer scan for all-time tips (CashTrees Settlement); throttled — bump nonce on Overview refresh. */
 const tipsLifetimeScanNonceRef = useRef(0);
 const tipsLifetimeAppliedNonceRef = useRef(0);
 const tipsLifetimeLastFullFetchMsRef = useRef(0);
 /** Session dedup for BeamioIndexerDiamond WSS `TransactionRecordSynced` (by txId hex) */
 const indexerInboundWssSeenRef = useRef<Set<string>>(new Set());
 /** Detect transition into Transactions tab to invalidate indexer cache (same render cycle as tx fetch effect). */
 const prevActiveTabForTxRef = useRef<string>(activeTab);
 feederAccountRef.current = feederEoa ?? '';
 useEffect(() => {
   if (!BIZ_OVERVIEW_FEEDER_TABS.has(activeTab)) return;
   feederCancelledRef.current = false;
   /** Resolved wallet for quota / BUint / consumption; null when not logged in (still fetch global stats + metadata). */
   const accountResolved = feederEoa && ethers.isAddress(feederEoa) ? ethers.getAddress(feederEoa) : null;
   const effectiveAdmin = effectiveAdminAddress ?? '';

   // Load trusted cache for immediate display
   const cachedMetadata = loadTrustedCache<FixedUserCardMetadata>(fixedCardMetadataCacheKey);
   const networkSummaryCacheKey =
     timeFilter === 'Today'
       ? `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:${effectiveAdmin.toLowerCase()}:network-summary:ptoday-local`
       : `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:${effectiveAdmin.toLowerCase()}:network-summary:p${overviewPeriodType}`;
   const networkSummaryLifetimeCacheKey =
     effectiveAdmin && ethers.isAddress(effectiveAdmin)
       ? `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:${effectiveAdmin.toLowerCase()}:network-summary:lifetime`
       : '';
   const adminTipsLifetimeStorageKey =
     effectiveAdmin && ethers.isAddress(effectiveAdmin)
       ? `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:${effectiveAdmin.toLowerCase()}:tips:lifetime`
       : '';
   /** Use account (current EOA) for quota cache key so we fetch even when fixedCardAdmins not yet loaded */
   const quotaCacheKey = `card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:${accountResolved ? accountResolved.toLowerCase() : ''}:quota-and-mint-counter`;
   const buintBalanceCacheKey = accountResolved ? `eoa:${accountResolved.toLowerCase()}:buint:balance` : '';
   const aa = profiles?.[0]?.aaAccount?.trim();
   /** EOA + AA addresses for BUint reserve read (same closure as cache key — do not use stale empty `account` inside async feederWork). */
   const buintReserveTargets: string[] = [];
   if (accountResolved) {
     const mainAc = ethers.getAddress(accountResolved);
     buintReserveTargets.push(mainAc);
     if (aa && ethers.isAddress(aa) && ethers.getAddress(aa).toLowerCase() !== mainAc.toLowerCase()) {
       buintReserveTargets.push(ethers.getAddress(aa));
     }
   }
   const cachedNetworkSummaryRaw = loadTrustedCache<BizNetworkSummaryRow>(networkSummaryCacheKey);
   const todayYmdForCache = formatLocalYmd(new Date());
   const cachedNetworkSummary =
     timeFilter === 'Today' &&
     cachedNetworkSummaryRaw &&
     cachedNetworkSummaryRaw.localDayKey !== todayYmdForCache
       ? null
       : cachedNetworkSummaryRaw;
   const cachedQuota = loadTrustedCache<{ quota: number; mintCounterFromClear: number }>(quotaCacheKey);
   const cachedBuintBalance = buintBalanceCacheKey ? loadTrustedCache<number>(buintBalanceCacheKey) : null;
   const cachedNetworkSummaryLifetime =
     loadTrustedCache<{ cadVol: number; txCount: number; usdc: number; vouchers: number }>(networkSummaryLifetimeCacheKey);
   const cachedTipsLifetime = adminTipsLifetimeStorageKey ? loadTrustedCache<number>(adminTipsLifetimeStorageKey) : null;

   if (cachedMetadata != null) setFixedCardMetadata(cachedMetadata);
   if (effectiveAdmin && ethers.isAddress(effectiveAdmin)) {
     if (cachedNetworkSummary != null) setAdminNetworkSummaryToday(cachedNetworkSummary);
     else setAdminNetworkSummaryToday(null);
     if (cachedNetworkSummaryLifetime != null) setAdminNetworkSummaryLifetime(cachedNetworkSummaryLifetime);
     else setAdminNetworkSummaryLifetime(null);
   } else {
     setAdminNetworkSummaryToday(null);
     setAdminNetworkSummaryLifetime(null);
   }
   if (cachedQuota != null && accountResolved) {
     setAdminMintLimitQuota(cachedQuota.quota);
     setAdminMintCounterFromClear(cachedQuota.mintCounterFromClear);
   }
   if (cachedBuintBalance != null && accountResolved) setProtocolFuelReserveBalance(cachedBuintBalance);
   if (effectiveAdmin && ethers.isAddress(effectiveAdmin)) {
     if (cachedTipsLifetime !== null) setAdminTipsLifetimeUSDC(cachedTipsLifetime);
     else setAdminTipsLifetimeUSDC(null);
   } else {
     setAdminTipsLifetimeUSDC(null);
   }

     const runFeeder = async () => {
     if (feederInProgressRef.current) return;
     feederInProgressRef.current = true;
     const accountRaw = (feederAccountRef.current || feederEoa || '').trim();
     const account = accountRaw && ethers.isAddress(accountRaw) ? ethers.getAddress(accountRaw) : '';
     const card = new ethers.Contract(staffProgramBeamioCardAddress, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
     const buint = new ethers.Contract(CONET_BUINT_ADDRESS, ERC20_BALANCE_ABI, conetDepinProvider);
     const indexerAsset = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ASSET_STATS_ABI, conetDepinProvider);
     const ACCOUNT_MODE_ALL = 0;

     const feederWork = async () => {
       await globalFetchQueue;

       // 0. Card metadata (HTTP, merged into 6s refresh)
       if (!feederCancelledRef.current) {
         try {
           const apiRes = await fetch(
             `${BEAMIO_APP_URL}/api/cardMetadata?cardAddress=${encodeURIComponent(staffProgramBeamioCardAddress)}`
           );
           let parsed: FixedUserCardMetadata | null = null;
           if (apiRes.ok) {
             const apiData = await apiRes.json() as { cardOwner?: string; metadata?: unknown };
             parsed = parseFixedUserCardMetadata(apiData.metadata, typeof apiData.cardOwner === 'string' ? apiData.cardOwner : undefined);
           }
           if (!parsed) {
             const normalizedCardAddress = staffProgramBeamioCardAddress.toLowerCase().replace(/^0x/, '');
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

       // 1. Daily Dashboard network summary: card-level `getGlobalStatsFull` (all admins). "Today" = local day via summed PERIOD_HOUR buckets.
       if (effectiveAdmin && ethers.isAddress(effectiveAdmin) && !feederCancelledRef.current) {
         try {
           if (timeFilter === 'Today') {
             const [periodLocalToday, parsedLifetime] = await Promise.all([
               aggregateGlobalNetworkSummaryLocalTodayFromHourlyBuckets(
                 staffProgramBeamioCardAddress,
                 baseRpcProviderDirect
               ),
               callGetGlobalStatsFullParsed(
                 staffProgramBeamioCardAddress,
                 PERIOD_DAY,
                 baseRpcProviderDirect,
                 0n,
                 0n
               ),
             ]);
             if (periodLocalToday && parsedLifetime && !feederCancelledRef.current) {
               setAdminNetworkSummaryToday(periodLocalToday);
               saveTrustedCache(networkSummaryCacheKey, periodLocalToday);
               const lifetimeSummary = {
                 cadVol: amountE6ToDisplayNumber(parsedLifetime.cumulativeTransferAmount),
                 txCount: Number(parsedLifetime.cumulativeTransfer),
                 usdc: amountE6ToDisplayNumber(parsedLifetime.cumulativeUSDCMint),
                 vouchers: amountE6ToDisplayNumber(parsedLifetime.cumulativeMint),
               };
               setAdminNetworkSummaryLifetime(lifetimeSummary);
               saveTrustedCache(networkSummaryLifetimeCacheKey, lifetimeSummary);
             } else if (!feederCancelledRef.current && cachedNetworkSummary != null) {
               setAdminNetworkSummaryToday(cachedNetworkSummary);
               if (cachedNetworkSummaryLifetime != null) setAdminNetworkSummaryLifetime(cachedNetworkSummaryLifetime);
               else setAdminNetworkSummaryLifetime(null);
             } else if (!feederCancelledRef.current) {
               setAdminNetworkSummaryToday(null);
               setAdminNetworkSummaryLifetime(null);
             }
           } else {
             const parsed = await callGetGlobalStatsFullParsed(
               staffProgramBeamioCardAddress,
               overviewPeriodType,
               baseRpcProviderDirect
             );
             if (parsed && !feederCancelledRef.current) {
               const summary: BizNetworkSummaryRow = {
                 cadVol: amountE6ToDisplayNumber(parsed.periodTransferAmount),
                 txCount: Number(parsed.periodTransfer),
                 usdc: amountE6ToDisplayNumber(parsed.periodUSDCMint),
                 vouchers: amountE6ToDisplayNumber(parsed.periodMint),
               };
               setAdminNetworkSummaryToday(summary);
               saveTrustedCache(networkSummaryCacheKey, summary);
               const lifetimeSummary = {
                 cadVol: amountE6ToDisplayNumber(parsed.cumulativeTransferAmount),
                 txCount: Number(parsed.cumulativeTransfer),
                 usdc: amountE6ToDisplayNumber(parsed.cumulativeUSDCMint),
                 vouchers: amountE6ToDisplayNumber(parsed.cumulativeMint),
               };
               setAdminNetworkSummaryLifetime(lifetimeSummary);
               saveTrustedCache(networkSummaryLifetimeCacheKey, lifetimeSummary);
             } else if (!feederCancelledRef.current && cachedNetworkSummary != null) {
               setAdminNetworkSummaryToday(cachedNetworkSummary);
               if (cachedNetworkSummaryLifetime != null) setAdminNetworkSummaryLifetime(cachedNetworkSummaryLifetime);
               else setAdminNetworkSummaryLifetime(null);
             } else if (!feederCancelledRef.current) {
               setAdminNetworkSummaryToday(null);
               setAdminNetworkSummaryLifetime(null);
             }
           }
         } catch {
           if (!feederCancelledRef.current && cachedNetworkSummary != null) setAdminNetworkSummaryToday(cachedNetworkSummary);
           if (!feederCancelledRef.current && cachedNetworkSummaryLifetime != null) {
             setAdminNetworkSummaryLifetime(cachedNetworkSummaryLifetime);
           }
         }
       } else if (!effectiveAdmin || !ethers.isAddress(effectiveAdmin)) {
         setAdminNetworkSummaryToday(null);
         setAdminNetworkSummaryLifetime(null);
       }

       // 2. Admin quota and mintCounterFromClear (account from feederAccountRef at execution time)
       if (account && ethers.isAddress(account) && !feederCancelledRef.current) {
         const step3QuotaCacheKey = `card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:${ethers.getAddress(account).toLowerCase()}:quota-and-mint-counter`;
         const step3CachedQuota = loadTrustedCache<{ quota: number; mintCounterFromClear: number }>(step3QuotaCacheKey);
         const cardDirect = new ethers.Contract(staffProgramBeamioCardAddress, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
         try {
           const adminLower = ethers.getAddress(account).toLowerCase();
           const fetchStatsWithRawFallback = async (): Promise<{ mintCounterFromClear: bigint }> => {
             try {
               const r = await cardDirect.getAdminStatsFull(account, 0, 0, 0) as { mintCounterFromClear: bigint };
               return r;
             } catch {
               const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI]);
               const calldata = iface.encodeFunctionData('getAdminStatsFull', [account, 0, 0, 0]);
               const hex = await baseRpcProviderDirect.call({ to: staffProgramBeamioCardAddress, data: calldata });
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
             const limitRes = await cardDirect.getAdminAirdropLimit(account) as { limit: bigint; unlimited: boolean };
             quotaDisplay = limitRes.unlimited ? Number.MAX_SAFE_INTEGER : amountE6ToDisplayNumber(limitRes.limit);
           }
           const mintCounterFromClear = amountE6ToDisplayNumber(statsRes.mintCounterFromClear);
           const result = { quota: quotaDisplay, mintCounterFromClear };
           if (process.env.NODE_ENV !== 'production') {
             console.warn('[feeder] Issued $CTree: fetched', { account: account.slice(0, 10) + '…', quota: result.quota, mintCounterFromClear: result.mintCounterFromClear, idx, adminsLen: admins.length });
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
       } else if (!account || !ethers.isAddress(account)) {
         setAdminMintLimitQuota(null);
         setAdminMintCounterFromClear(null);
       }

       // 2b. Staff table: per-linked-terminal admin stats (no separate useEffect / no fetchWithCache — same tick as Overview)
       if (!feederCancelledRef.current) {
         const termList = terminalsRef.current;
         const termAddrs = termList.filter((t) => t.id && ethers.isAddress(t.id)).map((t) => ethers.getAddress(t.id));
         if (termAddrs.length === 0) {
           if (!feederCancelledRef.current) setTerminalStats({});
         } else {
           const next: Record<string, BizTerminalChainStats | null> = {};
           for (const taddr of termAddrs) {
             if (feederCancelledRef.current) break;
             const k = taddr.toLowerCase();
             next[k] = await fetchBizTerminalChainStats(card, baseRpcProviderDirect, staffProgramBeamioCardAddress, taddr);
           }
           if (!feederCancelledRef.current) setTerminalStats(next);
         }
       }

       // 3. Protocol Fuel Reserve: CoNET BUint.balanceOf sum for user EOA + AA (same 6s feeder tick as indexer diamond consumption below).
       // Trusted-cache protocol: only overwrite on full successful read; partial RPC failure → keep last trusted (persisted + in-memory).
       if (accountResolved && buintReserveTargets.length > 0 && !feederCancelledRef.current) {
         const stepBuintKey = buintBalanceCacheKey;
         try {
           let sumRaw = 0n;
           let allOk = true;
           for (const addr of buintReserveTargets) {
             try {
               sumRaw += (await buint.balanceOf(addr)) as bigint;
             } catch {
               allOk = false;
               break;
             }
           }
           if (allOk && !feederCancelledRef.current) {
             const balance = Number(sumRaw) / 1_000_000;
             setProtocolFuelReserveBalance(balance);
             if (stepBuintKey) saveTrustedCache(stepBuintKey, balance);
           } else if (!feederCancelledRef.current) {
             const fb = stepBuintKey ? loadTrustedCache<number>(stepBuintKey) : null;
             if (fb != null) setProtocolFuelReserveBalance(fb);
           }
         } catch {
           if (!feederCancelledRef.current) {
             const fb = stepBuintKey ? loadTrustedCache<number>(stepBuintKey) : null;
             if (fb != null) setProtocolFuelReserveBalance(fb);
           }
         }
       } else if (!accountResolved) {
         setProtocolFuelReserveBalance(null);
       }

       // 4. Protocol Fuel “consumption” for the Overview panel is derived client-side from Transactions-list
       //    Charge rows (`fees.bServiceUnits6`) in `transactionsFilteredForTable`, scoped by header `timeFilter` — not fetched here.
       // 5. Overview “Tips Collected” period totals: semi-persistent `tipsCollectedLedgerRef` + Transactions filters (TX_TIP / legacy tip), not indexer period facet here.

       // 5b. All-time admin tips (indexer): PERIOD_YEAR buckets + pagination — CashTrees Settlement only; throttled to limit RPC load
       const TIPS_LIFETIME_MIN_INTERVAL_MS = 120_000;
       const forceTipsLifetime = tipsLifetimeScanNonceRef.current !== tipsLifetimeAppliedNonceRef.current;
       const tipsLifetimeDue =
         forceTipsLifetime || Date.now() - tipsLifetimeLastFullFetchMsRef.current >= TIPS_LIFETIME_MIN_INTERVAL_MS;
       if (effectiveAdmin && ethers.isAddress(effectiveAdmin) && adminTipsLifetimeStorageKey && tipsLifetimeDue && !feederCancelledRef.current) {
         try {
           let totalTips6 = 0n;
           const pageLimit = 100;
           const maxYearOffsets = 24;
           let emptyYearStreak = 0;
           for (let yearOff = 0; yearOff < maxYearOffsets; yearOff++) {
             if (feederCancelledRef.current) break;
             let pageOffset = 0;
             let yearSum6 = 0n;
             let reportedTotal = 0n;
             while (true) {
               const [total, , , page] = await indexerAsset.getAssetTransactionsByTopAdminAndCurrentPeriodOffsetAndAccountModePaged(
                 staffProgramBeamioCardAddress,
                 ethers.getAddress(effectiveAdmin),
                 PERIOD_YEAR,
                 yearOff,
                 pageOffset,
                 pageLimit,
                 TX_MERCHANT_PAY_TIP_UPDATED,
                 ACCOUNT_MODE_ALL,
                 CHAIN_ID_FILTER_ALL
               ) as [bigint, bigint, bigint, Array<{ finalRequestAmountUSDC6: bigint }>];
               reportedTotal = total;
               for (const tx of page ?? []) yearSum6 += tx.finalRequestAmountUSDC6;
               if (!page || page.length < pageLimit || pageOffset + page.length >= Number(total)) break;
               pageOffset += page.length;
             }
             totalTips6 += yearSum6;
             if (Number(reportedTotal) === 0 && yearSum6 === 0n) {
               emptyYearStreak += 1;
               if (emptyYearStreak >= 4) break;
             } else {
               emptyYearStreak = 0;
             }
           }
           const nextLifetimeTips = amountE6ToDisplayNumber(totalTips6);
           if (!feederCancelledRef.current) {
             setAdminTipsLifetimeUSDC(nextLifetimeTips);
             saveTrustedCache(adminTipsLifetimeStorageKey, nextLifetimeTips);
             tipsLifetimeAppliedNonceRef.current = tipsLifetimeScanNonceRef.current;
             tipsLifetimeLastFullFetchMsRef.current = Date.now();
           }
         } catch {
           if (!feederCancelledRef.current && cachedTipsLifetime !== null) setAdminTipsLifetimeUSDC(cachedTipsLifetime);
         }
       } else if (!effectiveAdmin || !ethers.isAddress(effectiveAdmin)) {
         setAdminTipsLifetimeUSDC(null);
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
   fixedCardMetadataCacheKey,
   fixedCardMetadata?.cardOwner,
   profiles?.[0]?.keyID,
   profiles?.[0]?.aaAccount,
   myAddress,
   timeFilter,
   staffProgramBeamioCardAddress,
 ]);

 // Fetch BeamioIndexerDiamond transactions: admin UI shows only this admin's accounting (account-based, excludes subordinates).
 useEffect(() => {
   if (!effectiveAdminAddress || !ethers.isAddress(effectiveAdminAddress)) {
     setIndexerTransactions([]);
     setIndexerTransactionsLoading(false);
     setIndexerTransactionsRefreshing(false);
     return;
   }
   let cancelled = false;
   const hadLocalList = indexerTxListCountRef.current > 0;
   if (hadLocalList) {
     setIndexerTransactionsRefreshing(true);
   } else {
     setIndexerTransactionsLoading(true);
   }
   const userAA = profiles?.[0]?.aaAccount?.trim();
   const userAAAddr = userAA && ethers.isAddress(userAA) ? ethers.getAddress(userAA) : '';
   const txKey = `eoa:${currentEoa}:indexer:tx:card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:${effectiveAdminAddress.toLowerCase()}${userAAAddr ? `:aa:${userAAAddr.toLowerCase()}` : ''}`;
   void fetchWithCache(txKey, async () => {
     const ACCOUNT_MODE_ALL = 0;
     const indexerAccount = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ACCOUNT_ABI, conetDepinProvider);
     const indexerAsset = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_ASSET_STATS_ABI, conetDepinProvider);
     type TxRow = {
       id: string
       originalPaymentHash?: string
       chainId: bigint
       txCategory: string
       displayJson: string
       timestamp: bigint
       payer: string
       payee: string
       finalRequestAmountFiat6: bigint
       finalRequestAmountUSDC6: bigint
       isAAAccount: boolean
       meta?: {
         afterNotePayer?: string
         afterNotePayee?: string
         requestAmountFiat6?: bigint
         requestAmountUSDC6?: bigint
         currencyFiat?: number
       }
       exists?: boolean
       topAdmin?: string
       subordinate?: string
       fees?: {
         gasChainType?: number | bigint
         gasWei?: bigint
         gasUSDC6?: bigint
         serviceUSDC6?: bigint
         bServiceUSDC6?: bigint
         bServiceUnits6?: bigint
         feePayer?: string
       }
     };
     const seen = new Set<string>();
     const all: Array<{
       id: string
       originalPaymentHash: string
       txCategory: string
       displayJson: string
       timestamp: string
       payer: string
       payee: string
       finalRequestAmountFiat6: string
       finalRequestAmountUSDC6: string
       meta?: {
         afterNotePayer?: string
         afterNotePayee?: string
         requestAmountFiat6?: bigint
         requestAmountUSDC6?: bigint
         currencyFiat?: number
       }
       topAdmin?: string
       subordinate?: string
       bServiceUnits6: string
       raw: Record<string, unknown>
     }> = [];
     const addPage = (page: TxRow[] | undefined) => {
       for (const tx of page ?? []) {
         if (!tx?.exists || !tx?.id) continue;
         if (isIndexerFetchedRowBunitLedger({ txCategory: String(tx.txCategory), payee: tx.payee ?? '' })) continue;
         const id = String(tx.id);
         if (seen.has(id)) continue;
         seen.add(id);
         const topAdmin = tx.topAdmin && tx.topAdmin !== ethers.ZeroAddress ? tx.topAdmin : undefined;
         const subordinate = tx.subordinate && tx.subordinate !== ethers.ZeroAddress ? tx.subordinate : undefined;
         const oph = tx.originalPaymentHash;
         const originalPaymentHash =
           typeof oph === 'string' && oph.startsWith('0x')
             ? oph
             : oph != null
               ? ethers.hexlify(oph as ethers.BytesLike)
               : ethers.ZeroHash;
         all.push({
           id: String(tx.id),
           originalPaymentHash,
           txCategory: String(tx.txCategory),
           displayJson: tx.displayJson ?? '',
           timestamp: String(tx.timestamp),
           payer: tx.payer,
           payee: tx.payee,
           finalRequestAmountFiat6: String(tx.finalRequestAmountFiat6 ?? 0n),
           finalRequestAmountUSDC6: String(tx.finalRequestAmountUSDC6 ?? 0n),
           meta: tx.meta,
           topAdmin,
           subordinate,
           bServiceUnits6: String(tx.fees?.bServiceUnits6 ?? 0n),
           raw: indexerPageTupleToTransactionJson(tx),
         });
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
           const [total, , , page] = await indexerAsset.getAssetTransactionsByCurrentPeriodOffsetAndAccountModePaged(staffProgramBeamioCardAddress, account, PERIOD_DAY, periodOffset, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL, CHAIN_ID_FILTER_ALL) as [bigint, bigint, bigint, TxRow[]];
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
          const [total, , , page] = await indexerAsset.getAssetTransactionsByTopAdminAndCurrentPeriodOffsetAndAccountModePaged(staffProgramBeamioCardAddress, topAdmin, PERIOD_DAY, periodOffset, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL, CHAIN_ID_FILTER_ALL) as [bigint, bigint, bigint, TxRow[]];
          addPage(page);
          if (Number(total) <= 100) return;
        } catch { return; }
      }
    };
    const queryAssetBySubordinate = async (subordinate: string) => {
      for (const periodOffset of [0, 1, 2]) {
        try {
          const [total, , , page] = await indexerAsset.getAssetTransactionsBySubordinateAndCurrentPeriodOffsetAndAccountModePaged(staffProgramBeamioCardAddress, subordinate, PERIOD_DAY, periodOffset, 0, 100, TX_CATEGORY_ZERO, ACCOUNT_MODE_ALL, CHAIN_ID_FILTER_ALL) as [bigint, bigint, bigint, TxRow[]];
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
    /** TX_TIP 等仅把 USDC 记入 assetActionIds[USDC]，不会出现在 getAssetTransactions*(asset=卡)。topAdminActionIds 含全量。 */
    const queryTopAdminLedger = async (topAdmin: string) => {
      for (const periodOffset of [0, 1, 2]) {
        try {
          const [total, , , page] = await indexerAccount.getTopAdminTransactionsByCurrentPeriodOffsetAndAccountModePaged(
            topAdmin,
            PERIOD_DAY,
            periodOffset,
            0,
            100,
            TX_CATEGORY_ZERO,
            ACCOUNT_MODE_ALL
          ) as [bigint, bigint, bigint, TxRow[]]
          addPage(page)
          if (Number(total) <= 100) return
        } catch {
          return
        }
      }
    }
    await queryTopAdminLedger(effectiveAdminAddress)
    if (userAAAddr && userAAAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase()) {
      await queryTopAdminLedger(userAAAddr)
    }
    if (myAddr && myAddr.toLowerCase() !== effectiveAdminAddress.toLowerCase() && myAddr.toLowerCase() !== userAAAddr.toLowerCase()) {
      await queryTopAdminLedger(myAddr)
    }
    return all.sort((a, b) => Number(BigInt(b.timestamp) - BigInt(a.timestamp))).slice(0, 50);
   }).then((rows) => {
     if (cancelled) return;
     const mapped = mapIndexerFetchedRowsToDisplay(rows);
     const eoaKey = currentEoa && ethers.isAddress(currentEoa) ? currentEoa.toLowerCase() : '';
     const deduped = mergeRenumberTxDisplays(mapped, eoaKey ? loadInboundTxDisplayCache(eoaKey) : []);
     if (eoaKey) {
       const preTip = buildTipsCollectedLedgerEntriesFromPremergeTips(deduped)
       if (preTip.length > 0) {
         const tm = tipsCollectedLedgerRef.current
         if (mergeTipsCollectedLedgerEntries(tm, preTip)) {
           trimTipsCollectedLedgerMap(tm, TIPS_COLLECTED_LEDGER_MAX_ENTRIES)
           saveTipsCollectedLedgerMapImmediate(eoaKey, tm)
           setTipsCollectedLedgerEpoch((n) => n + 1)
         }
       }
     }
     const absorbedTips = mergeTipRowsIntoParentCharges(deduped);
     const capped = absorbedTips.slice(0, 80);
     const merged = capped.map((r, idx) => ({ ...r, id: `TX-${1000 + capped.length - idx}` }));
     let slideKeysForAnim: string[] = [];
     setIndexerTransactions((prev) => {
       const prevIds = new Set(prev.map((t) => String(t.indexerTxId || t.id)));
       const firstOldIdx = merged.findIndex((m) => prevIds.has(String(m.indexerTxId || m.id)));
       let newAtTop: TxDisplayRow[] = [];
       if (prev.length > 0) {
         if (firstOldIdx < 0) {
           newAtTop = merged.filter((m) => !prevIds.has(String(m.indexerTxId || m.id)));
         } else if (firstOldIdx > 0) {
           newAtTop = merged.slice(0, firstOldIdx);
         }
       }
       slideKeysForAnim = newAtTop.map((t) => String(t.indexerTxId || t.id));
       return merged;
     });
     if (slideKeysForAnim.length > 0) {
       setTxSlideInKeys(slideKeysForAnim);
       window.setTimeout(() => setTxSlideInKeys([]), 880);
     }
     if (eoaKey) saveInboundTxDisplayCache(eoaKey, merged);
   }).catch(() => {
     if (!cancelled) {
       setIndexerTransactions((p) => (p.length > 0 ? p : []));
     }
   }).finally(() => {
     if (!cancelled) {
       setIndexerTransactionsLoading(false);
       setIndexerTransactionsRefreshing(false);
     }
   });
   return () => { cancelled = true; };
 }, [effectiveAdminAddress, profiles?.[0]?.aaAccount, myAddress, currentEoa, overviewRefreshTrigger, txListPollTick, staffProgramBeamioCardAddress]);

 /** Entering Transactions: Overview may already reflect new Base stats while indexer list was cached or never polled on this tab. */
 useEffect(() => {
   const enteredTx = activeTab === 'Transactions' && prevActiveTabForTxRef.current !== 'Transactions';
   prevActiveTabForTxRef.current = activeTab;
   if (!enteredTx) return;
   if (currentEoa && ethers.isAddress(currentEoa)) {
     invalidateFetchCache(`eoa:${currentEoa}:indexer:tx:`);
   }
   setTxListPollTick((n) => n + 1);
 }, [activeTab, currentEoa]);

 /** While on Transactions, periodically invalidate indexer tx cache so the list catches new records without relying only on WSS. */
 useEffect(() => {
   if (activeTab !== 'Transactions') return;
   const id = window.setInterval(() => {
     if (currentEoa && ethers.isAddress(currentEoa)) {
       invalidateFetchCache(`eoa:${currentEoa}:indexer:tx:`);
     }
     setTxListPollTick((n) => n + 1);
   }, 30_000);
   return () => window.clearInterval(id);
 }, [activeTab, currentEoa]);

 /** WSS: CoNET BeamioIndexerDiamond `TransactionRecordSynced` → inbound rows for user EOA/AA (payer|payee|topAdmin|subordinate) */
 useEffect(() => {
   if (typeof window === 'undefined') return;
   if (!CONET_MAINNET_WSS?.startsWith('wss://')) return;
   if (!effectiveAdminAddress || !ethers.isAddress(effectiveAdminAddress)) return;
   const eoaKey = currentEoa && ethers.isAddress(currentEoa) ? currentEoa.toLowerCase() : '';
   if (!eoaKey) return;

   indexerInboundWssSeenRef.current = new Set();

   const userAA = profiles?.[0]?.aaAccount?.trim();
   const userAAAddr = userAA && ethers.isAddress(userAA) ? ethers.getAddress(userAA) : '';
   const myAddr =
     typeof myAddress === 'string' && ethers.isAddress(myAddress) ? ethers.getAddress(myAddress) : '';

   const watchLower = new Set<string>();
   watchLower.add(ethers.getAddress(effectiveAdminAddress).toLowerCase());
   if (userAAAddr) watchLower.add(userAAAddr.toLowerCase());
   if (myAddr) watchLower.add(myAddr.toLowerCase());

   let ws: ethers.WebSocketProvider | null = null;
   let stopped = false;

   const httpReader = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_READ_FULL_AND_EVENT_ABI, conetDepinProvider);

   const onSynced = async (actionId: bigint, txId: unknown, _cat: unknown, payer: string, payee: string) => {
     if (stopped) return;
     void actionId;
     void payer;
     void payee;
     const tidHex =
       typeof txId === 'string'
         ? txId
         : txId != null
           ? ethers.hexlify(txId as ethers.BytesLike)
           : '';
     if (!tidHex || tidHex === ethers.ZeroHash) return;
     const tid = tidHex.toLowerCase();
     if (indexerInboundWssSeenRef.current.has(tid)) return;
     indexerInboundWssSeenRef.current.add(tid);
     try {
       const full = await httpReader.getTransactionFullByTxId(tidHex);
       const fr = full as unknown as Record<string, unknown>;
       if (!transactionFullMatchesUserWatch(fr, watchLower)) {
         indexerInboundWssSeenRef.current.delete(tid);
         return;
       }
       const row = transactionFullToFetchedRow(full);
       if (!row) {
         indexerInboundWssSeenRef.current.delete(tid);
         return;
       }
       if (isIndexerFetchedRowBunitLedger({ txCategory: row.txCategory, payee: row.payee ?? '' })) {
         indexerInboundWssSeenRef.current.delete(tid);
         return;
       }
       const [display] = mapIndexerFetchedRowsToDisplay([row]);
       setIndexerTransactions((prev) => {
         const deduped = mergeRenumberTxDisplays([display], prev);
         const absorbedTips = mergeTipRowsIntoParentCharges(deduped);
         const capped = absorbedTips.slice(0, 80);
         const merged = capped.map((r, idx) => ({ ...r, id: `TX-${1000 + capped.length - idx}` }));
         saveInboundTxDisplayCache(eoaKey, merged);
         return merged;
       });
       invalidateFetchCache(`eoa:${eoaKey}:indexer:tx:`);
     } catch {
       indexerInboundWssSeenRef.current.delete(tid);
     }
   };

   try {
     ws = new ethers.WebSocketProvider(CONET_MAINNET_WSS);
   } catch {
     return;
   }

   const sub = new ethers.Contract(BEAMIO_INDEXER_DIAMOND, INDEXER_READ_FULL_AND_EVENT_ABI, ws);
   sub.on('TransactionRecordSynced', onSynced);

   return () => {
     stopped = true;
     try {
       sub.removeAllListeners('TransactionRecordSynced');
     } catch {
       /* ignore */
     }
     const w = ws;
     /** Defer destroy: avoid ethers v6 race where `eth_subscribe` is still starting (React Strict Mode / rapid effect re-run). */
     window.setTimeout(() => {
       try {
         void w?.destroy();
       } catch {
         /* ignore */
       }
     }, 150);
   };
 }, [effectiveAdminAddress, profiles?.[0]?.aaAccount, myAddress, currentEoa]);

 /** Resolve payer / payee beamioTag for Customer & Source (searchUsername + fetchWithCache). Includes Charge/Tip, not only Top-Up — AA payer may differ from profile accounts.address. */
 useEffect(() => {
   if (activeTab !== 'Transactions') return;
   const tagSourceTxs = indexerTransactions.filter(
     (t) => t.type.includes('Top-Up') || t.type === 'Charge' || t.type === 'Tip'
   );
   const addrs = new Set<string>();
   for (const tx of tagSourceTxs) {
     const raw = tx.raw as Record<string, unknown>;
     const payer = typeof raw.payer === 'string' ? raw.payer : '';
     const payee = typeof raw.payee === 'string' ? raw.payee : '';
     if (payer && ethers.isAddress(payer)) addrs.add(ethers.getAddress(payer).toLowerCase());
     if (payee && ethers.isAddress(payee)) addrs.add(ethers.getAddress(payee).toLowerCase());
   }
   if (addrs.size === 0) return;
   let cancelled = false;
   void (async () => {
     const updates: Record<string, string> = {};
     await Promise.all(
       [...addrs].map(async (lower) => {
         try {
           const tag = await fetchWithCache(`beamio:searchTag:${lower}`, async () => {
             const ck = ethers.getAddress(lower);
             const res = await searchUsername(ck);
             const results = (res?.results ?? []) as Array<{ address?: string; username?: string; accountName?: string }>;
             const exact = results.find((r) => (r?.address ?? '').toLowerCase() === lower);
             const withName = results.find((r) => !!(r?.username ?? r?.accountName));
             const peer = exact ?? withName ?? results[0];
             const u = peer?.username ?? peer?.accountName;
             if (!u) return '';
             return u.startsWith('@') ? u : `@${u}`;
           });
           if (tag) updates[lower] = tag;
         } catch {
           /* ignore */
         }
       })
     );
     if (!cancelled && Object.keys(updates).length > 0) {
       setTxReportingBeamioTagByAddress((p) => ({ ...p, ...updates }));
     }
   })();
   return () => {
     cancelled = true;
   };
 }, [activeTab, indexerTransactions]);

 /** Charge rows: resolve payer tier on `BEAMIO_USER_CARD_ASSET_ADDRESS` for Customer & Source capsule */
 useEffect(() => {
   if (activeTab !== 'Transactions') return;
   const payers = new Set<string>();
   for (const tx of indexerTransactions) {
     if (tx.type !== 'Charge') continue;
     const raw = tx.raw as Record<string, unknown>;
     const payer = typeof raw.payer === 'string' ? raw.payer : '';
     if (payer && ethers.isAddress(payer)) payers.add(ethers.getAddress(payer).toLowerCase());
   }
   if (payers.size === 0) return;
   let cancelled = false;
   void (async () => {
     const updates: Record<string, { name: string; backgroundColor?: string } | null> = {};
     await Promise.all(
       [...payers].map(async (lower) => {
         try {
           const cacheKey = `payer:${lower}:program:${staffProgramBeamioCardAddress.toLowerCase()}:tier-capsule-v3`;
           const val = await fetchWithCache(cacheKey, async () =>
             fetchPayerInfraTierCapsuleMeta(ethers.getAddress(lower), baseRpcProviderDirect, staffProgramBeamioCardAddress)
           );
           updates[lower] = val as { name: string; backgroundColor?: string } | null;
         } catch {
           updates[lower] = null;
         }
       })
     );
     if (!cancelled) {
       setChargePayerInfraTierCapsuleByPayer((prev) => ({ ...prev, ...updates }));
     }
   })();
   return () => {
     cancelled = true;
   };
 }, [activeTab, indexerTransactions, staffProgramBeamioCardAddress]);

 const isFixedUserCardAdmin = fixedCardAdmins.some((address) => normalizedAdminCandidates.includes(address.toLowerCase()));
 /** Chain-verified admin for UI: only true when chain confirms; avoids persisted-session/cache showing admin to non-admin on production */
 const isAdminForUI = isCurrentUserCardAdmin === true;
 /** Staff: hide «Smart Terminal Locked» once user owns a self-issued BeamioUserCard (even if not infra-card admin). */
 const showStaffSmartTerminalLockedPanel =
   !isAdminForUI && profileOwnsIssuedBeamioCardFetched && !profileOwnsIssuedBeamioCard;
 /** Staff: terminal list + Link New Terminal — infra-card admin or owner of at least one self-issued BeamioUserCard. */
 const showStaffTerminalsManagement =
   isAdminForUI || (profileOwnsIssuedBeamioCardFetched && profileOwnsIssuedBeamioCard);

 /** User EOA is listed on the fixed card admin list → treat as joined to `ALLIANCE_ID_FOR_FIXED_USER_CARD` for UI */
 const merchantWalletEoa = (profiles?.[0]?.keyID ?? myAddress ?? '').trim();
 const eoaOnFixedCardAdminList =
   !!merchantWalletEoa &&
   ethers.isAddress(merchantWalletEoa) &&
   fixedCardAdmins.some((addr) => addr.toLowerCase() === ethers.getAddress(merchantWalletEoa).toLowerCase());

 const effectiveJoinedAlliances = useMemo(() => {
   if (!eoaOnFixedCardAdminList) return joinedAlliances;
   if (joinedAlliances.includes(ALLIANCE_ID_FOR_FIXED_USER_CARD)) return joinedAlliances;
   return [ALLIANCE_ID_FOR_FIXED_USER_CARD, ...joinedAlliances];
 }, [joinedAlliances, eoaOnFixedCardAdminList]);
 /** Smart Terminal (AA) present — mirrors newBiz `isAaUnlocked` for Market fuel cards */
 const hasAaAccount = Boolean(profiles?.[0]?.aaAccount?.trim());
 const membersLoyaltyFiltered = useMemo(() => {
   const q = membersLoyaltySearch.trim().toLowerCase();
   return membersLoyaltyRows.filter((m) => {
     const branchOk =
       membersLoyaltyBranch === BIZ_LOYALTY_BRANCHES[0] || m.store === membersLoyaltyBranch;
     if (!branchOk) return false;
     if (!q) return true;
     return (
       m.tag.toLowerCase().includes(q) ||
       m.address.toLowerCase().includes(q) ||
       m.tier.toLowerCase().includes(q)
     );
   });
 }, [membersLoyaltyRows, membersLoyaltySearch, membersLoyaltyBranch]);

 const closeIssueCardModal = useCallback(() => {
   setIsIssueCardModalOpen(false);
   window.setTimeout(() => {
     setIssueCardStep(1);
     setIssueTarget('');
     setIssueType('PREPAID');
     setIssueValue('');
     setIssueExpiry('Never');
     setIssueTokenSymbol('$CTree');
     setIsCreatingTier(false);
     setNewTierName('');
     setNewTierDiscount('');
   }, 300);
 }, []);

 const handleToggleLoyaltyMemberStatus = useCallback((id: string) => {
   setMembersLoyaltyRows((rows) =>
     rows.map((m) =>
       m.id === id ? { ...m, status: m.status === 'Active' ? 'Suspended' : 'Active' } : m
     )
   );
 }, []);

 const handleDeleteLoyaltyMember = useCallback((id: string) => {
   setMembersLoyaltyRows((rows) => rows.filter((m) => m.id !== id));
 }, []);

 const handleCreateLoyaltyTier = useCallback(() => {
   const name = newTierName.trim();
   const disc = parseFloat(newTierDiscount);
   if (!name || !Number.isFinite(disc)) return;
   const id = `ct_${Date.now()}`;
   setAlliancesDb((prev) => {
     const row = prev[ALLIANCE_ID_FOR_FIXED_USER_CARD];
     return {
       ...prev,
       [ALLIANCE_ID_FOR_FIXED_USER_CARD]: {
         ...row,
         tiers: [...row.tiers, { id, name, discount: Math.round(disc), iconType: 'emerald' as const }],
       },
     };
   });
   setIsCreatingTier(false);
   setNewTierName('');
   setNewTierDiscount('');
 }, [newTierName, newTierDiscount]);

 const handleConfirmIssueCard = useCallback(() => {
   setIssueCardStep(3);
   window.setTimeout(() => {
     const isPrepaid = issueType === 'PREPAID';
     const branchDefault =
       membersLoyaltyBranch === BIZ_LOYALTY_BRANCHES[0] ? 'Main Store' : membersLoyaltyBranch;
     const newMember: BizLoyaltyMemberRow = {
       id: `blm${Math.floor(1000 + Math.random() * 9000)}`,
       tag: issueTarget.startsWith('@') ? issueTarget : `@${issueTarget}`,
       address: `0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
       tier: isPrepaid ? 'Standard' : issueValue,
       balance: isPrepaid ? parseFloat(issueValue) || 0 : 0,
       ltv: 0,
       lastActive: 'Just joined',
       store: branchDefault,
       status: 'Active',
     };
     setMembersLoyaltyRows((prev) => [newMember, ...prev]);
   }, 400);
 }, [issueType, issueTarget, issueValue, membersLoyaltyBranch]);

 const hasLinkedMerchant = linkedMerchantAdmins.length > 0;
 /** When user is admin (incl. owner), always show panels. linkedMerchantAdmins excludes owner, so owner-only would wrongly hide. */
 const hideTransactionsPanel = linkedMerchantLookupDone && !hasLinkedMerchant && !isAdminForUI;
 const showFixedCardMetadata = activeTab === 'Overview' && isAdminForUI;
 const showOverviewSummary = isAdminForUI;

 const handleOverviewRefresh = useCallback(() => {
   tipsLifetimeScanNonceRef.current += 1;
   invalidateFetchCache(`card:${staffProgramBeamioCardAddress.toLowerCase()}`);
   invalidateFetchCache('indexer:tips');
   invalidateFetchCache('indexer:tx');
   invalidateFetchCache('eoa:');
   invalidateFetchCache('aa:');
   try {
     const adminSummaryPrefix = `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:admin:`;
     const globalSummaryPrefix = `eoa:${currentEoa}:card:${staffProgramBeamioCardAddress.toLowerCase()}:network-summary:global:`;
     Object.keys(window.localStorage)
       .filter((k) =>
         k.startsWith(`${BIZ_CACHE_PREFIX}${adminSummaryPrefix}`) ||
         k.startsWith(`${BIZ_CACHE_PREFIX}${globalSummaryPrefix}`) ||
         (k.startsWith(`${BIZ_CACHE_PREFIX}card:`) && (k.includes('quota-and-mint-counter') || k.includes('mint-limit-quota'))) ||
         (k.startsWith(BIZ_CACHE_PREFIX) && k.includes('buint:balance'))
       )
       .forEach((k) => window.localStorage.removeItem(k));
   } catch { /* ignore */ }
   setOverviewRefreshing(true);
   setOverviewRefreshTrigger((t) => t + 1);
   setTimeout(() => setOverviewRefreshing(false), 2500);
 }, [currentEoa, staffProgramBeamioCardAddress]);

 useEffect(() => {
   if (hideTransactionsPanel && activeTab === 'Transactions') {
     setActiveTab('Overview');
   }
 }, [activeTab, hideTransactionsPanel]);


 // --- Financial Data: Overview network summary uses `getGlobalStatsFull` on the staff/program BeamioUserCard (full card). "Today" = local calendar day via summed PERIOD_HOUR global buckets; other ranges = global period slice. Tips / tx list may still be admin-scoped. ---
 const adminToday = adminNetworkSummaryToday;
 const totalSales = effectiveAdminAddress && adminToday ? adminToday.cadVol : 0;
 /** Tips Collected (CAD Base): sum of CAD-equivalent from `finalRequestAmountFiat6` + `currencyFiat` (and USDC6→CAD when fiat leg is zero). */
 const totalTips = tipsCollectedOverviewSums.cadTotal;
 // Panel 3: token 0 mint in selected period (periodMint — USDC top-up, redeem, airdrop, etc.). periodUSDCMint alone is often 0 when no USDC gateway mint.
 const topUpsIssued = effectiveAdminAddress && adminToday ? adminToday.vouchers : 0;
 const topUpsUsdcMintOnly = effectiveAdminAddress && adminToday ? adminToday.usdc : 0;
const topUpsQuota = adminMintLimitQuota ?? 0; // denominator: mint limit from chain
const topUpsUsedFromClear = adminMintCounterFromClear ?? 0; // numerator: mintCounterFromClear from chain

const protocolFuelReserve = protocolFuelReserveBalance ?? 0; // B-Units: CoNET BUint.balanceOf(EOA)+balanceOf(AA) from 6s Overview feeder
/** Charge-only sum of `fees.bServiceUnits6` from `transactionsFilteredForTable`, windowed by header `timeFilter`. */
const protocolFuelConsumptionDisplayVal = protocolFuelConsumptionDisplayUnits;

 // Chain gives totals; points row uses `dashboardPointsCurrencySymbol` from card metadata. When not admin / no data, show 0.
 const salesCTree = totalSales;
 const salesUSDC = 0;
 const tipsUSDC = tipsCollectedOverviewSums.usdcPayments;
 const tipsCTree = tipsCollectedOverviewSums.nonUsdcCad;

 const totalCTreeReceived = salesCTree + totalTips;
 const netSettlementBalance = totalCTreeReceived - topUpsIssued;
 /** CashTrees Settlement + CAD payout drawer: chain cumulative subtree + all-time tips — independent of header day/week/month/quarter/year */
 const adminLifetime = adminNetworkSummaryLifetime;
 const totalSalesLifetime = effectiveAdminAddress && adminLifetime ? adminLifetime.cadVol : 0;
 const totalTipsLifetime = adminTipsLifetimeUSDC ?? 0;
 const topUpsIssuedLifetime = effectiveAdminAddress && adminLifetime ? adminLifetime.vouchers : 0;
 const salesCTreeLifetime = totalSalesLifetime;
 const tipsCTreeLifetime = totalTipsLifetime;
 const totalCTreeReceivedLifetime = salesCTreeLifetime + tipsCTreeLifetime;
 const netSettlementBalanceLifetime = totalCTreeReceivedLifetime - topUpsIssuedLifetime;
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
         ? 'bg-[#1562f0] text-white shadow-md hover:bg-[#2b74f5] active:bg-[#0d4ec4]'
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


   const allianceFee = netSettlementBalanceLifetime * 0.03;
   const finalBankAmount = netSettlementBalanceLifetime - allianceFee;


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
                 <p className="text-5xl font-light text-black tracking-tighter mb-1">${netSettlementBalanceLifetime.toFixed(2)}</p>
                 <p className="text-[14px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block mt-2">
                   CashTrees owes you CAD
                 </p>
               </div>


               <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
                 <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                   <Activity size={18} className="text-emerald-800" />
                   <span className="font-semibold text-[15px] text-black">Net Calculation ({dashboardPointsCurrencySymbol})</span>
                 </div>
                
                 <div className="p-6 space-y-4">
                   <div className="flex justify-between items-center">
                     <span className="text-[14px] text-slate-500 font-medium">{dashboardPointsCurrencySymbol} Received (Sales & Tips)</span>
                     <span className="text-[15px] font-semibold text-black">+${totalCTreeReceivedLifetime.toFixed(2)}</span>
                   </div>
                  
                   <div className="flex justify-between items-center">
                     <span className="text-[14px] text-slate-500 font-medium">{dashboardPointsCurrencySymbol} Issued (In-Store Top-Ups)</span>
                     <span className="text-[15px] font-semibold text-rose-500">-${topUpsIssuedLifetime.toFixed(2)}</span>
                   </div>
                  
                   <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-slate-400">
                     <span className="text-[14px] font-medium flex items-center gap-1.5">
                       Alliance Fee <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-500">3.0%</span>
                     </span>
                     <span className="text-[15px] font-semibold">-${allianceFee.toFixed(2)}</span>
                   </div>


                   <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                     <span className="text-[15px] font-bold text-black">Final Transfer to Bank</span>
                     <span className="text-[20px] font-bold text-emerald-800">${finalBankAmount.toFixed(2)}</span>
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
               <div className="mb-6 h-20 w-20 animate-spin rounded-full border-4 border-slate-100 border-t-[#1562f0] shadow-[0_0_24px_rgba(21,98,240,0.35)]" />
               <h3 className="text-xl font-bold text-black mb-2">Initiating Settlement...</h3>
               <p className="text-[15px] text-slate-500 font-medium text-center">
                 Burning Net {dashboardPointsCurrencySymbol} and<br/>notifying CashTrees Treasury.
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
                  <span className="text-[13px] font-mono text-emerald-800 font-semibold">0x8f2a...9c4b</span>
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
   <div data-biz-ui-primary={BIZ_UI_PRIMARY} className="flex h-screen bg-[#f5f5f7] font-sans text-slate-900 overflow-hidden selection:bg-[#1562f0]/25">
    
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
                <img src={BIZ_PUBLIC_LOGO512} alt="Beamio" className="w-full h-full object-cover" />
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
         <NavItem icon={CreditCard} label="Card Issuance Setup" isActive={activeTab === 'Card Issuance Setup'} onClick={() => handleTabChange('Card Issuance Setup')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         {!hideTransactionsPanel && (
           <NavItem icon={Receipt} label="Transactions" isActive={activeTab === 'Transactions'} onClick={() => handleTabChange('Transactions')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
         )}
         <NavItem icon={Award} label="Members & Loyalty" isActive={activeTab === 'MembersLoyalty'} onClick={() => handleTabChange('MembersLoyalty')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
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
             <RefreshCw size={12} className={`${bizUiPrimaryLoader} animate-[spin_4s_linear_infinite]`} />
             <span className="text-[11px] font-bold text-slate-500 tracking-wider">ORACLE: 1 CAD ≈ {(oracleCadUsdc ?? ORACLE_CAD_USDC_FALLBACK).toFixed(2)} USDC</span>
           </div>
           {/* GLOBAL TIME FILTER SELECTION */}
           <div className="hidden sm:flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-xl px-2 py-1.5 shadow-sm">
             <CalendarDays size={14} className="text-slate-400 ml-1" />
             <select
               value={timeFilter}
               onChange={(e) => {
                 const v = e.target.value
                 if ((OVERVIEW_TIME_FILTERS as readonly string[]).includes(v)) setTimeFilter(v as OverviewTimeFilter)
               }}
               className={`cursor-pointer appearance-none rounded-md bg-transparent pl-1 pr-6 text-[14px] font-medium text-slate-700 ${bizFocusRingClass}`}
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
               className="rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
               title="Refresh panel data"
             >
               <RefreshCw size={20} className={overviewRefreshing ? `animate-spin ${bizUiPrimaryLoader}` : ''} />
             </button>
           )}
           {activeTab !== 'Settings' && (
             <>
               <div className="h-6 w-[1px] bg-slate-200"></div>
               <div className="flex items-center gap-3">
                 <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-200 bg-white shadow-sm shrink-0">
                   <img src={BIZ_PUBLIC_LOGO512} alt="Beamio" className="w-full h-full object-cover" />
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
                <div className="relative h-[280px] w-full max-w-xl overflow-hidden rounded-[32px] border border-slate-800 bg-gradient-to-br from-slate-950 via-[#0f2247] to-[#0a0a0c] shadow-[0_0_40px_rgba(21,98,240,0.28)]">
                  {fixedCardMetadata?.image ? (
                    <img
                      src={fixedCardMetadata.image}
                      alt={fixedCardMetadata?.name || 'Merchant card'}
                      className="absolute inset-0 w-full h-full object-cover opacity-35 mix-blend-screen"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/45 to-[#0a0a0c]" />
                  <div className={`absolute -right-8 -top-8 h-36 w-36 rounded-full ${bizGlowBlurClass} blur-[70px]`} />
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
                          <span className="inline-flex rounded-lg border border-[#1562f0]/45 bg-[#1562f0]/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-100">
                            Linked Merchant Card
                          </span>
                          <div className="mt-2">
                            <AddressCapsule address={staffProgramBeamioCardAddress} className="bg-white/10 border-white/15 text-white/80 hover:bg-white/15" />
                          </div>
                        </div>
                      </div>
                      <div className="bg-white/8 backdrop-blur-md rounded-2xl border border-white/10 px-3 py-2 text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Status</p>
                        <p className="mt-1 text-[13px] font-semibold text-sky-200">Franchise Merchant</p>
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
              <div className="relative overflow-hidden rounded-[24px] bg-[#1562f0] p-6 text-white shadow-lg shadow-[#1562f0]/20 sm:p-8">
                <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
                {redeemAdminInProgress && (
                  <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[13px] font-medium text-white backdrop-blur-sm">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Redeeming admin access...
                  </div>
                )}
                <div className="relative z-10 max-w-2xl">
                  <h3 className="mb-2 text-[22px] font-bold">Welcome to VERRA Web3 POS!</h3>
                  <p className="mb-6 text-[15px] leading-relaxed text-white/80">
                    Your EOA Vault is ready. You can currently send/receive direct USDC payments.{' '}
                    <strong>Your Smart Terminal (AA) is locked.</strong> To unlock zero-gas routing, VIP
                    memberships, and voucher economies, you must activate your account with a Fuel Pack.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('Market');
                        setSelectedProduct('starter');
                      }}
                      className="flex items-center gap-2 rounded-[14px] bg-white px-6 py-3 text-[14px] font-semibold text-[#1562f0] shadow-sm transition-colors hover:bg-slate-50"
                    >
                      <Zap size={16} /> Buy B-Units to Activate
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
                     <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[12px] font-medium">
                       {timeFilter === 'Today' ? 'Today (local)' : timeFilter}
                     </span>
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
                       <span className="text-[11px] font-semibold text-emerald-600">{dashboardPointsCurrencySymbol}</span>
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
                     <span className="text-[10px] text-slate-500">
                       ≈ $
                       {(tipsUSDC / (oracleCadUsdc ?? ORACLE_CAD_USDC_FALLBACK)).toFixed(2)} CAD
                     </span>
                   </div>
				   {isAdminForUI && (
                   <div className="bg-emerald-50/50 px-3 py-2 rounded-2xl flex flex-col gap-0.5 shrink-0 min-w-[140px]">
                     <div className="flex items-center gap-1">
                       <Ticket size={12} className="text-emerald-600" />
                       <span className="text-[11px] font-semibold text-emerald-600">{dashboardPointsCurrencySymbol}</span>
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
                   <p className="text-[11px] text-slate-400 mb-2">Selected range · token mint (all paths)</p>
                   <p className="text-[40px] font-semibold text-black tracking-tighter leading-none">${topUpsIssued.toFixed(2)}</p>
                   {topUpsUsdcMintOnly > 0 ? (
                     <p className="text-[11px] text-slate-500 mt-2">USDC top-up mint: ${topUpsUsdcMintOnly.toFixed(2)}</p>
                   ) : null}
                 </div>
                 <div className="mt-6 pt-6 border-t border-slate-100">
                   {isAdminForUI ? (
                     effectiveAdminAddress ? (
                       <div className="bg-rose-50 px-4 py-3 rounded-2xl flex items-center justify-between">
                         <div className="flex flex-col gap-0.5">
                           <span className="text-[12px] font-semibold text-slate-700">Issued {dashboardPointsCurrencySymbol}</span>
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
                   <p className="text-[13px] text-slate-400">{overviewPeriodConsumptionCaption(timeFilter)}</p>
                   <p className="text-[16px] font-semibold text-amber-500">
                     {protocolFuelConsumptionDisplayVal >= 0 ? '' : '-'}
                     {Math.abs(protocolFuelConsumptionDisplayVal).toFixed(2)} Units
                   </p>
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
               <div className="relative flex flex-col justify-between overflow-hidden rounded-[48px] border border-slate-800 bg-gradient-to-br from-slate-900 via-[#0f2748] to-slate-950 p-10 text-white shadow-[0_20px_50px_rgba(21,98,240,0.2)]">
                 <div className={`pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full ${bizGlowBlurClass} blur-[80px]`} />
                 <div className="relative z-10">
                   <div className="flex justify-between items-start mb-6">
                     <p className="text-[14px] font-semibold text-[#1562f0] flex items-center gap-2">
                       <Ticket size={18} /> CashTrees Settlement
                     </p>
                     <span className="bg-white/10 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[12px] font-medium border border-white/5">Net Balance</span>
                   </div>
                   <div className="flex items-baseline gap-2 mb-6">
                     <p className="text-5xl sm:text-[56px] font-light tracking-tight leading-none">${netSettlementBalanceLifetime.toFixed(2)}</p>
                     <span className="text-xl sm:text-2xl text-slate-400 font-light">CAD</span>
                   </div>
                   <div className="flex items-center gap-3 text-[14px] font-medium text-slate-400 bg-black/20 p-4 rounded-[20px] w-max backdrop-blur-sm border border-white/5">
                     <span className="text-white">+${totalCTreeReceivedLifetime.toFixed(2)} Recv</span>
                     <span className="text-slate-600">|</span>
                     <span className="text-rose-400">-${topUpsIssuedLifetime.toFixed(2)} Issued</span>
                   </div>
                 </div>
                 <button
                   type="button"
                   onClick={() => setIsPayoutModalOpen(true)}
                   className={`relative z-10 w-full py-4 rounded-[20px] font-semibold text-[17px] transition-all flex items-center justify-center gap-2 active:scale-[0.98] mt-6 ${bizUiPrimarySolid}`}
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
           const filteredTx = transactionsFilteredForTable;
           const cadOracle = oracleCadUsdc ?? ORACLE_CAD_USDC_FALLBACK;
           const calculateTxNetValueCAD = (tx: TxDisplayRow) => {
             if (tx.type.includes('Top-Up')) return tx.ctreeAmount || 0;
             let tipCadExtra = 0
             if (tx.type === 'Charge' && tx.tipRaw) {
               const tr = tx.tipRaw.raw as Record<string, unknown>
               const tipFiat = parseIndexerUintE6Field(tr.finalRequestAmountFiat6)
               const tipMeta = parseIndexerMetaTuple(tr.meta)
               if (tipFiat > 0) {
                 const tipCur = beamioFiatCurrencyLabel(Number(tipMeta.currencyFiat))
                 tipCadExtra = approximateCadFromFinalRequestFiat6(tipFiat, tipCur, cadOracle)
               } else if (tx.tipRaw.usdcAmount > 0) {
                 tipCadExtra = tx.tipRaw.usdcAmount / cadOracle
               }
             }
             if (tx.type === 'Charge') {
               const raw = tx.raw as Record<string, unknown>
               const meta = parseIndexerMetaTuple(raw.meta)
               const finalFiat = parseIndexerUintE6Field(raw.finalRequestAmountFiat6)
               if (finalFiat > 0) {
                 const curLabel = beamioFiatCurrencyLabel(Number(meta.currencyFiat))
                 return approximateCadFromFinalRequestFiat6(finalFiat, curLabel, cadOracle) + tipCadExtra
               }
               return (tx.usdcAmount / cadOracle) + (tx.ctreeAmount || 0) + tipCadExtra
             }
             return (tx.usdcAmount / cadOracle) + (tx.ctreeAmount || 0);
           };
           /** Tip portion in CAD (merged Charge + tipRaw). */
           const mergedChargeTipCad = (tx: TxDisplayRow): number => {
             if (tx.type !== 'Charge' || !tx.tipRaw) return 0
             const tr = tx.tipRaw.raw as Record<string, unknown>
             const tipFiat = parseIndexerUintE6Field(tr.finalRequestAmountFiat6)
             const tipMeta = parseIndexerMetaTuple(tr.meta)
             if (tipFiat > 0) {
               const tipCur = beamioFiatCurrencyLabel(Number(tipMeta.currencyFiat))
               return approximateCadFromFinalRequestFiat6(tipFiat, tipCur, cadOracle)
             }
             if (tx.tipRaw.usdcAmount > 0) return tx.tipRaw.usdcAmount / cadOracle
             if (tx.tip > 0) return tx.tip / cadOracle
             return 0
           };
           /**
            * Pre–tier-discount “sticker” total in CAD (subtotal + tax + tip from NFC displayJson),
            * so strikethrough can sit above final net when tier discount applies.
            */
           const chargeBreakdownStrikeCad = (tx: TxDisplayRow): number | null => {
             if (tx.type !== 'Charge' || !tx.tipRaw) return null
             try {
               const raw = tx.raw as Record<string, unknown>
               const dj = raw.displayJson
               if (typeof dj !== 'string' || !dj.trim()) return null
               const o = JSON.parse(dj) as {
                 chargeBreakdown?: {
                   requestCurrency?: string
                   subtotalCurrencyAmount?: string
                   taxAmountCurrencyAmount?: string
                   tipCurrencyAmount?: string
                 }
               }
               const b = o.chargeBreakdown
               if (!b) return null
               const sub = parseFloat(String(b.subtotalCurrencyAmount ?? '').replace(/,/g, ''))
               const tax = parseFloat(String(b.taxAmountCurrencyAmount ?? '').replace(/,/g, ''))
               const tip = parseFloat(String(b.tipCurrencyAmount ?? '').replace(/,/g, ''))
               if (!Number.isFinite(sub) || !Number.isFinite(tax) || !Number.isFinite(tip)) return null
               const sum = sub + tax + tip
               if (!(sum > 0)) return null
               const cur = String(b.requestCurrency ?? 'CAD').toUpperCase()
               if (cur === 'CAD') return sum
               if (cur === 'USD' || cur === 'USDC') return sum / cadOracle
               return null
             } catch {
               return null
             }
           };
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
                <button type="button" onClick={() => setActiveLedger('AA')} disabled={!profiles?.[0]?.aaAccount} className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeLedger === 'AA' ? 'bg-white text-emerald-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
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
                  <input type="text" placeholder="Search receipt, hash..." value={txSearchTerm} onChange={(e) => setTxSearchTerm(e.target.value)} className={`pl-12 pr-4 py-3.5 sm:py-3 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-[20px] sm:rounded-2xl w-full sm:w-80 text-[15px] font-medium ${bizFocusRingClass} focus:border-[#1562f0] transition-all shadow-sm`} />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                  <select value={txFilterTerminal} onChange={(e) => setTxFilterTerminal(e.target.value)} className={`cursor-pointer appearance-none shrink-0 rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3.5 text-[14px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl sm:rounded-2xl sm:py-3 ${bizFocusRingClass} focus:border-[#1562f0]`}>
                    <option value="All">All Terminals</option>
                    {terminals.map((t) => (
                      <option key={t.tag} value={t.tag}>{t.name} ({t.tag})</option>
                    ))}
                    <option value="The Vault">The Vault (EOA)</option>
                  </select>
                  <select value={txFilterType} onChange={(e) => setTxFilterType(e.target.value)} className={`cursor-pointer appearance-none shrink-0 rounded-[20px] border border-slate-200/80 bg-white/80 px-4 py-3.5 text-[14px] font-semibold text-slate-700 shadow-sm backdrop-blur-xl sm:rounded-2xl sm:py-3 ${bizFocusRingClass} focus:border-[#1562f0]`}>
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
                    <Activity size={14} className="text-emerald-800" />
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
                    <span className="text-[11px] text-emerald-800 font-semibold mb-0.5 flex items-center gap-1"><Coins size={10} /> USDC</span>
                    <span className="text-[15px] font-bold text-slate-800">{summaryTotalUSDC.toFixed(2)}</span>
                  </div>
                  <div className="bg-white rounded-[14px] px-4 py-2.5 border border-slate-200/60 flex flex-col flex-1 sm:flex-none">
                    <span className="text-[11px] text-emerald-500 font-semibold mb-0.5 flex items-center gap-1"><Ticket size={10} /> Vouchers</span>
                    <span className="text-[15px] font-bold text-slate-800">{summaryTotalCAD.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
                {indexerTransactionsRefreshing ? (
                  <div
                    className="flex items-center justify-center gap-2 py-2.5 px-4 border-b border-slate-100/90 text-[12px] font-medium text-slate-600 bg-slate-50/50"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className={`w-3.5 h-3.5 animate-spin shrink-0 ${bizUiPrimaryLoader}`} aria-hidden />
                    <span>Updating transactions…</span>
                  </div>
                ) : null}
                <table className="w-full min-w-[1000px]">
                   <thead>
                     <tr className="bg-slate-50/50 text-left border-b border-slate-100/80">
                       <th className="px-8 py-5 text-[13px] font-medium text-slate-500">Recent Transaction</th>
                       <th className="px-6 py-5 text-[13px] font-medium text-slate-500">Customer &amp; Source</th>
                       <th className="px-6 py-5 text-[13px] font-medium text-slate-500">Payment Routing</th>
                       <th className="px-6 py-5 text-[13px] font-medium text-slate-500">Network &amp; Fuel</th>
                       <th className="px-8 py-5 text-[13px] font-medium text-slate-500 text-right">Net Value (CAD Base)</th>
                     </tr>
                   </thead>
                   <LayoutGroup id="merchant-os-tx-table">
                   <tbody className="divide-y divide-slate-100/80">
                      {indexerTransactionsLoading && indexerTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-8 py-16 text-center text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-slate-300 border-t-[#1562f0] rounded-full animate-spin" />
                              Loading transactions...
                            </span>
                          </td>
                        </tr>
                      ) : filteredTx.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-8 py-16 text-center text-slate-500">
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
                      filteredTx.map((tx, idx) => {
                        const isVaultTerminal = tx.terminal?.toLowerCase().includes('vault') || tx.terminal === 'The Vault';
                        const txTotalCAD = calculateTxNetValueCAD(tx);
                        const rowKey = String(tx.indexerTxId || tx.id || `idx-${idx}`);
                        const slideIn = txSlideInKeys.includes(rowKey);
                        return (
                        <motion.tr
                          key={rowKey}
                          layout="position"
                          initial={slideIn ? { x: 120, opacity: 0.65 } : false}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.88 }}
                          style={{ display: 'table-row' }}
                          className="hover:bg-slate-50/50 transition-colors group"
                        >
                           <td className="px-8 py-5 align-middle">
                             <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                                 tx.type.includes('Top-Up') ? 'bg-emerald-50 border-emerald-100/50 text-emerald-600' :
                                 isVaultTerminal ? 'bg-blue-50 border-blue-100 text-emerald-800' :
                                 tx.type === 'Tip' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                                 'bg-slate-50 border-slate-200/50 text-slate-600'
                               }`}>
                                 {tx.type === 'Tip' ? <Heart size={18} className="fill-rose-100" /> :
                                  tx.type.includes('Top-Up') ? <ArrowUpFromLine size={18}/> :
                                  <ArrowDownToLine size={18}/>}
                               </div>
                               <div>
                                 <div className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.type}</div>
                                 {tx.type.includes('Top-Up') || tx.type === 'Charge' || tx.type === 'Tip' ? (
                                   <div className="text-[13px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                     <span className="whitespace-nowrap">
                                       TX-{indexerTxIdBodyPrefix6(tx.indexerTxId)} • {tx.time}
                                     </span>
                                     <button
                                       type="button"
                                       onClick={() => setRawTxJsonModal(tx)}
                                       className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#1562f0] transition-colors shrink-0"
                                       title="View TxDisplayRow JSON (includes raw Transaction)"
                                       aria-label="View TxDisplayRow JSON"
                                     >
                                       <Code size={14} />
                                     </button>
                                   </div>
                                 ) : (
                                   <>
                                     <div className="text-[13px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                       <span className="whitespace-nowrap">{tx.id} • {tx.time}</span>
                                       <button
                                         type="button"
                                         onClick={() => setRawTxJsonModal(tx)}
                                         className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#1562f0] transition-colors shrink-0"
                                         title="View TxDisplayRow JSON (includes raw Transaction)"
                                         aria-label="View TxDisplayRow JSON"
                                       >
                                         <Code size={14} />
                                       </button>
                                     </div>
                                     <div className="text-[12px] text-slate-400 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                       <span>{tx.dateStr || dateString}</span>
                                       <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded" title="Processed by terminal">
                                         <MonitorSmartphone size={10}/> {tx.terminal}
                                       </span>
                                       {tx.topAdmin && (
                                         <span className="flex items-center gap-1 min-w-0" title="Top Admin (reporting)">
                                           <span className="text-slate-500 shrink-0">Top Admin</span>
                                           <AddressCapsule address={tx.topAdmin} className="bg-slate-100 border-slate-200 text-slate-700 max-w-[200px]" />
                                         </span>
                                       )}
                                     </div>
                                   </>
                                 )}
                               </div>
                             </div>
                           </td>

                           <td className="px-6 py-5 align-middle">
                             <div className="flex flex-col gap-1.5">
                               {tx.type.includes('Top-Up') || ((tx.type === 'Charge' || tx.type === 'Tip') && !isVaultTerminal) ? (
                                 (() => {
                                   const raw = tx.raw as Record<string, unknown>;
                                   const payerAddr =
                                     typeof raw.payer === 'string' && ethers.isAddress(raw.payer)
                                       ? ethers.getAddress(raw.payer)
                                       : '';
                                   const payeeAddr =
                                     typeof raw.payee === 'string' && ethers.isAddress(raw.payee)
                                       ? ethers.getAddress(raw.payee)
                                       : '';
                                   const payerLower = payerAddr.toLowerCase();
                                   const payeeLower = payeeAddr.toLowerCase();
                                   const payerTag = payerLower ? txReportingBeamioTagByAddress[payerLower] : '';
                                   const payeeTag = payeeLower ? txReportingBeamioTagByAddress[payeeLower] : '';
                                   const payerHandle = payerTag ? payerTag.replace(/^@/, '') : '';
                                   const tierCap =
                                     tx.type === 'Charge' && payerLower
                                       ? chargePayerInfraTierCapsuleByPayer[payerLower]
                                       : undefined;
                                   const tierPres =
                                     tierCap != null && tierCap.name ? infraTierCapsulePresentation(tierCap.backgroundColor) : null;
                                   /** Same as In-Store Top-Up: NFC only when payer tag is CashTreeDamo_* (Android POS / NFC path). */
                                   const useNfcSubtitle = payerHandle.startsWith('CashTreeDamo_')
                                   return (
                                     <>
                                       <div className="flex items-center gap-2 flex-wrap min-w-0">
                                         {payerTag ? (
                                           <span className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{payerTag}</span>
                                         ) : payerAddr ? (
                                           <AddressCapsule address={payerAddr} className="bg-slate-100 border-slate-200 text-slate-700" />
                                         ) : tx.type === 'Charge' || tx.type === 'Tip' ? (
                                           <span className="font-medium text-[15px] text-slate-500 italic whitespace-nowrap">Anonymous</span>
                                         ) : (
                                           <span className="font-medium text-[15px] text-slate-500">—</span>
                                         )}
                                         {tx.type === 'Charge' && tierCap != null && tierPres ? (
                                           <span
                                             className="inline-flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-1"
                                             style={tierPres.wrap}
                                             title="Payer membership tier (program BeamioUserCard NFT metadata)"
                                           >
                                             <ShieldCheck size={14} className="shrink-0" strokeWidth={2.25} style={{ color: tierPres.fg }} />
                                             <span
                                               className="text-[11px] font-bold whitespace-nowrap max-w-[160px] truncate"
                                               style={{ color: tierPres.fg }}
                                             >
                                               {tierCap.name}
                                             </span>
                                           </span>
                                         ) : null}
                                       </div>
                                       <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium flex-wrap">
                                         {useNfcSubtitle ? (
                                           <>
                                             <Nfc size={14} className="text-slate-400 shrink-0" />
                                             <span className="whitespace-nowrap">NFC •</span>
                                           </>
                                         ) : (
                                           <>
                                             <Smartphone size={14} className="text-emerald-800 shrink-0" />
                                             <span className="whitespace-nowrap">App •</span>
                                           </>
                                         )}
                                         {payeeTag ? (
                                           <span className="whitespace-nowrap">{payeeTag}</span>
                                         ) : payeeAddr ? (
                                           <AddressCapsule address={payeeAddr} className="bg-slate-50 border-slate-200 text-slate-600 text-[12px]" />
                                         ) : (tx.type === 'Charge' || tx.type === 'Tip') && tx.terminal ? (
                                           <span className="whitespace-nowrap">{tx.terminal}</span>
                                         ) : (
                                           <span className="text-slate-400">—</span>
                                         )}
                                       </div>
                                     </>
                                   );
                                 })()
                               ) : isVaultTerminal ? (
                                 <>
                                   <span className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.beamioTag || 'The Vault'}</span>
                                   <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium whitespace-nowrap">
                                     <Shield size={14} className="text-emerald-800" />
                                     <span>The Vault • On-Chain</span>
                                   </div>
                                 </>
                               ) : (
                                 <>
                                   <div className="flex items-center gap-2 flex-wrap">
                                     {tx.beamioTag ? (
                                       <span className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.beamioTag}</span>
                                     ) : (
                                       <span className="font-medium text-[15px] text-slate-500 italic whitespace-nowrap">Anonymous</span>
                                     )}
                                   </div>
                                   <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium whitespace-nowrap">
                                     {tx.source === 'APP' ? <Smartphone size={14} className="text-emerald-800" /> : <Nfc size={14} className="text-slate-400" />}
                                     <span>{tx.source === 'APP' ? 'App' : 'NFC'} • {tx.terminal}</span>
                                   </div>
                                   {tx.source === 'APP' && tx.beamioTag && (
                                     <div className="hidden lg:group-hover:flex items-center gap-1 pt-0.5">
                                       <button type="button" className="rounded-md bg-[#1562f0]/20 p-1.5 text-blue-900 hover:bg-[#1562f0] hover:text-white transition-colors" title="Send Message">
                                         <MessageSquare size={14} />
                                       </button>
                                       <button type="button" className="rounded-md bg-[#1562f0]/20 p-1.5 text-blue-900 hover:bg-[#1562f0] hover:text-white transition-colors" title="Send Smart Receipt">
                                         <Send size={14} />
                                       </button>
                                     </div>
                                   )}
                                 </>
                               )}
                             </div>
                           </td>

                           <td className="px-6 py-5 align-middle">
                             <div className="flex flex-col gap-1.5">
                               {tx.type === 'Charge' ? (() => {
                                 const raw = tx.raw as Record<string, unknown>
                                 const meta = parseIndexerMetaTuple(raw.meta)
                                 const finalFiat = parseIndexerUintE6Field(raw.finalRequestAmountFiat6)
                                 const pctOffStr = discountRateBpsToPercentOffLabel(meta.discountRateBps)
                                 if (!(finalFiat > 0)) {
                                   return <span className="text-[13px] font-medium text-slate-400">—</span>
                                 }
                                 const curLabel = beamioFiatCurrencyLabel(Number(meta.currencyFiat))
                                 const mainCad = approximateCadFromFinalRequestFiat6(finalFiat, curLabel, cadOracle)
                                 let tipFiatAdd = 0
                                 let tipUsdcAdd = 0
                                 if (tx.tipRaw) {
                                   const tr = tx.tipRaw.raw as Record<string, unknown>
                                   tipFiatAdd = parseIndexerUintE6Field(tr.finalRequestAmountFiat6)
                                   if (!(tipFiatAdd > 0) && tx.tipRaw.usdcAmount > 0) tipUsdcAdd = tx.tipRaw.usdcAmount
                                 }
                                 const tipUsdcAsDisplayFiat =
                                   tipUsdcAdd > 0
                                     ? curLabel === 'CAD'
                                       ? tipUsdcAdd / cadOracle
                                       : curLabel === 'USD' || curLabel === 'USDC'
                                         ? tipUsdcAdd
                                         : tipUsdcAdd / cadOracle
                                     : 0
                                 const displayFiatFull = finalFiat + tipFiatAdd + tipUsdcAsDisplayFiat
                                 const cadApproxFull = mainCad + mergedChargeTipCad(tx)
                                 return (
                                   <div className="flex flex-col gap-1.5 items-start">
                                     <div className="flex items-start gap-2">
                                       <Ticket size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                                       <div className="flex flex-col min-w-0">
                                         <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 whitespace-nowrap">
                                           {displayFiatFull.toFixed(2)}{' '}
                                           <span className="text-[12px] text-slate-400 font-medium">$CTree</span>
                                         </div>
                                         <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                                           ≈ ${cadApproxFull.toFixed(2)} CAD
                                         </span>
                                       </div>
                                     </div>
                                     {pctOffStr ? (
                                       <div className="w-fit rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-1">
                                         <span className="text-[11px] font-bold text-emerald-800">
                                           Auto-Routing: {pctOffStr}% Off
                                         </span>
                                       </div>
                                     ) : null}
                                   </div>
                                 )
                               })() : tx.type.includes('Top-Up') ? (
                                 (() => {
                                   const meta = parseIndexerMetaTuple(tx.raw.meta)
                                   const reqFiat = parseIndexerUintE6Field(meta.requestAmountFiat6)
                                   return (
                                     <div className="flex items-start gap-2">
                                       <Ticket size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                                       <div className="flex flex-col min-w-0">
                                         <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-900 whitespace-nowrap">
                                           {reqFiat.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">$CTree</span>
                                         </div>
                                         <span className="text-[11px] text-slate-400 font-medium mt-0.5">
                                           ≈ ${reqFiat.toFixed(2)} CAD
                                         </span>
                                       </div>
                                     </div>
                                   )
                                 })()
                               ) : tx.method === 'Tip' ? (
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2 text-[14px] font-semibold text-rose-600 whitespace-nowrap">
                                     <Heart size={15} className="text-rose-500 shrink-0" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
                                   </div>
                                   <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${(tx.usdcAmount / cadOracle).toFixed(2)} CAD</span>
                                 </div>
                               ) : tx.method === 'Mixed' ? (
                                 <>
                                   <div className="flex flex-col">
                                     <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                       <Ticket size={15} className="text-emerald-500 shrink-0" /> {tx.ctreeAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">$CTree</span>
                                     </div>
                                     <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${tx.ctreeAmount.toFixed(2)} CAD</span>
                                   </div>
                                   <div className="flex flex-col">
                                     <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                       <Coins size={15} className="text-emerald-800 shrink-0" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
                                     </div>
                                     <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${(tx.usdcAmount / cadOracle).toFixed(2)} CAD</span>
                                   </div>
                                 </>
                               ) : tx.method === 'Issued $CTree' ? (
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                     <Ticket size={15} className="text-emerald-500 shrink-0" /> {tx.ctreeAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">$CTree</span>
                                   </div>
                                   <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${tx.ctreeAmount.toFixed(2)} CAD</span>
                                 </div>
                               ) : tx.method.includes('No Discount') ? (
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                     <Coins size={15} className="text-emerald-800 shrink-0" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
                                   </div>
                                   <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${(tx.usdcAmount / cadOracle).toFixed(2)} CAD</span>
                                 </div>
                               ) : tx.method.includes('Black Tier') ? (
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                     <Crown size={15} className="text-yellow-500 shrink-0" /> {tx.ctreeAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">$CTree</span>
                                   </div>
                                   <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${tx.ctreeAmount.toFixed(2)} CAD</span>
                                 </div>
                               ) : tx.method === '$CTree or USDC' ? (
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                     <Coins size={15} className="text-emerald-800 shrink-0" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
                                   </div>
                                   <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${(tx.usdcAmount / cadOracle).toFixed(2)} CAD</span>
                                 </div>
                               ) : (
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                     <Ticket size={15} className="text-[#34C759] shrink-0" /> {tx.ctreeAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">$CTree</span>
                                   </div>
                                   <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${tx.ctreeAmount.toFixed(2)} CAD</span>
                                 </div>
                               )}
                             </div>
                           </td>

                           <td className="px-6 py-5 align-middle">
                             <div className="flex flex-col items-start gap-2">
                               {(tx.type.includes('Top-Up') || tx.type === 'Charge') && /^0x[0-9a-fA-F]{64}$/.test(tx.indexerTxId) ? (
                                 <a
                                   href={`https://basescan.org/tx/${tx.indexerTxId}`}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 hover:bg-slate-100 hover:border-slate-200 transition-colors cursor-pointer"
                                   title="View transaction on BaseScan"
                                 >
                                   {tx.status === 'Pending' ? (
                                     <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
                                   ) : (
                                     <CheckCircle2 size={12} className={isVaultTerminal ? 'text-blue-500 shrink-0' : 'text-emerald-500 shrink-0'} />
                                   )}
                                   <span className="text-[12px] font-mono text-slate-500">{tx.hash}</span>
                                 </a>
                               ) : (
                                 <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                   {tx.status === 'Pending' ? (
                                     <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
                                   ) : (
                                     <CheckCircle2 size={12} className={isVaultTerminal ? 'text-blue-500 shrink-0' : 'text-emerald-500 shrink-0'} />
                                   )}
                                   <span className="text-[12px] font-mono text-slate-500">{tx.hash}</span>
                                 </div>
                               )}
                               {tx.type.includes('Top-Up') ? (
                                 <div className="flex items-center gap-1.5 bg-blue-50/90 px-2 py-1 rounded-md border border-blue-100">
                                   <Sparkles size={12} className="text-emerald-800 shrink-0" />
                                   <span className="text-[11px] font-bold text-emerald-800">Sponsored</span>
                                 </div>
                               ) : tx.bUnits > 0 ? (
                                 <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-1 rounded-md border border-orange-500/10 cursor-help" title={`Protocol Fee: ${(tx.bUnits * 0.01).toFixed(2)} USDC`}>
                                   <Fuel size={12} className="text-orange-500 shrink-0" />
                                   <span className="text-[11px] font-bold text-orange-500">{tx.bUnits.toFixed(2)} B-Units</span>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/50">
                                   <span className="text-[11px] font-bold text-slate-400">0 B-Units (Base Gas)</span>
                                 </div>
                               )}
                             </div>
                           </td>

                           <td className="px-8 py-5 align-middle text-right">
                             {tx.type === 'Charge' && tx.tipRaw ? (() => {
                               const tipCadCol = mergedChargeTipCad(tx)
                               const strikeCad = chargeBreakdownStrikeCad(tx)
                               const showStrike =
                                 strikeCad != null && strikeCad > txTotalCAD + 0.015
                               const mainCls =
                                 tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-900'
                               return (
                                 <div className="flex flex-col items-end gap-1">
                                   <div className="flex items-baseline justify-end gap-2 flex-wrap">
                                     {showStrike ? (
                                       <span className="text-[15px] font-normal text-slate-400 line-through whitespace-nowrap tabular-nums">
                                         ${strikeCad.toFixed(2)}
                                       </span>
                                     ) : null}
                                     <span className={`font-semibold text-[18px] tracking-tight whitespace-nowrap tabular-nums ${mainCls}`}>
                                       ${txTotalCAD.toFixed(2)}
                                     </span>
                                   </div>
                                   <div className={`text-[12px] font-medium whitespace-nowrap tabular-nums ${tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-400'}`}>
                                     {tx.status === 'Pending'
                                       ? 'Pending Settlement'
                                       : tipCadCol > 0
                                         ? `Incl. $${tipCadCol.toFixed(2)} Tip`
                                         : 'No Tip'}
                                   </div>
                                 </div>
                               )
                             })() : (
                               <>
                                 <div className={`font-semibold text-[18px] tracking-tight whitespace-nowrap tabular-nums ${
                                   tx.type.includes('Top-Up') ? 'text-emerald-600' :
                                   tx.type === 'Tip' ? 'text-rose-600' :
                                   tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-900'
                                 }`}>
                                   {tx.type.includes('Top-Up') ? '+' : ''}${txTotalCAD.toFixed(2)}
                                 </div>
                                 <div className={`text-[12px] font-medium mt-1 whitespace-nowrap tabular-nums ${tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-400'}`}>
                                   {tx.status === 'Pending' ? 'Pending Settlement' : tx.tip > 0 ? `Incl. $${(tx.tip / cadOracle).toFixed(2)} Tip` : isVaultTerminal ? 'Treasury TX' : 'No Tip'}
                                 </div>
                               </>
                             )}
                           </td>
                        </motion.tr>
                        );
                      }))}
                   </tbody>
                   </LayoutGroup>
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
                   <div className={`pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full ${bizGlowBlurClass} blur-[80px]`} />
                   <div className="relative z-10">
                     <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-white/5 backdrop-blur-md rounded-[20px] flex items-center justify-center border border-white/10">
                              <Shield size={28} className="text-emerald-800" />
                           </div>
                           <div>
                              <h4 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-white">The Vault <span className="rounded-md border border-[#1562f0]/50 bg-[#1562f0]/30 px-2 py-0.5 text-[11px] font-bold text-sky-100">EOA</span></h4>
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
                      <button className="bg-[#1562f0] text-white py-3 rounded-[16px] text-[14px] font-semibold transition-all hover:bg-[#2b74f5] shadow-[0_8px_20px_rgba(21,98,240,0.3)] active:scale-[0.98] flex flex-col items-center justify-center gap-1">
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
                   <button onClick={() => setActiveTab('Alliances')} className="bg-[#1562f0] text-white px-6 py-3.5 rounded-[16px] font-semibold text-[15px] hover:bg-[#2b74f5] transition-colors shadow-lg shadow-[#1562f0]/25 active:scale-95 flex items-center gap-2">
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
                       <Zap size={28} className="text-emerald-800" />
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
                     <span className="text-[11px] text-emerald-800 font-medium">{aaUsdcBalance != null ? parseFloat(aaUsdcBalance).toFixed(2) : '—'} USDC</span>
                   </div>
                   {effectiveJoinedAlliances.map((aId) => {
                     const alliance = alliancesDb[aId];
                     const useAaCardPoints0 =
                       aId === ALLIANCE_ID_FOR_FIXED_USER_CARD && Boolean(profiles?.[0]?.aaAccount?.trim());
                     const displayVoucherNum: number | null = useAaCardPoints0
                       ? aaUserCardPointsToken0Balance
                       : alliance.aaBalance;
                     const voucherPending = useAaCardPoints0 && displayVoucherNum === null;
                     return (
                       <div key={aId} className={`${alliance.themeLightBg} rounded-[24px] p-5 sm:p-6 border border-white/50 shrink-0 min-w-[200px] sm:min-w-[240px] w-max`}>
                         <p className={`text-[13px] font-medium ${alliance.themeText} mb-1 truncate`}>{alliance.id} Vouchers</p>
                         <div className="flex items-baseline gap-1.5 mb-0.5">
                           <p className="text-3xl sm:text-[32px] font-semibold text-slate-900 tracking-tight">
                             {voucherPending ? '—' : displayVoucherNum!.toFixed(2)}
                           </p>
                           <span className={`text-[14px] ${alliance.themeText} font-medium`}>{alliance.token}</span>
                         </div>
                         <span className={`text-[11px] ${alliance.themeText} opacity-70 font-medium`}>
                           ≈ ${voucherPending ? '—' : displayVoucherNum!.toFixed(2)} CAD
                         </span>
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
                       <p className="text-[12px] font-medium text-slate-400 mb-0.5">Protocol Fuel (EOA + AA)</p>
                       <p className="text-[18px] font-mono font-semibold text-white tracking-tight">
                         {protocolFuelReserveBalance != null ? protocolFuelReserveBalance.toLocaleString() : '—'} B-Units
                       </p>
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
                         <Zap size={28} className="text-emerald-800" />
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

             {isAdminForUI && effectiveJoinedAlliances.length === 0 && (
               <div className="pt-8 mt-8 border-t border-slate-200/60">
                 <div
                   onClick={() => setActiveTab('Alliances')}
                   className="bg-white rounded-[32px] border border-slate-200 border-dashed p-8 cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-4 group"
                 >
                   <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1562f0]/20 transition-colors group-hover:bg-[#1562f0]/30">
                     <Hexagon size={24} className="text-blue-900" />
                   </div>
                   <div className="flex-1 min-w-0">
                     <h4 className="text-[18px] font-semibold text-slate-900">Partner Alliances</h4>
                     <p className="text-[14px] text-slate-500 mt-1">Manage your Merchant License NFTs and join new alliances.</p>
                   </div>
                   <ChevronRight size={20} className="text-slate-400 shrink-0" />
                 </div>
               </div>
             )}

             {effectiveJoinedAlliances.length > 0 && (
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
                         {effectiveJoinedAlliances.map((aId) => {
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
                {/* Product 0: Starter Fuel Pack (1 USDC) OR Custom Refill — aligned with newBiz */}
                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80 flex flex-col h-full">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5 flex-grow">
                    {!hasAaAccount ? (
                      <div>
                        <div className="mb-10 flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-3">
                          <span className="w-fit shrink-0 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Starter</span>
                          <span className="min-w-0 text-[13px] font-mono font-medium text-slate-400 break-words 2xl:text-right">Unlimited</span>
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
                    ) : (
                      <div>
                        <div className="mb-6 flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-3">
                          <span className="w-fit shrink-0 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Custom Refill</span>
                          <span className="min-w-0 text-[13px] font-mono font-medium text-slate-400 break-words 2xl:text-right">0.01 USDC / Unit</span>
                        </div>
                        <div className="flex justify-center mb-10 relative">
                          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          <div className="w-full bg-[#1a1c23] border border-emerald-500/30 rounded-[28px] p-6 flex flex-col items-center justify-center gap-2 shadow-[0_0_40px_rgba(16,185,129,0.15)] relative z-10">
                            <span className="text-[12px] font-bold text-emerald-500/70 tracking-widest uppercase mb-2 mt-2">Enter Amount</span>
                            <div className="flex items-center gap-2 border-b border-emerald-500/50 pb-2 mb-2 w-3/4 justify-center">
                              <span className="text-xl text-white font-medium">$</span>
                              <input
                                type="number"
                                min="1"
                                value={customFuelAmount}
                                onChange={(e) => setCustomFuelAmount(e.target.value)}
                                className="bg-transparent text-4xl font-bold text-white w-full text-center focus:outline-none placeholder-white/20"
                                placeholder="0"
                              />
                            </div>
                            <div className="text-center mt-2 mb-2">
                              <div className="text-[13px] font-bold text-emerald-500/70 tracking-widest uppercase">Yields {(Number(customFuelAmount) || 0) * 100} B-Units</div>
                            </div>
                          </div>
                        </div>
                        <h4 className="text-[28px] font-semibold text-white tracking-tight leading-tight">Custom Fuel Top-Up</h4>
                        <p className="text-[14px] font-medium text-emerald-500/80 mt-2 uppercase tracking-widest">Pay as you go routing</p>
                      </div>
                    )}

                    <div className="mt-10 flex flex-col gap-3 bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-4">
                      <div className="min-w-0 pr-1">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Total</p>
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white break-all tabular-nums">${!hasAaAccount ? '1' : (customFuelAmount || '0')}</p>
                          <span className="text-[13px] font-medium text-slate-500 shrink-0">USDC</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(!hasAaAccount ? 'starter' : 'custom_fuel')}
                        disabled={hasAaAccount && (!customFuelAmount || Number(customFuelAmount) <= 0)}
                        className="w-full shrink-0 bg-emerald-500 text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed 2xl:w-auto"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>

                {/* Product 1: Limited Fuel Pack */}
                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80 flex flex-col h-full">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5 flex-grow">
                    <div>
                      <div className="mb-10 flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-3">
                        <span className="w-fit shrink-0 bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Package A</span>
                        <span className="min-w-0 text-[13px] font-mono font-medium text-slate-400 break-words tabular-nums 2xl:text-right">842 / 1000</span>
                      </div>
                      <div className="flex justify-center mb-10 relative">
                        <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
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
                    <div className="mt-10 flex flex-col gap-3 bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-4">
                      <div className="min-w-0 pr-1">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pricing</p>
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white tabular-nums">$499</p>
                          <span className="text-[13px] font-medium text-slate-500 shrink-0">USDC</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedProduct('fuel')} className="w-full shrink-0 bg-orange-500 text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20 active:scale-95 2xl:w-auto">
                        View
                      </button>
                    </div>
                  </div>
                </div>

                {/* Product 2: Genesis Node Pack */}
                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80 flex flex-col h-full">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-[#1562f0]/20 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5 flex-grow">
                    <div>
                      <div className="mb-10 flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-3">
                        <span className="w-fit shrink-0 rounded-[8px] border border-[#1562f0]/45 bg-[#1562f0]/25 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-sky-200">Package B</span>
                        <span className="min-w-0 text-[13px] font-mono font-medium text-slate-400 break-words tabular-nums 2xl:text-right">247 / 300</span>
                      </div>
                      <div className="flex justify-center mb-10 relative">
                        <div className="absolute inset-0 bg-[#1562f0]/25 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="w-28 h-28 bg-[#1a1c23] border border-[#1562f0]/40 rounded-[28px] flex items-center justify-center shadow-[0_0_40px_rgba(21,98,240,0.15)] relative z-10">
                          <Activity size={40} className="text-emerald-800" strokeWidth={1.5} />
                        </div>
                      </div>
                      <h4 className="text-[28px] font-semibold text-white tracking-tight leading-tight">Genesis Node Pack</h4>
                      <p className="text-[14px] font-medium text-[#1562f0]/90 mt-2 uppercase tracking-widest">The Infrastructure Backbone</p>
                    </div>
                    <div className="mt-10 flex flex-col gap-3 bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md 2xl:flex-row 2xl:items-center 2xl:justify-between 2xl:gap-4">
                      <div className="min-w-0 pr-1">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pricing</p>
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white tabular-nums">$999</p>
                          <span className="text-[13px] font-medium text-slate-500 shrink-0">USDC</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedProduct('node')} className="w-full shrink-0 bg-[#1562f0] text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-[#2b74f5] transition-colors shadow-lg shadow-[#1562f0]/25 active:scale-95 2xl:w-auto">
                        View
                      </button>
                    </div>
                  </div>
                </div>
             </div>
           </div>
         )}

         {/* --- PARTNER ALLIANCES TAB --- (aligned with newBiz: joined cards + join CTA + Routing Rules) */}
         {activeTab === 'Alliances' && (
           <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Partner Alliances</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Manage your Ecosystem NFTs (ERC-1155) that grant routing logic and settlement privileges.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {effectiveJoinedAlliances.map((aId) => {
                  const alliance = alliancesDb[aId];
                  return (
                    <div key={aId} className={`${alliance.nftBg} rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.25)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border ${alliance.nftBorder}`}>
                      <div className="h-full p-8 relative z-10 flex flex-col">
                        <div className="flex justify-between items-start mb-8 relative">
                          <div className="w-16 h-16 rounded-[20px] border border-white/30 bg-white/10 flex items-center justify-center backdrop-blur-md relative z-20">
                            <CreditCard size={28} className="text-white" strokeWidth={1.5} />
                          </div>
                          <span className="bg-[#c8f7d9] text-[#127a3a] px-4 py-1.5 rounded-[8px] text-[13px] font-bold tracking-wide shadow-sm z-20">
                            Active
                          </span>
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
                              {alliance.privileges.map((priv, i) => (
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

                        <div className="mt-auto pt-6 border-t border-white/20 flex items-center justify-between">
                          <span className="text-[12px] font-medium text-white/70">Contract: <span className="font-mono text-white">0x...</span></span>
                          <button
                            type="button"
                            onClick={() => handleOpenConfig(aId)}
                            className="text-[13px] font-semibold text-slate-900 bg-white hover:bg-slate-100 px-3.5 py-2 rounded-[12px] transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <SlidersHorizontal size={14} /> Routing Rules
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {Object.keys(alliancesDb).length > effectiveJoinedAlliances.length && (
                  <div
                    onClick={() => setIsJoinAllianceModalOpen(true)}
                    className="bg-white/50 backdrop-blur-xl rounded-[32px] p-8 border border-slate-200 border-dashed flex flex-col items-center justify-center text-center min-h-[380px] hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Plus size={24} className="text-emerald-800" />
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

         {/* --- MEMBERS & LOYALTY TAB --- */}
         {activeTab === 'MembersLoyalty' && (
           <div className="max-w-[1400px] mx-auto animate-in fade-in duration-300 relative space-y-6 sm:space-y-8">
             {!hasAaAccount && (
               <div className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                 <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-slate-50 shadow-sm">
                   <Lock size={32} className="text-slate-400" />
                 </div>
                 <h3 className="mb-3 text-[24px] font-bold tracking-tight text-slate-900">Decentralized Loyalty Locked</h3>
                 <p className="mb-8 max-w-md text-[15px] font-medium leading-relaxed text-slate-500">
                   Memberships require a Brand Loyalty Contract on Base L2. Activate your Smart Terminal with a Fuel Pack to deploy your contract.
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     setActiveTab('Market');
                     setSelectedProduct('starter');
                   }}
                   className="flex items-center gap-2 rounded-[16px] bg-[#1562f0] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(21,98,240,0.25)] transition-colors hover:bg-[#2b74f5] active:scale-95"
                 >
                   <Zap size={18} /> Buy B-Units to Activate
                 </button>
               </div>
             )}

             <div
               className={`space-y-6 sm:space-y-8 ${
                 !hasAaAccount ? 'pointer-events-none select-none opacity-40 blur-sm' : ''
               }`}
             >
               <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                 <div>
                   <h3 className="text-[26px] font-semibold tracking-tight text-slate-900">Members & Loyalty</h3>
                   <p className="mt-1 text-[15px] font-medium text-slate-500">
                     Manage global VIP tiers and prepaid balances across your franchise.
                   </p>
                 </div>
                 <button
                   type="button"
                   onClick={() => setIsIssueCardModalOpen(true)}
                   className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#1562f0] px-6 py-4 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(21,98,240,0.25)] transition-all hover:shadow-[0_12px_24px_rgba(21,98,240,0.35)] active:scale-[0.98] sm:w-auto sm:py-3.5"
                 >
                   <UserPlus size={20} strokeWidth={2.5} /> Issue New Asset
                 </button>
               </div>

               <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                 <div className="flex flex-col justify-between rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
                   <div className="mb-4 flex items-center gap-3">
                     <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#1562f0]">
                       <Users size={20} />
                     </div>
                     <p className="text-[13px] font-bold uppercase tracking-widest text-slate-400">Total Network Members</p>
                   </div>
                   <p className="text-3xl font-light tracking-tight text-slate-900">
                     {membersLoyaltyRows.length.toLocaleString()}
                   </p>
                 </div>
                 <div className="flex flex-col justify-between rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
                   <div className="mb-4 flex items-center gap-3">
                     <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                       <BadgeInfo size={20} />
                     </div>
                     <p className="text-[13px] font-bold uppercase tracking-widest text-slate-400">Active Prepaid Balances</p>
                   </div>
                   <div className="flex items-baseline gap-1.5">
                     <p className="text-3xl font-light tracking-tight text-slate-900">
                       ${membersLoyaltyRows.reduce((sum, m) => sum + m.balance, 0).toFixed(2)}
                     </p>
                     <span className="text-[13px] font-medium text-slate-500">CAD</span>
                   </div>
                 </div>
                 <div className="flex flex-col justify-between rounded-[24px] border border-slate-100 bg-white p-6 shadow-sm">
                   <div className="mb-4 flex items-center gap-3">
                     <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-500">
                       <Crown size={20} />
                     </div>
                     <p className="text-[13px] font-bold uppercase tracking-widest text-slate-400">VIP Tiers Issued</p>
                   </div>
                   <p className="text-3xl font-light tracking-tight text-slate-900">
                     {membersLoyaltyRows.filter((m) => m.tier !== 'Standard').length}
                   </p>
                 </div>
               </div>

               <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:rounded-[32px]">
                 <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:p-6">
                   <div className="relative w-full sm:max-w-xs">
                     <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                     <input
                       type="text"
                       placeholder="Search @tag or address..."
                       value={membersLoyaltySearch}
                       onChange={(e) => setMembersLoyaltySearch(e.target.value)}
                       className={`w-full rounded-[14px] border border-slate-200/60 bg-white py-2.5 pl-11 pr-4 text-[13px] font-medium text-slate-900 ${bizFocusRingClass} focus:border-[#1562f0]`}
                     />
                   </div>
                   <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                     <select
                       value={membersLoyaltyBranch}
                       onChange={(e) => setMembersLoyaltyBranch(e.target.value)}
                       className={`w-full cursor-pointer rounded-[14px] border border-slate-200/60 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 sm:w-auto ${bizFocusRingClass}`}
                     >
                       {BIZ_LOYALTY_BRANCHES.map((b) => (
                         <option key={b} value={b}>
                           {b}
                         </option>
                       ))}
                     </select>
                     <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                       <Filter size={16} /> Filter by store
                     </div>
                   </div>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full min-w-[950px]">
                     <thead className="border-b border-slate-100/80 bg-slate-50/50 text-left">
                       <tr>
                         <th className="px-6 py-5 text-[12px] font-semibold text-slate-400">Customer Identity</th>
                         <th className="px-6 py-5 text-center text-[12px] font-semibold text-slate-400">Status</th>
                         <th className="px-6 py-5 text-center text-[12px] font-semibold text-slate-400">Active Tier</th>
                         <th className="px-6 py-5 text-right text-[12px] font-semibold text-slate-400">Prepaid Balance</th>
                         <th className="px-6 py-5 text-right text-[12px] font-semibold text-slate-400">Lifetime Value (LTV)</th>
                         <th className="px-6 py-5 text-right text-[12px] font-semibold text-slate-400">Issuing Store</th>
                         <th className="px-6 py-5 text-right text-[12px] font-semibold text-slate-400 sm:px-8">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100/80">
                       {membersLoyaltyFiltered.map((member) => (
                         <tr
                           key={member.id}
                           className={`transition-colors ${
                             member.status === 'Suspended'
                               ? 'bg-rose-50/20'
                               : 'hover:bg-slate-50/50'
                           }`}
                         >
                           <td className="px-6 py-4">
                             <div className="flex items-center gap-3">
                               <div
                                 className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white shadow-sm ${
                                   member.status === 'Suspended'
                                     ? 'bg-rose-300'
                                     : member.balance > 0
                                       ? 'bg-[#1562f0]'
                                       : 'bg-slate-300'
                                 }`}
                               >
                                 {member.tag.replace('@', '').substring(0, 2).toUpperCase()}
                               </div>
                               <div>
                                 <div
                                   className={`text-[15px] font-semibold ${
                                     member.status === 'Suspended'
                                       ? 'text-slate-400 line-through'
                                       : 'text-slate-900'
                                   }`}
                                 >
                                   {member.tag}
                                 </div>
                                 <div className="mt-0.5 font-mono text-[12px] font-medium text-slate-400">
                                   {member.address}
                                 </div>
                               </div>
                             </div>
                           </td>
                           <td className="px-6 py-4 text-center">
                             {member.status === 'Active' ? (
                               <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/50 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                                 <CheckCircle2 size={12} /> Active
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1.5 rounded-md border border-rose-200/50 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600">
                                 <Ban size={12} /> Suspended
                               </span>
                             )}
                           </td>
                           <td className="px-6 py-4 text-center">
                             {member.tier === 'Black VIP' ? (
                               <span className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] font-bold text-yellow-400 shadow-sm">
                                 <Crown size={12} className="text-yellow-400" /> VIP
                               </span>
                             ) : member.tier === 'Green Card' ? (
                               <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/50 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-600">
                                 <ShieldCheck size={12} className="text-emerald-500" /> Green
                               </span>
                             ) : member.tier === 'Standard' ? (
                               <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/50 bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                                 Standard
                               </span>
                             ) : (
                               <span className="inline-flex items-center gap-1 rounded-md border border-[#1562f0]/20 bg-[#1562f0]/10 px-2 py-1 text-[11px] font-bold text-[#1562f0]">
                                 <Crown size={12} /> {member.tier}
                               </span>
                             )}
                           </td>
                           <td className="px-6 py-4 text-right">
                             <span
                               className={`text-[15px] font-semibold ${
                                 member.status === 'Suspended'
                                   ? 'text-slate-400'
                                   : member.balance > 0
                                     ? 'text-[#1562f0]'
                                     : 'text-slate-400'
                               }`}
                             >
                               ${member.balance.toFixed(2)}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                             <span
                               className={`text-[15px] font-semibold ${
                                 member.status === 'Suspended' ? 'text-slate-400' : 'text-slate-900'
                               }`}
                             >
                               ${member.ltv.toFixed(2)}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                             <span className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1 text-[13px] font-medium text-slate-500">
                               {member.store}
                             </span>
                             <div className="mt-1 text-[11px] text-slate-400">{member.lastActive}</div>
                           </td>
                           <td className="flex items-center justify-end gap-2 px-6 py-4 text-right sm:px-8">
                             <button
                               type="button"
                               onClick={() => handleToggleLoyaltyMemberStatus(member.id)}
                               className={`rounded-[12px] p-2.5 shadow-sm transition-colors ${
                                 member.status === 'Active'
                                   ? 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white'
                                   : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                               }`}
                               title={member.status === 'Active' ? 'Suspend' : 'Reactivate'}
                             >
                               {member.status === 'Active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                             </button>
                             <button
                               type="button"
                               onClick={() => handleDeleteLoyaltyMember(member.id)}
                               className="rounded-[12px] bg-slate-50 p-2.5 text-slate-400 shadow-sm transition-colors hover:bg-rose-500 hover:text-white"
                               title="Remove from list"
                             >
                               <Trash2 size={16} />
                             </button>
                           </td>
                         </tr>
                       ))}
                       {membersLoyaltyFiltered.length === 0 && (
                         <tr>
                           <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                             <Search size={24} className="mx-auto mb-2 opacity-50" />
                             No members match this filter.
                           </td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                 </div>
               </div>
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
                   <input type="text" placeholder="Search CoNET tags..." className={`w-full rounded-[14px] border border-slate-200/60 bg-slate-50 py-2.5 pl-11 pr-4 text-[13px] font-medium text-slate-900 transition-all ${bizFocusRingClass} focus:border-[#1562f0]`} />
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto scrollbar-hide">
                 {MOCK_CONTACTS.map((contact) => (
                   <div
                     key={contact.id}
                     onClick={() => setActiveContact(contact.id)}
                     className={`p-4 border-b border-slate-50 cursor-pointer transition-colors flex items-center gap-4 ${activeContact === contact.id ? 'bg-[#1562f0]/10 border-l-4 border-l-[#1562f0]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}
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
                   <button className="p-3 text-slate-400 hover:bg-[#1562f0]/15 hover:text-[#1562f0] rounded-full transition-colors shrink-0">
                     <Paperclip size={20} />
                   </button>
                   <div className="flex-1 relative">
                     <input
                       type="text"
                       placeholder="Type an encrypted message..."
                       value={chatInput}
                       onChange={(e) => setChatInput(e.target.value)}
                       onKeyDown={(e) => { if (e.key === 'Enter' && chatInput.trim()) setChatInput(''); }}
                       className={`w-full rounded-[20px] border border-slate-200/60 bg-slate-50 py-4 pl-5 pr-12 text-[15px] font-medium text-slate-900 transition-all ${bizFocusRingClass} focus:border-[#1562f0]`}
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
             {showStaffSmartTerminalLockedPanel && (
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
                     <button onClick={() => setActiveTab('Alliances')} className="bg-[#1562f0] text-white px-6 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-[#2b74f5] transition-colors shadow-md flex items-center gap-2">
                       <Hexagon size={18} /> Join Alliance
                     </button>
                   </div>
                 </div>
               </div>
             )}

             {showStaffTerminalsManagement && (
           <div className="space-y-6">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-black tracking-tight">Staff Terminals</h3>
                  <p className="text-[13px] font-medium text-slate-500 mt-1">Manage linked POS devices and their EOA authorizations.</p>
                </div>
                <button
                  onClick={() => setIsAddTerminalOpen(true)}
                  className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[14px] font-bold shadow-lg shadow-[#1562f0]/30 transition-all active:scale-95 ${bizUiPrimarySolid}`}
                >
                  <Plus size={18} strokeWidth={2.5} /> Link New Terminal
                </button>
              </div>


              <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px]">
                    <thead className="bg-slate-50/50 text-left border-b border-slate-100/80">
                      <tr className="bg-slate-50/50 text-left border-b border-slate-100/80">
                        <th className="px-6 sm:px-8 py-5 text-[12px] font-semibold text-slate-400">Terminal Identity</th>
                        <th className="px-6 py-5 text-[12px] font-semibold text-slate-400">Linked EOA Address</th>
                        <th className="px-6 py-5 text-[12px] font-semibold text-slate-400 text-center">Status</th>
                        <th className="px-6 py-5 text-[12px] font-semibold text-slate-400 text-right">Daily Issuance</th>
                        <th className="px-6 sm:px-8 py-5 text-[12px] font-semibold text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {terminalsLoading ? (
                        <tr>
                          <td colSpan={5} className="px-6 sm:px-8 py-16 text-center text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-slate-300 border-t-[#1562f0] rounded-full animate-spin" />
                              Loading terminals...
                            </span>
                          </td>
                        </tr>
                      ) : terminals.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 sm:px-8 py-16 text-center text-slate-500">
                            No terminals linked yet. Click &quot;Link New Terminal&quot; to add one.
                          </td>
                        </tr>
                      ) : (
                        terminals.map((term) => (
                          <tr key={term.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 sm:px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-[16px] bg-slate-50 flex items-center justify-center text-emerald-800 border border-slate-100">
                                  <MonitorSmartphone size={22} />
                                </div>
                                <div>
                                  <div className="font-semibold text-[16px] text-slate-900">{term.tag}</div>
                                  <div className="text-[13px] font-medium text-slate-500 mt-0.5">{term.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6">
                              <div className="flex items-center gap-2 min-w-0">
                                <AddressCapsule address={term.id} className="bg-slate-50 border-slate-100 text-slate-600 max-w-full" />
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[12px] font-semibold">
                                <CheckCircle2 size={14} /> {term.status}
                              </span>
                              <div className="text-[12px] font-medium text-slate-400 mt-2">{term.lastActive}</div>
                            </td>
                            <td className="px-6 py-6 text-right">
                              {(() => {
                                const s = terminalStats[term.id.toLowerCase()];
                                if (s == null) {
                                  return <span className="text-[14px] font-medium text-slate-400">—</span>;
                                }
                                const issued = s.mintCounterFromClear;
                                const unlimited = s.remainingAvailable >= Number.MAX_SAFE_INTEGER;
                                const quota = unlimited ? null : issued + s.remainingAvailable;
                                const pct =
                                  quota != null && quota > 0 ? Math.min(100, (issued / quota) * 100) : 0;
                                return (
                                  <div className="flex flex-col items-end gap-1.5">
                                    <span className="font-semibold text-[15px] text-slate-900 tabular-nums">
                                      ${issued.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                                      <span className="text-slate-400 text-[13px] font-medium">
                                        /{' '}
                                        {quota != null
                                          ? `$${quota.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                                          : '∞'}
                                      </span>
                                    </span>
                                    {quota != null && quota > 0 ? (
                                      <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            issued >= quota
                                              ? 'bg-rose-500'
                                              : issued >= quota * 0.8
                                                ? 'bg-amber-400'
                                                : 'bg-emerald-500'
                                          }`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-6 sm:px-8 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetTerminalLimitError(null);
                                    setResetTerminalLimitModal(term);
                                  }}
                                  className="rounded-[14px] bg-blue-50 p-3 text-blue-900 transition-colors hover:bg-[#1562f0] hover:text-white"
                                  title="Reset terminal issuance limit (parent admin)"
                                >
                                  <RefreshCcw size={18} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTerminalToRemove(term)}
                                  className="p-3 bg-rose-50 text-rose-500 rounded-[14px] hover:bg-rose-500 hover:text-white transition-colors"
                                  title="Revoke Authorization"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
             )}
           </div>
         )}

         {activeTab === 'Card Issuance Setup' && (
           <div className="max-w-[1200px] mx-auto animate-in fade-in duration-300 pb-8">
             <div className="flex flex-col mb-10">
               <span className="text-[#1562f0] font-bold tracking-widest text-[10px] uppercase mb-2">Configuration Studio</span>
               {cardIssuanceOnchainFetch === 'loading' || !cardIssuanceExistingCard ? (
                 <p className="text-slate-500 mt-2 text-base sm:text-lg font-medium">
                   {cardIssuanceOnchainFetch === 'loading'
                     ? 'Checking the User Card factory for cards owned by your wallet…'
                     : 'Define the parameters and rewards logic for your new merchant card program.'}
                 </p>
               ) : null}
             </div>

             {cardIssuanceOnchainFetch === 'loading' ? (
               <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                 <Loader2 className="h-10 w-10 animate-spin text-[#1562f0]" strokeWidth={2} aria-hidden />
                 <p className="text-sm font-medium text-slate-500">Loading your issued card from the factory…</p>
               </div>
             ) : cardIssuanceExistingCard ? (
               <section className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100 space-y-8">
                 <div className="flex items-start gap-4">
                   <div className="w-12 h-12 rounded-full bg-[#1562f0]/10 flex items-center justify-center shrink-0">
                     <CreditCard className="w-6 h-6 text-[#1562f0]" strokeWidth={2} aria-hidden />
                   </div>
                   <div className="min-w-0 flex-1">
                     <h4 className="text-xl font-bold text-slate-900">Issued BeamioUserCard</h4>
                   </div>
                 </div>
                 <div className="space-y-6 sm:pl-0">
                   <div className="space-y-2">
                     <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Contract</span>
                     <div className="flex flex-wrap items-center gap-3">
                       <AddressCapsule
                         address={cardIssuanceExistingCard.cardAddress}
                         className="bg-slate-50 border-slate-200 text-slate-800"
                       />
                       <a
                         href={`https://basescan.org/address/${cardIssuanceExistingCard.cardAddress}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 text-sm font-bold text-[#1562f0] hover:underline"
                       >
                         Basescan
                         <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                       </a>
                     </div>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                     <div className="space-y-2">
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Card name</span>
                       <p className="text-lg font-bold text-slate-900">
                         {cardIssuanceExistingCard.meta?.name?.trim() ||
                           cardIssuanceExistingCard.userCard.name ||
                           '—'}
                       </p>
                     </div>
                     <div className="space-y-2">
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-400">On-chain currency</span>
                       <p className="text-lg font-bold text-slate-900">{cardIssuanceExistingCard.userCard.currency}</p>
                     </div>
                   </div>
                   <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                     <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                       Membership upgrade mode
                     </span>
                     {cardIssuanceExistingCard.upgradeType === 0 ||
                     cardIssuanceExistingCard.upgradeType === 1 ||
                     cardIssuanceExistingCard.upgradeType === 2 ? (
                       <>
                         <p className="text-lg font-bold text-slate-900">
                           <span className="font-mono text-base text-[#1562f0] tabular-nums">
                             {cardIssuanceExistingCard.upgradeType}
                           </span>
                           <span className="mx-2 text-slate-300">·</span>
                           {CARD_ISSUANCE_UPGRADE_TYPE_UI[cardIssuanceExistingCard.upgradeType as 0 | 1 | 2].title}
                         </p>
                         <p className="text-sm text-slate-600 font-medium leading-snug">
                           {CARD_ISSUANCE_UPGRADE_TYPE_UI[cardIssuanceExistingCard.upgradeType as 0 | 1 | 2].detail}
                         </p>
                       </>
                     ) : (
                       <p className="text-sm font-medium text-slate-600">
                         Could not read <span className="font-mono">upgradeType</span> on-chain
                         {cardIssuanceExistingCard.upgradeType >= 0
                           ? ` (raw: ${cardIssuanceExistingCard.upgradeType})`
                           : ''}
                         .
                       </p>
                     )}
                   </div>
                   {cardIssuanceExistingCard.meta?.image ? (
                     <div className="space-y-2">
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Share image</span>
                       <img
                         src={cardIssuanceExistingCard.meta.image}
                         alt=""
                         className="h-24 w-24 rounded-xl border border-slate-200 object-cover shadow-sm"
                       />
                     </div>
                   ) : null}
                   {cardIssuanceExistingCard.meta?.categories && cardIssuanceExistingCard.meta.categories.length > 0 ? (
                     <div className="space-y-3">
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Categories</span>
                       <div className="flex overflow-x-auto gap-4 pb-1 scrollbar-hide">
                         {cardIssuanceExistingCard.meta.categories.map((catId) => {
                           const opt = CARD_ISSUANCE_CATEGORY_OPTIONS.find(
                             (o) => o.id === catId.toLowerCase()
                           );
                           const Icon = opt?.Icon ?? Sparkles;
                           const circle = opt?.circleClass ?? 'bg-slate-100 text-slate-600';
                           const label = opt?.label ?? catId;
                           return (
                             <div
                               key={catId}
                               className="flex-shrink-0 flex flex-col items-center gap-2 min-w-[4.5rem]"
                             >
                               <div
                                 className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm ${circle}`}
                               >
                                 <Icon className="w-7 h-7" strokeWidth={2} aria-hidden />
                               </div>
                               <span className="text-[11px] font-bold text-slate-600 tracking-tight text-center leading-tight max-w-[5rem]">
                                 {label}
                               </span>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   ) : null}
                   {cardIssuanceExistingCard.meta?.tiers && cardIssuanceExistingCard.meta.tiers.length > 0 ? (
                     <div className="space-y-3">
                       <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Tiers (metadata)</span>
                       <div className="overflow-x-auto rounded-xl border border-slate-100">
                         <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                             <tr>
                               <th className="px-4 py-3">Name</th>
                               <th className="px-4 py-3">
                                 {`Min (${cardIssuanceExistingCard.userCard.currency?.trim() || '—'})`}
                               </th>
                               <th className="px-4 py-3">Description</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                             {[...cardIssuanceExistingCard.meta.tiers]
                               .sort((a, b) => {
                                 const na =
                                   a.minUsdc6 != null && a.minUsdc6 !== '' ? Number(a.minUsdc6) : NaN;
                                 const nb =
                                   b.minUsdc6 != null && b.minUsdc6 !== '' ? Number(b.minUsdc6) : NaN;
                                 const ca = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
                                 const cb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
                                 return ca - cb;
                               })
                               .map((t, i) => {
                                 const minRaw =
                                   t.minUsdc6 != null && t.minUsdc6 !== '' ? Number(t.minUsdc6) : NaN;
                                 const minLabel = Number.isFinite(minRaw)
                                   ? (minRaw / 1e6).toLocaleString()
                                   : '—';
                                 return (
                                   <tr key={`${t.index ?? 'idx'}-${i}`} className="bg-white">
                                     <td className="px-4 py-3 font-semibold text-slate-900">{t.name ?? '—'}</td>
                                     <td className="px-4 py-3 font-mono text-slate-700">{minLabel}</td>
                                     <td className="px-4 py-3 text-slate-600">{t.description ?? '—'}</td>
                                   </tr>
                                 );
                               })}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   ) : null}
                   {!cardIssuanceExistingCard.meta ? (
                     <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                       Metadata JSON was not available from the API or URI. Contract address and on-chain currency are still shown above.
                     </p>
                   ) : null}
                 </div>
               </section>
             ) : (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
               <div className="lg:col-span-8 space-y-8">
                 <section className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100">
                   <div className="flex items-center gap-4 mb-8">
                     <div className="w-12 h-12 rounded-full bg-[#1562f0]/10 flex items-center justify-center shrink-0">
                       <Fingerprint className="w-6 h-6 text-[#1562f0]" strokeWidth={2} />
                     </div>
                     <h4 className="text-xl font-bold text-slate-900">Card Identity</h4>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                     <div className="space-y-2">
                       <label htmlFor="card-issuance-program-name" className="text-sm font-semibold text-slate-500 ml-1">
                         Card Name
                       </label>
                       <input
                         id="card-issuance-program-name"
                         type="text"
                         value={cardIssuanceProgramName}
                         onChange={(e) => setCardIssuanceProgramName(e.target.value)}
                         placeholder="e.g., Acme Rewards Plus"
                         className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 ${bizFocusRingClass}`}
                       />
                     </div>
                     
                     <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                       <label htmlFor="card-issuance-currency" className="text-sm font-semibold text-slate-500 ml-1">
                         Currency Symbol
                       </label>
                       <input
                         id="card-issuance-currency"
                         type="text"
                         value={cardIssuanceCurrencySymbol}
                         onChange={(e) => setCardIssuanceCurrencySymbol(e.target.value)}
                         placeholder="e.g., $VERRA"
                         className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 ${bizFocusRingClass}`}
                       />
                     </div>
                     <div className="space-y-2">
                       <span className="text-sm font-semibold text-slate-500 ml-1 block">Currency</span>
                       <div
                         className="w-full rounded-xl border border-slate-200 bg-slate-100/80 px-5 py-3.5 text-[15px] font-semibold text-slate-700"
                         aria-label="Program currency"
                       >
                         {CARD_ISSUANCE_BEAMIO_CURRENCY}
                         <span className="ml-2 text-xs font-medium text-slate-400">(BeamioCurrency only)</span>
                       </div>
                     </div>
                   </div>
                   <div className="mt-8 space-y-6">
                     <div className="space-y-2">
                       <div className="flex justify-between items-end gap-3 ml-1">
                         <label
                           htmlFor="card-issuance-description"
                           className="text-sm font-semibold text-slate-500"
                         >
                           Card description
                         </label>
                         <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Optional</span>
                       </div>
                       <textarea
                         id="card-issuance-description"
                         value={cardIssuanceDescription}
                         onChange={(e) =>
                           setCardIssuanceDescription(e.target.value.slice(0, CARD_ISSUANCE_CONFIGURATION_MAX_CHARS))
                         }
                         placeholder="Short summary for wallets and explorers (shown in card metadata)."
                         rows={4}
                         maxLength={CARD_ISSUANCE_CONFIGURATION_MAX_CHARS}
                         spellCheck={true}
                         className={`w-full resize-y min-h-[96px] bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 ${bizFocusRingClass}`}
                       />
                       <p className="text-[11px] text-slate-400 font-medium ml-1">
                         {cardIssuanceDescription.length}/{CARD_ISSUANCE_CONFIGURATION_MAX_CHARS} characters
                       </p>
                     </div>
                     <div className="space-y-2">
                     <div className="flex flex-wrap items-center gap-3 ml-1">
                       <input
                         ref={cardIssuanceIconFileRef}
                         type="file"
                         accept="image/*"
                         className="hidden"
                         onChange={handleCardIssuanceIconPick}
                       />
                       <button
                         type="button"
                         onClick={() => cardIssuanceIconFileRef.current?.click()}
                         disabled={cardIssuanceShareImageUploading}
                         className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/40"
                       >
                         {cardIssuanceShareImageUploading ? (
                           <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
                         ) : (
                           <ImagePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
                         )}
                         {cardIssuanceShareImageUploading ? 'Uploading…' : 'Add card icon'}
                       </button>
                       {cardIssuanceShareImageUrl ? (
                         <>
                           <img
                             src={cardIssuanceShareImageUrl}
                             alt=""
                             className="h-12 w-12 rounded-lg border border-slate-200 object-cover shadow-sm"
                           />
                           <button
                             type="button"
                             onClick={() => setCardIssuanceShareImageUrl('')}
                             className="rounded-lg px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                           >
                             Remove
                           </button>
                         </>
                       ) : null}
                     </div>
                     </div>
                   </div>
                   <div className="mt-8 space-y-3">
                     <div className="flex justify-between items-end gap-3 ml-1">
                       <span className="text-sm font-semibold text-slate-500">Category</span>
                       <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                         {cardIssuanceCategoryId
                           ? CARD_ISSUANCE_CATEGORY_OPTIONS.find((o) => o.id === cardIssuanceCategoryId)?.label ??
                             cardIssuanceCategoryId
                           : 'Optional'}
                       </span>
                     </div>
                     <p className="text-[11px] text-slate-400 font-medium ml-1">
                       Tap to tag your program. Optional — helps classify offers for members.
                     </p>
                     {/** ring-inset: parent overflow-x-auto clips outer ring+offset; inset keeps highlight inside button */}
                     <div className="flex overflow-x-auto gap-3 py-1 pl-1 -mx-1 px-1 scrollbar-hide">
                       {CARD_ISSUANCE_CATEGORY_OPTIONS.map((opt) => {
                         const selected = cardIssuanceCategoryId === opt.id;
                         const Icon = opt.Icon;
                         return (
                           <button
                             key={opt.id}
                             type="button"
                             onClick={() => {
                               setCardIssuanceCategoryId((prev) => (prev === opt.id ? '' : opt.id));
                             }}
                             className={`flex-shrink-0 flex flex-col items-center gap-2 min-w-[4.5rem] rounded-2xl p-1.5 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1562f0]/45 ${
                               selected
                                 ? 'ring-2 ring-inset ring-[#1562f0] bg-blue-50/50 shadow-sm'
                                 : ''
                             }`}
                           >
                             <div
                               className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm transition-transform ${opt.circleClass} ${
                                 selected ? 'shadow-md scale-[1.02]' : ''
                               }`}
                             >
                               <Icon className="w-7 h-7" strokeWidth={2} aria-hidden />
                             </div>
                             <span className="text-[11px] font-bold text-slate-600 tracking-tight text-center leading-tight max-w-[5rem]">
                               {opt.label}
                             </span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 </section>

                 <section className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100">
                   <div className="flex items-center gap-4 mb-2">
                     <div className="w-12 h-12 rounded-full bg-[#1562f0]/10 flex items-center justify-center shrink-0">
                       <Wallet className="w-6 h-6 text-[#1562f0]" strokeWidth={2} />
                     </div>
                     <h4 className="text-xl font-bold text-slate-900">Recharge Parameters</h4>
                   </div>
                   <p className="text-sm text-slate-500 mb-8 sm:ml-16 font-medium">
                     Define the limits for card balance additions. Minimum must be at least {CARD_ISSUANCE_MIN_TOPUP_MIN}{' '}
                     {CARD_ISSUANCE_BEAMIO_CURRENCY}; maximum must not exceed {CARD_ISSUANCE_MAX_TOPUP_MAX}{' '}
                     {CARD_ISSUANCE_BEAMIO_CURRENCY}. Minimum and maximum top-up must be whole numbers (no decimals).
                   </p>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:ml-16">
                     <div className="space-y-2">
                       <label htmlFor="card-issuance-min-topup" className="text-sm font-semibold text-slate-500 ml-1">
                         Minimum Top-up
                       </label>
                       <div className="relative">
                         <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-[#1562f0]">$</span>
                         <input
                           id="card-issuance-min-topup"
                           type="number"
                           inputMode="numeric"
                           autoComplete="off"
                           min={CARD_ISSUANCE_MIN_TOPUP_MIN}
                           max={CARD_ISSUANCE_MAX_TOPUP_MAX}
                           step={1}
                           value={cardIssuanceMinTopup}
                           onChange={(e) => {
                             const raw = e.target.value.replace(/,/g, '');
                             if (raw === '') {
                               setCardIssuanceMinTopup('');
                               return;
                             }
                             const beforeDot = raw.split('.')[0];
                             const digitsOnly = beforeDot.replace(/\D/g, '');
                             setCardIssuanceMinTopup(digitsOnly);
                           }}
                           onBlur={() => {
                             const raw = cardIssuanceMinTopup.replace(/,/g, '').trim();
                             let v = raw === '' ? NaN : Number.parseInt(raw, 10);
                             if (!Number.isFinite(v)) {
                               setCardIssuanceMinTopup(String(CARD_ISSUANCE_MIN_TOPUP_DEFAULT));
                               return;
                             }
                             v = Math.min(
                               CARD_ISSUANCE_MAX_TOPUP_MAX,
                               Math.max(CARD_ISSUANCE_MIN_TOPUP_MIN, v)
                             );
                             setCardIssuanceMinTopup(String(v));
                           }}
                           placeholder="10"
                           className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-5 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 ${bizFocusRingClass} ${bizNumericNoSpinnerClass}`}
                         />
                       </div>
                     </div>
                     <div className="space-y-2">
                       <label htmlFor="card-issuance-max-topup" className="text-sm font-semibold text-slate-500 ml-1">
                         Maximum Top-up
                       </label>
                       <div className="relative">
                         <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-[#1562f0]">$</span>
                         <input
                           id="card-issuance-max-topup"
                           type="number"
                           inputMode="numeric"
                           autoComplete="off"
                           min={CARD_ISSUANCE_MIN_TOPUP_MIN}
                           max={CARD_ISSUANCE_MAX_TOPUP_MAX}
                           step={1}
                           value={cardIssuanceMaxTopup}
                           onChange={(e) => {
                             const raw = e.target.value.replace(/,/g, '');
                             if (raw === '') {
                               setCardIssuanceMaxTopup('');
                               return;
                             }
                             const beforeDot = raw.split('.')[0];
                             const digitsOnly = beforeDot.replace(/\D/g, '');
                             setCardIssuanceMaxTopup(digitsOnly);
                           }}
                           onBlur={() => {
                             const raw = cardIssuanceMaxTopup.replace(/,/g, '').trim();
                             let v = raw === '' ? NaN : Number.parseInt(raw, 10);
                             if (!Number.isFinite(v)) {
                               setCardIssuanceMaxTopup(String(CARD_ISSUANCE_MAX_TOPUP_DEFAULT));
                               return;
                             }
                             v = Math.min(
                               CARD_ISSUANCE_MAX_TOPUP_MAX,
                               Math.max(CARD_ISSUANCE_MIN_TOPUP_MIN, v)
                             );
                             setCardIssuanceMaxTopup(String(v));
                           }}
                           placeholder="100"
                           className={`w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-5 py-3.5 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 ${bizFocusRingClass} ${bizNumericNoSpinnerClass}`}
                         />
                       </div>
                     </div>
                   </div>
                 </section>

                 <section className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100 space-y-8">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-[#1562f0]/10 flex items-center justify-center shrink-0">
                       <Medal className="w-6 h-6 text-[#1562f0]" strokeWidth={2} />
                     </div>
                     <h4 className="text-xl font-bold text-slate-900">Loyalty Tier Rules</h4>
                   </div>
                   <div>
                     <h5 className="text-xl font-bold text-slate-900 mb-6">Core Rule Logic</h5>
                     <div className="space-y-4">
                       {(
                         [
                           {
                             key: 'single' as const,
                             title: 'Single Top-up Amount',
                             desc: 'Tiers based on a one-time load value. No downgrades possible.',
                           },
                           {
                             key: 'cumulative' as const,
                             title: 'Cumulative Spend',
                             desc: 'Reward lifetime loyalty. Tiers unlock as total spending grows.',
                           },
                           {
                             key: 'balance' as const,
                             title: 'Current Balance',
                             desc: 'Dynamic tiers. Auto upgrade or downgrade based on wallet balance.',
                           },
                         ] as const
                       ).map(({ key, title, desc }) => (
                         <label
                           key={key}
                           className={`group relative flex items-start gap-4 p-5 rounded-xl border cursor-pointer transition-all ${
                             cardIssuanceTierRule === key
                               ? 'border-[#1562f0]/35 bg-blue-50/40'
                               : 'border-transparent hover:border-[#1562f0]/20 bg-slate-50'
                           }`}
                         >
                           <input
                             type="radio"
                             name="card-issuance-core-rule"
                             checked={cardIssuanceTierRule === key}
                             onChange={() => setCardIssuanceTierRule(key)}
                             className={`mt-1 h-5 w-5 shrink-0 border-slate-300 text-[#0051d1] ${bizFocusRingClass}`}
                           />
                           <div className="flex flex-col min-w-0">
                             <span className="font-bold text-slate-900">{title}</span>
                             <span className="text-sm text-slate-500 mt-0.5 font-medium leading-snug">{desc}</span>
                           </div>
                         </label>
                       ))}
                     </div>
                   </div>
                   <div
                     className="p-6 sm:p-8 rounded-2xl text-white relative overflow-hidden border border-white/10"
                     style={{ background: 'radial-gradient(at 135% 0%, #7a9dff 0%, #0051d1 100%)' }}
                   >
                     <div className="relative z-10">
                       <Sparkles className="mb-4 w-9 h-9 sm:w-10 sm:h-10 opacity-95" strokeWidth={1.75} aria-hidden />
                       <h5 className="text-xl sm:text-2xl font-bold mb-2">Hands-Free Growth</h5>
                       <p className="text-sm leading-relaxed text-white/90 font-medium max-w-lg">
                         When a customer reaches a threshold, the loyalty engine instantly updates their card tier and notifies them via push notification. No manual verification required.
                       </p>
                     </div>
                     <Zap
                       className="absolute -right-6 -bottom-8 sm:-right-10 sm:-bottom-10 w-28 h-28 sm:w-36 sm:h-36 text-white opacity-[0.18] pointer-events-none"
                       strokeWidth={1.25}
                       aria-hidden
                     />
                   </div>
                 </section>

                 <section className="bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100 flex flex-col min-h-0">
                   <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                     <div className="flex items-start gap-4">
                       <div className="w-12 h-12 rounded-full bg-[#1562f0]/10 flex items-center justify-center shrink-0 mt-0.5">
                         <Layers className="w-6 h-6 text-[#1562f0]" strokeWidth={2} />
                       </div>
                       <div>
                         <h4 className="text-xl font-bold text-slate-900">Tier Configuration</h4>
                         <p className="text-sm text-slate-500 mt-1 font-medium">
                           Configure thresholds and discount benefits. Threshold amounts must be whole numbers (no decimals).
                         </p>
                       </div>
                     </div>
                     <button
                       type="button"
                       onClick={() =>
                         setCardIssuanceTiers((rows) => [
                           ...rows,
                           {
                             id: `tier-${Date.now()}`,
                             name: 'Custom',
                             preset: 'custom',
                             threshold: '0',
                             discountPercent: '0',
                             tierDescription: '',
                             tierDescriptionOpen: false,
                           },
                         ])
                       }
                       className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0051d1] text-white px-6 py-2.5 text-sm font-bold shadow-lg shadow-[#0051d1]/20 hover:opacity-90 transition-opacity shrink-0"
                     >
                       <Plus className="w-4 h-4" strokeWidth={2.5} />
                       Add Tier
                     </button>
                   </div>
                   <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
                     <table className="w-full text-left border-separate border-spacing-y-4 min-w-[520px]">
                       <thead>
                         <tr className="text-slate-500 uppercase text-[10px] tracking-widest font-bold">
                           <th className="px-4 pb-2 text-left">Tier Identity</th>
                           <th className="px-4 pb-2 text-left">Threshold ($)</th>
                           <th className="px-4 pb-2 text-left">Discount (%)</th>
                           <th className="px-4 pb-2 text-left">Actions</th>
                         </tr>
                       </thead>
                       <tbody className="text-sm">
                         {cardIssuanceTiers.map((row) => (
                           <tr key={row.id} className="bg-slate-50 group hover:bg-slate-100/90 transition-colors">
                             <td className="px-4 py-5 rounded-l-2xl align-top border-y border-l border-slate-100/80 group-hover:border-slate-200/80">
                               <div className="flex flex-col gap-3 min-w-0">
                                 <div className="flex items-center gap-3 min-w-0">
                                   <CardIssuanceTierIdentityIcon preset={row.preset} />
                                   <input
                                     type="text"
                                     value={row.name}
                                     onChange={(e) => {
                                       const v = e.target.value;
                                       setCardIssuanceTiers((tiers) => tiers.map((t) => (t.id === row.id ? { ...t, name: v } : t)));
                                     }}
                                     className="font-bold text-base text-slate-900 bg-transparent border-none min-w-0 max-w-[120px] sm:max-w-[160px] focus:outline-none focus:ring-0"
                                     aria-label={`Tier name for ${row.id}`}
                                   />
                                 </div>
                                 {row.tierDescriptionOpen ? (
                                   <div className="min-w-0 max-w-[min(100%,320px)] space-y-2 pl-[3.25rem]">
                                     <textarea
                                       value={row.tierDescription}
                                       onChange={(e) =>
                                         setCardIssuanceTiers((tiers) =>
                                           tiers.map((t) =>
                                             t.id === row.id
                                               ? {
                                                   ...t,
                                                   tierDescription: e.target.value.slice(0, CARD_ISSUANCE_CONFIGURATION_MAX_CHARS),
                                                 }
                                               : t
                                           )
                                         )
                                       }
                                       placeholder="Optional. Shown in tier metadata for wallets and explorers."
                                       rows={3}
                                       maxLength={CARD_ISSUANCE_CONFIGURATION_MAX_CHARS}
                                       spellCheck={true}
                                       className={`w-full resize-y min-h-[72px] text-[13px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder:text-slate-400 ${bizFocusRingClass}`}
                                       aria-label={`Tier description for ${row.name || row.id}`}
                                     />
                                     <div className="flex flex-wrap items-center gap-2">
                                       <button
                                         type="button"
                                         onClick={() =>
                                           setCardIssuanceTiers((tiers) =>
                                             tiers.map((t) =>
                                               t.id === row.id ? { ...t, tierDescriptionOpen: false } : t
                                             )
                                           )
                                         }
                                         className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                                       >
                                         <Minus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                         Hide
                                       </button>
                                       <span className="text-[10px] font-medium text-slate-400">
                                         {row.tierDescription.length}/{CARD_ISSUANCE_CONFIGURATION_MAX_CHARS}
                                       </span>
                                     </div>
                                   </div>
                                 ) : (
                                   <button
                                     type="button"
                                     onClick={() =>
                                       setCardIssuanceTiers((tiers) =>
                                         tiers.map((t) => (t.id === row.id ? { ...t, tierDescriptionOpen: true } : t))
                                       )
                                     }
                                     className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:border-[#1562f0]/40 hover:text-[#1562f0] hover:bg-blue-50/50 transition-colors ml-[3.25rem]"
                                     aria-label={`Add tier description for ${row.name || row.id}`}
                                   >
                                     <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                                     Tier description
                                   </button>
                                 )}
                               </div>
                             </td>
                             <td className="px-4 py-5 align-top border-y border-slate-100/80 group-hover:border-slate-200/80">
                               <input
                                 type="text"
                                 inputMode="numeric"
                                 autoComplete="off"
                                 value={row.threshold}
                                 onChange={(e) => {
                                   const raw = e.target.value.replace(/,/g, '');
                                   if (raw === '') {
                                     setCardIssuanceTiers((tiers) =>
                                       tiers.map((t) => (t.id === row.id ? { ...t, threshold: '' } : t))
                                     );
                                     return;
                                   }
                                   const beforeDot = raw.split('.')[0];
                                   const digitsOnly = beforeDot.replace(/\D/g, '');
                                   setCardIssuanceTiers((tiers) =>
                                     tiers.map((t) => (t.id === row.id ? { ...t, threshold: digitsOnly } : t))
                                   );
                                 }}
                                 className={`bg-white border border-slate-200 rounded-lg w-24 text-center text-sm font-semibold text-slate-900 py-1.5 shadow-sm ${bizFocusRingClass}`}
                                 aria-label={`Threshold dollars for ${row.name || row.id}`}
                               />
                             </td>
                             <td className="px-4 py-5 align-top border-y border-slate-100/80 group-hover:border-slate-200/80">
                               <div className="flex items-center gap-2">
                                 <input
                                   type="text"
                                   inputMode="decimal"
                                   autoComplete="off"
                                   value={row.discountPercent}
                                   onChange={(e) => {
                                     const v = e.target.value;
                                     setCardIssuanceTiers((tiers) => tiers.map((t) => (t.id === row.id ? { ...t, discountPercent: v } : t)));
                                   }}
                                   className={`bg-white border border-slate-200 rounded-lg w-12 text-center text-sm font-semibold text-slate-900 py-1.5 shadow-sm ${bizFocusRingClass}`}
                                 />
                                 <span className="text-slate-500 font-medium">%</span>
                               </div>
                             </td>
                             <td className="px-4 py-5 rounded-r-2xl align-top border-y border-r border-slate-100/80 group-hover:border-slate-200/80">
                               <button
                                 type="button"
                                 disabled={cardIssuanceTiers.length <= 1}
                                 onClick={() =>
                                   setCardIssuanceTiers((tiers) =>
                                     tiers.length <= 1 ? tiers : tiers.filter((t) => t.id !== row.id)
                                   )
                                 }
                                 className="text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-35 disabled:pointer-events-none p-1 rounded-lg"
                                 title="Remove tier"
                                 aria-label={`Remove tier ${row.name}`}
                               >
                                 <Trash2 className="w-[22px] h-[22px]" strokeWidth={2} />
                               </button>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                   <div className="mt-auto pt-8 flex justify-end">
                     <button
                       type="button"
                       onClick={() => {
                         setCardIssuanceTierRule('single');
                         setCardIssuanceTiers(defaultCardIssuanceTiers());
                         setCardIssuanceCategoryId('');
                         setCardIssuanceDescription('');
                         setCardIssuanceCreateResult(null);
                         setCardIssuanceCreateError('');
                       }}
                       className="px-8 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                     >
                       Discard Changes
                     </button>
                   </div>
                 </section>
               </div>

               <div className="lg:col-span-4">
                 <div className="lg:sticky lg:top-24 space-y-6">
                   <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_20px_40px_rgba(21,98,240,0.06)] border border-slate-100 overflow-hidden">
                     <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Live Preview</h4>
                     <div className="w-full aspect-[1.58/1] rounded-xl p-6 sm:p-8 text-white relative flex flex-col justify-between shadow-2xl bg-gradient-to-br from-[#0051d1] to-[#7a9dff]">
                       <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none rounded-xl" />
                       
                       <div className="relative z-10 mt-auto">
                         <div className="flex items-center gap-3 mb-3 sm:mb-4">
                           <div className="w-11 h-8 sm:w-12 sm:h-9 bg-white/20 rounded-md backdrop-blur-md flex items-center justify-center overflow-hidden">
                             {cardIssuanceShareImageUrl ? (
                               <img
                                 src={cardIssuanceShareImageUrl}
                                 alt=""
                                 className="h-full w-full object-cover"
                               />
                             ) : (
                               <div className="w-8 h-5 bg-gradient-to-br from-yellow-200 to-yellow-500 rounded-sm opacity-80" />
                             )}
                           </div>
                         </div>
                         <p className="text-base sm:text-lg font-bold tracking-tight truncate mb-3 sm:mb-4 pr-1 max-w-full">
                           {cardIssuancePreviewProgram}
                         </p>
                         <div className="flex justify-between items-end gap-2">
                           <div className="flex flex-col min-w-0">
                             <span className="text-[8px] opacity-60 uppercase tracking-widest font-bold">Member ID</span>
                             <span className="text-xs sm:text-sm font-mono tracking-[0.15em] font-medium truncate">
                               4412 • 0098 • 1120
                             </span>
                           </div>
                           <span className="text-xl sm:text-2xl font-black italic tracking-tighter shrink-0">{cardIssuancePreviewBrand}</span>
                         </div>
                       </div>
                     </div>
                     <div className="mt-8 space-y-1">
                       <div className="flex justify-between items-center py-2 border-b border-slate-100">
                         <span className="text-sm text-slate-500 font-medium">Tier Logic</span>
                         <span className="text-sm font-bold text-slate-900">{cardIssuanceTierRuleLabels[cardIssuanceTierRule]}</span>
                       </div>
                       {cardIssuanceCategoryId ? (
                         <div className="flex justify-between items-start gap-2 py-2 border-b border-slate-100">
                           <span className="text-sm text-slate-500 font-medium shrink-0">Category</span>
                           <span className="text-sm font-bold text-slate-900 text-right leading-snug">
                             {CARD_ISSUANCE_CATEGORY_OPTIONS.find((o) => o.id === cardIssuanceCategoryId)?.label ??
                               cardIssuanceCategoryId}
                           </span>
                         </div>
                       ) : null}
                       {cardIssuanceDescription.trim() ? (
                         <div className="flex justify-between items-start gap-2 py-2 border-b border-slate-100">
                           <span className="text-sm text-slate-500 font-medium shrink-0">Description</span>
                           <span className="text-sm font-bold text-slate-900 text-right leading-snug line-clamp-3">
                             {cardIssuanceDescription.trim()}
                           </span>
                         </div>
                       ) : null}
                       <div className="flex justify-between items-center py-2 border-b border-slate-100">
                         <span className="text-sm text-slate-500 font-medium">Initial Currency</span>
                         <span className="text-sm font-bold text-slate-900 truncate ml-2 max-w-[55%] text-right">
                           {cardIssuanceCurrencySymbol.trim()
                             ? `${CARD_ISSUANCE_BEAMIO_CURRENCY} · ${cardIssuanceCurrencySymbol.trim()}`
                             : CARD_ISSUANCE_BEAMIO_CURRENCY}
                         </span>
                       </div>
                       <div className="flex justify-between items-center py-2">
                         <span className="text-sm text-slate-500 font-medium">Program Status</span>
                         <span className="flex items-center gap-1.5 text-xs font-bold bg-[#1562f0]/10 text-[#1562f0] px-3 py-1 rounded-full">
                           <span className="w-1.5 h-1.5 rounded-full bg-[#1562f0]" />
                           Drafting
                         </span>
                       </div>
                     </div>
                   </div>

                   {cardIssuanceCreateError ? (
                     <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                       {cardIssuanceCreateError}
                     </div>
                   ) : null}

                   {cardIssuanceCreateResult ? (
                     <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 space-y-2">
                       <p>Card created successfully.</p>
                       <p className="font-mono text-xs break-all text-emerald-950/90">{cardIssuanceCreateResult.cardAddress}</p>
                       {cardIssuanceCreateResult.hash ? (
                         <a
                           href={`https://basescan.org/tx/${cardIssuanceCreateResult.hash}`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 text-[#1562f0] hover:underline font-bold"
                         >
                           View transaction on Basescan
                           <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
                         </a>
                       ) : null}
                       {cardIssuanceOwnerAdminNotice ? (
                         <p
                           className={`text-xs font-semibold pt-1 border-t border-emerald-200/80 ${
                             cardIssuanceOwnerAdminNotice.kind === 'warn'
                               ? 'text-amber-900'
                               : 'text-emerald-950/90'
                           }`}
                         >
                           {cardIssuanceOwnerAdminNotice.text}
                         </p>
                       ) : null}
                       {cardIssuanceCategoryIndexSummary ? (
                         <p className="text-xs font-semibold text-emerald-950/90 pt-1 border-t border-emerald-200/80">
                           {cardIssuanceCategoryIndexSummary}
                         </p>
                       ) : null}
                     </div>
                   ) : null}

                   <button
                     type="button"
                     onClick={() => void handlePublishCardIssuance()}
                     disabled={cardIssuanceCreateLoading}
                     className="w-full rounded-full py-4 sm:py-5 font-bold text-base sm:text-lg text-white shadow-xl bg-gradient-to-br from-[#0051d1] to-[#7a9dff] hover:shadow-[0_12px_32px_rgba(0,81,209,0.25)] active:scale-[0.98] transition-all flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65"
                   >
                     {cardIssuanceCreateLoading ? (
                       <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" strokeWidth={2} aria-hidden />
                     ) : (
                       <Rocket className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} aria-hidden />
                     )}
                     {cardIssuanceCreateLoading ? 'Creating…' : 'Publish & Issue Card'}
                   </button>
                   <p className="text-center text-xs text-slate-500 font-medium px-4">
                     By publishing, you agree to the Merchant Services Agreement and Program Compliance terms.
                   </p>
                 </div>
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
                  <div className="w-12 h-12 bg-blue-50 text-emerald-800 rounded-2xl flex items-center justify-center">
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
                  className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] font-semibold text-slate-900 transition-all ${bizFocusRingClass} focus:border-[#1562f0]`}
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
                  className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-[15px] font-semibold text-slate-900 transition-all ${bizFocusRingClass} focus:border-[#1562f0]`}
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
                      className={`w-full rounded-2xl border bg-white py-3.5 pr-14 font-mono text-[15px] font-semibold text-slate-900 placeholder:text-slate-400 ${newTerminalTag.startsWith('0x') ? 'pl-4' : 'pl-9'} ${deviceHandleError ? 'border-rose-500 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/25' : `border-slate-200 ${bizFocusRingClass} focus:border-[#1562f0]`}`}
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
                  const resolveRegistrationProgramCardAddress = async (): Promise<string> => {
                    if (merchantOwnCardAddress) return merchantOwnCardAddress;
                    const p0 = profiles?.[0];
                    if (p0) {
                      const { cards, trusted } = await getCardsOfOwnerWithDetailsForProfile(p0);
                      if (trusted && cards.length > 0) {
                        const primary = await pickPrimaryIssuedCardAddressForBiz(p0, cards, baseRpcProviderDirect);
                        if (primary) return ethers.getAddress(primary);
                      }
                    }
                    const ex = cardIssuanceExistingCard?.cardAddress;
                    if (ex) return ethers.getAddress(ex);
                    const cr = cardIssuanceCreateResult?.cardAddress;
                    if (cr) return ethers.getAddress(cr);
                    throw new Error(
                      'No merchant-issued card found. Create your program card in Card Issuance Setup before registering a terminal.',
                    );
                  };
                  const cardAddress = await resolveRegistrationProgramCardAddress();
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
                  invalidateFetchCache(`card:${cardAddress.toLowerCase()}`);
                  try {
                    window.localStorage.removeItem(
                      `${BIZ_CACHE_PREFIX}card-admins:${cardAddress.toLowerCase()}:v2`,
                    );
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
                  <Loader2 className={`w-5 h-5 animate-spin ${bizUiPrimaryLoader}`} />
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

     {/* --- RESET TERMINAL ISSUANCE LIMIT (parent admin clear mint counter) --- */}
     {resetTerminalLimitModal && (
       <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
         <div
           className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
           onClick={() =>
             !resetTerminalLimitLoading && (setResetTerminalLimitModal(null), setResetTerminalLimitError(null))
           }
         />
         <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-blue-50 text-emerald-800 rounded-2xl flex items-center justify-center">
                 <RefreshCcw size={24} />
               </div>
               <h2 className="text-xl font-bold tracking-tight text-black">Reset Terminal Limit</h2>
             </div>
             <button
               type="button"
               onClick={() =>
                 !resetTerminalLimitLoading && (setResetTerminalLimitModal(null), setResetTerminalLimitError(null))
               }
               className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-black transition-colors disabled:opacity-50"
             >
               <X size={20} />
             </button>
           </div>
           <p className="text-[14px] text-slate-600 mb-3">
             Clears this terminal&apos;s mint counter on-chain (parent admin signature). After reset, Daily Issuance used
             returns to zero until the next feeder refresh.
           </p>
           <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 mb-4 space-y-2">
             <div className="font-semibold text-slate-900">{resetTerminalLimitModal.name}</div>
             <div className="text-[13px] text-slate-500">{resetTerminalLimitModal.tag}</div>
             <AddressCapsule
               address={ethers.getAddress(resetTerminalLimitModal.id)}
               className="bg-white border-slate-200 text-slate-700 max-w-full"
             />
           </div>
           {(() => {
             const s = terminalStats[resetTerminalLimitModal.id.toLowerCase()];
             if (s == null) {
               return (
                 <p className="text-[14px] text-slate-500 mb-4">
                   Quota stats not loaded yet. Staff stats refresh on a short interval, or use Refresh stats below.
                 </p>
               );
             }
             const issued = s.mintCounterFromClear;
             const unlimited = s.remainingAvailable >= Number.MAX_SAFE_INTEGER;
             const quota = unlimited ? null : issued + s.remainingAvailable;
             return (
               <div className="mb-4 space-y-1 text-[15px]">
                 <div className="flex justify-between gap-4 text-slate-700">
                   <span className="text-slate-500">Used (points, 6 decimals)</span>
                   <span className="font-semibold tabular-nums text-slate-900">
                     ${issued.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                   </span>
                 </div>
                 <div className="flex justify-between gap-4 text-slate-700">
                   <span className="text-slate-500">Cap</span>
                   <span className="font-semibold tabular-nums text-slate-900">
                     {quota != null
                       ? `$${quota.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                       : 'Unlimited'}
                   </span>
                 </div>
               </div>
             );
           })()}
           <button
             type="button"
             onClick={() => setOverviewRefreshTrigger((t) => t + 1)}
             disabled={resetTerminalLimitLoading}
             className="mb-4 w-full py-2.5 rounded-xl text-[13px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
           >
             Refresh stats from chain (next feeder tick)
           </button>
           {resetTerminalLimitError && (
             <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] font-medium text-amber-800">
               {resetTerminalLimitError}
             </div>
           )}
           <div className="flex gap-3">
             <button
               type="button"
               onClick={() =>
                 !resetTerminalLimitLoading && (setResetTerminalLimitModal(null), setResetTerminalLimitError(null))
               }
               disabled={resetTerminalLimitLoading}
               className="flex-1 py-3.5 rounded-2xl text-[15px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
             >
               Cancel
             </button>
             <button
               type="button"
               onClick={async () => {
                 if (!resetTerminalLimitModal) return;
                 setResetTerminalLimitError(null);
                 const pk = profiles?.[0]?.privateKeyArmor;
                 if (!pk) {
                   setResetTerminalLimitError('Unlock your wallet to sign.');
                   return;
                 }
                 setResetTerminalLimitLoading(true);
                 try {
                   const userEOA = (profiles?.[0]?.keyID ?? myAddress)?.trim();
                   if (!userEOA || !ethers.isAddress(userEOA)) {
                     throw new Error('Wallet address not available.');
                   }
                   const chainSub = await resolveTerminalChainSubordinate(resetTerminalLimitModal.id);
                   const card = new ethers.Contract(
                     staffProgramBeamioCardAddress,
                     USER_CARD_ADMIN_READ_ABI,
                     baseRpcProviderDirect,
                   );
                   const parent = (await card.adminParent(chainSub)) as string;
                   if (!parent || parent === ethers.ZeroAddress) {
                     throw new Error(
                       'This terminal has no parent admin on-chain. Owner-added admins cannot be cleared this way.',
                     );
                   }
                   if (ethers.getAddress(parent) !== ethers.getAddress(userEOA)) {
                     throw new Error(
                       `Connect the parent admin wallet (${parent}) to reset this terminal. Current wallet: ${userEOA}.`,
                     );
                   }
                   const deadline = Math.floor(Date.now() / 1000) + 600;
                   const nonce = ethers.hexlify(ethers.randomBytes(32));
                   const adminSignature = await signClearAdminMintCounter(
                     pk,
                     staffProgramBeamioCardAddress,
                     chainSub,
                     deadline,
                     nonce,
                   );
                   const res = await postCardClearAdminMintCounter({
                     cardAddress: staffProgramBeamioCardAddress,
                     subordinate: chainSub,
                     deadline,
                     nonce,
                     adminSignature,
                   });
                   if (!res.success) {
                     throw new Error(res.error ?? 'Reset failed');
                   }
                   setResetTerminalLimitModal(null);
                   setOverviewRefreshTrigger((t) => t + 1);
                   invalidateFetchCache(`card:${staffProgramBeamioCardAddress.toLowerCase()}`);
                   try {
                     window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${fixedCardAdminsCacheKey}`);
                   } catch {
                     /* ignore */
                   }
                 } catch (e: unknown) {
                   setResetTerminalLimitError(e instanceof Error ? e.message : 'Reset failed');
                 } finally {
                   setResetTerminalLimitLoading(false);
                 }
               }}
               disabled={resetTerminalLimitLoading}
               className="flex-1 py-3.5 rounded-2xl text-[15px] font-semibold bg-[#1562f0] text-white hover:bg-[#2b74f5] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
             >
               {resetTerminalLimitLoading ? (
                 <>
                   <Loader2 className={`w-5 h-5 animate-spin ${bizUiPrimaryLoader}`} />
                   Resetting…
                 </>
               ) : (
                 'Reset'
               )}
             </button>
           </div>
         </div>
       </div>
     )}

     {/* --- ROUTING CONFIG MODAL --- */}
     {isConfigModalOpen && configAllianceId && (() => {
       const alliance = alliancesDb[configAllianceId];
       const useOnChainTiers = configAllianceId === ALLIANCE_ID_FOR_FIXED_USER_CARD;
       const chainList = routingModalChainTiers;
       const chainLoading = useOnChainTiers && routingModalTiersLoading;
       const chainErr = useOnChainTiers ? routingModalTiersError : null;
       const iconCycle = ['emerald', 'yellow'] as const;
       type TierRow = {
         id: string
         name: string
         iconType: 'emerald' | 'yellow'
         subtitle?: string
         /** Formatted minUsdc6 + card `currency` — same row as name, right side */
         thresholdRight?: string
       };
       let tiersForUi: TierRow[] = [];
       const chainCurrency = routingModalChainCurrencyType ?? 0;
       if (useOnChainTiers) {
         if (chainList && chainList.length > 0) {
           tiersForUi = chainList.map((ct, i) => {
             const expLabel =
               ct.tierExpirySeconds === 0n
                 ? 'Tier expiry: use card default'
                 : `Tier expiry: ${ct.tierExpirySeconds.toString()}s`;
             const modeLabel = ct.upgradeByBalance
               ? 'Upgrade path: balance ≥ min threshold'
               : 'Upgrade path: single top-up / redeem ≥ min threshold';
             const rawName = resolveTierMetadataDisplayName(routingModalCardTiersMeta, ct.index);
             return {
               id: `chain-tier-${ct.index}`,
               name: tierDisplayNameWithCardSuffix(rawName),
               iconType: iconCycle[i % 2],
               thresholdRight: formatMinUsdc6WithCurrencyLabel(ct.minUsdc6, chainCurrency),
               subtitle: `attr ${ct.attr.toString()} · ${expLabel} · ${modeLabel}`,
             };
           });
         }
       } else if (alliance.tiers?.length) {
         tiersForUi = alliance.tiers.map((t) => ({
           id: t.id,
           name: t.name,
           iconType: t.iconType,
         }));
       }
       const hasTiers = !chainLoading && !chainErr && tiersForUi.length > 0;
       const showStandardOnly = !chainLoading && !chainErr && tiersForUi.length === 0;
       return (
         <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 font-sans">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsConfigModalOpen(false)}></div>
           <div className="relative bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 max-h-[90vh]">
             <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 shrink-0">
               <div className="flex justify-between items-start mb-2">
                 <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center text-white mb-4 shadow-sm ${alliance.nftBg}`}>
                    <SlidersHorizontal size={20} />
                 </div>
                 <button type="button" onClick={() => setIsConfigModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors">
                   <X size={20} />
                 </button>
               </div>
               <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-1">{alliance.name} Routing</h2>
               <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
                 {useOnChainTiers
                   ? 'Discounts are configured per on-chain membership tier from your program BeamioUserCard contract. Enforced by your Smart Terminal.'
                   : 'Configure automatic point-of-sale discounts for ecosystem VIP tiers. Enforced by your Smart Terminal.'}
               </p>
               {useOnChainTiers && (
                 <p className="text-[11px] text-slate-400 font-mono mt-2 break-all">
                   {staffProgramBeamioCardAddress}
                 </p>
               )}
             </div>

             <div className="p-6 sm:p-8 overflow-y-auto min-h-0">
               {chainLoading ? (
                 <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                   <Loader2 size={28} className={`animate-spin ${bizUiPrimaryLoader}`} />
                   <p className="text-[14px] font-medium">Loading tiers from Base…</p>
                 </div>
               ) : chainErr ? (
                 <div className="bg-amber-50 rounded-[20px] p-6 border border-amber-100 flex gap-3">
                   <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" />
                   <div>
                     <h4 className="text-[15px] font-semibold text-amber-900 mb-1">Could not load tiers</h4>
                     <p className="text-[13px] text-amber-800/90 break-words">{chainErr}</p>
                   </div>
                 </div>
               ) : showStandardOnly ? (
                 <div className="bg-slate-50 rounded-[20px] p-6 text-center border border-slate-100">
                   <Info size={24} className="text-slate-400 mx-auto mb-3" />
                   <h4 className="text-[15px] font-semibold text-slate-700 mb-1">Standard Routing Only</h4>
                   <p className="text-[13px] text-slate-500">
                     {useOnChainTiers
                       ? 'This card has no on-chain membership tiers yet. Configure tiers on the BeamioUserCard contract first.'
                       : 'This alliance does not support custom membership discount tiers.'}
                   </p>
                 </div>
               ) : (
                 <div className="space-y-6">
                   {useOnChainTiers && hasTiers ? (
                     <div className="bg-white border border-slate-200 rounded-[20px] p-5 shadow-sm">
                       <label htmlFor="biz-routing-tax-rate" className="block text-[13px] font-semibold text-slate-700 mb-2">
                         Registered tax rate (%)
                       </label>
                       <p className="text-[12px] text-slate-500 mb-3 leading-relaxed">
                         Stored in each Smart Terminal&apos;s on-chain admin metadata as{' '}
                         <span className="font-mono text-slate-600">tierRoutingDiscounts.taxRatePercent</span> for the device to apply at checkout.
                       </p>
                       <input
                         id="biz-routing-tax-rate"
                         type="number"
                         inputMode="decimal"
                         min={0}
                         max={100}
                         step={0.01}
                         autoComplete="off"
                         enterKeyHint="done"
                         value={Number.isFinite(routingTaxRatePercent) ? routingTaxRatePercent : 0}
                         onChange={(e) => {
                           const raw = e.target.value;
                           if (raw === '' || raw === '-') {
                             setRoutingTaxRatePercent(0);
                             return;
                           }
                           const n = Number(raw);
                           if (!Number.isFinite(n)) return;
                           setRoutingTaxRatePercent(Math.min(100, Math.max(0, n)));
                         }}
                         className={`w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] font-semibold tabular-nums text-slate-900 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${bizFocusRingClass} focus:border-[#1562f0]`}
                       />
                       <p className="text-[11px] text-slate-400 mt-2">Default 0%. Range 0–100.</p>
                     </div>
                   ) : null}
                   {tiersForUi.map((tier) => (
                     <div key={tier.id} className="bg-white border border-slate-200 rounded-[20px] p-5 shadow-sm">
                       <div className="mb-4 flex items-center gap-3">
                         <div className="flex min-w-0 flex-1 items-center gap-3">
                           <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center border ${
                             tier.iconType === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' :
                             tier.iconType === 'yellow' ? 'bg-yellow-50 border-yellow-100 text-yellow-500' :
                             'bg-purple-50 border-purple-100 text-purple-500'
                           }`}>
                             {tier.iconType === 'emerald' ? <ShieldCheck size={18} /> : tier.iconType === 'yellow' ? <Crown size={18} /> : <Award size={18} />}
                           </div>
                           <div className="min-w-0 flex-1">
                             <div className="flex items-center justify-between gap-2">
                               <h4 className="text-[16px] font-semibold text-slate-900 min-w-0 break-words">{tier.name}</h4>
                               {tier.thresholdRight ? (
                                 <span className="text-[13px] font-semibold text-slate-600 tabular-nums shrink-0 text-right max-w-[50%] leading-snug">
                                   {tier.thresholdRight}
                                 </span>
                               ) : null}
                             </div>
                             {tier.subtitle ? (
                               <p className="text-[11px] text-slate-500 font-medium leading-snug mt-1">{tier.subtitle}</p>
                             ) : null}
                           </div>
                         </div>
                         {/* Fixed-width column: discount changes do not steal space from title / minUsdc6 */}
                         <div className="flex w-[4.5rem] shrink-0 items-center justify-center sm:w-[4.75rem]">
                           <div className="flex min-h-[2.25rem] w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1.5 sm:px-2">
                             <span className="text-center text-[15px] font-bold tabular-nums text-slate-900">
                               {tempDiscounts[tier.id] ?? 0}
                             </span>
                             <span className="shrink-0 text-[12px] font-bold text-slate-500">%</span>
                           </div>
                         </div>
                       </div>

                       <input
                         type="range"
                         min="0"
                         max="100"
                         step="1"
                         value={tempDiscounts[tier.id] ?? 0}
                         onChange={(e) => setTempDiscounts((prev) => ({ ...prev, [tier.id]: parseInt(e.target.value, 10) }))}
                         className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1562f0]"
                       />
                       <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-2 px-1">
                         <span>0%</span>
                         <span>50%</span>
                         <span>100% (Free)</span>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div className="p-6 sm:p-8 bg-slate-50/50 border-t border-slate-100 mt-auto shrink-0">
               {routingRulesDeployError ? (
                 <div className="mb-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-900">
                   {routingRulesDeployError}
                 </div>
               ) : null}
               <button
                 type="button"
                 onClick={() => void handleSignDeployRules()}
                 disabled={chainLoading || !!chainErr || !hasTiers || routingRulesDeployLoading}
                 className={`w-full py-4 sm:py-5 rounded-[20px] font-semibold text-[16px] transition-all flex items-center justify-center gap-2 ${
                   !chainLoading && !chainErr && hasTiers && !routingRulesDeployLoading
                     ? `${bizUiPrimarySolid} active:scale-[0.98]`
                     : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                 }`}
               >
                 {routingRulesDeployLoading ? (
                   <>
                     <Loader2 size={18} className={`animate-spin ${bizUiPrimaryLoader}`} /> Deploying...
                   </>
                 ) : (
                   <>
                     <Cpu size={18} /> Sign & Deploy Rules
                   </>
                 )}
               </button>
             </div>
           </div>
         </div>
       );
     })()}

     {/* --- JOIN NEW ALLIANCE MODAL --- */}
     {isJoinAllianceModalOpen && (
       <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsJoinAllianceModalOpen(false)}></div>
         <div className="relative bg-white/90 backdrop-blur-3xl rounded-t-[32px] sm:rounded-[40px] shadow-2xl w-full max-w-md p-6 sm:p-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
            <div className="flex justify-between items-center mb-8">
               <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#1562f0]/20 text-blue-900">
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
                .filter((id) => !effectiveJoinedAlliances.includes(id))
                .map((aId) => {
                  const alliance = alliancesDb[aId];
                  return (
                    <div key={aId} className="border border-slate-200 rounded-[20px] p-5 hover:border-[#1562f0]/55 hover:bg-[#1562f0]/10 transition-all">
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
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeMarketProductModal}></div>
         <div className="relative bg-[#0f1115] w-full max-w-[500px] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[40px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-white/10">
            <div className={`relative h-48 sm:h-56 shrink-0 bg-gradient-to-b ${selectedProduct === 'fuel' ? 'from-orange-900/40' : selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? 'from-emerald-900/40' : 'from-blue-900/40'} to-[#0f1115]`}>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
              <button
                type="button"
                onClick={closeMarketProductModal}
                className="absolute top-6 left-6 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-md transition-colors hover:text-white"
                aria-label="Close"
              >
                <X size={22} strokeWidth={2} className="shrink-0" />
              </button>
              <div className="absolute bottom-6 left-8 right-8">
                 <span className={`inline-block px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase mb-3 border ${
                    selectedProduct === 'fuel' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                    selectedProduct === 'starter' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    selectedProduct === 'custom_fuel' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                 }`}>
                    {selectedProduct === 'fuel' ? 'Merchant Prepaid' : selectedProduct === 'starter' ? 'AA Activation' : selectedProduct === 'custom_fuel' ? 'Custom Top-Up' : 'Hardware + License'}
                 </span>
                 <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-1">
                    {selectedProduct === 'fuel' ? 'Limited Fuel Pack' : selectedProduct === 'starter' ? 'Starter Fuel Pack' : selectedProduct === 'custom_fuel' ? 'Custom Fuel Refill' : 'Genesis Node Pack'}
                 </h2>
                 <p className="text-[15px] font-medium text-slate-400">
                    {selectedProduct === 'fuel' ? 'The Store Clearing Fuel' : selectedProduct === 'starter' ? 'The perfect entry to smart routing' : selectedProduct === 'custom_fuel' ? 'Flexible routing power on demand' : 'The Infrastructure Backbone'}
                 </p>
              </div>
            </div>
            {(selectedProduct === 'custom_fuel' || selectedProduct === 'starter') &&
            (marketRefuelProcessing || marketRefuelSuccess !== null) ? (
              <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 min-h-[240px]">
                {marketRefuelProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-4">
                    <RefreshCw size={48} className="animate-spin text-orange-500" />
                    <p className="text-[15px] font-semibold text-slate-300">Processing refuel...</p>
                    <p className="text-[12px] text-slate-500">Please wait</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check size={32} strokeWidth={3} className="text-green-500" />
                    </div>
                    <p className="text-[18px] font-black text-green-400">Success</p>
                    {marketRefuelSuccess != null && marketRefuelSuccess.startsWith('0x') && (
                      <a
                        href={`https://basescan.org/tx/${marketRefuelSuccess}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[12px] font-mono text-[#1562f0] hover:bg-white/10 transition-colors"
                      >
                        {marketRefuelSuccess.slice(0, 10)}...{marketRefuelSuccess.slice(-8)}
                        <ExternalLink size={14} strokeWidth={2.5} />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={resetMarketRefuelSuccess}
                      className="mt-2 text-[13px] font-semibold text-orange-500 hover:text-orange-400"
                    >
                      Refuel Again
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
            <div
              className={`flex-1 overflow-y-auto p-8 pt-4 scrollbar-hide space-y-8 ${
                selectedProduct === 'custom_fuel' ? 'pb-44' : 'pb-32'
              }`}
            >
              <div className="flex gap-4">
                <div className="flex-1 bg-white/5 rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                     selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                     selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                     'bg-blue-500/10 border-blue-500/20 text-blue-500'
                  }`}>
                    {selectedProduct === 'fuel' ? <Database size={20} /> : selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? <Zap size={20} /> : <Cpu size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{selectedProduct === 'fuel' ? 'Volume' : selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? 'Volume' : 'Security'}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">
                      {selectedProduct === 'fuel' ? '100k B-Units' : selectedProduct === 'starter' ? '100 B-Units' : selectedProduct === 'custom_fuel' ? `${(Number(customFuelAmount) || 0) * 100} B-Units` : 'ATECC608 Vault'}
                    </p>
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                     selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                     selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                     'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  }`}>
                    {selectedProduct === 'fuel' ? <Sparkles size={20} /> : selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? <Cpu size={20} /> : <Activity size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{selectedProduct === 'fuel' ? 'Discount' : selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? 'AA Account' : 'Yield'}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">{selectedProduct === 'fuel' ? '50% Tech Off' : selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? 'Unlocked' : '5% Network'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#16181d] rounded-[24px] p-6 border border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <Lock size={16} className="text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{selectedProduct === 'fuel' ? 'The Merchant Arsenal' : selectedProduct === 'starter' ? 'Entry Arsenal' : selectedProduct === 'custom_fuel' ? 'Refill Arsenal' : 'The Tangible Edge'}</span>
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
                      <div><h4 className="text-[15px] font-bold text-white mb-1">100 B-Units Pre-load</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">System value of $1 USDC. Instant AA contract deployment to unlock smart routing.</p></div>
                    </div>
                  ) : selectedProduct === 'custom_fuel' ? (
                    <div className="flex gap-4">
                      <Zap size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div><h4 className="text-[15px] font-bold text-white mb-1">{(Number(customFuelAmount) || 0) * 100} B-Units Pre-load</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">System value of ${customFuelAmount || 0} USDC. Instant clearing fuel to process your daily retail volume.</p></div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <Box size={20} className="text-emerald-800 shrink-0 mt-0.5" />
                      <div><h4 className="text-[15px] font-bold text-white mb-1">Desktop API Gateway</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">Screenless black-box design with internal 300g weights for physical stability.</p></div>
                    </div>
                  )}
                </div>
              </div>
              {(selectedProduct === 'custom_fuel' || selectedProduct === 'starter') && marketRefuelError ? (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-[13px] font-medium text-red-300">
                  {marketRefuelError}
                </div>
              ) : null}
            </div>
            {selectedProduct === 'custom_fuel' ? (
              <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 bg-gradient-to-t from-[#0f1115] via-[#0f1115] to-transparent pt-32	flex flex-col gap-4 ">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-[32px] font-bold text-white leading-none">{customFuelAmount || '0'}</p>
                      <span className="text-[14px] font-medium text-slate-500">USDC</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleMarketPurchase()}
                  disabled={marketRefuelProcessing || !Number.isFinite(marketCustomFuelUsdc) || marketCustomFuelUsdc < 1}
                  className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-[1.2rem] text-white font-black text-[15px] uppercase tracking-wide shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] disabled:bg-slate-600 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  <Fuel size={20} fill="currentColor" strokeWidth={1.5} /> Refuel Now
                </button>
              </div>
            ) : (
            <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 bg-gradient-to-t from-[#0f1115] via-[#0f1115] to-transparent pt-12 flex items-center justify-between border-t border-white/5">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-[32px] font-bold text-white leading-none">
                    {selectedProduct === 'fuel' ? '499' : selectedProduct === 'starter' ? '1' : '999'}
                  </p>
                  <span className="text-[14px] font-medium text-slate-500">USDC</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleMarketPurchase()}
                disabled={selectedProduct === 'starter' && marketRefuelProcessing}
                className={`flex items-center gap-2 px-8 py-4 rounded-[16px] font-semibold text-[16px] text-white transition-all shadow-lg active:scale-95 ${
                 selectedProduct === 'fuel' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20' :
                 selectedProduct === 'starter' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' :
                 'bg-[#1562f0] hover:bg-[#2b74f5] shadow-[#1562f0]/25'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {selectedProduct === 'fuel' ? 'Secure Fuel' : selectedProduct === 'starter' ? 'Activate AA' : 'Secure Node'} <ChevronRight size={18} />
              </button>
            </div>
            )}
              </>
            )}
         </div>
       </div>
     )}

     {/* --- Issue brand asset / membership (Members & Loyalty) --- */}
     {isIssueCardModalOpen && (
       <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 font-sans sm:items-center sm:p-6">
         <div
           className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
           onClick={closeIssueCardModal}
           aria-hidden
         />
         <div className="relative flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[40px] border border-white/10 bg-[#0f1115] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 sm:rounded-[40px]">
           {issueCardStep === 1 && (
             <>
               <div className="relative shrink-0 border-b border-white/5 bg-gradient-to-b from-[#1562f0]/20 to-[#0f1115] p-6">
                 <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent opacity-20" />
                 <button
                   type="button"
                   onClick={closeIssueCardModal}
                   className="absolute right-6 top-6 z-10 rounded-full border border-white/10 bg-black/40 p-2.5 text-white/70 backdrop-blur-md transition-colors hover:text-white"
                 >
                   <X size={20} />
                 </button>
                 <div className="relative z-10 mt-2 text-center">
                   <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#1562f0]/30 bg-[#1562f0]/20 text-[#1562f0]">
                     <UserPlus size={20} />
                   </div>
                   <h2 className="mb-1 text-[20px] font-bold tracking-tight text-white">Issue Brand Asset</h2>
                   <p className="text-[13px] font-medium text-slate-400">Mint ERC-1155 Prepaid or NFT Tiers to users</p>
                 </div>
               </div>

               <div className="flex flex-col items-center p-6 sm:p-8">
                 <div className="relative mb-6 w-full">
                   <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                   <input
                     type="text"
                     placeholder="Customer @BeamioTag..."
                     value={issueTarget}
                     onChange={(e) => setIssueTarget(e.target.value)}
                     className="w-full rounded-[16px] border border-white/10 bg-white/5 py-3.5 pl-11 pr-4 text-[14px] font-medium text-white placeholder:text-slate-500 focus:border-[#1562f0] focus:outline-none"
                   />
                 </div>

                 <div className="mb-6 flex w-full rounded-[16px] border border-white/10 bg-white/5 p-1">
                   <button
                     type="button"
                     onClick={() => {
                       setIssueType('PREPAID');
                       setIssueValue('');
                     }}
                     className={`flex-1 rounded-[12px] py-2.5 text-[13px] font-bold transition-colors ${
                       issueType === 'PREPAID'
                         ? 'bg-[#1562f0] text-white shadow-sm'
                         : 'text-slate-400 hover:text-white'
                     }`}
                   >
                     Prepaid (ID: 0)
                   </button>
                   <button
                     type="button"
                     onClick={() => {
                       setIssueType('VIP_TIER');
                       const first = alliancesDb[ALLIANCE_ID_FOR_FIXED_USER_CARD].tiers[0]?.name ?? 'Green Card';
                       setIssueValue(first);
                     }}
                     className={`flex-1 rounded-[12px] py-2.5 text-[13px] font-bold transition-colors ${
                       issueType === 'VIP_TIER'
                         ? 'bg-[#1562f0] text-white shadow-sm'
                         : 'text-slate-400 hover:text-white'
                     }`}
                   >
                     VIP Tiers (ID: 99+)
                   </button>
                 </div>

                 <div className="mb-6 flex w-full items-center justify-between rounded-[16px] border border-white/10 bg-black/40 p-3">
                   <span className="pl-2 text-[13px] font-bold text-slate-400">Asset Expiration</span>
                   <select
                     value={issueExpiry}
                     onChange={(e) => setIssueExpiry(e.target.value)}
                     className="rounded-[10px] border border-white/10 bg-white/10 px-3 py-1.5 text-[12px] font-bold text-white focus:outline-none"
                   >
                     <option value="Never" className="text-slate-900">
                       Never (Lifetime)
                     </option>
                     <option value="1 Month" className="text-slate-900">
                       1 Month
                     </option>
                     <option value="1 Year" className="text-slate-900">
                       1 Year
                     </option>
                   </select>
                 </div>

                 {issueType === 'PREPAID' ? (
                   <div className="mb-4 flex w-full flex-col items-center space-y-4">
                     <input
                       type="text"
                       placeholder="Token Symbol (e.g. $CTree)"
                       value={issueTokenSymbol}
                       onChange={(e) => {
                         let val = e.target.value.toUpperCase();
                         if (val && !val.startsWith('$')) val = `$${val}`;
                         setIssueTokenSymbol(val);
                       }}
                       className="w-full rounded-[16px] border border-white/10 bg-white/5 px-4 py-3.5 text-center text-[15px] font-bold tracking-widest text-emerald-400 placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                     />
                     <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-500">
                       Minting {issueTokenSymbol} (Fungible)
                     </span>
                     <div className="flex items-center justify-center gap-2">
                       <span className="mt-1 text-[28px] font-semibold text-slate-500">$</span>
                       <input
                         type="number"
                         placeholder="0.00"
                         value={issueValue}
                         onChange={(e) => setIssueValue(e.target.value)}
                         className="w-[180px] bg-transparent text-center text-[56px] font-semibold text-white placeholder:text-slate-600 focus:outline-none"
                       />
                     </div>
                   </div>
                 ) : (
                   <div className="mb-4 flex max-h-[220px] w-full flex-col items-center space-y-4 overflow-y-auto pr-1 scrollbar-hide">
                     {alliancesDb[ALLIANCE_ID_FOR_FIXED_USER_CARD].tiers.map((tier) => (
                       <div
                         key={tier.id}
                         onClick={() => setIssueValue(tier.name)}
                         className={`flex w-full shrink-0 cursor-pointer items-center justify-between rounded-[16px] border-2 p-4 transition-all ${
                           issueValue === tier.name
                             ? tier.iconType === 'yellow'
                               ? 'border-yellow-500 bg-yellow-500/10'
                               : 'border-emerald-500 bg-emerald-500/10'
                             : 'border-white/10 bg-white/5 hover:border-white/20'
                         }`}
                       >
                         <div className="flex items-center gap-3">
                           <div
                             className={`flex h-10 w-10 items-center justify-center rounded-full ${
                               tier.iconType === 'yellow'
                                 ? 'bg-yellow-500/20 text-yellow-500'
                                 : 'bg-emerald-500/20 text-emerald-500'
                             }`}
                           >
                             {tier.iconType === 'yellow' ? (
                               <Crown size={18} />
                             ) : (
                               <ShieldCheck size={18} />
                             )}
                           </div>
                           <div>
                             <h4 className="text-[15px] font-bold text-white">{tier.name}</h4>
                             <p className="text-[12px] text-slate-400">
                               ID: {tier.id} • {tier.discount}% Auto-Discount
                             </p>
                           </div>
                         </div>
                         {issueValue === tier.name && (
                           <CheckCircle2
                             size={20}
                             className={tier.iconType === 'yellow' ? 'text-yellow-500' : 'text-emerald-500'}
                           />
                         )}
                       </div>
                     ))}
                     {!isCreatingTier ? (
                       <button
                         type="button"
                         onClick={() => setIsCreatingTier(true)}
                         className="mt-2 flex w-full shrink-0 items-center justify-center gap-2 rounded-[16px] border border-dashed border-white/20 py-4 text-[13px] font-bold text-slate-400 transition-colors hover:border-white/40 hover:text-white"
                       >
                         <Plus size={16} /> Create Custom Tier
                       </button>
                     ) : (
                       <div className="shrink-0 space-y-3 rounded-[16px] border border-[#1562f0]/30 bg-[#1562f0]/5 p-4 animate-in fade-in">
                         <input
                           type="text"
                           placeholder="Tier Name (e.g. Diamond VIP)"
                           value={newTierName}
                           onChange={(e) => setNewTierName(e.target.value)}
                           className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-[14px] text-white focus:border-[#1562f0] focus:outline-none"
                         />
                         <div className="relative">
                           <input
                             type="number"
                             placeholder="Discount Percentage"
                             value={newTierDiscount}
                             onChange={(e) => setNewTierDiscount(e.target.value)}
                             className="w-full rounded-lg border border-white/10 bg-black/40 py-3 pl-4 pr-10 text-[14px] text-white focus:border-[#1562f0] focus:outline-none"
                           />
                           <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                         </div>
                         <div className="flex gap-2 pt-2">
                           <button
                             type="button"
                             onClick={() => setIsCreatingTier(false)}
                             className="flex-1 rounded-lg py-2.5 text-[13px] font-bold text-slate-400 transition-colors hover:bg-white/10"
                           >
                             Cancel
                           </button>
                           <button
                             type="button"
                             onClick={handleCreateLoyaltyTier}
                             disabled={!newTierName.trim() || !newTierDiscount}
                             className="flex-1 rounded-lg bg-[#1562f0] py-2.5 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(21,98,240,0.2)] transition-colors disabled:opacity-50"
                           >
                             Save New Tier
                           </button>
                         </div>
                       </div>
                     )}
                   </div>
                 )}
               </div>

               <div className="shrink-0 border-t border-white/5 bg-gradient-to-t from-[#0f1115] via-[#0f1115] to-transparent p-6 sm:p-8">
                 <button
                   type="button"
                   onClick={() => setIssueCardStep(2)}
                   disabled={
                     !issueTarget ||
                     !issueValue ||
                     (issueType === 'PREPAID' && parseFloat(issueValue) <= 0) ||
                     (protocolFuelReserveBalance ?? 0) < ISSUE_CARD_MIN_BUINTS
                   }
                   className={`w-full rounded-[20px] py-4 text-[16px] font-bold transition-all ${
                     !issueTarget ||
                     !issueValue ||
                     (issueType === 'PREPAID' && parseFloat(issueValue) <= 0) ||
                     (protocolFuelReserveBalance ?? 0) < ISSUE_CARD_MIN_BUINTS
                       ? 'cursor-not-allowed border border-white/5 bg-white/5 text-slate-500'
                       : 'bg-[#1562f0] text-white shadow-[0_8px_20px_rgba(21,98,240,0.25)] hover:bg-blue-600 active:scale-[0.98]'
                   }`}
                 >
                   Continue
                 </button>
                 {(protocolFuelReserveBalance ?? 0) < ISSUE_CARD_MIN_BUINTS && (
                   <p className="mt-3 text-center text-[12px] font-bold text-rose-500">
                     Insufficient Protocol Fuel. Requires {ISSUE_CARD_MIN_BUINTS} B-Units.
                   </p>
                 )}
               </div>
             </>
           )}

           {issueCardStep === 2 && (
             <>
               <div className="relative shrink-0 border-b border-white/5 bg-gradient-to-b from-[#1562f0]/20 to-[#0f1115] p-6">
                 <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent opacity-20" />
                 <button
                   type="button"
                   onClick={() => setIssueCardStep(1)}
                   className="absolute left-6 top-6 z-10 rounded-full border border-white/10 bg-black/40 p-2.5 text-white/70 backdrop-blur-md transition-colors hover:text-white"
                 >
                   <ArrowRightLeft size={20} />
                 </button>
               </div>

               <div className="flex flex-col items-center p-6 animate-in slide-in-from-right sm:p-8">
                 <div className="relative z-10 -mt-12 mb-8 flex flex-col items-center">
                   <div className="relative mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#0f1115] bg-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                     <span className="text-[20px] font-bold text-white drop-shadow-md">
                       {issueTarget.replace('@', '').substring(0, 2).toUpperCase()}
                     </span>
                   </div>
                   <h3 className="mb-0.5 text-[22px] font-bold text-white">{issueTarget}</h3>
                   <p className="text-[13px] font-medium text-[#1562f0]">Will receive this asset</p>
                 </div>

                 <div className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-sm">
                   <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400">
                     {issueType === 'PREPAID' ? 'Amount to Issue (ID: 0)' : 'Tier to Mint (ID: 99+)'}
                   </span>
                   {issueType === 'PREPAID' ? (
                     <div className="text-[32px] font-bold leading-none text-white">
                       ${parseFloat(issueValue || '0').toFixed(2)}{' '}
                       <span className="text-[16px] text-slate-400">{issueTokenSymbol.replace('$', '')}</span>
                     </div>
                   ) : (
                     <div className="text-[24px] font-bold leading-none text-white">{issueValue}</div>
                   )}
                   <span className="mt-2 text-[11px] font-medium text-slate-500">Expires: {issueExpiry}</span>
                 </div>

                 <div className="mb-4 flex w-full items-center justify-between border-b border-white/5 px-4 py-5">
                   <span className="text-[14px] font-bold text-slate-300">Network fee</span>
                   <div className="flex flex-col items-end">
                     <div className="flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-orange-500">
                       <Fuel size={14} />
                       <span className="text-[13px] font-bold">{ISSUE_CARD_MIN_BUINTS} B-Units</span>
                     </div>
                     <span className="mt-1 text-[11px] font-medium text-slate-500">≈ 2.00 USDC</span>
                   </div>
                 </div>
               </div>

               <div className="shrink-0 border-t border-white/5 bg-gradient-to-t from-[#0f1115] via-[#0f1115] to-transparent p-6 sm:p-8">
                 <button
                   type="button"
                   onClick={handleConfirmIssueCard}
                   className="w-full rounded-[20px] bg-[#1562f0] py-4.5 text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(21,98,240,0.25)] transition-all hover:bg-blue-600 active:scale-[0.98]"
                 >
                   Mint to Customer
                 </button>
               </div>
             </>
           )}

           {issueCardStep === 3 && (
             <div className="flex h-full flex-col items-center justify-center p-8 py-16 animate-in zoom-in-95">
               <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#1562f0] shadow-[0_0_40px_rgba(21,98,240,0.5)]">
                 <Check size={48} className="text-white" strokeWidth={2.5} />
               </div>
               <h3 className="mb-3 text-[20px] font-semibold text-slate-300">Successfully Issued</h3>
               <div className="mb-4 text-center text-[32px] font-bold leading-none text-white">
                 {issueType === 'PREPAID'
                   ? `$${parseFloat(issueValue || '0').toFixed(2)} ${issueTokenSymbol.replace('$', '')}`
                   : issueValue}
               </div>
               <p className="mb-12 max-w-xs text-center text-[14px] font-medium text-slate-500">
                 ERC-1155 Asset recorded for {issueTarget} (demo). On production, mint via Beamio User Card flows.
               </p>
               <button
                 type="button"
                 onClick={closeIssueCardModal}
                 className="mt-auto w-full rounded-[20px] bg-[#1562f0] py-4.5 text-[16px] font-bold text-white shadow-[0_8px_20px_rgba(21,98,240,0.25)] transition-all hover:bg-blue-600 active:scale-[0.98]"
               >
                 Done
               </button>
             </div>
           )}
         </div>
       </div>
     )}

     {/* TxDisplayRow JSON modal (`raw` = full indexer Transaction + mapped UI fields) */}
     {rawTxJsonModal && (
       <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 font-sans">
         <button
           type="button"
           className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
           onClick={() => setRawTxJsonModal(null)}
           aria-label="Close"
         />
         <div
           className="relative bg-white rounded-[20px] shadow-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
           onClick={(e) => e.stopPropagation()}
           role="dialog"
           aria-modal="true"
           aria-labelledby="raw-tx-json-title"
         >
           <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
             <h2 id="raw-tx-json-title" className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
               <Code size={18} className="text-emerald-800" />
               TxDisplayRow (raw + mapped)
             </h2>
             <button
               type="button"
               onClick={() => setRawTxJsonModal(null)}
               className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
               aria-label="Close"
             >
               <X size={20} />
             </button>
           </div>
           <div className="p-4 overflow-auto flex-1 min-h-0">
             <div className="bg-[#1C1C1E] rounded-[16px] p-5 overflow-x-auto shadow-inner">
                 <pre className="break-all whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-sky-400">
                 {JSON.stringify(rawTxJsonModal, null, 2)}
               </pre>
             </div>
           </div>
         </div>
       </div>
     )}
   </div>
 );


 return renderDashboard();
}

