import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  RefreshCw, 
  Search, 
  ChevronLeft, 
  Filter, 
  Receipt, 
  MessageCircle, 
  Coins, 
  CheckCircle2, 
  Copy, 
  Code, 
  Share2,
  Zap,
  Ticket,
  Wallet,
  QrCode, 
  Fuel,   
  Clock,   
  XCircle, 
  Ban,
  Link as LinkIcon,
  ArrowRightLeft
} from 'lucide-react';
import VscodeJsonBlock from '@/components/VscodeJsonBlock';

// --- Design Tokens ---
const BEAMIO_BLUE = '#1562f0';

/** Transaction 类型：从 mock 数据推断，供 selectedTx 与 filteredTransactions 使用 */
type TxItem = {
  id: string
  type: string
  title: string
  handle: string
  timestamp: string
  amountFiat: number
  currencyFiat: string
  amountUSDC: number
  status: string
  category: string
  accountType: 'AA' | 'EOA'
  isMixed: boolean
  route: { asset: string; amount: number; type: string; symbol: string; source: string }[]
  fees: { gas: number; service: number; bUnits: number; gasBUnits: number }
  hashes: { base: string | string[] | null; conet: string | null }
  meta?: { requestAmount?: number; [k: string]: unknown }
}

/**
 * Mock Data - PRESERVED LOGIC
 * 更新：新增 tx_012，展示极限 P2P Smart Routing 场景 (Voucher -> AA USDC -> EOA USDC)
 */
const TRANSACTIONS: TxItem[] = [
  {
    id: 'tx_007', 
    type: 'request_create',
    title: 'Store Payment QR', 
    handle: 'QR Generated',
    timestamp: 'Just now',
    amountFiat: 0, 
    currencyFiat: 'USD',
    amountUSDC: 0,
    status: 'Waiting', 
    category: 'Tools',
    accountType: 'AA', 
    isMixed: false,
    route: [],
    // 修正：按照 0.8% 费率计算。50 * 0.008 = 0.40 USDC = 40 B-Units
    fees: { gas: 0, service: 0, bUnits: 40, gasBUnits: 0 }, 
    hashes: { base: null, conet: '0x9a8...b7c6' },
    meta: { requestAmount: 50.00 }
  },
  {
    id: 'tx_012', // 新增：极限 Smart Routing 场景 (付款方视角)
    type: 'transfer_out',
    title: 'Paid @charlie_aa',
    handle: 'Smart P2P Payment',
    timestamp: '10 mins ago',
    amountFiat: -50.00,
    currencyFiat: 'USD',
    amountUSDC: -40.00, // 实际扣除的 USDC 总额 (15 AA + 25 EOA)
    status: 'Finalized',
    category: 'P2P Transfer',
    accountType: 'AA', // 从 AA 发起智能路由
    isMixed: true, // 开启智能路由可视化
    route: [
      // 完美对应您的需求：Voucher -> AA USDC -> EOA USDC
      { asset: '$COFFEE', amount: 10.00, type: 'Voucher', symbol: 'pts', source: 'Express Pay' },
      { asset: 'USDC', amount: 15.00, type: 'Cash', symbol: '$', source: 'Express Pay (AA)' },
      { asset: 'USDC', amount: 25.00, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 2 }, 
    // 核心架构更新：支持多笔哈希，对应 EOA 和 AA 的并发结算
    hashes: { base: ['0x9c2...d3e4', '0x1a8...f9b2'], conet: '0x5f6...a1b2' },
    meta: { via: 'Smart Route' }
  },
  {
    id: 'tx_013', // 新增：收款方仅有 EOA 时的优雅降级场景
    type: 'transfer_out',
    title: 'Paid @dave_classic',
    handle: 'Standard P2P Payment',
    timestamp: '30 mins ago',
    amountFiat: -15.00,
    currencyFiat: 'USD',
    amountUSDC: -15.00, 
    status: 'Finalized',
    category: 'P2P Transfer',
    accountType: 'EOA', // 仅涉及 EOA 到 EOA 的转账
    isMixed: false, // 不触发复杂路由
    route: [
      { asset: 'USDC', amount: 15.00, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 2 }, 
    hashes: { base: '0xdef...5678', conet: '0x9ab...cdef' },
    meta: { via: 'QR Link' } // 同样是通过扫码触发的
  },
  {
    id: 'tx_008', 
    type: 'request_fulfilled',
    title: 'Payment Received',
    handle: 'Paid by @bob_builder', 
    timestamp: 'Today, 2:15 PM',
    amountFiat: 50.00, 
    currencyFiat: 'USD',
    amountUSDC: 50.00,
    status: 'Received', 
    category: 'Tools',
    accountType: 'AA', 
    isMixed: false,
    route: [
       { asset: 'USDC', amount: 50.00, type: 'Cash', symbol: '$', source: 'Express Pay' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 }, 
    hashes: { base: '0x2f4...d5e6', conet: '0x9a8...b7c6' },
    meta: { originalRequestId: 'req_101' }
  },
  {
    id: 'tx_001', 
    type: 'merchant_pay',
    title: 'Starbucks @Robson',
    handle: '@starbucks_van',
    timestamp: 'Today, 10:23 AM',
    amountFiat: -12.50,
    currencyFiat: 'CAD',
    amountUSDC: -9.25,
    status: 'Finalized',
    category: 'Food & Drink',
    accountType: 'AA', 
    isMixed: true, 
    route: [
      { asset: '$CCSA', amount: 3.25, type: 'Voucher', symbol: 'pts', source: 'Express Pay' },
      { asset: 'USDC', amount: 9.25, type: 'Cash', symbol: '$', source: 'Main Wallet' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 2 }, 
    hashes: { base: '0x8f2...a9b1', conet: '0x1d4...e3f9' },
    meta: { via: 'QR Link' }
  },
  {
    id: 'tx_011',  
    type: 'reload_card',
    title: 'Reload CCSA Card',
    handle: '@ccsa_alliance',
    timestamp: 'Today, 10:00 AM',
    amountFiat: -50.00,
    currencyFiat: 'CAD',
    amountUSDC: -36.50, 
    status: 'Finalized',
    category: 'Store Credit',
    accountType: 'EOA', 
    isMixed: false,
    route: [
      { asset: 'USDC', amount: 36.50, type: 'Cash', symbol: '$', source: 'Main Wallet' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 2 }, 
    hashes: { base: '0x5d6...e7f8', conet: '0x1v2...w3x4' }
  },
  {
    id: 'tx_010', 
    type: 'internal_transfer',
    title: 'Withdraw to Main Wallet',
    handle: 'Internal Transfer',
    timestamp: 'Today, 9:30 AM',
    amountFiat: 20.00,
    currencyFiat: 'USD',
    amountUSDC: 20.00,
    status: 'Finalized',
    category: 'Internal',
    accountType: 'EOA', 
    isMixed: false,
    route: [
      { asset: 'USDC', amount: 20.00, type: 'Cash', symbol: '$', source: 'Express Pay -> Main' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 2 }, 
    hashes: { base: '0x1a2...b3c4', conet: null }
  },
  {
    id: 'tx_002', 
    type: 'transfer_in',
    title: 'Received from Mike',
    handle: '@mike_eth',
    timestamp: 'Yesterday, 4:45 PM',
    amountFiat: 50.00,
    currencyFiat: 'USD',
    amountUSDC: 50.00,
    status: 'Finalized',
    category: 'Transfer',
    accountType: 'EOA', 
    isMixed: false,
    route: [
      { asset: 'USDC', amount: 50.00, type: 'Cash', symbol: '$', source: 'Main Wallet' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
    hashes: { base: '0x7a2...b8c3', conet: '0x9e1...f2a4' }
  },
  {
    id: 'tx_003', 
    type: 'fund_express_pay',
    title: 'Add to Express Pay',
    handle: 'Internal Transfer',
    timestamp: 'Yesterday, 2:00 PM',
    amountFiat: -100.00,
    currencyFiat: 'USD',
    amountUSDC: -100.00,
    status: 'Finalized',
    category: 'Internal',
    accountType: 'EOA', 
    isMixed: false,
    route: [
      { asset: 'USDC', amount: 100.00, type: 'Cash', symbol: '$', source: 'Main -> Express Pay' }
    ],
    fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 2 },
    hashes: { base: '0x3c4...d5e6', conet: null }
  },
  {
    id: 'tx_009', 
    type: 'request_expired',
    title: 'Request Expired',
    handle: 'Link Invalidated',
    timestamp: 'Yesterday, 9:00 AM',
    amountFiat: 0,
    currencyFiat: 'USD',
    amountUSDC: 0,
    status: 'Expired', 
    category: 'Tools',
    accountType: 'AA', 
    isMixed: false,
    route: [],
    // 修正：按照 0.8% 费率计算。20 * 0.008 = 0.16 USDC = 16 B-Units
    fees: { gas: 0, service: 0, bUnits: 16, gasBUnits: 0 }, 
    hashes: { base: null, conet: '0x3c2...a1b0' },
    meta: { requestAmount: 20.00 }
  }
];

export default function BeamioTransactions({ initialTab = 'All' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedTx, setSelectedTx] = useState<TxItem | null>(null);
  const [showJson, setShowJson] = useState(false);

  const filteredTransactions = TRANSACTIONS.filter(tx => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Cash') return tx.accountType === 'EOA';
    if (activeTab === 'Vouchers') return tx.accountType === 'AA';
    return true;
  });

  const formatCurrency = (amount: number, currency: string) => {
    const sign = amount > 0 ? '+' : amount < 0 ? '' : '';
    return `${sign}${amount.toFixed(2)} ${currency}`;
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 font-sans p-4">
      {/* Device Frame */}
      <div className="w-full max-w-md bg-[#F2F2F7] h-[850px] rounded-[50px] shadow-2xl overflow-hidden relative border-[12px] border-gray-900 flex flex-col">
        
        {/* iOS Status Bar Area */}
        <div className="absolute top-0 left-0 w-full h-12 z-50 flex justify-between px-6 pt-3 pointer-events-none">
           <span className="text-sm font-semibold text-black tracking-wide">9:41</span>
           <div className="flex gap-1.5 items-center">
             <div className="w-4 h-2.5 bg-black rounded-[1px]"></div> {/* Signal */}
             <div className="w-4 h-2.5 bg-black rounded-[1px]"></div> {/* WiFi */}
             <div className="w-6 h-3 border-[1px] border-black/30 rounded-[3px] relative">
               <div className="absolute top-0.5 left-0.5 w-4 h-1.5 bg-black rounded-[1px]"></div>
             </div> {/* Battery */}
           </div>
        </div>
        
        {/* Dynamic Island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-9 bg-black rounded-[20px] z-50 transition-all hover:w-48 hover:h-12 flex items-center justify-center">
        </div>

        {/* Header - Glassmorphism */}
        <div className="pt-16 pb-2 px-5 flex justify-between items-center bg-[#F2F2F7]/80 backdrop-blur-xl sticky top-0 z-40 border-b border-gray-200/50">
          <button className="flex items-center gap-1 text-[#1562f0] active:opacity-50 transition-opacity">
            <ChevronLeft size={26} strokeWidth={2.5} />
            <span className="text-[17px] font-medium tracking-tight">Wallet</span>
          </button>
          <div className="flex gap-3">
             <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-900 active:scale-95 transition-transform">
               <Search size={20} strokeWidth={2} />
             </button>
          </div>
        </div>

        {/* Large Title */}
        <div className="px-5 pt-2 pb-4 bg-[#F2F2F7]">
           <h1 className="text-[34px] font-bold text-black tracking-tight leading-tight">Transactions</h1>
        </div>

        {/* Floating Segmented Control */}
        <div className="px-5 mb-6 z-30 relative">
          <div className="flex bg-white/90 backdrop-blur-xl p-1.5 rounded-full shadow-[0_8px_25px_rgba(0,0,0,0.06)] border border-white/50 w-full relative">
            {['All', 'Cash', 'Vouchers'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-[13px] font-semibold tracking-tight rounded-full py-2.5 transition-all duration-300 ${
                  activeTab === tab 
                    ? 'bg-[#1562f0] text-white shadow-[0_4px_12px_rgba(21,98,240,0.3)] scale-[1.02]' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Floating Context Hint */}
          <div className="mt-3 flex justify-center">
             <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-sm border border-white/40 shadow-sm">
               {activeTab === 'Cash' && <Wallet size={12} className="text-[#1562f0]" />}
               {activeTab === 'Vouchers' && <Ticket size={12} className="text-[#1562f0]" />}
               <span className="text-[11px] font-medium text-gray-500">
                 {activeTab === 'Cash' ? 'Main Wallet (USDC)' : activeTab === 'Vouchers' ? 'Express Pay (Assets)' : 'All Accounts'}
               </span>
             </div>
          </div>
        </div>

        {/* Transaction List - Inset Grouped Style */}
        <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-3 scrollbar-hide">
          {filteredTransactions.map((tx) => (
            <div 
              key={tx.id}
              onClick={() => { setShowJson(false); setSelectedTx(tx); }}
              className="relative flex items-center justify-between p-4 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all duration-200 cursor-pointer border border-gray-100/50"
            >
              <div className="flex items-center gap-4">
                {/* Icon Container - Floating Style */}
                <div className={`w-[48px] h-[48px] rounded-[14px] flex items-center justify-center shadow-sm relative overflow-hidden ${
                  tx.type === 'merchant_pay' ? 'bg-[#1562f0]/10 text-[#1562f0]' :
                  tx.type === 'reload_card' ? 'bg-[#AF52DE]/10 text-[#AF52DE]' : 
                  tx.type === 'transfer_in' ? 'bg-[#34C759]/10 text-[#34C759]' : 
                  tx.type === 'transfer_out' ? 'bg-gray-100 text-black' : 
                  tx.type === 'request_create' ? 'bg-[#FF9500]/10 text-[#FF9500]' : 
                  tx.type === 'request_fulfilled' ? 'bg-[#34C759]/10 text-[#34C759]' : 
                  tx.type === 'request_expired' ? 'bg-gray-100 text-gray-400' :
                  (tx.type === 'fund_express_pay' || tx.type === 'internal_transfer') ? 'bg-gray-100 text-gray-600' :
                  'bg-[#AF52DE]/10 text-[#AF52DE]' 
                }`}>
                  {/* Icon Selection */}
                  {tx.type === 'merchant_pay' && <CreditCard size={22} strokeWidth={2} />}
                  {tx.type === 'reload_card' && <CreditCard size={22} strokeWidth={2} />}
                  {tx.type === 'transfer_in' && <ArrowDownLeft size={22} strokeWidth={2} />}
                  {tx.type === 'request_fulfilled' && <QrCode size={22} strokeWidth={2} />} 
                  {tx.type === 'transfer_out' && <ArrowUpRight size={22} strokeWidth={2} />} 
                  {tx.type === 'request_create' && <QrCode size={22} strokeWidth={2} />} 
                  {tx.type === 'request_expired' && <XCircle size={22} strokeWidth={2} />}
                  {tx.type === 'fund_express_pay' && <Wallet size={22} strokeWidth={2} />}
                  {tx.type === 'internal_transfer' && <ArrowRightLeft size={20} strokeWidth={2} />}
                  {tx.type === 'voucher_burn' && <Ticket size={22} strokeWidth={2} />}
                </div>

                <div className="flex flex-col gap-0.5">
                  <h3 className={`text-[16px] font-semibold tracking-tight ${tx.type === 'request_expired' ? 'text-gray-400' : 'text-black'}`}>
                    {tx.title}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] text-gray-500 font-medium">{tx.handle}</span>
                    
                    {/* Status Badges - Pill Style */}
                    {tx.isMixed && (
                      <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#FF9500]/10 rounded-md">
                        <Zap size={10} className="text-[#FF9500] fill-[#FF9500]" />
                        <span className="text-[10px] font-bold text-[#FF9500] uppercase tracking-wider">Split</span>
                      </div>
                    )}
                    {tx.type === 'request_fulfilled' && (
                       <span className="text-[10px] font-semibold text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 rounded-md">
                        Request
                      </span>
                    )}
                    {tx.fees && tx.fees.bUnits > 0 && tx.type === 'request_expired' && (
                       <div className="flex items-center gap-0.5 bg-gray-100 px-1.5 py-0.5 rounded-md">
                         <Fuel size={10} className="text-gray-500" />
                         <span className="text-[10px] font-bold text-gray-500">Burnt</span>
                       </div>
                    )}
                    {tx.type === 'request_create' && (
                       <span className="text-[10px] font-semibold text-[#FF9500] bg-[#FF9500]/10 px-1.5 py-0.5 rounded-md">
                        Waiting
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <div className={`text-[16px] font-semibold tracking-tight ${
                  tx.amountFiat > 0 ? 'text-[#34C759]' : 
                  tx.type === 'request_expired' ? 'text-gray-400' : 'text-black'
                }`}>
                   {tx.type === 'request_create' ? (
                     <span className="text-[#FF9500]">Pending</span>
                   ) : tx.type === 'request_expired' ? (
                     'Expired'
                   ) : formatCurrency(tx.amountFiat, tx.currencyFiat)}
                </div>
                
                {tx.amountUSDC !== 0 && tx.type !== 'request_create' && tx.type !== 'request_expired' && (
                  <span className="text-[12px] font-medium text-gray-400">
                    {Math.abs(tx.amountUSDC).toFixed(2)} USDC
                  </span>
                )}
                {(tx.type === 'request_create' || tx.type === 'request_expired') && tx.meta && (
                  <span className="text-[12px] font-medium text-gray-400">
                    ${(tx.meta.requestAmount ?? 0).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
          
          <div className="pt-6 pb-2 text-center">
            <span className="text-[12px] font-medium text-gray-400">Encrypted on CoNET L1</span>
          </div>
        </div>

        {/* Floating Detail Sheet (iOS Modal Style) */}
        {selectedTx && (
          <div className="absolute inset-0 z-50 flex justify-end flex-col animate-in fade-in duration-300">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setSelectedTx(null)}
            ></div>
            
            {/* Sheet - Added overflow-y-auto and scrollbar-hide to ensure scrollability */}
            <div 
              className="bg-white w-full rounded-t-[32px] p-6 pb-12 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] relative z-10 animate-in slide-in-from-bottom duration-400 ease-out overflow-y-auto scrollbar-hide"
              style={{ maxHeight: '85%' }}
            >
              {/* Drag Handle */}
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
              
              {/* Close Button */}
              <button 
                onClick={() => setSelectedTx(null)}
                className="absolute top-6 right-6 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <div className="text-gray-500 font-bold text-lg leading-none">×</div>
              </button>

              {/* Sheet Header */}
              <div className="text-center mb-8">
                <div className={`w-[72px] h-[72px] mx-auto rounded-[24px] flex items-center justify-center shadow-lg mb-5 ${
                  selectedTx.type === 'merchant_pay' ? 'bg-[#1562f0] text-white shadow-blue-200' :
                  selectedTx.type === 'reload_card' ? 'bg-[#AF52DE] text-white shadow-purple-200' :
                  selectedTx.type === 'request_fulfilled' ? 'bg-[#34C759] text-white shadow-green-200' : 
                  selectedTx.type === 'transfer_in' ? 'bg-[#34C759] text-white shadow-green-200' :
                  selectedTx.type === 'transfer_out' ? 'bg-black text-white shadow-gray-300' : 
                  selectedTx.type === 'request_create' ? 'bg-[#FF9500] text-white shadow-orange-200' :
                  selectedTx.type === 'request_expired' ? 'bg-gray-200 text-gray-500' : 
                  (selectedTx.type === 'fund_express_pay' || selectedTx.type === 'internal_transfer') ? 'bg-gray-100 text-gray-500' :
                  'bg-[#AF52DE] text-white'
                }`}>
                   {selectedTx.type === 'merchant_pay' && <CreditCard size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'reload_card' && <CreditCard size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'transfer_in' && <ArrowDownLeft size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'request_fulfilled' && <QrCode size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'transfer_out' && <ArrowUpRight size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'request_create' && <QrCode size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'request_expired' && <XCircle size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'fund_express_pay' && <Wallet size={36} strokeWidth={1.5} />}
                   {selectedTx.type === 'internal_transfer' && <ArrowRightLeft size={32} strokeWidth={1.5} />}
                   {selectedTx.type === 'voucher_burn' && <Ticket size={36} strokeWidth={1.5} />}
                </div>
                
                <h2 className={`text-[28px] font-bold tracking-tight leading-tight ${selectedTx.type === 'request_expired' ? 'text-gray-400' : 'text-black'}`}>
                   {selectedTx.type === 'request_create' || selectedTx.type === 'request_expired'
                     ? `Requesting $${(selectedTx.meta?.requestAmount ?? 0).toFixed(2)}`
                     : selectedTx.amountFiat === 0 ? 'Redeemed' : formatCurrency(selectedTx.amountFiat, selectedTx.currencyFiat)
                   }
                </h2>

                {/* 明确展示结算的 USDC 金额 (Source of Truth) */}
                {selectedTx.amountUSDC !== 0 && selectedTx.type !== 'request_create' && selectedTx.type !== 'request_expired' && (
                   <div className="text-[15px] font-semibold text-[#1562f0] mt-1.5 mb-0.5">
                     Settled for {Math.abs(selectedTx.amountUSDC).toFixed(2)} USDC
                   </div>
                )}

                <p className="text-[14px] font-medium text-gray-400 mt-1.5">{selectedTx.timestamp}</p>
                
                {/* Status Chip */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold mt-4 ${
                   selectedTx.status === 'Waiting' ? 'bg-[#FF9500]/10 text-[#FF9500]' :
                   selectedTx.status === 'Expired' ? 'bg-gray-100 text-gray-500' :
                   'bg-[#34C759]/10 text-[#34C759]'
                }`}>
                   {selectedTx.status === 'Waiting' ? <Clock size={14} /> : 
                    selectedTx.status === 'Expired' ? <Ban size={14} /> :
                    <CheckCircle2 size={14} />} 
                   {selectedTx.status}
                </div>
              </div>

              {/* Action Area */}
              <div className="space-y-4 mb-8">
                {selectedTx.type === 'request_create' ? (
                   <>
                      <div className="bg-[#FF9500]/5 rounded-[20px] p-5 text-center border border-[#FF9500]/20">
                          <p className="text-[15px] text-[#FF9500] font-medium mb-4">Code is active. Waiting for payment.</p>
                          <button className="w-full py-3.5 bg-white text-[#FF9500] border border-[#FF9500]/30 rounded-[14px] font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform">
                            <Share2 size={18} /> Share Again
                          </button>
                      </div>
                      <button className="w-full py-3.5 text-red-500 font-semibold text-[15px] active:bg-red-50 rounded-[14px] transition-colors">
                         Cancel Request (Fuel not refundable)
                      </button>
                   </>
                ) : selectedTx.type === 'request_expired' ? (
                   <div className="bg-gray-50 rounded-[20px] p-6 text-center border border-gray-100">
                      <p className="text-[15px] text-gray-500 font-medium">This request has expired.</p>
                      <button className="mt-4 w-full py-3 bg-white border border-gray-200 text-black rounded-[14px] font-semibold text-[15px] shadow-sm active:scale-95 transition-transform">
                         {/* 修正：动态读取该笔交易的实际燃料消耗 */}
                         Create New (-{selectedTx.fees?.bUnits || 0} B-Units)
                      </button>
                   </div>
                ) : selectedTx.category === 'Internal' ? (
                   null
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <button className="flex items-center justify-center gap-2 py-4 bg-[#1562f0] text-white rounded-[18px] font-bold text-[16px] shadow-lg shadow-blue-500/30 active:scale-95 transition-transform">
                      <Coins size={20} /> Add Tip
                    </button>
                    <button className="flex items-center justify-center gap-2 py-4 bg-[#F2F2F7] text-black rounded-[18px] font-bold text-[16px] active:scale-95 transition-transform">
                      <MessageCircle size={20} /> Chat
                    </button>
                  </div>
                )}
              </div>

              {/* Mixed Payment Visualization - Refined */}
              {selectedTx.isMixed && (
                <div className="bg-gradient-to-b from-[#F9FAFB] to-white border border-gray-100 p-5 rounded-[24px] mb-6 shadow-sm">
                   <div className="flex justify-between items-center mb-5">
                    <h3 className="text-[15px] font-bold text-black flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#FF9500]/20 flex items-center justify-center">
                        <Zap size={14} className="text-[#FF9500] fill-[#FF9500]" />
                      </div>
                      Smart Routing
                    </h3>
                    <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md tracking-wide">AUTO</span>
                  </div>
                  
                  <div className="space-y-4 relative">
                    <div className="absolute left-[9px] top-3 bottom-3 w-[2px] bg-gray-100 -z-10"></div>
                    {/* UI 自动循环渲染任意级数的路由，包括三级跳 */}
                    {selectedTx.route.map((item: TxItem['route'][number], index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                           <div className={`w-5 h-5 rounded-full border-[3px] border-white shadow-sm flex items-center justify-center text-[9px] font-bold z-10 ${
                             item.type === 'Voucher' ? 'bg-[#AF52DE] text-white' : 'bg-[#1562f0] text-white'
                           }`}>
                             {item.symbol}
                           </div>
                           <div className="flex flex-col">
                             <span className="text-[15px] font-semibold text-black leading-tight">{item.asset}</span>
                             <span className="text-[12px] text-gray-400 font-medium">
                               {item.type} • {item.source}
                             </span>
                           </div>
                        </div>
                        <span className="text-[15px] font-semibold text-black">-{item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-dashed border-gray-200 mt-4 pt-4 flex justify-between items-center">
                       <span className="text-[13px] font-medium text-gray-400 pl-9">Total Paid</span>
                       <span className="text-[16px] font-bold text-black">
                         {Math.abs(selectedTx.amountUSDC).toFixed(2)} USDC
                       </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Rows */}
              <div className="bg-[#F9FAFB] rounded-[24px] p-5 space-y-4 mb-8">
                 <div className="flex justify-between items-center text-[14px]">
                    <span className="text-gray-500 font-medium">
                      {selectedTx.type === 'request_create' ? 'Service' : 
                       selectedTx.category === 'Internal' ? 'Transaction Type' :
                       selectedTx.type === 'transfer_in' || selectedTx.type === 'request_fulfilled' ? 'Received From' : 
                       'Paid To'}
                    </span>
                    <span className="font-semibold text-black flex items-center gap-1.5">
                      {selectedTx.title} 
                      {selectedTx.type !== 'request_create' && selectedTx.type !== 'request_expired' && selectedTx.category !== 'Internal' && <Share2 size={14} className="text-gray-400" />}
                    </span>
                 </div>

                 {/* 跨币种交易时，展示预言机汇率 */}
                 {selectedTx.currencyFiat !== 'USD' && selectedTx.amountUSDC !== 0 && selectedTx.amountFiat !== 0 && (
                    <div className="flex justify-between items-center text-[14px]">
                       <span className="text-gray-500 font-medium">Exchange Rate</span>
                       <span className="font-semibold text-black">
                         1 USDC ≈ {Math.abs(selectedTx.amountFiat / selectedTx.amountUSDC).toFixed(2)} {selectedTx.currencyFiat}
                       </span>
                    </div>
                 )}
                 
                 {/* V1.2 Gas 与影子燃料风控展示 */}
                 <div className="flex justify-between items-center text-[14px]">
                    <span className="text-gray-500 font-medium">Network Gas</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded text-[12px]">Sponsored</span>
                      {selectedTx.fees && selectedTx.fees.gasBUnits > 0 && (
                         <span className="font-bold text-gray-400 flex items-center gap-1 text-[13px]">
                           <Fuel size={12} className="fill-current" /> -{selectedTx.fees.gasBUnits}
                         </span>
                      )}
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-center text-[14px]">
                    <span className="text-gray-500 font-medium">Beamio Fee</span>
                    {selectedTx.fees && selectedTx.fees.bUnits > 0 ? (
                       <span className={`font-bold px-2 py-0.5 rounded text-[12px] flex items-center gap-1 ${
                         selectedTx.type === 'request_expired' 
                           ? 'text-gray-400 bg-gray-200 decoration-gray-400 line-through' 
                           : 'text-[#FF9500] bg-[#FF9500]/10'
                       }`}>
                         <Fuel size={12} className="fill-current" /> {selectedTx.fees.bUnits} B-Units
                       </span>
                    ) : selectedTx.fees && selectedTx.fees.service > 0 ? (
                       <span className="font-semibold text-black">${selectedTx.fees.service.toFixed(2)}</span>
                    ) : (
                       <span className="font-semibold text-black">$0.00</span>
                    )}
                 </div>
              </div>

              {/* Proofs */}
              <div className="space-y-3 mb-8">
                 <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-2">
                   {selectedTx.hashes.base ? 'Settlement Proof' : 'Creation Proof'}
                 </h4>
                 
                 {/* 核心架构更新：动态渲染单笔或多笔 Base L2 Hash */}
                 {Array.isArray(selectedTx.hashes.base) ? (
                    selectedTx.hashes.base.map((hash: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-[16px] shadow-sm active:bg-gray-50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 bg-[#1562f0] rounded-full shadow-[0_0_8px_rgba(21,98,240,0.5)]"></div>
                            <span className="text-[13px] font-semibold text-gray-700">Base L2 (Part {index + 1})</span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] font-mono text-[#1562f0]">
                            {hash.substring(0, 10)}... <Copy size={12} />
                          </div>
                      </div>
                    ))
                 ) : selectedTx.hashes.base ? (
                    <div className="flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-[16px] shadow-sm active:bg-gray-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 bg-[#1562f0] rounded-full shadow-[0_0_8px_rgba(21,98,240,0.5)]"></div>
                          <span className="text-[13px] font-semibold text-gray-700">Base L2 (Value)</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] font-mono text-[#1562f0]">
                          {selectedTx.hashes.base.substring(0, 10)}... <Copy size={12} />
                        </div>
                    </div>
                 ) : (
                    <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-[16px] border-dashed opacity-70">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                          <span className="text-[13px] font-semibold text-gray-500">Base L2 (Pending)</span>
                        </div>
                        <span className="text-[11px] font-medium text-gray-400">Awaiting Payment</span>
                    </div>
                 )}
                 
                 {selectedTx.hashes.conet && (
                   <div className="flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-[16px] shadow-sm active:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2.5">
                         <div className="w-2.5 h-2.5 bg-[#AF52DE] rounded-full shadow-[0_0_8px_rgba(175,82,222,0.5)]"></div>
                         <span className="text-[13px] font-semibold text-gray-700">CoNET L1 (Data)</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] font-mono text-[#AF52DE]">
                         {selectedTx.hashes.conet.substring(0, 10)}... <Copy size={12} />
                      </div>
                   </div>
                 )}
              </div>

              {/* JSON Toggle */}
              <div>
                 <button onClick={() => setShowJson(!showJson)} className="w-full py-3 border border-gray-200 text-gray-500 rounded-[16px] text-[13px] font-semibold flex items-center justify-center gap-2 active:bg-gray-50 transition-colors">
                   <Code size={16} /> {showJson ? 'Hide Raw Data' : 'View Smart Receipt'}
                 </button>
                 {showJson && (
                   <VscodeJsonBlock className="mt-4" data={selectedTx} />
                 )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

