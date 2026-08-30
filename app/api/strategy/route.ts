import { NextRequest, NextResponse } from "next/server";
import {
  simulateSession,
  DEFAULT_STRATEGY_PARAMS,
  type Bar,
  type StrategyParams,
} from "@/lib/strategy";

const SYMBOL = "TSLA";
const DEFAULT_HOLDING_SHARES = 480;

function parseParams(searchParams: URLSearchParams): StrategyParams {
  const initialSharesRaw = Number(searchParams.get("initialShares"));
  const stepRaw = Number(searchParams.get("step"));
  const multiplierRaw = Number(searchParams.get("multiplier"));

  return {
    initialShares:
      Number.isFinite(initialSharesRaw) && initialSharesRaw > 0
        ? initialSharesRaw
        : DEFAULT_STRATEGY_PARAMS.initialShares,
    step:
      Number.isFinite(stepRaw) && stepRaw > 0
        ? stepRaw
        : DEFAULT_STRATEGY_PARAMS.step,
    multiplier:
      Number.isFinite(multiplierRaw) && multiplierRaw > 0
        ? multiplierRaw
        : DEFAULT_STRATEGY_PARAMS.multiplier,
  };
}

export async function GET(request: NextRequest) {
  try {
    const holdingSharesRaw = Number(request.nextUrl.searchParams.get("shares"));
    const holdingShares =
      Number.isFinite(holdingSharesRaw) && holdingSharesRaw > 0
        ? holdingSharesRaw
        : DEFAULT_HOLDING_SHARES;

    // Never short more than half the shares you actually hold.
    const params: StrategyParams = {
      ...parseParams(request.nextUrl.searchParams),
      maxShortShares: holdingShares * 0.5,
    };

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

    const sim = simulateSession(bars, nowSeconds, marketCloseSeconds, params);

    const startPrice = sim.openPrice ?? meta.regularMarketPrice ?? 0;
    const capitalBase = holdingShares * startPrice;

    return NextResponse.json({
      symbol: meta.symbol,
      capitalBase,
      params,
      marketOpenSeconds: regular?.start ?? null,
      marketCloseSeconds,
      barCount: bars.length,
      ...sim,
    });
  } catch {
    return NextResponse.json({ error: "Could not load strategy data" }, { status: 502 });
  }
}
