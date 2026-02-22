import React, { useState, useEffect } from 'react';
import {
 X,
 Share,
 ShieldCheck,
 Cpu,
 Activity,
 Zap,
 CheckCircle2,
 ArrowRight,
 Lock,
 Search,
 Check,
 Flame,
 Database,
 Banknote,
 Server,
 PackageOpen,
 Info
} from 'lucide-react';


const App = () => {
 const [currentScreen, setCurrentScreen] = useState('market');
 const [paymentStep, setPaymentStep] = useState('idle'); // idle, processing, success
 const [unboxingStep, setUnboxingStep] = useState('hidden'); // hidden, opening, revealed
 const [selectedPackage, setSelectedPackage] = useState<'genesis' | 'fuel'>('genesis');


 // Simulate Payment Process
 const handlePurchase = () => {
   setPaymentStep('processing');
   setTimeout(() => {
     setPaymentStep('success');
     setTimeout(() => {
       setCurrentScreen('unboxing');
       setPaymentStep('idle');
       startUnboxingSequence();
     }, 1500);
   }, 2000);
 };


 // Simulate Unboxing Sequence
 const startUnboxingSequence = () => {
   setUnboxingStep('opening');
   setTimeout(() => {
     setUnboxingStep('revealed');
   }, 2800);
 };


 const handlePackageSelect = (pkg: 'genesis' | 'fuel') => {
   setSelectedPackage(pkg);
   setCurrentScreen('detail');
 };


 // Content Dictionaries STRICTLY based on Whitepaper & Compliance Deck
 const packageData = {
   genesis: {
     title: "Genesis Node Pack",
     tag: "Hardware + License",
     subtitle: "The Infrastructure Equity",
     price: 999,
     limit: 300,
     currentMinted: 247,
     themeColor: "blue",
     heroImg: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop",
     stat1Label: "Compute",
     stat1Value: "EAL6+ Edge",
     stat1Icon: <Cpu className="w-6 h-6" />,
     stat2Label: "Yield",
     stat2Value: "5% Network",
     stat2Icon: <Activity className="w-6 h-6" />,
     featureTitle: "The Tangible Edge",
     featureIcon: <Lock className="w-4 h-4" />,
     features: [
       { icon: <Zap className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />, title: "Dynamic E-ink Terminal", desc: "0.84mm flexible PCB. Off-grid identity credential auto-refreshing every 60s." },
       { icon: <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />, title: "Global Validator License", desc: "Delegated Staking (NaaS). 1-click cloud delegation for seamless routing." },
       { icon: <CheckCircle2 className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />, title: "5% Validator Yield", desc: "Perpetual computational rewards from all global B-Units routing fuel consumed." }
     ],
     legalNote: "Forward-looking projection based on network modeling. Yields are utility-derived computational rewards, not guaranteed financial returns."
   },
   fuel: {
     title: "Limited Fuel Pack",
     tag: "Merchant Prepaid",
     subtitle: "The Store Clearing Fuel",
     price: 499,
     limit: 1000,
     currentMinted: 842,
     themeColor: "orange",
     heroImg: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800&auto=format&fit=crop",
     stat1Label: "Volume",
     stat1Value: "100k B-Units",
     stat1Icon: <Database className="w-6 h-6" />,
     stat2Label: "Discount",
     stat2Value: "50% Tech Off",
     stat2Icon: <Flame className="w-6 h-6" />,
     featureTitle: "The Merchant Arsenal",
     featureIcon: <PackageOpen className="w-4 h-4" />,
     features: [
       { icon: <Database className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />, title: "100,000 B-Units Pre-load", desc: "System value of $1,000 USDC. Instant clearing fuel to process your daily retail volume." },
       { icon: <Banknote className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />, title: "50% Effective Rate Cut", desc: "Effectively slashes the standard 0.8% Beamio transaction fee in half. Keep more of your hard-earned revenue." },
       { icon: <Server className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />, title: "Automated Fee Deduction", desc: "Zero crypto friction. The system automatically burns your pre-paid fuel as consumers pay at your counter." }
     ],
     legalNote: "B-Units are internal utility protocol fuel pegged for internal system accounting. They cannot be withdrawn as fiat or traded on secondary markets."
   }
 };


 const currentData = packageData[selectedPackage];


 return (
   <div className="flex justify-center items-center min-h-screen bg-[#050505] p-4 font-sans select-none">
     {/* Mobile Device Container */}
     <div className="w-full max-w-[400px] h-[800px] bg-[#0a0a0c] rounded-[40px] shadow-2xl overflow-hidden relative border-[8px] border-[#1a1a1c]">
      
       {/* iPhone Notch Area */}
       <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50 pointer-events-none">
         <div className="w-32 h-6 bg-[#1a1a1c] rounded-b-3xl"></div>
       </div>


       {/* ======================= MARKET SCREEN ======================= */}
       <div
         className={`absolute inset-0 transition-all duration-500 ease-in-out bg-[#0a0a0c] ${currentScreen === 'market' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}
       >
         {/* Header */}
         <div className="pt-12 px-6 flex justify-between items-center">
           <h1 className="text-3xl font-extrabold tracking-tight text-white">Strategic</h1>
           <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-800">
             <img src="https://i.pravatar.cc/150?img=11" alt="User avatar" className="w-full h-full object-cover" />
           </div>
         </div>


         {/* Search Bar */}
         <div className="px-6 mt-6">
           <div className="flex items-center bg-[#151518] border border-gray-800 rounded-2xl px-4 py-3">
             <Search className="w-5 h-5 text-gray-500 mr-2" />
             <input
               type="text"
               placeholder="Search allocations..."
               className="bg-transparent border-none focus:outline-none text-gray-300 w-full font-medium"
               readOnly
             />
           </div>
         </div>


         {/* Horizontal Scroll Cards */}
         <div className="mt-8 flex overflow-x-auto px-6 pb-4 space-x-4 snap-x hide-scrollbar">
          
           {/* PACKAGE B: GENESIS NODE */}
           <div
             onClick={() => handlePackageSelect('genesis')}
             className="min-w-[300px] h-[400px] rounded-3xl bg-gradient-to-br from-gray-900 to-black relative overflow-hidden snap-center cursor-pointer shadow-[0_0_30px_rgba(0,112,243,0.15)] border border-gray-800 group active:scale-95 transition-transform duration-200"
           >
             <img
               src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop"
               alt="Carbon texture"
               className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-[#0a0a0c]"></div>
            
             <div className="absolute -left-10 top-20 w-32 h-32 bg-blue-600 rounded-full blur-[60px] opacity-40 animate-pulse"></div>


             <div className="absolute top-0 inset-x-0 p-6">
               <div className="flex justify-between items-center mb-4">
                 <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                   Package B
                 </span>
                 <span className="text-gray-400 text-xs font-bold font-mono">
                   247/300
                 </span>
               </div>
               <h2 className="text-white text-3xl font-extrabold leading-tight tracking-tight">Genesis<br/>Node Pack</h2>
               <p className="text-blue-400/80 text-xs mt-1 font-semibold uppercase tracking-wider">Infrastructure Equity</p>
             </div>


             {/* Card Mockup */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 bg-gradient-to-tr from-[#1a1a1c] to-[#2a2a2c] rounded-xl border border-gray-600 shadow-2xl rotate-12 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
                <div className="w-12 h-8 bg-black rounded flex items-center justify-center border border-gray-700">
                   <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/10 to-transparent h-1 w-full animate-[scan_2s_ease-in-out_infinite]"></div>
             </div>


             <div className="absolute bottom-6 inset-x-6">
               <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex justify-between items-center border border-white/10">
                 <div>
                   <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">Pricing</p>
                   <p className="text-white text-xl font-bold font-mono">$999 <span className="text-[10px] text-gray-500">USDC</span></p>
                 </div>
                 <button className="bg-blue-600 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                   View
                 </button>
               </div>
             </div>
           </div>


           {/* PACKAGE A: LIMITED FUEL PACK */}
           <div
             onClick={() => handlePackageSelect('fuel')}
             className="min-w-[300px] h-[400px] rounded-3xl bg-gradient-to-br from-gray-900 to-[#1a1005] relative overflow-hidden snap-center cursor-pointer shadow-[0_0_30px_rgba(249,115,22,0.15)] border border-gray-800 group active:scale-95 transition-transform duration-200"
           >
              <img
               src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=800&auto=format&fit=crop"
               alt="Server texture"
               className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
             />
             <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/80 to-[#0a0a0c]"></div>
            
             <div className="absolute -left-10 top-20 w-32 h-32 bg-orange-600 rounded-full blur-[60px] opacity-30 animate-pulse delay-75"></div>


             <div className="absolute top-0 inset-x-0 p-6">
                <div className="flex justify-between items-center mb-4">
                 <span className="bg-orange-600/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                   Package A
                 </span>
                 <span className="text-gray-400 text-xs font-bold font-mono">
                   842/1000
                 </span>
               </div>
               <h2 className="text-white text-3xl font-extrabold leading-tight tracking-tight">Limited<br/>Fuel Pack</h2>
               {/* Updated Subtitle for Merchant context */}
               <p className="text-orange-400/80 text-xs mt-1 font-semibold uppercase tracking-wider">Store Clearing Fuel</p>
             </div>


              {/* Fuel Container Mockup */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 bg-[#110a05] rounded-xl border border-orange-900/50 shadow-2xl flex flex-col items-center justify-center group-hover:scale-105 transition-transform duration-500">
                <Database className="w-12 h-12 text-orange-500 mb-2 opacity-80" />
                <p className="text-orange-400 font-mono font-bold text-lg leading-none">100k</p>
                <p className="text-orange-600 text-[8px] uppercase font-bold tracking-widest mt-1">B-Units</p>
                <div className="absolute bottom-0 inset-x-0 h-1 bg-orange-600 rounded-b-xl shadow-[0_0_10px_rgba(234,88,12,0.8)]"></div>
             </div>


              <div className="absolute bottom-6 inset-x-6">
               <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex justify-between items-center border border-white/10">
                 <div>
                   <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">Pricing</p>
                   <p className="text-white text-xl font-bold font-mono">$499 <span className="text-[10px] text-gray-500">USDC</span></p>
                 </div>
                 <button className="bg-orange-600 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-[0_0_15px_rgba(234,88,12,0.5)]">
                   View
                 </button>
               </div>
             </div>
           </div>


         </div>


         <div className="px-6 mt-2 text-center">
           <p className="text-xs text-gray-600 font-medium tracking-wide">CONFIDENTIAL // STRICTLY LIMITED ALLOCATIONS</p>
         </div>
       </div>




       {/* ======================= DETAIL SCREEN ======================= */}
       <div
         className={`absolute inset-0 bg-[#0a0a0c] transition-all duration-500 ease-in-out ${currentScreen === 'detail' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}
       >
         {/* Scrollable Content Container */}
         <div className="absolute inset-0 overflow-y-auto pb-48">
          
           {/* Hero Image Area */}
           <div className={`relative h-[380px] w-full bg-gradient-to-b from-gray-900 to-[#0a0a0c]`}>
             <img
               src={currentData.heroImg}
               alt="Detail background"
               className="w-full h-full object-cover opacity-30 mix-blend-screen"
             />
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0c]/80 to-[#0a0a0c]"></div>
            
             <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 w-48 h-20 rounded-[100%] blur-[80px] opacity-30 ${currentData.themeColor === 'blue' ? 'bg-blue-600' : 'bg-orange-600'}`}></div>


             {/* Top Navigation */}
             <div className="absolute top-12 inset-x-4 flex justify-between items-center z-10">
               <button
                 onClick={() => setCurrentScreen('market')}
                 className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition border border-white/10"
               >
                 <X className="w-5 h-5" />
               </button>
               <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition border border-white/10">
                 <Share className="w-5 h-5" />
               </button>
             </div>


             <div className="absolute bottom-6 inset-x-6">
               <span className={`bg-${currentData.themeColor}-600/20 text-${currentData.themeColor}-400 border border-${currentData.themeColor}-500/30 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider mb-3 inline-block`}>
                 {currentData.tag}
               </span>
               <h1 className="text-white text-4xl font-extrabold leading-tight mb-2 tracking-tight">
                 {currentData.title}
               </h1>
               <p className="text-gray-400 font-medium text-sm">
                 {currentData.subtitle}
               </p>
             </div>
           </div>


           {/* Specs Row */}
           <div className="flex border-b border-gray-800 py-6 px-6 bg-[#0a0a0c]">
             <div className="flex items-center gap-4 flex-1">
               <div className={`w-12 h-12 rounded-full bg-[#151518] border border-gray-800 flex items-center justify-center shadow-lg ${currentData.themeColor === 'blue' ? 'text-blue-500' : 'text-orange-500'}`}>
                 {currentData.stat1Icon}
               </div>
               <div>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{currentData.stat1Label}</p>
                 <p className="text-base font-bold text-white leading-none">{currentData.stat1Value}</p>
               </div>
             </div>
             <div className="w-px bg-gray-800 mx-2 h-10 self-center"></div>
             <div className="flex items-center gap-4 flex-1 pl-4">
               <div className={`w-12 h-12 rounded-full bg-[#151518] border border-gray-800 flex items-center justify-center shadow-lg ${currentData.themeColor === 'blue' ? 'text-green-500' : 'text-orange-400'}`}>
                 {currentData.stat2Icon}
               </div>
               <div>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{currentData.stat2Label}</p>
                 <p className="text-base font-bold text-white leading-none">{currentData.stat2Value}</p>
               </div>
             </div>
           </div>


           {/* Progress Bar */}
           <div className="px-6 py-6 bg-[#0a0a0c]">
             <div className="flex justify-between text-xs font-bold mb-2">
               <span className="text-gray-400">Global Allocation Progress</span>
               <span className={`text-${currentData.themeColor}-400 font-mono`}>{currentData.currentMinted} / {currentData.limit}</span>
             </div>
             <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden relative">
               <div
                 className={`absolute top-0 left-0 h-full bg-${currentData.themeColor}-600 shadow-[0_0_10px_rgba(${currentData.themeColor === 'blue' ? '37,99,235' : '234,88,12'},0.8)]`}
                 style={{ width: `${(currentData.currentMinted / currentData.limit) * 100}%` }}
               ></div>
             </div>
           </div>


           {/* Features Card */}
           <div className="px-6 mb-4">
             <div className="bg-[#151518] border border-gray-800 rounded-2xl p-6">
               <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                 {currentData.featureIcon}
                 {currentData.featureTitle}
               </h3>
               <div className="space-y-6">
                 {currentData.features.map((feature: { icon: React.ReactNode; title: string; desc: string }, idx: number) => (
                   <div key={idx} className="flex items-start gap-4">
                     {feature.icon}
                     <div>
                       <span className="text-sm font-bold text-gray-200 block">{feature.title}</span>
                       <span className="text-xs text-gray-500 font-medium mt-1 block leading-relaxed opacity-80">{feature.desc}</span>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>


           {/* Compliance / Legal Note */}
           <div className="px-6 mb-8">
              <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 flex items-start gap-3">
                 <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                 <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                    <strong className="text-gray-400 block mb-1">LEGAL NOTE:</strong>
                    {currentData.legalNote}
                 </p>
              </div>
           </div>


         </div>


         {/* Sticky Bottom Bar */}
         <div className="absolute bottom-0 inset-x-0 bg-[#0a0a0c]/90 backdrop-blur-xl border-t border-gray-800 p-6 flex justify-between items-center rounded-b-[32px] z-50">
           <div>
             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Due</p>
             <p className="text-3xl font-extrabold text-white font-mono tracking-tight">{currentData.price} <span className="text-sm text-gray-500">USDC</span></p>
           </div>
           <button
             onClick={handlePurchase}
             className={`bg-${currentData.themeColor}-600 hover:bg-${currentData.themeColor}-500 active:scale-95 transition-all text-white font-bold py-3.5 px-6 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(${currentData.themeColor === 'blue' ? '37,99,235' : '234,88,12'},0.4)]`}
           >
             {selectedPackage === 'genesis' ? 'Secure Node' : 'Secure Fuel'}
             <ArrowRight className="w-4 h-4" />
           </button>
         </div>
       </div>




       {/* ======================= PAYMENT OVERLAY ======================= */}
       <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end transition-opacity duration-300 ${paymentStep === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
         <div className={`w-full bg-[#1c1c1e] rounded-t-[32px] p-6 pb-12 transform transition-transform duration-500 ${paymentStep === 'idle' ? 'translate-y-full' : 'translate-y-0'}`}>
           
            {paymentStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className={`w-16 h-16 rounded-full border-4 border-gray-700 border-t-${currentData.themeColor}-500 animate-spin mb-4`}></div>
                <p className="text-white font-bold text-lg mb-1">Authorizing Settlement</p>
                <p className="text-gray-400 text-sm">Validating via Coinbase Pay...</p>
              </div>
            )}


            {paymentStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4 text-black animate-bounce">
                   <Check className="w-8 h-8" strokeWidth={3} />
                </div>
                <p className="text-white font-bold text-lg">Transaction Cleared</p>
                <p className="text-gray-400 text-sm">Deploying smart contracts...</p>
              </div>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-600 rounded-full"></div>
         </div>
       </div>




       {/* ======================= UNBOXING SCREEN ======================= */}
       <div
          className={`absolute inset-0 bg-black flex flex-col items-center justify-center z-40 transition-opacity duration-1000 ${currentScreen === 'unboxing' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
       >
          {/* Background Particles */}
          <div className="absolute inset-0 overflow-hidden">
             <div className={`absolute top-1/4 left-1/4 w-2 h-2 bg-${currentData.themeColor}-500 rounded-full opacity-50 blur-[2px]`}></div>
             <div className="absolute top-3/4 left-3/4 w-3 h-3 bg-purple-500 rounded-full opacity-30 blur-[4px]"></div>
          </div>


          <div className={`relative transition-all duration-[1500ms] ease-out transform perspective-1000 ${unboxingStep === 'revealed' ? 'scale-100 rotate-y-0' : 'scale-50 rotate-y-180 opacity-0'}`}>
            
             {/* Glow Behind */}
             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-96 bg-${currentData.themeColor}-600 rounded-full blur-[80px] transition-opacity duration-1000 ${unboxingStep === 'revealed' ? 'opacity-40' : 'opacity-0'}`}></div>


             {/* DYNAMIC UNBOXING RENDER */}
             {selectedPackage === 'genesis' ? (
               /* --- PACKAGE B: GENESIS NODE HARDWARE REVEAL --- */
               <div className="w-[280px] h-[440px] bg-gradient-to-br from-[#1a1a1c] to-[#0a0a0c] rounded-2xl border border-gray-700 shadow-2xl relative overflow-hidden flex flex-col">
                   <div className="h-1/2 p-6 flex flex-col items-center justify-center relative border-b border-gray-800 bg-[#111]">
                       <div className="w-32 h-32 bg-white p-2 rounded-lg mb-4 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                           <div className="w-full h-full bg-black flex items-center justify-center text-white text-[8px] font-mono break-all p-1 leading-none opacity-80">
                              0x4B...A2F9<br/>VALIDATOR_KEY<br/>DELEGATED_AWS
                           </div>
                       </div>
                       <p className="text-gray-500 text-[10px] uppercase tracking-[0.2em] animate-pulse">Syncing L1 Data...</p>
                   </div>
                   <div className="h-1/2 p-6 flex flex-col justify-between bg-gradient-to-b from-[#151518] to-[#0a0a0c]">
                       <div>
                          <p className="text-blue-500 text-xs font-bold uppercase tracking-wider mb-2">Validator Node #248</p>
                          <h2 className="text-white text-2xl font-bold">Activated</h2>
                       </div>
                       <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                             <CheckCircle2 className="w-4 h-4 text-green-500" /><span>License Delegated on CoNET</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                             <CheckCircle2 className="w-4 h-4 text-green-500" /><span>Compute Yield Routed</span>
                          </div>
                       </div>
                   </div>
               </div>
             ) : (
               /* --- PACKAGE A: FUEL PACK VAULT REVEAL --- */
               <div className="w-[280px] h-[440px] bg-gradient-to-br from-[#1a1a1c] to-[#0a0a0c] rounded-2xl border border-orange-900 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-8">
                   <div className="absolute inset-0 bg-orange-600/5 mix-blend-overlay"></div>
                  
                   {/* Abstract Fuel Core */}
                   <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
                       <div className="absolute inset-0 border-4 border-dashed border-orange-500/30 rounded-full animate-[spin_10s_linear_infinite]"></div>
                       <div className="absolute inset-4 border-4 border-orange-500/50 rounded-full animate-[spin_5s_linear_infinite_reverse]"></div>
                       <Database className="w-16 h-16 text-orange-500 relative z-10 drop-shadow-[0_0_15px_rgba(234,88,12,0.8)]" />
                   </div>


                   <div className="text-center z-10 w-full">
                      <p className="text-orange-500 text-xs font-bold uppercase tracking-widest mb-2 animate-pulse">Vault Credited</p>
                      <h2 className="text-white text-4xl font-extrabold font-mono mb-1">100,000</h2>
                      <p className="text-gray-400 font-bold uppercase tracking-wider text-sm border-b border-gray-800 pb-4 mb-4">B-Units</p>
                     
                      <div className="flex items-center justify-center gap-2 text-sm text-green-400 font-medium bg-green-900/20 py-2 px-4 rounded-lg border border-green-500/20">
                         <CheckCircle2 className="w-4 h-4" />
                         <span>Routing Subsidies Active</span>
                      </div>
                   </div>
               </div>
             )}
          </div>


          {/* Success Text */}
          <div className={`mt-12 text-center transition-all duration-1000 delay-500 ${unboxingStep === 'revealed' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
             <h1 className="text-3xl font-bold text-white mb-2">Welcome to Beamio</h1>
             <p className="text-gray-400 text-sm">Your infrastructure assets are ready.</p>
            
             <button
               onClick={() => {setCurrentScreen('market'); setUnboxingStep('hidden')}}
               className="mt-8 bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-bold text-sm transition border border-white/10"
             >
               Enter Dashboard
             </button>
          </div>
       </div>


     </div>
    
     {/* CSS for custom animations */}
     <style>{`
       .hide-scrollbar::-webkit-scrollbar { display: none; }
       .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
       .perspective-1000 { perspective: 1000px; }
       .rotate-y-180 { transform: rotateY(180deg); }
       .rotate-y-0 { transform: rotateY(0deg); }
       @keyframes scan {
           0% { top: 0%; opacity: 0; }
           50% { opacity: 1; }
           100% { top: 100%; opacity: 0; }
       }
     `}</style>
   </div>
 );
};


export default App;

