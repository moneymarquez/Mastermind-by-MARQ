import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useStocksBot } from '../../data/useStocksBot';
import type { BotSignal, BotTrade } from '../../data/types';
import { useNovaPreferences } from '../../data/useNovaPreferences';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const GOLD = '#C9A24B';
const GREEN = '#4CAF7D';
const RED = '#c47a7a';

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const mono: CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '9px 12px',
  color: 'var(--text)', fontSize: 13.5, outline: 'none',
};
const tabStyle = (active: boolean): CSSProperties => ({
  padding: '9px 16px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, color: active ? 'var(--text)' : 'var(--text-tertiary)',
  background: active ? '#F5F6F71a' : 'transparent', whiteSpace: 'nowrap',
});
const pillButton = (variant: 'solid' | 'outline', danger?: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  background: variant === 'solid' ? (danger ? RED : 'var(--text)') : 'transparent',
  color: variant === 'solid' ? 'var(--bg)' : danger ? RED : 'var(--text)',
  border: variant === 'outline' ? `1px solid ${danger ? RED : 'var(--text)'}` : 'none',
});

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function pnlColor(n: number): string {
  return n > 0 ? GREEN : n < 0 ? RED : 'var(--text-secondary)';
}
function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

const RISK_RULES = [
  'Max 5% of paper account per position',
  'Max 3 open positions at once',
  'Per-trade stop loss: 2% below entry, automatic (broker-side bracket order)',
  'Daily loss limit: bot halts for the rest of the day if the paper account is down 3%',
];
const STRATEGY_PARAMS = [
  'Trend: EMA 20 / EMA 50 crossover on 1-hour candles',
  'Momentum: breaks above the prior 10-bar high on above-average volume',
  'Correlation guard: blocks new entries if SPY and QQQ are both already held long',
  'Scans every 15 minutes, 9:30am-4:00pm ET, Monday-Friday',
];

const WALKTHROUGH_KEY = 'stocks-bot-walkthrough-checked';
const WALKTHROUGH_STEPS = [
  'Create a free Alpaca account at alpaca.markets — choose Paper Trading.',
  'In the Alpaca dashboard, generate a Paper API Key ID + Secret.',
  'Paste both into Watchlist & Settings → Broker Keys below. Save.',
  'Set your watchlist (start with the defaults, 5 tickers max).',
  'Flip the bot to ON. It scans every 15 min during market hours.',
  "For the first 2 weeks: do nothing. Check the Today panel each evening — read the blocked signals too, that's the bot's judgment on display.",
  "After 30 trading days, review Performance: win rate, drawdown, and whether it beat just holding SPY. Be honest with yourself here.",
  "Only consider live mode if the paper results genuinely justify it — that's a future build, not a toggle tonight.",
];

function loadWalkthroughState(): boolean[] {
  try {
    const raw = localStorage.getItem(WALKTHROUGH_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt/missing localStorage — falls through to defaults
  }
  return WALKTHROUGH_STEPS.map(() => false);
}

function Walkthrough() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(loadWalkthroughState);

  const toggle = (i: number) => {
    const next = [...checked];
    next[i] = !next[i];
    setChecked(next);
    localStorage.setItem(WALKTHROUGH_KEY, JSON.stringify(next));
  };

  const doneCount = checked.filter(Boolean).length;

  return (
    <div style={{ ...cardStyle, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>How to run this bot</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{doneCount}/{WALKTHROUGH_STEPS.length} · {open ? 'Hide' : 'Show'}</div>
      </div>
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WALKTHROUGH_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggle(i)}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: `1px solid ${checked[i] ? GOLD : 'var(--border-2)'}`, background: checked[i] ? GOLD : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--bg)', fontWeight: 700,
              }}>
                {checked[i] ? '✓' : ''}
              </div>
              <div style={{ fontSize: 13, color: checked[i] ? 'var(--text-tertiary)' : 'var(--text-quaternary-2)', textDecoration: checked[i] ? 'line-through' : 'none', lineHeight: 1.5 }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '30px 0' }}>Not enough days yet — check back after a few trading days.</div>;
  const w = 600, h = 120, pad = 8;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => [pad + i * step, h - pad - ((p - min) / range) * (h - pad * 2)]);
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const lineColor = last >= points[0] ? GREEN : RED;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 120, display: 'block' }} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={lineColor} strokeWidth={2} />
    </svg>
  );
}

function TodayPanel({ signals, trades, account, accountLoading }: ReturnType<typeof useStocksBot>) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySignals = signals.filter((s) => s.created_at.slice(0, 10) === today);
  const openTrades = trades.filter((t) => t.status === 'open');

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...cardStyle, minWidth: 160 }}>
          <div style={{ ...mono, fontSize: 26, fontWeight: 600, color: accountLoading ? 'var(--text-tertiary)' : pnlColor(account.dailyPl) }}>
            {accountLoading ? '—' : money(account.dailyPl)}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Net P&L today {accountLoading ? '' : `(${pct(account.dailyPlPct)})`}</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 160 }}>
          <div style={{ ...mono, fontSize: 26, fontWeight: 600, color: 'var(--text)' }}>{accountLoading ? '—' : money(account.equity)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Paper account equity</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 160 }}>
          <div style={{ ...mono, fontSize: 26, fontWeight: 600, color: 'var(--text)' }}>{account.positions.length}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Open positions</div>
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 24, marginBottom: 10 }}>Open positions</div>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {account.positions.map((p) => (
          <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.symbol}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{p.qty} sh · avg {money(p.avg_entry_price)} · now {money(p.current_price)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ ...mono, fontSize: 14, fontWeight: 600, color: pnlColor(p.unrealized_pl) }}>{money(p.unrealized_pl)}</div>
              <div style={{ fontSize: 12, color: pnlColor(p.unrealized_plpc) }}>{pct(p.unrealized_plpc)}</div>
            </div>
          </div>
        ))}
        {!accountLoading && account.positions.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No open positions right now.</div>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 24, marginBottom: 10 }}>
        Today's signals <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>— including blocked ones, so you can see why the bot did (or didn't) act</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {todaySignals.map((s) => <SignalRow key={s.id} signal={s} />)}
        {todaySignals.length === 0 && <div style={{ padding: 18, fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No signals yet today.</div>}
      </div>
      {openTrades.length === 0 && account.positions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>No trades open — the bot is watching the watchlist for a setup.</div>
      )}
    </div>
  );
}

function SignalRow({ signal }: { signal: BotSignal }) {
  const color = signal.signal_type === 'entry' ? GREEN : signal.signal_type === 'exit' ? GOLD : 'var(--text-tertiary)';
  const label = signal.signal_type === 'entry' ? 'Entered' : signal.signal_type === 'exit' ? 'Exited' : 'Blocked';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.4, minWidth: 56, marginTop: 2 }}>{label}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{signal.ticker === '*' ? 'Bot-wide' : signal.ticker}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{signal.reason}</div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(signal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  );
}

function PerformancePanel({ trades, dailySummaries }: ReturnType<typeof useStocksBot>) {
  const { assistantName } = useNovaPreferences();
  const closed = trades.filter((t) => t.status === 'closed' && t.pnl != null);
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => (t.pnl ?? 0) < 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : null;
  const avgWin = wins.length ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0;

  const equityPoints = useMemo(() => {
    const withEquity = dailySummaries.filter((d) => d.equity != null).slice().reverse();
    return withEquity.map((d) => d.equity as number);
  }, [dailySummaries]);

  const maxDrawdown = useMemo(() => {
    let peak = -Infinity, worst = 0;
    for (const e of equityPoints) {
      peak = Math.max(peak, e);
      if (peak > 0) worst = Math.min(worst, ((e - peak) / peak) * 100);
    }
    return worst;
  }, [equityPoints]);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Equity curve since start</div>
        <Sparkline points={equityPoints} />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{winRate == null ? '—' : `${winRate.toFixed(0)}%`}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Win rate</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>{closed.length}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Total closed trades</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 22, fontWeight: 600, color: GREEN }}>{money(avgWin)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Average win</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 22, fontWeight: 600, color: RED }}>{money(avgLoss)}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Average loss</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 22, fontWeight: 600, color: RED }}>{maxDrawdown.toFixed(1)}%</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Max drawdown</div>
        </div>
      </div>

      {dailySummaries[0]?.nova_commentary ? (
        <div style={{ ...cardStyle, marginTop: 16, borderColor: `${GOLD}44` }}>
          <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, marginBottom: 6 }}>{assistantName} · {dailySummaries[0].summary_date}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-quaternary-2)', lineHeight: 1.6 }}>{dailySummaries[0].nova_commentary}</div>
        </div>
      ) : dailySummaries[0] ? (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{assistantName} commentary — pending API key.</div>
        </div>
      ) : null}
    </div>
  );
}

function TradeLogPanel({ trades }: { trades: BotTrade[] }) {
  const [filter, setFilter] = useState('');
  const tickers = useMemo(() => [...new Set(trades.map((t) => t.ticker))].sort(), [trades]);
  const filtered = filter ? trades.filter((t) => t.ticker === filter) : trades;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={tabStyle(filter === '')} onClick={() => setFilter('')}>All</div>
        {tickers.map((t) => <div key={t} style={tabStyle(filter === t)} onClick={() => setFilter(t)}>{t}</div>)}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 60px 70px 90px 90px 90px 90px 1fr', gap: 8, padding: '10px 20px', background: 'var(--surface-4)', fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            <div>Ticker</div><div>Side</div><div>Qty</div><div>Entry</div><div>Exit</div><div>Stop</div><div>P&L</div><div>Opened</div>
          </div>
          {filtered.map((t) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '80px 60px 70px 90px 90px 90px 90px 1fr', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--surface-3)', background: 'var(--surface-2)', fontSize: 13, alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t.ticker}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{t.side}</div>
              <div style={mono}>{t.qty}</div>
              <div style={mono}>{t.entry_price != null ? money(t.entry_price) : '—'}</div>
              <div style={mono}>{t.exit_price != null ? money(t.exit_price) : '—'}</div>
              <div style={{ ...mono, color: 'var(--text-secondary)' }}>{t.stop_loss_price != null ? money(t.stop_loss_price) : '—'}</div>
              <div style={{ ...mono, color: t.pnl != null ? pnlColor(t.pnl) : 'var(--text-tertiary)' }}>{t.pnl != null ? money(t.pnl) : t.status === 'open' ? 'open' : '—'}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{new Date(t.opened_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 18, fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No trades yet.</div>}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel(bot: ReturnType<typeof useStocksBot>) {
  const { config, updateConfig, brokerStatus, saveBrokerKeys, savingKeys, keysError } = bot;
  const [watchlistInput, setWatchlistInput] = useState(config.watchlist.join(', '));
  const [apiKeyId, setApiKeyId] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const saveWatchlist = () => {
    const tickers = watchlistInput.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 5);
    setWatchlistInput(tickers.join(', '));
    updateConfig({ watchlist: tickers });
  };

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Broker keys — Alpaca (paper)</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {brokerStatus.connected ? `Connected · key ${brokerStatus.apiKeyIdMasked}` : 'Not connected yet.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inputStyle} placeholder="Paper API Key ID" value={apiKeyId} onChange={(e) => setApiKeyId(e.target.value)} />
          <input style={inputStyle} placeholder="Paper API Secret" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
          {keysError && <div style={{ fontSize: 12.5, color: RED }}>{keysError}</div>}
          <div
            style={{ ...pillButton('solid'), alignSelf: 'flex-start', opacity: savingKeys || !apiKeyId.trim() || !apiSecret.trim() ? 0.5 : 1, pointerEvents: savingKeys ? 'none' : 'auto' }}
            onClick={() => apiKeyId.trim() && apiSecret.trim() && saveBrokerKeys(apiKeyId.trim(), apiSecret.trim()).then(() => { setApiKeyId(''); setApiSecret(''); })}
          >
            {savingKeys ? 'Saving…' : 'Save keys'}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Watchlist <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(5 max)</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="SPY, QQQ, AAPL" value={watchlistInput} onChange={(e) => setWatchlistInput(e.target.value)} />
          <div style={pillButton('outline')} onClick={saveWatchlist}>Save</div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Risk rules <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(view only — hard limits, can't be loosened here)</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RISK_RULES.map((r, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-quaternary-2)', display: 'flex', gap: 8 }}>
              <span style={{ color: GOLD }}>·</span>{r}
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Strategy</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STRATEGY_PARAMS.map((r, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-quaternary-2)', display: 'flex', gap: 8 }}>
              <span style={{ color: GOLD }}>·</span>{r}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewsPanel({ account, accountLoading }: { account: ReturnType<typeof useStocksBot>['account']; accountLoading: boolean }) {
  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {account.news.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ ...cardStyle, display: 'block', textDecoration: 'none' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{n.headline}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {n.source} · {n.symbols.join(', ')} · {new Date(n.createdAt).toLocaleDateString()}
          </div>
        </a>
      ))}
      {!accountLoading && account.news.length === 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{account.connected ? 'No recent headlines for your watchlist.' : 'Connect your Alpaca keys to see market news for your watchlist.'}</div>
        </div>
      )}
    </div>
  );
}

type Tab = 'today' | 'performance' | 'log' | 'settings' | 'news';

export default function StocksScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const bot = useStocksBot();
  const [tab, setTab] = useState<Tab>('today');
  const { config, toggleEnabled } = bot;

  const halted = config.halted_date === new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div style={homeHeadStyle}>Stocks</div>
      <div style={homeSubStyle}>Paper-trading bot on Alpaca — watches the market, trades small, shows its work.</div>

      <div style={{ ...cardStyle, marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ padding: '5px 12px', borderRadius: 999, background: `${GOLD}22`, border: `1px solid ${GOLD}55`, color: GOLD, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5 }}>PAPER</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: config.enabled ? GREEN : 'var(--text-tertiary)' }} />
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{config.enabled ? 'Running' : 'Paused'}</div>
          </div>
          {halted && (
            <div style={{ padding: '5px 12px', borderRadius: 999, background: `${RED}22`, border: `1px solid ${RED}55`, color: RED, fontSize: 11.5, fontWeight: 700 }}>
              HALTED — {config.halted_reason}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Last run: {timeAgo(config.last_run_at)}</div>
        </div>
        <div style={pillButton(config.enabled ? 'outline' : 'solid', config.enabled)} onClick={toggleEnabled}>
          {config.enabled ? 'Kill switch — stop bot' : 'Turn bot ON'}
        </div>
      </div>

      <Walkthrough />

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        <div style={tabStyle(tab === 'today')} onClick={() => setTab('today')}>Today</div>
        <div style={tabStyle(tab === 'performance')} onClick={() => setTab('performance')}>Performance</div>
        <div style={tabStyle(tab === 'log')} onClick={() => setTab('log')}>Trade Log</div>
        <div style={tabStyle(tab === 'settings')} onClick={() => setTab('settings')}>Watchlist & Settings</div>
        <div style={tabStyle(tab === 'news')} onClick={() => setTab('news')}>News</div>
      </div>

      {tab === 'today' && <TodayPanel {...bot} />}
      {tab === 'performance' && <PerformancePanel {...bot} />}
      {tab === 'log' && <TradeLogPanel trades={bot.trades} />}
      {tab === 'settings' && <SettingsPanel {...bot} />}
      {tab === 'news' && <NewsPanel account={bot.account} accountLoading={bot.accountLoading} />}
    </div>
  );
}
