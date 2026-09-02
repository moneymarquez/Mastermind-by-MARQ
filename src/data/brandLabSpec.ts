import { askClaude, extractJson } from '../lib/ai';
import type { BrandLabBrief, FunctionalSpec, Niche, SpecFunctionality, SpecFunctionalityKind, SpecPage } from './types';

const KINDS: SpecFunctionalityKind[] = ['static', 'form', 'integration', 'dynamic'];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || Math.random().toString(36).slice(2, 8);
}

/** The brief as the model should see it — only what was actually captured.
 *  Shared with the prompt generator so both reason from the same text. */
export function briefSummary(brief: BrandLabBrief, niche: Niche | null): string {
  const lines: string[] = [];
  const nicheName = brief.niche_slug === 'other' ? (brief.niche_custom || 'other') : (niche?.name ?? brief.niche_slug ?? 'unspecified');
  lines.push(`Business: ${brief.business || brief.direction}`);
  lines.push(`Niche: ${nicheName}`);
  if (brief.audience) lines.push(`Audience: ${brief.audience}`);
  if (brief.bottleneck_verbatim) lines.push(`Their bottleneck, in their words: "${brief.bottleneck_verbatim}"`);
  if (brief.services) lines.push(`Services / products: ${brief.services}`);
  if (brief.geography) lines.push(`Service area: ${brief.geography}`);
  if (brief.budget) lines.push(`Budget mentioned: ${brief.budget}`);
  if (brief.wants) lines.push(`They explicitly want: ${brief.wants}`);
  if (brief.dont_wants) lines.push(`They explicitly do NOT want: ${brief.dont_wants}`);
  if (brief.competitors) lines.push(`Competitors / references they named: ${brief.competitors}`);
  const refs = [brief.reference_url_1, brief.reference_url_2, brief.reference_url_3].filter(Boolean);
  if (refs.length) lines.push(`Reference sites: ${refs.join(', ')}`);
  if (brief.quotes.length) lines.push(`Direct quotes: ${brief.quotes.map((q) => `"${q}"`).join(' | ')}`);
  if (brief.tone) lines.push(`Tone: ${brief.tone}`);
  if (brief.color_pref) lines.push(`Color preference: ${brief.color_pref}`);
  return lines.join('\n');
}

export function nicheSummary(niche: Niche | null, customNiche: string | null): string {
  if (!niche || niche.slug === 'other') {
    return `Niche: ${customNiche || 'other'} — NO stored research for this niche. Reason from first principles: who buys, what triggers the purchase, what the site must do, what trust looks like in this category. State the reasoning briefly.`;
  }
  const list = (label: string, arr: string[]) => (arr.length ? `${label}:\n${arr.map((x) => `- ${x}`).join('\n')}` : '');
  return [
    `Niche: ${niche.name}`,
    `Buyer context: ${niche.buyer_context}`,
    list('Standard sections for this niche', niche.standard_sections),
    list('Required functionality (non-negotiable)', niche.required_functionality),
    list('Trust signals that matter', niche.trust_signals),
    list('Common mistakes to avoid', niche.common_mistakes),
    niche.visual_conventions ? `Visual conventions: ${niche.visual_conventions}` : '',
    niche.benchmark_sites.length ? `Benchmark sites (why each works):\n${niche.benchmark_sites.map((b) => `- ${b.url}${b.note ? ` — ${b.note}` : ''}`).join('\n')}` : '',
    niche.keywords.length ? `Keywords: ${niche.keywords.join(', ')}` : '',
  ].filter(Boolean).join('\n\n');
}

/** Brief + niche → the one functional spec both prompts inherit from.
 *  Runs at medium effort: this is the decision that fixes scope for the
 *  whole project, and it's reviewed by a human before anything else is
 *  generated, so a slower, better answer here is the cheap option. */
export async function generateFunctionalSpec(brief: BrandLabBrief, niche: Niche | null): Promise<FunctionalSpec> {
  const text = await askClaude({
    system:
      'You are a senior web strategist producing a FUNCTIONAL SPEC for a small-business website before any design ' +
      'work starts. The spec decides what the site DOES; a separate design step decides what it looks like. Be ' +
      'concrete and conservative — the operator would rather approve a tight spec than trim a bloated one. Respond ' +
      'with ONLY a JSON object, no prose:\n' +
      '{\n' +
      '  "summary": one paragraph, unambiguous, what is being built and for whom,\n' +
      '  "pages": [{"name": string, "purpose": one line, "sections": [ordered section names]}] — every page, ' +
      'sections in reading order; a one-page site is one page with many sections,\n' +
      '  "functionality": [{"label": what it does, "kind": "static"|"form"|"integration"|"dynamic", "page": page name ' +
      'or null for site-wide}] — EVERY interactive thing. static = content/links/anchor scroll, no backend. form = ' +
      'collects data, needs storage + notification. integration = Stripe, calendar, maps, reviews, booking. dynamic = ' +
      'needs a database and an owner admin surface,\n' +
      '  "data_model": [strings] — what gets stored, if anything (empty array if nothing),\n' +
      '  "admin_needs": [strings] — what the owner must be able to change without a developer,\n' +
      '  "out_of_scope": [strings] — explicit, so neither the design tool nor the build tool invents it\n' +
      '}\n' +
      'Rules: only include functionality the niche research or the client\'s own words justify. Do not add a blog, ' +
      'a CMS, accounts, or e-commerce unless the brief calls for it. Anything the client said they do NOT want goes ' +
      'in out_of_scope verbatim. If the brief has a budget, respect it — a $1,500 site is not a portal.',
    messages: [{ role: 'user', content: `BRIEF\n${briefSummary(brief, niche)}\n\nNICHE RESEARCH\n${nicheSummary(niche, brief.niche_custom)}` }],
    maxTokens: 3000,
    effort: 'medium',
  });
  const raw = extractJson<{
    summary?: string;
    pages?: { name?: string; purpose?: string; sections?: string[] }[];
    functionality?: { label?: string; kind?: string; page?: string | null }[];
    data_model?: string[];
    admin_needs?: string[];
    out_of_scope?: string[];
  }>(text);

  const pages: SpecPage[] = (raw.pages ?? [])
    .filter((p) => p.name)
    .map((p) => ({ id: slug(p.name as string), name: (p.name as string).trim(), purpose: (p.purpose ?? '').trim(), sections: (p.sections ?? []).map((s) => String(s).trim()).filter(Boolean), enabled: true }));
  const pageIdByName = new Map(pages.map((p) => [p.name.toLowerCase(), p.id]));

  const functionality: SpecFunctionality[] = (raw.functionality ?? [])
    .filter((f) => f.label)
    .map((f, i) => ({
      id: `${slug(f.label as string)}-${i}`,
      label: (f.label as string).trim(),
      kind: KINDS.includes(f.kind as SpecFunctionalityKind) ? (f.kind as SpecFunctionalityKind) : 'static',
      page_id: f.page ? pageIdByName.get(String(f.page).toLowerCase()) ?? null : null,
      enabled: true,
    }));

  const strs = (arr: unknown): string[] => (Array.isArray(arr) ? arr.map((x) => String(x).trim()).filter(Boolean) : []);
  return {
    summary: (raw.summary ?? '').trim(),
    pages,
    functionality,
    data_model: strs(raw.data_model),
    admin_needs: strs(raw.admin_needs),
    out_of_scope: strs(raw.out_of_scope),
    generated_at: new Date().toISOString(),
  };
}
