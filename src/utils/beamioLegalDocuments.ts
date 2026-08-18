import type { BeamioUiLocale } from '@/locale/i18n'

export type BeamioLegalDocId = 'privacy' | 'terms'

export type BeamioLegalBlock =
	| { kind: 'p'; text: string }
	| { kind: 'ul'; items: string[] }

export type BeamioLegalSection = {
	heading: string
	blocks: BeamioLegalBlock[]
	subsections?: Array<{ heading: string; blocks: BeamioLegalBlock[] }>
}

export type BeamioLegalDocument = {
	id: string
	title: string
	lastUpdatedLabel?: string
	intro: string[]
	notice?: string
	sections: BeamioLegalSection[]
	contactEmail?: string
	contactLead?: string
}

const CONTACT_EMAIL = 'support@beamio.app'

const PRIVACY_EN: BeamioLegalDocument = {
	id: 'privacy',
	title: 'BEAMIO GLOBAL PRIVACY POLICY',
	lastUpdatedLabel: 'Last Updated: August 16, 2026',
	intro: [
		'This Privacy Policy explains how the applicable Beamio operating entity (defined below) (“Beamio”, “we”, “us”, or “our”) collects, uses, and shares information when you use our website at beamio.app, related non-custodial interfaces, and services (the “Service”).',
	],
	sections: [
		{
			heading: '1. DATA CONTROLLER & JURISDICTIONAL ROUTING',
			blocks: [{ kind: 'p', text: 'Your Data Controller depends on your legally declared residency:' }],
			subsections: [
				{
					heading: '(a) US Residents:',
					blocks: [{ kind: 'p', text: 'BEAMIO, INC., a Delaware corporation (File Number: 10419778).' }],
				},
				{
					heading: '(b) ROW Residents (Rest of World):',
					blocks: [
						{
							kind: 'p',
							text: 'BEAMIO CANADA INC., a British Columbia corporation (Incorporation Number: BC1598247).',
						},
					],
				},
			],
		},
		{
			heading: '2. ZERO-KNOWLEDGE & LOCAL ENCRYPTION (WHAT WE DO NOT COLLECT)',
			blocks: [],
			subsections: [
				{
					heading: '2.1 No Custodial Data.',
					blocks: [
						{
							kind: 'p',
							text: 'Beamio operates a non-custodial infrastructure. We NEVER collect, transmit, or store your private keys, seed phrases, or business account passwords. As indicated in our interface, your business credentials are PROTECTED BY LOCAL ENCRYPTION on your device.',
						},
					],
				},
				{
					heading: '2.2 No IP/Location Tracking.',
					blocks: [
						{
							kind: 'p',
							text: 'As a privacy-preserving network, we DO NOT automatically track, log, or collect your IP address or geolocation data.',
						},
					],
				},
			],
		},
		{
			heading: '3. WHAT WE DO COLLECT',
			blocks: [
				{
					kind: 'p',
					text: 'We collect only what is strictly necessary for operational functionality and legal compliance:',
				},
			],
			subsections: [
				{
					heading: '3.1 Self-Attested Information.',
					blocks: [
						{
							kind: 'p',
							text: 'We collect the "Tax Residency / Jurisdiction" and business handle (@yourbusiness) that you manually provide during onboarding to ensure regulatory and tax compliance.',
						},
					],
				},
				{
					heading: '3.2 Support Information.',
					blocks: [
						{
							kind: 'p',
							text: 'Any email addresses or details you voluntarily provide when contacting support.',
						},
					],
				},
				{
					heading: '3.3 Non-Custodial Public Data.',
					blocks: [
						{
							kind: 'p',
							text: 'Public wallet addresses, transaction hashes, and smart contract interactions related to the Service.',
						},
					],
				},
			],
		},
		{
			heading: '4. HOW WE USE INFORMATION',
			blocks: [
				{ kind: 'p', text: 'We use the collected information exclusively to:' },
				{
					kind: 'ul',
					items: [
						'Provide and maintain the non-custodial interface;',
						'Calculate and remit applicable statutory indirect taxes (e.g., GST/HST, US Sales Tax) based on your self-attested jurisdiction;',
						'Execute risk-control ("Slashing") protocols in the event of documented fiat chargebacks or fraud;',
						'Comply with overriding legal and financial reporting obligations.',
					],
				},
			],
		},
		{
			heading: '5. HOW WE SHARE INFORMATION',
			blocks: [
				{ kind: 'p', text: 'We do not sell your personal information. We may share information with:' },
				{
					kind: 'ul',
					items: [
						'Intercompany Affiliates: Between Beamio, Inc. and Beamio Canada Inc. strictly for technical R&D, royalty settlement, and compliance auditing under arm’s length intercompany agreements.',
						'Service Providers: Third-party infrastructure partners (e.g., payment gateways like Stripe for fiat processing).',
						'Legal Authorities: When strictly required by a valid subpoena or tax audit (e.g., CRA or IRS).',
					],
				},
			],
		},
		{
			heading: '6. DATA RETENTION & BLOCKCHAIN IMMUTABILITY',
			blocks: [
				{
					kind: 'p',
					text: 'We retain self-attested jurisdiction and billing records for a minimum of seven (7) years to satisfy North American tax audit requirements. You explicitly acknowledge that any data broadcasted to a decentralized blockchain network (such as Base) becomes public, immutable, and cannot be erased or modified by Beamio.',
				},
			],
		},
		{
			heading: '7. CONTACT US',
			blocks: [
				{
					kind: 'p',
					text: 'If you have questions regarding this Privacy Policy, please contact our Compliance Officer at:',
				},
			],
		},
	],
	contactEmail: CONTACT_EMAIL,
	contactLead: 'If you have questions regarding this Privacy Policy, please contact our Compliance Officer at:',
}

const PRIVACY_ZH: BeamioLegalDocument = {
	id: 'privacy',
	title: 'BEAMIO 全球隐私政策',
	lastUpdatedLabel: '最后更新日期：2026年8月16日',
	intro: [
		'本隐私政策解释了适用的 Beamio 运营实体（定义见下文）（“Beamio”、“我们”或“我们的”）在您使用我们的 beamio.app 网站、相关的非托管界面和服务（“服务”）时如何收集、使用和共享信息。',
	],
	sections: [
		{
			heading: '1. 数据控制者与管辖权路由',
			blocks: [{ kind: 'p', text: '您的数据控制者取决于您合法声明的居住地：' }],
			subsections: [
				{
					heading: '(a) 美国居民：',
					blocks: [{ kind: 'p', text: '特拉华州公司 BEAMIO, INC.（档案号：10419778）。' }],
				},
				{
					heading: '(b) 全球其他地区 (ROW) 居民：',
					blocks: [
						{
							kind: 'p',
							text: '不列颠哥伦比亚省公司 BEAMIO CANADA INC.（注册号：BC1598247）。',
						},
					],
				},
			],
		},
		{
			heading: '2. 零知识与本地加密（我们不收集什么）',
			blocks: [],
			subsections: [
				{
					heading: '2.1 无托管数据。',
					blocks: [
						{
							kind: 'p',
							text: 'Beamio 运营非托管基础设施。我们从不收集、传输或存储您的私钥、助记词或商业账户密码。正如我们界面所示，您的商业凭据在您的设备上受本地加密保护 (PROTECTED BY LOCAL ENCRYPTION)。',
						},
					],
				},
				{
					heading: '2.2 无 IP/位置追踪。',
					blocks: [
						{
							kind: 'p',
							text: '作为一个保护隐私的网络，我们绝不自动追踪、记录或收集您的 IP 地址或地理位置数据。',
						},
					],
				},
			],
		},
		{
			heading: '3. 我们收集什么',
			blocks: [{ kind: 'p', text: '我们仅收集为实现运营功能和法律合规所绝对必要的信息：' }],
			subsections: [
				{
					heading: '3.1 自我声明信息。',
					blocks: [
						{
							kind: 'p',
							text: '我们收集您在入驻期间手动提供的“税务管辖区”和商业句柄（@yourbusiness），以确保监管和税务合规。',
						},
					],
				},
				{
					heading: '3.2 支持信息。',
					blocks: [{ kind: 'p', text: '您在联系支持时自愿提供的任何电子邮件地址或详细信息。' }],
				},
				{
					heading: '3.3 非托管公开数据。',
					blocks: [{ kind: 'p', text: '与服务相关的公开钱包地址、交易哈希和智能合约交互。' }],
				},
			],
		},
		{
			heading: '4. 我们如何使用信息',
			blocks: [
				{ kind: 'p', text: '我们将收集的信息专门用于：' },
				{
					kind: 'ul',
					items: [
						'提供并维护非托管界面；',
						'根据您自我声明的管辖区，计算并代缴适用的法定间接税（例如，GST/HST、美国销售税）；',
						'在发生有记录的法币拒付或欺诈时，执行风控（“罚没 / Slashing”）协议；',
						'遵守压倒性的法律和财务报告义务。',
					],
				},
			],
		},
		{
			heading: '5. 我们如何共享信息',
			blocks: [
				{ kind: 'p', text: '我们绝不将您的个人信息出售。我们可能会与以下各方共享信息：' },
				{
					kind: 'ul',
					items: [
						'集团内关联公司：在严格的独立企业间协议下，Beamio, Inc. 与 Beamio Canada Inc.之间为技术研发、特许权使用费结算和合规审计共享数据。',
						'服务提供商：第三方基础设施合作伙伴（例如，用于法币处理的 Stripe 等支付网关）。',
						'法律机构：当有效的传票或税务审计（如 CRA 或 IRS）严格要求时。',
					],
				},
			],
		},
		{
			heading: '6. 数据留存与区块链不可篡改性',
			blocks: [
				{
					kind: 'p',
					text: '我们将自我声明的管辖区和账单记录至少保留七 (7) 年，以满足北美税务审计的要求。您明确承认，任何广播到去中心化区块链网络（如 Base）的数据都将成为公开、不可篡改的，且无法由 Beamio 擦除或修改。',
				},
			],
		},
		{
			heading: '7. 联系我们',
			blocks: [{ kind: 'p', text: '如果您对本隐私政策有任何疑问，请联系我们的合规官：' }],
		},
	],
	contactEmail: CONTACT_EMAIL,
	contactLead: '如果您对本隐私政策有任何疑问，请联系我们的合规官：',
}

const TERMS_EN: BeamioLegalDocument = {
	id: 'terms',
	title: 'BEAMIO WEBSITE GENERAL TERMS OF USE',
	lastUpdatedLabel: 'Last Updated: August 16, 2026',
	intro: [
		'These Terms of Use (the “Terms”) constitute a legally binding agreement between you (“you” or “user”) and the applicable Beamio operating entity (defined below) governing your access to and use of the beamio.app website and any related non-custodial web interfaces (collectively, the “Site” or “Interface”).',
	],
	notice: 'IMPORTANT – READ CAREFULLY:',
	sections: [
		{
			heading: '1. CONTRACTING ENTITY & JURISDICTIONAL ROUTING',
			blocks: [
				{
					kind: 'p',
					text: 'Your contracting entity depends on your residency and primary jurisdiction of operation:',
				},
			],
			subsections: [
				{
					heading: '(a) US Residents:',
					blocks: [
						{
							kind: 'p',
							text: 'If you are a resident or domiciled entity of the United States of America, your agreement is with BEAMIO, INC., a Delaware corporation (File Number: 10419778).',
						},
					],
				},
				{
					heading: '(b) ROW Residents:',
					blocks: [
						{
							kind: 'p',
							text: 'If you are a resident or domiciled entity of any country outside the United States (Rest of World), your agreement is with BEAMIO CANADA INC., a British Columbia corporation (Incorporation Number: BC1598247).',
						},
						{
							kind: 'p',
							text: '(Collectively referred to herein as "Beamio", "we", "us", or "our").',
						},
					],
				},
			],
		},
		{
			heading: '2. INTERFACE NATURE & TRANSACTIONAL EULA',
			blocks: [],
			subsections: [
				{
					heading: '2.1 Non-Custodial Interface.',
					blocks: [
						{
							kind: 'p',
							text: 'Beamio strictly operates as a non-custodial graphical user interface. We do not hold your funds, take custody of your private keys, or control your on-chain digital assets.',
						},
					],
				},
				{
					heading: '2.2 Specific EULA Applies.',
					blocks: [
						{
							kind: 'p',
							text: 'These Terms govern your general browsing and interaction with the Site. However, any purchase of B-Units, Genesis Full-Nodes, or execution of commercial SaaS transactions shall be exclusively governed by the applicable End User License Agreement (EULA) presented to you at checkout based on your declared jurisdiction. In the event of a conflict between these Terms and the EULA, the EULA shall prevail.',
						},
					],
				},
			],
		},
		{
			heading: '3. NO FINANCIAL OR LEGAL ADVICE',
			blocks: [
				{
					kind: 'p',
					text: 'Nothing on the Site constitutes investment advice, financial advice, or an offer of securities. B-Units are strictly utility-based prepaid software service credits. They do not constitute legal tender, e-money, or financial investment products under any regulatory regime. You assume all macroeconomic risks associated with decentralized networks.',
				},
			],
		},
		{
			heading: '4. TAX LIABILITIES',
			blocks: [
				{
					kind: 'p',
					text: 'Any service fees or transaction estimates displayed on the Site are EXCLUSIVE of all applicable indirect consumption taxes. You are solely responsible for calculating, reporting, and paying all applicable local taxes (including but not limited to US State Sales Tax, Canadian GST/HST, or global VAT) arising from your interaction with decentralized smart contracts.',
				},
			],
		},
		{
			heading: '5. LIMITATION OF LIABILITY',
			blocks: [
				{
					kind: 'p',
					text: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, BEAMIO, INC., BEAMIO CANADA INC., AND THEIR RESPECTIVE DIRECTORS, OFFICERS, AND STOCKHOLDERS (REPRESENTING THE 4,693,367 FULLY DILUTED SHARES) DISCLAIM ALL LIABILITY FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM SMART CONTRACT BUGS, NETWORK CONGESTION, LOSS OF PRIVATE KEYS, OR MACROECONOMIC VOLATILITY. THE INTERFACE IS PROVIDED "AS IS" AND "AS AVAILABLE".',
				},
			],
		},
		{
			heading: '6. BIFURCATED DISPUTE RESOLUTION',
			blocks: [],
			subsections: [
				{
					heading: '(a) For US Residents:',
					blocks: [
						{
							kind: 'p',
							text: 'These Terms shall be governed by the laws of the State of Delaware, USA. Any disputes shall be resolved exclusively through binding individual arbitration in Delaware. Class actions are strictly waived.',
						},
					],
				},
				{
					heading: '(b) For ROW Residents:',
					blocks: [
						{
							kind: 'p',
							text: 'These Terms shall be governed by the laws of the Province of British Columbia, Canada. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Vancouver, British Columbia.',
						},
					],
				},
			],
		},
		{
			heading: '7. CONTACT US',
			blocks: [
				{
					kind: 'p',
					text: 'If you have questions regarding this Privacy Policy, please contact our Compliance Officer at:',
				},
			],
		},
	],
	contactEmail: CONTACT_EMAIL,
	contactLead: 'If you have questions regarding this Privacy Policy, please contact our Compliance Officer at:',
}

const TERMS_ZH: BeamioLegalDocument = {
	id: 'terms',
	title: 'BEAMIO 网站通用使用条款',
	lastUpdatedLabel: '最后更新日期：2026年8月16日',
	intro: [
		'本使用条款（“条款”）构成您（“您”或“用户”）与适用的 Beamio 运营实体（定义见下文）之间具有法律约束力的协议，管辖您对 beamio.app 网站及任何相关非托管网络界面（统称“网站”或“界面”）的访问和使用。',
	],
	notice: '重要提示 – 请仔细阅读：',
	sections: [
		{
			heading: '1. 缔约实体与管辖权路由',
			blocks: [{ kind: 'p', text: '您的缔约实体取决于您的居住地和主要运营管辖区：' }],
			subsections: [
				{
					heading: '(a) 美国居民：',
					blocks: [
						{
							kind: 'p',
							text: '如果您是美利坚合众国的居民或设立的实体，您的协议方为特拉华州公司 BEAMIO, INC.（档案号：10419778）。',
						},
					],
				},
				{
					heading: '(b) 全球其他地区 (ROW) 居民：',
					blocks: [
						{
							kind: 'p',
							text: '如果您是美国以外任何国家的居民或设立的实体，您的协议方为不列颠哥伦比亚省公司 BEAMIO CANADA INC.（注册号：BC1598247）。',
						},
						{ kind: 'p', text: '（在此统称为“Beamio”、“我们”或“我们的”）。' },
					],
				},
			],
		},
		{
			heading: '2. 界面性质与交易型 EULA',
			blocks: [],
			subsections: [
				{
					heading: '2.1 非托管界面。',
					blocks: [
						{
							kind: 'p',
							text: 'Beamio 严格作为非托管图形用户界面运行。我们不持有您的资金，不托管您的私钥，也不控制您的链上数字资产。',
						},
					],
				},
				{
					heading: '2.2 特定 EULA 适用。',
					blocks: [
						{
							kind: 'p',
							text: '本条款管辖您对网站的一般浏览和交互。但是，任何购买 B-Units、创世全功能节点或执行商业 SaaS 交易的行为，均应受结账时根据您声明的管辖区向您出示的适用《最终用户许可协议 (EULA)》的排他性管辖。如果本条款与 EULA 发生冲突，应以 EULA 为准。',
						},
					],
				},
			],
		},
		{
			heading: '3. 无财务或法律建议',
			blocks: [
				{
					kind: 'p',
					text: '网站上的任何内容均不构成投资建议、财务建议或证券发售。B-Units 严格属于基于效用的预付费软件服务点数。在任何监管制度下，它们均不构成法定货币、电子货币或金融投资产品。您需自行承担与去中心化网络相关的所有宏观经济风险。',
				},
			],
		},
		{
			heading: '4. 税务责任',
			blocks: [
				{
					kind: 'p',
					text: '网站上显示的任何服务费或交易估算均不包含所有适用的间接消费税。您全权负责计算、申报并支付因您与去中心化智能合约交互而产生的所有适用当地税费（包括但不限于美国州销售税、加拿大 GST/HST 或全球增值税）。',
				},
			],
		},
		{
			heading: '5. 责任限制',
			blocks: [
				{
					kind: 'p',
					text: '在法律允许的最大范围内，BEAMIO, INC.、BEAMIO CANADA INC. 及其各自的董事、高级职员和股东（代表 4,693,367 股完全稀释股份）对因智能合约漏洞、网络拥堵、私钥丢失或宏观经济波动引起的任何间接、偶然、特殊或后果性损害不承担任何责任。界面按“原样”和“可用状态”提供。',
				},
			],
		},
		{
			heading: '6. 分级争议解决机制',
			blocks: [],
			subsections: [
				{
					heading: '(a) 针对美国居民：',
					blocks: [
						{
							kind: 'p',
							text: '本条款受美国特拉华州法律管辖。任何争议应专门通过在特拉华州进行的具有约束力的个人仲裁解决。严格放弃集体诉讼权。',
						},
					],
				},
				{
					heading: '(b) 针对全球其他地区 (ROW) 居民：',
					blocks: [
						{
							kind: 'p',
							text: '本条款受加拿大不列颠哥伦比亚省法律管辖。任何争议应受位于不列颠哥伦比亚省温哥华法院的排他性管辖。',
						},
					],
				},
			],
		},
		{
			heading: '7. 联系我们',
			blocks: [{ kind: 'p', text: '如果您对本隐私政策有任何疑问，请联系我们的合规官：' }],
		},
	],
	contactEmail: CONTACT_EMAIL,
	contactLead: '如果您对本隐私政策有任何疑问，请联系我们的合规官：',
}

const DOCS: Record<BeamioLegalDocId, Record<BeamioUiLocale, BeamioLegalDocument>> = {
	privacy: { en: PRIVACY_EN, 'zh-CN': PRIVACY_ZH },
	terms: { en: TERMS_EN, 'zh-CN': TERMS_ZH },
}

export function getBeamioLegalDocument(id: BeamioLegalDocId, locale: BeamioUiLocale): BeamioLegalDocument {
	return DOCS[id][locale] ?? DOCS[id].en
}
