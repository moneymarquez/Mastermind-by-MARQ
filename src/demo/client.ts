// The demo stand-in for supabase-js (13-demo-mode-spec §1): same call
// shapes the app uses, answered from an in-memory copy of the seed. Writes
// land in memory only — nothing here can reach the real database, because
// there is no network code in this file at all. Reset on every demo start.
import { buildSeed, DEMO_USER } from './seed';
import { getDemo } from './state';
import { JAMES_TEAM } from './seed';

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

let db: Record<string, Row[]> = {};
let n = 0;
const id = () => `d0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
export function resetDemoDb(): void { db = buildSeed(); n = 0; }
/** Read-only peek at the in-memory demo tables (for /api answers). */
export function demoRows(table: string): Record<string, unknown>[] { return (db[table] ?? []) as Record<string, unknown>[]; }

function cmp(r: Row, col: string, op: string, v: unknown): boolean {
  if (col.includes('->')) {
    // JSON path filters (detail->analysis): look one level down.
    const [base, key] = col.split('->');
    const inner = (r[base] as Row | null | undefined)?.[key.replace(/>/g, '')];
    return op === 'is' ? (v === null ? inner == null : inner === v) : true;
  }
  const x = r[col];
  switch (op) {
    case 'eq': return String(x) === String(v);
    case 'neq': return String(x) !== String(v);
    case 'gt': return (x as number) > (v as number);
    case 'gte': return (x as string) >= (v as string);
    case 'lt': return (x as number) < (v as number);
    case 'lte': return (x as string) <= (v as string);
    case 'in': return (v as unknown[]).map(String).includes(String(x));
    case 'is': return v === null ? x == null : x === v;
    case 'ilike': case 'like': return new RegExp('^' + String(v).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$', 'i').test(String(x ?? ''));
    case 'contains': return Array.isArray(x) && (v as unknown[]).every((y) => (x as unknown[]).includes(y));
    default: return true;
  }
}

function builder(table: string) {
  const f: Filter[] = [];
  let op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  let payload: Row | Row[] | null = null;
  let single = 0; let lim = 0; let off = 0; let head = false; let wantCount = false;
  const ord: [string, boolean][] = [];
  let conflict: string[] | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {};
  const chain = (name: string, fn?: (...a: never[]) => void) => { b[name] = (...a: never[]) => { fn?.(...a); return b; }; };
  chain('select', ((_c: string, o?: { head?: boolean; count?: string }) => { if (o?.head) head = true; if (o?.count) wantCount = true; }) as never);
  for (const o of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'ilike', 'like', 'contains']) chain(o, ((c: string, v: unknown) => f.push((r) => cmp(r, c, o, v))) as never);
  chain('not', ((c: string, o: string, v: unknown) => f.push((r) => !cmp(r, c, o, v))) as never);
  chain('match', ((m: Row) => Object.entries(m).forEach(([k, v]) => f.push((r) => String(r[k]) === String(v)))) as never);
  chain('filter', ((c: string, o: string, v: unknown) => f.push((r) => cmp(r, c, o, v))) as never);
  for (const o of ['or', 'containedBy', 'overlaps', 'textSearch', 'returns', 'abortSignal', 'throwOnError', 'csv', 'explain', 'maybeSingleOr']) chain(o);
  chain('order', ((c: string, o?: { ascending?: boolean }) => ord.push([c, o?.ascending !== false])) as never);
  chain('limit', ((l: number) => { lim = l; }) as never);
  chain('range', ((a: number, z: number) => { off = a; lim = z - a + 1; }) as never);
  chain('insert', ((p: Row | Row[]) => { op = 'insert'; payload = p; }) as never);
  chain('upsert', ((p: Row | Row[], o?: { onConflict?: string }) => { op = 'upsert'; payload = p; conflict = o?.onConflict?.split(',').map((s) => s.trim()) ?? null; }) as never);
  chain('update', ((p: Row) => { op = 'update'; payload = p; }) as never);
  chain('delete', () => { op = 'delete'; });
  b.single = () => { single = 1; return b; };
  b.maybeSingle = () => { single = 2; return b; };

  const run = () => {
    const rows = (db[table] ??= []);
    const now = new Date().toISOString();
    let out: Row[];
    if (op === 'insert' || op === 'upsert') {
      const list: Row[] = (Array.isArray(payload) ? payload : [payload ?? {}]).map((p) => ({ id: id(), user_id: DEMO_USER.id, created_at: now, updated_at: now, ...p }));
      for (const p of list) {
        const hit = conflict ? rows.find((r) => conflict!.every((c) => r[c] === p[c])) : null;
        if (hit && op === 'upsert') Object.assign(hit, p); else rows.push(p);
      }
      out = list;
    } else {
      out = rows.filter((r) => f.every((fn) => fn(r)));
      if (op === 'update') out.forEach((r) => Object.assign(r, payload, { updated_at: now }));
      if (op === 'delete') db[table] = rows.filter((r) => !out.includes(r));
      for (const [c, asc] of [...ord].reverse()) out = [...out].sort((a, z) => ((a[c] ?? '') > (z[c] ?? '') ? 1 : (a[c] ?? '') < (z[c] ?? '') ? -1 : 0) * (asc ? 1 : -1));
      if (off) out = out.slice(off);
      if (lim) out = out.slice(0, lim);
    }
    const copy = JSON.parse(JSON.stringify(out)) as Row[];
    if (single === 1) return copy.length >= 1 && (copy.length === 1 || op !== 'select') ? { data: copy[0], error: null } : { data: null, error: { message: 'No rows', code: 'PGRST116' } };
    if (single === 2) return { data: copy[0] ?? null, error: null };
    return { data: head ? null : copy, error: null, count: wantCount || head ? copy.length : null };
  };
  b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve().then(run).then(ok, bad);
  return b;
}

// ── Realtime: the Office's envelopes ride on ai_worker_runs INSERTs ────
type Handler = (payload: { eventType: string; new: Row; old: Row }) => void;
const channels = new Set<{ handlers: { table?: string; cb: Handler }[] }>();
let ticker: ReturnType<typeof setInterval> | null = null;
function startTicker() {
  if (ticker) return;
  let i = 0;
  ticker = setInterval(() => {
    const workers = (db.ai_workers ?? []).filter((w) => w.domain === 'ecom' && w.enabled !== false);
    if (!workers.length) return;
    const w = workers[i++ % workers.length];
    const run: Row = { id: id(), worker_id: w.id, domain: 'ecom', status: 'running', input: {}, output: {}, summary: null, error: null, cost_usd: 0, tokens_in: 0, tokens_out: 0, trigger: 'cron', instructions: null, started_at: new Date().toISOString(), finished_at: null, created_at: new Date().toISOString() };
    for (const ch of channels) for (const h of ch.handlers) if (h.table === 'ai_worker_runs') h.cb({ eventType: 'INSERT', new: run, old: {} });
  }, 2600);
}
export function stopDemoTicker(): void { if (ticker) clearInterval(ticker); ticker = null; channels.clear(); }

function channel() {
  const ch = { handlers: [] as { table?: string; cb: Handler }[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api: any = {
    on: (_e: string, filter: { table?: string }, cb: Handler) => { ch.handlers.push({ table: filter?.table, cb }); return api; },
    subscribe: (cb?: (s: string) => void) => { channels.add(ch); startTicker(); cb?.('SUBSCRIBED'); return api; },
    unsubscribe: () => { channels.delete(ch); return Promise.resolve('ok'); },
    send: () => Promise.resolve('ok'),
  };
  return api;
}

const PLACEHOLDER = '/demo/placeholder.svg';
const storage = (bucket: string) => ({
  upload: async (path: string) => ({ data: { path }, error: null }),
  remove: async () => ({ data: [], error: null }),
  list: async () => ({ data: [], error: null }),
  createSignedUrl: async (p: string) => ({ data: { signedUrl: p.startsWith('/') ? p : PLACEHOLDER }, error: null }),
  createSignedUrls: async (ps: string[]) => ({ data: ps.map((p) => ({ path: p, signedUrl: p.startsWith('/') ? p : PLACEHOLDER, error: null })), error: null }),
  getPublicUrl: (p: string) => ({ data: { publicUrl: p.startsWith('/') ? p : PLACEHOLDER } }),
  download: async () => ({ data: new Blob([bucket]), error: null }),
});

const session = { access_token: 'demo', refresh_token: 'demo', expires_at: 4102444800, token_type: 'bearer', user: { id: DEMO_USER.id, email: DEMO_USER.email, user_metadata: { full_name: DEMO_USER.name }, app_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } };
const rpcData: Record<string, unknown> = { is_comped: true, is_owner: true, list_comp_codes: [], list_comped_users: [], list_client_logins: [], client_brief_summary: null, my_client_id: null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const demoClient: any = {
  from: builder,
  rpc: (name: string) => {
    // Explore mode shows the member side too: Marq is also on James's crew.
    const data = name === 'dispatch_my_teams' ? (getDemo().tour ? [] : [{ member_id: JAMES_TEAM.memberId, owner_id: JAMES_TEAM.ownerId, owner_name: 'James', role: 'member' }]) : rpcData[name] ?? null;
    const p: Promise<unknown> & { single?: () => unknown; maybeSingle?: () => unknown } = Promise.resolve({ data, error: null }); p.single = () => p; p.maybeSingle = () => p; return p; },
  channel, removeChannel: () => Promise.resolve('ok'), removeAllChannels: () => Promise.resolve([]), getChannels: () => [],
  storage: { from: storage },
  functions: { invoke: async () => ({ data: null, error: { message: 'Not available in the demo.' } }) },
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: session.user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { session, user: session.user }, error: null }),
    signUp: async () => ({ data: { session: null, user: null }, error: { message: 'Sign up from the real app, not the demo.' } }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: { user: session.user }, error: null }),
    refreshSession: async () => ({ data: { session }, error: null }),
  },
};
export const demoSession = session;
