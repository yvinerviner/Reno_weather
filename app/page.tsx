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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-300 dark:from-zinc-950 dark:to-zinc-900 px-6 py-12">
      <main className="flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl bg-white/80 dark:bg-black/40 p-10 shadow-xl backdrop-blur">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
            Tesla, Inc. (TSLA)
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {quote ? formatMarketState(quote.marketState) : "…"}
          </p>
        </div>

        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {timeString}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {dateString} (ET)
          </p>
        </div>

        {error && <p className="text-red-500">{error}</p>}
        {!error && !quote && (
          <p className="text-zinc-500 dark:text-zinc-400">Loading quote…</p>
        )}

        {quote && (
          <>
            <div className="text-center">
              <p className="text-6xl font-bold text-zinc-900 dark:text-white">
                ${quote.price.toFixed(2)}
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  isUp ? "text-green-500" : "text-red-500"
                }`}
              >
                {isUp ? "▲" : "▼"} {isUp ? "+" : ""}
                {change.toFixed(2)} ({isUp ? "+" : ""}
                {changePercent.toFixed(2)}%)
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-4 rounded-xl bg-white/60 dark:bg-white/5 p-4 text-center sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Prev close
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  ${quote.previousClose.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Day high
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  ${quote.dayHigh.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Day low
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  ${quote.dayLow.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Volume
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {formatVolume(quote.volume)}
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
