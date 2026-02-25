import React, { useState } from 'react';
import {
 ArrowUpRight,
 ArrowDownLeft,
 CreditCard,
 Search,
 ChevronLeft,
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
 ArrowRightLeft,
 Loader2,
 Route
} from 'lucide-react';

/** 路由项：资产、金额、类型、来源 */
type RouteItem = { asset: string; amount: number; type: string; symbol: string; source?: string };
/** 交易元数据 */
type TxMeta = { requestAmount?: number; expiresAt?: string; via?: string; originalRequestId?: string };
/** 交易类型 */
type Transaction = {
  id: string;
  type: string;
  title: string;
  handle: string;
  timestamp: string;
  amountFiat: number;
  currencyFiat: string;
  amountUSDC: number;
  status: string;
  category: string;
  accountType: string;
  isMixed: boolean;
  route: RouteItem[];
  fees: { gas: number; service: number; bUnits: number; gasBUnits: number };
  hashes: { base: string | string[] | null; conet: string | null };
  meta?: TxMeta;
};
/** 账本条目 */
type LedgerEntry = { tx: Transaction; id: string; title: string; amountPrimary: string; amountSecondary: string | null; isPositive: boolean };

/**
* Beamio Transactions Module
* Architecture Version: V6.0 | B-Units Taxonomy V3.0
* * 核心逻辑校验:
* - 蓝色 (EOA): Main Wallet
* - 紫色 (AA): Express Pay
* - 智能子账本引擎: 支持混合支付 (Mixed) 在不同 Tab 下的动态拆行与法币精准折算。
*/
const TRANSACTIONS = [
 {
   id: 'tx_017',
   type: 'receive_static_aa',
   title: 'Paid by Frank',
   handle: '@frank_aa',
   timestamp: 'Just now',
   amountFiat: 100.00,
   currencyFiat: 'USD',
   amountUSDC: 100.00,
   status: 'Finalized',
   category: 'Income',
   accountType: 'AA',
   isMixed: true,
   route: [
     { asset: '$FRANK_PTS', amount: 20.00, type: 'Voucher', symbol: 'pts', source: "" },
     { asset: 'USDC', amount: 80.00, type: 'Cash', symbol: '$', source: "Express Pay (AA)" }
   ],
   fees: { gas: 0, service: 0, bUnits: 80, gasBUnits: 0 },
   hashes: { base: '0x123...456', conet: '0xabc...def' },
   meta: { via: 'Static QR' }
 },
 {
   id: 'tx_014',
   type: 'request_create',
   title: 'Dinner Split QR',
   handle: 'Link Shared',
   timestamp: '2 mins ago',
   amountFiat: 0,
   currencyFiat: 'USD',
   amountUSDC: 0,
   status: 'Waiting',
   category: 'Tools',
   accountType: 'AA',
   isMixed: false,
   route: [],
   fees: { gas: 0, service: 0, bUnits: 64, gasBUnits: 0 },
   hashes: { base: null, conet: '0xabc...def0' },
   meta: { requestAmount: 80.00, expiresAt: 'Feb 24, 2026, 02:15 PM' }
 },
 {
   id: 'tx_007',
   type: 'request_create',
   title: 'Payment QR',
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
   fees: { gas: 0, service: 0, bUnits: 40, gasBUnits: 0 },
   hashes: { base: null, conet: '0x9a8...b7c6' },
   meta: { requestAmount: 50.00, expiresAt: 'Feb 24, 2026, 10:23 AM' }
 },
 {
   id: 'tx_018',
   type: 'request_canceled',
   title: 'Request Canceled',
   handle: 'Manually Canceled',
   timestamp: '45 mins ago',
   amountFiat: 0,
   currencyFiat: 'USD',
   amountUSDC: 0,
   status: 'Canceled',
   category: 'Tools',
   accountType: 'AA',
   isMixed: false,
   route: [],
   fees: { gas: 0, service: 0, bUnits: 24, gasBUnits: 0 },
   hashes: { base: null, conet: '0xdef...b7c6' },
   meta: { requestAmount: 30.00, expiresAt: 'Feb 23, 2026, 07:29 PM' }
 },
 {
   id: 'tx_012',
   type: 'smart_pay',
   title: 'Paid to Charlie',
   handle: '@charlie_aa',
   timestamp: '1 hr ago',
   amountFiat: -50.00,
   currencyFiat: 'USD',
   amountUSDC: -40.00,
   status: 'Finalized',
   category: 'P2P Transfer',
   accountType: 'AA',
   isMixed: true,
   route: [
     { asset: '$COFFEE', amount: 10.00, type: 'Voucher', symbol: 'pts', source: "" },
     { asset: 'USDC', amount: 15.00, type: 'Cash', symbol: '$', source: 'Express Pay (AA)' },
     { asset: 'USDC', amount: 25.00, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: ['0x9c2...d3e4', '0x1a8...f9b2'], conet: '0x5f6...a1b2' },
   meta: { via: 'Smart Route' }
 },
 {
   id: 'tx_015',
   type: 'smart_pay',
   title: 'Paid to David',
   handle: '@david_aa',
   timestamp: '1.5 hrs ago',
   amountFiat: -40.00,
   currencyFiat: 'USD',
   amountUSDC: -40.00,
   status: 'Finalized',
   category: 'P2P Transfer',
   accountType: 'AA',
   isMixed: true,
   route: [
     { asset: 'USDC', amount: 10.00, type: 'Cash', symbol: '$', source: 'Express Pay (AA)' },
     { asset: 'USDC', amount: 30.00, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: ['0x3b4...e5f6', '0x7c8...a9b0'], conet: '0x1d2...e3f4' },
   meta: { via: 'Smart Route' }
 },
 {
   id: 'tx_016',
   type: 'smart_pay',
   title: 'Paid to Emma',
   handle: '@emma_aa',
   timestamp: '1.8 hrs ago',
   amountFiat: -25.00,
   currencyFiat: 'USD',
   amountUSDC: -25.00,
   status: 'Finalized',
   category: 'P2P Transfer',
   accountType: 'AA',
   isMixed: true,
   route: [
     { asset: 'USDC', amount: 25.00, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: '0x4f5...g6h7', conet: '0x8i9...j0k1' },
   meta: { via: 'Smart Route' }
 },
 {
   id: 'tx_013',
   type: 'transfer_out',
   title: 'Sent to Dave',
   handle: '@dave_classic',
   timestamp: '2 hrs ago',
   amountFiat: -15.00,
   currencyFiat: 'USD',
   amountUSDC: -15.00,
   status: 'Finalized',
   category: 'P2P Transfer',
   accountType: 'EOA',
   isMixed: false,
   route: [
     { asset: 'USDC', amount: 15.00, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 2 },
   hashes: { base: '0xdef...5678', conet: '0x9ab...cdef' },
   meta: { via: 'QR Link' }
 },
 {
   id: 'tx_008',
   type: 'request_fulfilled',
   title: 'Request Fulfilled',
   handle: '@bob_builder',
   timestamp: 'Today, 2:15 PM',
   amountFiat: 50.00,
   currencyFiat: 'USD',
   amountUSDC: 50.00,
   status: 'Finalized',
   category: 'Tools',
   accountType: 'AA',
   isMixed: true,
   route: [
      { asset: '$BUILD_COIN', amount: 15.00, type: 'Voucher', symbol: 'pts', source: "" },
      { asset: 'USDC', amount: 35.00, type: 'Cash', symbol: '$', source: "Express Pay (AA)" }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: '0x2f4...d5e6', conet: '0x9a8...b7c6' },
   meta: { originalRequestId: 'req_101' }
 },
 {
   id: 'tx_001',
   type: 'smart_pay',
   title: 'Paid to Starbucks',
   handle: '@starbucks_van',
   timestamp: 'Today, 10:23 AM',
   amountFiat: -12.50,
   currencyFiat: 'CAD',
   amountUSDC: -6.7525,
   status: 'Finalized',
   category: 'Food & Drink',
   accountType: 'AA',
   isMixed: true,
   route: [
     { asset: '$CCSA', amount: 3.25, type: 'Voucher', symbol: 'pts', source: "" },
     { asset: 'USDC', amount: 6.7525, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: '0x8f2...a9b1', conet: '0x1d4...e3f9' },
   meta: { via: 'QR Link' }
 },
 {
   id: 'tx_011',
   type: 'reload_card',
   title: 'Reload CCSA Card',
   handle: '@ccsa_alliance',
   timestamp: 'Today, 10:00 AM',
   amountFiat: 100.00,
   currencyFiat: 'CAD',
   amountUSDC: -73.00,
   status: 'Finalized',
   category: 'Store Credit',
   accountType: 'AA',
   isMixed: true,
   route: [
     { asset: '$CCSA', amount: 100.00, type: 'Voucher', symbol: 'pts', source: "" },
     { asset: 'USDC', amount: 73.00, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: '0x5d6...e7f8', conet: '0x1v2...w3x4' }
 },
 {
   id: 'tx_019',
   type: 'reload_card',
   title: 'Reload Starbucks Card',
   handle: '@starbucks_van',
   timestamp: 'Yesterday, 8:15 AM',
   amountFiat: 50.00,
   currencyFiat: 'CAD',
   amountUSDC: -36.50,
   status: 'Finalized',
   category: 'Store Credit',
   accountType: 'AA',
   isMixed: true,
   route: [
     { asset: '$SBUX', amount: 50.00, type: 'Voucher', symbol: 'pts', source: "" },
     { asset: 'USDC', amount: 36.50, type: 'Cash', symbol: '$', source: 'Main Wallet (EOA)' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: '0x9a8...b7c6', conet: '0x1d4...e3f9' }
 },
 {
   id: 'tx_010',
   type: 'internal_transfer',
   title: 'Express Pay → Main Wallet',
   handle: 'Internal Transfer',
   timestamp: 'Today, 9:30 AM',
   amountFiat: 20.00,
   currencyFiat: 'USD',
   amountUSDC: 20.00,
   status: 'Finalized',
   category: 'Internal',
   accountType: 'Internal',
   isMixed: false,
   route: [
     { asset: 'USDC', amount: 20.00, type: 'Cash', symbol: '$', source: 'Express Pay -> Main' }
   ],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
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
   title: 'Main Wallet → Express Pay',
   handle: 'Internal Transfer',
   timestamp: 'Yesterday, 2:00 PM',
   amountFiat: 100.00,
   currencyFiat: 'USD',
   amountUSDC: 100.00,
   status: 'Finalized',
   category: 'Internal',
   accountType: 'Internal',
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
   fees: { gas: 0, service: 0, bUnits: 16, gasBUnits: 0 },
   hashes: { base: null, conet: '0x3c2...a1b0' },
   meta: { requestAmount: 20.00, expiresAt: 'Feb 21, 2026, 09:00 AM' }
 },
 {
   id: 'tx_004',
   type: 'voucher_burn',
   title: 'VIP Lounge Access',
   handle: '@yvr_lounge',
   timestamp: 'Jan 28, 8:30 PM',
   amountFiat: 0,
   currencyFiat: 'CAD',
   amountUSDC: 0,
   status: 'Redeemed',
   category: 'Ticket',
   accountType: 'AA',
   isMixed: false,
   route: [{ asset: 'Lounge Pass #402', amount: 1, type: 'NFT', symbol: '#' }],
   fees: { gas: 0, service: 0, bUnits: 0, gasBUnits: 0 },
   hashes: { base: '0x5f6...g7h8', conet: '0x2a3...b4c5' }
 }
];


export default function BeamioTransactions({ initialTab = 'All' }: { initialTab?: string }) {
 const [activeTab, setActiveTab] = useState(initialTab);
 const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
 const [showJson, setShowJson] = useState(false);


 // 格式化金额工具 (完全剥离 $)
 const formatCurrency = (amount: number, currency: string) => {
   const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
   return `${sign}${Math.abs(amount).toFixed(2)} ${currency}`;
 };


 // 内部互转金额翻转引擎 (名字由箭头固化，仅保留金额极性的上下文翻转)
 const getDisplayAmount = (tx: Transaction, tab: string) => {
   if (tx.accountType !== 'Internal') return tx.amountFiat;
   if (tx.type === 'fund_express_pay') return tab === 'Express' ? Math.abs(tx.amountFiat) : -Math.abs(tx.amountFiat);
   if (tx.type === 'internal_transfer') return tab === 'Express' ? -Math.abs(tx.amountFiat) : Math.abs(tx.amountFiat);
   return tx.amountFiat;
 };


 // 详情页底部聚合结算引擎
 const getSettledString = (tx: Transaction) => {
   if (!tx.route || tx.route.length === 0) {
      return tx.amountUSDC !== 0 ? `${Math.abs(tx.amountUSDC).toFixed(2)} USDC` : null;
   }
  
   if (tx.type === 'reload_card') {
      const v = tx.route.find((r: RouteItem) => r.type === 'Voucher');
      const c = tx.route.find((r: RouteItem) => r.type === 'Cash');
      if (v && c) return `${c.amount.toFixed(2)} ${c.asset} → ${v.amount.toFixed(2)} ${v.asset}`;
   }


   const assetsMap: Record<string, number> = {};
   tx.route.forEach((r: RouteItem) => {
      assetsMap[r.asset] = (assetsMap[r.asset] || 0) + r.amount;
   });
   return Object.entries(assetsMap).map(([asset, amt]: [string, number]) => {
      if (asset.includes('#')) return `${amt} ${asset}`;
      const formattedAmt = Number.isInteger(amt * 100) ? amt.toFixed(2) : amt.toFixed(4);
      return `${formattedAmt} ${asset}`;
   }).join(' + ');
 };


 // 动态预言机汇率引擎
 const renderExchangeRate = (tx: Transaction) => {
   if (tx.amountFiat === 0 || tx.amountUSDC === 0 || tx.type === 'request_create' || tx.type === 'request_expired' || tx.type === 'request_canceled') return null;
  
   let usdcRate = 1;
   const voucherRoute = tx.route?.find((r: RouteItem) => r.type === 'Voucher');
  
   if (tx.type === 'reload_card') {
      usdcRate = Math.abs(tx.amountUSDC) / Math.abs(tx.amountFiat);
   } else if (tx.route && tx.route.length > 0) {
     const totalVoucherFiat = tx.route.filter((x: RouteItem) => x.type === 'Voucher').reduce((acc: number, x: RouteItem) => acc + x.amount, 0);
     const remainingFiat = Math.abs(tx.amountFiat) - totalVoucherFiat;
     const totalCashRoute = tx.route.filter((x: RouteItem) => x.type === 'Cash').reduce((acc: number, x: RouteItem) => acc + x.amount, 0);
    
     if (remainingFiat > 0 && totalCashRoute > 0) {
       usdcRate = totalCashRoute / remainingFiat;
     } else if (remainingFiat === 0) {
       usdcRate = 1;
     } else {
        usdcRate = Math.abs(tx.amountUSDC) / Math.abs(tx.amountFiat);
     }
   } else {
     usdcRate = Math.abs(tx.amountUSDC) / Math.abs(tx.amountFiat);
   }
  
   const isUsd = tx.currencyFiat === 'USD';
  
   const usdcText = isUsd && usdcRate === 1
     ? `1 ${tx.currencyFiat} = 1.00 USDC`
     : `1 ${tx.currencyFiat} ≈ ${usdcRate.toFixed(2)} USDC`;


   return (
     <div className="flex justify-between items-start text-[14px]">
        <span className="text-gray-500 font-medium pt-0.5">Exchange Rate</span>
        <div className="flex flex-col items-end gap-1">
          {voucherRoute && (
            <span className="font-semibold text-black">1 {tx.currencyFiat} = 1 {voucherRoute.asset}</span>
          )}
          <span className="font-semibold text-black">{usdcText}</span>
        </div>
     </div>
   );
 };


 // 核心革命：智能子账本投影引擎与法币精准折算
 const ledgerEntries: LedgerEntry[] = [];
 TRANSACTIONS.forEach((tx) => {
   // 1. 内部互转
   if (tx.accountType === 'Internal') {
     if (activeTab === 'All' || activeTab === 'Cash' || activeTab === 'Express') {
       const displayFiat = getDisplayAmount(tx, activeTab);
       ledgerEntries.push({
         tx,
         id: tx.id,
         title: tx.title,
         amountPrimary: formatCurrency(displayFiat, tx.currencyFiat),
         amountSecondary: `${Math.abs(displayFiat).toFixed(2)} USDC`,
         isPositive: displayFiat > 0
       });
     }
     return;
   }


   // 2. All 标签页 (宏观上帝视角)
   if (activeTab === 'All') {
     let amtPrimary: string;
     if (tx.type === 'request_create' || tx.type === 'request_expired' || tx.type === 'request_canceled') {
        amtPrimary = `${(tx.meta?.requestAmount ?? 0).toFixed(2)} ${tx.currencyFiat}`;
     }
     else if (tx.type === 'reload_card') amtPrimary = formatCurrency(-Math.abs(tx.amountFiat), tx.currencyFiat);
     else amtPrimary = formatCurrency(tx.amountFiat, tx.currencyFiat);


     ledgerEntries.push({
       tx,
       id: tx.id,
       title: tx.title,
       amountPrimary: amtPrimary,
       amountSecondary: (tx.amountUSDC !== 0 && tx.type !== 'request_create' && tx.type !== 'request_expired' && tx.type !== 'request_canceled')
         ? `${Math.abs(tx.amountUSDC).toFixed(2)} USDC` : null,
       isPositive: tx.amountFiat > 0
     });
     return;
   }


   // 3. 非混合支付
   if (!tx.isMixed || !tx.route || tx.route.length === 0) {
     if ((activeTab === 'Cash' && tx.accountType === 'EOA') ||
         (activeTab === 'Express' && tx.accountType === 'AA')) {
       let amtPrimary: string;
       if (tx.type === 'request_create' || tx.type === 'request_expired' || tx.type === 'request_canceled') {
          amtPrimary = `${(tx.meta?.requestAmount ?? 0).toFixed(2)} ${tx.currencyFiat}`;
       }
       else amtPrimary = formatCurrency(tx.amountFiat, tx.currencyFiat);


       ledgerEntries.push({
         tx,
         id: tx.id,
         title: tx.title,
         amountPrimary: amtPrimary,
         amountSecondary: (tx.amountUSDC !== 0 && tx.type !== 'request_create' && tx.type !== 'request_expired' && tx.type !== 'request_canceled')
           ? `${Math.abs(tx.amountUSDC).toFixed(2)} USDC` : null,
         isPositive: tx.amountFiat > 0
       });
     }
     return;
   }


   // 4. 混合支付：动态拆分子账本并精确折算法币
   const isOutgoing = tx.amountUSDC < 0 || tx.amountFiat < 0;
   const totalVoucherFiat = tx.route.filter((x: RouteItem) => x.type === 'Voucher').reduce((acc: number, x: RouteItem) => acc + x.amount, 0);
   const totalCashFiat = Math.abs(tx.amountFiat) - totalVoucherFiat;
   const totalCashRoute = tx.route.filter((x: RouteItem) => x.type === 'Cash').reduce((acc: number, x: RouteItem) => acc + x.amount, 0);


   tx.route.forEach((r: RouteItem, idx: number) => {
     const isMainWallet = (r.source ?? '').includes('Main Wallet');
     let belongsToTab = false;
     let isPos = false;
     let fiatValue = 0;


     if (tx.type === 'reload_card') {
       if (activeTab === 'Cash') belongsToTab = isMainWallet;
       else if (activeTab === 'Express') belongsToTab = !isMainWallet;
      
       isPos = !isMainWallet;
       fiatValue = r.type === 'Voucher' ? r.amount : r.amount * (Math.abs(tx.amountFiat) / Math.abs(tx.amountUSDC));
     } else {
       if (activeTab === 'Cash') {
         belongsToTab = isMainWallet;
       } else if (activeTab === 'Express') {
         if (isOutgoing) belongsToTab = !isMainWallet;
         else belongsToTab = true;
       }
       isPos = !isOutgoing;
       if (r.type === 'Voucher') {
         fiatValue = r.amount;
       } else {
         if (totalCashRoute > 0) fiatValue = r.amount * (totalCashFiat / totalCashRoute);
         else fiatValue = r.amount;
       }
     }


     if (belongsToTab) {
       const displayFiat = isPos ? fiatValue : -fiatValue;
       const formattedAssetAmt = Number.isInteger(r.amount * 100) ? r.amount.toFixed(2) : r.amount.toFixed(4);
       const assetStr = `${r.asset.includes('#') ? r.amount : formattedAssetAmt} ${r.asset}`;
      
       ledgerEntries.push({
         tx,
         id: `${tx.id}_sub_${idx}`,
         title: tx.title,
         amountPrimary: formatCurrency(displayFiat, tx.currencyFiat),
         amountSecondary: assetStr,
         isPositive: isPos
       });
     }
   });
 });


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
           {['All', 'Cash', 'Express'].map((tab) => (
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
              {activeTab === 'Express' && <Wallet size={12} className="text-[#AF52DE]" />}
              <span className="text-[11px] font-medium text-gray-500">
                {activeTab === 'Cash' ? 'Main Wallet (EOA)' : activeTab === 'Express' ? 'Express Pay (AA)' : 'All Accounts'}
              </span>
            </div>
         </div>
       </div>


       {/* Transaction List - Rendered from Dynamic Ledger Entries */}
       <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-3 scrollbar-hide">
         {ledgerEntries.map((entry) => {
           const { tx, id, title, amountPrimary, amountSecondary, isPositive } = entry;
          
           return (
             <div
               key={id}
               onClick={() => { setShowJson(false); setSelectedTx(tx); }}
               className="relative flex items-center justify-between p-4 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all duration-200 cursor-pointer border border-gray-100/50"
             >
               <div className="flex items-center gap-4">
                 {/* Icon Container */}
                 <div className={`w-[48px] h-[48px] rounded-[14px] flex items-center justify-center shadow-sm relative overflow-hidden ${
                   tx.type === 'smart_pay' ? 'bg-[#AF52DE]/10 text-[#AF52DE]' :
                   tx.type === 'merchant_pay' ? 'bg-[#1562f0]/10 text-[#1562f0]' :
                   tx.type === 'reload_card' ? 'bg-[#AF52DE]/10 text-[#AF52DE]' :
                   tx.type === 'receive_static_aa' ? 'bg-[#34C759]/10 text-[#34C759]' :
                   tx.type === 'transfer_in' ? 'bg-[#34C759]/10 text-[#34C759]' :
                   tx.type === 'transfer_out' ? 'bg-gray-100 text-black' :
                   tx.type === 'request_create' ? 'bg-[#FF9500]/10 text-[#FF9500]' :
                   tx.type === 'request_fulfilled' ? 'bg-[#34C759]/10 text-[#34C759]' :
                   (tx.type === 'request_expired' || tx.type === 'request_canceled') ? 'bg-gray-100 text-gray-400' :
                   tx.type === 'fund_express_pay' ? 'bg-[#AF52DE]/10 text-[#AF52DE]' :
                   tx.type === 'internal_transfer' ? 'bg-[#1562f0]/10 text-[#1562f0]' :
                   'bg-[#AF52DE]/10 text-[#AF52DE]'
                 }`}>
                   {/* Icon Selection */}
                   {tx.type === 'smart_pay' && <Route size={22} strokeWidth={2} />}
                   {tx.type === 'merchant_pay' && <CreditCard size={22} strokeWidth={2} />}
                   {tx.type === 'reload_card' && <CreditCard size={22} strokeWidth={2} />}
                   {tx.type === 'receive_static_aa' && <Route size={22} strokeWidth={2} />}
                   {tx.type === 'transfer_in' && <ArrowDownLeft size={22} strokeWidth={2} />}
                   {tx.type === 'request_fulfilled' && <QrCode size={22} strokeWidth={2} />}
                   {tx.type === 'transfer_out' && <ArrowUpRight size={22} strokeWidth={2} />}
                   {tx.type === 'request_create' && (tx.status === 'Pending' ? <Loader2 size={22} strokeWidth={2} className="animate-spin" /> : <QrCode size={22} strokeWidth={2} />)}
                   {(tx.type === 'request_expired' || tx.type === 'request_canceled') && <Ban size={22} strokeWidth={2} />}
                   {tx.type === 'fund_express_pay' && <Wallet size={22} strokeWidth={2} />}
                   {tx.type === 'internal_transfer' && <Wallet size={22} strokeWidth={2} />}
                   {tx.type === 'voucher_burn' && <Ticket size={22} strokeWidth={2} />}
                 </div>


                 <div className="flex flex-col gap-0.5">
                   <h3 className={`text-[16px] font-semibold tracking-tight ${(tx.type === 'request_expired' || tx.type === 'request_canceled') ? 'text-gray-400' : 'text-black'}`}>
                     {title}
                   </h3>
                   <div className="flex items-center gap-1.5">
                     <span className="text-[13px] text-gray-500 font-medium">{tx.handle}</span>
                    
                     {/* Status Badges */}
                     {tx.isMixed && tx.route?.length > 1 && (
                       <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#FF9500]/10 rounded-md">
                         <Zap size={10} className="text-[#FF9500] fill-[#FF9500]" />
                         <span className="text-[10px] font-bold text-[#FF9500] uppercase tracking-wider">Split</span>
                       </div>
                     )}
                    
                     {tx.fees && tx.fees.bUnits > 0 && (tx.type === 'request_expired' || tx.type === 'request_canceled') && (
                        <div className="flex items-center gap-0.5 bg-gray-100 px-1.5 py-0.5 rounded-md">
                          <Fuel size={10} className="text-gray-500" />
                          <span className="text-[10px] font-bold text-gray-500">Burnt</span>
                        </div>
                     )}
                     {tx.type === 'request_create' && tx.status === 'Waiting' && (
                        <span className="text-[10px] font-semibold text-[#FF9500] bg-[#FF9500]/10 px-1.5 py-0.5 rounded-md">
                         Waiting
                       </span>
                     )}
                     {tx.type === 'request_create' && tx.status === 'Pending' && (
                        <span className="text-[10px] font-semibold text-white bg-[#1562f0] px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                         <Clock size={10} /> Pending
                       </span>
                     )}
                   </div>
                 </div>
               </div>


               <div className="text-right flex flex-col items-end">
                 <div className={`text-[16px] font-semibold tracking-tight ${
                   isPositive ? 'text-[#34C759]' :
                   (tx.type === 'request_expired' || tx.type === 'request_canceled') ? 'text-gray-400' : 'text-black'
                 }`}>
                    {tx.type === 'request_create' ? (
                      <span className={tx.status === 'Pending' ? "text-[#1562f0]" : "text-[#FF9500]"}>
                        {amountPrimary}
                      </span>
                    ) : (
                      amountPrimary
                    )}
                 </div>
                
                 {amountSecondary && (
                   <span className="text-[12px] font-medium text-gray-400">
                     {amountSecondary}
                   </span>
                 )}
               </div>
             </div>
           );
         })}
        
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
          
           {/* Sheet */}
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
                 selectedTx.type === 'smart_pay' ? 'bg-[#AF52DE] text-white shadow-purple-200' :
                 selectedTx.type === 'merchant_pay' ? 'bg-[#1562f0] text-white shadow-blue-200' :
                 selectedTx.type === 'reload_card' ? 'bg-[#AF52DE] text-white shadow-purple-200' :
                 selectedTx.type === 'receive_static_aa' ? 'bg-[#34C759] text-white shadow-green-200' :
                 selectedTx.type === 'request_fulfilled' ? 'bg-[#34C759] text-white shadow-green-200' :
                 selectedTx.type === 'transfer_in' ? 'bg-[#34C759] text-white shadow-green-200' :
                 selectedTx.type === 'transfer_out' ? 'bg-black text-white shadow-gray-300' :
                 selectedTx.type === 'request_create' && selectedTx.status === 'Waiting' ? 'bg-[#FF9500] text-white shadow-orange-200' :
                 selectedTx.type === 'request_create' && selectedTx.status === 'Pending' ? 'bg-[#1562f0] text-white shadow-blue-200' :
                 (selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled') ? 'bg-gray-200 text-gray-500' :
                 selectedTx.type === 'fund_express_pay' ? 'bg-[#AF52DE] text-white shadow-purple-200' :
                 selectedTx.type === 'internal_transfer' ? 'bg-[#1562f0] text-white shadow-blue-200' :
                 'bg-[#AF52DE] text-white'
               }`}>
                  {selectedTx.type === 'smart_pay' && <Route size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'merchant_pay' && <CreditCard size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'reload_card' && <CreditCard size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'receive_static_aa' && <Route size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'transfer_in' && <ArrowDownLeft size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'request_fulfilled' && <QrCode size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'transfer_out' && <ArrowUpRight size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'request_create' && selectedTx.status === 'Waiting' && <QrCode size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'request_create' && selectedTx.status === 'Pending' && <Loader2 size={36} strokeWidth={1.5} className="animate-spin" />}
                  {(selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled') && <Ban size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'fund_express_pay' && <Wallet size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'internal_transfer' && <Wallet size={36} strokeWidth={1.5} />}
                  {selectedTx.type === 'voucher_burn' && <Ticket size={36} strokeWidth={1.5} />}
               </div>
              
               <h2 className={`text-[28px] font-bold tracking-tight leading-tight ${(selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled') ? 'text-gray-400' : 'text-black'}`}>
                  {selectedTx.type === 'request_create' || selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled'
                    ? `Requesting ${(selectedTx.meta?.requestAmount ?? 0).toFixed(2)} ${selectedTx.currencyFiat}`
                    : selectedTx.amountFiat === 0 ? 'Redeemed'
                    : formatCurrency(selectedTx.type === 'reload_card' ? selectedTx.amountFiat : selectedTx.amountFiat, selectedTx.currencyFiat)
                  }
               </h2>


               {/* 明确展示结算的资产组合 */}
               {selectedTx.type !== 'request_create' && selectedTx.type !== 'request_expired' && selectedTx.type !== 'request_canceled' && getSettledString(selectedTx) && (
                  <div className="text-[15px] font-semibold text-[#1562f0] mt-1.5 mb-0.5">
                    Settled for {getSettledString(selectedTx)}
                  </div>
               )}


               <p className="text-[14px] font-medium text-gray-400 mt-1.5">{selectedTx.timestamp}</p>
              
               {/* Status Chip */}
               <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold mt-4 ${
                  selectedTx.status === 'Waiting' ? 'bg-[#FF9500]/10 text-[#FF9500]' :
                  selectedTx.status === 'Pending' ? 'bg-[#1562f0]/10 text-[#1562f0]' :
                  (selectedTx.status === 'Expired' || selectedTx.status === 'Canceled') ? 'bg-gray-100 text-gray-500' :
                  'bg-[#34C759]/10 text-[#34C759]'
               }`}>
                  {selectedTx.status === 'Waiting' ? <Clock size={14} /> :
                   selectedTx.status === 'Pending' ? <Loader2 size={14} className="animate-spin" /> :
                   (selectedTx.status === 'Expired' || selectedTx.status === 'Canceled') ? <Ban size={14} /> :
                   <CheckCircle2 size={14} />}
                  {selectedTx.status}
               </div>
             </div>


             {/* Action Area - 仅对具有操作生命周期的请求类型展示，常规交易彻底隐藏 */}
             {(selectedTx.type === 'request_create' || selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled') && (
               <div className="space-y-4 mb-8">
                 {selectedTx.type === 'request_create' ? (
                    <>
                       <div className={`rounded-[20px] p-5 text-center border ${selectedTx.status === 'Pending' ? 'bg-[#1562f0]/5 border-[#1562f0]/20' : 'bg-[#FF9500]/5 border-[#FF9500]/20'}`}>
                           <p className={`text-[15px] font-medium mb-4 ${selectedTx.status === 'Pending' ? 'text-[#1562f0]' : 'text-[#FF9500]'}`}>
                             {selectedTx.status === 'Pending' ? 'Order locked. Someone is reviewing the checkout...' : 'Code is active. Waiting for payment.'}
                           </p>
                           <button disabled={selectedTx.status === 'Pending'} className={`w-full py-3.5 bg-white border rounded-[14px] font-bold text-[15px] flex items-center justify-center gap-2 shadow-sm transition-transform ${selectedTx.status === 'Pending' ? 'text-gray-400 border-gray-200 opacity-50' : 'text-[#FF9500] border-[#FF9500]/30 active:scale-95'}`}>
                             <Share2 size={18} /> {selectedTx.status === 'Pending' ? 'Locked' : 'Share Again'}
                           </button>
                       </div>
                       <button disabled={selectedTx.status === 'Pending'} className={`w-full py-3.5 font-semibold text-[15px] rounded-[14px] transition-colors ${selectedTx.status === 'Pending' ? 'text-gray-300' : 'text-red-500 active:bg-red-50'}`}>
                          Cancel Request (Fuel not refundable)
                       </button>
                    </>
                 ) : (
                    <div className="bg-gray-50 rounded-[20px] p-6 text-center border border-gray-100">
                       <p className="text-[15px] text-gray-500 font-medium">
                         {selectedTx.type === 'request_canceled' ? 'This request was canceled by you.' : 'This request has expired.'}
                       </p>
                       <button className="mt-4 w-full py-3 bg-white border border-gray-200 text-black rounded-[14px] font-semibold text-[15px] shadow-sm active:scale-95 transition-transform">
                          Create New (-{selectedTx.fees?.bUnits || 0} B-Units)
                       </button>
                    </div>
                 )}
               </div>
             )}


             {/* Mixed Payment Visualization */}
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
                   {/* UI 自动循环渲染任意级数的路由，并根据资金流向（正负数）动态显示颜色 */}
                   {selectedTx.route.map((item: RouteItem, index: number) => (
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
                              {item.type}{item.source ? ` • ${item.source}` : ''}
                            </span>
                          </div>
                       </div>
                       <span className={`text-[15px] font-semibold ${
                         (selectedTx.type === 'reload_card' ? item.type === 'Voucher' : selectedTx.amountUSDC > 0) ? 'text-[#34C759]' : 'text-black'
                       }`}>
                         {(() => {
                            let isItemPos = selectedTx.amountUSDC > 0;
                            if (selectedTx.type === 'reload_card') isItemPos = item.type === 'Voucher';
                            return `${isItemPos ? '+' : '-'}${Number.isInteger(item.amount * 100) ? item.amount.toFixed(2) : item.amount.toFixed(4)}`;
                         })()}
                       </span>
                     </div>
                   ))}
                 </div>
               </div>
             )}


             {/* Data Rows */}
             <div className="bg-[#F9FAFB] rounded-[24px] p-5 space-y-4 mb-8">
                <div className="flex justify-between items-center text-[14px]">
                   <span className="text-gray-500 font-medium">
                     {(selectedTx.type === 'request_create' || selectedTx.type === 'request_canceled' || selectedTx.type === 'request_expired') ? 'Request Title' :
                      selectedTx.category === 'Internal' ? 'Transaction Type' :
                      (selectedTx.type === 'receive_static_aa' || selectedTx.type === 'request_fulfilled') ? 'Paid By' :
                      selectedTx.type === 'transfer_in' ? 'Received From' :
                      selectedTx.type === 'transfer_out' && selectedTx.accountType === 'EOA' ? 'Sent To' :
                      'Paid To'}
                   </span>
                  
                   <div className="flex items-center gap-2">
                      <span className="font-semibold text-black flex items-center gap-1.5">
                        {/* 🔥 直接显示固化的标题，或者 @Tag */}
                        {selectedTx.category === 'Internal' ? selectedTx.title :
                         (selectedTx.type === 'request_create' || selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled') ? selectedTx.title :
                         selectedTx.handle}
                        {selectedTx.type !== 'request_create' && selectedTx.type !== 'request_expired' && selectedTx.type !== 'request_canceled' && selectedTx.category !== 'Internal' && <Share2 size={14} className="text-gray-400" />}
                      </span>
                     
                      {/* 🔥 内联 Chat 按钮：仅当存在 @Tag 时浮现在其右侧 */}
                      {selectedTx.handle?.startsWith('@') && (
                         <button className="w-[28px] h-[28px] bg-gray-200/60 text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-300 active:scale-95 transition-all ml-1 shadow-sm">
                           <MessageCircle size={14} />
                         </button>
                      )}
                   </div>
                </div>


                {/* 🔥 引入 Expires 字段，展示精准的过期时间点 */}
                {(selectedTx.type === 'request_create' || selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled') && selectedTx.meta?.expiresAt && (
                   <div className="flex justify-between items-center text-[14px]">
                      <span className="text-gray-500 font-medium">Expires</span>
                      <span className="font-semibold text-black">{selectedTx.meta?.expiresAt}</span>
                   </div>
                )}


                {renderExchangeRate(selectedTx)}
               
                <div className="flex justify-between items-center text-[14px]">
                   <span className="text-gray-500 font-medium">Network Gas</span>
                   <div className="flex items-center gap-2">
                     {selectedTx.type === 'reload_card' || selectedTx.type === 'voucher_burn' ? (
                        <span className="font-bold text-[#AF52DE] bg-[#AF52DE]/10 px-2 py-0.5 rounded text-[12px]">Issuer Paid</span>
                     ) : selectedTx.fees && selectedTx.fees.gasBUnits === 0 && selectedTx.fees.bUnits >= 2 ? (
                        <span className="font-bold text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded text-[12px]">Waived</span>
                     ) : (
                        <span className="font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-[12px] flex items-center gap-1">
                          <Fuel size={12} className="fill-current text-gray-400" /> {selectedTx.fees?.gasBUnits || 0} B-Units
                        </span>
                     )}
                   </div>
                </div>
               
                <div className="flex justify-between items-center text-[14px]">
                   <span className="text-gray-500 font-medium">Beamio Fee</span>
                   {selectedTx.type === 'request_fulfilled' ? (
                      <span className="font-bold text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded text-[12px]">Pre-paid (Fuel)</span>
                   ) : selectedTx.fees && selectedTx.fees.bUnits > 0 ? (
                      <span className={`font-bold px-2 py-0.5 rounded text-[12px] flex items-center gap-1 ${
                        (selectedTx.type === 'request_expired' || selectedTx.type === 'request_canceled')
                          ? 'text-gray-400 bg-gray-200 decoration-gray-400 line-through'
                          : 'text-[#FF9500] bg-[#FF9500]/10'
                      }`}>
                        <Fuel size={12} className="fill-current" /> {selectedTx.fees.bUnits} B-Units
                      </span>
                   ) : selectedTx.type === 'reload_card' ? (
                      <span className="font-bold text-[#AF52DE] bg-[#AF52DE]/10 px-2 py-0.5 rounded text-[12px]">Covered by Issuer</span>
                   ) : (
                      <span className="font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-[12px] flex items-center gap-1">
                        <Fuel size={12} className="fill-current text-gray-400" /> 0 B-Units
                      </span>
                   )}
                </div>
             </div>


             {/* Proofs */}
             <div className="space-y-3 mb-8">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-2">
                  {selectedTx.hashes.base ? 'Settlement Proof' : 'Creation Proof'}
                </h4>
               
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
                         <span className="text-[13px] font-semibold text-gray-500">
                            {(selectedTx.status === 'Pending' || selectedTx.status === 'Canceled') ? 'Base L2 (Locked)' : 'Base L2 (Pending)'}
                         </span>
                       </div>
                       <span className="text-[11px] font-medium text-gray-400">
                          {selectedTx.status === 'Pending' ? 'Checkout in progress' : selectedTx.status === 'Canceled' ? 'Request Withdrawn' : 'Awaiting Payment'}
                       </span>
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
                  <div className="mt-4 bg-[#1C1C1E] rounded-[16px] p-5 overflow-x-auto shadow-inner">
                    <pre className="text-[11px] text-[#34C759] font-mono leading-relaxed">
                      {JSON.stringify(selectedTx, null, 2)}
                    </pre>
                  </div>
                )}
             </div>


           </div>
         </div>
       )}
     </div>
   </div>
 );
}

