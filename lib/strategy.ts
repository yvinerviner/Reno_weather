export type Bar = { time: number; price: number };

export type Leg = { shares: number; price: number; time: number };

export type TradeEvent = {
  time: number;
  type: "OPEN_SHORT" | "ADD_SHORT" | "STOP_OUT" | "EOD_CLOSE";
  shares: number;
  price: number;
  note: string;
};

export type StrategyParams = {
  initialShares: number;
  step: number;
  multiplier: number;
  maxShortShares: number;
};

export const DEFAULT_STRATEGY_PARAMS: StrategyParams = {
  initialShares: 50,
  step: 5,
  multiplier: 2,
  maxShortShares: Infinity,
};

export type SimResult = {
  status: "FLAT" | "OPEN" | "CLOSED";
  legs: Leg[];
  events: TradeEvent[];
  totalShares: number;
  avgEntry: number | null;
  stopPrice: number | null;
  nextAddTrigger: number | null;
  nextAddShares: number | null;
  openPrice: number | null;
  currentPrice: number | null;
  realizedPnl: number;
  unrealizedPnl: number;
};

// addIndex: 1 = first add (same size as initial), 2nd+ grows by multiplier.
function addSizeForIndex(addIndex: number, initialShares: number, multiplier: number): number {
  return initialShares * Math.pow(multiplier, addIndex - 1);
}

export function simulateSession(
  bars: Bar[],
  nowSeconds: number,
  marketCloseSeconds: number,
  params: StrategyParams = DEFAULT_STRATEGY_PARAMS
): SimResult {
  const { initialShares, step, multiplier, maxShortShares } = params;
  const events: TradeEvent[] = [];
  const legs: Leg[] = [];

  let status: SimResult["status"] = "FLAT";
  let openPrice: number | null = null;
  let stopPrice: number | null = null;
  let nextAddIndex = 1;
  let nextAddTrigger: number | null = null;
  let realizedPnl = 0;
  let currentPrice: number | null = null;

  function recomputeStopAfterAdd() {
    const totalShares = legs.reduce((s, l) => s + l.shares, 0);
    const totalCost = legs.reduce((s, l) => s + l.shares * l.price, 0);
    stopPrice = totalCost / totalShares;
  }

  for (const bar of bars) {
    currentPrice = bar.price;

    if (status === "FLAT") {
      openPrice = bar.price;
      const openShares = Math.min(initialShares, maxShortShares);
      legs.push({ shares: openShares, price: bar.price, time: bar.time });
      events.push({
        time: bar.time,
        type: "OPEN_SHORT",
        shares: openShares,
        price: bar.price,
        note: `Opened short ${openShares} @ $${bar.price.toFixed(2)}`,
      });
      status = "OPEN";
      stopPrice = openPrice + step;
      nextAddTrigger = openPrice - step;
      continue;
    }

    if (status !== "OPEN") continue;

    // No intraday stop-out: stopPrice/breakeven is tracked for reference only
    // (shown in the UI) — the position is only ever closed by the forced
    // end-of-day close below, regardless of how far price moves against it.

    while (status === "OPEN" && nextAddTrigger !== null && bar.price <= nextAddTrigger) {
      const currentTotal = legs.reduce((s, l) => s + l.shares, 0);
      const remainingCapacity = maxShortShares - currentTotal;
      if (remainingCapacity <= 0) break; // already at the position-size cap

      const rawAddShares = addSizeForIndex(nextAddIndex, initialShares, multiplier);
      const addShares = Math.min(rawAddShares, remainingCapacity);
      const fillPrice = nextAddTrigger;
      legs.push({ shares: addShares, price: fillPrice, time: bar.time });
      recomputeStopAfterAdd();
      events.push({
        time: bar.time,
        type: "ADD_SHORT",
        shares: addShares,
        price: fillPrice,
        note: `Added ${addShares} short @ $${fillPrice.toFixed(2)}. Stop moved to breakeven $${stopPrice!.toFixed(2)}`,
      });
      nextAddIndex += 1;
      nextAddTrigger = (openPrice as number) - step * nextAddIndex;
    }
  }

  if (status === "OPEN" && nowSeconds >= marketCloseSeconds && currentPrice !== null) {
    const totalShares = legs.reduce((s, l) => s + l.shares, 0);
    const pnl = legs.reduce((s, l) => s + l.shares * (l.price - currentPrice!), 0);
    realizedPnl += pnl;
    events.push({
      time: nowSeconds,
      type: "EOD_CLOSE",
      shares: totalShares,
      price: currentPrice,
      note: `End of day: covered ${totalShares} @ $${currentPrice.toFixed(2)} (P/L $${pnl.toFixed(2)})`,
    });
    status = "CLOSED";
  }

  const openTotalShares = legs.reduce((s, l) => s + l.shares, 0);
  const openAvgEntry =
    legs.length > 0
      ? legs.reduce((s, l) => s + l.shares * l.price, 0) / openTotalShares
      : null;

  const unrealizedPnl =
    status === "OPEN" && currentPrice !== null
      ? legs.reduce((s, l) => s + l.shares * (l.price - currentPrice!), 0)
      : 0;

  const remainingCapacity = maxShortShares - openTotalShares;
  const nextAddShares =
    status === "OPEN" && remainingCapacity > 0
      ? Math.min(addSizeForIndex(nextAddIndex, initialShares, multiplier), remainingCapacity)
      : null;

  return {
    status,
    legs,
    events,
    totalShares: status === "OPEN" ? openTotalShares : 0,
    avgEntry: status === "OPEN" ? openAvgEntry : null,
    stopPrice: status === "OPEN" ? stopPrice : null,
    nextAddTrigger: status === "OPEN" ? nextAddTrigger : null,
    nextAddShares,
    openPrice,
    currentPrice,
    realizedPnl,
    unrealizedPnl,
  };
}
