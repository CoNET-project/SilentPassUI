import React, { useState } from "react";
import { Gift, Info, Flame, BadgeCheck, Activity, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Silent Pass · Phase-1 Airdrop 任务页（iOS 小屏适配 · 中文）
 * - 移动优先（375–428px 宽度友好）
 * - 单列、紧凑卡片；48px 触控高度；文字 13–16pt；固定底部 CTA
 * - 规则：BPI=1.00、Soft-cap=100,000 加权GB、周上限15/期上限80、Genesis 1.55×
 */

const fmt = (n:number) => n.toLocaleString("zh-CN");

export default function AirdropTaskIOS() {
  // ===== Mock 状态（演示用） =====
  // 仅发积分期：不显示具体代币，改为“参考示例”
  const P_EXAMPLE = 20_000_000; // 示例：官方公告前的参考值
  const perExample = P_EXAMPLE / 100000; // Soft-cap 100,000 GB -> 每加权积分GB ≈ perExample
  const [weeklyGB] = useState(5.8);
  const weeklyCap = 15;
  const [periodGB] = useState(22.4);
  const periodCap = 80;
  const [accessTier, setAccessTier] = useState<'free'|'checkin'|'monthly'|'yearly'>('free');
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
  const estExample = Math.floor(periodWeighted * perExample);

  return (
    <div className="w-full mx-auto max-w-[428px] bg-white text-slate-900">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b px-4 py-2.5 flex items-center justify-between">
        <div className="text-base font-semibold">Airdrop 任务</div>
        <Sheet>
          <SheetTrigger asChild>
            <Button size="sm" variant="ghost" className="h-9 px-2 text-slate-600"><Info className="h-5 w-5"/></Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>规则速览</SheetTitle>
            </SheetHeader>
            <div className="text-sm text-slate-700 space-y-2 mt-2">
              <ul className="list-disc pl-5 space-y-1">
                <li>资格由链上 NFT 自动确权：免费 / 打卡 / 订阅 / Genesis。</li>
                <li>计分：加权GB = min(GB,15) × 使用通道 × Genesis × 连续活跃；总乘数≤2.0；BPI=1.00。</li>
                <li>上限：15GB/周；80GB/期。</li>
                <li>生效：D7≥2GB 后开始累计；新设备首周≤5GB。</li>
                <li>Soft-cap：全网 Σ加权GB 封顶 100,000 GB；封顶后（示例）每加权≈{fmt(perExample)}。</li>
                <li>异常流量不计分：数据中心 ASN / 回环 / 恒速等；可申诉。</li>
                <li>本期为空投积分展示；兑换方案将于 TGE 前官方公告。</li>
              </ul>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* 总进度（紧凑卡） */}
      <div className="px-4 pt-3">
        <Card className="rounded-2xl shadow-sm border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700"><Activity className="h-4 w-4"/><span className="text-sm">累计进度</span></div>
              <div className="text-xs text-slate-500">参考示例：每加权积分GB ≈ {fmt(perExample)}</div>
            </div>
            <div className="mt-2">
              <Progress value={100} className="h-2" />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>0</span><span>Soft-cap 100,000 GB</span>
              </div>
              <div className="mt-2 text-xs text-slate-600">兑换方案将于 TGE 前通过官方公告发布</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs：我的 / 排行榜 */}
      <div className="px-4 mt-3">
        <Tabs defaultValue="mine">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="mine">我的</TabsTrigger>
            <TabsTrigger value="board">排行（展示）</TabsTrigger>
          </TabsList>

          {/* 我的 */}
          <TabsContent value="mine">
            {/* 个人进度 */}
            <Card className="rounded-2xl shadow-sm mt-3">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[12px] text-slate-500">本周真实 GB</div>
                    <div className="text-xl font-semibold">{weeklyGB} GB</div>
                    <Progress value={(Math.min(weeklyGB, weeklyCap)/weeklyCap)*100} className="h-2 mt-1.5"/>
                    <div className="text-[11px] text-slate-500 mt-1">上限 {weeklyCap} · 还可 {Math.max(0, weeklyCap - weeklyGB).toFixed(1)} GB</div>
                  </div>
                  <div>
                    <div className="text-[12px] text-slate-500">本期真实 GB</div>
                    <div className="text-xl font-semibold">{periodGB} GB</div>
                    <Progress value={(Math.min(periodGB, periodCap)/periodCap)*100} className="h-2 mt-1.5"/>
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
                      {(['free','checkin','monthly','yearly'] as const).map((k)=> (
                        <button
                          key={k}
                          onClick={()=>setAccessTier(k)}
                          className={`h-9 rounded-lg border text-xs ${accessTier===k? 'bg-slate-900 text-white border-slate-900':'bg-white text-slate-700 hover:bg-slate-50'}`}
                          aria-pressed={accessTier===k}
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
                  <Card className="rounded-xl border-dashed">
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
                              <Button size="sm" variant="outline" className="rounded-lg" onClick={()=>setAccessTier('monthly')}>月订阅</Button>
                              <Button size="sm" className="rounded-lg" onClick={()=>setAccessTier('yearly')}>年订阅</Button>
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
                              <div className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">已持有 NFT</div>
                            ) : (
                              <Button size="sm" className="rounded-lg">购买 Genesis</Button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">链上 NFT 自动确权，无需校验</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                    

{/* 我的积分 & 参考示例 */}
                <div className="mt-3 rounded-2xl bg-slate-50 border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-600">我的本期积分（加权GB）</span>
                    <span className="text-base font-semibold">{periodWeighted.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 rounded-xl border p-3 text-center">
                    <div className="text-[11px] text-slate-500">参考示例</div>
                    <div className="text-base font-semibold mt-1">{fmt(estExample)}</div>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2">以上示例仅供参考，最终以官方公告公布为准。</div>
                </div>

                {/* 合规与帮助（折叠式） */}
                <div className="mt-3">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="w-full h-11 rounded-xl"><HelpCircle className="h-4 w-4 mr-1"/> 申诉与帮助</Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
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
            <Card className="rounded-2xl shadow-sm mt-3">
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
      <div className="h-20"/>{/* spacer */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-[428px] px-3 pb-3">
          <div className="rounded-2xl border bg-white shadow-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500">我的本期积分</div>
              <div className="text-base font-semibold">{periodWeighted.toFixed(2)} 加权GB</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-10 rounded-xl"><Info className="h-4 w-4 mr-1"/> 规则</Button>
              <Button size="sm" className="h-10 rounded-xl"><Gift className="h-4 w-4 mr-1"/> 完成任务</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
