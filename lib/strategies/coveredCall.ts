import { groupByTradingDay, type DailyBar } from "@/lib/marketData";
import { blackScholesCall, historicalVolatility } from "@/lib/blackScholes";

// Covered Call: sell 1 call contract per 100 held shares each month, struck
// otmPercent above the price on the day you sell, expiring the next monthly
// (3rd Friday) expiration. If it expires in-the-money, the shares are
// assigned away at the strike and immediately re-bought at market so the
// holding count never changes — the assignment's cost (missing the extra
// upside above strike) shows up as a negative adjustment that day. Either
// way, a new cycle starts right after expiration.
//
// Real historical options prices aren't available for free, so each cycle's
// premium is estimated with Black-Scholes, using a trailing-30-trading-day
// historical volatility computed from the actual price data.

export type CoveredCallParams = {
  otmPercent: number; // e.g. 0.175 for 17.5% out of the money
  riskFreeRate: number; // e.g. 0.04 for 4%
};

export const DEFAULT_COVERED_CALL_PARAMS: CoveredCallParams = {
  otmPercent: 0.175,
  riskFreeRate: 0.04,
};

export type CoveredCallCycle = {
  entryDate: string;
  expirationDate: string;
  entryPrice: number;
  strike: number;
  volatility: number;
  premiumPerShare: number;
  premiumTotal: number;
  expirationPrice: number;
  assigned: boolean;
  assignmentAdjustment: number;
  cyclePnl: number;
};

export type CoveredCallDayResult = {
  date: string;
  close: number;
  pnl: number;
  cumulativePnl: number;
  cumulativeEquity: number;
  buyHoldEquity: number;
  event: "SOLD_CALLS" | "EXPIRED_WORTHLESS" | "ASSIGNED" | null;
  note: string | null;
};

export type CoveredCallSummary = {
  startDate: string | null;
  endDate: string | null;
  tradingDays: number;
  cycleCount: number;
  assignedCount: number;
  totalPnl: number;
  totalReturnPercent: number;
  premiumCollected: number;
  bestCycle: CoveredCallCycle | null;
  worstCycle: CoveredCallCycle | null;
  finalEquity: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownPeakDate: string | null;
  maxDrawdownTroughDate: string | null;
};

export type CoveredCallResult = {
  params: CoveredCallParams;
  capitalBase: number;
  days: CoveredCallDayResult[];
  cycles: CoveredCallCycle[];
  summary: CoveredCallSummary;
};

const VOL_LOOKBACK_DAYS = 30;

function thirdFridayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const firstDayOfWeek = firstDay.getUTCDay();
  const firstFridayDate = 1 + ((5 - firstDayOfWeek + 7) % 7);
  return new Date(Date.UTC(year, month, firstFridayDate + 14));
}

// The next monthly (3rd Friday) expiration at least minDaysOut after fromDate.
function nextMonthlyExpiration(fromDate: Date, minDaysOut: number): Date {
  let year = fromDate.getUTCFullYear();
  let month = fromDate.getUTCMonth();
  const minDate = new Date(fromDate.getTime() + minDaysOut * 86_400_000);

  let candidate = thirdFridayOfMonth(year, month);
  while (candidate < minDate) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = thirdFridayOfMonth(year, month);
  }
  return candidate;
}

// Latest trading-day index at or before targetDate, searching from fromIndex
// onward (handles the 3rd Friday landing on a market holiday).
function findExpirationIndex(
  tradingDays: [string, DailyBar[]][],
  targetDate: Date,
  fromIndex: number
): number {
  const targetStr = targetDate.toISOString().slice(0, 10);
  let result = -1;
  for (let j = fromIndex; j < tradingDays.length; j++) {
    if (tradingDays[j][0] <= targetStr) result = j;
    else break;
  }
  return result;
}

export function runCoveredCallBacktest(
  bars: DailyBar[],
  holdingShares: number,
  params: CoveredCallParams = DEFAULT_COVERED_CALL_PARAMS
): CoveredCallResult {
  const groupedByDay = groupByTradingDay(bars);
  const tradingDays = [...groupedByDay.entries()];
  const numContracts = Math.floor(holdingShares / 100);
  const coveredShares = numContracts * 100;

  const closesFor = (dayBars: DailyBar[]) => dayBars[dayBars.length - 1].close;

  const startPrice = tradingDays.length > 0 ? tradingDays[0][1][0].open : 0;
  const capitalBase = holdingShares * startPrice;

  const cycles: CoveredCallCycle[] = [];
  const eventsByDate = new Map<string, { event: CoveredCallDayResult["event"]; note: string; pnl: number }>();

  let i = 0;
  while (i < tradingDays.length) {
    const [entryDateStr, entryBars] = tradingDays[i];
    const entryPrice = entryBars[0].open;
    const entryDate = new Date(`${entryDateStr}T00:00:00Z`);

    const expirationTarget = nextMonthlyExpiration(entryDate, 21);
    let expIndex = findExpirationIndex(tradingDays, expirationTarget, i + 1);
    if (expIndex === -1 || expIndex <= i) expIndex = tradingDays.length - 1;
    if (expIndex <= i) break; // no more room for a full cycle

    const [expDateStr, expBars] = tradingDays[expIndex];
    const expirationPrice = closesFor(expBars);

    const lookbackStart = Math.max(0, i - VOL_LOOKBACK_DAYS);
    const priceHistory = tradingDays
      .slice(lookbackStart, i + 1)
      .map(([, dayBars]) => closesFor(dayBars));
    const volatility = historicalVolatility(priceHistory);

    const strike = entryPrice * (1 + params.otmPercent);
    const T = Math.max(expIndex - i, 1) / 252;
    const premiumPerShare = blackScholesCall(entryPrice, strike, T, params.riskFreeRate, volatility);
    const premiumTotal = premiumPerShare * coveredShares;

    const assigned = expirationPrice >= strike;
    const assignmentAdjustment = assigned ? coveredShares * (strike - expirationPrice) : 0;
    const cyclePnl = premiumTotal + assignmentAdjustment;

    cycles.push({
      entryDate: entryDateStr,
      expirationDate: expDateStr,
      entryPrice,
      strike,
      volatility,
      premiumPerShare,
      premiumTotal,
      expirationPrice,
      assigned,
      assignmentAdjustment,
      cyclePnl,
    });

    eventsByDate.set(entryDateStr, {
      event: "SOLD_CALLS",
      note: `Sold ${numContracts} call${numContracts === 1 ? "" : "s"} @ $${strike.toFixed(2)} strike, exp ${expDateStr}. Premium: $${premiumTotal.toFixed(2)}`,
      pnl: premiumTotal,
    });

    const existing = eventsByDate.get(expDateStr);
    const expNote = assigned
      ? `Assigned: sold ${coveredShares} @ $${strike.toFixed(2)}, re-bought at $${expirationPrice.toFixed(2)} (P/L $${assignmentAdjustment.toFixed(2)})`
      : `Calls expired worthless (close $${expirationPrice.toFixed(2)} < strike $${strike.toFixed(2)})`;
    eventsByDate.set(expDateStr, {
      event: assigned ? "ASSIGNED" : "EXPIRED_WORTHLESS",
      note: existing ? `${existing.note} · ${expNote}` : expNote,
      pnl: (existing?.pnl ?? 0) + assignmentAdjustment,
    });

    i = expIndex + 1;
  }

  const days: CoveredCallDayResult[] = [];
  let cumulativePnl = 0;
  for (const [date, dayBars] of tradingDays) {
    const close = closesFor(dayBars);
    const dayEvent = eventsByDate.get(date);
    const pnl = dayEvent?.pnl ?? 0;
    cumulativePnl += pnl;

    days.push({
      date,
      close,
      pnl,
      cumulativePnl,
      cumulativeEquity: holdingShares * close + cumulativePnl,
      buyHoldEquity: holdingShares * close,
      event: dayEvent?.event ?? null,
      note: dayEvent?.note ?? null,
    });
  }

  const bestCycle = cycles.reduce<CoveredCallCycle | null>(
    (best, c) => (!best || c.cyclePnl > best.cyclePnl ? c : best),
    null
  );
  const worstCycle = cycles.reduce<CoveredCallCycle | null>(
    (worst, c) => (!worst || c.cyclePnl < worst.cyclePnl ? c : worst),
    null
  );

  const totalPnl = cumulativePnl;
  const finalEquity = days.length > 0 ? days[days.length - 1].cumulativeEquity : capitalBase;
  const premiumCollected = cycles.reduce((s, c) => s + c.premiumTotal, 0);
  const assignedCount = cycles.filter((c) => c.assigned).length;

  let peak = capitalBase;
  let peakDate: string | null = days.length > 0 ? days[0].date : null;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let maxDrawdownPeakDate: string | null = null;
  let maxDrawdownTroughDate: string | null = null;

  for (const d of days) {
    if (d.cumulativeEquity > peak) {
      peak = d.cumulativeEquity;
      peakDate = d.date;
    }
    const drawdown = peak - d.cumulativeEquity;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = peak !== 0 ? (drawdown / peak) * 100 : 0;
      maxDrawdownPeakDate = peakDate;
      maxDrawdownTroughDate = d.date;
    }
  }

  return {
    params,
    capitalBase,
    days,
    cycles,
    summary: {
      startDate: days.length > 0 ? days[0].date : null,
      endDate: days.length > 0 ? days[days.length - 1].date : null,
      tradingDays: days.length,
      cycleCount: cycles.length,
      assignedCount,
      totalPnl,
      totalReturnPercent: (totalPnl / capitalBase) * 100,
      premiumCollected,
      bestCycle,
      worstCycle,
      finalEquity,
      maxDrawdown,
      maxDrawdownPercent,
      maxDrawdownPeakDate,
      maxDrawdownTroughDate,
    },
  };
}
