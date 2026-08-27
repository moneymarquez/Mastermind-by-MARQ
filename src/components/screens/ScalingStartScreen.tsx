import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useScalingProjects } from '../../data/useScalingProjects';
import { useIdeaMaker } from '../../data/useIdeaMaker';
import { useBrandLab } from '../../data/useBrandLab';
import { useQuestionnaireTable } from '../../data/useQuestionnaireTable';
import { useClientDocuments } from '../../data/useClientDocuments';
import { askClaude, AiError } from '../../lib/ai';
import type { ScalingPlan } from '../../data/types';
import Icon from '../../Icon';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onNavigate: (id: string) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 13px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box',
};
const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' };
const ghostBtn: CSSProperties = {
  padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent',
  color: 'var(--text-quaternary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer',
};

function StepBadge({ done }: { done: boolean }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: done ? '#4a7a5a33' : 'var(--border)', border: `1px solid ${done ? '#4a7a5a' : 'var(--border-2)'}`, flexShrink: 0,
    }}>
      {done ? <Icon name="check" size={12} color="var(--success)" /> : <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-tertiary)' }} />}
    </div>
  );
}

export default function ScalingStartScreen({ homeHeadStyle, homeSubStyle, onNavigate }: Props) {
  const { projects, loading, create, patch } = useScalingProjects();
  const { sessions: ideaSessions } = useIdeaMaker();
  const { briefs } = useBrandLab();
  const { rows: plans } = useQuestionnaireTable<ScalingPlan>('scaling_plans', 'plan_text');
  const { create: createDoc } = useClientDocuments();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [websiteDraft, setWebsiteDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [novaError, setNovaError] = useState('');

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const startProject = async () => {
    if (!newName.trim()) return;
    const p = await create(newName.trim());
    setNewName('');
    if (p) setSelectedId(p.id);
  };

  const open = (id: string) => {
    setSelectedId(id);
    const p = projects.find((x) => x.id === id);
    setWebsiteDraft(p?.website_url ?? '');
  };

  const trailCount = (p: typeof projects[number]) =>
    [p.idea_session_id, p.brand_lab_brief_id, p.website_url, p.scaling_plan_id].filter(Boolean).length;

  const generateInvoice = async () => {
    if (!selected) return;
    setGenerating(true);
    setNovaError('');
    try {
      const idea = ideaSessions.find((s) => s.id === selected.idea_session_id)?.idea_text;
      const brand = briefs.find((b) => b.id === selected.brand_lab_brief_id)?.direction;
      const plan = plans.find((p) => p.id === selected.scaling_plan_id)?.plan_text;
      const context = [
        idea ? `Idea: ${idea}` : null,
        brand ? `Brand direction: ${brand}` : null,
        selected.website_url ? `Site: ${selected.website_url}` : null,
        plan ? `Scaling plan excerpt: ${plan.slice(0, 400)}` : null,
      ].filter(Boolean).join('\n');

      const description = await askClaude({
        system:
          'You write a single, tight invoice line-item description (one sentence, no fluff, no pricing) summarizing ' +
          'a client project kickoff based on the project context given. Output only the sentence, nothing else.',
        messages: [{ role: 'user', content: `Project: ${selected.name}\n${context || 'No details linked yet — write a generic project-kickoff line.'}` }],
        maxTokens: 150,
      });

      const doc = await createDoc('invoice', `Invoice — ${selected.name}`, null, {
        project_ref: selected.name,
        line_items: [{ type: 'Service', description: description.trim(), qty: '1', rate: '' }],
      });
      if (doc) await patch(selected.id, { invoice_document_id: doc.id });
    } catch (err) {
      setNovaError(err instanceof AiError ? err.message : 'Could not generate the invoice draft — try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div style={homeSubStyle}>Loading…</div>;

  if (!selected) {
    return (
      <div>
        <div style={homeHeadStyle}>Start</div>
        <div style={homeSubStyle}>
          The guided entry point for a new client project — chains Idea Maker, Brand Lab, Website Builder, and
          Scaling Planner together, then Nova ties it into a starter invoice. Each module also stays independently
          accessible in the nav.
        </div>

        <div style={{ ...cardStyle, marginTop: 24, maxWidth: 480, display: 'flex', gap: 10 }}>
          <input
            style={inputStyle}
            placeholder="New project name (e.g. client or business name)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startProject()}
          />
          <button style={primaryBtn} onClick={startProject} disabled={!newName.trim()}>Start</button>
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 620 }}>
          {projects.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No projects yet — start one above.</div>}
          {projects.map((p) => (
            <div key={p.id} style={{ ...cardStyle, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => open(p.id)}>
              <div>
                <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 3 }}>{trailCount(p)} / 4 steps linked · {p.status.replace(/_/g, ' ')}</div>
              </div>
              <Icon name="caret-right" size={16} color="var(--text-tertiary)" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const ideaLinked = ideaSessions.find((s) => s.id === selected.idea_session_id);
  const brandLinked = briefs.find((b) => b.id === selected.brand_lab_brief_id);
  const planLinked = plans.find((p) => p.id === selected.scaling_plan_id);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={ghostBtn} onClick={() => setSelectedId(null)}>← All projects</span>
      </div>
      <div style={{ ...homeHeadStyle, marginTop: 12 }}>{selected.name}</div>
      <div style={homeSubStyle}>Its trail — link each piece as it's built, in any order.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22, maxWidth: 620 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <StepBadge done={!!ideaLinked} />
            <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>1. Idea Maker</div>
          </div>
          {ideaLinked && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{ideaLinked.idea_text}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={selectStyle} value={selected.idea_session_id ?? ''} onChange={(e) => patch(selected.id, { idea_session_id: e.target.value || null })}>
              <option value="">— link an idea session —</option>
              {ideaSessions.map((s) => <option key={s.id} value={s.id}>{s.idea_text.slice(0, 60)}</option>)}
            </select>
            <button style={ghostBtn} onClick={() => onNavigate('idea-maker')}>Open →</button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <StepBadge done={!!brandLinked} />
            <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>2. Brand Lab</div>
          </div>
          {brandLinked && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{brandLinked.direction}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={selectStyle} value={selected.brand_lab_brief_id ?? ''} onChange={(e) => patch(selected.id, { brand_lab_brief_id: e.target.value || null })}>
              <option value="">— link a brand direction —</option>
              {briefs.map((b) => <option key={b.id} value={b.id}>{b.direction.slice(0, 60)}</option>)}
            </select>
            <button style={ghostBtn} onClick={() => onNavigate('brand-lab')}>Open →</button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <StepBadge done={!!selected.website_url} />
            <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>3. Website & App Builder</div>
          </div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 10 }}>
            The builder itself is still in development (see its roadmap) — paste the live site URL here once it exists.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="https://…"
              value={websiteDraft}
              onChange={(e) => setWebsiteDraft(e.target.value)}
              onBlur={() => { if (websiteDraft !== (selected.website_url ?? '')) patch(selected.id, { website_url: websiteDraft.trim() || null }); }}
            />
            <button style={ghostBtn} onClick={() => onNavigate('website')}>Open →</button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <StepBadge done={!!planLinked} />
            <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>4. Scaling Planner <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(parallel — anytime)</span></div>
          </div>
          {planLinked?.plan_text && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>{planLinked.plan_text.slice(0, 160)}…</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={selectStyle} value={selected.scaling_plan_id ?? ''} onChange={(e) => patch(selected.id, { scaling_plan_id: e.target.value || null })}>
              <option value="">— link a scaling plan —</option>
              {plans.filter((p) => p.plan_text).map((p) => <option key={p.id} value={p.id}>{(p.plan_text ?? '').slice(0, 60)}</option>)}
            </select>
            <button style={ghostBtn} onClick={() => onNavigate('scaling-planner')}>Open →</button>
          </div>
        </div>

        <div style={{ ...cardStyle, borderColor: '#3a3520' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Icon name="sparkle" size={16} color="var(--warning)" />
            <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600, color: 'var(--text)' }}>5. Nova — tie it together</div>
          </div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
            Once at least one piece above is linked, Nova drafts a starter invoice from the project's trail — the
            first downstream artifact, with more to follow as this project matures.
          </div>
          {selected.invoice_document_id ? (
            <button style={ghostBtn} onClick={() => onNavigate('invoicing')}>Open invoice in Invoicing →</button>
          ) : (
            <button
              style={primaryBtn}
              onClick={generateInvoice}
              disabled={generating || trailCount(selected) === 0}
            >
              {generating ? 'Generating…' : 'Generate starter invoice'}
            </button>
          )}
          {novaError && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', marginTop: 10 }}>{novaError}</div>}
        </div>
      </div>
    </div>
  );
}
