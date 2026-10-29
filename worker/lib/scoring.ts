// Scores one AI output (spec Part 3): Logic (rules in code), Trust (sources
// present, reachable, fresh) and On-target (a cheap model compares it to
// what was asked). Writes one ai_output_scores row. Kept small per call: it
// runs inside one Worker invocation (an HTTP request or its own /__tick/score*),
// well under the free plan's 50 outside requests.
import type { Sb } from './sb';
import { ask } from './ai';
import { MODELS } from './models';
import { extractJson } from './scout';
import { zonedNow } from './sb';
import { approvalLogic, emailLogic, leadLogic, scoreChecks, trustFrom, urlsIn, overallOf } from '../../src/data/aiScores';
import type { Check, ScoreResult } from '../../src/data/aiScores';

export type OutputType = 'approval' | 'outreach' | 'lead' | 'gov_contract' | 'complaint';
const TZ = 'America/Denver';
/** Approval types built from outside research (they must cite sources). */
const RESEARCH = new Set(['product_card', 'product_pitch', 'supplier_pick', 'inspiration', 'trend', 'market_read', 'brand_read']);
const MAX_HEADS = 6;

/** A URL counts as reachable if the server answers at all (bot walls 401/403/405/429 still prove it exists). */
export const reachableStatus = (s: number) => s < 400 || [401, 403, 405, 429].includes(s);

async function reach(urls: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  await Promise.all(urls.slice(0, MAX_HEADS).map(async (u) => {
    const r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(6000) }).catch(() => null);
    out[u] = !!r && reachableStatus(r.status);
  }));
  return out;
}

const ON_TARGET_SYSTEM = `You check whether an AI worker's output matches what it was asked to do. Judge only fit to the request: right item, right scope, right constraints. Ignore writing quality.
Score 0-100: 90+ exactly what was asked; 60-89 mostly, with drift; under 60 wrong item, wrong scope, or breaks a stated rule (e.g. asked for oversized throw blankets, got a hoodie = under 20).
Reply with JSON only: {"score": 0, "reason": "one short line"}`;

async function onTarget(apiKey: string | undefined, sb: Sb, userId: string, domain: string, request: string, output: string): Promise<ScoreResult> {
  if (!apiKey || !request.trim()) return { score: null, checks: [] };
  try {
    const r = await ask(apiKey, sb, { model: MODELS.haiku, system: ON_TARGET_SYSTEM, user: `REQUEST:\n${request.slice(0, 2500)}\n\nOUTPUT:\n${output.slice(0, 5000)}`, maxTokens: 200, domain, userId, date: zonedNow(TZ).date });
    const j = extractJson(r.text) as { score?: unknown; reason?: unknown };
    const n = Math.max(0, Math.min(100, Math.round(Number(j.score))));
    if (!Number.isFinite(n)) return { score: null, checks: [] };
    return { score: n, checks: [{ name: 'Matches the request', pass: n >= 60, why: String(j.reason ?? '').slice(0, 240) }] };
  } catch (e) {
    return { score: null, checks: [{ name: 'On-target check', pass: false, why: `not run: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`, weight: 0 }] };
  }
}

/** What the worker was asked, in words, for each approval type. */
function requestFor(type: string, title: string, payload: Record<string, unknown>): string {
  const ins = typeof payload.instructions === 'string' && payload.instructions ? `\nExtra instructions: ${payload.instructions}` : '';
  if (type === 'supplier_pick') return `Find 3-5 suppliers selling exactly this product: ${String(payload.product ?? title.replace(/^Supplier Finder:\s*/, '').split(' — ')[0])}. Same item, size and material; low MOQ for a test; fast US shipping.${ins}`;
  if (type === 'product_card') return `Find one specific, physical, brandable product to dropship on ${String(payload.channel ?? 'TikTok Shop')}, $20-$80, at least $10 profit and 35% margin, light and unbreakable, demoable on video. Never: electronics, skincare, supplements, clothing, branded goods, vague product names, or groceries.${ins}`;
  if (type === 'product_pitch') return `Pitch the single best product that clears: at least $10 profit per order, 35% margin, $20-$80, light and unbreakable, with proof it is selling now.${ins}`;
  if (type === 'brand_options') return `Three distinct brand options for the product, reasoned from the buyer: name, .com, handles, positioning, voice, palette with reasons, type, logo direction.${ins}`;
  return `${title}${ins}`;
}

interface ApprovalRow { id: string; user_id: string; domain: string; type: string; title: string; payload: Record<string, unknown>; source_url: string | null; worker_id: string | null; created_at: string }

export async function scoreOutput(apiKey: string | undefined, sb: Sb, userId: string, type: OutputType, id: string): Promise<Record<string, unknown> | null> {
  let worker: string | null = null;
  let logic: ScoreResult = { score: null, checks: [] };
  let trust: ScoreResult = { score: null, checks: [] };
  let target: ScoreResult = { score: null, checks: [] };

  if (type === 'approval') {
    const [a] = await sb.get<ApprovalRow>(`ai_approvals?id=eq.${id}&user_id=eq.${userId}&select=id,user_id,domain,type,title,payload,source_url,worker_id,created_at`);
    if (!a) return null;
    if (a.worker_id) worker = (await sb.get<{ key: string }>(`ai_workers?id=eq.${a.worker_id}&select=key`))[0]?.key ?? null;
    worker ??= a.type;
    const p = a.payload ?? {};
    logic = approvalLogic(a.type, p);
    const urls = [...new Set([...(a.source_url ? [a.source_url] : []), ...urlsIn(p)])];
    let claims = 0, sourced = 0;
    if (a.type === 'supplier_pick') {
      const sups = Array.isArray(p.suppliers) ? (p.suppliers as Record<string, unknown>[]) : [];
      claims = sups.length; sourced = sups.filter((s) => s.url || (Array.isArray(s.evidence) && s.evidence.length)).length;
    } else if (a.type === 'product_card') {
      const sig = ((p.row as Record<string, unknown> | undefined)?.detail as Record<string, unknown> | undefined)?.card as Record<string, unknown> | undefined;
      const signals = (sig?.signals ?? {}) as Record<string, { seen?: boolean | null; url?: string | null }>;
      const seen = Object.values(signals).filter((x) => x && typeof x === 'object' && 'seen' in x && x.seen);
      claims = seen.length; sourced = seen.filter((x) => x.url).length;
    }
    const asOf = (((p.row as Record<string, unknown> | undefined)?.as_of as string | undefined) ?? null);
    trust = trustFrom({ urls, reachable: urls.length ? await reach(urls) : {}, claims, sourcedClaims: sourced, asOf, needsSources: RESEARCH.has(a.type) });
    target = await onTarget(apiKey, sb, userId, a.domain || 'ecom', requestFor(a.type, a.title, p), JSON.stringify({ title: a.title, ...p }));
  } else if (type === 'outreach') {
    const [o] = await sb.get<{ id: string; lead_id: string | null; place_id: string | null; business_name: string; finding_kind: string | null; subject: string | null; body: string | null }>(`lead_outreach?id=eq.${id}&user_id=eq.${userId}&select=id,lead_id,place_id,business_name,finding_kind,subject,body`);
    if (!o) return null;
    worker = 'outreach';
    const kinds = o.place_id ? (await sb.get<{ kind: string }>(`lead_findings?user_id=eq.${userId}&place_id=eq.${encodeURIComponent(o.place_id)}&select=kind`)).map((k) => k.kind) : [];
    logic = emailLogic(o, kinds);
    trust = { score: null, checks: [{ name: 'Built from your own site audit', pass: true, why: 'no outside research' }] };
    const nameOk = !!o.body && o.body.toLowerCase().includes(o.business_name.split(' ')[0].toLowerCase());
    const checks: Check[] = [{ name: 'Written to this business', pass: nameOk, why: nameOk ? 'names the business' : 'business name missing' }, { name: 'About the problem found', pass: !!o.finding_kind && kinds.includes(o.finding_kind), why: o.finding_kind ?? 'none' }];
    target = { score: scoreChecks(checks), checks };
  } else if (type === 'lead') {
    const [l] = await sb.get<{ id: string; place_id: string; phone: string | null; website: string | null; status: string | null; is_chain: boolean | null; business_size: string | null; city: string | null }>(`leads?id=eq.${id}&select=id,place_id,phone,website,status,is_chain,business_size,city`);
    if (!l) return null;
    worker = 'client_finder';
    logic = leadLogic(l);
    const f = await sb.get<{ kind: string; evidence: Record<string, unknown> }>(`lead_findings?user_id=eq.${userId}&place_id=eq.${encodeURIComponent(l.place_id)}&kind=neq.checked&select=kind,evidence`);
    const urls = urlsIn(f.map((x) => x.evidence));
    trust = trustFrom({ urls, reachable: {}, claims: f.length, sourcedClaims: f.filter((x) => x.kind === 'no_website' || urlsIn(x.evidence).length).length, needsSources: false });
    target = { score: f.length ? 100 : 30, checks: [{ name: 'Has a fixable website problem', pass: f.length > 0, why: f.map((x) => x.kind).join(', ') || 'none found' }] };
  } else if (type === 'gov_contract') {
    const [c] = await sb.get<{ id: string; amount: number | null; recipient: string | null; url: string | null; quiz: unknown[]; brief: Record<string, unknown>; created_at: string }>(`gov_contracts?id=eq.${id}&user_id=eq.${userId}&select=id,amount,recipient,url,quiz,brief,created_at`);
    if (!c) return null;
    worker = 'govcon';
    const checks: Check[] = [
      { name: 'Has an amount', pass: Number(c.amount) > 0, why: c.amount != null ? `$${Math.round(Number(c.amount)).toLocaleString('en-US')}` : 'missing' },
      { name: 'Has a winner', pass: !!c.recipient, why: c.recipient ?? 'missing' },
      { name: 'Quiz has 3 questions', pass: Array.isArray(c.quiz) && c.quiz.length === 3, why: `${Array.isArray(c.quiz) ? c.quiz.length : 0}` },
      { name: 'Breakdown complete', pass: !!(c.brief?.who && c.brief?.how && c.brief?.play), why: 'who / how / play' },
    ];
    logic = { score: scoreChecks(checks), checks };
    const urls = c.url ? [c.url] : [];
    trust = trustFrom({ urls, reachable: urls.length ? await reach(urls) : {}, claims: 1, sourcedClaims: urls.length, needsSources: true });
  } else if (type === 'complaint') {
    const [k] = await sb.get<{ id: string; quotes: { url?: string }[]; repeat_count: number; tag: string | null; found_on: string }>(`complaint_clusters?id=eq.${id}&user_id=eq.${userId}&select=id,quotes,repeat_count,tag,found_on`);
    if (!k) return null;
    worker = 'complaint_scanner';
    const q = Array.isArray(k.quotes) ? k.quotes : [];
    const checks: Check[] = [{ name: 'At least 2 quotes', pass: q.length >= 2, why: `${q.length}` }, { name: 'Repeat count matches quotes', pass: k.repeat_count >= q.length, why: `${k.repeat_count} vs ${q.length}` }];
    logic = { score: scoreChecks(checks), checks };
    const urls = urlsIn(q);
    trust = trustFrom({ urls, reachable: urls.length ? await reach(urls) : {}, claims: q.length, sourcedClaims: q.filter((x) => x.url).length, asOf: k.found_on, needsSources: true });
    target = { score: k.tag === 'can_do_now' ? 95 : 60, checks: [{ name: 'Something Made by can fix now', pass: k.tag === 'can_do_now', why: k.tag ?? 'new' }] };
  }

  const row = {
    user_id: userId, worker, output_type: type, output_id: id,
    logic: logic.score, trust: trust.score, on_target: target.score, overall: overallOf(logic.score, trust.score, target.score),
    checks: { logic: logic.checks, trust: trust.checks, on_target: target.checks }, updated_at: new Date().toISOString(),
  };
  await sb.insert('ai_output_scores', row, { upsert: 'output_type,output_id' });
  return row;
}

/** Five-minute timer: score up to `n` recent outputs that have no score yet —
 *  approval cards first, then email drafts, GovCon contracts and complaint
 *  clusters. Leads are scored when they're looked at (there are hundreds). */
export async function runScoreTick(apiKey: string | undefined, sb: Sb, n = 2): Promise<number> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const sources: { type: OutputType; path: string }[] = [
    { type: 'approval', path: `ai_approvals?status=eq.pending&created_at=gte.${since}&order=created_at.desc&limit=60&select=id,user_id` },
    { type: 'outreach', path: `lead_outreach?status=eq.drafted&archived_at=is.null&created_at=gte.${since}&order=created_at.desc&limit=60&select=id,user_id` },
    { type: 'gov_contract', path: `gov_contracts?created_at=gte.${since}&order=created_at.desc&limit=30&select=id,user_id` },
    { type: 'complaint', path: `complaint_clusters?archived_at=is.null&created_at=gte.${since}&order=created_at.desc&limit=30&select=id,user_id` },
  ];
  let done = 0;
  for (const src of sources) {
    if (done >= n) break;
    const recent = await sb.get<{ id: string; user_id: string }>(src.path).catch(() => []);
    if (!recent.length) continue;
    const have = new Set((await sb.get<{ output_id: string }>(`ai_output_scores?output_type=eq.${src.type}&output_id=in.(${recent.map((r) => r.id).join(',')})&select=output_id`).catch(() => [])).map((r) => r.output_id));
    for (const r of recent) {
      if (done >= n) break;
      if (have.has(r.id)) continue;
      await scoreOutput(apiKey, sb, r.user_id, src.type, r.id).catch((e) => console.error('score', src.type, r.id, e));
      done++;
    }
  }
  return done;
}
