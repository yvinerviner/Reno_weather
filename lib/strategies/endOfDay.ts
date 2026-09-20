import { groupByTradingDay, type DailyBar } from "@/lib/marketData";

// "End of Day": short a fixed percentage of your held shares at the market
// open, and cover (buy back) at the close, every day. Profits when the
// stock falls that day, loses when it rises. No adds, no intraday stop —
// just one open-to-close round trip per day, so daily O/C bars are enough
// (no need for the minute-level pseudo-bar approximation Short Trading uses).

export type EndOfDayParams = {
  sellPercent: number; // e.g. 0.5 for 50%
};

export const DEFAULT_END_OF_DAY_PARAMS: EndOfDayParams = {
  sellPercent: 0.5,
};

export type EndOfDayDayResult = {
  date: string;
  open: number;
  close: number;
  sharesShorted: number;
  pnl: number;
  cumulativePnl: number;
  cumulativeEquity: number;
  buyHoldEquity: number;
};

export type EndOfDaySummary = {
  startDate: string | null;
  endDate: string | null;
  tradingDays: number;
  totalPnl: number;
  totalReturnPercent: number;
  winDays: number;
  lossDays: number;
  flatDays: number;
  bestDay: EndOfDayDayResult | null;
  worstDay: EndOfDayDayResult | null;
  finalEquity: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownPeakDate: string | null;
  maxDrawdownTroughDate: string | null;
};

export type EndOfDayResult = {
  params: EndOfDayParams;
  capitalBase: number;
  days: EndOfDayDayResult[];
  summary: EndOfDaySummary;
};

export function runEndOfDayBacktest(
  bars: DailyBar[],
  holdingShares: number,
  params: EndOfDayParams = DEFAULT_END_OF_DAY_PARAMS
): EndOfDayResult {
  const groupedByDay = groupByTradingDay(bars);
  const sharesShorted = holdingShares * params.sellPercent;

  const firstDayBars = groupedByDay.values().next().value;
  const startPrice = firstDayBars ? firstDayBars[0].open : 0;
  const capitalBase = holdingShares * startPrice;

  const days: EndOfDayDayResult[] = [];
  let cumulativePnl = 0;

  for (const [date, dayBars] of groupedByDay) {
    const open = dayBars[0].open;
    const close = dayBars[dayBars.length - 1].close;
    const pnl = sharesShorted * (open - close);
    cumulativePnl += pnl;

    days.push({
      date,
      open,
      close,
      sharesShorted,
      pnl,
      cumulativePnl,
      cumulativeEquity: holdingShares * close + cumulativePnl,
      buyHoldEquity: holdingShares * close,
    });
  }

  const winDays = days.filter((d) => d.pnl > 0).length;
  const lossDays = days.filter((d) => d.pnl < 0).length;
  const flatDays = days.filter((d) => d.pnl === 0).length;

  const bestDay = days.reduce<EndOfDayDayResult | null>(
    (best, d) => (!best || d.pnl > best.pnl ? d : best),
    null
  );
  const worstDay = days.reduce<EndOfDayDayResult | null>(
    (worst, d) => (!worst || d.pnl < worst.pnl ? d : worst),
    null
  );

  const totalPnl = cumulativePnl;
  const finalEquity = days.length > 0 ? days[days.length - 1].cumulativeEquity : capitalBase;

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
    summary: {
      startDate: days.length > 0 ? days[0].date : null,
      endDate: days.length > 0 ? days[days.length - 1].date : null,
      tradingDays: days.length,
      totalPnl,
      totalReturnPercent: (totalPnl / capitalBase) * 100,
      winDays,
      lossDays,
      flatDays,
      bestDay,
      worstDay,
      finalEquity,
      maxDrawdown,
      maxDrawdownPercent,
      maxDrawdownPeakDate,
      maxDrawdownTroughDate,
    },
  };
}
