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

// The full state of one day's session, threaded through applyTick one price
// update at a time. Same shape whether fed by a batch of historical bars
// (backtest) or a live price feed (the trading bot) — this is what keeps the
// two behaviorally identical.
export type SessionState = {
  status: "FLAT" | "OPEN" | "CLOSED";
  legs: Leg[];
  events: TradeEvent[];
  openPrice: number | null;
  stopPrice: number | null;
  nextAddIndex: number;
  nextAddTrigger: number | null;
  realizedPnl: number;
  currentPrice: number | null;
};

export function createSessionState(): SessionState {
  return {
    status: "FLAT",
    legs: [],
    events: [],
    openPrice: null,
    stopPrice: null,
    nextAddIndex: 1,
    nextAddTrigger: null,
    realizedPnl: 0,
    currentPrice: null,
  };
}

// addIndex: 1 = first add (same size as initial), 2nd+ grows by multiplier.
function addSizeForIndex(addIndex: number, initialShares: number, multiplier: number): number {
  return initialShares * Math.pow(multiplier, addIndex - 1);
}

function totalShares(legs: Leg[]): number {
  return legs.reduce((s, l) => s + l.shares, 0);
}

function weightedAvgPrice(legs: Leg[]): number {
  const shares = totalShares(legs);
  return legs.reduce((s, l) => s + l.shares * l.price, 0) / shares;
}

// Applies one price tick to the session state and returns the new state.
// Pure function — the input state is never mutated, so callers can safely
// keep the previous state around (e.g. to diff `events` for what's new).
export function applyTick(state: SessionState, bar: Bar, params: StrategyParams): SessionState {
  const { initialShares, step, multiplier, maxShortShares } = params;

  if (state.status === "FLAT") {
    const openShares = Math.min(initialShares, maxShortShares);
    const legs = [{ shares: openShares, price: bar.price, time: bar.time }];
    const events = [
      ...state.events,
      {
        time: bar.time,
        type: "OPEN_SHORT" as const,
        shares: openShares,
        price: bar.price,
        note: `Opened short ${openShares} @ $${bar.price.toFixed(2)}`,
      },
    ];
    return {
      ...state,
      status: "OPEN",
      legs,
      events,
      openPrice: bar.price,
      stopPrice: bar.price + step,
      nextAddTrigger: bar.price - step,
      currentPrice: bar.price,
    };
  }

  if (state.status !== "OPEN") {
    return { ...state, currentPrice: bar.price };
  }

  // No intraday stop-out: stopPrice/breakeven is tracked for reference only
  // (shown in the UI) — the position is only ever closed by the forced
  // end-of-day close, regardless of how far price moves against it.

  let legs = state.legs;
  let events = state.events;
  let stopPrice = state.stopPrice;
  let nextAddIndex = state.nextAddIndex;
  let nextAddTrigger = state.nextAddTrigger;

  while (nextAddTrigger !== null && bar.price <= nextAddTrigger) {
    const currentTotal = totalShares(legs);
    const remainingCapacity = maxShortShares - currentTotal;
    if (remainingCapacity <= 0) break; // already at the position-size cap

    const rawAddShares = addSizeForIndex(nextAddIndex, initialShares, multiplier);
    const addShares = Math.min(rawAddShares, remainingCapacity);
    const fillPrice = nextAddTrigger;
    legs = [...legs, { shares: addShares, price: fillPrice, time: bar.time }];
    stopPrice = weightedAvgPrice(legs);
    events = [
      ...events,
      {
        time: bar.time,
        type: "ADD_SHORT",
        shares: addShares,
        price: fillPrice,
        note: `Added ${addShares} short @ $${fillPrice.toFixed(2)}. Stop moved to breakeven $${stopPrice.toFixed(2)}`,
      },
    ];
    nextAddIndex += 1;
    nextAddTrigger = (state.openPrice as number) - step * nextAddIndex;
  }

  return {
    ...state,
    legs,
    events,
    stopPrice,
    nextAddIndex,
    nextAddTrigger,
    currentPrice: bar.price,
  };
}

// Forces the end-of-day close if a position is still open. Idempotent: a
// no-op if already closed or never opened.
export function forceEodClose(state: SessionState, nowSeconds: number): SessionState {
  if (state.status !== "OPEN" || state.currentPrice === null) return state;

  const shares = totalShares(state.legs);
  const pnl = state.legs.reduce((s, l) => s + l.shares * (l.price - state.currentPrice!), 0);
  const events = [
    ...state.events,
    {
      time: nowSeconds,
      type: "EOD_CLOSE" as const,
      shares,
      price: state.currentPrice,
      note: `End of day: covered ${shares} @ $${state.currentPrice.toFixed(2)} (P/L $${pnl.toFixed(2)})`,
    },
  ];

  return {
    ...state,
    status: "CLOSED",
    events,
    realizedPnl: state.realizedPnl + pnl,
  };
}

// Projects the current session state into the display/API shape.
export function deriveSimResult(state: SessionState, params: StrategyParams): SimResult {
  const { initialShares, multiplier, maxShortShares } = params;

  const openTotalShares = totalShares(state.legs);
  const openAvgEntry = state.legs.length > 0 ? weightedAvgPrice(state.legs) : null;

  const unrealizedPnl =
    state.status === "OPEN" && state.currentPrice !== null
      ? state.legs.reduce((s, l) => s + l.shares * (l.price - state.currentPrice!), 0)
      : 0;

  const remainingCapacity = maxShortShares - openTotalShares;
  const nextAddShares =
    state.status === "OPEN" && remainingCapacity > 0
      ? Math.min(addSizeForIndex(state.nextAddIndex, initialShares, multiplier), remainingCapacity)
      : null;

  return {
    status: state.status,
    legs: state.legs,
    events: state.events,
    totalShares: state.status === "OPEN" ? openTotalShares : 0,
    avgEntry: state.status === "OPEN" ? openAvgEntry : null,
    stopPrice: state.status === "OPEN" ? state.stopPrice : null,
    nextAddTrigger: state.status === "OPEN" ? state.nextAddTrigger : null,
    nextAddShares,
    openPrice: state.openPrice,
    currentPrice: state.currentPrice,
    realizedPnl: state.realizedPnl,
    unrealizedPnl,
  };
}

// Batch convenience wrapper over the incremental primitives above — used by
// the backtest (and the live "today" API) to replay a whole array of bars at
// once. The trading bot instead calls applyTick directly, one live price
// update at a time, persisting SessionState between calls.
export function simulateSession(
  bars: Bar[],
  nowSeconds: number,
  marketCloseSeconds: number,
  params: StrategyParams = DEFAULT_STRATEGY_PARAMS
): SimResult {
  let state = createSessionState();
  for (const bar of bars) {
    state = applyTick(state, bar, params);
  }
  if (nowSeconds >= marketCloseSeconds) {
    state = forceEodClose(state, nowSeconds);
  }
  return deriveSimResult(state, params);
}
