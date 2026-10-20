// /api/govcon/* — the GovCon section in Orchestrator.
//   POST briefing  pull 3 new contracts from USAspending and write the briefs + quizzes (Claude)
//   POST explain   plain meanings for flagged words that don't have one yet (Claude, Haiku)
//   POST lead      add a contract's winner to LeadFlow (winners often need hiring pages, sites, marketing)
// Reading, quiz answers, predictions, flags and watch lists are saved straight
// from the app (RLS "own rows").
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { ask, CapReached } from '../lib/ai';
import { MODELS } from '../lib/models';
import { extractJson } from '../lib/scout';
import { USASPENDING, AWARD_FIELDS_MIN, awardsQuery, toAward, pickAwards, BRIEF_SYSTEM, briefUser, parseBriefs, WORDS_SYSTEM, type Award } from '../lib/govcon';

export type GovconEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string; ANTHROPIC_API_KEY?: string };
const TZ = 'America/Denver';
const DOMAIN = 'govcon';

async function fetchAwards(body: Record<string, unknown>): Promise<{ awards: Award[]; error?: string }> {
  const go = (b: Record<string, unknown>) => fetch(USASPENDING, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  let res = await go(body).catch(() => null);
  // A field name the API no longer accepts: ask again with the basics.
  if (res && res.status >= 400 && res.status < 500) res = await go({ ...body, fields: AWARD_FIELDS_MIN }).catch(() => null);
  if (!res) return { awards: [], error: "Couldn't reach USAspending.gov." };
  if (!res.ok) return { awards: [], error: `USAspending.gov answered ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  return { awards: (data.results ?? []).map(toAward).filter((a): a is Award => !!a) };
}

export async function govconRoute(request: Request, env: GovconEnv, path: string): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set.' }, 500);
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const sb = new Sb(env);
  const uid = user.id;
  const today = zonedNow(TZ).date;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (path === 'briefing') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: "Claude isn't connected (ANTHROPIC_API_KEY)." }, 503);
      const [settings] = await sb.get<{ states: string[]; keywords: string[]; per_day: number }>(`gov_settings?user_id=eq.${uid}&select=states,keywords,per_day&limit=1`);
      const states = settings?.states?.length ? settings.states : ['UT'];
      const keywords = settings?.keywords ?? [];
      const n = Math.max(1, Math.min(5, settings?.per_day ?? 3));
      const now = new Date();
      const [local, national] = await Promise.all([
        fetchAwards(awardsQuery({ now, states, keywords })),
        fetchAwards(awardsQuery({ now, keywords })),
      ]);
      if (!local.awards.length && !national.awards.length) return json({ error: local.error ?? national.error ?? 'No new contracts found for your watch list. Try fewer keywords.' }, 502);
      const seenRows = await sb.get<{ award_id: string }>(`gov_contracts?user_id=eq.${uid}&select=award_id&limit=5000`);
      const picks = pickAwards(local.awards, national.awards, new Set(seenRows.map((r) => r.award_id)), n);
      if (!picks.length) return json({ error: "You've already read every big new contract on your watch list. Widen the watch list or try tomorrow." }, 404);

      const r = await ask(env.ANTHROPIC_API_KEY, sb, { model: MODELS.sonnet, system: BRIEF_SYSTEM, user: briefUser(picks), maxTokens: 6000, domain: DOMAIN, userId: uid, date: today });
      const briefs = parseBriefs(r.text, picks.map((p) => p.award_id));
      if (!briefs.size) return json({ error: "Claude's answer couldn't be read. Press the button again." }, 502);
      const rows = picks.filter((p) => briefs.has(p.award_id)).map((p) => ({
        user_id: uid, briefing_date: today, award_id: p.award_id, internal_id: p.internal_id, recipient: p.recipient, amount: p.amount, agency: p.agency,
        sub_agency: p.sub_agency, description: p.description, state: p.state, naics: p.naics, start_date: p.start_date, end_date: p.end_date, url: p.url,
        brief: briefs.get(p.award_id)!.brief, quiz: briefs.get(p.award_id)!.quiz,
      }));
      const saved = await sb.insert('gov_contracts', rows, { upsert: 'user_id,award_id' });
      return json({ ok: true, count: saved.length, costUsd: r.costUsd });
    }

    if (path === 'explain') {
      if (!env.ANTHROPIC_API_KEY) return json({ error: "Claude isn't connected (ANTHROPIC_API_KEY)." }, 503);
      const pending = await sb.get<{ id: string; word: string; context: string | null }>(`gov_words?user_id=eq.${uid}&meaning=is.null&select=id,word,context&limit=30`);
      if (!pending.length) return json({ ok: true, explained: 0 });
      const r = await ask(env.ANTHROPIC_API_KEY, sb, {
        model: MODELS.haiku, system: WORDS_SYSTEM, maxTokens: 2000, domain: DOMAIN, userId: uid, date: today,
        user: pending.map((w) => `${w.word}${w.context ? ` — seen in: "${w.context.slice(0, 200)}"` : ''}`).join('\n'),
      });
      let words: { word?: string; meaning?: string }[] = [];
      try { words = ((extractJson(r.text) as { words?: typeof words }).words ?? []); } catch { /* none */ }
      const by = new Map(words.filter((w) => w.word && w.meaning).map((w) => [w.word!.trim().toLowerCase(), w.meaning!.trim().slice(0, 600)]));
      let n = 0;
      for (const w of pending) { const m = by.get(w.word.toLowerCase()); if (m) { await sb.patch('gov_words', `id=eq.${w.id}`, { meaning: m }); n++; } }
      return json({ ok: true, explained: n });
    }

    if (path === 'lead') {
      const id = typeof body.contractId === 'string' && /^[0-9a-f-]{36}$/i.test(body.contractId) ? body.contractId : '';
      if (!id) return json({ error: 'contractId is required.' }, 400);
      const [c] = await sb.get<{ id: string; award_id: string; recipient: string | null; state: string | null; agency: string | null; amount: number | null; description: string | null; lead_id: string | null }>(`gov_contracts?id=eq.${id}&user_id=eq.${uid}&select=id,award_id,recipient,state,agency,amount,description,lead_id&limit=1`);
      if (!c) return json({ error: 'Contract not found.' }, 404);
      if (c.lead_id) return json({ ok: true, leadId: c.lead_id, already: true });
      const name = (c.recipient ?? 'Unknown winner').trim();
      const key = `gov:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}`;
      const [existing] = await sb.get<{ id: string }>(`leads?place_id=eq.${encodeURIComponent(key)}&select=id&limit=1`);
      const leadId = existing?.id ?? (await sb.insert<{ id: string }>('leads', {
        place_id: key, business_name: name, state: c.state, status: 'new', tag: 'govcon', category: 'government contractor', search_category: 'government contractor',
        summary: `Just won a $${Math.round(Number(c.amount ?? 0)).toLocaleString('en-US')} contract from ${c.agency ?? 'a federal agency'}: ${(c.description ?? '').slice(0, 200)}. Likely needs hiring pages, a better site, or marketing for the new work.`,
      }, { upsert: 'place_id', ignore: true }))[0]?.id;
      if (!leadId) return json({ error: "Couldn't add the lead." }, 502);
      await sb.patch('gov_contracts', `id=eq.${c.id}`, { lead_id: leadId });
      return json({ ok: true, leadId });
    }
  } catch (e) {
    if (e instanceof CapReached) return json({ error: `${e.message} Raise the govcon cap in HQ if you want more today.` }, 429);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
  return json({ error: `Unknown GovCon route: ${path}` }, 404);
}
