// View Office — pure parts of the orchestrator loop: its reply format,
// proposal validation, the playbook before/after edit, and task routing.
import { extractJson } from './scout';
import { PLAYBOOK_MAX_CHARS } from '../../src/data/ecom';

export type Proposal =
  | { kind: 'rerun'; instructions: string; why: string; applied_at?: string }
  | { kind: 'playbook'; playbook: string; before: string; after: string; why: string; applied_at?: string }
  | { kind: 'settings'; model?: string; autonomy_level?: number; enabled?: boolean; why: string; applied_at?: string };

import { ALLOWED_MODELS } from './models';
export { ALLOWED_MODELS };
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
    if (kind === 'rerun' && str(p.instructions)) { out.push({ kind, instructions: str(p.instructions).slice(0, PLAYBOOK_MAX_CHARS), why }); seen.add(kind); }
    if (kind === 'playbook' && str(p.after)) {
      const name = str(p.playbook);
      out.push({ kind, playbook: playbookNames.includes(name) || name.startsWith('worker:') ? name : defaultPlaybook, before: str(p.before), after: str(p.after).slice(0, PLAYBOOK_MAX_CHARS), why });
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

export type RouteDomain = 'ecom' | 'content' | 'marketing';
export interface RouteDecision { workerKey: string | null; instructions: string; channel: string | null; reply: string; productId: string | null; scriptChannel: string | null; domain: RouteDomain | null }
export function parseRoute(text: string, allowedKeys: string[]): RouteDecision {
  let obj: Record<string, unknown>;
  try { obj = extractJson(text) as Record<string, unknown>; } catch { return { workerKey: null, instructions: '', channel: null, reply: text.trim(), productId: null, scriptChannel: null, domain: null }; }
  const key = str(obj.worker_key);
  const channel = str(obj.channel);
  return {
    workerKey: allowedKeys.includes(key) ? key : null,
    instructions: str(obj.instructions).slice(0, PLAYBOOK_MAX_CHARS),
    channel: ['tiktok', 'amazon', 'meta', 'etsy', 'walmart', 'rising'].includes(channel) ? channel : null,
    reply: str(obj.reply),
    productId: /^[0-9a-f-]{36}$/i.test(str(obj.product_id)) ? str(obj.product_id) : null,
    scriptChannel: ['call', 'voicemail', 'email', 'dm', 'landing'].includes(str(obj.script_channel)) ? str(obj.script_channel) : null,
    domain: (['ecom', 'content', 'marketing'] as const).find((d) => d === str(obj.domain)) ?? null,
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

export const ROUTE_SYSTEM = (workers: { key: string; name: string; role: string; live: boolean }[], products: { id: string; name: string }[] = []) => [
  'You are the Orchestrator. Marq just gave you an order. Pick the ONE worker best suited to do it, and rewrite the order as clear instructions for that worker.',
  `Workers:\n${workers.map((w) => `- ${w.key}: ${w.name} — ${w.role}${w.live ? '' : ' (not live yet)'}`).join('\n')}`,
  'If the order is about finding products on a channel, pick scout and set channel to one of tiktok, amazon, meta, etsy, walmart, rising.',
  'Analyst and Teardown work on one product: set product_id to the matching product from the list below (null if none matches).',
  'Script & Copy writes for one channel: set script_channel to call, voicemail, email, dm or landing.',
  products.length ? `Products in the sheet:\n${products.map((p) => `- ${p.id}: ${p.name}`).join('\n')}` : '',
  'Answer ONLY with JSON: {"worker_key":"","channel":null,"product_id":null,"script_channel":null,"instructions":"","reply":"one sentence telling Marq who you gave it to and what they will do"}',
].filter(Boolean).join('\n\n');

/** HQ's first hop (brief §2a): which domain orchestrator gets Marq's order. */
export const HQ_ROUTE_SYSTEM = [
  'You are HQ, the master orchestrator. Marq talks only to you. Decide which domain orchestrator should take his message, or answer it yourself if it is a question about the business as a whole.',
  'Domains: ecom (product research, brands, stores, suppliers, orders), content (social accounts, posts, ideas, clips, performance), marketing (Masterminds and Made by Marq growth, campaigns, leads, cold calling scripts, offers, budget).',
  'Answer ONLY with JSON: {"domain":"ecom|content|marketing|null","reply":"one or two sentences to Marq","instructions":"the order rewritten for that orchestrator, or empty"}',
].join('\n\n');
