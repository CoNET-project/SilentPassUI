一、 顶部核心资产看板 (Hero Metrics)
这是老板每天早上一睁眼最关心的大盘健康度。
1. TOTAL CAPITAL RETAINED (总留存资金) - C$128,450.00
数据定义：商户当前在 VERRA 闭环系统中“欠”顾客的钱，也就是顾客提前充值但尚未消费的总金额。这是商户真正的护城河和无息现金流。
统计依据：实时遍历该商户下所有激活状态的 @BeamioTag (App用户) 和 @NFC-xxxx (匿名物理卡)，将他们账户内的 Stored Value (储值余额) 进行总和求和。
对比维度：+12.5% from last period。取过去 30 天的同期平均值进行涨跌幅对比。
2. ACTIVE CARDS (活跃卡片) - 1,204
数据定义：目前真正在流通使用、且里面有钱的顾客数字/物理账户总数。
统计依据：满足以下任一条件的账户总数：
账户 Stored Value > C$0.00。
过去 90 天内产生过至少一笔 Charge 或 Top-up 的流水。
(注：如果一张卡余额为 0 且一年没用了，应算作沉睡卡，不计入此数字)。
3. SYSTEM QUOTA (系统交互配额) - 4,860 B-Units
数据定义：商户系统的“油箱剩余油量”。提醒老板还能支撑多少次门店扫码和发卡动作。
统计依据：读取我们在 Market / Settings 页面中设计的 B-Units 总账本余额。
预警逻辑：72% OF CAPACITY REACHED。如果剩余量低于 15% (例如低于 1,000 Units)，这个进度条和数字应该变成警告色（橙色/红色），并提醒老板开启 Auto-Refill (自动充能)。
二、 中部今日营运实况 (Today's Activity)
这是用来跟门店收银机 (SoftPOS) 进行日结对账 (Daily Reconciliation) 的高频模块。时间的统计依据严格遵循商户在 Settings 里设置的本地时区 (Timezone)，从今日 00:00 算起。
1. TOP-UPS (充值总额) - C$1,240.00
数据定义：今天一天内，通过所有渠道（线下现金/刷卡、线上 USDC）新进入系统的资金总额。
统计依据：筛选 Transactions 总账本中，日期为 Today 且类型为 🟢 Top-up 的所有交易，对 Net Value 求和。底层包含 24 transactions (笔数)。
2. CHARGES (消费扣款) - C$712.50
数据定义：今天一天内，门店通过 VERRA 系统成功核销收取的营业额（包含储值扣款和 USDC 自动路由补足的扣款）。
统计依据：筛选 Transactions 总账本中，日期为 Today 且类型为 🔵 Charge 的所有交易。注意：这里求和的依据是 Total Settled (应收总额)，不包含小费，且必须是扣除折扣后的实收金额。
3. TIPS (员工小费) - C$177.75
数据定义：今天通过系统额外收取的员工小费。这笔钱属于员工，对财务来说是需要单独剥离的应付账款。
统计依据：在今天所有的 Charge 交易记录中，提取 Staff Tip 字段的值并独立求和。
4. NFC ACTIVATIONS (新卡激活) - 12 Cards
数据定义：今天门店收银员发出去的新实体卡数量。这是拉新指标。
统计依据：筛选 Transactions 中类型为 🪪 Link (发卡) 的记录数。
下钻细分：8 ANON (纯匿名发卡) + 4 APP (顾客当场掏出手机 App 绑定了这张 NFC 卡)。这个比例老板极其看重，因为它代表了线下流量向线上私域的转化率。
三、 底部深度洞察图表 (Behavioral Insights)
这里展现的是 VERRA 作为“智能 Business OS”的分析威力。
1. RELOAD VELOCITY (复充率动能)
数据定义：顾客账户里没钱了之后，多快会再次充钱？这反映了顾客对品牌的“成瘾度”。
统计依据：
AVG. TIME (平均复充耗时)：14.2m (天/月，此处 14.2m 应该是 months 或者 minutes？建议前端统一标为 days 比如 14.2 Days)。取顾客上一次余额降至 $5 以下，到下一次发生 Top-up 之间的时间差的平均值。
PEAK HOUR (充值高峰)：11:00 AM。统计历史 Top-up 行为发生最密集的时间段。
STATUS：Accelerating (加速中)，意味着最近的平均复充间隔比上个月变短了。
2. GIFT PACK CONVERSIONS (礼包核销漏斗)
数据定义：商户在 Programs 里配置并发出去的“营销礼券”，到底带来了多少真实的到店消费。
统计依据 (漏斗三步走)：
Discovery (曝光/发现)：2,480。用户在 Consumer App 的消息列表里，或者外部扫码看到了这个礼包的次数。
Selection (领取/保存)：840。用户点击了“Save to Wallet”将其存入数字钱包的次数。
Redemption (核销/使用)：422。这必须是底层系统在 Transactions 里读取到了对应 Voucher Code 的真实核销记录才算数。
TOTAL EFFICIENCY (总体转化率)：422 / 2480 = 17.2%。
总结：
这份 Dashboard 是我见过的 Web2.5 产品中最克制、最懂传统零售老板心理的看板。它完美屏蔽了底层区块链的复杂性（Hash、智能合约等留在了流水详情页里），而在首页展示的全部是拉新、留存、复购、利润。

