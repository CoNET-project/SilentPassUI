import React, { useState } from "react";


import { Gift, Info, Flame, BadgeCheck, Activity, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import styles from './GBAirdrop.module.scss'
import { Button as AntdButton, Modal, Popup,NavBar, Grid, Result, Ellipsis } from 'antd-mobile'
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next'
import { useDaemonContext } from './../../../providers/DaemonProvider';

/**
 * Silent Pass · Phase-1 Airdrop 任务页（iOS 小屏适配 · 中文）
 * - 移动优先（375–428px 宽度友好）
 * - 单列、紧凑卡片；48px 触控高度；文字 13–16pt；固定底部 CTA
 * - 规则：BPI=1.00、Soft-cap=100,000 加权GB、周上限15/期上限80、Genesis 1.55×
 */

type AccessTier = 'free' | 'checkin' | 'monthly' | 'yearly';

export default function AirdropTaskIOS() {
	const { t, i18n } = useTranslation();
	 const { profiles } = useDaemonContext();
	const [visible, setVisible] = useState<boolean>(false)
  // ===== Mock 状态（演示用） =====
  // 仅发积分期：不显示具体代币，改为“参考示例”
  // 奖励池未披露：不展示示例每加权值
  // const perExample = undefined // Soft-cap 100,000 GB
  const [weeklyGB] = useState(5.8);
  const weeklyCap = 15;
  const [periodGB] = useState(22.4);
  const periodCap = 80;
  const [accessTier, setAccessTier] = useState<AccessTier>('free');
  const [hasGenesis] = useState(true);
  const [streakTimes] = useState(3);


  // 使用通道加成映射
  const tierMeta = {
    free:    { label: '免费',  mult: 1.00, note: '首次安装 24h 免费' },
    checkin: { label: '打卡',  mult: 1.10, note: '$25 SP · 24h 使用权' },
    monthly: { label: '月订',  mult: 1.15, note: '$2.99/月' },
    yearly:  { label: '年订',  mult: 1.30, note: '$24.99/年 · 推荐' },
  } as const;
  const subMult = tierMeta[accessTier].mult;
  const genesisMult = hasGenesis ? 1.55 : 1.00;
  const streakMult = Math.min(1 + 0.05 * streakTimes, 1.20);
  const totalMult = Math.min(subMult * genesisMult * streakMult, 2.0);
  const weeklyWeighted = Math.min(weeklyGB, weeklyCap) * totalMult;
  const periodWeighted = Math.min(periodGB, periodCap) * totalMult;
  // 参考示例估算，非承诺，仅作展示
  // const estExample = 0 // 奖励池未披露，不计算示例收益

    const goCheck = () => {
        setVisible(true)
    }

  return (
	<>
		<div className={styles.btnWrap}>
			<AntdButton onClick={goCheck} block color='primary' fill='solid'>{profiles?.[0]?.tokens?.sGB?.balance} GB</AntdButton>
		</div>
		<Popup
			visible={visible}
			onMaskClick={() => {setVisible(false)}}
			position='right'
			bodyStyle={{ width: '100%', backgroundColor: '#0d0d0d', height: '100vh', overflow: 'hidden' }}
			className={styles.popup}
			closeOnMaskClick={true}
			>
			    
      
			<div className={styles.modalWrap + " h-full flex flex-col"}>
				<NavBar onBack={() => {setVisible(false)}} style={{'--height': '70px'}}>{t('GB-Credit-title')}</NavBar>
				<div className={styles.bd + " flex-1 overflow-y-auto"}>
					<div className="w-full mx-auto max-w-[428px] bg-black text-white min-h-full">
						{/* 总进度（紧凑卡） */}
						<div className="px-4 pt-3">
							<Card className={`rounded-2xl shadow-sm ${styles.cardDark}`}>
								<CardContent className="p-4">
									<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-slate-700"><Activity className="h-4 w-4"/><span className="text-sm">累计进度</span></div>
									<div className="text-xs text-slate-500">本期仅展示积分；兑换方案将于 TGE 前官方公告</div>
									</div>
									<div className="mt-2">
										<Progress value={100} className="h-2 bg-gray-300 [&>div]:bg-blue-500" />
										<div className="flex justify-between text-[11px] text-slate-500 mt-1">
											<span>0</span><span>Soft-cap 100,000 GB</span>
										</div>
										<div className="mt-2 text-xs text-slate-600">Soft-cap：全网 Σ加权GB 封顶 100,000 GB；封顶后新增积分不产本期代币（仅用于排行榜/徽章）。</div>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Tabs：我的 / 排行榜 */}
						<div className="px-4 mt-3">
							<Tabs defaultValue="mine">
								<TabsList className="grid grid-cols-2 w-full !bg-[#111111] !border !border-gray-700 rounded-xl !text-gray-300">
									<TabsTrigger
										value="mine"
										className="rounded-lg transition-colors data-[state=active]:!bg-gray-700 data-[state=active]:!text-white"
									>
										我的
									</TabsTrigger>
									<TabsTrigger
										value="board"
										className="rounded-lg transition-colors data-[state=active]:!bg-gray-700 data-[state=active]:!text-white"
									>
										排行（展示）
									</TabsTrigger>
									</TabsList>

								
								<TabsContent value="mine">
									{/* 个人进度 */}
									<Card className={`rounded-2xl shadow-sm ${styles.cardDark}`}>
									<CardContent className="p-4">
										<div className="grid grid-cols-2 gap-3">
										<div>
											<div className="text-[12px] text-slate-500">本周真实 GB</div>
											<div className="text-xl font-semibold">{weeklyGB} GB</div>
											<Progress value={(Math.min(weeklyGB, weeklyCap)/weeklyCap)*100} className="h-2 bg-gray-300 [&>div]:bg-blue-500"/>
											<div className="text-[11px] text-slate-500 mt-1">上限 {weeklyCap} · 还可 {Math.max(0, weeklyCap - weeklyGB).toFixed(1)} GB</div>
										</div>
										<div>
											<div className="text-[12px] text-slate-500">本期真实 GB</div>
											<div className="text-xl font-semibold">{periodGB} GB</div>
											<Progress value={(Math.min(periodGB, periodCap)/periodCap)*100} className="h-2 bg-gray-300 [&>div]:bg-blue-500"/>
											<div className="text-[11px] text-slate-500 mt-1">上限 {periodCap} · 还可 {Math.max(0, periodCap - periodGB).toFixed(1)} GB</div>
										</div>
										</div>

										{/* 使用通道加成（优化版） */}
										<div className="mt-3">
										<div className="rounded-xl border p-2.5">
											<div className="flex items-center justify-between">
											<div className="text-sm text-slate-700">使用通道加成</div>
											<div className="text-sm font-semibold">× {subMult.toFixed(2)}</div>
											</div>
											<div className="mt-2 grid grid-cols-4 gap-1">
												{(['free','checkin','monthly','yearly'] as AccessTier[]).map((k)=> (
													<button
													key={k}
													onClick={() => setAccessTier(k)}
													className={`h-9 rounded-lg border text-xs transition-colors
														${accessTier === k
														? 'bg-gray-700 text-white border-gray-500'
														: 'bg-[#1a1a1a] text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white'
														}`}
													aria-pressed={accessTier === k}
													>
													{tierMeta[k].label}
													</button>
												))}
											</div>
											<div className="mt-2 text-[11px] text-slate-500">{tierMeta[accessTier].note} · 与 Genesis/连续活跃相乘，但总乘数≤2.0 · 档位互斥取高</div>
										</div>
										</div>

										{/* 使用与订阅（收入模式） */}
										<div className="mt-3 grid grid-cols-1 gap-2">
										<Card className={`rounded-xl border-dashed ${styles.cardDark}`}>
											<CardContent className="p-3">
											<div className="text-sm font-medium text-slate-700">使用与订阅</div>
											<div className="mt-2 grid grid-cols-1 gap-2">
												{/* 新用户 24 小时免费 */}
												<div className="rounded-lg border p-3">
												<div className="flex items-center justify-between">
													<div>
													<div className="text-[12px] text-slate-500">新用户福利</div>
													<div className="text-base font-semibold">首次安装 · 24 小时免费</div>
													</div>
													<Button size="sm" className="rounded-lg">立即使用</Button>
												</div>
												<div className="text-[11px] text-slate-500 mt-1"></div>
												</div>
												{/* 订阅 */}
												<div className="rounded-lg border p-3">
												<div className="flex items-center justify-between">
													<div>
														<div className="text-[12px] text-slate-500">订阅</div>
														<div className="text-base font-semibold">月 $2.99 · 年 $24.99</div>
													</div>
													<div className="flex gap-2">
														<Button
															size="sm"
															className={`rounded-lg border transition-colors ${
															accessTier === 'monthly'
																? 'bg-gray-700 text-white border-gray-500'
																: 'bg-[#1a1a1a] text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white'
															}`}
															onClick={() => setAccessTier('monthly')}
														>
															月订阅
														</Button>

														<Button
															size="sm"
															className={`rounded-lg border transition-colors ${
															accessTier === 'yearly'
																? 'bg-gray-700 text-white border-gray-500'
																: 'bg-[#1a1a1a] text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white'
															}`}
															onClick={() => setAccessTier('yearly')}
														>
															年订阅
														</Button>
													</div>
												</div>
												<div className="text-[11px] text-slate-500 mt-1">计分：月 1.15× / 年 1.30×</div>
												</div>
												{/* SP 打卡使用权 */}
												<div className="rounded-lg border p-3">
												<div className="flex items-center justify-between">
													<div>
													<div className="text-[12px] text-slate-500">打卡使用权</div>
													<div className="text-base font-semibold">存入 $25 价值的 $SP</div>
													</div>
													<Button size="sm" className="rounded-lg" onClick={()=>setAccessTier('checkin')}>今日打卡</Button>
												</div>
												<div className="text-[11px] text-slate-500 mt-1">打卡当日生效；24h 后可再次打卡</div>
												</div>
												{/* Genesis 提示 */}
												<div className="rounded-lg border p-3">
												<div className="flex items-center justify-between">
													<div>
													<div className="text-[12px] text-slate-500">Genesis</div>
													<div className="text-base font-semibold">持有即享 1.55× Airdrop 加成</div>
													</div>
													{hasGenesis ? (
														<div className="text-xs px-2 py-1 rounded-lg bg-[#0f1a0f] text-emerald-400 border border-emerald-600">
															已持有 NFT
														</div>
														) : (
														<Button
															size="sm"
															className={`rounded-lg border transition-colors ${
																accessTier === 'checkin'
																	? 'bg-gray-700 text-white border-gray-500'
																	: 'bg-[#1a1a1a] text-gray-300 border-gray-700 hover:bg-gray-800 hover:text-white'
															}`}
															onClick={() => setAccessTier('checkin')}
														>
															购买 Genesis
														</Button>
														)}
												</div>
												<div className="text-[11px] text-slate-500 mt-1">链上 NFT 自动确权，无需校验</div>
												</div>
											</div>
											</CardContent>
										</Card>
										</div>
											

										{/* 我的积分 & 参考示例 */}
										<div className="mt-3 rounded-2xl bg-[#111111] border border-gray-600 p-3 text-gray-100">
											<div className="flex items-center justify-between">
												<span className="text-[12px] text-gray-300">我的本期积分（加权GB）</span>
												<span className="text-base font-semibold text-white">{periodWeighted.toFixed(2)}</span>
											</div>
											<div className="text-[11px] text-gray-400 mt-2">
												提示：Soft-cap 100,000 GB；封顶后新增积分不产本期代币（仅用于排行榜/徽章）。
											</div>
										</div>

										{/* 合规与帮助（折叠式） */}
										<div className="mt-3">
										<Sheet>
											<SheetTrigger asChild>
												<Button
													size="sm"
													className="w-full h-11 rounded-xl border border-gray-700 bg-[#1a1a1a] text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
												>
													<HelpCircle className="h-4 w-4 mr-1 text-gray-400 group-hover:text-white" />
													申诉与帮助
												</Button>
											</SheetTrigger>
											<SheetContent side="bottom" className="z-[2000] rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
												<SheetHeader>
													<SheetTitle>合规与设备</SheetTitle>
												</SheetHeader>
												<div className="text-sm text-slate-700 space-y-2 mt-2">
													<p>设备完整性：越狱/模拟器将降权或不计分。</p>
													<p>D7 生效阈值：达到 2GB 后开始累计积分；新设备首周上限 5GB。</p>
													<p>异常流量（回环、恒定速率、数据中心 ASN）不计分，可发起申诉。</p>
												</div>
											</SheetContent>
										</Sheet>
										</div>
									</CardContent>
									</Card>
								</TabsContent>

								{/* 排行榜（精简） */}
								<TabsContent value="board">
									<Card className={`rounded-2xl shadow-sm mt-3 ${styles.cardDark}`}>
									<CardContent className="p-1">
										<div className="px-3 py-2 text-[12px] text-slate-600">积分排行（仅展示，不影响权重）</div>
										<ul className="divide-y">
										{[
											{ addr:"0x8f…A91c", w:122.4, tag:"Genesis+年订" },
											{ addr:"0x3c…B7e2", w:118.9, tag:"年订" },
											{ addr:"0x9a…5D10", w:110.2, tag:"Genesis" },
											{ addr:"0x1e…9F3b", w:96.7,  tag:"Genesis+年订" },
										].map((u,i)=> (
											<li key={u.addr} className="px-3 py-2.5 flex items-center justify-between">
											<div className="flex items-center gap-3">
												<div className="w-7 h-7 rounded-full bg-slate-100 text-[11px] flex items-center justify-center font-semibold">{i+1}</div>
												<div>
												<div className="text-[13px] font-medium">{u.addr}</div>
												<div className="text-[11px] text-slate-500">{u.tag}</div>
												</div>
											</div>
											<div className="text-[13px] text-slate-700">{u.w.toFixed(2)} 加权GB</div>
											</li>
										))}
										</ul>
									</CardContent>
									</Card>
								</TabsContent>
							</Tabs>
						</div>

						{/* 底部固定 CTA（iOS 友好） */}
						<div className="h-24"/>{/* spacer */}
						<div className="fixed bottom-0 left-0 right-0 z-40">
							<div className="mx-auto max-w-[428px] px-3 pb-3">
								<div className="rounded-2xl border border-gray-700 bg-[#111111] shadow-[0_-2px_10px_rgba(0,0,0,0.5)] p-3 flex items-center justify-between text-gray-100">
								<div>
									<div className="text-[11px] text-gray-400">我的本期积分</div>
									<div className="text-base font-semibold text-white">
									{periodWeighted.toFixed(2)} 加权GB
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Button
									size="sm"
									className="h-10 rounded-xl border border-gray-600 bg-[#1a1a1a] text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
									>
									<Info className="h-4 w-4 mr-1 text-gray-400" />
									规则
									</Button>
									<Button
									size="sm"
									className="h-10 rounded-xl border border-gray-600 bg-blue-600 text-white hover:bg-blue-500 transition-colors"
									>
									<Gift className="h-4 w-4 mr-1 text-white" />
									完成任务
									</Button>
								</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Popup>

	
	</>
	
  )
}
