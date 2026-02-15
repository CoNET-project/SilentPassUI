import React, { useState, useEffect } from 'react';
import {
 ArrowRight,
 CheckCircle2,
 ShieldCheck,
 Wallet,
 Ticket,
 Copy,
 Download,
 Loader2,
 Check,
 Lock,
 CreditCard,
 QrCode,
 Zap,
 ShoppingBag,
 Smartphone,
 ChevronRight,
 Shield,
 Store,
 Globe,
 Building2,
 Share,
 PlusSquare,
 X,
 Eye,
 EyeOff,
 KeyRound
} from 'lucide-react';


/**
* BEAMIO ASSET-LED ONBOARDING (Deep Link / QR Scan Flow)
* Design System: Apple Modern (2026)
* Strategy: Single Path to Installation (No Distractions)
* Asset: 100 CAD CCSA Membership
* Terminology Update: "Log in" -> "Restore access"
*/


const BEAMIO_BLUE = "#1562f0";

type StepId = 'splash' | 'tag' | 'password' | 'security' | 'provisioning' | 'ready';

// --- Components ---


// 1. CCSA Card Component (Updated to CAD)
const CCSACard = ({ balance = "100.00", currency = "CAD", className = "" }) => (
 <div className={`relative w-full aspect-[1.58/1] rounded-[24px] overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.02] ${className}`}>
   <div className="absolute inset-0 bg-[#4c1d95]">
      <div className="absolute top-[-25%] left-[-20%] w-[70%] h-[70%] bg-[#fbbf24] rounded-full blur-[60px] opacity-90 mix-blend-screen"></div>
      <div className="absolute top-[-10%] right-[-20%] w-[80%] h-[80%] bg-[#a855f7] rounded-full blur-[60px] opacity-100 mix-blend-screen"></div>
      <div className="absolute bottom-[-30%] left-[-20%] w-[90%] h-[80%] bg-[#06b6d4] rounded-full blur-[70px] opacity-90 mix-blend-screen"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#7c3aed] rounded-full blur-[60px] opacity-80"></div>
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
   </div>
   <div className="relative z-10 p-6 h-full flex flex-col justify-between">
     <div className="flex justify-between items-start">
       <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#fcd34d] to-[#d97706] flex items-center justify-center shadow-lg border border-[#fef3c7]/40">
             <Globe size={20} className="text-white drop-shadow-md" strokeWidth={2} />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-[#fef3c7] text-xl font-bold leading-none tracking-wide drop-shadow-sm">CCSA</span>
            <span className="font-serif text-[#fef3c7] text-xl font-bold leading-none tracking-wide drop-shadow-sm mt-1">CARD</span>
          </div>
       </div>
       <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/10 shadow-sm">
          <Globe size={12} className="text-white" />
          <span className="text-white text-xs font-medium tracking-wide">Membership</span>
       </div>
     </div>
     <div className="mt-auto">
        <p className="text-[#cffafe] text-[10px] font-bold uppercase tracking-widest mb-1 opacity-90">Balance</p>
        <div className="flex items-baseline gap-2">
           <span className="text-[#fef9c3] text-5xl font-sans font-medium tracking-tighter drop-shadow-sm">{balance}</span>
           <span className="text-[#fef9c3] text-xl font-sans font-medium tracking-wide opacity-90">{currency}</span>
        </div>
     </div>
   </div>
 </div>
);


// 2. Install Guide Sheet (Updated Terminology)
const InstallSheet = ({ onDismiss, tag }: { onDismiss: () => void; tag?: string }) => (
 <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
   <div className="bg-white rounded-t-[32px] p-8 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-500 relative max-h-[90vh] overflow-y-auto">
     <button onClick={onDismiss} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500">
       <X size={24} />
     </button>
    
     {/* Header */}
     <div className="flex items-center gap-4 mb-8">
       <div className="w-14 h-14 bg-[#1562f0] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
         <ArrowRight size={24} className="rotate-90" />
       </div>
       <div>
         <h2 className="text-xl font-bold text-slate-900 leading-tight">Install to Secure</h2>
         <p className="text-sm text-slate-500 font-medium">Keep your $100 safe.</p>
       </div>
     </div>


     {/* Instructions */}
     <div className="space-y-3 mb-8">
       <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
         <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[#1562f0] font-bold">1</div>
         <p className="text-slate-700 font-medium text-sm">Tap <span className="inline-flex items-center px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-900 mx-1"><Share size={12} className="mr-1"/> Share</span> below</p>
       </div>
       <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
         <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-[#1562f0] font-bold">2</div>
         <p className="text-slate-700 font-medium text-sm">Select <span className="inline-flex items-center px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-900 mx-1"><PlusSquare size={12} className="mr-1"/> Add to Home Screen</span></p>
       </div>
     </div>
    
     {/* Strategic Reminder: The Restore Key */}
     <div className="bg-yellow-50 rounded-2xl p-5 border border-yellow-100/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-2 -mr-2 text-yellow-100">
           <KeyRound size={60} strokeWidth={1} />
        </div>
        <div className="relative z-10">
           <div className="flex items-center gap-2 mb-2">
              <KeyRound size={16} className="text-yellow-600" />
              <span className="text-xs font-black text-yellow-700 uppercase tracking-widest">Future Access</span>
           </div>
           {/* UPDATED TERMINOLOGY: Restore Access */}
           <p className="text-slate-800 text-sm font-bold leading-relaxed">
              Restore access anytime with:
           </p>
           <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-1 bg-white rounded-md text-slate-900 text-xs font-bold border border-yellow-200 shadow-sm">
                 @{tag || "yourtag"}
              </span>
              <span className="text-slate-400 font-medium text-xs self-center">+</span>
              <span className="px-2 py-1 bg-white rounded-md text-slate-900 text-xs font-bold border border-yellow-200 shadow-sm">
                 Your Password
              </span>
           </div>
        </div>
     </div>


   </div>
 </div>
);


// --- Steps ---


// Step 1: Splash
const RedemptionSplash = ({ onStart }: { onStart: () => void }): React.ReactElement => (
 <div className="min-h-screen bg-[#F5F5F7] flex flex-col relative overflow-hidden font-sans">
   <div className="w-full h-14 bg-transparent z-50"></div>
   <div className="flex-1 flex flex-col items-center px-6 pt-4 relative z-10">
     <div className="flex items-center gap-2 bg-white/60 backdrop-blur-xl border border-white/40 px-4 py-2 rounded-full shadow-sm mb-8 animate-in fade-in slide-in-from-top duration-700">
       <div className="w-4 h-4 rounded-full bg-[#1562f0] flex items-center justify-center">
         <ShieldCheck size={10} className="text-white" />
       </div>
       <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">Verified Asset • Ready to Claim</span>
     </div>
     <div className="w-full max-w-[340px] perspective-1000 mb-10 animate-in zoom-in duration-700 delay-100">
       <CCSACard balance="100.00" currency="CAD" />
       <div className="w-[90%] h-4 mx-auto bg-blue-900/20 blur-xl rounded-full mt-4"></div>
     </div>
     <div className="mt-4 text-center space-y-3 max-w-xs mx-auto animate-in slide-in-from-bottom duration-700 delay-200">
       <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Activate Your Card.</h1>
       <p className="text-slate-500 text-[15px] font-medium leading-relaxed">
         Create a secure Beamio wallet to claim this membership. No app download required yet.
       </p>
     </div>
   </div>
   <div className="p-6 pb-10 bg-gradient-to-t from-[#F5F5F7] to-transparent z-20">
     <button onClick={onStart} className="group w-full h-16 bg-[#1562f0] rounded-full text-white font-bold text-[17px] shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-between px-2 pl-6">
       <span>Activate Now</span>
       <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#1562f0] group-hover:scale-105 transition-transform">
         <ArrowRight size={24} strokeWidth={3} />
       </div>
     </button>
   </div>
 </div>
);


// Step 2: Tag Setup
const TagSetup = ({ onNext }: { onNext: (tag: string) => void }) => {
 const [tag, setTag] = useState('');
 return (
   <div className="min-h-screen bg-white p-6 pt-14 flex flex-col">
     <div className="mb-8">
       <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
          <ShieldCheck size={24} className="text-slate-900" />
       </div>
       <h2 className="text-[34px] leading-tight font-bold text-slate-900 mb-3 tracking-tight">Claim your<br/>Owner ID.</h2>
       <p className="text-slate-500 text-[17px] leading-relaxed">This <span className="text-[#1562f0] font-semibold">@BeamioTag</span> will be bound to your card permanently.</p>
     </div>
     <div className="relative group mb-8">
       <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
         <span className="text-2xl font-bold text-slate-300 group-focus-within:text-[#1562f0] transition-colors">@</span>
       </div>
       <input autoFocus type="text" placeholder="username" value={tag} onChange={(e) => setTag(e.target.value.toLowerCase())} className="block w-full pl-12 pr-12 py-6 bg-slate-50 border-none rounded-[24px] text-2xl font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1562f0] focus:bg-white transition-all caret-[#1562f0]" />
       {tag.length > 3 && <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none animate-in zoom-in"><CheckCircle2 size={24} className="text-[#1562f0] fill-white" /></div>}
     </div>
     <button disabled={tag.length < 3} onClick={() => onNext(tag)} className={`mt-auto w-full h-14 rounded-full font-bold text-[17px] transition-all ${tag.length >= 3 ? 'bg-[#1562f0] text-white shadow-lg shadow-blue-500/30 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>Continue</button>
   </div>
 );
};


// Step 3: Password Setup
const PasswordSetup = ({ onNext }: { onNext: (pass: string) => void }) => {
 const [pass, setPass] = useState('');
 const [show, setShow] = useState(false);
  return (
   <div className="min-h-screen bg-white p-6 pt-14 flex flex-col">
     <div className="mb-8">
       <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
          <Lock size={24} className="text-slate-900" />
       </div>
       <h2 className="text-[34px] leading-tight font-bold text-slate-900 mb-3 tracking-tight">Set a<br/>Password.</h2>
       <p className="text-slate-500 text-[17px] leading-relaxed">
         You will use this password + your tag to restore your wallet on other devices.
       </p>
     </div>


     <div className="relative group mb-4">
       <input
         autoFocus
         type={show ? "text" : "password"}
         placeholder="Minimum 6 chars"
         value={pass}
         onChange={(e) => setPass(e.target.value)}
         className="block w-full px-6 py-6 bg-slate-50 border-none rounded-[24px] text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1562f0] focus:bg-white transition-all"
       />
       <button
         onClick={() => setShow(!show)}
         className="absolute inset-y-0 right-0 pr-6 flex items-center text-slate-400 hover:text-slate-600"
       >
         {show ? <EyeOff size={20}/> : <Eye size={20}/>}
       </button>
     </div>
    
     <p className="text-xs text-slate-400 px-2 leading-relaxed">
       Beamio cannot reset this password. It encrypts your keys locally.
     </p>


     <button
       disabled={pass.length < 6}
       onClick={() => onNext(pass)}
       className={`mt-auto w-full h-14 rounded-full font-bold text-[17px] transition-all ${pass.length >= 6 ? 'bg-[#1562f0] text-white shadow-lg shadow-blue-500/30 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
     >
       Set Password
     </button>
   </div>
 );
};


// Step 4: Security (Master Key)
const SecurityBoot = ({ onNext }: { onNext: () => void }) => {
 const [saved, setSaved] = useState(false);
 return (
   <div className="min-h-screen bg-white p-6 pt-14 flex flex-col">
     <div className="mb-6">
       <h2 className="text-[34px] leading-tight font-bold text-slate-900 mb-3 tracking-tight">Save your<br/>Master Key.</h2>
       <p className="text-slate-500 text-[17px] leading-relaxed"><span className="text-orange-600 font-bold">Important:</span> This QR code is your ultimate backup if you forget your password.</p>
     </div>
     <div className="w-full aspect-square bg-white rounded-[32px] p-8 flex flex-col items-center justify-center mb-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 relative overflow-hidden">
       <QrCode size={180} className="text-slate-900" />
     </div>
     <div className="flex gap-3 mb-auto">
       <button className="flex-1 h-12 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-900 text-sm transition-colors flex items-center justify-center gap-2"><Download size={16}/> Save Image</button>
       <button className="flex-1 h-12 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-900 text-sm transition-colors flex items-center justify-center gap-2"><Copy size={16}/> Copy</button>
     </div>
     <div className="mt-6">
       <div onClick={() => setSaved(!saved)} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 mb-6 cursor-pointer active:bg-slate-50 transition-colors">
         <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${saved ? 'border-[#1562f0] bg-[#1562f0]' : 'border-slate-300'}`}>
           {saved && <Check size={14} className="text-white" strokeWidth={3} />}
         </div>
         <span className="text-sm font-semibold text-slate-700">I have saved my Key</span>
       </div>
       <button disabled={!saved} onClick={onNext} className={`w-full h-14 rounded-full font-bold text-[17px] transition-all ${saved ? 'bg-[#1562f0] text-white shadow-lg shadow-blue-500/30 active:scale-95' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>Initialize & Redeem</button>
     </div>
   </div>
 );
};


// Step 5: Provisioning
const ProvisioningLoader = ({ onComplete }: { onComplete: () => void }) => {
 const [step, setStep] = useState(0);
 useEffect(() => {
   const steps = [setTimeout(() => setStep(1), 1500), setTimeout(() => setStep(2), 3500), setTimeout(() => setStep(3), 5500), setTimeout(() => onComplete(), 7000)];
   return () => steps.forEach(clearTimeout);
 }, [onComplete]);
 const steps = ["Securing Vault...", "Deploying Account...", "Redeeming $100 Asset...", "Finalizing Setup..."];
 return (
   <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
     <div className="relative mb-12">
       <div className="w-20 h-20 bg-[#1562f0] rounded-[28px] flex items-center justify-center shadow-xl shadow-blue-500/40">
          <Loader2 size={36} className="text-white animate-spin" strokeWidth={2.5} />
       </div>
       <div className="absolute -inset-4 bg-[#1562f0] rounded-[40px] opacity-10 blur-xl animate-pulse"></div>
     </div>
     <h2 className="text-2xl font-bold text-slate-900 mb-2">Activating...</h2>
     <div className="h-6 overflow-hidden relative w-full max-w-[240px]">
       {steps.map((text, i) => (
         <p key={i} className={`absolute inset-x-0 top-0 text-slate-400 font-medium transition-all duration-500 ${step === i ? 'opacity-100 translate-y-0' : step > i ? 'opacity-0 -translate-y-4' : 'opacity-0 translate-y-4'}`}>{text}</p>
       ))}
     </div>
   </div>
 );
};


// Step 6: Commercial Ready (Single Action Focus)
const CommercialReady = ({ onGoHome, tag }: { onGoHome: () => void; tag: string }) => {
 const [showInstall, setShowInstall] = useState(false);
 return (
   <div className="min-h-screen bg-white p-6 pt-14 flex flex-col relative overflow-hidden">
     <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[50vh] bg-gradient-to-b from-blue-50 to-white -z-10"></div>
     <div className="flex flex-col items-center mb-8">
       <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 mb-6 animate-in zoom-in duration-500">
         <Check size={32} className="text-white" strokeWidth={4} />
       </div>
       <h1 className="text-[32px] font-bold text-slate-900 tracking-tight text-center leading-tight">Card Active!</h1>
       <p className="text-slate-500 font-medium mt-2">Redemption complete. Funds available.</p>
     </div>
    
     <div className="w-full max-w-[340px] mx-auto mb-10 perspective-1000 relative">
        <CCSACard balance="100.00" currency="CAD" />
        <div className="absolute top-4 right-4 z-20">
           <div className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-in fade-in zoom-in delay-700 duration-500">
              <Zap size={10} fill="currentColor" /> READY
           </div>
        </div>
     </div>


     <div className="mt-auto space-y-4">
       {/* Single Primary Action to drive Installation */}
       <button
         onClick={() => setShowInstall(true)}
         className="w-full h-16 bg-slate-900 text-white rounded-full font-bold text-[17px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
       >
         <Smartphone size={20} /> Save Wallet to Home Screen
       </button>
     </div>
    
     {showInstall && <InstallSheet onDismiss={() => setShowInstall(false)} tag={tag} />}
   </div>
 );
};


// --- Orchestrator ---
export default function App() {
 const [step, setStep] = useState<StepId>('splash');
 const [tag, setTag] = useState('');
  const next = (s: StepId) => { window.scrollTo(0,0); setStep(s); }


 switch(step) {
   case 'splash': return <RedemptionSplash onStart={() => next('tag')} />;
   case 'tag': return <TagSetup onNext={(t: string) => { setTag(t); next('password'); }} />;
   case 'password': return <PasswordSetup onNext={() => next('security')} />;
   case 'security': return <SecurityBoot onNext={() => next('provisioning')} />;
   case 'provisioning': return <ProvisioningLoader onComplete={() => next('ready')} />;
   case 'ready': return <CommercialReady onGoHome={() => alert("Installation Complete")} tag={tag} />;
   default: return <RedemptionSplash onStart={() => next('tag')} />;
 }
}

