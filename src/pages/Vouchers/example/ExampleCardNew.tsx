
import React, { useState, useEffect } from 'react';
import { IpfsImg } from '@/components/IpfsImg';
import {
 Search,
 MapPin,
 Filter,
 ChevronRight,
 Star,
 Zap,
 ShieldCheck,
 Clock,
 ArrowRight,
 Utensils,
 Trophy,
 Sparkles,
 Coffee,
 ShoppingBag,
 X,
 Check,
 Wallet,
 ScanLine,
 Lock,
 Share,
 Info,
 Calendar,
 Gift,
 Copy,
 MessageCircle,
 Send,
 QrCode,
 Wifi,
 AlertTriangle,
 UserCheck,
 CreditCard,
 Plus,
 MoreHorizontal,
 Server,
 Cpu,
 Layers,
 Activity,
 Percent,
 Truck,
 Crown,
 Store,
 CreditCard as CardIcon
} from 'lucide-react';


// --- MOCK DATA ---


const HERO_COLLECTION = [
 {
   id: 101, // CashTrees Black VIP Card
   title: "CashTrees Black VIP",
   subtitle: "Load $100+ to unlock maximum merchant discounts.",
   description: "Experience premium dining with exclusive rewards. Discount rates are set by individual merchants. The entire bill must be paid with this CashTrees card to apply the discount.",
   features: ["Merchant-Defined VIP Discounts", "Sen Pho + Cafe: 10% Off", "Priority Reservations", "Valid at Kerrisdale & Champlain Heights"],
   image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=800", // Elegant dark food image
   merchant: "Sen Pho + Cafe",
   merchantLogo: "🍜",
   partners: [
     { name: "Kerrisdale", address: "6290 East Blvd, Vancouver, BC", icon: "📍", bg: "bg-gray-800 text-white" },
     { name: "Champlain Heights", address: "7056 Kerr St, Vancouver, BC", icon: "📍", bg: "bg-black text-white" }
   ],
   price: 100, // Minimum for Black
   isVariablePrice: true,
   minPrice: 100,
   type: "CashTrees VIP",
   color: "text-white",
   customGradient: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 100%)",
   theme: "black" as const
 },
 {
   id: 102, // CashTrees Green Card
   title: "CashTrees Green Card",
   subtitle: "Load $50 - $99 to unlock standard discounts.",
   description: "Start enjoying authentic dining with CashTrees rewards. Discount rates are set by individual merchants. The entire bill must be paid with this CashTrees card to apply the discount.",
   features: ["Merchant-Defined Standard Discounts", "Sen Pho + Cafe: 5% Off", "Instant Digital Setup", "Valid at Kerrisdale & Champlain Heights"],
   image: "https://images.unsplash.com/photo-1563245372068-5b40c6c74796?auto=format&fit=crop&q=80&w=800", // Bright fresh food
   merchant: "Sen Pho + Cafe",
   merchantLogo: "🍜", // Match the black card's icon style
   partners: [
     { name: "Kerrisdale", address: "6290 East Blvd, Vancouver, BC", icon: "📍", bg: "bg-white text-green-700" },
     { name: "Champlain Heights", address: "7056 Kerr St, Vancouver, BC", icon: "📍", bg: "bg-green-100 text-green-800" }
   ],
   price: 50, // Minimum for Green
   isVariablePrice: true,
   minPrice: 50,
   maxPrice: 99.99,
   type: "CashTrees Member",
   color: "text-[#0e2a05]",
   customGradient: "linear-gradient(to bottom, rgba(150,235,60,0.95) 0%, rgba(150,235,60,0.7) 50%, rgba(150,235,60,0.98) 100%)",
   theme: "green" as const
 }
];


const CATEGORIES = [
 { id: 'dining', name: 'Dining', icon: <Utensils size={20} />, color: 'bg-orange-100 text-orange-600' },
 { id: 'retail', name: 'Retail', icon: <ShoppingBag size={20} />, color: 'bg-pink-100 text-pink-600' },
 { id: 'entertainment', name: 'Events', icon: <Trophy size={20} />, color: 'bg-purple-100 text-purple-600' },
 { id: 'services', name: 'Services', icon: <Sparkles size={20} />, color: 'bg-blue-100 text-blue-600' },
 { id: 'wellness', name: 'Wellness', icon: <Coffee size={20} />, color: 'bg-teal-100 text-teal-600' },
];


// --- TYPES ---
type HeroItem = {
  id: number; title: string; subtitle: string; description: string; features?: string[];
  image?: string; merchant: string; merchantLogo: string;
  partners?: { name: string; address?: string; icon: string; bg: string }[];
  price: number; isVariablePrice?: boolean; minPrice?: number; maxPrice?: number;
  type: string; color: string; customGradient?: string; theme?: 'black' | 'green';
  icon?: string; bg?: string; shadow?: string; overlay?: string;
};
type VoucherItem = {
  id: number; title: string; merchant: string; category?: string; description?: string;
  features?: string[]; location?: string; price: number; originalPrice?: number;
  icon?: string; bg?: string; rating?: number; tag?: string;
  image?: string; overlay?: string; customGradient?: string; shadow?: string;
  theme?: 'black' | 'green';
  partners?: { name: string; address?: string; icon: string; bg: string }[];
};
type ProductItem = HeroItem | VoucherItem;
type InventoryInstance = { id: string; date: string; balance: string };
type InventoryState = Record<number, InventoryInstance[]>;
type ActionSheetState = { item: ProductItem; instance: InventoryInstance };
type GiftingState = { item: ProductItem; instance: InventoryInstance };
type RedeemingState = { item: ProductItem; instance: InventoryInstance };

const TOP_VOUCHERS = [
 {
   id: 301,
   title: "Signature Pan-Fried Buns",
   merchant: "老弄堂 LONGDHANG",
   category: "Free Voucher",
   description: "Enjoy a complimentary serving of our signature Pan-Fried Buns (4pcs). Authentic Shanghai flavor with crispy bottom and juicy filling.",
   features: ["Free Voucher", "Value CA$6.95", "Dine-in Only", "Valid 7 Days"],
   location: "Richmond & Vancouver",
   price: 0,
   originalPrice: 6.95,
   icon: "🥟",
   bg: "bg-red-700",
   rating: 4.9,
   tag: "GIFT"
 },
 {
   id: 201,
   title: "$20 Lunch Pass",
   merchant: "Burger King",
   category: "Dining",
   description: "Get $20 worth of food for only $15. Valid at all participating locations for lunch hours.",
   features: ["Save 25%", "Instant Redeem", "Lunch Hours Only"],
   location: "Global Chain",
   price: 15,
   originalPrice: 20,
   icon: "🍔",
   bg: "bg-orange-500",
   rating: 4.8
 },
 {
   id: 202,
   title: "Deep Tissue Massage",
   merchant: "Urban Spa",
   category: "Wellness",
   description: "A 60-minute deep tissue massage designed to relieve severe tension.",
   features: ["60 Minutes", "RMT Certified", "Includes Aromatherapy"],
   location: "Yaletown",
   price: 65,
   originalPrice: 80,
   icon: "💆‍♀️",
   bg: "bg-purple-500",
   rating: 4.9
 },
];


// --- COMPONENTS ---


const SectionHeader = ({ title, action = "See All" }: { title: string; action?: string }) => (
 <div className="flex justify-between items-end px-5 mb-3 mt-8">
   <h3 className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">{title}</h3>
   <button className="text-[#1562f0] text-[15px] font-medium active:opacity-60">{action}</button>
 </div>
);


const GetButton = ({ price, state = 'ready', count = 0, onClick, compact = false, isVariable = false }: { price: number; state?: 'ready' | 'loading'; count?: number; onClick: () => void; compact?: boolean; isVariable?: boolean }) => {
 if (state === 'loading') {
   return (
     <button className={`${compact ? 'w-16 h-8' : 'px-5 py-1.5 min-w-[75px]'} rounded-full font-bold text-[13px] bg-gray-100 flex items-center justify-center`}>
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
     </button>
   );
 }


 // Visual style for FREE items
 if (price === 0) {
    return (
       <button
         onClick={(e) => { e.stopPropagation(); onClick(); }}
         className={`relative rounded-full font-bold text-[13px] transition-all duration-200 shadow-sm active:scale-95 bg-red-100 text-red-700 hover:bg-red-200 flex items-center justify-center gap-1.5 ${compact ? 'px-4 py-1.5' : 'px-5 py-1.5 min-w-[75px]'}`}
       >
         CLAIM
         {count > 0 && (
            <span className="flex items-center justify-center bg-white text-red-700 text-[9px] h-4 min-w-[16px] px-1 rounded-full -mr-2 shadow-sm font-extrabold">
               x{count}
            </span>
         )}
       </button>
    );
 }


 return (
   <button
     onClick={(e) => { e.stopPropagation(); onClick(); }}
     className={`relative rounded-full font-bold text-[13px] transition-all duration-200 shadow-sm active:scale-95 bg-black text-white hover:bg-gray-800 flex items-center justify-center gap-1.5 ${compact ? 'px-4 py-1.5' : 'px-5 py-1.5 min-w-[75px]'}`}
   >
     {isVariable ? `Load $${price}+` : `$${price}`}
     {count > 0 && (
       <span className="flex items-center justify-center bg-white text-black text-[9px] h-4 min-w-[16px] px-1 rounded-full -mr-2 shadow-sm font-extrabold">
          x{count}
       </span>
     )}
   </button>
 );
};


// --- STORY CARD (Cleaned up for CashTrees) ---
const StoryCard = ({ item, count, onClick, onBuy }: { item: HeroItem; count: number; onClick: (i: HeroItem) => void; onBuy: (i: HeroItem) => void }) => {
 const isBlackCard = item.theme === 'black';


 return (
   <div
     onClick={() => onClick(item)}
     className="snap-center relative min-w-[340px] h-[460px] rounded-[32px] overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.2)] cursor-pointer group active:scale-[0.98] transition-transform duration-300"
   >
     <IpfsImg src={item.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={item.title} />
     <div className="absolute inset-0" style={{ background: item.customGradient }}></div>


     <div className="absolute inset-0 flex flex-col justify-between p-7">
        <div className="mt-8">
           <h2 className={`${isBlackCard ? 'text-white' : 'text-[#0e2a05]'} text-4xl font-extrabold leading-[1.1] tracking-tight drop-shadow-lg w-4/5 mb-3`}>
              {item.title}
           </h2>
           <p className={`${isBlackCard ? 'text-gray-200' : 'text-[#1a4a0a]'} text-[15px] font-medium leading-snug line-clamp-2 drop-shadow-md w-11/12`}>
              {item.subtitle}
           </p>
        </div>


        <div className={`${isBlackCard ? 'bg-black/80 border-gray-700' : 'bg-[#96EB3C]/90 border-[#7ac22e]'} backdrop-blur-xl border rounded-[24px] p-4 flex items-center justify-between shadow-lg`}>
           <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 ${isBlackCard ? 'bg-white/10 border-white/20 text-white' : 'bg-white/40 border-white/50 text-[#1a4a0a]'} backdrop-blur-md rounded-[14px] flex items-center justify-center text-2xl shadow-inner border`}>
                 {item.merchantLogo}
              </div>
             
              <div className="flex flex-col">
                 <span className={`${isBlackCard ? 'text-white' : 'text-[#0e2a05]'} font-bold text-[15px] leading-tight`}>
                    {item.merchant}
                 </span>
                 <div className="flex items-center gap-1.5 mt-0.5">
                    <CardIcon size={12} className={isBlackCard ? 'text-gray-400' : 'text-[#1a4a0a]'} />
                    <span className={`${isBlackCard ? 'text-gray-300' : 'text-[#1a4a0a]'} text-[11px] font-bold uppercase tracking-wide`}>CashTrees</span>
                 </div>
              </div>
           </div>


           <div onClick={(e) => e.stopPropagation()}>
              <GetButton
                price={item.price}
                state="ready"
                count={count}
                onClick={() => onBuy(item)}
                compact={true}
                isVariable={item.isVariablePrice}
              />
           </div>
        </div>
     </div>
   </div>
 );
};




// --- STANDARD PRODUCT DETAIL MODAL ---
const ProductDetailModal = ({ item, inventory, onClose, onBuy, onOpenWallet }: { item: ProductItem; inventory: InventoryInstance[]; onClose: () => void; onBuy: (i: ProductItem) => void; onOpenWallet: () => void }) => {
 if (!item) return null;
 const count = inventory.length;


 const isFree = item.price === 0;
 const isBlackCard = item.theme === 'black';
 const isGreenCard = item.theme === 'green';


 let headerBgClass = item.bg || 'bg-gray-900';
 let accentColorClass = 'bg-[#1562f0]';
 let bannerBgClass = 'from-blue-50 to-indigo-50 border-blue-100';
 let bannerIconClass = 'bg-white text-[#1562f0]';


 if (isBlackCard) {
   headerBgClass = 'bg-black';
   accentColorClass = 'bg-gray-900 text-white hover:bg-black border border-gray-700';
   bannerBgClass = 'from-gray-100 to-gray-200 border-gray-300';
   bannerIconClass = 'bg-black text-white';
 } else if (isGreenCard) {
   headerBgClass = 'bg-[#96EB3C]';
   accentColorClass = 'bg-[#7ac22e] text-white hover:bg-[#68a825]';
   bannerBgClass = 'from-[#ecfce0] to-[#dcf9c6] border-[#bbf293]';
   bannerIconClass = 'bg-[#7ac22e] text-white';
 }


 return (
   <div className="fixed inset-0 z-[80] bg-white animate-slide-up overflow-y-auto flex flex-col">
     <div className="absolute top-0 w-full p-4 flex justify-between items-center z-50">
       <button onClick={onClose} className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-sm hover:bg-white/30 transition-colors"><X size={20} /></button>
       <div className="flex gap-2"><button className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-sm hover:bg-white/30 transition-colors"><Share size={18} /></button></div>
     </div>


     <div className={`relative w-full h-[45vh] shrink-0 ${headerBgClass} ${item.shadow || ''}`}>
        {item.image ? <IpfsImg src={item.image} className="w-full h-full object-cover" alt={item.title} /> : <div className="w-full h-full flex items-center justify-center text-9xl opacity-20 text-white">{item.icon}</div>}
        <div className="absolute inset-0" style={{ background: item.customGradient || (item.overlay ? undefined : 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))') }}></div>
        {item.overlay && !item.customGradient && <div className={`absolute inset-0 bg-gradient-to-t ${item.overlay}`}></div>}
       
        <div className="absolute bottom-0 left-0 w-full p-6 text-white">
           <h1 className={`text-4xl font-extrabold leading-tight mb-2 shadow-sm ${isGreenCard ? 'text-white' : 'text-white'}`}>{item.title}</h1>
           <p className={`text-lg font-medium ${isGreenCard ? 'text-white/90' : 'text-white/90'}`}>{item.merchant}</p>
        </div>
     </div>


     <div className={`flex-1 px-6 py-8 pb-32`}>
        {/* Inventory Status Banner */}
        {count > 0 && (
           <div onClick={onOpenWallet} className={`bg-gradient-to-r ${bannerBgClass} border rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-sm`}>
              <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${bannerIconClass}`}>
                    <Wallet size={20} />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-gray-900">You have {count} cards</h4>
                    <p className="text-xs text-gray-600">Tap to View Balance or Use</p>
                 </div>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
           </div>
        )}


        {/* Important Rules for CashTrees */}
        {(isBlackCard || isGreenCard) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 flex gap-3">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-bold text-yellow-800 text-sm">Discount Condition</h4>
              <p className="text-yellow-700 text-sm mt-1">Discount rates are set by individual merchants. To receive the discount, the <b>entire bill</b> must be paid using the balance on this CashTrees card.</p>
            </div>
          </div>
        )}


        <h3 className={`text-xl font-bold mb-3 text-gray-900`}>About</h3>
        <p className={`leading-relaxed text-[17px] mb-8 text-gray-600`}>{item.description}</p>


        {item.features && (
          <div className={`rounded-2xl p-5 mb-8 bg-[#F2F2F7]`}>
             <h4 className={`text-sm font-bold uppercase tracking-wide mb-4 text-gray-900`}>What's Included</h4>
             <div className="space-y-3">
                {item.features.map((feature: string, idx: number) => (
                   <div key={idx} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ${isBlackCard ? 'bg-black' : (isGreenCard ? 'bg-[#7ac22e]' : 'bg-[#1562f0]')}`}>
                         <Check size={12} strokeWidth={4} />
                      </div>
                      <span className={`font-medium text-gray-700`}>{feature}</span>
                   </div>
                ))}
             </div>
          </div>
        )}


        {/* LOCATIONS LIST */}
        {item.partners && (
           <div className="mt-8 mb-4">
              <h4 className={`text-sm font-bold uppercase tracking-wide mb-4 flex items-center gap-2 ${isGreenCard ? 'text-[#1a4a0a]' : 'text-gray-900'}`}>
                <MapPin size={16} /> Participating Locations
              </h4>
              <div className="space-y-3">
                 {item.partners.map((loc: { name: string; address?: string; icon: string; bg: string }, i: number) => (
                    <div key={i} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${loc.bg}`}>{loc.icon}</div>
                       <div>
                          <span className="block text-sm font-bold text-gray-900 mb-1">{loc.name}</span>
                          <span className="block text-xs text-gray-500">{loc.address}</span>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}
     </div>


     <div className={`fixed bottom-0 w-full max-w-md backdrop-blur-xl border-t p-5 pb-8 z-50 flex gap-3 bg-white/90 border-gray-200`}>
        {count > 0 ? (
           <>
              <button onClick={onOpenWallet} className={`flex-1 border-2 px-4 py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform flex items-center justify-center gap-2 bg-white border-gray-200 text-gray-900`}>
                 <Wallet size={18} /> My Cards <span className={`text-xs px-1.5 py-0.5 rounded-md ml-1 bg-gray-200 text-gray-900`}>x{count}</span>
              </button>
              <button onClick={() => onBuy(item)} className={`flex-[1.5] px-4 py-3.5 rounded-full font-bold text-[15px] shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 ${accentColorClass}`}>
                 Load Another
              </button>
           </>
        ) : (
           <div className="flex-1 flex gap-4 items-center">
              <div className="flex-1">
                 <div className={`text-xs uppercase font-bold text-gray-500`}>Min. Load</div>
                 <div className={`text-3xl font-bold tracking-tight text-gray-900`}>
                   {isFree ? "FREE" : `$${item.price}`}
                 </div>
              </div>
              <button onClick={() => onBuy(item)} className={`px-8 py-3.5 rounded-full font-bold text-[17px] shadow-lg active:scale-95 transition-transform flex items-center gap-2 ${accentColorClass}`}>
                 {isFree ? "Claim Gift" : "Load Card"} <ArrowRight size={20} />
              </button>
           </div>
        )}
     </div>
   </div>
 );
};


// --- CARD PICKER MODAL ---
const CardPickerModal = ({ item, instances, onClose, onSelect }: { item: ProductItem; instances: InventoryInstance[]; onClose: () => void; onSelect: (inst: InventoryInstance) => void }) => {
 const isBlackCard = item.theme === 'black';
 const isGreenCard = item.theme === 'green';
  let stripeColor = 'bg-gray-900';
 if (isBlackCard) stripeColor = 'bg-black';
 else if (isGreenCard) stripeColor = 'bg-[#96EB3C]';
 else if (item.price === 0) stripeColor = 'bg-red-700';


 return (
   <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-md bg-[#F2F2F7] rounded-t-[32px] shadow-2xl overflow-hidden animate-slide-up pb-8 border-t border-white/20" onClick={e => e.stopPropagation()}>
         <div className="w-full flex justify-center pt-3 pb-6"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
         <div className="px-6">
            <div className="flex justify-between items-center mb-6">
               <div>
                  <h2 className="text-xl font-bold text-gray-900">My Wallet</h2>
                  <p className="text-xs text-gray-500">{instances.length} Cards Available</p>
               </div>
               <button onClick={onClose} className="bg-gray-200 p-1.5 rounded-full text-gray-500"><X size={16}/></button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pb-8">
               {instances.map((inst: InventoryInstance, idx: number) => (
                  <div key={inst.id} onClick={() => onSelect(inst)} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden group">
                     <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${stripeColor}`}></div>
                     <div className="flex gap-4 items-center">
                        <div className={`w-12 h-12 rounded-xl ${stripeColor} flex items-center justify-center text-2xl text-white shadow-sm`}>
                           {item.icon || "💎"}
                        </div>
                        <div>
                           <div className="font-bold text-gray-900 flex items-center gap-2">
                              {inst.id}
                              {idx === instances.length - 1 && <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 rounded">NEW</span>}
                           </div>
                           <div className="text-xs text-gray-500">Balance: <span className="font-semibold text-gray-800">{inst.balance || "Full"}</span></div>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-green-50 text-green-600 px-2 py-1 rounded-md">Active</span>
                        <ChevronRight size={16} className="text-gray-300" />
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   </div>
 );
};


// --- REDEEM MODAL ---
const RedeemModal = ({ item, instance, onClose }: { item: ProductItem; instance: InventoryInstance; onClose: () => void }) => {
 if (!item) return null;
 const isBlackCard = item.theme === 'black';
 const isGreenCard = item.theme === 'green';
  let headerBg = 'bg-gray-900';
 if (isBlackCard) headerBg = 'bg-black';
 else if (isGreenCard) headerBg = 'bg-[#96EB3C]';


 return (
   <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-fade-in">
      <button onClick={onClose} className="absolute top-6 right-6 bg-white/10 p-2 rounded-full text-white/70 hover:text-white transition-colors"><X size={24} /></button>
      <div className="w-full max-w-sm relative">
         <div className={`rounded-t-[24px] p-6 ${isGreenCard ? 'text-[#0e2a05]' : 'text-white'} relative overflow-hidden ${headerBg}`}>
            <div className="relative z-10 flex gap-4 items-center"><div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl">{item.icon || "💎"}</div><div><h3 className="font-bold text-lg leading-tight">{item.title}</h3><div className="flex items-center gap-2 opacity-80 text-sm"><span>{item.merchant}</span><span className="w-1 h-1 bg-white/50 rounded-full"></span><span className="font-mono bg-white/20 px-1.5 rounded text-[10px]">{instance?.id ?? ''}</span></div></div></div>
            <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-black rounded-full z-20"></div><div className="absolute -bottom-3 -right-3 w-6 h-6 bg-black rounded-full z-20"></div><div className="absolute bottom-0 left-3 right-3 border-b-2 border-dashed border-white/20"></div>
         </div>
         <div className="bg-white rounded-b-[24px] p-8 flex flex-col items-center relative">
            <div className="relative z-10 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><QrCode size={180} className="text-gray-900" /><div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md"><Zap size={20} className="text-[#1562f0] fill-current" /></div></div></div>
            <div className="mt-8 flex items-center gap-2 text-gray-400 text-xs font-mono uppercase tracking-widest"><ScanLine size={14} /> Scan to Redeem</div>
         </div>
      </div>
   </div>
 );
};


// --- GIFTING MODAL ---
const GiftingModal = ({ item, instance, onClose }: { item: ProductItem; instance: InventoryInstance; onClose: () => void }) => {
 const [step, setStep] = useState('wrap');
 const [theme, setTheme] = useState('classic');
 const THEMES = [{ id: 'classic', name: 'Classic', color: 'bg-red-500' }, { id: 'birthday', name: 'Birthday', color: 'bg-pink-500' }, { id: 'business', name: 'Business', color: 'bg-slate-800' }];
 const handleGenerateLink = () => { setStep('generating'); setTimeout(() => { setStep('shared'); }, 2000); };
 return (
   <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
     <div className="relative w-full max-w-md bg-[#F2F2F7] rounded-t-[32px] shadow-2xl overflow-hidden animate-slide-up pb-8 border-t border-white/20">
       <div className="w-full flex justify-center pt-3 pb-6"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
       <button onClick={onClose} className="absolute top-4 right-4 bg-gray-200 rounded-full p-2 text-gray-500 hover:bg-gray-300 transition-colors z-50"><X size={16} /></button>
       <div className="px-6">
          <div className="text-center mb-6"><div className="inline-flex items-center justify-center w-12 h-12 bg-pink-100 text-pink-500 rounded-full mb-3"><Gift size={24} /></div><h2 className="text-2xl font-bold text-gray-900">Send a Gift</h2><div className="flex items-center justify-center gap-2 mt-1"><span className="text-gray-500 text-sm">Gifting Item</span><span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-mono font-bold">{instance?.id}</span></div></div>
          <div className="relative w-full aspect-[16/9] mb-8 perspective-1000">
             <div className={`w-full h-full rounded-[24px] shadow-xl p-6 text-white flex flex-col justify-between relative overflow-hidden transition-all duration-500 ${THEMES.find(t => t.id === theme)?.color ?? 'bg-red-500'} ${step === 'shared' ? 'scale-95 opacity-50' : 'scale-100'}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div className="relative z-10 flex justify-between items-start"><span className="text-xs font-bold uppercase tracking-widest opacity-80">A Gift For You</span><Gift size={14} /></div>
                <div className="relative z-10 text-center"><div className="text-3xl font-bold">{item.title}</div><div className="text-sm opacity-90 mt-1">{item.merchant}</div></div>
                <div className="relative z-10 text-center"><span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono">Tap to Open</span></div>
             </div>
             {step === 'shared' && <div className="absolute inset-0 bg-white rounded-[24px] shadow-2xl flex flex-col items-center justify-center p-6 z-20 animate-scale-in"><div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4"><Check size={32} /></div><h3 className="font-bold text-gray-900 text-lg mb-1">Link Created</h3><p className="text-xs text-gray-500 mb-4 text-center">The asset is now reserved. Share this link to gift it.</p><div className="w-full bg-gray-100 p-3 rounded-xl flex items-center gap-3 mb-2"><span className="text-xs text-gray-500 truncate flex-1 font-mono">beamio.link/g/8x92...</span><button className="text-blue-600 font-bold text-xs">COPY</button></div></div>}
          </div>
          {step === 'wrap' && <><div className="flex gap-3 justify-center mb-6">{THEMES.map(t => <button key={t.id} onClick={() => setTheme(t.id)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${theme === t.id ? 'bg-black text-white shadow-lg scale-105' : 'bg-white text-gray-500 border border-gray-200'}`}>{t.name}</button>)}</div><div className="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-6 flex items-start gap-3"><AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5" /><p className="text-[11px] text-orange-700 leading-snug"><strong>Note:</strong> Generating a gift link will <u>freeze</u> voucher {instance?.id}.</p></div><button onClick={handleGenerateLink} className="w-full bg-[#1562f0] text-white py-4 rounded-[20px] font-bold text-[17px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2"><ScanLine size={20} /> Create Magic Link</button></>}
          {step === 'generating' && <div className="flex justify-center pb-8"><div className="w-10 h-10 border-4 border-blue-200 border-t-[#1562f0] rounded-full animate-spin"></div></div>}
          {step === 'shared' && <div className="grid grid-cols-2 gap-3"><button className="bg-[#1562f0] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95"><MessageCircle size={18} /> Send</button><button className="bg-white text-gray-900 border border-gray-200 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95"><Share size={18} /> Share</button></div>}
       </div>
     </div>
   </div>
 );
};


// --- ACTION SHEET ---
const ActionSheet = ({ item, instance, onClose, onGift, onRedeem }: { item: ProductItem; instance: InventoryInstance; onClose: () => void; onGift: (inst: InventoryInstance) => void; onRedeem: (inst: InventoryInstance) => void }) => {
  return (
     <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div className="bg-[#F2F2F7] w-full max-w-md rounded-t-[32px] p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
           <div className="w-full flex justify-center mb-6"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
           <div className="flex gap-4 items-center mb-8">
              <div className={`w-14 h-14 rounded-xl ${item.bg || 'bg-gray-900'} flex items-center justify-center text-2xl text-white shadow-md`}>{item.icon || (item.image && <IpfsImg src={item.image} className="w-full h-full object-cover rounded-xl" />) || "💎"}</div>
              <div><h3 className="font-bold text-lg text-gray-900">{item.title}</h3><div className="flex items-center gap-2 text-sm text-gray-500"><span>#{instance.id.replace('#','')}</span><span className="text-gray-300">•</span><span>Purchased Today</span></div></div>
           </div>
           <div className="space-y-3">
              <button onClick={() => onRedeem(instance)} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform"><div className="flex items-center gap-3"><div className="bg-blue-50 text-blue-600 p-2.5 rounded-full"><ScanLine size={20} /></div><div className="text-left"><div className="font-bold text-gray-900">Redeem / Use</div><div className="text-xs text-gray-500">Show QR code at merchant</div></div></div><ChevronRight size={20} className="text-gray-300" /></button>
              <button onClick={() => onGift(instance)} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-transform"><div className="flex items-center gap-3"><div className="bg-pink-50 text-pink-500 p-2.5 rounded-full"><Gift size={20} /></div><div className="text-left"><div className="font-bold text-gray-900">Send as Gift</div><div className="text-xs text-gray-500">Create a magic link</div></div></div><ChevronRight size={20} className="text-gray-300" /></button>
           </div>
        </div>
     </div>
  )
}


// --- PAYMENT SHEET ---
const PaymentSheet = ({ item, onConfirm, onCancel }: { item: ProductItem & { isVariablePrice?: boolean; minPrice?: number; maxPrice?: number }; onConfirm: (amountLoaded?: number) => void; onCancel: () => void }) => {
 const [step, setStep] = useState<'review' | 'processing' | 'success'>('review');
 const [loadAmount, setLoadAmount] = useState(item.price);


 let errorMsg: string | null = null;
 if (item.isVariablePrice) {
    const minP = item.minPrice ?? 0;
    if (loadAmount < minP) errorMsg = `Minimum load amount is $${minP}`;
    else if (item.maxPrice && loadAmount > item.maxPrice) errorMsg = `Maximum load amount for this tier is $${item.maxPrice}`;
 }
 const canPay = item.isVariablePrice ? !errorMsg : true;


 const handlePay = () => {
   if (!canPay) return;
   setStep('processing');
   setTimeout(() => { setStep('success'); setTimeout(() => onConfirm(loadAmount), 1500); }, 2000);
 };
  const isFree = item.price === 0;


 return (
   <div className="fixed inset-0 z-[100] flex items-end justify-center">
     <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={step === 'review' ? onCancel : undefined} />
     <div className="relative w-full max-w-md bg-[#F2F2F7] rounded-t-[32px] shadow-2xl overflow-hidden animate-slide-up pb-8 border-t border-white/20">
       <div className="w-full flex justify-center pt-3 pb-6" onClick={step === 'review' ? onCancel : undefined}><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
       <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-2"><div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center text-white"><span className="font-bold text-xs italic">B</span></div><span className="font-bold text-xl text-gray-900 tracking-tight">Beamio Pay</span></div>
             {step === 'review' && <button onClick={onCancel} className="bg-gray-200 rounded-full p-2 text-gray-500 hover:bg-gray-300 transition-colors"><X size={16} /></button>}
          </div>
          <div className="bg-white rounded-[24px] p-4 shadow-sm mb-6 flex gap-4 border border-gray-100">
             <div className={`w-16 h-16 rounded-[18px] ${item.bg || 'bg-gray-900'} flex items-center justify-center text-3xl shrink-0 shadow-inner overflow-hidden`}>
                {item.image ? <IpfsImg src={item.image} className="w-full h-full object-cover" /> : item.icon || "💎"}
             </div>
             <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-bold text-gray-900 truncate text-lg">{item.title}</h3>
                <p className="text-sm text-gray-500 truncate">{item.merchant}</p>
                <div className="flex items-center gap-1 mt-1"><ShieldCheck size={12} className="text-[#1562f0]" /><p className="text-xs text-[#1562f0] font-medium">Verified Asset</p></div>
             </div>
          </div>


          {item.isVariablePrice && step === 'review' ? (
             <div className="mb-6 bg-white p-4 rounded-2xl border border-gray-200">
               <label className="block text-sm font-bold text-gray-700 mb-2">Load Amount (USDC)</label>
               <div className="flex items-center">
                 <span className="text-gray-500 text-xl font-bold mr-2">$</span>
                 <input
                   type="number"
                   value={loadAmount}
                   onChange={(e) => setLoadAmount(Number(e.target.value))}
                   min={item.minPrice ?? 0}
                   className="w-full text-2xl font-bold text-gray-900 focus:outline-none"
                 />
               </div>
               {errorMsg && (
                 <p className="text-red-500 text-xs mt-2">{errorMsg}</p>
               )}
             </div>
          ) : null}


          <div className="space-y-4 mb-8">
             <div className="flex justify-between items-center pb-4 border-b border-gray-200/60"><span className="text-gray-500 text-[15px]">Pay with</span><div className="flex items-center gap-2"><div className="w-6 h-6 bg-[#2775CA] rounded-full flex items-center justify-center text-[8px] text-white font-bold">USDC</div><span className="text-gray-900 font-semibold text-[15px]">Balance</span></div></div>
             <div className="flex justify-between items-center pb-4 border-b border-gray-200/60"><span className="text-gray-500 text-[15px]">Network Fee</span><span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded-lg">COVERED</span></div>
             <div className="flex justify-between items-center pt-2"><span className="text-gray-900 font-bold text-lg">Total</span><span className={`text-3xl font-bold tracking-tight ${isFree ? 'text-green-600' : 'text-gray-900'}`}>{isFree ? "FREE" : `$${loadAmount}`}</span></div>
          </div>
          <div className="relative h-[60px]">
             {step === 'review' && <button onClick={handlePay} disabled={!canPay} className={`w-full h-full text-white rounded-[20px] font-bold text-[17px] flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${isFree ? 'bg-green-600 shadow-green-500/30' : 'bg-black shadow-[0_10px_20px_rgba(0,0,0,0.3)] active:scale-[0.98]'}`}>{isFree ? "Confirm Claim" : "Confirm Payment"}</button>}
             {step === 'processing' && <div className="w-full h-full bg-black text-white rounded-[20px] font-bold text-[17px] flex items-center justify-center gap-3"><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>Processing on Base...</div>}
             {step === 'success' && <div className="w-full h-full bg-green-500 text-white rounded-[20px] font-bold text-[17px] flex items-center justify-center gap-2 animate-scale-in"><Check size={28} strokeWidth={3} />{isFree ? "Claimed" : "Purchased"}</div>}
          </div>
          <div className="text-center mt-6 flex justify-center items-center gap-1.5 opacity-50"><Lock size={12} className="text-gray-500" /><span className="text-[11px] text-gray-500 font-medium">Secured by ERC-4337 Smart Account</span></div>
       </div>
     </div>
   </div>
 );
};


// --- MAIN VIEW ---


export default function BeamioMarketPage() {
 const [confirmingItem, setConfirmingItem] = useState<ProductItem | null>(null);
 const [viewingItem, setViewingItem] = useState<ProductItem | null>(null);
  // Inventory State: { itemId: [ { id, date, balance } ] }
 const [inventory, setInventory] = useState<InventoryState>({
    201: [{ id: '#100', date: 'Oct 24', balance: '$20' }]
 });
  // Instance Management State
 const [pickingCardForItem, setPickingCardForItem] = useState<ProductItem | null>(null);
 const [actionSheetInstance, setActionSheetInstance] = useState<ActionSheetState | null>(null);
 const [giftingItem, setGiftingItem] = useState<GiftingState | null>(null);
 const [redeemingItem, setRedeemingItem] = useState<RedeemingState | null>(null);


 const getOwnedInstances = (id: number): InventoryInstance[] => inventory[id] || [];


 const openDetail = (item: ProductItem) => {
   setViewingItem(item);
 };


 const initiatePurchase = (item: ProductItem, forcePayment = false) => {
   // For standard items: if owned AND NOT forced, show manage options (open detail)
   if (!forcePayment && getOwnedInstances(item.id).length > 0) {
     openDetail(item);
     return;
   }
   setConfirmingItem(item);
 };


 const finalizePurchase = (amountLoaded?: number) => {
   if (!confirmingItem) return;
  
   // Optimistic Update: Add new instance
   const newId = '#' + (100 + Math.floor(Math.random() * 900));
   const balanceStr = confirmingItem.price === 0 ? 'CLAIMED' : `$${amountLoaded ?? confirmingItem.price}`;


   const newItem: InventoryInstance = {
     id: newId,
     date: 'Just now',
     balance: balanceStr
   };
  
   setInventory(prev => ({
      ...prev,
      [confirmingItem.id]: [...(prev[confirmingItem.id] || []), newItem]
   }));


   const item = confirmingItem;
   setConfirmingItem(null);
   setViewingItem(item);
 };


 const handleCardSelect = (instance: InventoryInstance) => {
    const item = pickingCardForItem;
    setPickingCardForItem(null);
    setActionSheetInstance(item ? { item, instance } : null);
 };


 return (
   <div className="flex justify-center items-center min-h-screen bg-[#E5E5EA] font-sans selection:bg-blue-100">
    
     <div className="relative w-full max-w-md h-[850px] bg-[#F2F2F7] sm:rounded-[50px] shadow-2xl overflow-hidden border-[8px] border-black flex flex-col">
      
       {/* Status Bar */}
       <div className="absolute top-0 w-full h-12 z-50 flex justify-between items-end px-7 pb-2 text-black font-semibold text-[15px] mix-blend-overlay pointer-events-none">
          <span>9:41</span>
          <div className="flex gap-1.5"><div className="w-5 h-3 bg-black rounded-sm"></div><div className="w-5 h-3 bg-black rounded-sm"></div><div className="w-7 h-3 border-2 border-black rounded-sm relative"><div className="absolute inset-0.5 bg-black rounded-[1px]"></div></div></div>
       </div>
       <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-8 bg-black rounded-full z-50 pointer-events-none" />


       {/* --- SCROLLABLE CONTENT --- */}
       <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
        
         <div className="px-6 pt-16 pb-4 flex justify-between items-end bg-[#F2F2F7]/90 backdrop-blur-xl sticky top-0 z-40 border-b border-gray-200/50">
           <h1 className="text-[34px] font-bold text-black tracking-tight leading-none">Market</h1>
           <div className="w-10 h-10 rounded-full bg-gray-200 border border-white overflow-hidden active:scale-95 transition-transform cursor-pointer"><IpfsImg src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Profile" /></div>
         </div>


         <div className="px-5 mb-6">
           <div className="relative group active:scale-[0.99] transition-transform"><Search className="absolute left-3.5 top-3 text-gray-400" size={18} strokeWidth={2.5} /><input type="text" placeholder="Games, Food, Vouchers..." className="w-full bg-[#E3E3E8] py-2.5 pl-10 pr-4 rounded-[12px] text-[17px] focus:outline-none focus:bg-[#D1D1D6] transition-colors placeholder-gray-500 font-medium"/></div>
         </div>


         {/* HERO CARDS: CashTrees */}
         <div className="flex gap-4 overflow-x-auto px-5 pb-8 scrollbar-hide snap-x snap-mandatory">
           {HERO_COLLECTION.map(item => (
             <StoryCard
               key={item.id}
               item={item}
               count={getOwnedInstances(item.id).length}
               onClick={openDetail}
               onBuy={(item) => initiatePurchase(item)}
             />
           ))}
         </div>


         <div className="h-px bg-gray-200 mx-5 mb-2" />
         <SectionHeader title="Browse by Category" action="" />
         <div className="flex gap-3 overflow-x-auto px-5 pb-4 scrollbar-hide">{CATEGORIES.map(cat => (<button key={cat.id} className="flex flex-col items-center gap-2 min-w-[72px] active:opacity-60 transition-opacity"><div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm ${cat.color}`}>{cat.icon}</div><span className="text-[11px] font-semibold text-gray-500">{cat.name}</span></button>))}</div>


         <SectionHeader title="Top Vouchers" />
         <div className="px-5 grid grid-cols-1 gap-y-0 bg-white rounded-[24px] shadow-sm divide-y divide-gray-100/80 mx-5 overflow-hidden">
            {TOP_VOUCHERS.map((voucher, index) => (
               <div key={voucher.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group" onClick={() => openDetail(voucher)}>
                  <div className="font-bold text-lg text-gray-300 w-4">{index + 1}</div>
                  <div className={`w-14 h-14 rounded-[14px] ${voucher.bg} flex items-center justify-center text-3xl shadow-sm shrink-0 group-hover:scale-105 transition-transform`}>{voucher.icon}</div>
                  <div className="flex-1 min-w-0 pr-2"><div className="font-semibold text-gray-900 truncate text-[16px]">{voucher.title}</div><div className="text-[13px] text-gray-500 mt-0.5">{voucher.merchant} • {voucher.category}</div></div>
                  <div className="flex flex-col items-end gap-1"><GetButton price={voucher.price} state="ready" count={getOwnedInstances(voucher.id).length} onClick={() => initiatePurchase(voucher)} /><span className="text-[9px] text-gray-400 font-medium">In-App Purchase</span></div>
               </div>
            ))}
         </div>
        
         <div className="px-8 pb-10 text-center mt-8"><button className="text-gray-400 text-xs font-medium bg-gray-200/50 px-4 py-2 rounded-lg mb-4">Redeem Code</button><p className="text-[10px] text-gray-400 leading-relaxed">Prices may vary by location. All assets are secured on Base Mainnet. <br/> Beamio Inc. © 2026</p></div>
       </div>


       {/* --- MODALS --- */}


       {viewingItem && (
         <ProductDetailModal
           item={viewingItem}
           inventory={getOwnedInstances(viewingItem.id)}
           onClose={() => setViewingItem(null)}
           onBuy={(item) => initiatePurchase(item, true)}
           onOpenWallet={() => setPickingCardForItem(viewingItem)}
         />
       )}


       {confirmingItem && (
         <PaymentSheet
           item={confirmingItem}
           onConfirm={finalizePurchase}
           onCancel={() => setConfirmingItem(null)}
         />
       )}


       {/* --- INSTANCE MANAGEMENT MODALS (Unified for all types) --- */}
       {pickingCardForItem && (
          <CardPickerModal
             item={pickingCardForItem}
             instances={getOwnedInstances(pickingCardForItem.id)}
             onClose={() => setPickingCardForItem(null)}
             onSelect={handleCardSelect}
          />
       )}


       {actionSheetInstance && (
          <ActionSheet
             item={actionSheetInstance.item}
             instance={actionSheetInstance.instance}
             onClose={() => setActionSheetInstance(null)}
             onGift={(inst) => { const it = actionSheetInstance?.item; setActionSheetInstance(null); it && setGiftingItem({ item: it, instance: inst }); }}
             onRedeem={(inst) => { const it = actionSheetInstance?.item; setActionSheetInstance(null); it && setRedeemingItem({ item: it, instance: inst }); }}
          />
       )}


       {giftingItem && <GiftingModal item={giftingItem.item} instance={giftingItem.instance} onClose={() => setGiftingItem(null)} />}
       {redeemingItem && <RedeemModal item={redeemingItem.item} instance={redeemingItem.instance} onClose={() => setRedeemingItem(null)} />}


     </div>
    
     <style>{`
       .scrollbar-hide::-webkit-scrollbar { display: none; }
       .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
       @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
       .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
       @keyframes scale-in { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
       .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
       .perspective-1000 { perspective: 1000px; }
       @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
       .animate-fade-in { animation: fade-in 0.2s ease-out; }
     `}</style>
   </div>
 );
}

