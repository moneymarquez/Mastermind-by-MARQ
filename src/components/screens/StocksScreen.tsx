import { useMemo, useState } from 'react';
import { emptyCopy } from '../../data/emptyCopy';
import type { CSSProperties } from 'react';
import Card from '../mm/Card';
import Chip from '../mm/Chip';
import Row from '../mm/Row';
import Stat from '../mm/Stat';
import { Line, Donut } from '../mm/charts';
import { Page, useModule, NovaMark } from '../mm/Page';
import { useStocksBot } from '../../data/useStocksBot';
import { splitWatchlist } from '../../data/tickers';
import type { BotTrade } from '../../data/types';
import { useNovaPreferences } from '../../data/useNovaPreferences';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const GOLD = 'var(--warning)';
const GREEN = 'var(--success)';
const RED = 'var(--danger)';

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const mono: CSSProperties = { fontFamily: 'var(--font-mono)' };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const tabStyle = (active: boolean): CSSProperties => ({
  padding: '9px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 600,
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, color: active ? 'var(--text)' : 'var(--text-tertiary)',
  background: active ? 'var(--tint-active)' : 'transparent', whiteSpace: 'nowrap',
});
const pillButton = (variant: 'solid' | 'outline', danger?: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer',
  background: variant === 'solid' ? (danger ? RED : 'var(--text)') : 'transparent',
  color: variant === 'solid' ? 'var(--bg)' : danger ? RED : 'var(--text)',
  border: variant === 'outline' ? `1px solid ${danger ? RED : 'var(--text)'}` : 'none',
});

// A broker answer missing a field (not connected yet, demo data) shows a
// dash instead of crashing the whole screen.
function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
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
        <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>How to run this bot</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' }}>{doneCount}/{WALKTHROUGH_STEPS.length} · {open ? 'Hide' : 'Show'}</div>
      </div>
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WALKTHROUGH_STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => toggle(i)}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: `1px solid ${checked[i] ? GOLD : 'var(--border-2)'}`, background: checked[i] ? GOLD : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-tiny)', color: 'var(--bg)', fontWeight: 700,
              }}>
                {checked[i] ? '✓' : ''}
              </div>
              <div style={{ fontSize: 'var(--text-body)', color: checked[i] ? 'var(--text-tertiary)' : 'var(--text-quaternary-2)', textDecoration: checked[i] ? 'line-through' : 'none', lineHeight: 1.5 }}>
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
  if (points.length < 2) return <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', padding: '30px 0' }}>Not enough days yet — check back after a few trading days.</div>;
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

function TodayPanel({ signals, account, accountLoading, dailySummaries }: ReturnType<typeof useStocksBot>) {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const today = new Date().toISOString().slice(0, 10);
  const todaySignals = signals.filter((s) => s.created_at.slice(0, 10) === today);
  const curve = [...dailySummaries].filter((d) => d.equity != null).sort((x, y) => x.summary_date.localeCompare(y.summary_date)).slice(-30);
  const first = curve[0]?.equity ?? null;
  const change = first != null && !accountLoading ? account.equity - first : null;
  const best = [...account.positions].sort((x, y) => y.unrealized_plpc - x.unrealized_plpc)[0];
  const worst = [...account.positions].sort((x, y) => x.unrealized_plpc - y.unrealized_plpc)[0];
  const latestNote = [...dailySummaries].sort((x, y) => y.summary_date.localeCompare(x.summary_date)).find((d) => d.nova_commentary);
  const dollars = Math.floor(Math.abs(account.equity));
  const hero = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Paper portfolio</span>
      <div style={{ display: 'flex', alignItems: 'baseline', color: 'var(--text)', fontSize: phone ? 40 : 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{accountLoading ? '—' : `$${dollars.toLocaleString('en-US')}`}{!accountLoading && <span style={{ fontSize: 22, color: 'var(--text-tertiary)' }}>.{String(Math.round(Math.abs(account.equity) * 100) % 100).padStart(2, '0')}</span>}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {change != null && <Chip k={change >= 0 ? 'good' : 'bad'}>{change >= 0 ? '↑' : '↓'} {money(Math.abs(change))}</Chip>}
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>{curve.length ? `since ${new Date(`${curve[0].summary_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Paper money · no real trades'}</span>
      </div>
      {curve.length >= 2 && <Line vals={curve.map((d) => Math.round(d.equity!))} labels={[new Date(`${curve[0].summary_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 'Today']} pts={curve.map((d) => d.summary_date)} pre="$" color="good" h={120} />}
    </section>
  );
  const stats = [
    <Stat key="t" label="Today" value={accountLoading ? '—' : money(account.dailyPl)} pill={accountLoading ? '' : pct(account.dailyPlPct)} k={account.dailyPl > 0 ? 'good' : account.dailyPl < 0 ? 'bad' : 'neutral'} />,
    <Stat key="b" label="Best" value={best?.symbol ?? '—'} pill={best ? pct(best.unrealized_plpc) : 'No positions'} k={best && best.unrealized_plpc > 0 ? 'good' : 'neutral'} />,
    <Stat key="w" label="Worst" value={worst && worst !== best ? worst.symbol : '—'} pill={worst && worst !== best ? pct(worst.unrealized_plpc) : '—'} k={worst && worst.unrealized_plpc < 0 ? 'bad' : 'neutral'} />,
    <Stat key="c" label="Cash" value={accountLoading ? '—' : money(account.cash)} pill="Paper money" />,
  ];
  const alloc = account.positions.length > 0 && <Card title="Allocation" meta={`${account.positions.length} holdings`} wide={!phone}><Donut rows={[...account.positions.map((p) => ({ name: p.symbol, value: Math.round(p.qty * p.current_price) })), { name: 'Cash', value: Math.round(account.cash) }].filter((x) => x.value > 0)} /></Card>;
  const signalsCard = (
    <Card title="Today's signals" meta="Including blocked ones" flush wide={!phone}>
      {todaySignals.length ? <div>{todaySignals.map((sg, i) => <Row key={sg.id} first={i === 0} name={sg.ticker === '*' ? 'Bot-wide' : sg.ticker} meta={new Date(sg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} chip={sg.signal_type === 'entry' ? 'Entered' : sg.signal_type === 'exit' ? 'Exited' : 'Blocked'} k={sg.signal_type === 'entry' ? 'good' : sg.signal_type === 'exit' ? 'warn' : 'neutral'} note={sg.reason} />)}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>{emptyCopy('noSignalsToday')}</div>}
    </Card>
  );
  const note = latestNote && <Card title="Commentary" meta={latestNote.summary_date} wide={!phone}><NovaMark /><p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{latestNote.nova_commentary}</p><span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Practice only. Not financial advice.</span></Card>;
  const positions = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px' }}><span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Positions</span><span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-tertiary)' }}>Paper trading · no real money</span></div>
      {[...account.positions.map((p) => ({ k: p.symbol, cells: [p.symbol, String(p.qty), money(p.current_price), pct(p.unrealized_plpc), money(p.qty * p.current_price)], up: p.unrealized_plpc >= 0 })), { k: 'cash', cells: ['Cash', '—', '—', 'Available', money(account.cash)], up: null }].map((r, i) => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: phone ? '70px 1fr 90px' : '90px 70px 100px 110px minmax(0,1fr)', gap: 12, alignItems: 'center', minHeight: 48, padding: '0 20px', borderTop: '1px solid var(--grid)', background: i === 0 ? undefined : undefined, fontSize: 14 }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{r.cells[0]}</span>
          {!phone && <span style={{ color: 'var(--text-secondary)' }}>{r.cells[1]}</span>}
          {!phone && <span style={{ color: 'var(--text-secondary)' }}>{r.cells[2]}</span>}
          <span>{r.up == null ? <Chip k="neutral">{r.cells[3]}</Chip> : <Chip k={r.up ? 'good' : 'bad'}>{r.cells[3]}</Chip>}</span>
          <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{r.cells[4]}</span>
        </div>
      ))}
      {!accountLoading && !account.connected && <div style={{ padding: '12px 20px', borderTop: '1px solid var(--grid)', fontSize: 13.5, color: 'var(--text-secondary)' }}>No broker connected yet. Add paper keys under Watchlist & settings.</div>}
    </section>
  );
  return phone ? <>{hero}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats[0]}{stats[3]}</div>{positions}{alloc}{note}{signalsCard}</> : (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? 'minmax(0,1.35fr) minmax(0,1fr)' : 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16 }}>{hero}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>{stats}</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' && !novaOpen ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>{alloc}{note}<div style={{ gridColumn: alloc && note && !(device === 'desktop' && !novaOpen) ? '1 / -1' : 'auto' }}>{signalsCard}</div></div>
      {positions}
    </>
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
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Equity curve since start</div>
        <Sparkline points={equityPoints} />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 'var(--text-stat)', fontWeight: 600, color: 'var(--text)' }}>{winRate == null ? '—' : `${winRate.toFixed(0)}%`}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>Win rate</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 'var(--text-stat)', fontWeight: 600, color: 'var(--text)' }}>{closed.length}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>Total closed trades</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 'var(--text-stat)', fontWeight: 600, color: GREEN }}>{money(avgWin)}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>Average win</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 'var(--text-stat)', fontWeight: 600, color: RED }}>{money(avgLoss)}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>Average loss</div>
        </div>
        <div style={{ ...cardStyle, minWidth: 140 }}>
          <div style={{ ...mono, fontSize: 'var(--text-stat)', fontWeight: 600, color: RED }}>{maxDrawdown.toFixed(1)}%</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>Max drawdown</div>
        </div>
      </div>

      {dailySummaries[0]?.nova_commentary ? (
        <div style={{ ...cardStyle, marginTop: 16, borderColor: `${GOLD}44` }}>
          <div style={{ fontSize: 'var(--text-small)', color: GOLD, fontWeight: 600, marginBottom: 6 }}>{assistantName} · {dailySummaries[0].summary_date}</div>
          <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary-2)', lineHeight: 1.6 }}>{dailySummaries[0].nova_commentary}</div>
        </div>
      ) : dailySummaries[0] ? (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>{assistantName} commentary — pending API key.</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', minWidth: 560 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 60px 70px 90px 90px 90px 90px 1fr', gap: 8, padding: '10px 20px', background: 'var(--surface-4)', fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            <div>Ticker</div><div>Side</div><div>Qty</div><div>Entry</div><div>Exit</div><div>Stop</div><div>P&L</div><div>Opened</div>
          </div>
          {filtered.map((t) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '80px 60px 70px 90px 90px 90px 90px 1fr', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--surface-3)', background: 'var(--surface-2)', fontSize: 'var(--text-body)', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t.ticker}</div>
              <div style={{ color: 'var(--text-secondary)' }}>{t.side}</div>
              <div style={mono}>{t.qty}</div>
              <div style={mono}>{t.entry_price != null ? money(t.entry_price) : '—'}</div>
              <div style={mono}>{t.exit_price != null ? money(t.exit_price) : '—'}</div>
              <div style={{ ...mono, color: 'var(--text-secondary)' }}>{t.stop_loss_price != null ? money(t.stop_loss_price) : '—'}</div>
              <div style={{ ...mono, color: t.pnl != null ? pnlColor(t.pnl) : 'var(--text-tertiary)' }}>{t.pnl != null ? money(t.pnl) : t.status === 'open' ? 'open' : '—'}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-small)' }}>{new Date(t.opened_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 18, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No trades yet.</div>}
        </div>
      </div>
    </div>
  );
}

function SettingsPanel(bot: ReturnType<typeof useStocksBot>) {
  const { config, updateConfig, brokerStatus, saveBrokerKeys, savingKeys, keysError } = bot;
  const [watchlistInput, setWatchlistInput] = useState(config.watchlist.join(', '));
  const [watchlistError, setWatchlistError] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const saveWatchlist = () => {
    // Stocks and ETFs only — the paper account can't trade gold or crypto,
    // and one such entry used to break every run for the whole list.
    const { valid, rejected } = splitWatchlist(watchlistInput.split(','));
    const tickers = valid.slice(0, 5);
    setWatchlistInput(tickers.join(', '));
    setWatchlistError(rejected.length ? `Not stock symbols, left out: ${rejected.join(', ')}. This bot trades US stocks and ETFs only (e.g. SPY, QQQ, AAPL).` : '');
    updateConfig({ watchlist: tickers });
  };

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Broker keys — Alpaca (paper)</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
          {brokerStatus.connected ? `Connected · key ${brokerStatus.apiKeyIdMasked}` : 'Not connected yet.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inputStyle} placeholder="Paper API Key ID" value={apiKeyId} onChange={(e) => setApiKeyId(e.target.value)} />
          <input style={inputStyle} placeholder="Paper API Secret" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
          {keysError && <div style={{ fontSize: 'var(--text-body-sm)', color: RED }}>{keysError}</div>}
          <div
            style={{ ...pillButton('solid'), alignSelf: 'flex-start', opacity: savingKeys || !apiKeyId.trim() || !apiSecret.trim() ? 0.5 : 1, pointerEvents: savingKeys ? 'none' : 'auto' }}
            onClick={() => apiKeyId.trim() && apiSecret.trim() && saveBrokerKeys(apiKeyId.trim(), apiSecret.trim()).then(() => { setApiKeyId(''); setApiSecret(''); })}
          >
            {savingKeys ? 'Saving…' : 'Save keys'}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>Watchlist <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(5 max)</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="SPY, QQQ, AAPL" value={watchlistInput} onChange={(e) => setWatchlistInput(e.target.value)} />
          <div style={pillButton('outline')} onClick={saveWatchlist}>Save</div>
        </div>
        {watchlistError && <div style={{ fontSize: 'var(--text-body-sm)', color: RED, marginTop: 8 }}>{watchlistError}</div>}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Risk rules <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(view only — hard limits, can't be loosened here)</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RISK_RULES.map((r, i) => (
            <div key={i} style={{ fontSize: 'var(--text-body)', color: 'var(--text-quaternary-2)', display: 'flex', gap: 8 }}>
              <span style={{ color: GOLD }}>·</span>{r}
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Strategy</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STRATEGY_PARAMS.map((r, i) => (
            <div key={i} style={{ fontSize: 'var(--text-body)', color: 'var(--text-quaternary-2)', display: 'flex', gap: 8 }}>
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
          <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{n.headline}</div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 6 }}>
            {n.source} · {n.symbols.join(', ')} · {new Date(n.createdAt).toLocaleDateString()}
          </div>
        </a>
      ))}
      {!accountLoading && account.news.length === 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-tertiary)' }}>{account.connected ? 'No recent headlines for your watchlist.' : 'Connect your Alpaca keys to see market news for your watchlist.'}</div>
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

  void homeHeadStyle; void homeSubStyle;
  return (
    <Page title="Stocks" sub="Paper-trading bot on Alpaca · not financial advice" right={{ t: config.enabled ? 'Stop bot' : 'Turn bot on', onClick: () => void toggleEnabled() }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip k="warn">Paper</Chip>
        <Chip k={config.enabled ? 'live' : 'neutral'}>{config.enabled ? 'Running' : 'Paused'}</Chip>
        {halted && <Chip k="bad">{`Halted: ${config.halted_reason}`}</Chip>}
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Last run {timeAgo(config.last_run_at)}</span>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)', overflowX: 'auto', maxWidth: '100%', alignSelf: 'flex-start' }}>
        {([['today', 'Today'], ['performance', 'Performance'], ['log', 'Trade log'], ['settings', 'Watchlist & settings'], ['news', 'News']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)} style={{ padding: '7px 14px', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', background: tab === k ? 'var(--text)' : 'transparent', color: tab === k ? 'var(--bg)' : 'var(--text-secondary)' }}>{l}</button>
        ))}
      </div>
      {tab === 'today' && <TodayPanel {...bot} />}
      {tab === 'performance' && <PerformancePanel {...bot} />}
      {tab === 'log' && <TradeLogPanel trades={bot.trades} />}
      {tab === 'settings' && <><Walkthrough /><SettingsPanel {...bot} /></>}
      {tab === 'news' && <NewsPanel account={bot.account} accountLoading={bot.accountLoading} />}
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Paper trading only. Practice, not financial advice.</span>
    </Page>
  );
}
