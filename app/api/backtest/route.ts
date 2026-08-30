import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { fetchHourlyBars, loadCachedMinuteBars } from "@/lib/marketData";
import { DEFAULT_STRATEGY_PARAMS, type StrategyParams } from "@/lib/strategy";

const SYMBOL = "TSLA";
const DEFAULT_HOLDING_SHARES = 480;
const DEFAULT_FROM = "2026-01-01";

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
    // runBacktest always overrides this from holdingShares — placeholder only.
    maxShortShares: DEFAULT_STRATEGY_PARAMS.maxShortShares,
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = parseParams(request.nextUrl.searchParams);
    const from = request.nextUrl.searchParams.get("from") || DEFAULT_FROM;
    const to = request.nextUrl.searchParams.get("to") || undefined;

    const holdingSharesRaw = Number(request.nextUrl.searchParams.get("shares"));
    const holdingShares =
      Number.isFinite(holdingSharesRaw) && holdingSharesRaw > 0
        ? holdingSharesRaw
        : DEFAULT_HOLDING_SHARES;

    const bars =
      loadCachedMinuteBars(SYMBOL, from, to) ?? (await fetchHourlyBars(SYMBOL, from, to));
    const backtest = runBacktest(bars, holdingShares, params);

    return NextResponse.json(backtest);
  } catch {
    return NextResponse.json({ error: "Could not load backtest data" }, { status: 502 });
  }
}
