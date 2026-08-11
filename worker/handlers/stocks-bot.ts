import Anthropic from '@anthropic-ai/sdk';
import {
  getBrokerKeys, fetchAccount, fetchPositions, fetchHourlyBars, placeBracketBuy, closePosition,
  fetchLatestFilledSell,
} from '../lib/alpaca';
import type { AlpacaKeys, AlpacaBar, AlpacaPosition } from '../lib/alpaca';
import type { StocksEnv } from './broker-keys';

// Paper-trading bot engine (Stocks tab), ported verbatim from
// netlify/functions/stocks-bot.ts to run as a Cloudflare Worker Cron
// Trigger instead — see wrangler.jsonc's `triggers.crons`. Moved here
// (rather than staying on Netlify like the push-notification Scheduled
// Functions) because this engine has no web-push dependency, so it isn't
// subject to the Workers-runtime web-push limitation that keeps
// send-reminders.ts/send-shift-reminders.ts/generate-daily-plan.ts on
// Netlify. Real reason for the move: Netlify production deploys were
// paused (team billing), so anything depending on a fresh Netlify deploy
// — including this whole feature — was stuck; this engine has no such
// dependency, so it doesn't need to wait on that.
const MODEL = 'claude-opus-5';

const MAX_POSITION_PCT = 0.05;
const MAX_OPEN_POSITIONS = 3;
const STOP_LOSS_PCT = 0.02;
const DAILY_LOSS_LIMIT_PCT = 0.03;
const EMA_FAST = 20;
const EMA_SLOW = 50;
const BREAKOUT_LOOKBACK = 10;

function nowInTimeZone(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return new Date(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function dateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function inWindow(now: Date, hour: number, minute: number): boolean {
  return now.getHours() === hour && now.getMinutes() >= minute && now.getMinutes() < minute + 15;
}
function marketOpen(now: Date): boolean {
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

function emaSeries(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += closes[i];
  seed /= period;
  out[period - 1] = seed;
  for (let i = period; i < closes.length; i++) {
    out[i] = closes[i] * k + (out[i - 1] as number) * (1 - k);
  }
  return out;
}

interface StrategyRead {
  crossUp: boolean;
  crossDown: boolean;
  breakout: boolean;
  lastClose: number;
}

function readStrategy(bars: AlpacaBar[]): StrategyRead | null {
  if (bars.length < EMA_SLOW + 2) return null;
  const closes = bars.map((b) => b.c);
  const fast = emaSeries(closes, EMA_FAST);
  const slow = emaSeries(closes, EMA_SLOW);
  const n = bars.length;
  const fastNow = fast[n - 1];
  const slowNow = slow[n - 1];
  const fastPrev = fast[n - 2];
  const slowPrev = slow[n - 2];
  if (fastNow == null || slowNow == null || fastPrev == null || slowPrev == null) return null;

  const crossUp = fastPrev <= slowPrev && fastNow > slowNow;
  const crossDown = fastPrev >= slowPrev && fastNow < slowNow;

  const lookback = bars.slice(n - 1 - BREAKOUT_LOOKBACK, n - 1);
  const priorHigh = Math.max(...lookback.map((b) => b.h));
  const avgVolume = lookback.reduce((s, b) => s + b.v, 0) / lookback.length;
  const currentBar = bars[n - 1];
  const breakout = currentBar.c > priorHigh && currentBar.v > avgVolume;

  return { crossUp, crossDown, breakout, lastClose: currentBar.c };
}

interface RunEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  anthropicKey: string | null;
  headers: Record<string, string>;
}

async function reconcileClosedPositions(env: RunEnv, userId: string, keys: AlpacaKeys, livePositions: AlpacaPosition[]) {
  const heldSymbols = new Set(livePositions.map((p) => p.symbol));
  const openRes = await fetch(`${env.supabaseUrl}/rest/v1/bot_trades?user_id=eq.${userId}&status=eq.open&select=*`, { headers: env.headers });
  const openTrades = (await openRes.json()) as { id: string; ticker: string; qty: number; entry_price: number | null }[];

  for (const trade of openTrades) {
    if (heldSymbols.has(trade.ticker)) continue;
    const fill = await fetchLatestFilledSell(keys, trade.ticker);
    const exitPrice = fill?.filled_avg_price ? Number(fill.filled_avg_price) : trade.entry_price ?? 0;
    const pnl = trade.entry_price != null ? (exitPrice - trade.entry_price) * trade.qty : null;
    await fetch(`${env.supabaseUrl}/rest/v1/bot_trades?id=eq.${trade.id}`, {
      method: 'PATCH',
      headers: env.headers,
      body: JSON.stringify({ status: 'closed', exit_price: exitPrice, pnl, closed_at: new Date().toISOString() }),
    });
  }
}

async function logSignal(env: RunEnv, userId: string, ticker: string, signalType: 'entry' | 'exit' | 'blocked', reason: string, actedOn: boolean) {
  await fetch(`${env.supabaseUrl}/rest/v1/bot_signals`, {
    method: 'POST',
    headers: env.headers,
    body: JSON.stringify({ user_id: userId, ticker, signal_type: signalType, reason, acted_on: actedOn }),
  });
}

async function runStrategyForUser(env: RunEnv, userId: string, config: { watchlist: string[]; halted_date: string | null }, keys: AlpacaKeys, nowET: Date) {
  const [account, positions] = await Promise.all([fetchAccount(keys), fetchPositions(keys)]);
  await reconcileClosedPositions(env, userId, keys, positions);

  const equity = Number(account.equity);
  const lastEquity = Number(account.last_equity) || equity;
  const dailyPlPct = lastEquity ? (equity - lastEquity) / lastEquity : 0;
  const today = dateOnly(nowET);

  let haltedToday = config.halted_date === today;
  if (!haltedToday && dailyPlPct <= -DAILY_LOSS_LIMIT_PCT) {
    haltedToday = true;
    await fetch(`${env.supabaseUrl}/rest/v1/bot_config?user_id=eq.${userId}`, {
      method: 'PATCH', headers: env.headers,
      body: JSON.stringify({ halted_date: today, halted_reason: `Daily loss limit hit (${(dailyPlPct * 100).toFixed(1)}%)` }),
    });
    await logSignal(env, userId, '*', 'blocked', `Daily loss limit hit (${(dailyPlPct * 100).toFixed(1)}%) — halted until tomorrow`, false);
  }

  const bars = await fetchHourlyBars(keys, config.watchlist);
  const openTickers = new Set(positions.map((p) => p.symbol));
  const correlationBlocked = openTickers.has('SPY') && openTickers.has('QQQ');

  for (const ticker of config.watchlist) {
    const read = readStrategy(bars[ticker] ?? []);
    if (!read) continue;

    if (read.crossDown && openTickers.has(ticker)) {
      await closePosition(keys, ticker);
      openTickers.delete(ticker);
      await logSignal(env, userId, ticker, 'exit', 'EMA20 crossed below EMA50 — trend exit', true);
      continue;
    }

    if (!(read.crossUp && read.breakout)) continue;

    if (openTickers.has(ticker)) continue;
    if (haltedToday) {
      await logSignal(env, userId, ticker, 'blocked', 'Blocked: daily loss halt in effect', false);
      continue;
    }
    if (openTickers.size >= MAX_OPEN_POSITIONS) {
      await logSignal(env, userId, ticker, 'blocked', `Blocked: max ${MAX_OPEN_POSITIONS} open positions already held`, false);
      continue;
    }
    if (correlationBlocked) {
      await logSignal(env, userId, ticker, 'blocked', 'Blocked: SPY and QQQ both already held — correlation block', false);
      continue;
    }
    const qty = Math.floor((equity * MAX_POSITION_PCT) / read.lastClose);
    if (qty < 1) {
      await logSignal(env, userId, ticker, 'blocked', 'Blocked: position size rounds to 0 shares at current price', false);
      continue;
    }

    const stopLossPrice = read.lastClose * (1 - STOP_LOSS_PCT);
    try {
      const order = await placeBracketBuy(keys, { symbol: ticker, qty, stopLossPrice });
      await fetch(`${env.supabaseUrl}/rest/v1/bot_trades`, {
        method: 'POST', headers: env.headers,
        body: JSON.stringify({
          user_id: userId, ticker, side: 'buy', qty, entry_price: read.lastClose, stop_loss_price: stopLossPrice,
          status: 'open', alpaca_order_id: order.id,
        }),
      });
      openTickers.add(ticker);
      await logSignal(env, userId, ticker, 'entry', 'EMA20 crossed above EMA50 with a momentum breakout on above-average volume', true);
    } catch (err) {
      console.error('stocks-bot: order failed', ticker, err);
      await logSignal(env, userId, ticker, 'blocked', `Order failed: ${err instanceof Error ? err.message : 'unknown error'}`, false);
    }
  }
}

async function generateDailySummary(env: RunEnv, userId: string, today: string, keys: AlpacaKeys | null) {
  const startEt = `${today}T00:00:00`;
  const tradesRes = await fetch(
    `${env.supabaseUrl}/rest/v1/bot_trades?user_id=eq.${userId}&status=eq.closed&closed_at=gte.${startEt}&select=ticker,pnl`,
    { headers: env.headers },
  );
  const trades = (await tradesRes.json()) as { ticker: string; pnl: number | null }[];
  const netPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = trades.length ? (wins / trades.length) * 100 : null;

  let snapshot: unknown[] = [];
  let equity: number | null = null;
  if (keys) {
    try {
      const [positions, account] = await Promise.all([fetchPositions(keys), fetchAccount(keys)]);
      snapshot = positions.map((p) => ({
        symbol: p.symbol, qty: Number(p.qty), avg_entry_price: Number(p.avg_entry_price),
        current_price: Number(p.current_price), unrealized_pl: Number(p.unrealized_pl), unrealized_plpc: Number(p.unrealized_plpc) * 100,
      }));
      equity = Number(account.equity);
    } catch (err) {
      console.error('stocks-bot: summary positions fetch failed', err);
    }
  }

  let novaCommentary: string | null = null;
  if (env.anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: env.anthropicKey });
      const tradesText = trades.length
        ? trades.map((t) => `${t.ticker}: ${(t.pnl ?? 0) >= 0 ? '+' : ''}$${(t.pnl ?? 0).toFixed(2)}`).join(', ')
        : 'no trades closed today';
      const msg = await anthropic.messages.create({
        model: MODEL, max_tokens: 300, thinking: { type: 'disabled' }, output_config: { effort: 'low' },
        system:
          "You are Nova, writing Cristopher's end-of-day note for his paper-trading bot. Plain text, 2-3 sentences, " +
          'no markdown. State the net P&L and how many positions are open plainly, then one honest, grounded line of ' +
          "color — not hype. This is paper money and a v1 strategy; don't oversell it.",
        messages: [{ role: 'user', content: `Today's net P&L: $${netPnl.toFixed(2)}. Closed trades: ${tradesText}. Open positions: ${snapshot.length}.` }],
      });
      novaCommentary = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    } catch (err) {
      console.error('stocks-bot: Nova summary generation failed', err);
    }
  }

  await fetch(`${env.supabaseUrl}/rest/v1/bot_daily_summary?on_conflict=user_id,summary_date`, {
    method: 'POST',
    headers: { ...env.headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId, summary_date: today, equity, net_pnl: netPnl, win_rate: winRate, trades_count: trades.length,
      open_positions_snapshot: snapshot, nova_commentary: novaCommentary,
    }),
  });
}

export async function runStocksBot(env: StocksEnv): Promise<void> {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = env.ANTHROPIC_API_KEY ?? null;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('stocks-bot: missing required env vars');
    return;
  }

  const runEnv: RunEnv = { supabaseUrl, serviceRoleKey, anthropicKey, headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' } };
  const nowET = nowInTimeZone('America/New_York');
  const today = dateOnly(nowET);

  if (marketOpen(nowET)) {
    const configRes = await fetch(`${supabaseUrl}/rest/v1/bot_config?enabled=eq.true&select=user_id,watchlist,halted_date`, { headers: runEnv.headers });
    const configs = (await configRes.json()) as { user_id: string; watchlist: string[]; halted_date: string | null }[];

    for (const config of configs) {
      const keys = await getBrokerKeys(supabaseUrl, serviceRoleKey, config.user_id);
      if (!keys) continue;
      try {
        await runStrategyForUser(runEnv, config.user_id, config, keys, nowET);
      } catch (err) {
        console.error('stocks-bot: run failed for user', config.user_id, err);
      }
      await fetch(`${supabaseUrl}/rest/v1/bot_config?user_id=eq.${config.user_id}`, {
        method: 'PATCH', headers: runEnv.headers, body: JSON.stringify({ last_run_at: new Date().toISOString() }),
      });
    }
  }

  // ── 4:15pm ET daily summary, once market's closed ────────────────────
  if (inWindow(nowET, 16, 15)) {
    const allConfigsRes = await fetch(`${supabaseUrl}/rest/v1/bot_config?select=user_id`, { headers: runEnv.headers });
    const allConfigs = (await allConfigsRes.json()) as { user_id: string }[];
    for (const config of allConfigs) {
      const existingRes = await fetch(`${supabaseUrl}/rest/v1/bot_daily_summary?user_id=eq.${config.user_id}&summary_date=eq.${today}&select=id`, { headers: runEnv.headers });
      const existing = (await existingRes.json()) as { id: string }[];
      if (existing.length > 0) continue;
      const keys = await getBrokerKeys(supabaseUrl, serviceRoleKey, config.user_id);
      try {
        await generateDailySummary(runEnv, config.user_id, today, keys);
      } catch (err) {
        console.error('stocks-bot: daily summary failed for user', config.user_id, err);
      }
    }
  }
}
