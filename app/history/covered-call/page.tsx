"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import NumberField from "@/components/NumberField";
import EquityChart from "@/components/EquityChart";

type DayResult = {
  date: string;
  close: number;
  pnl: number;
  cumulativePnl: number;
  cumulativeEquity: number;
  buyHoldEquity: number;
  event: "SOLD_CALLS" | "EXPIRED_WORTHLESS" | "ASSIGNED" | null;
  note: string | null;
};

type Cycle = {
  entryDate: string;
  expirationDate: string;
  entryPrice: number;
  strike: number;
  volatility: number;
  premiumPerShare: number;
  premiumTotal: number;
  expirationPrice: number;
  assigned: boolean;
  assignmentAdjustment: number;
  cyclePnl: number;
};

type Summary = {
  startDate: string | null;
  endDate: string | null;
  tradingDays: number;
  cycleCount: number;
  assignedCount: number;
  totalPnl: number;
  totalReturnPercent: number;
  premiumCollected: number;
  bestCycle: Cycle | null;
  worstCycle: Cycle | null;
  finalEquity: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownPeakDate: string | null;
  maxDrawdownTroughDate: string | null;
};

type BacktestData = {
  capitalBase: number;
  days: DayResult[];
  cycles: Cycle[];
  summary: Summary;
};

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function CoveredCallHistoryPage() {
  const [data, setData] = useState<BacktestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("");
  const [shares, setShares] = useState(500);
  const [otmPercent, setOtmPercent] = useState(17.5);
  const [riskFreeRate, setRiskFreeRate] = useState(4);

  useEffect(() => {
    async function fetchBacktest() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/backtest/covered-call?from=${from}&to=${to}&shares=${shares}&otmPercent=${otmPercent}&riskFreeRate=${riskFreeRate}`
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
  }, [from, to, shares, otmPercent, riskFreeRate]);

  const summary = data?.summary;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h1 className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              TSLA{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                Covered Call — History
              </span>
            </h1>
            <nav className="mt-1 flex gap-3 text-xs text-sky-600 dark:text-sky-400">
              <Link href="/">← Live quote</Link>
              <Link href="/history">Short Trading history</Link>
              <Link href="/history/end-of-day">End of Day history</Link>
            </nav>
          </div>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            BACKTEST · ESTIMATED PREMIUMS (BLACK-SCHOLES)
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
          <NumberField label="Number of shares" value={shares} onChange={setShares} min={100} />
          <NumberField label="OTM %" value={otmPercent} onChange={setOtmPercent} step={0.5} />
          <NumberField
            label="Risk-free rate %"
            value={riskFreeRate}
            onChange={setRiskFreeRate}
            step={0.25}
          />
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
                  label="Premium collected"
                  value={money(summary.premiumCollected)}
                  sub={`${summary.totalReturnPercent >= 0 ? "+" : ""}${summary.totalReturnPercent.toFixed(2)}%`}
                  valueClassName="text-emerald-500"
                />
              </div>

              <EquityChart days={data.days} capitalBase={data.capitalBase} />

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatTile label="Cycles" value={`${summary.cycleCount}`} />
                <StatTile label="Assigned" value={`${summary.assignedCount}`} />
                <StatTile
                  label="Best cycle"
                  value={summary.bestCycle ? money(summary.bestCycle.cyclePnl) : "—"}
                  valueClassName="text-emerald-500"
                />
                <StatTile
                  label="Worst cycle"
                  value={summary.worstCycle ? money(summary.worstCycle.cyclePnl) : "—"}
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
                  Cycles ({data.cycles.length})
                </p>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-sm text-zinc-700 dark:text-zinc-300">
                    <thead className="sticky top-0 bg-zinc-100 font-mono text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-500">
                      <tr>
                        <th className="px-3 py-1.5">Sold</th>
                        <th className="px-3 py-1.5">Expires</th>
                        <th className="px-3 py-1.5 text-right">Entry</th>
                        <th className="px-3 py-1.5 text-right">Strike</th>
                        <th className="px-3 py-1.5 text-right">Premium</th>
                        <th className="px-3 py-1.5 text-right">Exp. price</th>
                        <th className="px-3 py-1.5">Outcome</th>
                        <th className="px-3 py-1.5 text-right">Cycle P/L</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {[...data.cycles].reverse().map((c) => (
                        <tr
                          key={c.entryDate}
                          className="border-t border-zinc-200 dark:border-zinc-800"
                        >
                          <td className="px-3 py-1.5">{c.entryDate}</td>
                          <td className="px-3 py-1.5">{c.expirationDate}</td>
                          <td className="px-3 py-1.5 text-right">${c.entryPrice.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right">${c.strike.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right">
                            {money(c.premiumTotal)}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            ${c.expirationPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-1.5">
                            {c.assigned ? (
                              <span className="text-red-500">Assigned</span>
                            ) : (
                              <span className="text-emerald-500">Expired worthless</span>
                            )}
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right ${
                              c.cyclePnl >= 0 ? "text-emerald-500" : "text-red-500"
                            }`}
                          >
                            {money(c.cyclePnl)}
                          </td>
                        </tr>
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
