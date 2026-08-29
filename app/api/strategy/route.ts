import { NextResponse } from "next/server";
import { simulateSession, type Bar } from "@/lib/strategy";

const SYMBOL = "TSLA";
const CAPITAL_BASE = 1000;

export async function GET() {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
    );
    if (!res.ok) throw new Error("Chart request failed");
    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const regular = meta.currentTradingPeriod?.regular as
      | { start: number; end: number }
      | undefined;

    const timestamps: (number | null)[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const bars: Bar[] = timestamps
      .map((t, i) => ({ time: t, price: closes[i] }))
      .filter(
        (b): b is Bar =>
          b.time != null &&
          b.price != null &&
          (!regular || (b.time >= regular.start && b.time <= regular.end))
      );

    const nowSeconds = Math.floor(Date.now() / 1000);
    const marketCloseSeconds = regular ? regular.end : nowSeconds;

    const sim = simulateSession(bars, nowSeconds, marketCloseSeconds);

    return NextResponse.json({
      symbol: meta.symbol,
      capitalBase: CAPITAL_BASE,
      marketOpenSeconds: regular?.start ?? null,
      marketCloseSeconds,
      barCount: bars.length,
      ...sim,
    });
  } catch {
    return NextResponse.json({ error: "Could not load strategy data" }, { status: 502 });
  }
}
