// Thin client for IBKR's local Client Portal Gateway (must be running and
// logged in at https://localhost:5000). All functions here are read-only or
// order-related — see trading-bot.mjs for how the order-placing ones are
// gated behind an explicit live flag.

const BASE = "https://localhost:5000/v1/api";

// The gateway uses a self-signed cert; trust it for this local-only client.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    ...options,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function checkAuthStatus() {
  return request("/iserver/auth/status", { method: "POST", body: "{}" });
}

export async function tickle() {
  return request("/tickle", { method: "POST", body: "{}" });
}

export async function getAccounts() {
  return request("/iserver/accounts");
}

export async function resolveConid(symbol) {
  const results = await request("/iserver/secdef/search", {
    method: "POST",
    body: JSON.stringify({ symbol, name: false }),
  });
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`No matches found for symbol "${symbol}"`);
  }
  const usExchanges = ["NASDAQ", "NYSE", "ARCA", "AMEX", "BATS"];
  const preferred =
    results.find(
      (r) => r.sections?.some((s) => s.secType === "STK") && usExchanges.includes(r.description)
    ) ?? results[0];
  return { conid: preferred.conid, name: preferred.companyHeader };
}

// The paper account doesn't carry the live account's market data
// entitlements (IBKR's snapshot/history endpoints both come back empty when
// logged into DUP-prefixed accounts), so live price-watching goes through
// Yahoo instead — the same free, no-auth source already used by the app's
// /api/quote route. IBKR is only used for account/order actions below.
export async function getYahooPrice(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
    { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" }
  );
  if (!res.ok) throw new Error("Yahoo quote request failed");
  const data = await res.json();
  const meta = data.chart.result[0].meta;
  return { last: meta.regularMarketPrice };
}

export async function getPositions(accountId) {
  return request(`/portfolio/${accountId}/positions/0`);
}

// Places a market order. NEVER call this from code you run yourself in an
// assistant session — it submits a real order to the broker (paper or not).
// Returns either a fill confirmation or an array of {id, message} prompts
// that must be resolved via confirmOrderReply before the order proceeds.
export async function placeOrder(accountId, { conid, side, quantity, orderType = "MKT" }) {
  return request(`/iserver/account/${accountId}/orders`, {
    method: "POST",
    body: JSON.stringify({
      orders: [{ conid, orderType, side, quantity, tif: "DAY" }],
    }),
  });
}

export async function confirmOrderReply(replyId, confirmed = true) {
  return request(`/iserver/reply/${replyId}`, {
    method: "POST",
    body: JSON.stringify({ confirmed }),
  });
}
