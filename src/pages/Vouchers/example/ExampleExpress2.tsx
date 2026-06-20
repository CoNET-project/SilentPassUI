import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { getMyAssetsAggregated } from '@/services/BeamioCard';
import { CCSA_Card_Address } from '@/utils/constants';
import ActiveList from '@/pages/Vouchers/ActiveList';
import {
  Wallet,
  ScanLine,
  Sparkles,
  Store,
  Gift,
  Landmark,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  Home,
  MessageCircle,
  Search,
  Zap,
  Coffee,
  CheckCircle2,
  X,
  CreditCard,
  ChevronRight,
  User,
  Ticket,
  Info,
  Coins,
  ArrowRight,
  Plus,
  Loader2,
  ChevronLeft,
  ShoppingCart,
  Utensils,
  Car,
  Music,
  Gamepad2,
  Pizza,
  Sandwich,
  Beer,
  MapPin,
  Calendar,
  QrCode,
  Crown,
  FileText,
  ShieldCheck,
  Clock,
  Fingerprint,
  Gem,
  Lock,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { tu } from '@/locale/beamioLocale'

// --- Types ---
type MarketItem = {
  id: string;
  category: string;
  name: string;
  fiatPrice: number;
  fiatCurrency: string;
  imageColor: string;
  icon: React.ReactElement;
  desc: string;
  type: string;
  topUpOptions: number[] | null;
  fullDescription?: string;
  benefits?: { title: string; desc: string; icon: React.ReactElement }[];
  terms?: string[];
  location?: string;
  date?: string;
  /** When item is in inventory (owned) */
  currentBalance?: number;
  status?: string;
};

type TransactionItem = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  amountVal: number;
  currency: string;
  walletType: string;
  date: string;
  icon: React.ReactElement;
  status?: string;
  isOutgoing: boolean;
  isVoucherDeposit?: boolean;
  voucherAmount?: number;
  secondaryAmount?: string;
};

type ViewAllCategory = { id: string; title: string } | null;

// --- Theme & Data ---
const THEME = {
  bg: '#F2F2F7',
  eoaGradient: 'linear-gradient(135deg, #0052FF 0%, #7B42F6 50%, #FA2E78 100%)',
  aaGradient: 'linear-gradient(135deg, #7B42F6 0%, #B65EBA 100%)',
  brandBlue: '#1562f0',
};

// 汇率常量： 1 CAD = 0.735 USDC
const EXCHANGE_RATE = 0.735; 

// Updated Market Items with Rich Details (Perks & Rules)
const MARKET_ITEMS = [
  // --- MEMBERSHIPS (Featured - Big Cards) ---
  {
    id: 'm1',
    category: 'membership',
    name: 'CCSA Membership',
    fiatPrice: 100,
    fiatCurrency: 'CA$',
    imageColor: 'bg-gradient-to-br from-purple-600 to-indigo-600',
    icon: <Store size={24} className="text-white" />,
    desc: 'Includes CA$100 Balance • VIP', 
    type: 'Membership',
    topUpOptions: [50, 100, 200],
    fullDescription: "Issued by the Canadian Community Service Association (CCSA). This is a dual-attribute Stored-Value Card (Identity + Payment). Purchasing this card instantly credits your account with CA$100 to spend at all alliance merchants.",
    benefits: [
      { title: "CA$100 Credit Included", desc: "Pay CA$100, get CA$100 spending power. No card fee.", icon: <Coins size={18} className="text-green-500" /> },
      { title: "One Card Access", desc: "Seamless identity verification across the ecosystem.", icon: <Fingerprint size={18} className="text-blue-500" /> },
      { title: "VIP Status", desc: "Enjoy exclusive discounts and priority services.", icon: <Crown size={18} className="text-yellow-500" /> },
      { title: "Gas Sponsored", desc: "Zero transaction fees within the network.", icon: <Zap size={18} className="text-purple-500" /> }
    ],
    terms: [
      "Issuer: Canadian Community Service Association",
      "Website: www.canadaccsa.com/ccsa",
      "Credits are valid at all participating partners.",
      "Closed Loop: Credits cannot be exchanged for cash.", // Added Rule
      "1:1 anchored to CAD value."
    ]
  },
  {
    id: 'm3',
    category: 'membership',
    name: 'Elite Golf Pass',
    fiatPrice: 500,
    fiatCurrency: 'CA$',
    imageColor: 'bg-gradient-to-br from-emerald-600 to-teal-800',
    icon: <Landmark size={24} className="text-white" />,
    desc: 'Access to 50+ Golf Courses',
    type: 'Membership',
    topUpOptions: [100, 500],
    fullDescription: "Access 50+ premier golf courses across the country with priority tee times and exclusive member rates.",
    benefits: [
      { title: "Priority Tee Times", desc: "Book up to 14 days in advance.", icon: <Clock size={18} className="text-green-200" /> },
      { title: "Guest Passes", desc: "2 Free guest passes per month.", icon: <Ticket size={18} className="text-white" /> }
    ],
    terms: ["Valid for 2026 Season.", "Non-transferable.", "No Cash Out."]
  },
  {
    id: 'm6',
    category: 'membership',
    name: 'Gamer Pro',
    fiatPrice: 60,
    fiatCurrency: 'CA$',
    imageColor: 'bg-gradient-to-br from-red-500 to-orange-600',
    icon: <Gamepad2 size={24} className="text-white" />,
    desc: 'Monthly Game Credits',
    type: 'Membership',
    topUpOptions: [60],
    fullDescription: "Level up your gaming experience. Use credits for in-game purchases and exclusive tournament entry fees.",
    benefits: [
       { title: "Tournament Entry", desc: "Free entry to weekly pro tournaments.", icon: <Gamepad2 size={18} className="text-yellow-300" /> }
    ]
  },
  
  // --- DINING (Medium List) ---
  {
    id: 'm2',
    category: 'dining',
    name: 'Starbucks',
    fiatPrice: 20,
    fiatCurrency: 'CA$',
    imageColor: 'bg-green-700',
    icon: <Coffee size={24} className="text-white" />,
    desc: 'Coffee & Snacks',
    type: 'Voucher',
    topUpOptions: [10, 20, 50],
    fullDescription: "Pre-load your Starbucks card for quick, contactless payments at any participating store. Earn stars with every sip.",
    benefits: [
      { title: "Instant Reload", desc: "Top up anytime with USDC.", icon: <Zap size={18} className="text-yellow-400" /> },
      { title: "Global Accepted", desc: "Use at 30,000+ locations.", icon: <MapPin size={18} className="text-red-400" /> }
    ]
  },
  // ... (Other items kept simple for brevity, logic applies to all)
  {
    id: 'm7', category: 'dining', name: 'Tim Hortons', fiatPrice: 15, fiatCurrency: 'CA$', imageColor: 'bg-red-700', icon: <Coffee size={24} className="text-white" />, desc: 'Coffee & Donuts', type: 'Voucher', topUpOptions: [15, 30]
  },
  {
    id: 'm8', category: 'dining', name: 'Uber Eats', fiatPrice: 25, fiatCurrency: 'CA$', imageColor: 'bg-green-900', icon: <Utensils size={24} className="text-white" />, desc: 'Food Delivery', type: 'Voucher', topUpOptions: [25, 50, 100]
  },
  {
    id: 'm4', category: 'retail', name: 'Whole Foods', fiatPrice: 50, fiatCurrency: 'CA$', imageColor: 'bg-blue-800', icon: <ShoppingCart size={24} className="text-white" />, desc: 'Organic Groceries', type: 'Voucher', topUpOptions: [50, 100]
  },
  {
    id: 'm5', category: 'services', name: 'Uber Ride', fiatPrice: 25, fiatCurrency: 'CA$', imageColor: 'bg-slate-900', icon: <Car size={24} className="text-white" />, desc: 'Ride Credits', type: 'Voucher', topUpOptions: [25, 50, 100]
  },
  
  // --- EVENTS ---
  {
    id: 't1',
    category: 'events',
    name: 'Neon City Festival',
    fiatPrice: 150,
    fiatCurrency: 'CA$',
    imageColor: 'bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500',
    icon: <Music size={24} className="text-white" />,
    desc: 'Weekend Pass • Sep 24-26',
    type: 'Ticket',
    location: 'City Stadium',
    date: 'Sep 24, 2026, 8:00 PM',
    topUpOptions: null,
    fullDescription: "The biggest electronic music festival of the year. 3 days of non-stop beats, lights, and energy. This is a commemorative NFT ticket.",
    benefits: [
        { title: "All Access", desc: "Entry to all main stages.", icon: <Ticket size={18} className="text-white"/> },
        { title: "NFT Souvenir", desc: "Includes a collectible NFT POA.", icon: <Sparkles size={18} className="text-yellow-300"/> }
    ],
    terms: [
      "Show QR code at gate for entry.",
      "One-time use only. Non-refundable.",
      "Valid only for Sep 24-26, 2026."
    ]
  }
];

const INITIAL_TRANSACTIONS = [
  {
    id: '3',
    title: 'Top-up from Main',
    subtitle: '内部转账',
    amount: '+ 150.00',
    amountVal: 150,
    currency: 'USDC',
    walletType: 'AA',
    date: '昨天',
    icon: <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><ArrowRightLeft size={18}/></div>,
    status: 'completed',
    isOutgoing: false,
  },
];

const ACTIVE_ITEMS = [];

// --- Shared Components ---

const Modal = ({ isOpen, onClose, title, children, fullScreen = false }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; fullScreen?: boolean }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} 
        />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-md bg-[#F2F2F7] overflow-hidden flex flex-col shadow-2xl ${fullScreen ? 'h-full rounded-none' : 'rounded-t-[32px] max-h-[90vh]'}`}
        >
          {fullScreen ? (
             <div className="absolute top-0 left-0 p-6 z-20">
               <button 
                 onClick={onClose} 
                 className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-700 shadow-md hover:scale-105 transition-transform"
               >
                 <ChevronLeft size={24} />
               </button>
             </div>
          ) : (
            <div className="flex justify-between items-center p-5 bg-white border-b border-slate-100">
              <span className="font-bold text-lg">{title}</span>
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>
          )}
          <div className={`${fullScreen ? 'h-full overflow-y-auto pt-6' : 'p-6 overflow-y-auto'}`}>
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const Toast = ({ message, visible }: { message: string; visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center gap-3 shadow-2xl w-max max-w-[300px]"
      >
        <CheckCircle2 size={20} className="text-green-400" />
        <span className="text-sm font-medium">{message}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

const IconButton = ({ icon, label, onClick, highlight = false }: { icon: React.ReactNode; label: string; onClick: () => void; highlight?: boolean }) => (
  <div className="flex flex-col items-center gap-2 cursor-pointer group min-w-[72px]" onClick={onClick}>
    <div className={`w-14 h-14 rounded-[20px] shadow-sm border flex items-center justify-center transition-transform active:scale-95 ${highlight ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-slate-100 text-slate-700'}`}>
      {icon}
    </div>
    <span className="text-[11px] font-semibold text-slate-500">{label}</span>
  </div>
);

// New Reusable Processing View Component
const ProcessingView = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    {/* Lock Icon with Spinner Ring */}
    <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
        <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
        <motion.div 
          className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent border-l-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <div className="relative z-10 text-blue-600"><Lock size={32} /></div>
    </div>

    <h3 className="font-bold text-xl text-slate-900 mb-2">Processing Payment</h3>
    <p className="text-slate-500 text-sm max-w-[240px] leading-relaxed mb-8">
      Please wait while we confirm your transaction...
    </p>

    {/* Network Badge */}
    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full mb-10">
        <Globe size={16} />
        <span className="text-sm font-bold">Base Network</span>
    </div>

    {/* Progress Bar */}
    <div className="w-full max-w-[200px] h-1.5 bg-slate-100 rounded-full overflow-hidden mb-12 relative">
        <motion.div 
          className="absolute top-0 bottom-0 bg-blue-600 w-1/3 rounded-full"
          animate={{ left: ["-100%", "100%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
    </div>

    {/* Footer */}
    <div className="flex items-center gap-2 text-slate-400">
        <ShieldCheck size={14} />
        <span className="text-[10px] font-bold tracking-widest uppercase">Secure Encrypted Transaction</span>
    </div>
  </div>
);

// Component for Active & Pending Items (Cashcodes / Requests)
const ActiveItemRow = ({
  title,
  subtitle,
  amount,
  status,
  statusColor,
  icon,
}: {
  title: string;
  subtitle: string;
  amount: string;
  status: string;
  statusColor: string;
  icon: React.ReactNode;
}) => (
  <div className="flex items-center justify-between p-4 bg-white active:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-0 first:rounded-t-[24px] last:rounded-b-[24px]">
    <div className="flex items-center gap-3">
      <div className="relative">
        {icon}
        {/* Status Indicator Dot */}
        <div className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
          status === 'Ready' ? 'bg-green-500' : 'bg-orange-500'
        }`} />
      </div>
      <div>
        <div className="font-bold text-[15px] text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-500 font-medium">{subtitle}</div>
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-[15px] text-slate-900">{amount} <span className="text-[11px]">USDC</span></div>
      <div className={`text-[11px] font-bold ${statusColor}`}>{status}</div>
    </div>
  </div>
);

const AssetRow = ({
  name,
  balance,
  value,
  icon,
  color,
  isVoucher = false
}: {
  name: string;
  balance: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  isVoucher?: boolean;
}) => (
  <div className="flex items-center justify-between p-4 bg-white active:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-0 first:rounded-t-[24px] last:rounded-b-[24px]">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${color} relative shadow-sm`}>
        {icon}
        {isVoucher && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center">
            <Zap size={8} className="text-yellow-900 fill-yellow-900" />
          </div>
        )}
      </div>
      <div>
        <div className="font-bold text-[15px] text-slate-900">{name}</div>
        <div className="text-[11px] text-slate-500 font-medium">
          {isVoucher ? 'Restricted Asset' : 'Base Network'}
        </div>
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-[15px] text-slate-900">{balance}</div>
      <div className="text-[11px] text-slate-400 font-medium">{value}</div>
    </div>
  </div>
);

// --- MAIN APP ---

export default function BeamioApp() {
  const [activeTab, setActiveTab] = useState('wallet'); // 'wallet' | 'market'
  const [balanceAA, setBalanceAA] = useState(145.20);
  const [balanceEOA, setBalanceEOA] = useState(5.72); // Added EOA balance
  // Initialize with EMPTY inventory to simulate new user flow
  const [inventory, setInventory] = useState<MarketItem[]>([]); 
  
  // Modals & States
  const [showPay, setShowPay] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false); // Internal Transfer
  const [showWithdraw, setShowWithdraw] = useState(false); // Withdraw Express -> Main
  const [payStep, setPayStep] = useState('scan'); // scan -> confirm -> processing -> success
  const [showBuy, setShowBuy] = useState<MarketItem | null>(null); // Selected item to buy (or top up)
  const [buyStep, setBuyStep] = useState('confirm'); // confirm -> processing -> success
  const [selectedCard, setSelectedCard] = useState<MarketItem | null>(null); // For Card Detail View
  const [detailTab, setDetailTab] = useState('activity'); // 'activity' | 'perks'
  const [selectedAmount, setSelectedAmount] = useState(0); // State for selected top-up amount
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS as TransactionItem[]);
  const [inputAmount, setInputAmount] = useState('');
  
  // NEW: Payment Method State
  const [paymentMethod, setPaymentMethod] = useState('beamio'); // 'beamio' | 'credit_card'
  
  // NEW: State for Viewing All Items in a Category
  const [viewAllCategory, setViewAllCategory] = useState<ViewAllCategory>(null);

  const { profiles } = useDaemonContext();
  const navigate = useNavigate();
  const [smartAccountCardAssets, setSmartAccountCardAssets] = useState<MyCardAssets | null>(null);

  // 拉取 CCSA 卡资产，供 ActiveList 展示活动（与 MyWalletDashboard Tab 2 一致）
  useEffect(() => {
    if (activeTab !== 'wallet' || !profiles?.[0]) return;
    getMyAssetsAggregated(profiles[0])
      .then((assets) => { if (assets) setSmartAccountCardAssets(assets); })
      .catch(() => setSmartAccountCardAssets(null));
  }, [activeTab, profiles]);

  // Update selectedAmount when showBuy changes
  useEffect(() => {
    if (showBuy) {
      // Default to the base price
      setSelectedAmount(showBuy.fiatPrice);
      setBuyStep('confirm'); // Reset step when opening modal
      setPaymentMethod('beamio'); // Default method
    }
  }, [showBuy]);

  // Reset tab when opening card details
  useEffect(() => {
    if (selectedCard) {
      // If we don't own it, we should probably check that first? 
      // Actually setSelectedCard is mostly for owned items or preview.
      // But in this new flow, we use setSelectedCard for ALL items.
      const isOwned = inventory.some(i => i.id === selectedCard.id);
      // If not owned, default to showing info (Perks), otherwise Activity.
      // Tickets default to Perks (Details) always.
      setDetailTab((isOwned && selectedCard.type !== 'Ticket') ? 'activity' : 'perks');
    }
  }, [selectedCard, inventory]);

  const showToastMsg = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const ORACLE_RATE = 0.74; // For consistency
  const DISPLAY_RATE = 0.735; // For consistency

  // Helper to block negative inputs
  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (['-', 'e', 'E', '+'].includes(e.key)) {
      e.preventDefault();
    }
  };

  // --- LOGIC: REDEEM TICKET ---
  const handleTicketScan = () => {
    // Simulate redeeming a ticket
    if (selectedCard && selectedCard.type === 'Ticket') {
        const updatedInventory = inventory.map(i => {
            if (i.id === selectedCard.id) {
                return { ...i, status: 'USED' };
            }
            return i;
        });
        setInventory(updatedInventory);
        
        // Add Tx Record
        setTransactions([
          {
            id: Date.now().toString(),
            title: selectedCard.name,
            subtitle: 'Ticket Redeemed',
            amount: '0.00',
            amountVal: 0,
            isVoucherDeposit: false,
            currency: 'USDC',
            walletType: 'AA',
            date: '刚刚',
            icon: selectedCard.icon,
            status: 'completed',
            isOutgoing: true,
          },
          ...transactions
        ]);
        
        showToastMsg("Ticket Redeemed Successfully");
    }
  }

  // --- LOGIC: BUY / TOP-UP VOUCHER ---
  const handleBuyVoucher = (item: MarketItem, amountToBuy: number | undefined, method: string) => {
    const purchaseAmount = amountToBuy || item.fiatPrice;
    
    // Calculate USDC cost if using Beamio Wallet
    const usdcCost = purchaseAmount * EXCHANGE_RATE;
    
    if (method === 'beamio') {
        if (balanceAA < usdcCost) {
            showToastMsg('Insufficient USDC Balance');
            return;
        }
    }
    
    setBuyStep('processing');

    // Simulate transaction
    setTimeout(() => {
      // Deduct only if paying with Beamio Wallet
      if (method === 'beamio') {
          setBalanceAA(prev => prev - usdcCost);
      }
      
      // Check if user already owns this voucher type
      const existingItemIndex = inventory.findIndex(i => i.id === item.id);
      
      const paymentSourceLabel = method === 'beamio' ? 'USDC' : 'Credit Card';
      
      if (existingItemIndex >= 0 && item.type !== 'Ticket') { // Tickets are usually unique instances
        // TOP-UP LOGIC: Update balance of existing card
        const updatedInventory = [...inventory];
        const currentBalance = updatedInventory[existingItemIndex].currentBalance || updatedInventory[existingItemIndex].fiatPrice;
        
        updatedInventory[existingItemIndex] = {
          ...updatedInventory[existingItemIndex],
          currentBalance: currentBalance + purchaseAmount
        };
        setInventory(updatedInventory);
        
        // Add transaction record for Top-up
        setTransactions([
          {
            id: Date.now().toString(),
            title: item.name,
            subtitle: `Card Top-up (${paymentSourceLabel})`,
            amount: method === 'beamio' ? '-' + usdcCost.toFixed(2) : '0.00', // Wallet USDC change
            amountVal: method === 'beamio' ? -usdcCost : 0,
            voucherAmount: purchaseAmount, // Card sees Fiat Addition (Positive)
            isVoucherDeposit: true, // Flag for green styling in card history
            currency: 'USDC',
            walletType: 'AA',
            date: '刚刚',
            icon: item.icon,
            isOutgoing: true, 
          },
          ...transactions
        ]);

      } else {
        // NEW PURCHASE LOGIC
        // Ticket logic handled slightly differently (always new instance)
        const newItem = { 
            ...item, 
            instanceId: Date.now(), 
            currentBalance: purchaseAmount,
            status: 'Active' // For tickets: Active -> Used
        };
        setInventory([...inventory, newItem]);
        
        // Add transaction record for Purchase
        setTransactions([
          {
            id: Date.now().toString(),
            title: item.name,
            subtitle: item.type === 'Ticket' ? 'Ticket Purchase' : `Membership Purchase (${paymentSourceLabel})`,
            amount: method === 'beamio' ? '-' + usdcCost.toFixed(2) : '0.00',
            amountVal: method === 'beamio' ? -usdcCost : 0,
            voucherAmount: item.type === 'Ticket' ? 0 : purchaseAmount, // Tickets don't have "balance"
            isVoucherDeposit: item.type !== 'Ticket',
            currency: 'USDC',
            walletType: 'AA',
            date: '刚刚',
            icon: item.icon,
            isOutgoing: true,
          },
          ...transactions
        ]);
      }
      
      setBuyStep('success'); // Move to success step instead of closing
    }, 2000); // Increased timeout for processing view
  };

  // --- LOGIC: SMART PAYMENT (Express Pay) ---
  const handleSmartPay = () => {
    setPayStep('processing');
    setTimeout(() => {
      const hasMembership = inventory.find(i => i.name === 'CCSA Membership');
      let usdcDeducted = 0;
      let voucherDeducted = 0;
      
      if (hasMembership) {
        const availableBalance = hasMembership.currentBalance || hasMembership.fiatPrice;
        const billAmount = 120; // 120 CAD
        
        if (availableBalance >= billAmount) {
           voucherDeducted = billAmount;
           const updatedInventory = inventory.map(i => {
             if (i.id === hasMembership.id) {
               return { ...i, currentBalance: availableBalance - billAmount };
             }
             return i;
           });
           setInventory(updatedInventory);
           usdcDeducted = 0;
        } else {
           voucherDeducted = availableBalance;
           const remainingBill = billAmount - availableBalance;
           usdcDeducted = remainingBill * EXCHANGE_RATE; 
           const updatedInventory = inventory.map(i => {
             if (i.id === hasMembership.id) {
               return { ...i, currentBalance: 0 };
             }
             return i;
           });
           setInventory(updatedInventory);
           setBalanceAA(prev => prev - usdcDeducted);
        }
      } else {
        usdcDeducted = 120 * EXCHANGE_RATE;
        setBalanceAA(prev => prev - usdcDeducted); 
      }
      
      setPayStep('success');
      setTransactions([
        {
          id: Date.now().toString(),
          title: '商户支付',
          subtitle: '@CityGolfClub',
          amount: '-' + usdcDeducted.toFixed(2),
          amountVal: -usdcDeducted,
          voucherAmount: -voucherDeducted, 
          currency: 'USDC',
          secondaryAmount: hasMembership ? `- CA$ ${voucherDeducted.toFixed(2)} Voucher` : undefined,
          walletType: 'AA',
          date: '刚刚',
          icon: <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white"><Store size={18}/></div>,
          status: 'completed',
          isOutgoing: true,
        },
        ...transactions
      ]);
    }, 2000); // Increased timeout for processing view
  };

  // --- LOGIC: WITHDRAW EXPRESS -> MAIN ---
  const handleWithdrawToMain = () => {
    const amount = parseFloat(inputAmount);
    if (!amount || amount <= 0) return;
    if (balanceAA < amount) {
      showToastMsg('Insufficient funds in Express Pay');
      return;
    }
    setBalanceAA(prev => prev - amount);
    setBalanceEOA(prev => prev + amount); 
    setShowWithdraw(false);
    setInputAmount('');
    showToastMsg(`Transferred ${amount} USDC to Main Wallet`);
    setTransactions([
      {
        id: Date.now().toString(),
        title: 'Transfer to Main',
        subtitle: '内部转账',
        amount: '-' + amount.toFixed(2),
        amountVal: -amount,
        currency: 'USDC',
        walletType: 'AA',
        date: '刚刚',
        icon: <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><ArrowRightLeft size={18}/></div>,
        status: 'completed',
        isOutgoing: true,
      },
      ...transactions
    ]);
  };

  const getPurchaseTitle = (item: MarketItem) => {
    if (buyStep === 'success') return 'Success';
    const isOwned = inventory.some(i => i.id === item.id);
    return (isOwned && item.type !== 'Ticket') ? `Top Up ${item.name}` : 'Purchase';
  };

  const getCardTransactions = (cardName: string) => {
    return transactions.filter(tx => {
       const isDirectMatch = tx.title.includes(cardName);
       const isVoucherUse = tx.secondaryAmount && tx.secondaryAmount.includes('Voucher') && cardName.includes('CCSA'); 
       return isDirectMatch || isVoucherUse;
    });
  };

  // Helper to render Market Sections
  const MarketSection = ({ title, category, limit = 5 }: { title: string; category: string; limit?: number }) => {
    const items = MARKET_ITEMS.filter(i => i.category === category);
    const displayedItems = items.slice(0, limit);
    const hasMore = items.length > limit;

    return (
      <div className="mb-8">
        <div className="px-6 mb-3 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
          {hasMore && (
            <span 
              onClick={() => setViewAllCategory({ id: category, title })}
              className="text-xs text-blue-600 font-bold cursor-pointer hover:underline"
            >{tu('view_all')}</span>
          )}
        </div>
        
        <div className="flex overflow-x-auto px-6 gap-3 no-scrollbar pb-4">
          {displayedItems.map((item) => (
            <div key={item.id} className="min-w-[160px] bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3 active:scale-[0.95] transition-transform cursor-pointer" onClick={() => setSelectedCard(item)}>
              <div className={`w-12 h-12 rounded-xl ${item.imageColor} flex items-center justify-center shadow-md`}>{item.icon}</div>
              <div><h4 className="font-bold text-slate-900 text-sm truncate">{item.name}</h4><span className="text-xs font-bold text-slate-500">{item.fiatCurrency} {item.fiatPrice}</span></div>
            </div>
          ))}
          {hasMore && (
             <div onClick={() => setViewAllCategory({ id: category, title })} className="min-w-[100px] bg-slate-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform border border-dashed border-slate-300">
               <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm"><ArrowRight size={20} /></div>
               <span className="text-xs font-bold text-slate-400">More</span>
             </div>
          )}
        </div>
      </div>
    );
  };

  // --- VIEWS ---

  const WalletView = () => (
    <div className="flex-1 overflow-y-auto pb-24 pt-12 px-0">
      <div className="px-6 pb-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">我的钱包</h1>
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">EOA</div>
      </div>

      {/* Express Pay Card */}
      <div className="px-4 mb-6">
        <div className="w-full aspect-[1.6/1] rounded-[32px] p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between" style={{ background: THEME.aaGradient }}>
          <div className="flex justify-between items-start z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                 {/* Updated Icon to match EOA (Coins) */}
                 <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <div className="w-2.5 h-[2px] bg-blue-600 rounded-full"></div>
                 </div>
              </div>
              <span className="text-lg font-medium tracking-wide">快捷支付</span>
            </div>
            {/* Updated Badge to match EOA (Sparkles) */}
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
              <Sparkles size={10} className="text-yellow-300 fill-yellow-300" />
              <span className="text-[10px] font-bold">Gas Sponsored</span>
            </div>
          </div>
          <div className="z-10 flex flex-col items-center justify-center flex-1 mt-4">
            <div className="text-6xl font-bold tracking-tighter flex items-baseline gap-2">
              {balanceAA.toFixed(2)} <span className="text-2xl font-bold opacity-80 tracking-[0.2em]">USDC</span>
            </div>
            {/* Added Fiat Value */}
            <div className="text-white/80 text-lg font-normal mt-2">≈ CA$ {(balanceAA / EXCHANGE_RATE).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Action Grid */}
      <div className="px-6 mb-8 flex gap-4 justify-center">
        {/* Updated Transfer Action */}
        <IconButton icon={<ArrowRightLeft size={24} className="text-purple-600" />} label="Transfer" onClick={() => setShowWithdraw(true)} />
        <IconButton icon={<ScanLine size={24} className="text-white" />} label="Payment" highlight onClick={() => { setPayStep('scan'); setShowPay(true); }} />
        {/* 'Voucher' button here links to Market tab visually or structurally */}
        <IconButton icon={<Ticket size={24} className="text-purple-600" />} label="Vouchers" onClick={() => setActiveTab('market')} />
      </div>

      {/* Assets List (Financial View) */}
      <div className="px-4 mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-600"></div>
          Account Assets
        </div>
        <div className="bg-white rounded-[24px] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">$</div>
              <div><div className="font-bold text-slate-900">USDC</div><div className="text-xs text-slate-500">Base Network</div></div>
            </div>
            <div className="text-right font-bold text-slate-900">{balanceAA.toFixed(2)}</div>
          </div>
          
          {/* Dynamically show owned vouchers as assets */}
          {inventory.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${item.type === 'Ticket' ? 'bg-pink-100 text-pink-500' : 'bg-green-100 text-green-700'}`}>
                    {item.type === 'Ticket' ? <Ticket size={16} /> : 'V'}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{item.name}</div>
                  <div className="text-xs text-slate-500">
                    {item.type === 'Ticket' ? '1 Pass' : `Balance: ${item.fiatCurrency} ${(item.currentBalance !== undefined ? item.currentBalance : item.fiatPrice).toFixed(2)}`}
                  </div>
                </div>
              </div>
              <div className={`text-right text-xs font-bold ${item.status === 'USED' ? 'text-slate-400' : 'text-green-600'}`}>
                  {item.status || 'Active'}
              </div>
            </div>
          ))}
          
          {inventory.length === 0 && (
            <div className="p-4 text-center text-slate-400 text-sm">暂无优惠券，请前往市场购买。</div>
          )}
        </div>
      </div>

      {/* Smart Account HISTORY（与 CardItem 中 ActiveList 一致） */}
      <div className="mt-4 mb-8">
        <div className="px-5">
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-700">HISTORY</span>
            <button
              type="button"
              onClick={() => navigate('/HistoryAll')}
              className="text-[12px] font-semibold text-violet-600 active:opacity-70"
            >{tu('view_all')}</button>
          </div>
          <div>
            <ActiveList
              MyCardAssets={
                smartAccountCardAssets ?? {
                  address: '',
                  cardAddress: CCSA_Card_Address,
                  points: '0',
                  cardOwner: null,
                  cardCurrency: 'USDC',
                  nfts: [],
                }
              }
              onItemClick={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const MarketView = () => (
    <div className="flex-1 overflow-y-auto pb-24 pt-12 px-0 bg-[#F2F2F7]">
      <div className="px-6 pb-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">市场</h1>
        <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-600">
          <Search size={20} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 mb-6 overflow-x-auto no-scrollbar flex gap-2">
         {['全部', 'Memberships', 'Events', 'Dining', 'Retail', 'Services'].map(cat => (
           <button 
             key={cat}
             onClick={() => setViewAllCategory(cat === '全部' ? null : { id: cat.toLowerCase(), title: cat })}
             className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
               false // Simple mock filter, real filter logic would be here
               ? 'bg-slate-900 text-white' 
               : 'bg-white text-slate-500 hover:bg-slate-50'
             }`}
           >
             {cat}
           </button>
         ))}
      </div>

      {/* 1. My Cards (Visual Stack) */}
      <div className="mb-8">
        <div className="px-6 mb-3 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">My Cards</h3>
          <span className="text-xs text-blue-600 font-bold">Manage</span>
        </div>
        
        {inventory.length > 0 ? (
          <div className="flex overflow-x-auto px-6 gap-4 no-scrollbar pb-4">
            {inventory.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedCard(item)}
                className={`min-w-[280px] h-[160px] rounded-2xl ${item.imageColor} p-5 text-white shadow-lg flex flex-col justify-between relative overflow-hidden group cursor-pointer active:scale-95 transition-transform`}
              >
                <div className="flex justify-between items-start z-10">
                  <span className="font-bold text-lg opacity-90">{item.name}</span>
                  {item.icon}
                </div>
                
                {/* Balance Display on Card */}
                {item.type === 'Ticket' ? (
                    <div className="z-10">
                       <div className="text-white/80 text-xs uppercase tracking-wide">Status</div>
                       <div className="text-3xl font-bold tracking-widest">{item.status === 'USED' ? 'USED' : 'ADMIT ONE'}</div>
                    </div>
                ) : (
                    <div className="z-10">
                       <div className="text-white/80 text-xs uppercase tracking-wide">余额</div>
                       <div className="text-2xl font-bold">
                         {item.fiatCurrency} {(item.currentBalance !== undefined ? item.currentBalance : item.fiatPrice).toFixed(2)}
                       </div>
                    </div>
                )}

                <div className="z-10 flex justify-between items-end">
                  <span className="text-sm opacity-80 font-mono">**** 8829</span>
                </div>
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mx-6 p-6 bg-white rounded-2xl border border-dashed border-slate-300 text-center">
            <Ticket className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-slate-400 text-sm">Your card wallet is empty.</p>
          </div>
        )}
      </div>

      {/* 2. Featured Sections */}
      <div className="px-6 mb-3"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Premier Access</h3></div>
      <div className="flex overflow-x-auto px-6 gap-4 no-scrollbar pb-8">
        {MARKET_ITEMS.filter(i => i.category === 'membership').map((item, idx) => (
          <div key={idx} onClick={() => setSelectedCard(item)} className={`min-w-[280px] h-[160px] rounded-2xl ${item.imageColor} p-5 text-white shadow-lg flex flex-col justify-between relative overflow-hidden group cursor-pointer active:scale-95 transition-transform`}>
            <div className="flex justify-between items-start z-10"><span className="font-bold text-lg opacity-90">{item.name}</span>{item.icon}</div>
            <div className="z-10"><div className="text-white/80 text-xs">Price</div><div className="text-2xl font-bold">{item.fiatCurrency} {item.fiatPrice}</div></div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          </div>
        ))}
      </div>

      {/* Events & Tickets */}
      <MarketSection title="Events & Tickets" category="events" />

      {/* Reusable Market Sections */}
      <MarketSection title="Dining Rewards" category="dining" />
      <MarketSection title="Retail" category="retail" />
      <MarketSection title="Services" category="services" />
      
      <div className="h-24"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-[#F2F2F7] font-sans relative overflow-hidden text-slate-900 border-x border-slate-200" style={{ background: THEME.bg }}>
      <Toast visible={toast.show} message={toast.msg} />
      {activeTab === 'wallet' ? <WalletView /> : <MarketView />}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 px-6 py-4 pb-8 flex justify-between items-center z-40 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] max-w-md mx-auto">
        <div onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-400'}`}><Home size={24} /></div>
        <div onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === 'wallet' ? 'text-blue-600' : 'text-slate-400'}`}><Wallet size={24} className={activeTab === 'wallet' ? 'fill-blue-600' : ''} /></div>
        <div className="-mt-8 cursor-pointer" onClick={() => { setActiveTab('wallet'); setShowPay(true); setPayStep('scan'); }}><div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-200 border-4 border-[#F2F2F7]"><ScanLine size={24} className="text-white" /></div></div>
        <div onClick={() => setActiveTab('market')} className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${activeTab === 'market' ? 'text-blue-600' : 'text-slate-400'}`}><ShoppingBag size={24} className={activeTab === 'market' ? 'fill-blue-600' : ''} /></div>
        <div className="flex flex-col items-center gap-1 text-slate-400 cursor-pointer"><MessageCircle size={24} /></div>
      </div>

      {/* CARD DETAIL / PRODUCT DETAIL MODAL */}
      <Modal isOpen={!!selectedCard} onClose={() => setSelectedCard(null)} title={inventory.some(i => i.id === selectedCard?.id) ? "Card Details" : "Product Details"} fullScreen={true}>
        {selectedCard && (
          <div className="pt-12 px-6">
            <div className={`w-full aspect-[1.6/1] rounded-2xl ${selectedCard.imageColor} p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between mb-8`}>
              <div className="flex justify-between items-start z-10"><span className="font-bold text-2xl opacity-90">{selectedCard.name}</span>{selectedCard.icon}</div>
              {selectedCard.type === 'Ticket' ? (
                <div className="z-10">
                   <div className="text-white/80 text-xs uppercase tracking-wide">Event Date</div>
                   <div className="text-xl font-bold">{selectedCard.date}</div>
                   <div className="text-sm opacity-80 mt-1 flex items-center gap-1"><MapPin size={12}/> {selectedCard.location}</div>
                </div>
              ) : (
                <div className="z-10">
                   {/* Logic to show Balance if owned, Price if not owned */}
                   {inventory.some(i => i.id === selectedCard.id) ? (
                       <>
                        <div className="text-white/80 text-xs uppercase tracking-wide">余额</div>
                        <div className="text-3xl font-bold">{selectedCard.fiatCurrency} {(selectedCard.currentBalance !== undefined ? selectedCard.currentBalance : selectedCard.fiatPrice).toFixed(2)}</div>
                         {/* Add Restriction Text */}
                         <div className="text-white/60 text-[10px] font-medium mt-1 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                            Closed Loop • Consumption Only
                         </div>
                       </>
                   ) : (
                       <>
                        <div className="text-white/80 text-xs uppercase tracking-wide">Price</div>
                        <div className="text-3xl font-bold">{selectedCard.fiatCurrency} {selectedCard.fiatPrice}</div>
                       </>
                   )}
                </div>
              )}
              <div className="z-10 flex justify-between items-end">
                  <span className="text-sm opacity-80 font-mono">**** 8829</span>
                  {/* Show Top Up only if owned and not a ticket */}
                  {inventory.some(i => i.id === selectedCard.id) && selectedCard.type !== 'Ticket' && (
                     <button onClick={(e) => { e.stopPropagation(); setShowBuy(selectedCard); }} className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1"><Plus size={16} /> Top Up</button>
                  )}
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-3xl" />
            </div>

            {/* TAB SWITCHER OR INFO ONLY */}
            {inventory.some(i => i.id === selectedCard.id) && selectedCard.type !== 'Ticket' ? (
                <div className="flex gap-4 mb-6 border-b border-slate-200">
                    <button 
                        onClick={() => setDetailTab('activity')}
                        className={`pb-3 text-sm font-bold px-2 relative ${detailTab === 'activity' ? 'text-blue-600' : 'text-slate-400'}`}
                    >
                        Activity
                        {detailTab === 'activity' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                    </button>
                    <button 
                        onClick={() => setDetailTab('perks')}
                        className={`pb-3 text-sm font-bold px-2 relative ${detailTab === 'perks' ? 'text-blue-600' : 'text-slate-400'}`}
                    >
                        Perks & Rules
                        {detailTab === 'perks' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                    </button>
                </div>
            ) : (
                // If not owned, just show header "Product Info" or similar, or nothing if we want clean look
                <div className="mb-6"><h4 className="font-bold text-slate-900 flex items-center gap-2"><Info size={18} className="text-slate-400"/> Product Details</h4></div>
            )}

            {/* CONTENT AREA */}
            <div className="pb-24"> 
                {/* TICKET VIEW (Always just one view if owned) */}
                {selectedCard.type === 'Ticket' && inventory.some(i => i.id === selectedCard.id) ? (
                     <div className="bg-white rounded-3xl p-6 shadow-lg mb-8 flex flex-col items-center">
                        {/* Simulation Button for Redemption */}
                         {selectedCard.status !== 'USED' ? (
                             <>
                                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Scan for Entry</div>
                                <div className="w-48 h-48 bg-slate-900 rounded-xl flex items-center justify-center mb-4">
                                    <QrCode size={160} className="text-white" />
                                </div>
                                <div className="text-slate-900 font-mono text-lg font-bold tracking-widest">A4F9-22K9</div>
                                
                                <button 
                                  onClick={handleTicketScan}
                                  className="mt-6 bg-slate-100 text-slate-500 text-xs font-bold px-4 py-2 rounded-full hover:bg-slate-200 transition-colors"
                                >
                                  Simulate Entry Scan (Debug)
                                </button>
                             </>
                         ) : (
                             <div className="text-center py-8">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                   <CheckCircle2 size={40} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-400">Ticket Used</h3>
                                <p className="text-xs text-slate-400 mt-2">Enjoy the event!</p>
                             </div>
                         )}
                    </div>
                ) : (
                    // MEMBERSHIP VIEW (Tabs or Info)
                    <>
                        {/* ACTIVITY TAB (Only if owned) */}
                        {inventory.some(i => i.id === selectedCard.id) && detailTab === 'activity' ? (
                            <div className="bg-white rounded-[24px] overflow-hidden mb-8 shadow-sm">
                              {getCardTransactions(selectedCard.name).length > 0 ? (
                                 getCardTransactions(selectedCard.name).map((tx) => (
                                    <motion.div 
                                      initial={{ opacity: 0 }} 
                                      animate={{ opacity: 1 }}
                                      key={tx.id} 
                                      className="flex justify-between items-center p-4 border-b border-slate-100 last:border-0"
                                    >
                                      <div className="flex items-center gap-3">
                                         <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.isVoucherDeposit ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'}`}>
                                           {tx.isVoucherDeposit ? <Plus size={18} /> : <ArrowUpRight size={18} />}
                                         </div>
                                         <div>
                                           <div className="font-bold text-sm text-slate-900">{tx.title}</div>
                                           <div className="text-xs text-slate-500">{tx.date}</div>
                                         </div>
                                      </div>
                                      <div className={`font-bold text-sm ${tx.isVoucherDeposit ? 'text-green-600' : 'text-slate-900'}`}>
                                        {/* Logic for +/- based on voucherAmount */}
                                        {tx.voucherAmount !== undefined ? (
                                            <>
                                                {tx.voucherAmount > 0 ? '+' : '-'} {selectedCard.fiatCurrency} {Math.abs(tx.voucherAmount).toFixed(2)}
                                            </>
                                        ) : (
                                            /* Fallback for older data */
                                            <>
                                                {tx.isVoucherDeposit ? '+' : '-'} {selectedCard.fiatCurrency} {Math.abs(tx.amountVal / EXCHANGE_RATE).toFixed(2)}
                                            </>
                                        )}
                                      </div>
                                    </motion.div>
                                 ))
                              ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">No recent activity.</div>
                              )}
                            </div>
                        ) : (
                            // PERKS/INFO TAB (Default for Not Owned)
                            <div className="space-y-6">
                                {/* Description */}
                                <div className="bg-white p-5 rounded-2xl shadow-sm">
                                    <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><Info size={16} className="text-blue-500"/> About</h4>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        {selectedCard.fullDescription || selectedCard.desc}
                                    </p>
                                </div>

                                {/* Benefits */}
                                {selectedCard.benefits && (
                                    <div className="bg-white p-5 rounded-2xl shadow-sm">
                                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Crown size={16} className="text-purple-500"/> Member Benefits</h4>
                                        <div className="space-y-4">
                                            {selectedCard.benefits.map((b, idx) => (
                                                <div key={idx} className="flex gap-3">
                                                    <div className="mt-0.5">{b.icon}</div>
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-800">{b.title}</div>
                                                        <div className="text-xs text-slate-500">{b.desc}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Terms */}
                                {selectedCard.terms && (
                                    <div className="bg-white p-5 rounded-2xl shadow-sm">
                                        <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><FileText size={16} className="text-slate-500"/> Terms & Rules</h4>
                                        <ul className="list-disc list-outside ml-4 space-y-2">
                                            {selectedCard.terms.map((t, idx) => (
                                                <li key={idx} className="text-xs text-slate-500 pl-1">{t}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* BOTTOM ACTION BUTTON - In Flow */}
                {!inventory.some(i => i.id === selectedCard.id) && (
                    <div className="mt-8"> {/* Added margin top for spacing */}
                        <button 
                        onClick={() => {
                            setShowBuy(selectedCard);
                        }} 
                        className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
                        style={{ backgroundColor: THEME.brandBlue }}
                        >
                        <Sparkles size={20} className="fill-white/20" />
                        Purchase for {selectedCard.fiatCurrency} {selectedCard.fiatPrice}
                        </button>
                    </div>
                )}
                {/* REMOVE BUTTON - In Flow */}
                {inventory.some(i => i.id === selectedCard.id) && (
                    <button className="w-full py-4 text-slate-400 font-bold text-sm mt-8">
                        Remove Card
                    </button>
                )}
            </div>
            
          </div>
        )}
      </Modal>

      {/* --- MODAL: CATEGORY ALL VIEW --- */}
      <Modal isOpen={!!viewAllCategory} onClose={() => setViewAllCategory(null)} title={viewAllCategory?.title || 'All Items'} fullScreen={true}>
          <div className="pt-16 px-4 pb-24 grid grid-cols-2 gap-4">
             {MARKET_ITEMS.filter(i => i.category === viewAllCategory?.id).map((item) => (
                <div key={item.id} onClick={() => { setViewAllCategory(null); setSelectedCard(item); }} className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center text-center gap-3 active:scale-[0.95] transition-transform cursor-pointer">
                  <div className={`w-16 h-16 rounded-xl ${item.imageColor} flex items-center justify-center shadow-md`}>{item.icon}</div>
                  <div><h4 className="font-bold text-slate-900 text-sm truncate w-full">{item.name}</h4><span className="text-xs font-bold text-slate-500">{item.fiatCurrency} {item.fiatPrice}</span></div>
                  <button className="bg-slate-100 text-slate-600 rounded-lg w-full py-2 flex items-center justify-center hover:bg-slate-200 transition-colors text-xs font-bold">Details</button>
                </div>
             ))}
          </div>
      </Modal>

      {/* BUY/TOPUP MODAL */}
      <Modal isOpen={!!showBuy} onClose={() => { setShowBuy(null); setBuyStep('confirm'); }} title={showBuy ? getPurchaseTitle(showBuy) : 'Purchase'}>
        {showBuy && (
          <div className="flex flex-col gap-6">
            {buyStep === 'confirm' && (
              <>
                <div className="text-center">
                  <div className={`w-20 h-20 mx-auto rounded-2xl ${showBuy.imageColor} flex items-center justify-center shadow-lg mb-4`}>{showBuy.icon}</div>
                  <h3 className="text-xl font-bold text-slate-900">{showBuy.name}</h3>
                  <p className="text-slate-500 text-sm mt-1">{showBuy.desc}</p>
                </div>

                {/* Top-up Options */}
                {showBuy.topUpOptions && inventory.some(i => i.id === showBuy.id) && showBuy.type !== 'Ticket' && (
                  <div className="flex gap-2 justify-center mb-4">
                     {showBuy.topUpOptions.map(amt => (
                        <button key={amt} onClick={() => setSelectedAmount(amt)} className={`px-4 py-2 rounded-xl border text-sm font-bold transition-colors ${selectedAmount === amt ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{showBuy.fiatCurrency} {amt}</button>
                     ))}
                  </div>
                )}
                
                {/* Payment Method Selector */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">支付方式</h4>
                  <div className="space-y-3">
                    {/* Beamio Wallet */}
                    <div 
                      onClick={() => setPaymentMethod('beamio')}
                      className={`border bg-blue-50/50 rounded-xl p-4 flex items-center justify-between cursor-pointer transition-colors ${paymentMethod === 'beamio' ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200'}`}
                    >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white"><Coins size={20} /></div>
                          <div><div className="font-bold text-slate-900 text-sm">Beamio Wallet</div><div className="text-xs text-slate-500">Balance: {balanceAA.toFixed(2)} USDC</div></div>
                        </div>
                        {paymentMethod === 'beamio' && <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><CheckCircle2 size={12} className="text-white" /></div>}
                    </div>
                    {/* Credit Card (Enabled) */}
                    <div 
                       onClick={() => setPaymentMethod('credit_card')}
                       className={`border bg-white rounded-xl p-4 flex items-center justify-between cursor-pointer transition-colors ${paymentMethod === 'credit_card' ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200'}`}
                    >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><CreditCard size={20} /></div>
                          <div><div className="font-bold text-slate-900 text-sm">Credit Card</div><div className="text-xs text-slate-500">via Stripe Secure</div></div>
                        </div>
                        {paymentMethod === 'credit_card' && <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><CheckCircle2 size={12} className="text-white" /></div>}
                    </div>
                  </div>
                </div>

                {/* Exchange Rate Info - Only show for Beamio Wallet (USDC) */}
                {paymentMethod === 'beamio' && (
                  <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-2">
                      <div className="flex justify-between"><span className="text-slate-500">汇率</span><span className="font-mono text-slate-700">1 CAD ≈ {EXCHANGE_RATE.toFixed(4)} USDC</span></div>
                      <div className="flex justify-between font-bold text-sm"><span className="text-slate-900">You Pay</span><span className="text-blue-600">{(selectedAmount * EXCHANGE_RATE).toFixed(4)} USDC</span></div>
                      <div className="text-[10px] text-slate-400 text-right">Via Coinbase Oracle</div>
                  </div>
                )}

                <button 
                  onClick={() => handleBuyVoucher(showBuy, selectedAmount, paymentMethod)} 
                  className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ backgroundColor: THEME.brandBlue }}
                >
                   <Sparkles size={20} className="fill-white/20" />
                   {paymentMethod === 'beamio' 
                     ? `Pay ${(selectedAmount * EXCHANGE_RATE).toFixed(4)} USDC`
                     : `Pay ${showBuy.fiatCurrency} ${selectedAmount.toFixed(2)}`
                   }
                </button>
                <p className="text-center text-[10px] text-slate-400">Secure encrypted transaction</p>
              </>
            )}
            {/* ... Processing Step using New Component ... */}
            {buyStep === 'processing' && <ProcessingView />}
            {buyStep === 'success' && <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20 }} className="py-4 flex flex-col items-center"><div className={`w-full aspect-[1.6/1] rounded-2xl ${showBuy.imageColor} p-6 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between mb-8`}><div className="flex justify-between items-start z-10"><span className="font-bold text-2xl opacity-90">{showBuy.name}</span>{showBuy.icon}</div>
                {/* Logic for Success Card Display */}
                {showBuy.type === 'Ticket' ? (
                   <div className="z-10"><div className="text-white/80 text-xs uppercase tracking-wide">Status</div><div className="text-3xl font-bold tracking-widest">ADMIT ONE</div></div>
                ) : (
                   <div className="z-10"><div className="text-white/80 text-xs uppercase tracking-wide">Current Balance</div><div className="text-3xl font-bold">{showBuy.fiatCurrency} {selectedAmount.toFixed(2)}</div></div>
                )}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-3xl" /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">{inventory.some(i => i.id === showBuy.id) ? 'Top-up Successful!' : 'Added to My Cards'}</h2><button onClick={() => { setShowBuy(null); setBuyStep('confirm'); setSelectedCard(null); /* Close all */ }} className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-xl active:scale-[0.98]">完成</button></motion.div>}
          </div>
        )}
      </Modal>

      {/* WITHDRAW & PAY MODALS - (Kept same logic) */}
      <Modal isOpen={showWithdraw} onClose={() => setShowWithdraw(false)} title="Transfer to Main Wallet"><div className="flex flex-col gap-6"><div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between"><div className="text-left"><div className="text-xs font-bold text-slate-400 uppercase">From</div><div className="font-bold">快捷支付</div></div><ArrowRight size={20} className="text-slate-300" /><div className="text-right"><div className="text-xs font-bold text-slate-400 uppercase">To</div><div className="font-bold">主钱包</div></div></div><div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Amount (USDC)</label><div className="flex items-center bg-white rounded-xl px-4 py-4 border border-slate-200 focus-within:ring-2 ring-blue-500/20 shadow-inner"><span className="text-xl font-bold text-slate-400 mr-2">$</span><input type="number" min="0" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} onKeyDown={handleAmountKeyDown} className="bg-transparent text-2xl font-bold text-slate-900 w-full outline-none" placeholder="0.00" /></div><div className="flex justify-between mt-2 text-xs"><span className="text-slate-400">Available: {balanceAA.toFixed(2)} USDC</span><span className="text-green-600 font-bold">0 Fee • 0 Gas</span></div></div><button onClick={handleWithdrawToMain} className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold text-lg shadow-xl active:scale-[0.98] transition-all">Confirm Withdrawal</button></div></Modal>
      <Modal isOpen={showPay} onClose={() => setShowPay(false)} title="快捷支付">
        {payStep === 'scan' && (<div className="flex flex-col items-center"><div className="w-64 h-64 bg-slate-900 rounded-3xl relative overflow-hidden flex items-center justify-center mb-6"><div className="absolute inset-0 border-2 border-white/20 m-4 rounded-2xl"></div><motion.div animate={{ top: ['10%', '90%', '10%'] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute left-4 right-4 h-0.5 bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.8)]" /><span className="text-white/50 text-sm">Scanning Merchant QR...</span></div><button onClick={() => setPayStep('confirm')} className="bg-slate-200 text-slate-700 px-6 py-2 rounded-full font-bold text-sm">Simulate Scan (Bill: $120)</button></div>)}
        {payStep === 'confirm' && (<div className="flex flex-col gap-6"><div className="text-center"><div className="text-slate-500 text-sm uppercase tracking-widest font-bold mb-2">Merchant Request</div><div className="text-4xl font-bold text-slate-900">CA$ 120.00</div><div className="text-slate-400 text-sm mt-1">@CityGolfClub</div></div><div className="bg-slate-50 border border-slate-200 rounded-2xl p-4"><div className="flex items-center gap-2 mb-4"><Sparkles size={16} className="text-purple-600" /><span className="text-xs font-bold text-purple-600 uppercase tracking-wide">Smart Routing Active</span></div>{inventory.some(i => i.name === 'CCSA Membership' && (i.currentBalance ?? 0) > 0) ? (<div className="flex justify-between items-center mb-3 opacity-100"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-bold">V</div><span className="text-sm font-medium text-slate-700">CCSA Membership</span></div><span className="text-sm font-bold text-green-600">- CA$ 100.00</span></div>) : null}<div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">$</div><span className="text-sm font-medium text-slate-700">USDC 余额</span></div><span className="text-sm font-bold text-slate-900">- CA$ {inventory.some(i => i.name === 'CCSA Membership' && (i.currentBalance ?? 0) > 0) ? '20.00' : '120.00'}</span></div><div className="text-right text-[10px] text-slate-400 mt-1">(≈ {((inventory.some(i => i.name === 'CCSA Membership' && (i.currentBalance ?? 0) > 0) ? 20 : 120) * EXCHANGE_RATE).toFixed(2)} USDC)</div></div><button onClick={handleSmartPay} className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-xl active:scale-[0.98]">Pay Now</button></div>)}
        {payStep === 'processing' && <ProcessingView />}
        {payStep === 'success' && <div className="flex flex-col items-center justify-center py-8 text-center"><div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><CheckCircle2 size={40} /></div><h3 className="font-bold text-2xl text-slate-900">Paid Successfully!</h3><p className="text-slate-500 text-sm mt-2 max-w-[200px]">You saved CA$ 100.00 using your CCSA Membership.</p><button onClick={() => setShowPay(false)} className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">完成</button></div>}
      </Modal>
    </div>
  );
}

