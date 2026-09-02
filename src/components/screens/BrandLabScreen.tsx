import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useBrandLab } from '../../data/useBrandLab';
import { useScalingProjects } from '../../data/useScalingProjects';
import { useNiches } from '../../data/useNiches';
import { useClientCRM } from '../../data/useClientCRM';
import type { BrandConcept, BrandLabBrief } from '../../data/types';
import { askClaude, AiError } from '../../lib/ai';
import NichesAdmin from './NichesAdmin';
import BrandLabIntakeForm from './BrandLabIntakeForm';
import type { IntakePayload } from './BrandLabIntakeForm';
import BrandLabSpecReview from './BrandLabSpecReview';
import { generateFunctionalSpec } from '../../data/brandLabSpec';
import { buildPrompts } from '../../data/brandLabPrompts';
import PromptBox from '../PromptBox';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const ARCHETYPES = [
  'centered-minimal', 'bold-split', 'editorial-asymmetric',
  'grid-cards', 'full-bleed-overlay', 'sidebar-dashboard',
] as const;

const FONT_OPTIONS = ['Inter', 'Playfair Display', 'Space Grotesk', 'DM Sans'];

async function generateConcepts(
  input: { business: string; audience: string; tone: string; colorPref: string; refs: (string | null)[] },
  count: number,
): Promise<BrandConcept[]> {
  const refLines = input.refs.filter(Boolean).map((r, i) => `Reference site ${i + 1}: ${r}`).join('\n') || '(no reference sites given)';
  const text = await askClaude({
    system:
      `You are a brand/visual design director. Given a business description, audience, tone, and color preference, ` +
      `generate exactly ${count} meaningfully DISTINCT visual brand-design concepts. Each concept must use a ` +
      `different layout archetype from this fixed list, never repeating one across concepts: ${ARCHETYPES.join(', ')}. ` +
      `Vary the heading font across concepts where possible, choosing from: ${FONT_OPTIONS.join(', ')}. Respond with ` +
      `ONLY a JSON array, no prose, of exactly ${count} objects matching: {"id": short-kebab-slug, "name": 2-4 word ` +
      `concept name, "archetype": one of the archetype keys above, "palette": {"bg": hex, "surface": hex, "primary": ` +
      `hex, "text": hex, "muted": hex} — a real cohesive 5-color palette, "headingFont": one of the fonts above, ` +
      `"mood": [3 short mood words], "blurb": one sentence on why this direction fits the business}.`,
    messages: [{
      role: 'user',
      content: `Business: ${input.business}\nAudience: ${input.audience}\nTone: ${input.tone}\nColor preference: ${input.colorPref || 'no strong preference — use your judgment'}\n${refLines}`,
    }],
    maxTokens: 1400,
  });
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) throw new AiError('AI response was not valid JSON.');
  return JSON.parse(raw.slice(start, end + 1)) as BrandConcept[];
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const primaryBtn: CSSProperties = {
  alignSelf: 'flex-start', padding: '10px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)',
  color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer', border: 'none',
};
const ghostBtn: CSSProperties = {
  padding: '8px 15px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent',
  color: 'var(--text-quaternary)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer',
};
const chipStyle = (active: boolean): CSSProperties => ({
  padding: '8px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-body-sm)', cursor: 'pointer',
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, background: active ? '#F5F6F71a' : 'var(--surface)',
  color: active ? 'var(--text)' : 'var(--text-secondary)',
});

function ConceptMock({ concept }: { concept: BrandConcept }) {
  const { bg, surface, primary, text, muted } = concept.palette;
  const headStyle: CSSProperties = { fontFamily: `'${concept.headingFont}', 'Inter', sans-serif` };
  const box: CSSProperties = { borderRadius: 'var(--radius-md)', overflow: 'hidden', height: 200, position: 'relative' };

  switch (concept.archetype) {
    case 'bold-split':
      return (
        <div style={{ ...box, display: 'flex' }}>
          <div style={{ flex: 1.2, background: primary, display: 'flex', alignItems: 'center', padding: 18 }}>
            <div style={{ ...headStyle, fontSize: 'var(--text-title)', fontWeight: 700, color: bg, lineHeight: 1.1 }}>{concept.name}</div>
          </div>
          <div style={{ flex: 1, background: surface, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 14, gap: 6 }}>
            {concept.mood.map((m) => <div key={m} style={{ fontSize: 'var(--text-nano)', color: muted }}>{m}</div>)}
          </div>
        </div>
      );
    case 'editorial-asymmetric':
      return (
        <div style={{ ...box, background: surface, display: 'flex', gap: 14, padding: 20 }}>
          <div style={{ width: 2, background: primary, flexShrink: 0 }} />
          <div>
            <div style={{ ...headStyle, fontSize: 18, fontStyle: 'italic', color: text, lineHeight: 1.25 }}>{concept.name}</div>
            <div style={{ fontSize: 'var(--text-tiny)', color: muted, marginTop: 10, lineHeight: 1.5 }}>{concept.blurb}</div>
          </div>
        </div>
      );
    case 'grid-cards':
      return (
        <div style={{ ...box, background: bg, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...headStyle, fontSize: 'var(--text-head)', fontWeight: 700, color: text }}>{concept.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, flex: 1 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ background: surface, borderRadius: 6, border: `1px solid ${primary}33` }} />
            ))}
          </div>
        </div>
      );
    case 'full-bleed-overlay':
      return (
        <div style={{ ...box, background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 18 }}>
          <div>
            <div style={{ ...headStyle, fontSize: 'var(--text-title)', fontWeight: 700, color: bg }}>{concept.name}</div>
            <div style={{ fontSize: 'var(--text-micro)', color: bg, opacity: 0.75, marginTop: 8 }}>{concept.mood.join(' · ')}</div>
          </div>
        </div>
      );
    case 'sidebar-dashboard':
      return (
        <div style={{ ...box, background: bg, display: 'flex' }}>
          <div style={{ width: 34, background: surface, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, gap: 8 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 'var(--radius-xs)', background: primary, opacity: 0.5 + i * 0.15 }} />)}
          </div>
          <div style={{ flex: 1, padding: 16 }}>
            <div style={{ ...headStyle, fontSize: 'var(--text-subhead)', fontWeight: 700, color: text }}>{concept.name}</div>
            <div style={{ fontSize: 'var(--text-micro)', color: muted, marginTop: 6, lineHeight: 1.5 }}>{concept.blurb}</div>
          </div>
        </div>
      );
    case 'centered-minimal':
    default:
      return (
        <div style={{ ...box, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: muted, textTransform: 'uppercase' }}>{concept.mood[0]}</div>
          <div style={{ ...headStyle, fontSize: 18, color: text, marginTop: 10 }}>{concept.name}</div>
          <div style={{ marginTop: 14, padding: '7px 16px', border: `1px solid ${muted}`, borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-micro)', color: text }}>{concept.blurb.slice(0, 24)}…</div>
        </div>
      );
  }
}

function ConceptCard({ concept, pinned, onPin }: { concept: BrandConcept; pinned: boolean; onPin: () => void }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${pinned ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 'var(--radius-xl)', padding: 14 }}>
      <ConceptMock concept={concept} />
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>{concept.name}</div>
          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 2 }}>{concept.mood.join(' · ')}</div>
        </div>
        <div style={pinned ? { ...ghostBtn, borderColor: 'var(--warning)', color: 'var(--warning)' } : ghostBtn} onClick={onPin}>
          {pinned ? 'Pinned ★' : 'Pin'}
        </div>
      </div>
    </div>
  );
}

function StepCard({
  index, title, children,
}: { index: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 }}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Step {index} — {title}</div>
      {children}
    </div>
  );
}

export default function BrandLabScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { briefs, loading, addBrief, updateBrief, removeBrief, saveConcepts, pinConcept, saveStep } = useBrandLab();
  const { projects, patch: patchProject } = useScalingProjects();
  const nichesApi = useNiches();
  const crm = useClientCRM();

  const [showForm, setShowForm] = useState(false);
  const [showNiches, setShowNiches] = useState(false);
  const [count, setCount] = useState<3 | 4 | 5>(3);
  const [specBusy, setSpecBusy] = useState(false);
  const [specError, setSpecError] = useState('');
  const [promptsBusy, setPromptsBusy] = useState(false);
  const [promptsError, setPromptsError] = useState('');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [logoDraft, setLogoDraft] = useState('');
  const [voiceDraft, setVoiceDraft] = useState('');
  const [attachProjectId, setAttachProjectId] = useState('');

  const active = briefs.find((b) => b.id === activeId) ?? null;

  // The intake step (BrandLabIntakeForm) lands here — transcript, idea, or
  // client, same brief row. Concepts are no longer generated on save: the
  // spec → prompts path is the product now, and the concept generator is
  // an optional side-step on the brief page ("Generate concepts").
  const submitNewBrief = async (p: IntakePayload) => {
    const business = p.intake.business?.trim() ?? '';
    const brief = await addBrief({
      direction: `${business} — ${p.tone}`,
      reference_url_1: p.refs[0], reference_url_2: p.refs[1], reference_url_3: p.refs[2],
      business, audience: p.intake.audience?.trim() ?? '', tone: p.tone, color_pref: p.color_pref,
      intake_source: p.intake_source, transcript: p.transcript, client_id: p.client_id,
      niche_slug: p.intake.niche_slug, niche_custom: p.intake.niche_custom,
      bottleneck_verbatim: p.intake.bottleneck_verbatim, budget: p.intake.budget, services: p.intake.services,
      geography: p.intake.geography, wants: p.intake.wants, dont_wants: p.intake.dont_wants,
      competitors: p.intake.competitors, quotes: p.intake.quotes, extracted_fields: p.extracted_fields,
    });
    setShowForm(false);
    if (brief) setActiveId(brief.id);
  };

  const regenerate = async (brief: BrandLabBrief) => {
    setGenerating(true);
    setAiError('');
    try {
      const concepts = await generateConcepts({
        business: brief.business ?? brief.direction, audience: brief.audience ?? '', tone: brief.tone ?? '', colorPref: brief.color_pref ?? '',
        refs: [brief.reference_url_1, brief.reference_url_2, brief.reference_url_3],
      }, count);
      await saveConcepts(brief.id, concepts);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not generate concepts — try again.');
    } finally {
      setGenerating(false);
    }
  };

  const pinnedConcept = active?.concepts.find((c) => c.id === active.pinned_concept_id) ?? null;

  const generateLogoDirection = async () => {
    if (!active || !pinnedConcept) return;
    setGenerating(true);
    setAiError('');
    try {
      const text = await askClaude({
        system: 'You write a short, concrete logo-design creative brief (3-5 sentences) — what shape/mark/wordmark approach fits, no fluff.',
        messages: [{ role: 'user', content: `Business: ${active.business}\nConcept: ${pinnedConcept.name} (${pinnedConcept.archetype}), mood: ${pinnedConcept.mood.join(', ')}\nPalette: ${JSON.stringify(pinnedConcept.palette)}` }],
        maxTokens: 300,
      });
      setLogoDraft(text.trim());
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not generate a logo direction.');
    } finally {
      setGenerating(false);
    }
  };

  const generateVoiceMessaging = async () => {
    if (!active || !pinnedConcept) return;
    setGenerating(true);
    setAiError('');
    try {
      const text = await askClaude({
        system: 'You write a compact brand-voice guide: 2-3 sentences on tone of voice, then one sample tagline, then one sample one-line bio. Plain text, no headers.',
        messages: [{ role: 'user', content: `Business: ${active.business}\nAudience: ${active.audience}\nConcept mood: ${pinnedConcept.mood.join(', ')}` }],
        maxTokens: 300,
      });
      setVoiceDraft(text.trim());
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not generate a voice guide.');
    } finally {
      setGenerating(false);
    }
  };

  const allStepsConfirmed = !!(
    active?.steps.paletteTypography?.confirmed &&
    active?.steps.logoDirection?.confirmed &&
    active?.steps.voiceMessaging?.confirmed &&
    active?.steps.assetPrep?.confirmed
  );

  const assetPrepText = active && pinnedConcept
    ? [
        `Concept: ${pinnedConcept.name} (${pinnedConcept.archetype})`,
        `Palette: bg ${pinnedConcept.palette.bg}, surface ${pinnedConcept.palette.surface}, primary ${pinnedConcept.palette.primary}, text ${pinnedConcept.palette.text}, muted ${pinnedConcept.palette.muted}`,
        `Heading font: ${pinnedConcept.headingFont} / Body font: Inter`,
        `Logo direction: ${active.steps.logoDirection?.text ?? '(not yet confirmed)'}`,
        `Voice & messaging: ${active.steps.voiceMessaging?.text ?? '(not yet confirmed)'}`,
      ].join('\n\n')
    : '';

  if (showNiches) {
    return <NichesAdmin nichesApi={nichesApi} onClose={() => setShowNiches(false)} homeHeadStyle={homeHeadStyle} homeSubStyle={homeSubStyle} />;
  }

  if (active) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={ghostBtn} onClick={() => setActiveId(null)}>← All briefs</span>
        </div>
        <div style={{ ...homeHeadStyle, marginTop: 12 }}>{active.business || active.direction}</div>
        <div style={homeSubStyle}>{active.audience ? `For: ${active.audience}` : 'A visual design-direction generator — not a site builder.'}</div>

        {generating && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 12 }}>Nova is working on it…</div>}
        {aiError && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', marginTop: 12 }}>{aiError}</div>}

        {/* What the intake step captured — the brief's foundation, shown
            plainly so nothing downstream is a black box. Blank fields are
            omitted rather than shown as "—": a blank means it wasn't said. */}
        <div style={{ marginTop: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16, maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Brief</div>
            <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>
              {active.intake_source === 'transcript' ? 'from a call transcript' : active.intake_source === 'client' ? 'from an existing client' : 'from an idea'}
              {active.niche_slug ? ` · ${nichesApi.bySlug(active.niche_slug)?.name ?? active.niche_slug}${active.niche_slug === 'other' && active.niche_custom ? ` (${active.niche_custom})` : ''}` : ''}
            </span>
          </div>
          {([
            ['Bottleneck, in their words', active.bottleneck_verbatim],
            ['Services', active.services],
            ['Service area', active.geography],
            ['Budget', active.budget],
            ['They want', active.wants],
            ["They don't want", active.dont_wants],
            ['Competitors / references', active.competitors],
          ] as [string, string | null][]).filter(([, v]) => !!v).map(([k, v]) => (
            <div key={k} style={{ fontSize: 'var(--text-body-sm)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>{k}: </span>
              <span style={{ color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
          {active.quotes.length > 0 && (
            <div style={{ fontSize: 'var(--text-body-sm)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Quotes: </span>
              {active.quotes.map((q, i) => <span key={i} style={{ color: 'var(--text)' }}>“{q}”{i < active.quotes.length - 1 ? ' · ' : ''}</span>)}
            </div>
          )}
        </div>

        {/* Step 4 — the functional spec. Generated once from brief + niche,
            then edited and approved here before any prompt exists. Approving
            locks it; unlocking clears any prompts generated from the old
            version so a stale prompt can never ship. */}
        <div style={{ marginTop: 18 }}>
          <BrandLabSpecReview
            spec={active.functional_spec}
            approvedAt={active.spec_approved_at}
            busy={specBusy}
            error={specError}
            onGenerate={async () => {
              setSpecBusy(true);
              setSpecError('');
              try {
                const spec = await generateFunctionalSpec(active, nichesApi.bySlug(active.niche_slug));
                await updateBrief(active.id, { functional_spec: spec, spec_approved_at: null, prompts: null });
              } catch (err) {
                setSpecError(err instanceof AiError ? err.message : 'Could not draft the spec — try again.');
              } finally {
                setSpecBusy(false);
              }
            }}
            onChange={(next) => updateBrief(active.id, { functional_spec: next })}
            onApprove={() => updateBrief(active.id, { spec_approved_at: new Date().toISOString() })}
            onUnlock={() => updateBrief(active.id, { spec_approved_at: null, prompts: null })}
          />
        </div>

        {/* Step 5 — the prompts. Only from an approved spec. Design and
            Fable are assembled deterministically from spec + niche + brief;
            the imagery block is the one model-drafted part. Each box has
            its own copy button because the workflow is copy → switch app →
            paste, from a phone. */}
        {active.spec_approved_at && active.functional_spec && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Prompts</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {active.prompts ? `Generated ${new Date(active.prompts.generated_at).toLocaleString()} from the approved spec.` : 'Generated from the approved spec — Design first, then Fable once the design is locked.'}
                </div>
              </div>
              <span
                style={{ ...(active.prompts ? ghostBtn : primaryBtn), opacity: promptsBusy ? 0.6 : 1, pointerEvents: promptsBusy ? 'none' : 'auto' }}
                onClick={async () => {
                  setPromptsBusy(true);
                  setPromptsError('');
                  try {
                    const prompts = await buildPrompts(active, nichesApi.bySlug(active.niche_slug));
                    await updateBrief(active.id, { prompts });
                  } catch (err) {
                    setPromptsError(err instanceof AiError ? err.message : 'Could not build the prompts — try again.');
                  } finally {
                    setPromptsBusy(false);
                  }
                }}
              >
                {promptsBusy ? 'Building…' : active.prompts ? 'Rebuild prompts' : 'Build prompts'}
              </span>
            </div>
            {promptsError && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>{promptsError}</div>}

            {active.prompts && active.prompts.scope_flags.length > 0 && (
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid color-mix(in srgb, var(--warning) 45%, transparent)', background: 'color-mix(in srgb, var(--warning) 8%, transparent)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--warning)', letterSpacing: 0.3, textTransform: 'uppercase' }}>Left out of the Design prompt</div>
                {active.prompts.scope_flags.map((f, i) => <div key={i} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f}</div>)}
              </div>
            )}

            {active.prompts && (
              <>
                <PromptBox title="Box 1 — Claude Design" hint="Paste into Claude Design. Includes the Higgsfield imagery block." text={active.prompts.design} />
                <PromptBox title="Box 2 — Claude Fable" hint="Paste the locked design into slot 6 first, then give Fable the whole thing." text={active.prompts.fable} />
                <PromptBox title="Box 3 — Higgsfield (standalone, optional)" hint="Only if you're generating imagery outside Claude Design." text={active.prompts.imagery} />
              </>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Visual concepts</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([3, 4, 5] as const).map((n) => <div key={n} style={{ ...chipStyle(count === n), padding: '5px 10px' }} onClick={() => setCount(n)}>{n}</div>)}
          </div>
          <span style={ghostBtn} onClick={() => regenerate(active)}>{active.concepts.length ? 'Regenerate' : `Generate ${count} concepts`}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 12, maxWidth: 900 }}>
          {active.concepts.map((c) => (
            <ConceptCard key={c.id} concept={c} pinned={active.pinned_concept_id === c.id} onPin={() => pinConcept(active.id, c.id)} />
          ))}
          {active.concepts.length === 0 && !generating && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Optional — distinct layout directions to react to. The spec and prompts below don't need them.</div>
          )}
        </div>

        {pinnedConcept && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Guided handoff prep</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Once these four are confirmed, this concept is ready to hand off to Website Builder.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
              <StepCard index={1} title="Palette & typography">
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {Object.entries(pinnedConcept.palette).map(([k, v]) => (
                    <div key={k} title={`${k}: ${v}`} style={{ width: 28, height: 28, borderRadius: 6, background: v, border: '1px solid var(--border-2)' }} />
                  ))}
                </div>
                <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginBottom: 10 }}>Heading: {pinnedConcept.headingFont} · Body: Inter</div>
                <div
                  style={active.steps.paletteTypography?.confirmed ? { ...ghostBtn, borderColor: 'var(--success)', color: 'var(--success)' } : primaryBtn}
                  onClick={() => saveStep(active.id, 'paletteTypography', { confirmed: true })}
                >
                  {active.steps.paletteTypography?.confirmed ? 'Confirmed ✓' : 'Confirm'}
                </div>
              </StepCard>

              <StepCard index={2} title="Logo direction">
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical', marginBottom: 10 }}
                  value={logoDraft || active.steps.logoDirection?.text || ''}
                  onChange={(e) => setLogoDraft(e.target.value)}
                  placeholder="Generate or write a logo direction…"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={ghostBtn} onClick={generateLogoDirection}>Generate with Nova</div>
                  <div
                    style={active.steps.logoDirection?.confirmed ? { ...ghostBtn, borderColor: 'var(--success)', color: 'var(--success)' } : primaryBtn}
                    onClick={() => saveStep(active.id, 'logoDirection', { text: logoDraft || active.steps.logoDirection?.text || '', confirmed: true })}
                  >
                    {active.steps.logoDirection?.confirmed ? 'Confirmed ✓' : 'Confirm'}
                  </div>
                </div>
              </StepCard>

              <StepCard index={3} title="Voice & messaging">
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical', marginBottom: 10 }}
                  value={voiceDraft || active.steps.voiceMessaging?.text || ''}
                  onChange={(e) => setVoiceDraft(e.target.value)}
                  placeholder="Generate or write a voice & messaging guide…"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={ghostBtn} onClick={generateVoiceMessaging}>Generate with Nova</div>
                  <div
                    style={active.steps.voiceMessaging?.confirmed ? { ...ghostBtn, borderColor: 'var(--success)', color: 'var(--success)' } : primaryBtn}
                    onClick={() => saveStep(active.id, 'voiceMessaging', { text: voiceDraft || active.steps.voiceMessaging?.text || '', confirmed: true })}
                  >
                    {active.steps.voiceMessaging?.confirmed ? 'Confirmed ✓' : 'Confirm'}
                  </div>
                </div>
              </StepCard>

              <StepCard index={4} title="Asset prep for Website Builder handoff">
                <textarea style={{ ...inputStyle, minHeight: 120, marginBottom: 10, fontFamily: 'monospace', fontSize: 'var(--text-caption)' }} readOnly value={assetPrepText} />
                <div
                  style={active.steps.assetPrep?.confirmed ? { ...ghostBtn, borderColor: 'var(--success)', color: 'var(--success)' } : primaryBtn}
                  onClick={() => saveStep(active.id, 'assetPrep', { text: assetPrepText, confirmed: true })}
                >
                  {active.steps.assetPrep?.confirmed ? 'Marked ready ✓' : 'Mark ready for handoff'}
                </div>
              </StepCard>
            </div>

            {allStepsConfirmed && (
              <div style={{ ...inputStyle, marginTop: 20, maxWidth: 480, background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--warning) 33%, transparent)', padding: 18 }}>
                <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--warning)', fontWeight: 600, marginBottom: 10 }}>Finalized — ready as a project asset</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select style={{ ...inputStyle, flex: 1 }} value={attachProjectId} onChange={(e) => setAttachProjectId(e.target.value)}>
                    <option value="">— attach to a Scaling project —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div style={primaryBtn} onClick={() => attachProjectId && patchProject(attachProjectId, { brand_lab_brief_id: active.id })}>Attach</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Brand Lab</div>
          <div style={homeSubStyle}>A visual design-direction generator — not a site builder. Distinct layout concepts, pick a favorite, prep it for handoff.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={ghostBtn} onClick={() => setShowNiches(true)}>Niche library{nichesApi.niches.length ? ` (${nichesApi.niches.length})` : ''}</span>
          <div style={primaryBtn} onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ New brief'}</div>
        </div>
      </div>

      {showForm && (
        <BrandLabIntakeForm niches={nichesApi.niches} clients={crm.clients} onSubmit={submitNewBrief} onCancel={() => setShowForm(false)} />
      )}

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', maxWidth: 640 }}>
        {briefs.map((b) => (
          <div
            key={b.id}
            onClick={() => setActiveId(b.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)', cursor: 'pointer' }}
          >
            <div>
              <span style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary)' }}>{b.business || b.direction}</span>
              {b.pinned_concept_id && <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--warning)', marginLeft: 10 }}>★ pinned</span>}
            </div>
            <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }} onClick={(e) => { e.stopPropagation(); removeBrief(b.id); }}>Delete</span>
          </div>
        ))}
        {!loading && briefs.length === 0 && (
          <div style={{ padding: 18, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No briefs yet.</div>
        )}
      </div>
    </div>
  );
}
