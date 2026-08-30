"use client";

import { Fragment, useEffect, useState } from "react";
import StatTile from "@/components/StatTile";
import NumberField from "@/components/NumberField";

type TradeEvent = {
  time: number;
  type: "OPEN_SHORT" | "ADD_SHORT" | "STOP_OUT" | "EOD_CLOSE";
  shares: number;
  price: number;
  note: string;
};

type DayResult = {
  date: string;
  open: number;
  close: number;
  status: "OPEN" | "CLOSED" | "FLAT";
  addsCount: number;
  finalShares: number;
  pnl: number;
  cumulativePnl: number;
  cumulativeEquity: number;
  buyHoldEquity: number;
  events: TradeEvent[];
};

type BacktestSummary = {
  startDate: string | null;
  endDate: string | null;
  tradingDays: number;
  totalPnl: number;
  totalReturnPercent: number;
  winDays: number;
  lossDays: number;
  flatDays: number;
  bestDay: DayResult | null;
  worstDay: DayResult | null;
  finalEquity: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownPeakDate: string | null;
  maxDrawdownTroughDate: string | null;
};

type BacktestData = {
  capitalBase: number;
  days: DayResult[];
  summary: BacktestSummary;
};

type OptimizeResult = {
  step: number;
  totalPnl: number;
  totalReturnPercent: number;
  finalEquity: number;
  winDays: number;
  lossDays: number;
};

type OptimizeData = {
  minStep: number;
  maxStep: number;
  increment: number;
  results: OptimizeResult[];
  best: OptimizeResult | null;
};

const MARKET_TZ = "America/New_York";

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTime(seconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(seconds * 1000));
}

type Trade = {
  openTime: number;
  closeTime: number;
  shares: number;
  entryPrice: number;
  closePrice: number;
  profit: number;
};

function buildTrades(events: TradeEvent[]): Trade[] {
  const closeEvent = events.find((e) => e.type === "STOP_OUT" || e.type === "EOD_CLOSE");
  if (!closeEvent) return [];

  return events
    .filter((e) => e.type === "OPEN_SHORT" || e.type === "ADD_SHORT")
    .map((e) => ({
      openTime: e.time,
      closeTime: closeEvent.time,
      shares: e.shares,
      entryPrice: e.price,
      closePrice: closeEvent.price,
      profit: e.shares * (e.price - closeEvent.price),
    }));
}

function EquityChart({ days, capitalBase }: { days: DayResult[]; capitalBase: number }) {
  if (days.length === 0) return null;

  const width = 800;
  const height = 240;
  const padding = 36;
  const topLabelSpace = 18;

  const strategyValues = days.map((d) => d.cumulativeEquity);
  const buyHoldValues = days.map((d) => d.buyHoldEquity);
  const minValue = Math.min(capitalBase, ...strategyValues, ...buyHoldValues);
  const maxValue = Math.max(capitalBase, ...strategyValues, ...buyHoldValues);
  const range = maxValue - minValue || 1;

  const xFor = (i: number) =>
    padding + (i / Math.max(days.length - 1, 1)) * (width - padding * 2);
  const yFor = (v: number) =>
    height -
    padding -
    ((v - minValue) / range) * (height - padding * 2 - topLabelSpace);

  const strategyPoints = days.map((d, i) => `${xFor(i)},${yFor(d.cumulativeEquity)}`).join(" ");
  const buyHoldPoints = days.map((d, i) => `${xFor(i)},${yFor(d.buyHoldEquity)}`).join(" ");
  const baselineY = yFor(capitalBase);
  const isUp = days[days.length - 1].cumulativeEquity >= capitalBase;

  const lastIndex = days.length - 1;
  const strategyStart = days[0].cumulativeEquity;
  const strategyEnd = days[lastIndex].cumulativeEquity;
  const buyHoldStart = days[0].buyHoldEquity;
  const buyHoldEnd = days[lastIndex].buyHoldEquity;

  const compactMoney = (n: number) =>
    `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const startOnTop = strategyStart >= buyHoldStart;
  const endOnTop = strategyEnd >= buyHoldEnd;
  const strategyColor = isUp ? "#10b981" : "#ef4444";

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-center gap-4 font-mono text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: strategyColor }} />
          Strategy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
          Buy &amp; hold
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60"
        preserveAspectRatio="none"
      >
        <line
          x1={padding}
          y1={baselineY}
          x2={width - padding}
          y2={baselineY}
          stroke="currentColor"
          className="text-zinc-300 dark:text-zinc-700"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <polyline points={buyHoldPoints} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
        <polyline points={strategyPoints} fill="none" stroke={strategyColor} strokeWidth={1.5} />

        <text
          x={padding}
          y={yFor(strategyStart) + (startOnTop ? -8 : 14)}
          fontSize="11"
          fontFamily="monospace"
          fill={strategyColor}
        >
          {compactMoney(strategyStart)}
        </text>
        <text
          x={padding}
          y={yFor(buyHoldStart) + (startOnTop ? 14 : -8)}
          fontSize="11"
          fontFamily="monospace"
          fill="#0ea5e9"
        >
          {compactMoney(buyHoldStart)}
        </text>
        <text
          x={width - padding}
          y={yFor(strategyEnd) + (endOnTop ? -8 : 14)}
          fontSize="11"
          fontFamily="monospace"
          textAnchor="end"
          fill={strategyColor}
        >
          {compactMoney(strategyEnd)}
        </text>
        <text
          x={width - padding}
          y={yFor(buyHoldEnd) + (endOnTop ? 14 : -8)}
          fontSize="11"
          fontFamily="monospace"
          textAnchor="end"
          fill="#0ea5e9"
        >
          {compactMoney(buyHoldEnd)}
        </text>
      </svg>
    </div>
  );
}

export default function HistoryPage() {
  const [data, setData] = useState<BacktestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("");
  const [initialShares, setInitialShares] = useState(50);
  const [step, setStep] = useState(5);
  const [shares, setShares] = useState(480);
  const [multiplier, setMultiplier] = useState(2);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const [minStep, setMinStep] = useState(3);
  const [maxStep, setMaxStep] = useState(12);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeData, setOptimizeData] = useState<OptimizeData | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  // Clear stale results whenever an input they depended on changes, so an
  // old optimization can't be mistaken for one reflecting current inputs.
  useEffect(() => {
    setOptimizeData(null);
    setOptimizeError(null);
  }, [from, to, initialShares, shares, multiplier]);

  async function runOptimize() {
    setOptimizing(true);
    setOptimizeError(null);
    try {
      const res = await fetch(
        `/api/optimize?from=${from}&to=${to}&initialShares=${initialShares}&minStep=${minStep}&maxStep=${maxStep}&shares=${shares}&multiplier=${multiplier}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setOptimizeData(json);
    } catch (e) {
      setOptimizeError(e instanceof Error ? e.message : "Could not run optimization.");
    } finally {
      setOptimizing(false);
    }
  }

  useEffect(() => {
    async function fetchBacktest() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/backtest?from=${from}&to=${to}&initialShares=${initialShares}&step=${step}&shares=${shares}&multiplier=${multiplier}`
        );
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
        setError(null);
      } catch {
        setError("Could not load backtest data.");
      } finally {
        setLoading(false);
      }
    }
    fetchBacktest();
  }, [from, to, initialShares, step, shares, multiplier]);

  const summary = data?.summary;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h1 className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            TSLA <span className="font-normal text-zinc-400 dark:text-zinc-500">Short Strategy — History</span>
          </h1>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            BACKTEST · REAL 1-MIN BARS
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            From date
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-sm tabular-nums text-zinc-800 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            To date
            <input
              type="date"
              value={to}
              min={from}
              placeholder="Latest"
              onChange={(e) => setTo(e.target.value)}
              className="rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-sm tabular-nums text-zinc-800 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <NumberField label="Initial shares" value={initialShares} onChange={setInitialShares} min={1} />
          <NumberField label="Step ($)" value={step} onChange={setStep} step={0.01} />
          <NumberField label="Number of shares" value={shares} onChange={setShares} min={1} />
          <NumberField label="Multiplier" value={multiplier} onChange={setMultiplier} step={0.01} />
        </div>

        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <p className="mb-3 text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Optimize step ($) — sweeps $1 increments, or $0.10 if min/max has a decimal
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <NumberField label="Min" value={minStep} onChange={setMinStep} step={0.01} />
            <NumberField label="Max" value={maxStep} onChange={setMaxStep} step={0.01} />
            <button
              onClick={runOptimize}
              disabled={optimizing}
              className="rounded bg-zinc-900 px-4 py-1.5 font-mono text-xs font-medium uppercase tracking-wide text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {optimizing ? "Optimizing…" : "Optimize"}
            </button>
          </div>

          {optimizeError && <p className="mt-3 text-sm text-red-500">{optimizeError}</p>}

          {optimizeData && optimizeData.best && (
            <p className="mt-3 font-mono text-sm text-zinc-600 dark:text-zinc-300">
              Best of {optimizeData.results.length} values (${optimizeData.increment.toFixed(2)}{" "}
              increments): step ${optimizeData.best.step.toFixed(2)} →{" "}
              <span
                className={optimizeData.best.totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}
              >
                {money(optimizeData.best.totalPnl)}
              </span>{" "}
              ({optimizeData.best.totalReturnPercent.toFixed(2)}%)
              <button
                onClick={() => setStep(optimizeData.best!.step)}
                className="ml-2 rounded border border-zinc-400 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-600 hover:bg-zinc-900 hover:text-white dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
              >
                Use this
              </button>
            </p>
          )}
        </div>

        <div className="p-6">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {loading && !data && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading backtest…</p>
          )}

          {summary && data && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Original equity" value={money(data.capitalBase)} />
                <StatTile label="Final equity" value={money(summary.finalEquity)} />
                <StatTile
                  label="Total P/L"
                  value={money(summary.finalEquity - data.capitalBase)}
                  sub={`${(
                    ((summary.finalEquity - data.capitalBase) / data.capitalBase) *
                    100
                  ).toFixed(2)}%`}
                  valueClassName={
                    summary.finalEquity - data.capitalBase >= 0
                      ? "text-emerald-500"
                      : "text-red-500"
                  }
                />
                <StatTile
                  label="Short-selling P/L"
                  value={money(summary.totalPnl)}
                  sub={`${summary.totalReturnPercent >= 0 ? "+" : ""}${summary.totalReturnPercent.toFixed(2)}%`}
                  valueClassName={summary.totalPnl >= 0 ? "text-emerald-500" : "text-red-500"}
                />
              </div>

              <EquityChart days={data.days} capitalBase={data.capitalBase} />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatTile label="Trading days" value={`${summary.tradingDays}`} />
                <StatTile label="Win / loss" value={`${summary.winDays} / ${summary.lossDays}`} />
                <StatTile
                  label="Best day"
                  value={summary.bestDay ? money(summary.bestDay.pnl) : "—"}
                  valueClassName="text-emerald-500"
                />
                <StatTile
                  label="Worst day"
                  value={summary.worstDay ? money(summary.worstDay.pnl) : "—"}
                  valueClassName="text-red-500"
                />
                <StatTile
                  label="Max drawdown"
                  value={`${money(-summary.maxDrawdown)} (${summary.maxDrawdownPercent.toFixed(1)}%)`}
                  valueClassName="text-red-500"
                  sub={
                    summary.maxDrawdownPeakDate && summary.maxDrawdownTroughDate
                      ? `${summary.maxDrawdownPeakDate} → ${summary.maxDrawdownTroughDate}`
                      : undefined
                  }
                />
              </div>

              <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
                <p className="border-b border-zinc-200 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
                  Day-by-day ({data.days.length} days)
                </p>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
                    <thead className="sticky top-0 bg-zinc-100 font-mono text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-500">
                      <tr>
                        <th className="px-3 py-1.5">Date</th>
                        <th className="px-3 py-1.5">Open</th>
                        <th className="px-3 py-1.5">Close</th>
                        <th className="px-3 py-1.5">Adds</th>
                        <th className="px-3 py-1.5 text-right">Day P/L</th>
                        <th className="px-3 py-1.5 text-right">Equity</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {[...data.days].reverse().map((d) => (
                        <Fragment key={d.date}>
                          <tr
                            onClick={() =>
                              setExpandedDate(expandedDate === d.date ? null : d.date)
                            }
                            className="cursor-pointer border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                          >
                            <td className="px-3 py-1.5">
                              <span className="mr-1 inline-block w-3 text-zinc-400">
                                {expandedDate === d.date ? "▾" : "▸"}
                              </span>
                              {d.date}
                            </td>
                            <td className="px-3 py-1.5">${d.open.toFixed(2)}</td>
                            <td className="px-3 py-1.5">${d.close.toFixed(2)}</td>
                            <td className="px-3 py-1.5">{d.addsCount}</td>
                            <td
                              className={`px-3 py-1.5 text-right ${
                                d.pnl >= 0 ? "text-emerald-500" : "text-red-500"
                              }`}
                            >
                              {money(d.pnl)}
                            </td>
                            <td className="px-3 py-1.5 text-right">{money(d.cumulativeEquity)}</td>
                          </tr>
                          {expandedDate === d.date && (
                            <tr className="bg-zinc-50 dark:bg-zinc-950/60">
                              <td colSpan={6} className="px-3 py-2">
                                {(() => {
                                  const trades = buildTrades(d.events);
                                  return trades.length === 0 ? (
                                    <p className="font-sans text-xs text-zinc-500 dark:text-zinc-400">
                                      No trades this day.
                                    </p>
                                  ) : (
                                    <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                                      <thead className="font-sans text-zinc-500 dark:text-zinc-400">
                                        <tr>
                                          <th className="py-0.5 pr-2 font-medium">Open time</th>
                                          <th className="py-0.5 pr-2 font-medium">Close time</th>
                                          <th className="py-0.5 pr-2 font-medium">Shares</th>
                                          <th className="py-0.5 pr-2 text-right font-medium">
                                            Entry price
                                          </th>
                                          <th className="py-0.5 pr-2 text-right font-medium">
                                            Close price
                                          </th>
                                          <th className="py-0.5 pr-2 text-right font-medium">
                                            Profit
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {trades.map((t, i) => (
                                          <tr key={i}>
                                            <td className="py-0.5 pr-2">{formatTime(t.openTime)}</td>
                                            <td className="py-0.5 pr-2">{formatTime(t.closeTime)}</td>
                                            <td className="py-0.5 pr-2">{t.shares}</td>
                                            <td className="py-0.5 pr-2 text-right">
                                              ${t.entryPrice.toFixed(2)}
                                            </td>
                                            <td className="py-0.5 pr-2 text-right">
                                              ${t.closePrice.toFixed(2)}
                                            </td>
                                            <td
                                              className={`py-0.5 pr-2 text-right ${
                                                t.profit >= 0 ? "text-emerald-500" : "text-red-500"
                                              }`}
                                            >
                                              {money(t.profit)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
