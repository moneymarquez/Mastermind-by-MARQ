// /api/hq/* — the master orchestrator's home (brief §5.8, §2a–2e). Owner only.
//   GET  status          controls, open flags, approvals across portals, spend, report, task log
//   POST pause           { which: 'all'|'ecommerce'|'content'|'marketing', paused }
//   POST settings        guardrail + flag thresholds + sites per product (stored as stores_per_product)
//   POST feedback        👍/👎 on any output (→ corrections → playbook rules)
//   POST chat            talk to HQ; it routes to a domain orchestrator
//   POST flags-sync      recompute flags now
//   GET  notifications   in-app list; POST notifications-read
//   GET/POST notify-prefs
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import { ask } from '../lib/ai';
import { ENGINE_DOMAINS, TZ } from '../lib/engine';
import { spentToday, capFor } from '../lib/ai';
import { loadControls, setPaused, spentThisMonth, controlsFrom, spentInGroup } from '../lib/controls';
import type { ControlDomain, SpendBucket } from '../lib/controls';
import { syncFlags, bySeverity } from '../lib/flags';
import type { Severity } from '../lib/flags';
import { likedPostBrief } from '../lib/contentOctober';
import { recordFeedback } from '../lib/feedback';
import { HQ_ROUTE_SYSTEM, parseRoute } from '../lib/office';
import { ROLE_MODEL } from '../lib/models';
import { notify, EVENTS, loadPrefs } from '../lib/notify';
import type { NotifyEnv } from '../lib/notify';
import { assignToDomain } from './office';
import type { OfficeEnv } from './office';

export type HqEnv = OfficeEnv & NotifyEnv;
async function body<T>(r: Request): Promise<T> { try { return (await r.json()) as T; } catch { return {} as T; } }

export async function hqRoute(request: Request, env: HqEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const sb = new Sb(env);
  const u = user.id;
  // Notifications and their preferences are for every account; the rest is the owner's HQ.
  try {
    if (path === 'notifications') {
      const rows = await sb.get(`app_notifications?user_id=eq.${u}&order=created_at.desc&limit=60&select=id,event,title,body,deep_link,priority,read_at,created_at`);
      return json({ rows });
    }
    if (path === 'notifications-read') {
      const b = await body<{ ids?: string[] }>(request);
      const ids = (b.ids ?? []).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
      await sb.patch('app_notifications', `user_id=eq.${u}${ids.length ? `&id=in.(${ids.join(',')})` : ''}&read_at=is.null`, { read_at: new Date().toISOString() });
      return json({ ok: true });
    }
    if (path === 'notify-prefs') {
      if (request.method === 'POST') {
        const b = await body<{ channels?: Record<string, string[]>; quiet_start?: string; quiet_end?: string; sms_to?: string | null }>(request);
        const valid = new Set(EVENTS.map((e) => e.id));
        const channels = Object.fromEntries(Object.entries(b.channels ?? {}).filter(([k]) => valid.has(k as never)).map(([k, v]) => [k, (v ?? []).filter((c) => c === 'push' || c === 'sms')]));
        const hhmm = (x?: string) => (x && /^\d{2}:\d{2}$/.test(x) ? x : undefined);
        await sb.insert('notify_prefs', { user_id: u, channels, ...(hhmm(b.quiet_start) ? { quiet_start: b.quiet_start } : {}), ...(hhmm(b.quiet_end) ? { quiet_end: b.quiet_end } : {}), ...(b.sms_to !== undefined ? { sms_to: b.sms_to?.trim() || null } : {}), updated_at: new Date().toISOString() }, { upsert: 'user_id' });
      }
      return json({ prefs: await loadPrefs(sb, u), events: EVENTS });
    }
    if (path === 'feedback') {
      const b = await body<{ domain?: string; worker_id?: string | null; entity_type?: string; entity_id?: string; vote?: number; reason?: string }>(request);
      if (!b.entity_type || !b.entity_id || (b.vote !== 1 && b.vote !== -1)) return json({ error: 'entity_type, entity_id and vote (1 or -1) are required.' }, 400);
      // 👍 on a post feeds the Ideas engine as a positive example.
      if (b.entity_type === 'social_post' && b.vote === 1 && /^[0-9a-f-]{36}$/i.test(b.entity_id)) await likedPostBrief(sb, u, b.entity_id).catch(() => {});
      return json(await recordFeedback(sb, u, { domain: b.domain ?? 'ecom', worker_id: b.worker_id && /^[0-9a-f-]{36}$/i.test(b.worker_id) ? b.worker_id : null, entity_type: b.entity_type.slice(0, 40), entity_id: b.entity_id.slice(0, 80), vote: b.vote, reason: b.reason ?? null }));
    }

    if (!isOwnerUser(user)) return json({ error: 'HQ is owner only.' }, 403);

    if (path === 'status') {
      const date = zonedNow(TZ).date;
      const [controls, flags, approvals, monthly, report, summaries, handoffs, tasks, runs] = await Promise.all([
        loadControls(sb, u),
        sb.get<{ id: string; domain: string; entity_type: string; entity_id: string; severity: Severity; rule: string; message: string; link: string | null; opened_at: string }>(`ai_flags?user_id=eq.${u}&resolved_at=is.null&order=opened_at.desc&limit=300&select=id,domain,entity_type,entity_id,severity,rule,message,link,opened_at`),
        sb.get<{ id: string; domain: string; type: string; title: string; is_money: boolean; amount_usd: number | null; created_at: string }>(`ai_approvals?user_id=eq.${u}&status=eq.pending&order=created_at.asc&limit=100&select=id,domain,type,title,is_money,amount_usd,created_at`),
        spentThisMonth(sb, u),
        sb.get<{ date: string; summary_text: string; numbers: Record<string, unknown> }>(`ai_daily_summaries?user_id=eq.${u}&domain=in.(orch:master,orchestrator)&order=date.desc,domain.asc&limit=2&select=date,summary_text,numbers,domain`),
        sb.get<{ domain: string; summary_text: string; numbers: Record<string, unknown> }>(`ai_daily_summaries?user_id=eq.${u}&date=eq.${date}&domain=in.(orch:ecom,orch:content,orch:marketing)&select=domain,summary_text,numbers`),
        sb.get(`ai_handoffs?user_id=eq.${u}&order=created_at.desc&limit=20&select=id,from_domain,to_domain,kind,status,note,created_at,done_at`),
        sb.get(`ai_tasks?user_id=eq.${u}&order=created_at.desc&limit=80&select=id,domain,body,worker_id,instructions,status,note,run_id,created_at`),
        sb.get(`ai_worker_runs?user_id=eq.${u}&order=created_at.desc&limit=80&select=id,worker_id,domain,status,summary,error,cost_usd,trigger,created_at,finished_at`),
      ]);
      const daily = await Promise.all(ENGINE_DOMAINS.filter((d) => d !== 'digest').map(async (d) => ({ domain: d, spent: await spentToday(sb, u, d, date), cap: await capFor(sb, u, d) })));
      return json({
        date, controls,
        flags: bySeverity(flags, (f) => f.severity),
        approvals, report: report[0] ?? null, summaries, handoffs, tasks, runs,
        spend: { daily, monthly: Object.entries(controls.monthly_caps).map(([bucket, cap]) => ({ bucket, cap, spent: spentInGroup(bucket as SpendBucket, monthly) })) },
      });
    }
    if (path === 'pause') {
      const b = await body<{ which?: string; paused?: boolean }>(request);
      const which = (['all', 'ecommerce', 'content', 'marketing'] as const).find((x) => x === b.which);
      if (!which || typeof b.paused !== 'boolean') return json({ error: 'which and paused are required.' }, 400);
      const controls = await setPaused(sb, u, which as 'all' | ControlDomain, b.paused);
      await notify(env, sb, u, 'kill_switch', { title: `${b.paused ? 'Paused' : 'Resumed'}: ${which === 'all' ? 'everything' : which}`, body: b.paused ? 'No runs, posts, sends or spend until you resume. Queued work waits.' : 'Queued work picks up on the next tick.', deepLink: 'hq', priority: 'high' });
      return json({ controls });
    }
    if (path === 'settings') {
      const b = await body<Record<string, unknown>>(request);
      const cur = await loadControls(sb, u);
      const caps = { ...cur.monthly_caps };
      for (const [k, v] of Object.entries((b.monthly_caps ?? {}) as Record<string, unknown>)) { const n = Number(v); if (['ecommerce', 'marketing', 'visual', 'research', 'supplier', 'xai', 'twilio', 'other'].includes(k) && Number.isFinite(n) && n >= 0 && n <= 100000) caps[k as keyof typeof caps] = n; }
      const per = Number(b.per_action_approval_over_usd);
      const next = controlsFrom({ ...cur, monthly_caps: caps, per_action_approval_over_usd: Number.isFinite(per) && per >= 0 ? per : cur.per_action_approval_over_usd, stores_per_product: Number(b.stores_per_product ?? cur.stores_per_product), flag_thresholds: (b.flag_thresholds as Record<string, number>) ?? cur.flag_thresholds });
      await sb.insert('system_controls', { user_id: u, per_action_approval_over_usd: next.per_action_approval_over_usd, monthly_caps: next.monthly_caps, stores_per_product: next.stores_per_product, flag_thresholds: next.flag_thresholds, updated_at: new Date().toISOString() }, { upsert: 'user_id' });
      return json({ controls: next });
    }
    if (path === 'flags-sync') return json(await syncFlags(sb, u));
    if (path === 'chat') {
      const b = await body<{ text?: string }>(request);
      const text = (b.text ?? '').trim();
      if (!text) return json({ error: 'Say something first.' }, 400);
      const date = zonedNow(TZ).date;
      const [hq] = await sb.get<{ id: string; model: string }>(`ai_workers?user_id=eq.${u}&key=eq.hq&select=id,model`);
      const res = await ask(env.ANTHROPIC_API_KEY, sb, { model: hq?.model ?? ROLE_MODEL.master, system: HQ_ROUTE_SYSTEM, user: text, domain: 'ecom', userId: u, date, workerId: hq?.id ?? null, maxTokens: 400 });
      const route = parseRoute(res.text, []);
      await sb.insert('ai_tasks', { user_id: u, domain: route.domain ?? 'ecom', body: `hq:${text.slice(0, 500)}`, worker_id: hq?.id ?? null, instructions: route.instructions || null, status: route.domain ? 'routed' : 'done', note: route.reply || null }).catch(() => {});
      if (!route.domain || !route.instructions) return json({ reply: route.reply || res.text, domain: null });
      const r = await assignToDomain(env, sb, u, route.domain, route.instructions);
      return json({ reply: route.reply, domain: route.domain, routed: r.body }, r.status);
    }
    return json({ error: `Unknown HQ route ${path}` }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
