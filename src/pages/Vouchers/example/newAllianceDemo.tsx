import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  CreditCard, 
  Users, 
  Settings, 
  Activity, 
  Wallet, 
  FileText, 
  TrendingUp, 
  ShieldCheck, 
  Search,
  Plus,
  CheckCircle2,
  Store,
  Layers,
  History,
  MessageSquare, 
  X,
  Ticket,
  Gift,
  PlusCircle,
  Calendar,
  PieChart,
  BadgeCheck,
  Globe,
  Trash2,
  ArrowRight,
  Upload,
  ExternalLink,
  Coins,
  Image as ImageIcon,
  Edit3, 
  Lock,
  Flame, 
  Banknote,
  UserPlus, 
  Filter,
  MoreHorizontal,
  Download,
  Copy,
  Zap,  
  Ban,   
  StickyNote,
  Percent,
  Calculator,
  Link as LinkIcon,
  Printer,
  Share2,  
  MapPin, 
  ShoppingBag,
  Award,
  Send,  
  MoreVertical,
  ArrowLeft,
  Camera,
  ShieldAlert,
  Cpu,
  Server,
  ArrowUpRight,
  ChevronRight,
  Key,
  Utensils,
  Receipt,
  BookOpen,
  ArrowRightLeft,
  Sparkles,
  Clock,
  Check,
  AlertTriangle,
  Smartphone,
  Nfc,
  AlertOctagon,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';

// --- Types & Mock Data ---

type Merchant = {
  id: string;
  name: string;
  beamioHandle: string;
  smartAccount: string;
  category: string;
  location: string;
  volume: string;
  fiatCollected: string;
  mintQuota: number;
  bUnitsBalance: number;
  kybStatus: string;
  activeMembers: number;
  avgTicket: string;
  feeRate: string;
  status: string;
  terminalId: string;
  logo: string;
};

type MetricCardProps = {
  title: string;
  value: string;
  subValue?: string;
  change: string;
  isPositive: boolean;
  icon: React.ReactNode;
  colorClass?: string;
};

type SidebarItemProps = {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
};

type StatusBadgeProps = { status: string };

const initialMembers = [
  { id: 'MEM-001', name: 'Alice Chen', beamioHandle: '@alice_chen', smartAccount: '0x71C...9A21', tier: 'Black VIP Card', balance: '1,250.00', currency: 'CAD', joinDate: 'Oct 24, 2025', status: 'Active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
  { id: 'MEM-002', name: 'Bob Smith', beamioHandle: '@bobby_s', smartAccount: '0x3A2...1B44', tier: 'Green Card', balance: '50.00', currency: 'CAD', joinDate: 'Nov 12, 2025', status: 'Active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
  { id: 'MEM-003', name: 'NFC Cardholder', beamioHandle: '', smartAccount: '0x9E1...4F22', tier: 'Green Card', balance: '75.00', currency: 'CAD', joinDate: 'Dec 05, 2025', status: 'Active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NFC' },
];

const initialMerchantsData = [
  { 
    id: 'MER-001', 
    name: 'Sen Pho + Cafe', 
    beamioHandle: '@senpho_kerr',
    smartAccount: '0x8B2...99C1',
    category: 'Vietnamese', 
    location: 'Kerrisdale, Vancouver, BC', 
    volume: '45200.00', 
    fiatCollected: '12500.00', 
    mintQuota: 50000.00,
    bUnitsBalance: 1250, 
    kybStatus: 'Verified',
    activeMembers: 412,
    avgTicket: '32.50',
    feeRate: '1.2% Flat',
    status: 'Active', 
    terminalId: 'POS-8821', 
    logo: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&h=100&fit=crop'
  },
  { 
    id: 'MER-002', 
    name: 'Sen Pho + Cafe', 
    beamioHandle: '@senpho_champ',
    smartAccount: '0x4D2...11F2',
    category: 'Vietnamese', 
    location: 'Champlain Heights, Vancouver, BC', 
    volume: '5000.00', 
    fiatCollected: '48500.00', 
    mintQuota: 50000.00, 
    bUnitsBalance: 12, 
    kybStatus: 'Verified',
    activeMembers: 285,
    avgTicket: '28.00',
    feeRate: '1.2% Flat',
    status: 'Active', 
    terminalId: 'POS-8822', 
    logo: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&h=100&fit=crop'
  },
];

const initialAssets = [
  { id: 'AST-01', name: 'CashTrees Green Card', type: 'Standard Membership', minTopUp: '≥ 50 CAD', minted: 1500, activeHolders: 1420, status: 'Active', color: 'bg-emerald-500', mintRule: 'One-time Top-up' },
  { id: 'AST-02', name: 'CashTrees Black VIP Card', type: 'VIP Membership', minTopUp: '≥ 100 CAD', minted: 280, activeHolders: 275, status: 'Active', color: 'bg-slate-900', mintRule: 'One-time Top-up' },
  { id: 'AST-03', name: 'CashTrees Partner Card', type: 'Merchant License NFT', minTopUp: 'KYB Approved', minted: 2, activeHolders: 2, status: 'Active', color: 'bg-indigo-600', mintRule: 'Authorized Partner' },
];

const ledgerTransactions = [
  { id: 'TX-9910', type: 'Mint', actionTitle: 'Purchase (Green Card)', amount: '50.00', from: 'CashTrees Treasury', to: '@new_diner', channel: 'Online', funding: 'USDC', device: 'Beamio APP', time: 'Just now', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '99 B-Units', txHash: '0x3fA...8b2' },
  { id: 'TX-9909', type: 'Mint', actionTitle: 'Purchase (Green Card)', amount: '50.00', from: 'Sen Pho (Kerrisdale)', to: '0x9E1...4F22', channel: 'Offline', funding: 'CAD', device: 'NFC Card', time: '5 mins ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '99 B-Units', txHash: '0x8cC...1a5' },
  { id: 'TX-9908', type: 'Transfer', actionTitle: 'Dining Payment', amount: '32.50', from: '0x9E1...4F22', to: 'Sen Pho (Champlain)', channel: 'Offline', funding: '$CTree', device: 'NFC Card', time: '12 mins ago', status: 'Settled', gasPaidBy: 'Merchant', gasAmount: '2.6 B-Units', txHash: '0x1dE...4f9' },
  { id: 'TX-9907', type: 'Transfer', actionTitle: 'Dining Payment', amount: '18.00', from: '@char_w', to: 'Sen Pho (Kerrisdale)', channel: 'Offline', funding: '$CTree', device: 'Beamio APP', time: '18 mins ago', status: 'Settled', gasPaidBy: 'Merchant', gasAmount: '2 B-Units', txHash: '0x7eF...9d0' },
  { id: 'TX-9906', type: 'Mint', actionTitle: 'Card Top-up', amount: '25.00', from: 'CashTrees Treasury', to: '@alice_chen', channel: 'Online', funding: 'USDC', device: 'Beamio APP', time: '1 hour ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '2 B-Units', txHash: '0x9bB...2e1' },
  { id: 'TX-9905', type: 'Mint', actionTitle: 'Upgrade (To Black VIP)', amount: '100.00', from: 'Sen Pho (Kerrisdale)', to: '0x3A2...1B44', channel: 'Offline', funding: 'CAD', device: 'NFC Card', time: '2 hours ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '99 B-Units', txHash: '0x8cC...1a5' },
  { id: 'TX-9904', type: 'Mint', actionTitle: 'Upgrade (To Black VIP)', amount: '100.00', from: 'CashTrees Treasury', to: '@char_w', channel: 'Online', funding: 'USDC', device: 'Beamio APP', time: '5 hours ago', status: 'Settled', gasPaidBy: 'CashTrees', gasAmount: '99 B-Units', txHash: '0x4aA...7c3' },
  { id: 'TX-9903', type: 'Burn', actionTitle: 'Merchant Settlement', amount: '4800.00', from: 'Sen Pho (Kerrisdale)', to: 'Zero Address', channel: 'Payout', funding: 'USDC', device: 'Web Dashboard', time: 'Yesterday', status: 'Completed', gasPaidBy: 'Merchant', gasAmount: '2 B-Units', txHash: '0x00A...000' },
  { id: 'TX-9902', type: 'Burn', actionTitle: 'Merchant Settlement', amount: '1250.00', from: 'Sen Pho (Champlain)', to: 'Zero Address', channel: 'Payout', funding: 'CAD', device: 'Web Dashboard', time: 'Yesterday', status: 'Completed', gasPaidBy: 'Merchant', gasAmount: '2 B-Units', txHash: '0x00B...111' },
];

// --- Sub-Components ---

const MetricCard = ({ title, value, subValue, change, isPositive, icon, colorClass = "bg-[#96EB3C]/20 text-[#6ea32b]" }: MetricCardProps) => (
  <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group">
    <div className="flex justify-between items-start mb-5">
      <div className={`p-3 rounded-[16px] ${colorClass} group-hover:scale-105 transition-transform duration-300`}>
        {icon}
      </div>
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
        {change}
      </span>
    </div>
    <h3 className="text-slate-500 text-[13px] font-semibold tracking-wide uppercase mb-1.5">{title}</h3>
    <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
    {subValue && <p className="text-xs text-slate-400 mt-1.5 font-medium">{subValue}</p>}
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: SidebarItemProps) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'space-x-3 px-4'} py-3.5 rounded-[16px] transition-all duration-200 ${active ? 'bg-[#96EB3C] text-slate-900 shadow-[0_4px_16px_rgba(150,235,60,0.4)]' : 'text-slate-500 hover:bg-black/5 hover:text-slate-900'}`}
    title={collapsed ? label : undefined}
  >
    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    {!collapsed && <span className={`font-semibold text-[15px] whitespace-nowrap ${active ? 'tracking-wide' : ''}`}>{label}</span>}
  </button>
);

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const styles: Record<string, string> = {
    'Active': 'bg-[#96EB3C]/20 text-[#548a1b]',
    'Verified': 'bg-[#96EB3C]/20 text-[#548a1b]',
    'Pending': 'bg-amber-100 text-amber-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
    'Settled': 'bg-slate-100 text-slate-700',
    'Burn': 'bg-rose-100 text-rose-700',
    'Mint': 'bg-[#96EB3C]/30 text-[#4c8016]',
    'Transfer': 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [posAmount, setPosAmount] = useState('0');
  
  // Merchant Onboard Modal State
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false);
  const [onboardHandle, setOnboardHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState('idle'); // 'idle' | 'searching' | 'found' | 'available'

  // Merchants State
  const [merchants, setMerchants] = useState(initialMerchantsData);

  // Settlement Requests State
  const [settlementRequests, setSettlementRequests] = useState([
    { id: 'REQ-8801', merchant: 'Sen Pho + Cafe', location: 'Kerrisdale', amount: '4800.00', method: 'USDC', timeline: 'T+0', time: '15 mins ago', requiredGas: '2 B-Units' }
  ]);

  // Quota Management Modal State
  const [quotaModalData, setQuotaModalData] = useState<{ isOpen: boolean; merchant: Merchant | null }>({ isOpen: false, merchant: null });
  const [newQuotaValue, setNewQuotaValue] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');

  const deployedContractAddress = '0xCT...88A1';

  const handleApproveSettlement = (id: string) => {
    setSettlementRequests(prev => prev.filter(req => req.id !== id));
  };

  const openQuotaModal = (merchant: Merchant) => {
    setQuotaModalData({ isOpen: true, merchant });
    setNewQuotaValue(merchant.mintQuota.toString());
    const owed = Math.max(0, parseFloat(merchant.fiatCollected) - parseFloat(merchant.volume));
    setSettlementAmount(owed > 0 ? owed.toString() : '');
  };

  const handleUpdateQuota = () => {
    const merchant = quotaModalData.merchant;
    if (!merchant) return;
    const updatedQuota = parseFloat(newQuotaValue);
    if (isNaN(updatedQuota) || updatedQuota < 0) return;

    setMerchants(prev => prev.map(m => m.id === merchant.id ? { ...m, mintQuota: updatedQuota } : m));
    setQuotaModalData(prev => prev.merchant ? { ...prev, merchant: { ...prev.merchant, mintQuota: updatedQuota } } : prev);
  };

  const handleRecordPayment = () => {
    const merchant = quotaModalData.merchant;
    if (!merchant) return;
    const payment = parseFloat(settlementAmount);
    if (isNaN(payment) || payment <= 0) return;

    setMerchants(prev => prev.map(m => {
        if (m.id === merchant.id) {
            const updatedFiat = Math.max(0, parseFloat(m.fiatCollected) - payment);
            return { ...m, fiatCollected: updatedFiat.toString() };
        }
        return m;
    }));
    
    setQuotaModalData(prev => {
        if (!prev.merchant) return prev;
        const updatedFiat = Math.max(0, parseFloat(prev.merchant.fiatCollected) - payment);
        return { ...prev, merchant: { ...prev.merchant, fiatCollected: updatedFiat.toString() } };
    });
    setSettlementAmount('');
  };

  const closeOnboardModal = () => {
    setIsMerchantModalOpen(false);
    setOnboardHandle('');
    setHandleStatus('idle');
  };

  const handleVerifyHandle = () => {
    if (!onboardHandle) return;
    setHandleStatus('searching');
    // Simulate API call to check if Handle exists in Merchant OS
    setTimeout(() => {
        if (onboardHandle.toLowerCase().includes('senpho') || onboardHandle.toLowerCase().includes('existing')) {
            setHandleStatus('found');
        } else {
            setHandleStatus('available');
        }
    }, 600);
  };

  // Helper to render 0x addresses or handles distinctly
  const formatEntity = (name: string) => {
    if (!name) return '';
    if (name.startsWith('0x')) {
       return <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-black/5">{name}</span>;
    }
    return name;
  };

  // Risk check calculation
  const hasRiskWarning = merchants.some(m => {
     const fiat = parseFloat(m.fiatCollected);
     const volume = parseFloat(m.volume);
     const owed = Math.max(0, fiat - volume);
     return (owed / m.mintQuota) > 0.8;
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F5F5F7] font-sans text-slate-900 selection:bg-[#96EB3C]/30 selection:text-slate-900">
      
      {/* Sidebar */}
      <aside className={`bg-white border-r border-black/[0.04] shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col fixed h-full z-20 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className="p-6 border-b border-black/[0.04] flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
            <div className="w-11 h-11 bg-[#96EB3C] rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-[0_4px_16px_rgba(150,235,60,0.4)] group-hover:bg-[#86d635] transition-colors">
              <span className="text-slate-900 font-black text-2xl tracking-tighter">C</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-black text-xl tracking-tighter text-slate-900 leading-none">CashTrees</span>
                <span className="text-[10px] font-bold text-[#7abf30] tracking-widest uppercase mt-1">Alliance OS</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto no-scrollbar">
          {!isSidebarCollapsed && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-4">Command Center</div>}
          <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === 'Overview'} onClick={() => setActiveTab('Overview')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={CreditCard} label="Asset Factory" active={activeTab === 'Assets'} onClick={() => setActiveTab('Assets')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Users} label="Members" active={activeTab === 'Members'} onClick={() => setActiveTab('Members')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={Utensils} label="Restaurants" active={activeTab === 'Merchants'} onClick={() => setActiveTab('Merchants')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={BookOpen} label="Ledger & Clearing" active={activeTab === 'Ledger'} onClick={() => setActiveTab('Ledger')} collapsed={isSidebarCollapsed} />
          
          {!isSidebarCollapsed && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-8">Financial Hub</div>}
          <SidebarItem icon={Wallet} label="Wallet & Treasury" active={activeTab === 'Treasury'} onClick={() => setActiveTab('Treasury')} collapsed={isSidebarCollapsed} />
          
          {!isSidebarCollapsed && <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-3 mt-8">System</div>}
          <SidebarItem icon={MessageSquare} label="Chat" active={activeTab === 'Chat'} onClick={() => setActiveTab('Chat')} collapsed={isSidebarCollapsed} />
          <SidebarItem icon={ShieldCheck} label="Audit Logs" active={activeTab === 'Audit'} onClick={() => setActiveTab('Audit')} collapsed={isSidebarCollapsed} />
        </nav>

        {/* Beamio Infrastructure Badge */}
        <div className="p-5 border-t border-black/[0.04] bg-slate-50/50 backdrop-blur-md">
          {!isSidebarCollapsed ? (
             <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1562f0] rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <span className="text-white font-bold text-lg italic">B</span>
                </div>
                <div>
                   <div className="text-[10px] text-slate-500 font-semibold tracking-wide">Infrastructure by</div>
                   <div className="text-sm font-bold text-[#1562f0] tracking-tight">Beamio Protocol</div>
                </div>
             </div>
          ) : (
             <div className="w-9 h-9 bg-[#1562f0] rounded-xl flex items-center justify-center mx-auto shadow-md">
               <span className="text-white font-bold text-lg italic">B</span>
             </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 h-full overflow-hidden ${isSidebarCollapsed ? 'ml-20' : 'ml-72'}`}>
        
        {/* Header */}
        {activeTab !== 'Chat' && (
          <header className="px-10 pt-10 pb-6 flex justify-between items-end flex-shrink-0">
            <div>
              <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight leading-tight">{activeTab === 'Ledger' ? '$CTree Ledger & Clearing' : activeTab}</h1>
              <div className="mt-2.5 flex items-center gap-3">
                <span className="bg-slate-200/50 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-md">Fiat Anchor: CAD</span>
                <div className="flex items-center gap-1.5 bg-white border border-black/[0.04] px-2.5 py-1 rounded-md text-slate-500 font-mono text-[11px] shadow-sm">
                    <FileText size={12} className="text-slate-400"/>
                    <span>Contract: {deployedContractAddress}</span>
                </div>
              </div>
            </div>
            {activeTab === 'Merchants' && (
              <button onClick={() => setIsMerchantModalOpen(true)} className="flex items-center space-x-2 px-6 py-3 bg-[#96EB3C] text-slate-900 rounded-[14px] text-sm font-extrabold hover:bg-[#86d635] shadow-[0_4px_16px_rgba(150,235,60,0.3)] transition-all duration-200 active:scale-95">
                <Utensils size={16} strokeWidth={2.5}/><span>Onboard Restaurant</span>
              </button>
            )}
            {activeTab === 'Assets' && (
              <button className="flex items-center space-x-2 px-6 py-3 bg-[#96EB3C] text-slate-900 rounded-[14px] text-sm font-extrabold hover:bg-[#86d635] shadow-[0_4px_16px_rgba(150,235,60,0.3)] transition-all duration-200 active:scale-95">
                <Plus size={16} strokeWidth={2.5}/><span>New Asset</span>
              </button>
            )}
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-10 pb-10">
            
            {/* --- OVERVIEW --- */}
            {activeTab === 'Overview' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard title="All-Time Volume" value="$1,824,500" subValue="Total Network Volume (CAD)" change="+124.5k (30d)" isPositive={true} icon={<Activity size={24} />} colorClass="bg-blue-50 text-blue-600" />
                  <MetricCard title="Active Memberships" value="1,695" subValue="Green & Black Cards" change="+42" isPositive={true} icon={<CreditCard size={24} />} colorClass="bg-purple-50 text-purple-600" />
                  <MetricCard title="Partner Locations" value="2" subValue="Verified restaurants" change="Stable" isPositive={true} icon={<Utensils size={24} />} colorClass="bg-emerald-50 text-emerald-600" />
                  <MetricCard title="CashTrees Fuel Pool" value="845K" subValue="B-Units for Mint/Top-ups" change="-2.1%" isPositive={false} icon={<Zap size={24} />} colorClass="bg-orange-50 text-orange-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   <div className="lg:col-span-2 bg-white rounded-[24px] border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-8">
                      <div className="flex justify-between items-center mb-6">
                        <h2 className="font-extrabold text-xl text-slate-900 tracking-tight">Live Network Activity</h2>
                        <button onClick={() => setActiveTab('Ledger')} className="text-sm font-bold text-[#82cc33] hover:text-[#6ea32b] hover:underline transition-colors">View Ledger</button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-black/[0.04]">
                              <th className="pb-4 pl-2">Event / Action</th>
                              <th className="pb-4">Context & Device</th>
                              <th className="pb-4 text-right">Amount & Route</th>
                              <th className="pb-4 text-right pr-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerTransactions.slice(0,6).map(tx => (
                              <tr key={tx.id} className="hover:bg-slate-50/50 border-b border-black/[0.02] transition-colors group">
                                <td className="py-4 pl-2">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tx.type==='Mint'?'bg-[#96EB3C]/20 text-[#5a961d]':tx.type==='Burn'?'bg-rose-50 text-rose-600':'bg-purple-50 text-purple-600'}`}>
                                        {tx.type === 'Mint' ? <Sparkles size={16}/> : tx.type === 'Burn' ? <Flame size={16}/> : <ArrowRightLeft size={16}/>}
                                      </div>
                                      <div>
                                        <div className="font-bold text-[14px] text-slate-900 group-hover:text-[#7abf30] transition-colors">{tx.actionTitle}</div>
                                        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5">{tx.type} • {tx.time}</div>
                                      </div>
                                  </div>
                                </td>
                                <td className="py-4">
                                  <div className="text-[14px] font-semibold text-slate-700 truncate max-w-[220px]" title={tx.type === 'Transfer' ? `${tx.from} ➔ ${tx.to}` : (tx.type === 'Mint' ? tx.to : tx.from)}>
                                     {tx.type === 'Transfer' ? (
                                         <div className="flex items-center gap-1.5">{formatEntity(tx.from)} <span className="text-slate-300 text-[10px]">➔</span> {formatEntity(tx.to)}</div>
                                     ) : (
                                         <>{tx.type === 'Mint' ? formatEntity(tx.to) : formatEntity(tx.from)}</>
                                     )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                     <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide ${tx.channel === 'Online' ? 'bg-blue-50 text-blue-600' : tx.channel === 'Offline' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                                        {tx.channel}
                                     </span>
                                     <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                                        {tx.device === 'NFC Card' ? <Nfc size={12}/> : tx.device === 'Beamio APP' ? <Smartphone size={12}/> : <Globe size={12}/>}
                                        {tx.device}
                                     </span>
                                  </div>
                                </td>
                                <td className={`py-4 text-right font-mono font-bold ${tx.type==='Mint'?'text-[#66a323]':tx.type==='Transfer'?'text-slate-700':'text-rose-600'}`}>
                                  <div className="text-[15px]">{tx.type==='Transfer'?'-':'+'} ${tx.amount}</div>
                                  <div className="text-[11px] text-slate-400 font-sans font-medium mt-0.5 whitespace-nowrap">
                                     {tx.type === 'Mint' ? `Paid via ${tx.funding}` : tx.type === 'Burn' ? `Payout in ${tx.funding}` : `${tx.funding} TX`}
                                  </div>
                                </td>
                                <td className="py-4 text-right"><span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide ${tx.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{tx.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                   </div>
                   
                   <div className="bg-slate-900 rounded-[24px] shadow-2xl p-8 text-white relative overflow-hidden flex flex-col border border-slate-800">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-[#96EB3C]/20 rounded-full blur-[60px] -mr-10 -mt-10"></div>
                      <h2 className="font-extrabold text-xl mb-8 relative z-10 flex items-center gap-2 tracking-tight"><ShieldAlert size={22} className="text-[#96EB3C]"/> System Health</h2>
                      
                      <div className="space-y-4 relative z-10 flex-1">
                         <div className="bg-white/5 p-4 rounded-[16px] border border-white/10 flex justify-between items-center backdrop-blur-md">
                            <div className="flex items-center gap-3">
                               <div className="w-2.5 h-2.5 rounded-full bg-[#96EB3C] animate-pulse shadow-[0_0_8px_rgba(150,235,60,0.8)]"></div>
                               <span className="text-[14px] font-semibold text-white">EOA Signer Nodes</span>
                            </div>
                            <span className="text-xs font-bold text-[#96EB3C] uppercase tracking-widest">Online</span>
                         </div>
                         
                         <div className="bg-white/5 p-4 rounded-[16px] border border-white/10 flex justify-between items-center backdrop-blur-md">
                            <div className="flex items-center gap-3">
                               <div className="w-2.5 h-2.5 rounded-full bg-[#96EB3C] animate-pulse shadow-[0_0_8px_rgba(150,235,60,0.8)]"></div>
                               <span className="text-[14px] font-semibold text-white">AA Contracts</span>
                            </div>
                            <span className="text-xs font-bold text-[#96EB3C] uppercase tracking-widest">Active</span>
                         </div>
                         
                         {/* Risk Control Metric */}
                         <div className={`p-4 rounded-[16px] border flex justify-between items-center backdrop-blur-md transition-colors ${hasRiskWarning ? 'bg-rose-500/20 border-rose-500/40' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center gap-3">
                               <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${hasRiskWarning ? 'bg-rose-500/30 text-rose-300' : 'bg-[#96EB3C]/20 text-[#96EB3C]'}`}>
                                  {hasRiskWarning ? <AlertOctagon size={18}/> : <ShieldCheck size={18}/>}
                               </div>
                               <div>
                                  <span className="text-[14px] font-semibold text-white block">Risk Control</span>
                                  {hasRiskWarning && <span className="text-[10px] text-rose-300 font-medium">Quota Limit Reached</span>}
                               </div>
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-widest ${hasRiskWarning ? 'text-rose-400' : 'text-[#96EB3C]'}`}>
                               {hasRiskWarning ? '1 Warning' : 'Safe'}
                            </span>
                         </div>
                      </div>
                      <div className="pt-6 mt-4 border-t border-white/10 flex justify-between items-center relative z-10">
                         <span className="text-[13px] font-medium text-slate-400">Restaurants KYB</span>
                         <span className="text-[13px] font-bold text-white bg-white/10 px-3 py-1 rounded-full">2 Verified</span>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* --- TREASURY --- */}
            {activeTab === 'Treasury' && (
              <div className="max-w-5xl space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                 
                 <div className="bg-white rounded-[32px] border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-10 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">CashTrees Core Wallet</h3>
                        <p className="text-[15px] text-slate-500 mt-1 font-medium max-w-lg">Multisig and Account Abstraction Identity. <strong className="text-slate-700">$CTree</strong> is dynamically minted and burned 1:1 with CAD on demand.</p>
                        <div className="mt-8 space-y-4">
                            <div className="flex items-center gap-3">
                               <BadgeCheck size={20} className="text-[#1562f0]"/>
                               <span className="font-bold text-slate-700 w-28">BeamioTag:</span> 
                               <span className="bg-[#1562f0]/10 text-[#1562f0] px-3.5 py-1.5 rounded-[10px] text-sm font-mono font-bold tracking-wide">@CashTrees</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <Wallet size={20} className="text-slate-400"/>
                               <span className="font-bold text-slate-700 w-28">EOA Wallet:</span> 
                               <span className="text-slate-600 font-mono text-sm bg-slate-50 px-3.5 py-1.5 rounded-[10px] border border-black/[0.05]">0x1A4b...3992</span>
                            </div>
                            <div className="flex items-center gap-3">
                               <Cpu size={20} className="text-[#1562f0]"/>
                               <span className="font-bold text-slate-700 w-28">AA Smart Acc:</span> 
                               <span className="text-slate-600 font-mono text-sm bg-slate-50 px-3.5 py-1.5 rounded-[10px] border border-black/[0.05]">{deployedContractAddress}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="flex items-center gap-2.5 mb-3">
                           <div className="w-10 h-10 rounded-full bg-[#96EB3C]/20 text-[#6ca12c] flex items-center justify-center font-extrabold shadow-sm">CT</div>
                           <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Circulating Supply</span>
                        </div>
                        <div className="text-5xl font-black text-slate-900 tracking-tighter">1,250,000 <span className="text-xl text-slate-400 font-bold ml-1">$CTree</span></div>
                        <div className="text-xs font-bold text-[#6ca12c] mt-4 bg-[#96EB3C]/10 px-4 py-1.5 rounded-full border border-[#96EB3C]/30 uppercase tracking-wide">ERC-1155 Token ID: 0</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white rounded-[32px] border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-10 flex flex-col">
                       <div className="flex items-center gap-4 mb-8">
                          <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-[18px] flex items-center justify-center shadow-inner"><Key size={26} strokeWidth={2.5}/></div>
                          <div>
                             <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">Signer EOA Wallet</h3>
                             <p className="text-[13px] text-slate-500 font-medium">Hardware-secured owner address</p>
                          </div>
                       </div>
                       <div className="space-y-4 flex-1">
                          <div className="bg-slate-50 p-5 rounded-[20px] border border-black/[0.03]">
                             <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Address</div>
                             <div className="font-mono text-[15px] font-medium text-slate-700">0x1A4b...3992</div>
                          </div>
                          <div className="bg-slate-50 p-5 rounded-[20px] border border-black/[0.03] flex justify-between items-center">
                             <div>
                                 <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Role & Authority</div>
                                 <div className="font-bold text-[15px] text-slate-800">Primary Signer (1/1)</div>
                             </div>
                             <CheckCircle2 size={24} className="text-[#96EB3C]"/>
                          </div>
                          <div className="bg-[#1562f0]/5 p-5 rounded-[20px] border border-[#1562f0]/10">
                             <div className="text-[11px] font-bold text-[#1562f0]/60 uppercase tracking-widest mb-2">Wallet Assets</div>
                             <div className="font-extrabold text-2xl text-slate-900 flex items-center gap-2">
                                <Coins size={22} className="text-[#1562f0]"/>
                                15,000.00 <span className="text-sm text-slate-500 font-semibold ml-1">USDC</span>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="bg-[#1d1d1f] rounded-[32px] shadow-[0_16px_40px_rgba(0,0,0,0.16)] p-10 flex flex-col text-white relative overflow-hidden border border-slate-800">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-[#1562f0]/20 rounded-full blur-[60px] -mr-20 -mt-20 pointer-events-none"></div>
                       <div className="flex items-center gap-4 mb-8 relative z-10">
                          <div className="w-14 h-14 bg-[#1562f0]/20 text-[#1562f0] rounded-[18px] flex items-center justify-center border border-[#1562f0]/30 shadow-inner"><Cpu size={26} strokeWidth={2.5}/></div>
                          <div>
                             <h3 className="font-extrabold text-xl text-white tracking-tight">AA Smart Account</h3>
                             <p className="text-[13px] text-slate-400 font-medium">ERC-4337 Programmable Vault</p>
                          </div>
                       </div>
                       <div className="space-y-4 flex-1 relative z-10">
                          <div className="bg-white/5 p-5 rounded-[20px] border border-white/10 backdrop-blur-md">
                             <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contract Address</div>
                             <div className="font-mono text-[15px] font-medium text-blue-300">{deployedContractAddress}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-white/5 p-5 rounded-[20px] border border-white/10 backdrop-blur-md">
                                 <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Paymaster</div>
                                 <div className="font-bold text-[14px] text-white flex items-center gap-1.5"><Zap size={16} className="text-orange-400"/> Sponsored</div>
                             </div>
                             <div className="bg-white/5 p-5 rounded-[20px] border border-white/10 backdrop-blur-md">
                                 <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bundler</div>
                                 <div className="font-bold text-[14px] text-white flex items-center gap-1.5"><Layers size={16} className="text-[#1562f0]"/> Active</div>
                             </div>
                          </div>
                          <div className="bg-white/5 p-5 rounded-[20px] border border-white/10 backdrop-blur-md">
                             <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Smart Account Assets</div>
                             <div className="font-extrabold text-3xl text-white flex items-center gap-2">
                                <Coins size={26} className="text-[#1562f0]"/>
                                85,400.00 <span className="text-[15px] text-slate-400 font-semibold ml-1">USDC</span>
                             </div>
                             <div className="text-[11px] text-blue-300/80 font-medium mt-3 flex items-center gap-1.5">
                                <Download size={14}/> Automatically receives USDC from In-App purchases
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-8 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                       <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-[18px] flex items-center justify-center"><Zap size={28}/></div>
                       <div>
                          <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">CashTrees Fuel Pool (B-Units)</h3>
                          <p className="text-[13px] text-slate-500 font-medium mt-0.5">Platform pays 99 B-Units per Mint & 2 B-Units per Top-up. <strong className="text-slate-700">Merchants bear 0.8% TX fee.</strong></p>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-3xl font-black text-slate-900 tracking-tight">845,000 <span className="text-base text-slate-400 font-bold ml-1">Units</span></div>
                       <div className="text-[13px] text-slate-400 mt-1 font-mono font-medium">≈ $8,450.00 USDC</div>
                    </div>
                    <button className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-[14px] transition-colors active:scale-95 shadow-sm">Recharge Pool</button>
                 </div>
              </div>
            )}

            {/* --- MERCHANTS (RESTAURANTS) --- */}
            {activeTab === 'Merchants' && (
              <div className="space-y-6 animate-in fade-in">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-sm flex items-center gap-5">
                       <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-[16px] flex items-center justify-center"><Utensils size={26}/></div>
                       <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Network Partners</div>
                          <div className="text-3xl font-black text-slate-900 tracking-tight">2 <span className="text-sm text-slate-500 font-semibold ml-1">Locations</span></div>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-sm flex items-center gap-5">
                       <div className="w-14 h-14 bg-blue-50 text-[#1562f0] rounded-[16px] flex items-center justify-center"><Users size={26}/></div>
                       <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Linked Diners</div>
                          <div className="text-3xl font-black text-slate-900 tracking-tight">697 <span className="text-sm text-slate-500 font-semibold ml-1">Active Cards</span></div>
                       </div>
                    </div>
                    <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-sm flex items-center gap-5">
                       <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-[16px] flex items-center justify-center"><Receipt size={26}/></div>
                       <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg. Ticket Size</div>
                          <div className="text-3xl font-black text-slate-900 tracking-tight">$30.25 <span className="text-sm text-slate-500 font-semibold ml-1">CAD</span></div>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-4">
                    <div className="relative w-full max-w-md">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input type="text" placeholder="Search restaurants or locations..." className="w-full pl-11 pr-4 py-3.5 bg-white border border-black/[0.05] rounded-[16px] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#96EB3C]/30 focus:border-[#96EB3C]/50 shadow-sm transition-all" />
                    </div>
                 </div>

                 <div className="bg-white border border-black/[0.04] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
                    <table className="w-full">
                       <thead>
                          <tr className="bg-slate-50/50 border-b border-black/[0.04] text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                             <th className="px-6 py-5">Restaurant & Location</th>
                             <th className="px-6 py-5">Cardholders</th>
                             <th className="px-6 py-5 text-right">Unsettled $CTree (Rev)</th>
                             <th className="px-6 py-5 text-right bg-slate-50">Unsettled Fiat (Offline)</th>
                             <th className="px-6 py-5">Mint Quota & Risk</th>
                             <th className="px-6 py-5">B-Units Balance</th>
                             <th className="px-6 py-5 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-black/[0.02]">
                          {merchants.map((m) => {
                             const rev = parseFloat(m.volume);
                             const fiat = parseFloat(m.fiatCollected);
                             const owedToAlliance = Math.max(0, fiat - rev);
                             const quotaUsage = (owedToAlliance / m.mintQuota) * 100;
                             const isHighRisk = quotaUsage > 80;

                             return (
                             <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-5">
                                   <div className="flex items-center gap-4">
                                      <img src={m.logo} alt="" className="w-12 h-12 rounded-[14px] bg-slate-200 object-cover border border-black/[0.05] shadow-sm" />
                                      <div>
                                         <div className="font-bold text-[15px] text-slate-900">{m.name}</div>
                                         <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-500 font-medium">
                                            <MapPin size={12} className="text-slate-400"/> {m.location}
                                         </div>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-5">
                                   <div className="flex items-center gap-1.5 text-[15px] font-bold text-slate-700">
                                      <Users size={16} className="text-[#1562f0]"/> {m.activeMembers}
                                   </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <div className="font-bold text-[16px] text-emerald-600">${m.volume}</div>
                                </td>
                                <td className="px-6 py-5 text-right bg-slate-50/50">
                                   <div className="font-bold text-[16px] text-slate-800">${m.fiatCollected}</div>
                                </td>
                                <td className="px-6 py-5">
                                   <div className="w-full max-w-[150px]">
                                      <div className="flex justify-between text-[11px] font-bold mb-1.5">
                                         <span className="text-slate-500">Usage: {quotaUsage.toFixed(1)}%</span>
                                         <span className="text-slate-400">Limit: {m.mintQuota / 1000}k</span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                         <div className={`h-full transition-all duration-500 ${isHighRisk ? 'bg-rose-500' : 'bg-[#96EB3C]'}`} style={{width: `${Math.min(100, quotaUsage)}%`}}></div>
                                      </div>
                                      {isHighRisk && (
                                         <div className="mt-2 inline-flex items-center gap-1 bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                                            <Ban size={12}/> Minting Suspended
                                         </div>
                                      )}
                                   </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-2">
                                        <Zap size={16} className={m.bUnitsBalance < 50 ? "text-rose-500" : "text-orange-500"} />
                                        <span className={`font-mono font-bold text-[15px] ${m.bUnitsBalance < 50 ? "text-rose-600" : "text-slate-700"}`}>
                                            {m.bUnitsBalance}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-medium mt-1">
                                        Bears 0.8% fee per dining TX
                                    </div>
                                    {m.bUnitsBalance < 50 && (
                                        <div className="text-[10px] text-rose-500 font-bold mt-1.5 flex items-center gap-1 bg-rose-50 px-2 py-0.5 w-max rounded-md">
                                            <AlertTriangle size={10}/> Low Fuel Warning
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <button onClick={() => openQuotaModal(m)} className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-[#96EB3C]/20 hover:text-[#7abf30] text-slate-700 px-4 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors active:scale-95">
                                      <SlidersHorizontal size={14}/> Manage
                                   </button>
                                </td>
                             </tr>
                          )})}
                       </tbody>
                    </table>
                 </div>
              </div>
            )}

            {/* --- MEMBERS --- */}
            {activeTab === 'Members' && (
              <div className="space-y-6 animate-in fade-in">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-[#96EB3C]/20 text-[#6ea32b] rounded-xl flex items-center justify-center"><Users size={16}/></div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Members</span>
                       </div>
                       <div className="text-3xl font-black text-slate-900 tracking-tight">1,695</div>
                    </div>
                    <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center"><CreditCard size={16}/></div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Black VIP</span>
                       </div>
                       <div className="text-3xl font-black text-slate-900 tracking-tight">275 <span className="text-sm text-slate-400 font-semibold ml-1">Cards</span></div>
                    </div>
                    <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-[#96EB3C] text-slate-900 rounded-xl flex items-center justify-center"><CreditCard size={16}/></div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Green Cards</span>
                       </div>
                       <div className="text-3xl font-black text-slate-900 tracking-tight">1,420 <span className="text-sm text-slate-400 font-semibold ml-1">Cards</span></div>
                    </div>
                    <div className="bg-white p-6 rounded-[24px] border border-black/[0.04] shadow-sm flex flex-col justify-center">
                       <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-blue-50 text-[#1562f0] rounded-xl flex items-center justify-center"><Wallet size={16}/></div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Balances</span>
                       </div>
                       <div className="text-3xl font-black text-slate-900 tracking-tight">$85,400 <span className="text-sm text-slate-400 font-semibold ml-1">CAD</span></div>
                    </div>
                 </div>

                 <div className="flex items-center justify-between gap-4">
                    <div className="relative w-full max-w-md">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input type="text" placeholder="Search by handle or AA address..." className="w-full pl-11 pr-4 py-3.5 bg-white border border-black/[0.05] rounded-[16px] text-[15px] focus:outline-none focus:ring-4 focus:ring-[#96EB3C]/30 focus:border-[#96EB3C]/50 shadow-sm transition-all" />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-3.5 bg-white border border-black/[0.05] rounded-[16px] text-[14px] font-bold text-slate-600 hover:bg-slate-50 shadow-sm active:scale-95 transition-all">
                       <Filter size={16}/> Filter by Tier
                    </button>
                 </div>

                 <div className="bg-white border border-black/[0.04] rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
                    <table className="w-full">
                       <thead>
                          <tr className="bg-slate-50/50 border-b border-black/[0.04] text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                             <th className="px-6 py-5">Member</th>
                             <th className="px-6 py-5">AA Smart Account</th>
                             <th className="px-6 py-5">Card Tier</th>
                             <th className="px-6 py-5 text-right">Balance</th>
                             <th className="px-6 py-5">Status</th>
                             <th className="px-6 py-5 text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-black/[0.02]">
                          {initialMembers.map((member) => (
                             <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                   <div className="flex items-center gap-4">
                                      <img src={member.avatar} alt="" className="w-11 h-11 rounded-full border border-black/[0.05] shadow-sm" />
                                      <div>
                                         <div className="font-bold text-[15px] text-slate-900">{member.name}</div>
                                         {member.beamioHandle ? (
                                             <div className="text-[12px] text-slate-500 font-medium mt-0.5">{member.beamioHandle}</div>
                                         ) : (
                                             <div className="text-[11px] text-[#1562f0] font-bold flex items-center gap-1 mt-1 bg-blue-50 px-2 py-0.5 rounded-md w-max"><Nfc size={10}/> NFC Wallet Only</div>
                                         )}
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                   <div className="font-mono text-[13px] text-slate-500 flex items-center gap-2">
                                      <Cpu size={14} className="text-slate-400"/> {member.smartAccount}
                                   </div>
                                </td>
                                <td className="px-6 py-4">
                                   <span className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide ${
                                      member.tier === 'Black VIP Card' 
                                      ? 'bg-slate-900 text-[#96EB3C] shadow-sm' 
                                      : 'bg-[#96EB3C]/20 text-[#5a961d] shadow-sm'
                                   }`}>
                                      {member.tier}
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <div className="font-extrabold text-[16px] text-slate-900">${member.balance}</div>
                                   <div className="text-[11px] text-slate-400 font-semibold">{member.currency}</div>
                                </td>
                                <td className="px-6 py-4"><StatusBadge status={member.status} /></td>
                                <td className="px-6 py-4 text-right"><button className="text-slate-400 hover:text-[#82cc33] p-2 hover:bg-[#96EB3C]/10 rounded-lg transition-colors"><Settings size={18}/></button></td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
            )}

            {/* --- ASSETS --- */}
            {activeTab === 'Assets' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="mb-6">
                   <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">CashTrees NFT Assets</h2>
                   <p className="text-[15px] text-slate-500 mt-2 font-medium max-w-4xl leading-relaxed">ERC-1155 Dynamic Allocation: User cards are minted based on top-up amounts. The <strong className="text-slate-700">Partner Card</strong> is a Merchant License NFT granting the authority to accept $CTree payments and process offline mints/top-ups.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {initialAssets.map(asset => (
                    <div key={asset.id} className={`${asset.color} rounded-[32px] p-8 shadow-[0_16px_40px_rgba(0,0,0,0.1)] relative overflow-hidden transition-transform duration-300 hover:-translate-y-1.5`}>
                      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                      <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
                      
                      <div className="relative z-10 flex justify-between items-start mb-14">
                        <div className={`w-14 h-14 rounded-[18px] bg-white/20 backdrop-blur-md flex items-center justify-center ${asset.id==='AST-01'?'text-slate-900':'text-white'} border border-white/30 shadow-inner`}>
                          <CreditCard size={28} strokeWidth={2} />
                        </div>
                        <div className="flex flex-col items-end">
                           <StatusBadge status={asset.status} />
                           <div className={`mt-3 ${asset.id==='AST-01'?'text-slate-800':'text-white/90'} text-[11px] font-bold bg-black/10 px-3 py-1.5 rounded-[10px] border border-black/5 uppercase tracking-widest`}>
                              Threshold: {asset.minTopUp}
                           </div>
                        </div>
                      </div>
                      
                      <div className="relative z-10">
                        <p className={`text-[13px] font-bold tracking-widest uppercase mb-1.5 ${asset.id==='AST-01'?'text-slate-700':'text-white/80'}`}>{asset.type}</p>
                        <h3 className={`font-black text-3xl tracking-tight mb-8 leading-tight ${asset.id==='AST-01'?'text-slate-900':'text-white'}`}>{asset.name}</h3>
                        
                        <div className="bg-black/10 backdrop-blur-md rounded-[24px] p-6 border border-black/5 shadow-inner">
                           <div className="flex justify-between items-end mb-4">
                             <div>
                               <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${asset.id==='AST-01'?'text-slate-600':'text-white/60'}`}>Mint Rule</div>
                               <div className={`font-extrabold text-[15px] ${asset.id==='AST-01'?'text-slate-800':'text-white'}`}>{asset.mintRule} <span className="font-mono ml-1.5">{asset.minTopUp}</span></div>
                             </div>
                             <div className="text-right">
                                <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${asset.id==='AST-01'?'text-slate-600':'text-white/60'}`}>Circulation</div>
                                <div className={`font-bold text-[13px] ${asset.id==='AST-01'?'text-slate-800':'text-white'}`}>{asset.activeHolders} Active <span className="mx-1 opacity-50">/</span> {asset.minted} Minted</div>
                             </div>
                           </div>
                           <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mt-3">
                             <div 
                               className={`h-full rounded-full relative ${asset.id==='AST-01'?'bg-slate-800':'bg-white'}`} 
                               style={{ width: `${(asset.activeHolders / asset.minted) * 100}%` }}
                             >
                                <div className="absolute right-0 top-0 bottom-0 w-6 bg-white/50 animate-pulse"></div>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-12 bg-white rounded-[32px] border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-10">
                    <h3 className="text-xl font-extrabold text-slate-900 mb-8 flex items-center gap-2.5 tracking-tight"><ArrowUpRight className="text-[#96EB3C]" strokeWidth={3}/> Acquisition & Top-up Channels</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="p-8 bg-[#F5F5F7] rounded-[24px] border border-black/[0.03]">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-[16px] bg-[#1562f0]/10 text-[#1562f0] flex items-center justify-center shadow-inner"><Globe size={24}/></div>
                                <h4 className="font-extrabold text-lg text-slate-900">Online (In-App)</h4>
                            </div>
                            <ul className="space-y-4 text-[14px] text-slate-600 font-medium">
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#1562f0] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Payment Currency:</strong> USDC (Web3 Native).</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#1562f0] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Card Balance Base:</strong> CAD (1 $CTree = 1 CAD).</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#1562f0] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Oracle Logic:</strong> Uses <strong className="text-[#1562f0]">Coinbase Oracle</strong> to fetch real-time USDC/CAD rates. Exact USDC is deposited to the AA Smart Account, and equivalent <strong className="text-slate-800">$CTree</strong> balance is minted.</span></li>
                            </ul>
                        </div>
                        <div className="p-8 bg-[#F5F5F7] rounded-[24px] border border-black/[0.03]">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-[16px] bg-[#96EB3C]/20 text-[#6ea32b] flex items-center justify-center shadow-inner"><Store size={24}/></div>
                                <h4 className="font-extrabold text-lg text-slate-900">Offline (Physical Stores)</h4>
                            </div>
                            <ul className="space-y-4 text-[14px] text-slate-600 font-medium">
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#82cc33] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Supported Currency:</strong> CAD (Fiat).</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#82cc33] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Hardware / Access:</strong> NFC 424 DNA physical cards or the Beamio APP.</span></li>
                                <li className="flex gap-3 items-start"><CheckCircle2 size={18} className="text-[#82cc33] shrink-0 mt-0.5"/> <span><strong className="text-slate-800">Example Flow:</strong> A consumer pays 50 CAD at a store POS, taps their NFC card, and instantly mints a Green Card securely tied to their Smart Account. Fiat remains with the merchant pending future clearing.</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {/* --- LEDGER & CLEARING --- */}
            {activeTab === 'Ledger' && (
              <div className="space-y-8 animate-in fade-in">
                 <div className="flex justify-between items-start mb-2">
                   <div>
                     <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Network Ledger & Clearing Matrix</h2>
                     <p className="text-[15px] text-slate-500 mt-1 font-medium">Real-time tracking of $CTree lifecycle and automated merchant settlement calculations.</p>
                   </div>
                   <div className="bg-[#1d1d1f] text-white px-6 py-4 rounded-[20px] flex items-center gap-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center"><Zap className="text-orange-400" size={20}/></div>
                      <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">CashTrees Fuel Pool</div>
                         <div className="font-black text-2xl leading-none">845,000 <span className="text-[13px] font-semibold text-slate-400 ml-0.5">B-Units</span></div>
                         <div className="text-[10px] text-orange-400 mt-1.5 font-bold">Platform pays for Mint/Top-ups only</div>
                      </div>
                   </div>
                 </div>

                 {settlementRequests.length > 0 && (
                 <div className="bg-white border border-[#1562f0]/20 rounded-[24px] shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-[#1562f0]/10 bg-[#1562f0]/5 flex justify-between items-center">
                       <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-[14px] bg-[#1562f0]/10 text-[#1562f0] flex items-center justify-center shadow-inner">
                             <Clock size={20} strokeWidth={2.5}/>
                          </div>
                          <div>
                             <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Pending Settlement Requests</h3>
                             <p className="text-xs text-slate-500 font-medium">Restaurants requesting to burn $CTree for payout.</p>
                          </div>
                       </div>
                       <span className="bg-[#1562f0]/10 text-[#1562f0] px-3.5 py-1.5 rounded-lg text-xs font-extrabold shadow-sm">
                          {settlementRequests.length} Pending
                       </span>
                    </div>
                    <table className="w-full">
                       <thead>
                          <tr className="border-b border-black/[0.04] text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                             <th className="px-6 py-5">Request ID & Time</th>
                             <th className="px-6 py-5">Restaurant</th>
                             <th className="px-6 py-5 text-right">Amount to Settle</th>
                             <th className="px-6 py-5 pl-10">Payout Route</th>
                             <th className="px-6 py-5 text-right">Action</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-black/[0.02]">
                          {settlementRequests.map(req => (
                             <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-5">
                                   <div className="font-mono text-[14px] font-bold text-slate-700">{req.id}</div>
                                   <div className="text-[11px] text-slate-400 mt-1 font-medium">{req.time}</div>
                                </td>
                                <td className="px-6 py-5">
                                   <div className="font-bold text-[15px] text-slate-900">{req.merchant}</div>
                                   <div className="text-[11px] text-slate-500 font-medium mt-0.5">{req.location}</div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <div className="font-mono font-black text-slate-900 text-xl">${req.amount}</div>
                                   <div className="text-[10px] text-orange-600 font-bold flex items-center justify-end gap-1 mt-1 bg-orange-50 w-max ml-auto px-2 py-0.5 rounded-md">
                                      <Zap size={10}/> Burn Fee: {req.requiredGas}
                                   </div>
                                </td>
                                <td className="px-6 py-5 pl-10">
                                   {req.method === 'USDC' ? (
                                      <div className="inline-flex items-center gap-3 bg-[#1562f0]/10 border border-[#1562f0]/20 px-4 py-2 rounded-[14px]">
                                         <div className="w-8 h-8 rounded-full bg-[#1562f0]/20 flex items-center justify-center text-[#1562f0]"><Coins size={16}/></div>
                                         <div>
                                            <div className="text-[13px] font-extrabold text-[#1562f0]">USDC Web3 Transfer</div>
                                            <div className="text-[10px] font-bold text-[#1562f0]/70 mt-0.5 uppercase tracking-wide">SLA: {req.timeline} (Instant)</div>
                                         </div>
                                      </div>
                                   ) : (
                                      <div className="inline-flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 px-4 py-2 rounded-[14px]">
                                         <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Banknote size={16}/></div>
                                         <div>
                                            <div className="text-[13px] font-extrabold text-emerald-700">CAD Bank Wire</div>
                                            <div className="text-[10px] font-bold text-emerald-600 mt-0.5 uppercase tracking-wide">SLA: {req.timeline} (Next Biz Day)</div>
                                         </div>
                                      </div>
                                   )}
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <button 
                                      onClick={() => handleApproveSettlement(req.id)}
                                      className="inline-flex items-center gap-1.5 bg-[#96EB3C] hover:bg-[#86d635] text-slate-900 px-5 py-2.5 rounded-[12px] text-[13px] font-bold transition-all shadow-[0_4px_12px_rgba(150,235,60,0.3)] active:scale-95"
                                   >
                                      <Check size={16} strokeWidth={3}/> Approve
                                   </button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 )}

                 <div className="bg-white border border-black/[0.04] rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-8 overflow-hidden">
                    <div className="flex items-center gap-3.5 mb-8">
                       <div className="w-10 h-10 bg-[#96EB3C]/20 rounded-xl flex items-center justify-center text-[#6ea32b]"><Calculator size={20}/></div>
                       <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Merchant Clearing Matrix</h3>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full">
                          <thead>
                             <tr className="border-b border-black/[0.04] text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                <th className="pb-4 pl-4">Restaurant</th>
                                <th className="pb-4 text-right">Dining Revenue ($CTree)</th>
                                <th className="pb-4 text-center px-4">-</th>
                                <th className="pb-4 text-right">Fiat Collected (Offline Mints)</th>
                                <th className="pb-4 text-center px-4">=</th>
                                <th className="pb-4 text-right pr-4">Net Settlement Due (CAD)</th>
                                <th className="pb-4 text-center pl-4">Action</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[0.02]">
                             {merchants.map(m => {
                                const rev = parseFloat(m.volume);
                                const collected = parseFloat(m.fiatCollected);
                                const net = rev - collected;
                                const isMerchantOwe = net < 0;
                                const absNet = Math.abs(net);
                                const quotaUsage = Math.min(100, (absNet / m.mintQuota) * 100);

                                return (
                                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="py-6 pl-4 font-bold text-[15px] text-slate-900">{m.name} <span className="text-[11px] text-slate-400 block font-medium mt-0.5">{m.location}</span></td>
                                   <td className="py-6 text-right font-mono font-bold text-slate-700 text-[16px]">${m.volume}</td>
                                   <td className="py-6 text-center text-slate-300">-</td>
                                   <td className="py-6 text-right font-mono font-bold text-rose-600 text-[16px]">${m.fiatCollected}</td>
                                   <td className="py-6 text-center text-slate-300">=</td>
                                   <td className="py-6 text-right pr-4">
                                      <div className={`font-mono font-black text-2xl tracking-tighter ${net > 0 ? 'text-[#96EB3C]' : 'text-rose-600'}`}>
                                         ${absNet.toFixed(2)}
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                         {net > 0 ? 'CashTrees Pays Merchant' : 'Merchant Owes CashTrees'}
                                      </div>
                                      {isMerchantOwe && (
                                         <div className="mt-3 text-left bg-slate-50 p-2.5 rounded-[12px] border border-black/[0.04]">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                                               <span>Quota Usage: {quotaUsage.toFixed(1)}%</span>
                                               <span>Limit: ${m.mintQuota}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                               <div className={`h-full transition-all duration-500 ${quotaUsage > 80 ? 'bg-rose-500' : 'bg-amber-400'}`} style={{width: `${quotaUsage}%`}}></div>
                                            </div>
                                         </div>
                                      )}
                                   </td>
                                   <td className="py-6 text-center pl-4">
                                      {isMerchantOwe ? (
                                         <button onClick={() => openQuotaModal(m)} className="bg-[#96EB3C] hover:bg-[#86d635] text-slate-900 text-[11px] font-bold px-4 py-2.5 rounded-[10px] uppercase tracking-wide whitespace-nowrap active:scale-95 transition-all shadow-[0_4px_12px_rgba(150,235,60,0.3)]">
                                            Request Funds
                                         </button>
                                      ) : (
                                         <span className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">No Action</span>
                                      )}
                                   </td>
                                </tr>
                                )
                             })}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 <div className="bg-white border border-black/[0.04] rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
                    <div className="p-8 border-b border-black/[0.04] bg-slate-50/30 flex justify-between items-center">
                       <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-slate-100 text-slate-700 rounded-[14px] flex items-center justify-center shadow-inner"><BookOpen size={20}/></div>
                           <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">$CTree Immutable Ledger</h3>
                       </div>
                       <div className="flex gap-2">
                          <span className="bg-[#96EB3C]/10 border border-[#96EB3C]/20 text-[#6ea32b] px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wide"><Sparkles size={12}/> Mint</span>
                          <span className="bg-purple-50 border border-purple-100 text-purple-700 px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wide"><ArrowRightLeft size={12}/> Transfer</span>
                          <span className="bg-rose-50 border border-rose-100 text-rose-700 px-3.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wide"><Flame size={12}/> Burn</span>
                       </div>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full">
                          <thead>
                             <tr className="bg-white border-b border-black/[0.04] text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                <th className="px-8 py-5">TX ID / Action</th>
                                <th className="px-8 py-5">From ➔ To</th>
                                <th className="px-8 py-5">Device</th>
                                <th className="px-8 py-5">Tx Hash</th>
                                <th className="px-8 py-5 text-right">Amount ($CTree)</th>
                                <th className="px-8 py-5 text-right">Gas Paid By</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[0.02]">
                             {ledgerTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="px-8 py-5 whitespace-nowrap">
                                      <div className="font-mono text-xs text-slate-400 mb-1.5">{tx.id} <span className="text-slate-300 ml-2">{tx.time}</span></div>
                                      <StatusBadge status={tx.type} />
                                      <div className="text-[11px] font-semibold text-slate-600 mt-2 max-w-[200px] truncate" title={tx.actionTitle}>{tx.actionTitle}</div>
                                   </td>
                                   <td className="px-8 py-5 whitespace-nowrap">
                                      <div className="font-bold text-[14px] text-slate-800 truncate max-w-[160px] mb-1.5">
                                         {formatEntity(tx.from)}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-medium truncate max-w-[160px] flex items-center gap-1.5">
                                         <span className="text-slate-300">➔</span> {formatEntity(tx.to)}
                                      </div>
                                   </td>
                                   <td className="px-8 py-5">
                                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-[10px] w-max border border-black/5">
                                         {tx.device === 'NFC Card' ? <Nfc size={14} className="text-[#1562f0]"/> : tx.device === 'Beamio APP' ? <Smartphone size={14} className="text-[#96EB3C]"/> : <Globe size={14} className="text-slate-400"/>}
                                         {tx.device}
                                      </div>
                                   </td>
                                   <td className="px-8 py-5">
                                      <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#1562f0] hover:text-[#1250c4] cursor-pointer w-max bg-[#1562f0]/10 px-2.5 py-1 rounded-[8px] border border-[#1562f0]/20 font-bold transition-colors">
                                         {tx.txHash} <ExternalLink size={12}/>
                                      </div>
                                   </td>
                                   <td className="px-8 py-5 text-right font-mono font-black text-slate-900 text-xl tracking-tight">${tx.amount}</td>
                                   <td className="px-8 py-5 text-right whitespace-nowrap">
                                      <div className={`text-[12px] font-extrabold ${tx.gasPaidBy === 'CashTrees' ? 'text-[#82cc33]' : 'text-orange-600'}`}>
                                         {tx.gasPaidBy}
                                      </div>
                                      <div className="text-[10px] text-orange-600 font-mono font-bold mt-1.5 flex items-center justify-end gap-1 bg-orange-50 px-2 py-0.5 rounded-md w-max ml-auto">
                                         <Zap size={10}/> {tx.gasAmount}
                                      </div>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
            )}

            {/* --- CHAT --- */}
            {activeTab === 'Chat' && (
              <div className="h-[calc(100vh-140px)] flex overflow-hidden bg-white rounded-[32px] border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                 <div className="w-[340px] border-r border-black/[0.04] flex flex-col bg-[#F5F5F7]/50">
                    <div className="p-6 border-b border-black/[0.04]">
                       <h2 className="text-2xl font-extrabold text-slate-900 mb-5 tracking-tight">Messages</h2>
                       <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-3 bg-white border border-black/[0.05] rounded-[14px] text-sm focus:outline-none focus:ring-2 focus:ring-[#96EB3C]/30 shadow-sm" />
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                       <div className="p-5 border-b border-black/[0.02] cursor-pointer bg-[#96EB3C]/10 border-l-4 border-l-[#96EB3C]">
                          <div className="flex justify-between items-start mb-1.5">
                              <div className="flex items-center gap-3">
                                  <img src={merchants[0].logo} alt="" className="w-11 h-11 rounded-full object-cover shadow-sm" />
                                  <div>
                                    <div className="font-bold text-[14px] text-slate-900 leading-none">{merchants[0].name}</div>
                                    <span className="text-[11px] text-slate-500 font-medium mt-1 block">{merchants[0].beamioHandle}</span>
                                  </div>
                              </div>
                              <span className="text-[10px] font-bold text-[#82cc33]">10:42 AM</span>
                          </div>
                          <p className="text-[13px] text-slate-600 truncate mt-2 pl-14 font-medium">Rate adjustment request for Q1...</p>
                       </div>
                    </div>
                 </div>
                 <div className="flex-1 flex flex-col bg-white">
                    <div className="h-24 border-b border-black/[0.04] flex justify-between items-center px-8 bg-white/80 backdrop-blur-md z-10">
                       <div className="flex items-center gap-4">
                          <img src={merchants[0].logo} alt="" className="w-14 h-14 rounded-[16px] object-cover shadow-sm border border-black/[0.04]" />
                          <div>
                             <div className="font-extrabold text-xl text-slate-900 flex items-center gap-2.5">
                                {merchants[0].name}
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">Merchant</span>
                             </div>
                             <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                                <Lock size={12} className="text-emerald-500"/> End-to-End Encrypted
                             </div>
                          </div>
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                       <div className="flex justify-center"><span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-[#F5F5F7] px-4 py-1 rounded-full">Today</span></div>
                       <div className="flex justify-start">
                          <div className="max-w-[65%] rounded-[20px] rounded-tl-sm px-6 py-4 text-[15px] bg-[#F5F5F7] text-slate-800 shadow-sm font-medium leading-relaxed border border-black/[0.02]">
                            Hi CashTrees Team, can we adjust our flat rate to 1.4% next month? Volume is up.
                            <div className="text-[10px] font-bold mt-2 text-slate-400">10:42 AM</div>
                          </div>
                       </div>
                    </div>
                    <div className="p-6 bg-white border-t border-black/[0.04]">
                       <div className="flex items-center gap-3 bg-[#F5F5F7] border border-black/[0.04] rounded-[20px] px-4 py-2.5">
                          <button className="p-2 text-slate-400 hover:text-[#96EB3C] transition-colors"><PlusCircle size={24}/></button>
                          <input type="text" placeholder="Type an encrypted message..." className="flex-1 bg-transparent border-none focus:outline-none text-[15px] py-2 text-slate-800" />
                          <button className="p-3.5 rounded-[16px] bg-[#96EB3C] hover:bg-[#86d635] text-slate-900 shadow-md shadow-[#96EB3C]/30 transition-transform active:scale-95"><Send size={18}/></button>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            {/* --- AUDIT LOGS --- */}
            {activeTab === 'Audit' && (
              <div className="bg-white border border-black/[0.04] rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden animate-in fade-in">
                 <div className="p-8 border-b border-black/[0.04] bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-200 text-slate-700 rounded-[16px] flex items-center justify-center"><ShieldAlert size={24}/></div>
                      <div>
                        <h3 className="font-extrabold text-xl text-slate-900 tracking-tight">FINTRAC & BoC Compliance Logs</h3>
                        <p className="text-[13px] font-medium text-slate-500 mt-1">Immutable ledger of administrative actions.</p>
                      </div>
                    </div>
                    <button className="bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-[14px] text-sm font-bold transition-all shadow-md active:scale-95">Export for Audit</button>
                 </div>
                 <div className="divide-y divide-black/[0.02]">
                    {[1,2,3].map(i => (
                      <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-5">
                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><History size={16}/></div>
                           <div>
                              <div className="text-[15px] font-bold text-slate-900">Merchant Onboarding Verified</div>
                              <div className="text-[12px] font-medium text-slate-500 mt-0.5">KYB approved for @osmanthus_van by Admin (0x12...af)</div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-[12px] font-bold text-slate-500">2025-12-10</div>
                           <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">On-Chain Verified</div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

        </div>
      </main>

      {/* --- QUOTA MANAGEMENT MODAL --- */}
      {quotaModalData.isOpen && quotaModalData.merchant ? (() => {
          const m = quotaModalData.merchant as Merchant;
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setQuotaModalData({ isOpen: false, merchant: null })}></div>
            <div className="bg-white rounded-[32px] shadow-[0_24px_48px_rgba(0,0,0,0.1)] w-full max-w-lg relative z-10 p-8 animate-in fade-in zoom-in duration-200">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                     <AlertOctagon className="text-[#82cc33]" size={28} strokeWidth={2.5}/> Manage Quota & Risk
                  </h3>
                  <button onClick={() => setQuotaModalData({ isOpen: false, merchant: null })} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X size={20}/></button>
               </div>
               
               <div className="mb-8 flex items-center gap-4 bg-[#F5F5F7] p-5 rounded-[20px] border border-black/[0.04]">
                   <img src={m.logo} className="w-14 h-14 rounded-[16px] object-cover shadow-sm" alt="" />
                   <div>
                       <div className="font-extrabold text-[16px] text-slate-900">{m.name}</div>
                       <div className="text-[13px] font-medium text-slate-500 mt-0.5">{m.location}</div>
                   </div>
               </div>

               <div className="space-y-8">
                  {/* Section 1: Adjust Quota Limit */}
                  <div>
                     <div className="flex justify-between items-end mb-3">
                         <div>
                             <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Adjust Quota Limit</label>
                             <p className="text-[12px] font-medium text-slate-400 mt-1">Maximum offline fiat allowed before freeze</p>
                         </div>
                     </div>
                     <div className="flex items-center gap-3">
                         <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input 
                                type="number" 
                                value={newQuotaValue}
                                onChange={(e) => setNewQuotaValue(e.target.value)}
                                className="w-full pl-8 pr-4 py-3.5 bg-white border border-slate-300 rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-bold font-mono text-[16px] transition-all" 
                            />
                         </div>
                         <button onClick={handleUpdateQuota} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3.5 px-6 rounded-[16px] transition-all active:scale-95 whitespace-nowrap">
                             Update Limit
                         </button>
                     </div>
                  </div>

                  {/* Section 2: Reset Quota Usage (Record Settlement) */}
                  <div className="border-t border-black/[0.05] pt-8">
                     <div className="flex justify-between items-end mb-4">
                         <div>
                             <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Settle & Reset Quota</label>
                             <p className="text-[12px] font-medium text-slate-400 mt-1">Record fiat payment from merchant to alliance</p>
                         </div>
                         <div className="text-right bg-rose-50 px-4 py-2 rounded-[14px]">
                             <div className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">Current Debt</div>
                             <div className="font-mono font-black text-rose-600 text-xl tracking-tight">
                                 ${Math.max(0, parseFloat(m.fiatCollected) - parseFloat(m.volume)).toFixed(2)}
                             </div>
                         </div>
                     </div>

                     <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-6">
                        <div 
                           className={`h-full transition-all duration-500 ${((Math.max(0, parseFloat(m.fiatCollected) - parseFloat(m.volume)) / m.mintQuota) * 100) > 80 ? 'bg-rose-500' : 'bg-[#96EB3C]'}`} 
                           style={{width: `${Math.min(100, (Math.max(0, parseFloat(m.fiatCollected) - parseFloat(m.volume)) / m.mintQuota) * 100)}%`}}
                        ></div>
                     </div>

                     <div className="flex items-center gap-3">
                         <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                            <input 
                                type="number" 
                                value={settlementAmount}
                                onChange={(e) => setSettlementAmount(e.target.value)}
                                placeholder="Amount Paid"
                                className="w-full pl-8 pr-4 py-3.5 bg-white border border-rose-200 rounded-[16px] focus:outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 font-bold font-mono text-[16px] transition-all placeholder:text-slate-300 placeholder:font-sans" 
                            />
                         </div>
                         <button onClick={handleRecordPayment} className="bg-[#96EB3C] hover:bg-[#86d635] text-slate-900 font-bold py-3.5 px-6 rounded-[16px] transition-all active:scale-95 shadow-[0_4px_16px_rgba(150,235,60,0.3)] whitespace-nowrap flex items-center gap-2">
                             <RefreshCw size={18} strokeWidth={2.5}/> Confirm Settle
                         </button>
                     </div>
                  </div>
               </div>
            </div>
          </div>
          );
      })() : null}

      {/* --- MERCHANT ONBOARD MODAL --- */}
      {isMerchantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeOnboardModal}></div>
            <div className="bg-white rounded-[32px] shadow-[0_24px_48px_rgba(0,0,0,0.1)] w-full max-w-md relative z-10 p-8 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center mb-6 flex-shrink-0">
                  <h3 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5 tracking-tight">
                     <Utensils className="text-[#82cc33]" size={28} strokeWidth={2.5}/> Onboard Restaurant
                  </h3>
                  <button onClick={closeOnboardModal} className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X size={20}/></button>
               </div>
               
               <div className="space-y-6 overflow-y-auto pr-2 pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div>
                     <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Restaurant Name</label>
                     <input type="text" className="w-full p-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold transition-all" placeholder="e.g. Sen Pho + Cafe" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Cuisine</label>
                         <input type="text" className="w-full p-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold transition-all" placeholder="e.g. Vietnamese" />
                      </div>
                      <div>
                         <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">City/Area</label>
                         <input type="text" className="w-full p-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold transition-all" placeholder="e.g. Kerrisdale" />
                      </div>
                  </div>
                  
                  {/* Dynamic Handle Verification Section */}
                  <div>
                     <div className="flex justify-between items-end mb-2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">Beamio Handle (Search or Reserve)</label>
                        {handleStatus === 'found' && <span className="text-[10px] font-bold text-[#1562f0] flex items-center gap-1"><CheckCircle2 size={12}/> Merchant Found</span>}
                        {handleStatus === 'available' && <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> Handle Available</span>}
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                           <input 
                              type="text" 
                              value={onboardHandle}
                              onChange={(e) => { setOnboardHandle(e.target.value); setHandleStatus('idle'); }}
                              className={`w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border rounded-[16px] focus:outline-none focus:ring-4 font-semibold transition-all ${handleStatus === 'found' ? 'border-[#1562f0]/30 focus:border-[#1562f0] focus:ring-[#1562f0]/20' : 'border-black/[0.04] focus:border-[#96EB3C] focus:ring-[#96EB3C]/20'}`} 
                              placeholder="senpho (Type this to test found)" 
                           />
                        </div>
                        <button onClick={handleVerifyHandle} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-4 px-6 rounded-[16px] transition-all active:scale-95 whitespace-nowrap">
                           {handleStatus === 'searching' ? 'Checking...' : 'Verify'}
                        </button>
                     </div>
                     
                     {handleStatus === 'found' && (
                        <div className="mt-3 p-4 bg-[#1562f0]/5 border border-[#1562f0]/10 rounded-[16px] flex items-start gap-3">
                            <BadgeCheck size={20} className="text-[#1562f0] shrink-0 mt-0.5" />
                            <div className="text-[12px] font-medium text-[#1562f0]">
                                <strong className="block text-[13px] mb-1">Existing Merchant OS User</strong>
                                The Smart Account for this handle is already verified. We will mint and airdrop the <strong>CashTrees Partner NFT</strong> directly to authorize alliance features.
                            </div>
                        </div>
                     )}
                     
                     {handleStatus === 'available' && (
                        <div className="mt-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-[16px] flex items-start gap-3">
                            <Store size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                            <div className="text-[12px] font-medium text-emerald-700">
                                <strong className="block text-[13px] mb-1">New Merchant</strong>
                                Handle is available. A KYB link will be generated to onboard the merchant and deploy their Smart Account.
                            </div>
                        </div>
                     )}
                  </div>

                  {/* Financial Limits & Risk Control */}
                  <div className="pt-6 border-t border-black/[0.04]">
                     <h4 className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest mb-4">Financial Limits & Risk Control</h4>
                     <div className="space-y-5">
                         <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Max Cumulative Quota (CAD)</label>
                            <div className="relative">
                               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                               <input type="number" className="w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold font-mono transition-all" placeholder="e.g. 50000" />
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Max Top-up / TX</label>
                                <div className="relative">
                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                   <input type="number" className="w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold font-mono transition-all" placeholder="e.g. 1000" />
                                </div>
                             </div>
                             <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Max Spend / TX</label>
                                <div className="relative">
                                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                   <input type="number" className="w-full pl-10 pr-4 py-4 bg-[#F5F5F7] border border-black/[0.04] rounded-[16px] focus:outline-none focus:border-[#96EB3C] focus:ring-4 focus:ring-[#96EB3C]/20 font-semibold font-mono transition-all" placeholder="e.g. 500" />
                                </div>
                             </div>
                         </div>
                     </div>
                  </div>

                  {/* Dynamic Submit Button */}
                  {handleStatus === 'found' ? (
                     <button className="w-full bg-[#1562f0] text-white py-4 rounded-[16px] font-bold shadow-[0_4px_16px_rgba(21,98,240,0.3)] hover:bg-[#1250c4] transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">
                        Mint Partner NFT & Authorize <Sparkles size={18} strokeWidth={2.5}/>
                     </button>
                  ) : (
                     <button className="w-full bg-[#96EB3C] text-slate-900 py-4 rounded-[16px] font-bold shadow-[0_4px_16px_rgba(150,235,60,0.3)] hover:bg-[#86d635] transition-all active:scale-95 flex items-center justify-center gap-2 mt-4">
                        Generate KYB Link <ArrowRight size={18} strokeWidth={2.5}/>
                     </button>
                  )}
               </div>
            </div>
          </div>
      )}
    </div>
  );
}

