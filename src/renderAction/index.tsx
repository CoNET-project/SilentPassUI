import React, { useState } from 'react';
import type { ReactNode } from 'react';
import {
 Home, Wallet, MessageSquare, Store, ScanLine, Search, Plus,
 X, Zap, ChevronRight, QrCode, Sparkles, ArrowRight, ShieldCheck,
 Check, Info, Crown, ChevronLeft, SmartphoneNfc, Utensils,
 Trophy, ShoppingBag, ArrowRightLeft, Pen, ChevronUp, UserCircle,
 CheckCircle, Copy, Focus, AlertTriangle, Gift, MoreHorizontal,
 Wifi, MapPin, Share, Coffee
} from 'lucide-react';


type PassTheme = 'black' | 'green' | 'starbucks' | 'ccsa';

interface WalletCard {
  id: string;
  merchant: string;
  tagline: string;
  theme: PassTheme;
  balance: number;
}

interface MarketItem {
  id: string;
  tagline: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  image: string;
  merchant: string;
  price: number;
  isVariablePrice?: boolean;
  minPrice: number;
  maxPrice?: number;
  quickSelects?: number[];
  theme: PassTheme;
}

/** Market listing or wallet card passed into the payment bottom sheet (demo combines both shapes) */
type PaymentWorkflowItem = Partial<MarketItem> &
  Partial<WalletCard> & {
    id: string;
    merchant: string;
    theme: PassTheme;
    isReloadAction?: boolean;
    isGiftPurchase?: boolean;
  };


// --- CUSTOM SVG LOGO (Tree Logo) ---
const CashTreesLogo = ({ className }: { className?: string }) => (
 <div className={`flex items-center justify-center ${className}`}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
       <path d="M12 22v-8m0 0l-4-4m4 4l4-4M10 8v-4m4 4v-4M6 12l4-3m4 3l4-3" />
       <circle cx="10" cy="4" r="1.5" fill="currentColor"/>
       <circle cx="14" cy="4" r="1.5" fill="currentColor"/>
       <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
       <circle cx="18" cy="12" r="1.5" fill="currentColor"/>
    </svg>
 </div>
);


const LeafIcon = ({ className }: { className?: string }) => (
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
   <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
   <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
 </svg>
);


// --- MARKET DATA ---
const MARKET_ITEMS: MarketItem[] = [
 {
   id: "ct-black",
   tagline: "BLACK VIP",
   title: "CashTrees Black VIP",
   subtitle: "Load $100+ to unlock maximum merchant discounts.",
   description: "Experience premium dining with exclusive rewards. Discount rates are set by individual merchants. The entire bill must be paid with this CashTrees card to apply the discount.",
   features: ["Merchant-Defined VIP Discounts", "Sen Pho + Cafe: 10% Off", "Priority Reservations"],
   image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=800",
   merchant: "CashTrees",
   price: 100,
   isVariablePrice: true,
   minPrice: 100,
   quickSelects: [100, 200, 500],
   theme: "black"
 },
 {
   id: "ct-green",
   tagline: "MEMBER",
   title: "CashTrees Green",
   subtitle: "Load $50 - $99 to unlock standard discounts.",
   description: "Start enjoying authentic dining with CashTrees rewards. Discount rates are set by individual merchants. The entire bill must be paid with this CashTrees card to apply the discount.",
   features: ["Merchant-Defined Standard Discounts", "Sen Pho + Cafe: 5% Off", "Instant Digital Setup"],
   image: "https://images.unsplash.com/photo-1563245372068-5b40c6c74796?auto=format&fit=crop&q=80&w=800",
   merchant: "CashTrees",
   price: 50,
   isVariablePrice: true,
   minPrice: 50,
   maxPrice: 99.99,
   quickSelects: [50, 75, 99],
   theme: "green"
 }
];


// --- GENERIC VISUAL CARD COMPONENT ---
const PassCardVisual = ({ theme }: { theme: PassTheme }) => {
 let bgClass = 'bg-[#96EB3C]';
 let textClass = 'text-[#0a1f03]';
 let logoBoxBorder = 'border-black/10';
  let logoBlock = (
    <div className={`bg-[#0a0a0a] border ${logoBoxBorder} w-[88px] h-[88px] flex flex-col items-center justify-center shadow-lg p-2 rounded-sm`}>
       <span className="text-[#96EB3C] text-4xl leading-none italic font-serif tracking-tighter" style={{fontFamily: 'Georgia, serif'}}>Sen</span>
       <span className="text-[#96EB3C] text-[7px] uppercase tracking-[0.2em] mt-1 font-sans">Pho + Cafe</span>
    </div>
 );
 let bottomLogo = <CashTreesLogo className="text-[#0a1f03]" />;


 if (theme === 'black') {
    bgClass = 'bg-[#151515]';
    textClass = 'text-white';
    logoBoxBorder = 'border-white/10';
    bottomLogo = <CashTreesLogo className="text-[#f8f5d7]" />;
 } else if (theme === 'starbucks') {
    bgClass = 'bg-[#00704A]';
    textClass = 'text-white';
    logoBoxBorder = 'border-white/20';
    logoBlock = (
       <div className={`bg-white border ${logoBoxBorder} w-[88px] h-[88px] flex flex-col items-center justify-center shadow-lg p-2 rounded-full`}>
          <Coffee size={40} className="text-[#00704A]" fill="currentColor" />
       </div>
    );
    bottomLogo = <span className="text-white font-bold text-xl tracking-tighter">STARBUCKS</span>;
 } else if (theme === 'ccsa') {
    bgClass = 'bg-gradient-to-br from-gray-900 to-black border border-yellow-900/30';
    textClass = 'text-yellow-500';
    logoBoxBorder = 'border-yellow-600/30';
    logoBlock = (
       <div className={`bg-[#111] border ${logoBoxBorder} w-[88px] h-[88px] flex flex-col items-center justify-center shadow-lg p-2 rounded-xl`}>
          <Crown size={36} className="text-yellow-500 mb-1" fill="currentColor" />
          <span className="text-yellow-500 text-[9px] uppercase tracking-widest font-bold">Alliance</span>
       </div>
    );
    bottomLogo = <span className="text-yellow-500 font-bold text-lg tracking-widest">CCSA VIP</span>;
 }
  return (
   <div className={`w-full aspect-[1.58] ${bgClass} rounded-2xl p-4 flex flex-col justify-between shadow-[0_10px_30px_rgba(0,0,0,0.15)] relative overflow-hidden transition-transform duration-500`}>
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,1) 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>
      <div className="flex justify-between items-start relative z-10">
         {logoBlock}
         <div className="bg-white border border-gray-200 p-1.5 shadow-sm rounded-md">
            <QrCode size={36} className="text-gray-900" strokeWidth={1.5} />
         </div>
      </div>
      <div className="flex justify-between items-end relative z-10">
         <div className={`${textClass} opacity-70 rotate-90 ml-2 mb-1`}>
            <Wifi size={24} strokeWidth={2.5} />
         </div>
         <div className="mr-1">
            {bottomLogo}
         </div>
      </div>
   </div>
 );
};


// --- WALLET LIST CARD COMPONENT ---
const WalletPassCard = ({
  card,
  isExpanded,
  onClick,
  onReload,
}: {
  card: WalletCard;
  isExpanded: boolean;
  onClick: () => void;
  onReload: () => void;
}) => {
 let bgClass = 'bg-[#1E3F1A]';
 let badgeText = card.tagline || 'DEFAULT';
 let icon = <CashTreesLogo className="text-[#a4f056] scale-[0.65]" />;
 let iconContainerClass = 'bg-white/5';


 if (card.theme === 'black') {
   bgClass = 'bg-[#080808]';
   icon = <CashTreesLogo className="text-[#a4f056] scale-[0.65]" />;
 } else if (card.theme === 'starbucks') {
   bgClass = 'bg-[#006241]';
   icon = <Coffee size={24} className="text-[#00704A]" fill="currentColor" />;
   iconContainerClass = 'bg-white';
 } else if (card.theme === 'ccsa') {
   bgClass = 'bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a]';
   icon = <Crown size={24} className="text-yellow-500" fill="currentColor" />;
 }


 return (
   <div
     onClick={onClick}
     className={`relative w-full ${bgClass} rounded-[28px] p-6 shadow-[0_-12px_24px_rgba(0,0,0,0.25)] cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between border-t border-white/10`}
     style={{ height: isExpanded ? '180px' : '150px' }}
   >
     <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,1) 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>
    
     <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-3.5">
           <div className={`w-[44px] h-[44px] ${iconContainerClass} rounded-full flex items-center justify-center p-1 border border-white/10 shadow-inner`}>
              {icon}
           </div>
           <div className="flex flex-col">
              <span className="text-white font-bold text-[18px] tracking-wide leading-tight font-sans">{card.merchant}</span>
              <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-0.5">{badgeText}</span>
           </div>
        </div>
        <div className="text-right flex items-baseline gap-1 mt-1">
           <span className="text-white font-bold text-[26px] tracking-tight leading-none">
              {card.balance.toFixed(2)}
           </span>
           <span className="text-[12px] font-bold text-white/60">CAD</span>
        </div>
     </div>


     <div className={`transition-all duration-300 relative z-10 flex justify-between items-end ${isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="flex gap-2.5">
           <button
              onClick={(e) => { e.stopPropagation(); onReload(); }}
              className="bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-xl text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-white/20 transition-colors border border-white/10"
           >
              <Plus size={16} strokeWidth={2.5}/> Reload
           </button>
           <button
              onClick={(e) => { e.stopPropagation(); }}
              className="bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-xl text-white/80 text-[13px] font-bold flex items-center gap-1.5 hover:bg-white/10 transition-colors border border-white/5"
           >
              <Gift size={16} strokeWidth={2.5}/> Gift
           </button>
        </div>
        <span className="text-white/30 text-[9px] font-mono uppercase tracking-[0.1em] font-medium pb-1">{card.id}</span>
     </div>


     <div className={`absolute bottom-6 right-6 transition-opacity duration-200 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
        <span className="text-white/30 text-[9px] font-mono uppercase tracking-[0.1em] font-medium">{card.id}</span>
     </div>
   </div>
 );
};


// --- MARKET STORY CARD ---
const MarketStoryCard = ({
  item,
  onBuy,
  ownedCard,
}: {
  item: MarketItem;
  onBuy: (item: MarketItem) => void;
  ownedCard: WalletCard | undefined;
}) => {
 const isBlackCard = item.theme === 'black';
 const accentColor = isBlackCard ? 'text-amber-400' : 'text-[#96EB3C]';
 const badgeBg = isBlackCard ? 'bg-amber-400/20' : 'bg-[#96EB3C]/20';
  let buttonText = "Get Card";
 let buttonBg = isBlackCard ? 'bg-white text-black' : 'bg-[#96EB3C] text-[#0a1f03]';
 let isOwnedOrUpgradable = false;
 let isAlreadyVIP = false;


 if (ownedCard) {
    if (ownedCard.theme === 'black') {
       isAlreadyVIP = true;
       buttonText = isBlackCard ? "Reload" : "Gift Card";
       if (!isBlackCard) {
          buttonBg = 'bg-pink-100 text-pink-600 border border-pink-200';
       } else {
          buttonBg = 'bg-amber-400 text-black';
       }
    } else if (ownedCard.theme === 'green') {
       isOwnedOrUpgradable = true;
       if (isBlackCard) {
          buttonText = "Upgrade VIP";
          buttonBg = 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.4)]';
       } else {
          buttonText = "Reload";
          buttonBg = 'bg-[#96EB3C] text-[#0a1f03]';
       }
    }
 }


 return (
   <div className="snap-center relative min-w-[320px] h-[420px] rounded-[36px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-black/5 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => onBuy(item)}>
     <img src={item.image} className="absolute inset-0 w-full h-full object-cover" alt={item.title} />
     <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10"></div>
     <div className="absolute inset-0 flex flex-col justify-between p-6">
        <div className="flex justify-between items-start">
           <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md ${badgeBg}`}>
              {isBlackCard ? <Crown size={12} className={accentColor} /> : <LeafIcon className={`w-3 h-3 ${accentColor}`} />}
              <span className={`text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>{item.tagline}</span>
           </div>
          
           {ownedCard && ((ownedCard.theme === 'green' && !isBlackCard) || (ownedCard.theme === 'black' && isBlackCard)) && (
              <div className="bg-green-500/20 border border-green-500/30 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                 <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">Active</span>
              </div>
           )}
        </div>
        <div className="space-y-4">
           <div>
              <h2 className="text-white text-3xl font-bold leading-tight tracking-tight mb-1">{item.title}</h2>
              <p className="text-gray-300 text-sm font-medium leading-snug opacity-90">{item.merchant}</p>
           </div>
           <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[24px] p-4 flex items-center justify-between">
              <div className="flex flex-col">
                 {ownedCard && ((ownedCard.theme === 'green' && !isBlackCard) || (ownedCard.theme === 'black' && isBlackCard)) ? (
                    <>
                       <span className="text-gray-300 text-[11px] font-medium uppercase tracking-widest mb-0.5">Current Balance</span>
                       <span className="text-white font-bold text-xl leading-none">${ownedCard.balance.toFixed(2)}</span>
                    </>
                 ) : (
                    <>
                       <span className="text-gray-300 text-[11px] font-medium uppercase tracking-widest mb-0.5">{isOwnedOrUpgradable && isBlackCard ? 'Upgrade For' : 'Min. Load'}</span>
                       <span className="text-white font-bold text-xl leading-none">${isOwnedOrUpgradable && isBlackCard ? '100.00' : item.price}</span>
                    </>
                 )}
              </div>
              <button className={`px-5 py-2.5 rounded-full font-bold text-[14px] shadow-lg flex items-center gap-2 transition-colors ${buttonBg}`}>
                {buttonText} {(!isAlreadyVIP || isBlackCard) && <ArrowRight size={14} />}
                {(isAlreadyVIP && !isBlackCard) && <Gift size={14} />}
              </button>
           </div>
        </div>
     </div>
   </div>
 );
};


// --- MARKET DETAIL MODAL ---
const MarketDetailModal = ({
  item,
  ownedCard,
  onClose,
  onPurchase,
}: {
  item: MarketItem;
  ownedCard: WalletCard | undefined;
  onClose: () => void;
  onPurchase: (isReloadAction: boolean, isGiftPurchase: boolean) => void;
}) => {
 const isBlackCard = item.theme === 'black';


 let primaryBtnText = "Reload";
 let primaryBg = "bg-[#1562f0] text-white shadow-blue-500/30";


 if (ownedCard) {
    if (ownedCard.theme === 'green' && isBlackCard) {
       primaryBtnText = "Upgrade VIP";
       primaryBg = "bg-amber-400 text-black shadow-amber-400/30";
    }
 }


 return (
   <div className="fixed inset-0 z-[110] bg-[#F5F5F7] animate-slide-up flex flex-col">
     <div className="absolute top-0 w-full p-6 flex justify-between items-center z-50">
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-gray-900 shadow-sm hover:bg-white transition-colors">
           <X size={20} />
        </button>
        <button className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-gray-900 shadow-sm hover:bg-white transition-colors">
           <Share size={18} />
        </button>
     </div>


     <div className="flex-1 overflow-y-auto scrollbar-hide pb-[120px] pt-20">
        <div className="px-6 mb-8 flex justify-center perspective-1000">
           <div className="w-full max-w-[320px] transform hover:scale-105 transition-transform duration-500 shadow-2xl rounded-2xl">
              <PassCardVisual theme={item.theme} />
           </div>
        </div>


        <div className="px-6 py-8 bg-white relative z-20 rounded-[32px] shadow-sm min-h-full">
           <div className="mb-6">
              <span className="bg-[#1562f0] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-sm">
                 {isBlackCard ? 'CASHTREES VIP' : 'CASHTREES MEMBER'}
              </span>
              <h1 className="text-gray-900 text-[32px] font-extrabold mt-4 tracking-tight leading-tight">
                 {item.title}
              </h1>
           </div>


           <div className="flex items-center gap-8 border-b border-gray-100 pb-8 mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 border border-gray-100">
                    <MapPin size={18} />
                 </div>
                 <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Location</p>
                    <p className="text-[13px] font-bold text-gray-900 mt-0.5">Vancouver, BC</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 border border-gray-100">
                    <ShieldCheck size={18} />
                 </div>
                 <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Security</p>
                    <p className="text-[13px] font-bold text-gray-900 mt-0.5">Guaranteed</p>
                 </div>
              </div>
           </div>


           <h3 className="text-xl font-extrabold text-gray-900 mb-3">About</h3>
           <p className="text-gray-600 text-[15px] leading-relaxed mb-10">
              {item.description}
           </p>


           <div className="bg-[#F5F5F7] rounded-3xl p-6 border border-gray-100">
              <h4 className="text-[12px] font-bold text-gray-900 uppercase tracking-widest mb-5">What's Included</h4>
              <ul className="space-y-4">
                 {item.features?.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-3">
                       <div className="mt-0.5 bg-[#10b981] rounded-full p-1 text-white shrink-0 shadow-sm">
                          <Check size={12} strokeWidth={4} />
                       </div>
                       <span className="text-[15px] text-gray-700 font-medium leading-snug">{f}</span>
                    </li>
                 ))}
              </ul>
           </div>
        </div>
     </div>


     <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 px-6 py-4 pb-8 z-30 flex justify-between items-end shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
        {ownedCard ? (
           ownedCard.theme === 'black' && !isBlackCard ? (
              // 黑卡用户看绿卡 -> 满宽的送礼按钮
              <div className="w-full">
                 <button
                    onClick={() => onPurchase(false, true)}
                    className="w-full bg-pink-500 text-white py-4 rounded-[20px] font-bold text-[17px] flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-pink-500/30"
                 >
                    <Gift size={20} /> Buy as Gift
                 </button>
              </div>
           ) : (
              // 正常自己的卡 或 绿卡看黑卡 -> 显示余额 + 升级/充值 + 送礼小按钮
              <>
                 <div className="flex-1 pr-4 pb-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-0.5">Your Balance</p>
                    <p className="text-3xl font-black text-gray-900 tracking-tight">${ownedCard.balance.toFixed(2)}</p>
                 </div>
                 <div className="flex gap-2">
                    <button
                       onClick={() => onPurchase(true, false)}
                       className={`px-6 py-4 rounded-[20px] font-bold text-[15px] shadow-lg active:scale-95 transition-transform flex items-center justify-center ${primaryBg}`}
                    >
                       {primaryBtnText}
                    </button>
                    <button
                       onClick={() => onPurchase(false, true)}
                       className="w-14 bg-pink-50 text-pink-500 rounded-[20px] flex items-center justify-center active:scale-95 transition-transform hover:bg-pink-100 border border-pink-100"
                    >
                       <Gift size={20} />
                    </button>
                 </div>
              </>
           )
        ) : (
           // 新用户 -> 获取卡片
           <div className="w-full flex justify-between items-center">
              <div>
                 <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-0.5">Min. Load</p>
                 <p className="text-3xl font-black text-gray-900 tracking-tight">${item.price}</p>
              </div>
              <button
                 onClick={() => onPurchase(false, false)}
                 className="bg-[#1562f0] text-white px-8 py-4 rounded-[20px] font-bold text-[17px] flex items-center gap-2 active:scale-95 transition-transform shadow-lg shadow-blue-500/30"
              >
                 Load Card <ArrowRight size={20} />
              </button>
           </div>
        )}
     </div>
   </div>
 );
};




// --- PAYMENT & RELOAD WORKFLOW (BOTTOM SHEET) ---
const PaymentWorkflow = ({
  item,
  isReload = false,
  existingCard,
  onConfirm,
  onCancel,
  goToWallet,
}: {
  item: PaymentWorkflowItem;
  isReload?: boolean;
  existingCard: WalletCard | undefined;
  onConfirm: (amount: number, triggersUpgrade: boolean, isGift: boolean) => void;
  onCancel: () => void;
  goToWallet?: () => void;
}) => {
 // 【修复核心】：使用 useState 锁定当前弹窗的初始状态快照，防止父组件 state (如 myCards) 发生变化时，这里重新渲染导致文字错乱！
 const [_isReload] = useState(Boolean(isReload || item.isReloadAction));
 const [_isGift] = useState(Boolean(item.isGiftPurchase));
 const [_existingCard] = useState(existingCard);


 const [isUpgradingFlow] = useState(_isReload && _existingCard?.theme === 'green' && item.theme === 'black');
 const initialAmount = isUpgradingFlow ? '100' : (_isReload ? '' : (item.price ? item.price.toString() : ''));


 const [step, setStep] = useState('amount');
 const [loadAmount, setLoadAmount] = useState(initialAmount);
  const amtNum = Number(loadAmount);
 const [currentTheme] = useState((_isReload && _existingCard) ? _existingCard.theme : item.theme);
 const [isCashTrees] = useState(item.merchant === 'CashTrees' || item.theme === 'green' || item.theme === 'black');


 const triggersUpgrade = !_isGift && isCashTrees && currentTheme === 'green' && amtNum >= 100;
  let errorMsg = null;
 let isAmountValid = false;


 if (loadAmount !== '' && amtNum > 0) {
    if (_isGift) {
       const minGift = item.minPrice ?? 0;
       if (amtNum < minGift) errorMsg = `Minimum gift amount is $${minGift}`;
       else isAmountValid = true;
    } else if (_isReload) {
       if (amtNum < 10) errorMsg = "Minimum top-up is $10";
       else isAmountValid = true;
    } else {
       const minLoad = item.minPrice ?? 0;
       if (amtNum < minLoad) errorMsg = `Minimum load is $${minLoad}`;
       else isAmountValid = true;
    }
 }


 const quickSelectsToUse = (_isReload && !_isGift && !isUpgradingFlow) ? [25, 50, 100] : (item.quickSelects || [10, 25, 50]);


 const handlePay = () => {
   setStep('processing');
   setTimeout(() => {
     setStep('success');
     // 【修复核心】：在付款成功展示的一瞬间，立刻通知父组件加钱/发卡。
     // 因为 _isReload 已经被 useState 锁死，所以 UI 绝不会变成 "Funds Added!"
     if (!_isGift) {
        onConfirm(amtNum, Boolean(triggersUpgrade), false);
     }
   }, 1500);
 };


 return (
   <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
     <div className="absolute inset-0" onClick={(step === 'amount') ? onCancel : undefined} />
    
     <div className="relative w-full max-w-md bg-white rounded-t-[36px] shadow-2xl overflow-hidden animate-slide-up h-[85vh] flex flex-col">
       <div className="shrink-0 bg-white z-20 pb-2">
           <div className="w-full flex justify-center pt-3 pb-2"><div className="w-12 h-1.5 bg-gray-200 rounded-full" /></div>
           <div className="flex items-center justify-between px-6 mt-2">
              <div className="w-10"></div>
              <h2 className="font-bold text-lg text-gray-900 tracking-tight text-center flex-1">
                 {step === 'processing' ? 'Processing' : step === 'success' ? (_isGift ? '' : 'Done') : ''}
              </h2>
              {step === 'amount' || (step === 'success' && _isGift) ? (
                <button onClick={onCancel} className="bg-gray-100 rounded-full p-2 text-gray-500 hover:bg-gray-200"><X size={18} /></button>
              ) : <div className="w-10"></div>}
           </div>
       </div>


       <div className="flex-1 overflow-y-auto px-6 bg-white scrollbar-hide pb-[130px]">
          {/* STEP 1: AMOUNT */}
          {step === 'amount' && (
             <div className="animate-fade-in pt-4 h-full flex flex-col">
               
                <div className="text-center mb-8 mt-2">
                   <p className="text-lg font-bold text-gray-900 tracking-tight">
                      {_isGift ? `Gift credits for ${item.title ?? 'this pass'}` : `Add credits to CashTrees Card`}
                   </p>
                </div>


                <div className="flex-1 flex flex-col justify-center">
                   <div className="relative mb-8 flex justify-center items-center">
                      <span className="text-gray-400 font-bold text-5xl mr-1">$</span>
                      <input
                        type="number" value={loadAmount} onChange={(e) => setLoadAmount(e.target.value)}
                        placeholder="0" className="w-[200px] bg-transparent text-[72px] font-black text-gray-900 text-center focus:outline-none p-0 hide-arrows tracking-tighter" autoFocus
                      />
                   </div>
                  
                   <div className="flex justify-center gap-3 mb-4">
                      {quickSelectsToUse?.map((amt: number) => (
                         <button
                            key={amt} onClick={() => setLoadAmount(amt.toString())}
                            className={`px-5 py-2.5 rounded-full font-bold text-base transition-all ${loadAmount === amt.toString() ? (_isGift ? 'bg-pink-500 text-white shadow-pink-500/30' : 'bg-gray-900 text-white shadow-md') : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                         >${amt}</button>
                      ))}
                   </div>


                   <div className="h-12 mt-2 flex justify-center items-center">
                      {triggersUpgrade && !_isGift ? (
                         <div className="bg-black text-amber-400 px-4 py-2 rounded-full flex items-center gap-2 animate-scale-in shadow-lg">
                            <Crown size={16} /> <span className="text-sm font-bold">VIP Upgrade Unlocked!</span>
                         </div>
                      ) : currentTheme === 'green' && !_isGift && loadAmount !== '' && amtNum >= 50 && amtNum < 100 ? (
                         <div className="text-gray-600 text-xs font-medium bg-gray-100 px-4 py-2 rounded-full flex items-center gap-1.5"><Info size={14}/> Load ${(100 - amtNum).toFixed(0)} more for Black VIP</div>
                      ) : errorMsg ? (
                         <div className="text-red-500 text-sm font-bold bg-red-50 px-4 py-2 rounded-full flex items-center gap-1.5"><AlertTriangle size={14} /> {errorMsg}</div>
                      ) : null}
                   </div>
                </div>
             </div>
          )}


          {/* STEP 2: PROCESSING */}
          {step === 'processing' && (
             <div className="py-24 flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="relative w-24 h-24 mb-8">
                   <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                   <div className={`absolute inset-0 border-4 border-t-transparent rounded-full animate-spin ${_isGift ? 'border-pink-500' : 'border-[#1562f0]'}`}></div>
                   <div className={`absolute inset-0 flex items-center justify-center ${_isGift ? 'text-pink-500' : 'text-[#1562f0]'}`}>
                      {_isGift ? <Gift size={32} /> : <ShieldCheck size={32} />}
                   </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing</h2>
                <p className="text-gray-500 text-[15px]">{_isGift ? 'Generating magic link...' : 'Securing asset on Base L2...'}</p>
             </div>
          )}


          {/* STEP 3: SUCCESS */}
          {step === 'success' && (
             <>
                {_isGift ? (
                   <div className="py-12 flex flex-col items-center justify-center text-center animate-scale-in w-full">
                      <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-8 shadow-[0_10px_30px_rgba(236,72,153,0.2)]">
                         <Gift size={44} className="text-pink-500" strokeWidth={2.5} />
                      </div>
                      <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Gift Ready!</h2>
                      <p className="text-gray-500 text-[16px] font-medium mb-8 px-6 leading-relaxed">
                         A <b className="text-gray-900">${amtNum.toFixed(2)} CAD</b> {item.theme === 'black' ? 'Black VIP' : 'Green'} voucher has been generated. Send the link to your friend.
                      </p>
                      <div className="w-full bg-gray-50 border border-gray-200 p-4 rounded-[20px] flex items-center gap-3 mb-6">
                         <span className="text-sm text-gray-500 font-mono truncate flex-1 text-left select-all">beamio.link/g/8x92a3</span>
                         <button className="text-[#1562f0] font-bold text-sm uppercase tracking-wide">Copy</button>
                      </div>
                   </div>
                ) : (
                   <div className="py-12 flex flex-col items-center justify-center text-center animate-scale-in w-full">
                      {triggersUpgrade ? (
                         <div className="relative w-full perspective-1000 mb-10 h-[160px] flex justify-center">
                            <div className="w-[280px] h-full absolute animate-flip-to-black preserve-3d">
                               <div className="absolute inset-0 backface-hidden"><PassCardVisual theme="green" /></div>
                               <div className="absolute inset-0 backface-hidden rotate-y-180 shadow-[0_0_50px_rgba(251,191,36,0.3)] rounded-[24px]"><PassCardVisual theme="black" /></div>
                            </div>
                         </div>
                      ) : (
                         <div className="w-24 h-24 bg-[#1562f0] rounded-full flex items-center justify-center shadow-[0_10px_40px_rgba(21,98,240,0.3)] mb-8">
                            <Check size={48} className="text-white" strokeWidth={4} />
                         </div>
                      )}
                      <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
                         {triggersUpgrade ? "VIP Unlocked!" : _isReload ? "Credits Added!" : "Success!"}
                      </h2>
                      <p className="text-gray-500 text-[16px] font-medium mb-4 px-6 leading-relaxed">
                         {triggersUpgrade
                            ? `Your card is now Black VIP. You will enjoy 10% off on all future orders.`
                            : `$${amtNum.toFixed(2)} CAD has been securely added to your ${_isReload ? 'card' : 'new pass'}.`}
                      </p>
                   </div>
                )}
             </>
          )}
       </div>


       {/* STICKY FOOTER WITH WIDE BUTTONS */}
       {(step === 'amount' || step === 'success') && (
          <div className="absolute bottom-0 left-0 w-full px-5 pt-4 bg-white border-t border-gray-50 pb-8 z-30">
             {step === 'amount' && (
                <button onClick={handlePay} disabled={!isAmountValid} className={`w-full h-14 rounded-[20px] font-bold text-[18px] flex items-center justify-center transition-all ${!isAmountValid ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : (_isGift ? 'bg-pink-500 text-white shadow-pink-500/20' : 'bg-[#1562f0] text-white shadow-blue-500/20')} active:scale-[0.98] shadow-lg`}>
                  Confirm
                </button>
             )}
             {step === 'success' && (
                <>
                   {_isGift ? (
                      <button onClick={onCancel} className="w-full h-14 rounded-[20px] font-bold text-[18px] flex items-center justify-center gap-2 bg-black text-white hover:bg-gray-800 transition-colors active:scale-95 shadow-xl">
                         <Share size={18} /> Share Link
                      </button>
                   ) : (
                      <button onClick={_isReload ? onCancel : (goToWallet ?? onCancel)} className="w-full h-14 rounded-[20px] font-bold text-[18px] flex items-center justify-center gap-2 bg-[#F2F2F7] text-[#1562f0] hover:bg-gray-200 transition-colors active:scale-95">
                         {_isReload ? "Done" : <><SmartphoneNfc size={20} /> Open Wallet</>}
                      </button>
                   )}
                </>
             )}
          </div>
       )}
     </div>
   </div>
 );
};


// --- MAIN APP LAYOUT (Stores & Wallet Unified) ---
export default function BeamioAppSimulator() {
 // START WITH NO CASHTREES CARD to demonstrate full zero-to-VIP flow
 const [myCards, setMyCards] = useState<WalletCard[]>([
    { id: "NFT M-000105", merchant: "Starbucks", tagline: "GOLD MEMBER", theme: "starbucks", balance: 12.50 },
    { id: "NFT M-000106", merchant: "CCSA Alliance", tagline: "ALLIANCE PASS", theme: "ccsa", balance: 150.00 }
 ]);
  // Defaulting to market tab for acquisition
 const [activeTab, setActiveTab] = useState<'market' | 'wallet'>('market');
 const [isExpressPayExpanded, setIsExpressPayExpanded] = useState(false);
  const [viewingMarketItem, setViewingMarketItem] = useState<MarketItem | null>(null);
 const [marketBuyingItem, setMarketBuyingItem] = useState<PaymentWorkflowItem | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
 const [reloadingCard, setReloadingCard] = useState<WalletCard | null>(null);


 const ownsCashTreesCard = myCards.some(c => c.merchant === "CashTrees");


 const handleMarketPurchase = (
   item: PaymentWorkflowItem,
   amount: number,
   _triggersUpgrade: boolean,
   isGiftPurchase: boolean,
 ) => {
   // 送礼直接返回，不影响钱包逻辑
   if (isGiftPurchase || item.isGiftPurchase) return;


   const isCashTrees = item.merchant === 'CashTrees' || item.theme === 'green' || item.theme === 'black';


   if (ownsCashTreesCard && isCashTrees) {
      setMyCards(prev => {
         const newCards = [...prev];
         const ctIndex = newCards.findIndex(c => c.merchant === "CashTrees");
         if (ctIndex !== -1) {
            newCards[ctIndex].balance += amount;
            if (amount >= 100 || newCards[ctIndex].theme === 'black') {
                newCards[ctIndex].theme = 'black';
                newCards[ctIndex].tagline = 'BLACK VIP';
            }
         }
         // Move the updated card to the end of the array to appear on top of stack
         const updatedCard = newCards.splice(ctIndex, 1)[0]!;
         return [...newCards, updatedCard];
      });
   } else {
      const finalTheme: PassTheme = (isCashTrees && amount >= 100) ? 'black' : item.theme;
      const finalTagline = isCashTrees ? (finalTheme === 'black' ? 'BLACK VIP' : 'MEMBER') : (item.tagline || 'NEW PASS');


      const newCard = {
        id: `NFT M-${Math.floor(100000 + Math.random() * 900000)}`,
        merchant: item.merchant,
        tagline: finalTagline,
        theme: finalTheme,
        balance: amount,
      };
      setMyCards(prev => [...prev, newCard]);
      setExpandedCardId(newCard.id);
   }
 };


 const handleWalletReload = (amount: number, _triggersUpgrade: boolean, _isGift?: boolean) => {
    const targetId = reloadingCard?.id;
    if (!targetId) return;
    setMyCards(prev => prev.map(card => {
       if (card.id !== targetId) return card;
       const upgraded = card.theme === 'black' || amount >= 100;
       return {
          ...card,
          balance: card.balance + amount,
          theme: upgraded ? 'black' : card.theme,
          tagline: upgraded ? 'BLACK VIP' : card.tagline
       };
    }));
    setReloadingCard(null);
 };


 const renderContent = () => {
   if (activeTab === 'market') {
      const userCashTreesCard = myCards.find(c => c.merchant === "CashTrees");


     return (
       <div className="pb-32 animate-fade-in bg-[#F5F5F7] min-h-full">
         <div className="px-6 pt-16 pb-4 flex justify-between items-end sticky top-0 z-40 bg-[#F5F5F7]/90 backdrop-blur-xl border-b border-gray-200/60">
           <h1 className="text-[34px] font-extrabold text-gray-900 tracking-tight leading-none">Store</h1>
           <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-300 overflow-hidden shadow-sm"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Profile" /></div>
         </div>
        
         <div className="flex gap-5 overflow-x-auto px-6 pb-8 scrollbar-hide snap-x snap-mandatory pt-8">
           {MARKET_ITEMS.map(item => (
             <MarketStoryCard
               key={item.id}
               item={item}
               onBuy={setViewingMarketItem}
               ownedCard={userCashTreesCard}
             />
           ))}
         </div>


         <div className="px-8 pb-10 text-center mt-6">
            <button className="text-gray-500 text-xs font-bold uppercase tracking-widest bg-gray-200/50 px-5 py-2.5 rounded-xl mb-4 hover:bg-gray-200 transition-colors">Redeem Promo Code</button>
            <p className="text-[11px] text-gray-400 leading-relaxed font-medium">Prices may vary by location.<br/>Secured on Base Mainnet.<br/>Beamio Inc. © 2026</p>
         </div>


         {viewingMarketItem && (
            <MarketDetailModal
              item={viewingMarketItem}
              ownedCard={userCashTreesCard}
              onClose={() => setViewingMarketItem(null)}
              onPurchase={(isReloadAction, isGiftPurchase) => {
                 const base = viewingMarketItem;
                 setViewingMarketItem(null);
                 if (!base) return;
                 setMarketBuyingItem({
                    ...base,
                    isReloadAction,
                    isGiftPurchase,
                 });
              }}
            />
         )}


         {marketBuyingItem && (
            <PaymentWorkflow
              item={marketBuyingItem}
              isReload={ownsCashTreesCard && (marketBuyingItem.theme === 'green' || marketBuyingItem.theme === 'black')}
              existingCard={userCashTreesCard}
              onConfirm={(amount, triggersUpgrade, isGift) => handleMarketPurchase(marketBuyingItem, amount, triggersUpgrade, isGift)}
              onCancel={() => setMarketBuyingItem(null)}
              goToWallet={() => { setMarketBuyingItem(null); setActiveTab('wallet'); }}
            />
         )}
       </div>
     );
   }


   if (activeTab === 'wallet') {
     return (
       <div className="pb-32 animate-fade-in bg-[#f5f5f7] min-h-full overflow-x-hidden relative">
          <div className="flex justify-between items-center px-6 pt-16 pb-4">
             <h1 className="text-[28px] font-bold text-black tracking-tight leading-none">Wallet</h1>
             <div className="flex items-center gap-3">
                <button className="text-[#1562f0] font-bold"><ArrowRightLeft size={20} /></button>
                <button className="text-[#1562f0] font-bold"><Pen size={20} /></button>
                <button className="text-[#1562f0] font-bold"><Plus size={24} /></button>
             </div>
          </div>
         
          <div className="px-5 relative mb-6">
             <div className="bg-gradient-to-br from-[#242b6b] to-[#5b154a] rounded-[28px] p-5 text-white shadow-lg h-[210px] w-full">
                <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-2 opacity-80"><UserCircle size={20} /><span className="font-bold text-sm tracking-wide">USDC on Base</span><CheckCircle size={14} className="text-blue-400" /></div>
                   <div className="font-bold text-[15px] opacity-90">6.36 <span className="text-xs font-medium">USDC</span></div>
                </div>
                <div className="text-center mt-2">
                   <div className="text-[52px] font-bold tracking-tighter leading-none mb-1">6.36 <span className="text-xl font-semibold opacity-80">USDC</span></div>
                   <div className="text-sm text-white/60 font-medium">≈ CA$ 8.63</div>
                </div>
             </div>
            
             <div
               onClick={() => setIsExpressPayExpanded(!isExpressPayExpanded)}
               className={`bg-gradient-to-br from-[#8846ff] to-[#4568f5] rounded-[28px] p-5 text-white shadow-[0_-10px_30px_rgba(0,0,0,0.2)] h-[210px] w-[92%] absolute left-1/2 -translate-x-1/2 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer z-20 ${isExpressPayExpanded ? 'top-[230px]' : 'top-[120px]'}`}
             >
                <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-2"><Zap size={20} className="fill-white" /><span className="font-bold text-[15px] tracking-wide">Express Pay</span></div>
                   <button className="bg-white/20 px-3 py-1.5 rounded-[12px] text-xs font-bold flex items-center gap-1.5"><QrCode size={14}/> Pay with QR</button>
                </div>
                <div className="text-center mt-2">
                   <div className="text-[52px] font-bold tracking-tighter text-[#2af063] leading-none mb-1">0.07 <span className="text-xl font-semibold text-[#2af063]/80">USDC</span></div>
                   <div className="text-sm text-white/80 font-medium">≈ CA$ 0.10</div>
                </div>
                <div className="mt-5 flex justify-between items-center">
                   <div className="bg-white/10 w-fit px-3 py-1.5 rounded-[12px] text-xs font-mono font-medium flex items-center gap-2 text-white/90">
                      0x799E...75C8 <Copy size={12} />
                   </div>
                   <ChevronUp size={24} className={`text-white/60 transition-transform duration-500 ${isExpressPayExpanded ? 'rotate-180' : ''}`} />
                </div>
             </div>
          </div>
         
          <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${isExpressPayExpanded ? 'h-[250px]' : 'h-[130px]'}`}></div>


          <div className={`px-5 mt-4 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] transform ${isExpressPayExpanded ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-10 absolute pointer-events-none -z-10'}`}>
            
             <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">{myCards.length} PASSES</div>
            
             {myCards.length === 0 ? (
                <div onClick={() => setActiveTab('market')} className="w-full h-[150px] rounded-[28px] border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 gap-3 hover:bg-gray-200/50 transition-colors cursor-pointer">
                   <div className="w-12 h-12 rounded-full bg-gray-200/50 flex items-center justify-center text-gray-500"><Plus size={24} /></div>
                   <span className="font-bold text-sm">Add a new Pass</span>
                </div>
             ) : (
                <div className="relative pt-2 pb-[160px]">
                   {myCards.map((card, index) => {
                      const isExpanded = expandedCardId === card.id;
                      const expandedIndex = myCards.findIndex(c => c.id === expandedCardId);
                      const isPushedDown = expandedIndex !== -1 && index > expandedIndex;
                     
                      const isFirstPushedDown = isPushedDown && index === expandedIndex + 1;
                      let mt = '0px';
                      if (index > 0) {
                          if (isFirstPushedDown) {
                              mt = '24px';
                          } else {
                              mt = '-105px';
                          }
                      }
                     
                      return (
                         <div
                           key={card.id}
                           className="relative transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] group"
                           style={{
                              marginTop: mt,
                              zIndex: isExpanded ? 50 : index
                           }}
                         >
                            <WalletPassCard
                               card={card}
                               isExpanded={isExpanded}
                               onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                               onReload={() => setReloadingCard(card)}
                            />
                         </div>
                      )
                   })}
                </div>
             )}
          </div>


          {reloadingCard && (
             <PaymentWorkflow
                item={reloadingCard}
                isReload={true}
                existingCard={reloadingCard}
                onConfirm={handleWalletReload}
                onCancel={() => setReloadingCard(null)}
             />
          )}
       </div>
     );
   }
 };


 return (
   <div className="flex justify-center items-center min-h-screen bg-gray-300 font-sans selection:bg-blue-100">
     <div className="relative w-full max-w-md h-[850px] bg-[#F5F5F7] sm:rounded-[50px] shadow-2xl overflow-hidden border-[8px] border-black flex flex-col">
      
       <div className="absolute top-0 w-full h-12 z-50 flex justify-between items-end px-7 pb-2 text-black font-semibold text-[15px] mix-blend-overlay pointer-events-none">
          <span>9:41</span>
          <div className="flex gap-1.5">
            <div className="w-5 h-3 bg-black rounded-sm"></div><div className="w-5 h-3 bg-black rounded-sm"></div><div className="w-7 h-3 border-2 border-black rounded-sm relative"><div className="absolute inset-0.5 bg-black rounded-[1px]"></div></div>
          </div>
       </div>


       <div className="flex-1 overflow-y-auto scrollbar-hide">
          {renderContent()}
       </div>


       <div className="absolute bottom-0 w-full bg-[#f2f2f7] border-t border-gray-300 pb-6 pt-3 px-4 flex justify-around items-center z-40">
          <TabButton icon={<Home size={26} strokeWidth={2} />} active={false} onClick={() => {}} />
          <TabButton icon={<Wallet size={26} strokeWidth={activeTab === 'wallet' ? 2.5 : 2} />} active={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
          <TabButton icon={<Focus size={26} strokeWidth={2} />} active={false} onClick={() => {}} />
          <TabButton icon={<MessageSquare size={26} strokeWidth={2} />} active={false} onClick={() => {}} />
          <TabButton icon={<Store size={26} strokeWidth={activeTab === 'market' ? 2.5 : 2} />} active={activeTab === 'market'} onClick={() => setActiveTab('market')} />
          <TabButton icon={<Search size={26} strokeWidth={2} />} active={false} onClick={() => {}} />
       </div>


     </div>
    
     <style>{`
       input[type="number"]::-webkit-inner-spin-button,
       input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
       input[type="number"] { -moz-appearance: textfield; }
       .hide-arrows { -moz-appearance: textfield; }


       .scrollbar-hide::-webkit-scrollbar { display: none; }
       .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
       @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
       .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
       @keyframes slide-left { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
       .animate-slide-left { animation: slide-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
       @keyframes scale-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
       .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
       @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
       .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
      
       .perspective-1000 { perspective: 1000px; }
       .preserve-3d { transform-style: preserve-3d; }
       .backface-hidden { backface-visibility: hidden; }
       .rotate-y-180 { transform: rotateY(180deg); }
      
       @keyframes flip-to-black {
          0% { transform: rotateY(0deg) scale(1); }
          50% { transform: rotateY(90deg) scale(1.1); }
          100% { transform: rotateY(180deg) scale(1); }
       }
       .animate-flip-to-black {
          animation: flip-to-black 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          animation-delay: 0.3s;
       }
     `}</style>
   </div>
 );
}


const TabButton = ({ icon, active, onClick }: { icon: ReactNode; active: boolean; onClick: () => void }) => (
 <button
   onClick={onClick}
   className={`w-14 h-12 flex flex-col items-center justify-center rounded-xl transition-all duration-200 relative ${active ? 'text-[#1562f0] bg-[#e3e5eb]' : 'text-gray-400 hover:text-gray-600'}`}
 >
    {active && <div className="absolute top-0 w-8 h-1 bg-[#1562f0] rounded-b-full"></div>}
    <div className={`mt-1`}>{icon}</div>
 </button>
);

