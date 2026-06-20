#!/usr/bin/env node
/**
 * One-shot: localize specific SilentPassUI production files to zh-CN.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(__dirname, '../src')

const TARGET_FILES = [
	'src/components/Home/Home.tsx',
	'src/pages/Vouchers/Market.tsx',
	'src/pages/Wallet/WalletOverview.tsx',
	'src/pages/Brands/MyBrandsPage.tsx',
	'src/components/Home/SearchBarWithResults.tsx',
	'src/components/EmbeddedPwaUpdateBanner.tsx',
]

/** Base map from localizeToZh.mjs (subset + full file parse) */
import { readFileSync } from 'node:fs'
const baseScript = readFileSync(path.join(__dirname, 'localizeToZh.mjs'), 'utf8')
const zhBlock = baseScript.match(/const ZH = \{([\s\S]*?)\n\}/)[1]
const ZH = {}
for (const m of zhBlock.matchAll(/'((?:\\'|[^'])*)':\s*'((?:\\'|[^'])*)'/g)) {
	ZH[m[1].replace(/\\'/g, "'")] = m[2].replace(/\\'/g, "'")
}

/** Extra strings for these 6 files only */
Object.assign(ZH, {
	'Update failed': '更新失败',
	'Restarting…': '正在重启…',
	'Restart': '重启',
	'Update ready ({pendingVer})': '更新已就绪 ({pendingVer})',
	'Current: {currentVer}': '当前版本：{currentVer}',
	'@BeamioTag, address, or paste link': '@BeamioTag、地址或粘贴链接',
	'Search for @BeamioTag or wallet address': '搜索 @BeamioTag 或钱包地址',
	'Scan QR code': '扫描二维码',
	'Open wallet details': '打开钱包详情',
	'Redeem admin': '兑换管理',
	'Toggle theme': '切换主题',
	'Open wallet': '打开钱包',
	'Loading linked cards': '正在加载关联卡',
	'Physical keys': '实体密钥',
	'Link NFC card': '关联 NFC 卡',
	'Total Purchasing Power': '总购买力',
	'USDC Balance': 'USDC 余额',
	'Merchant Assets': '商户资产',
	'Tap at any Beamio SoftPOS to pay seamlessly.': '在任意 Beamio SoftPOS 终端轻触即可无缝支付。',
	'See all': '查看全部',
	'No merchant brands yet.': '暂无商户品牌。',
	'Thank you for testing Beamio on Base. Your Beamio wallet has been funded with': '感谢您在 Base 上测试 Beamio。您的 Beamio 钱包已充值',
	'so you can try your first gasless payment.': '，可体验首次免 Gas 支付。',
	'View in Discover': '在发现页查看',
	'Sen Pho + Cafe': 'Sen Pho + Cafe',
	'Dismiss': '关闭',
	'Waiting...': '等待中…',
	'Linking your card': '正在关联您的卡',
	'Opening a secure session and attaching this tag to your wallet.': '正在建立安全会话并将此标签关联到您的钱包。',
	'Secured by Beamio Protocol': '由 Beamio 协议保护',
	'Physical card linked': '实体卡已关联',
	'This NFC tag is now bound to your CashTrees wallet.': '此 NFC 标签已绑定到您的 CashTrees 钱包。',
	'USDC, CADD, Beamio card balances, and membership NFTs from the tag wallet were moved to your app wallet.': '标签钱包中的 USDC、CADD、Beamio 卡余额及会员 NFT 已转入您的 App 钱包。',
	'Your home balance will refresh shortly.': '首页余额将很快刷新。',
	'Check NFC is on, then retry or close.': '请确认 NFC 已开启，然后重试或关闭。',
	'Retry scan': '重新扫描',
	'Manage your secure hardware authentication devices and access tokens.': '管理您的安全硬件认证设备与访问令牌。',
	'This device cannot read NFC. You can still manage keys already linked to your account. To register a new key, use a phone or tablet with NFC.': '此设备无法读取 NFC。您仍可管理已关联到账户的密钥。要注册新密钥，请使用带 NFC 的手机或平板。',
	'Loading keys…': '正在加载密钥…',
	'Paused hardware key': '已暂停的硬件密钥',
	'Primary hardware key': '主硬件密钥',
	'Linked hardware key': '已关联硬件密钥',
	'Paused on server': '服务端已暂停',
	'Active': '活跃',
	'Inactive': '未激活',
	'Enable': '启用',
	'Unfreeze key': '解冻密钥',
	'Set primary': '设为主设备',
	'Freeze key': '冻结密钥',
	'Register New Hardware Key': '注册新硬件密钥',
	'Beamio keys use physical-layer encryption. Freezing a key immediately revokes access across all terminal endpoints globally.': 'Beamio 密钥采用物理层加密。冻结密钥将立即在全球所有终端撤销访问。',
	'Scan to Pay': '扫码支付',
	'Position the QR code within the frame to authorize the transaction.': '将二维码置于框内以授权交易。',
	'Unlock your wallet to show pay QR.': '请解锁钱包以显示付款二维码。',
	'Could not generate pay code. Close and try again.': '无法生成付款码，请关闭后重试。',
	'Pay code expired': '付款码已过期',
	'Secure Dynamic Key': '安全动态密钥',
	'Add Funds at Store': '在门店充值',
	'Show this code to the cashier to top up your balance.': '向收银员出示此码以充值余额。',
	'Loading code…': '正在加载二维码…',
	'Add Funds': '充值',
	'Fund your self-custodial wallet or top up merchant cards.': '为您的自托管钱包充值或为商户卡充值。',
	'3rd-party platform. Auto-deposits to wallet.': '第三方平台，USDC 将自动存入钱包。',
	'them your paper cash.': '现金。',
	'CashTrees is a self-custodial wallet and never touches your fiat. You will be securely redirected to Coinbase to complete your purchase. USDC will auto-deposit to your wallet.': 'CashTrees 为自托管钱包，不接触您的法币。您将安全跳转至 Coinbase 完成购买，USDC 将自动存入钱包。',
	'Continue with Coinbase': '通过 Coinbase 继续',
	'Change': '更换',
	'Bal:': '余额：',
	'Refresh exchange rate': '刷新汇率',
	'Oracle unreachable; using app cache fallback. Use refresh to retry.': '预言机不可达，使用应用缓存。请点击刷新重试。',
	'Demo: store card balances update locally only; vault balance follows chain after refresh.': '演示：门店卡余额仅本地更新；金库余额刷新后跟随链上。',
	'Confirm Top Up': '确认充值',
	'How Beamio Alpha works': 'Beamio Alpha 如何运作',
	'How Beamio works': 'Beamio 如何运作',
	'About this 0.2 USDC': '关于这 0.2 USDC',
	'Beamio Balance': 'Beamio 余额',
	'USDC on Base': 'Base 链 USDC',
	'Gas sponsored': 'Gas 已赞助',
	'US Dollar': '美元',
	'Canadian Dollar': '加元',
	'Euro': '欧元',
	'Japanese Yen': '日元',
	'Chinese Yuan': '人民币',
	'Hong Kong Dollar': '港币',
	'New Taiwan Dollar': '新台币',
	'Singapore Dollar': '新加坡元',
	'Merchant card': '商户卡',
	'Gift merchant balance': '赠送商户余额',
	'Invalid NFC payload': '无效的 NFC 数据',
	'Wallet key is not available. Unlock your wallet and try again.': '钱包密钥不可用，请解锁钱包后重试。',
	'Wallet key is not available.': '钱包密钥不可用。',
	'This tag is still a template (SUN not enabled). Ask the merchant to finish NFC provisioning on the card before linking.': '此标签仍为模板（SUN 未启用）。请联系商户在卡上完成 NFC 配置后再关联。',
	'This card does not support secure link. Missing or invalid SUN data (e, c, m).': '此卡不支持安全关联，缺少或无效的 SUN 数据 (e, c, m)。',
	'All': '全部',
	'Shanghai Cuisine': '上海菜',
	'Health and Beauty': '健康与美容',
	'Welcome to LongDhang Inner Circle': '欢迎加入 LongDhang 内圈',
	'Unlock seamless dining and exclusive digital privileges. Top up your LongDhang Pass to enjoy instant bonus rewards.': '解锁无缝用餐与专属数字权益。充值 LongDhang Pass 即享即时奖励。',
	'About LongDhang': '关于 LongDhang',
	'Longdhang Shanghai Cuisine serves authentic, family-style dishes that capture the true taste of Old Shanghai. We specialize in traditional favorites, featuring our famous handmade Xiao Long Bao and deep-fried pork chops. Join us for a warm, welcoming dining experience that celebrates classic Shanghainese heritage.': 'LongDhang 上海菜以地道家常风味呈现老上海真味，招牌手工小笼包与炸猪排等传统名菜。欢迎光临，感受经典海派饮食。',
	'Mon-Fri: 11 am - 1 pm; 5 - 9:30 pm\nSaturday, Sunday: 11 am - 10 pm': '周一至周五：11:00–13:00；17:00–21:30\n周六、周日：11:00–22:00',
	'Welcome to STT Inner Circle': '欢迎加入 STT 内圈',
	'Unlock your journey to holistic wellness and natural beauty. Join our exclusive digital membership to access premium treatments, tailored rewards, and seamless payment experiences.': '开启整体健康与自然美容之旅。加入专属数字会员，享受优质疗程、定制奖励与无缝支付。',
	'About STT Oriental Medical': '关于 STT 东方医学',
	'STT Oriental Medical Centre Ltd. is a premier clinic specializing in customized health and beauty solutions through Traditional Chinese Medicine and natural medical aesthetics. Our experienced, multi-disciplinary team provides a comprehensive range of one-stop services, including acupuncture, osteopathic massage, preventive medicine therapies, and advanced anti-aging treatments. By combining traditional healing wisdom with modern therapeutic techniques, we are dedicated to helping you achieve optimal wellness and radiant beauty from the inside out.': 'STT 东方医学中心以中医与自然医学美容提供定制健康方案，针灸、推拿、预防医学与抗衰等一站式服务，助您由内而外焕发光彩。',
	'Mon-Sat: 9 am - 6 pm': '周一至周六：9:00–18:00',
	'VIP Privilege': 'VIP 特权',
	'10% Bonus on Every Top-Up!': '每次充值享 10% 奖励！',
	'Top up $100 CAD or more to instantly unlock a 10% bonus balance. (e.g., Add $100, receive $110). Treat yourself to authentic Shanghai cuisine anytime, with balance that never expires.': '充值满 100 加元 CAD 即享 10% 余额奖励（例：充 100 得 110）。余额永不过期，随时享用正宗上海菜。',
	'Wellness Points': '健康积分',
	'Member since 2024': '2024 年起会员',
	'BASE WELLNESS TIER': '基础健康等级',
	'Silver Wellness Tier': '白银健康等级',
	'New Member Benefit: 10% off clinical assessments': '新会员福利：临床评估 9 折',
	'View contract on ${explorerLabel}: ${address}': '在 ${explorerLabel} 查看合约：${address}',
	'User Card': '用户卡',
	'Tier': '等级',
	'Gift voucher': '礼品券',
	'Add coupon details for members': '请为会员补充优惠券详情',
	'Coupon ${row.coupon.title} already claimed': '优惠券 ${row.coupon.title} 已领取',
	'Claim coupon ${row.coupon.title}': '领取优惠券 ${row.coupon.title}',
	'Member pricing': '会员价',
	' pts to ': ' 积分升至 ',
	' pts': ' 积分',
	'Opening Hours': '营业时间',
	'Contact': '联系方式',
	'Location': '地址',
	'Available Offers': '可用优惠',
	'Coupons': '优惠券',
	' total': ' 张',
	'Loading coupons…': '正在加载优惠券…',
	'No coupons available yet.': '暂无可用优惠券。',
	'Reward Tiers': '奖励等级',
	' reward tiers': ' 个奖励等级',
	'Loading reward tiers…': '正在加载奖励等级…',
	'No reward tiers configured yet.': '尚未配置奖励等级。',
	'Copy URL for another wallet app': '复制链接供其他钱包 App 使用',
	'Complete top-up': '完成充值',
	'Modern cuisine': '现代餐饮',
	'Artisan coffee & pastries': '精品咖啡与糕点',
	'Member Benefits': '会员权益',
	'Request timed out — showing cached results': '请求超时 — 显示缓存结果',
	'Failed to load cards': '加载卡片失败',
	'Search businesses, NGOs, or friends': '搜索商户、机构或好友',
	'Search businesses, NGOs, or friends…': '搜索商户、机构或好友…',
	'Loading new cards…': '正在加载新卡…',
	'Your Assets': '您的资产',
	'Recharge Bonus': '充值奖励',
	'No cards match your search.': '没有符合筛选的卡片。',
	'Card address is unavailable.': '卡地址不可用。',
	'Failed to convert amount.': '金额换算失败。',
	'Top-up failed.': '充值失败。',
	'Top-up failed': '充值失败',
	'Close purchase panel': '关闭购买面板',
	'Add credits to CashTrees Card': '为 CashTrees 卡充值',
	'Credit amount': '充值金额',
	'Load ${prefix}${formatDollar(upgradeCapsule.amountNeededCad - amount)} more for ${upgradeCapsule.nextTierName}': '再充 ${prefix}${formatDollar(upgradeCapsule.amountNeededCad - amount)} 可升至 ${upgradeCapsule.nextTierName}',
	'Please enter a valid amount.': '请输入有效金额。',
	'Amount must be at least ${prefix}50 for first purchase.${maxAmount != null ? ` Maximum ${prefix}${formatDollar(maxAmount)}.` : ""}': '首次购买至少 ${prefix}50。${maxAmount != null ? ` 最高 ${prefix}${formatDollar(maxAmount)}。` : ""}',
	'Processing…': '处理中…',
	'Hardware + License': '硬件 + 许可',
	'Genesis Node Pack': '创世节点包',
	'The Infrastructure Backbone': '基础设施骨干',
	'Own the physical edge and the invisible engine of the Beamio network.': '拥有 Beamio 网络的物理边缘与隐形引擎。',
	'Package B': '套餐 B',
	'Compute': '算力',
	'EAL6+ Edge': 'EAL6+ 边缘',
	'Yield': '收益',
	'Dynamic E-ink Terminal': '动态电子墨水终端',
	'0.84mm flexible PCB. Off-grid identity credential auto-refreshing every 60s.': '0.84mm 柔性 PCB，离网身份凭证每 60 秒自动刷新。',
	'Global Validator License': '全球验证者许可',
	'Delegated Staking (NaaS). 1-click cloud delegation for seamless routing.': '委托质押 (NaaS)，一键云端委托实现无缝路由。',
	'5% Validator Yield': '5% 验证者收益',
	'Perpetual computational rewards from all global B-Units routing fuel consumed.': '全球 B-Unit 路由燃料消耗的永续算力奖励。',
	'Forward-looking projection based on network modeling. Yields are utility-derived computational rewards, not guaranteed financial returns.': '基于网络建模的前瞻预测。收益为效用型算力奖励，非保证财务回报。',
	'The Tangible Edge': '有形边缘',
	'Merchant Prepaid': '商户预付',
	'Limited Fuel Pack': '限量燃料包',
	'The Store Clearing Fuel': '门店清算燃料',
	'Instant clearing fuel to process your daily retail volume. System value of $1,000 USDC.': '即时清算燃料，处理日常零售流水，系统价值 1000 USDC。',
	'Package A': '套餐 A',
	'Volume': '额度',
	'Discount': '折扣',
	'100,000 B-Units Pre-load': '预载 100,000 B-Unit',
	'System value of $1,000 USDC. Instant clearing fuel to process your daily retail volume.': '系统价值 1000 USDC，即时清算燃料处理日常零售流水。',
	'50% Effective Rate Cut': '有效费率减半',
	'Effectively slashes the standard 0.8% Beamio transaction fee in half. Keep more of your hard-earned revenue.': '将标准 0.8% Beamio 交易费减半，留住更多收入。',
	'Automated Fee Deduction': '自动扣费',
	'Zero crypto friction. The system automatically burns your pre-paid fuel as consumers pay at your counter.': '零加密摩擦，消费者付款时系统自动消耗预付燃料。',
	'B-Units are internal utility protocol fuel pegged for internal system accounting. They cannot be withdrawn as fiat or traded on secondary markets.': 'B-Unit 为内部效用协议燃料，用于系统记账，不可提现法币或在二级市场交易。',
	'The Merchant Arsenal': '商户工具包',
	'HAPPENING NOW': '进行中',
	'CCSA Member Card': 'CCSA 会员卡',
	'Unlock Exclusive Dining. First Partner: Osmanthus.': '解锁专属餐饮，首家合作伙伴：Osmanthus。',
	'Your gateway to a curated network of premier restaurants. Start your journey at Osmanthus, our inaugural partner, with exclusive perks and stored value acceptance.': '通往精选顶级餐厅网络，从首家合作伙伴 Osmanthus 开始，享专属权益与储值支付。',
	'Accepted at Osmanthus & Future Partners': 'Osmanthus 及未来合作伙伴可用',
	'Priority Booking at Osmanthus': 'Osmanthus 优先订位',
	'Member-Only Tasting Menus': '会员专属品鉴菜单',
	'Future Network Expansion': '未来网络扩展',
	'CCSA Alliance': 'CCSA 联盟',
	'Aberdeen Centre, Richmond, BC': '列治文 Aberdeen Centre，BC',
	'Membership': '会员',
	'LOCAL FAVORITE': '本地人气',
	'Sen Pho + Cafe Card': 'Sen Pho + Cafe 卡',
	'Redefining Vietnamese Cuisine': '重新定义越南菜',
	'Experience authentic Vietnamese cuisine at its finest. This membership is valid at both Champlain Heights and Kerrisdale locations, offering exclusive perks for loyal patrons.': '品味正宗越南菜，Champlain Heights 与 Kerrisdale 两店通用，忠诚顾客享专属权益。',
	'10% Off All Orders': '全单 9 折',
	'Valid at Champlain Heights & Kerrisdale': 'Champlain Heights 与 Kerrisdale 可用',
	'Priority Reservations': '优先订位',
	'Birthday Dessert': '生日甜品',
	'Vancouver, BC': '温哥华，BC',
	'Carbon texture': '碳纤维纹理',
	'Pricing': '价格',
	'Server texture': '服务器纹理',
	'B-Units': 'B-Unit',
	'Detail background': '详情背景',
	'You own ${count} Nodes': '您拥有 ${count} 个节点',
	'Tap to Gift or Manage': '点击赠送或管理',
	'Global Allocation Progress': '全球配额进度',
	'LEGAL NOTE:': '法律声明：',
	'My Nodes': '我的节点',
	'Secure Another': '再 securing 一个',
	'Total Due': '应付总额',
	'Secure Node': ' securing 节点',
	'Secure Fuel': ' securing 燃料',
	'Verifying Eligibility': '正在验证资格',
	'Checking whitelist status and wallet age...': '正在检查白名单状态与钱包龄…',
	'Where should we send your Node?': '节点寄送地址？',
	'This pack includes physical hardware.': '此套餐含实体硬件。',
	'Full Name': '姓名',
	'Shipping Address': '收货地址',
	'Hardware Delivery': '硬件配送',
	'Est. 2 Weeks': '约 2 周',
	'Confirm & Pay $999': '确认并支付 $999',
	'Processing Payment': '正在处理付款',
	'Minting Genesis NFT': '正在铸造创世 NFT',
	'Securing funds on Base L2...': '正在 Base L2 上锁定资金…',
	'Deploying contract 0x71...9a2': '正在部署合约 0x71...9a2',
	'Welcome, Node #248': '欢迎，节点 #248',
	'You are now a verified infrastructure partner of the Beamio Network.': '您已成为 Beamio 网络认证基础设施合作伙伴。',
	'Transaction': '交易',
	'Revenue Share': '收益分成',
	'Enter Dashboard': '进入控制台',
	'Voucher': '优惠券',
	'You have ${count} cards': '您有 ${count} 张卡',
	'Tap to Use, Gift or Trade': '点击使用、赠送或交易',
	'Online': '线上',
	'Guaranteed': '有保障',
	'About': '关于',
	"What&apos;s Included": '包含内容',
	'Topup': '充值',
	'Reload': '再次充值',
	'Min. Load': '最低充值',
	'Purchase': '购买',
	'Just now': '刚刚',
	'ACTIVE': '活跃',
	'Active': '活跃',
	'Full': '完整',
})

function localizeContent(content) {
	let out = content
	const keys = Object.keys(ZH).sort((a, b) => b.length - a.length)
	for (const en of keys) {
		const zh = ZH[en]
		out = out.split(`'${en}'`).join(`'${zh}'`)
		out = out.split(`"${en}"`).join(`"${zh}"`)
		out = out.split(`\`${en}\``).join(`\`${zh}\``)
		out = out.split(`>${en}<`).join(`>${zh}<`)
		out = out.split(`>${en}</`).join(`>${zh}</`)
	}
	// Template literals / dynamic patterns
	out = out.replace(/\$\{Math\.round\(tier\.discountPct\)\}% DISCOUNT/g, '${Math.round(tier.discountPct)}% 折扣')
	out = out.replace(/`TOTAL \$\{total\} · LEFT \$\{remaining\}`/g, '`总量 ${total} · 剩余 ${remaining}`')
	out = out.replace(/`TOTAL \$\{total\} · LEFT --`/g, '`总量 ${total} · 剩余 --`')
	out = out.replace(/`LEFT \$\{remaining\}`/g, '`剩余 ${remaining}`')
	out = out.replace(/\{remainingPts\} pts to \{config\.nextTierLabel\}/g, '{remainingPts} 积分升至 {config.nextTierLabel}')
	out = out.replace(/aria-label=\{`View contract on \$\{explorerLabel\}: \$\{address\}`\}/g, 'aria-label={`在 ${explorerLabel} 查看合约：${address}`}')
	out = out.replace(/aria-label=\{\s*isAlreadyClaimed\s*\?\s*`Coupon \$\{row\.coupon\.title\} already claimed`\s*:\s*`Claim coupon \$\{row\.coupon\.title\}`\s*\}/g, 'aria-label={isAlreadyClaimed ? `优惠券 ${row.coupon.title} 已领取` : `领取优惠券 ${row.coupon.title}`}')
	out = out.replace(/<p className="truncate font-medium">Update ready \(\{pendingVer\}\)<\/p>/g, '<p className="truncate font-medium">更新已就绪 ({pendingVer})</p>')
	out = out.replace(/<p className="truncate text-xs text-white\/70">Current: \{currentVer\}<\/p>/g, '<p className="truncate text-xs text-white/70">当前版本：{currentVer}</p>')
	out = out.replace(/\{applying \? 'Restarting…' : 'Restart'\}/g, "{applying ? '正在重启…' : '重启'}")
	out = out.replace(/setError\(applyError \|\| 'Update failed'\)/g, "setError(applyError || '更新失败')")
	return out
}

let changed = 0
for (const rel of TARGET_FILES) {
	const file = path.join(__dirname, '..', rel)
	const before = fs.readFileSync(file, 'utf8')
	const after = localizeContent(before)
	if (after !== before) {
		fs.writeFileSync(file, after, 'utf8')
		changed++
		console.log('Updated', rel)
	}
}
console.log(`Done: ${changed} file(s).`)
