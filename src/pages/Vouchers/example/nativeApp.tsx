import React, { useState, useEffect } from 'react';
import { tu } from '@/locale/beamioLocale'
import {
 Nfc,
 CheckCircle2,
 ArrowLeft,
 LogOut,
 Wallet,
 Store,
 ChevronRight,
 ShieldCheck,
 Activity,
 ArrowDownToLine,
 ArrowUpFromLine,
 Search,
 Lock,
 MessageSquare,
 Heart,
 Printer,
 QrCode,
 ScanLine,
 Ticket,
 Coins,
 AlertTriangle,
 PlusCircle,
 TrendingUp,
 Crown,
 Sparkles,
 Smartphone // Added to indicate customer scanning
} from 'lucide-react';


export default function MobilePOS() {
 const [currentView, setCurrentView] = useState('login');
 const [merchantTag, setMerchantTag] = useState('@cashtrees_van');
 const [mode, setMode] = useState('charge');
 const [amount, setAmount] = useState('0');
 const [selectedTipRate, setSelectedTipRate] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
 const [scanMethod, setScanMethod] = useState('nfc');
 const [authUsed, setAuthUsed] = useState('NFC');


 const [txStatus, setTxStatus] = useState('pending');
 const [isPrinting, setIsPrinting] = useState(false);


 // Compact date to prevent text wrapping on small screens
 const today = new Date();
 const dateString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
 const timeString = today.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });


 const numAmount = parseFloat(amount || '0');
 const tipValue = mode === 'charge' ? numAmount * selectedTipRate : 0;
 const originalTotalAmount = numAmount + tipValue;


 const handlePadClick = (val: string) => {
   if (val === 'back') {
     setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
     return;
   }
   if (val === '.') {
     if (amount.includes('.')) return;
     setAmount(prev => prev + '.');
     return;
   }
   setAmount(prev => {
     if (prev === '0') return val;
     if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
     return prev + val;
   });
 };


 const simulateNFCTap = () => {
   setIsScanning(true);
   setTimeout(() => {
     setIsScanning(false);
     setAuthUsed('NFC');
    
     if (mode === 'charge') {
       const initialVoucherBalance = 40.00;
       const greenDiscountRate = 0.10;
       const greenDiscountedSubtotal = numAmount * (1 - greenDiscountRate);
       const requiredGreenTotal = greenDiscountedSubtotal + tipValue;


       if (requiredGreenTotal > initialVoucherBalance) {
         setTxStatus('shortfall');
       } else {
         setTxStatus('success_nfc_green');
       }
     } else if (mode === 'topup') {
       const topUpValue = numAmount;
       if (topUpValue >= 100) {
         setTxStatus('topup_black_unlocked');
       } else if (topUpValue >= 50) {
         setTxStatus('topup_green_unlocked');
       } else {
         setTxStatus('topup_standard');
       }
     } else {
       setTxStatus('success_simple');
     }
     setCurrentView('success');
   }, 1500);
 };


 const simulateQRScan = () => {
   setIsScanning(true);
   setTimeout(() => {
     setIsScanning(false);
     setAuthUsed('QR');
    
     if (mode === 'charge') {
       setTxStatus('success_qr');
     } else if (mode === 'topup') {
       const topUpValue = numAmount;
       if (topUpValue >= 100) {
         setTxStatus('topup_black_unlocked');
       } else if (topUpValue >= 50) {
         setTxStatus('topup_green_unlocked');
       } else {
         setTxStatus('topup_standard');
       }
     } else {
       setTxStatus('success_simple');
     }
     setCurrentView('success');
   }, 1500);
 };


 // --- Views ---


 const renderLogin = () => (
   <div className="flex-1 flex flex-col justify-center px-8 bg-[#f5f5f7] text-black">
     <div className="flex justify-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
       <div className="w-20 h-20 bg-black rounded-[22px] flex items-center justify-center shadow-lg">
         <Nfc size={40} className="text-white" strokeWidth={1.5} />
       </div>
     </div>
     <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
       <h1 className="text-3xl font-semibold tracking-tight mb-1">CashTrees POS</h1>
       <p className="text-[#86868b] font-medium text-sm">Powered by Beamio Protocol</p>
     </div>


     <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
       <div className="bg-white rounded-[16px] px-4 py-1 flex items-center shadow-sm">
         <span className="text-[#86868b] font-medium mr-1">@</span>
         <input
           type="text"
           value={merchantTag.replace('@', '')}
           onChange={(e) => setMerchantTag(`@${e.target.value}`)}
           className="bg-transparent border-none outline-none text-[17px] font-medium w-full text-black placeholder-[#86868b] py-3"
           placeholder="merchant_tag"
         />
       </div>


       <div className="bg-white rounded-[16px] px-4 py-1 flex items-center shadow-sm">
         <Lock size={18} className="text-[#86868b] mr-2" />
         <input
           type="password"
           className="bg-transparent border-none outline-none text-[17px] font-medium w-full text-black placeholder-[#86868b] py-3 tracking-widest"
           placeholder="••••••••"
         />
       </div>


       <button
         onClick={() => setCurrentView('home')}
         className="w-full bg-black hover:bg-zinc-800 text-white font-semibold text-[17px] py-4 rounded-[16px] transition-transform active:scale-[0.98] mt-4 shadow-sm"
       >
         Initialize
       </button>
     </div>
    
     <div className="mt-auto pb-10 text-center animate-in fade-in duration-1000">
       <p className="text-[11px] text-[#86868b] font-medium tracking-wide">Universal Smart Routing Enabled</p>
     </div>
   </div>
 );


 const renderHome = () => (
   <div className="flex-1 flex flex-col bg-[#f5f5f7]">
     <div className="pt-14 pb-4 px-6 bg-white/70 backdrop-blur-xl border-b border-black/5 flex justify-between items-center z-10 sticky top-0 shrink-0">
       <div className="flex items-center gap-3">
         <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
           <Store size={18} className="text-white" strokeWidth={2} />
         </div>
         <div className="leading-tight">
           <h2 className="text-[17px] font-semibold text-black tracking-tight">{merchantTag}</h2>
           <p className="text-[12px] font-medium text-[#86868b]">Active Terminal</p>
         </div>
       </div>
       <button onClick={() => setCurrentView('login')} className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-black active:bg-zinc-200 transition-colors">
         <LogOut size={14} strokeWidth={2.5} />
       </button>
     </div>


     <div className="p-6 flex-1 flex flex-col overflow-y-auto pb-8 min-h-0">
       <div className="mb-3 ml-2 shrink-0">
         <p className="text-[12px] font-semibold text-[#86868b] uppercase tracking-widest">{dateString}</p>
       </div>


       <div className="bg-black rounded-[24px] p-6 text-white shadow-lg mb-6 relative overflow-hidden shrink-0">
         <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
        
         <div className="relative z-10 flex items-center justify-between">
           <div className="flex-1">
             <div className="flex items-center gap-1.5 mb-2">
               <div className="w-6 h-6 rounded-full bg-[#1562f0]/20 flex items-center justify-center">
                 <ArrowDownToLine size={12} className="text-[#1562f0]" strokeWidth={2.5}/>
               </div>
               <p className="text-[13px] font-medium text-[#86868b]">Charges</p>
             </div>
             <p className="text-[28px] font-semibold tracking-tight leading-none mb-1">$845<span className="text-[18px] text-[#86868b]">.00</span></p>
             <p className="text-[12px] font-medium text-[#86868b]">CAD</p>
           </div>
          
           <div className="w-[1px] h-16 bg-white/10 mx-2"></div>


           <div className="flex-1 pl-4">
             <div className="flex items-center gap-1.5 mb-2">
               <div className="w-6 h-6 rounded-full bg-[#34C759]/20 flex items-center justify-center">
                 <ArrowUpFromLine size={12} className="text-[#34C759]" strokeWidth={2.5}/>
               </div>
               <p className="text-[13px] font-medium text-[#86868b]">Top-Ups</p>
             </div>
             <p className="text-[28px] font-semibold tracking-tight leading-none mb-1">$400<span className="text-[18px] text-[#86868b]">.00</span></p>
             <p className="text-[12px] font-medium text-[#86868b]">CAD</p>
           </div>
         </div>
       </div>


       <div className="flex-1 flex flex-col gap-4 shrink-0">
         <button
           onClick={() => { setMode('charge'); setAmount('0'); setSelectedTipRate(0); setTxStatus('pending'); setCurrentView('amount'); }}
           className="w-full bg-white rounded-[24px] p-6 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all"
         >
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-[#1562f0]/10 rounded-full flex items-center justify-center text-[#1562f0]">
               <ArrowDownToLine size={24} strokeWidth={2} />
             </div>
             <div className="text-left">
               <h3 className="text-[20px] font-semibold text-black tracking-tight">Charge</h3>
               <p className="text-[13px] font-medium text-[#86868b] mt-0.5">Accept NFC or Scan QR</p>
             </div>
           </div>
           <ChevronRight size={20} className="text-[#c7c7cc]" />
         </button>


         <button
           onClick={() => { setMode('topup'); setAmount('0'); setTxStatus('pending'); setCurrentView('amount'); }}
           className="w-full bg-white rounded-[24px] p-6 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all"
         >
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center text-[#34C759]">
               <ArrowUpFromLine size={24} strokeWidth={2} />
             </div>
             <div className="text-left">
               <h3 className="text-[20px] font-semibold text-black tracking-tight">Top-Up (New/Reload)</h3>
               <p className="text-[13px] font-medium text-[#86868b] mt-0.5">Load balance & activate tiers</p>
             </div>
           </div>
           <ChevronRight size={20} className="text-[#c7c7cc]" />
         </button>


         <button
           onClick={() => { setMode('balance'); setScanMethod('nfc'); setTxStatus('pending'); setCurrentView('scanning'); }}
           className="w-full bg-white rounded-[24px] p-6 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all"
         >
           <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center text-black">
               <Search size={24} strokeWidth={2} />
             </div>
             <div className="text-left">
               <h3 className="text-[20px] font-semibold text-black tracking-tight">Check Balance</h3>
               <p className="text-[13px] font-medium text-[#86868b] mt-0.5">Read card via NFC</p>
             </div>
           </div>
           <ChevronRight size={20} className="text-[#c7c7cc]" />
         </button>
       </div>
     </div>
   </div>
 );


 const renderAmountInput = () => (
   <div className="flex-1 flex flex-col bg-[#f5f5f7]">
     <div className="pt-14 px-4 pb-4 flex justify-between items-center bg-[#f5f5f7] shrink-0">
       <button onClick={() => setCurrentView('home')} className="flex items-center text-[#1562f0] active:opacity-50 transition-opacity">
         <ArrowLeft size={24} strokeWidth={2} />
         <span className="text-[17px] ml-1 font-medium">返回</span>
       </button>
       <span className="font-semibold text-[17px] text-black">
         {mode === 'charge' ? 'Charge Amount' : 'Top-Up Amount'}
       </span>
       <div className="w-16"></div>
     </div>


     <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
       <div className="text-[72px] font-light text-black tracking-tighter flex items-center">
          <span className="text-4xl mr-1 text-[#86868b]">$</span>{amount}
       </div>
     </div>


     <div className="px-6 pb-12 pt-6 shrink-0">
       <div className="grid grid-cols-3 gap-x-4 gap-y-4 mb-8 max-w-[300px] mx-auto">
         {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'back'].map(val => (
           <button
             key={val}
             onClick={() => handlePadClick(val.toString())}
             className="w-[72px] h-[72px] mx-auto bg-white text-black text-[28px] font-normal rounded-full active:bg-[#e5e5ea] transition-colors shadow-sm flex items-center justify-center"
           >
             {val === 'back' ? <ArrowLeft size={24} strokeWidth={2} /> : val}
           </button>
         ))}
       </div>
       <button
         onClick={() => setCurrentView(mode === 'charge' ? 'tip' : 'scanning')}
         disabled={amount === '0' || amount === '0.'}
         className={`w-full py-4 rounded-[16px] font-semibold text-[17px] flex items-center justify-center gap-2 transition-all duration-300 ${
           amount === '0' || amount === '0.'
           ? 'bg-[#e5e5ea] text-[#86868b] cursor-not-allowed'
           : mode === 'charge' ? 'bg-black text-white shadow-md active:scale-[0.98]' : 'bg-[#1562f0] text-white shadow-md active:scale-[0.98]'
         }`}
       >{tu('continue')}</button>
     </div>
   </div>
 );


 const renderTipSelection = () => (
   <div className="flex-1 flex flex-col bg-[#f5f5f7] animate-in slide-in-from-right-4 duration-300">
     <div className="pt-14 px-4 pb-4 flex justify-between items-center bg-[#f5f5f7] shrink-0">
       <button onClick={() => setCurrentView('amount')} className="flex items-center text-[#1562f0] active:opacity-50 transition-opacity">
         <ArrowLeft size={24} strokeWidth={2} />
         <span className="text-[17px] ml-1 font-medium">返回</span>
       </button>
       <span className="font-semibold text-[17px] text-black">Add Tip</span>
       <div className="w-16"></div>
     </div>


     <div className="flex-1 flex flex-col px-6 pb-12 min-h-0">
       <div className="text-center mt-2 mb-6 shrink-0">
          <div className="inline-flex items-center justify-center bg-black/5 px-3 py-1.5 rounded-full mb-4 gap-1.5">
            <Heart size={14} className="text-[#1562f0]" />
            <span className="text-[12px] font-semibold text-[#86868b] uppercase tracking-widest">Present to Customer</span>
          </div>
          <p className="text-[15px] font-medium text-[#86868b] mb-1">Subtotal</p>
          <p className="text-[48px] font-light text-black tracking-tighter leading-none">${numAmount.toFixed(2)}</p>
       </div>


       <div className="grid grid-cols-2 gap-4 mb-6 shrink-0">
         {[0.15, 0.18, 0.20].map(rate => (
           <button
             key={rate}
             onClick={() => setSelectedTipRate(rate)}
             className={`py-6 rounded-[24px] border-[2px] transition-all flex flex-col items-center justify-center ${selectedTipRate === rate ? 'border-[#1562f0] bg-[#1562f0]/10' : 'border-transparent bg-white shadow-sm active:scale-[0.98]'}`}
           >
             <p className={`text-[24px] font-semibold ${selectedTipRate === rate ? 'text-[#1562f0]' : 'text-black'}`}>{rate * 100}%</p>
             <p className={`text-[15px] font-medium mt-1 ${selectedTipRate === rate ? 'text-[#1562f0]/80' : 'text-[#86868b]'}`}>+${(numAmount * rate).toFixed(2)}</p>
           </button>
         ))}
         <button
           onClick={() => setSelectedTipRate(0)}
           className={`py-6 rounded-[24px] border-[2px] transition-all flex flex-col items-center justify-center ${selectedTipRate === 0 ? 'border-[#1562f0] bg-[#1562f0]/10' : 'border-transparent bg-white shadow-sm active:scale-[0.98]'}`}
         >
           <p className={`text-[20px] font-semibold ${selectedTipRate === 0 ? 'text-[#1562f0]' : 'text-black'}`}>No Tip</p>
           <p className={`text-[15px] font-medium mt-1 ${selectedTipRate === 0 ? 'text-[#1562f0]/80' : 'text-[#86868b]'}`}>+$0.00</p>
         </button>
       </div>


       <div className="mt-auto bg-black text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden shrink-0">
         <div className="absolute top-0 right-0 w-40 h-40 bg-[#1562f0]/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
         <div className="relative z-10">
           <div className="flex justify-between items-end mb-6">
             <span className="text-[15px] font-medium text-[#86868b]">Total to Pay</span>
             <span className="text-[40px] font-semibold tracking-tight leading-none">${originalTotalAmount.toFixed(2)}</span>
           </div>
           <button
             onClick={() => setCurrentView('scanning')}
             className="w-full py-4 bg-white text-black rounded-[20px] font-semibold text-[17px] active:scale-[0.98] transition-transform shadow-sm flex items-center justify-center gap-2"
           >
             Confirm & Pay <ChevronRight size={20} />
           </button>
         </div>
       </div>
     </div>
   </div>
 );


 const renderScanning = () => (
   <div className={`flex-1 flex flex-col bg-black text-white transition-colors duration-500`}>
    
     {/* Top Toggle: Dynamic text based on Top-Up vs Charge */}
     {mode !== 'balance' && (
       <div className="pt-14 px-6 pb-2 shrink-0 flex justify-center z-30">
         <div className="bg-white/10 p-1.5 rounded-full flex gap-1 backdrop-blur-xl border border-white/10">
           <button
             onClick={() => setScanMethod('nfc')}
             className={`px-5 py-2.5 rounded-full text-[14px] font-semibold transition-all flex items-center gap-2 ${scanMethod === 'nfc' ? 'bg-white text-black shadow-md' : 'text-white/70 hover:text-white'}`}
           >
             <Nfc size={16} /> Tap Card
           </button>
           <button
             onClick={() => setScanMethod('qr')}
             className={`px-5 py-2.5 rounded-full text-[14px] font-semibold transition-all flex items-center gap-2 ${scanMethod === 'qr' ? 'bg-white text-black shadow-md' : 'text-white/70 hover:text-white'}`}
           >
             <QrCode size={16} /> {mode === 'topup' ? '显示二维码' : 'Scan QR'}
           </button>
         </div>
       </div>
     )}


     {/* DYNAMIC SENSOR AREA */}
     <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center relative z-20 px-8 py-6">
      
       {scanMethod === 'nfc' ? (
         <>
           {/* --- NFC SCANNING UI --- */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className={`w-[200px] h-[200px] rounded-full absolute ${isScanning ? 'animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] border-[2px] border-[#1562f0]/40' : 'border border-white/10'}`}></div>
             <div className={`w-[300px] h-[300px] rounded-full absolute ${isScanning ? 'animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] border-[2px] border-[#1562f0]/20' : 'border border-white/5'}`}></div>
           </div>


           <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md mb-8 relative z-20">
              <Nfc size={40} strokeWidth={1.5} className={isScanning ? 'animate-pulse text-[#1562f0]' : 'text-white'} />
           </div>
           <h2 className="text-[24px] font-semibold tracking-tight mb-2 relative z-20">
             {isScanning ? 'Verifying...' : '准备扫描'}
           </h2>
           <p className="text-[15px] font-normal text-[#86868b] text-center max-w-[260px] leading-relaxed relative z-20">
             Hold the customer's {mode === 'topup' ? '(blank) ' : ''}NTAG 424 DNA card near the top of iPhone.
           </p>
         </>
       ) : mode === 'topup' ? (
         <>
           {/* --- NEW: QR GENERATION UI (C Scans B for Top-Up) --- */}
           <div className={`bg-white p-6 rounded-[32px] mb-8 relative transition-shadow duration-500 ${isScanning ? 'shadow-[0_0_60px_rgba(21,98,240,0.5)]' : 'shadow-none'}`}>
             <QrCode size={180} className="text-black" strokeWidth={1} />
            
             {/* Beamio Logo Overlay in Center of QR */}
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border-4 border-white">
                   <span className="text-white font-black italic text-lg">B</span>
                </div>
             </div>


             {/* Scanning Overlay Effect */}
             {isScanning && (
               <div className="absolute inset-0 bg-[#1562f0]/10 rounded-[32px] flex items-center justify-center backdrop-blur-[2px]">
                 <CheckCircle2 size={48} className="text-[#1562f0] animate-in zoom-in duration-300" strokeWidth={2.5}/>
               </div>
             )}
           </div>
           <h2 className="text-[24px] font-semibold tracking-tight mb-3 text-center relative z-20">
             {isScanning ? '已收款' : 'Customer Scan to Pay'}
           </h2>
           <div className="flex flex-col items-center">
             <p className="text-[15px] font-normal text-[#86868b] text-center max-w-[280px] leading-relaxed relative z-20">
               Scan with Beamio App to reload instantly.
             </p>
             <div className="mt-4 flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
               <Smartphone size={14} className="text-[#1562f0]" />
               <span className="text-[12px] font-medium text-[#86868b]">No app? Native camera opens Web App.</span>
             </div>
           </div>
         </>
       ) : (
         <>
           {/* --- QR CAMERA VIEWFINDER (B Scans C for Charge) --- */}
           <div className="w-full max-w-[260px] aspect-square border-2 border-white/10 rounded-[32px] relative mb-8 overflow-hidden bg-white/5 backdrop-blur-sm mx-auto">
             <div className="absolute top-0 left-0 w-12 h-12 border-t-[4px] border-l-[4px] border-[#1562f0] rounded-tl-[32px]"></div>
             <div className="absolute top-0 right-0 w-12 h-12 border-t-[4px] border-r-[4px] border-[#1562f0] rounded-tr-[32px]"></div>
             <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[4px] border-l-[4px] border-[#1562f0] rounded-bl-[32px]"></div>
             <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[4px] border-r-[4px] border-[#1562f0] rounded-br-[32px]"></div>
             <div className={`w-full h-[2px] bg-[#1562f0] shadow-[0_0_15px_#1562f0] absolute top-1/2 -translate-y-1/2 ${isScanning ? 'animate-ping' : 'animate-[bounce_3s_infinite]'}`}></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <ScanLine size={48} className={isScanning ? 'text-[#1562f0]' : 'text-white/20'} strokeWidth={1} />
             </div>
           </div>
           <h2 className="text-[24px] font-semibold tracking-tight mb-2 text-center relative z-20">
             {isScanning ? 'Decoding...' : 'Scan Dynamic QR'}
           </h2>
           <p className="text-[15px] font-normal text-[#86868b] text-center max-w-[260px] leading-relaxed mx-auto relative z-20">
             Position the customer's Beamio App payment code in the frame.
           </p>
         </>
       )}
     </div>


     {/* Bottom Actions */}
     <div className="w-full px-6 pb-12 pt-6 shrink-0 bg-black z-30 border-t border-white/5">
       {mode !== 'balance' && (
         <div className="flex flex-col items-center mb-6">
            <p className="text-[13px] font-medium text-[#86868b] mb-1 uppercase tracking-widest">{mode === 'charge' ? 'Total Amount' : 'Top-Up Amount'}</p>
            <p className="text-[40px] font-semibold tracking-tight leading-none">${originalTotalAmount.toFixed(2)}</p>
         </div>
       )}


       <button
         onClick={scanMethod === 'nfc' ? simulateNFCTap : simulateQRScan}
         disabled={isScanning}
         className="w-full py-4 bg-white/10 text-white backdrop-blur-xl font-semibold rounded-[16px] active:scale-[0.98] transition-transform text-[17px] mb-4 border border-white/10"
       >
         {/* Dynamic Button Text based on contextual action */}
         [Simulate {scanMethod === 'nfc' ? 'NFC Tap' : (mode === 'topup' ? 'Customer Scan' : 'QR Scan')}]
       </button>


       <button
         onClick={() => setCurrentView(mode === 'balance' ? 'home' : (mode === 'charge' ? 'tip' : 'amount'))}
         className="w-full py-4 text-[#1562f0] font-medium text-[17px] active:opacity-50 transition-opacity"
       >{tu('cancel')}</button>
     </div>
   </div>
 );


 const renderSuccess = () => {
   // Logic: In charge mode, mock user holding some balances. In top-up mode, assume blank card (0) for new activation showcase.
   const initialVoucherBalance = mode === 'topup' ? 0.00 : (scanMethod === 'nfc' ? 40.00 : 0.00);
   const initialUSDCBalance = scanMethod === 'nfc' ? 20.00 : 1000.00;


   // Tier Setup
   const greenDiscount = 0.10;
   const blackDiscount = 0.20;
   const blackTierThreshold = 100.00;


   // Resolution calculations
   const greenSubtotal = numAmount * (1 - greenDiscount);
   const greenTotalRequired = greenSubtotal + tipValue;
   const topUpRequiredForGreen = Math.max(0, greenTotalRequired - initialVoucherBalance);


   const blackSubtotal = numAmount * (1 - blackDiscount);
   const blackTotalRequired = blackSubtotal + tipValue;
   const topUpRequiredForBlack = Math.max(blackTierThreshold, blackTotalRequired - initialVoucherBalance);


   // 1. DYNAMIC SHORTFALL / UPSELL VIEW (Charge Mode Only)
   if (txStatus === 'shortfall') {
     return (
       <div className="flex-1 flex flex-col bg-[#f5f5f7] relative overflow-hidden animate-in slide-in-from-right-4">
          <div className="pt-16 pb-4 flex flex-col items-center justify-center px-6 text-center shrink-0">
             <div className="w-[72px] h-[72px] bg-[#FF9F0A] rounded-full flex items-center justify-center shadow-sm mb-3">
                <AlertTriangle size={36} className="text-white" strokeWidth={2.5} />
             </div>
             <h2 className="text-[22px] font-semibold text-black tracking-tight">Balance Too Low</h2>
             <p className="text-[14px] font-medium text-[#86868b] mt-1 leading-snug">
               Current Balance: <span className="text-black font-bold">${initialVoucherBalance.toFixed(2)}</span>
             </p>
          </div>


          <div className="px-6 flex-1 overflow-y-auto min-h-0 pb-6 space-y-4">
             <div className="bg-gradient-to-br from-zinc-900 to-black rounded-[24px] p-6 shadow-xl relative overflow-hidden border border-white/10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="relative z-10">
                   <div className="flex justify-between items-center mb-1">
                     <div className="flex items-center gap-1.5 text-yellow-500">
                       <Crown size={18} fill="currentColor" />
                       <span className="font-bold text-[14px] uppercase tracking-widest">Upgrade to Black</span>
                     </div>
                     <span className="bg-yellow-500 text-black px-2 py-0.5 rounded text-[10px] font-bold">20% OFF</span>
                   </div>
                   <p className="text-[#86868b] text-[13px] mb-4">Top up $100 to unlock max discount.</p>
                  
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-[14px] text-[#86868b]">New Bill Total</span>
                      <span className="text-[14px] font-bold text-white">${blackTotalRequired.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between items-center mb-5">
                      <span className="text-[14px] text-[#86868b]">Top-Up Amount</span>
                      <span className="text-[20px] font-bold text-yellow-500">+${topUpRequiredForBlack.toFixed(2)}</span>
                   </div>


                   <button
                     onClick={() => setTxStatus('success_black_topped_up')}
                     className="w-full py-3.5 bg-white text-black rounded-[16px] font-semibold text-[15px] active:scale-[0.98] transition-transform shadow-sm"
                   >
                      Top-Up ${topUpRequiredForBlack.toFixed(2)} & Pay
                   </button>
                </div>
             </div>


             <div className="bg-white rounded-[24px] p-6 shadow-sm border border-black/5">
                <div className="flex justify-between items-center mb-1">
                   <span className="font-bold text-[14px] uppercase tracking-widest text-[#34C759]">Keep Green Card</span>
                   <span className="bg-[#34C759]/10 text-[#34C759] px-2 py-0.5 rounded text-[10px] font-bold">10% OFF</span>
                </div>
                <p className="text-[#86868b] text-[13px] mb-4">Top up exactly what's needed.</p>


                <div className="flex justify-between items-center mb-1">
                   <span className="text-[14px] text-[#86868b]">New Bill Total</span>
                   <span className="text-[14px] font-bold text-black">${greenTotalRequired.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-5">
                   <span className="text-[14px] text-[#86868b]">Top-Up Required</span>
                   <span className="text-[18px] font-bold text-[#1562f0]">+${topUpRequiredForGreen.toFixed(2)}</span>
                </div>


                <button
                   onClick={() => setTxStatus('success_green_topped_up')}
                   className="w-full py-3.5 bg-[#1562f0]/10 text-[#1562f0] rounded-[16px] font-semibold text-[15px] active:scale-[0.98] transition-transform"
                 >
                    Top-Up ${topUpRequiredForGreen.toFixed(2)} & Pay
                 </button>
             </div>


             <div className="pt-2">
               <button
                 onClick={() => setTxStatus('success_no_discount')}
                 className="w-full py-4 text-[#86868b] font-medium text-[15px] active:opacity-50 transition-opacity"
               >
                  Pay Original ${originalTotalAmount.toFixed(2)} (Lose Discount)
               </button>
             </div>
          </div>
       </div>
     );
   }


   let finalPaidByVoucher = 0;
   let finalPaidByUSDC = 0;
   let finalShortfall = 0;
   let finalNewVoucherBalance = initialVoucherBalance;
   let displayedReceiptTotal = originalTotalAmount;
   let showsDiscount = false;
   let appliedDiscountRate = 0;
   let discountLabel = "";


   if (txStatus === 'success_green_topped_up' || txStatus === 'success_nfc_green') {
      finalPaidByVoucher = greenTotalRequired;
      finalNewVoucherBalance = txStatus === 'success_green_topped_up' ? 0 : initialVoucherBalance - greenTotalRequired;
      displayedReceiptTotal = greenTotalRequired;
      showsDiscount = true;
      appliedDiscountRate = greenDiscount;
      discountLabel = "Green Card";
   } else if (txStatus === 'success_black_topped_up') {
      finalPaidByVoucher = blackTotalRequired;
      finalNewVoucherBalance = initialVoucherBalance + topUpRequiredForBlack - blackTotalRequired;
      displayedReceiptTotal = blackTotalRequired;
      showsDiscount = true;
      appliedDiscountRate = blackDiscount;
      discountLabel = "Black Card";
   } else if (txStatus === 'success_no_discount') {
      finalPaidByVoucher = initialVoucherBalance;
      finalPaidByUSDC = Math.min(originalTotalAmount - finalPaidByVoucher, initialUSDCBalance);
      finalShortfall = originalTotalAmount - finalPaidByVoucher - finalPaidByUSDC;
      finalNewVoucherBalance = 0;
      displayedReceiptTotal = originalTotalAmount;
   } else if (txStatus === 'success_qr') {
      finalPaidByUSDC = originalTotalAmount;
      displayedReceiptTotal = originalTotalAmount;
   } else if (mode === 'topup' || txStatus.includes('topup_')) {
      finalNewVoucherBalance = initialVoucherBalance + originalTotalAmount;
      displayedReceiptTotal = originalTotalAmount;
   } else if (mode === 'balance') {
      finalNewVoucherBalance = initialVoucherBalance;
   }


   return (
     <div className="flex-1 flex flex-col bg-[#f5f5f7] relative overflow-hidden animate-in fade-in duration-500">
      
       <div className="pt-12 pb-4 flex flex-col items-center justify-center shrink-0">
         <div className="w-[80px] h-[80px] bg-white rounded-full flex items-center justify-center shadow-sm mb-4 animate-in zoom-in duration-500 delay-150">
           <CheckCircle2 size={48} className="text-[#34C759]" strokeWidth={2} />
         </div>
         <h2 className="text-[24px] font-semibold text-black mb-1 tracking-tight">
           {mode === 'charge' ? 'Payment Approved' : mode === 'topup' ? 'Top-Up Complete' : 'Balance Checked'}
         </h2>
        
         {mode !== 'balance' && (
            <div className="flex flex-col items-center mt-1">
              <div className="flex items-center">
                <span className="text-[20px] text-[#86868b] mr-1 font-medium">{mode === 'charge' ? '-' : '+'}</span>
                <span className="text-[48px] font-light text-black tracking-tight leading-none">
                  {displayedReceiptTotal.toFixed(2)}
                </span>
              </div>
              {mode === 'charge' && tipValue > 0 && (
                <span className="text-[13px] font-medium text-[#86868b] mt-2">
                  (Includes ${(tipValue).toFixed(2)} Tip)
                </span>
              )}
            </div>
         )}
       </div>


       <div className="px-6 flex-1 overflow-y-auto min-h-0 pb-4 space-y-5">
        
         {(txStatus === 'topup_black_unlocked' || txStatus === 'topup_green_unlocked') && (
           <div className={`rounded-[24px] p-6 shadow-xl relative overflow-hidden border ${txStatus === 'topup_black_unlocked' ? 'bg-gradient-to-br from-zinc-900 to-black border-white/10 text-white' : 'bg-gradient-to-br from-emerald-50 to-[#e8f6ed] border-[#34C759]/20 text-emerald-900'}`}>
             <div className="relative z-10">
               <div className="flex items-center gap-2 mb-2">
                 <Sparkles size={20} className={txStatus === 'topup_black_unlocked' ? 'text-yellow-500' : 'text-emerald-500'} />
                 <span className={`font-bold text-[14px] uppercase tracking-widest ${txStatus === 'topup_black_unlocked' ? 'text-yellow-500' : 'text-emerald-700'}`}>
                   Card Activated
                 </span>
               </div>
               <h3 className="text-[22px] font-bold tracking-tight mb-1">
                 {txStatus === 'topup_black_unlocked' ? 'Black Tier Unlocked!' : 'Green Tier Unlocked!'}
               </h3>
               <p className={`text-[14px] leading-snug font-medium ${txStatus === 'topup_black_unlocked' ? 'text-zinc-400' : 'text-emerald-700/70'}`}>
                 Customer now enjoys {txStatus === 'topup_black_unlocked' ? '20%' : '10%'} off all future purchases at CashTrees.
               </p>
             </div>
             {txStatus === 'topup_black_unlocked' && (
               <Crown size={120} strokeWidth={1} className="absolute -bottom-8 -right-8 text-yellow-500/10 pointer-events-none" />
             )}
             {txStatus === 'topup_green_unlocked' && (
               <Ticket size={120} strokeWidth={1} className="absolute -bottom-8 -right-8 text-emerald-500/10 pointer-events-none" />
             )}
           </div>
         )}


         {finalShortfall > 0 && (
           <div className="bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-[24px] p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-2">
               <AlertTriangle size={18} className="text-[#FF9F0A]" strokeWidth={2.5} />
               <span className="font-semibold text-[#FF9F0A] text-[14px] uppercase tracking-widest">Collect Remainder</span>
             </div>
             <div className="flex justify-between items-end mt-4">
               <div>
                 <p className="text-[13px] text-[#86868b] font-medium leading-snug">Voucher drained.<br/>Charge via external terminal.</p>
               </div>
               <div className="text-right">
                 <p className="text-[11px] text-[#FF9F0A] font-bold uppercase tracking-widest mb-0.5">Amount Due</p>
                 <p className="text-[32px] font-semibold text-black tracking-tight leading-none">${finalShortfall.toFixed(2)}</p>
               </div>
             </div>
           </div>
         )}


         <div className="bg-black rounded-[24px] p-6 text-white shadow-xl flex items-center justify-between relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
           <div className="relative z-10">
             <p className="text-[13px] font-medium text-[#86868b] mb-1 uppercase tracking-widest">
               {finalNewVoucherBalance >= 100 || txStatus === 'success_black_topped_up' ? 'Black Card Balance' : finalNewVoucherBalance >= 50 ? 'Green Card Balance' : 'Card Balance'}
             </p>
             <p className="text-[38px] font-semibold tracking-tight leading-none">${finalNewVoucherBalance.toFixed(2)}</p>
           </div>
          
           <button
             onClick={() => {
               setIsPrinting(true);
               setTimeout(() => setIsPrinting(false), 1500);
             }}
             disabled={isPrinting}
             className={`relative z-10 w-[64px] h-[64px] rounded-[20px] flex flex-col items-center justify-center transition-all ${isPrinting ? 'bg-white text-black' : 'bg-[#1c1c1e] border border-white/10 text-white hover:bg-[#2c2c2e] active:scale-95'}`}
           >
             <Printer size={24} strokeWidth={2} className={isPrinting ? "animate-bounce" : ""} />
             <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">{isPrinting ? '...' : '打印'}</span>
           </button>
         </div>


         {txStatus === 'success_qr' && mode === 'charge' && (
           <div className="bg-gradient-to-br from-zinc-900 to-black rounded-[24px] p-6 shadow-xl border border-white/10 relative overflow-hidden">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-yellow-500 text-black px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-widest">App Exclusive</div>
                </div>
                <p className="text-white font-semibold text-[17px] mb-1">
                  Qualify for {originalTotalAmount >= 100 ? 'Black' : 'Green'} Card!
                </p>
                <p className="text-[#86868b] text-[13px] mb-5 leading-relaxed">
                  Top-up ${originalTotalAmount >= 100 ? '100' : '50'} in your Beamio App now to unlock {originalTotalAmount >= 100 ? '20%' : '10%'} off your next CashTrees visits.
                </p>
                <button className="w-full bg-white text-black py-3.5 rounded-[16px] font-semibold text-[15px] active:scale-[0.98] transition-transform shadow-sm flex justify-center items-center gap-2">
                  <TrendingUp size={16}/> Send Top-Up Offer
                </button>
             </div>
           </div>
         )}


         <div className="bg-white rounded-[20px] shadow-sm overflow-hidden border border-black/5">
          
           {mode === 'charge' && (finalPaidByVoucher > 0 || finalPaidByUSDC > 0 || finalShortfall > 0) && (
             <div className="px-5 py-5 border-b border-black/5 bg-[#f8f9fa]">
               <div className="flex items-center gap-2 mb-4">
                 <Activity size={16} className="text-[#1562f0]" />
                 <span className="text-[13px] font-bold text-[#1562f0] uppercase tracking-widest">Smart Routing Engine</span>
               </div>
               <div className="space-y-4">
                
                 {showsDiscount && (
                   <div className="flex justify-between items-center">
                     <span className="text-[15px] text-[#34C759] flex items-center gap-2">
                       {discountLabel === 'Black Card' ? <Crown size={16} strokeWidth={2.5}/> : <Ticket size={16} strokeWidth={2}/>}
                       {discountLabel}
                     </span>
                     <span className="text-[15px] font-bold text-[#34C759]">-{appliedDiscountRate * 100}%</span>
                   </div>
                 )}


                 {finalPaidByVoucher > 0 && (
                   <div className="flex justify-between items-center">
                     <span className="text-[15px] text-[#86868b] flex items-center gap-2"><Ticket size={16} strokeWidth={2}/> Voucher Deduction</span>
                     <span className="text-[15px] font-medium text-black">-${finalPaidByVoucher.toFixed(2)}</span>
                   </div>
                 )}
                
                 {finalPaidByUSDC > 0 && (
                   <div className="flex justify-between items-center">
                     <span className="text-[15px] text-[#86868b] flex items-center gap-2">
                       <Coins size={16} strokeWidth={2}/> USDC Deduction
                       <span className="text-[10px] bg-[#e5e5ea] px-1.5 py-0.5 rounded-md text-[#86868b] ml-1 font-bold">Oracle</span>
                     </span>
                     <span className="text-[15px] font-medium text-black">-${finalPaidByUSDC.toFixed(2)}</span>
                   </div>
                 )}
               </div>
             </div>
           )}


           <div className="px-5 py-4 border-b border-black/5 flex justify-between items-center bg-white">
             <span className="text-[15px] text-[#86868b]">Date</span>
             <span className="text-[15px] font-medium text-black text-right">{dateString}, {timeString}</span>
           </div>
          
           <div className="px-5 py-4 border-b border-black/5 flex justify-between items-center bg-white">
             <span className="text-[15px] text-[#86868b]">安全</span>
             <span className="text-[15px] font-medium text-[#34C759] flex items-center gap-1">
               <ShieldCheck size={14}/>
               {scanMethod === 'nfc' ? 'NTAG 424 DNA' : 'Beamio App (Dynamic QR)'}
             </span>
           </div>
          
           {mode !== 'balance' && (
             <div className="px-5 py-4 flex justify-between items-center bg-white">
               <span className="text-[15px] text-[#86868b]">TX Hash</span>
               <span className="text-[13px] font-mono text-[#1562f0] truncate w-32 text-right">0xab89f...4f1e</span>
             </div>
           )}
         </div>


         {mode === 'charge' && finalShortfall === 0 && (
           <div className="bg-[#1562f0]/10 rounded-[16px] p-4 flex items-start gap-3 border border-[#1562f0]/20 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
              <div className="mt-0.5 text-[#1562f0]">
                <CheckCircle2 size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-black tracking-tight">Smart Receipt Generated</p>
                <p className="text-[13px] text-[#86868b] leading-snug mt-1 font-medium">
                  Transaction secured on CoNET. Users with the Beamio App can view their history asynchronously.
                </p>
              </div>
           </div>
         )}
       </div>


       <div className="p-6 pt-4 pb-12 bg-[#f5f5f7] shrink-0 z-10">
         {mode === 'balance' && (
           <button
             onClick={() => { setMode('topup'); setAmount('0'); setCurrentView('amount'); }}
             className="w-full bg-[#1562f0] hover:bg-blue-700 text-white py-4 rounded-[16px] font-semibold text-[17px] active:scale-[0.98] transition-all shadow-md flex justify-center items-center gap-2 mb-3"
           >
             <PlusCircle size={20} /> Top-Up Card Now
           </button>
         )}


         <button
           onClick={() => setCurrentView('home')}
           className={`w-full ${mode === 'balance' ? 'bg-[#e5e5ea] text-black hover:bg-[#d1d1d6]' : 'bg-black text-white'} py-4 rounded-[16px] font-semibold text-[17px] active:scale-[0.98] transition-transform shadow-sm`}
         >{tu('done')}</button>
       </div>
     </div>
   );
 };


 return (
   <div className="flex items-center justify-center min-h-screen bg-zinc-200 p-4 font-sans">
     <div className="w-full max-w-[393px] h-[852px] bg-black rounded-[55px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col border-[8px] border-zinc-800 relative ring-4 ring-zinc-300">
      
       <div className="absolute top-3 inset-x-0 flex justify-center z-50 pointer-events-none">
         <div className="w-[120px] h-[32px] bg-black rounded-full flex justify-end items-center px-3">
            <div className="w-2.5 h-2.5 bg-[#141414] rounded-full border border-white/10"></div>
         </div>
       </div>


       <div className="flex-1 bg-black overflow-hidden flex flex-col rounded-[47px]">
         {currentView === 'login' && renderLogin()}
         {currentView === 'home' && renderHome()}
         {currentView === 'amount' && renderAmountInput()}
         {currentView === 'tip' && renderTipSelection()}
         {currentView === 'scanning' && renderScanning()}
         {currentView === 'success' && renderSuccess()}
       </div>


       <div className="absolute bottom-2 inset-x-0 flex justify-center z-50 pointer-events-none">
         <div className="w-32 h-1 bg-black/40 rounded-full dark:bg-white/40"></div>
       </div>
     </div>
   </div>
 );
}

