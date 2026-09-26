// View Office — pure parts of the orchestrator loop: its reply format,
// proposal validation, the playbook before/after edit, and task routing.
import { extractJson } from './scout';

export type Proposal =
  | { kind: 'rerun'; instructions: string; why: string; applied_at?: string }
  | { kind: 'playbook'; playbook: string; before: string; after: string; why: string; applied_at?: string }
  | { kind: 'settings'; model?: string; autonomy_level?: number; enabled?: boolean; why: string; applied_at?: string };

export const ALLOWED_MODELS = ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1'];
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Keep only well-formed proposals; the orchestrator may suggest at most one of each kind. */
export function parseOrchestratorReply(text: string, playbookNames: string[], defaultPlaybook: string): { reply: string; proposals: Proposal[] } {
  let obj: { reply?: unknown; proposals?: unknown[] };
  try { obj = extractJson(text) as typeof obj; } catch { return { reply: text.trim() || 'No answer.', proposals: [] }; }
  const out: Proposal[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(obj.proposals) ? obj.proposals : []) {
    const p = (raw ?? {}) as Record<string, unknown>;
    const kind = str(p.kind);
    if (seen.has(kind)) continue;
    const why = str(p.why) || str(p.reason);
    if (kind === 'rerun' && str(p.instructions)) { out.push({ kind, instructions: str(p.instructions).slice(0, 1000), why }); seen.add(kind); }
    if (kind === 'playbook' && str(p.after)) {
      const name = str(p.playbook);
      out.push({ kind, playbook: playbookNames.includes(name) || name.startsWith('worker:') ? name : defaultPlaybook, before: str(p.before), after: str(p.after).slice(0, 4000), why });
      seen.add(kind);
    }
    if (kind === 'settings') {
      const s: Proposal = { kind, why };
      if (ALLOWED_MODELS.includes(str(p.model))) s.model = str(p.model);
      const lv = Number(p.autonomy_level);
      if (Number.isInteger(lv) && lv >= 0 && lv <= 2) s.autonomy_level = lv;
      if (typeof p.enabled === 'boolean') s.enabled = p.enabled;
      if (s.model || s.autonomy_level !== undefined || s.enabled !== undefined) { out.push(s); seen.add(kind); }
    }
  }
  return { reply: str(obj.reply) || 'Here is what I would change.', proposals: out };
}

/** Replace the exact "before" rule if it's in the playbook; otherwise add
 *  the new rule at the end. Returns the new body and what happened. */
export function applyPlaybookEdit(body: string, before: string, after: string): { body: string; mode: 'replaced' | 'appended' } {
  if (before && body.includes(before)) return { body: body.replace(before, after), mode: 'replaced' };
  const trimmed = body.replace(/\s+$/, '');
  return { body: trimmed ? `${trimmed}\n${after}` : after, mode: 'appended' };
}

export interface RouteDecision { workerKey: string | null; instructions: string; channel: string | null; reply: string }
export function parseRoute(text: string, allowedKeys: string[]): RouteDecision {
  let obj: Record<string, unknown>;
  try { obj = extractJson(text) as Record<string, unknown>; } catch { return { workerKey: null, instructions: '', channel: null, reply: text.trim() }; }
  const key = str(obj.worker_key);
  const channel = str(obj.channel);
  return {
    workerKey: allowedKeys.includes(key) ? key : null,
    instructions: str(obj.instructions).slice(0, 1000),
    channel: ['tiktok', 'amazon', 'meta', 'etsy', 'walmart', 'rising'].includes(channel) ? channel : null,
    reply: str(obj.reply),
  };
}

export const THREAD_SYSTEM = (w: { name: string; role: string; model: string; autonomy_level: number }, playbooks: string) => [
  `You are the Orchestrator of a solo founder's AI company. The founder (Marq) is raising a problem with one output from your worker "${w.name}" (${w.role}; model ${w.model}; autonomy L${w.autonomy_level}).`,
  'Diagnose why the output went wrong, in two or three plain sentences, then propose fixes that make the correction STICK — not just this once.',
  'Proposal kinds (use only the ones that help, at most one of each):',
  '- rerun: run the worker again now with changed instructions.',
  '- playbook: a rule to add to or change in the worker\'s playbook. "before" is the exact existing line you are replacing (empty if adding), "after" is the new rule. Rules are one line, concrete, testable ("Skip any product under $15 sell price or with fewer than 4.0 stars").',
  '- settings: change model, autonomy_level (0 draft, 1 queue, 2 act+notify; never above 0 for anything touching money) or enabled.',
  'Answer ONLY with JSON: {"reply":"your diagnosis","proposals":[{"kind":"rerun","instructions":"","why":""},{"kind":"playbook","playbook":"<name>","before":"","after":"","why":""},{"kind":"settings","model":"","autonomy_level":0,"why":""}]}',
  playbooks ? `Current playbooks this worker loads:\n${playbooks}` : 'This worker has no playbook yet; a playbook proposal will create one.',
].join('\n\n');

export const ROUTE_SYSTEM = (workers: { key: string; name: string; role: string; live: boolean }[]) => [
  'You are the Orchestrator. Marq just gave you an order. Pick the ONE worker best suited to do it, and rewrite the order as clear instructions for that worker.',
  `Workers:\n${workers.map((w) => `- ${w.key}: ${w.name} — ${w.role}${w.live ? '' : ' (not live yet)'}`).join('\n')}`,
  'If the order is about finding products on a channel, pick scout and set channel to one of tiktok, amazon, meta, etsy, walmart, rising.',
  'Answer ONLY with JSON: {"worker_key":"","channel":null,"instructions":"","reply":"one sentence telling Marq who you gave it to and what they will do"}',
].join('\n\n');
