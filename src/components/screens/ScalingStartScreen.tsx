import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useScalingProjects } from '../../data/useScalingProjects';
import { useIdeaMaker } from '../../data/useIdeaMaker';
import { useBrandLab } from '../../data/useBrandLab';
import { useQuestionnaireTable } from '../../data/useQuestionnaireTable';
import { useClientDocuments } from '../../data/useClientDocuments';
import { askClaude, AiError } from '../../lib/ai';
import type { ScalingPlan } from '../../data/types';
import Card from '../mm/Card';
import Chip from '../mm/Chip';
import Stat from '../mm/Stat';
import { Empty } from '../mm/States';
import { Page, useModule, useAi, AiOffCard, NovaMark, field } from '../mm/Page';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onNavigate: (id: string) => void;
}

export default function ScalingStartScreen({ onNavigate }: Props) {
  const { device } = useModule();
  const phone = device === 'phone';
  const ai = useAi();
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

  if (loading) return <Page title="Start" sub="Guided new-client flow"><span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Loading…</span></Page>;

  const newCard = (
    <Card title="New project" meta="A client or business name" wide={!phone}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void startProject(); }} placeholder="Bloom Studio" style={{ ...field, flex: 1 }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!newName.trim()} onClick={() => void startProject()}>Start</button>
      </div>
    </Card>
  );

  if (!selected) {
    return (
      <Page title="Start" sub="Idea → brand → site → plan → invoice">
        {newCard}
        {projects.length === 0 ? <Empty text="No projects yet. Name one above and walk it from idea to a starter invoice." /> : (
          <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : 'repeat(auto-fill,minmax(280px,1fr))', gap: phone ? 12 : 16 }}>
            {projects.map((p) => { const n = trailCount(p); return (
              <section key={p.id} role="button" tabIndex={0} onClick={() => open(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') open(p.id); }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}>
                <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${(n / 4) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} /></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><Chip k={p.invoice_document_id ? 'good' : n ? 'accent' : 'neutral'}>{p.invoice_document_id ? 'Invoice drafted' : `${n} of 4 linked`}</Chip><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{(p.status ?? 'in progress').replace(/_/g, ' ')}</span></div>
              </section>
            ); })}
          </div>
        )}
      </Page>
    );
  }

  const ideaLinked = ideaSessions.find((s) => s.id === selected.idea_session_id);
  const brandLinked = briefs.find((b) => b.id === selected.brand_lab_brief_id);
  const planLinked = plans.find((p) => p.id === selected.scaling_plan_id);
  const steps: { n: string; done: boolean; detail: string | null; control: React.ReactNode; open: string; note?: string }[] = [
    { n: 'Idea', done: !!ideaLinked, detail: ideaLinked?.idea_text ?? null, open: 'idea-maker',
      control: <select value={selected.idea_session_id ?? ''} onChange={(e) => void patch(selected.id, { idea_session_id: e.target.value || null })} style={field}><option value="">Link an Idea Maker thread</option>{ideaSessions.map((x) => <option key={x.id} value={x.id}>{x.idea_text.slice(0, 70)}</option>)}</select> },
    { n: 'Brand', done: !!brandLinked, detail: brandLinked?.direction ?? null, open: 'brand-lab',
      control: <select value={selected.brand_lab_brief_id ?? ''} onChange={(e) => void patch(selected.id, { brand_lab_brief_id: e.target.value || null })} style={field}><option value="">Link a Brand Lab direction</option>{briefs.map((b) => <option key={b.id} value={b.id}>{b.direction.slice(0, 70)}</option>)}</select> },
    { n: 'Website', done: !!selected.website_url, detail: selected.website_url, open: 'website', note: 'The builder is still in planning. Paste the live site once it exists.',
      control: <input value={websiteDraft} onChange={(e) => setWebsiteDraft(e.target.value)} onBlur={() => { if (websiteDraft !== (selected.website_url ?? '')) void patch(selected.id, { website_url: websiteDraft.trim() || null }); }} placeholder="https://" style={field} /> },
    { n: 'Scaling plan', done: !!planLinked, detail: planLinked?.plan_text ? `${planLinked.plan_text.slice(0, 160)}…` : null, open: 'scaling-planner', note: 'Anytime, in parallel.',
      control: <select value={selected.scaling_plan_id ?? ''} onChange={(e) => void patch(selected.id, { scaling_plan_id: e.target.value || null })} style={field}><option value="">Link a finished plan</option>{plans.filter((x) => x.plan_text).map((x) => <option key={x.id} value={x.id}>{(x.plan_text ?? '').slice(0, 70)}</option>)}</select> },
  ];
  const cur = steps.findIndex((x) => !x.done);
  const linked = trailCount(selected);
  const flow = (
    <Card title="Guided new-client flow" meta={selected.name} wide={!phone}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((st, i) => (
          <div key={st.n} style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 22, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', boxSizing: 'border-box', background: st.done ? 'var(--accent)' : 'transparent', border: st.done ? 'none' : i === cur ? '2px solid var(--accent)' : '1.5px solid var(--border)', color: 'var(--bg)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{st.done ? '✓' : ''}</div>
              <div style={{ flex: 1, width: 2, minHeight: 12, background: st.done ? 'var(--accent)' : 'var(--grid)' }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '1px 0 18px', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{st.n}</span>{i === cur && <Chip k="accent">Now</Chip>}</div>
              {st.detail && <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{st.detail}</span>}
              {st.note && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{st.note}</span>}
              <div style={{ display: 'flex', gap: 8 }}><div style={{ flex: 1, minWidth: 0 }}>{st.control}</div><button className="mm-btn" style={{ height: 44 }} onClick={() => onNavigate(st.open)}>Open</button></div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 22, flex: 'none', display: 'flex', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden style={{ marginTop: 3 }}><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2-2.2 7.3-2.2-7.3-7.3-2.2 7.3-2.2z" /></svg></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>Starter invoice</span>
            {ai === false ? <AiOffCard text="Nova drafts the starter invoice from this trail once AI is connected. You can still write one in Invoicing." /> : (
              <>
                <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>Nova drafts a starter invoice from whatever's linked above. It opens in Invoicing as a draft; nothing is sent.</span>
                {selected.invoice_document_id ? <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => onNavigate('invoicing')}>Open the invoice</button>
                  : <button className="mm-btn mm-btn--primary" style={{ alignSelf: 'flex-start', height: 44 }} disabled={generating || linked === 0} onClick={() => void generateInvoice()}>{generating ? 'Drafting…' : linked ? 'Draft the starter invoice' : 'Link a step first'}</button>}
                {novaError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{novaError}</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
  const linkedCard = (
    <Card title="What it's built from" meta={`${linked} of 4 linked`} wide={!phone}>
      <NovaMark title="The trail" />
      <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Each module stays usable on its own. Linking it here is what lets Nova write the invoice from the real work, not a template.</span>
    </Card>
  );

  return (
    <Page title={selected.name} sub="Start · guided new-client flow">
      <button className="mm-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setSelectedId(null)}>‹ All projects</button>
      {!phone && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <Stat label="Linked" value={`${linked} of 4`} pill="Steps" k={linked === 4 ? 'good' : 'neutral'} />
          <Stat label="Step" value={cur >= 0 ? steps[cur].n : 'Done'} pill={cur >= 0 ? 'Up next' : 'All linked'} />
          <Stat label="Invoice" value={selected.invoice_document_id ? 'Drafted' : '—'} pill={selected.invoice_document_id ? 'In Invoicing' : 'Not yet'} k={selected.invoice_document_id ? 'good' : 'neutral'} />
          <Stat label="Status" value={(selected.status ?? 'in progress').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} pill="Project" />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0,1fr)' : 'minmax(0,2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>{flow}{linkedCard}</div>
    </Page>
  );
}
