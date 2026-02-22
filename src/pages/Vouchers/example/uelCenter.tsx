import React, { useState, useMemo, useEffect } from 'react';
import {
 Zap,
 ArrowUpRight,
 Plus,
 ChevronRight,
 Calculator,
 CheckCircle2,
 RefreshCw,
 Minus,
 Coins,
 User,
 ArrowDownLeft,
 MessageSquare,
 Search,
 Copy,
 QrCode,
 Globe,
 ShieldAlert,
 Home,
 Wallet,
 Store,
 ScanLine,
 Filter,
 X,
 ExternalLink,
 Settings,
 Cpu,
 BarChart3,
 ArrowRightLeft,
 Wallet as WalletIcon
} from 'lucide-react';


// --- Types ---
type Contact = { id: string; name: string; tag: string; followers: number; wallet: string; avatarColor: string };
type BUnitsLog = { id: string; title: string; subtitle: string; amount: number; time: string; type: string; status: string; linkedUsdc: string; txHash: string; network: string };

// --- Global Configuration (V4.0 Specs) ---
const BEAMIO_BLUE = "#1562f0";
const REFUEL_GAS_COST = 2; // Shadow gas for the refuel operation itself
const MIN_SERVICE_FEE = 2; // Min 2 Units ($0.02)
const MAX_SERVICE_FEE = 200; // Max 200 Units ($2.00)
const P2P_GAS_COST = 2; // Flat 2 Units for P2P Send


const App = () => {
 // --- Global States ---
 const [currentView, setCurrentView] = useState('home'); // home, fuel, profile, genesis
  // 🟢 恢复为正常的资金状态，体验完整的顺畅转账流程
 const [bUnits, setBUnits] = useState(852);
 const [usdcBalance, setUsdcBalance] = useState(182.24);
  const [autoRefuel, setAutoRefuel] = useState(true);
  // Genesis Node States
 const isGenesisNode = true;
 const [yieldAvailable, setYieldAvailable] = useState(45.28);
 const [isClaiming, setIsClaiming] = useState(false);
 const [showClaimSuccess, setShowClaimSuccess] = useState(false);


 // Refuel UI States
 const [refuelAmount, setRefuelAmount] = useState(5);
 const [isRefueling, setIsRefueling] = useState(false);
 const [showRefuelSuccess, setShowRefuelSuccess] = useState(false);
  // Send Workflow States
 const [sendModalOpen, setSendModalOpen] = useState(false);
 const [sendStep, setSendStep] = useState('input'); // input, confirm, processing, success
 const [sendRecipient, setSendRecipient] = useState<Contact | null>(null);
 const [sendAmount, setSendAmount] = useState('');
 const [sendSearchQuery, setSendSearchQuery] = useState('');


 // Fee Calculator States
 const [calcAmount, setCalcAmount] = useState(100);


 // Ledger Detail Modal State
 const [selectedLog, setSelectedLog] = useState<BUnitsLog | null>(null);


 // --- Dynamic Ledgers (Stateful for syncing) ---
 const [usdcLedger, setUsdcLedger] = useState([
   { id: 'u1', name: "Payment Received", tag: "Paid by @Beamiot...", val: "+ 1.37 CAD", sub: "1.23 USDC", icon: <QrCode size={18} />, color: "text-green-500", type: "receive" },
   { id: 'u2', name: "Sent to @Simon", tag: "1.00 USD", val: "- 1.0000 USDC", sub: "1.00 USDC", icon: <ArrowUpRight size={18} />, color: "text-slate-900", type: "send" }
 ]);


 const [bUnitsLedger, setBUnitsLedger] = useState([
   { id: "LOG-892A", title: "Service Fee (0.8%)", subtitle: "Payment Request #892", amount: -80, time: "Feb 21, 14:22", type: "fee", status: "Completed", linkedUsdc: "100.00 USDC", txHash: "0x8f2a...4b1c", network: "Base Mainnet" },
   { id: "LOG-891B", title: "Network Gas", subtitle: "P2P Send to @Simon", amount: -2, time: "2h ago", type: "gas", status: "Completed", linkedUsdc: "1.00 USDC", txHash: "0x1c9d...9e2f", network: "Base Mainnet" },
   { id: "LOG-890C", title: "Manual Refuel Gain", subtitle: "Swap $5.00 USDC", amount: 498, time: "5h ago", type: "refuel", status: "Completed", linkedUsdc: "-5.00 USDC", txHash: "0x4a1b...2c3d", network: "Base Mainnet" },
   { id: "LOG-889D", title: "Reward Backfill", subtitle: "CashTree Card Claim #102", amount: 100, time: "Yesterday", type: "reward", status: "Completed", linkedUsdc: "N/A", txHash: "0x9e8f...1a2b", network: "CoNET L1" }
 ]);


 // --- Mock Data ---
 const mockContacts = [
   { id: 'c1', name: 'Jimmy Z', tag: '@Beamiotest_iphone', followers: 2, wallet: '0xd5b0...9ea3', avatarColor: 'bg-teal-100' },
   { id: 'c2', name: 'Simon', tag: '@Simon', followers: 12, wallet: '0x1a2b...3c4d', avatarColor: 'bg-orange-100' }
 ];


 const mockYieldLedger = [
   { title: "Protocol Share (Burn)", subtitle: "From 12,450 Network Txns", amount: "+4.25", asset: "USDC", time: "1h ago", icon: <Zap size={16} className="text-amber-400" /> },
   { title: "Protocol Share (Burn)", subtitle: "From 3,820 Network Txns", amount: "+1.12", asset: "USDC", time: "4h ago", icon: <Zap size={16} className="text-amber-400" /> },
   { title: "Yield Claimed", subtitle: "To Main Wallet", amount: "-120.00", asset: "USDC", time: "Feb 20", icon: <ArrowRightLeft size={16} className="text-slate-400" /> }
 ];


 // --- Logic Calculations ---
 const fuelStatus = useMemo(() => {
   if (bUnits > 50) return { label: 'Optimal', color: 'text-green-500', bar: 'bg-green-500', width: '85%' };
   if (bUnits >= 10) return { label: 'Warning', color: 'text-amber-500', bar: 'bg-amber-500', width: '30%' };
   if (bUnits >= 0) return { label: 'Critical', color: 'text-red-500', bar: 'bg-red-500', width: '5%' };
   return { label: 'Overdraft', color: 'text-purple-600', bar: 'bg-purple-600', width: '0%' };
 }, [bUnits]);


 // --- Handlers ---
 const handleRefuel = () => {
   if (usdcBalance < refuelAmount || bUnits < REFUEL_GAS_COST) return;
   setIsRefueling(true);
   setTimeout(() => {
     setUsdcBalance(prev => prev - refuelAmount);
     setBUnits(prev => prev + (refuelAmount * 100) - REFUEL_GAS_COST);
    
     // Update B-Units Ledger
     setBUnitsLedger([{
       id: `LOG-${Math.floor(Math.random()*10000)}`,
       title: "Manual Refuel Gain", subtitle: `Swap $${refuelAmount.toFixed(2)} USDC`,
       amount: (refuelAmount * 100) - REFUEL_GAS_COST, time: "Just now", type: "refuel", status: "Completed",
       linkedUsdc: `-${refuelAmount.toFixed(2)} USDC`, txHash: "0x" + Math.random().toString(16).substr(2, 8), network: "Base Mainnet"
     }, ...bUnitsLedger]);


     setIsRefueling(false);
     setShowRefuelSuccess(true);
     setTimeout(() => setShowRefuelSuccess(false), 3000);
   }, 1200);
 };


 const handleClaimYield = () => {
   if (yieldAvailable <= 0) return;
   setIsClaiming(true);
   setTimeout(() => {
     setUsdcBalance(prev => prev + yieldAvailable);
     setYieldAvailable(0);
     setIsClaiming(false);
     setShowClaimSuccess(true);
     setTimeout(() => setShowClaimSuccess(false), 3000);
   }, 1500);
 };


 const estimatedServiceFee = useMemo(() => {
   const rawFee = Math.ceil(calcAmount * 0.8);
   return Math.min(Math.max(rawFee, MIN_SERVICE_FEE), MAX_SERVICE_FEE);
 }, [calcAmount]);


 // --- 🌟 Send Workflow Execution (The Dual-Ledger Magic) 🌟 ---
 const executeSend = () => {
   if (!sendRecipient) return;
   setSendStep('processing');
  
   // Simulate Blockchain & Facilitator latency
   setTimeout(() => {
     const amountNum = parseFloat(sendAmount);
    
     // 1. Deduct Balances (USDC Principle + 2 B-Units Network Gas)
     setUsdcBalance(prev => prev - amountNum);
     setBUnits(prev => prev - P2P_GAS_COST);


     // 2. Sync to Home USDC Ledger (Fiat Ledger)
     setUsdcLedger([{
       id: `u-${Date.now()}`,
       name: `Sent to ${sendRecipient.name}`,
       tag: sendRecipient.tag,
       val: `- ${amountNum.toFixed(4)} USDC`,
       sub: `${amountNum.toFixed(2)} USDC`,
       icon: <ArrowUpRight size={18} />,
       color: "text-slate-900",
       type: "send"
     }, ...usdcLedger]);


     // 3. Sync to B-Units Ledger (Shadow Gas Ledger)
     setBUnitsLedger([{
       id: `LOG-S${Math.floor(Math.random()*1000)}`,
       title: "Network Gas",
       subtitle: `P2P Send to ${sendRecipient.tag}`,
       amount: -P2P_GAS_COST,
       time: "Just now",
       type: "gas",
       status: "Completed",
       linkedUsdc: `${amountNum.toFixed(2)} USDC`,
       txHash: "0x" + Math.random().toString(16).substr(2, 8) + "..." + Math.random().toString(16).substr(2, 4),
       network: "Base Mainnet"
     }, ...bUnitsLedger]);


     // 4. Move to Success Screen
     setSendStep('success');
   }, 1800);
 };


 const openSendModal = () => {
   setSendStep('input');
   setSendAmount('');
   setSendRecipient(null);
   setSendSearchQuery('');
   setSendModalOpen(true);
 };


 // --- Views ---


 const HomeView = () => (
   <div className="animate-in fade-in duration-500 flex flex-col min-h-screen pb-32 bg-[#f4f5f9]">
     <div className="px-6 pt-10">
       <div onClick={() => setCurrentView('profile')} className="inline-flex bg-white rounded-full pl-1.5 pr-4 py-1.5 items-center gap-2 shadow-[0_4px_14px_rgba(0,0,0,0.05)] cursor-pointer active:scale-95 transition-all border border-slate-100/50">
         <div className="w-8 h-8 rounded-full bg-[#1da1f2] flex items-center justify-center text-white overflow-hidden relative">
           <div className="w-1.5 h-1.5 bg-blue-900 rounded-full absolute top-2.5 left-2"></div>
           <div className="w-1.5 h-1.5 bg-blue-900 rounded-full absolute top-2.5 right-2"></div>
           <div className="w-3 h-1.5 border-t-2 border-blue-900 rounded-t-full absolute bottom-2"></div>
         </div>
         <div className="flex flex-col justify-center">
           <p className="text-[9px] text-slate-500 font-bold leading-tight uppercase tracking-wider">Voucher</p>
           <p className="text-[13px] font-black text-slate-900 leading-tight">@Beamiovoucher</p>
         </div>
       </div>
     </div>


     <div className="mt-8 px-6 text-center space-y-4">
       <div onClick={() => setCurrentView('fuel')} className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] cursor-pointer hover:shadow-md transition-all active:scale-95 border border-slate-100/50">
         <Zap size={14} className="text-amber-400" fill="currentColor" />
         <span className="text-[11px] font-black text-slate-600">Beamio Sponsored Gas</span>
       </div>
       <div className="space-y-1">
         <p className="text-sm font-bold text-slate-400">Total Valuation (USDC)</p>
         <div className="flex items-baseline justify-center gap-1">
           <span className="text-3xl font-black text-slate-800">$</span>
           <span className="text-[4rem] font-black text-slate-900 tracking-tighter leading-none">{usdcBalance.toFixed(0)}</span>
           <span className="text-3xl font-black text-slate-400">.{(usdcBalance % 1).toFixed(2).substring(2)}</span>
         </div>
       </div>
       <div className="grid grid-cols-2 gap-4 mt-8 h-40">
        
         {/* SEND ACTION CARD */}
         <div
           onClick={openSendModal}
           className="bg-gradient-to-br from-[#3b7ef5] to-[#1562f0] rounded-[2rem] p-5 text-white flex flex-col justify-between shadow-2xl shadow-blue-200/50 active:scale-95 transition-all cursor-pointer group"
         >
           <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition-colors">
             <ArrowUpRight size={22} strokeWidth={2.5} />
           </div>
           <div className="text-left">
             <p className="text-[17px] font-black leading-tight">Send</p>
             <p className="text-[10px] font-medium opacity-80 mt-0.5 tracking-wide">0 Gas USDC</p>
           </div>
         </div>


         <div className="flex flex-col gap-4">
           <div className="flex-1 bg-white rounded-[1.8rem] px-5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.03)] active:scale-95 transition-all cursor-pointer hover:border-blue-100 border border-transparent">
             <div className="flex items-center gap-3">
               <ArrowDownLeft size={22} className="text-green-500" strokeWidth={2.5} />
               <span className="font-black text-[15px] text-slate-800">Receive</span>
             </div>
           </div>
           <div className="flex-1 bg-white rounded-[1.8rem] px-5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.03)] active:scale-95 transition-all cursor-pointer hover:border-blue-100 border border-transparent">
             <div className="flex items-center gap-3">
               <Plus size={22} className="text-slate-400" strokeWidth={2.5} />
               <span className="font-black text-[15px] text-slate-800">Add Cash</span>
             </div>
           </div>
         </div>
       </div>
     </div>


     <div className="mt-10 px-6 space-y-4">
       <div className="flex justify-between items-center">
         <h3 className="text-[19px] font-black text-slate-900 tracking-tight">Recent Activity</h3>
         <button className="text-[13px] font-bold text-[#1562f0] flex items-center gap-0.5">
           View all <ChevronRight size={16} />
         </button>
       </div>
       <div className="space-y-3">
         {usdcLedger.map((tx) => (
           <div key={tx.id} className="bg-white p-4 rounded-[1.5rem] flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-50/50">
             <div className="flex items-center gap-4">
               <div className={`w-10 h-10 ${tx.type === 'receive' ? 'bg-green-50 text-green-600' : 'bg-[#f4f5f9] text-slate-800'} rounded-xl flex items-center justify-center`}>
                 {tx.icon}
               </div>
               <div>
                 <p className="text-[14px] font-black text-slate-900">{tx.name}</p>
                 <p className="text-[11px] font-medium text-slate-400 mt-0.5">{tx.tag}</p>
               </div>
             </div>
             <div className="text-right">
               <p className={`text-[14px] font-black ${tx.color}`}>{tx.val}</p>
               <p className="text-[11px] font-medium text-slate-400 mt-0.5">{tx.sub}</p>
             </div>
           </div>
         ))}
       </div>
     </div>
   </div>
 );


 const FuelView = () => (
   <div className="animate-in slide-in-from-right duration-500 flex flex-col min-h-screen pb-32 bg-[#fdfdff]">
     <div className="px-6 pt-10 flex items-center gap-4">
       <button onClick={() => setCurrentView('home')} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors">
         <ChevronRight size={22} className="rotate-180" />
       </button>
       <h2 className="text-2xl font-black text-slate-800 tracking-tight">Fuel Center</h2>
     </div>


     <div className="px-6 pt-8 space-y-6">
       <div className="bg-white rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-50 relative overflow-hidden group">
         <div className="flex justify-between items-center mb-1">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Fuel Balance</p>
           <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${fuelStatus.bar} bg-opacity-10 ${fuelStatus.color}`}>
             {fuelStatus.label}
           </div>
         </div>
         <div className="flex items-baseline justify-between">
           <div className="flex items-baseline gap-2">
             <span className={`text-[4.5rem] leading-none font-black tracking-tighter ${bUnits < 10 ? 'text-red-500' : 'text-[#1562f0]'}`}>{bUnits}</span>
             <span className="text-slate-300 font-bold text-xl uppercase italic">Units</span>
           </div>
         </div>
         <div className="mt-8 h-2 bg-slate-100 rounded-full overflow-hidden">
           <div style={{ width: fuelStatus.width }} className={`${fuelStatus.bar} h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(21,98,240,0.2)]`}></div>
         </div>
       </div>


       <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-50 space-y-6">
         <div className="flex justify-between items-center">
           <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select Amount</h3>
           <div className="bg-[#eef6ff] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
             <Coins size={14} className="text-[#1562f0]" />
             <span className="text-base font-black text-[#1562f0]">${refuelAmount}</span>
             <span className="text-[10px] text-blue-400 font-bold uppercase">USDC</span>
           </div>
         </div>


         <div className="flex items-center gap-4 px-1">
           <button onClick={() => setRefuelAmount(Math.max(1, refuelAmount-1))} className="w-12 h-12 rounded-[1rem] border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 active:scale-95 transition-all"><Minus size={20}/></button>
           <input type="range" min="1" max="100" step="1" value={refuelAmount} onChange={e=>setRefuelAmount(Number(e.target.value))} className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#1562f0]" />
           <button onClick={() => setRefuelAmount(refuelAmount+1)} className="w-12 h-12 rounded-[1rem] border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 active:scale-95 transition-all"><Plus size={20}/></button>
         </div>


         <div className="bg-[#f8f9fc] p-5 rounded-[1.5rem] space-y-3">
           <div className="flex justify-between text-[13px] font-bold">
             <span className="text-slate-400">Fuel Yield (1:100)</span>
             <span className="text-slate-800">+{refuelAmount * 100} Units</span>
           </div>
           <div className="flex justify-between text-[13px] font-bold">
             <span className="text-slate-400 tracking-tight">Refuel Fee (Shadow Gas)</span>
             <span className="text-red-400">-{REFUEL_GAS_COST} Units</span>
           </div>
           <div className="border-t border-slate-200 pt-3 flex justify-between items-center mt-1">
             <span className="text-[14px] font-black text-slate-800">Net Deposit</span>
             <span className="text-[22px] font-black text-[#1562f0] leading-none">+{refuelAmount * 100 - REFUEL_GAS_COST} <span className="text-[10px] font-bold opacity-60 uppercase">Units</span></span>
           </div>
         </div>


         <button
           onClick={handleRefuel}
           disabled={isRefueling}
           className="w-full bg-[#1562f0] py-4 rounded-[1.2rem] text-white font-black text-[15px] shadow-[0_8px_20px_rgba(21,98,240,0.3)] active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center justify-center gap-2"
         >
           {isRefueling ? <RefreshCw size={20} className="animate-spin" /> : <><Zap size={18} fill="currentColor" /> Refuel Now</>}
         </button>
       </div>


       <div className="space-y-4">
         <div className="flex justify-between items-center px-2">
           <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-widest">B-Units Ledger</h3>
           <button className="text-[11px] font-bold text-[#1562f0] flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
             <Filter size={12} /> Filter
           </button>
         </div>
         <div className="bg-white rounded-[2rem] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-50 divide-y divide-slate-50">
           {bUnitsLedger.map((log, idx) => (
             <div
               key={log.id}
               onClick={() => setSelectedLog(log)}
               className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group"
             >
               <div className="flex items-center gap-4">
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                   log.amount < 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                 }`}>
                   {log.type === 'refuel' ? <Plus size={18} strokeWidth={3} /> : <Zap size={16} fill="currentColor" />}
                 </div>
                 <div>
                   <p className="text-[14px] font-black text-slate-800 leading-tight">{log.title}</p>
                   <p className="text-[11px] font-medium text-slate-400 mt-0.5">{log.subtitle}</p>
                 </div>
               </div>
               <div className="text-right flex items-center gap-2">
                 <div>
                   <p className={`text-[15px] font-black ${log.amount < 0 ? 'text-slate-900' : 'text-green-500'}`}>
                     {log.amount > 0 ? '+' : ''}{log.amount}
                   </p>
                   <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">Units</p>
                 </div>
                 <ChevronRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity -mr-1" />
               </div>
             </div>
           ))}
         </div>
       </div>
     </div>
   </div>
 );


 const ProfileView = () => (
   <div className="animate-in slide-in-from-bottom duration-500 flex flex-col min-h-screen bg-[#f4f5f9]">
     <div className="bg-[#1562f0] pt-14 pb-16 px-6 text-center relative">
       <button onClick={() => setCurrentView('home')} className="absolute top-14 left-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur-sm hover:bg-white/20 transition-colors">
         <ChevronRight size={22} className="rotate-180" />
       </button>
      
       <div className="w-24 h-24 rounded-full bg-[#1da1f2] mx-auto mb-4 flex items-center justify-center relative shadow-lg">
          <div className="w-2.5 h-2.5 bg-blue-900 rounded-full absolute top-7 left-6"></div>
          <div className="w-2.5 h-2.5 bg-blue-900 rounded-full absolute top-7 right-6"></div>
          <div className="w-8 h-2.5 border-t-4 border-blue-900 rounded-t-full absolute bottom-6"></div>
       </div>


       <div className="flex items-center justify-center gap-2">
         <h2 className="text-[22px] font-black text-white tracking-tight">@Beamiovoucher</h2>
         <Copy size={16} className="text-white/80 cursor-pointer hover:text-white" />
       </div>
     </div>


     <div className="px-6 -mt-6 relative z-10 space-y-4 pb-32">
       {isGenesisNode && (
         <div onClick={() => setCurrentView('genesis')} className="bg-slate-900 rounded-[1.8rem] p-6 shadow-2xl flex justify-between items-center group cursor-pointer active:scale-[0.98] transition-all border border-slate-700/50 relative overflow-hidden">
           <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none"></div>
           <div className="relative z-10 flex items-center gap-4">
             <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-slate-900 shadow-lg">
               <Cpu size={24} strokeWidth={2.5} />
             </div>
             <div>
               <div className="flex items-center gap-2">
                 <h3 className="text-[17px] font-black text-white tracking-tight">Genesis Portal</h3>
                 <div className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 uppercase font-black tracking-widest">VIP</div>
               </div>
               <p className="text-[12px] font-medium text-slate-400 mt-0.5">Node #042 Yield Dashboard</p>
             </div>
           </div>
           <ChevronRight size={20} className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all relative z-10" />
         </div>
       )}


       <div className="pt-2">
           <div onClick={() => setCurrentView('fuel')} className="bg-white rounded-[1.8rem] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex justify-between items-center group cursor-pointer hover:border-blue-100 border border-transparent transition-all active:scale-95">
               <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-[#1562f0] rounded-xl flex items-center justify-center text-white"><Zap size={20} fill="currentColor"/></div>
               <div>
                   <span className="text-[15px] font-black text-slate-900">Network Fuel (B-Units)</span>
                   <p className="text-[11px] text-[#1562f0] font-bold mt-0.5 tracking-tight">{bUnits} Units Available</p>
               </div>
               </div>
               <ChevronRight size={18} className="text-[#1562f0] group-hover:translate-x-1 transition-transform" />
           </div>
       </div>
     </div>
   </div>
 );


 const GenesisView = () => (
   <div className="animate-in slide-in-from-bottom duration-500 flex flex-col min-h-screen pb-32 bg-[#0b0f19] text-slate-200">
     <div className="px-6 pt-10 pb-6 flex items-center justify-between sticky top-0 bg-[#0b0f19]/80 backdrop-blur-xl z-20 border-b border-white/5">
       <button onClick={() => setCurrentView('profile')} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors">
         <ChevronRight size={22} className="rotate-180" />
       </button>
       <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
         <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
         <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Node #042 Active</span>
       </div>
     </div>


     <div className="px-6 pt-4 space-y-6">
       <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-[2.5rem] p-8 border border-slate-700/50 relative overflow-hidden shadow-2xl">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-500/10 blur-[3rem] rounded-full pointer-events-none"></div>
         <div className="relative z-10">
           <div className="flex items-center justify-between mb-2">
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Available Protocol Yield</p>
             <BarChart3 size={16} className="text-slate-500" />
           </div>
           <div className="flex items-baseline gap-2 mb-8">
             <span className="text-3xl font-black text-white">$</span>
             <span className="text-[4rem] leading-none font-black text-white tracking-tighter">{yieldAvailable.toFixed(2)}</span>
             <span className="text-xl font-bold text-slate-400 uppercase">USDC</span>
           </div>
           <button
             onClick={handleClaimYield} disabled={isClaiming || yieldAvailable <= 0}
             className="w-full bg-amber-500 hover:bg-amber-400 py-4 rounded-[1.2rem] text-slate-900 font-black text-[15px] shadow-[0_8px_20px_rgba(245,158,11,0.2)] active:scale-[0.98] disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none transition-all flex items-center justify-center gap-2"
           >
             {isClaiming ? <RefreshCw size={20} className="animate-spin" /> : <><ArrowDownLeft size={20} strokeWidth={3} /> Claim to Main Wallet</>}
           </button>
         </div>
       </div>


       <div className="space-y-4 pt-4">
         <div className="flex justify-between items-center px-2">
           <h3 className="text-[13px] font-black text-white uppercase tracking-widest">Yield History</h3>
         </div>
         <div className="bg-white/5 rounded-[2rem] overflow-hidden border border-white/5 divide-y divide-white/5">
           {mockYieldLedger.map((log, idx) => (
             <div key={idx} className="p-5 flex items-center justify-between hover:bg-white/5 transition-colors">
               <div className="flex items-center gap-4">
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${log.amount.startsWith('-') ? 'bg-slate-800 text-slate-400' : 'bg-amber-500/10 text-amber-500'}`}>
                   {log.icon}
                 </div>
                 <div>
                   <p className="text-[14px] font-black text-slate-200 leading-tight">{log.title}</p>
                   <p className="text-[11px] font-medium text-slate-500 mt-0.5">{log.subtitle} • {log.time}</p>
                 </div>
               </div>
               <div className="text-right">
                 <p className={`text-[15px] font-black ${log.amount.startsWith('-') ? 'text-slate-300' : 'text-amber-400'}`}>{log.amount}</p>
                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{log.asset}</p>
               </div>
             </div>
           ))}
         </div>
       </div>
     </div>
   </div>
 );


 return (
   <div className="flex flex-col min-h-screen bg-[#FDFDFF] text-slate-900 max-w-md mx-auto shadow-2xl relative overflow-hidden">
    
     <div className="flex-1 overflow-y-auto">
       {currentView === 'home' && <HomeView />}
       {currentView === 'fuel' && <FuelView />}
       {currentView === 'profile' && <ProfileView />}
       {currentView === 'genesis' && <GenesisView />}
     </div>


     {/* --- MODALS OVERLAYS --- */}


     {/* 1. Send Workflow Modal (Bottom Sheet) */}
     {sendModalOpen && (
       <div className="fixed inset-0 z-[70] flex items-end justify-center pointer-events-auto max-w-md mx-auto">
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => {if(sendStep==='input') setSendModalOpen(false)}}></div>
        
         <div className={`bg-white w-full rounded-t-[2.5rem] ${sendStep === 'success' ? 'h-auto pb-12' : 'h-[88vh]'} p-6 relative z-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl flex flex-col`}>
           {sendStep !== 'success' && <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full"></div>}
          
           {(sendStep === 'input' || sendStep === 'confirm') && (
             <button onClick={() => {
               if(sendStep === 'confirm') setSendStep('input');
               else setSendModalOpen(false);
             }} className="absolute top-6 right-6 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
               <X size={18} />
             </button>
           )}


           {/* STEP 1: INPUT */}
           {sendStep === 'input' && (
             <div className="flex flex-col h-full pt-8 animate-in fade-in zoom-in-95 duration-300">
               {/* Search Bar */}
               <div className="relative mb-6">
                 <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                   type="text"
                   placeholder="@BeamioTag, address, or paste link"
                   value={sendSearchQuery}
                   onChange={(e) => setSendSearchQuery(e.target.value)}
                   className="w-full bg-slate-100 rounded-2xl py-4 pl-12 pr-4 outline-none font-medium text-[15px] focus:ring-2 focus:ring-blue-500/20 transition-all"
                 />
               </div>


               {/* Contacts or Recipient Selected */}
               {!sendRecipient ? (
                 <div className="flex gap-4 mb-8 px-2 overflow-x-auto pb-2 hide-scrollbar">
                   {mockContacts.map(c => (
                     <div key={c.id} onClick={() => setSendRecipient(c)} className="flex flex-col items-center gap-2 cursor-pointer group shrink-0">
                       <div className={`w-14 h-14 ${c.avatarColor} rounded-full flex items-center justify-center text-xl shadow-sm group-active:scale-95 transition-transform border-2 border-transparent group-hover:border-blue-500`}>
                         😎
                       </div>
                       <span className="text-[11px] font-bold text-slate-600">{c.tag}</span>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="flex flex-col items-center mb-8 animate-in slide-in-from-top-4 duration-300">
                    <div className={`w-16 h-16 ${sendRecipient.avatarColor} rounded-full flex items-center justify-center text-2xl shadow-md mb-2`}>
                       😎
                    </div>
                    <h3 className="text-lg font-black text-[#1562f0]">{sendRecipient.tag}</h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{sendRecipient.wallet}</p>
                 </div>
               )}


               {/* Amount Input */}
               <div className={`flex flex-col items-center justify-center flex-1 transition-opacity ${sendRecipient ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-slate-800">$</span>
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={!sendRecipient}
                      className="text-[4rem] font-black text-slate-900 w-full text-center outline-none bg-transparent placeholder:text-slate-200 leading-none tracking-tighter"
                    />
                  </div>
                  <p className="text-[13px] font-bold text-slate-400 mt-2 tracking-wide uppercase">USDC</p>
               </div>


               {/* Paying From Card */}
               <div className="mt-auto mb-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-600">
                       <WalletIcon size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paying From</p>
                      <p className="text-[14px] font-black text-slate-800">Main Vault</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-black text-slate-800">CA$ {(usdcBalance * 1.35).toFixed(2)}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">≈ {usdcBalance.toFixed(4)} USDC</p>
                  </div>
               </div>


               <button
                 onClick={() => setSendStep('confirm')}
                 disabled={!sendRecipient || !sendAmount || parseFloat(sendAmount) <= 0 || parseFloat(sendAmount) > usdcBalance}
                 className="w-full bg-[#1562f0] py-4 rounded-[1.2rem] text-white font-black text-[17px] shadow-[0_8px_20px_rgba(21,98,240,0.3)] active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none transition-all"
               >
                 Review
               </button>
             </div>
           )}


           {/* STEP 2: CONFIRMATION & B-UNITS GUARD */}
           {sendStep === 'confirm' && sendRecipient && (
             <div className="flex flex-col h-full pt-10 animate-in slide-in-from-right duration-300">
               <div className="text-center mb-10">
                  <div className={`w-20 h-20 mx-auto ${sendRecipient.avatarColor} rounded-full flex items-center justify-center text-3xl shadow-lg mb-4`}>😎</div>
                  <h3 className="text-xl font-black text-[#1562f0]">{sendRecipient.tag}</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">{sendRecipient.wallet}</p>
               </div>


               <div className="bg-[#f8f9fc] rounded-[1.5rem] p-6 space-y-4 border border-slate-100 mb-6">
                 <div className="flex justify-between items-end pb-4 border-b border-dashed border-slate-200">
                   <div>
                     <p className="text-[15px] font-black text-slate-900">Total</p>
                     <p className="text-[11px] font-medium text-slate-400 mt-0.5">Amount to send</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[22px] font-black text-slate-900 leading-none">{parseFloat(sendAmount).toFixed(4)} <span className="text-[13px] text-slate-400 uppercase">USDC</span></p>
                     <p className="text-[11px] font-bold text-slate-400 mt-1">≈ CA$ {(parseFloat(sendAmount)*1.35).toFixed(2)}</p>
                   </div>
                 </div>


                 {/* B-UNITS NETWORK GAS UI */}
                 <div className="flex justify-between items-center pt-2">
                   <div>
                     <p className="text-[13px] font-bold text-slate-800">Network Gas</p>
                     <p className="text-[10px] text-slate-400 mt-0.5">Base L2 Operation</p>
                   </div>
                  
                   <div className="flex flex-col items-end">
                     <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                       <Zap size={14} className="text-[#1562f0]" fill="currentColor" />
                       <span className="text-[13px] font-black text-[#1562f0]">{P2P_GAS_COST} Units</span>
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium mt-1">From B-Units Ledger</p>
                   </div>
                 </div>
               </div>


               {/* INSUFFICIENT B-UNITS GUARD */}
               {bUnits < P2P_GAS_COST && (
                 <div className="mb-6 bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                   <div className="flex items-center gap-2 text-red-600 mb-1.5">
                     <ShieldAlert size={16} strokeWidth={2.5} />
                     <span className="font-black text-[13px]">Insufficient Network Fuel</span>
                   </div>
                   <p className="text-[12px] text-red-500 font-medium leading-relaxed">
                     You need <span className="font-bold">{P2P_GAS_COST} B-Units</span> to process this transaction on-chain. Your current balance is {bUnits}.
                   </p>
                 </div>
               )}


               <div className="mt-auto">
                 {bUnits >= P2P_GAS_COST ? (
                   <button
                     onClick={executeSend}
                     className="w-full bg-[#1562f0] py-4 rounded-[1.2rem] text-white font-black text-[17px] shadow-[0_8px_20px_rgba(21,98,240,0.3)] active:scale-[0.98] transition-all"
                   >
                     Confirm & Send
                   </button>
                 ) : (
                   <button
                     onClick={() => { setSendModalOpen(false); setCurrentView('fuel'); }}
                     className="w-full bg-slate-900 py-4 rounded-[1.2rem] text-white font-black text-[17px] shadow-[0_8px_20px_rgba(15,23,42,0.3)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                   >
                     <Zap size={18} fill="currentColor" /> Refuel B-Units
                   </button>
                 )}
               </div>
             </div>
           )}


           {/* STEP 3: PROCESSING */}
           {sendStep === 'processing' && (
             <div className="flex flex-col items-center justify-center h-full animate-in fade-in duration-300">
               <div className="w-16 h-16 relative">
                  <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-[#1562f0] rounded-full border-t-transparent animate-spin"></div>
               </div>
               <h3 className="text-lg font-black text-slate-900 mt-6">Processing on Base L2...</h3>
               <p className="text-[12px] text-slate-400 font-medium mt-2">Deducting USDC and B-Units</p>
             </div>
           )}


           {/* STEP 4: SUCCESS */}
           {sendStep === 'success' && (
             <div className="flex flex-col items-center justify-center pt-10 pb-4 animate-in zoom-in-95 duration-500">
               <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(34,197,94,0.4)] mb-6">
                 <CheckCircle2 size={40} strokeWidth={3} />
               </div>
               <h3 className="text-[15px] font-bold text-slate-500">Successfully sent</h3>
               <p className="text-[32px] font-black text-slate-900 tracking-tighter mt-1">{parseFloat(sendAmount).toFixed(4)} USDC</p>
               <p className="text-[11px] font-medium text-slate-400 mt-2">Transaction is finalized on-chain.</p>
              
               <div className="w-full space-y-3 mt-10">
                 <button
                   onClick={() => setSendModalOpen(false)}
                   className="w-full bg-[#1562f0] py-4 rounded-[1.2rem] text-white font-black text-[15px] active:scale-[0.98] transition-all"
                 >
                   Done
                 </button>
                 <button className="w-full bg-white border-2 border-slate-100 py-3.5 rounded-[1.2rem] text-slate-600 font-black text-[15px] hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                   <ExternalLink size={18} /> View transaction
                 </button>
               </div>
             </div>
           )}
         </div>
       </div>
     )}


     {/* 2. Detail Receipt Modal (Bottom Sheet for Ledger) */}
     {selectedLog && (
       <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-auto max-w-md mx-auto">
         <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedLog(null)}></div>
        
         <div className="bg-white w-full rounded-t-[2.5rem] p-8 relative z-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
           <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full"></div>
          
           <button onClick={() => setSelectedLog(null)} className="absolute top-6 right-6 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
             <X size={18} />
           </button>


           <div className="text-center mt-4 space-y-2">
             <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-md mb-4 ${selectedLog.amount < 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
               {selectedLog.type === 'refuel' ? <Plus size={28} strokeWidth={3} /> : <Zap size={28} fill="currentColor" />}
             </div>
             <h3 className="text-[22px] font-black text-slate-900">{selectedLog.title}</h3>
             <p className="text-[13px] font-bold text-slate-400">{selectedLog.subtitle}</p>
             <div className="pt-2">
               <span className={`text-[32px] font-black tracking-tighter ${selectedLog.amount < 0 ? 'text-slate-900' : 'text-green-500'}`}>
                 {selectedLog.amount > 0 ? '+' : ''}{selectedLog.amount}
               </span>
               <span className="text-[14px] font-bold text-slate-400 ml-1">Units</span>
             </div>
           </div>


           <div className="mt-8 bg-[#f8f9fc] rounded-[1.5rem] p-5 space-y-4 border border-slate-100">
             <div className="flex justify-between items-center">
               <span className="text-[13px] font-bold text-slate-500">Status</span>
               <div className="flex items-center gap-1.5 bg-green-100 px-2 py-1 rounded-md text-green-700">
                 <CheckCircle2 size={12} strokeWidth={3} />
                 <span className="text-[11px] font-black uppercase tracking-wider">{selectedLog.status}</span>
               </div>
             </div>
             <div className="h-[1px] w-full border-t border-dashed border-slate-200"></div>
             <div className="flex justify-between items-center">
               <span className="text-[13px] font-bold text-slate-500">Time</span>
               <span className="text-[13px] font-black text-slate-900">{selectedLog.time}</span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-[13px] font-bold text-slate-500">Linked USDC</span>
               <span className="text-[13px] font-black text-[#1562f0]">{selectedLog.linkedUsdc}</span>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-[13px] font-bold text-slate-500">Network</span>
               <span className="text-[13px] font-black text-slate-900">{selectedLog.network}</span>
             </div>
             <div className="h-[1px] w-full border-t border-dashed border-slate-200"></div>
             <div className="flex justify-between items-center">
               <span className="text-[13px] font-bold text-slate-500">TxHash</span>
               <div className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity">
                 <span className="text-[13px] font-mono font-bold text-slate-900">{selectedLog.txHash}</span>
                 <Copy size={14} className="text-slate-400" />
               </div>
             </div>
           </div>
         </div>
       </div>
     )}


     {/* Success Modal for Refuel */}
     {showRefuelSuccess && (
       <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-[1.5rem] shadow-2xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
         <div className="bg-green-500 rounded-full p-1"><CheckCircle2 size={18} className="text-white" /></div>
         <div>
           <p className="text-[13px] font-black">Refuel Successful</p>
           <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">Synced +{refuelAmount * 100 - REFUEL_GAS_COST} Units</p>
         </div>
       </div>
     )}


     {/* Bottom Navigation */}
     {currentView !== 'genesis' && (
       <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto z-40 flex items-center justify-between pointer-events-none">
         <div className="bg-slate-800/95 backdrop-blur-xl rounded-[2rem] p-1.5 flex items-center gap-1 shadow-2xl pointer-events-auto">
           <button onClick={() => setCurrentView('home')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${currentView === 'home' ? 'bg-white text-[#1562f0] shadow-sm' : 'text-white/80 hover:text-white'}`}>
             <Home size={22} fill={currentView === 'home' ? "currentColor" : "none"} strokeWidth={currentView === 'home' ? 2 : 2.5} />
           </button>
           <button className="w-12 h-12 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all">
             <Wallet size={22} strokeWidth={2.5} />
           </button>
           <button className="w-12 h-12 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all">
             <ScanLine size={22} strokeWidth={2.5} />
           </button>
           <button className="w-12 h-12 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all">
             <MessageSquare size={22} strokeWidth={2.5} />
           </button>
           <button onClick={() => setCurrentView('profile')} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${currentView === 'profile' ? 'bg-white text-[#1562f0] shadow-sm' : 'text-white/80 hover:text-white'}`}>
             <Store size={22} fill={currentView === 'profile' ? "currentColor" : "none"} strokeWidth={currentView === 'profile' ? 2 : 2.5} />
           </button>
         </div>
         <button className="w-14 h-14 bg-slate-800/95 backdrop-blur-xl rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all pointer-events-auto">
           <Search size={22} strokeWidth={2.5} />
         </button>
       </div>
     )}


   </div>
 );
};


export default App;

