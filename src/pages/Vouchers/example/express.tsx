import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Gift, 
  Landmark, 
  ScanLine, 
  Ticket, 
  Home, 
  Wallet, 
  ShoppingBag, 
  MessageCircle, 
  ChevronRight,
  Plus,
  Zap,
  Coffee,
  CheckCircle2,
  Lock,
  Copy,
  Loader2,
  CreditCard,
  Check
} from 'lucide-react';
import { useDaemonContext } from '@/providers/DaemonProvider';

// 模拟数据
const INITIAL_EOA_BALANCE = 5.72;
const AA_CREATION_COST = 0.99;
const INITIAL_AA_BALANCE = 42.30; 

// 模拟地址
const EOA_ADDRESS = "0x71C...9A21";
const SA_ADDRESS = "0x34F...B702";

export default function WalletExample() {
  const { setShowFooter } = useDaemonContext();

  // 隐藏全局 footer（与 BeamioExample 一致）
  useEffect(() => {
    setShowFooter(false);
    return () => {
      setShowFooter(true);
    };
  }, [setShowFooter]);

  // 状态管理
  const [hasSmartAccount, setHasSmartAccount] = useState(false); 
  const [activeSlide, setActiveSlide] = useState(0); // 0: EOA, 1: Smart Account
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('wallet'); // 'wallet', 'bag' (vouchers), etc.
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'vouchers'
  
  // 全局处理状态 (用于 Loading 遮罩)
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('');

  // 模拟 EOA 余额
  const [eoaBalance, setEoaBalance] = useState(INITIAL_EOA_BALANCE);

  // 处理滑动切换钱包
  const toggleSlide = (index: number) => {
    setActiveSlide(index);
  };

  // 流程 1: 支付创建 Smart Account (模拟过程)
  const handleCreateSmartAccount = () => {
    if (eoaBalance < AA_CREATION_COST) {
      alert("Insufficient EOA balance (0.99 USDC required)");
      return;
    }

    // 在 Modal 内部显示 Loading (或使用全局)
    // 这里我们统一使用全局 Loading 效果，体验更一致
    setShowActivateModal(false); // 关闭选择弹窗
    setProcessingText("Creating Smart Account...");
    setIsGlobalProcessing(true);

    // 模拟链上交互延迟
    setTimeout(() => {
      setEoaBalance(prev => +(prev - AA_CREATION_COST).toFixed(2));
      setHasSmartAccount(true);
      setIsGlobalProcessing(false);
      setActiveSlide(1); // 自动切换到新钱包
    }, 2000);
  };

  // 流程 2: 跳转到 Vouchers 页面
  const goToVouchers = () => {
    setShowActivateModal(false);
    setCurrentView('vouchers');
    setActiveTab('bag');
  };

  // 流程 2后续: 购买 Voucher 并激活
  const buyVoucherAndActivate = (voucherName: string) => {
      // 1. 设置处理状态
      setProcessingText(`Purchasing ${voucherName}...`);
      setIsGlobalProcessing(true);

      // 2. 模拟网络请求和合约交互 (1.5秒)
      setTimeout(() => {
          // 3. 购买成功，更新状态
          setHasSmartAccount(true);
          
          // 4. 更新 Loading 文字，提供成功反馈 (再停留 0.5秒)
          setProcessingText("Activating Smart Account...");
          
          setTimeout(() => {
            setIsGlobalProcessing(false);
            setCurrentView('dashboard'); // 回到主页
            setActiveTab('wallet');      // 选中钱包 Tab
            setActiveSlide(1);           // 自动滑动到 Smart Account 卡片
          }, 800);

      }, 1500);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden max-w-md mx-auto shadow-2xl relative">
      
      {/* 顶部标题栏 (仅在 Dashboard 显示) */}
      {currentView === 'dashboard' && (
        <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-slate-50 z-10">
            <h1 className="text-2xl font-bold text-slate-900">My Wallet</h1>
            {activeSlide === 0 && (
            <span className="px-2 py-1 bg-slate-200 text-slate-500 text-xs font-bold rounded-full">EOA</span>
            )}
            {activeSlide === 1 && hasSmartAccount && (
            <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs font-bold rounded-full">Smart Account</span>
            )}
        </header>
      )}

      {/* Vouchers 页面标题栏 */}
      {currentView === 'vouchers' && (
          <header className="px-6 pt-12 pb-4 flex items-center gap-4 bg-white z-10 shadow-sm">
            <button onClick={() => { setCurrentView('dashboard'); setActiveTab('wallet'); }} className="p-1 rounded-full hover:bg-slate-100">
                <ChevronRight className="rotate-180" size={24}/>
            </button>
            <h1 className="text-xl font-bold text-slate-900">Marketplace</h1>
          </header>
      )}

      {/* 主要内容区域 */}
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide relative">
        
        {currentView === 'dashboard' ? (
            <>
                {/* 钱包卡片轮播区 */}
                <div className="relative px-6 mb-6">
                <div className="flex gap-4 overflow-x-hidden snap-x snap-mandatory">
                    
                    {/* EOA 钱包卡片 */}
                    <div 
                    className={`w-full flex-shrink-0 transition-transform duration-500 ease-out ${activeSlide === 1 ? '-translate-x-[105%]' : 'translate-x-0'}`}
                    onClick={() => setActiveSlide(0)}
                    >
                    <div className="relative w-full aspect-[1.6] rounded-3xl p-6 text-white shadow-xl bg-gradient-to-br from-blue-600 via-indigo-500 to-pink-500 flex flex-col justify-between overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                        
                        <div className="flex justify-between items-start z-10">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <div className="w-4 h-1 bg-white rounded-full"></div>
                            </div>
                            <span className="font-medium">Base EOA</span>
                        </div>
                        <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1">
                            <Zap size={10} className="fill-yellow-300 text-yellow-300" />
                            Gas Sponsored
                        </div>
                        </div>

                        <div className="text-center z-10 mt-4">
                        <div className="text-5xl font-bold tracking-tight">{eoaBalance.toFixed(2)} <span className="text-2xl font-normal opacity-80">USDC</span></div>
                        <div className="text-white/70 mt-1 text-sm">≈ CA$ {(eoaBalance * 1.36).toFixed(2)}</div>
                        </div>

                        {/* 地址显示 - 右下角 */}
                        <div className="flex justify-end mt-auto z-10">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-mono text-white/90 cursor-pointer hover:bg-black/30 transition-colors">
                                {EOA_ADDRESS}
                                <Copy size={10} />
                            </div>
                        </div>
                    </div>
                    </div>

                    {/* Smart Account 钱包卡片 */}
                    <div 
                    className={`absolute top-0 left-6 right-6 transition-transform duration-500 ease-out ${activeSlide === 1 ? 'translate-x-0' : 'translate-x-[105%]'}`}
                    onClick={() => setActiveSlide(1)}
                    >
                    {!hasSmartAccount ? (
                        // 未激活状态
                        <div onClick={() => setShowActivateModal(true)} className="relative w-full aspect-[1.6] rounded-3xl p-6 text-white shadow-lg bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col justify-center items-center cursor-pointer overflow-hidden border-2 border-dashed border-slate-600 group hover:border-purple-400 transition-colors">
                        <div className="absolute inset-0 bg-purple-600/10 group-hover:bg-purple-600/20 transition-colors"></div>
                        <div className="z-10 bg-white/10 p-4 rounded-full mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform">
                            <Plus size={32} className="text-purple-300" />
                        </div>
                        <h3 className="text-xl font-bold z-10">Create Smart Account</h3>
                        <p className="text-slate-400 text-sm mt-2 z-10 text-center px-8">Unlock gas-free payments & exclusive vouchers</p>
                        </div>
                    ) : (
                        // 已激活状态
                        <div className="relative w-full aspect-[1.6] rounded-3xl p-6 text-white shadow-xl bg-gradient-to-br from-purple-600 via-violet-500 to-fuchsia-500 flex flex-col justify-between overflow-hidden">
                        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500 opacity-20 rounded-full blur-3xl"></div>
                        
                        <div className="flex justify-between items-start z-10">
                            <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <div className="w-4 h-1 bg-white rounded-full"></div>
                            </div>
                            <span className="font-medium">Smart Account</span>
                            </div>
                            <div className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold flex items-center gap-1">
                            <Zap size={10} className="fill-yellow-300 text-yellow-300" />
                            Gas Sponsored
                            </div>
                        </div>

                        <div className="text-center z-10 mt-4">
                            <div className="text-5xl font-bold tracking-tight">{INITIAL_AA_BALANCE.toFixed(2)} <span className="text-2xl font-normal opacity-80">USDC</span></div>
                            <div className="text-white/70 mt-1 text-sm">≈ CA$ {(INITIAL_AA_BALANCE * 1.36).toFixed(2)}</div>
                        </div>

                         {/* 地址显示 - 右下角 */}
                         <div className="flex justify-end mt-auto z-10">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-sm rounded-full text-xs font-mono text-white/90 cursor-pointer hover:bg-black/30 transition-colors">
                                {SA_ADDRESS}
                                <Copy size={10} />
                            </div>
                        </div>
                        </div>
                    )}
                    </div>

                </div>

                {/* 分页指示器 */}
                <div className="flex justify-center gap-2 mt-6">
                    <button 
                    onClick={() => toggleSlide(0)}
                    className={`h-2 rounded-full transition-all duration-300 ${activeSlide === 0 ? 'w-8 bg-blue-600' : 'w-2 bg-slate-300'}`} 
                    />
                    <button 
                    onClick={() => toggleSlide(1)}
                    className={`h-2 rounded-full transition-all duration-300 ${activeSlide === 1 ? 'w-8 bg-purple-600' : 'w-2 bg-slate-300'}`} 
                    />
                </div>
                </div>

                {/* 动态功能按钮区 */}
                <div className="px-4 transition-all duration-300">
                    {activeSlide === 0 ? (
                        <div className="grid grid-cols-5 gap-2">
                            <ActionButton icon={<ArrowRightLeft size={20} />} label="Transfer" onClick={() => {}} />
                            <ActionButton icon={<ArrowUpRight size={20} />} label="Send" onClick={() => {}} />
                            <ActionButton icon={<ArrowDownLeft size={20} />} label="Request" onClick={() => {}} />
                            <ActionButton icon={<Gift size={20} />} label="Cashcode" onClick={() => {}} />
                            <ActionButton icon={<Landmark size={20} />} label="Bank" onClick={() => {}} />
                        </div>
                    ) : !hasSmartAccount ? (
                        <div className="flex justify-center py-4 text-slate-400 text-sm">
                            Create Smart Account to see actions
                        </div>
                    ) : (
                        <div className="flex justify-center gap-8">
                            <ActionButton icon={<ArrowRightLeft size={24} />} label="Transfer" large onClick={() => {}} />
                            <ActionButton icon={<ScanLine size={24} />} label="Pay" large highlight onClick={() => {}} />
                            <ActionButton icon={<Ticket size={24} />} label="Vouchers" large onClick={() => setCurrentView('vouchers')} />
                        </div>
                    )}
                </div>

                {/* 列表区域 */}
                <div className="mt-8 px-4">
                    {activeSlide === 0 ? (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span> Active & Pending
                                </h3>
                                <button className="text-xs text-blue-600 font-semibold">View All</button>
                            </div>
                            <div className="space-y-3">
                                <ListItem 
                                    icon={<Gift size={20} className="text-pink-500" />} 
                                    bg="bg-pink-100"
                                    title="Cashcode #8829" 
                                    subtitle="Created 2m ago" 
                                    amount="20.00" 
                                    currency="USDC" 
                                    status="Ready"
                                    statusColor="text-green-500"
                                    subAmount=""
                                />
                                <ListItem 
                                    icon={<ArrowDownLeft size={20} className="text-blue-500" />} 
                                    bg="bg-blue-100"
                                    title="Request: Dinner Split" 
                                    subtitle="Sent to @alice" 
                                    amount="15.50" 
                                    currency="USDC" 
                                    status="Pending"
                                    statusColor="text-orange-500"
                                    subAmount=""
                                />
                            </div>
                        </div>
                    ) : hasSmartAccount ? (
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-purple-600"></span> Account Assets
                                </h3>
                                <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
                                    <AssetItem 
                                        icon={<span className="font-bold text-purple-600">$</span>}
                                        bg="bg-purple-100"
                                        name="USDC"
                                        network="Base Network"
                                        value={INITIAL_AA_BALANCE.toFixed(2)}
                                        valueColor="text-slate-900"
                                    />
                                    <div className="h-px bg-slate-100 my-1 mx-4"></div>
                                    <AssetItem 
                                        icon={<span className="font-bold text-green-700">V</span>}
                                        bg="bg-green-100"
                                        name="Starbucks"
                                        network="Balance: CA$ 20.00"
                                        value="Active"
                                        valueColor="text-green-600 font-medium text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">History</h3>
                                    <button className="text-xs text-purple-600 font-semibold">View All</button>
                                </div>
                                <div className="space-y-3">
                                    <ListItem 
                                        icon={<ShoppingBag size={18} className="text-slate-700" />} 
                                        bg="bg-slate-100"
                                        title="Merchant Payment" 
                                        subtitle="@CityGolfClub • Just now" 
                                        amount="-88.20" 
                                        currency="USDC"
                                        subAmount="CA$ 120.00"
                                    />
                                    <ListItem 
                                        icon={<Coffee size={18} className="text-slate-700" />} 
                                        bg="bg-white border border-slate-200"
                                        title="Starbucks" 
                                        subtitle="Membership Purchase" 
                                        amount="-14.70" 
                                        currency="USDC"
                                        subAmount="CA$ 20.00"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-8 text-center p-6 bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="inline-flex p-3 bg-purple-50 rounded-full mb-4">
                                <Lock className="text-purple-400" size={24} />
                            </div>
                            <h3 className="font-bold text-slate-700 mb-2">Wallet Locked</h3>
                            <p className="text-slate-500 text-sm">Create Smart Account to view assets and transaction history.</p>
                        </div>
                    )}
                </div>
            </>
        ) : (
            // ================== VOUCHERS 页面 ==================
            <div className="p-4 space-y-4">
                 <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 mb-6">
                    <h3 className="font-bold text-purple-900 mb-1">Exclusive Offer</h3>
                    <p className="text-sm text-purple-700">Buy any voucher to create your Smart Account for <span className="font-bold">FREE</span>!</p>
                 </div>

                 <h3 className="font-bold text-slate-900 text-lg">Featured</h3>
                 <div className="grid grid-cols-2 gap-3">
                    <VoucherCard 
                        name="Starbucks" 
                        value="$20" 
                        cost="20.00 USDC" 
                        bg="bg-green-700"
                        onClick={() => buyVoucherAndActivate("Starbucks Card")}
                    />
                    <VoucherCard 
                        name="Amazon" 
                        value="$50" 
                        cost="50.00 USDC" 
                        bg="bg-slate-800"
                        onClick={() => buyVoucherAndActivate("Amazon Gift Card")}
                    />
                 </div>

                 <h3 className="font-bold text-slate-900 text-lg mt-6">All Brands</h3>
                 <div className="space-y-3">
                    <VoucherRow name="Uber Eats" cost="25.00 USDC" icon="🍔" onClick={() => buyVoucherAndActivate("Uber Eats")} />
                    <VoucherRow name="Netflix" cost="30.00 USDC" icon="🍿" onClick={() => buyVoucherAndActivate("Netflix")} />
                    <VoucherRow name="Apple" cost="10.00 USDC" icon="🍎" onClick={() => buyVoucherAndActivate("Apple Card")} />
                 </div>
            </div>
        )}

      </div>

      {/* 底部导航栏 */}
      <nav className="bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center pb-8 z-20">
        <NavItem icon={<Home size={24} />} active={activeTab === 'home'} onClick={() => {setActiveTab('home'); setCurrentView('dashboard');}} />
        <NavItem icon={<Wallet size={24} />} active={activeTab === 'wallet'} onClick={() => {setActiveTab('wallet'); setCurrentView('dashboard');}} />
        
        {/* 中心扫描按钮 */}
        <div className="relative -top-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200 transition-colors ${activeSlide === 1 ? 'bg-purple-600 shadow-purple-200' : 'bg-blue-600'}`}>
                <ScanLine size={28} />
            </div>
        </div>

        <NavItem icon={<ShoppingBag size={24} />} active={activeTab === 'bag'} onClick={() => {setActiveTab('bag'); setCurrentView('vouchers');}} />
        <NavItem icon={<MessageCircle size={24} />} active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
      </nav>

      {/* 激活弹窗 Modal */}
      {showActivateModal && (
          <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                  
                    {/* 初始选择界面 */}
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900">Activate Smart Account</h2>
                            <button onClick={() => setShowActivateModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Option 1 */}
                            <button onClick={handleCreateSmartAccount} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200">
                                        <Wallet size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800">Create Smart Account</div>
                                        <div className="text-xs text-slate-500">Fast, Gas-less payments</div>
                                    </div>
                                </div>
                                <div className="font-bold text-blue-600">0.99 USDC</div>
                            </button>

                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-slate-200"></div>
                                <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase">OR</span>
                                <div className="flex-grow border-t border-slate-200"></div>
                            </div>

                            {/* Option 2 */}
                            <button onClick={goToVouchers} className="w-full flex items-center justify-between p-4 border border-purple-200 bg-purple-50 rounded-2xl hover:border-purple-500 hover:bg-purple-100 transition-all text-left group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center group-hover:bg-purple-300">
                                        <Ticket size={20} className="text-purple-700" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-purple-900">Buy Any Voucher</div>
                                        <div className="text-xs text-purple-600">Includes free wallet activation</div>
                                    </div>
                                </div>
                                <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded">HOT</div>
                            </button>
                        </div>
                    </>
                 
                  <p className="text-center text-xs text-slate-400 mt-6">
                      Smart Account powered by ERC-4337
                  </p>
              </div>
          </div>
      )}

      {/* 全局 Loading 遮罩 */}
      {isGlobalProcessing && (
         <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md animate-in fade-in duration-300">
              <div className="relative mb-6">
                 {hasSmartAccount && processingText.includes("Activating") ? (
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                        <Check size={32} className="text-green-600" />
                    </div>
                 ) : (
                    <>
                        <Loader2 className="animate-spin text-purple-600" size={48} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-purple-100 rounded-full -z-10 animate-pulse"></div>
                    </>
                 )}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{processingText}</h3>
              <p className="text-slate-500 text-sm">Interacting with Base Network...</p>
         </div>
      )}

    </div>
  );
}

// 辅助组件

function ActionButton({ icon, label, large = false, highlight = false, onClick }: { icon: React.ReactNode; label: string; large?: boolean; highlight?: boolean; onClick?: () => void }) {
    return (
        <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={onClick}>
            <div className={`
                flex items-center justify-center rounded-2xl transition-all shadow-sm
                ${large ? 'w-16 h-16' : 'w-14 h-14'}
                ${highlight 
                    ? 'bg-purple-600 text-white shadow-purple-200 shadow-md group-hover:bg-purple-700' 
                    : 'bg-white text-slate-700 border border-slate-100 group-hover:border-slate-300'
                }
            `}>
                {icon}
            </div>
            <span className="text-xs font-medium text-slate-600">{label}</span>
        </div>
    );
}

function ListItem({ icon, bg, title, subtitle, amount, currency, status, statusColor, subAmount }: { icon: React.ReactNode; bg: string; title: string; subtitle: string; amount: string; currency: string; status?: string; statusColor?: string; subAmount?: string }) {
    return (
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-slate-50">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                    {icon}
                </div>
                <div>
                    <div className="font-bold text-slate-900 text-sm">{title}</div>
                    <div className="text-xs text-slate-500">{subtitle}</div>
                </div>
            </div>
            <div className="text-right">
                <div className="font-bold text-slate-900">{amount} <span className="text-xs font-normal text-slate-500">{currency}</span></div>
                {status && <div className={`text-xs font-bold ${statusColor}`}>{status}</div>}
                {subAmount && <div className="text-xs text-slate-400">{subAmount}</div>}
            </div>
        </div>
    );
}

function AssetItem({ icon, bg, name, network, value, valueColor }: { icon: React.ReactNode; bg: string; name: string; network: string; value: string; valueColor?: string }) {
    return (
        <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
                    {icon}
                </div>
                <div>
                    <div className="font-bold text-slate-900 text-sm">{name}</div>
                    <div className="text-xs text-slate-400">{network}</div>
                </div>
            </div>
             <div className={`font-bold ${valueColor || 'text-slate-900'}`}>{value}</div>
        </div>
    );
}

function NavItem({ icon, active, onClick }: { icon: React.ReactNode; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} className={`p-2 transition-colors ${active ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}>
            {icon}
        </button>
    );
}

function VoucherCard({ name, value, cost, bg, onClick }: { name: string; value: string; cost: string; bg: string; onClick: () => void }) {
    return (
        <div onClick={onClick} className={`${bg} rounded-2xl p-4 text-white relative overflow-hidden cursor-pointer hover:scale-105 transition-transform shadow-lg active:scale-95`}>
            <div className="absolute top-0 right-0 p-2 opacity-20">
                <Coffee size={64} />
            </div>
            <div className="font-bold text-lg mb-4">{name}</div>
            <div className="flex justify-between items-end">
                <div>
                    <div className="text-xs opacity-70">Value</div>
                    <div className="text-2xl font-bold">{value}</div>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-xs font-bold">
                    Buy {cost}
                </div>
            </div>
        </div>
    )
}

function VoucherRow({ name, cost, icon, onClick }: { name: string; cost: string; icon: React.ReactNode; onClick: () => void }) {
    return (
        <div onClick={onClick} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer active:bg-slate-50">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl">
                    {icon}
                </div>
                <span className="font-bold text-slate-800">{name}</span>
            </div>
            <span className="text-blue-600 font-bold text-sm">{cost}</span>
        </div>
    )
}
