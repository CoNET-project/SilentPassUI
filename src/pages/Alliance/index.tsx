import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CoNET_Data } from '@/utils/globals';
import { getAAAccount, getAAAccountByEOA, getCardMetadataFromApi, getCardMetadataFrom1155Json, postCardCreateRedeemAdmin, postCardAddAdmin, signExecuteForOwner, encodeCreateRedeemAdmin, encodeAddAdminWithMintLimit, ISSUED_NFT_START_ID, signBUnitRefuel3009 } from '@/services/BeamioCard';
import { searchUsername, generateCODE, redeemCodeHash } from '@/services/beamio';
import { getBalance, getBUnitBalance, formatWithThousands, purchaseBUnitFromBase, getUsdcBalanceFromApi } from '@/services/beamio';
import { ethers } from 'ethers';
import { baseEndpoint } from '@/utils/constants';
import { BASE_MAINNET_FACTORIES, BEAMIO_USER_CARD_ASSET_ADDRESS } from '@/config/chainAddresses';
import { APP_VERSION } from '@/version';
import ActiveHistoryPannelNew from '@/pages/History/components/activeHistoryPannelNew';
import { 
  LayoutDashboard, 
  CreditCard, 
  Users, 
  Settings, 
  Activity, 
  Wallet, 
  QrCode, 
  FileText, 
  TrendingUp, 
  ShieldCheck, 
  Search,
  Plus,
  CheckCircle2,
  Store,
  Layers,
  History,
  MessageSquare, 
  X,
  Ticket,
  Gift,
  PlusCircle,
  Calendar,
  PieChart,
  BadgeCheck,
  Globe,
  Trash2,
  ArrowRight,
  Upload,
  ExternalLink,
  Coins,
  Image as ImageIcon,
  Edit3, 
  Lock,
  Flame, 
  Banknote,
  UserPlus, 
  Filter,
  MoreHorizontal,
  Download,
  Copy,
  Zap,  
  Ban,   
  StickyNote,
  Percent,
  Calculator,
  Link as LinkIcon,
  Printer,
  Share2,  
  MapPin, 
  ShoppingBag,
  Award,
  Send,  
  MoreVertical,
  ArrowLeft,
  Camera,
  ShieldAlert,
  Cpu,
  Server,
  ArrowUpRight,
  ChevronRight,
  Key,
  Utensils,
  Receipt,
  BookOpen,
  ArrowRightLeft,
  Sparkles,
  Clock,
  Check,
  AlertTriangle,
  Smartphone,
  Nfc,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Menu,
  Fuel,
  Minus,
  Plus
} from 'lucide-react';

// --- Types & Mock Data ---

const initialMembers = [
  { id: 'MEM-001', name: 'Alice Chen', beamioHandle: '@alice_chen', smartAccount: '0x71C...9A21', tier: 'Black VIP Card', balance: '1,250.00', currency: 'CAD', joinDate: 'Oct 24, 2025', status: 'Active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
  { id: 'MEM-002', name: 'Bob Smith', beamioHandle: '@bobby_s', smartAccount: '0x3A2...1B44', tier: 'Green Card', balance: '50.00', currency: 'CAD', joinDate: 'Nov 12, 2025', status: 'Active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
  { id: 'MEM-003', name: 'Charlie Wang', beamioHandle: '@char_w', smartAccount: '0x9E1...4F22', tier: 'Green Card', balance: '75.00', currency: 'CAD', joinDate: 'Dec 05, 2025', status: 'Active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie' },
];

const initialMerchants = [
  { 
    id: 'MER-001', 
    name: 'Sen Pho + Cafe', 
    beamioHandle: '@senpho_kerr',
    smartAccount: '0x8B2...99C1',
    category: 'Vietnamese', 
    location: 'Kerrisdale, Vancouver, BC', 
    volume: '45200.00', // Total $CTree received from dining
    fiatCollected: '12500.00', // CAD collected offline from users top-ups
    bUnitsBalance: 1250, // 商家 B-Units 余额
    kybStatus: 'Verified',
    activeMembers: 412,
    avgTicket: '32.50',
    feeRate: '1.2% Flat',
    status: 'Active', 
    terminalId: 'POS-8821', 
    logo: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&h=100&fit=crop'
  },
  { 
    id: 'MER-002', 
    name: 'Sen Pho + Cafe', 
    beamioHandle: '@senpho_champ',
    smartAccount: '0x4D2...11F2',
    category: 'Vietnamese', 
    location: 'Champlain Heights, Vancouver, BC', 
    volume: '28150.00',
    fiatCollected: '3200.00',
    bUnitsBalance: 12, // 余额警告阈值
    kybStatus: 'Verified',
    activeMembers: 285,
    avgTicket: '28.00',
    feeRate: '1.2% Flat',
    status: 'Active', 
    terminalId: 'POS-8822', 
    logo: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&h=100&fit=crop'
  },
];

const TIER_COLOR_FALLBACKS = ['bg-[#96EB3C]', 'bg-slate-900', 'bg-blue-600', 'bg-amber-600', 'bg-purple-600', 'bg-rose-600'];

/** Returns true if background is dark → use white text; false → use dark text. Uses relative luminance (WCAG). */
function isBackgroundDark(color: string): boolean {
  const hexMatch = color.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/) ?? color.match(/\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\]/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance < 0.5;
  }
  const darkPatterns = /slate-9|blue-6|purple-6|rose-6|2a6808|212121|6B4BEF/i;
  const lightPatterns = /96EB3C|amber-6|emerald-4/i;
  if (lightPatterns.test(color)) return false;
  if (darkPatterns.test(color)) return true;
  return true;
}

type TierAsset = {
  id: string;
  name: string;
  type: string;
  minTopUp: string;
  minted: number;
  activeHolders: number;
  status: string;
  color: string;
  mintRule: string;
  image?: string;
};

/** CashTrees Partner Card - Merchant License NFT (always shown in Assets) */
const PARTNER_CARD_ASSET: TierAsset = {
  id: 'AST-PARTNER',
  name: 'CashTrees Partner Card',
  type: 'Merchant License NFT',
  minTopUp: 'KYB Approved',
  minted: 2,
  activeHolders: 2,
  status: 'Active',
  color: '#6B4BEF',
  mintRule: 'Authorized Partner',
};

const ledgerTransactions = [
  { id: 'TX-9901', type: 'Mint', amount: '50.00', from: 'CashTrees Treasury', to: '@new_diner', note: 'Online Purchase (New Green Card)', time: '5 mins ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '99 B-Units', device: 'Beamio APP', txHash: '0x3fA...8b2' },
  { id: 'TX-9902', type: 'Mint', amount: '100.00', from: 'Sen Pho (Kerrisdale)', to: '@bob_smith', note: 'Offline Upgrade (To VIP Black)', time: '20 mins ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '99 B-Units', device: 'NFC Card', txHash: '0x8cC...1a5' },
  { id: 'TX-9903', type: 'Transfer', amount: '32.50', from: '@alice_chen', to: 'Sen Pho (Champlain)', note: 'Offline Payment (Dining)', time: '1 hour ago', status: 'Settled', gasPaidBy: 'Merchant', gasAmount: '2.6 B-Units (0.8%)', device: 'NFC Card', txHash: '0x1dE...4f9' },
  { id: 'TX-9904', type: 'Mint', amount: '25.00', from: 'CashTrees Treasury', to: '@alice_chen', note: 'Online Top-up', time: '3 hours ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '2 B-Units', device: 'Beamio APP', txHash: '0x9bB...2e1' },
  { id: 'TX-9905', type: 'Mint', amount: '50.00', from: 'Sen Pho (Kerrisdale)', to: '@char_w', note: 'Offline Purchase (New Green Card)', time: '5 hours ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '99 B-Units', device: 'Beamio APP', txHash: '0x4aA...7c3' },
  { id: 'TX-9906', type: 'Transfer', amount: '18.00', from: '@bob_smith', to: 'Sen Pho (Kerrisdale)', note: 'Offline Payment (Dining)', time: 'Yesterday', status: 'Settled', gasPaidBy: 'Merchant', gasAmount: '2 B-Units (Min)', device: 'Beamio APP', txHash: '0x7eF...9d0' },
  { id: 'TX-9907', type: 'Burn', amount: '5000.00', from: 'Sen Pho (Kerrisdale)', to: 'Zero Address', note: 'Merchant Settlement (CAD Payout)', time: 'Yesterday', status: 'Completed', gasPaidBy: 'Merchant', gasAmount: '2 B-Units', device: 'Web Dashboard', txHash: '0x00A...000' },
];

// --- Helpers ---
const shortenAddress = (addr: string, head = 6, tail = 4) =>
  addr && addr.length > head + tail ? `${addr.slice(0, head)}...${addr.slice(-tail)}` : addr || '—';

/** CashTrees 卡 (BeamioUserCard)，与 chainAddresses 保持一致 */
const FIXED_USER_CARD_CONTRACT_ADDRESS = BEAMIO_USER_CARD_ASSET_ADDRESS
const ALLIANCE_CACHE_PREFIX = 'alliance:index:trusted:';
const ALLIANCE_RESTAURANTS_KEY = 'alliance:restaurants:local';
const ZERO_ADDRESS = ethers.ZeroAddress;

type LocalRestaurant = {
  id: string
  name: string
  cuisine: string
  cityArea: string
  handle: string
  kybCode?: string
  kybLink?: string
  createdAt: number
  /** Chain address (AA or EOA) - unique ID for deduplication */
  address?: string
  /** Optional chain data when merchant is registered */
  volume?: string
  fiatCollected?: string
  mintQuota?: number
  activeMembers?: number
  bUnitsBalance?: number
  logo?: string
}
type OnchainAdminEntry = {
  address: string
  metadata: string
  metadataTitle: string
  metadataSubtitle: string
  parent: string
  role: 'Owner' | 'Direct Admin' | 'Sub Admin'
}
type PendingRedeemAdminEntry = {
  hash: string
  status: 'Active' | 'Expired'
}
const EMPTY_OVERVIEW_METRICS = {
  totalNetworkVolumeCad: '—',
  activeMemberships: '—',
  partnerLocations: '—',
  fuelPoolBUnits: '—',
};
const EMPTY_ISSUED_CARD_SUMMARY = {
  name: '—',
  totalSupply: '—',
};
const EMPTY_ONCHAIN_ADMINS: OnchainAdminEntry[] = [];
const EMPTY_PENDING_REDEEM_ADMINS: PendingRedeemAdminEntry[] = [];

function summarizeAdminMetadata(raw: string): { title: string; subtitle: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { title: 'No metadata', subtitle: '' };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const title = [
      parsed.name,
      parsed.title,
      parsed.restaurantName,
      parsed.handle,
      parsed.username,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
    const subtitle = [
      parsed.location,
      parsed.cityArea,
      parsed.city,
      parsed.description,
      parsed.note,
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ?? '';
    return {
      title: title ?? 'JSON metadata',
      subtitle,
    };
  } catch {
    const compact = trimmed.replace(/\s+/g, ' ');
    return {
      title: compact.length > 48 ? `${compact.slice(0, 48)}...` : compact,
      subtitle: '',
    };
  }
}

function loadTrustedCache<T>(key: string | null): T | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${ALLIANCE_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value?: T };
    return parsed?.value ?? null;
  } catch {
    return null;
  }
}

function saveTrustedCache<T>(key: string | null, value: T) {
  if (!key || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${ALLIANCE_CACHE_PREFIX}${key}`,
      JSON.stringify({ value, updatedAt: Date.now() })
    );
  } catch {
    // Ignore storage quota or privacy-mode failures.
  }
}

// --- Sub-Components ---

interface MetricCardProps {
  title: string;
  value: string;
  subValue?: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
  colorClass?: string;
  bottomRightAction?: React.ReactNode;
}

const MetricCard = ({ title, value, subValue, change, isPositive, icon, colorClass = "bg-[#96EB3C]/20 text-[#6ea32b]", bottomRightAction }: MetricCardProps) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2 rounded-lg ${colorClass} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <span className={`text-sm font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-[#96EB3C]/20 text-[#6ea32b]' : 'bg-red-50 text-red-600'}`}>
        {change}
      </span>
    </div>
    <h3 className="text-slate-500 text-sm font-bold tracking-wide uppercase mb-1">{title}</h3>
    <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
    {subValue && <p className="text-xs text-slate-400 mt-1 font-medium">{subValue}</p>}
    {bottomRightAction && (
      <div className="absolute bottom-4 right-4">
        {bottomRightAction}
      </div>
    )}
  </div>
);

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: SidebarItemProps) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3 rounded-lg transition-all ${active ? 'bg-[#96EB3C] text-slate-900 shadow-[0_4px_16px_rgba(150,235,60,0.4)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
    title={collapsed ? label : undefined}
  >
    <Icon size={20} />
    {!collapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    'Active': 'bg-[#96EB3C]/20 text-[#548a1b]',
    'Expired': 'bg-amber-100 text-amber-700',
    'Verified': 'bg-[#96EB3C]/20 text-[#548a1b]',
    'Pending': 'bg-amber-100 text-amber-700',
    'Completed': 'bg-[#96EB3C]/20 text-[#548a1b]',
    'Settled': 'bg-slate-100 text-slate-700',
    'Burn': 'bg-rose-100 text-rose-700',
    'Mint': 'bg-blue-100 text-blue-700',
    'Transfer': 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const aaAddressFetchSeq = useRef(0);
  const overviewFetchSeq = useRef(0);
  const eoaBalanceFetchSeq = useRef(0);
  const aaBalanceFetchSeq = useRef(0);
  const bUnitBalanceFetchSeq = useRef(0);
  const [activeTab, setActiveTab] = useState('Overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [posAmount, setPosAmount] = useState('0');

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  }, []);
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [refuelAmount, setRefuelAmount] = useState(5);
  const [isRefueling, setIsRefueling] = useState(false);
  const [refuelError, setRefuelError] = useState<string | null>(null);
  const [refuelSuccess, setRefuelSuccess] = useState<string | null>(null);
  const [fuelUsdcBalance, setFuelUsdcBalance] = useState<number | null>(null);
  const REFUEL_GAS_COST = 2;

  // Onboard Restaurant form
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantCuisine, setRestaurantCuisine] = useState('');
  const [restaurantCity, setRestaurantCity] = useState('');
  const [restaurantHandle, setRestaurantHandle] = useState('');
  const [isGeneratingKyb, setIsGeneratingKyb] = useState(false);
  const [kybGeneratingPhase, setKybGeneratingPhase] = useState<'register' | null>(null);
  const [kybError, setKybError] = useState<string | null>(null);
  const [kybSuccess, setKybSuccess] = useState<{ code: string; link: string } | null>(null);
  const [kybLinkCopied, setKybLinkCopied] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleResolved, setHandleResolved] = useState<{ username: string; address?: string; addressAA?: string; image?: string; first_name?: string; last_name?: string } | null>(null);
  const [handleChecking, setHandleChecking] = useState(false);
  const [handleStatus, setHandleStatus] = useState<'idle' | 'searching' | 'found' | 'available'>('idle');
  const [topupLimit, setTopupLimit] = useState('1000');
  const [maxTopupPerTx, setMaxTopupPerTx] = useState('1000');
  const [maxSpendPerTx, setMaxSpendPerTx] = useState('500');
  const handleValidateAbortRef = useRef<boolean>(false);

  const validateHandle = useCallback(async (raw: string) => {
    const trimmed = raw.trim().replace(/^@/, '');
    if (!trimmed) {
      setHandleError(null);
      setHandleResolved(null);
      setHandleStatus('idle');
      return;
    }
    handleValidateAbortRef.current = false;
    setHandleChecking(true);
    setHandleStatus('searching');
    setHandleError(null);
    setHandleResolved(null);
    try {
      const isAddressSearch = ethers.isAddress(trimmed);
      const searchKey = isAddressSearch ? ethers.getAddress(trimmed) : trimmed;
      const res = await searchUsername(searchKey);
      if (handleValidateAbortRef.current) return;
      const results = res?.results ?? [];
      const norm = trimmed.toLowerCase();
      let match: { username?: string; accountName?: string; address?: string; image?: string; first_name?: string; last_name?: string } | undefined;
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
          try {
            const card = new ethers.Contract(
              FIXED_USER_CARD_CONTRACT_ADDRESS,
              ['function balanceOf(address account, uint256 id) view returns (uint256)'],
              baseEndpoint
            );
            const bal = (await card.balanceOf(addr, ISSUED_NFT_START_ID)) as bigint;
            if (bal > 0n) {
              setHandleResolved(null);
              setHandleError('Already registered as merchant');
              setHandleStatus('idle');
              return;
            }
          } catch {
            // RPC failure: fail open, allow capsule assembly; server will reject if already registered
          }
          let addressAA: string | undefined;
          try {
            const aa = await getAAAccountByEOA(addr);
            if (aa && ethers.isAddress(aa)) addressAA = aa;
          } catch {
            /* RPC/API failure: fallback to EOA in handleRegistrationMerchant */
          }
          if (handleValidateAbortRef.current) return;
          setHandleResolved({
            username: match.username ?? match.accountName ?? (isAddressSearch ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : trimmed),
            address: addr,
            addressAA,
            image: match.image,
            first_name: match.first_name,
            last_name: match.last_name,
          });
          setHandleError(null);
          setHandleStatus('found');
          return;
        }
        setHandleResolved({
          username: match.username ?? match.accountName ?? trimmed,
          address: addr,
          image: match.image,
          first_name: match.first_name,
          last_name: match.last_name,
        });
        setHandleError(null);
        setHandleStatus('found');
      } else if (isAddressSearch) {
        let addressAA: string | undefined;
        try {
          const aa = await getAAAccountByEOA(searchKey);
          if (aa && ethers.isAddress(aa)) addressAA = aa;
        } catch {
          /* RPC/API failure: fallback to EOA in handleRegistrationMerchant */
        }
        if (handleValidateAbortRef.current) return;
        setHandleResolved({
          username: `${searchKey.slice(0, 6)}…${searchKey.slice(-4)}`,
          address: searchKey,
          addressAA,
        });
        setHandleError(null);
        setHandleStatus('found');
      } else {
        setHandleResolved(null);
        setHandleError('Not found');
        setHandleStatus('available');
      }
    } catch {
      if (!handleValidateAbortRef.current) {
        setHandleResolved(null);
        setHandleError('Not found');
        setHandleStatus('idle');
      }
    } finally {
      if (!handleValidateAbortRef.current) setHandleChecking(false);
    }
  }, []);

  const closeMerchantModal = useCallback(() => {
    setIsMerchantModalOpen(false);
    setRestaurantName('');
    setRestaurantCuisine('');
    setRestaurantCity('');
    setRestaurantHandle('');
    setTopupLimit('1000');
    setMaxTopupPerTx('1000');
    setMaxSpendPerTx('500');
    setKybError(null);
    setKybSuccess(null);
    setKybLinkCopied(false);
    setHandleError(null);
    setHandleResolved(null);
    setHandleStatus('idle');
    setKybGeneratingPhase(null);
  }, []);

  // Local restaurants from localStorage
  const [localRestaurants, setLocalRestaurants] = useState<LocalRestaurant[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(ALLIANCE_RESTAURANTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as LocalRestaurant[];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const saveLocalRestaurants = (list: LocalRestaurant[]) => {
    setLocalRestaurants(list);
    try { window.localStorage.setItem(ALLIANCE_RESTAURANTS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const addLocalRestaurant = (rest: LocalRestaurant) => {
    setLocalRestaurants((prev) => {
      const next = [...prev, rest];
      try { window.localStorage.setItem(ALLIANCE_RESTAURANTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleRegistrationMerchant = async () => {
    if (!handleResolved) return;
    const adminEOA = handleResolved.address;
    if (!adminEOA || !ethers.isAddress(adminEOA)) return;
    const cardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS;
    const ownerPk = profile?.privateKeyArmor;
    if (!ownerPk) {
      setKybError('Wallet not connected. Connect with card owner to register merchant.');
      return;
    }
    setKybError(null);
    setKybSuccess(null);
    setIsGeneratingKyb(true);
    setKybGeneratingPhase('register');
    try {
      const metadata = JSON.stringify({
        restaurantName: restaurantName.trim() || `@${handleResolved.username}`,
        cuisine: restaurantCuisine.trim(),
        cityArea: restaurantCity.trim(),
        handle: `@${handleResolved.username}`,
      });
      const limitNum = Math.max(0, Number(topupLimit) || 1000);
      const mintLimitPoints6 = BigInt(Math.round(limitNum * 1_000_000));
      const data = encodeAddAdminWithMintLimit(adminEOA, 1, metadata, mintLimitPoints6);
      const now = Math.floor(Date.now() / 1000);
      const deadline = now + 300;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const ownerSignature = await signExecuteForOwner(ownerPk, cardAddress, data, deadline, nonce);
      const res = await postCardAddAdmin({
        cardAddress,
        data,
        deadline,
        nonce,
        ownerSignature,
        adminEOA,
      });
      if (!res.success) {
        setKybError(res.error ?? 'Failed to register merchant as admin');
        return;
      }
      const rest: LocalRestaurant = {
        id: adminEOA.toLowerCase(),
        name: restaurantName.trim() || `@${handleResolved.username}`,
        cuisine: restaurantCuisine.trim(),
        cityArea: restaurantCity.trim(),
        handle: `@${handleResolved.username}`,
        createdAt: Date.now(),
        address: ethers.getAddress(adminEOA),
      };
      addLocalRestaurant(rest);
      setKybSuccess({ code: '', link: `Merchant @${handleResolved.username} registered as admin successfully.` });
    } catch (e: any) {
      setKybError(e?.message ?? String(e) ?? 'Failed to register merchant');
    } finally {
      setIsGeneratingKyb(false);
    }
  };

  const handleGenerateKybLink = async () => {
    const name = restaurantName.trim();
    const cuisine = restaurantCuisine.trim();
    const city = restaurantCity.trim();
    const handle = restaurantHandle.trim().replace(/^@/, '');
    if (!name) {
      setKybError('Restaurant Name is required');
      return;
    }
    if (handleError === 'Already registered as merchant') {
      setKybError(handleError);
      return;
    }
    setKybError(null);
    setKybSuccess(null);
    setIsGeneratingKyb(true);
    try {
      const cardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS;
      const ownerPk = profile?.privateKeyArmor;
      if (!ownerPk) {
        setKybError('Wallet not connected. Connect with card owner to generate KYB link.');
        return;
      }
      const { code, hash } = generateCODE('');
      const now = Math.floor(Date.now() / 1000);
      const validAfter = now - 60;
      const validBefore = now + 365 * 86400;
      const resolvedHandle = handleResolved?.username ? `@${handleResolved.username}` : (handle ? `@${handle}` : '');
      const metadata = JSON.stringify({
        restaurantName: name,
        cuisine,
        cityArea: city,
        handle: resolvedHandle,
      });
      const limitNum = Math.max(0, Number(topupLimit) || 1000);
      const mintLimitPoints6 = BigInt(Math.round(limitNum * 1_000_000));
      const redeemAdminData = encodeCreateRedeemAdmin(hash, metadata, validAfter, validBefore, mintLimitPoints6);
      const deadline = now + 300;
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const ownerSignature = await signExecuteForOwner(ownerPk, cardAddress, redeemAdminData, deadline, nonce);
      const redeemRes = await postCardCreateRedeemAdmin({
        cardAddress,
        data: redeemAdminData,
        deadline,
        nonce,
        ownerSignature,
      });
      if (!redeemRes.success) {
        setKybError(redeemRes.error ?? 'Failed to create redeem admin');
        return;
      }
      const kybLink = `https://biz.beamio.app/biz/?redeemCode=${encodeURIComponent(code)}&redeemAdmin=1&card=${cardAddress}`;
      const rest: LocalRestaurant = {
        id: `rest-${Date.now()}`,
        name,
        cuisine,
        cityArea: city,
        handle: resolvedHandle,
        kybCode: code,
        kybLink,
        createdAt: Date.now(),
      };
      addLocalRestaurant(rest);
      setKybSuccess({ code, link: kybLink });
      setRestaurantName('');
      setRestaurantCuisine('');
      setRestaurantCity('');
      setRestaurantHandle('');
      setHandleResolved(null);
    } catch (e: any) {
      setKybError(e?.message ?? String(e) ?? 'Failed to generate KYB link');
    } finally {
      setIsGeneratingKyb(false);
    }
  };

  // 新增：模拟待处理的结算申请状态
  const [settlementRequests, setSettlementRequests] = useState([
    { id: 'REQ-8801', merchant: 'Sen Pho + Cafe', location: 'Kerrisdale', amount: '4800.00', method: 'USDC', timeline: 'T+0', time: '15 mins ago', requiredGas: '2 B-Units' },
    { id: 'REQ-8802', merchant: 'Sen Pho + Cafe', location: 'Champlain Heights', amount: '1250.00', method: 'CAD', timeline: 'T+1', time: '2 hours ago', requiredGas: '2 B-Units' },
  ]);

  // Real wallet data from CoNET_Data
  const profile = CoNET_Data?.profiles?.[0];
  const beamioTag = CoNET_Data?.beamio?.accountName ? `@${CoNET_Data.beamio.accountName}` : null;
  const eoaAddress = profile?.keyID ?? null;
  const normalizedEoaAddress = eoaAddress?.toLowerCase() ?? null;
  const normalizedCardAddress = FIXED_USER_CARD_CONTRACT_ADDRESS.toLowerCase();
  const aaAddressCacheKey = normalizedEoaAddress ? `aa-address:${normalizedEoaAddress}` : null;
  const overviewCacheKey = `overview:${normalizedCardAddress}`;
  const issuedCardSummaryCacheKey = `issued-card-summary:${normalizedCardAddress}`;
  const eoaUsdcBalanceCacheKey = normalizedEoaAddress ? `eoa-usdc:${normalizedEoaAddress}` : null;
  const bUnitBalanceCacheKey = normalizedEoaAddress ? `bunit:${normalizedEoaAddress}` : null;
  const [aaAddress, setAaAddress] = useState<string | null>(null);
  useEffect(() => {
    if (!profile?.keyID) {
      setAaAddress(null);
      return;
    }
    setAaAddress(loadTrustedCache<string>(aaAddressCacheKey));

    const requestId = ++aaAddressFetchSeq.current;
    getAAAccount(profile)
      .then((resolvedAddress) => {
        if (requestId !== aaAddressFetchSeq.current || !resolvedAddress) return;
        setAaAddress(resolvedAddress);
        saveTrustedCache(aaAddressCacheKey, resolvedAddress);
      })
      .catch(() => {
        // Keep the last trusted address if RPC/account resolution fails.
      });
  }, [aaAddressCacheKey, profile]);

  // Fixed CashTrees BeamioUserCard contract address
  const userCardContractAddress = FIXED_USER_CARD_CONTRACT_ADDRESS;

  const deployedContractAddress = aaAddress ?? eoaAddress ?? '—';

  const [contractCopied, setContractCopied] = useState(false);
  const handleCopyContract = () => {
    if (!userCardContractAddress) return;
    navigator.clipboard.writeText(userCardContractAddress).then(() => {
      setContractCopied(true);
      setTimeout(() => setContractCopied(false), 1500);
    });
  };

  const [overviewMetrics, setOverviewMetrics] = useState(EMPTY_OVERVIEW_METRICS);
  const [issuedCardSummary, setIssuedCardSummary] = useState(EMPTY_ISSUED_CARD_SUMMARY);
  const tierAssetsCacheKey = `tier-assets:${normalizedCardAddress}`;
  const [tierAssets, setTierAssets] = useState<TierAsset[]>([]);
  const onchainAdminsCacheKey = `admins:${normalizedCardAddress}`;
  const pendingRedeemAdminsCacheKey = `redeem-admins:${normalizedCardAddress}`;
  const [onchainAdmins, setOnchainAdmins] = useState<OnchainAdminEntry[]>([]);
  const [pendingRedeemAdmins, setPendingRedeemAdmins] = useState<PendingRedeemAdminEntry[]>([]);
  const [overviewRefreshTrigger, setOverviewRefreshTrigger] = useState(0);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);

  const handleNewTransactionIndexed = useCallback(() => {
    setOverviewRefreshTrigger((n) => n + 1);
  }, []);

  const handleOverviewRefresh = useCallback(() => {
    setOverviewRefreshing(true);
    setOverviewRefreshTrigger((n) => n + 1);
    setTimeout(() => setOverviewRefreshing(false), 3000);
  }, []);

  useEffect(() => {
    if (isFuelModalOpen && eoaAddress) {
      getUsdcBalanceFromApi(eoaAddress)
        .then((s) => setFuelUsdcBalance(s != null ? Number(s) : null))
        .catch(() => setFuelUsdcBalance(null));
    }
  }, [isFuelModalOpen, eoaAddress]);

  const handleRefuel = useCallback(async () => {
    const pk = profile?.privateKeyArmor;
    if (!pk || !eoaAddress) {
      setRefuelError('Wallet not ready. Please unlock or sign in.');
      return;
    }
    const usdcBal = fuelUsdcBalance ?? 0;
    if (usdcBal < refuelAmount) {
      setRefuelError('Insufficient USDC balance.');
      return;
    }
    setRefuelError(null);
    setRefuelSuccess(null);
    setIsRefueling(true);
    try {
      const payload = await signBUnitRefuel3009(pk, String(refuelAmount));
      const result = await purchaseBUnitFromBase(payload);
      if (result.success) {
        setRefuelSuccess(result.txHash ?? 'Success');
        setOverviewRefreshTrigger((n) => n + 1);
        setTimeout(() => {
          setIsFuelModalOpen(false);
          setRefuelSuccess(null);
        }, 2500);
      } else {
        setRefuelError(result.error ?? 'Refuel failed');
      }
    } catch (e) {
      setRefuelError((e as Error)?.message ?? 'Refuel failed');
    } finally {
      setIsRefueling(false);
    }
  }, [profile?.privateKeyArmor, eoaAddress, fuelUsdcBalance, refuelAmount]);

  useEffect(() => {
    let cancelled = false;
    const cachedOverview = loadTrustedCache<typeof EMPTY_OVERVIEW_METRICS>(overviewCacheKey);
    const cachedIssuedCardSummary = loadTrustedCache<typeof EMPTY_ISSUED_CARD_SUMMARY>(issuedCardSummaryCacheKey);
    const cachedTierAssets = loadTrustedCache<TierAsset[]>(tierAssetsCacheKey);
    const cachedOnchainAdmins = loadTrustedCache<OnchainAdminEntry[]>(onchainAdminsCacheKey);
    const cachedPendingRedeemAdmins = loadTrustedCache<PendingRedeemAdminEntry[]>(pendingRedeemAdminsCacheKey);

    setOverviewMetrics(cachedOverview ?? EMPTY_OVERVIEW_METRICS);
    setIssuedCardSummary(cachedIssuedCardSummary ?? EMPTY_ISSUED_CARD_SUMMARY);
    setTierAssets(cachedTierAssets ?? []);
    setOnchainAdmins(cachedOnchainAdmins ?? EMPTY_ONCHAIN_ADMINS);
    setPendingRedeemAdmins(cachedPendingRedeemAdmins ?? EMPTY_PENDING_REDEEM_ADMINS);

    const loadOverviewMetrics = async () => {
      if (!userCardContractAddress) {
        return;
      }

      try {
        const requestId = ++overviewFetchSeq.current;
        const card = new ethers.Contract(
          userCardContractAddress,
          [
            'function owner() view returns (address)',
            'function totalMembershipIssued() view returns (uint256)',
            'function totalActiveMemberships() view returns (uint256)',
            'function totalMembershipIssuedByTierIndex(uint256) view returns (uint256)',
            'function activeMembershipCountByTierIndex(uint256) view returns (uint256)',
            'function tiers(uint256) view returns (uint256 minUsdc6, uint256 attr, uint256 tierExpirySeconds, bool upgradeByBalance)',
            'function getGlobalStatsFull(uint8,uint256,uint256) view returns (uint256 cumulativeMint, uint256 cumulativeBurn, uint256 cumulativeTransfer, uint256 cumulativeTransferAmount, uint256 cumulativeRedeemMint, uint256 cumulativeUSDCMint, uint256 cumulativeIssued, uint256 cumulativeUpgraded, uint256 periodMint, uint256 periodBurn, uint256 periodTransfer, uint256 periodTransferAmount, uint256 periodRedeemMint, uint256 periodUSDCMint, uint256 periodIssued, uint256 periodUpgraded, uint256 adminCount)',
            'function getAdminListWithMetadata() view returns (address[] admins, string[] metadatas, address[] parents)',
            'function getRedeemAdminList() view returns (bytes32[] memory)',
            'function getRedeemAdminStatus(bytes32 hash) view returns (bool active)',
            'function totalSupply(uint256) view returns (uint256)',
            'function totalSupply() view returns (uint256)',
          ],
          baseEndpoint
        );

        const [owner, totalMembershipIssued, totalActiveMemberships, metadata] = await Promise.all([
          card.owner() as Promise<string>,
          card.totalMembershipIssued() as Promise<bigint>,
          card.totalActiveMemberships() as Promise<bigint>,
          getCardMetadataFromApi(userCardContractAddress).then((meta) => meta ?? getCardMetadataFrom1155Json(userCardContractAddress)),
        ]);

        let totalNetworkVolumeCad = 0;
        try {
          const totalSupplyById = card.getFunction('totalSupply(uint256)');
          const pointsSupply0 = (await totalSupplyById.staticCall(0)) as bigint;
          totalNetworkVolumeCad = Number(pointsSupply0) / 1_000_000;
        } catch {
          for (let i = 0; i < 64; i++) {
            try {
              const [issuedCount, tier] = await Promise.all([
                card.totalMembershipIssuedByTierIndex(i) as Promise<bigint>,
                card.tiers(i) as Promise<{ minUsdc6: bigint }>,
              ]);
              totalNetworkVolumeCad += Number(issuedCount) * Number(tier.minUsdc6) / 1_000_000;
            } catch {
              break;
            }
          }
        }

        const tierAssetsList: TierAsset[] = [];
        for (let i = 0; i < 64; i++) {
          try {
            const [issuedCount, activeCount, tier] = await Promise.all([
              card.totalMembershipIssuedByTierIndex(i) as Promise<bigint>,
              card.activeMembershipCountByTierIndex(i) as Promise<bigint>,
              card.tiers(i) as Promise<{ minUsdc6: bigint; upgradeByBalance: boolean }>,
            ]);

            const metaTier = metadata?.tiers?.[i];
            const minCad = Number(tier.minUsdc6) / 1_000_000;
            const tierName = metaTier?.name?.trim() || (metadata?.name ? `${metadata.name} Tier ${i + 1}` : `Tier ${i + 1}`);
            const tierType = metaTier?.description?.trim() || 'Membership';
            const tierColor = metaTier?.backgroundColor?.trim() || TIER_COLOR_FALLBACKS[i % TIER_COLOR_FALLBACKS.length];
            tierAssetsList.push({
              id: `AST-${i}`,
              name: tierName,
              type: tierType,
              minTopUp: `≥ ${formatWithThousands(minCad, 0)} CAD`,
              minted: Number(issuedCount),
              activeHolders: Number(activeCount),
              status: 'Active',
              color: tierColor,
              mintRule: tier.upgradeByBalance ? 'Balance-based Upgrade' : 'One-time Top-up',
              image: metaTier?.image?.trim() || undefined,
            });
          } catch {
            break;
          }
        }

        // Fallback: when chain tier loop yields nothing but API metadata has tiers (e.g. RPC timeout, contract mismatch)
        if (tierAssetsList.length === 0 && metadata?.tiers && Array.isArray(metadata.tiers) && metadata.tiers.length > 0) {
          for (let i = 0; i < metadata.tiers.length; i++) {
            const t = metadata.tiers[i];
            const minUsdc6 = t.minUsdc6 != null ? String(t.minUsdc6).trim() : '0';
            const minCad = parseInt(minUsdc6, 10) / 1_000_000;
            const tierColor = t.backgroundColor?.trim() || TIER_COLOR_FALLBACKS[i % TIER_COLOR_FALLBACKS.length];
            tierAssetsList.push({
              id: `AST-${i}`,
              name: t.name?.trim() || (metadata?.name ? `${metadata.name} Tier ${i + 1}` : `Tier ${i + 1}`),
              type: t.description?.trim() || 'Membership',
              minTopUp: `≥ ${formatWithThousands(Number.isNaN(minCad) ? 0 : minCad, 0)} CAD`,
              minted: 0,
              activeHolders: 0,
              status: 'Active',
              color: tierColor,
              mintRule: (t as { upgradeByBalance?: boolean }).upgradeByBalance ? 'Balance-based Upgrade' : 'One-time Top-up',
              image: t.image?.trim() || undefined,
            });
          }
        }

        const ownerBUnits = await getBUnitBalance(owner);
        const nextOnchainAdmins: OnchainAdminEntry[] = [];
        let didLoadOnchainAdmins = false;
        try {
          const [admins, metadatas, parents] = await card.getAdminListWithMetadata() as [string[], string[], string[]];
          didLoadOnchainAdmins = true;
          for (let i = 0; i < admins.length; i++) {
            const address = admins[i];
            const metadataRaw = metadatas[i] ?? '';
            const parent = parents[i] ?? ZERO_ADDRESS;
            const { title, subtitle } = summarizeAdminMetadata(metadataRaw);
            nextOnchainAdmins.push({
              address,
              metadata: metadataRaw,
              metadataTitle: title,
              metadataSubtitle: subtitle,
              parent,
              role: address.toLowerCase() === owner.toLowerCase()
                ? 'Owner'
                : parent.toLowerCase() === ZERO_ADDRESS.toLowerCase()
                  ? 'Direct Admin'
                  : 'Sub Admin',
            });
          }
        } catch {
          // Keep trusted cached admin directory when RPC query fails.
        }
        // Partner Locations = only direct admins under owner (parent=0), exclude sub-admins (second layer)
        const partnerLocations = didLoadOnchainAdmins
          ? nextOnchainAdmins.filter((a) => a.role === 'Direct Admin').length
          : 0;

        const nextPendingRedeemAdmins: PendingRedeemAdminEntry[] = [];
        let didLoadPendingRedeemAdmins = false;
        try {
          const hashes = await card.getRedeemAdminList() as string[];
          didLoadPendingRedeemAdmins = true;
          const statuses = await Promise.all(
            hashes.map(async (hash) => {
              try {
                const active = await card.getRedeemAdminStatus(hash) as boolean;
                return active ? 'Active' : 'Expired';
              } catch {
                return 'Active';
              }
            })
          );
          for (let i = 0; i < hashes.length; i++) {
            nextPendingRedeemAdmins.push({
              hash: hashes[i],
              status: statuses[i],
            });
          }
        } catch {
          // Keep trusted cached redeem-admin list when RPC query fails.
        }

        if (cancelled || requestId !== overviewFetchSeq.current) return;

        const nextOverviewMetrics = {
          totalNetworkVolumeCad: `$${formatWithThousands(totalNetworkVolumeCad, 0)}`,
          activeMemberships: formatWithThousands(Number(totalActiveMemberships), 0),
          partnerLocations: formatWithThousands(partnerLocations, 0),
          fuelPoolBUnits: ownerBUnits != null ? formatWithThousands(ownerBUnits, 0) : '—',
        };
        const nextIssuedCardSummary = {
          name: metadata?.name?.trim() || 'Issued Membership Card',
          totalSupply: formatWithThousands(Number(totalMembershipIssued), 0),
        };

        setOverviewMetrics(nextOverviewMetrics);
        setIssuedCardSummary(nextIssuedCardSummary);
        setTierAssets(tierAssetsList);
        if (didLoadOnchainAdmins) {
          setOnchainAdmins(nextOnchainAdmins);
          saveTrustedCache(onchainAdminsCacheKey, nextOnchainAdmins);
        }
        if (didLoadPendingRedeemAdmins || didLoadOnchainAdmins) {
          if (didLoadPendingRedeemAdmins) {
            setPendingRedeemAdmins(nextPendingRedeemAdmins);
            saveTrustedCache(pendingRedeemAdminsCacheKey, nextPendingRedeemAdmins);
          }
          // Sync local restaurants: remove entries that don't exist on chain
          const ownerLower = (owner || '').toLowerCase();
          const userEoa = (eoaAddress || '').toLowerCase();
          const userAa = (aaAddress ?? '').toLowerCase();
          if (ownerLower && (ownerLower === userEoa || ownerLower === userAa)) {
            const activeHashes = didLoadPendingRedeemAdmins
              ? new Set(
                  nextPendingRedeemAdmins
                    .filter((e) => e.status === 'Active')
                    .map((e) => (e.hash || '').toLowerCase())
                )
              : new Set<string>();

            // Build chain admin list under user (owner sees all; direct admin sees sub-admins)
            const adminsUnderUser = didLoadOnchainAdmins
              ? nextOnchainAdmins.filter((a) => {
                  const isOwner = ownerLower === userEoa || ownerLower === userAa;
                  if (isOwner) return a.role !== 'Owner'; // owner sees all non-owner admins
                  const p = (a.parent || '').toLowerCase();
                  return p === userEoa || p === userAa;
                })
              : [];

            // Build trusted list from chain: use address as unique ID, deduplicate, remove non-existent
            setLocalRestaurants((prev) => {
              const merged: LocalRestaurant[] = [];
              const seen = new Set<string>();
              if (didLoadOnchainAdmins) {
                for (const a of adminsUnderUser) {
                  const addr = a.address.toLowerCase();
                  if (seen.has(addr)) continue;
                  seen.add(addr);
                  const local = prev.find((r) => r.address?.toLowerCase() === addr);
                  let parsed: { restaurantName?: string; handle?: string; cuisine?: string; cityArea?: string } = {};
                  try {
                    parsed = a.metadata?.trim() ? (JSON.parse(a.metadata) as typeof parsed) : {};
                  } catch {
                    /* ignore */
                  }
                  merged.push({
                    id: addr,
                    name: local?.name ?? parsed?.restaurantName?.trim() ?? `0x${addr.slice(2, 6)}…${addr.slice(-4)}`,
                    cuisine: local?.cuisine ?? parsed?.cuisine?.trim() ?? '',
                    cityArea: local?.cityArea ?? parsed?.cityArea?.trim() ?? '',
                    handle: local?.handle ?? parsed?.handle?.trim() ?? '',
                    kybCode: local?.kybCode,
                    kybLink: local?.kybLink,
                    createdAt: local?.createdAt ?? Date.now(),
                    address: ethers.getAddress(a.address),
                  });
                }
              }
              // Keep pending KYB (not yet on chain): has kybCode and active hash
              if (didLoadPendingRedeemAdmins) {
                for (const r of prev) {
                  if (r.kybCode && !r.address) {
                    try {
                      const h = redeemCodeHash(r.kybCode, '').toLowerCase();
                      if (activeHashes.has(h)) merged.push(r);
                    } catch {
                      /* skip */
                    }
                  }
                }
              }
              if (!didLoadOnchainAdmins) {
                return prev;
              }
              const next = merged.length > 0 ? merged : prev.filter((r) => r.kybCode);
              try {
                window.localStorage.setItem(ALLIANCE_RESTAURANTS_KEY, JSON.stringify(next));
              } catch {
                /* ignore */
              }
              return next;
            });
          }
        }
        saveTrustedCache(overviewCacheKey, nextOverviewMetrics);
        saveTrustedCache(issuedCardSummaryCacheKey, nextIssuedCardSummary);
        saveTrustedCache(tierAssetsCacheKey, tierAssetsList);
      } catch {
        // Keep the last trusted cache/state when RPC fetch fails.
      }
    };

    loadOverviewMetrics();
    return () => {
      cancelled = true;
    };
  }, [eoaAddress, aaAddress, issuedCardSummaryCacheKey, onchainAdminsCacheKey, overviewCacheKey, pendingRedeemAdminsCacheKey, tierAssetsCacheKey, userCardContractAddress, overviewRefreshTrigger]);

  const [eoaUsdcBalance, setEoaUsdcBalance] = useState<string | null>(null);
  useEffect(() => {
    if (!eoaAddress) {
      setEoaUsdcBalance(null);
      return;
    }
    setEoaUsdcBalance(loadTrustedCache<string>(eoaUsdcBalanceCacheKey));

    const requestId = ++eoaBalanceFetchSeq.current;
    getBalance(eoaAddress)
      .then((balance) => {
        if (requestId !== eoaBalanceFetchSeq.current || balance?.usdc == null) return;
        setEoaUsdcBalance(balance.usdc);
        saveTrustedCache(eoaUsdcBalanceCacheKey, balance.usdc);
      })
      .catch(() => {
        // Keep the last trusted balance if the refresh fails.
      });
  }, [eoaAddress, eoaUsdcBalanceCacheKey]);

  const [aaUsdcBalance, setAaUsdcBalance] = useState<string | null>(null);
  const aaUsdcBalanceCacheKey = (aaAddress ?? eoaAddress)?.toLowerCase()
    ? `aa-usdc:${(aaAddress ?? eoaAddress)!.toLowerCase()}`
    : null;
  useEffect(() => {
    const addr = aaAddress ?? eoaAddress;
    if (!addr || addr === '—') {
      setAaUsdcBalance(null);
      return;
    }
    setAaUsdcBalance(loadTrustedCache<string>(aaUsdcBalanceCacheKey));

    const requestId = ++aaBalanceFetchSeq.current;
    getBalance(addr)
      .then((balance) => {
        if (requestId !== aaBalanceFetchSeq.current || balance?.usdc == null) return;
        setAaUsdcBalance(balance.usdc);
        saveTrustedCache(aaUsdcBalanceCacheKey, balance.usdc);
      })
      .catch(() => {
        // Keep the last trusted balance if the refresh fails.
      });
  }, [aaAddress, aaUsdcBalanceCacheKey, eoaAddress]);

  const [bUnitBalance, setBUnitBalance] = useState<string | null>(null);
  useEffect(() => {
    // B-Units are on CoNET and held by EOA (claimant); AA is on Base, use EOA only
    if (!eoaAddress) {
      setBUnitBalance(null);
      return;
    }
    setBUnitBalance(loadTrustedCache<string>(bUnitBalanceCacheKey));

    const requestId = ++bUnitBalanceFetchSeq.current;
    getBUnitBalance(eoaAddress)
      .then((balance) => {
        if (requestId !== bUnitBalanceFetchSeq.current || balance == null) return;
        setBUnitBalance(balance);
        saveTrustedCache(bUnitBalanceCacheKey, balance);
      })
      .catch(() => {
        // Keep the last trusted balance if the refresh fails.
      });
  }, [bUnitBalanceCacheKey, eoaAddress]);

  // 新增：处理结算申请的函数
  const handleApproveSettlement = (id: string) => {
    setSettlementRequests(prev => prev.filter(req => req.id !== id));
    // 在真实逻辑中，这里会触发 USDC 智能合约转账，或者生成 CAD 银行转账指令，并写入 Immutable Ledger
  };

  const handlePosPadClick = (val: string) => {
    if (val === 'backspace') { 
      setPosAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0'); 
      return; 
    }
    if (val === '.') { 
      if (posAmount.includes('.')) return; 
      setPosAmount(prev => prev + '.'); 
      return; 
    }
    setPosAmount(prev => {
      if (prev === '0') return val;
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      return prev + val;
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 selection:bg-[#96EB3C]/30 selection:text-slate-900 overflow-hidden">
      
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'}
          lg:relative lg:translate-x-0 ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className={`p-5 border-b border-slate-100 flex items-center justify-between ${isSidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => window.innerWidth >= 1024 && setIsSidebarCollapsed(!isSidebarCollapsed)}>
            <div className="w-10 h-10 bg-[#96EB3C] rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_4px_16px_rgba(150,235,60,0.4)] group-hover:bg-[#86d635] transition-colors">
              <span className="text-white font-black text-2xl">C</span>
            </div>
            {(!isSidebarCollapsed || isMobileMenuOpen) && (
              <div className="flex flex-col">
                <span className="font-black text-xl tracking-tighter text-slate-900 leading-none">CashTrees</span>
                <span className="text-[9px] font-bold text-[#7abf30] tracking-widest uppercase mt-1">Alliance OS</span>
              </div>
            )}
          </div>
          <button className="lg:hidden p-2 text-slate-400 hover:text-slate-800 bg-slate-100 rounded-full shrink-0" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto no-scrollbar">
          {(!isSidebarCollapsed || isMobileMenuOpen) && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-4">Command Center</div>}
          <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === 'Overview'} onClick={() => handleTabChange('Overview')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={CreditCard} label="Asset Factory" active={activeTab === 'Assets'} onClick={() => handleTabChange('Assets')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={Users} label="Members" active={activeTab === 'Members'} onClick={() => handleTabChange('Members')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={Utensils} label="Restaurants" active={activeTab === 'Merchants'} onClick={() => handleTabChange('Merchants')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={BookOpen} label="Ledger & Clearing" active={activeTab === 'Ledger'} onClick={() => handleTabChange('Ledger')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
          
          {(!isSidebarCollapsed || isMobileMenuOpen) && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-8">Financial Hub</div>}
          <SidebarItem icon={Wallet} label="Wallet & Treasury" active={activeTab === 'Treasury'} onClick={() => handleTabChange('Treasury')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
          
          {(!isSidebarCollapsed || isMobileMenuOpen) && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-8">System</div>}
          <SidebarItem icon={MessageSquare} label="Chat" active={activeTab === 'Chat'} onClick={() => handleTabChange('Chat')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
          <SidebarItem icon={ShieldCheck} label="Audit Logs" active={activeTab === 'Audit'} onClick={() => handleTabChange('Audit')} collapsed={isSidebarCollapsed && !isMobileMenuOpen} />
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          {(!isSidebarCollapsed || isMobileMenuOpen) ? (
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg italic">B</span>
                </div>
                <div>
                   <div className="text-[10px] text-slate-400 font-medium">Infrastructure by</div>
                   <div className="text-xs font-bold text-slate-700">Beamio Protocol</div>
                   <div className="text-[10px] text-slate-400">v{APP_VERSION}</div>
                </div>
             </div>
          ) : (
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mx-auto">
               <span className="text-white font-bold text-lg italic">B</span>
             </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col transition-all duration-300 min-w-0 ml-0">
        
        {/* Header */}
        {activeTab !== 'Chat' && activeTab !== 'POS' && (
          <header className="p-4 sm:p-8 pb-4 flex justify-between items-end">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu size={24} />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">{activeTab === 'Ledger' ? '$CTree Ledger & Clearing' : activeTab}</h1>
                {activeTab === 'Overview' && (
                  <button
                    onClick={handleOverviewRefresh}
                    disabled={overviewRefreshing}
                    className="flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-[#96EB3C] hover:bg-[#96EB3C]/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                    title="Refresh from chain"
                    aria-label="Refresh overview from chain"
                  >
                    <RefreshCw size={20} className={overviewRefreshing ? 'animate-spin' : ''} />
                  </button>
                )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                <span className="bg-[#96EB3C]/20 text-[#548a1b] text-xs font-bold px-2 py-1 rounded-md">Fiat Anchor: CAD</span>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleCopyContract}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCopyContract(); }}
                  className={`flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-600 font-mono text-xs shadow-sm cursor-pointer hover:bg-slate-50 transition-colors ${!userCardContractAddress ? 'cursor-default hover:bg-white' : ''}`}
                  title={userCardContractAddress ?? undefined}
                >
                    <FileText size={12} className="text-slate-400"/>
                    <span>Contract: {userCardContractAddress ? shortenAddress(userCardContractAddress) : '—'}</span>
                    {userCardContractAddress && (
                      <span className={`ml-0.5 inline-flex transition-all duration-200 ${contractCopied ? 'scale-110' : ''}`}>
                        {contractCopied ? <Check size={12} className="text-[#96EB3C]" /> : <Copy size={12} className="text-slate-400" />}
                      </span>
                    )}
                </div>
                </div>
              </div>
            </div>
            {activeTab === 'Merchants' && (
              <button onClick={() => setIsMerchantModalOpen(true)} className="flex items-center space-x-2 px-5 py-2.5 bg-[#96EB3C] text-slate-900 rounded-xl text-sm font-bold hover:bg-[#86d635] shadow-[0_4px_16px_rgba(150,235,60,0.3)]">
                <Utensils size={16} /><span>Onboard Restaurant</span>
              </button>
            )}
            {activeTab === 'Assets' && (
              <button className="flex items-center space-x-2 px-5 py-2.5 bg-[#96EB3C] text-slate-900 rounded-xl text-sm font-bold hover:bg-[#86d635] shadow-[0_4px_16px_rgba(150,235,60,0.3)]">
                <Plus size={16} /><span>New Asset</span>
              </button>
            )}
          </header>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-4">
            
            {/* --- OVERVIEW --- */}
            {activeTab === 'Overview' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard title="All-Time Volume" value={overviewMetrics.totalNetworkVolumeCad} subValue="Total Network Volume (CAD)" change="Live" isPositive={true} icon={<Activity size={24} />} />
                  <MetricCard title="Active Memberships" value={overviewMetrics.activeMemberships} subValue="Green & Black Cards" change="Live" isPositive={true} icon={<CreditCard size={24} />} colorClass="bg-blue-50 text-blue-600" />
                  <MetricCard title="Partner Locations" value={overviewMetrics.partnerLocations} subValue="Verified restaurants" change="Live" isPositive={true} icon={<Utensils size={24} />} colorClass="bg-purple-50 text-purple-600" />
                  <MetricCard
                    title="CashTrees Fuel Pool"
                    value={overviewMetrics.fuelPoolBUnits}
                    subValue="B-Units for Mint/Top-ups"
                    change="Live"
                    isPositive={true}
                    icon={<Zap size={24} />}
                    colorClass="bg-orange-50 text-orange-600"
                    bottomRightAction={
                      <button
                        onClick={() => { setIsFuelModalOpen(true); setRefuelError(null); setRefuelSuccess(null); }}
                        className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 active:scale-95 transition-all"
                        title="Purchase B-Units"
                      >
                        <Fuel size={20} fill="currentColor" />
                      </button>
                    }
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="font-bold text-lg text-slate-800">Live Network Activity</h2>
                        <button onClick={() => setActiveTab('Ledger')} className="text-sm font-bold text-[#82cc33] hover:text-[#6ea32b] hover:underline">View Ledger</button>
                      </div>
                      <ActiveHistoryPannelNew title="Live Network Activity" compact compactLimit={10} bare embeddedInDrawer filterByCardAddress={FIXED_USER_CARD_CONTRACT_ADDRESS} ledgerLayout onNewTransactionIndexed={handleNewTransactionIndexed} />
                   </div>
                   
                   <div className="bg-slate-900 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden flex flex-col">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#96EB3C]/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                      <h2 className="font-bold text-lg mb-6 relative z-10 flex items-center gap-2"><ShieldAlert size={20} className="text-[#96EB3C]"/> System Health</h2>
                      
                      <div className="space-y-5 relative z-10 flex-1">
                         <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-[#96EB3C] animate-pulse"></div>
                               <span className="text-sm font-medium text-slate-200">EOA Signer Nodes</span>
                            </div>
                            <span className="text-xs font-bold text-[#96EB3C]">Online</span>
                         </div>
                         
                         <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-[#96EB3C] animate-pulse"></div>
                               <span className="text-sm font-medium text-slate-200">AA Contracts</span>
                            </div>
                            <span className="text-xs font-bold text-[#96EB3C]">Active</span>
                         </div>
                         
                         <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-[#96EB3C] animate-pulse"></div>
                               <span className="text-sm font-medium text-slate-200">USDC Liquidity</span>
                            </div>
                            <span className="text-xs font-bold text-[#96EB3C]">Stable</span>
                         </div>

                         <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                            <span className="text-xs text-slate-400">Restaurants KYB</span>
                            <span className="text-xs font-bold text-white">2 Verified</span>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* --- TREASURY --- */}
            {activeTab === 'Treasury' && (
              <div className="max-w-5xl space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                 
                 {/* Wallet Identity Card */}
                 <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">CashTrees Core Wallet</h3>
                        <p className="text-sm text-slate-500 mt-1">Multisig and Account Abstraction Identity on the Beamio Network</p>
                        <div className="mt-5 space-y-3">
                            <div className="flex items-center gap-2">
                               <BadgeCheck size={18} className="text-[#96EB3C]"/>
                               <span className="font-bold text-slate-700 w-24">BeamioTag:</span> 
                               <span className="bg-[#96EB3C]/20 text-[#548a1b] px-3 py-1 rounded-md text-sm font-mono font-bold">{beamioTag ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <Wallet size={18} className="text-slate-400"/>
                               <span className="font-bold text-slate-700 w-24">EOA Wallet:</span> 
                               <span className="text-slate-500 font-mono text-sm bg-slate-50 px-3 py-1 rounded-md border border-slate-100" title={eoaAddress ?? undefined}>{eoaAddress ? shortenAddress(eoaAddress) : '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <Cpu size={18} className="text-blue-500"/>
                               <span className="font-bold text-slate-700 w-24">AA Smart Acc:</span> 
                               <span className="text-slate-500 font-mono text-sm bg-slate-50 px-3 py-1 rounded-md border border-slate-100" title={aaAddress ?? eoaAddress ?? undefined}>{deployedContractAddress !== '—' ? shortenAddress(deployedContractAddress) : '—'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-8 h-8 rounded-full bg-[#96EB3C]/20 text-[#6ea32b] flex items-center justify-center font-bold">CT</div>
                           <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{issuedCardSummary.name}</span>
                        </div>
                        <div className="text-4xl font-black text-slate-900 tracking-tight">{issuedCardSummary.totalSupply} <span className="text-lg text-slate-400 font-bold">$CashTrees</span></div>
                        <div className="text-xs font-bold text-[#6ea32b] mt-2 bg-[#96EB3C]/10 px-3 py-1 rounded-full border border-[#96EB3C]/30">Total Membership Supply</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* EOA Wallet */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col">
                       <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center"><Key size={24}/></div>
                          <div>
                             <h3 className="font-bold text-lg text-slate-900">Signer EOA Wallet</h3>
                             <p className="text-xs text-slate-500">Hardware-secured owner address</p>
                          </div>
                       </div>
                       <div className="space-y-4 flex-1">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Address</div>
                             <div className="font-mono text-sm text-slate-700" title={eoaAddress ?? undefined}>{eoaAddress ? shortenAddress(eoaAddress) : '—'}</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                             <div>
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Role & Authority</div>
                                 <div className="font-bold text-sm text-slate-700">Primary Signer (1/1)</div>
                             </div>
                             <CheckCircle2 size={20} className="text-[#96EB3C]"/>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Wallet Assets</div>
                             <div className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                <Coins size={18} className="text-blue-500"/>
                                {eoaUsdcBalance != null ? formatWithThousands(eoaUsdcBalance) : '—'} <span className="text-sm text-slate-500 font-medium">USDC</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* AA Smart Account */}
                    <div className="bg-slate-900 rounded-3xl shadow-xl p-8 flex flex-col text-white relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-48 h-48 bg-[#96EB3C]/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                       <div className="flex items-center gap-4 mb-6 relative z-10">
                          <div className="w-12 h-12 bg-[#96EB3C]/20 text-[#96EB3C] rounded-2xl flex items-center justify-center"><Cpu size={24}/></div>
                          <div>
                             <h3 className="font-bold text-lg text-white">AA Smart Account</h3>
                             <p className="text-xs text-slate-400">ERC-4337 Programmable Vault</p>
                          </div>
                       </div>
                       <div className="space-y-4 flex-1 relative z-10">
                          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contract Address</div>
                             <div className="font-mono text-sm text-[#96EB3C]" title={aaAddress ?? eoaAddress ?? undefined}>{deployedContractAddress !== '—' ? shortenAddress(deployedContractAddress) : '—'}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Paymaster</div>
                                 <div className="font-bold text-sm text-white flex items-center gap-1.5"><Zap size={14} className="text-amber-400"/> Sponsored</div>
                             </div>
                             <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bundler</div>
                                 <div className="font-bold text-sm text-white flex items-center gap-1.5"><Layers size={14} className="text-blue-400"/> Active</div>
                             </div>
                          </div>
                          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Smart Account Assets</div>
                             <div className="font-bold text-2xl text-white flex items-center gap-2">
                                <Coins size={24} className="text-blue-400"/>
                                {aaUsdcBalance != null ? formatWithThousands(aaUsdcBalance) : '—'} <span className="text-sm text-slate-400 font-medium">USDC</span>
                             </div>
                             <div className="text-[10px] text-[#96EB3C] mt-2 flex items-center gap-1">
                                <Download size={12}/> Automatically receives USDC from In-App purchases
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><Zap size={24}/></div>
                       <div>
                          <h3 className="font-bold text-slate-900">CashTrees Fuel Pool (B-Units)</h3>
                          <p className="text-xs text-slate-500">Platform pays 99 B-Units per Mint & 2 B-Units per Top-up. <strong className="text-slate-700">Merchants bear the 0.8% TX fee.</strong></p>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-2xl font-black text-slate-900">{bUnitBalance != null ? formatWithThousands(bUnitBalance, 0) : '—'} <span className="text-sm text-slate-400 font-bold">Units</span></div>
                       <div className="text-xs text-slate-400 mt-1 font-mono">{bUnitBalance != null ? `≈ $${formatWithThousands(Number(bUnitBalance) / 100, 2)} USDC` : '—'}</div>
                    </div>
                    <button className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl">Recharge Pool</button>
                 </div>
              </div>
            )}

            {/* --- MERCHANTS (RESTAURANTS) --- */}
            {activeTab === 'Merchants' && (
              <div className="space-y-6 animate-in fade-in">
                 {/* Restaurant Alliance Metrics */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                       <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center"><Utensils size={24}/></div>
                       <div>
                          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Network Partners</div>
                          <div className="text-2xl font-black text-slate-900">{formatWithThousands(onchainAdmins.filter((item) => item.role !== 'Owner').length, 0)} <span className="text-sm text-slate-500 font-medium">Admins</span></div>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                       <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><Users size={24}/></div>
                       <div>
                          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Linked Diners</div>
                          <div className="text-2xl font-black text-slate-900">{overviewMetrics.activeMemberships} <span className="text-sm text-slate-500 font-medium">Active Cards</span></div>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                       <div className="w-12 h-12 bg-[#96EB3C]/20 text-[#6ea32b] rounded-xl flex items-center justify-center"><Receipt size={24}/></div>
                       <div>
                          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">Avg. Ticket Size</div>
                          <div className="text-2xl font-black text-slate-900">$30.25 <span className="text-sm text-slate-500 font-medium">CAD</span></div>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input type="text" placeholder="Search restaurants or locations..." className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#96EB3C]/30 focus:border-[#96EB3C]/50 w-80 shadow-sm" />
                    </div>
                 </div>


                 <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                       <div>
                          <h3 className="text-lg font-black text-slate-900">Pending Redeem Admins</h3>
                          <p className="text-xs text-slate-500 mt-1">Unconsumed redeem-admin hashes currently stored on-chain.</p>
                       </div>
                       <div className="text-sm font-bold text-slate-500">{formatWithThousands(pendingRedeemAdmins.length, 0)} pending</div>
                    </div>
                    <table className="w-full">
                       <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                             <th className="px-6 py-4">Redeem Hash</th>
                             <th className="px-6 py-4">Status</th>
                             <th className="px-6 py-4 text-right">Notes</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {pendingRedeemAdmins.length > 0 ? pendingRedeemAdmins.map((item) => (
                            <tr key={item.hash} className="hover:bg-slate-50 transition-colors">
                               <td className="px-6 py-4">
                                  <div className="font-mono text-sm font-bold text-slate-900">{shortenAddress(item.hash, 12, 8)}</div>
                                  <div className="text-[10px] text-slate-400 mt-1 break-all">{item.hash}</div>
                               </td>
                               <td className="px-6 py-4">
                                  <StatusBadge status={item.status} />
                               </td>
                               <td className="px-6 py-4 text-right text-[11px] text-slate-500">
                                  Metadata is not exposed by the current card getter.
                               </td>
                            </tr>
                          )) : (
                            <tr>
                               <td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-400">No pending redeem-admin hashes.</td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>

                 <div className="bg-white border border-black/[0.04] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
                    <div className="px-6 py-5 border-b border-black/[0.04] flex items-center justify-between">
                       <div>
                          <h3 className="text-lg font-black text-slate-900">Saved Restaurant Drafts</h3>
                          <p className="text-xs text-slate-500 mt-1">Local draft entries created from this dashboard.</p>
                       </div>
                       <div className="text-sm font-bold text-slate-500">{formatWithThousands(localRestaurants.length, 0)} saved</div>
                    </div>
                    <table className="w-full">
                       <thead>
                          <tr className="bg-slate-50/50 border-b border-black/[0.04] text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                             <th className="px-6 py-5">Restaurant & Location</th>
                             <th className="px-6 py-5">Cardholders</th>
                             <th className="px-6 py-5 text-right">Unsettled $CTree (Rev)</th>
                             <th className="px-6 py-5 text-right bg-slate-50">Unsettled Fiat (Offline)</th>
                             <th className="px-6 py-5">Mint Quota & Risk</th>
                             <th className="px-6 py-5">B-Units Balance</th>
                             <th className="px-6 py-5 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-black/[0.02]">
                          {localRestaurants.map((r) => {
                             const rev = r.volume != null ? parseFloat(r.volume) : 0;
                             const fiat = r.fiatCollected != null ? parseFloat(r.fiatCollected) : 0;
                             const owedToAlliance = r.mintQuota != null ? Math.max(0, fiat - rev) : 0;
                             const quotaUsage = r.mintQuota != null && r.mintQuota > 0 ? (owedToAlliance / r.mintQuota) * 100 : 0;
                             const isHighRisk = r.mintQuota != null && quotaUsage > 80;
                             const bUnits = r.bUnitsBalance ?? 0;
                             const hasChainData = r.volume != null || r.fiatCollected != null || r.mintQuota != null;

                             return (
                             <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-5">
                                   <div className="flex items-center gap-4">
                                      <img src={r.logo || 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&h=100&fit=crop'} alt="" className="w-12 h-12 rounded-[14px] bg-slate-200 object-cover border border-black/[0.05] shadow-sm" />
                                      <div>
                                         <div className="font-bold text-[15px] text-slate-900">{r.name}</div>
                                         <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 font-medium">
                                            <MapPin size={12} className="text-slate-400"/> {r.cityArea || '—'}
                                         </div>
                                         {r.cuisine && (
                                           <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium mt-1 inline-block">{r.cuisine}</span>
                                         )}
                                         {r.handle && (
                                           <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.handle}</div>
                                         )}
                                         {!hasChainData && (
                                           <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#96EB3C]/20 text-[#548a1b] font-bold uppercase mt-1 inline-block">Saved</span>
                                         )}
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-5">
                                   <div className="flex items-center gap-1.5 text-[15px] font-bold text-slate-700">
                                      <Users size={16} className="text-[#1562f0]"/> {r.activeMembers ?? 0}
                                   </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <div className="font-bold text-[16px] text-emerald-600">{hasChainData && r.volume != null ? `$${r.volume}` : '—'}</div>
                                </td>
                                <td className="px-6 py-5 text-right bg-slate-50/50">
                                   <div className="font-bold text-[16px] text-slate-800">{hasChainData && r.fiatCollected != null ? `$${r.fiatCollected}` : '—'}</div>
                                </td>
                                <td className="px-6 py-5">
                                   <div className="w-full max-w-[150px]">
                                      <div className="flex justify-between text-[11px] font-bold mb-1.5">
                                         <span className="text-slate-500">Usage: {r.mintQuota != null ? `${quotaUsage.toFixed(1)}%` : '—'}</span>
                                         <span className="text-slate-400">Limit: {r.mintQuota != null ? `${r.mintQuota / 1000}k` : '—'}</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                         <div className={`h-full transition-all duration-500 ${isHighRisk ? 'bg-rose-500' : 'bg-[#96EB3C]'}`} style={{ width: `${Math.min(100, quotaUsage)}%` }}></div>
                                      </div>
                                      {isHighRisk && (
                                         <div className="mt-2 inline-flex items-center gap-1 bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                                            <Ban size={12}/> Minting Suspended
                                         </div>
                                      )}
                                   </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-2">
                                        <Zap size={16} className={bUnits < 50 && hasChainData ? 'text-rose-500' : 'text-orange-500'} />
                                        <span className={`font-mono font-bold text-[15px] ${bUnits < 50 && hasChainData ? 'text-rose-600' : 'text-slate-700'}`}>
                                            {hasChainData ? bUnits : '—'}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium mt-1">
                                        Bears 0.8% fee per dining TX
                                    </div>
                                    {bUnits < 50 && hasChainData && (
                                        <div className="text-[10px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 bg-rose-50 px-2 py-0.5 w-max rounded-md">
                                            <AlertTriangle size={10}/> Low Fuel Warning
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {r.kybLink && (
                                      <a href={r.kybLink} target="_blank" rel="noopener noreferrer" className="text-[#82cc33] hover:text-[#6ea32b] text-sm font-medium" title="KYB Link">KYB</a>
                                    )}
                                    <button className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-[#96EB3C]/20 hover:text-[#7abf30] text-slate-700 px-4 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors active:scale-95">
                                      <SlidersHorizontal size={14}/> Manage
                                    </button>
                                  </div>
                                </td>
                             </tr>
                          )})}
                       </tbody>
                    </table>
                 </div>
              </div>
            )}

            {/* --- MEMBERS --- */}
            {activeTab === 'Members' && (
              <div className="space-y-6 animate-in fade-in">
                 
                 {/* Members Metrics */}
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Users size={16}/></div>
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Members</span>
                       </div>
                       <div className="text-2xl font-black text-slate-900">1,695</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center"><CreditCard size={16}/></div>
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Black VIP</span>
                       </div>
                       <div className="text-2xl font-black text-slate-900">275 <span className="text-sm text-slate-500 font-medium">Cards</span></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-[#96EB3C]/20 text-[#6ea32b] rounded-lg flex items-center justify-center"><CreditCard size={16}/></div>
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Green Cards</span>
                       </div>
                       <div className="text-2xl font-black text-slate-900">1,420 <span className="text-sm text-slate-500 font-medium">Cards</span></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><Wallet size={16}/></div>
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Balances</span>
                       </div>
                       <div className="text-2xl font-black text-slate-900">$85,400 <span className="text-sm text-slate-500 font-medium">CAD</span></div>
                    </div>
                 </div>

                 <div className="flex items-center justify-between gap-4">
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input type="text" placeholder="Search by handle or AA address..." className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-[#96EB3C]/30 focus:border-[#96EB3C]/50 w-80 shadow-sm" />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm">
                       <Filter size={16}/> Filter by Tier
                    </button>
                 </div>

                 <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <table className="w-full">
                       <thead>
                          <tr className="bg-slate-50/80 border-b border-slate-100 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                             <th className="px-6 py-4">Member</th>
                             <th className="px-6 py-4">AA Smart Account</th>
                             <th className="px-6 py-4">Card Tier</th>
                             <th className="px-6 py-4 text-right">Balance</th>
                             <th className="px-6 py-4">Status</th>
                             <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {initialMembers.map((member) => (
                             <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                   <div className="flex items-center gap-3">
                                      <img src={member.avatar} alt="" className="w-10 h-10 rounded-full border border-slate-200" />
                                      <div>
                                         <div className="font-bold text-sm text-slate-900">{member.name}</div>
                                         <div className="text-[10px] text-slate-500 font-medium">{member.beamioHandle}</div>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                   <div className="font-mono text-xs text-slate-500 flex items-center gap-1.5">
                                      <Cpu size={12} className="text-slate-400"/> {member.smartAccount}
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                   <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                                      member.tier === 'Black VIP Card' 
                                      ? 'bg-slate-900 text-amber-400 border border-slate-800' 
                                      : 'bg-[#96EB3C]/20 text-[#5a961d] border border-[#96EB3C]/30'
                                   }`}>
                                      {member.tier}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <div className="font-bold text-slate-900">${member.balance}</div>
                                   <div className="text-[10px] text-slate-400 font-medium">{member.currency}</div>
                                </td>
                                <td className="px-6 py-4"><StatusBadge status={member.status} /></td>
                                <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-[#82cc33]"><Settings size={18}/></button></td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
            )}

            {/* --- ASSETS --- */}
            {activeTab === 'Assets' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="mb-6">
                   <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">CashTrees NFT Assets</h2>
                   <p className="text-[15px] text-slate-500 mt-2 font-medium max-w-4xl leading-relaxed">ERC-1155 Dynamic Allocation: User cards are minted based on top-up amounts. The <strong className="text-slate-700">Partner Card</strong> is a Merchant License NFT granting the authority to accept $CTree payments and process offline mints/top-ups.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {tierAssets.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="font-medium">No tier metadata available yet.</p>
                      <p className="text-sm mt-1">Tier cards will appear once the issued card has tiers configured on-chain and metadata is loaded.</p>
                    </div>
                  )}
                  {[...tierAssets, PARTNER_CARD_ASSET].map(asset => {
                    const useLightText = isBackgroundDark(asset.color);
                    return (
                    <div
                      key={asset.id}
                      className={`rounded-[32px] p-8 shadow-[0_16px_40px_rgba(0,0,0,0.1)] relative overflow-hidden transition-transform duration-300 hover:-translate-y-1.5 ${asset.color.startsWith('#') ? '' : asset.color}`}
                      style={asset.color.startsWith('#') ? { backgroundColor: asset.color } : undefined}
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                      <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                      
                      <div className="relative z-10 flex justify-between items-start mb-14">
                        <div className={`w-14 h-14 rounded-[18px] bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner overflow-hidden ${useLightText ? 'text-white' : 'text-slate-900'}`}>
                          {asset.image ? (
                            <img src={asset.image} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <CreditCard size={28} strokeWidth={2} />
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                           <StatusBadge status={asset.status} />
                           <div className={`mt-3 text-[11px] font-bold bg-black/10 px-3 py-1.5 rounded-[10px] border border-black/5 uppercase tracking-widest ${useLightText ? 'text-white/90' : 'text-slate-800'}`}>
                              Threshold: {asset.minTopUp}
                           </div>
                        </div>
                      </div>
                      
                      <div className="relative z-10">
                        <p className={`text-[13px] font-bold tracking-widest uppercase mb-1.5 ${useLightText ? 'text-white/80' : 'text-slate-700'}`}>{asset.type}</p>
                        <h3 className={`font-black text-3xl tracking-tight mb-8 leading-tight ${useLightText ? 'text-white' : 'text-slate-900'}`}>{asset.name}</h3>
                        
                        <div className={`backdrop-blur-md rounded-[24px] p-6 border shadow-inner ${useLightText ? 'bg-black/10 border-black/5' : 'bg-black/5 border-black/5'}`}>
                           <div className="flex justify-between items-end mb-4">
                             <div>
                               <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${useLightText ? 'text-white/60' : 'text-slate-600'}`}>Mint Rule</div>
                               <div className={`font-extrabold text-[15px] ${useLightText ? 'text-white' : 'text-slate-800'}`}>{asset.mintRule} <span className="font-mono ml-1.5">{asset.minTopUp}</span></div>
                             </div>
                             <div className="text-right">
                                <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${useLightText ? 'text-white/60' : 'text-slate-600'}`}>Circulation</div>
                                <div className={`font-bold text-[13px] ${useLightText ? 'text-white' : 'text-slate-800'}`}>{asset.activeHolders} Active <span className="mx-1 opacity-50">/</span> {asset.minted} Minted</div>
                             </div>
                           </div>
                           <div className={`w-full h-2 rounded-full overflow-hidden mt-3 ${useLightText ? 'bg-white/20' : 'bg-black/20'}`}>
                             <div 
                               className={`h-full rounded-full relative ${useLightText ? 'bg-white' : 'bg-slate-800'}`} 
                               style={{ width: `${asset.minted > 0 ? (asset.activeHolders / asset.minted) * 100 : 0}%` }}
                             >
                                <div className={`absolute right-0 top-0 bottom-0 w-6 animate-pulse ${useLightText ? 'bg-white/50' : 'bg-white/30'}`}></div>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  );})}
                </div>
                
                {/* Acquisition & Top-up Channels */}
                <div className="mt-12 bg-white rounded-[32px] border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-10">
                    <h3 className="text-xl font-extrabold text-slate-900 mb-8 flex items-center gap-2.5 tracking-tight"><ArrowUpRight className="text-[#96EB3C]" strokeWidth={3}/> Acquisition & Top-up Channels</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="p-8 bg-[#F5F5F7] rounded-[24px] border border-black/[0.03]">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-[16px] bg-[#1562f0]/10 text-[#1562f0] flex items-center justify-center shadow-inner"><Globe size={24}/></div>
                                <h4 className="font-extrabold text-lg text-slate-900">Online (In-App)</h4>
                            </div>
                            <ul className="space-y-4 text-[14px] text-slate-600 font-medium">
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#1562f0] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Payment Currency:</strong> USDC (Web3 Native).</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#1562f0] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Card Balance Base:</strong> CAD (1 $CTree = 1 CAD).</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#1562f0] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Oracle Logic:</strong> Uses <strong className="text-[#1562f0]">Coinbase Oracle</strong> to fetch real-time USDC/CAD rates. Exact USDC is deposited to the AA Smart Account, and equivalent <strong className="text-slate-800">$CTree</strong> balance is minted.</span></li>
                            </ul>
                        </div>
                        <div className="p-8 bg-[#F5F5F7] rounded-[24px] border border-black/[0.03]">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-[16px] bg-[#96EB3C]/20 text-[#6ea32b] flex items-center justify-center shadow-inner"><Store size={24}/></div>
                                <h4 className="font-extrabold text-lg text-slate-900">Offline (Physical Stores)</h4>
                            </div>
                            <ul className="space-y-4 text-[14px] text-slate-600 font-medium">
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#82cc33] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Supported Currency:</strong> CAD (Fiat).</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#82cc33] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Hardware / Access:</strong> NFC 424 DNA physical cards or the Beamio APP.</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#82cc33] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Example Flow:</strong> A consumer pays 50 CAD at a store POS, taps their NFC card, and instantly mints a Green Card securely tied to their Smart Account. Fiat remains with the merchant pending future clearing.</span></li>
                            </ul>
                        </div>
                    </div>
                </div>

              </div>
            )}

            {/* --- LEDGER & CLEARING (Replaces Distributions) --- */}
            {activeTab === 'Ledger' && (
              <div className="space-y-6 animate-in fade-in">
                 
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <h2 className="text-xl font-black text-slate-900">Network Ledger & Clearing Matrix</h2>
                     <p className="text-sm text-slate-500 mt-1">Real-time tracking of $CTree lifecycle and automated merchant settlement calculations.</p>
                   </div>
                   <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-lg">
                      <Zap className="text-amber-400" size={20}/>
                      <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">CashTrees Fuel Pool</div>
                         <div className="font-black text-xl leading-none">845,000 <span className="text-xs font-normal text-slate-400">B-Units</span></div>
                         <div className="text-[9px] text-[#96EB3C] mt-1">Platform pays for Mint/Top-ups only</div>
                      </div>
                   </div>
                 </div>

                 {/* 1. Pending Settlement Requests (新增结算申请看板) */}
                 {settlementRequests.length > 0 && (
                 <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden mb-8">
                    <div className="p-6 border-b border-amber-100 bg-amber-50/30 flex justify-between items-center">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                             <Clock size={16}/>
                          </div>
                          <div>
                             <h3 className="font-bold text-slate-900">Pending Settlement Requests</h3>
                             <p className="text-[10px] text-slate-500">Restaurants requesting to burn $CTree for payout.</p>
                          </div>
                       </div>
                       <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                          {settlementRequests.length} Pending
                       </span>
                    </div>
                    <table className="w-full">
                       <thead>
                          <tr className="border-b border-slate-100 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                             <th className="px-6 py-4">Request ID & Time</th>
                             <th className="px-6 py-4">Restaurant</th>
                             <th className="px-6 py-4 text-right">Amount to Settle</th>
                             <th className="px-6 py-4">Payout Route</th>
                             <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {settlementRequests.map(req => (
                             <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                   <div className="font-mono text-sm font-bold text-slate-700">{req.id}</div>
                                   <div className="text-[10px] text-slate-400 mt-1">{req.time}</div>
                                </td>
                                <td className="px-6 py-4">
                                   <div className="font-bold text-slate-900">{req.merchant}</div>
                                   <div className="text-[10px] text-slate-500">{req.location}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <div className="font-mono font-black text-slate-900 text-lg">${req.amount}</div>
                                   <div className="text-[10px] text-amber-600 font-medium flex items-center justify-end gap-1 mt-1">
                                      <Zap size={10}/> Burn Fee: {req.requiredGas}
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                   {req.method === 'USDC' ? (
                                      <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
                                         <Coins size={14} className="text-blue-500"/>
                                         <div>
                                            <div className="text-xs font-bold text-blue-700">USDC Web3 Transfer</div>
                                            <div className="text-[10px] font-bold text-blue-500 mt-0.5">SLA: {req.timeline} (Instant)</div>
                                         </div>
                                      </div>
                                   ) : (
                                      <div className="inline-flex items-center gap-2 bg-[#96EB3C]/10 border border-[#96EB3C]/20 px-3 py-1.5 rounded-lg">
                                         <Banknote size={14} className="text-[#6ea32b]"/>
                                         <div>
                                            <div className="text-xs font-bold text-[#548a1b]">CAD Bank Wire</div>
                                            <div className="text-[10px] font-bold text-[#6ea32b] mt-0.5">SLA: {req.timeline} (Next Biz Day)</div>
                                         </div>
                                      </div>
                                   )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <button 
                                      onClick={() => handleApproveSettlement(req.id)}
                                      className="inline-flex items-center gap-1.5 bg-[#96EB3C] hover:bg-[#86d635] text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-[0_4px_12px_rgba(150,235,60,0.3)] active:scale-95"
                                   >
                                      <Check size={16}/> Approve
                                   </button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 )}

                 {/* Clearing Matrix (The core of the business logic) */}
                 <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-8 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                       <Calculator className="text-[#6ea32b]" size={24}/>
                       <h3 className="text-lg font-bold text-slate-900">Merchant Clearing Matrix</h3>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full">
                          <thead>
                             <tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <th className="pb-4 pl-4">Restaurant</th>
                                <th className="pb-4 text-right">Dining Revenue ($CTree)</th>
                                <th className="pb-4 text-center px-4">-</th>
                                <th className="pb-4 text-right">Fiat Collected (Offline Mints)</th>
                                <th className="pb-4 text-center px-4">=</th>
                                <th className="pb-4 text-right pr-4">Net Settlement Due (CAD)</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {initialMerchants.map(m => {
                                const rev = parseFloat(m.volume);
                                const collected = parseFloat(m.fiatCollected);
                                const net = rev - collected;
                                return (
                                <tr key={m.id} className="hover:bg-slate-50">
                                   <td className="py-5 pl-4 font-bold text-slate-900">{m.name} <span className="text-[10px] text-slate-400 block font-normal">{m.location}</span></td>
                                   <td className="py-5 text-right font-mono font-bold text-slate-700">${m.volume}</td>
                                   <td className="py-5 text-center text-slate-300">-</td>
                                   <td className="py-5 text-right font-mono font-bold text-rose-600">${m.fiatCollected}</td>
                                   <td className="py-5 text-center text-slate-300">=</td>
                                   <td className="py-5 text-right pr-4">
                                      <div className={`font-mono font-black text-lg ${net > 0 ? 'text-[#96EB3C]' : 'text-rose-600'}`}>
                                         ${Math.abs(net).toFixed(2)}
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                                         {net > 0 ? 'CashTrees Pays Merchant' : 'Merchant Owes CashTrees'}
                                      </div>
                                   </td>
                                </tr>
                                )
                             })}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 {/* Transaction Ledger */}
                 <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                       <h3 className="font-bold text-slate-900">$CTree Immutable Ledger</h3>
                       <div className="flex gap-2">
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Sparkles size={12}/> Mint</span>
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><ArrowRightLeft size={12}/> Transfer</span>
                          <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1"><Flame size={12}/> Burn</span>
                       </div>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full">
                          <thead>
                             <tr className="bg-white border-b border-slate-100 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                <th className="px-6 py-4">TX ID / Action</th>
                                <th className="px-6 py-4">From ➔ To</th>
                                <th className="px-6 py-4">Device</th>
                                <th className="px-6 py-4">Tx Hash</th>
                                <th className="px-6 py-4 text-right">Amount ($CTree)</th>
                                <th className="px-6 py-4 text-right">Gas Paid By</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {ledgerTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                   <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="font-mono text-xs text-slate-400 mb-1">{tx.id} <span className="text-slate-300 ml-2">{tx.time}</span></div>
                                      <StatusBadge status={tx.type} />
                                      <div className="text-[10px] font-medium text-slate-600 mt-1 max-w-[180px] truncate" title={tx.note}>{tx.note}</div>
                                   </td>
                                   <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="font-bold text-sm text-slate-700 truncate max-w-[150px]" title={tx.from}>{tx.from}</div>
                                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]" title={tx.to}>➔ {tx.to}</div>
                                   </td>
                                   <td className="px-6 py-4">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg w-max">
                                         {tx.device === 'NFC Card' ? <Nfc size={14} className="text-blue-500"/> : tx.device === 'Beamio APP' ? <Smartphone size={14} className="text-[#96EB3C]"/> : <Globe size={14} className="text-slate-400"/>}
                                         {tx.device}
                                      </div>
                                   </td>
                                   <td className="px-6 py-4">
                                      <div className="flex items-center gap-1.5 text-xs font-mono text-[#82cc33] hover:text-[#6ea32b] cursor-pointer w-max bg-[#96EB3C]/10 px-2 py-1 rounded border border-[#96EB3C]/20">
                                         {tx.txHash} <ExternalLink size={12}/>
                                      </div>
                                   </td>
                                   <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-lg">${tx.amount}</td>
                                   <td className="px-6 py-4 text-right whitespace-nowrap">
                                      <div className={`text-xs font-bold ${tx.gasPaidBy === 'CashTrees' ? 'text-[#82cc33]' : 'text-orange-600'}`}>
                                         {tx.gasPaidBy}
                                      </div>
                                      <div className="text-[10px] text-amber-600 font-mono mt-1 flex items-center justify-end gap-1">
                                         <Zap size={10}/> {tx.gasAmount}
                                      </div>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>

              </div>
            )}

            {/* --- POS (SIMULATOR) --- */}
            {activeTab === 'POS' && (
              <div className="h-full flex items-center justify-center p-4">
                <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-[360px] h-[720px] flex flex-col relative overflow-hidden border-[12px] border-slate-900">
                   <div className="absolute top-0 w-full flex justify-center z-20">
                      <div className="w-24 h-6 bg-slate-900 rounded-b-2xl"></div>
                   </div>
                   <div className="p-6 pt-10 flex items-center">
                      <button onClick={() => setActiveTab('Overview')} className="p-2 bg-slate-50 rounded-full"><ArrowLeft size={18} /></button>
                   </div>
                   <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Amount to Charge (CAD)</div>
                      <div className="text-6xl font-black text-slate-900 tracking-tighter">${posAmount}</div>
                   </div>
                   <div className="p-6 pb-10 bg-white space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                         {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'backspace'].map(val => (
                            <button 
                              key={val} 
                              onClick={() => handlePosPadClick(val.toString())}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-900 text-2xl font-bold py-4 rounded-xl transition-all active:scale-95 shadow-sm flex items-center justify-center"
                            >
                              {val === 'backspace' ? <ArrowLeft size={24} /> : val}
                            </button>
                         ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         <button className="bg-[#96EB3C] hover:bg-[#86d635] text-slate-900 font-bold py-4 rounded-xl flex flex-col items-center justify-center shadow-[0_4px_16px_rgba(150,235,60,0.3)]">
                            <Camera size={20} />
                            <span className="text-[8px] uppercase tracking-widest mt-1">Scan User</span>
                         </button>
                         <button className="bg-white border-2 border-[#96EB3C] text-[#6ea32b] font-bold py-4 rounded-xl flex flex-col items-center justify-center">
                            <QrCode size={20} />
                            <span className="text-[8px] uppercase tracking-widest mt-1">Receive</span>
                         </button>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* --- CHAT --- */}
            {activeTab === 'Chat' && (
              <div className="h-full flex overflow-hidden bg-white -m-8">
                 <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
                    <div className="p-6 border-b border-slate-200">
                       <h2 className="text-xl font-black text-slate-900 mb-4">Messages</h2>
                       <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input type="text" placeholder="Search..." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm" />
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                       <div className="p-4 border-b border-slate-100 cursor-pointer bg-[#96EB3C]/10 border-l-4 border-l-[#96EB3C]">
                          <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-3">
                                  <img src={initialMerchants[0].logo} alt="" className="w-10 h-10 rounded-full object-cover" />
                                  <div>
                                    <div className="font-bold text-sm text-slate-900 leading-none">Osmanthus</div>
                                    <span className="text-[10px] text-slate-500">@osmanthus_van</span>
                                  </div>
                              </div>
                              <span className="text-[10px] font-bold text-[#82cc33]">10:42 AM</span>
                          </div>
                          <p className="text-xs text-slate-600 truncate mt-1">Rate adjustment request for Q1...</p>
                       </div>
                    </div>
                 </div>
                 <div className="flex-1 flex flex-col bg-slate-50/30">
                    <div className="h-20 border-b border-slate-200 flex justify-between items-center px-8 bg-white shadow-sm z-10">
                       <div className="flex items-center gap-4">
                          <img src={initialMerchants[0].logo} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          <div>
                             <div className="font-bold text-lg text-slate-900 flex items-center gap-2">Osmanthus <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-bold uppercase">Merchant</span></div>
                             <div className="text-xs text-slate-500 flex items-center gap-1"><Lock size={10} className="text-[#96EB3C]"/> End-to-End Encrypted</div>
                          </div>
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                       <div className="flex justify-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today</span></div>
                       <div className="flex justify-start">
                          <div className="max-w-[60%] rounded-2xl rounded-tl-sm px-5 py-3 text-sm bg-white border border-slate-200 shadow-sm text-slate-700">
                            Hi CashTrees Team, can we adjust our flat rate to 1.4% next month? Volume is up.
                            <div className="text-[10px] mt-2 text-slate-400">10:42 AM</div>
                          </div>
                       </div>
                    </div>
                    <div className="p-6 bg-white border-t border-slate-200">
                       <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
                          <button className="p-2 text-slate-400 hover:text-slate-600"><PlusCircle size={24}/></button>
                          <input type="text" placeholder="Type a message..." className="flex-1 bg-transparent border-none focus:outline-none text-sm py-2" />
                          <button className="p-2.5 rounded-xl bg-[#96EB3C] hover:bg-[#86d635] text-slate-900"><Send size={18}/></button>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {/* --- AUDIT LOGS --- */}
            {activeTab === 'Audit' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in">
                 <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldAlert size={20} className="text-slate-700"/>
                      <div>
                        <h3 className="font-bold text-slate-900">FINTRAC & BoC Compliance Logs</h3>
                        <p className="text-xs text-slate-500">Immutable ledger of administrative actions.</p>
                      </div>
                    </div>
                    <button className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Export for Audit</button>
                 </div>
                 <div className="divide-y divide-slate-100">
                    {[1,2,3].map(i => (
                      <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-4">
                           <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><History size={14}/></div>
                           <div>
                              <div className="text-sm font-bold text-slate-800">Merchant Onboarding Verified</div>
                              <div className="text-xs text-slate-400">KYB approved for @osmanthus_van by Admin (0x12...af)</div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-xs font-bold text-slate-500">2025-12-10</div>
                           <div className="text-[10px] text-[#6ea32b] font-bold">On-Chain Verified</div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

        </div>
      </main>

      {/* --- MERCHANT ONBOARD MODAL --- */}
      {isMerchantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeMerchantModal}></div>
            <div className="bg-white rounded-[32px] shadow-[0_24px_48px_rgba(0,0,0,0.1)] w-full max-w-md relative z-10 p-8 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center mb-6 flex-shrink-0">
                  <h3 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5 tracking-tight">
                     <Utensils className="text-[#82cc33]" size={28} strokeWidth={2.5}/> Onboard Restaurant
                  </h3>
                  <button onClick={closeMerchantModal} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors shrink-0"><X size={20}/></button>
               </div>
               
               <div className="space-y-6 overflow-y-auto pr-2 pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {kybError && (
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-sm font-medium">{kybError}</div>
                  )}
                  {kybSuccess ? (
                    <div className="p-4 bg-[#96EB3C]/10 text-[#548a1b] rounded-xl text-sm border border-[#96EB3C]/20">
                      <div className="font-bold mb-2">{kybSuccess.link.startsWith('http') ? 'KYB Link generated' : 'Success'}</div>
                      <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-[#96EB3C]/20">
                        <span className="flex-1 break-all text-slate-800 font-medium">{kybSuccess.link}</span>
                        {kybSuccess.link.startsWith('http') && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(kybSuccess!.link).then(() => {
                                setKybLinkCopied(true);
                                setTimeout(() => setKybLinkCopied(false), 2000);
                              });
                            }}
                            className="flex-shrink-0 p-2 rounded-lg hover:bg-[#96EB3C]/10 transition-colors"
                            title="Copy link"
                          >
                            {kybLinkCopied ? (
                              <Check className="w-5 h-5 text-[#96EB3C] animate-in zoom-in duration-200" />
                            ) : (
                              <Copy className="w-5 h-5 text-slate-600" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                  <div>
                     <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Restaurant Name</label>
                     <input type="text" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} className="w-full p-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold transition-all" placeholder="e.g. Sen Pho + Cafe" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cuisine</label>
                         <input type="text" value={restaurantCuisine} onChange={(e) => setRestaurantCuisine(e.target.value)} className="w-full p-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold transition-all" placeholder="e.g. Vietnamese" />
                      </div>
                      <div>
                         <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">City/Area</label>
                         <input type="text" value={restaurantCity} onChange={(e) => setRestaurantCity(e.target.value)} className="w-full p-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold transition-all" placeholder="e.g. Kerrisdale" />
                      </div>
                  </div>
                  
                  {/* Dynamic Handle Verification Section */}
                  <div>
                     <div className="flex justify-between items-end mb-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Beamio Handle (Search or Reserve)</label>
                        {handleStatus === 'found' && <span className="text-[10px] font-bold text-[#1562f0] flex items-center gap-1"><CheckCircle2 size={12}/> Merchant Found</span>}
                        {handleStatus === 'available' && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> Handle Available</span>}
                     </div>
                     {handleResolved ? (
                        <div className="flex items-center gap-3 p-4 bg-[#1562f0]/5 border border-[#1562f0]/10 rounded-[16px]">
                           <img src={handleResolved.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${handleResolved.username}`} alt="" className="w-10 h-10 rounded-full border border-[#1562f0]/20 object-cover" />
                           <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span className="font-mono font-bold text-[#1562f0]">@{handleResolved.username}</span>
                              {handleResolved.addressAA ? (
                                <span className="text-[10px] text-slate-500 font-mono" title={handleResolved.addressAA}>AA: {shortenAddress(handleResolved.addressAA)}</span>
                              ) : handleResolved.address ? (
                                <span className="text-[10px] text-slate-500 font-mono" title={handleResolved.address}>EOA: {shortenAddress(handleResolved.address)}</span>
                              ) : null}
                           </div>
                           <button type="button" onClick={() => { setHandleResolved(null); setRestaurantHandle(''); setHandleError(null); setHandleStatus('idle'); }} className="p-2 rounded-lg hover:bg-[#1562f0]/10 text-slate-500" aria-label="Clear handle"><X size={16} /></button>
                        </div>
                     ) : (
                        <div className="flex items-center gap-3">
                           <div className="relative flex-1">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                              <input
                                 type="text"
                                 value={restaurantHandle}
                                 onChange={(e) => { setRestaurantHandle(e.target.value); setHandleStatus('idle'); setHandleError(null); }}
                                 onKeyDown={(e) => e.key === 'Enter' && validateHandle(restaurantHandle)}
                                 className={`w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border rounded-[16px] focus:outline-none focus:ring-4 font-semibold transition-all ${handleStatus === 'found' ? 'border-[#1562f0]/30 focus:border-[#1562f0] focus:ring-[#1562f0]/20' : 'border-black/[0.04] focus:border-[#96EB3C] focus:ring-[#96EB3C]/20'} ${handleError ? 'border-rose-500' : ''}`}
                                 placeholder="@handle or 0x..."
                              />
                           </div>
                           <button onClick={() => validateHandle(restaurantHandle)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-4 px-6 rounded-[16px] transition-all active:scale-95 whitespace-nowrap" disabled={handleChecking}>
                              {handleChecking ? 'Checking...' : 'Verify'}
                           </button>
                        </div>
                     )}
                     
                     {handleStatus === 'found' && (
                        <div className="mt-3 p-4 bg-[#1562f0]/5 border border-[#1562f0]/10 rounded-[16px] flex items-start gap-3">
                            <BadgeCheck size={20} className="text-[#1562f0] shrink-0 mt-0.5" />
                            <div className="text-[12px] font-medium text-[#1562f0]">
                                <strong className="block text-[13px] mb-1">Existing Merchant OS User</strong>
                                The Smart Account for this handle is already verified. We will mint and airdrop the <strong>CashTrees Partner NFT</strong> directly to authorize alliance features.
                            </div>
                        </div>
                     )}
                     
                     {handleStatus === 'available' && (
                        <div className="mt-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-[16px] flex items-start gap-3">
                            <Store size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                            <div className="text-[12px] font-medium text-emerald-700">
                                <strong className="block text-[13px] mb-1">New Merchant</strong>
                                Handle is available. A KYB link will be generated to onboard the merchant and deploy their Smart Account.
                            </div>
                        </div>
                     )}
                     {handleError && handleStatus !== 'available' && (
                        <div className="mt-2 text-[11px] font-medium text-rose-600">{handleError}</div>
                     )}
                  </div>

                  {/* Financial Limits & Risk Control */}
                  <div className="pt-6 border-t border-black/[0.04]">
                     <h4 className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest mb-4">Financial Limits & Risk Control</h4>
                     <div className="space-y-5">
                         <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Max Cumulative Quota (CAD)</label>
                            <div className="relative">
                               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                               <input type="text" inputMode="numeric" value={topupLimit} onChange={(e) => setTopupLimit(e.target.value.replace(/[^\d.]/g, ''))} className="w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold font-mono transition-all" placeholder="e.g. 50000" />
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Max Top-up / TX</label>
                                <div className="relative">
                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                   <input type="text" inputMode="numeric" value={maxTopupPerTx} onChange={(e) => setMaxTopupPerTx(e.target.value.replace(/[^\d.]/g, ''))} className="w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold font-mono transition-all" placeholder="e.g. 1000" />
                                </div>
                             </div>
                             <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Max Spend / TX</label>
                                <div className="relative">
                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                   <input type="text" inputMode="numeric" value={maxSpendPerTx} onChange={(e) => setMaxSpendPerTx(e.target.value.replace(/[^\d.]/g, ''))} className="w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold font-mono transition-all" placeholder="e.g. 500" />
                                </div>
                             </div>
                         </div>
                     </div>
                  </div>

                  {/* Dynamic Submit Button */}
                  {handleStatus === 'found' ? (
                     <button
                       onClick={handleRegistrationMerchant}
                       disabled={isGeneratingKyb}
                       className="w-full bg-[#1562f0] text-white py-4 rounded-[16px] font-bold shadow-[0_4px_16px_rgba(21,98,240,0.3)] hover:bg-[#1250c4] transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
                     >
                       {isGeneratingKyb ? (
                         <>
                           <Loader2 className="w-5 h-5 animate-spin" />
                           {kybGeneratingPhase === 'register' ? 'Registering...' : 'Register'}
                         </>
                       ) : (
                         <>Mint Partner NFT & Authorize <Sparkles size={18} strokeWidth={2.5}/></>
                       )}
                     </button>
                  ) : (
                     <button
                       onClick={handleGenerateKybLink}
                       disabled={isGeneratingKyb || !restaurantName.trim()}
                       className="w-full bg-[#96EB3C] text-slate-900 py-4 rounded-[16px] font-bold shadow-[0_4px_16px_rgba(150,235,60,0.3)] hover:bg-[#86d635] transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
                     >
                       {isGeneratingKyb ? (
                         <>
                           <Loader2 className="w-5 h-5 animate-spin" />
                           Generating...
                         </>
                       ) : (
                         <>Generate KYB Link <ArrowRight size={18} strokeWidth={2.5}/></>
                       )}
                     </button>
                  )}
                    </>
                  )}
               </div>
            </div>
          </div>
      )}

      {/* --- B-UNIT PURCHASE (FUEL) MODAL --- */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isRefueling && setIsFuelModalOpen(false)} aria-hidden="true" />
          <div className="bg-white rounded-[2rem] shadow-[0_24px_48px_rgba(0,0,0,0.1)] w-full max-w-md relative z-10 p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <Fuel size={24} className="text-orange-500" fill="currentColor" /> Purchase B-Units
              </h3>
              <button onClick={() => !isRefueling && setIsFuelModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors shrink-0" disabled={isRefueling}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select Amount</h4>
                <div className="bg-[#eef6ff] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <Coins size={14} className="text-[#1562f0]" />
                  <span className="text-base font-black text-[#1562f0]">${refuelAmount}</span>
                  <span className="text-[10px] text-blue-400 font-bold uppercase">USDC</span>
                </div>
              </div>

              <div className="flex items-center gap-4 px-1">
                <button onClick={() => setRefuelAmount(Math.max(1, refuelAmount - 1))} className="w-12 h-12 rounded-[1rem] border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 active:scale-95 transition-all" disabled={isRefueling}>
                  <Minus size={20} />
                </button>
                <input type="range" min="1" max="100" step="1" value={refuelAmount} onChange={(e) => setRefuelAmount(Number(e.target.value))} className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#1562f0]" disabled={isRefueling} />
                <button onClick={() => setRefuelAmount(refuelAmount + 1)} className="w-12 h-12 rounded-[1rem] border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 active:scale-95 transition-all" disabled={isRefueling}>
                  <Plus size={20} />
                </button>
              </div>

              <div className="bg-[#f8f9fc] p-5 rounded-[1.5rem] space-y-3">
                <div className="flex justify-between text-[13px] font-bold">
                  <span className="text-slate-400">Fuel Yield (1:100)</span>
                  <span className="text-slate-800">+{refuelAmount * 100} B-Units</span>
                </div>
                <div className="flex justify-between text-[13px] font-bold">
                  <span className="text-slate-400 tracking-tight">Refuel Fee (Shadow Gas)</span>
                  <span className="text-red-400">-{REFUEL_GAS_COST} B-Units</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center mt-1">
                  <span className="text-[14px] font-black text-slate-800">Net Deposit</span>
                  <span className="text-[22px] font-black text-orange-500 leading-none">+{refuelAmount * 100 - REFUEL_GAS_COST} <span className="text-[10px] font-bold opacity-60">B-Units</span></span>
                </div>
              </div>

              {fuelUsdcBalance != null && (
                <p className="text-[12px] text-slate-500 font-medium">USDC Balance: {formatWithThousands(fuelUsdcBalance, 2)}</p>
              )}

              {refuelError && (
                <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-sm font-medium">{refuelError}</div>
              )}
              {refuelSuccess && (
                <div className="p-3 bg-[#96EB3C]/10 text-[#548a1b] rounded-xl text-sm font-medium flex items-center gap-2">
                  <Check size={18} /> {refuelSuccess}
                </div>
              )}

              <button
                onClick={handleRefuel}
                disabled={isRefueling}
                className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-[1.2rem] text-white font-black text-[15px] shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {isRefueling ? <RefreshCw size={20} className="animate-spin" /> : <><Fuel size={18} fill="currentColor" /> Refuel Now</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

