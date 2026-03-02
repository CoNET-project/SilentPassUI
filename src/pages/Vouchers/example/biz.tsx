import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useDaemonContext } from '@/providers/DaemonProvider';
import BeamioMeMainScreen from '@/components/Setting';
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
 Building2,
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
 MonitorSmartphone, // 新增：用于终端图标
 Plus,              // 新增：用于添加按钮
 Trash2,            // 新增：用于删除按钮
 Link as LinkIcon   // 新增：用于关联图标
} from 'lucide-react';

const getImg = (avatarSeed: string | undefined) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || '@Beamio')}`;

/** beamio 表示 name 的 protocol，与 Home displayName 一致 */
const displayName = (item: { firstName?: string; lastName?: string; accountName?: string } | null | undefined) => {
  if (!item) return ''
  const first = (item as { firstName?: string }).firstName ?? ''
  const lastRaw = (item as { lastName?: string }).lastName ?? ''
  const lastname = String(lastRaw || '').split('\r\n') || []
  const fullName = `${first || ''} ${/^\{/.test(lastname[0] || '') ? '' : lastname[0] || ''}`.trim()
  return fullName || (item as { accountName?: string }).accountName || ''
}

// --- Precise Mock Data reflecting the exact Discount & Source logic ---
// 更新：每条记录增加了 `terminal` 字段，用于追溯是哪台终端完成的收款
const MOCK_TRANSACTIONS = [
 {
   id: 'TX-1042', time: '14:22 PM', type: 'Charge', subtotal: 85.00, tip: 15.00, total: 100.00,
   method: 'Mixed', ctreeAmount: 40.00, usdcAmount: 60.00,
   source: 'APP', beamioTag: '@alice_chen', status: 'Settled', hash: '0x1a...f9', terminal: '@ut_reg1'
 },
 {
   id: 'TX-1043', time: '15:05 PM', type: 'In-Store Top-Up', subtotal: 100.00, tip: 0.00, total: 100.00,
   method: 'Issued $CTree', ctreeAmount: 100.00, usdcAmount: 0,
   source: 'NFC', beamioTag: null, status: 'Settled', hash: '0x2b...e4', terminal: '@ut_reg1'
 },
 {
   id: 'TX-1044', time: '16:10 PM', type: 'Charge', subtotal: 12.50, tip: 2.00, total: 14.50,
   method: '$CTree (Green Tier)', ctreeAmount: 14.50, usdcAmount: 0,
   source: 'NFC', beamioTag: null, status: 'Settled', hash: '0x3c...d1', terminal: '@ut_kiosk2'
 },
 {
   id: 'TX-1045', time: '16:45 PM', type: 'Charge', subtotal: 45.00, tip: 5.00, total: 50.00,
   method: 'USDC (No Discount)', ctreeAmount: 0, usdcAmount: 50.00,
   source: 'APP', beamioTag: '@bobby_s', status: 'Settled', hash: '0x4d...c2', terminal: '@ut_reg1'
 },
 {
   id: 'TX-1046', time: '17:30 PM', type: 'Charge', subtotal: 75.00, tip: 10.00, total: 85.00,
   method: '$CTree (Black Tier)', ctreeAmount: 85.00, usdcAmount: 0,
   source: 'APP', beamioTag: '@char_w', status: 'Settled', hash: '0x5e...b3', terminal: '@ut_kiosk2'
 },
];


// 新增：终端 Mock 数据
const INITIAL_TERMINALS = [
 { id: 'TM-001', tag: '@ut_reg1', name: 'Main Register 1', eoa: '0x1A2B...3C4D', status: 'Active', lastActive: '2 mins ago' },
 { id: 'TM-002', tag: '@ut_kiosk2', name: 'Self-Serve Kiosk', eoa: '0x9F8E...7D6C', status: 'Active', lastActive: '1 hr ago' },
];


export default function MerchantOS() {
 const { beamio } = useDaemonContext();
 const [currentView, setCurrentView] = useState('dashboard');
 const [activeTab, setActiveTab] = useState('Overview');
  const [merchantTag, setMerchantTag] = useState('@urbantea_van');
 const [password, setPassword] = useState('');
 const [loadingStep, setLoadingStep] = useState(0);


 const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
 const [payoutStep, setPayoutStep] = useState(1);
  // New state for sidebar toggle
 const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);


 // 新增：终端管理状态
 const [terminals, setTerminals] = useState(INITIAL_TERMINALS);
 const [isAddTerminalOpen, setIsAddTerminalOpen] = useState(false);
 const [newTerminalTag, setNewTerminalTag] = useState('');
 const [newTerminalEoa, setNewTerminalEoa] = useState('');


 // --- Financial Mock Data Logic ---
 const salesCTree = 1200.00;
 const salesUSDC = 645.50;
 const totalSales = salesCTree + salesUSDC;


 const tipsCTree = 200.00;
 const tipsUSDC = 142.00;
 const totalTips = tipsCTree + tipsUSDC;


 const topUpsIssued = 850.00;


 const totalCTreeReceived = salesCTree + tipsCTree;
 const netSettlementBalance = totalCTreeReceived - topUpsIssued;
 const totalUSDCBalance = salesUSDC + tipsUSDC;


 const today = new Date();
 const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


 const CashTreesLogo = () => (
   <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
     <rect width="100" height="100" fill="#000" />
     <path d="M50 20 V80 M25 45 L50 70 L75 45 M35 30 L50 45 L65 30" stroke="#10b981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
     <circle cx="50" cy="20" r="5" fill="#10b981"/>
     <circle cx="25" cy="45" r="5" fill="#10b981"/>
     <circle cx="75" cy="45" r="5" fill="#10b981"/>
     <circle cx="35" cy="30" r="4" fill="#10b981"/>
     <circle cx="65" cy="30" r="4" fill="#10b981"/>
   </svg>
 );


 const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
   e.preventDefault();
   setCurrentView('loading');
   setTimeout(() => setLoadingStep(1), 800); 
   setTimeout(() => setLoadingStep(2), 1600);
   setTimeout(() => setLoadingStep(3), 2400);
   setTimeout(() => setCurrentView('dashboard'), 3200);
 };


 const renderLogin = () => (
   <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 selection:bg-[#1562f0]/20">
     <div className="w-full max-w-md bg-white rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.05)] border border-slate-100 p-10 overflow-hidden relative">
       <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
       <div className="relative z-10 flex flex-col items-center">
         <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-slate-100 mb-6">
           <CashTreesLogo />
         </div>
         <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">Merchant OS</h1>
         <p className="text-[13px] font-medium text-slate-500 mb-8">Access your decentralized store wallet</p>


         <form onSubmit={handleLogin} className="w-full space-y-4">
           <div className="space-y-1.5">
             <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Beamio Tag</label>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                 <span className="text-slate-400 font-bold">@</span>
               </div>
               <input
                 type="text"
                 value={merchantTag.replace('@', '')}
                 onChange={(e) => setMerchantTag(`@${e.target.value}`)}
                 className="w-full pl-9 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-semibold text-[15px] text-slate-900"
                 required
               />
             </div>
           </div>


           <div className="space-y-1.5">
             <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recovery Password</label>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                 <KeyRound size={16} className="text-slate-400" />
               </div>
               <input
                 type="password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 placeholder="••••••••••••"
                 className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-medium text-[15px] tracking-widest text-slate-900"
                 required
               />
             </div>
           </div>


           <button
             type="submit"
             className="w-full bg-[#1562f0] text-white py-4 rounded-[20px] font-semibold text-[16px] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all mt-6 flex justify-center items-center gap-2"
           >
             <Wallet size={18} /> Unlock Wallet 111
           </button>
         </form>


         <div className="mt-8 flex items-center gap-2 text-[11px] font-bold text-slate-400">
           <ShieldCheck size={14} className="text-emerald-500" />
           <span>Local EOA Derivation • Zero-Knowledge Architecture</span>
         </div>
       </div>
     </div>
   </div>
 );


 const renderLoading = () => (
   <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
     <div className="w-full max-w-md bg-white rounded-[40px] shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center relative overflow-hidden">
       <div className="w-20 h-20 border-4 border-slate-100 border-t-[#1562f0] rounded-full animate-spin mb-8"></div>
       <div className="space-y-4 w-full">
         <div className={`flex items-center gap-3 transition-opacity duration-500 ${loadingStep >= 0 ? 'opacity-100' : 'opacity-30'}`}>
           <div className={`w-6 h-6 rounded-full flex items-center justify-center ${loadingStep > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
             <CheckCircle2 size={14} />
           </div>
           <span className="text-sm font-semibold text-slate-700">Deriving Local EOA via ZK-Proof...</span>
         </div>
         <div className={`flex items-center gap-3 transition-opacity duration-500 ${loadingStep >= 1 ? 'opacity-100' : 'opacity-30'}`}>
           <div className={`w-6 h-6 rounded-full flex items-center justify-center ${loadingStep > 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
             <CheckCircle2 size={14} />
           </div>
           <span className="text-sm font-semibold text-slate-700">Connecting Smart Account (AA)...</span>
         </div>
         <div className={`flex items-center gap-3 transition-opacity duration-500 ${loadingStep >= 2 ? 'opacity-100' : 'opacity-30'}`}>
           <div className={`w-6 h-6 rounded-full flex items-center justify-center ${loadingStep > 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
             <CheckCircle2 size={14} />
           </div>
           <span className="text-sm font-semibold text-slate-700">Syncing Ledger State...</span>
         </div>
       </div>
     </div>
   </div>
 );


 const NavItem = ({ icon: Icon, label, isActive, onClick, collapsed }: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  collapsed: boolean;
}) => (
   <button
     onClick={onClick}
     className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-2xl transition-all ${
       isActive
         ? 'bg-black text-white shadow-md'
         : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
     }`}
     title={collapsed ? label : undefined}
   >
     <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="shrink-0" />
     {!collapsed && <span className="font-semibold text-[15px] whitespace-nowrap">{label}</span>}
   </button>
 );


 const renderPayoutDrawer = () => {
   if (!isPayoutModalOpen) return null;


   const allianceFee = netSettlementBalance * 0.03;
   const finalBankAmount = netSettlementBalance - allianceFee;


   return (
     <div className="fixed inset-0 z-50 flex justify-end">
       <div
         className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
         onClick={() => isPayoutModalOpen && payoutStep !== 2 && setIsPayoutModalOpen(false)}
       />
      
       <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
         <div className="px-8 pt-8 pb-6 border-b border-slate-100 flex justify-between items-center bg-white">
           <h2 className="text-2xl font-bold tracking-tight text-black">CAD Settlement</h2>
           <button
             onClick={() => setIsPayoutModalOpen(false)}
             disabled={payoutStep === 2}
             className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-black transition-colors disabled:opacity-50"
           >
             <X size={20} />
           </button>
         </div>


         <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
           {payoutStep === 1 && (
             <div className="space-y-6 animate-in fade-in">
               <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
                 <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-2">Net Settlement Due</p>
                 <p className="text-5xl font-light text-black tracking-tighter mb-1">${netSettlementBalance.toFixed(2)}</p>
                 <p className="text-[14px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block mt-2">
                   CashTrees owes you CAD
                 </p>
               </div>


               <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden">
                 <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                   <Activity size={18} className="text-[#1562f0]" />
                   <span className="font-semibold text-[15px] text-black">Net Calculation ($CTree)</span>
                 </div>
                
                 <div className="p-6 space-y-4">
                   <div className="flex justify-between items-center">
                     <span className="text-[14px] text-slate-500 font-medium">$CTree Received (Sales & Tips)</span>
                     <span className="text-[15px] font-semibold text-black">+${totalCTreeReceived.toFixed(2)}</span>
                   </div>
                  
                   <div className="flex justify-between items-center">
                     <span className="text-[14px] text-slate-500 font-medium">$CTree Issued (In-Store Top-Ups)</span>
                     <span className="text-[15px] font-semibold text-rose-500">-${topUpsIssued.toFixed(2)}</span>
                   </div>
                  
                   <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-slate-400">
                     <span className="text-[14px] font-medium flex items-center gap-1.5">
                       Alliance Fee <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-500">3.0%</span>
                     </span>
                     <span className="text-[15px] font-semibold">-${allianceFee.toFixed(2)}</span>
                   </div>


                   <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                     <span className="text-[15px] font-bold text-black">Final Transfer to Bank</span>
                     <span className="text-[20px] font-bold text-[#1562f0]">${finalBankAmount.toFixed(2)}</span>
                   </div>
                 </div>
               </div>


               <div className="bg-blue-50 rounded-[20px] p-5 flex items-start gap-3 border border-blue-100">
                 <Landmark size={20} className="text-blue-600 mt-0.5" />
                 <div>
                   <p className="text-[14px] font-semibold text-blue-900">Fiat Bank Transfer</p>
                   <p className="text-[13px] text-blue-700/80 font-medium mt-1 leading-snug">
                     CashTrees will deposit CAD via EFT to your connected RBC account ending in *8821.
                   </p>
                 </div>
               </div>
             </div>
           )}


           {payoutStep === 2 && (
             <div className="h-full flex flex-col items-center justify-center animate-in fade-in">
               <div className="w-20 h-20 border-4 border-slate-100 border-t-[#1562f0] rounded-full animate-spin mb-6"></div>
               <h3 className="text-xl font-bold text-black mb-2">Initiating Settlement...</h3>
               <p className="text-[15px] text-slate-500 font-medium text-center">
                 Burning Net $CTree and<br/>notifying CashTrees Treasury.
               </p>
             </div>
           )}


           {payoutStep === 3 && (
             <div className="h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
               <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                 <CheckCircle2 size={48} className="text-emerald-600" strokeWidth={2.5} />
               </div>
               <h3 className="text-2xl font-bold text-black mb-2 tracking-tight">Settlement Requested</h3>
               <p className="text-[15px] text-slate-500 font-medium text-center mb-8">
                 ${finalBankAmount.toFixed(2)} CAD transfer has been queued by CashTrees.
               </p>
               <div className="bg-white border border-slate-200 rounded-[16px] p-4 w-full flex justify-between items-center shadow-sm">
                  <span className="text-[13px] text-slate-500 font-medium">Clearance Hash</span>
                  <span className="text-[13px] font-mono text-[#1562f0] font-semibold">0x8f2a...9c4b</span>
               </div>
             </div>
           )}
         </div>


         <div className="p-6 bg-white border-t border-slate-100">
           {payoutStep === 1 ? (
             <button
               onClick={() => {
                 setPayoutStep(2);
                 setTimeout(() => setPayoutStep(3), 2500);
               }}
               className="w-full bg-black text-white py-4 rounded-[16px] font-semibold text-[17px] active:scale-[0.98] transition-all shadow-md flex justify-center items-center gap-2"
             >
               Confirm & Request CAD
             </button>
           ) : payoutStep === 3 ? (
             <button
               onClick={() => {
                 setIsPayoutModalOpen(false);
                 setTimeout(() => { setPayoutStep(1); }, 300);
               }}
               className="w-full bg-black text-white py-4 rounded-[16px] font-semibold text-[17px] active:scale-[0.98] transition-all shadow-md"
             >
               Done
             </button>
           ) : null}
         </div>
       </div>
     </div>
   );
 };


 const renderDashboard = () => (
   <div className="flex h-screen bg-[#f5f5f7] font-sans text-slate-900 overflow-hidden selection:bg-[#1562f0]/20">
    
     {/* --- Sidebar --- */}
     <aside
       className={`bg-white border-r border-slate-200 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-24' : 'w-72'}`}
     >
       <div className={`p-6 pb-6 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
         <div
           className="flex items-center gap-4 mb-6 cursor-pointer group"
           onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
           title="Toggle Sidebar"
         >
           <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md border border-slate-100 shrink-0 group-hover:shadow-lg transition-all bg-white flex items-center justify-center">
              {beamio ? (
                <img
                  src={beamio.image ? beamio.image : getImg(beamio.accountName)}
                  alt={beamio.accountName || ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500 text-lg">?</div>
              )}
           </div>
           {!isSidebarCollapsed && (
             <div className="whitespace-nowrap overflow-hidden">
               <h1 className="font-bold text-[18px] tracking-tight leading-tight">
                 {displayName(beamio) || 'User'}
               </h1>
               <p className="text-[12px] font-semibold text-[#86868b] mt-0.5">
                 @{beamio?.accountName ?? 'Beamio'}
               </p>
             </div>
           )}
         </div>
        
         {!isSidebarCollapsed && (
           <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col gap-3 overflow-hidden whitespace-nowrap">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Cpu size={12}/> Smart AA</span>
                <span className="text-[11px] font-mono font-bold text-slate-800 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">0x4D2...11F2</span>
              </div>
              <div className="h-[1px] w-full bg-slate-200/50"></div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><KeyRound size={12}/> Owner EOA</span>
                <span className="text-[11px] font-mono text-slate-400">0x8B...A9C</span>
              </div>
           </div>
         )}
       </div>


       <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
         {!isSidebarCollapsed && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-2 whitespace-nowrap">Store Management</p>}
         <NavItem icon={LayoutDashboard} label="Daily Dashboard" isActive={activeTab === 'Overview'} onClick={() => setActiveTab('Overview')} collapsed={isSidebarCollapsed} />
         <NavItem icon={Receipt} label="Transactions" isActive={activeTab === 'Transactions'} onClick={() => setActiveTab('Transactions')} collapsed={isSidebarCollapsed} />
         <NavItem icon={Wallet} label="Payouts & Bank" isActive={activeTab === 'Payouts'} onClick={() => setActiveTab('Payouts')} collapsed={isSidebarCollapsed} />
        
         <div className={isSidebarCollapsed ? 'mt-6' : 'mt-8'}></div>
         {!isSidebarCollapsed && <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 whitespace-nowrap">Configuration</p>}
         <NavItem icon={Users} label="Staff Terminals" isActive={activeTab === 'Staff'} onClick={() => setActiveTab('Staff')} collapsed={isSidebarCollapsed} />
         <NavItem icon={Settings} label="Store Settings" isActive={activeTab === 'Settings'} onClick={() => setActiveTab('Settings')} collapsed={isSidebarCollapsed} />
       </nav>


       <div className="p-6">
         <button
           onClick={() => { window.location.href = '/' }}
           className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-center gap-2 px-4'} py-3 rounded-2xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors font-semibold text-[15px]`}
           title="Lock Wallet"
         >
           <LogOut size={18} className="shrink-0" />
           {!isSidebarCollapsed && <span className="whitespace-nowrap">Lock Wallet</span>}
         </button>
       </div>
     </aside>


     {/* --- Main Content Area --- */}
     <main className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 ease-in-out">
       <header className="h-20 bg-white/60 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-10 sticky top-0 z-10 shrink-0">
         <h2 className="text-2xl font-bold text-black tracking-tight">{activeTab}</h2>
         <div className="flex items-center gap-6">
           <span className="text-[13px] font-semibold text-slate-500">{dateString}</span>
           <div className="h-6 w-[1px] bg-slate-200"></div>
           <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center border border-emerald-200">
                <span className="text-[13px] font-bold text-emerald-700">UT</span>
             </div>
           </div>
         </div>
       </header>


       <div className="flex-1 overflow-y-auto p-10">
         {activeTab === 'Overview' && (
           <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
             {/* Row 1: Operations Metrics */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
               {/* Metric 1: Gross Sales */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                        <TrendingUp size={24} className="text-slate-700" />
                     </div>
                     <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[12px] font-bold">Today</span>
                   </div>
                   <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Gross Sales</p>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${totalSales.toFixed(2)}</p>
                 </div>
                
                 {/* The Split Breakdown */}
                 <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
                    <div className="bg-emerald-50/50 px-4 py-3 rounded-2xl border border-emerald-100 flex-1">
                       <span className="text-[10px] text-emerald-600 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Ticket size={12}/> $CTree</span>
                       <span className="text-[16px] font-black text-slate-800">${salesCTree.toFixed(2)}</span>
                    </div>
                    <div className="bg-blue-50/50 px-4 py-3 rounded-2xl border border-blue-100 flex-1">
                       <span className="text-[10px] text-blue-500 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Coins size={12}/> USDC</span>
                       <span className="text-[16px] font-black text-slate-800">${salesUSDC.toFixed(2)}</span>
                    </div>
                 </div>
               </div>


               {/* Metric 2: Tips Collected */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                        <Heart size={24} className="text-rose-500 fill-rose-100" />
                     </div>
                   </div>
                   <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tips Collected</p>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${totalTips.toFixed(2)}</p>
                 </div>


                 <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100">
                    <div className="bg-emerald-50/50 px-4 py-3 rounded-2xl border border-emerald-100 flex-1">
                       <span className="text-[10px] text-emerald-600 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Ticket size={12}/> $CTree</span>
                       <span className="text-[16px] font-black text-slate-800">${tipsCTree.toFixed(2)}</span>
                    </div>
                    <div className="bg-blue-50/50 px-4 py-3 rounded-2xl border border-blue-100 flex-1">
                       <span className="text-[10px] text-blue-500 font-bold block mb-1 uppercase tracking-widest flex items-center gap-1"><Coins size={12}/> USDC</span>
                       <span className="text-[16px] font-black text-slate-800">${tipsUSDC.toFixed(2)}</span>
                    </div>
                 </div>
               </div>


               {/* Metric 3: Top-Ups Sold */}
               <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 relative overflow-hidden group flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-4">
                     <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                        <ArrowUpFromLine size={24} className="text-white" />
                     </div>
                   </div>
                   <div className="flex items-center gap-2 mb-1">
                     <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">In-Store Top-Ups Sold</p>
                     <div className="group/tooltip relative">
                       <Info size={14} className="text-slate-300 cursor-help" />
                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-20">
                         Top-ups processed at POS where you received CAD cash/card. App self-reloads are excluded.
                       </div>
                     </div>
                   </div>
                   <p className="text-[40px] font-light text-black tracking-tighter leading-none">${topUpsIssued.toFixed(2)}</p>
                 </div>
                
                 <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                       <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-widest">Voucher Liability Issued</span>
                       <span className="text-[16px] font-black text-slate-800">{topUpsIssued.toFixed(2)} $CTree</span>
                    </div>
                 </div>
               </div>
             </div>


             {/* Row 2: Wallets & Settlement Pools */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
               {/* CashTrees Settlement Pool */}
               <div className="bg-gradient-to-br from-zinc-900 to-black rounded-[32px] p-8 shadow-xl relative overflow-hidden text-white flex flex-col justify-between border border-white/10">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                 <div className="relative z-10 mb-8">
                   <div className="flex items-center justify-between mb-4">
                     <p className="text-[13px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                       <Ticket size={16}/> CashTrees Settlement
                     </p>
                     <span className="bg-white/10 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/10">Net Balance</span>
                   </div>
                   <div className="flex items-baseline gap-2 mb-4">
                     <p className="text-[56px] font-light tracking-tighter leading-none">${netSettlementBalance.toFixed(2)}</p>
                     <span className="text-xl text-slate-400">CAD</span>
                   </div>


                   <div className="flex items-center gap-3 text-[13px] font-medium text-slate-400">
                      <span className="text-white">+${totalCTreeReceived.toFixed(2)} Recv</span>
                      <span>-</span>
                      <span className="text-rose-400">-${topUpsIssued.toFixed(2)} Issued</span>
                   </div>
                 </div>


                 <button
                   onClick={() => setIsPayoutModalOpen(true)}
                   className="relative z-10 w-full bg-white text-black py-4 rounded-[16px] font-bold text-[15px] hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 shadow-lg"
                 >
                   <Landmark size={18} /> Request CAD Settlement
                 </button>
               </div>


               {/* Direct USDC Wallet */}
               <div className="bg-gradient-to-br from-blue-900 to-[#0f172a] rounded-[32px] p-8 shadow-xl relative overflow-hidden text-white flex flex-col justify-between border border-blue-800/30">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                
                 <div className="relative z-10 mb-8">
                   <div className="flex items-center justify-between mb-4">
                     <p className="text-[13px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                       <Coins size={16}/> Direct Crypto Revenue
                     </p>
                     <span className="bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-blue-500/30">Self-Custody</span>
                   </div>
                   <div className="flex items-baseline gap-2 mb-4">
                     <p className="text-[56px] font-light tracking-tighter leading-none">${totalUSDCBalance.toFixed(2)}</p>
                     <span className="text-xl text-blue-300">USDC</span>
                   </div>


                   <p className="text-[13px] font-medium text-blue-200/60 leading-relaxed max-w-sm">
                     Direct payments routed to your AA wallet. CashTrees does not settle this balance.
                   </p>
                 </div>


                 <button
                   className="relative z-10 w-full bg-[#1562f0] text-white py-4 rounded-[16px] font-bold text-[15px] hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/50"
                 >
                   Off-ramp via Coinbase <ExternalLink size={16} />
                 </button>
               </div>


             </div>
           </div>
         )}


         {activeTab === 'Transactions' && (
           <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-2">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Search receipt ID, hash..." className="pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl w-80 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all shadow-sm" />
                </div>
                <button className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-3 rounded-2xl text-[14px] font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
                  <Filter size={16} /> Filter by Date
                </button>
              </div>


              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                   <thead>
                     <tr className="bg-slate-50/80 text-left border-b border-slate-100">
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Transaction Info</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Source / Customer</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Routing Breakdown</th>
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Net Value</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     
                      {MOCK_TRANSACTIONS.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                          
                           {/* Column 1: Tx Info */}
                           <td className="px-8 py-6">
                             <div className="flex items-center gap-3 mb-1">
                               {tx.type === 'Charge' ? (
                                 <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0"><ArrowDownToLine size={14}/></div>
                               ) : (
                                 <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><ArrowUpFromLine size={14}/></div>
                               )}
                               <div className="font-bold text-[15px] text-black whitespace-nowrap">{tx.type}</div>
                             </div>
                             <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 mt-2 pl-11 whitespace-nowrap">
                               <span>{dateString}, {tx.time}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               <span>{tx.id}</span>
                               <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                               {/* 更新：展示终端来源 */}
                               <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded" title="Processed by terminal">
                                 <MonitorSmartphone size={10}/> {tx.terminal}
                               </span>
                             </div>
                           </td>


                           {/* Column 2: Source & Customer Engagement */}
                           <td className="px-6 py-6">
                             <div className="flex flex-col gap-2">
                               <div className="flex items-center gap-2">
                                 {tx.source === 'APP' ? (
                                   <Smartphone size={16} className="text-[#1562f0] shrink-0"/>
                                 ) : (
                                   <Nfc size={16} className="text-slate-400 shrink-0"/>
                                 )}
                                 <span className={`text-[13px] font-bold whitespace-nowrap ${tx.source === 'APP' ? 'text-[#1562f0]' : 'text-slate-600'}`}>
                                   {tx.source === 'APP' ? 'Beamio App' : 'NFC Card'}
                                 </span>
                               </div>
                               {tx.beamioTag ? (
                                 <div className="flex items-center gap-3">
                                   <span className="text-[12px] font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-600 whitespace-nowrap">
                                     {tx.beamioTag}
                                   </span>
                                   {/* Action buttons appear on hover for App users */}
                                   <div className="hidden lg:group-hover:flex items-center gap-1">
                                     <button className="p-1.5 bg-[#1562f0]/10 text-[#1562f0] rounded-md hover:bg-[#1562f0] hover:text-white transition-colors tooltip-trigger" title="Send Message">
                                       <MessageSquare size={14} />
                                     </button>
                                     <button className="p-1.5 bg-[#1562f0]/10 text-[#1562f0] rounded-md hover:bg-[#1562f0] hover:text-white transition-colors tooltip-trigger" title="Send Smart Receipt">
                                       <Send size={14} />
                                     </button>
                                   </div>
                                 </div>
                               ) : (
                                 <span className="text-[12px] font-medium text-slate-400 italic whitespace-nowrap">Anonymous Customer</span>
                               )}
                             </div>
                           </td>


                           {/* Column 3: Exact Routing Breakdown */}
                           <td className="px-6 py-6">
                             <div className="space-y-1.5">
                               {tx.method === 'Mixed' ? (
                                 <>
                                   <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                                     <Ticket size={14} className="text-slate-400 shrink-0" /> $CTree: ${tx.ctreeAmount.toFixed(2)} <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-400">No Discount</span>
                                   </div>
                                   <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                                     <Coins size={14} className="text-blue-500 shrink-0" /> USDC: ${tx.usdcAmount.toFixed(2)}
                                   </div>
                                 </>
                               ) : tx.method === 'Issued $CTree' ? (
                                 <div className="flex items-center gap-2 text-[13px] font-bold text-emerald-700 whitespace-nowrap">
                                     <ArrowUpFromLine size={14} className="text-emerald-500 shrink-0" /> Issued $CTree: ${tx.ctreeAmount.toFixed(2)}
                                 </div>
                               ) : tx.method.includes('No Discount') ? (
                                 <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 whitespace-nowrap">
                                     <Coins size={14} className="text-blue-500 shrink-0" /> USDC (No Discount): ${tx.usdcAmount.toFixed(2)}
                                 </div>
                               ) : tx.method.includes('Black Tier') ? (
                                 <div className="flex items-center gap-2 text-[13px] font-bold text-[#34C759] whitespace-nowrap">
                                     <Crown size={14} className="text-yellow-500 shrink-0" /> $CTree (Black Tier): ${tx.ctreeAmount.toFixed(2)}
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2 text-[13px] font-bold text-[#34C759] whitespace-nowrap">
                                     <Ticket size={14} className="text-[#34C759] shrink-0" /> $CTree (Green Tier): ${tx.ctreeAmount.toFixed(2)}
                                 </div>
                               )}
                             </div>
                           </td>


                           {/* Column 4: Totals & Tips */}
                           <td className="px-8 py-6 text-right">
                             <div className={`font-bold text-[18px] whitespace-nowrap ${tx.type.includes('Top-Up') ? 'text-emerald-600' : 'text-black'}`}>
                               {tx.type.includes('Top-Up') ? '+' : ''}${tx.total.toFixed(2)}
                             </div>
                             {tx.tip > 0 ? (
                               <div className="text-[11px] font-bold text-slate-500 mt-1 whitespace-nowrap">Incl. <span className="text-rose-500">${tx.tip.toFixed(2)}</span> Tip</div>
                             ) : (
                               <div className="text-[11px] font-bold text-slate-400 mt-1 whitespace-nowrap">No Tip</div>
                             )}
                             {/* Small hash row */}
                             <div className="flex justify-end items-center gap-1.5 mt-2">
                               <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                               <span className="text-[10px] font-mono text-slate-300 hover:text-[#1562f0] cursor-pointer transition-colors whitespace-nowrap">{tx.hash}</span>
                             </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
           </div>
         )}


         {/* --- STAFF TERMINALS TAB (NEW) --- */}
         {activeTab === 'Staff' && (
           <div className="max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-black tracking-tight">Staff Terminals</h3>
                  <p className="text-[13px] font-medium text-slate-500 mt-1">Manage linked POS devices and their EOA authorizations.</p>
                </div>
                <button
                  onClick={() => setIsAddTerminalOpen(true)}
                  className="flex items-center gap-2 bg-[#1562f0] text-white px-6 py-3.5 rounded-2xl text-[14px] font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <Plus size={18} strokeWidth={2.5} /> Link New Terminal
                </button>
              </div>


              <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                   <thead>
                     <tr className="bg-slate-50/80 text-left border-b border-slate-100">
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Terminal Identity</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Linked EOA Address</th>
                       <th className="px-6 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                       <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {terminals.map((term, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                           <td className="px-8 py-6">
                             <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 border border-slate-200">
                                 <MonitorSmartphone size={20} />
                               </div>
                               <div>
                                 <div className="font-bold text-[15px] text-black">{term.tag}</div>
                                 <div className="text-[12px] font-medium text-slate-500 mt-0.5">{term.name}</div>
                               </div>
                             </div>
                           </td>
                           <td className="px-6 py-6">
                             <div className="flex items-center gap-2">
                               <KeyRound size={14} className="text-slate-400" />
                               <span className="font-mono text-[13px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                 {term.eoa}
                               </span>
                             </div>
                           </td>
                           <td className="px-6 py-6 text-center">
                             <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide">
                               <CheckCircle2 size={12} /> {term.status}
                             </span>
                             <div className="text-[11px] font-medium text-slate-400 mt-2">Last active: {term.lastActive}</div>
                           </td>
                           <td className="px-8 py-6 text-right">
                             <button className="p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-colors tooltip-trigger" title="Revoke Authorization">
                               <Trash2 size={18} />
                             </button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </div>
           </div>
         )}


         {activeTab === 'Settings' && (
           <div className="animate-in fade-in duration-300">
             <BeamioMeMainScreen />
           </div>
         )}

         {activeTab === 'Payouts' && (
           <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-in fade-in">
             <Settings size={48} className="mb-4 opacity-20" />
             <p className="text-[15px] font-medium">This module is active in production build.</p>
           </div>
         )}


       </div>
     </main>


     {renderPayoutDrawer()}


     {/* --- ADD TERMINAL MODAL --- */}
     {isAddTerminalOpen && (
       <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
         <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsAddTerminalOpen(false)}></div>
         <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 text-[#1562f0] rounded-2xl flex items-center justify-center">
                     <LinkIcon size={24} />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-black">Link New Terminal</h2>
               </div>
               <button onClick={() => setIsAddTerminalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-black transition-colors">
                 <X size={20} />
               </button>
            </div>


            <div className="space-y-5 mb-8">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <p className="text-[13px] font-medium text-slate-600 leading-snug">
                  Install the POS App on the new device. Retrieve its generated BeamioTag and public EOA address to authorize it for this store.
                </p>
              </div>


              <div className="space-y-1.5">
                 <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Terminal Beamio Tag</label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <span className="text-slate-400 font-bold">@</span>
                   </div>
                   <input
                     type="text"
                     value={newTerminalTag}
                     onChange={(e) => setNewTerminalTag(e.target.value)}
                     placeholder="e.g. ut_reg3"
                     className="w-full pl-9 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-semibold text-[15px] text-slate-900"
                   />
                 </div>
              </div>


              <div className="space-y-1.5">
                 <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Terminal EOA Address</label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                     <KeyRound size={16} className="text-slate-400" />
                   </div>
                   <input
                     type="text"
                     value={newTerminalEoa}
                     onChange={(e) => setNewTerminalEoa(e.target.value)}
                     placeholder="0x..."
                     className="w-full pl-10 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#1562f0]/20 focus:border-[#1562f0] transition-all font-mono font-medium text-[14px] text-slate-900"
                   />
                 </div>
              </div>
            </div>


            <button
              onClick={() => {
                // Mock adding logic
                if (newTerminalTag && newTerminalEoa) {
                  setTerminals([...terminals, {
                    id: `TM-00${terminals.length + 1}`,
                    tag: newTerminalTag.startsWith('@') ? newTerminalTag : `@${newTerminalTag}`,
                    name: 'New POS Terminal',
                    eoa: `${newTerminalEoa.substring(0, 6)}...${newTerminalEoa.substring(newTerminalEoa.length - 4)}`,
                    status: 'Active',
                    lastActive: 'Just now'
                  }]);
                  setIsAddTerminalOpen(false);
                  setNewTerminalTag('');
                  setNewTerminalEoa('');
                }
              }}
              className="w-full bg-black text-white py-4 rounded-[16px] font-semibold text-[16px] hover:bg-slate-800 transition-all active:scale-[0.98] shadow-md"
            >
              Authorize & Link
            </button>
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

