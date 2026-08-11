import type { Config, Context } from '@netlify/functions';
import { getBrokerKeys, fetchAccount, fetchPositions, fetchNews } from './lib/alpaca';

// Client-facing read of live Alpaca state — the Today/Performance panels
// call this rather than talking to Alpaca directly, since the API keys
// never leave the server (see save-broker-keys.ts / schema_019).
export default async (req: Request, _context: Context) => {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth token' }), { status: 401 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  }

  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });
  if (!authRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const user = (await authRes.json()) as { id: string };

  const keys = await getBrokerKeys(supabaseUrl, serviceRoleKey, user.id);
  if (!keys) {
    return new Response(JSON.stringify({ connected: false, equity: 0, cash: 0, dailyPl: 0, dailyPlPct: 0, positions: [], news: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  const configRes = await fetch(`${supabaseUrl}/rest/v1/bot_config?user_id=eq.${user.id}&select=watchlist`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const configRows = (await configRes.json()) as { watchlist: string[] }[];
  const watchlist = configRows[0]?.watchlist ?? ['SPY', 'QQQ'];

  try {
    const [account, positions, news] = await Promise.all([fetchAccount(keys), fetchPositions(keys), fetchNews(keys, watchlist)]);
    const equity = Number(account.equity);
    const lastEquity = Number(account.last_equity) || equity;
    const dailyPl = equity - lastEquity;

    return new Response(
      JSON.stringify({
        connected: true,
        equity,
        cash: Number(account.cash),
        dailyPl,
        dailyPlPct: lastEquity ? (dailyPl / lastEquity) * 100 : 0,
        positions: positions.map((p) => ({
          symbol: p.symbol,
          qty: Number(p.qty),
          avg_entry_price: Number(p.avg_entry_price),
          current_price: Number(p.current_price),
          unrealized_pl: Number(p.unrealized_pl),
          unrealized_plpc: Number(p.unrealized_plpc) * 100,
        })),
        news: news.map((n) => ({ headline: n.headline, source: n.source, url: n.url, symbols: n.symbols, createdAt: n.created_at })),
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  } catch (err) {
    console.error('stocks-account: Alpaca fetch failed', err);
    return new Response(JSON.stringify({ error: 'Could not reach Alpaca — check your API keys.' }), { status: 502 });
  }
};

export const config: Config = {
  path: '/api/stocks-account',
};
