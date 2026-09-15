"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTaipeiDateKey } from "@/lib/fitnessTimezone";

type Recommendation = {
  symbol: string;
  name: string;
  type: "stock" | "etf";
  watchReason: string;
  holdingPeriod: string;
  potentialUpside: string;
  riskFactors: string[];
};

type Report = {
  _id: string;
  reportDate: string;
  newsSummary: string;
  institutionalSummary: string;
  recommendations: Recommendation[];
  disclaimer: string;
  generatedAt: string;
};

type CumulativeAmount = {
  foreignNetAmount: number;
  trustNetAmount: number;
  dealerNetAmount: number;
  totalNetAmount: number;
};

type FlowDigest = {
  fromDate: string;
  toDate: string;
  cumulativeAmount: CumulativeAmount | null;
};

function formatYi(amount: number): string {
  const yi = amount / 1e8;
  return `${yi >= 0 ? "+" : ""}${yi.toFixed(1)}億`;
}

function amountColor(amount: number): string {
  return amount >= 0 ? "text-red-500 dark:text-red-400" : "text-green-600 dark:text-green-400";
}

const STAGE_FLOW = "擷取三大法人買賣超資料中...";
const STAGE_FLOW_BACKFILL = "回補近5個工作天三大法人資料中（較慢，請耐心等候）...";
const STAGE_NEWS = "擷取財經新聞中...";
const STAGE_REPORT = "AI 分析中，請稍候...";

export default function InvestmentPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [flowDigest, setFlowDigest] = useState<FlowDigest | null>(null);
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  async function loadFlowDigest() {
    const res = await fetch("/api/investment/institutional-flow/summary?days=5");
    const data = await res.json();
    setFlowDigest(data.digest ?? null);
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);

      const [reportRes] = await Promise.all([
        fetch("/api/investment/report?limit=10"),
        loadFlowDigest(),
      ]);
      const data = await reportRes.json();
      if (!cancelled) {
        const list: Report[] = data.reports ?? [];
        setReports(list);
        setSelected(list[0] ?? null);
        setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleGenerate(flowDays: number) {
    if (generating) return;
    setGenerating(true);
    setElapsedSeconds(0);
    setError(null);
    try {
      setStage(flowDays > 1 ? STAGE_FLOW_BACKFILL : STAGE_FLOW);
      const flowRes = await fetch("/api/investment/institutional-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: flowDays }),
      });
      if (!flowRes.ok) {
        const data = await flowRes.json().catch(() => ({}));
        throw new Error(data.error ?? "三大法人資料擷取失敗");
      }

      setStage(STAGE_NEWS);
      const newsRes = await fetch("/api/investment/news", { method: "POST" });
      if (!newsRes.ok) {
        const data = await newsRes.json().catch(() => ({}));
        throw new Error(data.error ?? "新聞擷取失敗");
      }

      setStage(STAGE_REPORT);
      const reportRes = await fetch("/api/investment/report", { method: "POST" });
      const reportData = await reportRes.json();
      if (!reportRes.ok) {
        throw new Error(reportData.error ?? "AI 報告產生失敗");
      }

      setReports((prev) => [reportData.report, ...prev]);
      setSelected(reportData.report);
      await loadFlowDigest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤，請稍後再試");
    } finally {
      setGenerating(false);
      setStage(null);
    }
  }

  if (checkingAuth || loading) {
    return null;
  }

  return (
    <div className="flex-1 bg-background px-5 py-8">
      <h1 className="text-xl font-bold tracking-tight">投資工具</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        彙整近5個工作天財經新聞與三大法人買賣超，由 AI 產生市場觀察報告
      </p>

      <button
        type="button"
        onClick={() => handleGenerate(1)}
        disabled={generating}
        className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 disabled:opacity-50"
      >
        {generating ? `${stage ?? "產生中..."}（已等待 ${elapsedSeconds} 秒）` : "產生今日報告"}
      </button>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        資料量大，第一步（三大法人資料）通常需要 20-30 秒，過程中請不要切換頁面或重新整理，否則會中斷重來。
      </p>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {flowDigest?.cumulativeAmount && (
        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">近5個工作天三大法人累計買賣超金額</h2>
            <span className="text-xs text-muted-foreground">
              {flowDigest.fromDate} ~ {flowDigest.toDate}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div>
              <div className={`text-sm font-bold ${amountColor(flowDigest.cumulativeAmount.foreignNetAmount)}`}>
                {formatYi(flowDigest.cumulativeAmount.foreignNetAmount)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">外資</div>
            </div>
            <div>
              <div className={`text-sm font-bold ${amountColor(flowDigest.cumulativeAmount.trustNetAmount)}`}>
                {formatYi(flowDigest.cumulativeAmount.trustNetAmount)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">投信</div>
            </div>
            <div>
              <div className={`text-sm font-bold ${amountColor(flowDigest.cumulativeAmount.dealerNetAmount)}`}>
                {formatYi(flowDigest.cumulativeAmount.dealerNetAmount)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">自營商</div>
            </div>
            <div>
              <div className={`text-sm font-bold ${amountColor(flowDigest.cumulativeAmount.totalNetAmount)}`}>
                {formatYi(flowDigest.cumulativeAmount.totalNetAmount)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">合計</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            正值（紅）為買超，負值（綠）為賣超，含上市＋上櫃，單位為新台幣億元
          </p>
        </div>
      )}

      {!selected && !generating && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">
            還沒有報告，第一次使用建議先回補近5個工作天的法人資料，分析會更完整。
          </p>
          <button
            type="button"
            onClick={() => handleGenerate(5)}
            disabled={generating}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
          >
            回補近5個工作天資料並產生報告
          </button>
        </div>
      )}

      {selected && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">新聞重點</h2>
              <span className="text-xs text-muted-foreground">
                {formatTaipeiDateKey(new Date(selected.reportDate))}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{selected.newsSummary}</p>
          </div>

          <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="text-sm font-semibold">三大法人資金流向</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{selected.institutionalSummary}</p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">值得關注清單</h2>
            {selected.recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground">這次沒有符合條件的標的。</p>
            )}
            {selected.recommendations.map((rec) => (
              <div key={rec.symbol} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{rec.name}</span>
                    <span className="text-xs text-muted-foreground">{rec.symbol}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {rec.type === "etf" ? "ETF" : "個股"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{rec.watchReason}</p>
                <p className="mt-2 text-xs text-muted-foreground">持有週期：{rec.holdingPeriod}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">潛在利多：{rec.potentialUpside}</p>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {rec.riskFactors.map((risk, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-red-500/90 dark:text-red-400/90">
                      <span>⚠</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="rounded-xl bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {selected.disclaimer}
          </p>

          <button
            type="button"
            onClick={() => handleGenerate(5)}
            disabled={generating}
            className="w-full rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground disabled:opacity-50"
          >
            資料有缺漏？回補近5個工作天法人資料後重新產生
          </button>
        </div>
      )}

      {reports.length > 1 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold">歷史報告</h2>
          <div className="mt-2 flex flex-col gap-2">
            {reports.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => setSelected(r)}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ring-1 ${
                  selected?._id === r._id
                    ? "bg-primary/10 ring-primary/30"
                    : "bg-card text-muted-foreground ring-border"
                }`}
              >
                <span>{formatTaipeiDateKey(new Date(r.reportDate))}</span>
                <span className="text-xs">{r.recommendations.length} 檔關注</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
