import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Receipt, 
  Users, 
  Settings, 
  CreditCard, 
  ArrowUpRight, 
  Scan, 
  Zap, 
  Coins, 
  Ticket, 
  ChevronRight,
  Monitor,
  Smartphone,
  CheckCircle2,
  Database, 
  ShieldCheck, 
  History, 
  TrendingUp, 
  Wallet, 
  MessageSquare, 
  Send, 
  ArrowRightLeft, 
  Plus, 
  ArrowLeft, 
  QrCode, 
  Camera, 
  RefreshCw, 
  Cpu, 
  Globe, 
  Lock, 
  Search, 
  MoreVertical,
  Tag,
  Gift,
  ChevronDown,
  Info,
  ShieldAlert,
  Activity,
  Check,
  Heart,
  DollarSign,
  X,
  ExternalLink,
  MapPin,
  Clock,
  Edit3
} from 'lucide-react';

// --- Simulation Constants ---
const MOCK_BALANCES = {
  vouchers: 100.00,
  aa_usdc: 50.00,
  eoa_usdc: 200.00,
};

const ExampleExpressComponent = () => {
  const [activeTab, setActiveTab] = useState('pos'); 
  const [viewMode, setViewMode] = useState('mobile'); 
  const [posStep, setPosStep] = useState('input'); 
  const [posMode, setPosMode] = useState<string | null>(null); 
  const [posAmount, setPosAmount] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<{s: string, m: string}[]>([]);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  
  // Chat Interaction States
  const [showTipModal, setShowTipModal] = useState(false);
  const [showFullReceipt, setShowFullReceipt] = useState(false);
  const [tipAmount, setTipAmount] = useState<number | string>(0);
  const [tipConfirmed, setTipConfirmed] = useState(false);
  const [customTipMode, setCustomTipMode] = useState(false); // New: Custom Tip Mode
  const [customTipInput, setCustomTipInput] = useState('');
  
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTab, tipConfirmed]);

  // --- Financial Logic ---
  const BC_GST_RATE = 0.05; 
  const CAD_TO_USDC = 0.74;
  const rawTotalInput = parseFloat(posAmount) || 120.00; 
  
  // 1. Discount Logic
  const discountRate = (posMode === 'B_SCAN_C' && isMember) ? 0.9 : 1.0;
  const billableTotal = rawTotalInput * discountRate;
  
  // 2. Tax Logic (Reverse Calc)
  const subtotalCAD = billableTotal / (1 + BC_GST_RATE);
  const taxCAD = billableTotal - subtotalCAD;

  // 3. Grand Total (User Pay)
  const grandTotal = billableTotal + (typeof tipAmount === 'string' ? parseFloat(tipAmount || '0') : tipAmount || 0);
  
  // 4. Beamio Fee (Merchant Cost) - 0.8% Min 0.02 Max 2.00
  const rawFeeUSDC = billableTotal * CAD_TO_USDC * 0.008;
  const safeBeamioFeeUSDC = Math.max(0.02, Math.min(2.00, rawFeeUSDC)).toFixed(2);

  // 5. Split Logic
  const vPart = Math.min(billableTotal, MOCK_BALANCES.vouchers);
  const rem1 = billableTotal - vPart;
  const aaPart = Math.min(rem1, MOCK_BALANCES.aa_usdc);
  const rem2 = rem1 - aaPart;
  const eoaPart = Math.min(rem2, MOCK_BALANCES.eoa_usdc);
  const applePart = rem2 - eoaPart;

  const aaUSDC = (aaPart * CAD_TO_USDC).toFixed(2);
  const eoaUSDC = (eoaPart * CAD_TO_USDC).toFixed(2);

  const resetPOS = () => {
    setPosStep('input');
    setPosAmount('');
    setIsMember(false);
    setPosMode(null);
    setTerminalLogs([]);
    setReceiptSent(false);
    setTipAmount(0);
    setTipConfirmed(false);
    setShowFullReceipt(false);
    setIsSendingReceipt(false);
    setCustomTipMode(false);
    setCustomTipInput('');
  };

  const handleSendReceipt = () => {
    setIsSendingReceipt(true);
    setTimeout(() => {
      setIsSendingReceipt(false);
      setReceiptSent(true);
    }, 1200);
  };

  const runRoutingEngine = (isMemberDetected: boolean) => {
    setIsMember(isMemberDetected);
    setPosStep('execution');
    const logs = [
      { s: 'INIT', m: 'Initializing Beamio Smart Routing...' },
      { s: 'CONN', m: 'Base Mainnet Node [OK]' },
      { s: 'SCAN', m: 'Pre-signed intent found: 0x...f2e' },
      { s: 'MEMB', m: isMemberDetected ? 'CCSA Alliance: 10% OFF' : 'Standard Rate' },
      { s: 'TAX', m: `BC GST 5% Auto-calc: CA$ ${taxCAD.toFixed(2)}` },
      { s: 'FEE', m: `Service Fee (0.8%): ${safeBeamioFeeUSDC} USDC` },
      { s: 'T1', m: `Voucher Applied: CA$ ${vPart.toFixed(2)}` },
      { s: 'T4', m: applePart > 0 ? `Card Fill: CA$ ${applePart.toFixed(2)}` : 'Full On-chain' },
      { s: 'DONE', m: 'Routing Complete.' }
    ];
    logs.forEach((log, i) => {
      setTimeout(() => {
        setTerminalLogs(prev => [...prev, log]);
        if (i === logs.length - 1) setTimeout(() => setPosStep('routing_result'), 800);
      }, i * 300);
    });
  };

  // --- UI COMPONENTS ---

  const FullReceiptView = () => (
    <div className="absolute inset-0 z-[150] bg-white flex flex-col animate-in slide-in-from-bottom-6 duration-500 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 shrink-0">
        <button onClick={() => setShowFullReceipt(false)} className="p-2 bg-gray-50 rounded-full"><X size={20} /></button>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Official Receipt</span>
        <button className="p-2 bg-gray-50 rounded-full text-[#1562f0]"><ExternalLink size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide pb-20">
        <div className="text-center space-y-2">
           <div className="w-16 h-16 bg-[#1562f0] rounded-[24px] flex items-center justify-center text-white mx-auto shadow-xl shadow-[#1562f0]/20 mb-4">
              <Zap size={32} className="fill-current" />
           </div>
           <h3 className="text-2xl font-black italic tracking-tighter">Starbucks Coffee</h3>
           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center"><MapPin size={10} className="mr-1" /> Vancouver, North Branch</p>
        </div>

        <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
           <div className="flex justify-between items-center text-sm font-bold text-gray-500 uppercase tracking-tight">
              <span>Subtotal</span>
              <span className={isMember ? 'line-through opacity-40' : ''}>CA$ {subtotalCAD.toFixed(2)}</span>
           </div>
           {isMember && (
             <div className="flex justify-between items-center text-sm font-black text-emerald-500 uppercase tracking-tight">
                <span className="flex items-center"><Gift size={14} className="mr-2" /> CCSA 10% Discount</span>
                <span>-CA$ {(rawTotalInput * 0.1).toFixed(2)}</span>
             </div>
           )}
           <div className="flex justify-between items-center text-sm font-bold text-gray-500 uppercase tracking-tight">
              <span>BC GST (5%)</span>
              <span>CA$ {taxCAD.toFixed(2)}</span>
           </div>
           {tipConfirmed && (
             <div className="flex justify-between items-center text-sm font-black text-[#1562f0] uppercase tracking-tight">
                <span className="flex items-center"><Heart size={14} className="mr-2 fill-current" /> Added Tip</span>
                <span>CA$ {(typeof tipAmount === 'string' ? parseFloat(tipAmount) : tipAmount).toFixed(2)}</span>
             </div>
           )}
           
           <div className="pt-4 border-t border-gray-900 flex justify-between items-center">
              <span className="text-lg font-black uppercase tracking-tighter">Total Paid</span>
              <span className="text-3xl font-black italic text-[#1d1d1f] tracking-tighter">CA$ {grandTotal.toFixed(2)}</span>
           </div>
        </div>

        <div className="bg-[#f9fafb] rounded-[32px] p-6 space-y-4 border border-gray-50">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Atomic Settlement Proof</p>
           <div className="space-y-3">
              <div className={`flex justify-between items-center ${vPart > 0 ? 'opacity-100' : 'opacity-20'}`}>
                 <span className="text-[11px] font-bold flex items-center"><Ticket size={14} className="mr-2 text-[#1562f0]" /> Tier 1: Vouchers</span>
                 <span className="text-[11px] font-black text-[#1d1d1f]">CA$ {vPart.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between items-center ${rem1 > 0 ? 'opacity-100' : 'opacity-20'}`}>
                 <span className="text-[11px] font-bold flex items-center"><Zap size={14} className="mr-2 text-amber-500 fill-current" /> Tier 2/3: USDC Combined</span>
                 <span className="text-[11px] font-black text-[#1d1d1f]">{(rem1 * CAD_TO_USDC).toFixed(2)} USDC</span>
              </div>
              <div className={`flex justify-between items-center ${applePart > 0 ? 'opacity-100' : 'opacity-20'}`}>
                 <span className="text-[11px] font-bold flex items-center"><Smartphone size={14} className="mr-2 text-gray-400" /> Tier 4: Apple Pay Bridge</span>
                 <span className="text-[11px] font-black text-[#1d1d1f]">CA$ {applePart.toFixed(2)}</span>
              </div>
           </div>
           <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between opacity-50">
              <span className="text-[9px] font-mono">HASH: 0x8A2E...4F21B</span>
              <ShieldCheck size={14} />
           </div>
        </div>
      </div>
      
      <div className="p-6 bg-white border-t border-gray-100 shrink-0">
         <button onClick={() => setShowFullReceipt(false)} className="w-full py-4 bg-[#1d1d1f] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">Done</button>
      </div>
    </div>
  );

  const EoaPaymentView = () => (
    <div className="flex-1 bg-white flex flex-col p-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="flex justify-between items-center mb-6 shrink-0 text-[#1d1d1f]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#1562f0] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-[#1562f0]/20">B</div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest">EOA Gateway</h3>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-0.5 text-emerald-500">Static Request</p>
          </div>
        </div>
        <button onClick={() => setPosStep('input')} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"><ArrowLeft size={16} className="text-gray-400" /></button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8 overflow-y-auto pb-6 scrollbar-hide">
        <div className="text-center shrink-0">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[#1d1d1f]">STANDARD QR</h2>
          <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-widest">Fixed Wallet Address</p>
        </div>
        <div className="w-72 h-72 border-[3.5px] border-[#1562f0] rounded-[60px] flex items-center justify-center relative shadow-2xl shadow-[#1562f0]/10 shrink-0">
          <div className="w-48 h-48 relative">
            <QrCode size={192} strokeWidth={1.5} className="text-[#1562f0]" />
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-10 h-10 bg-white rounded-xl shadow-lg border border-gray-100 flex items-center justify-center"><span className="text-[#1562f0] font-black italic text-sm">B</span></div>
            </div>
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className="text-lg font-black tracking-tighter text-[#1d1d1f] uppercase italic">@JIUDINGSXIANG</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 shrink-0 pt-4 border-t border-gray-50">
        <button onClick={() => setPosStep('input')} className="py-4 rounded-2xl font-bold uppercase tracking-widest text-gray-400 text-[10px] hover:bg-gray-50 transition-colors">Cancel</button>
        <button onClick={() => setPosStep('input')} className="py-4 bg-[#1562f0] text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-[#1562f0]/20 active:scale-95">Confirm</button>
      </div>
    </div>
  );

  const ChatInvoiceCard = () => (
    <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-xl shadow-[#1562f0]/5 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-[#1562f0] p-5 text-white relative">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12"><Zap size={60} /></div>
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md"><Receipt size={20} /></div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-2 py-1 rounded-md backdrop-blur-md">Paid</span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Starbucks North Branch</p>
        <h3 className="text-2xl font-black italic tracking-tighter">CA$ {billableTotal.toFixed(2)}</h3>
      </div>
      
      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest"><span>Subtotal</span><span>CA$ {subtotalCAD.toFixed(2)}</span></div>
          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest"><span>BC GST (5%)</span><span>CA$ {taxCAD.toFixed(2)}</span></div>
        </div>
        
        <div className="h-px bg-gray-50"></div>
        
        <div className="flex flex-col space-y-3">
          <button 
            onClick={() => { setShowTipModal(true); setCustomTipMode(false); }}
            className="w-full py-3 bg-[#f5f5f7] hover:bg-gray-100 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-95"
          >
            <Heart size={16} className="text-[#1562f0]" />
            <span className="text-[11px] font-black uppercase text-[#1d1d1f] tracking-widest">
              {tipConfirmed ? `Tip Added: CA$ ${tipAmount}` : 'Add Tip'}
            </span>
          </button>
          
          <button onClick={() => setShowFullReceipt(true)} className="w-full py-3 border border-gray-100 rounded-2xl flex items-center justify-center space-x-2 text-gray-400 hover:text-[#1d1d1f] transition-colors">
            <span className="text-[10px] font-bold uppercase tracking-widest">View Full Receipt</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-[#1d1d1f] font-sans selection:bg-[#1562f0]/10">
      
      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-[340px] bg-white rounded-[40px] p-8 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6">
                 <h4 className="text-xl font-black italic uppercase tracking-tighter">Support Staff</h4>
                 <button onClick={() => setShowTipModal(false)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X size={18} /></button>
              </div>
              
              {!customTipMode ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                     {[15, 18, 20].map(pct => (
                       <button 
                         key={pct}
                         onClick={() => setTipAmount((billableTotal * pct / 100).toFixed(2))}
                         className={`py-5 rounded-[28px] border-2 flex flex-col items-center justify-center transition-all ${(typeof tipAmount === 'string' ? parseFloat(tipAmount) : tipAmount) === parseFloat((billableTotal * pct / 100).toFixed(2)) ? 'border-[#1562f0] bg-[#1562f0]/5 text-[#1562f0]' : 'border-gray-50 text-gray-400'}`}
                       >
                          <span className="text-sm font-black">{pct}%</span>
                          <span className="text-[8px] font-bold uppercase mt-1 tracking-widest">CA$ {(billableTotal * pct / 100).toFixed(2)}</span>
                       </button>
                     ))}
                  </div>
                  <button 
                    onClick={() => { setCustomTipMode(true); setTipAmount(0); }}
                    className="w-full py-4 mb-8 border-2 border-dashed border-gray-200 rounded-[28px] text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-[#1562f0] hover:text-[#1562f0] transition-colors"
                  >
                    Enter Custom Amount
                  </button>
                </>
              ) : (
                <div className="mb-8">
                   <div className="flex flex-col items-center justify-center mb-6">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom Tip (CAD)</p>
                      <input 
                        type="number" 
                        value={customTipInput}
                        onChange={(e) => { setCustomTipInput(e.target.value); setTipAmount(e.target.value); }}
                        placeholder="0.00"
                        className="text-5xl font-black text-center w-full outline-none placeholder:text-gray-200"
                        autoFocus
                      />
                   </div>
                   <button onClick={() => setCustomTipMode(false)} className="w-full py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest underline">Back to Percentages</button>
                </div>
              )}
              
              <button 
                disabled={!tipAmount || tipAmount <= 0}
                onClick={() => { setTipConfirmed(true); setShowTipModal(false); }} 
                className={`w-full py-5 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-[#1562f0]/20 active:scale-95 transition-all ${!tipAmount || tipAmount <= 0 ? 'bg-gray-200 cursor-not-allowed' : 'bg-[#1562f0]'}`}
              >
                Confirm Tip
              </button>
           </div>
        </div>
      )}

      {/* Nav */}
      <nav className="border-b border-gray-100 px-8 py-3 flex justify-between items-center bg-white/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-8 h-8 bg-[#1562f0] rounded-lg flex items-center justify-center shadow-lg shadow-[#1562f0]/20">
            <Zap className="text-white fill-current" size={16} />
          </div>
          <span className="text-lg font-bold tracking-tight text-[#1562f0]">Beamio</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-full p-1">
            <button onClick={() => setViewMode('desktop')} className={`px-4 py-1.5 rounded-full flex items-center space-x-2 text-[10px] font-bold transition-all ${viewMode === 'desktop' ? 'bg-white text-[#1562f0] shadow-sm' : 'text-gray-500'}`}>
              <Monitor size={12} /> <span className="hidden sm:inline uppercase">Dashboard</span>
            </button>
            <button onClick={() => setViewMode('mobile')} className={`px-4 py-1.5 rounded-full flex items-center space-x-2 text-[10px] font-bold transition-all ${viewMode === 'mobile' ? 'bg-white text-[#1562f0] shadow-sm' : 'text-gray-500'}`}>
              <Smartphone size={12} /> <span className="hidden sm:inline uppercase tracking-tighter">Terminal</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="flex">
        <main className={`flex-1 ${viewMode === 'mobile' ? 'flex justify-center py-8' : 'p-10'}`}>
          {viewMode === 'mobile' ? (
            <div className="w-[360px] h-[740px] bg-white rounded-[50px] border-[10px] border-[#1d1d1f] shadow-2xl overflow-hidden relative flex flex-col scale-100">
              <div className="h-8 bg-white flex justify-center items-end pb-1 relative z-50 shrink-0">
                <div className="w-20 h-5 bg-[#1d1d1f] rounded-b-2xl"></div>
              </div>

              <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
                
                {/* Full Receipt Overlay */}
                {showFullReceipt && <FullReceiptView />}

                {activeTab === 'pos' && (
                  <div className="flex-1 flex flex-col p-6 overflow-hidden animate-in fade-in">
                    <div className="flex justify-between items-center mb-6 shrink-0 text-[#1d1d1f]">
                       <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-[#1562f0] rounded-lg flex items-center justify-center text-white font-bold shadow-sm text-xs">B</div>
                          <div>
                             <h2 className="text-[10px] font-black uppercase tracking-tighter leading-none">PRO TERMINAL</h2>
                             <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mt-0.5 text-emerald-500">Hybrid Hub Active</p>
                          </div>
                       </div>
                       <button onClick={() => setPosStep('eoa_request')} className="w-10 h-10 rounded-xl bg-[#1562f0]/5 flex items-center justify-center text-[#1562f0] border border-[#1562f0]/10 shadow-sm hover:bg-[#1562f0]/10 transition-colors">
                          <QrCode size={18} />
                       </button>
                    </div>

                    {/* INPUT STEP */}
                    {posStep === 'input' && (
                      <div className="flex-1 flex flex-col animate-in slide-in-from-bottom-4 overflow-hidden">
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2 text-center">Charge Amount (CAD)</p>
                          <div className="text-6xl font-black tracking-tighter text-[#1d1d1f] mb-8">{posAmount || '0.00'}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-6 shrink-0">
                          {[1,2,3,4,5,6,7,8,9,'.',0,'del'].map(k => (
                            <button key={k} onClick={() => {
                              if (k === 'del') setPosAmount(p => p.slice(0,-1));
                              else if (posAmount.length < 8) setPosAmount(p => p + k);
                            }} className="h-12 bg-gray-50 rounded-2xl text-xl font-bold hover:bg-gray-100 active:scale-95 transition-all text-[#1d1d1f]">{k === 'del' ? '←' : k}</button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 shrink-0 mb-4">
                          <button disabled={!posAmount} onClick={() => { setPosMode('B_SCAN_C' as string); setPosStep('scanning'); }} className="py-5 rounded-[28px] bg-[#1562f0] text-white shadow-xl flex flex-col items-center justify-center space-y-1"><Camera size={20} /><span className="text-[8px] font-bold uppercase tracking-widest">Scan User</span></button>
                          <button disabled={!posAmount} onClick={() => { setPosMode('C_SCAN_B' as string); setPosStep('showing_qr'); }} className="py-5 rounded-[28px] bg-white border-2 border-[#1562f0] text-[#1562f0] flex flex-col items-center justify-center space-y-1 shadow-md"><QrCode size={20} /><span className="text-[8px] font-bold uppercase tracking-widest">Show QR</span></button>
                        </div>
                      </div>
                    )}

                    {/* SCANNING */}
                    {posStep === 'scanning' && (
                      <div className="flex-1 flex flex-col animate-in zoom-in duration-300 overflow-hidden">
                         <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="w-56 h-56 rounded-[48px] bg-gray-50 border border-gray-100 flex items-center justify-center relative overflow-hidden mb-8 shadow-inner">
                               <Camera size={40} className="text-[#1562f0] animate-pulse" />
                               <div className="absolute top-0 inset-x-0 h-1 bg-[#1562f0] animate-[scan_2s_linear_infinite]"></div>
                            </div>
                            <style>{`@keyframes scan { 0% { top: 10% } 50% { top: 90% } 100% { top: 10% } }`}</style>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-[#1d1d1f]">Recognizing</h3>
                            <div className="mt-12 flex flex-col space-y-3 w-full px-6 shrink-0">
                              <button onClick={() => runRoutingEngine(true)} className="py-4 bg-emerald-500 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 flex items-center justify-center space-x-2 transition-all"><Tag size={14} /> <span>Member Detected (Jason)</span></button>
                              <button onClick={() => runRoutingEngine(false)} className="py-4 bg-gray-100 text-gray-500 rounded-3xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Standard User</button>
                            </div>
                         </div>
                      </div>
                    )}

                    {/* SHOW QR */}
                    {posStep === 'showing_qr' && (
                      <div className="flex-1 flex flex-col animate-in fade-in duration-500 overflow-hidden">
                        <div className="flex-1 flex flex-col items-center justify-center">
                           <div className="bg-white p-6 rounded-[48px] shadow-[0_20px_60px_rgba(21,98,240,0.15)] border border-gray-50 mb-10">
                              <div className="w-56 h-56 relative flex items-center justify-center mx-auto">
                                 <QrCode size={210} strokeWidth={1.2} className="text-[#1d1d1f]" />
                                 <div className="absolute w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-gray-100">
                                    <Zap size={24} className="text-[#1562f0] fill-current" />
                                 </div>
                              </div>
                           </div>
                           <div className="text-center">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mb-1 italic">Scan to Pay (Total)</p>
                              <h4 className="text-3xl font-black text-[#1562f0] italic">CA$ {posAmount}</h4>
                           </div>
                           <div className="mt-12 w-full px-6">
                              <button onClick={() => runRoutingEngine(false)} className="w-full py-4 bg-[#f9fafb] border border-gray-200 text-[#1d1d1f] rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 shadow-sm active:bg-gray-100 transition-all">
                                 <RefreshCw size={14} className="animate-spin text-[#1562f0]" /><span>Simulate User Scanned</span>
                              </button>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* ROBOTIC EXECUTION ENGINE */}
                    {posStep === 'execution' && (
                      <div className="flex-1 flex flex-col bg-[#0b0b0b] -mx-6 -mt-6 p-8 text-white rounded-[42px] shadow-2xl relative overflow-hidden animate-in fade-in">
                        <div className="absolute top-0 right-0 p-10 opacity-5"><Cpu size={140} strokeWidth={1} /></div>
                        <div className="flex items-center space-x-2 mb-8 relative z-10">
                           <div className="w-2 h-2 bg-[#1562f0] rounded-full animate-ping"></div>
                           <p className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-[#1562f0]">Robotic Routing Exec</p>
                        </div>
                        <div className="flex-1 font-mono text-[9px] space-y-4 overflow-y-auto leading-relaxed relative z-10 scrollbar-hide pt-2 text-[#fff]">
                          {terminalLogs.map((log, i) => (
                            <div key={i} className="animate-in slide-in-from-left-2 fade-in duration-300 flex">
                              <span className="text-gray-500 mr-2 shrink-0">[{log.s}]</span>
                              <span className={log.s.startsWith('T') || log.s === 'MEMB' || log.s === 'FEE' || log.s === 'TAX' ? 'text-[#1562f0] font-bold' : log.s === 'DONE' ? 'text-emerald-400 font-bold' : 'text-gray-300'}>{log.m}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto pt-6 border-t border-white/10 flex justify-between items-center opacity-40 relative z-10">
                           <div className="flex items-center space-x-2"><Lock size={12} /><span className="text-[8px] font-black uppercase tracking-tighter">Atomic Pre-Clearing</span></div>
                           <RefreshCw size={12} className="animate-spin" />
                        </div>
                      </div>
                    )}

                    {/* ROUTING RESULT (REVIEW & CHARGE) */}
                    {posStep === 'routing_result' && (
                      <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-500">
                        <header className="mb-4 shrink-0">
                           <p className="text-[9px] text-[#1562f0] font-black uppercase tracking-[0.3em] mb-0.5 italic tracking-widest">Routing Result</p>
                           <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[#1d1d1f]">Review Settlement</h3>
                        </header>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 scrollbar-hide text-[#1d1d1f]">
                           <div className="bg-white border border-gray-100 p-4 rounded-[28px] shadow-sm flex items-center space-x-3 shrink-0">
                              <div className="w-10 h-10 bg-[#1562f0] rounded-xl flex items-center justify-center font-black text-lg text-white shadow-lg shadow-[#1562f0]/20">JT</div>
                              <div className="flex-1">
                                 <div className="flex items-center space-x-2">
                                    <p className="text-xs font-black">Jason Toronto</p>
                                    {(posMode === 'B_SCAN_C' && isMember) && <span className="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border border-emerald-500/20">Member</span>}
                                 </div>
                                 <p className="text-[9px] text-gray-400 font-mono">0x71c...A2E9</p>
                              </div>
                           </div>

                           <div className="bg-[#f9fafb] border border-gray-100 p-5 rounded-[36px] space-y-5 shadow-sm shrink-0 text-[#1d1d1f]">
                              <div className="space-y-2">
                                 <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                    <span>Initial Price</span>
                                    <span className={(posMode === 'B_SCAN_C' && isMember) ? 'line-through opacity-30 font-bold' : 'font-bold'}>CA$ {rawTotalInput.toFixed(2)}</span>
                                 </div>
                                 {(posMode === 'B_SCAN_C' && isMember) && (
                                   <div className="flex justify-between items-center bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100">
                                      <span className="text-[8px] font-black uppercase tracking-widest flex items-center"><Gift size={10} className="mr-1" /> CCSA 10% OFF</span>
                                      <span className="text-xs font-black">-CA$ {(rawTotalInput * 0.1).toFixed(2)}</span>
                                   </div>
                                 )}
                                 
                                 {/* NEW: Tax & Subtotal Breakdown (Smart Invoice Logic) */}
                                 <div className="pt-2 flex justify-between items-center text-[9px] font-bold text-gray-500">
                                    <span>Subtotal</span>
                                    <span>CA$ {subtotalCAD.toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between items-center text-[9px] font-bold text-gray-500">
                                    <span>BC GST (5.0%)</span>
                                    <span>CA$ {taxCAD.toFixed(2)}</span>
                                 </div>

                                 <div className="flex justify-between items-center pt-2 border-t border-gray-200/50 mt-2">
                                    <span className="text-[10px] font-black uppercase text-[#1562f0] tracking-tight">Final Settlement</span>
                                    <span className="text-xl font-black text-[#1562f0] italic whitespace-nowrap">CA$ {billableTotal.toFixed(2)}</span>
                                 </div>
                              </div>

                              <div className="h-px bg-gray-200"></div>

                              <div className="space-y-3">
                                 <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 italic">Atomic Sequence</p>
                                 <div className={`flex justify-between items-center ${vPart > 0 ? 'opacity-100' : 'opacity-20'}`}>
                                    <div className="flex items-center space-x-2"><Ticket size={12} className="text-[#1562f0]" /><span className="text-[10px] font-bold text-gray-600 tracking-tight">Tier 1: Vouchers</span></div>
                                    <span className="text-[10px] font-black">-CA$ {vPart.toFixed(2)}</span>
                                 </div>
                                 {(aaPart > 0 || eoaPart > 0) && (
                                   <div className="flex justify-between items-center">
                                      <div className="flex items-center space-x-2"><Zap size={12} className="text-amber-500" /><span className="text-[10px] font-bold text-gray-600 tracking-tight">Tier 2/3: USDC Credit</span></div>
                                      <span className="text-[10px] font-black">{(parseFloat(aaUSDC) + parseFloat(eoaUSDC)).toFixed(2)} USDC</span>
                                   </div>
                                 )}
                                 {applePart > 0 && (
                                   <div className="flex justify-between items-center">
                                      <div className="flex items-center space-x-2"><CreditCard size={12} className="text-gray-400" /><span className="text-[10px] font-bold text-gray-600 tracking-tight">Tier 4: Card Bridge</span></div>
                                      <span className="text-[10px] font-black">+CA$ {applePart.toFixed(2)}</span>
                                   </div>
                                 )}
                              </div>
                              <div className="h-px bg-gray-200"></div>
                              <div className="flex justify-between items-center bg-gray-100/50 p-3 rounded-2xl border border-gray-200/50">
                                 <span className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Service Fee (0.8%)</span>
                                 <span className="text-xs font-black text-[#1d1d1f]">{safeBeamioFeeUSDC} USDC</span>
                              </div>
                           </div>
                        </div>

                        <div className="mt-auto space-y-2 shrink-0 pt-4 bg-white border-t border-gray-50 pb-2">
                           <button onClick={() => setPosStep('success')} className="w-full py-5 bg-[#1562f0] text-white rounded-[24px] font-black text-lg shadow-xl shadow-[#1562f0]/30 active:scale-95 transition-all uppercase tracking-tighter italic">
                              Charge & Finalize
                           </button>
                           <button onClick={resetPOS} className="w-full py-2 text-gray-300 text-[9px] font-black uppercase tracking-widest">Abort Transaction</button>
                        </div>
                      </div>
                    )}

                    {/* SUCCESS / DONE STEP */}
                    {posStep === 'success' && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in duration-500 overflow-hidden px-4 text-[#1d1d1f]">
                         <div className="w-16 h-16 bg-[#1562f0] rounded-full flex items-center justify-center mb-6 shadow-xl shadow-[#1562f0]/20 animate-bounce">
                            <CheckCircle2 size={32} className="text-white" strokeWidth={3} />
                         </div>
                         <h2 className="text-3xl font-black mb-1 tracking-tighter uppercase italic tracking-widest">Done</h2>
                         <p className="text-gray-400 text-[9px] font-bold uppercase tracking-widest mb-10">Settled on Base Network</p>
                         
                         <div className="w-full bg-[#f9f9f9] border border-gray-100 p-6 rounded-[32px] text-left space-y-4 mb-8 shadow-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Final Cleared</span>
                              <span className="text-xl font-black italic text-[#1562f0] whitespace-nowrap">CA$ {billableTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200/50">
                               <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Service Fee</span>
                               <span className="text-[11px] font-black">{safeBeamioFeeUSDC} USDC</span>
                            </div>
                            <div className="pt-4 border-t border-gray-200 flex justify-between items-center font-mono text-[8px] text-gray-400">
                               <span>TX: 0x8A...4F2E</span>
                               <div className="flex items-center space-x-1 text-emerald-500 font-black uppercase tracking-tighter">
                                  <Lock size={8} /> <span>Confirmed</span>
                               </div>
                            </div>
                         </div>

                         <div className="w-full space-y-3">
                            <button 
                              onClick={handleSendReceipt}
                              disabled={receiptSent || isSendingReceipt}
                              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-all ${
                                receiptSent 
                                ? 'bg-emerald-500 text-white cursor-default shadow-md shadow-emerald-500/20' 
                                : isSendingReceipt 
                                  ? 'bg-gray-100 text-gray-400' 
                                  : 'bg-white border-2 border-[#1562f0] text-[#1562f0] hover:bg-blue-50 active:scale-95 shadow-sm'
                              }`}
                            >
                               {isSendingReceipt ? (
                                 <><RefreshCw size={14} className="animate-spin" /> <span>Sending...</span></>
                               ) : receiptSent ? (
                                 <><Check size={14} /> <span>Invoice Sent to Chat</span></>
                               ) : (
                                 <><MessageSquare size={14} /> <span>Send Invoice to Chat</span></>
                               )}
                            </button>
                            <button 
                              onClick={resetPOS} 
                              className="w-full py-4 bg-[#1d1d1f] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                            >
                               Next Client
                            </button>
                         </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'chat' && (
                  <div className="flex-1 flex flex-col bg-[#fcfcfd] animate-in slide-in-from-right-4 duration-300 overflow-hidden">
                    <header className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
                       <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-[#f5f5f7] rounded-xl flex items-center justify-center border border-gray-200"><Tag size={18} className="text-[#1562f0]" /></div>
                          <div><h3 className="text-sm font-black">Starbucks Coffee</h3><p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest flex items-center"><ShieldCheck size={10} className="mr-1" /> Verified Store</p></div>
                       </div>
                       <MoreVertical size={18} className="text-gray-300" />
                    </header>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                       <div className="flex flex-col space-y-1">
                          <p className="text-[9px] text-gray-300 font-bold uppercase text-center mb-6 tracking-[0.2em]">Today • 11:35 PM</p>
                          <div className="bg-[#f5f5f7] p-4 rounded-[24px] rounded-tl-none max-w-[85%] text-[11px] font-medium leading-relaxed shadow-sm">
                            Thanks for visiting! Here's your smart invoice. ☕️
                          </div>
                       </div>
                       
                       <ChatInvoiceCard />

                       {tipConfirmed && (
                         <div ref={chatBottomRef} className="flex justify-end animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-[#1562f0] text-white p-5 rounded-[28px] rounded-tr-none max-w-[80%] text-[11px] font-bold shadow-xl shadow-[#1562f0]/20 leading-relaxed">
                               Just added CA$ {tipAmount} as a tip. Great service! 🙏✨
                            </div>
                         </div>
                       )}
                    </div>
                    
                    <div className="p-4 bg-white border-t border-gray-100 flex items-center space-x-3 shrink-0">
                       <div className="bg-gray-50 p-2.5 rounded-xl"><Plus size={18} className="text-gray-400" /></div>
                       <div className="flex-1 bg-gray-50 px-4 py-3 rounded-2xl text-[11px] font-bold text-gray-300">Message Starbucks...</div>
                       <div className="bg-[#1562f0] p-2.5 rounded-xl text-white shadow-lg"><Send size={18} /></div>
                    </div>
                  </div>
                )}

                {activeTab !== 'pos' && activeTab !== 'chat' && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
                    <Database size={32} className="text-gray-200 mb-4 opacity-50" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Module Active</p>
                    <button onClick={() => setActiveTab('pos')} className="mt-4 text-[#1562f0] text-[9px] font-black uppercase underline hover:opacity-70">Back to Terminal</button>
                  </div>
                )}
              </div>

              {/* GLOBAL BOTTOM NAV */}
              <div className="h-16 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center px-4 pb-4 shrink-0 z-50">
                {[{ id: 'pos', icon: CreditCard, label: 'POS' }, { id: 'wallet', icon: Wallet, label: 'Wallet' }, { id: 'chat', icon: MessageSquare, label: 'Chat' }, { id: 'dashboard', icon: LayoutDashboard, label: 'Admin' }].map(item => (
                  <button key={item.id} onClick={() => {setActiveTab(item.id); if(item.id==='pos') resetPOS();}} className={`flex flex-col items-center space-y-0.5 transition-all ${activeTab === item.id ? 'text-[#1562f0] scale-105' : 'text-gray-400'}`}>
                    <item.icon size={16} /><span className="text-[7px] font-black uppercase tracking-widest leading-none">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500">
               <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-4xl font-black tracking-tight text-[#1d1d1f]">BEAMIO PRO</h1>
                    <p className="text-gray-400 text-sm mt-1 uppercase font-bold tracking-widest">Enterprise Intelligence • Node v7.3</p>
                  </div>
                  <button className="px-6 py-3 bg-[#1562f0] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#1562f0]/20 active:scale-95 transition-all">New Campaign</button>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-100 p-10 rounded-[48px] shadow-sm"><p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest opacity-60">Rolling Volume</p><h3 className="text-4xl font-black italic tracking-tighter text-[#1d1d1f]">CA$ 12,840.50</h3></div>
                  <div className="bg-[#1d1d1f] p-10 rounded-[48px] shadow-sm text-white relative overflow-hidden"><p className="text-[10px] font-black opacity-40 uppercase mb-2 tracking-widest">Active Pool</p><h3 className="text-4xl font-black italic tracking-tighter text-emerald-400">4,200 USDC</h3></div>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ExampleExpressComponent;

