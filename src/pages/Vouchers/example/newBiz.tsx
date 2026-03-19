import React, { useState, useEffect } from 'react';
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
 MonitorSmartphone,
 Plus,
 Trash2,
 Link as LinkIcon,
 Shield,
 Zap,
 Lock,
 QrCode,
 Menu, 
 Fuel, 
 Store, 
 Server, 
 Database, 
 ChevronRight, 
 Sparkles, 
 Box, 
 Hexagon, 
 Award,
 CreditCard,
 Unlock,
 Paperclip,
 MoreVertical,
 AlertTriangle,
 Building2,
 SlidersHorizontal,
 RefreshCcw,
 CalendarDays
} from 'lucide-react';

// ==========================================
// ORACLE & EXCHANGE RATE (Simulated Coinbase Feed)
// CAD is the base currency. 1 CAD = X USDC.
// ==========================================
const ORACLE_CAD_USDC = 0.740;

// ==========================================
// DYNAMIC ALLIANCE DATABASE (Initial State)
// Scalable to infinity with Mint Quota logic
// ==========================================
const INITIAL_ALLIANCES_DB = {
  'CashTrees': {
    id: 'CashTrees',
    name: 'CashTrees Network',
    nftName: 'CashTrees Partner Card',
    token: '$CTree',
    nftBg: 'bg-[#4854e8]',
    nftBorder: 'border-[#5d68eb]',
    themeLightBg: 'bg-emerald-50',
    themeText: 'text-emerald-600',
    sales: 5000.00,       
    tips: 0.00,
    topUps: 20000.00,     
    aaBalance: 1400.00,
    canTopUp: true,
    mintQuota: 20000.00,  
    tiers: [
      { id: 'ct_green', name: 'Green Card', discount: 10, iconType: 'emerald' },
      { id: 'ct_black', name: 'Black VIP', discount: 20, iconType: 'yellow' }
    ],
    privileges: [
      { title: 'Full Access: $CTree (1:1 CAD)', desc: 'Process payments, issue cards, and handle upgrades at POS.' },
      { title: 'CAD Trust Settlement', desc: 'Unlock fiat payouts via local MSB.' },
      { title: 'Membership Routing', desc: 'Auto-apply VIP tier discounts.' }
    ]
  },
  'CCSA': {
    id: 'CCSA',
    name: 'CCSA Alliance',
    nftName: 'CCSA Franchise Node',
    token: '$CCSA',
    nftBg: 'bg-[#581c87]',
    nftBorder: 'border-[#7e22ce]',
    themeLightBg: 'bg-purple-50',
    themeText: 'text-purple-600',
    sales: 20000.00,      
    tips: 0.00,
    topUps: 5000.00,      
    aaBalance: 380.00,
    canTopUp: true,
    mintQuota: 20000.00,  
    tiers: [
      { id: 'ccsa_member', name: 'CCSA Member', discount: 15, iconType: 'purple' }
    ],
    privileges: [
      { title: 'Full Access: $CCSA (1:1 CAD)', desc: 'Process payments, issue cards, and handle upgrades at POS.' },
      { title: 'B2B Supply Chain', desc: 'Pay wholesale suppliers in $CCSA.' },
      { title: 'Cross-Store Discounts', desc: 'Shared loyalty across 100+ stores.' }
    ]
  },
  'SenPho': {
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
    mintQuota: null, 
    tiers: [], 
    privileges: [
      { title: 'Consumption Only: $PHO (1:1 CAD)', desc: 'Process payments. Top-ups and upgrades disabled.' },
      { title: 'HQ Franchise Settlement', desc: 'Direct corporate treasury payouts.' },
      { title: 'Inventory Purchasing', desc: 'Use $PHO for wholesale ingredients.' }
    ]
  },
  'UrbanPlay': {
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
    mintQuota: null,
    tiers: [], 
    privileges: [
      { title: 'Consumption Only: $UPASS (1:1 CAD)', desc: 'Process payments. Top-ups and upgrades disabled.' },
      { title: 'Event Ticketing', desc: 'Validate Class-B NFT tickets.' }
    ]
  }
};

type AllianceId = keyof typeof INITIAL_ALLIANCES_DB;
type TxRow = typeof INITIAL_TRANSACTIONS[number];

// --- Precise Mock Data ---
const INITIAL_TRANSACTIONS = [
 { id: 'TX-1049', time: '09:15 AM', type: 'Fiat Withdrawal', subtotal: 2500.00, tip: 0, total: 2500.00, method: 'Wire Transfer', ctreeAmount: 0, usdcAmount: 1850.00, source: 'EOA', beamioTag: 'RBC Bank *8821', status: 'Pending', hash: '0x1c...d4', terminal: 'The Vault', bUnits: 0, tier: null, requiredAlliance: null, wallet: 'EOA' },
 { id: 'TX-1048', time: '11:05 AM', type: 'P2P Send', subtotal: 500.00, tip: 0, total: 500.00, method: 'Direct USDC', ctreeAmount: 0, usdcAmount: 370.00, source: 'EOA', beamioTag: '@supplier_bob', status: 'Settled', hash: '0x9a...b2', terminal: 'The Vault', bUnits: 2, tier: null, requiredAlliance: null, wallet: 'EOA' },
 { id: 'TX-1042', time: '14:22 PM', type: 'Charge', subtotal: 85.00, tip: 15.00, total: 100.00, method: 'Mixed', ctreeAmount: 40.00, usdcAmount: 44.40, source: 'APP', beamioTag: '@alice_chen', status: 'Settled', hash: '0x1a...f9', terminal: '@ut_reg1', bUnits: 80, tier: 'Standard', requiredAlliance: 'CashTrees', wallet: 'AA' }, 
 { id: 'TX-1043', time: '15:05 PM', type: 'In-Store Top-Up', subtotal: 100.00, tip: 0.00, total: 100.00, method: 'Issued $CTree', ctreeAmount: 100.00, usdcAmount: 0, source: 'NFC', beamioTag: null, status: 'Settled', hash: '0x2b...e4', terminal: '@ut_reg1', bUnits: 2, tier: null, requiredAlliance: 'CashTrees', wallet: 'AA' },
 { id: 'TX-1044', time: '16:10 PM', type: 'Charge', subtotal: 12.50, tip: 2.00, total: 14.50, method: '$CTree (Green Tier)', ctreeAmount: 14.50, usdcAmount: 0, source: 'NFC', beamioTag: null, status: 'Settled', hash: '0x3c...d1', terminal: '@ut_kiosk2', bUnits: 12, tier: 'Green Card', requiredAlliance: 'CashTrees', wallet: 'AA' },
 { id: 'TX-1045', time: '16:45 PM', type: 'Charge', subtotal: 45.00, tip: 5.00, total: 50.00, method: 'USDC (No Discount)', ctreeAmount: 0, usdcAmount: 37.00, source: 'APP', beamioTag: '@bobby_s', status: 'Settled', hash: '0x4d...c2', terminal: '@ut_reg1', bUnits: 40, tier: 'Standard', requiredAlliance: null, wallet: 'AA' }, 
 { id: 'TX-1046', time: '17:30 PM', type: 'Charge', subtotal: 75.00, tip: 10.00, total: 85.00, method: '$CTree (Black Tier)', ctreeAmount: 85.00, usdcAmount: 0, source: 'APP', beamioTag: '@char_w', status: 'Settled', hash: '0x5e...b3', terminal: '@ut_kiosk2', bUnits: 68, tier: 'Black VIP', requiredAlliance: 'CashTrees', wallet: 'AA' },
 { id: 'TX-1047', time: '18:15 PM', type: 'Charge', subtotal: 120.00, tip: 18.00, total: 138.00, method: '$CCSA VIP', ctreeAmount: 0, usdcAmount: 0, ccsaAmount: 138.00, source: 'NFC', beamioTag: '@steven_liu', status: 'Settled', hash: '0x8f...a1', terminal: '@ut_reg1', bUnits: 110, tier: 'CCSA Member', requiredAlliance: 'CCSA', wallet: 'AA' }
];

const INITIAL_TERMINALS = [
 { id: 'TM-001', tag: '@ut_reg1', name: 'Main Register 1', eoa: '0x1A2B...3C4D', status: 'Active', lastActive: '2 mins ago', quota: 10000 },
 { id: 'TM-002', tag: '@ut_kiosk2', name: 'Self-Serve Kiosk', eoa: '0x9F8E...7D6C', status: 'Active', lastActive: '1 hr ago', quota: 5000 },
];

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

export default function MerchantOS() {
 const [currentView, setCurrentView] = useState('login'); 
 const [activeTab, setActiveTab] = useState('Overview');
 const [merchantTag, setMerchantTag] = useState('');
 const [password, setPassword] = useState('');
 const [loadingStep, setLoadingStep] = useState(0);

 // ==========================================
 // GLOBAL TIME FILTER STATE
 // ==========================================
 const [timeFilter, setTimeFilter] = useState('Today');

 // ==========================================
 // CORE ONBOARDING & ALLIANCE STATE
 // ==========================================
 const [isAaUnlocked, setIsAaUnlocked] = useState(false); 
 const [joinedAlliances, setJoinedAlliances] = useState<AllianceId[]>([]); 
 const [alliancesDb, setAlliancesDb] = useState(INITIAL_ALLIANCES_DB); 
 const [isJoinAllianceModalOpen, setIsJoinAllianceModalOpen] = useState(false);
 const [applyingAlliance, setApplyingAlliance] = useState<AllianceId | null>(null); 

 // ==========================================
 // ROUTING RULES STATE
 // ==========================================
 const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
 const [configAllianceId, setConfigAllianceId] = useState<AllianceId | null>(null);
 const [tempDiscounts, setTempDiscounts] = useState<Record<string, number>>({});

 // ==========================================
 // SETTLEMENT & PAYOUT STATE
 // ==========================================
 const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
 const [payoutAlliance, setPayoutAlliance] = useState<AllianceId | null>(null); 
 const [settlementType, setSettlementType] = useState('PAYOUT'); 
 const [settlementConsumed, setSettlementConsumed] = useState(0); 
 const [settlementNetBalance, setSettlementNetBalance] = useState(0); 
 const [payoutMethod, setPayoutMethod] = useState('USDC'); 
 const [payoutStep, setPayoutStep] = useState(1); 
 
 const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
 const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

 // ==========================================
 // TERMINALS WORKFLOW STATE
 // ==========================================
 const [terminals, setTerminals] = useState(INITIAL_TERMINALS);
 const [isAddTerminalOpen, setIsAddTerminalOpen] = useState(false);
 const [linkTerminalStep, setLinkTerminalStep] = useState(1); 
 const [isVerifyingTag, setIsVerifyingTag] = useState(false);
 const [newTerminalTag, setNewTerminalTag] = useState('');
 const [newTerminalName, setNewTerminalName] = useState('');
 const [newTerminalQuota, setNewTerminalQuota] = useState('');
 const [foundTerminalEoa, setFoundTerminalEoa] = useState('');

 // Transactions State
 const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
 const [activeLedger, setActiveLedger] = useState('All'); 
 const [searchTerm, setSearchTerm] = useState('');
 const [filterType, setFilterType] = useState('All');
 const [filterTerminal, setFilterTerminal] = useState('All');
 
 // Chat State
 const [activeContact, setActiveContact] = useState('c1');
 const [chatInput, setChatInput] = useState('');

 useEffect(() => {
   const handleResize = () => {
     if (window.innerWidth >= 1024) {
       setIsMobileMenuOpen(false); 
     }
   };
   window.addEventListener('resize', handleResize);
   return () => window.removeEventListener('resize', handleResize);
 }, []);

 const handleTabChange = (tab: string) => {
   setActiveTab(tab);
   setIsMobileMenuOpen(false);
 };

 const handleApplyAlliance = (aId: AllianceId) => {
   setApplyingAlliance(aId);
   setTimeout(() => {
     setJoinedAlliances(prev => [...prev, aId]);
     setIsAaUnlocked(true); 
     setApplyingAlliance(null);
     setIsJoinAllianceModalOpen(false);
     setActiveTab('Messages');
     setActiveContact('c1');
   }, 2500); 
 };

 const handleMarketPurchase = () => {
   setIsAaUnlocked(true); 
   setSelectedProduct(null);
   setActiveTab('Wallets'); 
 };

 const handleOpenConfig = (aId: AllianceId) => {
   setConfigAllianceId(aId);
   const initial: Record<string, number> = {};
   if (alliancesDb[aId].tiers) {
     alliancesDb[aId].tiers.forEach((t: { id: string; discount: number }) => { initial[t.id] = t.discount; });
   }
   setTempDiscounts(initial);
   setIsConfigModalOpen(true);
 };

 const handleSaveConfig = () => {
   const aId = configAllianceId;
   if (!aId) return;
   setAlliancesDb(prev => {
     const updatedTiers = prev[aId].tiers.map((t: { id: string; discount: number; name: string; iconType: string }) => ({
       ...t,
       discount: tempDiscounts[t.id] ?? t.discount
     }));
     return {
       ...prev,
       [aId]: { ...prev[aId], tiers: updatedTiers }
     };
   });
   setIsConfigModalOpen(false);
 };

 // ==========================================
 // TERMINAL LINKING LOGIC
 // ==========================================
 const handleVerifyTerminalTag = () => {
   if (!newTerminalTag) return;
   setIsVerifyingTag(true);
   setTimeout(() => {
     setIsVerifyingTag(false);
     setFoundTerminalEoa('0x' + Math.random().toString(16).slice(2, 6).toUpperCase() + '...' + Math.random().toString(16).slice(2, 6).toUpperCase());
     setLinkTerminalStep(2);
   }, 1500);
 };

 const handleLinkTerminal = () => {
   if (newTerminalName && newTerminalQuota) {
     setTerminals([...terminals, {
       id: `TM-00${terminals.length + 1}`,
       tag: newTerminalTag.startsWith('@') ? newTerminalTag : `@${newTerminalTag}`,
       name: newTerminalName,
       eoa: foundTerminalEoa,
       status: 'Active',
       lastActive: 'Just now',
       quota: parseFloat(newTerminalQuota) || 0
     }]);
     closeTerminalModal();
   }
 };

 const closeTerminalModal = () => {
   setIsAddTerminalOpen(false);
   setTimeout(() => {
     setLinkTerminalStep(1);
     setNewTerminalTag('');
     setNewTerminalName('');
     setNewTerminalQuota('');
     setFoundTerminalEoa('');
   }, 300);
 };

 // ==========================================
 // EXECUTE SETTLEMENT
 // ==========================================
 const executeSettlement = () => {
   const aId = payoutAlliance;
   if (!aId) return;
   setPayoutStep(2); 
   
   setTimeout(() => {
     setPayoutStep(3); 
     
     setAlliancesDb(prev => ({
       ...prev,
       [aId]: {
         ...prev[aId],
         sales: 0,
         tips: 0,
         topUps: 0,
       }
     }));

     const newTxId = `TX-${Math.floor(1000 + Math.random() * 9000)}`;
     let txType = '';
     if (settlementType === 'PAYOUT') {
        txType = payoutMethod === 'USDC' ? 'L2 Settlement' : 'Fiat Payout';
     } else {
        txType = payoutMethod === 'USDC' ? 'L2 Remittance' : 'Fiat Remittance';
     }

     const usdcPayoutValue = payoutMethod === 'USDC' ? (settlementNetBalance * ORACLE_CAD_USDC) : 0;

     const newTx = {
       id: newTxId,
       time: new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}),
       type: txType,
       subtotal: settlementNetBalance, 
       tip: 0, 
       total: settlementNetBalance,
       method: payoutMethod === 'USDC' ? 'USDC (T+0)' : 'Wire (T+2)',
       ctreeAmount: 0, 
       usdcAmount: usdcPayoutValue, 
       source: 'AA', 
       beamioTag: payoutMethod === 'USDC' ? 'The Vault (EOA)' : 'Alliance Treasury', 
       status: payoutMethod === 'USDC' ? 'Settled' : 'Pending', 
       hash: '0x' + Math.random().toString(16).slice(2, 10), 
       terminal: 'Smart Contract', 
       bUnits: 2, 
       tier: null, 
       requiredAlliance: aId, 
       wallet: payoutMethod === 'USDC' ? 'AA' : 'EOA'
     };
     setTransactions(prev => [newTx as unknown as TxRow, ...prev]);

   }, 3000); 
 };

 // ==========================================
 // DYNAMIC TIME SCALING (FLOWS ONLY)
 // ==========================================
 const getTimeMultiplier = () => {
   switch(timeFilter) {
     case 'This Week': return 7;
     case 'This Month': return 30;
     case 'This Quarter': return 90;
     case 'This Year': return 365;
     default: return 1; // 'Today'
   }
 };
 const flowMultiplier = getTimeMultiplier();

 // --- Dynamic Financial Logic (CAD BASE CURRENCY CONVERSION) ---
 // Snapshots (Do not scale with time)
 const eoaBalanceUSDC = isAaUnlocked ? 5420.00 : 0.00; 
 const aaUsdcBalance = isAaUnlocked ? 125.50 : 0.00;
 const eoaBalance_CAD = eoaBalanceUSDC / ORACLE_CAD_USDC; 
 const aaUsdcBalance_CAD = aaUsdcBalance / ORACLE_CAD_USDC; 
 const aaBUnits = isAaUnlocked ? 13300 : 20; 

 // Flows (Scale with time range selected)
 const baseSalesCAD_viaUSDC = isAaUnlocked ? 872.30 : 0.00; 
 const baseTipsCAD_viaUSDC = isAaUnlocked ? 191.89 : 0.00;

 const salesCAD_viaUSDC = baseSalesCAD_viaUSDC * flowMultiplier; 
 const tipsCAD_viaUSDC = baseTipsCAD_viaUSDC * flowMultiplier;

 const usdcCollectedFromSales = salesCAD_viaUSDC * ORACLE_CAD_USDC;
 const usdcCollectedFromTips = tipsCAD_viaUSDC * ORACLE_CAD_USDC;

 let totalSalesCAD = salesCAD_viaUSDC;
 let totalTipsCAD = tipsCAD_viaUSDC;
 let totalTopUpsCAD = 0;

 joinedAlliances.forEach(aId => {
   totalSalesCAD += (alliancesDb[aId].sales * flowMultiplier);
   totalTipsCAD += (alliancesDb[aId].tips * flowMultiplier);
   totalTopUpsCAD += (alliancesDb[aId].topUps * flowMultiplier);
 });

 const calculateTxNetValueCAD = (tx: TxRow) => {
   if (tx.type.includes('Top-Up') || tx.type.includes('Settlement') || tx.type.includes('Withdrawal')) {
      if (tx.method.includes('USDC') || tx.type.includes('P2P Send')) return tx.usdcAmount / ORACLE_CAD_USDC;
      return tx.total; 
   }
   return (tx.usdcAmount / ORACLE_CAD_USDC) + (tx.ctreeAmount ?? 0) + (tx.ccsaAmount ?? 0);
 }

 const today = new Date();
 const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

 const CashTreesLogo = ({ className = '' }: { className?: string }) => (
   <svg viewBox="0 0 100 100" className={`w-full h-full ${className}`} fill="none" xmlns="http://www.w3.org/2000/svg">
     <rect width="100" height="100" fill="#000" rx="24" />
     <path d="M50 20 V80 M25 45 L50 70 L75 45 M35 30 L50 45 L65 30" stroke="#1562f0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
     <circle cx="50" cy="20" r="5" fill="#1562f0"/>
     <circle cx="25" cy="45" r="5" fill="#1562f0"/>
     <circle cx="75" cy="45" r="5" fill="#1562f0"/>
     <circle cx="35" cy="30" r="4" fill="#1562f0"/>
     <circle cx="65" cy="30" r="4" fill="#1562f0"/>
   </svg>
 );

 const handleOnboarding = (isInviteFlow: boolean) => {
   if (!merchantTag) return; 
   setCurrentView('loading');
   setTimeout(() => setLoadingStep(1), 800); 
   setTimeout(() => setLoadingStep(2), 1600);
   setTimeout(() => setLoadingStep(3), 2400);
   setTimeout(() => {
     if (isInviteFlow) {
       setIsAaUnlocked(true);
       setJoinedAlliances(['CashTrees', 'CCSA']);
       setActiveTab('Wallets'); 
     } else {
       setIsAaUnlocked(false);
       setJoinedAlliances([]);
       setActiveLedger('EOA'); 
       setActiveTab('Overview');
     }
     setCurrentView('dashboard');
   }, 3200);
 };

 const renderLogin = () => (
   <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 sm:p-6 selection:bg-[#1562f0]/20 font-sans">
     <div className="w-full max-w-[420px] bg-white/70 backdrop-blur-3xl rounded-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8 sm:p-10 overflow-hidden relative">
       <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-[#1562f0]/5 via-transparent to-emerald-500/5 -z-10 blur-2xl"></div>
       <div className="relative z-10 flex flex-col items-center">
         <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-sm border border-slate-100 mb-6 transform hover:scale-105 transition-transform duration-300">
           <CashTreesLogo />
         </div>
         <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight mb-2">Merchant OS</h1>
         <p className="text-[14px] font-medium text-slate-500 mb-8 text-center">Create or access your decentralized identity</p>

         <div className="w-full space-y-4">
           <div className="space-y-2">
             <label className="text-[12px] font-semibold text-slate-500 ml-1">Set Beamio Tag</label>
             <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                 <span className="text-slate-400 font-medium text-[16px]">@</span>
               </div>
               <input type="text" value={merchantTag.replace('@', '')} onChange={(e) => setMerchantTag(`@${e.target.value}`)} placeholder="e.g. urbantea_van" className="w-full pl-9 pr-4 py-3.5 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[15px] text-slate-900 shadow-sm" />
             </div>
           </div>
           <div className="space-y-2">
             <label className="text-[12px] font-semibold text-slate-500 ml-1">Local Password</label>
             <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                 <KeyRound size={16} className="text-slate-400" />
               </div>
               <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" className="w-full pl-10 pr-4 py-3.5 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-[16px] focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[15px] tracking-widest text-slate-900 shadow-sm" />
             </div>
           </div>
           <div className="pt-6 space-y-3">
             <button onClick={() => handleOnboarding(false)} className="w-full bg-[#1562f0] text-white py-3.5 rounded-[16px] font-semibold text-[15px] shadow-[0_8px_20px_rgba(21,98,240,0.25)] hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2">
               <Wallet size={18} /> Create Standard Wallet
             </button>
             <button onClick={() => handleOnboarding(true)} className="w-full bg-slate-900 text-white py-3.5 rounded-[16px] font-semibold text-[15px] hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 border border-slate-800">
               <LinkIcon size={18} /> Redeem Alliance Invite
             </button>
           </div>
         </div>
         <div className="mt-8 flex items-center gap-2 text-[11px] font-medium text-slate-500 bg-slate-50/80 px-3 py-1.5 rounded-full border border-slate-100">
           <ShieldCheck size={14} className="text-[#1562f0]" />
           <span>Zero-Knowledge EOA Derivation</span>
         </div>
       </div>
     </div>
   </div>
 );

 const renderLoading = () => (
   <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 sm:p-6 font-sans">
     <div className="w-full max-w-[420px] bg-white/80 backdrop-blur-3xl rounded-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-12 flex flex-col items-center justify-center relative overflow-hidden">
       <div className="w-16 h-16 border-[3px] border-slate-100 border-t-[#1562f0] rounded-full animate-spin mb-10"></div>
       <div className="space-y-5 w-full">
         {[
           { step: 0, text: "Deriving Local EOA via ZK-Proof" },
           { step: 1, text: isAaUnlocked ? "Connecting Smart Account (AA)" : "Securing Vault Infrastructure" },
           { step: 2, text: "Syncing Ledger State" }
         ].map((item) => (
           <div key={item.step} className={`flex items-center gap-4 transition-all duration-700 ${loadingStep >= item.step ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
             <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-500 ${loadingStep > item.step ? 'bg-[#1562f0] text-white' : 'bg-slate-100 text-slate-300'}`}>
               <CheckCircle2 size={16} />
             </div>
             <span className={`text-[15px] ${loadingStep > item.step ? 'font-semibold text-slate-900' : 'font-medium text-slate-400'}`}>{item.text}</span>
           </div>
         ))}
       </div>
     </div>
   </div>
 );

 const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: { icon: React.ElementType; label: string; isActive: boolean; onClick: () => void; collapsed?: boolean }) => (
   <button
     onClick={onClick}
     className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3.5 rounded-[16px] transition-all duration-200 ${
       isActive
         ? 'bg-[#1562f0] text-white shadow-[0_4px_12px_rgba(21,98,240,0.2)]'
         : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 active:bg-slate-200'
     }`}
     title={collapsed ? label : undefined}
   >
     <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
     {!collapsed && <span className="font-semibold text-[15px] whitespace-nowrap">{label}</span>}
   </button>
 );

 // --- Dashboard Layout & Content ---
 const renderDashboard = () => (
   <div className="flex h-screen bg-[#f5f5f7] font-sans text-slate-900 overflow-hidden selection:bg-[#1562f0]/20">
    
     {isMobileMenuOpen && (
       <div 
         className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
         onClick={() => setIsMobileMenuOpen(false)}
       />
     )}

     <aside
       className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white/80 backdrop-blur-3xl border-r border-slate-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out
         ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'} 
         lg:relative lg:translate-x-0 ${isDesktopSidebarCollapsed ? 'lg:w-[90px]' : 'lg:w-[280px]'}`}
     >
       <div className={`p-6 pb-6 pt-8 ${isDesktopSidebarCollapsed ? 'lg:flex lg:justify-center' : ''} flex justify-between items-center lg:block`}>
         <div
           className="flex items-center gap-4 lg:mb-8 cursor-pointer group"
           onClick={() => {
             if(window.innerWidth >= 1024) setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed);
           }}
         >
           <div className="w-12 h-12 rounded-[14px] overflow-hidden shadow-sm border border-slate-100 shrink-0 group-hover:shadow-md transition-all">
              <CashTreesLogo />
           </div>
           {(!isDesktopSidebarCollapsed || window.innerWidth < 1024) && (
             <div className="whitespace-nowrap overflow-hidden">
               <div className="flex items-center gap-2">
                 <h1 className="font-semibold text-[19px] tracking-tight text-slate-900">Your Store</h1>
                 {joinedAlliances.length > 0 && (
                   <div className="flex items-center justify-center w-5 h-5 bg-emerald-50 rounded-full border border-emerald-200 shrink-0 shadow-sm" title="Ecosystem NFT Active">
                     <Award size={12} className="text-emerald-600" />
                   </div>
                 )}
               </div>
               <p className="text-[13px] font-medium text-slate-500 mt-0.5">@{merchantTag || 'merchant'}</p>
             </div>
           )}
         </div>
         <button className="lg:hidden p-2 text-slate-400 hover:text-slate-800 bg-slate-50 rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
           <X size={20} />
         </button>
        
         {(!isDesktopSidebarCollapsed || window.innerWidth < 1024) && (
           <div className="hidden lg:flex lg:flex-col bg-slate-50/80 backdrop-blur-sm border border-slate-100/80 rounded-[20px] p-4 gap-3 overflow-hidden whitespace-nowrap">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-500 flex items-center gap-1.5"><Cpu size={14} className={isAaUnlocked ? "text-[#1562f0]" : "text-slate-400"}/> Smart AA</span>
                <span className={`text-[12px] font-mono font-medium px-2 py-1 rounded-[8px] shadow-sm border ${isAaUnlocked ? 'bg-white text-slate-700 border-slate-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                  {isAaUnlocked ? '0x4D...11F2' : 'Locked'}
                </span>
              </div>
              <div className="h-[1px] w-full bg-slate-200/50"></div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-500 flex items-center gap-1.5"><KeyRound size={14}/> Owner EOA</span>
                <span className="text-[12px] font-mono font-medium text-slate-700">0x8B...A9C</span>
              </div>
           </div>
         )}
       </div>

       <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
         {(!isDesktopSidebarCollapsed || window.innerWidth < 1024) && <p className="px-4 text-[12px] font-semibold text-slate-400 mb-3 mt-4 whitespace-nowrap">Store Management</p>}
         <NavItem icon={LayoutDashboard} label="Daily Dashboard" isActive={activeTab === 'Overview'} onClick={() => handleTabChange('Overview')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />
         <NavItem icon={Receipt} label="Transactions" isActive={activeTab === 'Transactions'} onClick={() => handleTabChange('Transactions')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />
         <NavItem icon={Wallet} label="Store Wallets" isActive={activeTab === 'Wallets'} onClick={() => handleTabChange('Wallets')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />
         <NavItem icon={Store} label="Market" isActive={activeTab === 'Market'} onClick={() => handleTabChange('Market')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />
        
         <div className="mt-8"></div>
         {(!isDesktopSidebarCollapsed || window.innerWidth < 1024) && <p className="px-4 text-[12px] font-semibold text-slate-400 mb-3 whitespace-nowrap">Communication</p>}
         <NavItem icon={MessageSquare} label="Messages" isActive={activeTab === 'Messages'} onClick={() => handleTabChange('Messages')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />

         <div className="mt-8"></div>
         {(!isDesktopSidebarCollapsed || window.innerWidth < 1024) && <p className="px-4 text-[12px] font-semibold text-slate-400 mb-3 whitespace-nowrap">Configuration</p>}
         <NavItem icon={Hexagon} label="Partner Alliances" isActive={activeTab === 'Alliances'} onClick={() => handleTabChange('Alliances')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />
         <NavItem icon={Users} label="Staff Terminals" isActive={activeTab === 'Staff'} onClick={() => handleTabChange('Staff')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />
         <NavItem icon={Settings} label="Store Settings" isActive={activeTab === 'Settings'} onClick={() => handleTabChange('Settings')} collapsed={isDesktopSidebarCollapsed && window.innerWidth >= 1024} />
       </nav>

       <div className="p-4 sm:p-6 mb-4 sm:mb-0">
         <button
           onClick={() => setCurrentView('login')}
           className={`w-full flex items-center ${(isDesktopSidebarCollapsed && window.innerWidth >= 1024) ? 'justify-center px-0' : 'justify-center gap-2 px-4'} py-3.5 rounded-[16px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors font-semibold text-[15px]`}
         >
           <LogOut size={20} className="shrink-0" />
           {(!isDesktopSidebarCollapsed || window.innerWidth < 1024) && <span className="whitespace-nowrap">Lock Wallet</span>}
         </button>
       </div>
     </aside>

     <main className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 ease-in-out">
       <header className="h-16 sm:h-20 bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 flex items-center justify-between px-4 sm:px-8 lg:px-10 sticky top-0 z-10 shrink-0">
         <div className="flex items-center gap-3 sm:gap-4">
           <button 
             className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
             onClick={() => setIsMobileMenuOpen(true)}
           >
             <Menu size={24} />
           </button>
           <h2 className="text-xl sm:text-[26px] font-semibold text-slate-900 tracking-tight">{activeTab}</h2>
         </div>
         <div className="flex items-center gap-4 sm:gap-6">
           {/* ORACLE LIVE FEED SIMULATOR */}
           <div className="hidden lg:flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200">
             <RefreshCcw size={12} className="text-[#1562f0] animate-[spin_4s_linear_infinite]" />
             <span className="text-[11px] font-bold text-slate-500 tracking-wider">ORACLE: 1 CAD ≈ {ORACLE_CAD_USDC.toFixed(2)} USDC</span>
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
           
           <div className="hidden sm:block h-5 w-[1px] bg-slate-200"></div>
           <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#1562f0]/10 rounded-full flex items-center justify-center border border-[#1562f0]/20 cursor-pointer hover:bg-[#1562f0]/20 transition-colors">
              <span className="text-[13px] sm:text-[14px] font-semibold text-[#1562f0]">Me</span>
           </div>
         </div>
       </header>

       <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 pb-24 sm:pb-10 scrollbar-hide">
         
         {/* --- 1. OVERVIEW TAB --- */}
         {activeTab === 'Overview' && (
           <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
             
             {/* If brand new merchant & AA Locked, show Welcome/Onboarding Banner */}
             {!isAaUnlocked && (
               <div className="bg-[#1562f0] rounded-[24px] p-6 sm:p-8 text-white shadow-lg shadow-[#1562f0]/20 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                 <div className="relative z-10 max-w-2xl">
                   <h3 className="text-[22px] font-bold mb-2">Welcome to Beamio Web3 POS!</h3>
                   <p className="text-[15px] text-white/80 leading-relaxed mb-6">Your EOA Vault is ready. You can currently send/receive direct USDC payments. <strong>Your Smart Terminal (AA) is locked.</strong> To unlock zero-gas routing, VIP memberships, and voucher economies, purchase a Fuel Pack or join an Alliance.</p>
                   <div className="flex gap-3">
                     <button 
                      onClick={() => setActiveTab('Market')}
                      className="bg-white text-[#1562f0] px-6 py-3 rounded-[14px] font-semibold text-[14px] hover:bg-slate-50 transition-colors shadow-sm"
                     >
                       Buy Fuel Pack
                     </button>
                     <button 
                      onClick={() => setActiveTab('Alliances')}
                      className="bg-[#1562f0] border border-white/30 text-white px-6 py-3 rounded-[14px] font-semibold text-[14px] hover:bg-white/10 transition-colors shadow-sm"
                     >
                       Join Alliance
                     </button>
                   </div>
                 </div>
               </div>
             )}

             {/* Metrics Row */}
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
               {/* Gross Sales */}
               <div className="bg-white/80 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow xl:col-span-1">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-slate-50 rounded-[16px] flex items-center justify-center border border-slate-100/50">
                        <TrendingUp size={24} className="text-slate-700" />
                     </div>
                     <span className="bg-[#1562f0]/10 text-[#1562f0] px-3 py-1.5 rounded-full text-[12px] font-semibold">{timeFilter}</span>
                   </div>
                   <p className="text-[14px] font-medium text-slate-500 mb-1">Total Gross Sales (CAD Base)</p>
                   <p className="text-4xl sm:text-[40px] font-light text-slate-900 tracking-tight leading-none">${totalSalesCAD.toFixed(2)}</p>
                 </div>
                 
                 {/* HORIZONTAL SCROLL FOR MULTI-ALLIANCE */}
                 <div className="flex flex-nowrap gap-3 mt-8 pt-6 border-t border-slate-100/80 overflow-x-auto scrollbar-hide pb-1">
                    <div className="bg-blue-50/50 px-4 py-3 rounded-[16px] shrink-0 w-[140px]">
                       <span className="text-[11px] text-[#1562f0] font-medium block mb-1 flex items-center gap-1.5"><Coins size={12}/> USDC Payments</span>
                       <span className="text-[15px] font-semibold text-[#1562f0]">${usdcCollectedFromSales.toFixed(2)}</span>
                       <span className="text-[10px] text-[#1562f0]/60 font-medium block mt-0.5">≈ ${salesCAD_viaUSDC.toFixed(2)} CAD</span>
                    </div>
                    {joinedAlliances.map(aId => {
                      const alliance = alliancesDb[aId];
                      const scaledSales = alliance.sales * flowMultiplier;
                      return (
                        <div key={aId} className={`${alliance.themeLightBg} px-4 py-3 rounded-[16px] shrink-0 w-[140px]`}>
                           <span className={`text-[11px] ${alliance.themeText} font-medium block mb-1 flex items-center gap-1.5`}><Ticket size={12}/> {alliance.token}</span>
                           <span className="text-[15px] font-semibold text-slate-800">${scaledSales.toFixed(2)}</span>
                           <span className={`text-[10px] ${alliance.themeText} opacity-60 font-medium block mt-0.5`}>≈ ${scaledSales.toFixed(2)} CAD</span>
                        </div>
                      )
                    })}
                 </div>
               </div>

               {/* Tips */}
               <div className="bg-white/80 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow xl:col-span-1">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-rose-50 rounded-[16px] flex items-center justify-center border border-rose-100/50">
                        <Heart size={24} className="text-rose-500 fill-rose-100" />
                     </div>
                   </div>
                   <p className="text-[14px] font-medium text-slate-500 mb-1">Tips Collected (CAD Base)</p>
                   <p className="text-4xl sm:text-[40px] font-light text-slate-900 tracking-tight leading-none">${totalTipsCAD.toFixed(2)}</p>
                 </div>
                 
                 {/* HORIZONTAL SCROLL FOR MULTI-ALLIANCE */}
                 <div className="flex flex-nowrap gap-3 mt-8 pt-6 border-t border-slate-100/80 overflow-x-auto scrollbar-hide pb-1">
                    <div className="bg-blue-50/50 px-4 py-3 rounded-[16px] shrink-0 w-[140px]">
                       <span className="text-[11px] text-[#1562f0] font-medium block mb-1 flex items-center gap-1.5"><Coins size={12}/> USDC Payments</span>
                       <span className="text-[15px] font-semibold text-[#1562f0]">${usdcCollectedFromTips.toFixed(2)}</span>
                       <span className="text-[10px] text-[#1562f0]/60 font-medium block mt-0.5">≈ ${tipsCAD_viaUSDC.toFixed(2)} CAD</span>
                    </div>
                    {joinedAlliances.map(aId => {
                      const alliance = alliancesDb[aId];
                      const scaledTips = alliance.tips * flowMultiplier;
                      return (
                        <div key={`tip-${aId}`} className={`${alliance.themeLightBg} px-4 py-3 rounded-[16px] shrink-0 w-[140px]`}>
                           <span className={`text-[11px] ${alliance.themeText} font-medium block mb-1 flex items-center gap-1.5`}><Ticket size={12}/> {alliance.token}</span>
                           <span className="text-[15px] font-semibold text-slate-800">${scaledTips.toFixed(2)}</span>
                           <span className={`text-[10px] ${alliance.themeText} opacity-60 font-medium block mt-0.5`}>≈ ${scaledTips.toFixed(2)} CAD</span>
                        </div>
                      )
                    })}
                 </div>
               </div>

               {/* Top-Ups */}
               <div className="bg-white/80 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow xl:col-span-1">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-emerald-50 rounded-[16px] flex items-center justify-center border border-emerald-100/50">
                        <ArrowUpFromLine size={24} className="text-emerald-500" />
                     </div>
                   </div>
                   <div className="flex items-center gap-2 mb-1">
                     <p className="text-[14px] font-medium text-slate-500">In-Store Top-Ups</p>
                   </div>
                   <p className="text-4xl sm:text-[40px] font-light text-slate-900 tracking-tight leading-none">${totalTopUpsCAD.toFixed(2)}</p>
                 </div>
                 
                 {/* SCROLLABLE VERTICAL LIST FOR TOP-UPS */}
                 <div className="mt-8 pt-6 border-t border-slate-100/80 flex flex-col gap-2 max-h-[85px] overflow-y-auto scrollbar-hide pr-2">
                    {joinedAlliances.filter(aId => alliancesDb[aId].canTopUp).length === 0 ? (
                      <p className="text-[12px] text-slate-400 font-medium">No active issuing networks.</p>
                    ) : (
                      joinedAlliances.filter(aId => alliancesDb[aId].canTopUp).map(aId => {
                        const alliance = alliancesDb[aId];
                        const scaledTopUps = alliance.topUps * flowMultiplier;
                        return (
                          <div key={`topup-${aId}`} className={`px-4 py-2.5 rounded-[12px] border flex justify-between items-center shrink-0 bg-slate-50/80 border-slate-100/50 transition-colors`}>
                            <div className="flex flex-col">
                              <span className="text-[12px] text-slate-500 font-medium">Issued {alliance.token}</span>
                            </div>
                            <span className={`text-[14px] font-semibold text-slate-800`}>
                              ${scaledTopUps.toFixed(2)}
                            </span>
                          </div>
                        )
                      })
                    )}
                 </div>
               </div>

               {/* Protocol Fuel (B-Units) */}
               <div className="bg-[#111113] rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 shadow-[0_16px_40px_rgba(0,0,0,0.15)] border border-orange-500/10 flex flex-col justify-between relative overflow-hidden group xl:col-span-1">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-[60px] -mr-10 -mt-10 pointer-events-none group-hover:bg-orange-500/20 transition-colors duration-700"></div>
                 
                 <div className="relative z-10">
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-orange-500/10 rounded-[16px] flex items-center justify-center border border-orange-500/20">
                        <Fuel size={24} className="text-orange-500" />
                     </div>
                     <div className="flex items-center gap-1.5 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                       <div className={`w-1.5 h-1.5 rounded-full ${isAaUnlocked ? 'bg-orange-500 animate-pulse' : 'bg-slate-500'}`}></div>
                       <span className={`text-[11px] font-bold ${isAaUnlocked ? 'text-orange-500' : 'text-slate-500'} tracking-wider uppercase`}>{isAaUnlocked ? 'Active' : 'Locked'}</span>
                     </div>
                   </div>
                   <p className="text-[14px] font-medium text-slate-400 mb-1">Protocol Fuel Reserve</p>
                   <div className="flex items-baseline gap-1.5">
                     <p className="text-4xl sm:text-[40px] font-mono font-semibold text-white tracking-tight leading-none">{aaBUnits.toLocaleString()}</p>
                   </div>
                 </div>

                 <div className="relative z-10 mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3">
                       <span className="text-[12px] font-medium text-slate-500">Total Consumption</span>
                       <span className="text-[13px] font-bold text-orange-400">{isAaUnlocked ? `-${420 * flowMultiplier} Units` : '0 Units'}</span>
                    </div>
                    <button 
                      onClick={() => { setActiveTab('Market'); setSelectedProduct('fuel'); }}
                      className="w-full bg-white/5 hover:bg-orange-500 hover:text-white hover:border-orange-500 text-orange-500 border border-orange-500/30 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      Top Up Fuel
                    </button>
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* --- 2. TRANSACTIONS TAB --- */}
         {activeTab === 'Transactions' && (() => {
            const filteredTransactions = transactions.filter(tx => {
               if (!isAaUnlocked && tx.wallet === 'AA') return false; 
               if (tx.requiredAlliance && !joinedAlliances.includes(tx.requiredAlliance as AllianceId)) return false;
               if (activeLedger !== 'All' && tx.wallet !== activeLedger) return false;

               const matchSearch = tx.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   (tx.beamioTag && tx.beamioTag.toLowerCase().includes(searchTerm.toLowerCase()));
               const matchType = filterType === 'All' || tx.type === filterType;
               const matchTerminal = filterTerminal === 'All' || tx.terminal === filterTerminal;
               return matchSearch && matchType && matchTerminal;
            });

            const summaryTxCount = filteredTransactions.length * flowMultiplier;
            const summaryTotalCAD = filteredTransactions.reduce((sum, tx) => sum + calculateTxNetValueCAD(tx), 0) * flowMultiplier;
            const summaryTotalUSDC = filteredTransactions.reduce((sum, tx) => sum + (tx.usdcAmount || 0), 0) * flowMultiplier;
            const summaryTotalVouchers = filteredTransactions.reduce((sum, tx) => sum + (tx.ctreeAmount ?? 0) + (tx.ccsaAmount ?? 0), 0) * flowMultiplier;

            return (
           <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300">
              
              <div className="flex bg-white/60 backdrop-blur-xl p-1.5 rounded-[20px] w-max mb-2 sm:mb-4 border border-slate-200/50 shadow-sm">
                <button 
                  onClick={() => setActiveLedger('All')} 
                  className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all ${activeLedger === 'All' ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  All Ledgers
                </button>
                <button 
                  onClick={() => setActiveLedger('AA')} 
                  className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeLedger === 'AA' ? 'bg-white text-[#1562f0] shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}
                  disabled={!isAaUnlocked}
                >
                  <Zap size={16} className={!isAaUnlocked ? "opacity-50" : ""} /> 
                  Smart Terminal (AA)
                  {!isAaUnlocked && <Lock size={12} className="ml-1 opacity-50" />}
                </button>
                <button 
                  onClick={() => setActiveLedger('EOA')} 
                  className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all flex items-center gap-1.5 ${activeLedger === 'EOA' ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Shield size={16} className={activeLedger === 'EOA' ? "text-emerald-500" : ""} /> The Vault (EOA)
                </button>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search receipt, hash..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 pr-4 py-3.5 sm:py-3 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-[20px] sm:rounded-2xl w-full sm:w-80 text-[15px] font-medium focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 focus:border-[#1562f0] transition-all shadow-sm" 
                  />
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                  <select 
                    value={filterTerminal}
                    onChange={(e) => setFilterTerminal(e.target.value)}
                    className="bg-white/80 backdrop-blur-xl border border-slate-200/80 px-4 py-3.5 sm:py-3 rounded-[20px] sm:rounded-2xl text-[14px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 cursor-pointer appearance-none shrink-0"
                  >
                    <option value="All">All Terminals</option>
                    {terminals.map(t => (
                      <option key={t.tag} value={t.tag}>{t.name} ({t.tag})</option>
                    ))}
                    <option value="The Vault">The Vault (EOA)</option>
                  </select>

                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-white/80 backdrop-blur-xl border border-slate-200/80 px-4 py-3.5 sm:py-3 rounded-[20px] sm:rounded-2xl text-[14px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 cursor-pointer appearance-none shrink-0"
                  >
                    <option value="All">All Actions</option>
                    <option value="Charge">Charge</option>
                    <option value="In-Store Top-Up">Top-Up</option>
                    <option value="P2P Send">P2P Send</option>
                    <option value="Fiat Withdrawal">Settlements</option>
                  </select>

                  <button className="flex items-center justify-center gap-2 bg-white/80 backdrop-blur-xl border border-slate-200/80 px-5 py-3.5 sm:py-3 rounded-[20px] sm:rounded-2xl text-[14px] font-semibold text-slate-700 shadow-sm shrink-0">
                    <Filter size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-xl border border-slate-200/50 rounded-[20px] p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <div>
                   <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Activity size={14} className="text-[#1562f0]" />
                      {filterTerminal === 'All' ? `Network Summary (${timeFilter})` : `${filterTerminal} Summary (${timeFilter})`}
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
                       <span className="text-[11px] text-[#1562f0] font-semibold mb-0.5 flex items-center gap-1"><Coins size={10}/> USDC</span>
                       <span className="text-[15px] font-bold text-slate-800">{summaryTotalUSDC.toFixed(2)}</span>
                    </div>
                    <div className="bg-white rounded-[14px] px-4 py-2.5 border border-slate-200/60 flex flex-col flex-1 sm:flex-none">
                       <span className="text-[11px] text-emerald-500 font-semibold mb-0.5 flex items-center gap-1"><Ticket size={10}/> Vouchers</span>
                       <span className="text-[15px] font-bold text-slate-800">{summaryTotalVouchers.toFixed(2)}</span>
                    </div>
                 </div>
              </div>

              <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full min-w-[1000px]">
                     <thead>
                       <tr className="bg-slate-50/50 text-left border-b border-slate-100/80">
                         <th className="px-8 py-5 text-[13px] font-medium text-slate-500">Recent Transaction</th>
                         <th className="px-6 py-5 text-[13px] font-medium text-slate-500">Customer & Source</th>
                         <th className="px-6 py-5 text-[13px] font-medium text-slate-500">Payment Routing</th>
                         <th className="px-6 py-5 text-[13px] font-medium text-slate-500">Network & Fuel</th>
                         <th className="px-8 py-5 text-[13px] font-medium text-slate-500 text-right">Net Value (CAD Base)</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100/80">
                        {filteredTransactions.length === 0 ? (
                           <tr>
                             <td colSpan={5} className="px-8 py-16 text-center text-slate-500">
                               <Search size={32} className="mx-auto mb-3 text-slate-300" />
                               <p className="text-[15px] font-medium">No transactions found for the current filters.</p>
                             </td>
                           </tr>
                        ) : (
                          filteredTransactions.map((tx, idx) => {
                            const txTotalCAD = calculateTxNetValueCAD(tx); 
                            return (
                            <tr key={tx.id || idx} className="hover:bg-slate-50/50 transition-colors group">
                               <td className="px-8 py-5 align-middle">
                                 <div className="flex items-center gap-4">
                                   <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                                     tx.type.includes('Top-Up') ? 'bg-emerald-50 border-emerald-100/50 text-emerald-600' : 
                                     tx.wallet === 'EOA' ? 'bg-blue-50 border-blue-100 text-[#1562f0]' :
                                     'bg-slate-50 border-slate-200/50 text-slate-600'
                                   }`}>
                                     {tx.type === 'P2P Send' ? <Send size={18}/> : 
                                      tx.type.includes('Withdrawal') || tx.type.includes('Settlement') || tx.type.includes('Remittance') ? <Landmark size={18}/> : 
                                      tx.type.includes('Top-Up') ? <ArrowUpFromLine size={18}/> : 
                                      <ArrowDownToLine size={18}/>}
                                   </div>
                                   <div>
                                      <div className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.type}</div>
                                      <div className="text-[13px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                                        {tx.id} • {tx.time}
                                      </div>
                                   </div>
                                 </div>
                               </td>

                               <td className="px-6 py-5 align-middle">
                                 <div className="flex flex-col gap-1.5">
                                   {tx.wallet === 'EOA' && !tx.type.includes('Settlement') && !tx.type.includes('Remittance') ? (
                                      <>
                                        <span className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.beamioTag}</span>
                                        <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium whitespace-nowrap">
                                          <Shield size={14} className="text-[#1562f0]" />
                                          <span>The Vault • On-Chain</span>
                                        </div>
                                      </>
                                   ) : tx.type.includes('Settlement') || tx.type.includes('Remittance') ? (
                                      <>
                                        <span className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.beamioTag}</span>
                                        <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium whitespace-nowrap">
                                          <Building2 size={14} className={tx.type.includes('Fiat') ? "text-amber-500" : "text-emerald-500"} />
                                          <span>{tx.type.includes('Fiat') ? 'Off-Chain Wire' : 'Base L2 Clearing'}</span>
                                        </div>
                                      </>
                                   ) : (
                                      <>
                                        <div className="flex items-center gap-2">
                                          {tx.beamioTag ? (
                                            <span className="font-semibold text-[15px] text-slate-900 whitespace-nowrap">{tx.beamioTag}</span>
                                          ) : (
                                            <span className="font-medium text-[15px] text-slate-500 italic whitespace-nowrap">Anonymous</span>
                                          )}
                                          
                                          {tx.tier === 'Black VIP' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-slate-900 text-yellow-400 px-1.5 py-0.5 rounded shadow-sm border border-slate-800 whitespace-nowrap">
                                              <Crown size={10} className="text-yellow-400" /> VIP
                                            </span>
                                          )}
                                          {tx.tier === 'Green Card' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-200/50 whitespace-nowrap">
                                              <ShieldCheck size={10} className="text-emerald-500" /> Green
                                            </span>
                                          )}
                                          {tx.tier === 'CCSA Member' && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-200/50 whitespace-nowrap">
                                              <Award size={10} className="text-purple-500" /> CCSA
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[13px] text-slate-500 font-medium whitespace-nowrap">
                                          {tx.source === 'APP' ? <Smartphone size={14} className="text-[#1562f0]" /> : 
                                           tx.source === 'AA' ? <Cpu size={14} className="text-emerald-500" /> : <Nfc size={14} className="text-slate-400" />}
                                          <span>{tx.source === 'APP' ? 'App' : tx.source === 'AA' ? 'Smart Contract' : 'NFC'} • {tx.terminal}</span>
                                        </div>
                                      </>
                                   )}
                                 </div>
                               </td>

                               <td className="px-6 py-5 align-middle">
                                 <div className="flex flex-col gap-1.5">
                                   {tx.usdcAmount > 0 && !tx.type.includes('Settlement') && !tx.type.includes('Remittance') && (
                                     <div className="flex flex-col">
                                       <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                         <Coins size={15} className="text-[#1562f0]" /> {tx.usdcAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">USDC</span>
                                       </div>
                                       <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${(tx.usdcAmount / ORACLE_CAD_USDC).toFixed(2)} CAD</span>
                                     </div>
                                   )}
                                   {tx.ctreeAmount > 0 && (
                                     <div className="flex flex-col">
                                       <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                         <Ticket size={15} className="text-emerald-500" /> {tx.ctreeAmount.toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">$CTree</span>
                                       </div>
                                       <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${tx.ctreeAmount.toFixed(2)} CAD</span>
                                     </div>
                                   )}
                                   {(tx.ccsaAmount ?? 0) > 0 && (
                                     <div className="flex flex-col">
                                       <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                         <Ticket size={15} className="text-purple-500" /> {(tx.ccsaAmount ?? 0).toFixed(2)} <span className="text-[12px] text-slate-400 font-medium">$CCSA</span>
                                       </div>
                                       <span className="text-[11px] text-slate-400 font-medium mt-0.5 ml-6">≈ ${(tx.ccsaAmount ?? 0).toFixed(2)} CAD</span>
                                     </div>
                                   )}
                                   {(tx.type.includes('Settlement') || tx.type.includes('Remittance')) && (
                                     <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 whitespace-nowrap">
                                       <Landmark size={15} className={tx.status === 'Pending' ? 'text-amber-500' : 'text-emerald-500'} /> 
                                       {tx.method}
                                     </div>
                                   )}
                                 </div>
                               </td>

                               <td className="px-6 py-5 align-middle">
                                 <div className="flex flex-col items-start gap-2">
                                   <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                     {tx.status === 'Pending' ? (
                                        <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
                                     ) : (
                                        <CheckCircle2 size={12} className={tx.wallet === 'EOA' ? "text-blue-500" : "text-emerald-500"} />
                                     )}
                                     <span className="text-[12px] font-mono text-slate-500">{tx.hash}</span>
                                   </div>
                                   {tx.bUnits > 0 ? (
                                     <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-1 rounded-md border border-orange-500/10 cursor-help" title={`Protocol Fee: ${(tx.bUnits * 0.01).toFixed(2)} USDC`}>
                                       <Fuel size={12} className="text-orange-500" />
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
                                    tx.type.includes('Top-Up') || tx.type === 'Receive' || tx.type === 'Fiat Settlement' || tx.type === 'L2 Settlement'
                                      ? 'text-emerald-600' 
                                      : tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-900'
                                 }`}>
                                   {tx.type.includes('Top-Up') || tx.type.includes('Settlement') || tx.type === 'Receive' ? '+' : ''}${txTotalCAD.toFixed(2)}
                                 </div>
                                 <div className={`text-[12px] font-medium mt-1 whitespace-nowrap ${tx.status === 'Pending' ? 'text-amber-500' : 'text-slate-400'}`}>
                                   {tx.status === 'Pending' ? 'Pending Settlement' : tx.tip > 0 ? `Incl. $${(tx.tip / ORACLE_CAD_USDC).toFixed(2)} Tip` : tx.wallet === 'EOA' ? 'Treasury TX' : 'No Tip'}
                                 </div>
                               </td>

                            </tr>
                          );})
                        )}
                     </tbody>
                  </table>
                </div>
              </div>
           </div>
            );
         })()}

         {/* --- 3. STORE WALLETS TAB --- */}
         {activeTab === 'Wallets' && (
           <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Store Wallets</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Manage your Tethered Hybrid Architecture: The Vault (EOA) & Smart Terminal (AA).</p>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                {/* 1. Main Wallet (EOA) - ALways active */}
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
                              <p className="text-[13px] text-slate-400 font-mono mt-1">0x8B49...A9C3</p>
                           </div>
                        </div>
                     </div>
                     <div className="mb-4">
                        <p className="text-[13px] font-medium text-slate-400 mb-1">CAD Value (Base L2)</p>
                        <div className="flex items-baseline gap-2 mb-1">
                           <p className="text-[48px] sm:text-[56px] font-light tracking-tight leading-none">${eoaBalance_CAD.toFixed(2)}</p>
                           <span className="text-xl text-slate-500 font-light">CAD</span>
                        </div>
                        <span className="text-[12px] font-mono text-[#1562f0] bg-[#1562f0]/10 px-2 py-0.5 rounded inline-block">{eoaBalanceUSDC.toFixed(2)} USDC</span>
                     </div>
                   </div>
                   {/* UPDATED EOA BUTTONS: Explicit B-Units Cost Mentioned */}
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

                {/* 2. Express Pay (AA) - Can be LOCKED */}
                <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between relative overflow-hidden xl:col-span-2">
                   
                   {/* LOCKED STATE OVERLAY */}
                   {!isAaUnlocked && (
                     <div className="absolute inset-0 backdrop-blur-xl bg-[#f5f5f7]/80 z-20 flex flex-col items-center justify-center text-center p-8 rounded-[32px]">
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

                   <div className={`relative z-10 ${!isAaUnlocked ? 'opacity-30 blur-sm pointer-events-none select-none' : ''}`}>
                     <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center border border-slate-100/80">
                              <Zap size={28} className="text-[#1562f0]" />
                           </div>
                           <div>
                              <h4 className="text-[20px] font-semibold text-slate-900 tracking-tight flex items-center gap-2">Smart Terminal <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">ERC-4337</span></h4>
                              <p className="text-[13px] text-slate-400 font-mono mt-1">0x4D2A...11F2</p>
                           </div>
                        </div>
                     </div>

                     {/* HORIZONTAL SCROLL FOR AA BALANCES */}
                     <div className="flex flex-nowrap gap-4 sm:gap-5 mb-8 overflow-x-auto scrollbar-hide pb-2">
                        <div className="bg-slate-50/80 rounded-[24px] p-5 sm:p-6 border border-slate-100/50 shrink-0 min-w-[200px] sm:min-w-[240px] w-max">
                           <p className="text-[13px] font-medium text-slate-500 mb-1">Liquid Reserve</p>
                           <div className="flex items-baseline gap-1.5 mb-0.5">
                              <p className="text-3xl sm:text-[32px] font-semibold text-slate-900 tracking-tight">${aaUsdcBalance_CAD.toFixed(2)}</p>
                              <span className="text-[14px] text-slate-500 font-medium">CAD</span>
                           </div>
                           <span className="text-[11px] text-[#1562f0] font-medium">{aaUsdcBalance.toFixed(2)} USDC</span>
                        </div>
                        {joinedAlliances.map(aId => {
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
                          )
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

             {/* UPGRADED: HIGH-DENSITY TABLE FOR SETTLEMENT POOLS with QUOTA LOGIC */}
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
                         {joinedAlliances.map(aId => {
                           const alliance = alliancesDb[aId];
                           const totalReceived = alliance.sales + alliance.tips;
                           const netBalance = totalReceived - alliance.topUps;
                           const isQuotaExceeded = alliance.mintQuota && alliance.topUps >= alliance.mintQuota;
                           
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
                               
                               <td className="px-6 py-5 text-right font-medium text-slate-600 text-[15px]">
                                 +${totalReceived.toFixed(2)}
                               </td>
                               
                               <td className="px-6 py-5 text-right font-medium text-[15px]">
                                 {alliance.canTopUp ? (
                                   <div className="flex flex-col items-end gap-1.5">
                                     <span className={`${isQuotaExceeded ? 'text-rose-600' : 'text-slate-800'} font-bold`}>
                                       -${alliance.topUps.toFixed(2)}
                                     </span>
                                     {alliance.mintQuota && (
                                       <div className="w-28 bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-500 ${isQuotaExceeded ? 'bg-rose-500' : alliance.topUps >= alliance.mintQuota * 0.8 ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                                            style={{ width: `${Math.min(100, (alliance.topUps / alliance.mintQuota) * 100)}%` }}
                                          ></div>
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
                                 <div className="text-[11px] text-slate-400 font-medium mt-1">
                                   {netBalance >= 0 ? 'Due to You' : 'Due to Alliance'}
                                 </div>
                               </td>
                               
                               <td className="px-8 py-5 text-center">
                                 <button 
                                   onClick={() => {
                                     setPayoutAlliance(aId);
                                     setSettlementNetBalance(Math.abs(netBalance));
                                     setSettlementType(netBalance >= 0 ? 'PAYOUT' : 'REMIT');
                                     setSettlementConsumed(totalReceived);
                                     setPayoutStep(1);
                                     setIsPayoutModalOpen(true);
                                   }}
                                   className={`px-5 py-2.5 rounded-[14px] text-[14px] font-semibold transition-all w-full flex items-center justify-center gap-2 active:scale-[0.98] ${
                                     netBalance >= 0 
                                       ? `${alliance.themeLightBg} ${alliance.themeText} hover:brightness-95` 
                                       : isQuotaExceeded 
                                         ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-[0_4px_15px_rgba(244,63,94,0.3)]'
                                         : 'bg-slate-800 text-white hover:bg-slate-700'
                                   }`}
                                 >
                                   {netBalance >= 0 ? <Landmark size={16} /> : isQuotaExceeded ? <Lock size={16} /> : <ArrowRightLeft size={16} />}
                                   {netBalance >= 0 ? 'Request Payout' : isQuotaExceeded ? 'Remit to Unlock' : 'Remit Fiat'}
                                 </button>
                               </td>
                             </tr>
                           )
                         })}
                       </tbody>
                     </table>
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}

         {/* --- 4. MARKET TAB --- */}
         {activeTab === 'Market' && (
           <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Market</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Acquire physical infrastructure and protocol fuel for your node.</p>
             </div>
             
             {/* UPDATED TO 3 COLUMNS */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                
                {/* Product 0: Starter Fuel Pack (1 USDC) */}
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
                      <button onClick={() => setSelectedProduct('fuel')} className="bg-orange-500 text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20 active:scale-95">
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
                      <button onClick={() => setSelectedProduct('node')} className="bg-[#1562f0] text-white px-8 py-3.5 rounded-[14px] font-semibold text-[15px] hover:bg-blue-500 transition-colors shadow-lg shadow-[#1562f0]/20 active:scale-95">
                        View
                      </button>
                    </div>
                  </div>
                </div>
             </div>
           </div>
         )}

         {/* --- 5. PARTNER ALLIANCES TAB --- */}
         {activeTab === 'Alliances' && (
           <div className="max-w-[1400px] mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300">
             <div className="mb-6">
               <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Partner Alliances</h3>
               <p className="text-[15px] font-medium text-slate-500 mt-1">Manage your Ecosystem NFTs (ERC-1155) that grant routing logic and settlement privileges.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                
                {/* Dynamically render minted Partner NFTs */}
                {joinedAlliances.map(aId => {
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
                            onClick={() => handleOpenConfig(aId)}
                            className="text-[13px] font-semibold text-slate-900 bg-white hover:bg-slate-100 px-3.5 py-2 rounded-[12px] transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <SlidersHorizontal size={14} /> Routing Rules
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* JOIN NEW ALLIANCE CTA */}
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

         {/* --- 6. STAFF TERMINALS TAB --- */}
         {activeTab === 'Staff' && (
           <div className="max-w-[1400px] mx-auto animate-in fade-in duration-300 relative">
             
             {/* LOCKED STATE: STANDALONE CARD */}
             {!isAaUnlocked && (
               <div className="flex flex-col items-center justify-center min-h-[400px] py-12">
                 <div className="w-full bg-white rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-slate-100 flex flex-col items-center text-center p-10">
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

             <div className={`space-y-6 sm:space-y-8 ${!isAaUnlocked ? 'opacity-40 blur-sm pointer-events-none select-none' : ''}`}>
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
                  <div>
                    <h3 className="text-[26px] font-semibold text-slate-900 tracking-tight">Staff Terminals</h3>
                    <p className="text-[15px] font-medium text-slate-500 mt-1">Manage linked POS devices and their EOA authorizations.</p>
                  </div>
                  <button
                    onClick={() => setIsAddTerminalOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1562f0] text-white px-6 py-4 sm:py-3.5 rounded-[20px] text-[15px] font-semibold shadow-[0_8px_20px_rgba(21,98,240,0.25)] hover:shadow-[0_12px_24px_rgba(21,98,240,0.35)] transition-all active:scale-[0.98]"
                  >
                    <Plus size={20} strokeWidth={2.5} /> Link New Terminal
                  </button>
                </div>

                <div className="bg-white rounded-[24px] sm:rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                       <thead>
                         <tr className="bg-slate-50/50 text-left border-b border-slate-100/80">
                           <th className="px-6 sm:px-8 py-5 text-[12px] font-semibold text-slate-400">Terminal Identity</th>
                           <th className="px-6 py-5 text-[12px] font-semibold text-slate-400">Linked EOA Address</th>
                           <th className="px-6 py-5 text-[12px] font-semibold text-slate-400 text-center">Status</th>
                           <th className="px-6 py-5 text-[12px] font-semibold text-slate-400 text-right">Issuing Quota</th>
                           <th className="px-6 sm:px-8 py-5 text-[12px] font-semibold text-slate-400 text-right">Actions</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100/80">
                          {terminals.map((term, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
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
                                 <div className="flex items-center gap-2">
                                   <span className="font-mono text-[14px] font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                     {term.eoa}
                                   </span>
                                 </div>
                               </td>
                               <td className="px-6 py-6 text-center">
                                 <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[12px] font-semibold">
                                   <CheckCircle2 size={14} /> {term.status}
                                 </span>
                                 <div className="text-[12px] font-medium text-slate-400 mt-2">{term.lastActive}</div>
                               </td>
                               <td className="px-6 py-6 text-right">
                                 <span className="font-semibold text-[15px] text-slate-900">
                                   ${term.quota ? term.quota.toLocaleString() : '0'}
                                 </span>
                                 <div className="text-[12px] font-medium text-slate-400 mt-1">CAD Daily</div>
                               </td>
                               <td className="px-6 sm:px-8 py-6 text-right">
                                 <button className="p-3 bg-rose-50 text-rose-500 rounded-[14px] hover:bg-rose-500 hover:text-white transition-colors" title="Revoke Authorization">
                                   <Trash2 size={20} />
                                 </button>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
                </div>
             </div>
           </div>
         )}

         {/* --- 7. MESSAGES (CHAT) TAB --- */}
         {activeTab === 'Messages' && (
           <div className="max-w-[1400px] mx-auto h-[calc(100vh-160px)] sm:h-[calc(100vh-200px)] flex flex-col sm:flex-row gap-6 animate-in fade-in duration-300">
             
             {/* Contacts Sidebar */}
             <div className="w-full sm:w-[340px] flex flex-col bg-white/80 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shrink-0 overflow-hidden">
               <div className="p-6 border-b border-slate-100/80 bg-white/50">
                 <h3 className="text-[20px] font-bold text-slate-900 tracking-tight mb-4">Messages</h3>
                 <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     type="text" 
                     placeholder="Search CoNET tags..." 
                     className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/60 rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[13px] text-slate-900"
                   />
                 </div>
               </div>
               
               <div className="flex-1 overflow-y-auto scrollbar-hide">
                 {MOCK_CONTACTS.map(contact => (
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

             {/* Chat Window */}
             <div className="flex-1 flex flex-col bg-white/80 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
               {/* Chat Header */}
               <div className="h-20 px-6 sm:px-8 border-b border-slate-100/80 bg-white/50 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-[16px] bg-[#4854e8] flex items-center justify-center text-white font-bold tracking-wider shadow-sm">
                     CT
                   </div>
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

               {/* Chat Messages */}
               <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#f8f9fb] space-y-6">
                 <div className="flex justify-center mb-8">
                   <div className="bg-slate-200/50 px-3 py-1 rounded-full text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                     CoNET L1 Secure Routing
                   </div>
                 </div>

                 {MOCK_MESSAGES.map(msg => (
                   <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                     <div className={`max-w-[80%] sm:max-w-[70%] p-4 rounded-[20px] ${
                       msg.sender === 'me' 
                         ? 'bg-[#1562f0] text-white rounded-tr-[4px] shadow-[0_4px_15px_rgba(21,98,240,0.2)]' 
                         : 'bg-white text-slate-800 rounded-tl-[4px] shadow-sm border border-slate-100'
                     }`}>
                       <p className="text-[14.5px] font-medium leading-relaxed">{msg.text}</p>
                     </div>
                     <span className="text-[11px] font-medium text-slate-400 mt-2 px-1">
                       {msg.time} {msg.sender === 'me' && '• Read'}
                     </span>
                   </div>
                 ))}
                 
                 {/* Typing indicator simulation for visual effect */}
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

               {/* Chat Input */}
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
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && chatInput.trim()) {
                           setChatInput('');
                         }
                       }}
                       className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200/60 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[15px] text-slate-900"
                     />
                     <button 
                       onClick={() => setChatInput('')}
                       className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all ${
                         chatInput.trim() ? 'bg-[#1562f0] text-white shadow-md' : 'text-slate-400 hover:bg-slate-200'
                       }`}
                     >
                       <Send size={18} className={chatInput.trim() ? "translate-x-0.5" : ""} />
                     </button>
                   </div>
                 </div>
                 <div className="text-center mt-3">
                   <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                     0 Gas Fee • Powered by CoNET L1
                   </span>
                 </div>
               </div>
             </div>

           </div>
         )}
       </div>
     </main>

     {/* ========================================================= */}
     {/* GLOBAL MODALS (MOVED OUTSIDE OF TABS TO PREVENT DUPLICATION) */}
     {/* ========================================================= */}

     {/* --- ADD TERMINAL MODAL --- */}
     {isAddTerminalOpen && (
       <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
         <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={closeTerminalModal}></div>
         <div className="relative bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            
            <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
               <div className="flex justify-between items-start mb-2">
                 <div className="w-12 h-12 rounded-[16px] bg-[#1562f0]/10 text-[#1562f0] flex items-center justify-center mb-4 shadow-sm">
                    <MonitorSmartphone size={24} />
                 </div>
                 <button onClick={closeTerminalModal} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors">
                   <X size={20} />
                 </button>
               </div>
               <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-1">Link Terminal</h2>
               <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
                 Securely map a mobile POS device to your Smart Account via zero-knowledge proof.
               </p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {linkTerminalStep === 1 && (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <div className="space-y-2 mb-6">
                    <label className="text-[12px] font-semibold text-slate-500 ml-1">Terminal Beamio Tag</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-medium text-[16px]">@</span>
                      </div>
                      <input
                        type="text"
                        value={newTerminalTag}
                        onChange={(e) => setNewTerminalTag(e.target.value)}
                        placeholder="e.g. ut_reg3"
                        disabled={isVerifyingTag}
                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200/60 rounded-[20px] focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 focus:border-[#1562f0] transition-all font-medium text-[16px] text-slate-900 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleVerifyTerminalTag}
                    disabled={!newTerminalTag || isVerifyingTag}
                    className={`w-full py-4.5 rounded-[20px] font-semibold text-[16px] transition-all flex items-center justify-center gap-2 ${
                      !newTerminalTag ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 
                      isVerifyingTag ? 'bg-slate-100 text-slate-400 cursor-wait' :
                      'bg-[#1562f0] text-white hover:bg-blue-600 shadow-[0_8px_20px_rgba(21,98,240,0.25)] active:scale-[0.98]'
                    }`}
                  >
                    {isVerifyingTag ? (
                      <><div className="w-5 h-5 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin"></div> Verifying On-Chain...</>
                    ) : (
                      <><Search size={18} /> Verify Identity</>
                    )}
                  </button>
                </div>
              )}

              {linkTerminalStep === 2 && (
                <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-[20px] flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Identity Verified</p>
                      <p className="text-[15px] font-mono font-medium text-slate-700">{foundTerminalEoa}</p>
                    </div>
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-sm">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-semibold text-slate-500 ml-1">Terminal Alias</label>
                    <input
                      type="text"
                      value={newTerminalName}
                      onChange={(e) => setNewTerminalName(e.target.value)}
                      placeholder="e.g. Front Desk Tablet"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200/60 rounded-[16px] focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 focus:border-[#1562f0] transition-all font-medium text-[15px] text-slate-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[12px] font-semibold text-slate-500 ml-1">Issuing Quota (CAD Daily)</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-slate-400 font-medium text-[16px]">$</span>
                      </div>
                      <input
                        type="number"
                        value={newTerminalQuota}
                        onChange={(e) => setNewTerminalQuota(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full pl-9 pr-4 py-3.5 bg-slate-50 border border-slate-200/60 rounded-[16px] focus:outline-none focus:ring-4 focus:ring-[#1562f0]/10 focus:border-[#1562f0] transition-all font-medium text-[15px] text-slate-900"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium px-1 mt-1.5 leading-snug">
                      Maximum liability this terminal can mint across all active alliances before requiring a manager reset.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleLinkTerminal}
                    disabled={!newTerminalName || !newTerminalQuota}
                    className={`w-full py-4.5 mt-4 rounded-[20px] font-semibold text-[16px] transition-all flex items-center justify-center gap-2 ${
                      (!newTerminalName || !newTerminalQuota) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 
                      'bg-slate-900 text-white hover:bg-slate-800 shadow-[0_8px_20px_rgba(0,0,0,0.15)] active:scale-[0.98]'
                    }`}
                  >
                    <LinkIcon size={18} /> Authorize & Link Terminal
                  </button>
                </div>
              )}
            </div>

         </div>
       </div>
     )}

     {/* --- ROUTING CONFIG MODAL --- */}
     {isConfigModalOpen && configAllianceId && (() => {
       const alliance = alliancesDb[configAllianceId];
       const hasTiers = alliance.tiers && alliance.tiers.length > 0;
       return (
         <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsConfigModalOpen(false)}></div>
           <div className="relative bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
             
             <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
               <div className="flex justify-between items-start mb-2">
                 <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center text-white mb-4 shadow-sm ${alliance.nftBg}`}>
                    <SlidersHorizontal size={20} />
                 </div>
                 <button onClick={() => setIsConfigModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors">
                   <X size={20} />
                 </button>
               </div>
               <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-1">{alliance.name} Routing</h2>
               <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
                 Configure automatic point-of-sale discounts for ecosystem VIP tiers. Enforced by your Smart Terminal.
               </p>
             </div>

             <div className="p-6 sm:p-8">
               {!hasTiers ? (
                 <div className="bg-slate-50 rounded-[20px] p-6 text-center border border-slate-100">
                   <Info size={24} className="text-slate-400 mx-auto mb-3" />
                   <h4 className="text-[15px] font-semibold text-slate-700 mb-1">Standard Routing Only</h4>
                   <p className="text-[13px] text-slate-500">This alliance does not support custom membership discount tiers.</p>
                 </div>
               ) : (
                 <div className="space-y-6">
                   {alliance.tiers.map(tier => (
                     <div key={tier.id} className="bg-white border border-slate-200 rounded-[20px] p-5 shadow-sm">
                       <div className="flex justify-between items-center mb-5">
                         <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                             tier.iconType === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' :
                             tier.iconType === 'yellow' ? 'bg-yellow-50 border-yellow-100 text-yellow-500' :
                             'bg-purple-50 border-purple-100 text-purple-500'
                           }`}>
                             {tier.iconType === 'emerald' ? <ShieldCheck size={18} /> : tier.iconType === 'yellow' ? <Crown size={18} /> : <Award size={18} />}
                           </div>
                           <h4 className="text-[16px] font-semibold text-slate-900">{tier.name}</h4>
                         </div>
                         <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                           <span className="text-[15px] font-bold text-slate-900">{tempDiscounts[tier.id] || 0}</span>
                           <span className="text-[12px] font-bold text-slate-500">%</span>
                         </div>
                       </div>
                       
                       <input 
                         type="range" 
                         min="0" 
                         max="100" 
                         step="1"
                         value={tempDiscounts[tier.id] || 0}
                         onChange={(e) => setTempDiscounts(prev => ({...prev, [tier.id]: parseInt(e.target.value)}))}
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

             <div className="p-6 sm:p-8 bg-slate-50/50 border-t border-slate-100 mt-auto">
               <button 
                 onClick={handleSaveConfig}
                 disabled={!hasTiers}
                 className={`w-full py-4.5 rounded-[20px] font-semibold text-[16px] transition-all flex items-center justify-center gap-2 ${
                   hasTiers 
                     ? 'bg-[#1562f0] text-white hover:bg-blue-600 shadow-[0_8px_20px_rgba(21,98,240,0.25)] active:scale-[0.98]' 
                     : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                 }`}
               >
                 <Cpu size={18} /> Sign & Deploy Rules
               </button>
             </div>

           </div>
         </div>
       );
     })()}

     {/* --- JOIN NEW ALLIANCE MODAL --- */}
     {isJoinAllianceModalOpen && (
       <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
         <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsJoinAllianceModalOpen(false)}></div>
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
                .filter(id => !joinedAlliances.includes(id))
                .map(aId => {
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
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleApplyAlliance(aId)}
                          disabled={applyingAlliance === aId}
                          className={`w-full py-3 rounded-[12px] font-semibold text-[14px] transition-all flex items-center justify-center gap-2 ${
                            applyingAlliance === aId 
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                              : 'bg-black text-white hover:bg-slate-800 active:scale-[0.98]'
                          }`}
                        >
                          {applyingAlliance === aId ? (
                            <><div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin"></div> Awaiting KYB Approval...</>
                          ) : (
                            <><MessageSquare size={16} /> Apply via Beamio Chat</>
                          )}
                        </button>
                        <p className="text-[11px] text-slate-400 text-center font-medium">
                          Requires business verification (KYB) by the operator.
                        </p>
                      </div>
                    </div>
                  )
              })}
            </div>
         </div>
       </div>
     )}

     {/* --- ALLIANCE SETTLEMENT MODAL --- */}
     {isPayoutModalOpen && payoutAlliance && (() => {
       const burnAmount = settlementType === 'PAYOUT' ? settlementNetBalance : settlementConsumed;
       return (
       <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 sm:py-12 font-sans">
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => { if(payoutStep === 1) setIsPayoutModalOpen(false); }}></div>
         <div className="relative bg-[#0f1115] w-full max-w-[500px] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[40px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-white/10">
            
            {payoutStep === 1 && (
              <>
                <div className={`relative p-8 shrink-0 bg-gradient-to-b ${settlementType === 'PAYOUT' ? 'from-emerald-500/20' : 'from-rose-500/20'} to-[#0f1115] border-b border-white/5`}>
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none"></div>
                  <button onClick={() => setIsPayoutModalOpen(false)} className="absolute top-6 left-6 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white border border-white/10 transition-colors z-10"><X size={22} /></button>
                  
                  <div className="text-center mt-8 relative z-10">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      {settlementType === 'PAYOUT' ? 'Net Payout Due to You' : 'Net Remittance You Owe'}
                    </p>
                    <div className="flex items-center justify-center gap-2 mb-2">
                       <h2 className="text-4xl sm:text-[44px] font-light tracking-tight text-white leading-none">${settlementNetBalance.toFixed(2)}</h2>
                       <span className="text-xl text-white/50 font-light mt-2">CAD</span>
                    </div>
                    <p className={`text-[13px] font-medium px-3 py-1 rounded-full inline-block border ${settlementType === 'PAYOUT' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                       {alliancesDb[payoutAlliance].name}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                  <div className="flex justify-between items-center bg-white/5 rounded-[16px] p-4 border border-white/10 mb-8">
                    <div className="text-center">
                       <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Consumption</p>
                       <p className="text-[14px] font-semibold text-emerald-400">+${settlementConsumed.toFixed(2)}</p>
                    </div>
                    <div className="text-slate-600">-</div>
                    <div className="text-center">
                       <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Liabilities</p>
                       <p className="text-[14px] font-semibold text-rose-400">-${alliancesDb[payoutAlliance].topUps.toFixed(2)}</p>
                    </div>
                    <div className="text-slate-600">=</div>
                    <div className="text-center">
                       <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">{settlementType === 'PAYOUT' ? 'Net Payout' : 'Net Remittance'}</p>
                       <p className="text-[14px] font-bold text-white">${settlementNetBalance.toFixed(2)}</p>
                    </div>
                  </div>

                  <p className="text-[14px] font-medium text-slate-400 leading-relaxed text-center mb-6">
                    {settlementType === 'PAYOUT' 
                      ? `Select a settlement rail. Your ${burnAmount.toLocaleString()} ${alliancesDb[payoutAlliance].token} will be burned to clear liabilities and process your payout.`
                      : `Select a payment rail to remit the difference. Your ${burnAmount.toLocaleString()} ${alliancesDb[payoutAlliance].token} will be burned to offset liabilities.`}
                  </p>

                  <div className="space-y-4">
                    <div onClick={() => setPayoutMethod('USDC')} className={`cursor-pointer rounded-[24px] p-5 border-2 transition-all flex items-start gap-4 ${payoutMethod === 'USDC' ? 'bg-[#1562f0]/10 border-[#1562f0]' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${payoutMethod === 'USDC' ? 'bg-[#1562f0] text-white' : 'bg-white/10 text-slate-400'}`}>
                        <Coins size={20} />
                      </div>
                      <div>
                        <h4 className="text-[16px] font-bold text-white mb-1">USDC (T+0 Settlement)</h4>
                        <p className="text-[13px] font-medium text-slate-400 leading-snug">
                          {settlementType === 'PAYOUT' ? `Instant cryptographic burn. ${((settlementNetBalance / ORACLE_CAD_USDC)).toFixed(2)} USDC deposited to your Vault.` : `Funds deducted instantly from your Vault and routed to the Alliance.`}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                           <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">0% Fee</span>
                           <span className="text-[11px] font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded">Seconds</span>
                        </div>
                      </div>
                    </div>

                    <div onClick={() => setPayoutMethod('CAD')} className={`cursor-pointer rounded-[24px] p-5 border-2 transition-all flex items-start gap-4 ${payoutMethod === 'CAD' ? 'bg-emerald-500/10 border-emerald-500' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${payoutMethod === 'CAD' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-[16px] font-bold text-white mb-1">CAD Fiat (T+2 Settlement)</h4>
                        <p className="text-[13px] font-medium text-slate-400 leading-snug">
                          {settlementType === 'PAYOUT' ? 'Traditional wire transfer to your linked corporate bank account (RBC Bank *8821).' : 'Send an EFT wire transfer directly to the Alliance treasury account.'}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                           <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">3% Alliance Fee</span>
                           <span className="text-[11px] font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded">1-2 Bus. Days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8 bg-gradient-to-t from-[#0f1115] via-[#0f1115] to-transparent border-t border-white/5 shrink-0">
                  <button onClick={executeSettlement} className={`w-full text-white py-4.5 rounded-[20px] font-semibold text-[16px] transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 ${settlementType === 'PAYOUT' ? 'bg-[#1562f0] hover:bg-blue-600 shadow-[#1562f0]/25' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'}`}>
                    <Activity size={18} /> Burn {burnAmount.toLocaleString()} {alliancesDb[payoutAlliance].token} & Settle
                  </button>
                </div>
              </>
            )}

            {payoutStep === 2 && (
              <div className="h-full flex flex-col items-center justify-center p-10 animate-in fade-in">
                <div className="relative flex items-center justify-center mb-10">
                   <div className="absolute w-32 h-32 border-4 border-white/10 border-t-[#1562f0] rounded-full animate-spin"></div>
                   <div className="w-20 h-20 bg-[#1562f0]/20 rounded-full flex items-center justify-center animate-pulse">
                     <Activity size={32} className="text-[#1562f0]" />
                   </div>
                </div>
                <h3 className="text-[22px] font-bold tracking-tight text-white mb-3">Executing Smart Contract...</h3>
                <p className="text-[14px] font-medium text-slate-400 text-center max-w-xs leading-relaxed">
                  Burning {burnAmount.toLocaleString()} {alliancesDb[payoutAlliance].token} on Base L2 to offset ledger.
                </p>
              </div>
            )}

            {payoutStep === 3 && (
              <div className="h-full flex flex-col items-center justify-center p-10 animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8 border border-emerald-500/20">
                  <CheckCircle2 size={48} className="text-emerald-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-[24px] font-bold tracking-tight text-white mb-3 text-center">Ledger Cleared<br/>Successfully</h3>
                <p className="text-[14px] font-medium text-slate-400 text-center mb-10 leading-relaxed">
                  {settlementType === 'PAYOUT' ? (
                    payoutMethod === 'USDC' ? `USDC payout has been deposited to The Vault.` : `Fiat transfer has been initiated by the operator.`
                  ) : (
                    payoutMethod === 'USDC' ? `USDC remittance has been deducted from The Vault.` : `Please complete your fiat wire transfer within 24 hours.`
                  )}
                </p>
                <button onClick={() => setIsPayoutModalOpen(false)} className="w-full bg-white text-slate-900 py-4.5 rounded-[20px] font-bold text-[16px] hover:bg-slate-100 transition-all active:scale-[0.98]">
                  Done
                </button>
              </div>
            )}
         </div>
       </div>
       );
     })()}

     {/* Product Market Detail Modal */}
     {selectedProduct && (
       <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 sm:py-12 font-sans">
         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedProduct(null)}></div>
         <div className="relative bg-[#0f1115] w-full max-w-[500px] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[40px] sm:rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 border border-white/10">
            <div className={`relative h-48 sm:h-56 shrink-0 bg-gradient-to-b ${selectedProduct === 'fuel' ? 'from-orange-900/40' : selectedProduct === 'starter' ? 'from-emerald-900/40' : 'from-blue-900/40'} to-[#0f1115]`}>
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
              <button onClick={() => setSelectedProduct(null)} className="absolute top-6 left-6 p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white border border-white/10 transition-colors z-10"><X size={22} /></button>
              <div className="absolute bottom-6 left-8 right-8">
                 <span className={`inline-block px-3 py-1 rounded-[8px] text-[11px] font-bold tracking-widest uppercase mb-3 border ${
                    selectedProduct === 'fuel' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 
                    selectedProduct === 'starter' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                 }`}>
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
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                     selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 
                     selectedProduct === 'starter' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                     'bg-blue-500/10 border-blue-500/20 text-blue-500'
                  }`}>
                    {selectedProduct === 'fuel' ? <Database size={20} /> : selectedProduct === 'starter' ? <Zap size={20} /> : <Cpu size={20} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">{selectedProduct === 'fuel' ? 'Volume' : selectedProduct === 'starter' ? 'Volume' : 'Security'}</p>
                    <p className="text-[16px] font-bold text-white leading-tight">{selectedProduct === 'fuel' ? '100k B-Units' : selectedProduct === 'starter' ? '100 B-Units' : 'ATECC608 Vault'}</p>
                  </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                     selectedProduct === 'fuel' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 
                     selectedProduct === 'starter' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                     'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                  }`}>
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
                    <>
                      <div className="flex gap-4">
                        <Database size={20} className="text-orange-500 shrink-0 mt-0.5" />
                        <div><h4 className="text-[15px] font-bold text-white mb-1">100,000 B-Units Pre-load</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">System value of $1,000 USDC. Instant clearing fuel to process your daily retail volume.</p></div>
                      </div>
                    </>
                  ) : selectedProduct === 'starter' ? (
                    <>
                      <div className="flex gap-4">
                        <Zap size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div><h4 className="text-[15px] font-bold text-white mb-1">100 B-Units Pre-load</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">System value of $1 USDC. Instant AA contract deployment to unlock smart routing.</p></div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-4">
                        <Box size={20} className="text-[#1562f0] shrink-0 mt-0.5" />
                        <div><h4 className="text-[15px] font-bold text-white mb-1">Desktop API Gateway</h4><p className="text-[13px] font-medium text-slate-400 leading-relaxed">Screenless black-box design with internal 300g weights for physical stability.</p></div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 bg-gradient-to-t from-[#0f1115] via-[#0f1115] to-transparent pt-12 flex items-center justify-between border-t border-white/5">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                <div className="flex items-baseline gap-1.5"><p className="text-[32px] font-bold text-white leading-none">{selectedProduct === 'fuel' ? '499' : selectedProduct === 'starter' ? '1' : '999'}</p><span className="text-[14px] font-medium text-slate-500">USDC</span></div>
              </div>
              <button onClick={handleMarketPurchase} className={`flex items-center gap-2 px-8 py-4 rounded-[16px] font-semibold text-[16px] text-white transition-all shadow-lg active:scale-95 ${
                 selectedProduct === 'fuel' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/20' : 
                 selectedProduct === 'starter' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' : 
                 'bg-[#1562f0] hover:bg-blue-500 shadow-[#1562f0]/20'
              }`}>
                {selectedProduct === 'fuel' ? 'Secure Fuel' : selectedProduct === 'starter' ? 'Activate AA' : 'Secure Node'} <ChevronRight size={18} />
              </button>
            </div>
         </div>
       </div>
     )}
   </div>
 );

 return (
   <>
     {currentView === 'login' && renderLogin()}
     {currentView === 'loading' && renderLoading()}
     {currentView === 'dashboard' && renderDashboard()}
   </>
 );
}

