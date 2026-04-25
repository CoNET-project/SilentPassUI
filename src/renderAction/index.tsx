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
  Star
} from 'lucide-react';

type StoreCardRow = {
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

export default function CashTreesApp() {
  const [showQR, setShowQR] = useState(false);
  const [qrMode, setQrMode] = useState('receive');
  const [showNFCScanner, setShowNFCScanner] = useState(false);
  
  // Send State
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAsset, setSendAsset] = useState('CAD'); 

  // Add Cash State
  const [showAddCashModal, setShowAddCashModal] = useState(false);
  const [addAmount, setAddAmount] = useState(''); 
  const [addCashMode, setAddCashMode] = useState('methods'); 

  // Balance Details State
  const [showBalanceDetails, setShowBalanceDetails] = useState(false);

  // QR Receive State
  const [qrReceiveState, setQrReceiveState] = useState('default');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMemo, setReceiveMemo] = useState('');

  // AA 钱包激活状态 & 物理卡绑定状态
  const [hasAAWallet, setHasAAWallet] = useState(false);
  const [isPhysicalCardBound, setIsPhysicalCardBound] = useState(false); 

  // Tab State
  const [activeTab, setActiveTab] = useState('home'); 

  const [storeCards] = useState<StoreCardRow[]>([
    { id: 'senpho', name: 'Sen Pho + Cafe', type: 'Black Card', color: 'from-gray-800 to-gray-900', borderColor: 'border-gray-700', iconColor: 'text-yellow-500', bgColor: 'bg-yellow-500/20', icon: Star, balanceCad: 50.0 },
    { id: 'lumina', name: 'Lumina Roasters', type: 'Green Card', color: 'from-emerald-500 to-teal-700', borderColor: 'border-emerald-600', iconColor: 'text-white', bgColor: 'bg-white/20', icon: CreditCard, balanceCad: 10.0 },
  ]);
  const [selectedStoreCard, setSelectedStoreCard] = useState<StoreCardRow | null>(null);

  const userBeamioTag = "@alex.tag";
  const eoaAddress = "0x212F...8A9B";
  const aaAddress = "0x799E...75C8";

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (showNFCScanner) {
      timer = setTimeout(() => {
        setShowNFCScanner(false);
        if (!hasAAWallet) setHasAAWallet(true);
        setIsPhysicalCardBound(true); 
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

  const EXCHANGE_RATE = 1.37;
  const reqCadAmount = parseFloat(receiveAmount) || 0;
  const reqUsdcEquivalent = reqCadAmount / EXCHANGE_RATE;
  
  let reqFeeUsdc = reqUsdcEquivalent * 0.008; 
  if (reqCadAmount > 0) {
    if (reqFeeUsdc < 0.02) reqFeeUsdc = 0.02; 
    if (reqFeeUsdc > 2) reqFeeUsdc = 2;       
  } else {
    reqFeeUsdc = 0;
  }
  const reqNetUsdc = reqUsdcEquivalent - reqFeeUsdc;

  const handleGenerateRequest = () => {
    if (!receiveAmount || parseFloat(receiveAmount) <= 0) return;
    setQrReceiveState('loading');
    setTimeout(() => setQrReceiveState('generated'), 1500);
  };

  // ==========================================
  // TAB 1: 首页 (Home) - 完美融合了之前的 Wallet 功能
  // ==========================================
  const renderHomeTab = () => (
    <div className="animate-in fade-in duration-300 pb-32">
      <div className="px-6 pt-12 pb-2 flex justify-between items-center">
        {/* 顶部的 @BeamioTag 作为跳转 Profile 个人中心的入口 */}
        <button 
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-2 bg-white shadow-sm border border-gray-200 rounded-full pl-1.5 pr-4 py-1.5 transition-transform active:scale-95 hover:bg-gray-50 group"
        >
          <div className="w-8 h-8 bg-gradient-to-tr from-[#96EB3C] to-[#65A30D] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner group-hover:scale-105 transition-transform">
            A
          </div>
          <span className="text-base font-bold text-gray-900 tracking-tight">{userBeamioTag}</span>
        </button>

        {/* 右上角快速设置入口 */}
        {hasAAWallet && (
          <button className="w-9 h-9 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
            <SlidersHorizontal size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {!hasAAWallet ? (
        // 未激活时，直接在首页展示 EOA 充值/贴卡引导
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
        // 激活后，首页就是最完美的实体卡与操作中心
        <>
          <div className="px-6 pt-2 pb-6">
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
                    <span className="font-extrabold text-[22px] tracking-tight text-gray-900 leading-none mb-1.5">CashTrees</span>
                    <div 
                      onClick={(e) => { e.stopPropagation(); }}
                      className="flex items-center gap-1.5 bg-gray-900/10 border border-gray-900/5 px-2 py-0.5 rounded-md shadow-sm hover:bg-gray-900/20 transition-colors"
                    >
                      <span className="text-[10px] text-gray-800 font-mono tracking-widest font-semibold uppercase">{aaAddress}</span>
                      <Copy size={10} className="text-gray-700" />
                    </div>
                  </div>
                </div>
                <div 
                  onClick={(e) => { e.stopPropagation(); setShowBalanceDetails(true); }}
                  className="w-8 h-8 rounded-full bg-gray-900/10 flex items-center justify-center text-gray-900 backdrop-blur-sm border border-gray-900/5 hover:bg-gray-900/20 transition-colors shadow-sm"
                >
                  <Info size={16} strokeWidth={2.5} />
                </div>
              </div>
              
              <div className="relative z-10 flex justify-between items-end">
                <div>
                  <p className="text-sm text-gray-800 font-bold mb-0.5 opacity-90 tracking-wide">Total Balance</p>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold mr-1 opacity-80">$</span>
                    <p className="text-[44px] font-extrabold tracking-tighter text-gray-900 leading-none">
                      125<span className="text-3xl font-bold text-gray-800/80">.50</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center bg-gray-900/10 backdrop-blur-md border border-gray-900/5 px-3 py-1.5 rounded-full shadow-sm mb-1.5">
                  <div className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-900 tracking-wider uppercase">
                    {isPhysicalCardBound ? 'Card Linked' : 'Virtual Active'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* 极其克制的绑卡胶囊 */}
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

          <div className="pl-6 mb-6 mt-2">
            <div className="flex justify-between items-center mb-3 pr-6">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">My Store Cards ({storeCards.length})</h2>
            </div>
            <div className="flex overflow-x-auto hide-scrollbar gap-4 pb-4 pr-6 snap-x">
              {storeCards.map((card) => {
                const IconComponent = card.icon;
                return (
                  <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedStoreCard(card)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedStoreCard(card);
                      }
                    }}
                    className={`snap-start min-w-[240px] bg-gradient-to-br ${card.color} rounded-[1.5rem] p-5 shadow-md border ${card.borderColor} relative overflow-hidden flex-shrink-0 cursor-pointer hover:-translate-y-1 transition-transform`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl" />
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
                role="button"
                tabIndex={0}
                onClick={() => setActiveTab('store')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveTab('store');
                  }
                }}
                className="snap-start min-w-[120px] bg-gray-50 border-2 border-dashed border-gray-300 rounded-[1.5rem] flex flex-col items-center justify-center text-gray-400 hover:bg-white hover:text-[#65A30D] hover:border-[#65A30D] transition-colors cursor-pointer flex-shrink-0"
              >
                <Plus size={24} className="mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Discover</span>
              </div>
            </div>
          </div>

          <div className="px-6 flex gap-4 mb-10">
            <button 
              onClick={() => { setAddAmount(''); setAddCashMode('methods'); setShowAddCashModal(true); }}
              className="flex-1 bg-white hover:bg-gray-50 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm border border-gray-100 group"
            >
              <div className="w-12 h-12 bg-[#96EB3C] rounded-full flex items-center justify-center shadow-[0_4px_14px_rgba(150,235,60,0.4)]">
                <Plus size={24} className="text-gray-900" />
              </div>
              <span className="font-semibold text-xs text-gray-700">Add Cash</span>
            </button>
            
            <button 
              onClick={() => setShowSendModal(true)}
              className="flex-1 bg-white hover:bg-gray-50 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm border border-gray-100"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-700">
                <Send size={20} className="ml-1" />
              </div>
              <span className="font-semibold text-xs text-gray-700">Send</span>
            </button>

            <button 
              onClick={() => setShowQR(true)}
              className="flex-1 bg-white hover:bg-gray-50 active:scale-95 transition-all py-4 rounded-[1.5rem] flex flex-col items-center justify-center gap-2 shadow-sm border border-gray-100"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-700">
                <QrCode size={20} />
              </div>
              <span className="font-semibold text-xs text-gray-700">Pay/Receive</span>
            </button>
          </div>

          <div className="px-6 mb-8 relative z-30">
            <div className="flex justify-between items-center mb-4 px-1">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Recent Activity</h2>
              <button className="text-sm font-semibold text-[#65A30D] hover:text-[#4d7c1e] transition-colors">View all</button>
            </div>
            
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
              <div className="flex items-center p-3 border-b border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 mr-4">
                  <Radio size={20} className="text-[#65A30D]" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">Sen Pho + Cafe</h3>
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">Card Tap (CashTrees)</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">- $15.50</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Today, 12:40 PM</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center p-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 mr-4">
                  <ArrowUpRight size={20} className="text-gray-900" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">Sent to @jimmy.z</h3>
                      <p className="text-xs text-gray-500 mt-0.5 font-medium">CA$ Transfer</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">- $20.00</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Yesterday</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ==========================================
  // TAB 2: 聊天/消息 (Chat / Messages)
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
  // TAB 3: 联盟会员卡与代金券 (Passes & Vouchers)
  // ==========================================
  const renderStoreTab = () => (
    <div className="animate-in fade-in duration-300 pb-32">
      <div className="px-6 pt-14 mb-6">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Discover</h1>
        <div className="flex items-center mt-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md w-max shadow-sm border border-yellow-200/50">
          <Sparkles size={12} className="mr-1.5" />
          <span className="text-[11px] font-bold uppercase tracking-wider">Alliance Members & Offers</span>
        </div>
      </div>

      <div className="px-6 space-y-6">
        
        {/* 卡券 1：Sen Pho + Cafe (联盟商家展示 - 自动抵扣) */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all duration-300 group relative">
          
          <div className="h-32 relative overflow-hidden bg-orange-50 rounded-t-[2rem]">
            <span className="text-7xl absolute opacity-30 flex items-center justify-center w-full h-full">🍜</span>
            <img 
              src="https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&q=80&w=800" 
              alt="Sen Pho + Cafe" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out z-10"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
              }}
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
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-yellow-600 uppercase tracking-wider">Alliance Member</span>
                </div>
                <p className="text-sm text-gray-500 font-medium">10% Off All Menu Items</p>
              </div>
            </div>
            
            {/* 核心改动：展示为自动抵扣状态，无需手动 Add Pass */}
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">How to use</span>
                <span className="text-sm font-bold text-gray-700">Pay with CashTrees</span>
              </div>
              <div className="bg-[#96EB3C]/20 text-[#65A30D] px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm">
                <ShieldCheck size={14} /> Auto-Applied
              </div>
            </div>
          </div>
        </div>

        {/* 卡券 2：Cha Cha Matcha (引流商品 - 限时免费领取的兑换券，保留 Claim 交互) */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all duration-300 group relative">
          
          <div className="h-32 relative overflow-hidden bg-green-50 rounded-t-[2rem]">
            <span className="text-6xl absolute opacity-30 flex items-center justify-center w-full h-full">🧋</span>
            <img 
              src="https://images.unsplash.com/photo-1558855567-1a42823b18d2?auto=format&fit=crop&q=80&w=800" 
              alt="Boba Tea" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out z-10"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent z-20"></div>
            <div className="absolute bottom-4 left-5 right-5 z-30">
              <h3 className="font-extrabold text-xl text-white tracking-tight drop-shadow-md">Cha Cha Matcha</h3>
            </div>
            
            {/* 限时抢购的高亮徽章 */}
            <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 z-30">
              <Clock size={12} />
              Ends Tomorrow
            </div>
          </div>
          
          <div className="relative h-6 bg-white z-30">
             <div className="absolute -left-3 top-0 w-6 h-6 bg-[#F1F8ED] rounded-full shadow-inner border-r border-gray-100"></div>
             <div className="absolute -right-3 top-0 w-6 h-6 bg-[#F1F8ED] rounded-full shadow-inner border-l border-gray-100"></div>
             <div className="absolute top-3 left-6 right-6 border-t-2 border-dashed border-gray-200"></div>
          </div>
          
          <div className="px-5 pb-5 pt-1 bg-white rounded-b-[2rem] z-30 relative">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap size={14} className="text-red-500 fill-red-500" />
                  <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Limited Voucher</span>
                </div>
                <p className="text-sm text-gray-500 font-medium">1 Free Brown Sugar Boba</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Your Price</span>
                <div className="flex items-center">
                   <span className="text-sm font-bold text-gray-400 line-through mr-1.5">$7.50</span>
                   <span className="text-xl font-extrabold text-[#65A30D] leading-none">FREE</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('home')}
                className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                Claim Now
              </button>
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

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center font-sans text-gray-900 pb-20">
      <div className="w-full max-w-md bg-[#F1F8ED] overflow-hidden relative shadow-2xl sm:rounded-[3rem] sm:border-[8px] border-white sm:my-8 sm:h-[850px] flex flex-col">
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {activeTab === 'home' && renderHomeTab()}
          {activeTab === 'store' && renderStoreTab()}
          {activeTab === 'chat' && renderChatTab()}
          {activeTab === 'profile' && renderProfileTab()}
        </div>

        {/* --- Floating Bottom Navigation Bar --- */}
        <div className="absolute bottom-6 w-full z-30 px-6 flex justify-center items-center gap-3 pointer-events-none">
          
          <div className="flex-1 bg-[#8E8E93] rounded-[2rem] p-1.5 flex justify-between items-center shadow-[0_8px_25px_rgba(0,0,0,0.12)] pointer-events-auto">
            <button 
              onClick={() => setActiveTab('home')}
              className={`relative flex items-center justify-center h-12 transition-all duration-300 ${activeTab === 'home' ? 'w-[76px] bg-white rounded-[1.5rem] shadow-sm' : 'flex-1 hover:opacity-80'}`}
            >
              <Wallet size={24} className={activeTab === 'home' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'home' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'home' ? 0 : 2} />
            </button>

            <button 
              onClick={() => setActiveTab('store')}
              className={`relative flex items-center justify-center h-12 transition-all duration-300 ${activeTab === 'store' ? 'w-[76px] bg-white rounded-[1.5rem] shadow-sm' : 'flex-1 hover:opacity-80'}`}
            >
              <Store size={24} className={activeTab === 'store' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'store' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'store' ? 0 : 2} />
            </button>

            <button 
              onClick={() => setShowQR(true)}
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

        {selectedStoreCard && (
          <div className="absolute inset-0 z-[45] flex flex-col justify-end pointer-events-auto">
            <div
              className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
              onClick={() => setSelectedStoreCard(null)}
              aria-hidden
            />
            <div className="relative z-10 mt-auto bg-white rounded-t-[2.5rem] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-full duration-300">
              <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full mb-5" />
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedStoreCard.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedStoreCard.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStoreCard(null)}
                  className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-200"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-2">Store Balance (CAD)</p>
              <p className="text-3xl font-extrabold text-gray-900 mb-6">${selectedStoreCard.balanceCad.toFixed(2)}</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedStoreCard(null);
                  setActiveTab('store');
                }}
                className="w-full py-3.5 rounded-2xl bg-[#96EB3C] text-gray-900 font-bold hover:bg-[#8ad936] active:scale-[0.99] transition-transform"
              >
                View in Discover
              </button>
            </div>
          </div>
        )}

        {/* --- QR Code Modal (Pay / Receive) --- */}
        {showQR && (
          <div className="absolute inset-0 z-40 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => {
              setShowQR(false);
              setQrReceiveState('default'); 
              setReceiveAmount('');
            }}></div>
            <div className="mt-auto bg-white rounded-t-[2.5rem] p-6 relative z-10 flex flex-col items-center animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
              
              {!hasAAWallet ? (
                // 未激活强制展示的 EOA 充值码
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
                // 激活后的 Pay/Receive 功能
                <>
                  <div className="flex bg-gray-100 p-1 rounded-full mb-6 w-full max-w-[240px] shadow-inner">
                    <button 
                      onClick={() => { setQrMode('pay'); setQrReceiveState('default'); }}
                      className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${qrMode === 'pay' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Pay
                    </button>
                    <button 
                      onClick={() => { setQrMode('receive'); setQrReceiveState('default'); }}
                      className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${qrMode === 'receive' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Receive
                    </button>
                  </div>

                  {qrMode === 'pay' ? (
                    <div className="flex flex-col items-center w-full min-h-[460px]">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">Pay with {userBeamioTag}</h3>
                      <p className="text-sm text-gray-500 mb-6 text-center">Show this code to cashier to pay.</p>
                      <div className="w-64 h-64 bg-white rounded-[2rem] p-4 mb-6 shadow-inner border border-gray-100 relative">
                        <div className="absolute inset-0 border-[6px] border-[#96EB3C] rounded-[2rem] opacity-30 scale-105 animate-pulse"></div>
                        <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center bg-gray-50">
                          <QrCode size={120} className="text-gray-800" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-6">
                        <div className="w-2 h-2 bg-[#65A30D] rounded-full animate-pulse"></div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Auto-refreshes every minute</span>
                      </div>
                      <button onClick={() => { setShowQR(false); setQrReceiveState('default'); }} className="w-full py-4 bg-gray-900 hover:bg-gray-800 active:scale-95 text-white rounded-full font-bold transition-all shadow-md mt-auto">
                        Done
                      </button>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center min-h-[460px]">
                      {qrReceiveState === 'default' && (
                        <div className="flex flex-col items-center w-full animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex flex-col items-center mb-4">
                            <div className="w-12 h-12 bg-gradient-to-tr from-[#96EB3C] to-[#65A30D] rounded-full flex items-center justify-center text-gray-900 font-bold text-xl mb-2 shadow-sm">
                              <Radio size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">CashTrees Card</h3>
                            <span className="text-xs text-gray-500">{userBeamioTag}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-4 bg-purple-50 text-purple-700 px-3 py-1 rounded-md border border-purple-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider">Smart Account</span>
                            <span className="text-xs font-mono font-semibold">{aaAddress}</span>
                          </div>

                          <div className="w-56 h-56 bg-white rounded-3xl p-3 mb-6 shadow-md border border-gray-100">
                            <div className="w-full h-full bg-gray-50 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-gray-200">
                              <QrCode size={160} className="text-gray-900" />
                              <div className="absolute bg-white p-1 rounded-full shadow-sm">
                                <div className="w-8 h-8 bg-[#96EB3C] rounded-full flex items-center justify-center text-gray-900"><Radio size={16} /></div>
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

                          <div className="flex gap-3 w-full">
                            <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
                              <Copy size={16} /> Copy
                            </button>
                            <button className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2">
                              <ArrowUpRight size={18} /> Share
                            </button>
                          </div>
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
                            <span className="text-2xl mr-2 text-gray-400">CA$</span>
                            <input 
                              type="number" 
                              placeholder="0"
                              value={receiveAmount}
                              onChange={(e) => setReceiveAmount(e.target.value)}
                              className="w-32 bg-transparent outline-none text-center placeholder-gray-200"
                              autoFocus
                            />
                          </div>
                          <div className="flex items-center text-sm text-gray-500 mb-8 font-medium">
                            <ArrowRightLeft size={12} className="mr-1" />
                            ≈ {reqUsdcEquivalent.toFixed(2)} USDC
                          </div>

                          <div className="w-full space-y-4 mb-8">
                            <input 
                              type="text" 
                              placeholder="What's this for? (Optional)"
                              value={receiveMemo}
                              onChange={(e) => setReceiveMemo(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-gray-900 outline-none focus:border-[#0055FF] focus:ring-1 focus:ring-[#0055FF] transition-all placeholder-gray-400"
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
                                <div className="w-8 h-8 bg-[#96EB3C] rounded-full flex items-center justify-center text-gray-900"><Radio size={16} /></div>
                              </div>
                            </div>
                          </div>

                          <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-6">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm text-gray-500">Requesting</span>
                              <span className="font-bold text-gray-900">CA$ {reqCadAmount.toFixed(2)}</span>
                            </div>
                            
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-sm text-gray-500 flex items-center">
                                Fee (0.8%) 
                                <Info size={12} className="ml-1 text-gray-400" />
                              </span>
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-semibold text-gray-700">- {reqFeeUsdc.toFixed(2)} USDC</span>
                                {(reqFeeUsdc === 0.02 || reqFeeUsdc === 2) && (
                                  <span className="text-[9px] text-gray-400 mt-0.5">
                                    {reqFeeUsdc === 0.02 ? 'Minimum fee applied' : 'Maximum fee cap applied'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-gray-200 pt-3 pb-1 flex justify-between items-start">
                              <span className="font-bold text-[#65A30D]">Est. Receive</span>
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-[#65A30D] text-lg">{reqNetUsdc.toFixed(2)} USDC</span>
                                <span className="text-xs text-gray-400 mt-0.5">≈ CA$ {(reqNetUsdc * EXCHANGE_RATE).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3 w-full mt-auto">
                            <button 
                              onClick={() => { setQrReceiveState('default'); setReceiveAmount(''); }}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                              Cancel
                            </button>
                            <button className="flex-1 bg-[#0055FF] hover:bg-blue-700 text-white py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-md">
                              <ArrowUpRight size={18} /> Share
                            </button>
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

        {/* --- Add Cash (充值) Modal --- */}
        {showAddCashModal && (
          <div className="absolute inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowAddCashModal(false)}></div>
            <div className="mt-auto bg-white rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[85%]">
              
              <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
              
              {addCashMode === 'methods' ? (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight text-center">Add Cash</h3>
                  <p className="text-sm text-gray-500 mb-8 text-center">Select how you want to fund your balance</p>

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
                          <p className="font-bold text-gray-900">Deposit Cash at Store</p>
                          <p className="text-xs text-gray-600">Give cash to an Alliance cashier</p>
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
                          <p className="font-bold text-gray-900">Coinbase Pay</p>
                          <p className="text-xs text-gray-500">Buy USDC securely with debit/credit</p>
                        </div>
                      </div>
                      <ChevronRight className="text-gray-400" size={20} />
                    </div>

                    <div 
                      onClick={() => setAddCashMode('convert')}
                      className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-gray-50 active:scale-[0.98] transition-all mt-4"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center mr-3">
                           <ArrowRightLeft className="text-blue-600" size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Top up with USDC</p>
                          <p className="text-xs text-gray-500">Convert crypto to Network CA$</p>
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
                      Show this code to any <span className="font-bold text-gray-900">Alliance Cashier</span> and hand them your paper cash.
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

                    <button 
                      onClick={handleActivateAA} 
                      className="w-full py-4 bg-[#96EB3C] active:scale-95 hover:bg-[#8ad936] text-gray-900 rounded-2xl font-bold transition-all shadow-md"
                    >
                      (Dev: Simulate Cashier Scan)
                    </button>
                  </div>
                </>
              ) : addCashMode === 'coinbase' ? (
                <>
                  <div className="flex items-center mb-6 w-full">
                    <button onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-6">
                      <ChevronRight className="rotate-180 mr-1" size={16} /> Back
                    </button>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight mx-auto">Coinbase Pay</h3>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center mb-auto pt-4 w-full">
                    <div className="w-16 h-16 bg-[#0052FF] rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-6">
                      C
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">Buy USDC directly</h4>
                    <p className="text-sm text-gray-500 mb-8 text-center px-4">
                      You will be securely redirected to Coinbase to complete your purchase. The USDC will be deposited to your Base network wallet automatically.
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

                    <button 
                      onClick={handleActivateAA}
                      className="w-full py-4 bg-[#0052FF] hover:bg-blue-700 active:scale-95 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-center"
                    >
                      Continue to Coinbase
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center mb-6 w-full">
                    <button onClick={() => setAddCashMode('methods')} className="text-[#65A30D] font-bold flex items-center text-sm absolute left-6">
                      <ChevronRight className="rotate-180 mr-1" size={16} /> Back
                    </button>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight mx-auto">Top Up</h3>
                  </div>

                  <div className="flex flex-col mb-auto pt-2 w-full">
                    <div className="bg-gray-50 border border-gray-200 rounded-3xl p-5 mb-2 relative shadow-inner">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-gray-500">From (USDC)</span>
                        <span className="text-xs font-bold text-gray-400">Bal: 91.20</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <input 
                          type="number" 
                          placeholder="0.00"
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          className="bg-transparent text-3xl font-bold text-gray-900 outline-none w-1/2"
                        />
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
                        <span className="text-sm font-semibold text-gray-500">To (Network Balance)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-[#65A30D]">
                          {addAmount ? (parseFloat(addAmount) * 1.37).toFixed(2) : '0.00'}
                        </span>
                        <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                          <span className="text-sm font-bold text-gray-700">CA$</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 bg-gray-50 rounded-2xl p-4 border border-gray-200">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-500">Rate</span>
                        <span className="font-semibold text-gray-900">1 USDC = 1.37 CAD</span>
                      </div>
                      <div className="flex justify-between items-center text-sm pt-2">
                        <span className="text-gray-500">Network Fee</span>
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-[#65A30D] bg-[#96EB3C]/20 px-2 py-0.5 rounded-md">Free</span>
                          <span className="text-[10px] text-gray-400 mt-1">Sponsored by CashTrees</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleActivateAA}
                      className="w-full py-4 mt-6 bg-[#96EB3C] hover:bg-[#8ad936] active:scale-95 text-gray-900 rounded-2xl font-bold transition-all shadow-[0_4px_14px_rgba(150,235,60,0.4)] flex items-center justify-center gap-2"
                    >
                      <ArrowDownToLine size={20} className="text-gray-900" />
                      Confirm Top Up
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* --- Balance/Send/NFC Modals --- */}
        {showBalanceDetails && (
          <div className="absolute inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowBalanceDetails(false)}></div>
            <div className="mt-auto bg-[#F1F8ED] rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
              <div className="mx-auto w-12 h-1.5 bg-gray-300 rounded-full mb-6"></div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight text-center">Balance Details</h3>
              <p className="text-sm text-gray-500 mb-8 text-center">Your purchasing power breakdown</p>
              
              <div className="w-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mb-8">
                <div className="p-4 flex items-center justify-between bg-gradient-to-r from-[#96EB3C]/15 to-transparent border-b border-gray-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-[#96EB3C]/30 text-lg">
                      🌳
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900 tracking-tight">Network Credit</span>
                      <span className="text-[10px] text-[#65A30D] font-bold uppercase tracking-wider mt-0.5">Eligible for Store Discounts</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">$85.50</span>
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-200 text-gray-500 font-bold text-lg">
                      $
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-700 tracking-tight">Standard Cash</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">No discounts (USDC)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-600">$40.00</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowBalanceDetails(false)}
                className="w-full py-4 bg-white hover:bg-gray-50 active:scale-95 text-gray-900 rounded-2xl font-bold transition-all shadow-sm border border-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showSendModal && (
          <div className="absolute inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowSendModal(false)}></div>
            <div className="mt-auto bg-white rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] h-[85%]">
              
              <div className="mx-auto w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
              
              <div className="flex flex-col items-center justify-center mb-8 mt-6">
                <div className="flex items-center text-gray-900 font-bold text-6xl tracking-tighter">
                  <span className="text-3xl mr-1 text-gray-400">$</span>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    className="w-40 bg-transparent outline-none text-center placeholder-gray-200"
                  />
                </div>
                
                <div className="flex items-center gap-1.5 mt-6 bg-gray-100 p-1 rounded-full shadow-inner border border-gray-200/50">
                  <button 
                    onClick={() => setSendAsset('CAD')}
                    className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1 ${sendAsset === 'CAD' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    CA$ <span className="font-medium opacity-70">(Network)</span>
                  </button>
                  <button 
                    onClick={() => setSendAsset('USDC')}
                    className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1 ${sendAsset === 'USDC' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    USDC <span className="font-medium opacity-70">(Crypto)</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-200 flex items-center shadow-sm">
                <UserCircle className="text-gray-400 mr-3" size={24} />
                <div className="flex-1 flex items-center">
                  <span className="text-gray-900 font-bold mr-2">To:</span>
                  <input 
                    type="text" 
                    placeholder="@beamio.tag or 0x..."
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    className="w-full bg-transparent outline-none text-gray-800 font-semibold placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 mb-auto border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-500 font-medium">Delivery</span>
                  <span className="text-sm font-bold text-gray-900">Instant</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-200 border-dashed">
                  <span className="text-sm text-gray-500 font-medium">Network Fee</span>
                  <div className="text-right flex flex-col items-end">
                    {sendAsset === 'CAD' ? (
                      <>
                        <span className="text-sm font-mono font-bold text-gray-900">≈ 0.03 CAD</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">Fixed 0.02 USDC equivalent</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-mono font-bold text-gray-900">0.02 USDC</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">Fixed flat fee</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowSendModal(false)} 
                className="w-full py-4 bg-[#96EB3C] hover:bg-[#8ad936] active:scale-95 text-gray-900 rounded-2xl font-bold transition-all shadow-[0_4px_14px_rgba(150,235,60,0.4)] flex items-center justify-center gap-2 mt-6"
              >
                <Send size={20} className="text-gray-900" />
                Send
              </button>
            </div>
          </div>
        )}

        {showNFCScanner && (
          <div className="absolute inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowNFCScanner(false)}></div>
            <div className="mt-auto bg-white/95 backdrop-blur-3xl rounded-t-[3rem] p-8 pb-12 relative z-10 flex flex-col items-center shadow-[0_-10px_50px_rgba(0,0,0,0.1)] border-t border-gray-100 animate-in slide-in-from-bottom-full duration-300 ease-out">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-[#96EB3C] rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                <div className="absolute inset-2 border-2 border-[#96EB3C]/60 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
                <div className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl border border-gray-100">
                  <Smartphone size={32} className="text-gray-900 absolute" />
                  <Radio size={48} className="text-[#96EB3C] absolute scale-150 animate-pulse opacity-60" />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

