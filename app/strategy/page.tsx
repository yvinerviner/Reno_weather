"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const MARKET_TZ = "America/New_York";

type TradeEvent = {
  time: number;
  type: "OPEN_SHORT" | "ADD_SHORT" | "STOP_OUT" | "EOD_CLOSE";
  shares: number;
  price: number;
  note: string;
};

type StrategyData = {
  symbol: string;
  capitalBase: number;
  status: "FLAT" | "OPEN" | "CLOSED";
  events: TradeEvent[];
  totalShares: number;
  avgEntry: number | null;
  stopPrice: number | null;
  nextAddTrigger: number | null;
  nextAddShares: number | null;
  openPrice: number | null;
  currentPrice: number | null;
  realizedPnl: number;
  unrealizedPnl: number;
};

function formatTime(seconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(seconds * 1000));
}

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function StrategyPage() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStrategy() {
      try {
        const res = await fetch("/api/strategy");
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
        setError(null);
      } catch {
        setError("Could not load strategy data.");
      }
    }
    fetchStrategy();
    const interval = setInterval(fetchStrategy, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const totalPnl = data ? data.realizedPnl + data.unrealizedPnl : 0;
  const returnPercent = data ? (totalPnl / data.capitalBase) * 100 : 0;

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-zinc-100 to-zinc-300 dark:from-zinc-950 dark:to-zinc-900 px-6 py-12">
      <main className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl bg-white/80 dark:bg-black/40 p-10 shadow-xl backdrop-blur">
        <nav className="self-start text-sm text-sky-600 dark:text-sky-400">
          <Link href="/">← Live quote</Link>
        </nav>

        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
            TSLA Short Strategy
          </h1>
          <p className="mt-1 inline-block rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            PAPER TRADING — simulated, no real orders placed
          </p>
        </div>

        {error && <p className="text-red-500">{error}</p>}
        {!error && !data && (
          <p className="text-zinc-500 dark:text-zinc-400">Loading strategy…</p>
        )}

        {data && (
          <>
            <div className="grid w-full grid-cols-2 gap-4 rounded-xl bg-white/60 dark:bg-white/5 p-4 text-center sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Status
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {data.status}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Open price
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {data.openPrice ? `$${data.openPrice.toFixed(2)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Current price
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {data.currentPrice ? `$${data.currentPrice.toFixed(2)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Shares short
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {data.totalShares}
                </p>
              </div>
            </div>

            {data.status === "OPEN" && (
              <div className="grid w-full grid-cols-2 gap-4 rounded-xl bg-white/60 dark:bg-white/5 p-4 text-center sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Avg entry
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                    {data.avgEntry ? `$${data.avgEntry.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Stop price
                  </p>
                  <p className="mt-1 text-lg font-semibold text-red-500">
                    {data.stopPrice ? `$${data.stopPrice.toFixed(2)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Next add
                  </p>
                  <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                    {data.nextAddTrigger && data.nextAddShares
                      ? `${data.nextAddShares} @ $${data.nextAddTrigger.toFixed(2)}`
                      : "—"}
                  </p>
                </div>
              </div>
            )}

            <div className="text-center">
              <p
                className={`text-5xl font-bold ${
                  totalPnl >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {money(totalPnl)}
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {returnPercent >= 0 ? "+" : ""}
                {returnPercent.toFixed(2)}% of ${data.capitalBase} capital base
                {data.status === "OPEN" ? " (unrealized)" : ""}
              </p>
            </div>

            <div className="w-full rounded-xl bg-white/60 dark:bg-white/5 p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Trade log
              </p>
              {data.events.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No trades yet today.
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {data.events.map((e, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-4 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTime(e.time)}
                    </span>
                    <span className="text-right">{e.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
