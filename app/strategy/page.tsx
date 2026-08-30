"use client";

import { useEffect, useState } from "react";
import StatTile from "@/components/StatTile";
import NumberField from "@/components/NumberField";

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
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function StrategyPage() {
  const [data, setData] = useState<StrategyData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialShares, setInitialShares] = useState(50);
  const [step, setStep] = useState(5);
  const [shares, setShares] = useState(480);
  const [multiplier, setMultiplier] = useState(2);

  useEffect(() => {
    async function fetchStrategy() {
      try {
        const res = await fetch(
          `/api/strategy?initialShares=${initialShares}&step=${step}&shares=${shares}&multiplier=${multiplier}`
        );
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
  }, [initialShares, step, shares, multiplier]);

  const totalPnl = data ? data.realizedPnl + data.unrealizedPnl : 0;
  const returnPercent = data ? (totalPnl / data.capitalBase) * 100 : 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h1 className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            TSLA <span className="font-normal text-zinc-400 dark:text-zinc-500">Short Strategy</span>
          </h1>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            PAPER TRADING
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <NumberField label="Initial shares" value={initialShares} onChange={setInitialShares} min={1} />
          <NumberField label="Step ($)" value={step} onChange={setStep} step={0.01} />
          <NumberField label="Number of shares" value={shares} onChange={setShares} min={1} />
          <NumberField label="Multiplier" value={multiplier} onChange={setMultiplier} step={0.01} />
        </div>

        <div className="p-6">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {!error && !data && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading strategy…</p>
          )}

          {data && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Status" value={data.status} />
                <StatTile
                  label="Open price"
                  value={data.openPrice ? `$${data.openPrice.toFixed(2)}` : "—"}
                />
                <StatTile
                  label="Current price"
                  value={data.currentPrice ? `$${data.currentPrice.toFixed(2)}` : "—"}
                />
                <StatTile label="Shares short" value={`${data.totalShares}`} />
              </div>

              {data.status === "OPEN" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <StatTile
                    label="Avg entry"
                    value={data.avgEntry ? `$${data.avgEntry.toFixed(2)}` : "—"}
                  />
                  <StatTile
                    label="Stop price"
                    value={data.stopPrice ? `$${data.stopPrice.toFixed(2)}` : "—"}
                    valueClassName="text-red-500"
                  />
                  <StatTile
                    label="Next add"
                    value={
                      data.nextAddTrigger && data.nextAddShares
                        ? `${data.nextAddShares} @ $${data.nextAddTrigger.toFixed(2)}`
                        : "—"
                    }
                  />
                </div>
              )}

              <div className="text-center">
                <p
                  className={`font-mono text-4xl font-bold tabular-nums ${
                    totalPnl >= 0 ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {money(totalPnl)}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {returnPercent >= 0 ? "+" : ""}
                  {returnPercent.toFixed(2)}% of {money(data.capitalBase)} capital base
                  {data.status === "OPEN" ? " (unrealized)" : ""}
                </p>
              </div>

              <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
                <p className="border-b border-zinc-200 px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
                  Trade log
                </p>
                <div className="p-3">
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
                        <span className="shrink-0 font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatTime(e.time)}
                        </span>
                        <span className="text-right">{e.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
