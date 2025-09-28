import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ------------------------------
// CoNET Network Dashboard (Web)
// Single-file React component you can drop into your website.
// Tailwind CSS recommended. Charts use recharts.
// No external UI kit required.
// ------------------------------

// ---- Helper: compact number formatting
const nf = new Intl.NumberFormat(undefined, { notation: "compact" });
const pf = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

// ---- Demo data (replace with live API payloads)
const demoNow = new Date();
function daysAgo(n: number) {
  const d = new Date(demoNow);
  d.setDate(d.getDate() - n);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const demoSeries = Array.from({ length: 14 }).map((_, i) => {
  const d = new Date(demoNow);
  d.setDate(d.getDate() - (13 - i));
  return {
    date: d, // real Date for month/year math
    label: `${d.getMonth() + 1}/${d.getDate()}`,
    gb: 12 + Math.round(Math.random() * 8) + i * 1.3, // GB/day (T x 1000 simplified)
    bpi: 0.012 + (Math.sin(i / 3) * 0.002 + Math.random() * 0.0008), // $/GB
    burn: Math.round(30 + Math.random() * 25 + i * 2), // k $CONET burned
  };
});

// 60‑minute concurrent online series (per minute)
const demoConcurrentSeries = Array.from({ length: 60 }).map((_, i) => ({
  min: i - 59,
  label: `${(60 - i)}m`,
  online: 2800 + Math.round(300 * Math.sin(i / 8) + Math.random() * 120),
}));

// Retention demo (percentage)
const demoRetention = {
  d1: 0.42,
  d7: 0.27,
  d30: 0.14,
};

// aggregate demo counters (replace with API)
const demoAggregates = {
  usersMAU: 128_400,           // Monthly Active Users
  wallets30d: 96_200,          // Unique wallets in last 30d
  onlineConcurrent: demoConcurrentSeries[59].online,     // Current concurrent users
  activeDevices: 182_000,      // Registered active devices (30d)
};

const regions = [
  { region: "NA", nodes: 420, traffic: 38 },
  { region: "EU", nodes: 360, traffic: 31 },
  { region: "APAC", nodes: 295, traffic: 22 },
  { region: "LATAM", nodes: 110, traffic: 6 },
  { region: "MEA", nodes: 75, traffic: 3 },
];

const apps = [
  { name: "Silent Pass", share: 0.62 },
  { name: "AI Agents", share: 0.18 },
  { name: "3rd‑party dApps", share: 0.12 },
  { name: "Other", share: 0.08 },
];

const topNodes = Array.from({ length: 8 }).map((_, i) => ({
  id: `EG-${100 + i}`,
  role: i % 3 === 0 ? "Validator" : i % 2 === 0 ? "Relay" : "Egress",
  region: ["NA", "EU", "APAC", "LATAM", "MEA"][i % 5],
  qos: 0.91 - (i * 0.012),
  latency: 26 + i * 5,
  uptime: 0.993 - i * 0.0007,
  throughput: 3.2 + Math.random() * 1.5, // TB / 24h
}));

const COLORS = ["#4f46e5", "#22c55e", "#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6"]; // Tailwind-ish palette

export default function CoNETDashboard() {
  // Filters & state
  const [range, setRange] = useState<"24h" | "7d" | "14d" | "30d">("14d");
  const [region, setRegion] = useState<string>("ALL");
  const [language, setLanguage] = useState<"en" | "zh">("zh");
  const [autorefresh, setAuto] = useState(true);
  const [tick, setTick] = useState(0);

  // Simulate live refresh (replace with SSE/WebSocket)
  useEffect(() => {
    if (!autorefresh) return;
    const t = setInterval(() => setTick((x) => x + 1), 8000);
    return () => clearInterval(t);
  }, [autorefresh]);

  // Derived KPIs (mocked from demoSeries)
  const kpis = useMemo(() => {
    const last = demoSeries[demoSeries.length - 1];
    const prev = demoSeries[demoSeries.length - 2];
    const gb24h = last.gb; // pretend last point is 24h
    const gbDelta = (last.gb - prev.gb) / Math.max(prev.gb, 1);
    const bpi = last.bpi;
    const burnK = last.burn;
    const nodes = regions.reduce((s, r) => s + r.nodes, 0);

    // Aggregates
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const mtdGB = demoSeries.filter(p => p.date.getMonth() === curMonth && p.date.getFullYear() === curYear).reduce((s, p) => s + p.gb, 0);
    const ytdGB = demoSeries.filter(p => p.date.getFullYear() === curYear).reduce((s, p) => s + p.gb, 0);
    const totalGB = demoSeries.reduce((s, p) => s + p.gb, 0);
    const totalBurnK = demoSeries.reduce((s, p) => s + p.burn, 0); // in thousands of $CONET (demo)

    // Peak day
    const peak = demoSeries.reduce((acc, p) => (p.gb > acc.gb ? p : acc), demoSeries[0]);
    const peakGB = peak.gb;
    const peakLabel = peak.label;

    // User & wallet counters (from demoAggregates)
    const usersMAU = demoAggregates.usersMAU;
    const wallets30d = demoAggregates.wallets30d;
    const onlineConcurrent = demoAggregates.onlineConcurrent;
    const activeDevices = demoAggregates.activeDevices;

    return { gb24h, gbDelta, bpi, burnK, nodes, mtdGB, ytdGB, totalGB, totalBurnK, peakGB, peakLabel, usersMAU, wallets30d, onlineConcurrent, activeDevices };
  }, [tick]);

  // i18n strings
  const t = (key: string) => {
    const zh: Record<string, string> = {
      title: "CoNET 全网指标看板",
      sub: "基于真实用量（GB）、QoS 与清分闭环的公开指标",
      range: "时间范围",
      region: "区域",
      language: "语言",
      refresh: "自动刷新",
      kpi_gb: "近24小时 真实用量（T）",
      kpi_bpi: "BPI（$/GB）",
      kpi_nodes: "活跃节点",
      kpi_burn: "近24小时 销毁（k $CONET）",
      kpi_mtd: "本月累计用量（T）",
      kpi_ytd: "今年累计用量（T）",
      kpi_total: "至今累计用量（T）",
      kpi_users: "月活用户（MAU）",
      kpi_wallets: "近30日唯一钱包",
      kpi_online: "当前在线用户",
      kpi_devices: "近30日活跃设备",
      badge_total_burn: "累计销毁",
      badge_peak: "历史最高日用量",
      chart_gb: "用量趋势（GB/日）",
      chart_bpi: "BPI 价格指数（$/GB）",
      chart_nodes: "分区节点 / 流量占比",
      chart_apps: "按应用来源的流量占比",
      chart_online: "近60分钟 并发在线",
      chart_retention: "留存（D1/D7/D30）",
      table_nodes: "Top 节点（QoS）",
      c_region: "区域",
      c_role: "角色",
      c_latency: "时延(ms)",
      c_uptime: "在线率",
      c_qos: "QoS",
      c_throughput: "吞吐(TB/24h)",
      footer: "注：以上为演示数据。接入指南见代码注释。",
      filter_all: "全部",
    };
    const en: Record<string, string> = {
      title: "CoNET Network Dashboard",
      sub: "Public metrics powered by real usage (GB), QoS & clearing loop",
      range: "Range",
      region: "Region",
      language: "Language",
      refresh: "Auto‑refresh",
      kpi_gb: "Last 24h Usage (T)",
      kpi_bpi: "BPI ($/GB)",
      kpi_nodes: "Active Nodes",
      kpi_burn: "Last 24h Burn (k $CONET)",
      kpi_mtd: "MTD Usage (T)",
      kpi_ytd: "YTD Usage (T)",
      kpi_total: "Total Usage (T)",
      kpi_users: "Monthly Active Users",
      kpi_wallets: "Unique Wallets (30d)",
      kpi_online: "Online Users (now)",
      kpi_devices: "Active Devices (30d)",
      badge_total_burn: "Total Burn",
      badge_peak: "Peak GB/Day",
      chart_gb: "Usage Trend (GB/day)",
      chart_bpi: "BPI Index ($/GB)",
      chart_nodes: "Nodes / Traffic by Region",
      chart_apps: "Traffic Share by App",
      chart_online: "Concurrent Online (last 60m)",
      chart_retention: "Retention (D1/D7/D30)",
      table_nodes: "Top Nodes (QoS)",
      c_region: "Region",
      c_role: "Role",
      c_latency: "Latency(ms)",
      c_uptime: "Uptime",
      c_qos: "QoS",
      c_throughput: "Throughput(TB/24h)",
      footer: "Note: Demo data. See code comments for integration.",
      filter_all: "All",
    };
    return (language === "zh" ? zh : en)[key] || key;
  };

  // Filtered data (region filter is just a demo here)
  const series = demoSeries;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 bg-slate-900/90 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-slate-400 text-sm">{t("sub")}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="hidden md:flex items-center gap-2 text-sm text-slate-300">
              {t("range")}
              <select className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1" value={range} onChange={(e) => setRange(e.target.value as any)}>
                <option value="24h">24h</option>
                <option value="7d">7d</option>
                <option value="14d">14d</option>
                <option value="30d">30d</option>
              </select>
            </label>
            <label className="hidden md:flex items-center gap-2 text-sm text-slate-300">
              {t("region")}
              <select className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="ALL">{t("filter_all")}</option>
                {regions.map((r) => (
                  <option key={r.region} value={r.region}>{r.region}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              {t("language")}
              <select className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1" value={language} onChange={(e) => setLanguage(e.target.value as any)}>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              {t("refresh")}
              <input type="checkbox" checked={autorefresh} onChange={(e) => setAuto(e.target.checked)} />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label={t("kpi_gb")} value={nf.format(Math.max(0, kpis.gb24h / 1000))} suffix="T" trend={kpis.gbDelta} />
          <KPI label={t("kpi_bpi")} value={kpis.bpi.toFixed(4)} prefix="$" />
          <KPI label={t("kpi_nodes")} value={nf.format(kpis.nodes)} />
          <KPI label={t("kpi_burn")} value={nf.format(kpis.burnK)} suffix="k" />
        </section>

        {/* Aggregate KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPI label={t("kpi_mtd")} value={(kpis.mtdGB / 1000).toFixed(2)} suffix="T" />
          <KPI label={t("kpi_ytd")} value={(kpis.ytdGB / 1000).toFixed(2)} suffix="T" />
          <KPI label={t("kpi_total")} value={(kpis.totalGB / 1000).toFixed(2)} suffix="T" />
        </section>

        {/* User & Wallet KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label={t("kpi_users")} value={nf.format(kpis.usersMAU)} />
          <KPI label={t("kpi_wallets")} value={nf.format(kpis.wallets30d)} />
          <KPI label={t("kpi_online")} value={nf.format(kpis.onlineConcurrent)} />
          <KPI label={t("kpi_devices")} value={nf.format(kpis.activeDevices)} />
        </section>

        {/* Badges */}
        <section className="flex flex-wrap items-center gap-3">
          <Badge label={t("badge_total_burn")} value={`${nf.format(kpis.totalBurnK)}k $CONET`} />
          <Badge label={t("badge_peak")} value={`${(kpis.peakGB / 1000).toFixed(2)}T @ ${kpis.peakLabel}`} />
        </section>

        {/* Charts Row 1: Usage + BPI */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title={t("chart_gb")} subtitle="GB/day across the network" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#0f172a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#1f2937" }} />
                  <YAxis tick={{ fill: "#94a3b8" }} axisLine={{ stroke: "#1f2937" }} />
                  <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", color: "#e2e8f0" }} />
                  <Line type="monotone" dataKey="gb" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <CardHeader title={t("chart_bpi")} subtitle="Bandwidth Price Index" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#0f172a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#1f2937" }} />
                  <YAxis tick={{ fill: "#94a3b8" }} axisLine={{ stroke: "#1f2937" }} domain={[0.008, 0.02]} />
                  <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", color: "#e2e8f0" }} />
                  <Area type="monotone" dataKey="bpi" stroke="#06b6d4" fill="url(#g1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* Charts Row 1.5: Online (60m) + Retention */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title={t("chart_online")} subtitle="minute‑level" />
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={demoConcurrentSeries} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#0f172a" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1f2937" }} interval={11} />
                  <YAxis tick={{ fill: "#94a3b8" }} axisLine={{ stroke: "#1f2937" }} />
                  <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", color: "#e2e8f0" }} />
                  <Line type="monotone" dataKey="online" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <CardHeader title={t("chart_retention")} subtitle="cohort snapshot" />
            <div className="h-40 flex items-center justify-center px-4">
              <ul className="w-full text-sm text-slate-200">
                <li className="flex items-center justify-between py-1">
                  <span>D1</span>
                  <span className="font-semibold">{(demoRetention.d1 * 100).toFixed(0)}%</span>
                </li>
                <li className="flex items-center justify-between py-1">
                  <span>D7</span>
                  <span className="font-semibold">{(demoRetention.d7 * 100).toFixed(0)}%</span>
                </li>
                <li className="flex items-center justify-between py-1">
                  <span>D30</span>
                  <span className="font-semibold">{(demoRetention.d30 * 100).toFixed(0)}%</span>
                </li>
              </ul>
            </div>
          </Card>
        </section>

        {/* Charts Row 2: Regions + Apps */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader title={t("chart_nodes")} subtitle="Active nodes and traffic share by region" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regions} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#0f172a" strokeDasharray="3 3" />
                  <XAxis dataKey="region" tick={{ fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#1f2937" }} />
                  <YAxis yAxisId="left" tick={{ fill: "#94a3b8" }} axisLine={{ stroke: "#1f2937" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8" }} axisLine={{ stroke: "#1f2937" }} />
                  <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", color: "#e2e8f0" }} />
                  <Bar yAxisId="left" dataKey="nodes" name="Nodes" fill="#8b5cf6" radius={[8,8,0,0]} />
                  <Bar yAxisId="right" dataKey="traffic" name="Traffic %" fill="#f59e0b" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <CardHeader title={t("chart_apps")} subtitle="App‑level traffic share" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={apps} dataKey="share" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {apps.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", color: "#e2e8f0" }} formatter={(v: number) => pf.format(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="px-4 pb-4 text-sm text-slate-300">
              <ul className="space-y-1">
                {apps.map((a, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {a.name}
                    </span>
                    <span>{pf.format(a.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </section>

        {/* Top Nodes Table */}
        <section>
          <Card>
            <CardHeader title={t("table_nodes")} subtitle="Sorted by QoS score" />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-slate-300">
                    <th className="text-left px-4 py-2">ID</th>
                    <th className="text-left px-4 py-2">{t("c_role")}</th>
                    <th className="text-left px-4 py-2">{t("c_region")}</th>
                    <th className="text-right px-4 py-2">{t("c_latency")}</th>
                    <th className="text-right px-4 py-2">{t("c_uptime")}</th>
                    <th className="text-right px-4 py-2">{t("c_qos")}</th>
                    <th className="text-right px-4 py-2">{t("c_throughput")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topNodes
                    .sort((a, b) => b.qos - a.qos)
                    .map((n, i) => (
                      <tr key={n.id} className={i % 2 ? "bg-slate-900/40" : ""}>
                        <td className="px-4 py-2 font-mono text-slate-200">{n.id}</td>
                        <td className="px-4 py-2">{n.role}</td>
                        <td className="px-4 py-2">{n.region}</td>
                        <td className="px-4 py-2 text-right">{n.latency}ms</td>
                        <td className="px-4 py-2 text-right">{(n.uptime * 100).toFixed(2)}%</td>
                        <td className="px-4 py-2 text-right">{(n.qos * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right">{n.throughput.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <p className="text-slate-500 text-xs text-center">{t("footer")}</p>
      </main>
    </div>
  );
}

// ---- UI primitives (Card + Header + KPI + Badge) ----
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 shadow-xl shadow-black/30 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <h3 className="text-base md:text-lg font-semibold tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function KPI({ label, value, prefix = "", suffix = "", trend }: { label: string; value: string | number; prefix?: string; suffix?: string; trend?: number }) {
  const isUp = (trend ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-slate-400 text-xs">{label}</div>
      <div className="mt-1 flex items-end justify-between">
        <div className="text-2xl font-semibold">{prefix}{value}{suffix}</div>
        {trend !== undefined && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${isUp ? "bg-emerald-900/40 text-emerald-300" : "bg-rose-900/40 text-rose-300"}`}>
            {isUp ? "▲" : "▼"} {Math.abs(trend) > 3 ? trend.toFixed(0) : (trend * 100).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-200">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

// ------------------------------
// Integration Notes (remove in prod):
// 1) Replace demo data with your APIs:
//    - GET /api/metrics/series?range=14d -> [{date, label, gb, bpi, burn}]
//    - GET /api/metrics/regions -> [{region, nodes, traffic}]
//    - GET /api/metrics/apps -> [{name, share}]
//    - GET /api/metrics/top-nodes -> [{id, role, region, qos, latency, uptime, throughput}]
//    - GET /api/metrics/aggregates -> { last24hGB, mtdGB, ytdGB, totalGB, nodes, bpi, burn24h, usersMAU, wallets30d, onlineConcurrent, activeDevices }
// 2) Consider using SSE or WebSocket for near‑real‑time updates.
// 3) Expose a public JSON at https://conet.network/status.json for embedding & community tools.
// 4) Add auth-gated views for internal OPS (per‑node logs, ASNs, abuse, sybil rate, alerts).
// 5) Keep all numbers privacy‑preserving; aggregate at region/bin level; never leak user data.
// ------------------------------
