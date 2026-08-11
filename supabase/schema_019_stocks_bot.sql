-- Mastermind by MARQ — Phase 19 schema (Stocks: paper-trading bot on Alpaca).
-- Run once, after schema_018_streaming.sql, in the Supabase SQL editor.

-- Broker credentials. Deliberately has NO policies after RLS is enabled —
-- anon/authenticated keys get zero access (default deny), only the
-- service_role key (used server-side by the Netlify Functions, which has
-- BYPASSRLS on Supabase) can read or write this table. The client never
-- queries this table directly — it goes through save-broker-keys.ts /
-- broker-keys-status.ts, which never echo the secret back down.
create table if not exists bot_broker_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  api_key_id text not null,
  api_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table bot_broker_keys enable row level security;

-- Per-user bot configuration: watchlist, kill switch, halt state.
-- Risk rules themselves (position size, stop loss, daily loss limit, max
-- open positions) are hard-coded constants in the engine, not stored here —
-- v1 UI displays them read-only rather than letting them be loosened.
create table if not exists bot_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  watchlist text[] not null default array['SPY', 'QQQ'],
  enabled boolean not null default false,
  mode text not null default 'paper' check (mode in ('paper', 'live')),
  halted_date date,
  halted_reason text,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table bot_config enable row level security;
create policy "own rows" on bot_config for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every signal the engine evaluates, including ones it blocked — the audit
-- trail that lets the "Today" panel show *why* the bot did or didn't act.
create table if not exists bot_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker text not null,
  signal_type text not null check (signal_type in ('entry', 'exit', 'blocked')),
  reason text not null,
  acted_on boolean not null default false,
  created_at timestamptz not null default now()
);
alter table bot_signals enable row level security;
create policy "own rows" on bot_signals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists bot_signals_user_created_idx on bot_signals(user_id, created_at desc);

-- Every order the engine placed. entry_price/qty are set at fill time;
-- exit_price/pnl are filled in when a position closes (trend-exit sell or
-- the broker-side bracket stop loss firing).
create table if not exists bot_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker text not null,
  side text not null check (side in ('buy', 'sell')),
  qty numeric not null,
  entry_price numeric,
  exit_price numeric,
  stop_loss_price numeric,
  status text not null default 'open' check (status in ('open', 'closed')),
  pnl numeric,
  alpaca_order_id text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table bot_trades enable row level security;
create policy "own rows" on bot_trades for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists bot_trades_user_status_idx on bot_trades(user_id, status);

-- One row per trading day: realized P&L, win rate, and a positions
-- snapshot, plus Nova's 4:15pm ET commentary once the Anthropic key is
-- funded (null + pending until then).
create table if not exists bot_daily_summary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  summary_date date not null,
  equity numeric,
  net_pnl numeric not null default 0,
  win_rate numeric,
  trades_count integer not null default 0,
  open_positions_snapshot jsonb not null default '[]',
  nova_commentary text,
  created_at timestamptz not null default now(),
  unique (user_id, summary_date)
);
alter table bot_daily_summary enable row level security;
create policy "own rows" on bot_daily_summary for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
