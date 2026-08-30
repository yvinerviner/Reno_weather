import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { fetchHourlyBars, loadCachedMinuteBars } from "@/lib/marketData";

const SYMBOL = "TSLA";
const DEFAULT_HOLDING_SHARES = 480;
const DEFAULT_FROM = "2026-01-01";
const MAX_STEPS_TESTED = 200;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from") || DEFAULT_FROM;

    const initialSharesRaw = Number(searchParams.get("initialShares"));
    const initialShares =
      Number.isFinite(initialSharesRaw) && initialSharesRaw > 0 ? initialSharesRaw : 50;

    const multiplierRaw = Number(searchParams.get("multiplier"));
    const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 2;

    const holdingSharesRaw = Number(searchParams.get("shares"));
    const holdingShares =
      Number.isFinite(holdingSharesRaw) && holdingSharesRaw > 0
        ? holdingSharesRaw
        : DEFAULT_HOLDING_SHARES;

    const minStepRaw = Number(searchParams.get("minStep"));
    const maxStepRaw = Number(searchParams.get("maxStep"));
    const minStep = Number.isFinite(minStepRaw) && minStepRaw > 0 ? minStepRaw : 3;
    const maxStep = Number.isFinite(maxStepRaw) && maxStepRaw >= minStep ? maxStepRaw : 12;

    // If either bound has a decimal (e.g. 3.5), sweep in $0.1 increments instead of $1.
    const hasDecimal = !Number.isInteger(minStep) || !Number.isInteger(maxStep);
    const increment = hasDecimal ? 0.1 : 1;

    const stepCount = Math.round((maxStep - minStep) / increment) + 1;
    if (stepCount > MAX_STEPS_TESTED) {
      return NextResponse.json(
        {
          error: `Range too large — max ${MAX_STEPS_TESTED} steps ($${increment} increments)`,
        },
        { status: 400 }
      );
    }

    const bars = loadCachedMinuteBars(SYMBOL, from) ?? (await fetchHourlyBars(SYMBOL, from));

    const results = [];
    for (let i = 0; i < stepCount; i++) {
      const step = Math.round((minStep + i * increment) * 10) / 10;
      const bt = runBacktest(bars, holdingShares, {
        initialShares,
        step,
        multiplier,
        maxShortShares: Infinity, // runBacktest overrides this from holdingShares
      });
      results.push({
        step,
        totalPnl: bt.summary.totalPnl,
        totalReturnPercent: bt.summary.totalReturnPercent,
        finalEquity: bt.summary.finalEquity,
        winDays: bt.summary.winDays,
        lossDays: bt.summary.lossDays,
      });
    }

    const best = results.reduce(
      (b, r) => (!b || r.totalPnl > b.totalPnl ? r : b),
      null as (typeof results)[number] | null
    );

    return NextResponse.json({
      from,
      initialShares,
      minStep,
      maxStep,
      increment,
      results,
      best,
    });
  } catch {
    return NextResponse.json({ error: "Could not run optimization" }, { status: 502 });
  }
}
