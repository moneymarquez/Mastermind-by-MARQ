// /api/engine/* — the shared worker engine's HTTP surface. Runs are
// synchronous from the caller's point of view ("Run now" waits for the
// answer); the overnight plan runs from the */5 cron (lib/orchestrator.ts).
import { requireMember } from '../lib/member';
import { json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { spentToday, capFor } from '../lib/ai';
import { ensureRoster, RUNNERS, decide, ENGINE_DOMAINS, TZ } from '../lib/engine';
import { nextDailyStep, planFor } from '../lib/orchestrator';
import { runPublisher, requeue } from '../lib/publisher';
import type { PublishEnv } from '../lib/publisher';
import { runLauncher } from '../lib/launcher';
import { rejectPitch, runProductPitch } from '../lib/ecomOctober';
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
      if (r.type === 'product_pitch') {
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
