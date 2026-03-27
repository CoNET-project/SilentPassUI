import React, { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { 
  CreditCard, 
  Settings, 
  QrCode,
  ArrowDownToLine,
  History,
  ChevronRight,
  ShieldCheck,
  Plus,
  ArrowRightLeft,
  Fingerprint,
  Wallet,
  Smartphone,
  Radio,
  Search,
  UserCircle,
  Send,
  Sparkles,
  Clock,
  User,
  MessageCircle,
  Scan,
  Snowflake,
  SlidersHorizontal,
  Download,
  Filter,
  LogOut,
  LifeBuoy,
  ArrowUpRight,
  Landmark,
  Barcode,
  Store,
  Home,
  Lock,
  MoreHorizontal,
  Info,
  CreditCard as CardIcon,
  Pencil,
  Zap,
  Copy,
  MapPin,
  Star,
  Gift,
  Layers,
  ChevronLeft,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';

type StoreCard = {
  id: string;
  name: string;
  type: string;
  color: string;
  borderColor: string;
  iconColor: string;
  bgColor: string;
  icon: LucideIcon;
  balanceCad: number;
};

type UsdcGiftVault = {
  id: 'usdc';
  name: string;
  type: string;
  color: string;
  text: string;
  balanceCad: number;
};

type GiftSource = StoreCard | UsdcGiftVault;

type NfcCard = {
  id: number;
  last4: string;
  isActive: boolean;
};

type PaymentDetails = {
  totalCad: number;
  paidFromCardCad: number;
  paidFromUsdc: number;
  usdcValueCad: number;
  remainingOwedCad: number;
};

type GiftDetails = {
  giftAmountCad: number;
  giftCostUsdc: number;
  networkFeeUsdc: number;
  totalCostUsdc: number;
  isStoreCard: boolean;
  storeName: string;
};

type TopupDetails = {
  addedCad: number;
  deductedUsdc: number;
  rate: number;
};

type BaseTransaction = {
  id: number;
  cardId: string;
  title: string;
  subtitle: string;
  amountStr: string;
  amountColor: string;
  iconBg: string;
  iconColor: string;
  iconType: string;
  time: string;
};

type Transaction =
  | (BaseTransaction & { type: 'payment'; details: PaymentDetails })
  | (BaseTransaction & { type: 'gift'; details: GiftDetails })
  | (BaseTransaction & { type: 'topup'; details: TopupDetails });

type SmartRoutingReceipt = {
  billTotal: number;
  cardDeductionCad: number;
  usdcTopUpUsdc: number;
  usdcTopUpCadEquivalent: number;
  remainingOwedCad: number;
  success: boolean;
};

const initialStoreCards: StoreCard[] = [
  { id: 'senpho', name: 'Sen Pho + Cafe', type: 'Black Card', color: 'from-gray-800 to-gray-900', borderColor: 'border-gray-700', iconColor: 'text-yellow-500', bgColor: 'bg-yellow-500/20', icon: Star, balanceCad: 50.00 },
  { id: 'lumina', name: 'Lumina Roasters', type: 'Green Card', color: 'from-emerald-500 to-teal-700', borderColor: 'border-emerald-600', iconColor: 'text-white', bgColor: 'bg-white/20', icon: CreditCard, balanceCad: 10.00 }
];

const initialTransactions: Transaction[] = [
  {
    id: 1, cardId: 'senpho', type: 'payment', title: 'Sen Pho + Cafe', subtitle: 'Smart Routing Checkout',
    amountStr: '- $15.50 CAD', amountColor: 'text-gray-900', iconBg: 'bg-gray-100', iconColor: 'text-[#65A30D]', iconType: 'radio', time: 'Yesterday, 12:40 PM',
    details: { totalCad: 15.50, paidFromCardCad: 10.00, paidFromUsdc: 4.40, usdcValueCad: 5.50, remainingOwedCad: 0 }
  },
  {
    id: 2, cardId: 'usdc', type: 'gift', title: 'Gift Sent to Emma', subtitle: 'Coffee on me!',
    amountStr: '- 4.03 USDC', amountColor: 'text-gray-900', iconBg: 'bg-pink-50', iconColor: 'text-pink-500', iconType: 'gift', time: 'Yesterday, 9:15 AM',
    details: { giftAmountCad: 5.00, giftCostUsdc: 4.00, networkFeeUsdc: 0.03, totalCostUsdc: 4.03, isStoreCard: false, storeName: 'USDC Vault' }
  },
  {
    id: 3, cardId: 'senpho', type: 'topup', title: 'Store Deposit', subtitle: 'From Vault: -80.00 USDC',
    amountStr: '+ $100.00 CAD', amountColor: 'text-[#65A30D]', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', iconType: 'arrow-down', time: 'Mon, 9:00 AM',
    details: { addedCad: 100.00, deductedUsdc: 80.00, rate: 1.25 }
  },
];

export default function CashTreesApp() {
  const [showQR, setShowQR] = useState(false);
  const [qrMode, setQrMode] = useState('pay'); 
  const [showNFCScanner, setShowNFCScanner] = useState(false);
  
  // --- 核心资金状态管理引擎 (统一换算为 CAD) ---
  const EXCHANGE_RATE = 1.25; // 按照设定：100 CAD = 80 USDC
  
  const [usdcBalance, setUsdcBalance] = useState(30.00); // 初始测试资金：30 USDC
  const [storeCards, setStoreCards] = useState<StoreCard[]>(initialStoreCards);

  // --- 全局动态流水账本 (包含明细下钻数据) ---
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);

  // 动态计算总资产
  const usdcValuationCad = usdcBalance * EXCHANGE_RATE;
  const totalCardsCad = storeCards.reduce((acc, card) => acc + card.balanceCad, 0);
  const totalValuationCad = usdcValuationCad + totalCardsCad;

  const [activeTab, setActiveTab] = useState('home'); 
  const [hasAAWallet, setHasAAWallet] = useState(false);
  const [showBalanceDetails, setShowBalanceDetails] = useState(false);

  // 物理 NFC 卡状态管理引擎
  const [nfcCards, setNfcCards] = useState<NfcCard[]>([]);
  const [showCardManagementModal, setShowCardManagementModal] = useState(false);
  const activeCard = nfcCards.find(c => c.isActive);
  const isPhysicalCardBound = nfcCards.length > 0;
  
  // 详情下钻控制
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedCard, setSelectedCard] = useState<StoreCard | null>(null);
  const [simulateAmount, setSimulateAmount] = useState('');
  const [smartRoutingReceipt, setSmartRoutingReceipt] = useState<SmartRoutingReceipt | null>(null);

  // 充值状态控制
  const [showAddCashModal, setShowAddCashModal] = useState(false);
  const [addAmountCad, setAddAmountCad] = useState(''); 
  const [addCashMode, setAddCashMode] = useState('methods'); 
  const [topUpStore, setTopUpStore] = useState<StoreCard>(initialStoreCards[0]);
  const [isSelectingTopUpStore, setIsSelectingTopUpStore] = useState(false);

  // 赠礼状态控制
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftStore, setGiftStore] = useState<GiftSource | null>(null);
  const [isSelectingGiftStore, setIsSelectingGiftStore] = useState(false);

  const [qrReceiveState, setQrReceiveState] = useState('default');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMemo, setReceiveMemo] = useState('');

  const userBeamioTag = "@alex.tag";
  const eoaAddress = "0x212F...8A9B";
  const aaAddress = "0x799E...75C8";

  // NFC 扫描绑定模拟
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (showNFCScanner) {
      timer = setTimeout(() => {
        setShowNFCScanner(false);
        if (!hasAAWallet) setHasAAWallet(true);
        
        // 自动绑定一张新卡并激活
        const newCardLast4 = Math.floor(1000 + Math.random() * 9000).toString();
        setNfcCards(prev => {
          const updatedCards = prev.map(c => ({ ...c, isActive: false }));
          return [{ id: Date.now(), last4: newCardLast4, isActive: true }, ...updatedCards];
        });
      }, 3000); 
    }
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [showNFCScanner, hasAAWallet]);

  const handleActivateAA = () => {
    setShowAddCashModal(false);
    setShowQR(false); 
    setHasAAWallet(true); 
  };

  // 动态费率计算
  const giftCadAmount = parseFloat(giftAmount) || 0;
  const giftUsdcEquivalent = giftCadAmount / EXCHANGE_RATE;
  let giftFeeUsdc = giftUsdcEquivalent * 0.008; 
  if (giftCadAmount > 0) {
    if (giftFeeUsdc < 0.02) giftFeeUsdc = 0.02; 
    if (giftFeeUsdc > 2) giftFeeUsdc = 2;       
  } else {
    giftFeeUsdc = 0;
  }
  const totalGiftCostCad = giftCadAmount + (giftFeeUsdc * EXCHANGE_RATE);

  // 真实发送礼物并记账
  const handleConfirmGift = () => {
    if (!giftCadAmount || giftCadAmount <= 0) return;
    const source = giftStore;
    const isStoreCard = Boolean(source && source.id !== 'usdc');
    const usdcCost = totalGiftCostCad / EXCHANGE_RATE;

    if (isStoreCard && source && source.id !== 'usdc') {
      if (source.balanceCad < totalGiftCostCad) return alert("Insufficient store card balance.");
      setStoreCards(prev => prev.map(c => c.id === source.id ? { ...c, balanceCad: c.balanceCad - totalGiftCostCad } : c));
    } else {
      if (usdcBalance < usdcCost) return alert("Insufficient USDC balance.");
      setUsdcBalance(prev => prev - usdcCost);
    }

    const newTx: Transaction = {
      id: Date.now(),
      cardId: isStoreCard && source && source.id !== 'usdc' ? source.id : 'usdc',
      type: 'gift',
      title: `Gift Sent to ${giftRecipient || 'Friend'}`,
      subtitle: giftMessage || 'Sent via CashTrees',
      amountStr: isStoreCard ? `- $${totalGiftCostCad.toFixed(2)} CAD` : `- ${usdcCost.toFixed(2)} USDC`,
      amountColor: 'text-gray-900',
      iconBg: 'bg-pink-50',
      iconColor: 'text-pink-500',
      iconType: 'gift',
      time: `Today, ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      details: {
        giftAmountCad: giftCadAmount,
        giftCostUsdc: giftCadAmount / EXCHANGE_RATE,
        networkFeeUsdc: giftFeeUsdc,
        totalCostUsdc: usdcCost,
        isStoreCard,
        storeName: isStoreCard && source && source.id !== 'usdc' ? source.name : 'USDC Vault'
      }
    };
    setTransactions(prev => [newTx, ...prev]);
    setShowGiftModal(false);
    setGiftAmount(''); setGiftRecipient(''); setGiftMessage(''); setGiftStore(null);
  };

  // 真实充值并记账
  const handleConfirmTopUp = () => {
    const cadToAdd = parseFloat(addAmountCad);
    if (!cadToAdd || cadToAdd <= 0) return;
    
    const usdcRequired = cadToAdd / EXCHANGE_RATE;
    if (usdcRequired > usdcBalance) {
      alert("Insufficient USDC balance. Please add more USDC first.");
      return;
    }

    setUsdcBalance(prev => prev - usdcRequired);
    setStoreCards(prev => prev.map(c => 
      c.id === topUpStore.id ? { ...c, balanceCad: c.balanceCad + cadToAdd } : c
    ));
    
    const newTx: Transaction = {
      id: Date.now(),
      cardId: topUpStore.id,
      type: 'topup',
      title: `${topUpStore.name} Top-up`,
      subtitle: `From Vault: -${usdcRequired.toFixed(2)} USDC`,
      amountStr: `+ $${cadToAdd.toFixed(2)} CAD`,
      amountColor: 'text-[#65A30D]',
      iconBg: 'bg-blue-50',
      iconColor: 'text-[#0055FF]',
      iconType: 'arrow-down',
      time: `Today, ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      details: {
        addedCad: cadToAdd,
        deductedUsdc: usdcRequired,
        rate: EXCHANGE_RATE
      }
    };
    setTransactions(prev => [newTx, ...prev]);

    setShowAddCashModal(false);
    setAddAmountCad('');
  };

  // 核心算法：Smart Routing 智能结账逻辑
  const handleSmartRoutingSimulation = () => {
    const card = selectedCard;
    if (!card) return;

    const billAmountCad = parseFloat(simulateAmount);
    if (!billAmountCad || billAmountCad <= 0) return;

    let remainingBillCad = billAmountCad;
    let currentCardBalCad = card.balanceCad;
    let currentUsdcBal = usdcBalance;
    
    let receipt = {
      billTotal: billAmountCad,
      cardDeductionCad: 0,
      usdcTopUpUsdc: 0,
      usdcTopUpCadEquivalent: 0,
      remainingOwedCad: 0,
      success: false
    };

    // 1. 卡内足够则优先扣卡
    if (currentCardBalCad > 0) {
      const deductFromCard = Math.min(currentCardBalCad, remainingBillCad);
      currentCardBalCad -= deductFromCard;
      remainingBillCad -= deductFromCard;
      receipt.cardDeductionCad = deductFromCard;
    }

    // 2. 卡内不足，动用 USDC 自动垫付
    if (remainingBillCad > 0 && currentUsdcBal > 0) {
      const requiredUsdc = remainingBillCad / EXCHANGE_RATE;
      const actualUsdcToUse = Math.min(currentUsdcBal, requiredUsdc);
      const cadEquivalentConverted = actualUsdcToUse * EXCHANGE_RATE;
      
      currentUsdcBal -= actualUsdcToUse;
      remainingBillCad -= cadEquivalentConverted;
      
      receipt.usdcTopUpUsdc = actualUsdcToUse;
      receipt.usdcTopUpCadEquivalent = cadEquivalentConverted;
    }

    // 3. 计算剩余欠款
    receipt.remainingOwedCad = Math.max(0, remainingBillCad);
    receipt.success = true;

    // 4. 状态更新与账本记录
    setUsdcBalance(currentUsdcBal);
    setStoreCards(prev => prev.map(c => 
      c.id === card.id ? { ...c, balanceCad: currentCardBalCad } : c
    ));
    setSelectedCard(prev => (prev ? { ...prev, balanceCad: currentCardBalCad } : prev));
    setSmartRoutingReceipt(receipt);
    
    // 生成动态流水
    const totalPaidCad = receipt.cardDeductionCad + receipt.usdcTopUpCadEquivalent;
    const subtitleText = receipt.usdcTopUpUsdc > 0 
      ? `Card: -$${receipt.cardDeductionCad.toFixed(2)} | Vault: -${receipt.usdcTopUpUsdc.toFixed(2)} USDC`
      : `Auto-paid from ${card.type}`;

    if (totalPaidCad > 0) {
      const newTx: Transaction = {
        id: Date.now(),
        cardId: card.id,
        type: 'payment',
        title: card.name,
        subtitle: subtitleText,
        amountStr: `- $${totalPaidCad.toFixed(2)} CAD`,
        amountColor: 'text-gray-900',
        iconBg: 'bg-gray-100',
        iconColor: 'text-[#65A30D]',
        iconType: 'radio',
        time: `Today, ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
        details: {
          totalCad: totalPaidCad,
          paidFromCardCad: receipt.cardDeductionCad,
          paidFromUsdc: receipt.usdcTopUpUsdc,
          usdcValueCad: receipt.usdcTopUpCadEquivalent,
          remainingOwedCad: receipt.remainingOwedCad
        }
      };
      setTransactions(prev => [newTx, ...prev]);
    }
    setSimulateAmount('');
  };

  const handleGenerateRequest = () => {
    if (!receiveAmount || parseFloat(receiveAmount) <= 0) return;
    setQrReceiveState('loading');
    setTimeout(() => setQrReceiveState('generated'), 1500);
  };

  // 通用流水图标渲染
  const renderTxIcon = (type: string, colorClass: string) => {
    if (type === 'radio') return <Radio size={18} className={colorClass} />;
    if (type === 'zap') return <Zap size={18} className={colorClass} />;
    if (type === 'arrow-down') return <ArrowDownToLine size={18} className={colorClass} />;
    if (type === 'gift') return <Gift size={18} className={colorClass} />;
    if (type === 'store') return <Store size={18} className={colorClass} />;
    return <CreditCard size={18} className={colorClass} />;
  };

  const renderTransactionList = (txList: Transaction[]) => {
    if (txList.length === 0) {
      return <div className="text-center text-gray-400 py-6 text-sm font-medium">No activity yet.</div>;
    }
    return (
      <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
        {txList.map((tx: Transaction, idx: number) => (
          <div 
            key={tx.id} 
            onClick={() => setSelectedTransaction(tx)}
            className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors ${idx !== txList.length - 1 ? 'border-b border-gray-50' : ''}`}
          >
            <div className={`w-12 h-12 rounded-xl ${tx.iconBg} flex items-center justify-center mr-4 shrink-0`}>
              {renderTxIcon(tx.iconType, tx.iconColor)}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex justify-between items-start">
                <div className="truncate">
                  <h3 className="font-semibold text-gray-900 truncate">{tx.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium truncate">{tx.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold ${tx.amountColor}`}>{tx.amountStr}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{tx.time}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ==========================================
  // TAB 1: 首页 (Home)
  // ==========================================
  const renderHomeTab = () => (
    <div className="animate-in fade-in duration-300 pb-32">
      <div className="px-6 pt-12 pb-2 flex justify-between items-center">
        <button 
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-2 bg-white shadow-sm border border-gray-200 rounded-full pl-1.5 pr-4 py-1.5 transition-transform active:scale-95 hover:bg-gray-50 group"
        >
          <div className="w-8 h-8 bg-gradient-to-tr from-[#96EB3C] to-[#65A30D] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner group-hover:scale-105 transition-transform">
            A
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">{userBeamioTag}</span>
        </button>

        {hasAAWallet && (
          <button 
            onClick={() => setShowCardManagementModal(true)}
            className="w-9 h-9 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors relative"
          >
            <SlidersHorizontal size={18} strokeWidth={2.5} />
            {nfcCards.length > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#65A30D] border-2 border-white rounded-full"></span>}
          </button>
        )}
      </div>

      {!hasAAWallet ? (
        <div className="px-6 mt-4">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 flex flex-col items-center relative overflow-hidden">
            <div className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
              Action Required
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center tracking-tight">Activate Wallet</h2>
            <p className="text-sm text-gray-500 mb-8 text-center leading-relaxed">
              Your App is currently in EOA mode. Load cash or sync a card to deploy your Smart Account.
            </p>
            <div className="w-full bg-gray-50 rounded-3xl p-5 mb-4 border border-gray-200 flex flex-col items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Store size={14} /> Option 1: Store Deposit
              </span>
              <div 
                onClick={() => { setQrMode('receive'); setShowQR(true); }}
                className="w-32 h-32 bg-white rounded-2xl p-2 shadow-sm border border-[#96EB3C] border-2 mb-3 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              >
                <QrCode size={100} className="text-gray-900" />
              </div>
              <div className="flex items-center gap-1.5 bg-gray-200/50 px-2 py-1 rounded-md mb-2">
                <span className="text-[10px] text-gray-500 font-mono font-semibold">EOA: {eoaAddress}</span>
              </div>
              <p className="text-xs text-gray-500 text-center font-medium">Show QR to cashier to load cash.</p>
              <button onClick={handleActivateAA} className="mt-4 text-[#65A30D] text-[11px] font-bold bg-[#96EB3C]/20 px-4 py-1.5 rounded-full active:scale-95 transition-transform">
                (Dev: Simulate Deposit)
              </button>
            </div>
            <div 
              onClick={() => setShowNFCScanner(true)}
              className="w-full bg-gray-50 hover:bg-[#96EB3C]/10 transition-colors rounded-3xl p-5 border border-gray-200 flex flex-col items-center cursor-pointer group"
            >
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <CardIcon size={14} /> Option 2: Got a Card?
              </span>
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-2 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                <Radio size={20} className="text-[#65A30D]" />
              </div>
              <p className="text-sm font-bold text-gray-900">Sync NFC Card</p>
              <p className="text-xs text-gray-500 mt-1">Tap funded card to phone.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="px-6 pt-2 pb-4">
            <div 
              onClick={() => setShowBalanceDetails(true)}
              className="relative bg-gradient-to-br from-[#8AE131] to-[#67AD0F] rounded-[2rem] p-6 text-gray-900 shadow-xl shadow-[#96EB3C]/20 overflow-hidden transform transition-transform hover:-translate-y-1 cursor-pointer border border-[#96EB3C]/40"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
              
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-start">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mr-3 backdrop-blur-sm border border-white/20 shadow-sm">
                    <Radio size={22} className="text-gray-900" />
                  </div>
                  <div className="flex flex-col items-start mt-0.5">
                    <span className="font-extrabold text-[22px] tracking-tight text-gray-900 leading-none mb-1.5">CashTrees Pass</span>
                    <div className="flex items-center gap-1.5 bg-gray-900/10 border border-gray-900/5 px-2 py-0.5 rounded-md shadow-sm">
                      <span className="text-[10px] text-gray-800 font-mono tracking-widest font-semibold uppercase">{aaAddress}</span>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center text-gray-900 backdrop-blur-sm border border-gray-900/5 shadow-sm">
                  <Layers size={16} strokeWidth={2.5} />
                </div>
              </div>
              
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <p className="text-sm text-gray-800 font-bold mb-0.5 opacity-90 tracking-wide flex items-center gap-1.5">
                    Total Valuation (CAD)
                    <Info size={12} className="opacity-70"/>
                  </p>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold mr-1 opacity-80">$</span>
                    <p className="text-[44px] font-extrabold tracking-tighter text-gray-900 leading-none">
                      {Math.floor(totalValuationCad)}<span className="text-3xl font-bold text-gray-800/80">.{(totalValuationCad % 1).toFixed(2).substring(2)}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center bg-gray-900/10 backdrop-blur-md border border-gray-900/5 px-3 py-1.5 rounded-full shadow-sm mb-1.5">
                  <div className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-900 tracking-wider uppercase">
                    {activeCard ? `Card ${activeCard.last4} Active` : 'Virtual Active'}
                  </span>
                </div>
              </div>
            </div>
            
            {!isPhysicalCardBound && (
              <div className="flex justify-center mt-4 animate-in zoom-in-95 duration-300">
                <button 
                  onClick={() => setShowNFCScanner(true)}
                  className="flex items-center gap-1.5 bg-white hover:bg-gray-50 px-4 py-2 rounded-full shadow-sm border border-gray-200 text-gray-500 hover:text-[#65A30D] hover:border-[#96EB3C]/50 transition-all active:scale-95"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <Radio size={14} />
                  <span className="text-[12px] font-bold uppercase tracking-wider ml-0.5">Bind Physical Card</span>
                </button>
              </div>
            )}
          </div>

          <div className="pl-6 mb-8 mt-2">
            <div className="flex justify-between items-center mb-3 pr-6">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">My Store Cards ({storeCards.length})</h2>
            </div>
            <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4 pr-6 snap-x">
              
              {storeCards.map((card) => {
                const IconComponent = card.icon;
                return (
                  <div 
                    key={card.id}
                    onClick={() => { setSelectedCard(card); setSmartRoutingReceipt(null); setSimulateAmount(''); }}
                    className={`snap-start min-w-[240px] bg-gradient-to-br ${card.color} rounded-[1.5rem] p-5 shadow-md border ${card.borderColor} relative overflow-hidden flex-shrink-0 cursor-pointer hover:-translate-y-1 transition-transform`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <h3 className="text-white font-bold text-lg leading-tight mb-1">{card.name}</h3>
                        <div className={`flex items-center gap-1 ${card.bgColor} ${card.iconColor} px-2 py-0.5 rounded-md w-max`}>
                          <IconComponent size={10} />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white">{card.type}</span>
                        </div>
                      </div>
                    </div>
                    <div className="relative z-10">
                      <p className="text-gray-300 text-xs font-medium mb-0.5">Store Balance (CAD)</p>
                      <p className="text-2xl font-extrabold text-white tracking-tight">${card.balanceCad.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}

              <div 
                onClick={() => setActiveTab('store')}
                className="snap-start min-w-[120px] bg-gray-50 border-2 border-dashed border-gray-300 rounded-[1.5rem] flex flex-col items-center justify-center text-gray-400 hover:bg-white hover:text-[#65A30D] hover:border-[#65A30D] transition-colors cursor-pointer flex-shrink-0"
              >
                <Plus size={24} className="mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Discover</span>
              </div>
            </div>
          </div>

          <div className="px-6 flex gap-3 mb-10">
            <button 
              onClick={() => { setAddAmountCad(''); setAddCashMode('methods'); setShowAddCashModal(true); }}
              className="flex-1 bg-white hover:bg-gray-50 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm border border-gray-100 group"
            >
              <div className="w-12 h-12 bg-[#96EB3C] rounded-full flex items-center justify-center shadow-[0_4px_14px_rgba(150,235,60,0.4)]">
                <ArrowDownToLine size={24} className="text-gray-900" />
              </div>
              <span className="font-semibold text-[11px] text-gray-700 tracking-wide uppercase">Add Cash</span>
            </button>
            
            <button 
              onClick={() => setShowGiftModal(true)}
              className="flex-1 bg-white hover:bg-gray-50 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm border border-gray-100 group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-12 h-12 bg-pink-100 rounded-full -mr-4 -mt-4 blur-xl opacity-60"></div>
              <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 border border-pink-100 relative z-10">
                <Gift size={22} className="group-hover:scale-110 transition-transform duration-300" />
              </div>
              <span className="font-semibold text-[11px] text-gray-700 tracking-wide uppercase relative z-10">Gift Card</span>
            </button>

            <button 
              onClick={() => { setQrMode('pay'); setShowQR(true); }}
              className="flex-1 bg-gray-900 hover:bg-gray-800 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-xl shadow-gray-900/20"
            >
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-white border border-gray-700">
                <Scan size={20} />
              </div>
              <span className="font-semibold text-[11px] text-white tracking-wide uppercase">Pay / Scan</span>
            </button>
          </div>

          <div className="px-6 mb-8 relative z-30">
            <div className="flex justify-between items-center mb-4 px-1">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Recent Activity</h2>
              <button 
                onClick={() => setActiveTab('transactions')}
                className="text-sm font-semibold text-[#65A30D] hover:text-[#4d7c1e] transition-colors"
              >
                View all
              </button>
            </div>
            {renderTransactionList(transactions.slice(0, 3))}
          </div>
        </>
      )}
    </div>
  );

  // ==========================================
  // TAB 1.5: 交易明细列表 (Transactions - View All)
  // ==========================================
  const renderTransactionsTab = () => (
    <div className="animate-in fade-in duration-300 pb-32">
      <div className="px-6 pt-14 mb-4 flex items-center relative w-full">
        <button 
          onClick={() => setActiveTab('home')} 
          className="absolute left-6 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors -ml-2"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mx-auto">Transactions</h1>
      </div>

      <div className="px-6 flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        <button className="bg-gray-900 text-white px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap">All Activity</button>
        <button className="bg-white border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm">Payments</button>
        <button className="bg-white border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm">Top-ups</button>
      </div>

      <div className="px-6 space-y-6">
        <div>
           {renderTransactionList(transactions)}
        </div>
        <div className="flex justify-center pt-6 pb-12 opacity-30">
          <Receipt size={24} className="text-gray-400" />
        </div>
      </div>
    </div>
  );

  // ==========================================
  // TAB 2: 商圈发现 (Discover)
  // ==========================================
  const renderStoreTab = () => (
    <div className="animate-in fade-in duration-300 pb-32">
      <div className="px-6 pt-14 mb-6">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Discover</h1>
        <div className="flex items-center mt-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md w-max shadow-sm border border-yellow-200/50">
          <Sparkles size={12} className="mr-1.5" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Store Memberships & Offers</span>
        </div>
      </div>

      <div className="px-6 space-y-6">
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all duration-300 group relative">
          <div className="h-32 relative overflow-hidden bg-orange-50 rounded-t-[2rem]">
            <span className="text-7xl absolute opacity-30 flex items-center justify-center w-full h-full">🍜</span>
            <img 
              src="https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=800" 
              alt="Sen Pho + Cafe" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out z-10"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent z-20"></div>
            <div className="absolute bottom-4 left-5 right-5 z-30 flex justify-between items-end">
              <h3 className="font-extrabold text-xl text-white tracking-tight drop-shadow-md">Sen Pho + Cafe</h3>
            </div>
          </div>
          
          <div className="relative h-6 bg-white z-30">
             <div className="absolute -left-3 top-0 w-6 h-6 bg-[#F1F8ED] rounded-full shadow-inner border-r border-gray-100"></div>
             <div className="absolute -right-3 top-0 w-6 h-6 bg-[#F1F8ED] rounded-full shadow-inner border-l border-gray-100"></div>
             <div className="absolute top-3 left-6 right-6 border-t-2 border-dashed border-gray-200"></div>
          </div>
          
          <div className="px-5 pb-5 pt-1 bg-white rounded-b-[2rem] z-30 relative">
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Store size={14} className="text-[#65A30D]" />
                <span className="text-xs font-bold text-[#65A30D] uppercase tracking-wider">Store Membership Cards</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">Top up to unlock exclusive discounts.</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-bold text-gray-900">Green Card</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">5% OFF</span>
                  </div>
                  <span className="text-xs text-gray-500">Min. $50 Top-up</span>
                </div>
                <button onClick={() => {setAddAmountCad(''); setTopUpStore(storeCards.find(c=>c.id==='senpho') || storeCards[0]); setAddCashMode('topup_store'); setShowAddCashModal(true);}} className="bg-white border border-gray-200 text-gray-700 hover:text-gray-900 px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm active:scale-95 flex items-center gap-1">
                  <Plus size={14} /> Get
                </button>
              </div>

              <div className="flex justify-between items-center bg-gray-900 p-3 rounded-2xl border border-gray-800">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-bold text-white">Black Card</span>
                    <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold">10% OFF</span>
                  </div>
                  <span className="text-xs text-gray-400">Min. $100 Top-up</span>
                </div>
                <button className="bg-white border border-gray-200 text-gray-400 px-4 py-2 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={14} /> Owned
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all duration-300 group relative">
          <div className="h-32 relative overflow-hidden bg-amber-50 rounded-t-[2rem]">
            <span className="text-6xl absolute opacity-30 flex items-center justify-center w-full h-full">☕️</span>
            <img 
              src="https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=800" 
              alt="Lumina Roasters" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out z-10"
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent z-20"></div>
            <div className="absolute bottom-4 left-5 right-5 z-30">
              <h3 className="font-extrabold text-xl text-white tracking-tight drop-shadow-md">Lumina Roasters</h3>
            </div>
          </div>
          
          <div className="relative h-6 bg-white z-30">
             <div className="absolute -left-3 top-0 w-6 h-6 bg-[#F1F8ED] rounded-full shadow-inner border-r border-gray-100"></div>
             <div className="absolute -right-3 top-0 w-6 h-6 bg-[#F1F8ED] rounded-full shadow-inner border-l border-gray-100"></div>
             <div className="absolute top-3 left-6 right-6 border-t-2 border-dashed border-gray-200"></div>
          </div>
          
          <div className="px-5 pb-5 pt-1 bg-white rounded-b-[2rem] z-30 relative">
             <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Store size={14} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Store Membership Cards</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm font-bold text-gray-900">Green Card</span>
                </div>
                <span className="text-xs text-gray-500">Min. $50 Top-up</span>
              </div>
              <button className="bg-white border border-gray-200 text-gray-400 px-4 py-2 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1">
                <CheckCircle2 size={14} /> Owned
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // TAB 3: 聊天/消息 (Chat / Messages)
  // ==========================================
  const renderChatTab = () => (
    <div className="animate-in fade-in duration-300 pb-32">
      <div className="px-6 pt-14 mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Messages</h1>
          <div className="flex items-center mt-2 text-gray-500 bg-gray-100 px-2 py-1 rounded-md w-max">
            <Lock size={12} className="mr-1" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">End-to-End Encrypted</span>
          </div>
        </div>
        <button className="w-10 h-10 bg-gray-200 text-gray-900 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform mt-1">
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="px-6 space-y-3">
        <div className="bg-white p-4 rounded-3xl flex items-center justify-between shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex items-center flex-1">
            <div className="w-12 h-12 rounded-full bg-[#96EB3C]/20 border border-[#96EB3C]/50 flex items-center justify-center text-xl mr-3">
              🌳
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex justify-between items-baseline mb-0.5">
                <h3 className="font-bold text-gray-900 truncate">CashTrees Support</h3>
                <span className="text-[10px] text-gray-400 font-medium">Mon</span>
              </div>
              <p className="text-xs text-gray-500 truncate">Welcome to the Alliance Network!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // TAB 4: 我的/设置 (Profile)
  // ==========================================
  const renderProfileTab = () => (
    <div className="animate-in fade-in duration-300 pb-32">
      <div className="px-6 pt-14 mb-6">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Profile</h1>
      </div>
      <div className="px-6 flex flex-col items-center mt-8">
        <div className="w-24 h-24 bg-gradient-to-tr from-[#96EB3C] to-[#65A30D] rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4">
          A
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{userBeamioTag}</h2>
        <p className="text-gray-500 mb-8 font-mono">{aaAddress}</p>
        
        <div className="w-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
           <div className="p-4 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50">
             <div className="flex items-center text-gray-700 font-semibold"><ShieldCheck className="mr-3 text-gray-400" size={20}/> Security & Backup</div>
             <ChevronRight className="text-gray-300" size={18}/>
           </div>
           <div className="p-4 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50">
             <div className="flex items-center text-gray-700 font-semibold"><History className="mr-3 text-gray-400" size={20}/> Transaction Limits</div>
             <ChevronRight className="text-gray-300" size={18}/>
           </div>
           <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50">
             <div className="flex items-center text-red-500 font-semibold"><LogOut className="mr-3 text-red-400" size={20}/> Sign Out</div>
           </div>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // 商户卡详情与 Smart Routing 模拟弹窗
  // ==========================================
  const renderCardDetailModal = () => {
    if (!selectedCard) return null;
    const IconCmp = selectedCard.icon;
    const cardTransactions = transactions.filter(tx => tx.cardId === selectedCard.id);

    return (
      <div className="absolute inset-0 z-[45] flex flex-col">
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedCard(null)}></div>
        <div className="mt-auto bg-[#F1F8ED] rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[90%] overflow-y-auto hide-scrollbar">
          
          <div className="mx-auto w-12 h-1.5 bg-gray-300 rounded-full mb-6"></div>
          
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Card Details</h3>
            <button onClick={() => setSelectedCard(null)} className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">✕</button>
          </div>

          <div className={`w-full bg-gradient-to-br ${selectedCard.color} rounded-[2rem] p-6 shadow-lg border ${selectedCard.borderColor} relative overflow-hidden mb-6`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div className="flex justify-between items-start mb-10 relative z-10">
              <div>
                <h3 className="text-white font-extrabold text-2xl leading-tight mb-1.5">{selectedCard.name}</h3>
                <div className={`flex items-center gap-1 ${selectedCard.bgColor} px-2.5 py-1 rounded-md w-max border border-white/10`}>
                  <IconCmp size={12} className={selectedCard.iconColor} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">{selectedCard.type}</span>
                </div>
              </div>
              <Radio size={24} className="text-white/50" />
            </div>
            <div className="relative z-10">
              <p className="text-gray-300 text-sm font-medium mb-1">Available Store Balance</p>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold text-white mr-1">CA$</span>
                <p className="text-[40px] font-extrabold text-white tracking-tight leading-none">{selectedCard.balanceCad.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={18} className="text-[#0055FF] fill-[#0055FF]" />
              <h4 className="font-bold text-gray-900 text-lg">Smart Routing Checkout</h4>
            </div>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Experience CashTrees intelligent auto-funding. If your card balance is insufficient, it automatically draws from your USDC vault to cover the difference seamlessly.
            </p>

            <div className="flex gap-3 items-center mb-5">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-center px-4 py-3">
                <span className="text-gray-400 font-bold mr-2">CA$</span>
                <input 
                  type="number" 
                  value={simulateAmount}
                  onChange={(e) => setSimulateAmount(e.target.value)}
                  placeholder="Enter Bill Amount"
                  className="bg-transparent w-full outline-none font-bold text-gray-900 text-lg"
                />
              </div>
              <button 
                onClick={handleSmartRoutingSimulation}
                disabled={!simulateAmount || parseFloat(simulateAmount) <= 0}
                className="bg-[#0055FF] hover:bg-blue-700 active:scale-95 disabled:bg-blue-300 text-white px-5 py-3.5 rounded-2xl font-bold transition-all shadow-sm flex items-center gap-2"
              >
                <Scan size={18} /> Pay
              </button>
            </div>

            {smartRoutingReceipt && (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex justify-center mb-3 text-green-500">
                  <CheckCircle2 size={24} />
                </div>
                <h5 className="text-center font-bold text-gray-900 mb-4">Smart Routing Execution</h5>
                
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Target Bill</span>
                    <span className="font-bold text-gray-900">CA$ {smartRoutingReceipt.billTotal.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-[#65A30D]">
                    <span className="flex items-center gap-1.5"><CardIcon size={14}/> Card Deduction</span>
                    <span className="font-bold">- CA$ {smartRoutingReceipt.cardDeductionCad.toFixed(2)}</span>
                  </div>

                  {smartRoutingReceipt.usdcTopUpUsdc > 0 && (
                    <div className="flex justify-between items-start text-[#0055FF] pt-2 border-t border-blue-100">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 font-semibold"><Zap size={14}/> Auto USDC Top-up</span>
                        <span className="text-[10px] ml-5 mt-0.5 opacity-80">Converted @ {EXCHANGE_RATE} CAD</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold">- {smartRoutingReceipt.usdcTopUpUsdc.toFixed(2)} USDC</span>
                        <span className="text-[10px] opacity-80">(≈ - CA$ {smartRoutingReceipt.usdcTopUpCadEquivalent.toFixed(2)})</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-200">
                    <span className="font-bold text-gray-900">Remaining Due</span>
                    <div className="flex flex-col items-end">
                      <span className={`font-extrabold text-lg ${smartRoutingReceipt.remainingOwedCad > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        CA$ {smartRoutingReceipt.remainingOwedCad.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {smartRoutingReceipt.remainingOwedCad > 0 && (
                  <div className="mt-4 bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-semibold flex items-start gap-2 border border-red-100">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <span>Vault depleted. Please pay the remaining CA$ {smartRoutingReceipt.remainingOwedCad.toFixed(2)} using cash or credit card at the counter.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mb-4">
            <h4 className="font-bold text-gray-900 text-lg mb-4">Card Activity</h4>
            {renderTransactionList(cardTransactions)}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 凭证详情弹窗 (Transaction Receipt Detail)
  // ==========================================
  const renderTransactionDetailModal = () => {
    if (!selectedTransaction) return null;
    const tx = selectedTransaction;

    return (
      <div className="absolute inset-0 z-[60] flex flex-col bg-[#F2F2F7] animate-in slide-in-from-right duration-300">
        <div className="px-6 pt-14 mb-6 flex items-center relative w-full">
          <button 
            onClick={() => setSelectedTransaction(null)} 
            className="absolute left-6 p-2 text-gray-400 hover:bg-gray-200 rounded-full transition-colors -ml-2"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 mx-auto">Receipt</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-10 flex flex-col items-center">
          <div className={`w-20 h-20 rounded-[1.5rem] ${tx.iconBg} flex items-center justify-center mb-4 shadow-sm border border-white/50`}>
             {renderTxIcon(tx.iconType, `${tx.iconColor} w-10 h-10`)}
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight text-center">{tx.title}</h2>
          <p className="text-gray-500 font-medium mb-8 text-center">{tx.time}</p>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 w-full mb-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-gray-100 to-transparent"></div>
            
            <div className="flex justify-between items-end mb-6 pb-6 border-b border-gray-100 border-dashed">
               <span className="text-gray-500 font-medium">Status</span>
               <span className="font-bold text-[#65A30D] flex items-center gap-1"><CheckCircle2 size={16}/> Completed</span>
            </div>

            {/* Smart Routing Payment Receipt Breakdown */}
            {tx.type === 'payment' && tx.details && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Transaction Details</h4>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Total Bill</span>
                    <span className="font-bold text-gray-900">CA$ {tx.details.totalCad.toFixed(2)}</span>
                  </div>
                  
                  {tx.details.paidFromCardCad > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Paid from Store Card</span>
                      <span className="font-medium text-gray-900">- CA$ {tx.details.paidFromCardCad.toFixed(2)}</span>
                    </div>
                  )}
                  
                  {tx.details.paidFromUsdc > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Auto-Topup from Vault</span>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">- {tx.details.paidFromUsdc.toFixed(2)} USDC</span>
                        <p className="text-[10px] text-gray-400 mt-0.5">Value: CA$ {tx.details.usdcValueCad.toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  {tx.details.remainingOwedCad > 0 && (
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-red-500 font-bold">Unpaid Balance</span>
                      <span className="font-bold text-red-500">CA$ {tx.details.remainingOwedCad.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="pt-4 mt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-gray-500">Network Fee</span>
                    <span className="font-bold text-[#65A30D]">Free</span>
                  </div>
                  <p className="text-[10px] text-gray-400 text-right mt-1">Paid by merchant</p>
                </div>
              </div>
            )}

            {/* Top-up Receipt Breakdown */}
            {tx.type === 'topup' && tx.details && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Exchange Details</h4>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Deducted from Vault</span>
                    <span className="font-bold text-red-500">- {tx.details.deductedUsdc.toFixed(2)} USDC</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Added to Store Card</span>
                    <span className="font-bold text-[#65A30D]">+ CA$ {tx.details.addedCad.toFixed(2)}</span>
                  </div>
                  
                  <div className="pt-4 mt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-gray-500">Exchange Rate</span>
                    <span className="font-medium text-gray-900">1 USDC = {tx.details.rate} CAD</span>
                  </div>
                </div>
              </div>
            )}

            {/* Gift Receipt Breakdown */}
            {tx.type === 'gift' && tx.details && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Gift Details</h4>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Asset Type</span>
                    <span className="font-medium text-gray-900">{tx.details.storeName}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Gift Amount</span>
                    <span className="font-medium text-gray-900">CA$ {tx.details.giftAmountCad.toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Network Fee (0.8%)</span>
                    <span className="font-medium text-gray-900">{tx.details.networkFeeUsdc.toFixed(2)} USDC</span>
                  </div>
                  
                  <div className="pt-4 mt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-gray-500">Total Charged</span>
                    <span className="font-bold text-red-500">- {tx.details.totalCostUsdc.toFixed(2)} USDC</span>
                  </div>
                </div>
              </div>
            )}

            {/* General Fallback for mock data without detailed breakdown */}
            {!tx.details && (
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                 <span className="text-gray-500">Amount</span>
                 <span className={`font-bold ${tx.amountColor}`}>{tx.amountStr}</span>
              </div>
            )}

          </div>

          <button className="bg-white border border-gray-200 text-gray-500 px-6 py-2.5 rounded-full font-bold text-sm shadow-sm">
            Report an Issue
          </button>
        </div>
      </div>
    );
  };

  // ==========================================
  // 卡片管理弹窗 (Card Management Modal)
  // ==========================================
  const renderCardManagementModal = () => {
    if (!showCardManagementModal) return null;

    return (
      <div className="absolute inset-0 z-50 flex flex-col">
        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowCardManagementModal(false)}></div>
        <div className="mt-auto bg-[#F1F8ED] rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[85%] overflow-y-auto hide-scrollbar">
          
          <div className="mx-auto w-12 h-1.5 bg-gray-300 rounded-full mb-6"></div>
          
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">NFC Cards</h3>
            <button onClick={() => setShowCardManagementModal(false)} className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">✕</button>
          </div>

          <p className="text-sm text-gray-500 mb-6">Manage your linked physical keys. Only one card can be active at a time to prevent conflicts.</p>

          <div className="space-y-3 mb-auto">
            {nfcCards.map(card => (
              <div key={card.id} className={`bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${card.isActive ? 'border-[#96EB3C]' : 'border-gray-100'}`}>
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${card.isActive ? 'bg-[#96EB3C]/20 text-[#65A30D]' : 'bg-gray-100 text-gray-400'}`}>
                    <Radio size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">CashTrees Card</h4>
                    <p className="text-xs text-gray-500 font-mono">•••• {card.last4}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!card.isActive && (
                    <button 
                      onClick={() => setNfcCards(prev => prev.map(c => ({...c, isActive: c.id === card.id})))}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    >
                      Activate
                    </button>
                  )}
                  {card.isActive && (
                    <span className="bg-[#96EB3C]/20 text-[#65A30D] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 size={14} /> Active
                    </span>
                  )}
                  <button 
                    onClick={() => {
                      setNfcCards(prev => prev.filter(c => c.id !== card.id));
                    }}
                    className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {nfcCards.length === 0 && (
              <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 border-dashed">
                <Smartphone size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm font-medium">No physical cards linked.</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => {
              setShowCardManagementModal(false);
              setShowNFCScanner(true);
            }}
            className="w-full py-4 mt-6 bg-gray-900 hover:bg-gray-800 active:scale-95 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Bind Another Card
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center font-sans text-gray-900 pb-20">
      <div className="w-full max-w-md bg-[#F1F8ED] overflow-hidden relative shadow-2xl sm:rounded-[3rem] sm:border-[8px] border-white sm:my-8 sm:h-[850px] flex flex-col">
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {activeTab === 'home' && renderHomeTab()}
          {activeTab === 'transactions' && renderTransactionsTab()}
          {activeTab === 'store' && renderStoreTab()}
          {activeTab === 'chat' && renderChatTab()}
          {activeTab === 'profile' && renderProfileTab()}
        </div>

        {/* --- Floating Bottom Navigation Bar --- */}
        <div className="absolute bottom-6 w-full z-30 px-6 flex justify-center items-center gap-3 pointer-events-none">
          <div className="flex-1 bg-[#8E8E93] rounded-[2rem] p-1.5 flex justify-between items-center shadow-[0_8px_25px_rgba(0,0,0,0.12)] pointer-events-auto">
            <button 
              onClick={() => setActiveTab('home')}
              className={`relative flex items-center justify-center h-12 transition-all duration-300 ${activeTab === 'home' || activeTab === 'transactions' ? 'w-[76px] bg-white rounded-[1.5rem] shadow-sm' : 'flex-1 hover:opacity-80'}`}
            >
              <Wallet size={24} className={activeTab === 'home' || activeTab === 'transactions' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'home' || activeTab === 'transactions' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'home' || activeTab === 'transactions' ? 0 : 2} />
            </button>

            <button 
              onClick={() => setActiveTab('store')}
              className={`relative flex items-center justify-center h-12 transition-all duration-300 ${activeTab === 'store' ? 'w-[76px] bg-white rounded-[1.5rem] shadow-sm' : 'flex-1 hover:opacity-80'}`}
            >
              <Store size={24} className={activeTab === 'store' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'store' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'store' ? 0 : 2} />
            </button>

            <button 
              onClick={() => { setQrMode('pay'); setShowQR(true); }}
              className="relative flex items-center justify-center flex-1 h-12 transition-all duration-300 hover:opacity-80"
            >
              <Scan size={24} className="text-white" strokeWidth={2.5} />
            </button>

            <button 
              onClick={() => setActiveTab('chat')}
              className={`relative flex items-center justify-center h-12 transition-all duration-300 ${activeTab === 'chat' ? 'w-[76px] bg-white rounded-[1.5rem] shadow-sm' : 'flex-1 hover:opacity-80'}`}
            >
              <MessageCircle size={24} className={activeTab === 'chat' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'chat' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'chat' ? 0 : 2} />
            </button>
          </div>

          <button className="w-[60px] h-[60px] bg-[#8E8E93] rounded-full shadow-[0_8px_25px_rgba(0,0,0,0.12)] flex items-center justify-center text-white hover:opacity-90 transition-opacity shrink-0 pointer-events-auto">
            <Search size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* --- All Full-Screen Modals --- */}
        {renderCardDetailModal()}
        {renderTransactionDetailModal()}
        {renderCardManagementModal()}

        {/* QR Code Modal (Pay / Receive) */}
        {showQR && (
          <div className="absolute inset-0 z-40 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => {
              setShowQR(false);
              setQrMode('pay');
            }}></div>
            <div className="mt-auto bg-white rounded-t-[2.5rem] p-6 relative z-10 flex flex-col items-center animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
              
              {!hasAAWallet ? (
                <div className="flex flex-col items-center w-full min-h-[460px]">
                  <div className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
                    Activation Required
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center tracking-tight">Receive to Activate</h3>
                  <p className="text-sm text-gray-500 mb-8 text-center px-4 leading-relaxed">
                    Your Smart Account is pending. Show this EOA QR to a cashier to make your first deposit.
                  </p>

                  <div className="w-64 h-64 bg-white rounded-[2rem] p-4 mb-6 shadow-md border border-[#96EB3C] border-2 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#96EB3C]/10 animate-pulse"></div>
                    <QrCode size={180} className="text-gray-900 relative z-10" />
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 w-full max-w-[280px] flex items-center justify-between mb-8">
                    <div className="flex flex-col overflow-hidden mr-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">EOA (Passkey) Address</span>
                      <span className="text-xs font-mono text-gray-700 truncate">{eoaAddress}</span>
                    </div>
                    <button className="bg-white border border-gray-200 shadow-sm text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                      Copy
                    </button>
                  </div>

                  <button 
                    onClick={handleActivateAA} 
                    className="w-full py-4 bg-[#96EB3C] active:scale-95 hover:bg-[#8ad936] text-gray-900 rounded-2xl font-bold transition-all shadow-md mt-auto"
                  >
                    Simulate Cashier Scan
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex bg-gray-100 p-1 rounded-full mb-6 w-full max-w-[240px] shadow-inner relative">
                    <button 
                      onClick={() => setQrMode('pay')}
                      className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 ${qrMode === 'pay' || qrMode === 'scan' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Pay
                    </button>
                    <button 
                      onClick={() => { setQrMode('receive'); setQrReceiveState('default'); }}
                      className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 flex items-center justify-center gap-1.5 ${qrMode === 'receive' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Receive
                    </button>
                  </div>

                  {qrMode === 'pay' || qrMode === 'scan' ? (
                    <div className="flex flex-col items-center w-full min-h-[460px] animate-in fade-in duration-200">
                      <div className="flex bg-gray-50 border border-gray-200 p-1 rounded-xl mb-6 w-full max-w-[200px]">
                        <button onClick={() => setQrMode('pay')} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${qrMode === 'pay' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Show QR</button>
                        <button onClick={() => setQrMode('scan')} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${qrMode === 'scan' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Scan Camera</button>
                      </div>

                      {qrMode === 'pay' ? (
                        <div className="flex flex-col items-center w-full animate-in zoom-in-95 duration-200">
                          <h3 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">Pay with CashTrees</h3>
                          <p className="text-sm text-gray-500 mb-4 text-center">Show this code to cashier to pay.</p>
                          
                          <div className="flex items-center gap-1.5 bg-[#96EB3C]/20 text-[#65A30D] px-3 py-1.5 rounded-full mb-4 border border-[#96EB3C]/50 shadow-sm">
                            <Zap size={14} className="fill-[#65A30D]" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Smart Routing Enabled</span>
                          </div>
                          
                          <div className="w-56 h-56 bg-white rounded-[2rem] p-4 mb-4 shadow-inner border border-gray-100 relative">
                            <div className="absolute inset-0 border-[6px] border-[#96EB3C] rounded-[2rem] opacity-30 scale-105 animate-pulse"></div>
                            <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50 relative overflow-hidden">
                              <QrCode size={120} className="text-gray-800" />
                              <div className="absolute bg-white p-1 rounded-full shadow-sm">
                                <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-[#96EB3C]"><Layers size={14} /></div>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 text-center px-8 mb-6 font-medium">
                            Automatically deducts from your specific store card balance based on location.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center w-full animate-in zoom-in-95 duration-200">
                          <h3 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">Scan Merchant QR</h3>
                          <p className="text-sm text-gray-500 mb-6 text-center">Align QR code within the frame to pay.</p>
                          
                          <div className="w-64 h-64 bg-gray-900 rounded-[2rem] p-4 mb-6 shadow-inner relative overflow-hidden flex items-center justify-center">
                            <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-[#96EB3C] rounded-tl-xl"></div>
                            <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-[#96EB3C] rounded-tr-xl"></div>
                            <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-[#96EB3C] rounded-bl-xl"></div>
                            <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-[#96EB3C] rounded-br-xl"></div>
                            
                            <div className="w-full h-[2px] bg-[#96EB3C] absolute top-1/2 left-0 shadow-[0_0_15px_#96EB3C] opacity-80 animate-pulse"></div>
                            <Scan size={48} className="text-gray-600 opacity-50" />
                          </div>
                          <p className="text-xs text-gray-400 text-center px-8 mb-6 font-medium">
                            CashTrees Smart Routing will automatically apply your available discounts.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center min-h-[460px]">
                      {qrReceiveState === 'default' && (
                        <div className="flex flex-col items-center w-full animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex flex-col items-center mb-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-xl mb-2 shadow-sm border border-gray-200">
                              <ArrowDownToLine size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">Receive USDC</h3>
                            <span className="text-xs text-gray-500">{userBeamioTag}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-4 bg-blue-50 text-blue-700 px-3 py-1 rounded-md border border-blue-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Self-Custodial Address</span>
                            <span className="text-xs font-mono font-semibold">{aaAddress}</span>
                          </div>

                          <div className="w-56 h-56 bg-white rounded-3xl p-3 mb-6 shadow-md border border-gray-100">
                            <div className="w-full h-full bg-gray-50 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-gray-200">
                              <QrCode size={160} className="text-gray-900" />
                              <div className="absolute bg-white p-1 rounded-full shadow-sm">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white"><span className="font-bold text-xs">$</span></div>
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={() => setQrReceiveState('input')}
                            className="w-full bg-[#E5F0FF] hover:bg-[#d0e3ff] text-[#0055FF] py-3.5 rounded-2xl font-bold transition-all mb-3 flex items-center justify-center gap-2"
                          >
                            <Plus size={18} strokeWidth={3} />
                            Set Specific Amount
                          </button>
                        </div>
                      )}

                      {qrReceiveState === 'input' && (
                        <div className="flex flex-col items-center w-full animate-in slide-in-from-right-8 duration-300">
                          <div className="w-full flex items-center mb-6 relative">
                            <button 
                              onClick={() => setQrReceiveState('default')}
                              className="absolute left-0 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                            >
                              <ChevronRight className="rotate-180" size={20} />
                            </button>
                            <h3 className="text-lg font-bold text-gray-900 mx-auto">Request Amount</h3>
                          </div>

                          <div className="flex items-center text-gray-900 font-bold text-6xl tracking-tighter mt-4 mb-2">
                            <span className="text-2xl mr-2 text-gray-400">USDC</span>
                            <input 
                              type="number" 
                              placeholder="0"
                              value={receiveAmount}
                              onChange={(e) => setReceiveAmount(e.target.value)}
                              className="w-32 bg-transparent outline-none text-center placeholder-gray-200"
                              autoFocus
                            />
                          </div>

                          <button 
                            onClick={handleGenerateRequest}
                            disabled={!receiveAmount || parseFloat(receiveAmount) <= 0}
                            className={`w-full py-4 rounded-2xl font-bold transition-all shadow-md mt-auto ${
                              (!receiveAmount || parseFloat(receiveAmount) <= 0) 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-[#0055FF] hover:bg-blue-700 active:scale-95 text-white'
                            }`}
                          >
                            Generate request
                          </button>
                        </div>
                      )}

                      {qrReceiveState === 'loading' && (
                        <div className="flex flex-col items-center justify-center w-full h-[400px] animate-in fade-in duration-300">
                          <div className="relative w-16 h-16 flex items-center justify-center mb-6">
                             <div className="w-16 h-16 border-4 border-gray-100 border-t-[#0055FF] rounded-full animate-spin"></div>
                             <Zap size={20} className="text-[#0055FF] absolute" />
                          </div>
                          <p className="text-gray-500 font-medium">Creating payment request...</p>
                        </div>
                      )}

                      {qrReceiveState === 'generated' && (
                        <div className="flex flex-col items-center w-full animate-in zoom-in-95 duration-300 w-full">
                          <div className="w-full flex items-center mb-4 relative">
                            <button 
                              onClick={() => { setQrReceiveState('input'); setReceiveAmount(''); }}
                              className="absolute left-0 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                            >
                              <ChevronRight className="rotate-180" size={20} />
                            </button>
                            <h3 className="text-lg font-bold text-gray-900 mx-auto">Ready to Scan</h3>
                          </div>

                          <div className="w-48 h-48 bg-white rounded-3xl p-3 mb-6 shadow-md border border-gray-100">
                            <div className="w-full h-full bg-gray-50 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-gray-200">
                              <QrCode size={140} className="text-gray-900" />
                              <div className="absolute bg-white p-1 rounded-full shadow-sm">
                                <div className="w-8 h-8 bg-[#0055FF] rounded-full flex items-center justify-center text-white"><span className="font-bold text-xs">$</span></div>
                              </div>
                            </div>
                          </div>

                          <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-6">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm text-gray-500">Requesting</span>
                              <span className="font-bold text-gray-900">{parseFloat(receiveAmount).toFixed(2)} USDC</span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 pb-1 flex justify-between items-start">
                              <span className="font-bold text-[#65A30D]">You Receive</span>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-[#65A30D] text-lg">{parseFloat(receiveAmount).toFixed(2)} USDC</span>
                                <span className="text-[10px] text-gray-400 mt-0.5">Free incoming transfers</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* --- Gift (赠礼) Modal --- */}
        {showGiftModal && (
          <div className="absolute inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => {setShowGiftModal(false); setIsSelectingGiftStore(false);}}></div>
            <div className="mt-auto bg-white rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[85%]">
              <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
              
              {isSelectingGiftStore ? (
                <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
                  <div className="flex items-center mb-6 relative w-full">
                    <button onClick={() => setIsSelectingGiftStore(false)} className="absolute left-0 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <h3 className="text-lg font-bold text-gray-900 mx-auto">Select Asset to Gift</h3>
                  </div>
                  
                  <div className="space-y-4 overflow-y-auto pb-6">
                    {([
                      {
                        id: 'usdc',
                        name: 'USDC Balance',
                        type: 'Unallocated Funds',
                        color: 'bg-blue-500',
                        text: 'text-white',
                        balanceCad: usdcValuationCad,
                      } satisfies UsdcGiftVault,
                      ...storeCards,
                    ] satisfies GiftSource[]).map((card) => {
                      const IconCmp: LucideIcon = card.id === 'usdc' ? Layers : (card as StoreCard).icon;
                      return (
                      <div 
                        key={card.id}
                        onClick={() => { setGiftStore(card); setIsSelectingGiftStore(false); }}
                        className="flex items-center p-4 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer hover:border-[#65A30D] hover:bg-[#96EB3C]/5 transition-colors shadow-sm"
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-inner ${card.id === 'usdc' ? 'bg-blue-500' : `bg-gradient-to-br ${card.color}`} text-white`}>
                           {card.id === 'usdc' ? <span className="font-bold">$</span> : <IconCmp size={18} />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-900">{card.name}</h4>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{card.type}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-bold text-gray-900">CA$ {card.balanceCad ? card.balanceCad.toFixed(2) : '0.00'}</p>
                           <p className="text-[10px] text-gray-400">Available</p>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full animate-in fade-in duration-200">
                  <div className="flex flex-col items-center justify-center mb-6 mt-2">
                    <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center text-pink-50 mb-4 shadow-sm border border-pink-100">
                      <Gift size={32} className="text-pink-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight text-center">Send a Store Gift</h3>
                    <p className="text-sm text-gray-500 mb-6 text-center px-6">Gift specific store cards or unallocated USDC to friends.</p>

                    <div className="flex items-center text-gray-900 font-bold text-6xl tracking-tighter">
                      <span className="text-3xl mr-1 text-gray-400">$</span>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        value={giftAmount}
                        onChange={(e) => setGiftAmount(e.target.value)}
                        className="w-40 bg-transparent outline-none text-center placeholder-gray-200"
                      />
                    </div>
                    
                    <div 
                      onClick={() => setIsSelectingGiftStore(true)}
                      className="mt-4 bg-gray-100 text-gray-700 px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors shadow-sm"
                    >
                      {giftStore ? (
                        <>
                          <div className={`w-4 h-4 rounded-full ${giftStore.id === 'usdc' ? 'bg-blue-500' : `bg-gradient-to-br ${giftStore.color}`} border border-white/20 shadow-inner`}></div>
                          {giftStore.name} <ChevronRight size={14} className="text-gray-400"/>
                        </>
                      ) : (
                        <>
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-[8px] font-bold">$</div>
                          Unallocated USDC <ChevronRight size={14} className="text-gray-400"/>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 mb-3 border border-gray-200 flex items-center shadow-sm">
                    <UserCircle className="text-gray-400 mr-3" size={24} />
                    <div className="flex-1 flex items-center">
                      <span className="text-gray-900 font-bold mr-2">To:</span>
                      <input 
                        type="text" 
                        placeholder="@beamio.tag or Phone #"
                        value={giftRecipient}
                        onChange={(e) => setGiftRecipient(e.target.value)}
                        className="w-full bg-transparent outline-none text-gray-800 font-semibold placeholder-gray-400"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 mb-auto border border-gray-200 flex items-center shadow-sm">
                    <MessageCircle className="text-gray-400 mr-3" size={24} />
                    <div className="flex-1 flex items-center">
                      <input 
                        type="text" 
                        placeholder="Add a message..."
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                        className="w-full bg-transparent outline-none text-gray-800 font-medium placeholder-gray-400"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-5 mt-6 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-500 font-medium">Gift Amount</span>
                      <span className="text-sm font-bold text-gray-900">
                        {giftStore && giftStore.id !== 'usdc' ? 'CA$' : 'USDC'} {giftCadAmount.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200 border-dashed">
                      <span className="text-sm text-gray-500 font-medium flex items-center">
                        Network Fee (0.8%)
                        <Info size={12} className="ml-1 text-gray-400" />
                      </span>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-sm font-mono font-bold text-gray-900">+ {giftFeeUsdc.toFixed(2)} USDC</span>
                        {(giftFeeUsdc === 0.02 || giftFeeUsdc === 2) && (
                          <span className="text-[9px] text-gray-400 mt-0.5">
                            {giftFeeUsdc === 0.02 ? 'Minimum fee applied' : 'Maximum fee cap applied'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
                      <span className="text-sm font-bold text-gray-900">Total Cost</span>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-base font-extrabold text-gray-900">
                           USDC {(giftCadAmount / EXCHANGE_RATE + giftFeeUsdc).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleConfirmGift} 
                    disabled={!giftCadAmount || giftCadAmount <= 0}
                    className={`w-full py-4 rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-4 ${(!giftCadAmount || giftCadAmount <= 0) ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-gray-900 hover:bg-gray-800 active:scale-95 text-white'}`}
                  >
                    <Gift size={20} className={(!giftCadAmount || giftCadAmount <= 0) ? 'text-gray-400' : 'text-white'} />
                    Confirm & Send Gift
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Add Cash (充值) Modal --- */}
        {showAddCashModal && (
          <div className="absolute inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => {setShowAddCashModal(false); setIsSelectingTopUpStore(false);}}></div>
            <div className="mt-auto bg-white rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[85%]">
              
              <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
              
              {addCashMode === 'methods' ? (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight text-center">Add Funds</h3>
                  <p className="text-sm text-gray-500 mb-8 text-center px-4">Fund your self-custodial wallet or top up merchant cards.</p>

                  <div className="space-y-3 mb-auto">
                    <h4 className="text-sm font-bold text-gray-900 mb-3 px-1">Funding Source</h4>
                    
                    <div 
                      onClick={() => setAddCashMode('store_qr')}
                      className="bg-white border border-[#96EB3C]/50 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-[#96EB3C]/10 active:scale-[0.98] transition-all relative overflow-hidden group"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#96EB3C]/20 rounded-full -mr-10 -mt-10 blur-xl group-hover:bg-[#96EB3C]/30 transition-colors"></div>
                      <div className="flex items-center relative z-10">
                        <div className="w-10 h-10 bg-[#96EB3C] rounded-xl flex items-center justify-center mr-3 shadow-sm">
                           <Store className="text-gray-900" size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Load Store Card via Cashier</p>
                          <p className="text-xs text-gray-600">Give physical cash to the issuing merchant</p>
                        </div>
                      </div>
                      <QrCode className="text-gray-900 relative z-10" size={20} />
                    </div>

                    <div 
                      onClick={() => setAddCashMode('coinbase')}
                      className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 active:scale-[0.98] transition-all mt-4"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-[#0052FF] rounded-xl flex items-center justify-center mr-3 shadow-sm">
                           <span className="text-white font-bold text-xl">C</span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Buy USDC via Coinbase</p>
                          <p className="text-xs text-gray-500">3rd-party platform. Auto-deposits to wallet.</p>
                        </div>
                      </div>
                      <ChevronRight className="text-gray-400" size={20} />
                    </div>

                    <div 
                      onClick={() => setAddCashMode('topup_store')}
                      className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 active:scale-[0.98] transition-all mt-4"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center mr-3">
                           <ArrowRightLeft className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Top Up Store Card</p>
                          <p className="text-xs text-gray-500">Use your USDC to fund a merchant card</p>
                        </div>
                      </div>
                      <ChevronRight className="text-gray-400" size={20} />
                    </div>
                  </div>
                </>
              ) : addCashMode === 'store_qr' ? (
                <>
                  <div className="flex items-center mb-6 w-full">
                    <button onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-6">
                      <ChevronRight className="rotate-180 mr-1" size={16} /> Back
                    </button>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight mx-auto">Store Deposit</h3>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center mb-auto pt-4">
                    <p className="text-sm text-gray-500 mb-8 text-center max-w-[260px] leading-relaxed">
                      Show this code to the <span className="font-bold text-gray-900">issuing merchant</span> and hand them your paper cash.
                    </p>
                    
                    <div className="w-64 h-64 bg-white rounded-[2rem] p-4 mb-6 shadow-md border border-gray-100">
                      <div className="w-full h-full bg-gray-50 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-gray-200">
                        <QrCode size={140} className="text-gray-900" />
                        <div className="absolute bg-white p-1 rounded-full shadow-sm border border-gray-100">
                           <div className="w-8 h-8 bg-[#96EB3C] rounded-full flex items-center justify-center text-gray-900 font-bold text-lg">🌳</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 w-full max-w-[280px] flex items-center justify-between mb-8">
                      <div className="flex flex-col overflow-hidden mr-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Wallet Address</span>
                        <span className="text-xs font-mono text-gray-700 truncate">{!hasAAWallet ? eoaAddress : aaAddress}</span>
                      </div>
                      <button className="bg-white border border-gray-200 shadow-sm text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                        Copy
                      </button>
                    </div>
                  </div>
                </>
              ) : addCashMode === 'coinbase' ? (
                <>
                  <div className="flex items-center mb-6 w-full">
                    <button onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-6">
                      <ChevronRight className="rotate-180 mr-1" size={16} /> Back
                    </button>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight mx-auto">Coinbase</h3>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center mb-auto pt-4 w-full">
                    <div className="w-16 h-16 bg-[#0052FF] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-6">
                      C
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Buy USDC directly</h4>
                    <p className="text-sm text-gray-500 mb-8 text-center px-4 leading-relaxed">
                      CashTrees is a self-custodial wallet and never touches your fiat. You will be securely redirected to Coinbase to complete your purchase. USDC will auto-deposit to your wallet.
                    </p>

                    <div className="w-full max-w-[280px] bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-8 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs text-gray-500 font-medium">To Wallet</span>
                        <span className="text-xs font-mono text-gray-900 font-bold bg-white px-2 py-1 rounded shadow-sm border border-gray-100">{!hasAAWallet ? eoaAddress : aaAddress}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-medium">Network</span>
                        <div className="flex items-center bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                          <div className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center mr-1.5"></div>
                          <span className="text-xs font-bold text-gray-900">Base</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : addCashMode === 'topup_store' ? (
                isSelectingTopUpStore ? (
                  <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
                    <div className="flex items-center mb-6 relative w-full">
                      <button onClick={() => setIsSelectingTopUpStore(false)} className="absolute left-0 p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors">
                        <ChevronLeft size={20} />
                      </button>
                      <h3 className="text-lg font-bold text-gray-900 mx-auto">Select Store Card</h3>
                    </div>
                    
                    <div className="space-y-4 overflow-y-auto pb-6">
                      {storeCards.map(card => {
                        const IconCmp = card.icon;
                        return (
                        <div 
                          key={card.id}
                          onClick={() => { setTopUpStore(card); setIsSelectingTopUpStore(false); }}
                          className="flex items-center p-4 bg-gray-50 border border-gray-200 rounded-2xl cursor-pointer hover:border-[#65A30D] hover:bg-[#96EB3C]/5 transition-colors shadow-sm"
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 shadow-inner bg-gradient-to-br ${card.color} text-white`}>
                             <IconCmp size={18} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{card.name}</h4>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{card.type}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-bold text-gray-900">CA$ {card.balanceCad.toFixed(2)}</p>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center mb-6 w-full">
                      <button onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-6">
                        <ChevronRight className="rotate-180 mr-1" size={16} /> Back
                      </button>
                      <h3 className="text-xl font-bold text-gray-900 tracking-tight mx-auto">Top Up Store Card</h3>
                    </div>

                    <div className="flex flex-col mb-auto pt-2 w-full animate-in fade-in duration-200">
                      <div className="bg-gray-50 border border-gray-200 rounded-3xl p-5 mb-2 relative shadow-inner">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold text-gray-500">From Vault (USDC)</span>
                          <span className="text-xs font-bold text-gray-400">Bal: {usdcBalance.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-3xl font-bold text-gray-900">
                            {addAmountCad ? (parseFloat(addAmountCad) / EXCHANGE_RATE).toFixed(2) : '0.00'}
                          </span>
                          <div className="flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-[10px] mr-1.5">$</div>
                            <span className="text-sm font-bold">USDC</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center -my-4 relative z-10">
                        <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
                          <ArrowDownToLine size={18} className="text-gray-400" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#96EB3C]/50 rounded-3xl p-5 mt-2 relative shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-semibold text-gray-500">To Store Card (CAD)</span>
                          <button onClick={() => setIsSelectingTopUpStore(true)} className="text-xs text-[#65A30D] font-bold hover:underline">Change</button>
                        </div>
                        
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${topUpStore.color} border border-gray-200 shadow-inner`}></div>
                            <span className="font-bold text-gray-900">{topUpStore.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <input 
                            type="number" 
                            placeholder="0.00"
                            value={addAmountCad}
                            onChange={(e) => setAddAmountCad(e.target.value)}
                            className="bg-transparent text-3xl font-bold text-[#65A30D] outline-none w-1/2 placeholder-[#65A30D]/30"
                            autoFocus
                          />
                          <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                            <span className="text-sm font-bold text-gray-700">CAD</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 bg-gray-50 rounded-2xl p-4 border border-gray-200">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Exchange Rate</span>
                          <span className="font-semibold text-gray-900">1 USDC = {EXCHANGE_RATE} CAD</span>
                        </div>
                      </div>

                      <button 
                        onClick={handleConfirmTopUp}
                        disabled={!addAmountCad || (parseFloat(addAmountCad) / EXCHANGE_RATE) > usdcBalance}
                        className={`w-full py-4 mt-6 rounded-2xl font-bold transition-all shadow-[0_4px_14px_rgba(150,235,60,0.4)] flex items-center justify-center gap-2 ${(!addAmountCad || (parseFloat(addAmountCad) / EXCHANGE_RATE) > usdcBalance) ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-[#96EB3C] hover:bg-[#8ad936] active:scale-95 text-gray-900'}`}
                      >
                        <ArrowDownToLine size={20} className={(!addAmountCad || (parseFloat(addAmountCad) / EXCHANGE_RATE) > usdcBalance) ? 'text-gray-400' : 'text-gray-900'} />
                        Confirm Top Up
                      </button>
                    </div>
                  </>
                )
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

