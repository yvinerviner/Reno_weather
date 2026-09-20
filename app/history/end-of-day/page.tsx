"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatTile from "@/components/StatTile";
import NumberField from "@/components/NumberField";
import EquityChart from "@/components/EquityChart";

type DayResult = {
  date: string;
  open: number;
  close: number;
  sharesShorted: number;
  pnl: number;
  cumulativePnl: number;
  cumulativeEquity: number;
  buyHoldEquity: number;
};

type Summary = {
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
  summary: Summary;
};

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function EndOfDayHistoryPage() {
  const [data, setData] = useState<BacktestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState("");
  const [shares, setShares] = useState(500);
  const [sellPercent, setSellPercent] = useState(50);

  useEffect(() => {
    async function fetchBacktest() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/backtest/end-of-day?from=${from}&to=${to}&shares=${shares}&sellPercent=${sellPercent / 100}`
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
  }, [from, to, shares, sellPercent]);

  const summary = data?.summary;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h1 className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              TSLA{" "}
              <span className="font-normal text-zinc-400 dark:text-zinc-500">
                End of Day — History
              </span>
            </h1>
            <nav className="mt-1 flex gap-3 text-xs text-sky-600 dark:text-sky-400">
              <Link href="/">← Live quote</Link>
              <Link href="/history">Short Trading history</Link>
            </nav>
          </div>
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
          <NumberField label="Number of shares" value={shares} onChange={setShares} min={1} />
          <NumberField
            label="Sell % of shares"
            value={sellPercent}
            onChange={setSellPercent}
            min={1}
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
                  label="Strategy P/L"
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
                        <th className="px-3 py-1.5">Shares</th>
                        <th className="px-3 py-1.5 text-right">Day P/L</th>
                        <th className="px-3 py-1.5 text-right">Equity</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {[...data.days].reverse().map((d) => (
                        <tr
                          key={d.date}
                          className="border-t border-zinc-200 dark:border-zinc-800"
                        >
                          <td className="px-3 py-1.5">{d.date}</td>
                          <td className="px-3 py-1.5">${d.open.toFixed(2)}</td>
                          <td className="px-3 py-1.5">${d.close.toFixed(2)}</td>
                          <td className="px-3 py-1.5">{d.sharesShorted}</td>
                          <td
                            className={`px-3 py-1.5 text-right ${
                              d.pnl >= 0 ? "text-emerald-500" : "text-red-500"
                            }`}
                          >
                            {money(d.pnl)}
                          </td>
                          <td className="px-3 py-1.5 text-right">{money(d.cumulativeEquity)}</td>
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
