import fs from "node:fs";
import path from "node:path";
import type { DailyBar } from "@/lib/backtest";

type IbkrBar = { t: number; o: number; h: number; l: number; c: number };

// Real 1-minute bars pulled once via scripts/fetch-ibkr-history.mjs from the
// local IBKR gateway and cached to disk (IBKR's free intraday history isn't
// reachable from a deployed server, so this file ships with the app).
export function loadCachedMinuteBars(symbol: string, from: string): DailyBar[] | null {
  const filePath = path.join(process.cwd(), "data", `${symbol.toLowerCase()}-1min.json`);
  if (!fs.existsSync(filePath)) return null;

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as IbkrBar[];
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();

  return raw
    .filter((b) => b.t >= fromMs)
    .map((b) => ({
      time: Math.floor(b.t / 1000),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    }));
}

async function fetchChartBars(
  symbol: string,
  period1: number,
  period2: number,
  interval: string
): Promise<DailyBar[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=${interval}`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  if (!res.ok) throw new Error("Chart request failed");
  const data = await res.json();
  const result = data.chart.result[0];

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens: (number | null)[] = quote.open ?? [];
  const highs: (number | null)[] = quote.high ?? [];
  const lows: (number | null)[] = quote.low ?? [];
  const closes: (number | null)[] = quote.close ?? [];

  return timestamps
    .map((t, i) => ({
      time: t,
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i],
    }))
    .filter(
      (b): b is DailyBar =>
        b.open != null && b.high != null && b.low != null && b.close != null
    );
}

// Hourly bars give ~7 real intraday timestamps per trading day (vs. 1 for
// daily bars), and Yahoo's free endpoint allows this range in one request
// (unlike 1m data, which is capped at the last 30 days).
export async function fetchHourlyBars(symbol: string, from: string): Promise<DailyBar[]> {
  const period1 = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  return fetchChartBars(symbol, period1, period2, "60m");
}
