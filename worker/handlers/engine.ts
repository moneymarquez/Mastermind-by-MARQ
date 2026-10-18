// /api/engine/* — the shared worker engine's HTTP surface. Runs are
// synchronous from the caller's point of view ("Run now" waits for the
// answer); the overnight plan runs from the */5 cron (lib/orchestrator.ts).
import { requireMember } from '../lib/member';
import { json, zonedNow, Sb } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { spentToday, capFor } from '../lib/ai';
import { ensureRoster, RUNNERS, decide, ENGINE_DOMAINS, TZ, runWorker, importScoutRows } from '../lib/engine';
import { enrichRow } from '../lib/enrich';
import { cardView } from '../../src/data/ecomCard';
import type { ImportRow } from '../../src/data/ecomProducts';
import { nextDailyStep, planFor } from '../lib/orchestrator';
import { runPublisher, requeue } from '../lib/publisher';
import type { PublishEnv } from '../lib/publisher';
import { runLauncher } from '../lib/launcher';
import { rejectPitch, runProductPitch, testProduct } from '../lib/ecomOctober';
import type { Venture, ScriptChannel } from '../../src/data/mktEngine';
import type { Channel } from '../../src/data/ecom';
import { PLAYBOOK_MAX_CHARS } from '../../src/data/ecom';

export interface EngineEnv extends SbEnv, PublishEnv { ANTHROPIC_API_KEY?: string }
export interface WaitCtx { waitUntil: (p: Promise<unknown>) => void }
const CHANNELS: Channel[] = ['tiktok', 'amazon', 'meta', 'etsy', 'walmart', 'rising'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VENTURES: Venture[] = ['madebymarq', 'mastermind', 'client'];
const SCRIPT_CHANNELS: ScriptChannel[] = ['call', 'voicemail', 'email', 'dm', 'landing'];

async function body<T>(request: Request): Promise<T | null> { try { return (await request.json()) as T; } catch { return null; } }

async function clearPending(sb: Sb, u: string, id: string): Promise<Record<string, unknown>> {
  const [a] = await sb.get<{ payload: Record<string, unknown> }>(`ai_approvals?id=eq.${id}&user_id=eq.${u}&select=payload`);
  return { ...(a?.payload ?? {}), pending_enrich: false };
}

/** Supplier Finder + Analyst for one find (approval) or one sheet product, as a tracked worker run. */
async function enrichOne(env: SbEnv & { ANTHROPIC_API_KEY?: string }, sb: Sb, userId: string, kind: 'approval' | 'product', id: string) {
  return runWorker(env.ANTHROPIC_API_KEY, sb, userId, {
    key: 'analyst', task: 'Finding the missing numbers', input: { id }, trigger: 'manual', entityType: kind, entityId: id,
    async execute(ctx) {
      if (kind === 'approval') {
        const [a] = await sb.get<{ payload: { row?: ImportRow }; status: string }>(`ai_approvals?id=eq.${id}&user_id=eq.${userId}&select=payload,status`);
        if (!a?.payload?.row || a.status !== 'pending') throw new Error('That find is no longer waiting for approval.');
        const row = await enrichRow(ctx, sb, a.payload.row);
        const v = cardView({ ...row, source_url: row.source_url ?? null } as never);
        await sb.patch('ai_approvals', `id=eq.${id}&user_id=eq.${userId}`, { payload: { ...a.payload, row, verdict: v.verdict, summary: v.verdictWhy, pending_enrich: false }, updated_at: new Date().toISOString() });
        return { summary: `${row.name}: ${v.missing.length ? `${v.missing.length} still not found` : 'all numbers found'}`, count: 1 };
      }
      const [p] = await sb.get<Record<string, unknown>>(`ecom_products?id=eq.${id}&user_id=eq.${userId}&select=*`);
      if (!p) throw new Error('That product is no longer in the sheet.');
      const row = await enrichRow(ctx, sb, { ...(p as unknown as ImportRow), detail: (p.detail ?? {}) as ImportRow['detail'] });
      await sb.patch('ecom_products', `id=eq.${id}&user_id=eq.${userId}`, { sell_price: row.sell_price, supplier_cost: row.supplier_cost, landed_cost: row.landed_cost, margin_pct: row.margin_pct, score: row.score, days_trending: row.days_trending, velocity: row.velocity, content_difficulty: row.content_difficulty, images: row.images, detail: row.detail, updated_at: new Date().toISOString() });
      const v = cardView({ ...row, source_url: row.source_url ?? null } as never);
      return { summary: `${row.name}: ${v.missing.length ? `${v.missing.length} still not found` : 'all numbers found'}`, count: 1 };
    },
  });
}

export async function engineRoute(request: Request, env: EngineEnv, path: string, ctx?: WaitCtx): Promise<Response> {
  // Members only (bug inventory B-02): every route here can spend.
  const m = await requireMember(request, env);
  if (m instanceof Response) return m;
  const { user, sb } = m;
  try {
    if (path === 'start') {
      const workers = await ensureRoster(sb, user.id);
      return json({ workers, anthropic: !!env.ANTHROPIC_API_KEY });
    }
    if (path === 'status') {
      const date = zonedNow(TZ).date;
      const workers = await sb.get(`ai_workers?user_id=eq.${user.id}&order=domain.asc&select=*`);
      const spend = await Promise.all(ENGINE_DOMAINS.map(async (d) => ({ domain: d, spent: await spentToday(sb, user.id, d, date), cap: await capFor(sb, user.id, d) })));
      return json({ workers, spend, anthropic: !!env.ANTHROPIC_API_KEY, date });
    }
    if (path === 'run') {
      const b = await body<{ worker?: string; channel?: string; count?: number; product_id?: string; venture?: string; script_channel?: string; all?: boolean; account_id?: string; clip_id?: string; brand_id?: string; instructions?: string }>(request);
      // The two workers that act rather than draft: no Claude, no approval card.
      if (b?.worker === 'publisher') return json((await runPublisher(env, sb, user.id, { trigger: 'manual' })) ?? { ok: true, skipped: true, summary: 'Nothing is due to post right now.' });
      if (b?.worker === 'launcher') {
        if (!UUID.test(b.brand_id ?? '')) return json({ ok: false, error: 'Pick a brand.' }, 400);
        const [build] = await sb.get<{ id: string }>(`ecom_store_builds?user_id=eq.${user.id}&brand_id=eq.${b.brand_id}&status=in.(preview,merged)&html=not.is.null&order=updated_at.desc&limit=1&select=id`);
        if (!build) return json({ ok: false, error: 'This brand has no approved store page yet. Run Store Builder and approve its page first.' }, 400);
        const r = await runLauncher(env, sb, user.id, { buildId: build.id, trigger: 'manual' });
        return json(r, r.ok ? 200 : 502);
      }
      const runner = b?.worker ? RUNNERS[b.worker] : undefined;
      if (!b || !runner) return json({ error: `${b?.worker ?? 'That worker'} doesn't run yet in this build.` }, 400);
      const r = await runner(env.ANTHROPIC_API_KEY, sb, user.id, {
        channel: CHANNELS.includes(b.channel as Channel) ? (b.channel as Channel) : 'tiktok', count: b.count, productId: b.product_id,
        venture: VENTURES.includes(b.venture as Venture) ? (b.venture as Venture) : undefined,
        scriptChannel: SCRIPT_CHANNELS.includes(b.script_channel as ScriptChannel) ? (b.script_channel as ScriptChannel) : undefined,
        accountId: UUID.test(b.account_id ?? '') ? b.account_id : undefined, clipId: UUID.test(b.clip_id ?? '') ? b.clip_id : undefined, brandId: UUID.test(b.brand_id ?? '') ? b.brand_id : undefined,
        all: !!b.all, instructions: b.instructions?.slice(0, PLAYBOOK_MAX_CHARS) || null,
      });
      return json(r, r.ok ? 200 : r.capReached ? 429 : 502);
    }
    // The overnight plan, one step per call — the Orchestrator room's
    // "Run tonight's plan now" calls this until it answers done.
    if (path === 'daily') {
      const z = zonedNow(TZ);
      if (request.method === 'GET') {
        const [tasks, [summary]] = await Promise.all([
          sb.get(`ai_tasks?user_id=eq.${user.id}&body=like.daily:${z.date}:*&order=created_at.asc&select=id,body,status,note,created_at`),
          sb.get(`ai_daily_summaries?user_id=eq.${user.id}&domain=eq.orchestrator&order=date.desc&limit=1&select=date,summary_text,numbers`),
        ]);
        return json({ date: z.date, plan: planFor(z.dow), tasks, summary: summary ?? null });
      }
      const step = await nextDailyStep(env.ANTHROPIC_API_KEY, sb, user.id, z.date, z.dow);
      return json({ date: z.date, done: !step, step });
    }
    if (path === 'decide') {
      const b = await body<{ approval_id?: string; status?: 'approved' | 'sent_back' | 'killed'; note?: string; rerun?: boolean; choice?: number }>(request);
      if (!b?.approval_id || !b.status || !['approved', 'sent_back', 'killed'].includes(b.status)) return json({ error: 'approval_id and status are required.' }, 400);
      const r = await decide(env.ANTHROPIC_API_KEY, sb, user.id, { approvalId: b.approval_id, status: b.status, note: b.note, rerun: b.rerun, choice: Number.isInteger(b.choice) && b.choice! >= 0 && b.choice! < 10 ? b.choice : undefined });
      if (r.ok && r.type === 'product_pitch' && b.status !== 'approved') {
        // A rejected pitch: the note is already a correction (send-back); the pitch is marked rejected.
        const [a] = await sb.get<{ payload: { pitch_id?: string } }>(`ai_approvals?id=eq.${b.approval_id}&user_id=eq.${user.id}&select=payload`);
        await rejectPitch(sb, user.id, a?.payload?.pitch_id, b.note ?? null);
      }
      if (!r.ok || b.status !== 'approved') return json(r, r.ok ? 200 : 400);
      if (r.type === 'product_pitch' || r.type === 'product_card') {
        // Approved: Brand Lab drafts 3 directions (the Visual worker images them)
        // and Supplier Finder builds the shipping plan — Marq confirms each.
        const brandId = ((r.applied ?? {}) as { brand_id?: string }).brand_id;
        if (brandId) {
          const job = (async () => { await RUNNERS.brandlab(env.ANTHROPIC_API_KEY, sb, user.id, { brandId, trigger: 'approval' }); await RUNNERS.supplier(env.ANTHROPIC_API_KEY, sb, user.id, { brandId, trigger: 'approval' }); })().catch((e) => console.error('pitch follow-up', e));
          if (ctx) ctx.waitUntil(job); else await job;
        }
      }
      // Approved work goes out into the world right away; the */5 cron is
      // the fallback for anything not due yet or still processing.
      if (r.type === 'post_plan' || r.type === 'clip_edit') {
        const job = runPublisher(env, sb, user.id, { trigger: 'approval' }).catch((e) => console.error('publisher', e));
        if (ctx) ctx.waitUntil(job); else await job;
      }
      if (r.type === 'store_draft') {
        const buildId = ((r.applied ?? {}) as { build_id?: string }).build_id;
        const launch = buildId ? await runLauncher(env, sb, user.id, { buildId, trigger: 'approval' }) : { ok: false, error: 'The approval had no build to launch.' };
        return json({ ...r, launch });
      }
      return json(r);
    }
    // "Publish again" on a post (one attempt), or "post what's due now".
    if (path === 'publish') {
      const b = await body<{ item_id?: string }>(request);
      if (b?.item_id) {
        if (!UUID.test(b.item_id)) return json({ error: 'Bad item_id.' }, 400);
        if (!(await requeue(sb, user.id, b.item_id))) return json({ error: 'That post is already queued, posting or posted.' }, 409);
      }
      const r = await runPublisher(env, sb, user.id, { trigger: 'manual', itemIds: b?.item_id ? [b.item_id] : undefined });
      return json(r ?? { ok: true, summary: 'Nothing is due to post right now.' });
    }
    // Product Pitch now, or "Find me another" (the current one is replaced).
    if (path === 'pitch') {
      const b = await body<{ another_of?: string; instructions?: string }>(request);
      let exclude: string[] = [];
      if (b?.another_of && UUID.test(b.another_of)) {
        const [a] = await sb.get<{ id: string; payload: { pitch_id?: string; product_id?: string }; status: string }>(`ai_approvals?id=eq.${b.another_of}&user_id=eq.${user.id}&select=id,payload,status`);
        if (a?.status === 'pending') await sb.patch('ai_approvals', `id=eq.${a.id}`, { status: 'killed', my_note: 'Find me another', decided_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        await rejectPitch(sb, user.id, a?.payload?.pitch_id, 'Find me another', true);
        if (a?.payload?.product_id) exclude = [a.payload.product_id];
      }
      const r = await runProductPitch(env.ANTHROPIC_API_KEY, sb, user.id, { exclude, instructions: b?.instructions?.slice(0, 2000) ?? null, trigger: 'manual' });
      return json(r, r.ok ? 200 : r.capReached ? 429 : 502);
    }
    // "Find the missing numbers": re-run Supplier Finder + Analyst on one find (an approval) or one sheet product.
    if (path === 'enrich') {
      const b = await body<{ approval_id?: string; product_id?: string }>(request);
      const id = b?.approval_id ?? b?.product_id;
      if (!id || !UUID.test(id)) return json({ error: 'approval_id or product_id is required.' }, 400);
      const r = await enrichOne(env, sb, user.id, b?.approval_id ? 'approval' : 'product', id);
      return json(r, r.ok ? 200 : r.capReached ? 429 : 502);
    }
    // The next find still waiting for its numbers; the Approvals tab calls this until nothing is left.
    if (path === 'enrich-next') {
      const [next] = await sb.get<{ id: string }>(`ai_approvals?user_id=eq.${user.id}&type=eq.product_card&status=eq.pending&payload->>pending_enrich=eq.true&order=created_at.asc&limit=1&select=id`);
      if (!next) return json({ ok: true, done: true, remaining: 0 });
      const r = await enrichOne(env, sb, user.id, 'approval', next.id);
      const remaining = await sb.count(`ai_approvals?user_id=eq.${user.id}&type=eq.product_card&status=eq.pending&payload->>pending_enrich=eq.true`).catch(() => 0);
      // A failed try is not retried forever: it's marked done and shows "Not found" with the Find the missing numbers button.
      if (!r.ok) await sb.patch('ai_approvals', `id=eq.${next.id}&user_id=eq.${user.id}`, { payload: await clearPending(sb, user.id, next.id) }).catch(() => {});
      return json({ ...r, done: remaining === 0 || !r.ok && remaining <= 1, remaining: Math.max(0, remaining - (r.ok ? 0 : 1)) }, 200);
    }
    // Watch: keep a find (re-check in 7 days) without starting a brand.
    if (path === 'watch-card') {
      const b = await body<{ approval_id?: string }>(request);
      if (!b?.approval_id || !UUID.test(b.approval_id)) return json({ error: 'approval_id is required.' }, 400);
      const [a] = await sb.get<{ payload: { row?: ImportRow }; status: string }>(`ai_approvals?id=eq.${b.approval_id}&user_id=eq.${user.id}&select=payload,status`);
      if (!a?.payload?.row || a.status !== 'pending') return json({ error: 'That find is no longer waiting.' }, 409);
      const row = a.payload.row;
      await importScoutRows(sb, user.id, [{ ...row, detail: { ...row.detail, recheck_at: new Date(Date.now() + 7 * 86400000).toISOString() } }]);
      await sb.patch('ecom_products', `user_id=eq.${user.id}&channel=eq.${row.channel}&name=eq.${encodeURIComponent(row.name)}`, { watched: true });
      await sb.patch('ai_approvals', `id=eq.${b.approval_id}&user_id=eq.${user.id}`, { status: 'approved', my_note: 'Watching: re-check in 7 days', decided_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return json({ ok: true, detail: 'Saved to Watched. It gets a fresh look in 7 days.' });
    }
    // Reject a sheet product with a reason; the reason becomes a correction Scout reads.
    if (path === 'reject-product') {
      const b = await body<{ product_id?: string; reason?: string }>(request);
      if (!b?.product_id || !UUID.test(b.product_id) || !b.reason?.trim()) return json({ error: 'product_id and a reason are required.' }, 400);
      const [p] = await sb.get<{ name: string; detail: Record<string, unknown> }>(`ecom_products?id=eq.${b.product_id}&user_id=eq.${user.id}&select=name,detail`);
      if (!p) return json({ error: 'That product is gone.' }, 404);
      const [w] = await sb.get<{ id: string }>(`ai_workers?user_id=eq.${user.id}&key=eq.scout&select=id`);
      await sb.patch('ecom_products', `id=eq.${b.product_id}&user_id=eq.${user.id}`, { detail: { ...p.detail, rejected: b.reason.trim().slice(0, 80) }, updated_at: new Date().toISOString() });
      await sb.insert('ai_approvals', { user_id: user.id, domain: 'ecom', type: 'product_card', entity_type: 'product', entity_id: b.product_id, worker_id: w?.id ?? null, title: `Product: ${p.name} (rejected)`, payload: { rejected: true }, status: 'sent_back', my_note: `Rejected: ${b.reason.trim().slice(0, 80)}`, decided_at: new Date().toISOString(), is_money: false }).catch(() => {});
      return json({ ok: true });
    }
    // "I want to test this one": any product on the sheet becomes a brand and runs the same pipeline as an approved pitch.
    if (path === 'test-product') {
      const b = await body<{ product_id?: string }>(request);
      if (!b?.product_id || !UUID.test(b.product_id)) return json({ error: 'product_id is required.' }, 400);
      const r = await testProduct(sb, user.id, b.product_id);
      if (!r.existing) {
        const job = (async () => { await RUNNERS.brandlab(env.ANTHROPIC_API_KEY, sb, user.id, { brandId: r.brand_id, trigger: 'approval' }); await RUNNERS.supplier(env.ANTHROPIC_API_KEY, sb, user.id, { brandId: r.brand_id, trigger: 'approval' }); })().catch((e) => console.error('test-product follow-up', e));
        if (ctx) ctx.waitUntil(job); else await job;
      }
      return json({ ok: true, ...r });
    }
    // "Launch again" on a store build after fixing what the last try said.
    if (path === 'launch') {
      const b = await body<{ build_id?: string }>(request);
      if (!b?.build_id || !UUID.test(b.build_id)) return json({ error: 'build_id is required.' }, 400);
      const r = await runLauncher(env, sb, user.id, { buildId: b.build_id, trigger: 'manual' });
      return json(r, r.ok ? 200 : 502);
    }
    return json({ error: `Unknown engine route: ${path}` }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
