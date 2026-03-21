import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { CoNET_Data, setCoNET_Data } from '@/utils/globals';
import { storeSystemData, getBalance, formatWithThousands, purchaseBUnitFromBase } from '@/services/beamio';
import BeamioMeMainScreen from '@/components/Setting';
import { searchUsername, getOracleCadUsdcFromConet } from '@/services/beamio';
import {
  checkRedeemAdminCodeValid,
  isCardAdmin,
  postCardRedeemAdmin,
  getAAAccount,
  postCardAddAdminByAdmin,
  postCardAddAdmin,
  encodeAddAdminWithMintLimit,
  signExecuteForAdmin,
  signExecuteForOwner,
  getCardMetadataFromApi,
  getCardMetadataFrom1155Json,
  signBUnitRefuel3009,
  type CardTierMetadata,
} from '@/services/BeamioCard';
import { conetDepinProvider, baseEndpoint, baseRpcProviderDirect, CONET_MAINNET_WSS } from '@/utils/constants';
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

/** 指定商户卡地址 - 必须使用此卡 */
const FIXED_USER_CARD_CONTRACT_ADDRESS = BEAMIO_USER_CARD_ASSET_ADDRESS
/** Card-level cache key for on-chain `tiers[]` (not EOA-scoped) */
const ROUTING_ONCHAIN_TIERS_CACHE_KEY = `card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:onchain-tiers`
/** Card-level JSON metadata `tiers[]` (names from 0x{card}…0.json / cardMetadata API) */
const ROUTING_TIER_METADATA_CACHE_KEY = `card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:routing-tier-metadata`
const CONET_BUINT_ADDRESS = '0x4A3E59519eE72B9Dcf376f0617fF0a0a5a1ef879'
const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'] as const
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
  'function getGlobalStatsFull(uint8 periodType, uint256 anchorTs, uint256 cumulativeStartTs) view returns (uint256 cumulativeMint, uint256 cumulativeBurn, uint256 cumulativeTransfer, uint256 cumulativeTransferAmount, uint256 cumulativeRedeemMint, uint256 cumulativeUSDCMint, uint256 cumulativeIssued, uint256 cumulativeUpgraded, uint256 periodMint, uint256 periodBurn, uint256 periodTransfer, uint256 periodTransferAmount, uint256 periodRedeemMint, uint256 periodUSDCMint, uint256 periodIssued, uint256 periodUpgraded, uint256 adminCount)',
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

/** BeamioIndexerDiamond ActionFacet: getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged (7 params, no chainIdFilter) */
const INDEXER_ACCOUNT_ABI = [
  `function getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged(address account, uint8 periodType, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter, uint8 accountMode) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, ${TX_PAGE_TUPLE}[] page)`,
] as const

const CHAIN_ID_FILTER_ALL = ethers.MaxUint256

/** Align with `AdminStatsPeriodLib` / indexer `periodType` */
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
/** keccak256("merchant_pay:tip_updated") - tip transactions */
const TX_MERCHANT_PAY_TIP_UPDATED = ethers.keccak256(ethers.toUtf8Bytes('merchant_pay:tip_updated'))
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

/**
 * `getAdminStatsFull` returns `AdminStatsFullView` (struct with trailing `address[]`); RPC hex starts with a word offset to the tuple.
 * ethers v6 `Contract.getAdminStatsFull` often throws BAD_DATA — same layout as `scripts/fetchAdminStats.mjs` `parseStatsFull`.
 */
function parseGetAdminStatsFullReturnHex(rawHex: string): {
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
  provider: ethers.Provider
): Promise<ReturnType<typeof parseGetAdminStatsFullReturnHex>> {
  const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI])
  const data = iface.encodeFunctionData('getAdminStatsFull', [admin, periodType, 0, 0])
  const raw = await provider.call({ to: cardAddress, data })
  return parseGetAdminStatsFullReturnHex(typeof raw === 'string' ? raw : '')
}

/** Linked POS / subordinate admin row — filled only by the 15s overview feeder tick (Overview + Staff tabs). */
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
    const isTip = cat === TX_MERCHANT_PAY_TIP_UPDATED
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
    const source: 'APP' | 'NFC' = (display.source ?? '').toLowerCase().includes('nfc') ? 'NFC' : 'APP'
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
function beamioFiatCurrencyLabel(code: unknown): string {
  const n = typeof code === 'number' && Number.isFinite(code) ? code : Number(code)
  if (!Number.isFinite(n) || n < 0 || n >= BEAMIO_FIAT_CURRENCY_LABELS.length) return 'CAD'
  return BEAMIO_FIAT_CURRENCY_LABELS[n]
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

/** Unified Base overview feeder: 15s interval, single batch to reduce RPC load (Overview + Staff tabs). */
const FEEDER_INTERVAL_MS = 15_000;
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
 const [timeFilter, setTimeFilter] = useState<OverviewTimeFilter>('Today');
 const [oracleCadUsdc, setOracleCadUsdc] = useState<number | null>(null);
 const [activeLedger, setActiveLedger] = useState<'All' | 'AA' | 'EOA'>('All');
 const [txSearchTerm, setTxSearchTerm] = useState('');
 const [txFilterTerminal, setTxFilterTerminal] = useState('All');
 const [txFilterType, setTxFilterType] = useState('All');
 const fixedCardAdminsCacheKey = `card-admins:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:v2`;
 const linkedMerchantAdminsCacheKey = `linked-merchants:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:v2`;
 const fixedCardMetadataCacheKey = `card-metadata:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`;
 const currentEoa = (profiles?.[0]?.keyID ?? myAddress ?? '').toLowerCase();
 const overviewPeriodType = useMemo(() => overviewTimeFilterToPeriodType(timeFilter), [timeFilter]);
 const linkedTerminalsCacheKey = `eoa:${currentEoa}:linked-terminals:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`;
 const [fixedCardAdmins, setFixedCardAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(fixedCardAdminsCacheKey) ?? []);
 const [linkedMerchantAdmins, setLinkedMerchantAdmins] = useState<string[]>(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) ?? []);
 const [fixedCardMetadata, setFixedCardMetadata] = useState<FixedUserCardMetadata | null>(() => loadTrustedCache<FixedUserCardMetadata>(fixedCardMetadataCacheKey));
 const [merchantOwnerProfile, setMerchantOwnerProfile] = useState<BeamioProfile>(null);
 const adminTipsTodayCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:tips:p${overviewPeriodType}`;
 const [adminNetworkSummaryToday, setAdminNetworkSummaryToday] = useState<{ cadVol: number; txCount: number; usdc: number; vouchers: number } | null>(null);
 const [adminTipsToday, setAdminTipsToday] = useState<number | null>(null);
 const [adminMintLimitQuota, setAdminMintLimitQuota] = useState<number | null>(null);
 const [adminMintCounterFromClear, setAdminMintCounterFromClear] = useState<number | null>(null);
 const [protocolFuelReserveBalance, setProtocolFuelReserveBalance] = useState<number | null>(null);
 /** BUint units consumed in the header time range (indexer), not calendar “today” only */
 const [protocolFuelConsumptionToday, setProtocolFuelConsumptionToday] = useState<number | null>(null);
 const [overviewRefreshTrigger, setOverviewRefreshTrigger] = useState(0);
 /** Refetch CoNET indexer tx list when entering Transactions or on a 30s tick there (Overview feeder uses Base card stats, not this list). */
 const [txListPollTick, setTxListPollTick] = useState(0);
 const [overviewRefreshing, setOverviewRefreshing] = useState(false);
 const [linkedMerchantLookupDone, setLinkedMerchantLookupDone] = useState(() => loadTrustedCache<string[]>(linkedMerchantAdminsCacheKey) !== null);
 const [adminRetryCount, setAdminRetryCount] = useState(0);
 const [redeemAdminInProgress, setRedeemAdminInProgress] = useState(false);
 const [aaRefreshStatus, setAaRefreshStatus] = useState<AaRefreshStatus>('idle');
 const [indexerTransactions, setIndexerTransactions] = useState<TxDisplayRow[]>([]);
 const [indexerTransactionsLoading, setIndexerTransactionsLoading] = useState(false);
 /** Background refetch while a local list is already shown (do not replace table with spinner). */
 const [indexerTransactionsRefreshing, setIndexerTransactionsRefreshing] = useState(false);
 /** Row keys (indexerTxId) that should play slide-in-from-right on this paint; cleared after animation. */
 const [txSlideInKeys, setTxSlideInKeys] = useState<string[]>([]);
 const indexerTxListCountRef = useRef(0);
 useEffect(() => {
   indexerTxListCountRef.current = indexerTransactions.length;
 }, [indexerTransactions.length]);
 const [rawTxJsonModal, setRawTxJsonModal] = useState<TxDisplayRow | null>(null);
 /** Transactions table: payer/payee address (lowercase) → @beamioTag from searchUsername (Top-Up / Charge / Tip) */
 const [txReportingBeamioTagByAddress, setTxReportingBeamioTagByAddress] = useState<Record<string, string>>({});
 /** Chain-verified admin status (EOA-scoped): local cache first, chain fetch as backup (beamio-ai-onchain-fetch) */
 const isAdminTrustedCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:is-admin`;
 const [isCurrentUserCardAdmin, setIsCurrentUserCardAdmin] = useState<boolean | null>(() =>
   currentEoa && ethers.isAddress(currentEoa) ? (loadTrustedCache<boolean>(isAdminTrustedCacheKey) ?? null) : null
 );

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

 const [eoaUsdcBalance, setEoaUsdcBalance] = useState<string | null>(null);
 const [aaUsdcBalance, setAaUsdcBalance] = useState<string | null>(null);
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

 const handleMarketPurchase = useCallback(async () => {
   if (selectedProduct === 'custom_fuel') {
     const pk = profiles?.[0]?.privateKeyArmor;
     const account = (profiles?.[0]?.keyID ?? myAddress)?.trim();
     if (!pk || !account) {
       setMarketRefuelError('Wallet not ready. Please unlock or sign in.');
       return;
     }
     const amountHuman = String(customFuelAmount).replace(/,/g, '.').trim();
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

   void fetchWithCache(ROUTING_TIER_METADATA_CACHE_KEY, () =>
     fetchCardTierMetadataListForRouting(FIXED_USER_CARD_CONTRACT_ADDRESS)
   )
     .then((metaTiers) => {
       if (!cancelled) setRoutingModalCardTiersMeta(metaTiers.length > 0 ? metaTiers : null);
     })
     .catch(() => {
       if (!cancelled) setRoutingModalCardTiersMeta(null);
     });

   void fetchWithCache(ROUTING_ONCHAIN_TIERS_CACHE_KEY, () =>
     fetchBeamioUserCardTiersAndCurrencyFromChain(FIXED_USER_CARD_CONTRACT_ADDRESS, baseRpcProviderDirect)
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
 }, [isConfigModalOpen, configAllianceId]);

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
       const cardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS;
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
 ]);

 const clearCardCacheAndRetry = useCallback(() => {
   try {
   invalidateFetchCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`);
   invalidateFetchCache(ROUTING_ONCHAIN_TIERS_CACHE_KEY);
   invalidateFetchCache(ROUTING_TIER_METADATA_CACHE_KEY);
   invalidateFetchCache('indexer:tips');
   invalidateFetchCache('eoa:');
     const keys = [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, adminTipsTodayCacheKey, linkedTerminalsCacheKey, isAdminTrustedCacheKey];
     keys.forEach((k) => window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${k}`));
     Object.keys(window.localStorage).filter((k) => (k.startsWith(BIZ_CACHE_PREFIX + 'card:') && (k.includes('mint-limit-quota') || k.includes('quota-and-mint-counter'))) || (k.startsWith(BIZ_CACHE_PREFIX) && k.includes('buint:balance:'))).forEach((k) => window.localStorage.removeItem(k));
     setFixedCardAdmins([]);
     setLinkedMerchantAdmins([]);
     setIsCurrentUserCardAdmin(null);
     setTerminals([]);
     setLinkedMerchantLookupDone(false);
     setAdminNetworkSummaryToday(null);
     setAdminTipsToday(null);
     setAdminMintLimitQuota(null);
     setAdminMintCounterFromClear(null);
     setProtocolFuelReserveBalance(null);
     setProtocolFuelConsumptionToday(null);
     setAdminRetryCount((c) => c + 1);
   } catch {
     setAdminRetryCount((c) => c + 1);
   }
 }, [fixedCardAdminsCacheKey, linkedMerchantAdminsCacheKey, fixedCardMetadataCacheKey, adminTipsTodayCacheKey, linkedTerminalsCacheKey, isAdminTrustedCacheKey]);

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
       window.localStorage.removeItem(`${BIZ_CACHE_PREFIX}${INDEXER_INBOUND_TX_CACHE_KEY(oldEoa.toLowerCase())}`);
     } catch { /* ignore */ }
     setFixedCardAdmins([]);
     setLinkedMerchantAdmins([]);
     setLinkedMerchantLookupDone(false);
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
 /** Use current EOA (local account) only: if not admin, show "-" (no fallback to AA). Align with cache keys & isAdmin. */
 const localEoa = (currentEoa ?? '').trim();
 /** On-card admin for stats: admin list OR chain-verified isAdmin (list can lag behind `isCardAdmin` fetch). */
 const effectiveAdminAddress = useMemo(() => {
   if (!localEoa || !ethers.isAddress(localEoa)) return null;
   const addr = ethers.getAddress(localEoa);
   if (fixedCardAdmins.some((a) => a.toLowerCase() === addr.toLowerCase())) return addr;
   if (isCurrentUserCardAdmin === true) return addr;
   return null;
 }, [localEoa, fixedCardAdmins, isCurrentUserCardAdmin]);

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

 /** Force next 15s overview feeder tick (Staff terminal stats are updated inside that daemon only). */
 const refreshAllTerminalStats = useCallback(() => {
   setOverviewRefreshTrigger((t) => t + 1);
 }, []);

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
     const cardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS;
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

     invalidateFetchCache(`card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}`);
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
   const menuEoa = (profiles?.[0]?.keyID ?? myAddress ?? '').trim();
   const resolved = menuEoa && ethers.isAddress(menuEoa) ? ethers.getAddress(menuEoa) : (fixedCardMetadata?.cardOwner && ethers.isAddress(fixedCardMetadata.cardOwner) ? ethers.getAddress(fixedCardMetadata.cardOwner) : null);
   if (resolved) setFeederEoa(resolved);
 }, [profiles?.[0]?.keyID, myAddress, fixedCardMetadata?.cardOwner]);

 /** Unified Base overview feeder: every 15s on Overview + Staff tabs. Card metadata without login; Overview dashboard uses current EOA admin subtree + today (not global card totals). Staff terminal stats share this tick. */
 const feederInProgressRef = useRef(false);
 const feederCancelledRef = useRef(false);
 const feederAccountRef = useRef('');
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
   const networkSummaryCacheKey = `eoa:${currentEoa}:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${effectiveAdmin.toLowerCase()}:network-summary:p${overviewPeriodType}`;
   /** Use account (current EOA) for quota cache key so we fetch even when fixedCardAdmins not yet loaded */
   const quotaCacheKey = `card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${accountResolved ? accountResolved.toLowerCase() : ''}:quota-and-mint-counter`;
   const buintBalanceCacheKey = accountResolved ? `eoa:${accountResolved.toLowerCase()}:buint:balance` : '';
   const aa = profiles?.[0]?.aaAccount?.trim();
   const accountsToQuery = accountResolved ? [accountResolved] : [];
   if (aa && ethers.isAddress(aa) && accountResolved && ethers.getAddress(aa).toLowerCase() !== accountResolved.toLowerCase()) {
     accountsToQuery.push(ethers.getAddress(aa));
   }
   const aaForKey = aa && ethers.isAddress(aa) ? ethers.getAddress(aa).toLowerCase() : '';
   const consumptionCacheKey = accountResolved
     ? `eoa:${accountResolved.toLowerCase()}${aaForKey ? `:aa:${aaForKey}` : ''}:buint:consumption:p${overviewPeriodType}`
     : '';
   const cachedNetworkSummary = loadTrustedCache<{ cadVol: number; txCount: number; usdc: number; vouchers: number }>(networkSummaryCacheKey);
   const cachedQuota = loadTrustedCache<{ quota: number; mintCounterFromClear: number }>(quotaCacheKey);
   const cachedBuintBalance = buintBalanceCacheKey ? loadTrustedCache<number>(buintBalanceCacheKey) : null;
   const cachedConsumption = consumptionCacheKey ? loadTrustedCache<number>(consumptionCacheKey) : null;
   const cachedTips = loadTrustedCache<number>(adminTipsTodayCacheKey);

   if (cachedMetadata != null) setFixedCardMetadata(cachedMetadata);
   if (effectiveAdmin && ethers.isAddress(effectiveAdmin)) {
     if (cachedNetworkSummary != null) setAdminNetworkSummaryToday(cachedNetworkSummary);
     else setAdminNetworkSummaryToday(null);
   } else {
     setAdminNetworkSummaryToday(null);
   }
   if (cachedQuota != null && accountResolved) {
     setAdminMintLimitQuota(cachedQuota.quota);
     setAdminMintCounterFromClear(cachedQuota.mintCounterFromClear);
   }
   if (cachedBuintBalance != null && accountResolved) setProtocolFuelReserveBalance(cachedBuintBalance);
   if (cachedConsumption != null && accountResolved) setProtocolFuelConsumptionToday(cachedConsumption);
   else if (accountResolved) setProtocolFuelConsumptionToday(null);
   if (effectiveAdmin && ethers.isAddress(effectiveAdmin)) {
     if (cachedTips !== null) setAdminTipsToday(cachedTips);
     else setAdminTipsToday(null);
   } else {
     setAdminTipsToday(null);
   }

     const runFeeder = async () => {
     if (feederInProgressRef.current) return;
     feederInProgressRef.current = true;
     const accountRaw = (feederAccountRef.current || feederEoa || '').trim();
     const account = accountRaw && ethers.isAddress(accountRaw) ? ethers.getAddress(accountRaw) : '';
     const card = new ethers.Contract(FIXED_USER_CARD_CONTRACT_ADDRESS, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
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

       // 1. Admin network summary (when EOA is on-card admin): selected period + subtree — raw-decode getAdminStatsFull (ethers often fails on struct + dynamic tail)
       if (effectiveAdmin && ethers.isAddress(effectiveAdmin) && !feederCancelledRef.current) {
         try {
           const parsed = await callGetAdminStatsFullParsed(
             FIXED_USER_CARD_CONTRACT_ADDRESS,
             ethers.getAddress(effectiveAdmin),
             overviewPeriodType,
             baseRpcProviderDirect
           );
           if (parsed && !feederCancelledRef.current) {
             const summary = {
               cadVol: amountE6ToDisplayNumber(parsed.periodTransferAmount),
               txCount: Number(parsed.periodTransfer),
               usdc: amountE6ToDisplayNumber(parsed.periodUSDCMint),
               vouchers: amountE6ToDisplayNumber(parsed.periodMint),
             };
             setAdminNetworkSummaryToday(summary);
             saveTrustedCache(networkSummaryCacheKey, summary);
           } else if (!feederCancelledRef.current && cachedNetworkSummary != null) {
             setAdminNetworkSummaryToday(cachedNetworkSummary);
           } else if (!feederCancelledRef.current) {
             setAdminNetworkSummaryToday(null);
           }
         } catch {
           if (!feederCancelledRef.current && cachedNetworkSummary != null) setAdminNetworkSummaryToday(cachedNetworkSummary);
         }
       } else if (!effectiveAdmin || !ethers.isAddress(effectiveAdmin)) {
         setAdminNetworkSummaryToday(null);
       }

       // 2. Admin quota and mintCounterFromClear (account from feederAccountRef at execution time)
       if (account && ethers.isAddress(account) && !feederCancelledRef.current) {
         const step3QuotaCacheKey = `card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${ethers.getAddress(account).toLowerCase()}:quota-and-mint-counter`;
         const step3CachedQuota = loadTrustedCache<{ quota: number; mintCounterFromClear: number }>(step3QuotaCacheKey);
         const cardDirect = new ethers.Contract(FIXED_USER_CARD_CONTRACT_ADDRESS, USER_CARD_ADMIN_READ_ABI, baseRpcProviderDirect);
         try {
           const adminLower = ethers.getAddress(account).toLowerCase();
           const fetchStatsWithRawFallback = async (): Promise<{ mintCounterFromClear: bigint }> => {
             try {
               const r = await cardDirect.getAdminStatsFull(account, 0, 0, 0) as { mintCounterFromClear: bigint };
               return r;
             } catch {
               const iface = new ethers.Interface([...USER_CARD_ADMIN_READ_ABI]);
               const calldata = iface.encodeFunctionData('getAdminStatsFull', [account, 0, 0, 0]);
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
             next[k] = await fetchBizTerminalChainStats(card, baseRpcProviderDirect, FIXED_USER_CARD_CONTRACT_ADDRESS, taddr);
           }
           if (!feederCancelledRef.current) setTerminalStats(next);
         }
       }

       // 3. Protocol Fuel Reserve: CoNET BUint.balanceOf sum for user EOA + AA (same 15s feeder tick as indexer diamond consumption below)
       if (account && ethers.isAddress(account) && !feederCancelledRef.current) {
         try {
           const aaLive = profiles?.[0]?.aaAccount?.trim();
           const buintTargets: string[] = [ethers.getAddress(account)];
           if (aaLive && ethers.isAddress(aaLive) && ethers.getAddress(aaLive).toLowerCase() !== ethers.getAddress(account).toLowerCase()) {
             buintTargets.push(ethers.getAddress(aaLive));
           }
           let sumRaw = 0n;
           for (const addr of buintTargets) {
             try {
               sumRaw += (await buint.balanceOf(addr)) as bigint;
             } catch {
               /* one address failed; continue */
             }
           }
           const balance = Number(sumRaw) / 1_000_000;
           if (!feederCancelledRef.current) {
             setProtocolFuelReserveBalance(balance);
             if (buintBalanceCacheKey) saveTrustedCache(buintBalanceCacheKey, balance);
           }
         } catch {
           if (!feederCancelledRef.current && cachedBuintBalance != null) setProtocolFuelReserveBalance(cachedBuintBalance);
         }
       } else {
         setProtocolFuelReserveBalance(null);
       }

       // 4. Protocol Fuel Consumption for selected period (paginate — week/month may exceed one page)
       if (accountsToQuery.length > 0 && !feederCancelledRef.current) {
         try {
           let totalUnits6 = 0n;
           const pageLimit = 100;
           for (const acc of accountsToQuery) {
             try {
               let pageOffset = 0;
               while (true) {
                 const [total, , , page] = await indexerAccount.getAccountTransactionsByCurrentPeriodOffsetAndAccountModePaged(
                   acc,
                   overviewPeriodType,
                   0,
                   pageOffset,
                   pageLimit,
                   TX_CATEGORY_ZERO,
                   ACCOUNT_MODE_ALL
                 ) as [bigint, bigint, bigint, Array<{ fees?: { bServiceUnits6?: bigint } }>];
                 for (const tx of page ?? []) totalUnits6 += tx?.fees?.bServiceUnits6 ?? 0n;
                 if (!page || page.length < pageLimit || pageOffset + page.length >= Number(total)) break;
                 pageOffset += page.length;
               }
             } catch { /* ignore */ }
           }
           const consumption = Number(totalUnits6) / 1_000_000;
           if (!feederCancelledRef.current) {
             setProtocolFuelConsumptionToday(consumption);
             if (consumptionCacheKey) saveTrustedCache(consumptionCacheKey, consumption);
           }
         } catch {
           if (!feederCancelledRef.current && cachedConsumption != null) setProtocolFuelConsumptionToday(cachedConsumption);
         }
       }

       // 5. Admin tips today (topAdmin = logged-in EOA admin — not all tips on the asset)
       if (effectiveAdmin && ethers.isAddress(effectiveAdmin) && !feederCancelledRef.current) {
         try {
           let totalTips6 = 0n;
           let pageOffset = 0;
           const pageLimit = 100;
           while (true) {
             const [total, , , page] = await indexerAsset.getAssetTransactionsByTopAdminAndCurrentPeriodOffsetAndAccountModePaged(
               FIXED_USER_CARD_CONTRACT_ADDRESS, ethers.getAddress(effectiveAdmin), overviewPeriodType, 0, pageOffset, pageLimit,
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
   adminTipsTodayCacheKey,
   fixedCardMetadataCacheKey,
   fixedCardMetadata?.cardOwner,
   profiles?.[0]?.keyID,
   profiles?.[0]?.aaAccount,
   myAddress,
   timeFilter,
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
   const txKey = `eoa:${currentEoa}:indexer:tx:card:${FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase()}:admin:${effectiveAdminAddress.toLowerCase()}${userAAAddr ? `:aa:${userAAAddr.toLowerCase()}` : ''}`;
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
     const mapped = mapIndexerFetchedRowsToDisplay(rows);
     const eoaKey = currentEoa && ethers.isAddress(currentEoa) ? currentEoa.toLowerCase() : '';
     const merged =
       eoaKey ? mergeRenumberTxDisplays(mapped, loadInboundTxDisplayCache(eoaKey)) : mapped;
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
 }, [effectiveAdminAddress, profiles?.[0]?.aaAccount, myAddress, currentEoa, overviewRefreshTrigger, txListPollTick]);

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
       const [display] = mapIndexerFetchedRowsToDisplay([row]);
       setIndexerTransactions((prev) => {
         const merged = mergeRenumberTxDisplays([display], prev);
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

 const isFixedUserCardAdmin = fixedCardAdmins.some((address) => normalizedAdminCandidates.includes(address.toLowerCase()));
 /** Chain-verified admin for UI: only true when chain confirms; avoids persisted-session/cache showing admin to non-admin on production */
 const isAdminForUI = isCurrentUserCardAdmin === true;

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
     [adminTipsTodayCacheKey].forEach((k) =>
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
 }, [currentEoa, adminTipsTodayCacheKey]);

 useEffect(() => {
   if (hideTransactionsPanel && activeTab === 'Transactions') {
     setActiveTab('Overview');
   }
 }, [activeTab, hideTransactionsPanel]);


 // --- Financial Data: Overview uses current EOA admin + UTC calendar day (getAdminStatsFull subtree), not global card totals ---
 const adminToday = adminNetworkSummaryToday;
 const totalSales = effectiveAdminAddress && adminToday ? adminToday.cadVol : 0;
 const totalTips = adminTipsToday ?? 0;
 // Panel 3: token 0 mint in selected period (periodMint — USDC top-up, redeem, airdrop, etc.). periodUSDCMint alone is often 0 when no USDC gateway mint.
 const topUpsIssued = effectiveAdminAddress && adminToday ? adminToday.vouchers : 0;
 const topUpsUsdcMintOnly = effectiveAdminAddress && adminToday ? adminToday.usdc : 0;
const topUpsQuota = adminMintLimitQuota ?? 0; // denominator: mint limit from chain
const topUpsUsedFromClear = adminMintCounterFromClear ?? 0; // numerator: mintCounterFromClear from chain

const protocolFuelReserve = protocolFuelReserveBalance ?? 0; // B-Units: CoNET BUint.balanceOf(EOA)+balanceOf(AA) from 15s Overview feeder
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
               onChange={(e) => {
                 const v = e.target.value
                 if ((OVERVIEW_TIME_FILTERS as readonly string[]).includes(v)) setTimeFilter(v as OverviewTimeFilter)
               }}
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
                     <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-[12px] font-medium">{timeFilter}</span>
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
                   <p className="text-[13px] text-slate-400">{overviewPeriodConsumptionCaption(timeFilter)}</p>
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
           const cadOracle = oracleCadUsdc ?? ORACLE_CAD_USDC_FALLBACK;
           const calculateTxNetValueCAD = (tx: TxDisplayRow) => {
             if (tx.type.includes('Top-Up')) return tx.ctreeAmount || 0;
             return (tx.usdcAmount / cadOracle) + (tx.ctreeAmount || 0);
           };
           const filteredTx = txList.filter((tx) => {
             if (activeLedger === 'AA' && !profiles?.[0]?.aaAccount) return false;
             const isVaultTx = tx.terminal?.toLowerCase().includes('vault') || tx.terminal === 'The Vault';
             const matchLedger = activeLedger === 'All' || (activeLedger === 'EOA' && isVaultTx) || (activeLedger === 'AA' && !isVaultTx);
             const q = txSearchTerm.toLowerCase();
             const topUpShortLabel = tx.type.includes('Top-Up')
               ? `TX-${indexerTxIdBodyPrefix6(tx.indexerTxId)}`.toLowerCase()
               : '';
             const matchSearch =
               !txSearchTerm.trim() ||
               tx.id.toLowerCase().includes(q) ||
               tx.indexerTxId.toLowerCase().includes(q) ||
               indexerTxIdBodyPrefix6(tx.indexerTxId).includes(q.replace(/^0x/, '')) ||
               (topUpShortLabel && topUpShortLabel.includes(q)) ||
               tx.hash.toLowerCase().includes(q) ||
               (tx.beamioTag && tx.beamioTag.toLowerCase().includes(q));
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

              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
                {indexerTransactionsRefreshing ? (
                  <div
                    className="flex items-center justify-center gap-2 py-2.5 px-4 border-b border-slate-100/90 text-[12px] font-medium text-slate-600 bg-slate-50/50"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-[#1562f0]" aria-hidden />
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
                              <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
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
                                 isVaultTerminal ? 'bg-blue-50 border-blue-100 text-[#1562f0]' :
                                 tx.type === 'Tip' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                                 'bg-slate-50 border-slate-200/50 text-slate-600'
                               }`}>
                                 {tx.type === 'Tip' ? <Heart size={18} className="fill-rose-100" /> :
                                  tx.type.includes('Top-Up') ? <ArrowUpFromLine size={18}/> :
                                  <ArrowDownToLine size={18}/>}
                               </div>
                               <div>
                                 <div className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.type}</div>
                                 {tx.type.includes('Top-Up') || tx.type === 'Charge' ? (
                                   <div className="text-[13px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                                     <span className="whitespace-nowrap">
                                       TX-{indexerTxIdBodyPrefix6(tx.indexerTxId)} • {tx.time}
                                     </span>
                                     <button
                                       type="button"
                                       onClick={() => setRawTxJsonModal(tx)}
                                       className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-[#1562f0] hover:bg-slate-100 transition-colors shrink-0"
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
                                         className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-[#1562f0] hover:bg-slate-100 transition-colors shrink-0"
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
                               {tx.type.includes('Top-Up') || (tx.type === 'Charge' && !isVaultTerminal) ? (
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
                                   let displayJsonSource = ''
                                   try {
                                     const dj = raw.displayJson
                                     if (typeof dj === 'string' && dj.trim()) {
                                       const o = JSON.parse(dj) as { source?: string }
                                       if (typeof o?.source === 'string') displayJsonSource = o.source.toLowerCase()
                                     }
                                   } catch { /* ignore */ }
                                   const beamioTagPlain = tx.beamioTag ? tx.beamioTag.replace(/^@/, '') : ''
                                   const useNfcSubtitle = tx.type.includes('Top-Up')
                                     ? payerHandle.startsWith('CashTreeDamo_')
                                     : tx.source === 'NFC' ||
                                       displayJsonSource === 'container' ||
                                       /nfc/i.test(beamioTagPlain)
                                   return (
                                     <>
                                       <div className="flex items-center gap-2 flex-wrap">
                                         {payerTag ? (
                                           <span className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{payerTag}</span>
                                         ) : payerAddr ? (
                                           <AddressCapsule address={payerAddr} className="bg-slate-100 border-slate-200 text-slate-700" />
                                         ) : tx.type === 'Charge' ? (
                                           <span className="font-medium text-[15px] text-slate-500 italic whitespace-nowrap">Anonymous</span>
                                         ) : (
                                           <span className="font-medium text-[15px] text-slate-500">—</span>
                                         )}
                                       </div>
                                       <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium flex-wrap">
                                         {useNfcSubtitle ? (
                                           <>
                                             <Nfc size={14} className="text-slate-400 shrink-0" />
                                             <span className="whitespace-nowrap">NFC •</span>
                                           </>
                                         ) : (
                                           <>
                                             <Smartphone size={14} className="text-[#1562f0] shrink-0" />
                                             <span className="whitespace-nowrap">App •</span>
                                           </>
                                         )}
                                         {payeeTag ? (
                                           <span className="whitespace-nowrap">{payeeTag}</span>
                                         ) : payeeAddr ? (
                                           <AddressCapsule address={payeeAddr} className="bg-slate-50 border-slate-200 text-slate-600 text-[12px]" />
                                         ) : tx.type === 'Charge' && tx.terminal ? (
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
                                     <Shield size={14} className="text-[#1562f0]" />
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
                                     {tx.source === 'APP' ? <Smartphone size={14} className="text-[#1562f0]" /> : <Nfc size={14} className="text-slate-400" />}
                                     <span>{tx.source === 'APP' ? 'App' : 'NFC'} • {tx.terminal}</span>
                                   </div>
                                   {tx.source === 'APP' && tx.beamioTag && (
                                     <div className="hidden lg:group-hover:flex items-center gap-1 pt-0.5">
                                       <button type="button" className="p-1.5 bg-[#1562f0]/10 text-[#1562f0] rounded-md hover:bg-[#1562f0] hover:text-white transition-colors" title="Send Message">
                                         <MessageSquare size={14} />
                                       </button>
                                       <button type="button" className="p-1.5 bg-[#1562f0]/10 text-[#1562f0] rounded-md hover:bg-[#1562f0] hover:text-white transition-colors" title="Send Smart Receipt">
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
                               {tx.type.includes('Top-Up') ? (
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
                                       <Coins size={15} className="text-[#1562f0] shrink-0" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
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
                                     <Coins size={15} className="text-[#1562f0] shrink-0" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
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
                                     <Coins size={15} className="text-[#1562f0] shrink-0" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
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
                               {tx.type.includes('Top-Up') && /^0x[0-9a-fA-F]{64}$/.test(tx.indexerTxId) ? (
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
                                   <Sparkles size={12} className="text-[#1562f0] shrink-0" />
                                   <span className="text-[11px] font-bold text-[#1562f0]">Sponsored</span>
                                 </div>
                               ) : tx.bUnits > 0 ? (
                                 <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-1 rounded-md border border-orange-500/10 cursor-help" title={`Protocol Fee: ${(tx.bUnits * 0.01).toFixed(2)} USDC`}>
                                   <Fuel size={12} className="text-orange-500 shrink-0" />
                                   <span className="text-[11px] font-bold text-orange-500">{tx.bUnits} B-Units</span>
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/50">
                                   <span className="text-[11px] font-bold text-slate-400">0 B-Units (Base Gas)</span>
                                 </div>
                               )}
                             </div>
                           </td>

                           <td className="px-8 py-5 align-middle text-right">
                             <div className={`font-semibold text-[18px] tracking-tight whitespace-nowrap ${
                               tx.type.includes('Top-Up') ? 'text-emerald-600' :
                               tx.type === 'Tip' ? 'text-rose-600' :
                               tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-900'
                             }`}>
                               {tx.type.includes('Top-Up') ? '+' : ''}${txTotalCAD.toFixed(2)}
                             </div>
                             <div className={`text-[12px] font-medium mt-1 whitespace-nowrap ${tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-400'}`}>
                               {tx.status === 'Pending' ? 'Pending Settlement' : tx.tip > 0 ? `Incl. $${(tx.tip / cadOracle).toFixed(2)} Tip` : isVaultTerminal ? 'Treasury TX' : 'No Tip'}
                             </div>
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
                   {effectiveJoinedAlliances.map((aId) => {
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

             {isAdminForUI && effectiveJoinedAlliances.length === 0 && (
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
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-6">
                          <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Custom Refill</span>
                          <span className="text-[13px] font-mono font-medium text-slate-400">0.01 USDC / Unit</span>
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

                    <div className="mt-10 flex items-center justify-between bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Total</p>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white">${!hasAaAccount ? '1' : (customFuelAmount || '0')}</p>
                          <span className="text-[13px] font-medium text-slate-500">USDC</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(!hasAaAccount ? 'starter' : 'custom_fuel')}
                        disabled={hasAaAccount && (!customFuelAmount || Number(customFuelAmount) <= 0)}
                        className="bg-emerald-500 text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      <div className="flex justify-between items-center mb-10">
                        <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Package A</span>
                        <span className="text-[13px] font-mono font-medium text-slate-400">842 / 1000</span>
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
                    <div className="mt-10 flex items-center justify-between bg-white/5 p-3 pr-4 pl-6 rounded-[20px] border border-white/5 backdrop-blur-md">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pricing</p>
                        <div className="flex items-baseline gap-1.5">
                          <p className="text-[24px] font-bold text-white">$499</p>
                          <span className="text-[13px] font-medium text-slate-500">USDC</span>
                        </div>
                      </div>
                      <button type="button" onClick={() => setSelectedProduct('fuel')} className="bg-orange-500 text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20 active:scale-95">
                        View
                      </button>
                    </div>
                  </div>
                </div>

                {/* Product 2: Genesis Node Pack */}
                <div className="bg-[#0a0a0a] rounded-[32px] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.2)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 border border-slate-800/80 flex flex-col h-full">
                  <div className="absolute top-0 inset-x-0 h-full bg-gradient-to-b from-[#1562f0]/15 via-transparent to-transparent pointer-events-none"></div>
                  <div className="bg-[#111113] rounded-[28px] h-full p-8 relative z-10 flex flex-col justify-between border border-white/5 flex-grow">
                    <div>
                      <div className="flex justify-between items-center mb-10">
                        <span className="bg-[#1562f0]/10 text-[#1562f0] border border-[#1562f0]/20 px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase">Package B</span>
                        <span className="text-[13px] font-mono font-medium text-slate-400">247 / 300</span>
                      </div>
                      <div className="flex justify-center mb-10 relative">
                        <div className="absolute inset-0 bg-[#1562f0]/20 blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
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
                      <button type="button" onClick={() => setSelectedProduct('node')} className="bg-[#1562f0] text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-blue-500 transition-colors shadow-lg shadow-[#1562f0]/20 active:scale-95">
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
                              <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
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
                                <div className="w-12 h-12 rounded-[16px] bg-slate-50 flex items-center justify-center text-[#1562f0] border border-slate-100">
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
                                  onClick={() => refreshAllTerminalStats()}
                                  className="p-3 bg-blue-50 text-[#1562f0] rounded-[14px] hover:bg-[#1562f0] hover:text-white transition-colors"
                                  title="Refresh stats from chain"
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
                   ? 'Discounts are configured per on-chain membership tier from the infrastructure card contract. Enforced by your Smart Terminal.'
                   : 'Configure automatic point-of-sale discounts for ecosystem VIP tiers. Enforced by your Smart Terminal.'}
               </p>
               {useOnChainTiers && (
                 <p className="text-[11px] text-slate-400 font-mono mt-2 break-all">
                   {FIXED_USER_CARD_CONTRACT_ADDRESS}
                 </p>
               )}
             </div>

             <div className="p-6 sm:p-8 overflow-y-auto min-h-0">
               {chainLoading ? (
                 <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
                   <Loader2 size={28} className="animate-spin text-[#1562f0]" />
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
                         className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] font-semibold tabular-nums text-slate-900 outline-none focus:border-[#1562f0] focus:ring-2 focus:ring-[#1562f0]/20 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                     ? 'bg-[#1562f0] text-white hover:bg-blue-600 shadow-[0_8px_20px_rgba(21,98,240,0.25)] active:scale-[0.98]'
                     : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                 }`}
               >
                 {routingRulesDeployLoading ? (
                   <>
                     <Loader2 size={18} className="animate-spin" /> Deploying...
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
                .filter((id) => !effectiveJoinedAlliances.includes(id))
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
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={closeMarketProductModal}></div>
         <div className="relative bg-[#0f1115] w-full max-w-[500px] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[40px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-white/10">
            <div className={`relative h-48 sm:h-56 shrink-0 bg-gradient-to-b ${selectedProduct === 'fuel' ? 'from-orange-900/40' : selectedProduct === 'starter' || selectedProduct === 'custom_fuel' ? 'from-emerald-900/40' : 'from-blue-900/40'} to-[#0f1115]`}>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
              <button type="button" onClick={closeMarketProductModal} className="absolute top-6 left-6 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white border border-white/10 transition-colors z-10"><X size={22} /></button>
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
            {selectedProduct === 'custom_fuel' && (marketRefuelProcessing || marketRefuelSuccess !== null) ? (
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
                      <Box size={20} className="text-[#1562f0] shrink-0 mt-0.5" />
                      <div><h4 className="text-[15px] font-bold text-white mb-1">Desktop API Gateway</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">Screenless black-box design with internal 300g weights for physical stability.</p></div>
                    </div>
                  )}
                </div>
              </div>
              {selectedProduct === 'custom_fuel' && marketRefuelError ? (
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
                className={`flex items-center gap-2 px-8 py-4 rounded-[16px] font-semibold text-[16px] text-white transition-all shadow-lg active:scale-95 ${
                 selectedProduct === 'fuel' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20' :
                 selectedProduct === 'starter' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' :
                 'bg-[#1562f0] hover:bg-blue-500 shadow-[#1562f0]/20'
              }`}
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
               <Code size={18} className="text-[#1562f0]" />
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
               <pre className="text-[11px] text-[#34C759] font-mono leading-relaxed whitespace-pre-wrap break-all">
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

