import { askClaude } from '../lib/ai';
import { briefSummary, nicheSummary } from './brandLabSpec';
import type { BrandLabBrief, BrandLabPrompts, FunctionalSpec, Niche, SpecFunctionalityKind } from './types';

// The Design and Fable prompts are ASSEMBLED, not generated — a template
// over the approved spec + niche + brief. Same input, same prompt, every
// time; instant; and the thing that makes prompts better per client is
// the niche data (benchmarks, conventions), which is the lever the
// operator actually controls. Only the imagery block is model-drafted,
// because writing a usable Higgsfield prompt for one specific business in
// one specific region needs creativity a template can't fake.

const KIND_LABEL: Record<SpecFunctionalityKind, string> = {
  static: 'static (no backend)',
  form: 'form (collects data → storage + notification)',
  integration: 'integration (third-party service)',
  dynamic: 'dynamic (database + owner admin)',
};

function enabledSpec(spec: FunctionalSpec) {
  const pages = spec.pages.filter((p) => p.enabled);
  const pageIds = new Set(pages.map((p) => p.id));
  const functionality = spec.functionality.filter((f) => f.enabled && (f.page_id === null || pageIds.has(f.page_id)));
  return { pages, functionality };
}

/** The spec, verbatim, as both prompts quote it. */
export function specText(spec: FunctionalSpec): string {
  const { pages, functionality } = enabledSpec(spec);
  const pageName = (id: string | null) => (id ? pages.find((p) => p.id === id)?.name ?? 'site-wide' : 'site-wide');
  const lines: string[] = [];
  lines.push(`SUMMARY\n${spec.summary}`);
  lines.push('PAGES AND SECTIONS (in order)');
  for (const p of pages) {
    lines.push(`- ${p.name}${p.purpose ? ` — ${p.purpose}` : ''}`);
    p.sections.forEach((s, i) => lines.push(`    ${i + 1}. ${s}`));
  }
  lines.push('FUNCTIONALITY (every interactive thing, tagged)');
  functionality.forEach((f) => lines.push(`- [${f.kind}] ${f.label} — ${pageName(f.page_id)}`));
  lines.push(`DATA MODEL\n${spec.data_model.length ? spec.data_model.map((d) => `- ${d}`).join('\n') : '- Nothing stored. Static site.'}`);
  lines.push(`OWNER MUST BE ABLE TO CHANGE WITHOUT A DEVELOPER\n${spec.admin_needs.length ? spec.admin_needs.map((d) => `- ${d}`).join('\n') : '- Nothing listed.'}`);
  lines.push(`OUT OF SCOPE (explicit — do not build, do not design)\n${spec.out_of_scope.length ? spec.out_of_scope.map((d) => `- ${d}`).join('\n') : '- Nothing listed.'}`);
  return lines.join('\n\n');
}

/** Scope guard for the Design prompt: it may only ask for UI the spec
 *  authorized. Anything the niche's required_functionality lists that the
 *  approved spec does NOT include gets flagged back to the operator — it
 *  is never quietly added to the prompt. */
export function scopeFlags(spec: FunctionalSpec, niche: Niche | null): string[] {
  if (!niche || niche.slug === 'other') return [];
  const { functionality } = enabledSpec(spec);
  const have = functionality.map((f) => f.label.toLowerCase());
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  return niche.required_functionality
    .filter((req) => {
      const ws = words(req);
      return !have.some((h) => ws.filter((w) => h.includes(w)).length >= Math.max(1, Math.ceil(ws.length / 2)));
    })
    .map((req) => `Niche research lists "${req}" as required, but the approved spec doesn't include it — left out of the Design prompt. Unlock the spec and add it if it belongs.`);
}

export function buildDesignPrompt(brief: BrandLabBrief, spec: FunctionalSpec, niche: Niche | null, imagery: string): string {
  const { pages } = enabledSpec(spec);
  const nicheName = brief.niche_slug === 'other' ? (brief.niche_custom || 'this business') : (niche?.name ?? 'this business');
  const benchmarks = niche?.benchmark_sites.length
    ? niche.benchmark_sites.map((b) => `- ${b.url}${b.note ? ` — why it works: ${b.note}` : ''}`).join('\n')
    : '(none on file yet — reason from the conventions below)';
  return [
    `# Website design brief — ${brief.business || brief.direction}`,
    '',
    'You are designing a complete website for a real small business. Produce the actual design — every page and section listed below, mobile first — not a moodboard. Deliverable format is at the end.',
    '',
    '## The business',
    briefSummary(brief, niche),
    '',
    `## Niche: ${nicheName}`,
    nicheSummary(niche, brief.niche_custom),
    '',
    '## Benchmark sites (what to learn from)',
    benchmarks,
    '',
    '## Tone and color',
    `Tone: ${brief.tone ?? 'Minimal & calm'}.`,
    brief.color_pref ? `Color direction: ${brief.color_pref}.` : 'Color: your judgment, grounded in the niche conventions above and the decision to follow or break them — state which.',
    '',
    '## Approved structure — design exactly this, in this order',
    pages.map((p) => `### ${p.name}${p.purpose ? `\n${p.purpose}` : ''}\n${p.sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}`).join('\n\n'),
    '',
    '## Interactive elements you may design (and only these)',
    enabledSpec(spec).functionality.map((f) => `- ${f.label} — ${KIND_LABEL[f.kind]}`).join('\n'),
    'Do not add UI for any functionality not in this list. If a section seems to need something that isn\'t here, design it as static content and note the gap — do not invent a booking flow, a login, a cart, or a dashboard.',
    '',
    '## Non-goals',
    spec.out_of_scope.length ? spec.out_of_scope.map((d) => `- ${d}`).join('\n') : '- Nothing beyond the structure above.',
    brief.dont_wants ? `- The client explicitly does not want: ${brief.dont_wants}` : '',
    '',
    '## Required states',
    '- Mobile at 375px is the primary view; desktop is derived from it.',
    '- Every form: empty, filled, submitting, success, error.',
    '- Every list or feed (reviews, gallery, schedule): loading, empty, populated.',
    '- 16px minimum on inputs.',
    '',
    '## Content honesty',
    'Use ONLY the real content in this brief (business facts, services, the client\'s own quotes). Where real content doesn\'t exist yet — reviews, photos, team names, prices — design an honest, clearly-labeled empty state or a "[needs real photo of X]" slot. No lorem ipsum, no invented testimonials, no fake review counts, no stock-photo faces.',
    '',
    imagery ? `## Imagery — generate with Higgsfield\n${imagery}` : '',
    '',
    '## Deliverable',
    'Export the full design as a single self-contained HTML file (inline CSS, no external dependencies) plus, for each page, a short note on the one decision you made that departs from the niche convention and why. That HTML gets pasted back for scoring against this brief.',
  ].filter((l) => l !== null && l !== undefined).join('\n');
}

/** `design` is the locked Claude Design HTML (step 6) — when present it
 *  rides in slot 6 verbatim; when absent slot 6 is an explicit paste
 *  marker so the prompt is never silently missing its design. */
export function buildFablePrompt(brief: BrandLabBrief, spec: FunctionalSpec, design?: string | null): string {
  const { functionality } = enabledSpec(spec);
  const forms = functionality.filter((f) => f.kind === 'form');
  const integrations = functionality.filter((f) => f.kind === 'integration');
  const dynamic = functionality.filter((f) => f.kind === 'dynamic');
  const business = brief.business || brief.direction;
  const criteria: string[] = [
    'The site builds with zero errors and zero warnings that indicate broken behavior.',
    'Every page and section in the approved spec exists, in the specified order, with the specified purpose.',
    'Every internal link and nav item resolves to a real page or anchor. No dead links.',
    'The site is fully usable at 375px wide with no horizontal scroll, no overlapped tap targets, and all inputs at 16px or larger.',
    'No placeholder content anywhere: no lorem ipsum, no "John Doe", no invented testimonials, no fabricated review counts or stats. Missing real content renders as an honest, labeled empty state.',
    'No console errors on any page in a clean browser session.',
    'Lighthouse Performance ≥ 85 and Accessibility ≥ 90 on mobile for the home page.',
    'Deploys to Cloudflare from a clean clone with the documented commands and runs.',
  ];
  forms.forEach((f) => criteria.push(`"${f.label}" submits, stores the submission, and notifies the owner; a failed submission shows an error and keeps the user's input.`));
  integrations.forEach((f) => criteria.push(`"${f.label}" is wired to the real service (test mode where applicable) and its failure state is handled visibly.`));
  if (integrations.some((f) => /stripe|pay|checkout/i.test(f.label))) criteria.push('A Stripe test-mode payment completes end to end and the confirmation is shown to the user.');
  dynamic.forEach((f) => criteria.push(`"${f.label}": the owner can create/edit/remove its content through the admin surface without touching code.`));

  return [
    `# Build brief — ${business}`,
    '',
    '## 1. What is being built',
    spec.summary || `A production website for ${business}.`,
    '',
    '## 2. Approved functional spec (verbatim — this is the contract)',
    specText(spec),
    '',
    '## 3. Stack',
    '- Deploy target: Cloudflare (Workers with static assets, or Pages) — the operator will SSH/CLI in and run it, so document the exact commands.',
    '- Frontend: a static-first build (Vite + React/TypeScript, or plain HTML/CSS/JS if the spec has no dynamic functionality — choose the lightest thing that meets the spec and say why).',
    forms.length || dynamic.length ? '- Data: Cloudflare D1 or Supabase for anything the spec stores; pick one, justify it, keep it minimal.' : '- Data: none required by the spec. Do not add a database.',
    '- No paid services beyond what the integrations below require.',
    '',
    '## 4. Data model',
    spec.data_model.length ? spec.data_model.map((d) => `- ${d}`).join('\n') : '- None. Nothing is stored.',
    '',
    '## 5. Integrations — each with its intended behavior',
    integrations.length || forms.length
      ? [...integrations, ...forms].map((f) => `- ${f.label} [${f.kind}] — must work end to end; failure states visible to the user; owner notified where data is collected.`).join('\n')
      : '- None.',
    '',
    '## 6. The design',
    design
      ? `The approved Claude Design output (locked in Brand Lab). Implement it faithfully; where the design and the spec disagree, the spec wins and you note the conflict.\n\n\`\`\`html\n${design.trim()}\n\`\`\``
      : '>>> PASTE THE APPROVED CLAUDE DESIGN OUTPUT HERE (the HTML export). Implement it faithfully; where the design and the spec disagree, the spec wins and you note the conflict. <<<',
    '',
    '## 7. Acceptance criteria — numbered, testable',
    criteria.map((c, i) => `${i + 1}. ${c}`).join('\n'),
    '',
    '## 8. Verification requirement',
    'Before reporting completion, test your own work against every numbered criterion above and report the result per item as PASS or FAIL with evidence (what you ran, what you saw). Do not claim a criterion passes because it should; run it. A FAIL with a clear reason is acceptable; an unverified PASS is not.',
    '',
    '## 9. Deploy',
    'Provide: the repo layout, the exact Cloudflare deploy commands, every environment variable and secret with where it comes from, and the one-command local run. Assume the operator is on a phone or a fresh laptop with the Cloudflare CLI and nothing else.',
    '',
    '## 10. Out of scope (verbatim)',
    spec.out_of_scope.length ? spec.out_of_scope.map((d) => `- ${d}`).join('\n') : '- Nothing beyond the spec.',
    brief.dont_wants ? `- Client explicitly does not want: ${brief.dont_wants}` : '',
    '',
    '## No fake content — hard rule',
    'No lorem ipsum. No placeholder testimonials. No invented review counts, stats, team members, or stock names. If real content for a section does not exist in this brief, render an honest empty state that says what is needed and list every such gap in your completion report. A site with fabricated content is unusable in front of the client and counts as a failed build.',
  ].filter((l) => l !== null && l !== undefined).join('\n');
}

/** The only model-drafted part: generation-ready image prompts for the
 *  business, its region, and the approved sections — written as usable
 *  Higgsfield prompts, not descriptions of prompts. */
export async function draftImagery(brief: BrandLabBrief, spec: FunctionalSpec, niche: Niche | null): Promise<string> {
  const { pages } = enabledSpec(spec);
  const sections = pages.flatMap((p) => p.sections.map((s) => `${p.name} → ${s}`));
  const text = await askClaude({
    system:
      'You write image-generation prompts for a real small-business website. Output plain text with these labeled ' +
      'blocks and nothing else:\n' +
      'HERO — one prompt: subject, mood, composition, lighting, aspect ratio 3:2, and the specific place it should ' +
      'read as.\nSECTION IMAGES — one prompt per section that genuinely needs an image (skip sections that don\'t), ' +
      'each on its own line prefixed by the section name, same detail level, aspect ratio stated.\nTEXTURES / ' +
      'BACKGROUNDS — 1-2 prompts for subtle background treatments if the tone calls for them.\nAVOID — a short list: ' +
      'generic stock look, obvious AI artifacts (hands, text, logos), wrong-region cues, and anything the client said ' +
      'they don\'t want.\n\nRules: every prompt must be pasteable as-is into an image generator. Be concrete about ' +
      'the region and season so the imagery can\'t read as somewhere else. Never depict real named people. Prefer ' +
      'environments, tools, and products over faces unless the niche needs faces — and then say "no identifiable ' +
      'face" or frame it so a real photo can replace it later.',
    messages: [{
      role: 'user',
      content: `${briefSummary(brief, niche)}\n\nNiche visual conventions: ${niche?.visual_conventions || 'unknown — infer from the business'}\n\nSections needing imagery consideration:\n${sections.map((s) => `- ${s}`).join('\n')}`,
    }],
    maxTokens: 1600,
  });
  return text.trim();
}

export interface BuildPromptsOptions {
  /** Reuse an existing (possibly operator-edited) imagery block instead
   *  of re-drafting it — the only model call in here, so skipping it
   *  makes a rebuild instant. */
  imagery?: string;
  /** Locked design HTML for Fable's slot 6. */
  design?: string | null;
}

export async function buildPrompts(brief: BrandLabBrief, niche: Niche | null, opts: BuildPromptsOptions = {}): Promise<BrandLabPrompts> {
  if (!brief.functional_spec) throw new Error('No functional spec.');
  const spec = brief.functional_spec;
  const imagery = opts.imagery ?? await draftImagery(brief, spec, niche);
  return {
    design: buildDesignPrompt(brief, spec, niche, imagery),
    fable: buildFablePrompt(brief, spec, opts.design),
    imagery,
    scope_flags: scopeFlags(spec, niche),
    generated_at: new Date().toISOString(),
  };
}
