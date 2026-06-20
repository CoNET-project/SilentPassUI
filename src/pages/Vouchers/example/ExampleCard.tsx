import React, { useState, useEffect } from 'react';
import { IpfsImg } from '@/components/IpfsImg';
import { tu } from '@/locale/beamioLocale'
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
 Store
} from 'lucide-react';

// --- MOCK DATA ---


const GENESIS_NODE_DATA = {
 id: 999,
 tagline: "LIMITED EDITION",
 title: "Genesis Node Pack",
 subtitle: "Strictly limited to 300 visionary partners.",
 description: "Own the physical edge and the invisible engine of the Beamio network.",
 currentMint: 247,
 totalMint: 300,
 price: 999,
 type: "HARDWARE + NFT",
 image: "https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=800",
 features: [
   {
     title: "Dynamic E-ink Display",
     desc: "0.84mm flexible PCB. Auto-refreshes QR code every 60s.",
     icon: <Zap size={20} className="text-blue-400" />
   },
   {
     title: "Military-Grade SE",
     desc: "EAL5+ certified chip for Account Abstraction keys.",
     icon: <ShieldCheck size={20} className="text-blue-400" />
   },
   {
     title: "5% Protocol Revenue Share",
     desc: "Perpetual claim on 5% of all B-Units consumed across the global clearing network.",
     icon: <Check size={20} className="text-blue-400" />
   }
 ]
};


const HERO_COLLECTION = [
 {
   id: 101, // CCSA Member Card
   tagline: "ALLIANCE PASS",
   title: "CCSA Member Card",
   subtitle: "Unlock Exclusive Dining. First Partner: Osmanthus.",
   description: "Your gateway to a curated network of premier restaurants. Start your journey at Osmanthus, our inaugural partner, with exclusive perks and stored value acceptance. Delicacy Originated From Song Dynasty.",
   features: ["Accepted at Osmanthus & Future Partners", "Priority Booking at Osmanthus", "Member-Only Tasting Menus", "Future Network Expansion"],
   // REPLACED IMAGE: High-end yellow floral dish aesthetic (Osmanthus style)
   image: "https://images.unsplash.com/photo-1625937759420-26d7e003e04c?auto=format&fit=crop&q=80&w=800",
   merchant: "CCSA Alliance",
   merchantLogo: "🌸",
   partners: [
     { name: "Osmanthus", icon: "🌸", bg: "bg-yellow-100" },
     { name: "Sen Pho", icon: "🍜", bg: "bg-orange-100" },
     { name: "Longdhang", icon: "🥟", bg: "bg-red-100" },
     { name: "More", icon: "+18", bg: "bg-gray-100 text-xs font-bold" }
   ],
   location: "Aberdeen Centre, Richmond, BC",
   price: 150,
   type: "Alliance Membership",
   color: "text-white",
   overlay: "from-black/60 via-black/10 to-black/30"
 },
 {
   id: 102,
   tagline: "LOCAL FAVORITE",
   title: "Sen Pho + Cafe Card",
   subtitle: "Redefining Vietnamese Cuisine",
   description: "Experience authentic Vietnamese cuisine at its finest. This membership is valid at both Champlain Heights and Kerrisdale locations, offering exclusive perks for loyal patrons.",
   features: ["10% Off All Orders", "Valid at Champlain Heights & Kerrisdale", "Priority Reservations", "Birthday Dessert"],
   image: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&q=80&w=800",
   merchant: "Sen Pho + Cafe",
   merchantLogo: "🍜",
   location: "Vancouver, BC",
   price: 99,
   type: "Membership",
   color: "text-white",
   overlay: "from-black/80 via-black/40 to-transparent"
 }
];


const CATEGORIES = [
 { id: 'mining', name: 'Nodes', icon: <Server size={20} />, color: 'bg-black text-white border border-gray-700' },
 { id: 'dining', name: 'Dining', icon: <Utensils size={20} />, color: 'bg-orange-100 text-orange-600' },
 { id: 'entertainment', name: 'Events', icon: <Trophy size={20} />, color: 'bg-purple-100 text-purple-600' },
 { id: 'services', name: 'Services', icon: <Sparkles size={20} />, color: 'bg-blue-100 text-blue-600' },
 { id: 'retail', name: 'Retail', icon: <ShoppingBag size={20} />, color: 'bg-pink-100 text-pink-600' },
];


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

// --- TYPES ---
type VoucherItem = {
  id: number; title: string; merchant: string; tagline?: string; subtitle?: string;
  category?: string; description?: string; features?: string[];
  location?: string; price: number; originalPrice?: number;
  icon?: string; bg?: string; rating?: number; tag?: string; image?: string;
  overlay?: string; shadow?: string; partners?: { name: string; icon: string; bg: string }[];
  type?: string; merchantLogo?: string; color?: string;
};
type GenesisItem = {
  id: number; tagline: string; title: string; subtitle: string; description: string;
  currentMint: number; totalMint: number; price: number; type: string; image: string;
  features: { title: string; desc: string; icon: JSX.Element }[];
  merchant?: string; icon?: string; bg?: string; shadow?: string; overlay?: string; category?: string; location?: string; partners?: { name: string; icon: string; bg: string }[];
};
type ProductItem = VoucherItem | GenesisItem;
type InventoryInstance = { id: string; date: string; balance: string };
type InventoryState = Record<number, InventoryInstance[]>;

// --- COMPONENTS ---


const SectionHeader = ({ title, action = "See All" }: { title: string; action?: string }) => (
 <div className="flex justify-between items-end px-5 mb-3 mt-8">
   <h3 className="text-[22px] font-bold text-gray-900 tracking-tight leading-none">{title}</h3>
   <button className="text-[#1562f0] text-[15px] font-medium active:opacity-60">{action}</button>
 </div>
);


// Updated GetButton
const GetButton = ({ price, state = 'ready', count = 0, onClick, compact = false }: { price: number; state?: 'ready' | 'loading'; count?: number; onClick: () => void; compact?: boolean }) => {
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
     className={`relative rounded-full font-bold text-[13px] transition-all duration-200 shadow-sm active:scale-95 bg-[#1562f0] text-white hover:bg-blue-600 flex items-center justify-center gap-1.5 ${compact ? 'px-4 py-1.5' : 'px-5 py-1.5 min-w-[75px]'}`}
   >
     ${price}
     {count > 0 && (
       <span className="flex items-center justify-center bg-blue-100 text-blue-600 text-[9px] h-4 min-w-[16px] px-1 rounded-full -mr-2 border border-blue-200 shadow-sm font-extrabold">
          x{count}
       </span>
     )}
   </button>
 );
};


// --- STORY CARD (For Alliance & Standard) ---
const StoryCard = ({ item, count, onClick, onBuy }: { item: VoucherItem; count: number; onClick: (i: VoucherItem) => void; onBuy: (i: VoucherItem) => void }) => (
 <div
   onClick={() => onClick(item)}
   className="snap-center relative min-w-[340px] h-[460px] rounded-[32px] overflow-hidden shadow-[0_15px_40px_-10px_rgba(0,0,0,0.2)] cursor-pointer group active:scale-[0.98] transition-transform duration-300"
 >
   <IpfsImg src={item.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={item.title} />
   <div className={`absolute inset-0 bg-gradient-to-b ${item.overlay}`} />


   <div className="absolute inset-0 flex flex-col justify-between p-7">
      <div className="mt-2">
         <span className="text-blue-300 font-bold tracking-wider text-[11px] uppercase mb-2 block drop-shadow-md">
            {item.tagline}
         </span>
         <h2 className="text-white text-4xl font-bold leading-[1.1] tracking-tight drop-shadow-lg w-4/5 mb-3">
            {item.title}
         </h2>
         <p className="text-gray-200 text-[15px] font-medium leading-snug line-clamp-2 drop-shadow-md w-11/12">
            {item.subtitle}
         </p>
      </div>


      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[24px] p-4 flex items-center justify-between shadow-lg">
         <div className="flex items-center gap-3.5">
            {item.partners ? (
              <div className="flex -space-x-3">
                 {item.partners.map((p: { name: string; icon: string; bg: string }, i: number) => (
                   <div key={i} className={`w-10 h-10 ${p.bg} rounded-full flex items-center justify-center text-lg border-2 border-white/20 shadow-md z-${10-i}`}>
                      {p.icon}
                   </div>
                 ))}
              </div>
            ) : (
              <div className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-[14px] flex items-center justify-center text-2xl shadow-inner border border-white/10">
                 {item.merchantLogo}
              </div>
            )}
           
            <div className="flex flex-col">
               <span className="text-white font-bold text-[15px] leading-tight">
                  {item.partners ? "Multiple Locations" : item.merchant}
               </span>
               <div className="flex items-center gap-1.5 mt-0.5">
                  {item.partners ? (
                     <div className="flex items-center gap-1 text-green-300">
                        <Store size={12} fill="currentColor" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Alliance</span>
                     </div>
                  ) : (
                     <>
                       {item.price > 0 && <Crown size={12} className="text-amber-400 fill-current" />}
                       <span className="text-gray-300 text-[11px] font-medium uppercase tracking-wide">{item.type}</span>
                     </>
                  )}
               </div>
            </div>
         </div>


         <div onClick={(e) => e.stopPropagation()}>
            <GetButton
              price={item.price}
              count={count}
              onClick={() => onBuy(item)}
              compact={true}
            />
         </div>
      </div>


   </div>
 </div>
);


// --- GENESIS CARD (List View - The Black Card) ---
const GenesisCard = ({ data, onClick }: { data: GenesisItem; onClick: (d: GenesisItem) => void }) => (
 <div
   onClick={() => onClick(data)}
   className="snap-center relative min-w-[340px] h-[460px] rounded-[32px] overflow-hidden cursor-pointer group active:scale-[0.98] transition-transform duration-300 bg-black border border-gray-800 shadow-[0_0_50px_-15px_rgba(21,98,240,0.5)]"
 >
   <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-black to-black"></div>
   {/* Tech Grid Pattern */}
   <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>


   <div className="absolute inset-0 p-7 flex flex-col justify-between z-10">
    
     {/* Top Bar */}
     <div className="flex justify-between items-start mt-2">
       <span className="bg-[#1e293b] text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-lg">
         {data.tagline}
       </span>
       <span className="text-white/60 font-mono text-xs font-bold tracking-wide">
         {data.currentMint} / {data.totalMint}
       </span>
     </div>


     {/* 3D Card Visual */}
     <div className="flex-1 flex items-center justify-center py-6">
        <div className="relative w-64 h-40 bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-2xl shadow-2xl border border-gray-700/50 transform -rotate-6 group-hover:-rotate-3 transition-transform duration-500 flex flex-col justify-between p-4 overflow-hidden">
            {/* Card Shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
           
            {/* E-ink Screen */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-black border border-gray-600 rounded-lg flex items-center justify-center shadow-inner">
               <QrCode className="text-white opacity-80" size={48} />
               <div className="absolute bottom-1 right-1 text-[5px] text-blue-400 font-mono">E-Ink</div>
            </div>


            <div className="flex justify-between items-center">
               <div className="w-8 h-5 bg-yellow-600/20 rounded-[4px] border border-yellow-600/40 relative overflow-hidden">
                  <div className="absolute left-1 top-1 w-3 h-3 border-l border-t border-yellow-600/60 rounded-tl-[2px]"></div>
               </div>
               <Wifi size={14} className="text-gray-500" />
            </div>
           
            <div className="text-right">
               <span className="font-bold italic text-white text-lg">B</span>
            </div>
        </div>
     </div>


     {/* Info */}
     <div className="mb-4">
       <h2 className="text-4xl font-bold text-white leading-none tracking-tight mb-2">{data.title}</h2>
     </div>


     {/* Mint Button */}
     <div className="bg-[#1e293b]/50 backdrop-blur-md border border-gray-700 rounded-[24px] p-4 flex items-center justify-between group-hover:border-blue-500/50 transition-colors">
        <div>
           <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Mint Price</div>
           <div className="text-xl font-bold text-white flex items-baseline gap-1">
              ${data.price} <span className="text-xs text-gray-500 font-normal">USDC</span>
           </div>
        </div>
        <button className="bg-[#1562f0] hover:bg-blue-600 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-colors shadow-[0_0_20px_rgba(21,98,240,0.4)] flex items-center gap-2">
           View Specs
        </button>
     </div>
   </div>
 </div>
);


// --- GENESIS DETAILS MODAL (Visual - PDP) ---
const GenesisDetailModal = ({ item, inventory, onClose, onBuy, onOpenWallet }: { item: GenesisItem; inventory: InventoryInstance[]; onClose: () => void; onBuy: (i: GenesisItem) => void; onOpenWallet: () => void }) => {
 if (!item) return null;
 const count = inventory.length;


 return (
   <div className="fixed inset-0 z-[80] bg-[#020617] animate-slide-up overflow-y-auto flex flex-col text-white">
     {/* Top Actions */}
     <div className="absolute top-0 w-full p-4 flex justify-between items-center z-50">
       <button onClick={onClose} className="w-9 h-9 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors">
         <X size={20} />
       </button>
       <button className="w-9 h-9 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors">
         <Share size={18} />
       </button>
     </div>


     {/* Background Ambience */}
     <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#1562f0]/20 to-transparent"></div>
        <div className="absolute top-0 w-full h-full" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
     </div>


     {/* Content */}
     <div className="relative z-10 px-6 pt-24 pb-32">
       
        <div className="mb-2">
           <span className="bg-[#1562f0] text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md">
              {item.type}
           </span>
        </div>
       
        <h1 className="text-5xl font-bold leading-none tracking-tight mb-4">{item.title.replace(" Pack", "")}</h1>
        <p className="text-gray-400 text-lg leading-snug mb-8">{item.subtitle}</p>


        {/* Inventory Status Banner (Dark Mode) */}
        {count > 0 && (
           <div
             onClick={onOpenWallet}
             className="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-4 mb-8 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-[0_0_20px_rgba(21,98,240,0.2)]"
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-sm">
                    <Wallet size={20} />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-white">You own {count} Nodes</h4>
                    <p className="text-xs text-blue-300">Tap to Gift or Manage</p>
                 </div>
              </div>
              <ChevronRight size={18} className="text-blue-400" />
           </div>
        )}


        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
           <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                 <Cpu size={20} />
              </div>
              <div>
                 <div className="text-[10px] text-gray-500 uppercase font-bold">Chipset</div>
                 <div className="text-sm font-bold leading-tight">EAL6+<br/>Secure</div>
              </div>
           </div>
           <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                 <Activity size={20} />
              </div>
              <div>
                 <div className="text-[10px] text-gray-500 uppercase font-bold">Yield</div>
                 <div className="text-sm font-bold leading-tight">5% Global</div>
              </div>
           </div>
        </div>


        {/* Mint Progress */}
        <div className="mb-10">
           <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-gray-300">Genesis Mint Progress</span>
              <span className="text-[#1562f0] font-mono font-bold">{item.currentMint} / {item.totalMint}</span>
           </div>
           <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#1562f0] rounded-full shadow-[0_0_10px_#1562f0]" style={{ width: `${(item.currentMint / item.totalMint) * 100}%` }}></div>
           </div>
        </div>


        {/* Features List */}
        <div className="bg-[#0f172a] rounded-3xl p-6 border border-gray-800">
           <div className="flex items-center gap-2 mb-6 text-gray-500 text-xs font-bold uppercase tracking-widest">
              <Lock size={12} /> The Tangible Edge
           </div>
           <div className="space-y-8">
              {item.features.map((feature: { title: string; desc: string; icon: JSX.Element }, idx: number) => (
                 <div key={idx} className="flex gap-4">
                    <div className="mt-1">{feature.icon}</div>
                    <div>
                       <h4 className="font-bold text-white text-[15px]">{feature.title}</h4>
                       <p className="text-gray-400 text-sm leading-relaxed mt-1">{feature.desc}</p>
                    </div>
                 </div>
              ))}
           </div>
        </div>


     </div>


     {/* Sticky Bottom Bar - Split if Owned */}
     <div className="fixed bottom-0 w-full max-w-md bg-[#020617]/90 backdrop-blur-xl border-t border-gray-800 p-5 pb-8 z-50 flex items-center gap-3">
        {count > 0 ? (
           <>
              <button
                onClick={onOpenWallet}
                className="flex-1 bg-white/5 border border-white/10 text-white px-4 py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform flex items-center justify-center gap-2 hover:bg-white/10"
              >
                 <Wallet size={18} /> My Nodes <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-1">x{count}</span>
              </button>
              <button
                onClick={() => onBuy(item)}
                className="flex-[1.5] bg-[#1562f0] hover:bg-blue-600 text-white px-4 py-3.5 rounded-full font-bold text-[15px] shadow-[0_0_30px_-5px_rgba(21,98,240,0.5)] active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                 Secure Another
              </button>
           </>
        ) : (
           <>
              <div>
                 <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">Total Investment</div>
                 <div className="text-3xl font-bold text-white tracking-tight">${item.price}</div>
              </div>
              <button
                onClick={() => onBuy(item)}
                className="flex-1 bg-[#1562f0] hover:bg-blue-600 text-white py-3.5 rounded-full font-bold text-[17px] shadow-[0_0_30px_-5px_rgba(21,98,240,0.5)] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                 Secure Node <ArrowRight size={20} />
              </button>
           </>
        )}
     </div>
   </div>
 );
};


// --- GENESIS PURCHASE MODAL (Workflow - Wizard) ---
const GenesisPurchaseModal = ({ item, onClose, onConfirm }: { item: GenesisItem; onClose: () => void; onConfirm: () => void }) => {
 const [step, setStep] = useState('check'); // check -> shipping -> paying -> minting -> success


 useEffect(() => {
   if (step === 'check') {
     setTimeout(() => setStep('shipping'), 2000);
   }
   if (step === 'paying') {
     setTimeout(() => setStep('minting'), 2000);
   }
   if (step === 'minting') {
     setTimeout(() => setStep('success'), 3000);
   }
 }, [step]);


 return (
   <div className="fixed inset-0 z-[100] bg-[#020617] text-white flex flex-col animate-fade-in">
      <div className="absolute top-0 right-0 p-6 z-50">
         <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><X size={20} /></button>
      </div>


      {/* Step 1: Eligibility Check */}
      {step === 'check' && (
         <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">Verifying Eligibility</h2>
            <p className="text-gray-400">Checking whitelist status and wallet age...</p>
         </div>
      )}


      {/* Step 2: Shipping Info */}
      {step === 'shipping' && (
         <div className="flex-1 flex flex-col p-6 animate-slide-up">
            <h2 className="text-3xl font-bold mb-2 pt-12">Where should we send your Node?</h2>
            <p className="text-gray-400 mb-8">This pack includes physical hardware.</p>
           
            <div className="space-y-4">
               <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                  <label className="text-xs uppercase text-gray-500 font-bold block mb-2">Full Name</label>
                  <input type="text" defaultValue="Felix Chen" className="w-full bg-transparent text-white font-bold text-lg outline-none" />
               </div>
               <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                  <label className="text-xs uppercase text-gray-500 font-bold block mb-2">Shipping Address</label>
                  <input type="text" defaultValue="1288 Alberni St, Vancouver, BC" className="w-full bg-transparent text-white font-bold text-lg outline-none" />
               </div>
            </div>


            <div className="mt-auto">
               <div className="flex justify-between items-center mb-6 text-sm">
                  <span className="text-gray-400">Hardware Delivery</span>
                  <span className="text-green-400 flex items-center gap-1"><Truck size={14} /> Est. 2 Weeks</span>
               </div>
               <button
                 onClick={() => setStep('paying')}
                 className="w-full bg-[#1562f0] py-4 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(21,98,240,0.4)]"
               >
                  Confirm & Pay $999
               </button>
            </div>
         </div>
      )}


      {/* Step 3 & 4: Processing Animation */}
      {(step === 'paying' || step === 'minting') && (
         <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
            {/* Matrix Rain Effect Background (Simplified) */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://media.giphy.com/media/U3qYN8S0j3bpK/giphy.gif')] bg-cover mix-blend-screen"></div>
           
            <div className="relative z-10 bg-black/50 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
               <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Cpu size={40} className="text-blue-400 animate-pulse" />
               </div>
               <h2 className="text-3xl font-bold mb-2">{step === 'paying' ? 'Processing Payment' : 'Minting Genesis NFT'}</h2>
               <p className="text-gray-400 font-mono text-sm">
                  {step === 'paying' ? 'Securing funds on Base L2...' : 'Deploying contract 0x71...9a2'}
               </p>
            </div>
         </div>
      )}


      {/* Step 5: Success */}
      {step === 'success' && (
         <div className="flex-1 flex flex-col items-center justify-center p-6 animate-scale-in text-center bg-gradient-to-b from-blue-900/20 to-[#020617]">
            <div className="w-32 h-32 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl shadow-[0_0_60px_rgba(59,130,246,0.6)] flex items-center justify-center mb-8 rotate-12">
               <Server size={64} className="text-white" />
            </div>
           
            <h1 className="text-4xl font-bold mb-2">Welcome, Node #248</h1>
            <p className="text-gray-400 mb-8 max-w-xs">You are now a verified infrastructure partner of the Beamio Network.</p>


            <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-4 mb-8">
               <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-500">交易</span>
                  <span className="font-mono text-blue-400">0x8a...2b9</span>
               </div>
               <div className="flex justify-between py-2">
                  <span className="text-gray-500">Revenue Share</span>
                  <span className="text-green-400">Active</span>
               </div>
            </div>


            <button
              onClick={onConfirm}
              className="w-full max-w-sm bg-white text-black py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition-colors"
            >
               Enter Dashboard
            </button>
         </div>
      )}
   </div>
 );
};


// --- STANDARD PRODUCT DETAIL MODAL ---
const ProductDetailModal = ({ item, inventory, onClose, onBuy, onOpenWallet }: { item: ProductItem; inventory: InventoryInstance[]; onClose: () => void; onBuy: (i: ProductItem) => void; onOpenWallet: () => void }) => {
 if (!item) return null;
 const count = inventory.length;


 // Custom visual for free items
 const isFree = item.price === 0;


 return (
   <div className="fixed inset-0 z-[80] bg-white animate-slide-up overflow-y-auto flex flex-col">
     <div className="absolute top-0 w-full p-4 flex justify-between items-center z-50">
       <button onClick={onClose} className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-sm hover:bg-white/30 transition-colors"><X size={20} /></button>
       <div className="flex gap-2"><button className="w-9 h-9 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-sm hover:bg-white/30 transition-colors"><Share size={18} /></button></div>
     </div>


     <div className={`relative w-full h-[45vh] shrink-0 ${item.bg || 'bg-gray-900'} ${item.shadow || ''}`}>
        {item.image ? <IpfsImg src={item.image} className="w-full h-full object-cover" alt={item.title} /> : <div className="w-full h-full flex items-center justify-center text-9xl opacity-20 text-white">{item.icon}</div>}
        <div className={`absolute inset-0 bg-gradient-to-t ${item.overlay || 'from-black/80 via-transparent to-black/30'}`}></div>
        <div className="absolute bottom-0 left-0 w-full p-6 text-white">
           <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-md mb-3 inline-block ${item.id === 999 ? 'bg-blue-600 text-white' : (isFree ? 'bg-red-700 text-white' : 'bg-[#1562f0]')}`}>{item.type || item.category || "Voucher"}</span>
           <h1 className="text-4xl font-bold leading-tight mb-2 shadow-sm">{item.title}</h1>
           <p className="text-lg text-white/90 font-medium">{item.merchant}</p>
        </div>
     </div>


     <div className={`flex-1 px-6 py-8 pb-32 ${item.id === 999 ? 'bg-slate-900' : ''}`}>
        {/* Inventory Status Banner */}
        {count > 0 && (
           <div
             onClick={onOpenWallet}
             className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-sm"
           >
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#1562f0] shadow-sm">
                    <Wallet size={20} />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-gray-900">You have {count} items</h4>
                    <p className="text-xs text-gray-500">Tap to Use, Gift or Trade</p>
                 </div>
              </div>
              <ChevronRight size={18} className="text-blue-400" />
           </div>
        )}


        {/* Stats Row */}
        <div className={`flex gap-6 mb-8 border-b ${item.id === 999 ? 'border-gray-800' : 'border-gray-100'} pb-8`}>
           <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.id === 999 ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                 <MapPin size={20} />
              </div>
              <div>
                 <div className={`text-[11px] uppercase font-bold tracking-wide ${item.id === 999 ? 'text-gray-500' : 'text-gray-400'}`}>Location</div>
                 <div className={`text-sm font-semibold ${item.id === 999 ? 'text-white' : 'text-gray-900'}`}>{item.location || "Online"}</div>
              </div>
           </div>
           <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.id === 999 ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                 <ShieldCheck size={20} />
              </div>
              <div>
                 <div className={`text-[11px] uppercase font-bold tracking-wide ${item.id === 999 ? 'text-gray-500' : 'text-gray-400'}`}>安全</div>
                 <div className={`text-sm font-semibold ${item.id === 999 ? 'text-white' : 'text-gray-900'}`}>Guaranteed</div>
              </div>
           </div>
        </div>


        <h3 className={`text-xl font-bold mb-3 ${item.id === 999 ? 'text-white' : 'text-gray-900'}`}>About</h3>
        <p className={`leading-relaxed text-[17px] mb-8 ${item.id === 999 ? 'text-gray-300' : 'text-gray-600'}`}>{item.description}</p>


        {item.features && (
          <div className={`rounded-2xl p-5 mb-8 ${item.id === 999 ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
             <h4 className={`text-sm font-bold uppercase tracking-wide mb-4 ${item.id === 999 ? 'text-gray-400' : 'text-gray-900'}`}>What's Included</h4>
             <div className="space-y-3">
                {(Array.isArray(item.features) ? item.features : []).map((feature: string | { title: string; desc: string; icon: JSX.Element }, idx: number) => (
                   <div key={idx} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ${item.id === 999 ? 'bg-blue-600' : 'bg-green-500'}`}>
                         <Check size={12} strokeWidth={4} />
                      </div>
                      <span className={`font-medium ${item.id === 999 ? 'text-gray-300' : 'text-gray-700'}`}>{typeof feature === 'string' ? feature : feature.title}</span>
                   </div>
                ))}
             </div>
          </div>
        )}


        {/* PARTNERS LIST (For Alliance Card Only) */}
        {item.partners && (
           <div className="mt-8">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Participating Locations</h4>
              <div className="grid grid-cols-2 gap-3">
                 {item.partners.map((p: { name: string; icon: string; bg: string }, i: number) => (
                    <div key={i} className="bg-white border border-gray-100 p-3 rounded-xl flex items-center gap-3 shadow-sm">
                       <div className={`w-10 h-10 ${p.bg} rounded-full flex items-center justify-center text-lg`}>{p.icon}</div>
                       <span className="text-sm font-bold text-gray-900">{p.name}</span>
                    </div>
                 ))}
              </div>
           </div>
        )}
     </div>


     {/* Split Bottom Bar */}
     <div className={`fixed bottom-0 w-full max-w-md backdrop-blur-xl border-t p-5 pb-8 z-50 flex gap-3 ${item.id === 999 ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-gray-200'}`}>
        {count > 0 ? (
           <>
              <button
                onClick={onOpenWallet}
                className={`flex-1 border-2 px-4 py-3.5 rounded-full font-bold text-[15px] active:scale-95 transition-transform flex items-center justify-center gap-2 ${item.id === 999 ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
              >
                 <Wallet size={18} /> My Wallet <span className={`text-xs px-1.5 py-0.5 rounded-md ml-1 ${item.id === 999 ? 'bg-slate-700 text-gray-300' : 'bg-gray-200 text-gray-900'}`}>x{count}</span>
              </button>
              <button
                onClick={() => onBuy(item)}
                className={`flex-[1.5] text-white px-4 py-3.5 rounded-full font-bold text-[15px] shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2 ${isFree ? 'bg-red-700 shadow-red-500/30' : 'bg-[#1562f0] shadow-blue-500/30'}`}
              >
                 {isFree ? "Claim Another" : "Buy Another"} <span className="opacity-80 font-medium text-xs ml-1">{isFree ? "FREE" : `$${item.price}`}</span>
              </button>
           </>
        ) : (
           <div className="flex-1 flex gap-4 items-center">
              <div className="flex-1">
                 <div className={`text-xs uppercase font-bold ${item.id === 999 ? 'text-gray-400' : 'text-gray-500'}`}>Total Price</div>
                 <div className={`text-3xl font-bold tracking-tight ${item.id === 999 ? 'text-white' : (isFree ? 'text-red-700' : 'text-gray-900')}`}>
                   {isFree ? "FREE" : `$${item.price}`}
                 </div>
              </div>
              <button
                onClick={() => onBuy(item)}
                className={`text-white px-8 py-3.5 rounded-full font-bold text-[17px] shadow-lg active:scale-95 transition-transform flex items-center gap-2 ${isFree ? 'bg-red-700 shadow-red-500/30' : 'bg-[#1562f0] shadow-blue-500/30'}`}
              >
                 {isFree ? "Claim Gift" : "Purchase"} <ArrowRight size={20} />
              </button>
           </div>
        )}
     </div>
   </div>
 );
};


// --- CARD PICKER MODAL (The Stack View) ---
const CardPickerModal = ({ item, instances, onClose, onSelect }: { item: ProductItem; instances: InventoryInstance[]; onClose: () => void; onSelect: (inst: InventoryInstance) => void }) => {
 return (
   <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-[#F2F2F7] rounded-t-[32px] shadow-2xl overflow-hidden animate-slide-up pb-8 border-t border-white/20"
        onClick={e => e.stopPropagation()}
      >
         <div className="w-full flex justify-center pt-3 pb-6">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
         </div>
        
         <div className="px-6">
            <div className="flex justify-between items-center mb-6">
               <div>
                  <h2 className="text-xl font-bold text-gray-900">我的钱包</h2>
                  <p className="text-xs text-gray-500">{instances.length} Cards Available</p>
               </div>
               <button onClick={onClose} className="bg-gray-200 p-1.5 rounded-full text-gray-500"><X size={16}/></button>
            </div>


            <div className="space-y-3 max-h-[60vh] overflow-y-auto pb-8">
               {instances.map((inst: InventoryInstance, idx: number) => (
                  <div
                    key={inst.id}
                    onClick={() => onSelect(inst)}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer relative overflow-hidden group"
                  >
                     <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.bg || (item.price === 0 ? 'bg-red-700' : 'bg-gray-900')}`}></div>
                     <div className="flex gap-4 items-center">
                        <div className={`w-12 h-12 rounded-xl ${item.bg || (item.price === 0 ? 'bg-red-700' : 'bg-gray-900')} flex items-center justify-center text-2xl text-white shadow-sm`}>
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
 return (
   <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-fade-in">
      <button onClick={onClose} className="absolute top-6 right-6 bg-white/10 p-2 rounded-full text-white/70 hover:text-white transition-colors"><X size={24} /></button>
      <div className="w-full max-w-sm relative">
         <div className={`rounded-t-[24px] p-6 text-white relative overflow-hidden ${item.bg || 'bg-gray-900'}`}>
            <div className="relative z-10 flex gap-4 items-center"><div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl">{item.icon || "💎"}</div><div><h3 className="font-bold text-lg leading-tight">{item.title}</h3><div className="flex items-center gap-2 text-white/80 text-sm"><span>{item.merchant}</span><span className="w-1 h-1 bg-white/50 rounded-full"></span><span className="font-mono bg-white/20 px-1.5 rounded text-[10px]">{instance?.id}</span></div></div></div>
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


// --- ACTION SHEET (After Selecting Card) ---
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
const PaymentSheet = ({ item, onConfirm, onCancel }: { item: ProductItem; onConfirm: () => void; onCancel: () => void }) => {
 const [step, setStep] = useState('review');
 const handlePay = () => { setStep('processing'); setTimeout(() => { setStep('success'); setTimeout(onConfirm, 1500); }, 2000); };
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
          <div className="bg-white rounded-[24px] p-4 shadow-sm mb-8 flex gap-4 border border-gray-100">
             <div className={`w-16 h-16 rounded-[18px] ${item.bg || 'bg-gray-900'} flex items-center justify-center text-3xl shrink-0 shadow-inner`}>{item.icon || (item.image && <IpfsImg src={item.image} className="w-full h-full object-cover rounded-[18px]" alt={item.title} />) || "💎"}</div>
             <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-bold text-gray-900 truncate text-lg">{item.title}</h3>
                <p className="text-sm text-gray-500 truncate">{item.merchant}</p>
                <div className="flex items-center gap-1 mt-1"><ShieldCheck size={12} className="text-[#1562f0]" /><p className="text-xs text-[#1562f0] font-medium">Verified Asset</p></div>
             </div>
          </div>
          <div className="space-y-4 mb-8">
             <div className="flex justify-between items-center pb-4 border-b border-gray-200/60"><span className="text-gray-500 text-[15px]">Pay with</span><div className="flex items-center gap-2"><div className="w-6 h-6 bg-[#2775CA] rounded-full flex items-center justify-center text-[8px] text-white font-bold">USDC</div><span className="text-gray-900 font-semibold text-[15px]">余额</span></div></div>
             <div className="flex justify-between items-center pb-4 border-b border-gray-200/60"><span className="text-gray-500 text-[15px]">网络费</span><span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded-lg">COVERED</span></div>
             <div className="flex justify-between items-center pt-2"><span className="text-gray-900 font-bold text-lg">Total</span><span className={`text-3xl font-bold tracking-tight ${isFree ? 'text-green-600' : 'text-gray-900'}`}>{isFree ? "FREE" : `$${item.price}`}</span></div>
          </div>
          <div className="relative h-[60px]">
             {step === 'review' && <button onClick={handlePay} className={`w-full h-full text-white rounded-[20px] font-bold text-[17px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${isFree ? 'bg-green-600 shadow-green-500/30' : 'bg-[#1562f0] shadow-[0_10px_20px_rgba(21,98,240,0.3)]'}`}>{isFree ? "Confirm Claim" : "Confirm Payment"}</button>}
             {step === 'processing' && <div className="w-full h-full bg-black text-white rounded-[20px] font-bold text-[17px] flex items-center justify-center gap-3"><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></div>Processing on Base...</div>}
             {step === 'success' && <div className="w-full h-full bg-green-500 text-white rounded-[20px] font-bold text-[17px] flex items-center justify-center gap-2 animate-scale-in"><Check size={28} strokeWidth={3} />{isFree ? tu('claimed') : "Purchased"}</div>}
          </div>
          <div className="text-center mt-6 flex justify-center items-center gap-1.5 opacity-50"><Lock size={12} className="text-gray-500" /><span className="text-[11px] text-gray-500 font-medium">Secured by ERC-4337 Smart Account</span></div>
       </div>
     </div>
   </div>
 );
};


// --- MAIN VIEW ---


export default function BeamioMarketPage() {
 const [purchaseStates, setPurchaseStates] = useState({});
 const [confirmingItem, setConfirmingItem] = useState<ProductItem | null>(null);
 const [viewingItem, setViewingItem] = useState<ProductItem | null>(null);
 const [purchasingGenesis, setPurchasingGenesis] = useState(false);
 const [inventory, setInventory] = useState<InventoryState>({
    201: [{ id: '#100', date: 'Oct 24', balance: '$20' }]
 });
 const [pickingCardForItem, setPickingCardForItem] = useState<ProductItem | null>(null);
 const [actionSheetInstance, setActionSheetInstance] = useState<{ item: ProductItem; instance: InventoryInstance } | null>(null);
 const [giftingItem, setGiftingItem] = useState<{ item: ProductItem; instance: InventoryInstance } | null>(null);
 const [redeemingItem, setRedeemingItem] = useState<{ item: ProductItem; instance: InventoryInstance } | null>(null);


 const getOwnedInstances = (id: number): InventoryInstance[] => inventory[id] || [];


 const openDetail = (item: ProductItem) => {
   setViewingItem(item);
 };


 const initiatePurchase = (item: ProductItem, forcePayment = false) => {
   // If Genesis Node, trigger special flow
   if (item.id === 999) {
     setPurchasingGenesis(true);
     return;
   }
  
   // For standard items: if owned AND NOT forced, show manage options (open detail)
   if (!forcePayment && getOwnedInstances(item.id).length > 0) {
     openDetail(item);
     return;
   }
   setConfirmingItem(item);
 };


 const finalizePurchase = () => {
   if (!confirmingItem) return;
  
   // Optimistic Update: Add new instance
   const newId = '#' + (100 + Math.floor(Math.random() * 900));
   const newItem = {
     id: newId,
     date: tu('just_now'),
     balance: confirmingItem.price === 0 ? 'CLAIMED' : '$' + confirmingItem.price
   };
  
   setInventory(prev => ({
      ...prev,
      [confirmingItem.id]: [...(prev[confirmingItem.id] || []), newItem]
   }));


   const item = confirmingItem;
   setConfirmingItem(null);
   setViewingItem(item); // Open detail after purchase
 };


 // Finalize Genesis Purchase (Adds to inventory)
 const finalizeGenesis = () => {
   setPurchasingGenesis(false);
  
   // Add Genesis Node instance to inventory
   const newId = '#GN-' + (248 + getOwnedInstances(999).length);
   const newItem = { id: newId, date: tu('just_now'), balance: 'ACTIVE' };
  
   setInventory(prev => ({
      ...prev,
      999: [...(prev[999] || []), newItem]
   }));
  
   // Re-open detail to show tu('my_wallet') state
   setViewingItem(GENESIS_NODE_DATA);
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
           <div className="w-10 h-10 rounded-full bg-gray-200 border border-white overflow-hidden active:scale-95 transition-transform cursor-pointer"><IpfsImg src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt={tu('profile')} /></div>
         </div>


         <div className="px-5 mb-6">
           <div className="relative group active:scale-[0.99] transition-transform"><Search className="absolute left-3.5 top-3 text-gray-400" size={18} strokeWidth={2.5} /><input type="text" placeholder="Games, Food, Vouchers..." className="w-full bg-[#E3E3E8] py-2.5 pl-10 pr-4 rounded-[12px] text-[17px] focus:outline-none focus:bg-[#D1D1D6] transition-colors placeholder-gray-500 font-medium"/></div>
         </div>


         {/* HERO CARDS: Genesis Node + Others */}
         <div className="flex gap-4 overflow-x-auto px-5 pb-8 scrollbar-hide snap-x snap-mandatory">
          
           {/* 1. Special Genesis Node Card */}
           <GenesisCard
             data={GENESIS_NODE_DATA}
             onClick={(d) => openDetail(d)}
           />


           {/* 2. Standard Hero Cards (Story Style) */}
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
        
         <div className="px-8 pb-10 text-center mt-8"><button className="text-gray-400 text-xs font-medium bg-gray-200/50 px-4 py-2 rounded-lg mb-4">兑换码</button><p className="text-[10px] text-gray-400 leading-relaxed">Prices may vary by location. All assets are secured on Base Mainnet. <br/> Beamio Inc. © 2026</p></div>
       </div>


       {/* --- SPECIAL GENESIS DETAIL MODAL (Updated with Inventory) --- */}
       {viewingItem && viewingItem.id === 999 && (
         <GenesisDetailModal
           item={viewingItem as unknown as GenesisItem}
           inventory={getOwnedInstances(999)} // Pass inventory!
           onClose={() => setViewingItem(null)}
           onBuy={(item) => { setViewingItem(null); setPurchasingGenesis(true); }}
           onOpenWallet={() => setPickingCardForItem(viewingItem)} // Trigger Picker
         />
       )}


       {/* --- STANDARD PRODUCT DETAIL MODAL --- */}
       {viewingItem && viewingItem.id !== 999 && (
         <ProductDetailModal
           item={viewingItem}
           inventory={getOwnedInstances(viewingItem.id)}
           onClose={() => setViewingItem(null)}
           onBuy={(item) => initiatePurchase(item, true)} // FORCE BUY for "Buy Another"
           onOpenWallet={() => setPickingCardForItem(viewingItem)}
         />
       )}


       {/* --- GENESIS PURCHASE FLOW --- */}
       {purchasingGenesis && (
          <GenesisPurchaseModal
             item={GENESIS_NODE_DATA}
             onClose={() => setPurchasingGenesis(false)}
             onConfirm={finalizeGenesis} // Trigger inventory update
          />
       )}


       {/* --- STANDARD PURCHASE FLOW --- */}
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
             onGift={(inst) => { setActionSheetInstance(null); setGiftingItem({ item: actionSheetInstance.item, instance: inst }); }}
             onRedeem={(inst) => { setActionSheetInstance(null); setRedeemingItem({ item: actionSheetInstance.item, instance: inst }); }}
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

