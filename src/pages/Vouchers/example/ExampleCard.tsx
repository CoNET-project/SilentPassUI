import React, { useState, useEffect } from 'react';
import { 
  Search, Scan, Home, Wallet, MessageCircle, Store, Plus, 
  ArrowUpRight, ArrowDownLeft, MoreHorizontal, CreditCard, 
  Gift, QrCode, ShieldCheck, Zap, Landmark, Repeat, 
  ArrowRightLeft, Send, Download, Banknote, Link,
  X, ChevronLeft, Check, User, Clock, Receipt, Copy, ExternalLink, Calendar,
  Filter, ChevronDown, PieChart, MapPin, Ticket, Tag, LayoutGrid
} from 'lucide-react';
import { ReactNode } from 'react';

// --- Types ---
interface Transaction {
  id: number;
  title: string;
  date: string;
  amount: string;
  icon: ReactNode;
  type: string;
  status?: string;
  hash?: string;
  fee?: string;
}

interface User {
  id: string;
  name: string;
  handle: string;
  address: string;
  avatar: string;
}

interface Card {
  id: string;
  name: string;
  balance: string;
  currency: string;
  tier: string;
  type: string;
  category: string;
  bgClass?: string;
  gradient: string;
  logo: ReactNode | string;
  logoBg: string;
  autoRefuel?: boolean;
  priority: number;
  contextTrigger?: string;
}

interface HistoryItemProps {
  tx: Transaction;
  darkTheme?: boolean;
  onClick?: () => void;
}

interface WalletActionProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  primary?: boolean;
}

interface NavIconProps {
  icon: ReactNode;
}

const BeamioAppExample = () => {
  const [activeView, setActiveView] = useState<string | null>(null); 
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showMainHistory, setShowMainHistory] = useState(false);
  const [sendStep, setSendStep] = useState(0); 
  const [sendData, setSendData] = useState<{ recipient: User | null; amount: string; note: string }>({ recipient: null, amount: '', note: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [cardFilter, setCardFilter] = useState('All'); 
  const [isStackExpanded, setIsStackExpanded] = useState(false);
  const [smartContext, setSmartContext] = useState<string | null>(null); 

  useEffect(() => { setTimeout(() => setIsLoaded(true), 100); }, []);

  // Main Wallet Data
  const mainWallet = {
    address: "0x43F0...B024",
    balance: "1,250.00",
    currency: "USDC",
    label: "Main Vault",
    network: "Base Mainnet"
  };

  const searchResults = [
    { id: 'u1', name: 'Consumer', handle: '@Beamio_Consumer', address: '0x58ac...794d', avatar: 'bg-indigo-500' },
    { id: 'u2', name: 'Daily Grind Cafe', handle: '@Beamiocafe', address: '0xfee7...fe7c', avatar: 'bg-orange-500' },
    { id: 'u3', name: 'BeamioMVP2', handle: '@BeamioMVP2', address: '0xcee6...ff75', avatar: 'bg-emerald-500' },
  ];

  const allExpressCards = [
    { id: "aa_usdc", name: "Express Cash", balance: "45.50", currency: "USDC", tier: "Smart Account", type: "Cash", category: "All", bgClass: "bg-blue-600", gradient: "bg-gradient-to-br from-blue-600 to-blue-800", logo: <Zap size={24} fill="currentColor" />, logoBg: "bg-white/20", autoRefuel: true, priority: 100 },
    { id: "card_ccsa", name: "CCSA Membership", balance: "120.00", currency: "$CCSA", tier: "Gold Member", type: "Voucher", category: "Membership", gradient: "bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-indigo-900", logo: "C", logoBg: "bg-indigo-500", priority: 10 },
    { id: "card_neon", name: "Neon City Festival", balance: "2", currency: "Tickets", tier: "VIP Pass", type: "Ticket", category: "Ticket", gradient: "bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-500 via-rose-600 to-rose-700", logo: "N", logoBg: "bg-white/20", priority: 5, contextTrigger: 'festival' },
    { id: "card_golf", name: "Golf Club Elite", balance: "500.00", currency: "$GOLF", tier: "Diamond", type: "Voucher", category: "Membership", gradient: "bg-[conic-gradient(at_bottom_left,_var(--tw-gradient-stops))] from-teal-600 via-emerald-700 to-emerald-900", logo: "G", logoBg: "bg-white/20", priority: 4 },
    { id: "card_starbucks", name: "Starbucks Rewards", balance: "1250", currency: "Stars", tier: "Gold", type: "Coupon", category: "Coupon", gradient: "bg-gradient-to-br from-green-700 to-emerald-900", logo: "S", logoBg: "bg-white/20", priority: 3, contextTrigger: 'coffee' },
    { id: "card_subway", name: "Subway Club", balance: "5.00", currency: "Points", tier: "Member", type: "Coupon", category: "Coupon", gradient: "bg-gradient-to-r from-yellow-400 to-green-500", logo: "Sub", logoBg: "bg-white/20", priority: 2 },
    { id: "card_cinema", name: "AMC Theatres", balance: "1", currency: "Ticket", tier: "IMAX", type: "Ticket", category: "Ticket", gradient: "bg-gradient-to-br from-red-600 to-black", logo: "AMC", logoBg: "bg-white/20", priority: 1 }
  ];

  const getProcessedCards = () => {
    let processed = [...allExpressCards];
    if (cardFilter !== 'All') processed = processed.filter(c => c.category === cardFilter || c.type === 'Cash');
    if (smartContext) {
      processed.sort((a, b) => {
        const aBoost = a.contextTrigger === smartContext ? 1000 : 0;
        const bBoost = b.contextTrigger === smartContext ? 1000 : 0;
        return (b.priority + bBoost) - (a.priority + aBoost);
      });
    } else {
      processed.sort((a, b) => b.priority - a.priority);
    }
    return processed;
  };

  const displayedCards = getProcessedCards();
  const visibleStackCards = isStackExpanded ? displayedCards : displayedCards.slice(0, 4);
  const hiddenCount = displayedCards.length - visibleStackCards.length;

  const getMainPreview = () => [
    { id: 101, title: "Sent to @Alice", date: "Today", amount: "-50.00 USDC", icon: <Send size={18} />, type: 'out' },
    { id: 102, title: "Coinbase Deposit", date: "Yesterday", amount: "+500.00 USDC", icon: <Banknote size={18} />, type: 'in' },
    { id: 103, title: "Refuel Express Pay", date: "Feb 08", amount: "-100.00 USDC", icon: <Zap size={18} />, type: 'transfer' },
  ];

  const getFullMainHistory = () => ({
    "Pending": [{ id: 999, title: "Bridge from Ethereum", date: "Est. 5 mins", amount: "+1000.00 USDC", icon: <ArrowRightLeft size={18} />, type: 'in', status: 'Pending', hash: '0x...' }],
    "February 2026": [{ id: 101, title: "Sent to @Alice", date: "Feb 09", amount: "-50.00 USDC", icon: <Send size={18} />, type: 'out', status: 'Completed', hash: '0x...' }, { id: 102, title: "Coinbase Deposit", date: "Feb 08", amount: "+500.00 USDC", icon: <Banknote size={18} />, type: 'in', status: 'Completed', hash: '0x...' }],
    "January 2026": [{ id: 105, title: "Year End Bonus", date: "Jan 30", amount: "+2000.00 USDC", icon: <Gift size={18} />, type: 'in', status: 'Completed', hash: '0x...' }]
  });
  const fullMainHistory = getFullMainHistory();

  const getExpressHistory = (cardId: string): Transaction[] => {
     return [
        { id: 301, title: "Usage Activity", date: "Today", amount: "-10.00", icon: <Zap size={18} />, type: 'pay', status: 'Completed', hash: '0x...', fee: 'Sponsored' },
        { id: 302, title: "Top Up", date: "Yesterday", amount: "+50.00", icon: <Plus size={18} />, type: 'in', status: 'Completed', hash: '0x...', fee: 'Sponsored' },
        { id: 303, title: "Points Earned", date: "Feb 05", amount: "+15.00", icon: <Store size={18} />, type: 'in', status: 'Completed', hash: '0x...', fee: 'Sponsored' },
     ];
  };
  const activeExpressHistoryData = activeView && activeView !== 'main' ? getExpressHistory(activeView) : [];

  const handleMainWalletClick = () => { setActiveView(activeView === 'main' ? null : 'main'); setShowMainHistory(false); };
  const handleExpressCardClick = (id: string) => setActiveView(activeView === id ? null : id);
  const startSendFlow = () => { setSendStep(1); setSendData({ recipient: null, amount: '', note: '' }); setSearchQuery(''); };
  const selectRecipient = (user: User) => { setSendData({ ...sendData, recipient: user }); setSendStep(2); };
  const confirmAmount = () => { if (!sendData.amount) return; setSendStep(3); };
  const executeTransaction = () => { setTimeout(() => setSendStep(4), 1500); };
  const closeSendFlow = () => { setSendStep(0); setActiveView(null); };

  return (
    <div className="flex justify-center bg-gray-200 min-h-screen font-sans antialiased">
      <div className="w-full max-w-md bg-[#F2F2F7] min-h-screen shadow-2xl overflow-hidden relative flex flex-col">
        
        {/* Header */}
        <header className={`px-5 pt-14 pb-2 bg-[#F2F2F7]/90 backdrop-blur-md sticky top-0 z-30 transition-all duration-300 ${activeView && activeView !== 'main' ? 'opacity-0 -translate-y-full' : 'opacity-100'}`}>
          <div className="flex justify-between items-center mb-1">
            <h1 className="text-[34px] font-bold text-black tracking-tight">Wallet</h1>
            <div className="flex gap-3">
               <button onClick={() => setSmartContext(smartContext ? null : 'festival')} className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform ${smartContext ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400'}`} title="Simulate Context: Festival"><MapPin size={18} /></button>
               <button className="bg-white w-9 h-9 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"><Scan size={20} className="text-black" /></button>
            </div>
          </div>
        </header>

        {/* Send Flow Overlay */}
        {sendStep > 0 && (
          <div className="absolute inset-0 z-[100] bg-[#F2F2F7] flex flex-col animate-in slide-in-from-bottom duration-300">
             {/* Simplified Send Flow View for brevity, keeping logic intact */}
             <div className="px-5 pt-14 pb-4 flex items-center gap-3">
                <button onClick={closeSendFlow} className="p-2 -ml-2 rounded-full hover:bg-gray-200"><X size={24} /></button>
                {sendStep === 1 && <div className="flex-1 bg-white h-12 rounded-2xl flex items-center px-4 shadow-sm"><input autoFocus type="text" placeholder="@BeamioTag" className="flex-1 outline-none text-sm bg-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>}
                {sendStep > 1 && <div className="flex-1 font-bold text-lg text-center">Step {sendStep}</div>}
             </div>
             {sendStep === 1 && <div className="px-5 mt-2 space-y-4">{searchResults.map(user => (<div key={user.id} onClick={() => selectRecipient(user)} className="flex items-center gap-4 cursor-pointer p-2 bg-white rounded-xl"><div className={`w-10 h-10 rounded-full ${user.avatar} text-white flex items-center justify-center`}>{user.name[0]}</div><div><div className="font-bold">{user.name}</div><div className="text-xs text-gray-500">{user.handle}</div></div></div>))}</div>}
             {sendStep > 1 && <div className="flex-1 flex flex-col items-center justify-center p-6"><h2 className="text-2xl font-bold mb-4">{sendStep === 2 ? 'Enter Amount' : sendStep === 3 ? 'Confirm' : 'Success'}</h2><button onClick={sendStep === 2 ? confirmAmount : sendStep === 3 ? executeTransaction : closeSendFlow} className="w-full py-4 bg-black text-white rounded-full font-bold">Continue</button></div>}
          </div>
        )}

        {/* Scrollable Main Content */}
        <div className="flex-1 overflow-y-auto pb-32 px-4 scroll-smooth relative no-scrollbar">
          
          {/* LAYER 1: MAIN WALLET (EOA) 
              FIX: Now collapses to h-0, mb-0, opacity-0 when an Express Card is active
          */}
          <div 
            onClick={handleMainWalletClick}
            className={`relative z-40 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] 
              ${activeView && activeView !== 'main' ? 'h-0 mb-0 opacity-0 overflow-hidden pointer-events-none' : 'opacity-100 translate-y-0 mb-6'}`}
          >
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1 flex items-center gap-1"><ShieldCheck size={12} /> Main Vault (EOA)</h2>
            <div className={`relative w-full rounded-[32px] bg-black text-white p-6 shadow-2xl overflow-hidden group transition-all duration-500 ${activeView === 'main' ? 'h-[600px]' : 'h-48'}`}>
               <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
               <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                     <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div><span className="text-[10px] font-bold tracking-wider">Self-Custody</span></div>
                     <Landmark size={20} className="text-white/50" />
                  </div>
                  <div>
                     <p className="text-xs font-medium text-gray-400 mb-1">Total Assets</p>
                     <div className="flex items-baseline gap-2"><span className="text-4xl font-medium tracking-tight">{mainWallet.balance}</span><span className="text-lg font-medium text-gray-400">{mainWallet.currency}</span></div>
                     <div className="flex items-center gap-2 mt-2 opacity-60 hover:opacity-100 transition-opacity cursor-pointer w-fit"><p className="text-xs font-mono text-gray-400 bg-white/10 px-2 py-1 rounded-lg flex items-center gap-2">{mainWallet.address} <Copy size={10} /></p></div>
                  </div>
                  <div className={`mt-8 transition-opacity duration-300 flex-1 flex flex-col ${activeView === 'main' ? 'opacity-100 delay-100' : 'opacity-0 hidden'}`}>
                    <div className="grid grid-cols-4 gap-2 mb-8">
                      <WalletAction icon={<Send size={20} />} label="Send" onClick={() => startSendFlow()} />
                      <WalletAction icon={<QrCode size={20} />} label="Request" onClick={() => {}} />
                      <WalletAction icon={<Gift size={20} />} label="Cashcode" onClick={() => {}} />
                      <WalletAction icon={<Banknote size={20} />} label="Bank" onClick={() => {}} />
                    </div>
                    <div className="flex-1"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h3><div className="space-y-1">{getMainPreview().map(tx => (<HistoryItem key={tx.id} tx={tx as Transaction} darkTheme onClick={() => setSelectedTx(tx as Transaction)} />))}</div></div>
                    <div className="mt-6 pt-4 border-t border-white/10 text-center pb-6"><button onClick={(e) => { e.stopPropagation(); setShowMainHistory(true); }} className="text-xs font-bold text-white/90 hover:text-white bg-white/10 w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg border border-white/5">View Full History <ChevronDown size={14} className="-rotate-90" /></button></div>
                  </div>
                  <div className={`absolute bottom-6 left-6 right-6 flex justify-end items-end transition-opacity duration-300 ${activeView === 'main' ? 'opacity-0 hidden' : 'opacity-100'}`}><div className="w-8 h-5 rounded bg-gradient-to-r from-yellow-400 to-yellow-600 opacity-80 shadow-lg"></div></div>
               </div>
            </div>
          </div>

          {/* LAYER 2: EXPRESS PAY (AA) STACK */}
          <div className={`relative perspective-1000 min-h-[400px] transition-transform duration-500 ${activeView === 'main' ? 'translate-y-[100px] opacity-50 blur-sm pointer-events-none' : ''}`}>
             <div className={`flex justify-between items-center mb-3 ml-1 transition-opacity ${activeView && activeView !== 'main' ? 'opacity-0' : 'opacity-100'}`}>
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">Express Pay ({allExpressCards.length}){smartContext && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 rounded-md flex items-center gap-1 animate-pulse"><MapPin size={8} /> Nearby</span>}</h2>
                <div className="flex gap-2">{['All', 'Membership', 'Ticket'].map(filter => (<button key={filter} onClick={() => setCardFilter(filter)} className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${cardFilter === filter ? 'bg-slate-800 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}>{filter}</button>))}</div>
             </div>

            <div className={`relative transition-all duration-500 ${isStackExpanded ? 'pb-20' : ''}`}>
              {visibleStackCards.map((card, index) => {
                const isSelected = activeView === card.id;
                
                // FIXED LOGIC: 
                // When selected, card stays at top: 0 (relative to the now top-aligned container since MainWallet collapsed)
                // When not selected but another is: push down
                let top = index * 55;
                if (isStackExpanded) top = index * 230;
                
                if (activeView && activeView !== 'main') {
                  // Since Main Wallet collapsed to 0 height, top: 0 is correct for the selected card
                  top = isSelected ? 0 : 800; 
                } else if (activeView === 'main') {
                  top = index * 30;
                }

                return (
                  <div
                    key={card.id}
                    onClick={() => handleExpressCardClick(card.id)}
                    className={`absolute w-full h-52 rounded-[24px] text-white shadow-lg transition-all duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) ${card.gradient} ${isStackExpanded ? 'shadow-md' : ''}`}
                    style={{
                      top: `${top}px`,
                      zIndex: isSelected ? 60 : 50 - index, // Ensure selected is above everything
                      transform: activeView && activeView !== 'main' && !isSelected ? 'scale(0.95)' : 'scale(1)',
                      opacity: activeView && activeView !== 'main' && !isSelected ? 0 : 1
                    }}
                  >
                     <div className="p-5 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-sm backdrop-blur-sm ${card.logoBg} text-white`}>{card.logo}</div>
                              <div><h3 className="font-bold text-lg leading-tight">{card.name}</h3><p className="text-[10px] uppercase font-bold opacity-70 flex items-center gap-1">{card.tier}{smartContext === card.contextTrigger && <span className="bg-white/20 px-1 rounded flex items-center gap-0.5"><MapPin size={8} /> Auto-Sort</span>}</p></div>
                           </div>
                           <div className="bg-black/10 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold border border-white/5">{card.category}</div>
                        </div>
                        <div className="flex justify-between items-end">
                           <div><p className="text-[10px] font-bold opacity-60 uppercase mb-0.5">Balance</p><div className="flex items-baseline gap-1"><span className="text-3xl font-medium tracking-tighter">{card.balance}</span><span className="text-sm font-semibold opacity-90">{card.currency}</span></div></div>
                           <div className="opacity-20 transform scale-150 origin-bottom-right">{card.logo}</div>
                        </div>
                     </div>
                  </div>
                );
              })}
              {!isStackExpanded && hiddenCount > 0 && !activeView && (<div onClick={() => setIsStackExpanded(true)} className="absolute w-[94%] left-[3%] h-12 rounded-[24px] bg-white border-2 border-slate-100 shadow-sm flex items-center justify-center text-xs font-bold text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors z-0" style={{ top: `${visibleStackCards.length * 55 + 10}px`, transform: 'scale(0.95)' }}><LayoutGrid size={14} className="mr-2" /> View {hiddenCount} more passes...</div>)}
              {isStackExpanded && !activeView && (<div onClick={() => setIsStackExpanded(false)} className="absolute left-0 right-0 flex justify-center py-4 z-50" style={{ top: `${visibleStackCards.length * 230}px` }}><button className="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">Collapse Stack <ChevronDown size={14} className="rotate-180" /></button></div>)}
            </div>
          </div>
        </div>

        {/* DETAILS PANEL - EXPRESS PAY HISTORY (With fixed positioning logic) 
            FIX: top-[280px] ensures it starts exactly under the selected card (h-52 approx 208px + margin)
        */}
        <div 
          className={`absolute inset-x-0 bottom-0 top-[280px] bg-white rounded-t-[32px] transition-transform duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) z-40 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] ${activeView && activeView !== 'main' ? 'translate-y-0' : 'translate-y-[1000px]'}`}
        >
          {/* Drag Handle & Close */}
          <div className="w-full flex justify-center pt-3 pb-1" onClick={() => setActiveView(null)}><div className="w-12 h-1.5 bg-slate-200 rounded-full cursor-pointer hover:bg-slate-300 transition-colors"></div></div>
          
          <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
             <span className="text-sm font-bold text-gray-900">Card Details</span>
             <button onClick={() => setActiveView(null)} className="bg-gray-100 p-1.5 rounded-full hover:bg-gray-200"><ArrowDownLeft className="w-4 h-4 text-gray-500 rotate-45" /></button>
          </div>

          {/* Action Grid (Pay/TopUp/Receipts) - CLEARLY VISIBLE NOW */}
          <div className="px-6 py-6 grid grid-cols-3 gap-4">
             <ActionButton icon={<Scan size={24} />} label="Pay / Redeem" primary={true} />
             <ActionButton icon={<Plus size={24} />} label="Top Up" primary={false} />
             <ActionButton icon={<Receipt size={24} />} label="Receipts" primary={false} />
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-24">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Activity Log</h4>
            <div className="space-y-2">
               {activeExpressHistoryData.map(tx => (<HistoryItem key={tx.id} tx={tx} darkTheme={false} onClick={() => setSelectedTx(tx)} />))}
               {activeExpressHistoryData.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No recent activity.</p>}
            </div>
          </div>
        </div>

        {/* Full Main History Sheet */}
        {showMainHistory && (
          <div className="absolute inset-0 z-[70] bg-[#F2F2F7] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="px-5 pt-14 pb-4 flex items-center justify-between bg-white border-b border-gray-100 sticky top-0 z-20"><button onClick={() => setShowMainHistory(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-slate-900 flex items-center gap-1"><ChevronLeft size={24} /><span className="text-sm font-bold">Back</span></button><h2 className="font-bold text-lg">Vault History</h2><div className="w-16"></div></div>
            <div className="bg-white pb-4 px-5 pt-2 shadow-sm z-10"><div className="flex bg-gray-100 p-1 rounded-xl mb-4"><button className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900">All</button><button className="flex-1 py-1.5 text-xs font-bold rounded-lg text-gray-500">Income</button><button className="flex-1 py-1.5 text-xs font-bold rounded-lg text-gray-500">Expenses</button></div></div>
            <div className="flex-1 overflow-y-auto px-5 pb-20 pt-4">{Object.entries(fullMainHistory).map(([group, items]) => (<div key={group} className="mb-6"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 sticky top-0 bg-[#F2F2F7] py-2 z-0">{group}</h3><div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">{items.map((tx, idx) => (<div key={tx.id} onClick={() => setSelectedTx(tx as Transaction)} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50"><div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">{tx.icon}</div><div className="flex-1"><h4 className="font-bold text-sm">{tx.title}</h4></div><span className="font-bold text-sm">{tx.amount}</span></div>))}</div></div>))}</div>
          </div>
        )}

        {/* Receipt Modal */}
        {selectedTx && (
          <div className="absolute inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
             <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl"><div className="p-8 text-center"><h1 className="text-3xl font-black">{selectedTx?.amount}</h1><button onClick={() => setSelectedTx(null)} className="w-full mt-8 py-4 rounded-2xl bg-slate-100 font-bold">Close</button></div></div>
          </div>
        )}

        {/* Dynamic Island Nav */}
        <div className={`fixed bottom-6 left-6 right-6 h-[68px] bg-black/80 backdrop-blur-2xl rounded-[34px] flex items-center justify-between px-2 shadow-2xl transition-transform duration-500 z-50 ${activeView || showMainHistory || selectedTx || sendStep > 0 ? 'translate-y-[200%]' : 'translate-y-0'}`}>
          <NavIcon icon={<Home size={24} />} />
          <div className="relative -top-5"><div className="absolute inset-0 bg-blue-500 blur-xl opacity-40 rounded-full"></div><div className="relative bg-white text-black p-4 rounded-full shadow-lg border-4 border-[#F2F2F7]"><Wallet size={26} strokeWidth={2.5} /></div></div>
          <NavIcon icon={<MessageCircle size={24} />} />
        </div>
      </div>
    </div>
  );
};

// ... Helper Components ...
const HistoryItem = ({ tx, darkTheme, onClick }: HistoryItemProps) => (
  <div onClick={onClick} className={`flex items-center gap-4 py-3 border-b ${darkTheme ? 'border-white/10' : 'border-gray-50'} last:border-0 cursor-pointer hover:bg-black/5 rounded-lg px-2 -mx-2 transition-colors group`}>
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm border ${darkTheme ? 'bg-white/10 border-white/5 text-white' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>{tx.icon}</div>
    <div className="flex-1"><h5 className={`font-semibold text-sm ${darkTheme ? 'text-gray-200' : 'text-gray-900'}`}>{tx.title}</h5><p className={`text-xs ${darkTheme ? 'text-gray-500' : 'text-gray-400'}`}>{tx.date}</p></div>
    <div className="text-right"><span className={`block text-sm font-bold ${tx.amount.startsWith('+') ? 'text-emerald-500' : (darkTheme ? 'text-gray-300' : 'text-gray-900')}`}>{tx.amount}</span></div>
  </div>
);

const WalletAction = ({ icon, label, onClick }: WalletActionProps) => (<button onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} className="flex flex-col items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95 bg-white/10 text-white hover:bg-white/20">{icon}<span className="text-[10px] font-bold uppercase tracking-wide">{label}</span></button>);
const ActionButton = ({ icon, label, primary }: ActionButtonProps) => (<button className={`flex flex-col items-center gap-3 py-4 rounded-2xl active:scale-95 transition-transform ${primary ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'bg-gray-50 text-slate-900 hover:bg-gray-100'}`}><div className={primary ? 'text-emerald-400' : 'text-slate-900'}>{icon}</div><span className="text-xs font-bold">{label}</span></button>);
const NavIcon = ({ icon }: NavIconProps) => (<button className="p-4 text-white/50 hover:text-white transition-colors">{icon}</button>);

export default BeamioAppExample;