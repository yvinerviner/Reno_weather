import {
  simulateSession,
  DEFAULT_STRATEGY_PARAMS,
  type StrategyParams,
  type TradeEvent,
} from "@/lib/strategy";

export type DailyBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type DayResult = {
  date: string;
  open: number;
  close: number;
  status: "OPEN" | "CLOSED" | "FLAT";
  addsCount: number;
  finalShares: number;
  pnl: number;
  cumulativePnl: number;
  cumulativeEquity: number;
  buyHoldEquity: number;
  events: TradeEvent[];
};

export type BacktestSummary = {
  startDate: string | null;
  endDate: string | null;
  tradingDays: number;
  totalPnl: number;
  totalReturnPercent: number;
  winDays: number;
  lossDays: number;
  flatDays: number;
  bestDay: DayResult | null;
  worstDay: DayResult | null;
  finalEquity: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownPeakDate: string | null;
  maxDrawdownTroughDate: string | null;
};

export type BacktestResult = {
  params: StrategyParams;
  capitalBase: number;
  days: DayResult[];
  summary: BacktestSummary;
};

// Approximate the intraday path within one bar: assume price moves toward
// its close last (dip-then-rally on up bars, rally-then-selloff on down
// bars). Real order within the bar still isn't known, but the error this
// introduces shrinks with the bar's width — negligible for real 1-minute
// bars (IBKR), still much better than a whole day for hourly (Yahoo)
// fallback bars. The 15s sub-offset stays well inside any bar width we use
// (>= 60s) so sub-points never spill into the next bar.
function barToPseudoBars(bar: DailyBar) {
  const extremesUp = [bar.low, bar.high];
  const extremesDown = [bar.high, bar.low];
  const extremes = bar.close >= bar.open ? extremesUp : extremesDown;
  const subOffset = 15;

  return [
    { time: bar.time, price: bar.open },
    { time: bar.time + subOffset, price: extremes[0] },
    { time: bar.time + subOffset * 2, price: extremes[1] },
    { time: bar.time + subOffset * 3, price: bar.close },
  ];
}

// Reuse one formatter — constructing a new Intl.DateTimeFormat per call
// (e.g. via toLocaleDateString with a timeZone option) is drastically
// slower and dominates runtime over tens of thousands of bars.
const tradingDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
});

function tradingDateKey(seconds: number): string {
  return tradingDateFormatter.format(new Date(seconds * 1000));
}

function groupByTradingDay(hourlyBars: DailyBar[]): Map<string, DailyBar[]> {
  const map = new Map<string, DailyBar[]>();
  for (const bar of hourlyBars) {
    const key = tradingDateKey(bar.time);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(bar);
  }
  return map;
}

export function runBacktest(
  hourlyBars: DailyBar[],
  holdingShares: number,
  params: StrategyParams = DEFAULT_STRATEGY_PARAMS
): BacktestResult {
  const days: DayResult[] = [];
  let cumulativePnl = 0;

  const groupedByDay = groupByTradingDay(hourlyBars);

  // You already hold `holdingShares` of the stock; that holding count never
  // changes. capitalBase is its value on day one (the baseline for % return).
  // Each day's equity instead marks that same holding to THAT day's close,
  // plus the short strategy's cumulative P/L — so equity moves with both the
  // stock's own price and the trading results, not a frozen day-one price.
  const firstDayBars = groupedByDay.values().next().value;
  const startPrice = firstDayBars ? firstDayBars[0].open : 0;
  const capitalBase = holdingShares * startPrice;

  // Never short more than half the shares you actually hold.
  const effectiveParams: StrategyParams = { ...params, maxShortShares: holdingShares * 0.5 };

  for (const [date, hours] of groupedByDay) {
    const pseudoBars = hours.flatMap(barToPseudoBars);
    const lastHour = hours[hours.length - 1];
    const marketCloseSeconds = lastHour.time + 3600;
    const nowSeconds = marketCloseSeconds + 1;

    const sim = simulateSession(pseudoBars, nowSeconds, marketCloseSeconds, effectiveParams);
    const pnl = sim.realizedPnl;
    cumulativePnl += pnl;

    days.push({
      date,
      open: hours[0].open,
      close: lastHour.close,
      status: sim.status,
      addsCount: sim.events.filter((e) => e.type === "ADD_SHORT").length,
      finalShares: sim.events.reduce(
        (max, e) => (e.type === "STOP_OUT" || e.type === "EOD_CLOSE" ? e.shares : max),
        0
      ),
      pnl,
      cumulativePnl,
      cumulativeEquity: holdingShares * lastHour.close + cumulativePnl,
      buyHoldEquity: holdingShares * lastHour.close,
      events: sim.events,
    });
  }

  const winDays = days.filter((d) => d.pnl > 0).length;
  const lossDays = days.filter((d) => d.pnl < 0).length;
  const flatDays = days.filter((d) => d.pnl === 0).length;

  const bestDay = days.reduce<DayResult | null>(
    (best, d) => (!best || d.pnl > best.pnl ? d : best),
    null
  );
  const worstDay = days.reduce<DayResult | null>(
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
    params: effectiveParams,
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
