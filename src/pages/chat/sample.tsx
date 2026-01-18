import React, { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Home,
  Info,
  Lock,
  MessageCircle,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Ticket,
  User,
  X,
  MoreHorizontal
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card";

/**
 * Beamio — Personal Canada UI skeleton
 * Focus: P2P (Direct Send) + Receipt Threads
 * Style: Apple-like, minimal, Beamio Blue
 *
 * Product truths:
 * - Settlement is USDC only.
 * - CAD display is an approximation from an oracle (~10 min updates).
 * - Receipts are verifiable; Beamio is non-custodial.
 *
 * Pay entry points:
 * 1) Home (FAB)
 * 2) Pay Hub (B tab)
 * 3) Search bar paste/tag
 * 4) Chat thread header “Pay”
 * 5) Receipt details “Send back / Pay again”
 */

const BEAMIO_BLUE = "#1652f0";
const BG_THREAD = "#eaf3ff";

type Viewer = "A" | "B";

type Route =
  | { screen: "home" }
  | { screen: "tx" }
  | { screen: "pay_hub" }
  | { screen: "me" }
  | { screen: "settings" }
  | { screen: "chat_list" }
  | { screen: "thread"; threadId: string }
  | { screen: "search" }
  | { screen: "contact" }
  | { screen: "pay" }
  | { screen: "scan" }
  | { screen: "payme_request" };

type ReceiptStatus = "completed" | "pending" | "failed";

type EventBase = { id: string; ts: number };

type DateEvent = EventBase & { type: "date"; label: string };

type MsgEvent = EventBase & {
  type: "msg";
  from: Viewer;
  text: string;
};

type ReceiptEvent = EventBase & {
  type: "receipt";
  from: Viewer;
  to: Viewer;
  amountUSDC: number;
  approxLocal: { code: string; value: number };
  note?: string;
  status: ReceiptStatus;
  network: "Base";
  gas: "Sponsored" | "User";
  tx: string;
};

type Event = DateEvent | MsgEvent | ReceiptEvent;

type Person = {
  name: string;
  tag: string;
  addressShort: string;
  avatar: "emoji" | "placeholder";
};

type Thread = {
  id: string;
  participants: {
    A: Person;
    B: Person;
  };
  unreadFor: { A: number; B: number };
  events: Event[];
};

type TxItem = {
  id: string;
  ts: number;
  tx: string;
  counterpartyName: string;
  counterpartyTag: string;
  dateLabel: string;
  direction: "in" | "out";
  source?: "direct" | "link";
  amountUSDC: number;
  note?: string;
};

type SearchResult = {
  id: string;
  name: string;
  tag: string;
  addressShort: string;
  meta: string;
};

type PayTarget = {
  name: string;
  tag: string;
  avatar: "emoji" | "placeholder";
};

type PayBackTarget = "contact" | "payme" | "thread" | "home" | null;

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function fmtUSDC(n: number, dp: number = 4) {
  const abs = Math.abs(n);
  const fixed = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(dp);
  return `${fixed} USDC`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(ts: number) {
  return new Date(ts).toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function shortTx(tx: string) {
  if (!tx) return "";
  if (tx.length <= 12) return tx;
  return `${tx.slice(0, 6)}…${tx.slice(-4)}`;
}

function makeTxHash() {
  return `0x${Math.random().toString(16).slice(2).padEnd(40, "0").slice(0, 40)}`;
}

// ---------------------------------------------------------------------------

const NOW = Date.now();

// Demo FX: CAD -> USDC
// Example: 1 CAD = 0.7195 USDC (so 1 USDC ≈ 1.389 CAD)
const FX_CAD_TO_USDC = 0.7195;
const LOCAL_CODE = "CAD";

const USDC_BALANCE = 10.5285;
const CAD_APPROX_BAL = Number((USDC_BALANCE / FX_CAD_TO_USDC).toFixed(2));
const FX_LAST_UPDATED_MIN_AGO = 6; // demo

const CONTACT: PayTarget & { addressShort: string } = {
  name: "KEY",
  tag: "@KEY",
  addressShort: "0x5dB0…9ea3",
  avatar: "emoji",
};

const ME: Record<Viewer, Person> = {
  A: { name: "Peter okamoto", tag: "@Peter", addressShort: "0xA91f…dD44", avatar: "emoji" },
  B: { name: "KEY", tag: "@KEY", addressShort: CONTACT.addressShort, avatar: "emoji" },
};

const THREAD_ID = "t_key";

const initialThread: Thread = {
  id: THREAD_ID,
  participants: { A: ME.A, B: ME.B },
  unreadFor: { A: 0, B: 0 },
  events: [
    { id: uid("d"), type: "date", label: "Today", ts: NOW - 1000 * 60 * 30 },
    {
      id: uid("m"),
      type: "msg",
      from: "B",
      text: "Hi, can we try Beamio for next month’s training fee?",
      ts: NOW - 1000 * 60 * 25,
    },
    {
      id: uid("m"),
      type: "msg",
      from: "A",
      text: "Sure — I’ll send USDC directly from Beamio. Network fee is sponsored so you receive the full amount.",
      ts: NOW - 1000 * 60 * 24,
    },
  ],
};

const TX_SAMPLE: TxItem[] = [
  {
    id: "tx1",
    ts: NOW - 1000 * 60 * 2,
    tx: makeTxHash(),
    counterpartyName: "Test2",
    counterpartyTag: "@Beamiotest_iphone",
    dateLabel: "Jan 14",
    direction: "in",
    amountUSDC: 1.44,
  },
  {
    id: "tx2",
    ts: NOW - 1000 * 60 * 8,
    tx: makeTxHash(),
    counterpartyName: "Test2",
    counterpartyTag: "@Beamiotest_iphone",
    dateLabel: "Jan 14",
    direction: "out",
    amountUSDC: 0.72,
  },
  {
    id: "tx3",
    ts: NOW - 1000 * 60 * 12,
    tx: makeTxHash(),
    counterpartyName: "Test2",
    counterpartyTag: "@Beamiotest_iphone",
    dateLabel: "Jan 14",
    direction: "out",
    source: "link",
    amountUSDC: 0.88,
  },
  {
    id: "tx4",
    ts: NOW - 1000 * 60 * 60,
    tx: makeTxHash(),
    counterpartyName: "Test2",
    counterpartyTag: "@Beamiotest_iphone",
    dateLabel: "Jan 14",
    direction: "in",
    amountUSDC: 7.2,
  },
  {
    id: "tx5",
    ts: NOW - 1000 * 60 * 60 * 5,
    tx: makeTxHash(),
    counterpartyName: "Test2",
    counterpartyTag: "@Beamiotest_iphone",
    dateLabel: "Jan 13",
    direction: "in",
    source: "link",
    amountUSDC: 0.86,
  },
  {
    id: "tx6",
    ts: NOW - 1000 * 60 * 60 * 6,
    tx: makeTxHash(),
    counterpartyName: "Test2",
    counterpartyTag: "@Beamiotest_iphone",
    dateLabel: "Jan 13",
    direction: "out",
    source: "link",
    amountUSDC: 0.88,
  },
  {
    id: "tx7",
    ts: NOW - 1000 * 60 * 60 * 24,
    tx: makeTxHash(),
    counterpartyName: "Test2",
    counterpartyTag: "@Beamiotest_iphone",
    dateLabel: "Jan 12",
    direction: "out",
    source: "link",
    amountUSDC: 0.88,
  },
];

const SAMPLE_RESULTS: SearchResult[] = [
  { id: "r_key", name: "KEY", tag: "@KEY", addressShort: CONTACT.addressShort, meta: "BeamioTag · Contact" },
  { id: "r_alto", name: "Alto Swim Club", tag: "@AltoSwim", addressShort: "0x1c20…bA11", meta: "Merchant · Verified" },
];

const SAMPLE_PAYME = {
  merchantName: "Beamio Store",
  merchantTag: "@BeamioStore",
  amountUSDC: 2,
  amountCAD: 2.78,
};

// ---------------------------------------------------------------------------

export default function BeamioPersonalCanadaPrototype() {
  const [viewer, setViewer] = useState<Viewer>("A");
  const [route, setRoute] = useState<Route>({ screen: "home" });

  const [threads, setThreads] = useState<Record<string, Thread>>({ [THREAD_ID]: initialThread });

  // Me / Balance sheet
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [promoDismissed, setPromoDismissed] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pay
  const [payTo, setPayTo] = useState<PayTarget>({ name: CONTACT.name, tag: CONTACT.tag, avatar: CONTACT.avatar });
  const [payBackTarget, setPayBackTarget] = useState<PayBackTarget>(null);
  const [payBackThreadId, setPayBackThreadId] = useState<string | null>(null);
  const [amountUSDC, setAmountUSDC] = useState<number>(10);
  const [note, setNote] = useState<string>("For training");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feeExpanded, setFeeExpanded] = useState(false);
  const [sending, setSending] = useState<"idle" | "success">("idle");

  // Receipt details sheet
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsReceipt, setDetailsReceipt] = useState<ReceiptEvent | null>(null);

  // Chat
  const [composer, setComposer] = useState("");
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackAmount, setSendBackAmount] = useState(10);
  const [sendBackNote, setSendBackNote] = useState("Send back");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Transactions
  const [txTab, setTxTab] = useState<"completed" | "payment_link" | "cashcode">("completed");
  const [txFilter, setTxFilter] = useState<"all" | "sent" | "receive">("all");

  const me = viewer;
  const them: Viewer = viewer === "A" ? "B" : "A";

  const activeThread = useMemo(() => {
    if (route.screen !== "thread") return null;
    return threads[route.threadId] ?? null;
  }, [route, threads]);

  const filteredResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SAMPLE_RESULTS;
    return SAMPLE_RESULTS.filter((r) => `${r.name} ${r.tag} ${r.addressShort}`.toLowerCase().includes(q));
  }, [searchQuery]);

  const txRows = useMemo(() => {
    return TX_SAMPLE.filter((t) => {
      if (txFilter === "all") return true;
      if (txFilter === "sent") return t.direction === "out";
      return t.direction === "in";
    });
  }, [txFilter]);

  const chatRows = useMemo(() => {
    const t = threads[THREAD_ID];
    const peer = viewer === "A" ? t.participants.B : t.participants.A;
    const last = [...t.events].reverse().find((e) => e.type === "msg" || e.type === "receipt") as
      | MsgEvent
      | ReceiptEvent
      | undefined;

    const lastText = !last ? "No messages yet" : last.type === "msg" ? last.text : receiptPreviewFor(viewer, last);
    const time = last ? new Date(last.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

    return [
      { id: t.id, name: peer.name, tag: peer.tag, avatar: peer.avatar, last: lastText, time, unread: t.unreadFor[viewer] },
      { id: "t_official", name: "Beamio Official", tag: "@Beamio", avatar: "placeholder" as const, last: "Welcome to Beamio — USDC payments.", time: "Mon", unread: 0 },
    ];
  }, [threads, viewer]);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  function openThread(threadId: string) {
    setThreads((prev) => {
      const next = { ...prev };
      const t = next[threadId];
      if (!t) return prev;
      next[threadId] = { ...t, unreadFor: { ...t.unreadFor, [viewer]: 0 } };
      return next;
    });
    setRoute({ screen: "thread", threadId });
    requestAnimationFrame(scrollToBottom);
  }

  function openPayFor(target: PayTarget, backTo: PayBackTarget) {
    setPayTo(target);
    setPayBackTarget(backTo);
    setPayBackThreadId(backTo === "thread" && route.screen === "thread" ? route.threadId : null);
    setSending("idle");
    setConfirmOpen(false);
    setRoute({ screen: "pay" });
  }

  function closePayScreen() {
    if (payBackTarget === "payme") return setRoute({ screen: "payme_request" });
    if (payBackTarget === "contact") return setRoute({ screen: "contact" });
    if (payBackTarget === "thread" && payBackThreadId) return setRoute({ screen: "thread", threadId: payBackThreadId });
    return setRoute({ screen: "home" });
  }

  function openReceiptDetails(receipt: ReceiptEvent) {
    setDetailsReceipt(receipt);
    setDetailsOpen(true);
  }

  function onSend() {
    const usdc = Number(amountUSDC);
    if (!isFinite(usdc) || usdc <= 0) return;
    setFeeExpanded(false);
    setConfirmOpen(true);
  }

  function pushReceiptToThread(receipt: ReceiptEvent, optionalNote?: string) {
    setThreads((prev) => {
      const next = { ...prev };
      const t = next[THREAD_ID] ?? initialThread;

      const noteEv: MsgEvent | null = optionalNote?.trim()
        ? { id: uid("m"), type: "msg", from: receipt.from, text: optionalNote.trim(), ts: receipt.ts + 1 }
        : null;

      next[THREAD_ID] = {
        ...t,
        events: [...t.events, receipt, ...(noteEv ? [noteEv] : [])],
        unreadFor: { ...t.unreadFor, [receipt.to]: t.unreadFor[receipt.to] + 1 },
      };

      return next;
    });
  }

  function confirmTransfer() {
    setConfirmOpen(false);

    const ts = Date.now();
    const tx = makeTxHash();
    const cadApprox = Number((Number(amountUSDC) / FX_CAD_TO_USDC).toFixed(2));

    const receipt: ReceiptEvent = {
      id: uid("rcpt"),
      type: "receipt",
      from: me,
      to: them,
      amountUSDC: Number(amountUSDC),
      approxLocal: { code: LOCAL_CODE, value: cadApprox },
      note: note.trim() || undefined,
      status: "completed",
      network: "Base",
      gas: "Sponsored",
      tx,
      ts,
    };

    pushReceiptToThread(receipt, receipt.note);

    setSending("success");
    setRoute({ screen: "pay" });
  }

  function doneAfterSuccess() {
    setSending("idle");
    if (payBackTarget === "payme") return setRoute({ screen: "payme_request" });
    if (payBackTarget === "contact") return setRoute({ screen: "contact" });
    if (payBackTarget === "thread" && payBackThreadId) return setRoute({ screen: "thread", threadId: payBackThreadId });
    return setRoute({ screen: "home" });
  }

  function sendMessage() {
    const text = composer.trim();
    if (!text || !activeThread) return;

    const ev: MsgEvent = { id: uid("m"), type: "msg", from: me, text, ts: Date.now() };

    setThreads((prev) => {
      const next = { ...prev };
      const t = next[activeThread.id];
      next[activeThread.id] = {
        ...t,
        events: [...t.events, ev],
        unreadFor: { ...t.unreadFor, [them]: t.unreadFor[them] + 1 },
      };
      return next;
    });

    setComposer("");
    requestAnimationFrame(scrollToBottom);
  }

  function onSendBackFromReceipt(r: ReceiptEvent) {
    setSendBackAmount(r.amountUSDC);
    setSendBackNote("Send back");
    setSendBackOpen(true);
  }

  function confirmSendBack() {
    if (!activeThread) return;
    const amt = Number(sendBackAmount);
    if (!isFinite(amt) || amt <= 0) return;

    const ts = Date.now();
    const receipt: ReceiptEvent = {
      id: uid("rcpt"),
      type: "receipt",
      from: me,
      to: them,
      amountUSDC: amt,
      approxLocal: { code: LOCAL_CODE, value: Number((amt / FX_CAD_TO_USDC).toFixed(2)) },
      note: sendBackNote.trim() || undefined,
      status: "completed",
      network: "Base",
      gas: "Sponsored",
      tx: makeTxHash(),
      ts,
    };

    pushReceiptToThread(receipt, receipt.note);
    setSendBackOpen(false);
    requestAnimationFrame(scrollToBottom);
  }

  function receiptFromTxRow(t: TxItem): ReceiptEvent {
    const amount = t.amountUSDC;
    const from: Viewer = t.direction === "out" ? me : them;
    const to: Viewer = t.direction === "out" ? them : me;

    return {
      id: `rcpt_${t.id}`,
      type: "receipt",
      from,
      to,
      amountUSDC: amount,
      approxLocal: { code: LOCAL_CODE, value: Number((amount / FX_CAD_TO_USDC).toFixed(2)) },
      note: t.note,
      status: "completed",
      network: "Base",
      gas: "Sponsored",
      tx: t.tx,
      ts: t.ts,
    };
  }

  function openPayAgainFromReceipt(r: ReceiptEvent) {
    setDetailsOpen(false);
    setPayTo({ name: CONTACT.name, tag: CONTACT.tag, avatar: CONTACT.avatar });
    setAmountUSDC(r.amountUSDC);
    setNote("Pay again");
    setPayBackTarget(route.screen === "thread" ? "thread" : "home");
    setPayBackThreadId(route.screen === "thread" ? route.threadId : null);
    setSending("idle");
    setConfirmOpen(false);
    setRoute({ screen: "pay" });
  }

  // -----------------------------------------------------------------------
  // Render helpers

  function Nav(active: "home" | "tx" | "beam" | "chat" | "me") {
    return (
      <BottomTabs
        active={active}
        onNav={(k) => {
          if (k === "home") setRoute({ screen: "home" });
          if (k === "tx") setRoute({ screen: "tx" });
          if (k === "beam") setRoute({ screen: "pay_hub" });
          if (k === "chat") setRoute({ screen: "chat_list" });
          if (k === "me") setRoute({ screen: "me" });
        }}
      />
    );
  }

  function renderScreen() {
    switch (route.screen) {
      case "home":
        return (
          <motion.div
            key="home"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="relative flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              {/* Search bar */}
              <div className="flex items-center gap-3 rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 px-3 py-3">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white ring-1 ring-zinc-200">
                  <div className="text-[14px] font-black" style={{ color: BEAMIO_BLUE }}>
                    B
                  </div>
                </div>
                <button onClick={() => setRoute({ screen: "search" })} className="flex-1 text-left text-sm text-zinc-500">
                  @BeamioTag, address, or paste link
                </button>
                <button
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-zinc-200"
                  onClick={() => setRoute({ screen: "scan" })}
                  aria-label="Scan"
                >
                  <QrCode className="h-5 w-5 text-zinc-600" />
                </button>
              </div>

              {/* Events/Promotions */}
              {!promoDismissed ? (
                <div className="soft-shadow mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
                  <div
                    className="px-4 py-3 text-white"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(22,82,240,1) 0%, rgba(142,56,255,1) 55%, rgba(255,97,97,1) 100%)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[16px] font-semibold">Beamio Grand Opening</div>
                        <div className="mt-0.5 text-sm text-white/85">Events, promos, and partner drops.</div>
                      </div>
                      <button
                        onClick={() => setPromoDismissed(true)}
                        className="grid h-9 w-9 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"
                        aria-label="Dismiss"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button className="rounded-2xl bg-white text-zinc-900 hover:bg-white/90">View</Button>
                      <Button variant="default" className="rounded-2xl bg-white/20 text-white hover:bg-white/25">
                        Learn more
                      </Button>
                    </div>
                  </div>
                  <div className="px-4 py-3 text-sm text-zinc-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-zinc-500" />
                        <span>Next: Vancouver pilot partner week</span>
                      </div>
                      <span className="text-xs text-zinc-400">This week</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Activity feed (Venmo-like) */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-[0.22em] text-zinc-400">ACTIVITY</div>
                  <button className="text-sm" style={{ color: BEAMIO_BLUE }} onClick={() => setRoute({ screen: "tx" })}>
                    See all
                  </button>
                </div>

                <div className="soft-shadow mt-3 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
                  {txRows.slice(0, 7).map((t, idx) => (
                    <button
                      key={t.id}
                      className={`w-full px-4 py-3 text-left transition hover:bg-zinc-50 ${idx !== 0 ? "border-t border-zinc-200" : ""}`}
                      onClick={() => openReceiptDetails(receiptFromTxRow(t))}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200">
                            <span className="text-lg">😈</span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-semibold">{t.counterpartyName}</div>
                            <div className="mt-0.5 truncate text-sm text-zinc-500">
                              {t.direction === "in" ? "Received" : "Sent"} · {t.dateLabel}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-[15px] font-semibold ${t.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                            {t.direction === "in" ? "+" : "-"}
                            {t.amountUSDC.toFixed(2)} USDC
                          </div>
                          <div className="text-xs text-zinc-400">≈ CA$ {(t.amountUSDC / FX_CAD_TO_USDC).toFixed(2)}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-3 text-xs text-zinc-400">Tap an item to view details, then Message to open the receipt thread.</div>
              </div>

              <AnimatePresence>
                {detailsOpen && detailsReceipt ? (
                  <PaymentDetailsSheet
                    receipt={detailsReceipt}
                    viewer={viewer}
                    onClose={() => setDetailsOpen(false)}
                    onMessage={() => {
                      setDetailsOpen(false);
                      openThread(THREAD_ID);
                    }}
                    onSendBack={() => {
                      setDetailsOpen(false);
                      onSendBackFromReceipt(detailsReceipt);
                    }}
                    onPayAgain={() => openPayAgainFromReceipt(detailsReceipt)}
                  />
                ) : null}
              </AnimatePresence>
            </div>

            {/* Floating Pay (keeps Home minimal + Venmo-like) */}
            <div className="pointer-events-none fixed inset-x-0 bottom-[92px] mx-auto w-full max-w-[430px] px-4">
              <div className="flex justify-end">
                <button
                  className="pointer-events-auto soft-shadow h-14 rounded-full px-5 font-semibold text-white"
                  style={{ background: BEAMIO_BLUE }}
                  onClick={() => setRoute({ screen: "pay_hub" })}
                >
                  Pay
                </button>
              </div>
            </div>

            <div className="mt-auto">{Nav("home")}</div>
          </motion.div>
        );

      case "tx":
        return (
          <motion.div
            key="tx"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-[0.22em] text-zinc-400">BEAMIO</div>
                  <div className="mt-1 text-[28px] font-semibold tracking-tight">Payments</div>
                </div>
                <button className="text-right" onClick={() => setRoute({ screen: "me" })}>
                  <div className="text-[14px] font-semibold">CA$ {CAD_APPROX_BAL.toFixed(2)}</div>
                  <div className="text-sm text-zinc-500">Available</div>
                </button>
              </div>

              <div className="mt-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Info className="h-4 w-4" />
                  <span>Beamio settles in USDC. CAD is an estimate (FX updates every ~10 min).</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 rounded-2xl bg-zinc-100 p-1 ring-1 ring-zinc-200">
                <Seg active={txTab === "completed"} onClick={() => setTxTab("completed")} label="Completed" />
                <Seg active={txTab === "payment_link"} onClick={() => setTxTab("payment_link")} label="Payment Link" />
                <Seg active={txTab === "cashcode"} onClick={() => setTxTab("cashcode")} label="Cashcode" />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Pill active={txFilter === "sent"} onClick={() => setTxFilter("sent")}>
                  Sent
                </Pill>
                <Pill active={txFilter === "receive"} onClick={() => setTxFilter("receive")}>
                  Receive
                </Pill>
                <Pill active={txFilter === "all"} onClick={() => setTxFilter("all")}>
                  All
                </Pill>
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              {txTab !== "completed" ? (
                <div className="px-4">
                  <div className="soft-shadow rounded-3xl bg-white p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
                    <div className="font-semibold">Coming soon</div>
                    <div className="mt-1">Personal Canada v0 focuses on Completed activity + P2P receipts.</div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-200">
                  {txRows.map((t) => (
                    <button
                      key={t.id}
                      className="w-full px-4 py-4 text-left transition hover:bg-zinc-50"
                      onClick={() => openReceiptDetails(receiptFromTxRow(t))}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-200 ring-1 ring-zinc-200">
                          <span className="text-lg">😈</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[18px] font-semibold">{t.counterpartyName}</div>
                              <div className="mt-1 truncate text-sm text-zinc-500">{t.counterpartyTag}</div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                                <span>{t.dateLabel}</span>
                                <span className="text-zinc-300">·</span>
                                <span className="inline-flex items-center gap-1">
                                  {t.direction === "in" ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600">
                                      <span className="text-[12px]">↙</span> Receive
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-rose-600">
                                      <span className="text-[12px]">↗</span> Sent
                                    </span>
                                  )}
                                </span>
                                {t.source === "link" ? (
                                  <span className="inline-flex items-center gap-1 text-purple-600">
                                    <span className="text-[12px]">⛓</span> Link
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className={`text-[18px] font-semibold ${t.direction === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                                {t.direction === "in" ? "+" : "-"} {t.amountUSDC.toFixed(2)} USDC
                              </div>
                              <div className="mt-1 text-sm text-zinc-400">CA$ {(t.amountUSDC / FX_CAD_TO_USDC).toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <AnimatePresence>
              {detailsOpen && detailsReceipt ? (
                <PaymentDetailsSheet
                  receipt={detailsReceipt}
                  viewer={viewer}
                  onClose={() => setDetailsOpen(false)}
                  onMessage={() => {
                    setDetailsOpen(false);
                    openThread(THREAD_ID);
                  }}
                  onSendBack={() => {
                    setDetailsOpen(false);
                    onSendBackFromReceipt(detailsReceipt);
                  }}
                  onPayAgain={() => openPayAgainFromReceipt(detailsReceipt)}
                />
              ) : null}
            </AnimatePresence>

            {Nav("tx")}
          </motion.div>
        );

      case "pay_hub":
        return (
          <motion.div
            key="payhub"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              <div className="flex items-center gap-3 rounded-2xl bg-zinc-100 ring-1 ring-zinc-200 px-3 py-3">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white ring-1 ring-zinc-200">
                  <div className="text-[14px] font-black" style={{ color: BEAMIO_BLUE }}>
                    B
                  </div>
                </div>
                <button onClick={() => setRoute({ screen: "search" })} className="flex-1 text-left text-sm text-zinc-500">
                  @BeamioTag, address, or paste link
                </button>
                <button
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-zinc-200"
                  onClick={() => setRoute({ screen: "scan" })}
                  aria-label="Scan"
                >
                  <QrCode className="h-5 w-5 text-zinc-600" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <HubTile title="Send" tone="blue" icon={<Send className="h-6 w-6 text-white" />} onClick={() => setRoute({ screen: "search" })} />
                <HubTile title="PayMe" tone="dark" icon={<QrCode className="h-6 w-6 text-white" />} onClick={() => setRoute({ screen: "payme_request" })} />
                <HubTile title="Links (Reusable)" tone="purple" icon={<ExternalLink className="h-6 w-6 text-white" />} onClick={() => setRoute({ screen: "tx" })} />
                <HubTile title="Links (One-time)" tone="purple" icon={<ExternalLink className="h-6 w-6 text-white" />} onClick={() => setRoute({ screen: "tx" })} />
              </div>

              <div className="soft-shadow mt-5 rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="text-sm font-semibold">Personal Canada v0</div>
                <div className="mt-1 text-sm text-zinc-600">Keep the hub focused: Send + PayMe + Links.</div>
              </div>
            </div>

            <div className="mt-auto">{Nav("beam")}</div>
          </motion.div>
        );

      case "scan":
        return (
          <motion.div
            key="scan"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" className="rounded-full" onClick={() => setRoute({ screen: "home" })}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="text-[18px] font-semibold">Scan</div>
                <div className="w-10" />
              </div>

              <div className="soft-shadow mt-4 rounded-3xl bg-zinc-950 p-6 text-white">
                <div className="flex items-center gap-2 text-white/85">
                  <ScanLine className="h-5 w-5" />
                  <div className="text-sm">Camera preview (prototype)</div>
                </div>
                <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm text-white/80 ring-1 ring-white/15">
                  This demo shows pay flows without a real camera.
                </div>
              </div>

              <div className="soft-shadow mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
                <div className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-400">SAMPLE SCANS</div>
                <div className="divide-y divide-zinc-200">
                  <button className="w-full px-4 py-4 text-left transition hover:bg-zinc-50" onClick={() => setRoute({ screen: "payme_request" })}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[16px] font-semibold">PayMe request</div>
                        <div className="mt-1 text-sm text-zinc-500">
                          {SAMPLE_PAYME.merchantName} · {SAMPLE_PAYME.merchantTag}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[16px] font-semibold">CA$ {SAMPLE_PAYME.amountCAD.toFixed(2)}</div>
                        <div className="text-xs text-zinc-400">{SAMPLE_PAYME.amountUSDC.toFixed(2)} USDC</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs text-zinc-400">In production: scan PayMe QR, payment links, or cashcodes.</div>
            </div>

            <div className="mt-auto">{Nav("home")}</div>
          </motion.div>
        );

      case "payme_request":
        return (
          <motion.div
            key="payme_request"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" className="rounded-full" onClick={() => setRoute({ screen: "pay_hub" })}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="text-[18px] font-semibold">PayMe</div>
                <div className="w-10" />
              </div>

              <div className="soft-shadow mt-4 overflow-hidden rounded-[30px] ring-1 ring-zinc-200">
                <div
                  className="p-5 text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,1) 0%, rgba(22,82,240,1) 60%, rgba(142,56,255,1) 115%)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white/75">Request from</div>
                      <div className="mt-1 text-[18px] font-semibold">{SAMPLE_PAYME.merchantName}</div>
                      <div className="text-sm text-white/70">{SAMPLE_PAYME.merchantTag}</div>
                    </div>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
                      onClick={() => setRoute({ screen: "scan" })}
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-6">
                    <div className="text-[46px] font-black tracking-tight">CA$ {SAMPLE_PAYME.amountCAD.toFixed(2)}</div>
                    <div className="mt-1 text-sm text-white/80">{SAMPLE_PAYME.amountUSDC.toFixed(2)} USDC (exact settlement)</div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm text-white/85 ring-1 ring-white/15">Tips can be added on the next screen.</div>
                </div>

                <div className="bg-white p-4">
                  <Button
                    className="w-full rounded-2xl"
                    style={{ background: BEAMIO_BLUE }}
                    onClick={() => {
                      openPayFor({ name: SAMPLE_PAYME.merchantName, tag: SAMPLE_PAYME.merchantTag, avatar: "placeholder" }, "payme");
                      setAmountUSDC(SAMPLE_PAYME.amountUSDC);
                      setNote("PayMe");
                    }}
                  >
                    Pay now
                  </Button>
                  <div className="mt-2 text-xs text-zinc-500">You approve with your signature. Beamio does not custody funds.</div>
                </div>
              </div>
            </div>

            <div className="mt-auto">{Nav("beam")}</div>
          </motion.div>
        );

      case "me":
        return (
          <motion.div
            key="me"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div
              className="soft-shadow rounded-b-[34px] px-5 pb-6 pt-5 text-white"
              style={{
                background: "linear-gradient(135deg, rgba(0,180,255,1) 0%, rgba(22,82,240,1) 55%, rgba(142,56,255,1) 110%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm ring-1 ring-white/20">Personal</div>
                <div className="flex items-center gap-2">
                  <button className="grid h-11 w-11 place-items-center rounded-full bg-white/10 ring-1 ring-white/20" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                  </button>
                  <button
                    className="grid h-11 w-11 place-items-center rounded-full bg-white/10 ring-1 ring-white/20"
                    onClick={() => setRoute({ screen: "settings" })}
                    aria-label="Settings"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col items-center text-center">
                <div className="grid h-24 w-24 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <span className="text-4xl">😓</span>
                </div>
                <div className="mt-3 text-[26px] font-semibold">@BeamioDemo</div>
                <div className="mt-1 text-sm text-white/80">Beamio account since Jan 3, 2026</div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button variant='default' className="rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15">
                    <QrCode className="mr-2 h-4 w-4" />
                    My QR
                  </Button>
                  <Button
                    variant='outline'
                    className="rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
                    onClick={() => navigator.clipboard?.writeText("@BeamioDemo")}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy tag
                  </Button>
                </div>

                <div className="mt-4 grid w-full max-w-[320px] grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 py-3 ring-1 ring-white/20">
                    <div className="text-[18px] font-semibold">2</div>
                    <div className="text-[11px] tracking-[0.22em] text-white/70">FOLLOWING</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 py-3 ring-1 ring-white/20">
                    <div className="text-[18px] font-semibold">1</div>
                    <div className="text-[11px] tracking-[0.22em] text-white/70">FOLLOWERS</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-4 pt-4">
              {/* Balance lives here (not duplicated on Home) */}
              <button
                className="soft-shadow w-full rounded-3xl bg-white p-4 text-left ring-1 ring-zinc-200"
                onClick={() => setWalletSheetOpen(true)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.22em] text-zinc-400">AVAILABLE</div>
                    <div className="mt-1 text-[26px] font-semibold">CA$ {CAD_APPROX_BAL.toFixed(2)}</div>
                    <div className="mt-1 text-sm text-zinc-500">{USDC_BALANCE.toFixed(4)} USDC (exact)</div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200">
                    <Info className="h-5 w-5 text-zinc-600" />
                  </div>
                </div>
                <div className="mt-3 text-xs text-zinc-400">FX via oracle · updates ~10 min · {FX_LAST_UPDATED_MIN_AGO}m ago</div>
              </button>

              <div className="soft-shadow rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="text-[18px] font-semibold">Account</div>
                <div className="mt-2 text-sm text-zinc-600">
                  Keep Beamio simple: pay by @BeamioTag and view receipts in Chat. Preferences live in Settings.
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant='outline' className="rounded-2xl" onClick={() => setRoute({ screen: "settings" })}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                  <Button variant='outline' className="rounded-2xl">
                    Help
                  </Button>
                </div>
              </div>

              <div className="soft-shadow rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="text-[18px] font-semibold">Your Beamio profile</div>
                <div className="mt-2 text-sm text-zinc-600">Wallet details stay hidden by default — designed for everyday users.</div>
              </div>
            </div>

            <AnimatePresence>{walletSheetOpen ? <WalletSheet onClose={() => setWalletSheetOpen(false)} /> : null}</AnimatePresence>

            <div className="mt-auto">{Nav("me")}</div>
          </motion.div>
        );

      case "settings":
        return (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" className="rounded-full" onClick={() => setRoute({ screen: "me" })}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="text-[18px] font-semibold">Settings</div>
                <div className="w-10" />
              </div>

              <div className="mt-4 space-y-4">
                <div className="soft-shadow rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                  <div className="text-sm font-semibold">Security</div>
                  <div className="mt-3 space-y-2">
                    <button className="w-full rounded-2xl bg-zinc-50 px-3 py-3 text-left transition hover:bg-zinc-100 ring-1 ring-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-zinc-200">
                          <Shield className="h-5 w-5 text-zinc-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">PIN & Face ID</div>
                          <div className="mt-0.5 text-sm text-zinc-500">Lock Beamio and approve sensitive actions</div>
                        </div>
                      </div>
                    </button>

                    <button className="w-full rounded-2xl bg-zinc-50 px-3 py-3 text-left transition hover:bg-zinc-100 ring-1 ring-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-zinc-200">
                          <RotateCcw className="h-5 w-5 text-zinc-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">Recovery</div>
                          <div className="mt-0.5 text-sm text-zinc-500">View and rotate Recovery QR</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="soft-shadow rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                  <div className="text-sm font-semibold">Display</div>
                  <div className="mt-3 space-y-2">
                    <button className="w-full rounded-2xl bg-zinc-50 px-3 py-3 text-left transition hover:bg-zinc-100 ring-1 ring-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-zinc-200">
                          <Info className="h-5 w-5 text-zinc-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">Currency</div>
                          <div className="mt-0.5 text-sm text-zinc-500">Show CAD estimates (FX updates every ~10 min)</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="soft-shadow rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                  <div className="text-sm font-semibold">Advanced</div>
                  <div className="mt-3 space-y-2">
                    <button className="w-full rounded-2xl bg-zinc-50 px-3 py-3 text-left transition hover:bg-zinc-100 ring-1 ring-zinc-200">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white ring-1 ring-zinc-200">
                          <ExternalLink className="h-5 w-5 text-zinc-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">Wallet details</div>
                          <div className="mt-0.5 text-sm text-zinc-500">Address, explorer, export (optional)</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
                    <Info className="mt-0.5 h-4 w-4" />
                    <div>Beamio is designed for everyday payments. Advanced wallet info is optional.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto">{Nav("me")}</div>
          </motion.div>
        );

      case "search":
        return (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="rounded-full" onClick={() => setRoute({ screen: "home" })}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-white ring-1 ring-zinc-200">
                  <div className="text-[14px] font-black" style={{ color: BEAMIO_BLUE }}>
                    B
                  </div>
                </div>
                <div className="flex flex-1 items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 ring-1 ring-zinc-200">
                  <Search className="h-4 w-4 text-zinc-500" />
                  <input
                    className="w-full bg-transparent text-sm placeholder:text-zinc-500 focus:outline-none"
                    placeholder="@BeamioTag, address, or paste link"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchQuery ? (
                    <button
                      className="grid h-7 w-7 place-items-center rounded-full bg-white ring-1 ring-zinc-200"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear"
                    >
                      <X className="h-4 w-4 text-zinc-500" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="soft-shadow mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
                <div className="px-4 py-3 text-xs font-semibold tracking-widest text-zinc-400">RESULTS</div>
                <div className="divide-y divide-zinc-200">
                  {filteredResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (r.id === "r_key") setRoute({ screen: "contact" });
                      }}
                      className="w-full px-4 py-3 text-left transition hover:bg-zinc-50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar kind={r.id === "r_key" ? "emoji" : "placeholder"} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="truncate text-[16px] font-semibold">{r.name}</div>
                            <div className="text-xs text-zinc-400">10:21</div>
                          </div>
                          <div className="mt-1 truncate text-sm text-zinc-500">{r.tag}</div>
                          <div className="mt-1 truncate text-xs text-zinc-400">{r.meta}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto">{Nav("home")}</div>
          </motion.div>
        );

      case "contact":
        return (
          <motion.div
            key="contact"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="relative">
              <div
                className="soft-shadow rounded-b-[34px] px-5 pb-6 pt-6 text-white"
                style={{
                  background: "linear-gradient(135deg, rgba(0,180,255,1) 0%, rgba(22,82,240,1) 55%, rgba(142,56,255,1) 110%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs tracking-[0.22em] text-white/75">CONTACT</div>
                  <button
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/20"
                    onClick={() => setRoute({ screen: "search" })}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 flex flex-col items-center text-center">
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                    <span className="text-4xl">😈</span>
                  </div>
                  <div className="mt-3 text-[26px] font-semibold">{CONTACT.name}</div>
                  <div className="mt-1 text-sm text-white/80">{CONTACT.tag}</div>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-1 ring-white/15">
                    <div className="text-sm font-semibold">{CONTACT.tag}</div>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
                      onClick={() => navigator.clipboard?.writeText(CONTACT.tag)}
                      aria-label="Copy"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="-mt-4 px-4">
                <div className="soft-shadow rounded-3xl bg-white p-2 ring-1 ring-zinc-200">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      className="rounded-2xl"
                      style={{ background: BEAMIO_BLUE }}
                      onClick={() => openPayFor({ name: CONTACT.name, tag: CONTACT.tag, avatar: CONTACT.avatar }, "contact")}
                    >
                      Pay
                    </Button>
                    <Button variant="secondary" className="rounded-2xl" onClick={() => openThread(THREAD_ID)}>
                      Chat
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pt-5">
              <div className="soft-shadow rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Lock className="h-4 w-4" />
                  <span>Receipts create a thread automatically.</span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">Messaging stays end-to-end encrypted.</div>
              </div>
            </div>

            <div className="mt-auto">{Nav("home")}</div>
          </motion.div>
        );

      case "pay":
        return (
          <motion.div
            key="pay"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" className="rounded-full" onClick={closePayScreen}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="text-[18px] font-semibold">Pay</div>
                <div className="w-10" />
              </div>

              <div className="soft-shadow mt-4 rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
                <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-3 py-3 ring-1 ring-sky-100">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-200 ring-1 ring-zinc-200">
                      <span className="text-lg">😈</span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">{payTo.name}</div>
                      <div className="truncate text-sm text-zinc-500">{payTo.tag}</div>
                    </div>
                  </div>
                  <button
                    className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-zinc-200"
                    onClick={closePayScreen}
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-zinc-500" />
                  </button>
                </div>

                {/* Amount — USDC exact, CAD shown as estimate */}
                <div className="mt-4 rounded-2xl bg-white px-4 py-4 ring-1 ring-zinc-200">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm text-zinc-500">You send (USDC)</div>
                    <div className="text-xs text-zinc-400">≈ CA$ {(Number(amountUSDC) / FX_CAD_TO_USDC).toFixed(2)}</div>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="text-lg font-semibold text-zinc-700">USDC</div>
                    <input
                      className="w-[170px] bg-transparent text-right text-[44px] font-black tracking-tight focus:outline-none"
                      value={String(amountUSDC)}
                      onChange={(e) => setAmountUSDC(Number(e.target.value))}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    <Info className="h-4 w-4" />
                    <span>CAD estimate updates every ~10 min via oracle.</span>
                  </div>
                  <div className="mt-3">
                    <Input className="rounded-2xl" placeholder="What’s this for?" value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" className="rounded-2xl">
                    Add Photo
                  </Button>
                  <Button
                    className="rounded-2xl"
                    style={{ background: BEAMIO_BLUE }}
                    onClick={onSend}
                    disabled={!amountUSDC || Number(amountUSDC) <= 0}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {confirmOpen ? (
                <ConfirmModal
                  key="confirm"
                  feeExpanded={feeExpanded}
                  onToggleFee={() => setFeeExpanded((v) => !v)}
                  onCancel={() => setConfirmOpen(false)}
                  onConfirm={confirmTransfer}
                  amountUSDC={Number(amountUSDC)}
                  approxLocal={{ code: LOCAL_CODE, value: Number((Number(amountUSDC) / FX_CAD_TO_USDC).toFixed(2)) }}
                  note={note}
                />
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {sending === "success" ? <SuccessOverlay key="success" amountUSDC={Number(amountUSDC)} onDone={doneAfterSuccess} /> : null}
            </AnimatePresence>

            <div className="mt-auto">{Nav("home")}</div>
          </motion.div>
        );

      case "chat_list":
        return (
          <motion.div
            key="chat_list"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="text-[28px] font-semibold tracking-tight">Chat</div>
                <Button variant="ghost" className="rounded-full" onClick={() => setRoute({ screen: "home" })}>
                  <Home className="h-5 w-5" />
                </Button>
              </div>

              <div className="mt-2 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                <div className="mt-0.5 flex items-center gap-2 text-sm text-zinc-600">
                  <Lock className="h-4 w-4" />
                  <span>Your personal messages are end-to-end encrypted.</span>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 ring-1 ring-zinc-200">
                <Search className="h-4 w-4 text-zinc-500" />
                <input className="w-full bg-transparent text-sm placeholder:text-zinc-500 focus:outline-none" placeholder="Search" />
              </div>
            </div>

            <div className="mt-3 flex-1">
              <div className="divide-y divide-zinc-200">
                {chatRows.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => {
                      if (row.id === THREAD_ID) openThread(THREAD_ID);
                    }}
                    className="w-full px-4 py-3 text-left transition hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar kind={row.avatar} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="truncate text-[18px] font-semibold">{row.name}</div>
                          <div className="ml-3 flex items-center gap-2">
                            <div className="text-sm text-zinc-500">{row.time}</div>
                            {row.unread > 0 ? (
                              <span
                                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold text-white"
                                style={{ background: BEAMIO_BLUE }}
                              >
                                {row.unread}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-1 truncate text-sm text-zinc-500">{row.last}</div>
                      </div>
                      <MoreHorizontal className="h-4 w-4 text-zinc-300" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="px-4 py-4 text-xs text-zinc-400">Payment receipts auto-create threads. Messaging stays encrypted by default.</div>
            </div>

            {Nav("chat")}
          </motion.div>
        );

      case "thread":
        return (
          <motion.div
            key={`thread_${route.threadId}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="flex min-h-[calc(100vh-84px)] flex-col"
          >
            {activeThread ? (
              <>
                <ThreadHeader
                  thread={activeThread}
                  me={viewer}
                  onBack={() => setRoute({ screen: "chat_list" })}
                  onPay={() => openPayFor({ name: CONTACT.name, tag: CONTACT.tag, avatar: CONTACT.avatar }, "thread")}
                />

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3" style={{ background: BG_THREAD }}>
                  <div className="space-y-3 pb-2">
                    {activeThread.events.map((ev) => {
                      if (ev.type === "date") {
                        return (
                          <div key={ev.id} className="flex justify-center">
                            <div className="rounded-full bg-white/70 px-3 py-1 text-xs text-zinc-500 ring-1 ring-zinc-200">{ev.label}</div>
                          </div>
                        );
                      }

                      if (ev.type === "msg") {
                        const fromMe = ev.from === me;
                        return (
                          <div key={ev.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[82%] rounded-3xl px-4 py-2 ring-1 shadow-sm ${
                                fromMe ? "text-white" : "bg-white text-zinc-900 ring-zinc-200"
                              }`}
                              style={fromMe ? { background: BEAMIO_BLUE, borderColor: "transparent" } : undefined}
                            >
                              <div className="text-[15px] leading-relaxed">{ev.text}</div>
                              <div className={`mt-1 text-[11px] ${fromMe ? "text-white/75" : "text-zinc-400"}`}>{fmtTime(ev.ts)}</div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <ReceiptBubble
                          key={ev.id}
                          viewer={viewer}
                          receipt={ev}
                          onSendBack={() => onSendBackFromReceipt(ev)}
                          onDetails={() => openReceiptDetails(ev)}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-zinc-200 bg-white px-3 py-3">
                  <div className="flex items-end gap-2">
                    <Input
                      className="rounded-2xl"
                      placeholder="Message"
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage();
                      }}
                    />
                    <Button
                      className="rounded-2xl px-4"
                      style={{ background: BEAMIO_BLUE }}
                      disabled={!composer.trim()}
                      onClick={sendMessage}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    <Shield className="h-4 w-4" />
                    <span>You authorize transfers with your signature. Beamio does not custody funds.</span>
                  </div>
                </div>

                {Nav("chat")}

                <AnimatePresence>
                  {detailsOpen && detailsReceipt ? (
                    <PaymentDetailsSheet
                      receipt={detailsReceipt}
                      viewer={viewer}
                      onClose={() => setDetailsOpen(false)}
                      onMessage={() => {
                        setDetailsOpen(false);
                      }}
                      onSendBack={() => {
                        setDetailsOpen(false);
                        onSendBackFromReceipt(detailsReceipt);
                      }}
                      onPayAgain={() => openPayAgainFromReceipt(detailsReceipt)}
                    />
                  ) : null}
                </AnimatePresence>

                <AnimatePresence>
                  {sendBackOpen ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
                      <div className="absolute inset-0 bg-black/30" onClick={() => setSendBackOpen(false)} />
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 1, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="soft-shadow absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-3xl bg-white p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">Send back</div>
                            <div className="text-xs text-zinc-500">Fast return from the receipt card</div>
                          </div>
                          <Button variant="ghost" className="rounded-full" onClick={() => setSendBackOpen(false)}>
                            ✕
                          </Button>
                        </div>

                        <div className="mt-3 rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-zinc-600">To</div>
                            <div className="text-sm font-semibold">{them === "A" ? ME.A.tag : ME.B.tag}</div>
                          </div>

                          <div className="mt-3">
                            <div className="text-sm text-zinc-600">Amount</div>
                            <div className="mt-1 flex items-center gap-2">
                              <Input
                                value={String(sendBackAmount)}
                                onChange={(e: any) => setSendBackAmount(Number(e.target.value))}
                                className="rounded-2xl"
                                inputMode="decimal"
                              />
                              <div className="text-sm font-semibold">USDC</div>
                            </div>
                            <div className="mt-2 text-xs text-zinc-500">Network fee: Sponsored</div>
                          </div>

                          <div className="mt-3">
                            <div className="text-sm text-zinc-600">Note</div>
                            <Input value={sendBackNote} onChange={(e: any) => setSendBackNote(e.target.value)} className="mt-1 rounded-2xl" placeholder="Optional" />
                          </div>
                        </div>

                        <Button className="mt-3 w-full rounded-2xl" style={{ background: BEAMIO_BLUE }} onClick={confirmSendBack}>
                          Confirm send
                        </Button>

                        <div className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
                          <Lock className="mt-0.5 h-4 w-4" />
                          <div>Receipts are verifiable. Messages are end-to-end encrypted.</div>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </>
            ) : (
              <div className="p-6 text-sm text-zinc-500">Thread not found.</div>
            )}
          </motion.div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen w-full bg-zinc-100 text-zinc-900">
      <style>{`
        :root { --beamio: ${BEAMIO_BLUE}; }
        .glass { background: rgba(255,255,255,.78); backdrop-filter: blur(14px); }
        .soft-shadow { box-shadow: 0 10px 30px rgba(0,0,0,.08); }
        .beamio-ring { box-shadow: 0 0 0 1px rgba(22,82,240,.18), 0 10px 30px rgba(0,0,0,.08); }
      `}</style>

      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white">
        <div className="h-3 bg-white" />

        {/* Preview switch (tiny) */}
        <div className="px-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-zinc-500">Preview</div>
            <div className="inline-flex rounded-full bg-zinc-100 p-1 ring-1 ring-zinc-200">
              <button
                onClick={() => setViewer("A")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${viewer === "A" ? "bg-white ring-1 ring-zinc-200" : "text-zinc-600"}`}
              >
                View as A
              </button>
              <button
                onClick={() => setViewer("B")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${viewer === "B" ? "bg-white ring-1 ring-zinc-200" : "text-zinc-600"}`}
              >
                View as B
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">{renderScreen()}</AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WalletSheet({ onClose }: { onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 18, opacity: 0 }}
        className="soft-shadow absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-3xl bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-semibold">Balance</div>
          <Button variant="ghost" className="rounded-full" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <div className="mt-3 rounded-3xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
          <div className="text-xs font-semibold tracking-[0.22em] text-zinc-400">AVAILABLE</div>
          <div className="mt-1 text-[30px] font-semibold">CA$ {CAD_APPROX_BAL.toFixed(2)}</div>
          <div className="mt-1 text-sm text-zinc-500">{USDC_BALANCE.toFixed(4)} USDC (exact)</div>
          <div className="mt-2 flex items-start gap-2 text-xs text-zinc-400">
            <Info className="mt-0.5 h-4 w-4" />
            <div>CAD is an estimate via oracle · updates every ~10 min · {FX_LAST_UPDATED_MIN_AGO}m ago</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" className="rounded-2xl">
            Add money
          </Button>
          <Button variant="secondary" className="rounded-2xl">
            Cash out
          </Button>
        </div>

        <Button className="mt-2 w-full rounded-2xl" style={{ background: BEAMIO_BLUE }}>
          Details
        </Button>

        <div className="mt-3 text-xs text-zinc-500">Beamio settles in USDC. You control your funds.</div>
      </motion.div>
    </motion.div>
  );
}

function Seg({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-white ring-1 ring-zinc-200" : "text-zinc-600"}`}
    >
      {label}
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${active ? "bg-white ring-zinc-200" : "bg-zinc-100 ring-zinc-200 text-zinc-600"}`}
      style={active ? { color: BEAMIO_BLUE } : undefined}
    >
      {children}
    </button>
  );
}

function HubTile({
  title,
  icon,
  onClick,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone: "blue" | "dark" | "purple";
}) {
  const bg =
    tone === "blue"
      ? "linear-gradient(180deg, rgba(22,82,240,1) 0%, rgba(22,82,240,.85) 100%)"
      : tone === "dark"
      ? "linear-gradient(180deg, rgba(25,32,44,1) 0%, rgba(17,22,31,1) 100%)"
      : "linear-gradient(180deg, rgba(142,56,255,1) 0%, rgba(120,62,255,1) 100%)";

  return (
    <button onClick={onClick} className="soft-shadow overflow-hidden rounded-3xl p-5 text-left ring-1 ring-zinc-200" style={{ background: bg }}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">{icon}</div>
      <div className="mt-4 text-[22px] font-semibold text-white">{title}</div>
    </button>
  );
}

function Avatar({ kind }: { kind: "emoji" | "placeholder" }) {
  if (kind === "emoji") {
    return (
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-fuchsia-200 ring-1 ring-zinc-200">
        <span className="text-lg">😈</span>
      </div>
    );
  }
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200">
      <User className="h-5 w-5 text-zinc-400" />
    </div>
  );
}

function ConfirmModal({
  amountUSDC,
  approxLocal,
  note,
  onCancel,
  onConfirm,
  feeExpanded,
  onToggleFee,
}: {
  amountUSDC: number;
  approxLocal: { code: string; value: number };
  note: string;
  onCancel: () => void;
  onConfirm: () => void;
  feeExpanded: boolean;
  onToggleFee: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/25" onClick={onCancel} />

      <motion.div
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 18, opacity: 0 }}
        className="absolute inset-x-0 top-20 mx-auto w-full max-w-[430px] px-4"
      >
        <div className="soft-shadow rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[28px] font-black">Total</div>
                <div className="text-sm text-zinc-500">Amount</div>
              </div>
              <div className="text-right">
                <div className="text-[28px] font-black">{fmtUSDC(amountUSDC, 2)}</div>
                <div className="text-sm text-zinc-500">
                  ≈ {approxLocal.code} {Number(approxLocal.value).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {note?.trim() ? (
            <div className="mt-3 rounded-2xl bg-yellow-50 px-4 py-3 text-sm ring-1 ring-yellow-200">{note}</div>
          ) : null}

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[18px] font-semibold">Network fee</div>
            <button onClick={onToggleFee} className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 ring-1 ring-sky-200">
              <Sparkles className="h-4 w-4" style={{ color: BEAMIO_BLUE }} />
              <span className="text-[18px] font-semibold" style={{ color: BEAMIO_BLUE }}>
                Sponsored
              </span>
            </button>
          </div>

          {feeExpanded ? (
            <div className="mt-3 rounded-2xl bg-zinc-50 p-4 text-sm ring-1 ring-zinc-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-zinc-500">Sponsor</div>
                  <div className="font-semibold">Beamio</div>
                </div>
                <div>
                  <div className="text-zinc-500">Network</div>
                  <div className="font-semibold">Base</div>
                </div>
                <div>
                  <div className="text-zinc-500">Settlement</div>
                  <div className="font-semibold">USDC</div>
                </div>
                <div>
                  <div className="text-zinc-500">Execution</div>
                  <div className="font-semibold">Sponsored Network Fee</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-zinc-500">You authorize this transfer with your signature. Beamio does not custody funds.</div>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" className="rounded-2xl" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="rounded-2xl" style={{ background: BEAMIO_BLUE }} onClick={onConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SuccessOverlay({ amountUSDC, onDone }: { amountUSDC: number; onDone: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-white/75" />
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        className="absolute inset-x-0 top-28 mx-auto w-full max-w-[430px] px-4"
      >
        <div className="soft-shadow rounded-3xl bg-white p-6 text-center ring-1 ring-zinc-200">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: BEAMIO_BLUE }}>
            <Check className="h-8 w-8 text-white" />
          </div>
          <div className="mt-4 text-[18px] font-semibold text-zinc-700">Successfully sent</div>
          <div className="mt-2 text-[34px] font-black" style={{ color: BEAMIO_BLUE }}>
            {fmtUSDC(amountUSDC, 2)}
          </div>
          <div className="mt-1 text-sm text-zinc-500">It may take a few seconds to appear on-chain.</div>

          <Button className="mt-5 w-full rounded-2xl" style={{ background: BEAMIO_BLUE }} onClick={onDone}>
            Done
          </Button>
          <Button variant="secondary" className="mt-3 w-full rounded-2xl">
            <ExternalLink className="mr-2 h-4 w-4" />
            View transaction
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ThreadHeader({
  thread,
  me,
  onBack,
  onPay,
}: {
  thread: Thread;
  me: Viewer;
  onBack: () => void;
  onPay: () => void;
}) {
  const peer = me === "A" ? thread.participants.B : thread.participants.A;

  return (
    <div className="border-b border-zinc-200 bg-white px-3 py-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="rounded-full" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar kind={peer.avatar} />
          <div className="min-w-0">
            <div className="truncate text-[18px] font-semibold">{peer.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Lock className="h-4 w-4" />
                Encrypted
              </span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500">{peer.tag}</span>
            </div>
          </div>
        </div>

        <Button variant="secondary" className="rounded-full" onClick={onPay}>
          Pay
        </Button>

        <Button variant="ghost" className="rounded-full" aria-label="More">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function receiptPreviewFor(viewer: Viewer, r: ReceiptEvent) {
  const iAmSender = r.from === viewer;
  const fromTag = ME[r.from].tag;
  const toTag = ME[r.to].tag;
  return iAmSender ? `You sent ${fmtUSDC(r.amountUSDC, 2)} to ${toTag}` : `Received ${fmtUSDC(r.amountUSDC, 2)} from ${fromTag}`;
}

function ReceiptBubble({
  viewer,
  receipt,
  onSendBack,
  onDetails,
}: {
  viewer: Viewer;
  receipt: ReceiptEvent;
  onSendBack: () => void;
  onDetails: () => void;
}) {
  const fromMe = receipt.from === viewer;
  const iAmReceiver = receipt.to === viewer;

  const fromTag = ME[receipt.from].tag;
  const toTag = ME[receipt.to].tag;

  const headline = fromMe
    ? `You sent ${fmtUSDC(receipt.amountUSDC, 2)} to ${toTag}`
    : `You received ${fmtUSDC(receipt.amountUSDC, 2)} from ${fromTag}`;

  const statusTone = receipt.status === "completed" ? "text-emerald-600" : receipt.status === "pending" ? "text-amber-600" : "text-red-600";

  return (
    <div className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[88%]">
        <Card className="rounded-3xl border-zinc-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold">{headline}</div>

                {/* Social-first: BeamioTag line (wallet details are hidden by default) */}
                <div className="mt-1 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-700">{fromTag}</span>
                  <span className="mx-2 text-zinc-300">→</span>
                  <span className="font-semibold text-zinc-700">{toTag}</span>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className={`font-semibold ${statusTone}`}>{receipt.status}</span>
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-500">Receipt</span>
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-500">Fee {receipt.gas}</span>
                </div>

                <div className="mt-1 text-xs text-zinc-500">
                  ≈ {receipt.approxLocal.code} {receipt.approxLocal.value.toFixed(2)}
                </div>

                {receipt.note ? (
                  <div className="mt-2 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200">{receipt.note}</div>
                ) : null}
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>

            {/* Keep on-chain reference subtle: short hash only */}
            <div className="mt-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">Reference</div>
                <div className="text-xs font-semibold text-zinc-700">{shortTx(receipt.tx)}</div>
              </div>
              <div className="mt-1 text-[11px] text-zinc-500">
                {fmtDay(receipt.ts)} · {fmtTime(receipt.ts)}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {iAmReceiver ? (
                <Button className="rounded-full" style={{ background: BEAMIO_BLUE }} onClick={onSendBack}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Send back
                </Button>
              ) : null}

              <Button variant="outline" className="rounded-full bg-white" onClick={() => navigator.clipboard?.writeText(receipt.tx)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy reference
              </Button>

              <Button variant="outline" className="rounded-full bg-white" onClick={onDetails}>
                <Info className="mr-2 h-4 w-4" />
                Details
              </Button>
            </div>

            <div className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
              <Shield className="mt-0.5 h-4 w-4" />
              <div>This receipt is verifiable. BeamioTag is the social layer — wallet details stay hidden by default.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PaymentDetailsSheet({
  receipt,
  viewer,
  onClose,
  onMessage,
  onSendBack,
  onPayAgain,
}: {
  receipt: ReceiptEvent;
  viewer: Viewer;
  onClose: () => void;
  onMessage: () => void;
  onSendBack: () => void;
  onPayAgain?: () => void;
}) {
  const iAmReceiver = receipt.to === viewer;
  const title = iAmReceiver ? "Received" : "Sent";

  const fromTag = ME[receipt.from].tag;
  const toTag = ME[receipt.to].tag;

  // Web2-first: hide on-chain details by default
  const [chainExpanded, setChainExpanded] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div
        initial={{ y: 22, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 22, opacity: 0 }}
        className="soft-shadow absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-3xl bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-zinc-500">Payment details</div>
          </div>
          <Button variant="ghost" className="rounded-full" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <div className="mt-3 rounded-3xl bg-white p-4 ring-1 ring-zinc-200">
          <div className="text-[34px] font-black" style={{ color: BEAMIO_BLUE }}>
            {fmtUSDC(receipt.amountUSDC, 4)}
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            ≈ {receipt.approxLocal.code} {receipt.approxLocal.value.toFixed(2)}
          </div>

          {/* Social-first identity */}
          <div className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">From</span>
              <button
                className="inline-flex items-center gap-2 font-semibold text-zinc-800"
                onClick={() => navigator.clipboard?.writeText(fromTag)}
                aria-label="Copy from tag"
              >
                {fromTag}
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-zinc-500">To</span>
              <button
                className="inline-flex items-center gap-2 font-semibold text-zinc-800"
                onClick={() => navigator.clipboard?.writeText(toTag)}
                aria-label="Copy to tag"
              >
                {toTag}
                <Copy className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Status</span>
              <span className="font-semibold text-emerald-600">{receipt.status}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-zinc-500">Network fee</span>
              <span className="font-semibold" style={{ color: BEAMIO_BLUE }}>
                Sponsored
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-zinc-500">Network</span>
              <span className="font-semibold">{receipt.network}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-zinc-500">Time</span>
              <span className="font-semibold">
                {fmtDay(receipt.ts)} · {fmtTime(receipt.ts)}
              </span>
            </div>
          </div>

          {receipt.note ? (
            <div className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700 ring-1 ring-zinc-200">{receipt.note}</div>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            {iAmReceiver ? (
              <Button className="rounded-2xl" style={{ background: BEAMIO_BLUE }} onClick={onSendBack}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Send back
              </Button>
            ) : (
              <Button className="rounded-2xl" style={{ background: BEAMIO_BLUE }} onClick={onPayAgain}>
                <Send className="mr-2 h-4 w-4" />
                Pay again
              </Button>
            )}

            <Button variant="secondary" className="rounded-2xl" onClick={onMessage}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Message
            </Button>
          </div>

          {/* Reference stays lightweight; on-chain details are opt-in */}
          <div className="mt-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">Reference</div>
              <button
                className="inline-flex items-center gap-2 text-xs font-semibold"
                style={{ color: BEAMIO_BLUE }}
                onClick={() => navigator.clipboard?.writeText(receipt.tx)}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-800">{shortTx(receipt.tx)}</div>

            <button
              className="mt-2 inline-flex items-center gap-2 text-xs font-semibold"
              style={{ color: BEAMIO_BLUE }}
              onClick={() => setChainExpanded((v) => !v)}
            >
              {chainExpanded ? "Hide on-chain details" : "Show on-chain details"}
              <ExternalLink className="h-3.5 w-3.5" />
            </button>

            {chainExpanded ? (
              <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
                <div className="text-xs text-zinc-500">Transaction hash</div>
                <div className="mt-1 break-all text-xs font-semibold text-zinc-800">{receipt.tx}</div>
                <Button variant="secondary" className="mt-3 w-full rounded-2xl">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on explorer
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-start gap-2 text-xs text-zinc-500">
            <Shield className="mt-0.5 h-4 w-4" />
            <div>You authorize transfers with your signature. Beamio does not custody funds.</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BottomTabs({
  active,
  onNav,
}: {
  active: "home" | "tx" | "beam" | "chat" | "me";
  onNav: (k: "home" | "tx" | "beam" | "chat" | "me") => void;
}) {
  return (
    <div className="sticky bottom-0 border-t border-zinc-200 bg-white/80 px-2 py-2 backdrop-blur">
      <div className="grid grid-cols-5 items-center">
        <Tab icon={<Home className="h-5 w-5" />} label="Home" active={active === "home"} onClick={() => onNav("home")} />
        <Tab icon={<ArrowLeftRight className="h-5 w-5" />} label="Transactions" active={active === "tx"} onClick={() => onNav("tx")} />

        <div className="flex justify-center">
          <button
            onClick={() => onNav("beam")}
            className="grid h-12 w-12 place-items-center rounded-2xl shadow-sm"
            style={{ background: BEAMIO_BLUE }}
            aria-label="Beamio"
          >
            <div className="text-xl font-black text-white">B</div>
          </button>
        </div>

        <Tab icon={<MessageCircle className="h-5 w-5" />} label="Chat" active={active === "chat"} onClick={() => onNav("chat")} />
        <Tab icon={<User className="h-5 w-5" />} label="Me" active={active === "me"} onClick={() => onNav("me")} />
      </div>
    </div>
  );
}

function Tab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 py-1 ${active ? "" : "opacity-40"}`}>
      <div className={active ? "text-zinc-900" : "text-zinc-500"}>{icon}</div>
      <div className={`text-[12px] ${active ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>{label}</div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lightweight tests (opt-in)
// In dev, set window.__BEAMIO_RUN_TESTS__ = true in console to run.
function __beamioRunTests() {
  console.assert(fmtUSDC(10, 2).startsWith("10"), "fmtUSDC integer formatting");
  console.assert(fmtUSDC(1.23456, 2) === "1.23 USDC", "fmtUSDC decimal formatting");
  console.assert(shortTx("0x1234567890abcdef") === "0x1234…cdef", "shortTx formatting");
  const tx = makeTxHash();
  console.assert(tx.startsWith("0x") && tx.length === 42, "makeTxHash length");

  const previewSender = receiptPreviewFor("A", {
    id: "x",
    ts: 0,
    type: "receipt",
    from: "A",
    to: "B",
    amountUSDC: 1,
    approxLocal: { code: "CAD", value: 1 },
    status: "completed",
    network: "Base",
    gas: "Sponsored",
    tx: "0x",
  });
  console.assert(previewSender.includes("sent"), "receiptPreviewFor sender");
  console.assert(previewSender.includes("@"), "receiptPreviewFor includes BeamioTag");

  const previewReceiver = receiptPreviewFor("B", {
    id: "y",
    ts: 0,
    type: "receipt",
    from: "A",
    to: "B",
    amountUSDC: 1,
    approxLocal: { code: "CAD", value: 1 },
    status: "completed",
    network: "Base",
    gas: "Sponsored",
    tx: "0x",
  });
  console.assert(previewReceiver.includes("from"), "receiptPreviewFor receiver wording");

  // extra: ensure fmtDay/fmtTime are stable-ish
  console.assert(typeof fmtDay(Date.now()) === "string" && fmtDay(Date.now()).length > 0, "fmtDay returns string");
  console.assert(typeof fmtTime(Date.now()) === "string" && fmtTime(Date.now()).length > 0, "fmtTime returns string");
}

declare global {
  interface Window {
    __BEAMIO_RUN_TESTS__?: boolean;
  }
}

if (typeof window !== "undefined" && window.__BEAMIO_RUN_TESTS__) {
  __beamioRunTests();
}
