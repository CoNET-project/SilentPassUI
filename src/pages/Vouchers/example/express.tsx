import React, { useState, useMemo, useEffect, useRef } from 'react';
import { tu } from '@/locale/beamioLocale'
import {
 Scan,
 Home,
 CreditCard,
 MessageSquare,
 Store,
 Settings,
 ChevronDown,
 Plus,
 ArrowUpRight,
 QrCode,
 History,
 Copy,
 Wallet,
 Globe,
 Zap,
 Utensils,
 Coffee,
 Ticket,
 User,
 Check,
 X,
 ChevronUp,
 Search,
 Plane,
 Dumbbell,
 ShoppingBag,
 GripVertical,
 MinusCircle,
 EyeOff,
 PlusCircle,
 ArrowRight,
 Clock,
 AlertCircle,
 CreditCard as CardIcon,
 DollarSign,
 Info,
 Star,
 ShieldCheck,
 MapPin,
 Edit2,
 Save,
 ArrowRightLeft, // For Internal Transfer
 ArrowDown
} from 'lucide-react';


// --- Configuration & Constants ---
const BEAMIO_BLUE = '#1562f0';


// Mock Exchange Rates (Base: USDC)
const CURRENCY_RATES = {
 'CAD': { rate: 1.35, symbol: '$', flag: '🇨🇦', name: 'Canadian Dollar' },
 'USD': { rate: 1.00, symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
};


// --- Type Definitions ---
interface Transaction {
 id: string;
 type: '充值' | '支付' | 'Transfer' | 'Internal';
 amount: string;
 currency: string;
 date: string;
 isPositive: boolean;
}


interface WalletBalances {
 vault: { usdc: number; address: string };
 spending: { usdc: number; address: string };
}


type Tab = 'home' | 'wallet' | 'scan' | 'chat' | 'store';


// --- Global Data ---


const recentActivityData: Transaction[] = [
 { id: '1', type: '充值', amount: '+ $100.00', currency: 'CAD', date: 'Feb 14', isPositive: true },
 { id: '2', type: '支付', amount: '- $12.50', currency: 'CAD', date: 'Feb 12', isPositive: false },
 { id: '3', type: 'Transfer', amount: '- $50.00', currency: 'USDC', date: 'Feb 10', isPositive: false },
];


// Rich Data for Alliance Card Simulation
const INITIAL_VOUCHERS = [
   {
     id: 'v1',
     name: 'CCSA CARD',
     nickname: '',
     balance: 150.00,
     currency: 'CAD',
     memberNo: 'M-000108',
     type: 'Membership',
     status: 'active',
     expiryDate: null,
     bg: 'radial-gradient(circle at top left, #dca54e, transparent 40%), radial-gradient(circle at bottom right, #2dd4bf, transparent 40%), linear-gradient(135deg, #7c3aed, #4f46e5)',
     icon: Globe,
     iconColor: '#fde68a',
     textColor: '#ffffff',
     benefits: [
       { icon: Star, title: tu('alliance_discount'), desc: "10% off at 20+ participating restaurants." },
       { icon: Zap, title: tu('gas_free'), desc: tu('zero_transaction_fees_on_beamio_network') },
       { icon: MapPin, title: "Universal Access", desc: "Valid across Toronto & Vancouver partners." }
     ],
     info: {
       issuer: "Canada Chinese Restaurant Alliance",
       network: tu('base_mainnet'),
       standard: "ERC-1155",
       contract: "0x88...921a"
     },
     history: [{ id: 1, title: tu('add_cash'), date: 'Feb 14', amount: '+ $100.00' }]
   },
   {
     id: 'v_sen',
     name: 'Sen Pho & Cafe',
     nickname: '',
     balance: 50.00,
     currency: 'CAD',
     memberNo: 'P-9921',
     type: 'Stored Value',
     status: 'active',
     expiryDate: null,
     bg: 'linear-gradient(135deg, #f97316, #ea580c, #9a3412)',
     icon: Utensils,
     iconColor: '#fed7aa',
     textColor: '#fff7ed',
     benefits: [
        { icon: Coffee, title: "Free Coffee", desc: "Get a free iced coffee every 5 visits." }
     ],
     info: { issuer: "Sen Pho", network: "Base", standard: "ERC-1155", contract: "0x77...22bb" },
     history: [{ id: 1, title: 'Opening Gift', date: 'Feb 15', amount: '+ $50.00' }]
   },
   {
     id: 'v2',
     name: 'Starbucks',
     nickname: 'Morning Coffee',
     balance: 12.50,
     currency: 'CAD',
     memberNo: 'S-882939',
     type: 'Rewards',
     status: 'active',
     expiryDate: null,
     bg: '#006241',
     icon: Coffee,
     iconColor: 'white',
     textColor: 'white',
     history: []
   },
   {
     id: 'v2_gift_1',
     name: 'Starbucks',
     nickname: '',
     balance: 25.00,
     currency: 'CAD',
     memberNo: 'G-112233',
     type: tu('gift_card'),
     status: 'active',
     expiryDate: null,
     bg: '#006241',
     icon: Coffee,
     iconColor: 'white',
     textColor: 'white',
     history: []
   },
   {
     id: 'v2_gift_2',
     name: 'Starbucks',
     nickname: '',
     balance: 25.00,
     currency: 'CAD',
     memberNo: 'G-998877',
     type: tu('gift_card'),
     status: 'active',
     expiryDate: null,
     bg: '#006241',
     icon: Coffee,
     iconColor: 'white',
     textColor: 'white',
     history: []
   },
   {
     id: 'v3',
     name: 'Air Canada',
     nickname: '',
     balance: 25000,
     currency: 'PTS',
     memberNo: 'AC-7721',
     type: 'Mileage',
     status: 'active',
     expiryDate: null,
     bg: 'linear-gradient(135deg, #ef4444, #b91c1c)',
     icon: Plane,
     iconColor: 'white',
     textColor: 'white',
     history: []
   },
   {
     id: 'v_concert_old',
     name: 'Taylor Swift | Eras',
     nickname: '',
     balance: 0.00,
     currency: 'TKT',
     memberNo: 'SEC-102',
     type: 'Event Ticket',
     status: 'expired',
     expiryDate: '2025-12-31',
     bg: 'linear-gradient(135deg, #ec4899, #831843)',
     icon: Ticket,
     iconColor: 'white',
     textColor: 'white',
     history: []
   },
   {
     id: 'v_old_gym',
     name: 'Fit4Less',
     nickname: '',
     balance: 0.00,
     currency: 'Days',
     memberNo: 'F4L-99',
     type: 'Access Pass',
     status: 'archived',
     expiryDate: null,
     bg: 'linear-gradient(135deg, #fbbf24, #d97706)',
     icon: Dumbbell,
     iconColor: 'white',
     textColor: 'white',
     history: []
   }
];


const INITIAL_BALANCES: WalletBalances = {
 vault: { usdc: 3.73, address: '0x212F...191D' },
 spending: { usdc: 0.04, address: '0x799E...75C8' },
};


// --- Helper Components ---


const RealisticQRCode = ({ className }: { className?: string }) => (
 <svg viewBox="0 0 100 100" fill="currentColor" className={className} shapeRendering="crispEdges">
   <path d="M10,10 h20 v20 h-20 z M15,15 v10 h10 v-10 z" />
   <path d="M70,10 h20 v20 h-20 z M75,15 v10 h10 v-10 z" />
   <path d="M10,70 h20 v20 h-20 z M15,75 v10 h10 v-10 z" />
   <rect x="20" y="20" width="5" height="5" />
   <rect x="80" y="20" width="5" height="5" />
   <rect x="20" y="80" width="5" height="5" />
   <g opacity="0.9">
     <rect x="40" y="10" width="5" height="5" /><rect x="50" y="10" width="5" height="5" /><rect x="60" y="10" width="5" height="5" />
     <rect x="45" y="15" width="5" height="5" /><rect x="55" y="15" width="5" height="5" /><rect x="65" y="15" width="5" height="5" />
     <rect x="40" y="20" width="5" height="5" /><rect x="50" y="20" width="5" height="5" /><rect x="60" y="20" width="5" height="5" />
     <rect x="10" y="40" width="5" height="5" /><rect x="20" y="40" width="5" height="5" /><rect x="30" y="40" width="5" height="5" />
     <rect x="15" y="45" width="5" height="5" /><rect x="25" y="45" width="5" height="5" /><rect x="35" y="45" width="5" height="5" />
     <rect x="10" y="50" width="5" height="5" /><rect x="20" y="50" width="5" height="5" /><rect x="30" y="50" width="5" height="5" />
     <rect x="40" y="40" width="10" height="10" /><rect x="60" y="40" width="5" height="5" /><rect x="70" y="40" width="5" height="5" /><rect x="80" y="40" width="5" height="5" />
     <rect x="50" y="50" width="5" height="5" /><rect x="60" y="50" width="5" height="5" /><rect x="70" y="50" width="5" height="5" /><rect x="80" y="50" width="5" height="5" />
     <rect x="40" y="60" width="5" height="5" /><rect x="50" y="60" width="5" height="5" /><rect x="60" y="60" width="5" height="5" /><rect x="70" y="60" width="10" height="10" />
     <rect x="80" y="60" width="5" height="5" /><rect x="90" y="60" width="5" height="5" />
     <rect x="40" y="70" width="5" height="5" /><rect x="50" y="70" width="5" height="5" /><rect x="60" y="70" width="5" height="5" /><rect x="80" y="70" width="5" height="5" />
     <rect x="40" y="80" width="5" height="5" /><rect x="55" y="80" width="5" height="5" /><rect x="65" y="80" width="5" height="5" /><rect x="75" y="80" width="5" height="5" /><rect x="85" y="80" width="5" height="5" />
     <rect x="40" y="90" width="5" height="5" /><rect x="50" y="90" width="5" height="5" /><rect x="60" y="90" width="5" height="5" /><rect x="70" y="90" width="5" height="5" /><rect x="80" y="90" width="5" height="5" />
   </g>
 </svg>
);


// Internal Transfer Overlay (New V3.13)
const InternalTransferOverlay = ({
 isOpen,
 onClose,
 balances,
 onTransfer
}: {
 isOpen: boolean,
 onClose: () => void,
 balances: WalletBalances,
 onTransfer: (amount: number, from: 'vault' | 'spending') => void
}) => {
 const [direction, setDirection] = useState<'vaultToSpending' | 'spendingToVault'>('vaultToSpending');
 const [amount, setAmount] = useState('');
 const [step, setStep] = useState('input');


 // Reset when opened
 useEffect(() => {
   if (isOpen) {
     setStep('input');
     setAmount('');
   }
 }, [isOpen]);


 const handleSwap = () => {
   setDirection(prev => prev === 'vaultToSpending' ? 'spendingToVault' : 'vaultToSpending');
 };


 const handleConfirm = () => {
   const numAmount = parseFloat(amount);
   const sourceBalance = direction === 'vaultToSpending' ? balances.vault.usdc : balances.spending.usdc;


   if (!amount || isNaN(numAmount) || numAmount <= 0) return;
   if (numAmount > sourceBalance) {
     alert(tu('insufficient_balance')); // Simplified feedback
     return;
   }


   setStep('processing');
   setTimeout(() => {
     onTransfer(numAmount, direction === 'vaultToSpending' ? 'vault' : 'spending');
     setStep('success');
   }, 1500);
 };


 if (!isOpen) return null;


 return (
   <div className="fixed inset-0 z-[100] flex flex-col justify-end">
     <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
     <div className="bg-white w-full rounded-t-[32px] relative flex flex-col overflow-hidden animate-slide-up shadow-2xl min-h-[600px]">
      
       {/* Header */}
       {step !== 'success' && (
         <div className="px-6 pt-6 pb-2 flex justify-between items-center z-10">
           <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ChevronDown className="w-6 h-6 text-gray-600" /></button>
           <span className="font-bold text-lg">内部转账</span>
           <div className="w-10"></div>
         </div>
       )}


       {step === 'input' && (
         <div className="flex-1 px-6 pt-4 pb-12 flex flex-col">
          
           {/* Visualizer */}
           <div className="flex flex-col gap-4 mb-8 mt-4 relative">
             {/* Source Card */}
             <div className={`p-4 rounded-[20px] transition-all border ${direction === 'vaultToSpending' ? 'bg-gradient-to-r from-blue-900 to-purple-900 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>
               <div className="flex justify-between items-center mb-1">
                 <span className="text-xs font-bold uppercase tracking-wider">From</span>
                 <span className="text-xs font-mono opacity-70">
                   {direction === 'vaultToSpending' ? balances.vault.address : balances.spending.address}
                 </span>
               </div>
               <div className="flex justify-between items-end">
                 <span className="font-bold text-lg">{direction === 'vaultToSpending' ? 'Main Wallet (Vault)' : tu('express_pay')}</span>
                 <span className="font-mono text-sm opacity-80">
                   Avail: {direction === 'vaultToSpending' ? balances.vault.usdc.toFixed(2) : balances.spending.usdc.toFixed(2)} USDC
                 </span>
               </div>
             </div>


             {/* Swap Button */}
             <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
               <button
                 onClick={handleSwap}
                 className="w-10 h-10 bg-white border border-gray-100 rounded-full shadow-md flex items-center justify-center text-[#1562f0] active:scale-90 transition-transform"
               >
                 <ArrowDown className="w-5 h-5" />
               </button>
             </div>


             {/* Destination Card */}
             <div className={`p-4 rounded-[20px] transition-all border ${direction === 'spendingToVault' ? 'bg-gradient-to-r from-blue-900 to-purple-900 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400'}`}>
               <div className="flex justify-between items-center mb-1">
                 <span className="text-xs font-bold uppercase tracking-wider">To</span>
                 <span className="text-xs font-mono opacity-70">
                   {direction === 'spendingToVault' ? balances.vault.address : balances.spending.address}
                 </span>
               </div>
               <div className="flex justify-between items-end">
                 <span className="font-bold text-lg">{direction === 'spendingToVault' ? 'Main Wallet (Vault)' : tu('express_pay')}</span>
                 <span className="font-mono text-sm opacity-80">
                   Current: {direction === 'spendingToVault' ? balances.vault.usdc.toFixed(2) : balances.spending.usdc.toFixed(2)} USDC
                 </span>
               </div>
             </div>
           </div>


           {/* Input */}
           <div className="flex-1 flex flex-col items-center justify-start">
              <div className="flex items-center justify-center mb-8">
                 <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-6xl font-bold text-gray-900 bg-transparent w-full text-center outline-none placeholder-gray-200"
                    placeholder="0.00"
                    autoFocus
                 />
                 <span className="text-xl font-bold text-gray-400 ml-2 mt-4">USDC</span>
              </div>
             
              <div className="flex gap-2">
                {['10', '50', 'Max'].map(val => (
                  <button
                   key={val}
                   onClick={() => setAmount(val === 'Max' ? (direction === 'vaultToSpending' ? balances.vault.usdc.toString() : balances.spending.usdc.toString()) : val)}
                   className="px-4 py-2 rounded-full bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200"
                  >
                    {val === 'Max' ? 'Max' : `+ ${val}`}
                  </button>
                ))}
              </div>
           </div>


           {/* Button */}
           <button
             onClick={handleConfirm}
             className="w-full bg-[#1562f0] text-white h-14 rounded-[20px] font-bold text-lg shadow-xl shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
           >
             <ArrowRightLeft className="w-5 h-5" />
             Transfer Now
           </button>
         </div>
       )}


       {step === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center">
             <div className="w-16 h-16 border-4 border-blue-100 border-t-[#1562f0] rounded-full animate-spin mb-6"></div>
             <h3 className="text-xl font-bold text-gray-900">Moving Assets...</h3>
             <p className="text-gray-500 text-sm mt-2">Zero Gas Fee • Instant</p>
          </div>
       )}


       {step === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center animate-fade-in-up">
             <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
                <Check className="w-10 h-10" strokeWidth={3} />
             </div>
             <h3 className="text-2xl font-bold text-gray-900 mb-2">Transfer Complete!</h3>
             <p className="text-gray-500 mb-8">Moved <span className="text-gray-900 font-bold">{parseFloat(amount).toFixed(2)} USDC</span> successfully.</p>
             <button onClick={onClose} className="w-full bg-gray-900 text-white h-14 rounded-[20px] font-bold text-lg">完成</button>
          </div>
       )}


     </div>
   </div>
 );
};


// Voucher Detail Modal
const VoucherDetailModal = ({ voucher, onClose, onPay, onTopUp }: { voucher: any, onClose: () => void, onPay: (v: any) => void, onTopUp: () => void }) => {
 if (!voucher) return null;
 const Icon = voucher.icon;
 // Use nickname if available, else name
 const displayName = voucher.nickname || voucher.name;


 return (
   <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="bg-[#F2F2F7] w-full h-[95%] rounded-t-[32px] relative flex flex-col overflow-hidden animate-slide-up shadow-2xl">
         <div className="absolute top-0 left-0 w-full h-64 z-0" style={{ background: voucher.bg }}></div>
         <div className="absolute top-0 left-0 w-full h-64 z-0 bg-gradient-to-b from-transparent to-[#F2F2F7]"></div>
         <div className="px-6 pt-6 pb-2 flex justify-between items-center z-10">
            <button onClick={onClose} className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 text-white transition-colors"><ChevronDown className="w-6 h-6" /></button>
            <button className="p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 text-white transition-colors"><Settings className="w-6 h-6" /></button>
         </div>
         <div className="flex-1 overflow-y-auto px-6 pt-2 pb-10 z-10 hide-scrollbar">
            <div className="w-full h-56 rounded-[24px] p-6 text-white shadow-2xl relative overflow-hidden mb-8 transform transition-transform" style={{ background: voucher.bg, color: voucher.textColor }}>
                <div className="flex justify-between items-start mb-2">
                   <div className="flex flex-col">
                      <h2 className="text-4xl font-bold tracking-tight leading-none text-white drop-shadow-sm">
                        {voucher.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        <span className="text-xl font-medium ml-2 opacity-90">{voucher.currency}</span>
                      </h2>
                      <p className="text-[10px] font-bold opacity-70 tracking-widest uppercase mt-1">余额</p>
                   </div>
                   <div className="text-xs font-mono opacity-80 tracking-widest pt-2 text-right">
                      {voucher.memberNo}
                   </div>
                </div>


                <div className="mt-12 flex justify-between items-end">
                    <div className="flex items-center gap-3">
                       <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                          <Icon className="w-7 h-7 text-white" />
                       </div>
                       <div>
                          <h3 className="font-bold text-xl leading-none">{displayName}</h3>
                          <span className="text-[10px] opacity-80 uppercase tracking-wider">{voucher.type}</span>
                       </div>
                    </div>
                    <QrCode className="w-8 h-8 opacity-60" />
                </div>
            </div>
           
            {/* Actions */}
            {voucher.status === 'active' ? (
               <div className="grid grid-cols-3 gap-3 mb-8">
                   <button onClick={() => onPay(voucher)} className="bg-white p-4 rounded-[20px] flex flex-col items-center justify-center shadow-sm active:scale-95 transition-transform"><div className="w-10 h-10 bg-[#1562f0] rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-blue-200"><Scan className="w-5 h-5" /></div><span className="text-xs font-bold text-gray-700">支付</span></button>
                   <button onClick={onTopUp} className="bg-white p-4 rounded-[20px] flex flex-col items-center justify-center shadow-sm active:scale-95 transition-transform"><div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-green-200"><Plus className="w-5 h-5" /></div><span className="text-xs font-bold text-gray-700">充值</span></button>
                   <button className="bg-white p-4 rounded-[20px] flex flex-col items-center justify-center shadow-sm active:scale-95 transition-transform"><div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white mb-2 shadow-lg shadow-orange-200"><Ticket className="w-5 h-5" /></div><span className="text-xs font-bold text-gray-700">Details</span></button>
               </div>
            ) : (
               <div className="bg-red-50 rounded-[20px] p-4 mb-8 flex items-center justify-center gap-2 text-red-500 border border-red-100">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-bold text-sm">This card is {voucher.status}</span>
               </div>
            )}


            {/* Member Benefits */}
            {voucher.benefits && (
               <div className="bg-white rounded-[24px] p-5 shadow-sm mb-4">
                  <div className="flex items-center gap-2 mb-4">
                     <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                     <h3 className="font-bold text-gray-900">会员权益</h3>
                  </div>
                  <div className="space-y-4">
                     {voucher.benefits.map((benefit: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-3">
                           <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                              <benefit.icon className="w-4 h-4 text-[#1562f0]" />
                           </div>
                           <div>
                              <h4 className="text-sm font-bold text-gray-900">{benefit.title}</h4>
                              <p className="text-xs text-gray-500 leading-relaxed">{benefit.desc}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}


            {/* Recent Activity */}
            <div className="bg-white rounded-[24px] p-5 shadow-sm mb-4"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-900">最近动态</h3><span className="text-xs font-bold text-[#1562f0]">查看全部</span></div>
               {voucher.history && voucher.history.length > 0 ? (<div className="space-y-4">{voucher.history.map((item: any) => (<div key={item.id} className="flex justify-between items-center"><div className="flex items-center space-x-3"><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><History className="w-4 h-4" /></div><div><div className="text-sm font-bold text-gray-900">{item.title}</div><div className="text-xs text-gray-500">{item.date}</div></div></div><span className={`text-sm font-bold ${item.amount.startsWith('+') ? 'text-green-600' : 'text-gray-900'}`}>{item.amount}</span></div>))}</div>) : (<div className="text-center py-8 text-gray-400 text-sm">暂无最近交易</div>)}
            </div>


            {/* Card Information */}
            {voucher.info && (
               <div className="bg-white rounded-[24px] p-5 shadow-sm mb-12">
                  <div className="flex items-center gap-2 mb-4">
                     <Info className="w-4 h-4 text-gray-400" />
                     <h3 className="font-bold text-gray-900">卡信息</h3>
                  </div>
                  <div className="space-y-3">
                     <div className="flex justify-between text-xs"><span className="text-gray-500">发行方</span><span className="font-medium text-gray-900">{voucher.info.issuer}</span></div>
                     <div className="flex justify-between text-xs"><span className="text-gray-500">网络</span><span className="font-medium text-gray-900">{voucher.info.network}</span></div>
                     <div className="flex justify-between text-xs"><span className="text-gray-500">标准</span><span className="font-medium text-gray-900">{voucher.info.standard}</span></div>
                     <div className="flex justify-between text-xs"><span className="text-gray-500">合约</span><span className="font-mono text-gray-500">{voucher.info.contract}</span></div>
                     <div className="flex justify-between text-xs items-center pt-2 border-t border-gray-100 mt-2">
                        <span className="text-gray-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-green-500" /> Audit Status</span>
                        <span className="font-bold text-green-600">已验证</span>
                     </div>
                  </div>
               </div>
            )}
         </div>
      </div>
   </div>
 );
};


// Unified Pay Code Overlay
const PayCodeOverlay = ({ isOpen, onClose, voucher }: { isOpen: boolean, onClose: () => void, voucher?: any }) => {
  if (!isOpen) return null;
  const displayName = voucher ? (voucher.nickname || voucher.name) : '';


  return (
     <div className="fixed inset-0 z-[100] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose}></div>
        <div className="bg-[#1562f0] w-full rounded-t-[32px] p-6 pb-20 relative flex flex-col items-center animate-slide-up shadow-2xl overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[60px] pointer-events-none -mt-20 -mr-20"></div>
           <div className="w-12 h-1.5 bg-white/20 rounded-full mb-8"></div>
           <div className="text-center mb-8 relative z-10">
              <h2 className="text-white font-bold text-2xl mb-1">快捷支付</h2>
              <p className="text-white/70 text-sm">Scan to pay instantly</p>
           </div>
           <div className="bg-white p-6 rounded-[32px] shadow-2xl shadow-blue-900/50 mb-8 relative z-10 w-full max-w-[320px] aspect-square flex items-center justify-center">
              <RealisticQRCode className="w-full h-full text-gray-900" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                    <Zap className="w-6 h-6 text-[#1562f0] fill-current" />
                 </div>
              </div>
           </div>
           {voucher ? (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full pl-2 pr-4 py-2 flex items-center gap-3 animate-fade-in-up">
                 <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: voucher.bg }}>
                    <voucher.icon className="w-4 h-4 text-white" />
                 </div>
                 <div className="text-left">
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider leading-none mb-0.5">Prioritizing</p>
                    <p className="text-white font-bold text-sm leading-none">{displayName}</p>
                 </div>
              </div>
           ) : (
              <div className="text-white/50 text-xs font-mono">0x799E...75C8</div>
           )}
        </div>
     </div>
  );
};


// Top Up Overlay
const TopUpOverlay = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [step, setStep] = useState('amount');
  const [amount, setAmount] = useState('50');
 
  // Reset state when opening
  useEffect(() => {
     if (isOpen) setStep('amount');
  }, [isOpen]);


  const handleTopUp = () => {
     setStep('processing');
     setTimeout(() => {
        setStep('success');
     }, 2000);
  };


  if (!isOpen) return null;


  return (
     <div className="fixed inset-0 z-[100] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
        <div className="bg-white w-full rounded-t-[32px] relative flex flex-col overflow-hidden animate-slide-up shadow-2xl min-h-[500px]">
           {step !== 'success' && (
              <div className="px-6 pt-6 pb-2 flex justify-between items-center z-10">
                 <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><ChevronDown className="w-6 h-6 text-gray-600" /></button>
                 <span className="font-bold text-lg">Top Up Balance</span>
                 <div className="w-10"></div>
              </div>
           )}


           {step === 'amount' && (
              <div className="flex-1 px-6 pt-4 pb-12 flex flex-col">
                 <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Enter Amount</div>
                    <div className="flex items-center justify-center mb-8">
                       <span className="text-4xl font-bold text-gray-300 mr-2">$</span>
                       <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="text-6xl font-bold text-gray-900 bg-transparent w-40 text-center outline-none"
                          autoFocus
                       />
                    </div>
                    <div className="w-full max-w-xs grid grid-cols-3 gap-3 mb-8">
                       {['20', '50', '100'].map(val => (
                          <button
                             key={val}
                             onClick={() => setAmount(val)}
                             className={`py-3 rounded-xl font-bold text-sm transition-all ${amount === val ? 'bg-[#1562f0] text-white shadow-lg shadow-blue-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                          >
                             ${val}
                          </button>
                       ))}
                    </div>
                 </div>


                 <div className="space-y-4">
                    <div className="bg-gray-50 rounded-[20px] p-4 flex items-center justify-between border border-gray-100">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center">
                             <CardIcon className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="text-sm font-bold text-gray-900">Apple Pay</p>
                             <p className="text-xs text-gray-500">Visa •• 4242</p>
                          </div>
                       </div>
                       <span className="text-xs font-bold text-[#1562f0]">Change</span>
                    </div>
                    <button
                       onClick={handleTopUp}
                       className="w-full bg-[#1562f0] text-white h-14 rounded-[20px] font-bold text-lg shadow-xl shadow-blue-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                       <Zap className="w-5 h-5 fill-white" />
                       Top Up Now
                    </button>
                 </div>
              </div>
           )}


           {step === 'processing' && (
              <div className="flex-1 flex flex-col items-center justify-center">
                 <div className="w-16 h-16 border-4 border-blue-100 border-t-[#1562f0] rounded-full animate-spin mb-6"></div>
                 <h3 className="text-xl font-bold text-gray-900">Processing...</h3>
                 <p className="text-gray-500 text-sm mt-2">Confirming with Payment Provider</p>
              </div>
           )}


           {step === 'success' && (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center animate-fade-in-up">
                 <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
                    <Check className="w-10 h-10" strokeWidth={3} />
                 </div>
                 <h3 className="text-2xl font-bold text-gray-900 mb-2">Top Up Successful!</h3>
                 <p className="text-gray-500 mb-8">You have added <span className="text-gray-900 font-bold">${amount}.00</span> to your wallet.</p>
                 <button onClick={onClose} className="w-full bg-gray-900 text-white h-14 rounded-[20px] font-bold text-lg">完成</button>
              </div>
           )}
        </div>
     </div>
  );
};


// Manage Cards Overlay (Updated with Renaming Logic)
const ManageCardsOverlay = ({
 isOpen,
 onClose,
 allVouchers,
 onUpdateStatus,
 onRename
}: {
 isOpen: boolean,
 onClose: () => void,
 allVouchers: any[],
 onUpdateStatus: (id: string, status: string) => void,
 onRename: (id: string, newName: string) => void
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');


  if (!isOpen) return null;


  const activeVouchers = allVouchers.filter(v => v.status === 'active');
  const hiddenVouchers = allVouchers.filter(v => v.status === 'archived');
  const expiredVouchers = allVouchers.filter(v => v.status === 'expired');


  const startEditing = (voucher: any) => {
     setEditingId(voucher.id);
     setTempName(voucher.nickname || voucher.name);
  };


  const saveEditing = (id: string) => {
     onRename(id, tempName);
     setEditingId(null);
  };


  return (
     <div className="fixed inset-0 z-[100] bg-[#F2F2F7] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md px-5 pt-14 pb-4 flex justify-between items-center border-b border-gray-200 sticky top-0 z-10">
           <h1 className="text-lg font-bold">管理 Pass</h1>
           <button onClick={onClose} className="text-[#1562f0] font-bold text-base">完成</button>
        </div>


        <div className="flex-1 overflow-y-auto p-5">
           <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3 ml-2">Active Passes ({activeVouchers.length})</p>
           <div className="bg-white rounded-[20px] overflow-hidden shadow-sm mb-6">
              {activeVouchers.map((voucher) => {
                 const Icon = voucher.icon;
                 const isEditing = editingId === voucher.id;
                 const displayTitle = voucher.nickname || voucher.name;


                 return (
                    <div key={voucher.id} className="flex items-center p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group">
                       <button onClick={() => onUpdateStatus(voucher.id, 'archived')} className="text-red-500 mr-4 active:scale-90 transition-transform">
                          <MinusCircle className="w-6 h-6 fill-red-100" />
                       </button>
                       <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3" style={{ background: voucher.bg }}>
                          <Icon className="w-5 h-5 text-white" />
                       </div>
                       <div className="flex-1">
                          <div className="flex items-center gap-2">
                             {isEditing ? (
                                <div className="flex items-center gap-2 w-full">
                                   <input
                                      type="text"
                                      value={tempName}
                                      onChange={(e) => setTempName(e.target.value)}
                                      className="font-bold text-gray-900 text-sm border-b-2 border-[#1562f0] outline-none bg-transparent w-full"
                                      autoFocus
                                      onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(voucher.id) }}
                                   />
                                   <button onClick={() => saveEditing(voucher.id)} className="text-[#1562f0]">
                                      <Save className="w-4 h-4" />
                                   </button>
                                </div>
                             ) : (
                                <>
                                   <h3 className="font-bold text-gray-900 text-sm">{displayTitle}</h3>
                                   {voucher.nickname && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Nickname</span>}
                                   <button onClick={() => startEditing(voucher)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Edit2 className="w-3 h-3 text-gray-400 hover:text-[#1562f0]" />
                                   </button>
                                </>
                             )}
                          </div>
                          <p className="text-xs text-gray-500">{voucher.type} • {voucher.balance.toLocaleString(undefined, {minimumFractionDigits: 2})} {voucher.currency}</p>
                       </div>
                       <div className="text-gray-300 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-5 h-5" />
                       </div>
                    </div>
                 );
              })}
              {activeVouchers.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">暂无有效 Pass</div>}
           </div>


           {(hiddenVouchers.length > 0 || expiredVouchers.length > 0) && (
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-3 ml-2">Hidden & Expired</p>
           )}
          
           <div className="bg-white rounded-[20px] overflow-hidden shadow-sm mb-8">
              {hiddenVouchers.map((voucher) => {
                 const Icon = voucher.icon;
                 return (
                    <div key={voucher.id} className="flex items-center p-4 border-b border-gray-100 last:border-0 opacity-70">
                       <button onClick={() => onUpdateStatus(voucher.id, 'active')} className="text-green-500 mr-4 active:scale-90 transition-transform">
                          <PlusCircle className="w-6 h-6 fill-green-100" />
                       </button>
                       <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 bg-gray-200">
                          <Icon className="w-5 h-5 text-gray-500" />
                       </div>
                       <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-sm">{voucher.nickname || voucher.name}</h3>
                          <p className="text-xs text-gray-500">由您归档</p>
                       </div>
                    </div>
                 );
              })}


              {expiredVouchers.map((voucher) => {
                 const Icon = voucher.icon;
                 return (
                    <div key={voucher.id} className="flex items-center p-4 border-b border-gray-100 last:border-0 opacity-50 bg-gray-50">
                       <div className="mr-4 text-gray-300 w-6 flex justify-center">
                          <Clock className="w-4 h-4" />
                       </div>
                       <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 grayscale" style={{ background: voucher.bg }}>
                          <Icon className="w-5 h-5 text-white" />
                       </div>
                       <div className="flex-1">
                          <h3 className="font-bold text-gray-500 text-sm">{voucher.name}</h3>
                          <p className="text-xs text-gray-400">Expired on {voucher.expiryDate}</p>
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
     </div>
  );
};


// Store View
const StoreView = () => (
   <div className="pt-14 pb-32 px-4 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center px-2">
         <h1 className="text-3xl font-bold text-gray-900">Store</h1>
         <div className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-500">Toronto</div>
      </div>
      <div className="w-full h-40 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[24px] p-6 text-white flex flex-col justify-center shadow-lg relative overflow-hidden">
         <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-1">New Arrivals</h2>
            <p className="opacity-80 text-sm mb-4">Get exclusive membership deals.</p>
            <button className="bg-white text-indigo-600 px-4 py-2 rounded-full text-xs font-bold shadow-sm">Explore</button>
         </div>
         <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
      </div>
      <h3 className="text-lg font-bold text-gray-900 px-1">Featured</h3>
      <div className="grid grid-cols-2 gap-4">
         {[{ title: 'Best Buy', offer: '2% Back', color: 'bg-blue-600' }, { title: 'Amazon', offer: '$10 Gift', color: 'bg-yellow-500' }, { title: 'Uber', offer: 'Free Ride', color: 'bg-black' }].map((item, idx) => (
            <div key={idx} className="bg-white p-4 rounded-[20px] h-32 flex flex-col justify-between shadow-sm border border-gray-100">
               <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-xs`}>{item.title[0]}</div>
               <div><h4 className="font-bold text-gray-900">{item.title}</h4><span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">{item.offer}</span></div>
            </div>
         ))}
      </div>
   </div>
);


// Main App Component
export default function App() {
 const [activeTab, setActiveTab] = useState<Tab>('home');
 const [isExpressExpanded, setIsExpressExpanded] = useState(false);
 const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
 const [isManagingCards, setIsManagingCards] = useState(false);
 const [showPayCode, setShowPayCode] = useState(false);
 const [payCodeContext, setPayCodeContext] = useState<any>(null);
 const [isTopUpOpen, setIsTopUpOpen] = useState(false);
 const [isTransferOpen, setIsTransferOpen] = useState(false);
  // Wallet Balances State
 const [balances, setBalances] = useState<WalletBalances>(INITIAL_BALANCES);
 // Vouchers State
 const [vouchers, setVouchers] = useState(INITIAL_VOUCHERS);


 const updateVoucherStatus = (id: string, newStatus: string) => {
    setVouchers(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));
 };


 const renameVoucher = (id: string, newNickname: string) => {
    setVouchers(prev => prev.map(v => v.id === id ? { ...v, nickname: newNickname } : v));
 };


 const handlePayAction = (voucher: any) => {
    setPayCodeContext(voucher);
    setShowPayCode(true);
 };


 const handleAddCard = () => {
    setActiveTab('store');
 };


 const handleDetails = () => {
    // Show details for the main card (CCSA)
    setSelectedVoucher(INITIAL_VOUCHERS[0]);
 };


 const handleTopUpTrigger = () => {
    setIsTopUpOpen(true);
 };


 const handleInternalTransferTrigger = () => {
    setIsTransferOpen(true);
 };


 const handleInternalTransfer = (amount: number, from: 'vault' | 'spending') => {
    setBalances(prev => {
       if (from === 'vault') {
          return {
             vault: { ...prev.vault, usdc: prev.vault.usdc - amount },
             spending: { ...prev.spending, usdc: prev.spending.usdc + amount }
          };
       } else {
          return {
             vault: { ...prev.vault, usdc: prev.vault.usdc + amount },
             spending: { ...prev.spending, usdc: prev.spending.usdc - amount }
          };
       }
    });
    setIsTransferOpen(false);
 };


 const HomeView = () => (
   <div className="pt-14 pb-32 px-4 space-y-6 animate-fade-in">
     <div className="flex justify-between items-center px-2">
       <button className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition"><ChevronDown size={20} /></button>
       <button className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition"><Settings size={20} /></button>
     </div>
     <div className="relative w-full aspect-[1.58/1] rounded-[32px] overflow-hidden shadow-2xl shadow-indigo-500/30">
       <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#06B6D4]"></div>
       <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]"></div>
       <div className="relative h-full p-6 flex flex-col justify-between text-white">
         <div className="flex justify-between items-start">
           <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center bg-white/10"><Globe size={20} className="text-yellow-300" /></div><div><h3 className="font-serif text-xl leading-tight tracking-wide">CCSA</h3><p className="text-xs font-serif opacity-80 tracking-widest">CARD</p></div></div>
           <QrCode size={24} className="opacity-80" />
         </div>
         <div><p className="text-xs font-medium opacity-70 mb-1 tracking-wider">BALANCE</p><div className="flex items-baseline gap-2"><h1 className="text-4xl font-bold tracking-tight">150.00</h1><span className="text-sm font-medium opacity-80">CAD</span></div></div>
         <div className="absolute bottom-6 right-6"><p className="text-[10px] font-mono opacity-60 tracking-widest">M-000108</p></div>
       </div>
     </div>
     <div className="grid grid-cols-3 gap-4">
       <button onClick={() => handlePayAction(INITIAL_VOUCHERS[0])} className="bg-white rounded-[24px] py-4 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><div className="w-12 h-12 bg-[#1562f0] rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-600/30"><Scan size={20} /></div><span className="text-xs font-bold text-gray-700">支付</span></button>
       <button onClick={handleTopUpTrigger} className="bg-white rounded-[24px] py-4 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-500/30"><Plus size={24} /></div><span className="text-xs font-bold text-gray-700">充值</span></button>
       <button onClick={handleDetails} className="bg-white rounded-[24px] py-4 flex flex-col items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/30"><CreditCard size={20} /></div><span className="text-xs font-bold text-gray-700">Details</span></button>
     </div>
     <div className="bg-white rounded-[32px] p-6 shadow-sm">
       <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-gray-800">最近动态</h3><button className="text-[#1562f0] text-xs font-bold">查看全部</button></div>
       <div className="space-y-6">
         {recentActivityData.map((tx) => (<div key={tx.id} className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><History size={18} /></div><div><p className="text-sm font-bold text-gray-900">{tx.type}</p><p className="text-xs text-gray-400">{tx.date}</p></div></div><span className={`text-sm font-bold ${tx.isPositive ? 'text-green-600' : 'text-gray-900'}`}>{tx.amount}</span></div>))}
       </div>
     </div>
   </div>
 );


 const WalletStackView = ({ onManage, onAdd, onTransfer }: { onManage: () => void, onAdd: () => void, onTransfer: () => void }) => {
   const [searchTerm, setSearchTerm] = useState('');
   const filteredVouchers = vouchers.filter(v => v.status === 'active' && (v.nickname || v.name).toLowerCase().includes(searchTerm.toLowerCase()));


   return (
     <div className="flex flex-col h-full bg-[#F2F2F7] pt-14 px-5 pb-44 overflow-y-auto hide-scrollbar">
       <div className="flex justify-between items-center mb-6 px-1">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">钱包</h1>
          <div className="flex items-center gap-3">
            <button onClick={onTransfer} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shadow-sm text-gray-700 active:scale-95 transition-transform"><ArrowRightLeft className="w-4 h-4" /></button>
            <button onClick={onManage} className="text-[#1562f0] font-bold text-sm bg-blue-50 px-3 py-1.5 rounded-full">编辑</button>
            <button onClick={onAdd} className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm text-[#1562f0] active:scale-95 transition-transform"><Plus className="w-5 h-5" /></button>
          </div>
       </div>
       <div className="relative h-[650px] perspective-1000">
         {/* Main Vault */}
         <div onClick={() => setIsExpressExpanded(false)} className={`absolute top-0 w-full rounded-[32px] p-6 text-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isExpressExpanded ? 'scale-90 opacity-100 translate-y-4 brightness-50' : 'scale-95 translate-y-16'}`} style={{ background: 'linear-gradient(135deg, #2563eb, #9333ea, #db2777)', zIndex: 10 }}>
           <div className="flex justify-between items-start mb-8"><div className="flex items-center space-x-2"><div className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center"><div className="w-4 h-1 bg-white rounded-full"></div></div><span className="font-medium text-lg tracking-wide">Base 上的 USDC</span></div><div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/20"><QrCode className="w-5 h-5" /></div></div>
           <div className="text-center mb-10"><div className="flex items-baseline justify-center"><span className="text-6xl font-bold tracking-tighter">{balances.vault.usdc.toFixed(2)}</span><span className="text-xl font-medium ml-2 opacity-80">USDC</span></div><div className="text-white/70 font-medium">≈ CA$ {(balances.vault.usdc * CURRENCY_RATES.CAD.rate).toFixed(2)}</div></div>
           <div className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-full inline-flex items-center space-x-2 border border-white/10 font-mono text-sm active:bg-black/30 transition-colors cursor-pointer mx-auto block w-fit"><span>{balances.vault.address}</span><Copy className="w-3 h-3 opacity-70" /></div>
         </div>
         {/* Express Pay */}
         <div onClick={() => setIsExpressExpanded(!isExpressExpanded)} className={`absolute top-0 w-full rounded-[32px] p-6 text-white shadow-[0_20px_50px_-12px_rgba(79,70,229,0.5)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${isExpressExpanded ? 'translate-y-[240px]' : 'translate-y-[150px]'}`} style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7, #3b82f6)', zIndex: 20 }}>
           <div className="flex justify-between items-center mb-8"><div className="flex items-center space-x-2"><div className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center"><Zap className="w-4 h-4 fill-current" /></div><span className="font-medium text-lg tracking-wide">快捷支付</span></div><button onClick={(e) => { e.stopPropagation(); handlePayAction(null); }} className="flex items-center space-x-2 border border-white/30 rounded-full px-4 py-1.5 backdrop-blur-md bg-white/5 active:bg-white/20 transition-colors"><QrCode className="w-4 h-4" /><span className="text-xs font-bold tracking-wider">PAY CODE</span></button></div>
           <div className="text-center mb-10"><div className="flex items-baseline justify-center"><span className="text-6xl font-bold tracking-tighter text-[#4ade80]">{balances.spending.usdc.toFixed(2)}</span><span className="text-xl font-medium ml-2 opacity-80 text-[#4ade80]">USDC</span></div><div className="text-[#4ade80]/70 font-medium">≈ CA$ {(balances.spending.usdc * CURRENCY_RATES.CAD.rate).toFixed(2)}</div></div>
           <div className="bg-black/20 backdrop-blur-md px-4 py-2 rounded-full inline-flex items-center space-x-2 border border-white/10 font-mono text-sm active:bg-black/30 transition-colors mx-auto block w-fit" onClick={(e) => { e.stopPropagation(); /* Copy action here */ }}><span>{balances.spending.address}</span><Copy className="w-3 h-3 opacity-70" /></div>
           <div className="absolute bottom-4 right-6 opacity-50 animate-bounce">{isExpressExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</div>
         </div>
         {/* Stacked Vouchers */}
         <div className={`absolute top-[480px] w-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isExpressExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'}`} style={{ zIndex: 15 }}>
            <div className="mb-4"><div className="bg-white rounded-xl px-4 py-2 flex items-center shadow-sm border border-gray-100"><Search className="w-4 h-4 text-gray-400 mr-2" /><input type="text" placeholder="Search passes..." className="bg-transparent text-sm w-full outline-none text-gray-700 placeholder-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
            <div className="flex items-center justify-between px-2 mb-2"><span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{filteredVouchers.length} Passes</span></div>
            <div className="relative pb-32">
              {filteredVouchers.length > 0 ? (
                  filteredVouchers.map((voucher, index) => {
                    const Icon = voucher.icon;
                    const overlap = 135;
                    const displayName = voucher.nickname || voucher.name;
                    return (
                      <div key={voucher.id} onClick={() => setSelectedVoucher(voucher)} className="w-full h-48 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden group active:scale-[0.98] transition-transform origin-top hover:translate-y-[-8px] border border-white/10" style={{ background: voucher.bg, zIndex: index, marginTop: index === 0 ? 0 : `-${overlap}px`, color: voucher.textColor || 'white', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', transform: `scale(${Math.max(0.95, 1 - (index * 0.01))})`, }}>
                         <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-sm"><Icon className="w-4 h-4 text-white" /></div><div className="flex flex-col"><h3 className="font-bold text-sm leading-tight text-white/90 drop-shadow-sm">{displayName}</h3><span className="text-[10px] opacity-70 uppercase tracking-wider">{voucher.type}</span></div></div>
                            <div className="text-right"><h2 className="text-2xl font-bold tracking-tight leading-none text-white drop-shadow-sm">{voucher.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}<span className="text-xs font-medium ml-1 opacity-80">{voucher.currency}</span></h2></div>
                         </div>
                         <div className="mt-auto pt-8 flex justify-end items-end opacity-40"><p className="text-[10px] font-mono tracking-widest">{voucher.memberNo}</p></div>
                      </div>
                    );
                  })
              ) : (<div className="text-center py-10 text-gray-400 text-sm">No passes found</div>)}
            </div>
         </div>
       </div>
       <VoucherDetailModal voucher={selectedVoucher} onClose={() => setSelectedVoucher(null)} onPay={handlePayAction} onTopUp={handleTopUpTrigger} />
     </div>
   );
 };


 const StatusBar = () => (<div className="flex justify-between items-center px-6 py-2 text-white/80 text-xs font-medium z-50 absolute top-0 w-full"><span>9:41</span><div className="flex gap-1"><div className="w-4 h-2.5 border border-white/40 rounded-[2px]"></div></div></div>);
 const BottomNav = () => (<div className="fixed bottom-6 left-6 right-6 h-20 bg-white rounded-[32px] shadow-2xl flex items-center justify-between px-6 z-50"><button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-blue-600' : 'text-gray-400'}`}><Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} /></button><button onClick={() => setActiveTab('wallet')} className={`flex flex-col items-center gap-1 ${activeTab === 'wallet' ? 'text-blue-600' : 'text-gray-400'}`}><Wallet size={24} strokeWidth={activeTab === 'wallet' ? 2.5 : 2} /></button><button onClick={() => setActiveTab('scan')} className="relative -top-6 w-16 h-16 bg-[#1562f0] rounded-full shadow-lg shadow-blue-600/40 flex items-center justify-center text-white transform transition-transform active:scale-95"><Scan size={28} /></button><button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 ${activeTab === 'chat' ? 'text-blue-600' : 'text-gray-400'}`}><MessageSquare size={24} strokeWidth={activeTab === 'chat' ? 2.5 : 2} /></button><button onClick={() => setActiveTab('store')} className={`flex flex-col items-center gap-1 ${activeTab === 'store' ? 'text-blue-600' : 'text-gray-400'}`}><Store size={24} strokeWidth={activeTab === 'store' ? 2.5 : 2} /></button></div>);


 return (
   <div className="w-full min-h-screen bg-[#F2F4F8] font-sans antialiased text-slate-900 selection:bg-blue-200">
     <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none"><div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[100px]"></div><div className="absolute bottom-[-10%] right-[-20%] w-[400px] h-[400px] bg-blue-200/40 rounded-full blur-[100px]"></div></div>
     <div className="relative z-10 max-w-md mx-auto min-h-screen bg-[#F2F4F8]/80 backdrop-blur-sm flex flex-col shadow-2xl overflow-hidden">
       <StatusBar />
       <div className="flex-1 overflow-hidden relative">
         {activeTab === 'home' && <HomeView />}
         {activeTab === 'wallet' && <WalletStackView onManage={() => setIsManagingCards(true)} onAdd={handleAddCard} onTransfer={handleInternalTransferTrigger} />}
         {activeTab === 'store' && <StoreView />}
         {activeTab === 'scan' && <div className="flex items-center justify-center h-full text-gray-400 font-medium animate-pulse">Camera Active...</div>}
       </div>
       <ManageCardsOverlay
         isOpen={isManagingCards}
         onClose={() => setIsManagingCards(false)}
         allVouchers={vouchers}
         onUpdateStatus={updateVoucherStatus}
         onRename={renameVoucher}
       />
       <PayCodeOverlay isOpen={showPayCode} onClose={() => { setShowPayCode(false); setPayCodeContext(null); }} voucher={payCodeContext} />
       <TopUpOverlay isOpen={isTopUpOpen} onClose={() => setIsTopUpOpen(false)} />
       <InternalTransferOverlay
         isOpen={isTransferOpen}
         onClose={() => setIsTransferOpen(false)}
         balances={balances}
         onTransfer={handleInternalTransfer}
       />
       <BottomNav />
     </div>
     <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1); } @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fade-in 0.3s ease-out; } @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }`}</style>
   </div>
 );
}

