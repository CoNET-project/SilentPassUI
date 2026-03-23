import React, { useState, useEffect } from 'react';
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
 Zap, // 新增闪电图标
 Copy // 引入 Copy 图标
} from 'lucide-react';


export default function CashTreesApp() {
 const [showQR, setShowQR] = useState(false);
 const [qrMode, setQrMode] = useState('pay');
 const [showNFCScanner, setShowNFCScanner] = useState(false);
  // Send (转账) State
 const [showSendModal, setShowSendModal] = useState(false);
 const [sendAmount, setSendAmount] = useState('');
 const [sendRecipient, setSendRecipient] = useState('');
 const [sendAsset, setSendAsset] = useState('CAD');


 // Add Cash (充值) State
 const [showAddCashModal, setShowAddCashModal] = useState(false);
 const [addAmount, setAddAmount] = useState('');
 const [addCashMode, setAddCashMode] = useState('methods');


 // 资产明细 (Balance Details) State
 const [showBalanceDetails, setShowBalanceDetails] = useState(false);


 // 防女巫攻击的 AA 钱包状态 (默认为未激活)
 const [hasAAWallet, setHasAAWallet] = useState(false);


 const [activeCardIndex, setActiveCardIndex] = useState(0);
  // 底部导航栏 Tab 状态控制 (默认进入 Wallet 以方便您预览)
 const [activeTab, setActiveTab] = useState('wallet');


 const userBeamioTag = "@alex.tag";


 useEffect(() => {
   let timer: ReturnType<typeof setTimeout> | undefined
   if (showNFCScanner) {
     timer = setTimeout(() => {
       setShowNFCScanner(false);
       // 核心逻辑新增：如果在未激活状态下扫描成功，自动激活并同步 AA 钱包
       if (!hasAAWallet) {
         setHasAAWallet(true);
       }
     }, 3000); // 将模拟感应时间缩短到 3 秒，体验更顺畅
   }
   return () => {
     if (timer !== undefined) clearTimeout(timer)
   }
 }, [showNFCScanner, hasAAWallet]);


 // 模拟充值完成，激活 AA 账号
 const handleConfirmTopUp = () => {
   setShowAddCashModal(false);
   setHasAAWallet(true); // 充值后正式部署并显示卡包
 };


 // ==========================================
 // TAB 1: 首页 / 核心金库 (Home Icon)
 // ==========================================
 const renderHomeTab = () => (
   <div className="animate-in fade-in duration-300 pb-32">
     {/* 首页专属：左上角的个人身份标识 */}
     <div className="px-6 pt-12 pb-2 flex justify-start items-center">
       <button className="flex items-center gap-2 bg-white shadow-sm border border-gray-200 rounded-full pl-1.5 pr-4 py-1.5 transition-transform active:scale-95 hover:bg-gray-50">
         <div className="w-8 h-8 bg-gradient-to-tr from-[#96EB3C] to-[#65A30D] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner">
           A
         </div>
         <span className="text-base font-bold text-gray-900 tracking-tight">{userBeamioTag}</span>
       </button>
     </div>


     {/* 极简总资产数字区 */}
     <div className="px-6 pt-4 pb-6 flex flex-col items-center justify-center relative">
       <div
         onClick={() => setShowBalanceDetails(true)}
         className="flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform group"
       >
         <div className="flex items-center text-gray-500 text-sm font-medium mb-1">
           Total Purchasing Power
           <div className="ml-1.5 w-4 h-4 rounded-full bg-[#96EB3C] flex items-center justify-center text-gray-900 shadow-sm group-hover:scale-110 transition-all duration-200">
             <Info size={11} strokeWidth={3} />
           </div>
         </div>
         <div className="flex items-start justify-center">
           <span className="text-2xl font-semibold text-gray-400 mt-2 mr-1">CA$</span>
           <h1 className="text-6xl font-bold tracking-tighter text-gray-900">
             125<span className="text-4xl text-gray-400">.50</span>
           </h1>
         </div>
       </div>
     </div>


     {/* 高频操作按钮 */}
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
         <span className="font-semibold text-xs text-gray-700">Pay</span>
       </button>
     </div>


     {/* 近期活动流水 */}
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
                 <p className="text-xs text-gray-500 mt-0.5 font-medium">Card Tap (Universal)</p>
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
   </div>
 );


 // ==========================================
 // TAB 2: 实体卡包与 AA 管理 (Wallet 页面)
 // ==========================================
 const renderWalletTab = () => (
   <div className="animate-in fade-in duration-300 pb-32">
     {/* Wallet 页面专属的“悬浮胶囊导航栏” */}
     <div className="px-6 pt-12 pb-6 flex justify-between items-center">
       <div className="bg-white shadow-sm border border-gray-100 px-6 py-2.5 rounded-full flex items-center">
         <span className="text-[20px] font-bold text-gray-600 tracking-tight">Wallet</span>
       </div>
      
       <div className="bg-white shadow-sm border border-gray-100 p-1.5 rounded-full flex items-center gap-1">
         <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#65A30D] active:scale-95 transition-transform hover:bg-gray-50">
           <ArrowRightLeft size={18} strokeWidth={2.5} />
         </button>
         {/* 将原本的 Pencil 替换为 SlidersHorizontal，作为 Security/Settings 的收纳入口 */}
         <button className="w-9 h-9 rounded-full flex items-center justify-center text-[#65A30D] active:scale-95 transition-transform hover:bg-gray-50">
           <SlidersHorizontal size={18} strokeWidth={2.5} />
         </button>
         <button
           onClick={() => { setAddAmount(''); setAddCashMode('methods'); setShowAddCashModal(true); }}
           className="w-9 h-9 bg-[#96EB3C] text-gray-900 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-sm hover:bg-[#8ad936]"
         >
           <Plus size={20} strokeWidth={2.5} />
         </button>
       </div>
     </div>


     {!hasAAWallet ? (
       // 状态 1：第一次安装，空白卡引导页 (需充值部署 AA 或 同步实体卡)
       <div className="px-6 mt-4">
         <div className="bg-gradient-to-b from-gray-100 to-white border-2 border-dashed border-gray-300 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[360px] shadow-sm">
           <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-gray-400 mb-6 shadow-sm border border-gray-100">
             <Wallet size={36} strokeWidth={1.5} />
           </div>
           <h2 className="text-xl font-bold text-gray-900 mb-2">Get Started with CashTrees</h2>
           <p className="text-sm text-gray-500 mb-8 leading-relaxed px-2">
             Deploy a new smart wallet or sync your existing physical card.
           </p>
          
           {/* 路径 1：充值部署新账户 */}
           <button
             onClick={() => {
               setAddAmount('');
               setAddCashMode('methods');
               setShowAddCashModal(true);
             }}
             className="w-full bg-[#96EB3C] hover:bg-[#8ad936] active:scale-95 text-gray-900 py-4 rounded-2xl font-bold transition-all shadow-[0_4px_14px_rgba(150,235,60,0.4)] flex items-center justify-center gap-2"
           >
             <ArrowDownToLine size={18} className="text-gray-900" />
             Add Cash to Activate
           </button>


           {/* OR 分割线 */}
           <div className="flex items-center w-full my-5 opacity-70">
             <div className="flex-1 border-t border-gray-200"></div>
             <span className="px-3 text-[10px] text-gray-400 font-bold uppercase tracking-widest">OR</span>
             <div className="flex-1 border-t border-gray-200"></div>
           </div>


           {/* 路径 2：贴卡同步已有的 AA 账户 */}
           <button
             onClick={() => setShowNFCScanner(true)}
             className="w-full bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-700 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
           >
             <Radio size={18} className="text-[#65A30D]" />
             Sync Existing Card
           </button>
         </div>
       </div>
     ) : (
       // 状态 2：拥有 AA 账号，展示卡包列表
       <div className="space-y-4 mt-2">
         {/* 第一张卡：底层智能钱包 (高级白底+淡绿光晕) */}
         <div
           onClick={() => setShowBalanceDetails(true)}
           className="mx-6 relative bg-gradient-to-br from-white to-[#F8F9FA] rounded-[2.5rem] p-7 text-gray-900 shadow-xl shadow-gray-200/50 overflow-hidden border border-gray-100 transform transition-transform hover:-translate-y-1 cursor-pointer"
         >
           <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#96EB3C] rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
           <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#96EB3C] rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
          
           <div className="flex justify-between items-start mb-6 relative z-10">
             <div className="flex items-center">
               <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mr-3 border border-gray-100 shadow-sm">
                 <Zap size={22} className="text-[#65A30D] fill-[#65A30D]" />
               </div>
               <div>
                 <span className="font-extrabold text-xl block tracking-tight text-gray-900">Universal Pass</span>
                 {/* 核心改动：在 Universal Pass 下方加入极其精致的 AA 钱包地址徽章 */}
                 <div
                   onClick={(e) => { e.stopPropagation(); /* 阻止冒泡，未来可接入复制逻辑 */ }}
                   className="flex items-center gap-1.5 mt-1.5 bg-gray-100/80 border border-gray-200/60 px-2 py-0.5 rounded-md w-max shadow-sm hover:bg-gray-200 transition-colors"
                 >
                   <span className="text-[10px] text-gray-500 font-mono tracking-widest font-semibold uppercase">0x799E...75C8</span>
                   <Copy size={10} className="text-gray-400" />
                 </div>
               </div>
             </div>
             <div
               onClick={(e) => { e.stopPropagation(); setShowBalanceDetails(true); }}
               className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100 hover:bg-gray-100 transition-colors shadow-sm"
             >
               <Info size={16} strokeWidth={2.5} />
             </div>
           </div>
          
           <div className="relative z-10 mt-10">
             <p className="text-sm text-gray-500 font-semibold mb-1">Total Balance</p>
             <div className="flex items-baseline">
               <span className="text-3xl font-semibold mr-1 text-gray-400">$</span>
               <p className="text-5xl font-extrabold tracking-tighter text-gray-900">
                 125<span className="text-3xl font-bold text-gray-400">.50</span>
               </p>
             </div>
           </div>
         </div>


         {/* 第二张卡：CashTrees 联盟会员卡 (品牌绿) */}
         <div
           onClick={() => setShowQR(true)}
           className="mx-6 relative bg-gradient-to-br from-[#96EB3C] to-[#65A30D] rounded-[2.5rem] p-7 text-gray-900 shadow-lg shadow-[#96EB3C]/20 overflow-hidden border border-[#96EB3C]/50 transform transition-transform hover:-translate-y-1 cursor-pointer"
         >
           <div className="absolute top-0 right-0 w-48 h-48 bg-white/30 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
           <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/20 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none"></div>
          
           <div className="flex justify-between items-start mb-6 relative z-10">
             <div className="flex items-center">
               <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mr-3 backdrop-blur-md border border-white/10 shadow-sm">
                 <span className="text-2xl">🌳</span>
               </div>
               <div>
                 <span className="font-extrabold text-xl block tracking-tight text-gray-900 shadow-sm">Alliance Member</span>
                 <span className="text-[10px] text-gray-800/80 font-mono tracking-widest uppercase mt-0.5 block">Store Credit • Tap to Pay</span>
               </div>
             </div>
           </div>
          
           {/* 核心改动：彻底移除绿色卡片右下角的二维码图标，维持架构统一性 */}
           <div className="relative z-10 mt-12">
             <p className="text-sm text-gray-800 font-semibold mb-1 opacity-90">Rewards Balance</p>
             <div className="flex items-baseline">
               <span className="text-2xl font-semibold mr-1 opacity-80">$</span>
               <p className="text-4xl font-extrabold tracking-tighter text-gray-900">
                 85<span className="text-2xl font-bold text-gray-800/80">.50</span>
               </p>
             </div>
           </div>
         </div>


         {/* 绑定物理卡入口 */}
         <div className="px-6 mt-4">
           <div
             onClick={() => setShowNFCScanner(true)}
             className="h-20 bg-white border border-gray-200 rounded-[1.5rem] flex items-center justify-center text-gray-600 hover:text-gray-900 hover:border-[#96EB3C] transition-all cursor-pointer shadow-sm group"
           >
             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3 group-hover:bg-[#96EB3C]/20 transition-colors">
               <Plus size={18} className="text-gray-500 group-hover:text-[#65A30D] transition-colors" />
             </div>
             <span className="font-bold tracking-tight text-[15px]">Bind Physical Card</span>
           </div>
         </div>
        
         {/* 安全设置 (Security) 区块已彻底移除，功能已收纳至右上角导航栏 */}
       </div>
     )}
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
           <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl mr-3 relative">
             👨🏻‍💻
             <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
           </div>
           <div className="flex-1 min-w-0 pr-4">
             <div className="flex justify-between items-baseline mb-0.5">
               <h3 className="font-bold text-gray-900 truncate">@jimmy.z</h3>
               <span className="text-[10px] text-gray-400 font-medium">12:42 PM</span>
             </div>
             <p className="text-xs text-gray-500 truncate">Thanks for the lunch! Sent $20.</p>
           </div>
         </div>
       </div>


       <div className="bg-white p-4 rounded-3xl flex items-center justify-between shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors">
         <div className="flex items-center flex-1">
           <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-xl mr-3 relative">
             👩🏼‍🦰
           </div>
           <div className="flex-1 min-w-0 pr-4">
             <div className="flex justify-between items-baseline mb-0.5">
               <h3 className="font-bold text-gray-900 truncate">@sarah.k</h3>
               <span className="text-[10px] text-gray-400 font-medium">Yesterday</span>
             </div>
             <p className="text-xs text-gray-500 truncate">Are we still going to Sen Pho tonight?</p>
           </div>
         </div>
       </div>


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
 // TAB 4: 试运行商圈 (Store / Explore)
 // ==========================================
 const renderStoreTab = () => (
   <div className="animate-in fade-in duration-300 pb-32">
     <div className="px-6 pt-14 mb-6">
       <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Stores</h1>
       <div className="flex items-center mt-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md w-max">
         <span className="text-[11px] font-bold uppercase tracking-wider">Pilot Program: 3 Locations</span>
       </div>
     </div>


     <div className="px-6 space-y-4">
       <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
         <div className="h-24 bg-orange-50 flex items-center justify-center relative">
           <span className="text-5xl absolute opacity-20">🍜</span>
           <span className="text-4xl z-10">🍜</span>
         </div>
         <div className="p-4">
           <div className="flex justify-between items-start mb-1">
             <h3 className="font-bold text-lg text-gray-900">Sen Pho + Cafe</h3>
             <span className="text-xs font-bold bg-[#96EB3C]/20 text-[#65A30D] px-2 py-1 rounded-md mt-0.5">10% Reward</span>
           </div>
           <p className="text-sm text-gray-500">Authentic Vietnamese Cuisine & Coffee</p>
           <div className="mt-3 flex gap-2">
             <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">Tap to Pay</span>
             <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">0.8 km</span>
           </div>
         </div>
       </div>


       <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
         <div className="h-24 bg-amber-50 flex items-center justify-center relative">
           <span className="text-5xl absolute opacity-20">☕️</span>
           <span className="text-4xl z-10">☕️</span>
         </div>
         <div className="p-4">
           <div className="flex justify-between items-start mb-1">
             <h3 className="font-bold text-lg text-gray-900">Downtown Roasters</h3>
             <span className="text-xs font-bold bg-[#96EB3C]/20 text-[#65A30D] px-2 py-1 rounded-md mt-0.5">5% Off</span>
           </div>
           <p className="text-sm text-gray-500">Local Artisanal Coffee & Pastries</p>
           <div className="mt-3 flex gap-2">
             <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">Tap to Pay</span>
             <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">1.2 km</span>
           </div>
         </div>
       </div>


       <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
         <div className="h-24 bg-red-50 flex items-center justify-center relative">
           <span className="text-5xl absolute opacity-20">🍣</span>
           <span className="text-4xl z-10">🍣</span>
         </div>
         <div className="p-4">
           <div className="flex justify-between items-start mb-1">
             <h3 className="font-bold text-lg text-gray-900">Oishi Sushi Bar</h3>
             <span className="text-xs font-bold bg-[#96EB3C]/20 text-[#65A30D] px-2 py-1 rounded-md mt-0.5">Free Drink</span>
           </div>
           <p className="text-sm text-gray-500">Premium Sushi & Japanese Tapas</p>
           <div className="mt-3 flex gap-2">
             <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">Tap to Pay</span>
             <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-md">2.5 km</span>
           </div>
         </div>
       </div>
     </div>
   </div>
 );


 return (
   <div className="min-h-screen bg-gray-100 flex justify-center font-sans text-gray-900 pb-20">
     <div className="w-full max-w-md bg-[#F2F2F7] overflow-hidden relative shadow-2xl sm:rounded-[3rem] sm:border-[8px] border-white sm:my-8 sm:h-[850px] flex flex-col">
      
       {/* Scrollable Content Area */}
       <div className="flex-1 overflow-y-auto hide-scrollbar">
         {activeTab === 'home' && renderHomeTab()}
         {activeTab === 'wallet' && renderWalletTab()}
         {activeTab === 'chat' && renderChatTab()}
         {activeTab === 'store' && renderStoreTab()}
       </div>


       {/* --- Floating Bottom Navigation Bar --- */}
       <div className="absolute bottom-6 w-full z-30 px-6 flex justify-center items-center gap-2 pointer-events-none">
         <div className="flex-1 bg-gradient-to-b from-[#A3A3A3] to-[#8E8E93] backdrop-blur-2xl rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.15)] p-1.5 flex justify-between items-center border border-white/30 pointer-events-auto">
          
           {/* 核心改动：将所有底部 active 状态的蓝光替换为 CashTrees 生态绿 */}
           <button
             onClick={() => setActiveTab('home')}
             className={`relative flex items-center justify-center flex-1 h-12 transition-all duration-300 ${activeTab === 'home' ? 'bg-gradient-to-b from-white to-[#F2F2F7] rounded-[1.5rem] shadow-[0_2px_10px_rgba(0,0,0,0.1)]' : 'hover:bg-white/10 rounded-[1.5rem]'}`}
           >
             <Home size={24} className={activeTab === 'home' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'home' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'home' ? 0 : 2} />
           </button>


           <button
             onClick={() => setActiveTab('wallet')}
             className={`relative flex items-center justify-center flex-1 h-12 transition-all duration-300 ${activeTab === 'wallet' ? 'bg-gradient-to-b from-white to-[#F2F2F7] rounded-[1.5rem] shadow-[0_2px_10px_rgba(0,0,0,0.1)]' : 'hover:bg-white/10 rounded-[1.5rem]'}`}
           >
             <Wallet size={24} className={activeTab === 'wallet' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'wallet' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'wallet' ? 0 : 2} />
           </button>


           <button
             onClick={() => setShowQR(true)}
             className="relative flex items-center justify-center flex-1 h-12 transition-all duration-300 hover:bg-white/10 rounded-[1.5rem]"
           >
             <Scan size={24} className="text-white" strokeWidth={2.5} />
           </button>


           <button
             onClick={() => setActiveTab('chat')}
             className={`relative flex items-center justify-center flex-1 h-12 transition-all duration-300 ${activeTab === 'chat' ? 'bg-gradient-to-b from-white to-[#F2F2F7] rounded-[1.5rem] shadow-[0_2px_10px_rgba(0,0,0,0.1)]' : 'hover:bg-white/10 rounded-[1.5rem]'}`}
           >
             <MessageCircle size={24} className={activeTab === 'chat' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'chat' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'chat' ? 0 : 2} />
           </button>


           <button
             onClick={() => setActiveTab('store')}
             className={`relative flex items-center justify-center flex-1 h-12 transition-all duration-300 ${activeTab === 'store' ? 'bg-gradient-to-b from-white to-[#F2F2F7] rounded-[1.5rem] shadow-[0_2px_10px_rgba(0,0,0,0.1)]' : 'hover:bg-white/10 rounded-[1.5rem]'}`}
           >
             <Store size={24} className={activeTab === 'store' ? 'text-[#65A30D]' : 'text-white'} fill={activeTab === 'store' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'store' ? 0 : 2} />
           </button>
         </div>


         <button className="w-14 h-14 bg-gradient-to-b from-[#A3A3A3] to-[#8E8E93] backdrop-blur-2xl rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.15)] flex items-center justify-center border border-white/30 text-white hover:bg-white/10 transition-colors shrink-0 pointer-events-auto">
           <Search size={24} strokeWidth={2.5} />
         </button>
       </div>


       {/* --- Balance Details (资产明细) Modal --- */}
       {showBalanceDetails && (
         <div className="absolute inset-0 z-50 flex flex-col">
           <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowBalanceDetails(false)}></div>
           <div className="mt-auto bg-[#F2F2F7] rounded-t-[2.5rem] p-6 relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
             <div className="mx-auto w-12 h-1.5 bg-gray-300 rounded-full mb-6"></div>
            
             <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight text-center">Balance Details</h3>
             <p className="text-sm text-gray-500 mb-8 text-center">Your purchasing power breakdown</p>
            
             <div className="w-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mb-8">
               {/* 闭环资金：$CTree */}
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


               {/* 开环资金：USDC */}
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
                       <span className="text-xs font-mono text-gray-700 truncate">0x799E...75C8</span>
                     </div>
                     <button className="bg-white border border-gray-200 shadow-sm text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                       Copy
                     </button>
                   </div>


                   <div className="flex items-center gap-2 bg-gray-50 px-5 py-3 rounded-full border border-gray-200 shadow-inner">
                     <div className="w-2 h-2 bg-[#65A30D] rounded-full animate-pulse"></div>
                     <span className="text-xs font-bold text-gray-600 tracking-wide uppercase">Waiting for cashier scan...</span>
                   </div>
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
                       <span className="text-xs font-mono text-gray-900 font-bold bg-white px-2 py-1 rounded shadow-sm border border-gray-100">0x799E...75C8</span>
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
                     onClick={handleConfirmTopUp}
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


                   {/* 充值成功后激活账户 */}
                   <button
                     onClick={handleConfirmTopUp}
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


       {/* --- QR Code Modal (Pay / Receive) --- */}
       {showQR && (
         <div className="absolute inset-0 z-40 flex flex-col">
           <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowQR(false)}></div>
           <div className="mt-auto bg-white rounded-t-[2.5rem] p-6 relative z-10 flex flex-col items-center animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
             <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-6"></div>
            
             <div className="flex bg-gray-100 p-1 rounded-full mb-6 w-full max-w-[240px] shadow-inner">
               <button
                 onClick={() => setQrMode('pay')}
                 className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${qrMode === 'pay' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 Pay
               </button>
               <button
                 onClick={() => setQrMode('receive')}
                 className={`flex-1 py-2 text-sm font-bold rounded-full transition-all duration-300 ${qrMode === 'receive' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 Receive
               </button>
             </div>


             {qrMode === 'pay' ? (
               <>
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
               </>
             ) : (
               <>
                 <h3 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">Receive USDC</h3>
                 <p className="text-sm text-gray-500 mb-6 text-center">Scan to send funds on <span className="font-bold text-blue-600">Base</span> Network.</p>
                 <div className="w-64 h-64 bg-white rounded-[2rem] p-4 mb-6 shadow-md border border-gray-100">
                   <div className="w-full h-full bg-gray-50 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border border-gray-200">
                     <QrCode size={140} className="text-gray-900" />
                     <div className="absolute bg-white p-1 rounded-full shadow-sm">
                       <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">$</div>
                     </div>
                   </div>
                 </div>
                 <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 w-full max-w-[280px] flex items-center justify-between mb-6">
                   <div className="flex flex-col overflow-hidden mr-3">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Wallet Address</span>
                     <span className="text-xs font-mono text-gray-700 truncate">0x799E...75C8</span>
                   </div>
                   <button className="bg-white border border-gray-200 shadow-sm text-gray-700 px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform">
                     Copy
                   </button>
                 </div>
               </>
             )}


             <button onClick={() => setShowQR(false)} className="w-full py-4 bg-gray-900 hover:bg-gray-800 active:scale-95 text-white rounded-full font-bold transition-all shadow-md">
               Done
             </button>
           </div>
         </div>
       )}


       {/* --- Send (转账) Modal --- */}
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


       {/* --- Apple Style @BeamioTag NFC Reader Modal --- */}
       {showNFCScanner && (
         <div className="absolute inset-0 z-50 flex flex-col">
           <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={() => setShowNFCScanner(false)}></div>
           <div className="mt-auto bg-white/95 backdrop-blur-3xl rounded-t-[3rem] p-8 pb-12 relative z-10 flex flex-col items-center shadow-[0_-10px_50px_rgba(0,0,0,0.1)] border-t border-gray-100 animate-in slide-in-from-bottom-full duration-300 ease-out">
             <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-10"></div>
             <div className="relative w-32 h-32 flex items-center justify-center mb-8">
               <div className="absolute inset-0 border-2 border-[#96EB3C] rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
               <div className="absolute inset-2 border-2 border-[#96EB3C]/60 rounded-full animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite_0.5s]"></div>
               <div className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl border border-gray-100">
                 <Smartphone size={32} className="text-gray-900 absolute" />
                 <Radio size={48} className="text-[#96EB3C] absolute scale-150 animate-pulse opacity-60" />
               </div>
             </div>
            
             {/* 核心改动：根据是否已激活，动态切换弹窗的话术 */}
             <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
               {!hasAAWallet ? "Sync existing card" : "Bind physical card"}
             </h3>
             <p className="text-base text-gray-500 mb-8 text-center max-w-[280px]">
               {!hasAAWallet
                 ? "Hold your CashTrees card near your phone to sync your account."
                 : <>Hold your new blank card near your phone to bind it to <span className="text-gray-900 font-bold bg-gray-100 px-2 py-0.5 rounded-md">{userBeamioTag}</span>.</>
               }
             </p>
            
             <div className="flex items-center bg-gray-50 px-4 py-2 rounded-full border border-gray-200 mb-8 shadow-sm">
               <ShieldCheck size={14} className="text-gray-400 mr-2" />
               <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                 Secured by Beamio Protocol
               </span>
             </div>
             <button
               onClick={() => setShowNFCScanner(false)}
               className="w-full max-w-xs py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-900 rounded-full font-bold transition-all border border-gray-200"
             >
               Cancel
             </button>
           </div>
         </div>
       )}


     </div>
   </div>
 );
}

