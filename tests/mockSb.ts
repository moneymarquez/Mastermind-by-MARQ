// Minimal in-memory PostgREST (the same shape as tests/engine.test.ts's):
// table + eq/in/is/like/gte filters, enough for worker lifecycles.
export function mockSb(seed: Record<string, Record<string, unknown>[]>) {
  const db: Record<string, Record<string, unknown>[]> = JSON.parse(JSON.stringify(seed));
  let n = 0;
  const parse = (path: string) => { const [t, q = ''] = path.split('?'); const f = q.split('&').filter((p) => p && !/^(select|order|limit)=/.test(p)).map((p) => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)] as const; }); return { t, f }; };
  const val = (r: Record<string, unknown>, k: string) => { const m = k.match(/^(\w+)->>(\w+)$/); return m ? (r[m[1]] as Record<string, unknown> | undefined)?.[m[2]] : r[k]; };
  const match = (r: Record<string, unknown>, f: (readonly [string, string])[]) => f.every(([k, v]) => {
    const x = val(r, k);
    if (v.startsWith('eq.')) return String(x) === decodeURIComponent(v.slice(3));
    if (v.startsWith('neq.')) return String(x) !== v.slice(4);
    if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(x));
    if (v === 'is.null') return x == null;
    if (v === 'not.is.null') return x != null;
    if (v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$'); return re.test(String(x ?? '')); }
    if (v.startsWith('gte.')) return String(x ?? '') >= v.slice(4);
    if (v.startsWith('lt.')) return String(x ?? '') < v.slice(3);
    return true;
  });
  return {
    db,
    async get(path: string) { const { t, f } = parse(path); return (db[t] ?? []).filter((r) => match(r, f)); },
    async count(path: string) { const { t, f } = parse(path); return (db[t] ?? []).filter((r) => match(r, f)).length; },
    async insert(t: string, body: unknown) { const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: `id${++n}`, created_at: new Date().toISOString(), ...(r as object) })); (db[t] ??= []).push(...rows); return rows; },
    async patch(t: string, filter: string, body: object) { const { f } = parse(`${t}?${filter}`); for (const r of db[t] ?? []) if (match(r, f)) Object.assign(r, body); },
    async remove() {},
  };
}
