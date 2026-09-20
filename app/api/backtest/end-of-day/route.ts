import { NextRequest, NextResponse } from "next/server";
import { runEndOfDayBacktest } from "@/lib/strategies/endOfDay";
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

    const sellPercentRaw = Number(searchParams.get("sellPercent"));
    const sellPercent =
      Number.isFinite(sellPercentRaw) && sellPercentRaw > 0 && sellPercentRaw <= 1
        ? sellPercentRaw
        : 0.5;

    const bars =
      loadCachedMinuteBars(SYMBOL, from, to) ?? (await fetchHourlyBars(SYMBOL, from, to));
    const backtest = runEndOfDayBacktest(bars, holdingShares, { sellPercent });

    return NextResponse.json(backtest);
  } catch {
    return NextResponse.json({ error: "Could not load backtest data" }, { status: 502 });
  }
}
