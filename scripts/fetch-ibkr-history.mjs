// Pulls full 1-minute history for a stock symbol from the local IBKR
// Client Portal Gateway (must be running and logged in at localhost:5000)
// and writes it to data/{symbol}-1min.json for the backtest to consume.
//
// Run with: node scripts/fetch-ibkr-history.mjs SYMBOL [FROM_DATE]
// Example:  node scripts/fetch-ibkr-history.mjs AAPL 2026-01-01

import fs from "node:fs";
import path from "node:path";

const symbolArg = process.argv[2];
const fromArg = process.argv[3] ?? "2026-01-01";

if (!symbolArg) {
  console.error("Usage: node scripts/fetch-ibkr-history.mjs SYMBOL [FROM_DATE]");
  process.exit(1);
}

const SYMBOL = symbolArg.toUpperCase();
const FROM = new Date(`${fromArg}T00:00:00Z`).getTime();
const BASE = "https://localhost:5000/v1/api";
const OUT_PATH = path.resolve(`data/${SYMBOL.toLowerCase()}-1min.json`);

// The local gateway uses a self-signed cert; trust it for this script only.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function formatStartTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

async function resolveConid(symbol) {
  const res = await fetch(`${BASE}/iserver/secdef/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, name: false }),
  });
  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`No matches found for symbol "${symbol}"`);
  }

  // Prefer the primary US stock listing (has a plain STK section, and its
  // description names a US exchange rather than a foreign/CDR/ETF listing).
  const usExchanges = ["NASDAQ", "NYSE", "ARCA", "AMEX", "BATS"];
  const preferred =
    results.find(
      (r) =>
        r.sections?.some((s) => s.secType === "STK") &&
        usExchanges.includes(r.description)
    ) ?? results[0];

  console.log(
    `Resolved ${symbol} -> conid ${preferred.conid} (${preferred.companyHeader})`
  );
  return preferred.conid;
}

async function fetchBatch(conid, startTime, retries = 5) {
  const url = new URL(`${BASE}/iserver/marketdata/history`);
  url.searchParams.set("conid", conid);
  url.searchParams.set("period", "5d");
  url.searchParams.set("bar", "1min");
  url.searchParams.set("outsideRth", "false");
  if (startTime) url.searchParams.set("startTime", startTime);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const json = await res.json();
    if (!json.error) return json.data ?? [];

    if (attempt === retries) {
      throw new Error(`Gateway error: ${json.error} (${json.statusCode})`);
    }
    const backoff = 2000 * Math.pow(2, attempt);
    console.log(`  ${json.error}, retrying in ${backoff}ms (attempt ${attempt + 1}/${retries})`);
    await new Promise((r) => setTimeout(r, backoff));
  }
  return [];
}

async function main() {
  const status = await fetch(`${BASE}/iserver/auth/status`, { method: "POST" }).then((r) =>
    r.json()
  );
  if (!status.authenticated) {
    throw new Error(
      "Not authenticated — open https://localhost:5000 in your browser and log in first."
    );
  }

  const conid = await resolveConid(SYMBOL);

  const allBars = new Map(); // dedupe by timestamp
  let cursor = undefined; // undefined = "now"
  let batchCount = 0;

  while (true) {
    const batch = await fetchBatch(conid, cursor);
    if (batch.length === 0) {
      console.log("Empty batch, stopping.");
      break;
    }

    for (const bar of batch) {
      allBars.set(bar.t, bar);
    }

    const oldestInBatch = batch[0].t;
    batchCount += 1;
    console.log(
      `Batch ${batchCount}: ${batch.length} bars, oldest ${new Date(oldestInBatch).toISOString()}, total unique so far ${allBars.size}`
    );

    if (oldestInBatch <= FROM) {
      console.log("Reached target start date, stopping.");
      break;
    }

    cursor = formatStartTime(oldestInBatch);
    await new Promise((r) => setTimeout(r, 1500)); // be polite to the gateway
  }

  const sorted = [...allBars.values()]
    .filter((b) => b.t >= FROM)
    .sort((a, b) => a.t - b.t);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(sorted));
  console.log(`Wrote ${sorted.length} bars to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
