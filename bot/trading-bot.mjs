// TSLA short-strategy trading bot — runs for one trading day, then exits.
// Reuses the EXACT same decision engine as the backtest/live-strategy pages
// (lib/strategy.ts), fed with real live prices from IBKR instead of history.
//
// SAFETY: defaults to --dry-run (no orders submitted, just logged). Live
// order submission only happens with --live, which you must pass yourself —
// this script is never invoked with --live by an assistant session.
//
// Usage:
//   node bot/trading-bot.mjs                     # dry run, defaults
//   node bot/trading-bot.mjs --live               # LIVE — submits real orders
//   node bot/trading-bot.mjs --shares=480 --initialShares=50 --step=5 --multiplier=2

import * as broker from "./broker.mjs";
import {
  createSessionState,
  applyTick,
  forceEodClose,
  deriveSimResult,
} from "../lib/strategy.ts";

const SYMBOL = "TSLA";
const MARKET_TZ = "America/New_York";
const POLL_INTERVAL_MS = 15_000;
const TICKLE_INTERVAL_MS = 50_000;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    })
  );
  return {
    live: args.live === "true",
    shares: Number(args.shares ?? 480),
    initialShares: Number(args.initialShares ?? 50),
    step: Number(args.step ?? 5),
    multiplier: Number(args.multiplier ?? 2),
  };
}

function nowInMarketTz() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute; // minutes since midnight ET
}

const MARKET_OPEN_MIN = 9 * 60 + 30;
const MARKET_CLOSE_MIN = 16 * 60;

function log(...args) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}]`, ...args);
}

async function executeEvent(event, accountId, conid, live) {
  const isBuy = event.type === "EOD_CLOSE"; // covering a short = buying back
  const side = isBuy ? "BUY" : "SELL";

  if (!live) {
    log(`[DRY RUN] Would submit ${side} ${event.shares} ${SYMBOL} (${event.type}) — ${event.note}`);
    return;
  }

  log(`LIVE: submitting ${side} ${event.shares} ${SYMBOL} (${event.type})`);
  let result = await broker.placeOrder(accountId, { conid, side, quantity: event.shares });

  // IBKR may respond with confirmation prompts instead of an immediate fill.
  while (Array.isArray(result) && result[0]?.id) {
    log(`Order needs confirmation: ${result[0].message?.join(" ") ?? "(no message)"}`);
    result = await broker.confirmOrderReply(result[0].id, true);
  }
  log("Order result:", JSON.stringify(result));
}

async function main() {
  const opts = parseArgs();
  const params = {
    initialShares: opts.initialShares,
    step: opts.step,
    multiplier: opts.multiplier,
    maxShortShares: opts.shares * 0.5,
  };

  log(`Starting bot — mode: ${opts.live ? "LIVE (real orders)" : "DRY RUN (no orders submitted)"}`);
  log("Params:", JSON.stringify(params));

  const authStatus = await broker.checkAuthStatus();
  if (!authStatus.authenticated) {
    throw new Error("Not authenticated — log in at https://localhost:5000 first.");
  }
  log("Authenticated.");

  const accountsInfo = await broker.getAccounts();
  const accountId = accountsInfo.selectedAccount ?? accountsInfo.accounts[0];
  log(`Using account: ${accountId} (isPaper=${accountsInfo.isPaper})`);

  if (!opts.live && accountsInfo.isPaper === false) {
    log("Note: this is a LIVE account, but running in dry-run — no orders will be submitted.");
  }
  if (opts.live && accountsInfo.isPaper === false) {
    log("WARNING: LIVE mode against a LIVE (real-money) account.");
  }

  const { conid, name } = await broker.resolveConid(SYMBOL);
  log(`Resolved ${SYMBOL} -> conid ${conid} (${name})`);

  const nowMin = nowInMarketTz();
  if (nowMin >= MARKET_CLOSE_MIN) {
    log("Market is already closed for today. Nothing to do — exiting.");
    return;
  }
  if (nowMin < MARKET_OPEN_MIN) {
    const waitMs = (MARKET_OPEN_MIN - nowMin) * 60_000;
    log(`Market not open yet. Waiting ${Math.round(waitMs / 60000)} min until 9:30 AM ET...`);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  let state = createSessionState();
  let lastEventCount = 0;
  let lastTickle = Date.now();

  log("Beginning session — polling live price every", POLL_INTERVAL_MS / 1000, "s");

  while (true) {
    const closedForToday = nowInMarketTz() >= MARKET_CLOSE_MIN;

    if (Date.now() - lastTickle > TICKLE_INTERVAL_MS) {
      await broker.tickle().catch((e) => log("Tickle failed (session may need re-login):", e.message));
      lastTickle = Date.now();
    }

    const { last: price } = await broker.getYahooPrice(SYMBOL);
    const bar = { time: Math.floor(Date.now() / 1000), price };

    state = applyTick(state, bar, params);
    if (closedForToday && state.status === "OPEN") {
      state = forceEodClose(state, bar.time);
    }

    const newEvents = state.events.slice(lastEventCount);
    for (const event of newEvents) {
      log(event.note);
      await executeEvent(event, accountId, conid, opts.live);
    }
    lastEventCount = state.events.length;

    if (state.status === "CLOSED") {
      const result = deriveSimResult(state, params);
      log(`Session complete. Realized P/L: $${result.realizedPnl.toFixed(2)}`);
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("Bot crashed:", err);
  process.exit(1);
});
