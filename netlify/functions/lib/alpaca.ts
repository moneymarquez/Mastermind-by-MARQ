// Shared Alpaca paper-trading helpers used by stocks-account.ts (live status
// pull for the client) and stocks-bot.ts (the scheduled engine). Paper-only —
// ALPACA_TRADING_BASE is hard-coded to the paper endpoint; there is no live
// path here by design (see the Stocks bot build spec: live is a future,
// separate build).
export const ALPACA_TRADING_BASE = 'https://paper-api.alpaca.markets';
export const ALPACA_DATA_BASE = 'https://data.alpaca.markets';

export interface AlpacaKeys {
  apiKeyId: string;
  apiSecret: string;
}

export function alpacaHeaders(keys: AlpacaKeys): Record<string, string> {
  return { 'APCA-API-KEY-ID': keys.apiKeyId, 'APCA-API-SECRET-KEY': keys.apiSecret };
}

export async function getBrokerKeys(supabaseUrl: string, serviceRoleKey: string, userId: string): Promise<AlpacaKeys | null> {
  const res = await fetch(`${supabaseUrl}/rest/v1/bot_broker_keys?user_id=eq.${userId}&select=api_key_id,api_secret`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = (await res.json()) as { api_key_id: string; api_secret: string }[];
  const row = rows[0];
  return row ? { apiKeyId: row.api_key_id, apiSecret: row.api_secret } : null;
}

export interface AlpacaAccount {
  equity: string;
  last_equity: string;
  cash: string;
  buying_power: string;
}

export async function fetchAccount(keys: AlpacaKeys): Promise<AlpacaAccount> {
  const res = await fetch(`${ALPACA_TRADING_BASE}/v2/account`, { headers: alpacaHeaders(keys) });
  if (!res.ok) throw new Error(`Alpaca account fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface AlpacaPosition {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  unrealized_pl: string;
  unrealized_plpc: string;
}

export async function fetchPositions(keys: AlpacaKeys): Promise<AlpacaPosition[]> {
  const res = await fetch(`${ALPACA_TRADING_BASE}/v2/positions`, { headers: alpacaHeaders(keys) });
  if (!res.ok) throw new Error(`Alpaca positions fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function closePosition(keys: AlpacaKeys, symbol: string): Promise<void> {
  const res = await fetch(`${ALPACA_TRADING_BASE}/v2/positions/${symbol}`, { method: 'DELETE', headers: alpacaHeaders(keys) });
  if (!res.ok && res.status !== 404) throw new Error(`Alpaca close position failed: ${res.status} ${await res.text()}`);
}

export interface BracketOrderRequest {
  symbol: string;
  qty: number;
  stopLossPrice: number;
}

export interface AlpacaOrder {
  id: string;
  filled_avg_price: string | null;
  status: string;
}

// Market buy with a broker-side stop-loss leg attached (order_class: bracket)
// so the 2% stop executes on Alpaca's side even if a future cron tick is
// missed — the stop isn't something our own code has to keep re-checking.
export async function placeBracketBuy(keys: AlpacaKeys, req: BracketOrderRequest): Promise<AlpacaOrder> {
  const res = await fetch(`${ALPACA_TRADING_BASE}/v2/orders`, {
    method: 'POST',
    headers: { ...alpacaHeaders(keys), 'content-type': 'application/json' },
    body: JSON.stringify({
      symbol: req.symbol,
      qty: req.qty,
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
      order_class: 'bracket',
      stop_loss: { stop_price: req.stopLossPrice.toFixed(2) },
    }),
  });
  if (!res.ok) throw new Error(`Alpaca order failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface AlpacaClosedOrder {
  id: string;
  symbol: string;
  side: string;
  status: string;
  filled_avg_price: string | null;
}

// Used during trade reconciliation: when a bot_trades row is still "open"
// but the ticker is no longer in live positions (the broker-side bracket
// stop loss fired, or a trend-exit sell filled), this finds the actual fill
// price so bot_trades.pnl reflects what really happened, not an estimate.
export async function fetchLatestFilledSell(keys: AlpacaKeys, symbol: string): Promise<AlpacaClosedOrder | null> {
  const url = `${ALPACA_TRADING_BASE}/v2/orders?status=closed&symbols=${symbol}&limit=10&direction=desc`;
  const res = await fetch(url, { headers: alpacaHeaders(keys) });
  if (!res.ok) return null;
  const orders = (await res.json()) as AlpacaClosedOrder[];
  return orders.find((o) => o.side === 'sell' && o.status === 'filled') ?? null;
}

export interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// 1-hour candles for the strategy's EMA/momentum/volume calculations.
// IEX feed (the free tier) — plenty for the crossover/breakout logic here.
export async function fetchHourlyBars(keys: AlpacaKeys, symbols: string[], limit = 80): Promise<Record<string, AlpacaBar[]>> {
  const url = `${ALPACA_DATA_BASE}/v2/stocks/bars?symbols=${symbols.join(',')}&timeframe=1Hour&limit=${limit}&feed=iex&adjustment=raw`;
  const res = await fetch(url, { headers: alpacaHeaders(keys) });
  if (!res.ok) throw new Error(`Alpaca bars fetch failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { bars: Record<string, AlpacaBar[]> };
  return body.bars ?? {};
}

export interface AlpacaNewsItem {
  headline: string;
  source: string;
  url: string;
  symbols: string[];
  created_at: string;
}

export async function fetchNews(keys: AlpacaKeys, symbols: string[], limit = 12): Promise<AlpacaNewsItem[]> {
  const url = `${ALPACA_DATA_BASE}/v1beta1/news?symbols=${symbols.join(',')}&limit=${limit}`;
  const res = await fetch(url, { headers: alpacaHeaders(keys) });
  if (!res.ok) return [];
  const body = (await res.json()) as { news: AlpacaNewsItem[] };
  return body.news ?? [];
}
