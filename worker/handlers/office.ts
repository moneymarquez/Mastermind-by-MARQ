// /api/office/* — View Office's feedback loop (Appendix 5 Part 3).
// raise:  chat with the orchestrator about one run; it answers with proposal
//         cards (rerun / playbook edit / settings change).
// apply:  do one proposal — playbook edits save a new ai_playbooks version
//         with change_reason + thread_id, so the correction sticks.
// assign: "＋ Assign task" — the orchestrator routes an order to a worker.
import { requireMember } from '../lib/member';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { ask, CapReached } from '../lib/ai';
import { playbooksFor, RUNNERS, TZ } from '../lib/engine';
import type { WorkerRow } from '../lib/engine';
import { parseOrchestratorReply, applyPlaybookEdit, parseRoute, THREAD_SYSTEM, ROUTE_SYSTEM } from '../lib/office';
import type { Proposal } from '../lib/office';
import type { Channel } from '../../src/data/ecom';
import type { Venture, ScriptChannel } from '../../src/data/mktEngine';
import { LIVE_WORKERS, PLAYBOOK_MAX_CHARS, PLAYBOOK_LOAD_BUDGET } from '../../src/data/ecom';

export interface OfficeEnv extends SbEnv { ANTHROPIC_API_KEY?: string }
// Live = has a runner. LIVE_WORKERS (the app's list) and RUNNERS agree;
// the orchestrator itself is routed to, never run as a task.
const LIVE = new Set(LIVE_WORKERS.filter((k) => k in RUNNERS));
const workerPlaybook = (key: string) => `worker:${key}`;

async function orchestrator(sb: Sb, userId: string): Promise<WorkerRow | null> {
  const [o] = await sb.get<WorkerRow>(`ai_workers?user_id=eq.${userId}&key=eq.orchestrator&select=*`);
  return o ?? null;
}

async function workerPlaybooks(sb: Sb, userId: string, w: WorkerRow): Promise<{ text: string; names: string[] }> {
  const text = await playbooksFor(sb, userId, w.domain === 'all' ? 'all' : w.domain, PLAYBOOK_LOAD_BUDGET, w.key);
  const names = (await sb.get<{ name: string }>(`ai_playbooks?user_id=eq.${userId}&select=name`)).map((r) => r.name);
  return { text, names };
}

export async function officeRoute(request: Request, env: OfficeEnv, path: string): Promise<Response> {
  // Members only (bug inventory B-02): every route here can spend.
  const m = await requireMember(request, env);
  if (m instanceof Response) return m;
  const { user, sb } = m;
  let b: Record<string, unknown> = {};
  try { b = (await request.json()) as Record<string, unknown>; } catch { /* empty */ }
  const date = zonedNow(TZ).date;
  try {
    if (path === 'raise') {
      const runId = String(b.run_id ?? ''); const message = String(b.message ?? '').trim();
      if (!runId || !message) return json({ error: 'run_id and message are required.' }, 400);
      const [run] = await sb.get<{ id: string; worker_id: string; domain: string; input: unknown; output: unknown; summary: string | null; error: string | null; instructions: string | null }>(`ai_worker_runs?id=eq.${runId}&user_id=eq.${user.id}&select=*`);
      if (!run) return json({ error: 'Run not found.' }, 404);
      const [w] = await sb.get<WorkerRow>(`ai_workers?id=eq.${run.worker_id}&select=*`);
      if (!w) return json({ error: 'That run has no worker.' }, 404);
      const orch = await orchestrator(sb, user.id);
      // The run's real output is usually in its approval payload (L0).
      const [appr] = await sb.get<{ title: string; payload: unknown; status: string; my_note: string | null }>(`ai_approvals?run_id=eq.${run.id}&select=title,payload,status,my_note`);
      let threadId = String(b.thread_id ?? '');
      if (!threadId) {
        const [t] = await sb.insert<{ id: string }>('ai_threads', { user_id: user.id, run_id: run.id, worker_id: w.id, domain: run.domain, title: message.slice(0, 80) });
        threadId = t.id;
      }
      const history = await sb.get<{ role: string; body: string }>(`ai_thread_messages?thread_id=eq.${threadId}&order=created_at.asc&select=role,body`);
      await sb.insert('ai_thread_messages', { user_id: user.id, thread_id: threadId, role: 'user', body: message });
      const pb = await workerPlaybooks(sb, user.id, w);
      const context = JSON.stringify({ run_input: run.input, run_instructions: run.instructions, run_summary: run.summary, run_error: run.error, output: appr?.payload ?? run.output, approval: appr ? { title: appr.title, status: appr.status, note: appr.my_note } : null }).slice(0, 14000);
      const res = await ask(env.ANTHROPIC_API_KEY, sb, {
        model: orch?.model ?? 'claude-fable-5-1', domain: run.domain === 'all' ? 'ecom' : run.domain, userId: user.id, date, workerId: orch?.id ?? null, maxTokens: 1500,
        system: THREAD_SYSTEM(w, pb.text),
        user: `The run:\n${context}\n\n${history.map((h) => `${h.role === 'user' ? 'Marq' : 'You'}: ${h.body}`).join('\n')}\nMarq: ${message}`,
      });
      const parsed = parseOrchestratorReply(res.text, pb.names, workerPlaybook(w.key));
      const [msg] = await sb.insert<{ id: string }>('ai_thread_messages', { user_id: user.id, thread_id: threadId, role: 'orchestrator', body: parsed.reply, proposal: parsed.proposals, cost_usd: Number(res.costUsd.toFixed(5)) });
      await sb.patch('ai_threads', `id=eq.${threadId}`, { updated_at: new Date().toISOString() });
      return json({ thread_id: threadId, message_id: msg.id, reply: parsed.reply, proposals: parsed.proposals, cost_usd: res.costUsd });
    }

    if (path === 'apply') {
      const messageId = String(b.message_id ?? ''); const index = Number(b.index);
      const [m] = await sb.get<{ id: string; thread_id: string; proposal: Proposal[] }>(`ai_thread_messages?id=eq.${messageId}&user_id=eq.${user.id}&select=id,thread_id,proposal`);
      if (!m || !m.proposal[index]) return json({ error: 'Proposal not found.' }, 404);
      const p = m.proposal[index];
      if (p.applied_at) return json({ error: 'Already applied.' }, 400);
      const [t] = await sb.get<{ id: string; worker_id: string; run_id: string | null }>(`ai_threads?id=eq.${m.thread_id}&select=id,worker_id,run_id`);
      const [w] = await sb.get<WorkerRow>(`ai_workers?id=eq.${t.worker_id}&select=*`);
      let result: Record<string, unknown> = {};
      if (p.kind === 'playbook') {
        const [existing] = await sb.get<{ id: string; body: string; version: number; domain: string }>(`ai_playbooks?user_id=eq.${user.id}&name=eq.${encodeURIComponent(p.playbook)}&select=id,body,version,domain`);
        let pbRow = existing;
        if (!pbRow) [pbRow] = await sb.insert<{ id: string; body: string; version: number; domain: string }>('ai_playbooks', { user_id: user.id, name: p.playbook, domain: w?.domain ?? 'all', body: '', version: 0 });
        if (pbRow.body.trim() && pbRow.version >= 1) await sb.insert('ai_playbook_versions', { user_id: user.id, playbook_id: pbRow.id, version: pbRow.version, body: pbRow.body, change_reason: 'before orchestrator edit' }, { upsert: 'playbook_id,version', ignore: true }).catch(() => {});
        const edit = applyPlaybookEdit(pbRow.body, p.before, p.after);
        if (edit.body.length > PLAYBOOK_MAX_CHARS) return json({ error: `That edit would make ${p.playbook} ${edit.body.length.toLocaleString('en-US')} characters — over the ${PLAYBOOK_MAX_CHARS.toLocaleString('en-US')} limit. Trim the playbook first.` }, 400);
        const version = pbRow.version + 1;
        const reason = `${p.why || 'Orchestrator fix'} (from "Raise with orchestrator")`;
        await sb.patch('ai_playbooks', `id=eq.${pbRow.id}`, { body: edit.body, version, change_reason: reason, updated_at: new Date().toISOString() });
        await sb.insert('ai_playbook_versions', { user_id: user.id, playbook_id: pbRow.id, version, body: edit.body, change_reason: reason, thread_id: t.id }, { upsert: 'playbook_id,version' });
        if (w && !w.playbook_name) await sb.patch('ai_workers', `id=eq.${w.id}`, { playbook_name: p.playbook }).catch(() => {});
        result = { playbook: p.playbook, version, mode: edit.mode };
      } else if (p.kind === 'settings') {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (p.model) patch.model = p.model;
        if (p.autonomy_level !== undefined) patch.autonomy_level = p.autonomy_level;
        if (p.enabled !== undefined) { patch.enabled = p.enabled; patch.status = p.enabled ? 'idle' : 'disabled'; }
        await sb.patch('ai_workers', `id=eq.${t.worker_id}`, patch);
        result = { settings: patch };
      } else if (p.kind === 'rerun') {
        if (!w || !LIVE.has(w.key)) return json({ error: `${w?.name ?? 'This worker'} can't run yet in this build.` }, 400);
        const [run] = t.run_id ? await sb.get<{ input: Record<string, unknown> }>(`ai_worker_runs?id=eq.${t.run_id}&select=input`) : [];
        const i = run?.input ?? {};
        const r = await RUNNERS[w.key](env.ANTHROPIC_API_KEY, sb, user.id, { channel: (i.channel as Channel) ?? 'tiktok', count: i.count as number | undefined, productId: i.product_id as string | undefined, venture: i.venture as Venture | undefined, scriptChannel: w.key === 'script_copy' ? (i.channel as ScriptChannel) : undefined, instructions: p.instructions, trigger: 'rerun' });
        result = { rerun: r };
      }
      const proposals = m.proposal.map((x, i) => (i === index ? { ...x, applied_at: new Date().toISOString() } : x));
      await sb.patch('ai_thread_messages', `id=eq.${m.id}`, { proposal: proposals });
      return json({ ok: true, ...result });
    }

    if (path === 'assign') {
      const domain = String(b.domain ?? 'ecom'); const text = String(b.text ?? '').trim();
      if (!text) return json({ error: 'Type the task first.' }, 400);
      const workers = await sb.get<WorkerRow>(`ai_workers?user_id=eq.${user.id}&domain=eq.${domain}&select=*`);
      if (!workers.length) return json({ error: 'No workers hired for this module yet. Setup → Start the company.' }, 409);
      const orch = await orchestrator(sb, user.id);
      const res = await ask(env.ANTHROPIC_API_KEY, sb, {
        model: orch?.model ?? 'claude-fable-5-1', domain, userId: user.id, date, workerId: orch?.id ?? null, maxTokens: 400,
        system: ROUTE_SYSTEM(workers.map((w) => ({ key: w.key, name: w.name, role: w.role, live: LIVE.has(w.key) })), domain === 'ecom' ? await sb.get<{ id: string; name: string }>(`ecom_products?user_id=eq.${user.id}&order=score.desc.nullslast&limit=30&select=id,name`) : []),
        user: text,
      });
      const route = parseRoute(res.text, workers.map((w) => w.key));
      const target = workers.find((w) => w.key === route.workerKey) ?? null;
      const [task] = await sb.insert<{ id: string }>('ai_tasks', { user_id: user.id, domain, body: text, worker_id: target?.id ?? null, instructions: route.instructions || text, status: target && LIVE.has(target.key) ? 'running' : 'waiting', note: route.reply || null });
      if (target && LIVE.has(target.key)) {
        const r = await RUNNERS[target.key](env.ANTHROPIC_API_KEY, sb, user.id, { channel: (route.channel as Channel) ?? 'tiktok', productId: route.productId ?? undefined, scriptChannel: (route.scriptChannel as ScriptChannel) ?? undefined, instructions: route.instructions || text, trigger: 'manual' });
        await sb.patch('ai_tasks', `id=eq.${task.id}`, { status: r.ok ? 'done' : 'failed', run_id: r.runId ?? null, note: r.ok ? `${route.reply || 'Done.'} ${r.skipped ? r.summary : `${r.summary ?? ''} → Approvals.`}` : r.error, updated_at: new Date().toISOString() });
        return json({ task_id: task.id, worker: target.name, reply: route.reply, run: r });
      }
      const note = target ? `${route.reply || `Routed to ${target.name}.`} ${target.name} isn't live yet — the task waits for it.` : (route.reply || 'No worker fits that yet.');
      await sb.patch('ai_tasks', `id=eq.${task.id}`, { note, updated_at: new Date().toISOString() });
      return json({ task_id: task.id, worker: target?.name ?? null, reply: note });
    }
    return json({ error: `Unknown office route ${path}` }, 404);
  } catch (e) {
    if (e instanceof CapReached) return json({ error: e.message, capReached: true }, 429);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
