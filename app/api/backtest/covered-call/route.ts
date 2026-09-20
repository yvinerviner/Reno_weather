import { NextRequest, NextResponse } from "next/server";
import { runCoveredCallBacktest } from "@/lib/strategies/coveredCall";
import { fetchHourlyBars, loadCachedMinuteBars } from "@/lib/marketData";

const SYMBOL = "TSLA";
const DEFAULT_HOLDING_SHARES = 500;
const DEFAULT_FROM = "2026-01-01";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from") || DEFAULT_FROM;
    const to = searchParams.get("to") || undefined;

    const holdingSharesRaw = Number(searchParams.get("shares"));
    const holdingShares =
      Number.isFinite(holdingSharesRaw) && holdingSharesRaw > 0
        ? holdingSharesRaw
        : DEFAULT_HOLDING_SHARES;

    const otmPercentRaw = Number(searchParams.get("otmPercent"));
    const otmPercent =
      Number.isFinite(otmPercentRaw) && otmPercentRaw > 0 ? otmPercentRaw / 100 : 0.175;

    const riskFreeRateRaw = Number(searchParams.get("riskFreeRate"));
    const riskFreeRate =
      Number.isFinite(riskFreeRateRaw) && riskFreeRateRaw > 0 ? riskFreeRateRaw / 100 : 0.04;

    const bars =
      loadCachedMinuteBars(SYMBOL, from, to) ?? (await fetchHourlyBars(SYMBOL, from, to));
    const backtest = runCoveredCallBacktest(bars, holdingShares, { otmPercent, riskFreeRate });

    return NextResponse.json(backtest);
  } catch {
    return NextResponse.json({ error: "Could not load backtest data" }, { status: 502 });
  }
}
