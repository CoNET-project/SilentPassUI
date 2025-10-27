import React from "react";
import { motion } from "framer-motion";
import conetLogo from "./assets/logo.svg";
import type { CheckListValue } from 'antd-mobile/es/components/check-list';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import enUS from 'antd-mobile/es/locales/en-US';
import jaJP from 'antd-mobile/es/locales/ja-JP';
import { NavBar,Popup,CheckList,setDefaultConfig } from 'antd-mobile';
import { useTranslation } from 'react-i18next';

///	navigate(value)

export type InfraItem = {
  id: string;
  title: string;
  desc: string;
  href: string;
  href1?: string,
  color?: string;
};

type Props = {
	logoSrc?: string;
	items?: InfraItem[];
	size?: number;
};



const Home = ({
	logoSrc = conetLogo,
	size = 480,
	items = [
		{
		id: "lm",
		title: "LayerMinus 通道",
		desc: "多节点并发、碎片化路由，端到端隐私隧道",
		href: "/dashboard/layerminus",
		color: "#22c55e",
		},
		{
		id: "nodes",
		title: "Node Network 节点网",
		desc: "全球入口/出口节点调度与测延迟采样",
		href: "/dashboard/nodes",
		color: "#60a5fa",
		},
		{
		id: "settlement",
		title: "Micropayments 结算",
		desc: "GB 代币化带宽与周度结算、Passport 资格",
		href: "/dashboard/settlement",
		color: "#f59e0b",
		},
	],
}: Props) => {
	const { t,i18n } = useTranslation();

		items = [
		{
			id: "lm",
			title: t('home-first-infra3'),
			desc: t('home-first-infra1-detail3'),
			href: "/",
			color: "#13592c",
		},
		{
			id: "nodes",
			title: t('home-first-infra1'),
			desc: t('home-first-infra1-detail1'),
			href: "/#/conet",
			href1: "https://conet.network",
			color: "#223c5b",
		},
		{
			id: "settlement",
			title: t('home-first-infra2'),
			desc: t('home-first-infra1-detail2'),
			href: "https://mainnet.conet.network",
			color: "#634107",
		},
	]

	const rOuter = size * 0.48;
	const rInner = size * 0.31;
	const cx = size / 2;
	const cy = size / 2;
	const segments = items.slice(0, 3);
	const segments1 = [items[1],items[2],items[0]];
	const sweep = (2 * Math.PI) / segments.length;

	const polar = (angle: number, r: number) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
	const arcPath = (startAngle: number, endAngle: number) => {
		const [x1, y1] = polar(startAngle, rOuter);
		const [x2, y2] = polar(endAngle, rOuter);
		const [x3, y3] = polar(endAngle, rInner);
		const [x4, y4] = polar(startAngle, rInner);
		const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
		return [
		`M ${x1} ${y1}`,
		`A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
		`L ${x3} ${y3}`,
		`A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
		"Z",
		].join(" ");
	};

	

	const arcCenter = (start: number, end: number) => {
		const mid = (start + end) / 2;
		const [x, y] = polar(mid, (rOuter + rInner) / 2);
		return { x, y, angle: mid };
	};

	const handleChange=async (value: CheckListValue[])=>{
        type AntdLocale = {
            en: typeof enUS;
            zh: typeof zhCN;
            jp: typeof jaJP;
        }
        const antdMLang: AntdLocale={en:enUS,zh:zhCN,jp:jaJP};
        let storage = window.localStorage;
        localStorage.lang=value;
		//@ts-ignore
        await i18n.changeLanguage(value);
        if(value && value[0]) setDefaultConfig({locale: antdMLang[value[0] as keyof typeof antdMLang]});
    }




	const hoverScale = { scale: 1.08, transition: { type: "spring", stiffness: 260, damping: 20 } } as const;
	const tapScale = { scale: 0.98 } as const;

	return (
		<div className="w-full flex flex-col items-center justify-start py-10 bg-black text-white min-h-screen">
		{/* 顶部标题 */}
		<h1 className="text-3xl font-bold text-white mb-2 text-center tracking-wide">
			{t('home-title-1')}
		</h1>
		<h2 className="text-2xl font-bold text-white mb-8 text-center tracking-wide">
			{t('home-title-2')}
		</h2>


		{/* 语言选择 */}
		<div className="flex gap-4 mt-3 mb-8 text-gray-300 text-sm">
			<button className="hover:text-white transition-colors" onClick={() => handleChange(['zh'])}>中文</button>
			<button className="hover:text-white transition-colors" onClick={() => handleChange(['jp'])}>日本語</button>
			<button className="hover:text-white transition-colors" onClick={() => handleChange(['en'])}>English</button>
		</div>

		<div className="relative flex items-center justify-center overflow-visible" style={{ width: size, height: size }}>
			<svg width={size+200} height={size+100} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm relative z-10 pointer-events-none">
			{segments.map((s, i) => {
				const start = -Math.PI / 2 + i * sweep;
				const end = start + sweep;
				const pathD = arcPath(start, end);
				const { x, y } = arcCenter(start, end);
				const color = s.color || "#64748b";

				return (
				<g key={s.id}>
					<a href={s.href} target="_blank" aria-label={`${s.title}：${s.desc}`}>
					<motion.path
						className="pointer-events-auto"
						d={pathD}
						initial={{ scale: 5, rotate: 180, opacity: 0 }}
						animate={{ scale: 1, rotate: 0, opacity: 1 }}
						transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 * i }}
						whileHover={{ scale: 1.08, fillOpacity: 0.35, filter: `drop-shadow(0 0 12px ${color})` }}
						whileTap={tapScale}
						style={{ cursor: "pointer", transformBox: "fill-box", transformOrigin: "50% 50%", pointerEvents: "visiblePainted" }}
						fill={color}
						fillOpacity={0.18}
						stroke={color}
						strokeWidth={2}
					/>
					</a>

					<a href={s.href} className="pointer-events-none">
						<motion.foreignObject x={x - 90} y={y - 40} width={180} height={80} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 * i }} style={{ pointerEvents: "none" }}>
							<div className="text-center select-none">
							<div className="text-1xl font-semibold text-white/80 leading-tight -translate-y-[-1rem]">{s.title}</div>
							</div>
						</motion.foreignObject>
					</a>
				</g>
				);
			})}
			</svg>

			<div
			className="absolute z-0 rounded-full bg-black/60 backdrop-blur-sm border border-gray-700 shadow-inner flex items-center justify-center overflow-visible translate-x-[-0.5rem] -translate-y-[0.3rem] rotate-[10deg]"
			style={{
				width: rInner * 1.65,
				height: rInner * 1.65,
				left: cx - (rInner * 1.65) / 2,
				top: cy - (rInner * 1.65) / 2,
			}}
			>
			<motion.img
				src={logoSrc}
				alt="CoNET Logo"
				className="w-full h-full object-cover"
				draggable={false}
				animate={{ opacity: 0.2, scale: 1.6 }}
				whileHover={{ opacity: 0.8, scale: [1.6, 2.0, 1.6] }}
				transition={{ duration: 1, ease: "easeOut" }}
			/>
			</div>

			<div className="absolute inset-0 pointer-events-none">
			{segments.map((s, i) => {
				const start = -Math.PI / 2 + i * sweep;
				const end = start + sweep;
				const mid = (start + end) / 2;
				const R = rOuter + 36;
				const [x, y] = polar(mid, R);
				return (
				<motion.div
					key={`label-${s.id}`}
					className="absolute -translate-x-1/2 -translate-y-1/2"
					style={{ left: x, top: y }}
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 + 0.12 * i }}
				>
				</motion.div>
				);
			})}
			</div>
		</div>
			
		<div className="mt-10 max-w-sm">
			<ul className="space-y-3">
			{segments1.map((s) => (
				<li key={`legend-${s.id}`} className="flex items-start gap-3">
				<span className="mt-1 w-3 h-3 rounded-sm" style={{ backgroundColor: s.color || "#64748b" }} />
				<div>
					{
						s?.href1?.length &&
						<a href={s.href1} className="font-medium hover:underline text-white" target="_blank">{s.title}</a>
					}
					{
						!s?.href1 &&
						<div className="font-medium text-white">
							{s.title}
						</div>
					}
					
					<div className="text-sm text-gray-400">{s.desc}</div>
				</div>
				</li>
			))}
			</ul>
		</div>
		</div>
	);
}

export default Home;