// /api/archive/* — Settings → Fresh start and Settings → Archive (owner only).
//   GET  preview        exact counts of what a fresh start would archive
//   POST fresh-start    archive all of it under one batch id
//   GET  list?batch=&q= archived items (newest batch first), searchable
//   POST restore        { batch } or { table, id } or { table: 'leads', place_ids }
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { ARCHIVE_RULES, ruleFor, batchId, scoped, archivePatch, restorePatch, notIn } from '../lib/archive';

export type ArchiveEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string };

async function linkedProductIds(sb: Sb): Promise<string[]> {
  const rows = await sb.get<{ product_id: string | null }>('ecom_brand_products?select=product_id&limit=1000').catch(() => []);
  return [...new Set(rows.map((r) => r.product_id).filter((x): x is string => !!x))];
}

async function preview(sb: Sb, userId: string): Promise<Record<string, number>> {
  const keep = notIn(await linkedProductIds(sb));
  const out: Record<string, number> = {};
  await Promise.all(ARCHIVE_RULES.map(async (r) => {
    out[r.table] = await sb.count(`${r.table}?${scoped(r, userId, r.active)}${r.table === 'ecom_products' ? keep : ''}`).catch(() => 0);
  }));
  return out;
}

export async function archiveRoute(request: Request, env: ArchiveEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  const sb = new Sb(env);
  const uid = user.id;
  const url = new URL(request.url);

  if (path === 'preview') return json({ counts: await preview(sb, uid) });

  if (path === 'fresh-start' && request.method === 'POST') {
    const counts = await preview(sb, uid);
    const taken = (await sb.get<{ id: string }>(`archive_batches?user_id=eq.${uid}&select=id`)).map((b) => b.id);
    const batch = batchId(new Date(), taken);
    const at = new Date().toISOString();
    const keep = notIn(await linkedProductIds(sb));
    // Batch row first, so a half-finished run can still be restored by its id.
    await sb.insert('archive_batches', { id: batch, user_id: uid, label: 'Fresh start', counts });
    for (const r of ARCHIVE_RULES) {
      await sb.patch(r.table, `${scoped(r, uid, r.active)}${r.table === 'ecom_products' ? keep : ''}`, archivePatch(r, batch, at));
    }
    return json({ ok: true, batch, counts });
  }

  if (path === 'list') {
    const batch = url.searchParams.get('batch');
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
    const batches = await sb.get<{ id: string; created_at: string; label: string | null; counts: Record<string, number> }>(`archive_batches?user_id=eq.${uid}&order=created_at.desc&select=id,created_at,label,counts`);
    const items: { table: string; id: string; name: string; sub: string; batch: string | null; archived_at: string }[] = [];
    await Promise.all(ARCHIVE_RULES.map(async (r) => {
      const f = [`archived_at=not.is.null`, batch ? `archive_batch=eq.${encodeURIComponent(batch)}` : '', q ? `${r.nameCol}=ilike.*${encodeURIComponent(q.replace(/[*,()]/g, ' '))}*` : ''].filter(Boolean).join('&');
      const rows = await sb.get<Record<string, unknown>>(`${r.table}?${scoped(r, uid, f)}&order=archived_at.desc&limit=200&select=id,${r.nameCol},${r.subCols},archive_batch,archived_at`).catch(() => []);
      for (const row of rows) items.push({ table: r.table, id: String(row.id), name: String(row[r.nameCol] ?? '').slice(0, 160), sub: r.subCols.split(',').map((c) => row[c]).filter((v) => v != null && v !== '').join(' · ').slice(0, 160), batch: (row.archive_batch as string | null) ?? null, archived_at: String(row.archived_at) });
    }));
    return json({ batches, items, labels: Object.fromEntries(ARCHIVE_RULES.map((r) => [r.table, r.label])) });
  }

  if (path === 'restore' && request.method === 'POST') {
    const b = (await request.json().catch(() => ({}))) as { batch?: string; table?: string; id?: string; place_ids?: string[] };
    if (typeof b.batch === 'string' && /^[a-z0-9-]{4,60}$/.test(b.batch)) {
      for (const r of ARCHIVE_RULES) await sb.patch(r.table, scoped(r, uid, `archive_batch=eq.${b.batch}`), restorePatch(r));
      return json({ ok: true, restored: 'batch' });
    }
    const r = ruleFor(String(b.table ?? ''));
    if (!r) return json({ error: 'Unknown table.' }, 400);
    if (r.table === 'leads' && Array.isArray(b.place_ids) && b.place_ids.length) {
      const ids = b.place_ids.filter((p) => typeof p === 'string' && /^[A-Za-z0-9_:-]{4,200}$/.test(p)).slice(0, 200);
      await sb.patch('leads', `place_id=in.(${ids.map((p) => `"${p}"`).join(',')})&archived_at=not.is.null`, restorePatch(r));
      return json({ ok: true, restored: ids.length });
    }
    if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.id)) return json({ error: 'id is required.' }, 400);
    await sb.patch(r.table, scoped(r, uid, `id=eq.${b.id}`), restorePatch(r));
    return json({ ok: true, restored: 1 });
  }
  return json({ error: `Unknown archive route: ${path}` }, 404);
}
