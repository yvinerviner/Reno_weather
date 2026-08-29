import { NextResponse } from "next/server";

const SYMBOL = "TSLA";

type TradingWindow = { start: number; end: number };
type TradingPeriod = {
  pre?: TradingWindow;
  regular?: TradingWindow;
  post?: TradingWindow;
};

function computeMarketState(nowSeconds: number, period: TradingPeriod | undefined): string {
  if (!period) return "CLOSED";
  const { pre, regular, post } = period;
  if (regular && nowSeconds >= regular.start && nowSeconds < regular.end) return "REGULAR";
  if (pre && nowSeconds >= pre.start && nowSeconds < pre.end) return "PRE";
  if (post && nowSeconds >= post.start && nowSeconds < post.end) return "POST";
  return "CLOSED";
}

export async function GET() {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?interval=1m&range=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error("Quote request failed");
    const data = await res.json();
    const meta = data.chart.result[0].meta;
    const nowSeconds = Math.floor(Date.now() / 1000);

    return NextResponse.json({
      symbol: meta.symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.previousClose,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      volume: meta.regularMarketVolume,
      currency: meta.currency,
      marketState: computeMarketState(nowSeconds, meta.currentTradingPeriod),
      timestamp: meta.regularMarketTime,
    });
  } catch {
    return NextResponse.json({ error: "Could not load quote" }, { status: 502 });
  }
}
