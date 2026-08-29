export type Bar = { time: number; price: number };

export type Leg = { shares: number; price: number; time: number };

export type TradeEvent = {
  time: number;
  type: "OPEN_SHORT" | "ADD_SHORT" | "STOP_OUT" | "EOD_CLOSE";
  shares: number;
  price: number;
  note: string;
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

const INITIAL_SHARES = 50;
const STEP = 5;

// addIndex: 1 = first add, 2 = second add, 3rd+ doubles the previous add size.
function addSizeForIndex(addIndex: number): number {
  if (addIndex === 1) return 50;
  if (addIndex === 2) return 100;
  return 100 * Math.pow(2, addIndex - 2);
}

export function simulateSession(
  bars: Bar[],
  nowSeconds: number,
  marketCloseSeconds: number
): SimResult {
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
      legs.push({ shares: INITIAL_SHARES, price: bar.price, time: bar.time });
      events.push({
        time: bar.time,
        type: "OPEN_SHORT",
        shares: INITIAL_SHARES,
        price: bar.price,
        note: `Opened short ${INITIAL_SHARES} @ $${bar.price.toFixed(2)}`,
      });
      status = "OPEN";
      stopPrice = openPrice + STEP;
      nextAddTrigger = openPrice - STEP;
      continue;
    }

    if (status !== "OPEN") continue;

    if (stopPrice !== null && bar.price >= stopPrice) {
      const totalShares = legs.reduce((s, l) => s + l.shares, 0);
      const pnl = legs.reduce((s, l) => s + l.shares * (l.price - bar.price), 0);
      realizedPnl += pnl;
      events.push({
        time: bar.time,
        type: "STOP_OUT",
        shares: totalShares,
        price: bar.price,
        note: `Stopped out: covered ${totalShares} @ $${bar.price.toFixed(2)} (P/L $${pnl.toFixed(2)})`,
      });
      status = "CLOSED";
      continue;
    }

    while (status === "OPEN" && nextAddTrigger !== null && bar.price <= nextAddTrigger) {
      const addShares = addSizeForIndex(nextAddIndex);
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
      nextAddTrigger = (openPrice as number) - STEP * nextAddIndex;
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

  return {
    status,
    legs,
    events,
    totalShares: status === "OPEN" ? openTotalShares : 0,
    avgEntry: status === "OPEN" ? openAvgEntry : null,
    stopPrice: status === "OPEN" ? stopPrice : null,
    nextAddTrigger: status === "OPEN" ? nextAddTrigger : null,
    nextAddShares: status === "OPEN" ? addSizeForIndex(nextAddIndex) : null,
    openPrice,
    currentPrice,
    realizedPnl,
    unrealizedPnl,
  };
}
