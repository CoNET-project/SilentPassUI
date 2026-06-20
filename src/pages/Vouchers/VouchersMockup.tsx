import React, { useMemo, useState } from "react"
import { tu } from '@/locale/beamioLocale'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Megaphone,
  Info,
  PlayCircle,
  Store,
  MapPin,
  Dices,
  Gift,
  Check,
  X,
  ChevronLeft,
  Loader2,
  Sparkles,
  DollarSign,
  Plus,
  Send,
  MoreHorizontal,
  Tag,
  Trophy // Added Trophy icon
} from "lucide-react"

// --- 1. Data Structures & Types ---

type Message = {
  id: number
  type: "text" | "payment" | "reward" | "request"
  content?: string
  amount?: string
  status?: string
  note?: string
  sender?: "me" | "them"
  time: string
}

type Chat = {
  id: string
  name: string
  avatar: string
  bg: string
  verified: boolean
  lastMessage: string
  time: string
  unread: number
  type: "merchant" | "person"
  messages: Message[]
}

type Merchant = {
  id: number
  type: "cashback" | "loyalty" | "luck"
  chatId: string
  name: string
  handle: string
  category: string
  promo: string
  bgImage: string
  coverImage: string
  logo: string
  distance: string
  stamps?: number
  followers: string
  desc: string
}

const INITIAL_CHATS: Chat[] = [
  {
    id: 'daily_grind',
    name: 'Daily Grind Cafe',
    avatar: '☕️',
    bg: 'bg-orange-100',
    verified: true,
    lastMessage: 'See you tomorrow! 🥐',
    time: '9:45 AM',
    unread: 0,
    type: 'merchant',
    messages: [
      { id: 1, type: 'text', content: 'Thanks for visiting us today!', sender: 'them', time: '9:42 AM' },
      { id: 2, type: 'payment', amount: '-4.50', status: 'completed', note: 'Morning Coffee', sender: 'me', time: '9:41 AM' }
    ]
  },
  {
    id: 'burger_king',
    name: 'Burger King',
    avatar: '🍔',
    bg: 'bg-red-100',
    verified: true,
    lastMessage: 'Your order is ready!',
    time: 'Mon',
    unread: 0,
    type: 'merchant',
    messages: []
  },
  {
    id: 'neon_bar',
    name: 'Neon Bar',
    avatar: '🍸',
    bg: 'bg-purple-100',
    verified: true,
    lastMessage: 'Happy Hour starts at 5pm!',
    time: 'Fri',
    unread: 0,
    type: 'merchant',
    messages: []
  }
]

const FEATURED_MERCHANTS: Merchant[] = [
  {
    id: 1,
    type: "cashback",
    chatId: "daily_grind",
    name: "Daily Grind Cafe",
    handle: "@dailygrind",
    category: "Food & Drink",
    promo: "20% Cashback",
    bgImage: "bg-orange-100",
    coverImage: "bg-gradient-to-r from-orange-400 to-red-500",
    logo: "☕️",
    distance: "0.8 km",
    followers: "1.2k",
    desc: "Best coffee in town. Serving since 2018."
  },
  {
    id: 2,
    type: "loyalty",
    chatId: "burger_king",
    name: "Burger King",
    handle: "@burgerking_dt",
    category: "Fast Food",
    promo: "Buy 5 Get $5",
    bgImage: "bg-red-100",
    coverImage: "bg-gradient-to-r from-red-600 to-orange-600",
    logo: "🍔",
    distance: "1.2 km",
    stamps: 4, // Set to 4 so next payment triggers reward
    followers: "5.8k",
    desc: "Flame grilled burgers."
  },
  {
    id: 3,
    type: "luck",
    chatId: "neon_bar",
    name: "Neon Bar",
    handle: "@neonbar_night",
    category: "Nightlife",
    promo: "Win Free Drinks",
    bgImage: "bg-purple-100",
    coverImage: "bg-gradient-to-r from-purple-600 to-blue-900",
    logo: "🍸",
    distance: "0.5 km",
    followers: "890",
    desc: "Live music every Friday."
  }
]

const CCSA_CARDS = [
  { id: 1, name: "Beamio Black", balance: "Coming Soon", color: "bg-gray-900", textColor: "text-white" },
  { id: 2, name: "Coffee Club", balance: "Waitlist", color: "bg-orange-500", textColor: "text-white" }
]

type PaymentStep = "idle" | "input" | "tip" | "processing" | "success"
type TipState =
  | { type: "none"; value: 0 }
  | { type: "percent"; value: number }
  | { type: "custom"; value: 0 }


// --- 2. Helper Components ---

function MessageBubble({ msg }: { msg: Message }) {
  const isMe = msg.sender === 'me'
  
  if (msg.type === 'payment' || msg.type === 'reward' || msg.type === 'request') {
    const isReward = msg.type === 'reward'
    return (
      <div className={`flex w-full mb-4 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className={`p-4 rounded-2xl shadow-sm border max-w-[240px] ${isMe ? 'bg-white border-blue-100 rounded-tr-sm' : 'bg-white border-gray-100 rounded-tl-sm'} ${isReward ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200' : ''}`}>
           <div className="flex items-center justify-between mb-2">
             <span className={`text-[10px] font-bold uppercase tracking-wider ${isReward ? 'text-blue-600' : 'text-gray-400'}`}>
               {isReward ? 'Reward Earned' : 'Payment Sent'}
             </span>
             <span className="text-[10px] text-gray-400">{msg.time}</span>
           </div>
           <div className="flex items-baseline gap-1 mb-1">
             <span className={`text-2xl font-bold ${isReward ? 'text-blue-600' : 'text-gray-900'}`}>{msg.amount}</span>
             <span className="text-xs font-medium text-gray-500">USDC</span>
           </div>
           <p className="text-xs text-gray-500 mb-3">{msg.note || 'Transfer'}</p>
           <div className="pt-2 border-t border-gray-100/50 flex items-center gap-1">
             <div className={`w-4 h-4 rounded-full flex items-center justify-center ${isReward ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'}`}>
               <Check size={10} strokeWidth={4} />
             </div>
             <span className="text-[10px] font-medium text-gray-400">Completed</span>
           </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`flex w-full mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`py-2 px-4 rounded-2xl max-w-[70%] text-sm ${isMe ? 'bg-[#0052FF] text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'}`}>
        {msg.content}
      </div>
    </div>
  )
}

function ChatDetailView({ chat, onBack, onTriggerPayment }: { chat: Chat, onBack: () => void, onTriggerPayment: () => void }) {
  const [showActionTray, setShowActionTray] = useState(false)
  
  return (
    <div className="absolute inset-0 z-[100] bg-[#F5F7FA] flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 pt-6 flex items-center justify-between sticky top-0 z-20">
         <div className="flex items-center gap-3">
           <button onClick={onBack} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full -ml-1">
             <ChevronLeft size={26} />
           </button>
           <div className="relative">
             <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl border border-gray-100 ${chat.bg}`}>
               {chat.avatar}
             </div>
             <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
           </div>
           <div>
             <h3 className="font-bold text-gray-900 flex items-center gap-1">
               {chat.name} 
               {chat.verified && <Check size={14} strokeWidth={4} className="bg-blue-500 text-white rounded-full p-0.5" />}
             </h3>
             <p className="text-xs text-gray-500">Online</p>
           </div>
         </div>
         <button className="text-gray-400 hover:bg-gray-100 p-2 rounded-full">
           <MoreHorizontal size={24} />
         </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
         <div className="text-center text-xs text-gray-400 mb-6 mt-2">Today</div>
         {chat.messages.map(msg => (
           <MessageBubble key={msg.id} msg={msg} />
         ))}
      </div>
      
      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-3 pb-8 absolute bottom-0 w-full z-30">
         {showActionTray && (
           <div className="flex gap-4 p-3 mb-2 animate-in slide-in-from-bottom duration-200">
              <button onClick={() => { onTriggerPayment(); setShowActionTray(false); }} className="flex flex-col items-center gap-1 group">
                 <div className="w-12 h-12 bg-blue-50 text-[#0052FF] rounded-full flex items-center justify-center border border-blue-100 shadow-sm group-active:scale-95 transition-all">
                   <DollarSign size={20} strokeWidth={2.5}/>
                 </div>
                 <span className="text-[10px] font-medium text-gray-600">{tu('send')}</span>
              </button>
              <button className="flex flex-col items-center gap-1 group">
                 <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-full flex items-center justify-center border border-gray-100 shadow-sm group-active:scale-95 transition-all">
                   <ArrowDownLeft size={20} strokeWidth={2.5}/>
                 </div>
                 <span className="text-[10px] font-medium text-gray-600">{tu('request')}</span>
              </button>
           </div>
         )}
         
         <div className="flex items-center gap-2">
           <button 
             onClick={() => setShowActionTray(!showActionTray)}
             className={`p-2 rounded-full transition-colors ${showActionTray ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:bg-gray-100'}`}
           >
             <Plus size={24} className={showActionTray ? 'rotate-45 transition-transform' : 'transition-transform'}/>
           </button>
           <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 flex items-center">
             <input type="text" placeholder="Message..." className="bg-transparent outline-none w-full text-sm" />
           </div>
           <button className="p-2 bg-[#0052FF] text-white rounded-full hover:bg-blue-600 transition-colors">
             <Send size={20} className="ml-0.5" />
           </button>
         </div>
      </div>
    </div>
  )
}

function MerchantItem({ merchant, onPayClick }: { merchant: Merchant; onPayClick: (m: Merchant) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm border border-gray-100 ${merchant.bgImage}`}>
          {merchant.logo}
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 leading-tight">{merchant.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">{merchant.category}</span>
            <span className="text-[11px] text-gray-400 flex items-center gap-0.5"><MapPin size={10} /> {merchant.distance}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {merchant.type === "cashback" && (
          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">{merchant.promo}</span>
        )}
        {merchant.type === "loyalty" && (
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < (merchant.stamps ?? 0) ? "bg-red-500" : "bg-gray-200"}`}/>
            ))}
          </div>
        )}
        {merchant.type === "luck" && (
          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100 flex items-center gap-1"><Dices size={10} /> {merchant.promo}</span>
        )}
        <button type="button" onClick={e => { e.stopPropagation(); onPayClick(merchant); }} className="mt-1 text-[11px] font-bold text-[#0052FF] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 active:scale-95">
          Pay <ArrowUpRight size={12} />
        </button>
      </div>
    </div>
  )
}

function CCSACard({ card }: { card: { id: number; name: string; balance: string; color: string; textColor: string } }) {
  return (
    <div className={`relative overflow-hidden rounded-[20px] p-4 min-w-[140px] h-[90px] ${card.color} ${card.textColor} shadow-md flex flex-col justify-between`}>
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
      <div className="flex justify-between items-start z-10">
        <Store size={16} className="opacity-80" />
        <span className="text-[10px] font-bold bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded">{card.balance}</span>
      </div>
      <div className="z-10">
        <p className="text-xs font-bold leading-tight">{card.name}</p>
        <p className="text-[9px] opacity-70 mt-0.5">Stored Value</p>
      </div>
    </div>
  )
}

function PaymentSimulationModal({
  step,
  merchant,
  amount,
  setAmount,
  tipState,
  setTipState,
  customTipInput,
  setCustomTipInput,
  onClose,
  onNext,
  onConfirm,
  onDone
}: {
  step: PaymentStep
  merchant: Merchant | null
  amount: string
  setAmount: (v: string) => void
  tipState: TipState
  setTipState: (v: TipState) => void
  customTipInput: string
  setCustomTipInput: (v: string) => void
  onClose: (mode?: "back") => void
  onNext: () => void
  onConfirm: () => void
  onDone: () => void
}) {
  if (step === "idle" || !merchant) return null

  const bill = parseFloat(amount) || 0
  const tip = tipState.type === "percent" ? bill * (tipState.value / 100) : tipState.type === "custom" ? parseFloat(customTipInput) || 0 : 0
  const total = bill + tip
  const cashback = merchant.type === "cashback" ? bill * 0.2 : 0

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onClose()} aria-label={tu('close')} />
      <div className="relative z-10 w-full max-w-sm rounded-[32px] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* --- STEP 1: INPUT --- */}
        {step === "input" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <button type="button" onClick={() => onClose()} className="p-2 -m-2"><X size={22} className="text-gray-400" /></button>
              <div className="text-[13px] font-extrabold text-gray-900">Send Payment</div>
              <div className="w-6" />
            </div>

            <div className="flex flex-col items-center mb-8">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 ${merchant.bgImage}`}>{merchant.logo}</div>
              <div className="text-lg font-extrabold text-gray-900">{merchant.name}</div>
              <div className="text-sm text-gray-500">{merchant.promo}</div>
              
              {/* Dynamic Badges */}
              {merchant.type === 'cashback' && (
                <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
                  <Sparkles size={14} className="text-orange-600" /> Pay & Earn Cashback
                </div>
              )}
              {merchant.type === 'loyalty' && (
                 <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-red-700 bg-red-50 border border-red-100 px-3 py-1 rounded-full">
                  <Trophy size={14} className="text-red-600" /> Collect Stamps
                </div>
              )}
              {merchant.type === 'luck' && (
                 <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1 rounded-full animate-pulse">
                  <Dices size={14} className="text-purple-600" /> Lucky Pay Qualified
                </div>
              )}
            </div>

            <div className="mb-8 text-center">
              <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block mb-2">Enter Amount</label>
              <div className="flex items-center justify-center text-[#0052FF]">
                <span className="text-4xl font-extrabold">$</span>
                <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className="text-6xl font-extrabold w-44 text-center outline-none text-[#0052FF] placeholder-blue-200 bg-transparent" placeholder="10.00" />
              </div>
            </div>

            <button type="button" onClick={onNext} className="w-full bg-[#0052FF] hover:bg-blue-600 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all">{tu('next')}</button>
          </div>
        )}

        {/* --- STEP 2: TIP --- */}
        {step === "tip" && (
          <div className="p-6 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between mb-6">
              <button type="button" onClick={() => onClose("back")} className="p-2 -m-2"><ChevronLeft size={22} className="text-gray-400" /></button>
              <div className="text-[13px] font-extrabold text-gray-900">Add a Tip</div>
              <div className="w-6" />
            </div>

            <div className="text-center mb-6">
              <div className="text-[12px] text-gray-500">{tu('bill_amount')}</div>
              <div className="text-3xl font-extrabold text-gray-900">${bill.toFixed(2)}</div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-6">
              {[15, 18, 20].map(percent => (
                <button key={percent} type="button" onClick={() => { setTipState({ type: "percent", value: percent }); setCustomTipInput("") }} className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all h-[72px] ${tipState.type === "percent" && tipState.value === percent ? "border-[#0052FF] bg-blue-50 text-[#0052FF] ring-1 ring-[#0052FF]" : "border-gray-100 bg-white text-gray-600 hover:bg-gray-50"}`}>
                  <span className="text-lg font-extrabold">{percent}%</span>
                  <span className="text-[10px] opacity-80">${((bill * percent) / 100).toFixed(2)}</span>
                </button>
              ))}
              <button type="button" onClick={() => { setTipState({ type: "custom", value: 0 }); window.setTimeout(() => document.getElementById("custom-tip-input")?.focus(), 30) }} className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all h-[72px] ${tipState.type === "custom" ? "border-[#0052FF] bg-blue-50 text-[#0052FF] ring-1 ring-[#0052FF]" : "border-gray-100 bg-white text-gray-600 hover:bg-gray-50"}`}>
                <span className="text-sm font-extrabold">Custom</span>
                {tipState.type === "custom" ? (<span className="text-[10px] opacity-80">Input</span>) : (<DollarSign size={12} className="opacity-60 mt-1" />)}
              </button>
            </div>

            {tipState.type === "custom" && (
              <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-center bg-gray-50 rounded-xl p-3 border border-blue-100">
                  <span className="text-gray-500 font-extrabold mr-1">$</span>
                  <input id="custom-tip-input" type="number" inputMode="decimal" placeholder="0.00" className="bg-transparent outline-none w-24 font-extrabold text-gray-900 text-lg" value={customTipInput} onChange={e => setCustomTipInput(e.target.value)} />
                </div>
              </div>
            )}

            <button type="button" onClick={() => { setTipState({ type: "none", value: 0 }); setCustomTipInput("") }} className={`w-full py-3 mb-6 rounded-xl border text-sm font-extrabold transition-all ${tipState.type === "none" ? "border-gray-400 text-gray-900 bg-gray-100" : "border-gray-100 text-gray-400 hover:text-gray-600"}`}>No Tip</button>

            <div className="border-t border-gray-100 pt-4 mb-6">
              <div className="flex justify-between items-center text-xl font-extrabold text-gray-900"><span>Total</span><span>${total.toFixed(2)}</span></div>
              {merchant.type === 'cashback' && (<div className="mt-1 text-[11px] text-gray-500 flex items-center justify-between"><span>Cashback</span><span className="font-bold text-orange-600">+{cashback.toFixed(2)} USDC</span></div>)}
            </div>

            <button type="button" onClick={onConfirm} className="w-full bg-[#0052FF] hover:bg-blue-600 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2">
              Pay Total <span className="bg-white/20 px-2 py-0.5 rounded text-sm font-extrabold">${total.toFixed(2)}</span>
            </button>
          </div>
        )}

        {/* --- STEP 3: PROCESSING --- */}
        {step === "processing" && (
          <div className="p-12 flex flex-col items-center justify-center min-h-[380px]">
            <Loader2 size={46} className="text-[#0052FF] animate-spin mb-4" />
            <div className="font-extrabold text-gray-700">Verifying on Chain...</div>
            <div className="text-xs text-gray-400 mt-2">Gas-free · instant settlement</div>
          </div>
        )}

        {/* --- STEP 4: SUCCESS (Dynamic) --- */}
        {step === "success" && (
          <div className="p-0 relative bg-white min-h-[480px] flex flex-col">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-10 left-10 w-4 h-4 bg-yellow-400 rounded-full animate-bounce" />
              <div className="absolute top-24 right-20 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
              <div className="absolute bottom-40 left-20 w-6 h-6 bg-purple-400 rounded-full opacity-50" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                <Check size={40} className="text-green-600" strokeWidth={4} />
              </div>
              <div className="text-2xl font-extrabold text-gray-900 mb-2">Payment Successful!</div>
              <div className="text-gray-500 mb-8">Sent to {merchant.name}</div>

              {/* DYNAMIC REWARD CARDS */}
              
              {/* 1. Cashback Card */}
              {merchant.type === "cashback" && (
                <div className="w-full bg-gradient-to-br from-[#0052FF] to-[#0A2540] rounded-2xl p-6 text-white shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
                  <div className="flex items-center gap-2 mb-2 opacity-90 justify-center">
                    <Sparkles size={16} className="text-yellow-300" /><span className="text-xs font-extrabold uppercase tracking-wider">Cashback Earned</span>
                  </div>
                  <div className="text-4xl font-extrabold mb-1 flex items-center justify-center gap-1">+{cashback.toFixed(2)} <span className="text-lg opacity-80 font-bold">USDC</span></div>
                  <div className="text-sm opacity-85">Added to your wallet instantly.</div>
                </div>
              )}

              {/* 2. Lucky Pay Card (Gamified Rewards) */}
              {merchant.type === "luck" && (
                 <div className="w-full bg-gradient-to-br from-purple-600 to-indigo-900 rounded-2xl p-6 text-white shadow-xl transform transition-all hover:scale-105 animate-in slide-in-from-bottom-4 fade-in duration-500">
                    <div className="flex items-center gap-2 mb-2 opacity-80 justify-center">
                      <Dices size={16} className="text-pink-300"/>
                      <span className="text-xs font-bold uppercase tracking-wider">Lucky Pay Result</span>
                    </div>
                    <div className="text-3xl font-extrabold mb-2 text-yellow-300 drop-shadow-md">JACKPOT! 🎉</div>
                    <p className="text-white font-bold text-lg mb-1">FREE DRINK WON</p>
                    <p className="text-sm opacity-80">$5.00 Credited to Wallet</p>
                 </div>
              )}

              {/* 3. Loyalty Card (Digital Loyalty) */}
              {merchant.type === "loyalty" && (
                <div className="w-full bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-6 text-white shadow-xl transform transition-all hover:scale-105 animate-in slide-in-from-bottom-4 fade-in duration-500">
                   <div className="flex items-center gap-2 mb-2 opacity-80 justify-center">
                     <Trophy size={16} className="text-yellow-300"/>
                     <span className="text-xs font-bold uppercase tracking-wider">Stamp Collected</span>
                   </div>
                   <div className="flex gap-2 justify-center my-4">
                      {[...Array(5)].map((_, i) => (
                         <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-white/20 ${i < 4 ? 'bg-white text-red-600' : 'bg-white/20 text-white'}`}>
                           {i < 4 ? <Check size={16} strokeWidth={4}/> : <div className="animate-ping absolute w-full h-full rounded-full bg-white/30"></div>}
                           {i === 4 && <Check size={16} strokeWidth={4}/>}
                         </div>
                      ))}
                   </div>
                   <p className="text-lg font-bold text-yellow-300 mb-1">Reward Unlocked! 🍔</p>
                   <p className="text-sm opacity-80">You got $5 off your next order.</p>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-gray-50">
              <button type="button" onClick={onDone} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-extrabold py-4 rounded-2xl transition-all active:scale-95">Done & View Receipt</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// --- 3. Main Component ---

export function VouchersMockup() {
  const [toast, setToast] = useState<string | null>(null)

  // --- Workflow states ---
  const [activeMerchant, setActiveMerchant] = useState<Merchant | null>(null)
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("idle")
  const [simulationAmount, setSimulationAmount] = useState("10.00")
  const [tipState, setTipState] = useState<TipState>({ type: "none", value: 0 })
  const [customTipInput, setCustomTipInput] = useState("")
  const [balance, setBalance] = useState(902.18)

  // --- Chat States ---
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1600)
  }

  const totalPaid = useMemo(() => {
    const bill = parseFloat(simulationAmount) || 0
    const tip = tipState.type === "percent" ? bill * (tipState.value / 100) : tipState.type === "custom" ? parseFloat(customTipInput) || 0 : 0
    return bill + tip
  }, [simulationAmount, tipState, customTipInput])

  const resetPayment = () => {
    setPaymentStep("idle")
    setActiveMerchant(null)
    setSimulationAmount("10.00")
    setTipState({ type: "none", value: 0 })
    setCustomTipInput("")
  }

  // --- Render logic for Chat view ---
  if (activeChatId) {
    const activeChat = chats.find(c => c.id === activeChatId)
    if (activeChat) {
      return (
         <div className="min-h-[100dvh] bg-[#F5F7FA]">
            <div className="max-w-md mx-auto min-h-[100dvh] bg-[#F5F7FA] relative border-x border-gray-200 overflow-hidden shadow-2xl">
               <ChatDetailView 
                 chat={activeChat} 
                 onBack={() => setActiveChatId(null)}
                 onTriggerPayment={() => {
                   const merchant = FEATURED_MERCHANTS.find(m => m.chatId === activeChatId)
                   if(merchant) {
                     setActiveMerchant(merchant)
                     setPaymentStep("input")
                   }
                 }}
               />
               <PaymentSimulationModal
                 step={paymentStep}
                 merchant={activeMerchant}
                 amount={simulationAmount}
                 setAmount={setSimulationAmount}
                 tipState={tipState}
                 setTipState={setTipState}
                 customTipInput={customTipInput}
                 setCustomTipInput={setCustomTipInput}
                 onClose={() => setPaymentStep("idle")}
                 onNext={() => setPaymentStep("tip")}
                 onConfirm={() => {
                     setPaymentStep("processing")
                     setTimeout(() => {
                        setPaymentStep("success")
                        // Chat update logic for simple re-payment here...
                        if (activeMerchant) {
                          const newChats = [...chats]
                          const chatIndex = newChats.findIndex(c => c.id === activeMerchant.chatId)
                          if (chatIndex >= 0) {
                             newChats[chatIndex].messages.push({id: Date.now(), type: 'payment', amount: `-${totalPaid.toFixed(2)}`, status: 'completed', sender: 'me', time: tu('just_now')})
                             newChats.unshift(newChats.splice(chatIndex, 1)[0])
                             setChats(newChats)
                          }
                        }
                     }, 1000)
                 }}
                 onDone={() => setPaymentStep("idle")}
               />
            </div>
         </div>
      )
    }
  }

  // --- Main Render ---
  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA]">
      <div className="max-w-md mx-auto min-h-[100dvh] bg-[#F5F7FA] relative border-x border-gray-200">
        <div className="h-3" />
        <div className="px-5 mt-2">
          <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md border border-gray-200/60 rounded-full px-3 py-1 shadow-sm">
            <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">{tu('balance')}</span>
            <span className="text-[11px] font-extrabold text-gray-900">{balance.toFixed(2)} USDC</span>
          </div>
        </div>

        {/* Demo Disclaimer */}
        <div className="px-5 mt-4 mb-2">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 p-3 opacity-10"><Megaphone size={60} className="text-indigo-900" /></div>
            <div className="relative z-10 flex gap-3">
              <div className="bg-indigo-100 p-2 rounded-full h-min text-indigo-600 shrink-0"><Info size={20} strokeWidth={2.5} /></div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-indigo-900">Demo Showcase</h3>
                <p className="text-xs text-indigo-700 mt-1 leading-relaxed">This page demonstrates marketing tools for merchants.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Spotlight Card */}
        <div className="px-5 mt-4 mb-6">
          <div className="relative overflow-hidden rounded-[24px] bg-[#0A2540] p-6 shadow-lg shadow-blue-900/10 cursor-pointer active:scale-95 transition-all" onClick={() => { setActiveMerchant(FEATURED_MERCHANTS[0]); setPaymentStep("input"); }}>
            <div className="absolute right-0 top-0 w-32 h-32 bg-orange-400/20 rounded-full blur-3xl" />
            <div className="absolute left-0 bottom-0 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl" />
            <div className="relative z-10 flex flex-col items-start">
              <span className="bg-white/10 text-white/90 text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-md border border-white/10 mb-2">Partner Spotlight</span>
              <h2 className="text-[28px] font-extrabold text-white leading-[1.05] mb-2 tracking-tight">20% Cashback at <br />Daily Grind Cafe</h2>
              <p className="text-white/60 text-xs mb-5">Instant reward when you pay with USDC</p>
              <button className="bg-white text-[#0A2540] text-xs font-bold px-5 py-2.5 rounded-full shadow-sm">Get Voucher</button>
            </div>
            <div className="absolute right-5 bottom-5 text-6xl opacity-15">☕️</div>
          </div>
        </div>

        {/* Merchant Solutions (Demo Buttons) */}
        <div className="px-5 mb-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Megaphone size={14} className="text-indigo-600" />
            <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">Merchant Solutions (Demo)</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* 1. Instant Cashback */}
            <button type="button" onClick={() => { setActiveMerchant(FEATURED_MERCHANTS[0]); setPaymentStep("input"); }} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl">⚡️</div>
                <div><h3 className="font-bold text-gray-900 text-sm">Instant Cashback</h3><p className="text-xs text-gray-500">Drive traffic with auto-rewards</p></div>
              </div>
              <div className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"><PlayCircle size={12} /> Try Demo</div>
            </button>
            
            {/* 2. Digital Loyalty (Burger King) */}
             <button type="button" onClick={() => { setActiveMerchant(FEATURED_MERCHANTS[1]); setPaymentStep("input"); }} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">🍔</div>
                <div><h3 className="font-bold text-gray-900 text-sm">Digital Loyalty</h3><p className="text-xs text-gray-500">Buy 5 Get $5 (No stamps needed)</p></div>
              </div>
              <div className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"><PlayCircle size={12} /> Try Demo</div>
            </button>

            {/* 3. Gamified Rewards (Neon Bar) */}
            <button type="button" onClick={() => { setActiveMerchant(FEATURED_MERCHANTS[2]); setPaymentStep("input"); }} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-xl">🎲</div>
                <div><h3 className="font-bold text-gray-900 text-sm">Gamified Rewards</h3><p className="text-xs text-gray-500">Lucky Pay (Random free bills)</p></div>
              </div>
              <div className="bg-purple-50 text-purple-600 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"><PlayCircle size={12} /> Try Demo</div>
            </button>
          </div>
        </div>

        {/* RESTORED SECTION: Accepting Beamio */}
        <div className="px-5 mb-7">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Store size={14} className="text-[#0052FF]" />
            <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">Accepting Beamio</h2>
          </div>

          <div className="bg-white rounded-[24px] overflow-hidden border border-gray-200/60 shadow-sm">
            {FEATURED_MERCHANTS.map((merchant, i) => (
              <React.Fragment key={merchant.id}>
                <MerchantItem
                  merchant={merchant}
                  onPayClick={m => {
                    setActiveMerchant(m)
                    setPaymentStep("input")
                  }}
                />
                {i !== FEATURED_MERCHANTS.length - 1 && <div className="ml-[72px] h-[1px] bg-gray-100" />}
              </React.Fragment>
            ))}
             <div className="p-3 text-center border-t border-gray-50">
               <button className="text-[11px] font-semibold text-gray-400 hover:text-[#0052FF] transition-colors">View all merchants nearby</button>
             </div>
          </div>
        </div>

        {/* RESTORED SECTION: Stored Value Cards */}
        <div className="px-5 pb-28">
           <div className="flex items-center gap-2 mb-3 px-1">
            <Gift size={14} className="text-purple-500" />
            <h2 className="text-[13px] font-bold text-gray-700 uppercase tracking-wider">
              Stored Value Cards{" "}
              <span className="text-purple-500 text-[10px] ml-1 bg-purple-50 px-1.5 py-0.5 rounded">
                Beta
              </span>
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-5 px-5">
            {CCSA_CARDS.map(card => (
              <CCSACard key={card.id} card={card} />
            ))}
             <button
              type="button"
              onClick={() => showToast("Add Code")}
              className="min-w-[140px] h-[90px] rounded-[20px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1 bg-gray-50/50 active:scale-95 transition"
            >
              <span className="text-xl">+</span>
              <span className="text-[10px] font-medium">Add Code</span>
            </button>
          </div>
        </div>
        
        {/* Payment Workflow Modal */}
        <PaymentSimulationModal
          step={paymentStep}
          merchant={activeMerchant}
          amount={simulationAmount}
          setAmount={setSimulationAmount}
          tipState={tipState}
          setTipState={setTipState}
          customTipInput={customTipInput}
          setCustomTipInput={setCustomTipInput}
          onClose={mode => { if (mode === "back") { setPaymentStep("input"); return; } resetPayment(); }}
          onNext={() => setPaymentStep("tip")}
          onConfirm={() => {
            setPaymentStep("processing")
            window.setTimeout(() => {
              setPaymentStep("success")
              
              // 1. Update Balance Logic
              let rewardValue = 0
              if (activeMerchant?.type === 'cashback') rewardValue = parseFloat(simulationAmount) * 0.2;
              if (activeMerchant?.type === 'luck') rewardValue = 5.00; // Fixed Jackpot amount
              
              setBalance(prev => prev - totalPaid + rewardValue)
              
              // 2. Chat Message Logic
              if (activeMerchant) {
                 const newChats = [...chats]
                 const chatIndex = newChats.findIndex(c => c.id === activeMerchant.chatId)
                 
                 if (chatIndex >= 0) {
                   // Payment Sent Msg
                   newChats[chatIndex].messages.push({ id: Date.now(), type: 'payment', amount: `-${totalPaid.toFixed(2)}`, status: 'completed', sender: 'me', time: tu('just_now') })
                   
                   // Reward Msgs
                   if (activeMerchant.type === 'cashback') {
                      newChats[chatIndex].messages.push({ id: Date.now() + 1, type: 'reward', amount: `+${rewardValue.toFixed(2)}`, status: 'reward', note: '20% Cashback', sender: 'me', time: tu('just_now') })
                   } else if (activeMerchant.type === 'luck') {
                      newChats[chatIndex].messages.push({ id: Date.now() + 1, type: 'text', content: '🎉 JACKPOT! You won a FREE DRINK! $5.00 credited.', sender: 'them', time: tu('just_now') })
                   } else if (activeMerchant.type === 'loyalty') {
                      newChats[chatIndex].messages.push({ id: Date.now() + 1, type: 'text', content: 'You earned a stamp! You have unlocked a $5 Reward!', sender: 'them', time: tu('just_now') })
                   }

                   newChats[chatIndex].lastMessage = `You sent $${totalPaid.toFixed(2)}`
                   newChats[chatIndex].time = tu('just_now')
                   newChats.unshift(newChats.splice(chatIndex, 1)[0])
                   setChats(newChats)
                 }
              }
            }, 1200)
          }}
          onDone={() => {
            if (activeMerchant) {
              const targetChatId = activeMerchant.chatId
              setPaymentStep("idle")
              setSimulationAmount("10.00")
              setTipState({ type: "none", value: 0 })
              setCustomTipInput("")
              setActiveMerchant(null) 
              setActiveChatId(targetChatId)
            } else {
              resetPayment()
            }
          }}
        />

        {/* tiny toast */}
        {toast && (
          <div className="fixed left-0 right-0 bottom-6 flex justify-center z-50 pointer-events-none">
            <div className="bg-black/80 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/15"><Check size={12} /></span>{toast}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function GlobalStyles() {
  return (
    <style>{`
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
  )
}