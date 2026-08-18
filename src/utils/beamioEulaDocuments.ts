import type { BeamioUiLocale } from '@/locale/i18n'
import type { BeamioLegalDocument } from '@/utils/beamioLegalDocuments'

export type BeamioEulaVariant = 'us' | 'row'

export function isUnitedStatesEulaJurisdiction(country: string | undefined | null): boolean {
	const n = String(country ?? '')
		.trim()
		.toUpperCase()
	return n === 'US' || n === 'USA' || n === 'UNITED STATES' || n === 'UNITED STATES OF AMERICA'
}

export function resolveBeamioEulaVariant(country: string | undefined | null): BeamioEulaVariant {
	return isUnitedStatesEulaJurisdiction(country) ? 'us' : 'row'
}

const EULA_US_EN: BeamioLegalDocument = {
	id: 'eula-us',
	title: 'END USER LICENSE AGREEMENT (EULA) - UNITED STATES VERSION',
	notice: 'IMPORTANT – READ CAREFULLY:',
	intro: [
		'This End User License Agreement (this "Agreement") is a legally binding contract between you (the "Merchant", "You", or "Your") and BEAMIO, INC., a corporation validly existing under the laws of the State of Delaware, USA, having its principal place of business at 16192 Coastal Highway, Lewes, Delaware 19958 (Delaware File Number: 10419778) (the "Corporation", "We", "Us", or "Our").',
		'BY CHECKING THE "I AGREE" BOX, COMPLETING THE PURCHASE PROCESS, OR OTHERWISE ACCESSING OR USING THE BEAMIO SAAS SERVICES OR B-UNITS, YOU EXPRESSLY ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT, INCLUDING THE MANDATORY ARBITRATION AND CLASS ACTION WAIVER CLAUSES SET FORTH IN ARTICLE 7.',
	],
	sections: [
		{
			heading: 'ARTICLE 1 - DEFINITIONS',
			blocks: [],
			subsections: [
				{
					heading: '1.1 "B-Units"',
					blocks: [
						{
							kind: 'p',
							text: 'means the proprietary, non-custodial, prepaid digital software service credits issued by the Corporation, pegged at a strictly functional metric where 100 B-Units equals 1.00 USDC of computational power.',
						},
					],
				},
				{
					heading: '1.2 "Genesis Full-Node"',
					blocks: [
						{
							kind: 'p',
							text: 'means a physical or cloud-based data routing and decentralized consensus validation node operating on the underlying network.',
						},
					],
				},
				{
					heading: '1.3 "SaaS Services"',
					blocks: [
						{
							kind: 'p',
							text: 'means the decentralized omnichannel commercial software operating systems and APIs provided by the Corporation.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 2 - DIGITAL ASSETS & NON-REFUNDABLE POLICY',
			blocks: [],
			subsections: [
				{
					heading: '2.1 Nature of B-Units.',
					blocks: [
						{
							kind: 'p',
							text: 'You explicitly acknowledge that B-Units are strictly utility-based, prepaid software service credits used exclusively to consume system state machine operations, API calls, and decentralized micro-settlements. B-Units DO NOT constitute legal tender, fiat currency, e-money, securities, or financial investment products under the Securities Act of 1933 or any state securities laws.',
						},
					],
				},
				{
					heading: '2.2 ALL SALES ARE FINAL.',
					blocks: [
						{
							kind: 'p',
							text: 'Given the immutable nature of cryptographic transactions and the immediate provisioning of digital software credits, YOU HEREBY AGREE THAT ALL PURCHASES OF B-UNITS AND ASSOCIATED SAAS PACKAGES ARE ABSOLUTELY FINAL AND NON-REFUNDABLE. Upon the issuance of B-Units to your designated wallet or account, the Corporation\'s delivery obligation is legally and fully satisfied. The Corporation strictly does not entertain refund requests for buyer\'s remorse, business failure, or lack of usage.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 3 - COMPLIMENTARY GENESIS NODE DISCLAIMER',
			blocks: [],
			subsections: [
				{
					heading: '3.1 As-Is Promotional Provision.',
					blocks: [
						{
							kind: 'p',
							text: 'If Your purchased SaaS package includes the allocation of a Genesis Full-Node, You explicitly acknowledge that such node is provided as a strictly complimentary, "As-Is", and cloud-based promotional provision.',
						},
					],
				},
				{
					heading: '3.2 No SLA or Financial Guarantees.',
					blocks: [
						{
							kind: 'p',
							text: 'The Corporation expressly disclaims any Service Level Agreement (SLA) guarantees, warranty of uptime, or promises of node performance. Furthermore, the Corporation makes NO PROMISES of financial return, token airdrops, yield generation, or secondary market value. You assume all technical and macroeconomic risks associated with operating decentralized infrastructure.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 4 - TAX LIABILITIES',
			blocks: [],
			subsections: [
				{
					heading: '4.1 State and Local Sales Tax.',
					blocks: [
						{
							kind: 'p',
							text: 'The base price of the SaaS packages (e.g., 4,000 USDC) is strictly exclusive of all applicable taxes. You are solely responsible for paying any and all applicable U.S. state and local sales taxes, use taxes, or equivalent consumption taxes arising from economic nexus in Your billing jurisdiction. Such taxes shall be calculated and charged on top of the base package price where required by law.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 5 - CHARGEBACKS & RECOURSE (SLASHING)',
			blocks: [],
			subsections: [
				{
					heading: '5.1 Prohibition of Chargebacks.',
					blocks: [
						{
							kind: 'p',
							text: 'You agree not to initiate any chargebacks, disputes, or reversals with Your credit card issuer or payment provider for purchases made in accordance with this Agreement.',
						},
					],
				},
				{
					heading: '5.2 Slashing for Cause.',
					blocks: [
						{
							kind: 'p',
							text: 'In the event of documented fraudulent chargebacks or material breach of this Agreement, the Corporation reserves the unilateral, absolute, and unencumbered right to execute "Slashing" procedures. This includes the immediate suspension of Your access to the SaaS Services, the freezing or confiscation of Your B-Units, and the permanent deactivation of Your associated Genesis Full-Node.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 6 - LIMITATION OF LIABILITY',
			blocks: [
				{
					kind: 'p',
					text: "6.1 TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE CORPORATION, ITS DIRECTORS, STOCKHOLDERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN ANY WAY CONNECTED WITH THE USE OR INABILITY TO USE THE SAAS SERVICES OR B-UNITS. THE CORPORATION'S AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE TOTAL AMOUNT ACTUALLY PAID BY YOU FOR THE SPECIFIC SAAS PACKAGE IN DISPUTE.",
				},
			],
		},
		{
			heading: 'ARTICLE 7 - DISPUTE RESOLUTION: MANDATORY ARBITRATION & CLASS ACTION WAIVER',
			blocks: [],
			subsections: [
				{
					heading: '7.1 MANDATORY BINDING ARBITRATION.',
					blocks: [
						{
							kind: 'p',
							text: 'Any dispute, claim, or controversy arising out of or relating to this Agreement, or the breach, termination, enforcement, interpretation, or validity thereof, shall be resolved exclusively by binding, individual arbitration administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules.',
						},
					],
				},
				{
					heading: '7.2 CLASS ACTION WAIVER.',
					blocks: [
						{
							kind: 'p',
							text: 'YOU AND THE CORPORATION AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, OR REPRESENTATIVE PROCEEDING. The arbitrator may not consolidate more than one person\'s claims and may not otherwise preside over any form of a representative or class proceeding.',
						},
					],
				},
				{
					heading: '7.3 Governing Law.',
					blocks: [
						{
							kind: 'p',
							text: 'This Agreement shall be governed by and construed in accordance with the internal laws of the State of Delaware, without regard to its conflict of laws principles. The arbitration shall take place in Wilmington, Delaware.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 8 - MISCELLANEOUS',
			blocks: [],
			subsections: [
				{
					heading: '8.1 Severability.',
					blocks: [
						{
							kind: 'p',
							text: 'If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.',
						},
					],
				},
				{
					heading: '8.2 Entire Agreement.',
					blocks: [
						{
							kind: 'p',
							text: 'This Agreement constitutes the entire agreement between You and the Corporation regarding the subject matter hereof and supersedes all prior communications, representations, or marketing materials.',
						},
					],
				},
			],
		},
	],
}

const EULA_ROW_EN: BeamioLegalDocument = {
	id: 'eula-row',
	title: 'END USER LICENSE AGREEMENT (EULA) - REST OF WORLD (ROW) VERSION',
	notice: 'IMPORTANT – READ CAREFULLY:',
	intro: [
		'This End User License Agreement (this "Agreement") is a legally binding contract between you (the "Merchant", "You", or "Your") and BEAMIO CANADA INC., a corporation validly existing under the laws of British Columbia, Canada, with its registered office at 112 - 970 Burrard Street, Office# 1568, Vancouver, BC V6Z 2R4 (Incorporation Number: BC1598247) (the "Corporation", "We", "Us", or "Our").',
		'BY CHECKING THE "I AGREE" BOX, COMPLETING THE PURCHASE PROCESS, OR OTHERWISE ACCESSING OR USING THE BEAMIO SAAS SERVICES OR B-UNITS, YOU EXPRESSLY ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THE TERMS OF THIS AGREEMENT.',
		'IF YOU ARE A RESIDENT OR DOMICILED ENTITY OF THE UNITED STATES OF AMERICA, YOU ARE STRICTLY PROHIBITED FROM AGREEING TO THIS ROW VERSION AND MUST EXIT THIS PAGE IMMEDIATELY.',
	],
	sections: [
		{
			heading: 'ARTICLE 1 - DEFINITIONS',
			blocks: [],
			subsections: [
				{
					heading: '1.1 "B-Units"',
					blocks: [
						{
							kind: 'p',
							text: 'means the proprietary, non-custodial, prepaid digital software service credits issued by the Corporation, pegged at a strictly functional metric where 100 B-Units equals 1.00 USDC of computational power.',
						},
					],
				},
				{
					heading: '1.2 "Genesis Full-Node"',
					blocks: [
						{
							kind: 'p',
							text: 'means a physical or cloud-based data routing and decentralized consensus validation node operating on the underlying CoNET network.',
						},
					],
				},
				{
					heading: '1.3 "SaaS Services"',
					blocks: [
						{
							kind: 'p',
							text: 'means the decentralized omnichannel commercial software operating systems and APIs provided by the Corporation.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 2 - DIGITAL ASSETS & NON-REFUNDABLE POLICY',
			blocks: [],
			subsections: [
				{
					heading: '2.1 Nature of B-Units.',
					blocks: [
						{
							kind: 'p',
							text: 'You explicitly acknowledge that B-Units are strictly utility-based, prepaid software service credits used exclusively to consume system state machine operations, API calls, and decentralized micro-settlements. B-Units DO NOT constitute legal tender, fiat currency, e-money, securities, or financial investment products in any jurisdiction.',
						},
					],
				},
				{
					heading: '2.2 ALL SALES ARE FINAL.',
					blocks: [
						{
							kind: 'p',
							text: 'Given the immutable nature of cryptographic transactions and the immediate provisioning of digital software credits, YOU HEREBY AGREE THAT ALL PURCHASES OF B-UNITS AND ASSOCIATED SAAS PACKAGES ARE ABSOLUTELY FINAL AND NON-REFUNDABLE. Upon the issuance of B-Units to your designated wallet or account, the Corporation\'s delivery obligation is legally and fully satisfied. The Corporation strictly does not entertain refund requests for buyer\'s remorse, business failure, or lack of usage.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 3 - COMPLIMENTARY GENESIS NODE DISCLAIMER',
			blocks: [],
			subsections: [
				{
					heading: '3.1 As-Is Promotional Provision.',
					blocks: [
						{
							kind: 'p',
							text: 'If Your purchased SaaS package includes the allocation of a Genesis Full-Node, You explicitly acknowledge that such node is provided as a strictly complimentary, "As-Is", and cloud-based promotional provision.',
						},
					],
				},
				{
					heading: '3.2 No SLA or Financial Guarantees.',
					blocks: [
						{
							kind: 'p',
							text: 'The Corporation expressly disclaims any Service Level Agreement (SLA) guarantees, warranty of uptime, or promises of node performance. Furthermore, the Corporation makes NO PROMISES of financial return, token airdrops, yield generation, or secondary market value. You assume all technical and macroeconomic risks associated with operating decentralized infrastructure.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 4 - TAX LIABILITIES',
			blocks: [],
			subsections: [
				{
					heading: '4.1 Indirect Taxes.',
					blocks: [
						{
							kind: 'p',
							text: 'The base price of the SaaS packages (e.g., 4,000 USDC) is strictly exclusive of all applicable taxes. You are solely responsible for paying any and all local consumption taxes, including but not limited to Canadian Goods and Services Tax (GST), Provincial Sales Tax (PST), Harmonized Sales Tax (HST), or global Value Added Tax (VAT), which shall be calculated and charged on top of the base package price in accordance with Your billing jurisdiction.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 5 - CHARGEBACKS & RECOURSE (SLASHING)',
			blocks: [],
			subsections: [
				{
					heading: '5.1 Prohibition of Chargebacks.',
					blocks: [
						{
							kind: 'p',
							text: 'You agree not to initiate any chargebacks, disputes, or reversals with Your credit card issuer or payment provider for purchases made in accordance with this Agreement.',
						},
					],
				},
				{
					heading: '5.2 Slashing for Cause.',
					blocks: [
						{
							kind: 'p',
							text: 'In the event of documented fraudulent chargebacks or material breach of this Agreement, the Corporation reserves the unilateral, absolute, and unencumbered right to execute "Slashing" procedures. This includes the immediate suspension of Your access to the SaaS Services, the freezing or confiscation of Your B-Units, and the permanent deactivation of Your associated Genesis Full-Node.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 6 - LIMITATION OF LIABILITY',
			blocks: [
				{
					kind: 'p',
					text: "6.1 TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE CORPORATION, ITS PARENT ENTITY (BEAMIO, INC.), DIRECTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, OR BUSINESS INTERRUPTION, ARISING OUT OF OR IN ANY WAY CONNECTED WITH THE USE OR INABILITY TO USE THE SAAS SERVICES OR B-UNITS. THE CORPORATION'S AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE TOTAL AMOUNT ACTUALLY PAID BY YOU FOR THE SPECIFIC SAAS PACKAGE IN DISPUTE.",
				},
			],
		},
		{
			heading: 'ARTICLE 7 - GOVERNING LAW & JURISDICTION',
			blocks: [],
			subsections: [
				{
					heading: '7.1 Governing Law.',
					blocks: [
						{
							kind: 'p',
							text: 'This Agreement shall be governed by and construed in accordance with the laws of the Province of British Columbia, Canada, and the federal laws of Canada applicable therein, excluding its conflicts of law rules.',
						},
					],
				},
				{
					heading: '7.2 Exclusive Jurisdiction.',
					blocks: [
						{
							kind: 'p',
							text: 'Any dispute, claim, or controversy arising out of or relating to this Agreement shall be subject to the exclusive jurisdiction of the provincial and federal courts located in Vancouver, British Columbia, Canada. You hereby irrevocably submit to the personal and exclusive jurisdiction of such courts.',
						},
					],
				},
			],
		},
		{
			heading: 'ARTICLE 8 - MISCELLANEOUS',
			blocks: [],
			subsections: [
				{
					heading: '8.1 Severability.',
					blocks: [
						{
							kind: 'p',
							text: 'If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.',
						},
					],
				},
				{
					heading: '8.2 Entire Agreement.',
					blocks: [
						{
							kind: 'p',
							text: 'This Agreement constitutes the entire agreement between You and the Corporation regarding the subject matter hereof and supersedes all prior communications, representations, or marketing materials.',
						},
					],
				},
			],
		},
	],
}

const EULA_US_ZH: BeamioLegalDocument = {
	id: 'eula-us',
	title: '最终用户许可协议 (EULA) - 美国本土版',
	notice: '重要提示 – 请仔细阅读：',
	intro: [
		'本最终用户许可协议（本“协议”）是您（“商户”、“您”或“您的”）与 BEAMIO, INC.（一家根据美国特拉华州法律有效存续的公司，其主要营业地点位于 16192 Coastal Highway, Lewes, Delaware 19958，特拉华州档案号：10419778）（“本公司”、“我们”或“我们的”）之间具有法律约束力的合同。',
		'通过勾选“我同意”复选框、完成购买流程或以其他方式访问或使用 BEAMIO SaaS 服务或 B-UNITS，即表示您明确承认您已阅读、理解并同意受本协议条款的约束，包括第 7 条规定的强制仲裁和集体诉讼豁免条款。',
	],
	sections: [
		{
			heading: '第一条 - 定义',
			blocks: [],
			subsections: [
				{
					heading: '1.1 “B-Units”',
					blocks: [
						{
							kind: 'p',
							text: '指由本公司发行的专有、非托管、预付费数字软件服务点数，以严格的功能指标锚定，即 100 B-Units 等于 1.00 USDC 的算力。',
						},
					],
				},
				{
					heading: '1.2 “创世全功能节点”',
					blocks: [
						{
							kind: 'p',
							text: '指在底层网络上运行的物理或基于云的数据路由及去中心化共识验证节点。',
						},
					],
				},
				{
					heading: '1.3 “SaaS 服务”',
					blocks: [
						{
							kind: 'p',
							text: '指由本公司提供的去中心化全渠道商业软件操作系统及 API。',
						},
					],
				},
			],
		},
		{
			heading: '第二条 - 数字资产与不退款政策',
			blocks: [],
			subsections: [
				{
					heading: '2.1 B-Units 的性质。',
					blocks: [
						{
							kind: 'p',
							text: '您明确承认 B-Units 是严格基于效用的预付费软件服务点数，专门用于消耗系统状态机操作、API 调用和去中心化微结算。在《1933 年证券法》或任何州证券法下，B-Units 均不构成法定货币、法币、电子货币、证券或金融投资产品。',
						},
					],
				},
				{
					heading: '2.2 所有销售均为最终决定。',
					blocks: [
						{
							kind: 'p',
							text: '鉴于密码学交易的不可篡改性质以及数字软件点数的即时配置，您特此同意，所有 B-UNITS 及相关 SAAS 套餐的购买均具有绝对的最终效力，且不可退款。在 B-Units 发放至您指定的钱包或账户后，本公司的交付义务即在法律上完全履行完毕。本公司坚决不接受因买方反悔、业务失败或缺乏使用而提出的退款要求。',
						},
					],
				},
			],
		},
		{
			heading: '第三条 - 免费创世节点免责声明',
			blocks: [],
			subsections: [
				{
					heading: '3.1 按现状的促销提供。',
					blocks: [
						{
							kind: 'p',
							text: '如果您购买的 SaaS 套餐包含分配创世全功能节点，您明确承认该节点是作为严格的免费赠送、“按现状”且基于云的促销条款提供的。',
						},
					],
				},
				{
					heading: '3.2 无 SLA 或财务保证。',
					blocks: [
						{
							kind: 'p',
							text: '本公司明确拒绝任何服务级别协议 (SLA) 保证、正常运行时间保证或对节点性能的承诺。此外，本公司不作任何财务回报、代币空投、收益产生或二级市场价值的承诺。您承担与运营去中心化基础设施相关的所有技术和宏观经济风险。',
						},
					],
				},
			],
		},
		{
			heading: '第四条 - 税务责任',
			blocks: [],
			subsections: [
				{
					heading: '4.1 州及地方销售税。',
					blocks: [
						{
							kind: 'p',
							text: 'SaaS 套餐的基础价格（例如 4,000 USDC）严格不包含所有适用税项。您全权负责支付因您账单管辖区的经济关联而产生的任何及所有适用的美国州和地方销售税、使用税或同等消费税。在法律要求的情况下，此类税款将在基础套餐价格之上计算和收取。',
						},
					],
				},
			],
		},
		{
			heading: '第五条 - 拒付与追索权 (SLASHING)',
			blocks: [],
			subsections: [
				{
					heading: '5.1 禁止拒付。',
					blocks: [
						{
							kind: 'p',
							text: '您同意，对于根据本协议进行的购买，不向您的信用卡发卡机构或支付提供商发起任何拒付（Chargebacks）、争议或撤销。',
						},
					],
				},
				{
					heading: '5.2 违规罚没 (Slashing for Cause)。',
					blocks: [
						{
							kind: 'p',
							text: '如果发生有记录的欺诈性拒付或对本协议的实质性违约，本公司保留执行“罚没 (Slashing)”程序的单方、绝对和不受限制的权利。这包括立即暂停您访问 SaaS 服务的权限、冻结或没收您的 B-Units，以及永久停用您关联的创世全功能节点。',
						},
					],
				},
			],
		},
		{
			heading: '第六条 - 责任限制',
			blocks: [
				{
					kind: 'p',
					text: '6.1 在适用法律允许的最大范围内，在任何情况下，本公司、其董事、股东或关联公司均不对因使用或无法使用 SAAS 服务或 B-UNITS 而引起或以任何方式相关的任何间接、惩罚性、偶然、特殊或后果性损害承担责任，包括但不限于利润、数据或业务中断损失。本公司在本协议项下的总责任不得超过您为发生争议的特定 SAAS 套餐实际支付的总金额。',
				},
			],
		},
		{
			heading: '第七条 - 争议解决：强制仲裁与集体诉讼豁免',
			blocks: [],
			subsections: [
				{
					heading: '7.1 强制约束性仲裁。',
					blocks: [
						{
							kind: 'p',
							text: '因本协议引起或与本协议相关的任何争议、索赔或争端，或其违约、终止、执行、解释或有效性，均应由美国仲裁协会 (AAA) 根据其商业仲裁规则，通过具有约束力的个人仲裁排他性地解决。',
						},
					],
				},
				{
					heading: '7.2 集体诉讼豁免。',
					blocks: [
						{
							kind: 'p',
							text: '您与本公司同意，双方只能以您或本公司的个人身份向对方提出索赔，而不能作为原告或集体成员参与任何意图的集体、合并或代表诉讼程序。仲裁员不得合并超过一个人的索赔，也不得主持任何形式的代表或集体诉讼程序。',
						},
					],
				},
				{
					heading: '7.3 管辖法律。',
					blocks: [
						{
							kind: 'p',
							text: '本协议应受美国特拉华州内部法律管辖并按其解释，不考虑其法律冲突原则。仲裁将在特拉华州威尔明顿举行。',
						},
					],
				},
			],
		},
		{
			heading: '第八条 - 杂项',
			blocks: [],
			subsections: [
				{
					heading: '8.1 可分割性。',
					blocks: [
						{
							kind: 'p',
							text: '如果本协议的任何条款被认定为无效或不可执行，其余条款应继续具有完全的效力。',
						},
					],
				},
				{
					heading: '8.2 完整协议。',
					blocks: [
						{
							kind: 'p',
							text: '本协议构成您与本公司之间关于本协议主题事项的完整协议，并取代此前所有沟通、陈述或营销材料。',
						},
					],
				},
			],
		},
	],
}

const EULA_ROW_ZH: BeamioLegalDocument = {
	id: 'eula-row',
	title: '最终用户许可协议 (EULA) - 全球版 (ROW VERSION)',
	notice: '重要提示 – 请仔细阅读：',
	intro: [
		'本最终用户许可协议（本“协议”）是您（“商户”、“您”或“您的”）与 BEAMIO CANADA INC.（一家根据加拿大不列颠哥伦比亚省法律有效存续的公司，其注册办公地点位于 112 - 970 Burrard Street, Office# 1568, Vancouver, BC V6Z 2R4，注册号：BC1598247）（“本公司”、“我们”或“我们的”）之间具有法律约束力的合同。',
		'通过勾选“我同意”复选框、完成购买流程或以其他方式访问或使用 BEAMIO SaaS 服务或 B-UNITS，即表示您明确承认您已阅读、理解并同意受本协议条款的约束。',
		'如果您是美利坚合众国的居民或住所设在美国的实体，则严禁您同意此全球版本，并且必须立即退出此页面。',
	],
	sections: [
		{
			heading: '第一条 - 定义',
			blocks: [],
			subsections: [
				{
					heading: '1.1 “B-Units”',
					blocks: [
						{
							kind: 'p',
							text: '指由本公司发行的专有、非托管、预付费数字软件服务点数，以严格的功能指标锚定，即 100 B-Units 等于 1.00 USDC 的算力。',
						},
					],
				},
				{
					heading: '1.2 “创世全功能节点”',
					blocks: [
						{
							kind: 'p',
							text: '指在底层 CoNET 网络上运行的物理或基于云的数据路由及去中心化共识验证节点。',
						},
					],
				},
				{
					heading: '1.3 “SaaS 服务”',
					blocks: [
						{
							kind: 'p',
							text: '指由本公司提供的去中心化全渠道商业软件操作系统及 API。',
						},
					],
				},
			],
		},
		{
			heading: '第二条 - 数字资产与不退款政策',
			blocks: [],
			subsections: [
				{
					heading: '2.1 B-Units 的性质。',
					blocks: [
						{
							kind: 'p',
							text: '您明确承认 B-Units 是严格基于效用的预付费软件服务点数，专门用于消耗系统状态机操作、API 调用和去中心化微结算。在任何司法管辖区，B-Units 均不构成法定货币、法币、电子货币、证券或金融投资产品。',
						},
					],
				},
				{
					heading: '2.2 所有销售均为最终决定。',
					blocks: [
						{
							kind: 'p',
							text: '鉴于密码学交易的不可篡改性质以及数字软件点数的即时配置，您特此同意，所有 B-UNITS 及相关 SAAS 套餐的购买均具有绝对的最终效力，且不可退款。在 B-Units 发放至您指定的钱包或账户后，本公司的交付义务即在法律上完全履行完毕。本公司坚决不接受因买方反悔、业务失败或缺乏使用而提出的退款要求。',
						},
					],
				},
			],
		},
		{
			heading: '第三条 - 免费创世节点免责声明',
			blocks: [],
			subsections: [
				{
					heading: '3.1 按现状的促销提供。',
					blocks: [
						{
							kind: 'p',
							text: '如果您购买的 SaaS 套餐包含分配创世全功能节点，您明确承认该节点是作为严格的免费赠送、“按现状”且基于云的促销条款提供的。',
						},
					],
				},
				{
					heading: '3.2 无 SLA 或财务保证。',
					blocks: [
						{
							kind: 'p',
							text: '本公司明确拒绝任何服务级别协议 (SLA) 保证、正常运行时间保证或对节点性能的承诺。此外，本公司不作任何财务回报、代币空投、收益产生或二级市场价值的承诺。您承担与运营去中心化基础设施相关的所有技术和宏观经济风险。',
						},
					],
				},
			],
		},
		{
			heading: '第四条 - 税务责任',
			blocks: [],
			subsections: [
				{
					heading: '4.1 间接税。',
					blocks: [
						{
							kind: 'p',
							text: 'SaaS 套餐的基础价格（例如 4,000 USDC）严格不包含所有适用税项。您全权负责支付任何及所有当地消费税，包括但不限于加拿大商品及服务税 (GST)、省销售税 (PST)、合并销售税 (HST) 或全球增值税 (VAT)，这些税项将根据您的账单管辖区在基础套餐价格之上计算和收取。',
						},
					],
				},
			],
		},
		{
			heading: '第五条 - 拒付与追索权 (SLASHING)',
			blocks: [],
			subsections: [
				{
					heading: '5.1 禁止拒付。',
					blocks: [
						{
							kind: 'p',
							text: '您同意，对于根据本协议进行的购买，不向您的信用卡发卡机构或支付提供商发起任何拒付（Chargebacks）、争议或撤销。',
						},
					],
				},
				{
					heading: '5.2 违规罚没 (Slashing for Cause)。',
					blocks: [
						{
							kind: 'p',
							text: '如果发生有记录的欺诈性拒付或对本协议的实质性违约，本公司保留执行“罚没 (Slashing)”程序的单方、绝对和不受限制的权利。这包括立即暂停您访问 SaaS 服务的权限、冻结或没收您的 B-Units，以及永久停用您关联的创世全功能节点。',
						},
					],
				},
			],
		},
		{
			heading: '第六条 - 责任限制',
			blocks: [
				{
					kind: 'p',
					text: '6.1 在适用法律允许的最大范围内，在任何情况下，本公司、其母公司实体 (BEAMIO, INC.)、董事或关联公司均不对因使用或无法使用 SAAS 服务或 B-UNITS 而引起或以任何方式相关的任何间接、惩罚性、偶然、特殊或后果性损害承担责任，包括但不限于利润、数据或业务中断损失。本公司在本协议项下的总责任不得超过您为发生争议的特定 SAAS 套餐实际支付的总金额。',
				},
			],
		},
		{
			heading: '第七条 - 管辖法律与管辖权',
			blocks: [],
			subsections: [
				{
					heading: '7.1 管辖法律。',
					blocks: [
						{
							kind: 'p',
							text: '本协议应受加拿大不列颠哥伦比亚省法律及适用的加拿大联邦法律管辖并按其解释，不考虑其法律冲突规则。',
						},
					],
				},
				{
					heading: '7.2 排他性管辖权。',
					blocks: [
						{
							kind: 'p',
							text: '因本协议引起的或与本协议相关的任何争议、索赔或争端应受位于加拿大不列颠哥伦比亚省温哥华的省和联邦法院的排他性管辖。您特此不可撤销地服从该等法院属人及排他性的管辖权。',
						},
					],
				},
			],
		},
		{
			heading: '第八条 - 杂项',
			blocks: [],
			subsections: [
				{
					heading: '8.1 可分割性。',
					blocks: [
						{
							kind: 'p',
							text: '如果本协议的任何条款被认定为无效或不可执行，其余条款应继续具有完全的效力。',
						},
					],
				},
				{
					heading: '8.2 完整协议。',
					blocks: [
						{
							kind: 'p',
							text: '本协议构成您与本公司之间关于本协议主题事项的完整协议，并取代此前所有沟通、陈述或营销材料。',
						},
					],
				},
			],
		},
	],
}

const EULAS: Record<BeamioEulaVariant, Record<BeamioUiLocale, BeamioLegalDocument>> = {
	us: { en: EULA_US_EN, 'zh-CN': EULA_US_ZH },
	row: { en: EULA_ROW_EN, 'zh-CN': EULA_ROW_ZH },
}

export function getBeamioEulaDocument(variant: BeamioEulaVariant, locale: BeamioUiLocale): BeamioLegalDocument {
	return EULAS[variant][locale] ?? EULAS[variant].en
}
