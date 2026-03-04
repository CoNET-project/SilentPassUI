import React, { useState, useEffect } from 'react';
import {
 Search,
 ShieldCheck,
 CheckCircle2,
 X,
 ChevronRight,
 ChevronLeft,
 Zap,
 Scan,
 Plus,
 Cpu,
 Lock,
 Activity,
 QrCode,
 Smartphone,
 Check,
 ArrowLeft,
 Heart,
 Crown,
 Delete,
 Wallet,
 ArrowDownLeft, // FIXED: Added missing import
 ArrowUpRight   // FIXED: Added missing import
} from 'lucide-react';


const App = () => {
 type View =
   | 'home'
   | 'keypad'
   | 'tip'
   | 'scanning'
   | 'verifying'
   | 'result_verify'
   | 'result_topup'
   | 'result_issue'
   | 'result_charge';
 type Workflow = 'verify' | 'load_issue' | 'charge' | '';
 type ScanMode = 'nfc' | 'qr';

 const [view, setView] = useState<View>('home');
 const [loadingProgress, setLoadingProgress] = useState(0);
 const [activeWorkflow, setActiveWorkflow] = useState<Workflow>(''); // 'verify', 'load_issue', 'charge'
 const [scanMode, setScanMode] = useState<ScanMode>('nfc'); // 'nfc', 'qr'
 const [cryptoHash, setCryptoHash] = useState('0x0000000000000000');
  // Business Logic States
 const [keypadAmount, setKeypadAmount] = useState('0');
 const [tipPercentage, setTipPercentage] = useState(15);


 // Amount Calculations
 const subtotal = Number(keypadAmount) / 100;
 const tipAmount = activeWorkflow === 'charge' ? subtotal * (tipPercentage / 100) : 0;
 const totalToPay = subtotal + tipAmount;


 // Beamio Brand Color
 const brandBlue = "#1562f0";


 // Navigation Handlers
 const startWorkflow = (type: Exclude<Workflow, ''>) => {
   setActiveWorkflow(type);
   if (type === 'verify') {
     setView('scanning');
   } else {
     setKeypadAmount('0');
     setTipPercentage(15);
     setView('keypad');
   }
 };


 const handleKeypadInput = (val: string) => {
   if (val === 'delete') {
     setKeypadAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
   } else if (val === '00') {
     setKeypadAmount(prev => prev === '0' ? '0' : prev + '00');
   } else {
     if (keypadAmount.length < 6) {
       setKeypadAmount(prev => prev === '0' ? val : prev + val);
     }
   }
 };


 const proceedFromKeypad = () => {
   if (subtotal === 0) return;
   if (activeWorkflow === 'charge') {
     setView('tip');
   } else {
     setView('scanning');
   }
 };


 const handleInteraction = () => {
   setView('verifying');
 };


 // Cryptographic Scramble Effect & Routing
 useEffect(() => {
  let hashInterval: ReturnType<typeof setInterval> | undefined;
  let progressInterval: ReturnType<typeof setInterval> | undefined;


   if (view === 'verifying') {
     hashInterval = setInterval(() => {
       const randomHash = '0x' + Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');
       setCryptoHash(randomHash);
     }, 50);


     progressInterval = setInterval(() => {
       setLoadingProgress(prev => {
         if (prev >= 100) {
           clearInterval(progressInterval);
           clearInterval(hashInterval);
          
           let targetView: View = 'result_verify';
           if (activeWorkflow === 'charge') {
             targetView = 'result_charge';
           } else if (activeWorkflow === 'load_issue') {
             const isNewCardDetected = Math.random() > 0.5;
             targetView = isNewCardDetected ? 'result_issue' : 'result_topup';
           }
          
           setTimeout(() => setView(targetView), 300);
           return 100;
         }
         return prev + 15;
       });
     }, 100);
   } else {
     setLoadingProgress(0);
   }


   return () => {
     clearInterval(progressInterval);
     clearInterval(hashInterval);
   };
 }, [view, activeWorkflow]);


 const baseBalance = 86.50;
 const topUpBalance = (baseBalance + subtotal).toFixed(2);
 const chargeBalance = Math.max(0, baseBalance - totalToPay).toFixed(2);
 const isBlackCard = subtotal >= 100 && activeWorkflow === 'load_issue';


 // Apple-style background: System Group Background (F2F2F7)
 const appBg = "bg-[#F2F2F7]";


 return (
   <div className={`flex flex-col h-screen font-sans overflow-hidden max-w-md mx-auto ${appBg} text-black transition-colors duration-500 ease-in-out shadow-[0_0_50px_rgba(0,0,0,0.1)] relative`}>
    
     {/* Dynamic Status Bar - Always Light Theme */}
     <div className="flex justify-between items-center px-6 py-3.5 text-[12px] font-semibold tracking-wide relative z-20 text-black/80">
       <span>1:25</span>
       <div className="flex items-center gap-1.5">
         <Zap size={12} className="text-black/80" />
         <div className="w-6 h-3 border border-black/30 rounded-[4px] flex items-center px-0.5">
           <div className="h-1.5 w-full rounded-[2px] bg-black/80"></div>
         </div>
       </div>
     </div>


     {/* --- VIEW: HOME (Apple Dashboard Style) --- */}
     {view === 'home' && (
       <div className="flex-1 flex flex-col px-5 pb-8 pt-2 animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
        
         <header className="flex items-center gap-4 mb-8 pl-1">
           <div className="w-[52px] h-[52px] bg-black rounded-full flex items-center justify-center shadow-md">
               <span className="text-white font-black text-[22px] italic tracking-tighter">B</span>
           </div>
           <div>
             <h1 className="text-[26px] font-bold tracking-tight text-black leading-none mb-1">Terminal</h1>
             <div className="text-[13px] text-[#1562f0] font-medium flex items-center gap-1.5">
                <div className="w-2 h-2 bg-[#1562f0] rounded-full animate-pulse"></div> Active Node
             </div>
           </div>
         </header>


         {/* Stats Card - Apple Wallet style glossy dark card */}
         <div className="bg-[#1c1c1e] rounded-[28px] p-6 mb-8 shadow-xl relative overflow-hidden group">
           <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-40 pointer-events-none"></div>
          
           <div className="flex justify-between items-start mb-10 relative z-10 text-white">
             <div className="flex flex-col gap-1">
               <span className="text-[13px] text-white/50 font-medium flex items-center gap-1.5">
                 <div className="w-6 h-6 rounded-full bg-[#1562f0]/20 flex items-center justify-center">
                   <ArrowDownLeft size={14} className="text-[#1562f0]" />
                 </div>
                 Charges
               </span>
               <div className="flex items-baseline gap-1 tracking-tight mt-1">
                 <span className="text-[40px] font-semibold">$845</span>
                 <span className="text-lg text-white/40 font-semibold">.00</span>
               </div>
             </div>
            
             <div className="w-px h-[72px] bg-white/10 mt-1"></div>


             <div className="flex flex-col gap-1 text-right">
               <span className="text-[13px] text-white/50 font-medium flex items-center justify-end gap-1.5">
                 <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                   <ArrowUpRight size={14} className="text-emerald-400" />
                 </div>
                 Top-Ups
               </span>
               <div className="flex items-baseline gap-1 justify-end tracking-tight mt-1">
                 <span className="text-[40px] font-semibold">$400</span>
                 <span className="text-lg text-white/40 font-semibold">.00</span>
               </div>
             </div>
           </div>


           <div className="flex justify-between items-center bg-white/10 rounded-xl px-4 py-2.5 backdrop-blur-md">
              <span className="text-[12px] font-mono text-white/70">ID: 0xfb4...4a15c</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#1562f0]" />
                <span className="text-[11px] font-semibold text-white/90 uppercase tracking-wider">Secured</span>
              </div>
           </div>
         </div>


         <div className="text-[14px] font-semibold text-black/40 mb-3 pl-2">Workflows</div>


         {/* Thick Apple-style Action Cards */}
         <div className="bg-white rounded-[28px] shadow-[0_2px_15px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col">
           <button
             onClick={() => startWorkflow('charge')}
             className="w-full bg-white p-5 flex items-center gap-4 active:bg-slate-50 transition-colors border-b border-slate-100"
           >
             <div className="w-[52px] h-[52px] bg-[#1562f0]/10 rounded-[18px] flex items-center justify-center text-[#1562f0]">
               <Scan size={26} strokeWidth={2} />
             </div>
             <div className="flex-1 text-left">
               <div className="font-semibold text-[18px] text-black tracking-tight">Charge</div>
               <div className="text-[14px] text-black/50 mt-0.5">Accept NFC or QR code</div>
             </div>
             <ChevronRight size={22} className="text-black/20" />
           </button>


           <button
             onClick={() => startWorkflow('load_issue')}
             className="w-full bg-white p-5 flex items-center gap-4 active:bg-slate-50 transition-colors border-b border-slate-100"
           >
             <div className="w-[52px] h-[52px] bg-emerald-50 rounded-[18px] flex items-center justify-center text-emerald-500">
               <Plus size={28} strokeWidth={2.5} />
             </div>
             <div className="flex-1 text-left">
               <div className="font-semibold text-[18px] text-black tracking-tight">Top-Up / Mint</div>
               <div className="text-[14px] text-black/50 mt-0.5">Load balance or new card</div>
             </div>
             <ChevronRight size={22} className="text-black/20" />
           </button>


           <button
             onClick={() => startWorkflow('verify')}
             className="w-full bg-white p-5 flex items-center gap-4 active:bg-slate-50 transition-colors"
           >
             <div className="w-[52px] h-[52px] bg-slate-100 rounded-[18px] flex items-center justify-center text-slate-500">
               <Search size={24} strokeWidth={2} />
             </div>
             <div className="flex-1 text-left">
               <div className="font-semibold text-[18px] text-black tracking-tight">Check Balance</div>
               <div className="text-[14px] text-black/50 mt-0.5">Read member profile</div>
             </div>
             <ChevronRight size={22} className="text-black/20" />
           </button>
         </div>
       </div>
     )}


     {/* --- VIEW: KEYPAD (iOS Native Style) --- */}
     {view === 'keypad' && (
       <div className="flex-1 flex flex-col pt-2 pb-10 px-5 animate-in slide-in-from-right duration-400 ease-out">
         <header className="flex justify-between items-center mb-10 relative z-20">
           <button onClick={() => setView('home')} className="flex items-center text-[#1562f0] font-medium text-[17px] active:opacity-60 -ml-2">
             <ChevronLeft size={28} strokeWidth={2.5} /> Back
           </button>
           <h2 className="font-semibold text-[17px] text-black absolute left-1/2 -translate-x-1/2">
             {activeWorkflow === 'charge' ? 'Charge' : 'Top-Up'}
           </h2>
         </header>


         <div className="flex-1 flex flex-col items-center justify-center mt-4 mb-12">
           <div className="flex items-start justify-center w-full">
             <span className={`text-[40px] font-light mt-3 mr-1 transition-colors ${subtotal > 0 ? 'text-black' : 'text-black/20'}`}>$</span>
             <span className={`text-[88px] font-light tracking-tighter leading-none transition-colors ${subtotal > 0 ? 'text-black' : 'text-black/20'}`}>
               {subtotal > 0 ? subtotal.toString() : '20'}
             </span>
           </div>
         </div>


         {/* iOS Style Circular Num Pad */}
         <div className="grid grid-cols-3 gap-y-4 gap-x-6 mb-12 px-4 w-full max-w-[340px] mx-auto">
           {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
             <button
               key={num}
               onClick={() => handleKeypadInput(num.toString())}
               className="w-[84px] h-[84px] mx-auto bg-[#E5E5EA] active:bg-[#D1D1D6] rounded-full text-[32px] font-normal text-black transition-colors flex items-center justify-center"
             >
               {num}
             </button>
           ))}
           <button
             onClick={() => handleKeypadInput('00')}
             className="w-[84px] h-[84px] mx-auto bg-[#E5E5EA] active:bg-[#D1D1D6] rounded-full text-[24px] font-normal text-black transition-colors flex items-center justify-center"
           >
             00
           </button>
           <button
             onClick={() => handleKeypadInput('0')}
             className="w-[84px] h-[84px] mx-auto bg-[#E5E5EA] active:bg-[#D1D1D6] rounded-full text-[32px] font-normal text-black transition-colors flex items-center justify-center"
           >
             0
           </button>
           <button
             onClick={() => handleKeypadInput('delete')}
             className="w-[84px] h-[84px] mx-auto bg-[#E5E5EA] active:bg-[#D1D1D6] rounded-full transition-colors flex items-center justify-center text-black"
           >
             <Delete size={32} strokeWidth={1.5} />
           </button>
         </div>


         {/* Thick Apple Style Button */}
         <button
           onClick={proceedFromKeypad}
           className={`w-full h-[64px] rounded-[20px] font-semibold text-[19px] flex items-center justify-center transition-all duration-300 ${subtotal > 0 ? 'bg-[#1562f0] text-white active:scale-[0.98] shadow-lg shadow-[#1562f0]/20' : 'bg-[#E5E5EA] text-black/30 cursor-not-allowed'}`}
         >
           Continue
         </button>
       </div>
     )}


     {/* --- VIEW: TIP SELECTION (Apple Style) --- */}
     {view === 'tip' && (
       <div className="flex-1 flex flex-col pt-2 pb-10 px-5 animate-in slide-in-from-right duration-400 ease-out">
         <header className="flex justify-between items-center mb-8 relative z-20">
           <button onClick={() => setView('keypad')} className="flex items-center text-[#1562f0] font-medium text-[17px] active:opacity-60 -ml-2">
             <ChevronLeft size={28} strokeWidth={2.5} /> Back
           </button>
           <h2 className="font-semibold text-[17px] text-black absolute left-1/2 -translate-x-1/2">
             Add Tip
           </h2>
         </header>


         <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2 bg-white shadow-sm px-5 py-2.5 rounded-full text-[14px] font-medium text-black">
               <Heart size={16} className="fill-[#1562f0] text-[#1562f0]" /> Present to Customer
            </div>
         </div>


         <div className="text-center mb-10">
            <div className="text-black/50 text-[15px] font-medium mb-1">Subtotal</div>
            <div className="text-[64px] font-light text-black tracking-tighter leading-none">${subtotal.toFixed(2)}</div>
         </div>


         {/* Apple Grid Selection */}
         <div className="grid grid-cols-2 gap-4 mb-auto">
            {[15, 18, 20, 0].map(tip => {
              const isSelected = tipPercentage === tip;
              const calculatedTip = subtotal * (tip / 100);
              return (
                <button
                  key={tip}
                  onClick={() => setTipPercentage(tip)}
                  className={`flex flex-col items-center justify-center py-7 rounded-[24px] border-[2.5px] transition-all duration-200 active:scale-95 ${isSelected ? 'border-[#1562f0] bg-[#1562f0]/5' : 'border-transparent bg-white shadow-[0_2px_15px_rgba(0,0,0,0.04)]'}`}
                >
                  <span className={`text-[30px] font-semibold mb-1 tracking-tight ${isSelected ? 'text-[#1562f0]' : 'text-black'}`}>
                    {tip === 0 ? 'No Tip' : `${tip}%`}
                  </span>
                  <span className={`text-[15px] font-medium ${isSelected ? 'text-[#1562f0]/70' : 'text-black/40'}`}>
                    +${calculatedTip.toFixed(2)}
                  </span>
                </button>
              );
            })}
         </div>


         {/* Thick Apple Bottom Summary */}
         <div className="mt-8 bg-white rounded-[32px] p-6 flex flex-col gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
            <div className="flex justify-between items-end px-2">
               <span className="text-black/50 text-[15px] font-medium">Total to Pay</span>
               <span className="text-[44px] font-semibold text-black tracking-tighter leading-none">${totalToPay.toFixed(2)}</span>
            </div>
            <button
               onClick={() => setView('scanning')}
               className="w-full h-[64px] bg-[#1562f0] text-white rounded-[20px] font-semibold text-[19px] flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-[#1562f0]/30"
            >
               Confirm & Pay
            </button>
         </div>
       </div>
     )}


     {/* --- VIEW: SCANNING (Cool Apple Wallet Style) --- */}
     {view === 'scanning' && (
       <div className="flex-1 flex flex-col p-5 animate-in slide-in-from-bottom-8 duration-500 ease-out">
        
         {/* Dual Mode Toggle (iOS Segmented Control Style) */}
         <div className="flex bg-[#E5E5EA] p-1 rounded-xl w-full max-w-[280px] mx-auto mt-4 mb-16 relative z-20">
           <button
             onClick={() => setScanMode('nfc')}
             className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[8px] text-[14px] font-semibold transition-all duration-300 ${scanMode === 'nfc' ? 'bg-white text-black shadow-sm' : 'text-black/50'}`}
           >
             <Smartphone size={18} className={scanMode === 'nfc' ? 'text-black' : 'opacity-50'} />
             Tap Card
           </button>
           <button
             onClick={() => setScanMode('qr')}
             className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[8px] text-[14px] font-semibold transition-all duration-300 ${scanMode === 'qr' ? 'bg-white text-black shadow-sm' : 'text-black/50'}`}
           >
             <QrCode size={18} className={scanMode === 'qr' ? 'text-black' : 'opacity-50'} />
             Scan QR
           </button>
         </div>


         <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full">
          
           {/* Extremely clean scanning target */}
           <div
             onClick={handleInteraction}
             className="w-full max-w-[280px] aspect-square bg-white rounded-[40px] flex flex-col items-center justify-center gap-6 cursor-pointer active:scale-95 transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative overflow-hidden group"
           >
             {scanMode === 'nfc' ? (
               <div className="flex flex-col items-center transform group-hover:scale-105 transition-transform duration-500">
                  {/* Apple Pay style concentric circles */}
                  <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                    <div className="absolute inset-0 border-[3px] border-[#1562f0] rounded-full opacity-20 animate-ping" style={{animationDuration: '2s'}}></div>
                    <div className="absolute inset-4 border-[3px] border-[#1562f0] rounded-full opacity-40 animate-ping" style={{animationDuration: '2s', animationDelay: '0.3s'}}></div>
                    <div className="absolute inset-8 border-[3px] border-[#1562f0] rounded-full opacity-60"></div>
                    <Smartphone size={40} className="text-[#1562f0] relative z-10" strokeWidth={1.5} />
                  </div>
                  <span className="text-[17px] font-semibold text-black">Hold Card Near Phone</span>
               </div>
             ) : (
               <div className="relative w-44 h-44 transition-all duration-500 transform group-hover:scale-105">
                 <div className="absolute inset-0 bg-[#1562f0]/5 rounded-[24px]"></div>
                 {/* Thick blue optical corners */}
                 <div className="absolute top-0 left-0 w-10 h-10 border-t-[4px] border-l-[4px] border-[#1562f0] rounded-tl-[24px]"></div>
                 <div className="absolute top-0 right-0 w-10 h-10 border-t-[4px] border-r-[4px] border-[#1562f0] rounded-tr-[24px]"></div>
                 <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[4px] border-l-[4px] border-[#1562f0] rounded-bl-[24px]"></div>
                 <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[4px] border-r-[4px] border-[#1562f0] rounded-br-[24px]"></div>
                
                 <div className="absolute inset-0 flex items-center justify-center">
                   <QrCode size={64} className="text-black/10" />
                 </div>
                 <div className="absolute left-0 w-full h-[3px] bg-[#1562f0] shadow-[0_0_15px_rgba(21,98,240,0.6)] animate-scanline"></div>
               </div>
             )}
           </div>
         </div>


         {/* Bottom Cancel & Amount */}
         <div className="mt-auto pt-10 flex flex-col items-center pb-6">
           {activeWorkflow === 'charge' && (
              <div className="flex flex-col items-center mb-8">
                <span className="text-black/40 text-[14px] font-medium mb-1">Total to Pay</span>
                <span className="text-black text-[48px] font-semibold tracking-tighter leading-none">${totalToPay.toFixed(2)}</span>
              </div>
           )}
           {activeWorkflow === 'load_issue' && (
              <div className="flex flex-col items-center mb-8">
                <span className="text-black/40 text-[14px] font-medium mb-1">Load Amount</span>
                <span className="text-black text-[48px] font-semibold tracking-tighter leading-none">${subtotal.toFixed(2)}</span>
              </div>
           )}
          
           {/* Thick Apple cancel button */}
           <button
             onClick={() => {
               if (activeWorkflow === 'charge') setView('tip');
               else if (activeWorkflow === 'load_issue') setView('keypad');
               else setView('home');
             }}
             className="w-full bg-[#E5E5EA] text-black h-[64px] rounded-[20px] font-semibold text-[19px] active:bg-[#D1D1D6] transition-colors"
           >
             Cancel
           </button>
         </div>
       </div>
     )}


     {/* --- VIEW: VERIFYING (Clean FaceID Style Loading) --- */}
     {view === 'verifying' && (
       <div className="flex-1 flex flex-col items-center justify-center p-8">
         <div className="relative w-36 h-36 mb-10">
           <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
             <circle cx="50" cy="50" r="46" fill="none" stroke="#E5E5EA" strokeWidth="6" />
           </svg>
           <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
             <circle
               cx="50" cy="50" r="46"
               fill="none"
               stroke="#1562f0"
               strokeWidth="6"
               strokeDasharray="289"
               strokeDashoffset={289 - (289 * loadingProgress) / 100}
               strokeLinecap="round"
               className="transition-all duration-100 ease-linear"
             />
           </svg>
           <div className="absolute inset-0 flex items-center justify-center">
             <Lock size={36} className="text-[#1562f0]" strokeWidth={2} />
           </div>
         </div>
        
         <h2 className="text-[22px] font-semibold tracking-tight mb-4 text-black">
           Authenticating
         </h2>
         <div className="bg-white px-4 py-2 rounded-lg font-mono text-[13px] text-black/50 shadow-sm border border-slate-100">
           {cryptoHash}
         </div>
       </div>
     )}


     {/* --- VIEW: RESULT (Apple Settings/Wallet Integration Style) --- */}
     {view.startsWith('result_') && (
       <div className="flex-1 flex flex-col p-5 animate-in zoom-in-95 duration-500 ease-out overflow-y-auto no-scrollbar">
        
         <div className="flex flex-col items-center justify-center mb-8 pt-6">
           <div className="w-[72px] h-[72px] bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(16,185,129,0.3)] mb-5">
             <Check size={40} className="text-white" strokeWidth={3} />
           </div>
           <h2 className="text-center text-[28px] font-bold tracking-tight text-black leading-none">
              {view === 'result_verify' && 'Authorized'}
              {view === 'result_topup' && (isBlackCard ? 'VIP Upgraded' : 'Balance Loaded')}
              {view === 'result_issue' && 'Card Minted'}
              {view === 'result_charge' && 'Approved'}
           </h2>
         </div>


         {/* Asset Card (Apple Wallet Aspect Ratio) */}
         <div className={`relative w-full aspect-[1.58/1] rounded-[24px] p-6 mb-8 overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.15)] flex flex-col justify-between transition-all duration-700 ${isBlackCard ? 'bg-[#1c1c1e]' : 'bg-gradient-to-br from-[#1a401b] to-[#0a1a0b]'}`}>
          
           {/* Shimmer overlay */}
           <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 hover:opacity-100 transition-opacity duration-500 animate-shimmer"></div>
          
           <div className="flex justify-between items-start relative z-10">
             <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md`}>
                  {isBlackCard ? <Crown size={20} className="text-amber-400" /> : <Activity size={20} className="text-emerald-400" />}
               </div>
               <div className="flex flex-col">
                  <h3 className="font-semibold text-[17px] text-white leading-tight">
                    {isBlackCard ? 'Black VIP' : 'CashTrees'}
                  </h3>
                  <span className="text-[12px] text-white/70 font-medium">Sen Pho + Cafe</span>
               </div>
             </div>
             <div className={`px-3 py-1.5 rounded-full text-[12px] font-bold bg-white/10 backdrop-blur-md ${isBlackCard ? 'text-amber-400' : 'text-white'}`}>
                 {view === 'result_charge' ? `-$${totalToPay.toFixed(2)}` : (isBlackCard ? '15% OFF' : '10% OFF')}
             </div>
           </div>


           <div className="flex justify-between items-end relative z-10">
              <div className="flex flex-col gap-0.5">
                 <span className="text-[12px] text-white/60 font-medium">Member No.</span>
                 <span className="text-[15px] text-white font-mono font-medium">
                   {view === 'result_issue' ? 'M-NEW' : 'M-000103'}
                 </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                 <span className="text-[12px] text-white/60 font-medium">Balance</span>
                 <span className={`text-[36px] leading-none font-bold tracking-tight ${view === 'result_charge' ? 'text-white' : (isBlackCard ? 'text-amber-400' : 'text-emerald-400')}`}>
                   ${view === 'result_issue' ? subtotal.toFixed(2) : view === 'result_topup' ? topUpBalance : view === 'result_charge' ? chargeBalance : baseBalance.toFixed(2)}
                 </span>
              </div>
           </div>
         </div>


         {/* --- THE RESTORED & UPGRADED AA SMART ACCOUNT (Apple Settings Style) --- */}
         <div className="bg-white rounded-[24px] px-5 py-2 mb-8 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            {/* AA Smart Account Row */}
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-2 text-black">
                <Wallet size={18} className="text-[#1562f0]" />
                <span className="text-[15px] font-semibold">AA Smart Account</span>
              </div>
              <span className="text-[14px] text-black/50 font-mono">0x52e4...23dE</span>
            </div>
           
            {/* Conditionally Render Transaction Hash */}
            {view !== 'result_verify' && (
              <div className="flex justify-between items-center py-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-black">
                  <Lock size={18} className="text-[#1562f0]" />
                  <span className="text-[15px] font-semibold">Tx Hash</span>
                </div>
                <span className="text-[14px] text-black/50 font-mono">0xBe4B...dfEa</span>
              </div>
            )}


            {/* Settlement Layer */}
            <div className="flex justify-between items-center py-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-black">
                  <Cpu size={18} className="text-[#1562f0]" />
                  <span className="text-[15px] font-semibold">Settlement</span>
                </div>
                <span className="text-[14px] text-black/50 font-medium">
                  {scanMode === 'nfc' ? 'NTAG 424 DNA' : 'App Validator'}
                </span>
            </div>
         </div>


         {/* Thick Apple Action Buttons */}
         <div className="flex flex-col gap-3 mt-auto pb-4">
           {view === 'result_verify' ? (
             <button
               onClick={() => startWorkflow('load_issue')}
               className="w-full h-[64px] bg-[#1562f0] text-white rounded-[20px] font-semibold text-[19px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-[#1562f0]/20"
             >
               <Plus size={20} strokeWidth={2.5} /> Load Balance
             </button>
           ) : (
             <button
               onClick={() => setView('home')}
               className="w-full h-[64px] bg-[#1562f0] text-white rounded-[20px] font-semibold text-[19px] active:scale-[0.98] transition-transform shadow-lg shadow-[#1562f0]/20"
             >
               Print Receipt
             </button>
           )}
          
           <button
             onClick={() => setView('home')}
             className="w-full h-[64px] bg-white text-[#1562f0] rounded-[20px] font-semibold text-[19px] active:bg-slate-50 transition-colors shadow-sm border border-slate-100"
           >
             Done
           </button>
         </div>
       </div>
     )}


   </div>
 );
};


export default App;

