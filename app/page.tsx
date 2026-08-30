"use client";

import { useEffect, useState } from "react";

const MARKET_TZ = "America/New_York";

type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  currency: string;
  marketState: string;
  timestamp: number;
};

function formatMarketState(state: string): string {
  const map: Record<string, string> = {
    REGULAR: "Market open",
    PRE: "Pre-market",
    POST: "After hours",
    POSTPOST: "After hours",
    CLOSED: "Market closed",
  };
  return map[state] ?? state;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return `${volume}`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}

export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch("/api/quote");
        if (!res.ok) throw new Error("Quote request failed");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setQuote(data);
        setError(null);
      } catch {
        setError("Could not load quote data.");
      }
    }
    fetchQuote();
    const interval = setInterval(fetchQuote, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const timeString = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: MARKET_TZ,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now)
    : "--:--:--";

  const dateString = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: MARKET_TZ,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(now)
    : "";

  const change = quote ? quote.price - quote.previousClose : 0;
  const changePercent = quote ? (change / quote.previousClose) * 100 : 0;
  const isUp = change >= 0;
  const isMarketOpen = quote?.marketState === "REGULAR";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h1 className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              TSLA <span className="font-normal text-zinc-400 dark:text-zinc-500">Tesla, Inc.</span>
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">NASDAQ</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isMarketOpen ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"
              }`}
            />
            {quote ? formatMarketState(quote.marketState) : "…"}
          </span>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {!error && !quote && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading quote…</p>
            )}
            {quote && (
              <>
                <p className="font-mono text-5xl font-bold tabular-nums text-zinc-900 dark:text-white">
                  ${quote.price.toFixed(2)}
                </p>
                <p
                  className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                    isUp ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  {isUp ? "▲" : "▼"} {isUp ? "+" : ""}
                  {change.toFixed(2)} ({isUp ? "+" : ""}
                  {changePercent.toFixed(2)}%)
                </p>
              </>
            )}
          </div>

          <div className="flex flex-col items-start sm:items-end">
            <p className="font-mono text-2xl font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
              {timeString}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{dateString} (ET)</p>
          </div>
        </div>

        {quote && (
          <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 p-6 pt-4 sm:grid-cols-4 dark:border-zinc-800">
            <StatTile label="Prev close" value={`$${quote.previousClose.toFixed(2)}`} />
            <StatTile label="Day high" value={`$${quote.dayHigh.toFixed(2)}`} />
            <StatTile label="Day low" value={`$${quote.dayLow.toFixed(2)}`} />
            <StatTile label="Volume" value={formatVolume(quote.volume)} />
          </div>
        )}
      </div>
    </main>
  );
}
