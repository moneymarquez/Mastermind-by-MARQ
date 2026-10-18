// 👍 / 👎 on anything a worker or orchestrator made (brief §2b).
//   👎 + reason → a correction the worker reads in its next brief
//   (correctionsFor in engine.ts reads these alongside send-back notes).
//   The same correction twice → a standing playbook rule: applied at once
//   when the worker runs at autonomy 2, otherwise an approval card for Marq.
//   👍 → a positive example the Content loop and Product picks read.
import { Sb } from './sb';
import { applyPlaybookEdit } from './office';
import { correctionKey } from './flags';
import { PLAYBOOK_MAX_CHARS } from '../../src/data/ecom';

export interface FeedbackInput { domain: string; worker_id?: string | null; entity_type: string; entity_id: string; vote: 1 | -1; reason?: string | null }
export interface FeedbackResult { saved: boolean; promoted?: { mode: 'applied' | 'proposed'; rule: string; playbook: string } }

/** A correction becomes a one-line playbook rule. Pure. */
export function ruleFromCorrection(reason: string): string {
  const r = reason.trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '');
  return `- ${r[0]?.toUpperCase() ?? ''}${r.slice(1)}. (Marq said this twice.)`.slice(0, 400);
}

/** Saves a new playbook version with the rule, like Office's playbook proposals. */
export async function addPlaybookRule(sb: Sb, u: string, playbook: string, domain: string, rule: string, why: string): Promise<{ version: number }> {
  let [pb] = await sb.get<{ id: string; body: string; version: number }>(`ai_playbooks?user_id=eq.${u}&name=eq.${encodeURIComponent(playbook)}&select=id,body,version`);
  if (!pb) [pb] = await sb.insert<{ id: string; body: string; version: number }>('ai_playbooks', { user_id: u, name: playbook, domain, body: '', version: 0 });
  if (pb.body.includes(rule)) return { version: pb.version };
  const edit = applyPlaybookEdit(pb.body, '', rule);
  if (edit.body.length > PLAYBOOK_MAX_CHARS) throw new Error(`${playbook} is full — trim it before adding rules.`);
  const version = pb.version + 1;
  await sb.patch('ai_playbooks', `id=eq.${pb.id}`, { body: edit.body, version, change_reason: why, updated_at: new Date().toISOString() });
  await sb.insert('ai_playbook_versions', { user_id: u, playbook_id: pb.id, version, body: edit.body, change_reason: why }, { upsert: 'playbook_id,version' }).catch(() => {});
  return { version };
}

export async function recordFeedback(sb: Sb, u: string, f: FeedbackInput): Promise<FeedbackResult> {
  const reason = f.reason?.trim().slice(0, 500) || null;
  const key = f.vote === -1 && reason ? correctionKey(reason) : null;
  await sb.insert('ai_feedback', { user_id: u, domain: f.domain, worker_id: f.worker_id ?? null, entity_type: f.entity_type, entity_id: f.entity_id, vote: f.vote, reason, reason_key: key }, { upsert: 'user_id,entity_type,entity_id' });
  if (!key || !f.worker_id) return { saved: true };
  const same = await sb.get<{ id: string; promoted_at: string | null }>(`ai_feedback?user_id=eq.${u}&worker_id=eq.${f.worker_id}&vote=eq.-1&reason_key=eq.${encodeURIComponent(key)}&select=id,promoted_at`);
  if (same.length < 2 || same.some((s) => s.promoted_at)) return { saved: true };
  const [w] = await sb.get<{ key: string; domain: string; autonomy_level: number; name: string }>(`ai_workers?id=eq.${f.worker_id}&select=key,domain,autonomy_level,name`);
  if (!w) return { saved: true };
  const playbook = `worker:${w.key}`, rule = ruleFromCorrection(reason!);
  const why = `${w.name}: the same correction twice ("${reason!.slice(0, 80)}")`;
  if (w.autonomy_level >= 2) {
    await addPlaybookRule(sb, u, playbook, w.domain, rule, why);
    await sb.patch('ai_feedback', `id=in.(${same.map((s) => s.id).join(',')})`, { promoted_at: new Date().toISOString() });
    return { saved: true, promoted: { mode: 'applied', rule, playbook } };
  }
  await sb.insert('ai_approvals', { user_id: u, domain: w.domain === 'all' ? 'ecom' : w.domain, type: 'playbook_rule', entity_type: 'worker', entity_id: f.worker_id, worker_id: f.worker_id, title: `Make it a rule for ${w.name}: ${reason!.slice(0, 120)}`, payload: { playbook, rule, domain: w.domain, feedback_ids: same.map((s) => s.id), summary: `You've corrected ${w.name} the same way twice. Approve to make it a standing rule in its playbook.` }, confidence: 'hard', is_money: false });
  await sb.patch('ai_feedback', `id=in.(${same.map((s) => s.id).join(',')})`, { promoted_at: new Date().toISOString() });
  return { saved: true, promoted: { mode: 'proposed', rule, playbook } };
}

/** 👎 reasons for a worker, newest first (merged into correctionsFor). */
export async function feedbackCorrections(sb: Sb, u: string, workerId: string): Promise<string[]> {
  const rows = await sb.get<{ reason: string }>(`ai_feedback?user_id=eq.${u}&worker_id=eq.${workerId}&vote=eq.-1&reason=not.is.null&order=created_at.desc&limit=10&select=reason`);
  return rows.map((r) => `${r.reason.trim()} (👎)`);
}
/** 👍 entities for a worker: positive examples. */
export async function likedIds(sb: Sb, u: string, workerId: string, entityType: string): Promise<string[]> {
  const rows = await sb.get<{ entity_id: string }>(`ai_feedback?user_id=eq.${u}&worker_id=eq.${workerId}&entity_type=eq.${entityType}&vote=eq.1&order=created_at.desc&limit=20&select=entity_id`);
  return rows.map((r) => r.entity_id);
}
