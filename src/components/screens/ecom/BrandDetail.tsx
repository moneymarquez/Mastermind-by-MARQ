import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { runWorkerNow } from '../../../data/useEngine';
import { diagnoseFunnel } from '../../../../worker/lib/ecomWorkers';
import { StorePreview } from './ApprovalBodies';
import type { CSSProperties } from 'react';
import type { Brand, StepDef, StepState, StepStatus } from '../../../data/ecom';
import { STEPS, stepState, stepStatus, nextStep, doneSteps, validate, money, ago } from '../../../data/ecom';
import { Drawer, E, Metric, TeachingEmpty, Section, HealthBadge, Badge, ProgressRing, btn, field, label, tint } from './ecomShared';
import { askConfirm } from '../../../lib/confirm';

const STATUS_LABEL: Record<StepStatus, string> = { todo: 'To do', in_progress: 'In progress', waiting: 'Waiting on you', done: 'Done' };
const STATUS_COLOR: Record<StepStatus, string> = { todo: E.faint, in_progress: E.blue, waiting: E.amber, done: E.green };

interface Props {
  brand: Brand | null;
  clientName: string | null;
  orders30d: { count: number; total: number; last: string | null } | undefined;
  productsLive: number;
  health: Brand['health'];
  onClose: () => void;
  onSaveStep: (brand: Brand, n: number, state: StepState) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

/** §4 brand detail: the KPIs bigger, the chart (teaching until Shopify),
 *  then the 10-step stepper. Each step: status, what workers will produce,
 *  what's waiting on you, and the manual fields Phase 1 lets you fill. */
export default function BrandDetail({ brand, clientName, orders30d, productsLive, health, onClose, onSaveStep, onRemove }: Props) {
  const [openStep, setOpenStep] = useState<number | null>(null);
  if (!brand) return null;
  const current = openStep ?? nextStep(brand);
  const done = doneSteps(brand);

  return (
    <Drawer open onClose={onClose} width={640}
      title={<span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{brand.name} <HealthBadge h={health} /></span>}
      subtitle={<>{brand.owner_type === 'client' ? `Client · ${clientName ?? 'unassigned'}` : 'Mine'} · Step {nextStep(brand)} of 10 · changed {ago(brand.last_activity_at)}</>}
    >
      {brand.positioning && <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.5 }}>{brand.positioning}</div>}

      <div style={{ ...E.card, padding: 16, marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14, alignItems: 'start' }}>
        {brand.shopify_store ? (
          <>
            <Metric big label="Revenue 30d" value={money(orders30d?.total ?? 0, 0)} confidence="hard" asOf={orders30d?.last} />
            <Metric big label="Orders 30d" value={String(orders30d?.count ?? 0)} confidence="hard" />
            <Metric big label="Products live" value={String(productsLive)} confidence="hard" />
          </>
        ) : (
          <div style={{ gridColumn: '1 / -1' }}>
            <TeachingEmpty what="Revenue, orders and conversion show here once Shopify is connected. Until then, Analytics reads the funnel from step 9." worker="Analytics" connection="Shopify custom app token" />
          </div>
        )}
      </div>

      <Performance brand={brand} />

      <Section title={`The 10 steps · ${done} done`} aside={<ProgressRing done={done} total={10} size={34} />}>
        <div data-demo="brand-steps" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STEPS.map((s) => (
            <StepCard key={`${s.n}-${brand.last_activity_at}`} brand={brand} def={s} open={current === s.n} onToggle={() => setOpenStep(current === s.n ? -1 : s.n)} onSave={(state) => onSaveStep(brand, s.n, state)} />
          ))}
        </div>
      </Section>

      <div style={{ marginTop: 28 }}>
        <span style={{ fontSize: 'var(--text-caption)', color: E.faint, cursor: 'pointer' }} onClick={async () => { if (await askConfirm(`Delete "${brand.name}" and everything under it?`)) { onRemove(brand.id); onClose(); } }}>Delete brand</span>
      </div>
    </Drawer>
  );
}

function StepCard({ brand, def, open, onToggle, onSave }: { brand: Brand; def: StepDef; open: boolean; onToggle: () => void; onSave: (state: StepState) => Promise<void> }) {
  const st = stepState(brand, def.n);
  const status = stepStatus(brand, def.n);
  const [fields, setFields] = useState<Record<string, string>>(st.fields ?? {});
  const [note, setNote] = useState(st.note ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(fields) !== JSON.stringify(st.fields ?? {}) || note !== (st.note ?? '');
  const save = async (next?: StepStatus) => {
    setSaving(true);
    await onSave({ fields, note: note.trim() || undefined, ...(next ? { status: next, done_at: next === 'done' ? new Date().toISOString() : st.done_at } : {}) });
    setSaving(false);
  };
  const filled = Object.values(fields).filter((v) => v && v.trim()).length;
  const v = def.n === 2 && fields.sell_price ? validate({ sellPrice: Number(fields.sell_price), supplierCost: Number(fields.supplier_cost || 0), shipCost: Number(fields.ship_cost || 0), shipDays: Number(fields.ship_days || 0), trend: fields.trend ?? '' }) : null;

  return (
    <div style={{ ...E.card, padding: 0, borderLeft: `3px solid ${def.hardStop ? E.red : STATUS_COLOR[status]}`, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: status === 'done' ? E.green : E.faint, width: 22, flexShrink: 0 }}>{status === 'done' ? '✓' : def.n}</span>
        <span style={{ fontWeight: 600, color: E.text, fontSize: 'var(--text-body)', flex: 1, minWidth: 0 }}>{def.title}</span>
        {def.hardStop && <Badge color={E.red}>🛑 Hard stop</Badge>}
        <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
        <span style={{ color: E.faint, fontSize: 12 }}>{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
            <div>
              <div style={label}>Workers do</div>
              <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.5, marginTop: 3 }}>{def.workers} <span style={{ color: E.faint }}>(workers take this over as each one goes live — until then, you.)</span></div>
            </div>
            <div>
              <div style={label}>You do</div>
              <div style={{ fontSize: 'var(--text-body)', color: E.text, lineHeight: 1.5, marginTop: 3 }}>{def.you}</div>
            </div>
          </div>
          {def.hardStop && (
            <div style={{ marginTop: 10, padding: '8px 12px', border: `1px solid ${E.red}`, borderRadius: 'var(--radius-sm)', background: tint(E.red, 10), fontSize: 'var(--text-body)', color: E.red }}>
              <strong>Hard stop.</strong> {def.hardStop}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 14 }}>
            {def.fields.map((f) => (
              <div key={f.key} style={f.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                <div style={{ ...label, marginBottom: 4 }}>{f.label}{f.unit ? <span style={{ fontWeight: 400, textTransform: 'none' }}> ({f.unit})</span> : null}</div>
                {f.type === 'textarea' ? (
                  <textarea style={{ ...field, minHeight: 72, resize: 'vertical' } as CSSProperties} value={fields[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setFields((d) => ({ ...d, [f.key]: e.target.value }))} />
                ) : f.type === 'select' ? (
                  <select style={field} value={fields[f.key] ?? ''} onChange={(e) => setFields((d) => ({ ...d, [f.key]: e.target.value }))}>
                    <option value="">—</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input style={{ ...field, fontFamily: f.type === 'number' ? 'var(--font-mono)' : 'inherit' }} type={f.type === 'url' ? 'url' : f.type} inputMode={f.type === 'number' ? 'decimal' : undefined} value={fields[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setFields((d) => ({ ...d, [f.key]: e.target.value }))} />
                )}
                {f.hint && <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 4, lineHeight: 1.4 }}>{f.hint}</div>}
              </div>
            ))}
          </div>

          {v && (
            <div style={{ marginTop: 12, ...E.card, padding: 12, background: v.pass ? tint(E.green, 10) : tint(E.amber, 10), borderColor: v.pass ? tint(E.green, 35) : tint(E.amber, 35) }}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Metric label="Landed cost" value={money(v.landed)} confidence="estimate" />
                <Metric label="Price ÷ landed" value={`${v.multiple.toFixed(1)}×`} confidence="estimate" />
                <Badge color={v.pass ? E.green : E.amber}>{v.pass ? 'Passes all three rules' : 'Fails a rule'}</Badge>
              </div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {v.rules.map((r) => <div key={r.name} style={{ fontSize: 'var(--text-body)', color: r.pass ? E.text : E.amber }}>{r.pass ? '✓' : '✗'} {r.name} <span style={{ color: E.faint }}>— {r.detail}</span></div>)}
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6 }}>Landed = supplier + shipping + 3% payment fees + 7.5% estimated returns.</div>
            </div>
          )}

          {STEP_WORKER[def.n] && <StepWorker brand={brand} n={def.n} />}

          <div style={{ marginTop: 12 }}>
            <div style={{ ...label, marginBottom: 4 }}>Your note</div>
            <input style={field} value={note} placeholder="Anything to remember, or a note back to the worker later" onChange={(e) => setNote(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={{ ...btn('ghost'), opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => save(status === 'todo' ? 'in_progress' : undefined)}>{saving ? 'Saving…' : 'Save'}</button>
            {status !== 'done'
              ? <button style={{ ...btn('primary'), opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={() => save('done')}>Mark step done</button>
              : <button style={btn('ghost')} disabled={saving} onClick={() => save('in_progress')}>Reopen</button>}
            {status !== 'done' && status !== 'waiting' && <button style={btn('ghost')} disabled={saving} onClick={() => save('waiting')}>Waiting on me</button>}
            <span style={{ fontSize: 'var(--text-caption)', color: E.faint, marginLeft: 'auto' }}>{filled}/{def.fields.length} filled{dirty ? ' · unsaved' : st.done_at ? ` · done ${ago(st.done_at)}` : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** The worker that does each step's work, run from the step itself. */
const STEP_WORKER: Record<number, { key: string; name: string; busy: string }> = {
  4: { key: 'supplier', name: 'Supplier Finder', busy: 'Searching… (40–90s)' },
  5: { key: 'brandlab', name: 'Brand Lab', busy: 'Designing… (30–60s)' },
  6: { key: 'builder', name: 'Store Builder', busy: 'Building… (60–120s)' },
  7: { key: 'content', name: 'Content Producer', busy: 'Writing… (30–60s)' },
  9: { key: 'analytics', name: 'Analytics', busy: 'Reading… (10–20s)' },
};
function StepWorker({ brand, n }: { brand: Brand; n: number }) {
  const w = STEP_WORKER[n];
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (n !== 6) return;
    supabase.from('ecom_store_builds').select('html').eq('brand_id', brand.id).not('html', 'is', null).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setHtml(((data ?? [])[0] as { html?: string } | undefined)?.html ?? null));
  }, [n, brand.id, msg]);
  const run = async () => {
    setBusy(true); setMsg(null);
    const r = await runWorkerNow(w.key, { brand_id: brand.id });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: r.skipped ? r.summary ?? '' : `${r.summary ?? 'Done'} → waiting in Approvals.${r.costUsd ? ` (${money(r.costUsd)})` : ''}` } : { ok: false, text: r.error ?? 'Run failed.' });
  };
  return (
    <div style={{ marginTop: 12, padding: 10, borderRadius: 'var(--radius-sm)', border: `1px dashed ${E.border}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btn('primary')} disabled={busy} onClick={run}>{busy ? w.busy : `🤖 Run ${w.name}`}</button>
        <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Its output waits in Approvals; approving fills this step.</span>
      </div>
      {msg && <div style={{ fontSize: 'var(--text-caption)', color: msg.ok ? E.muted : E.red, marginTop: 6 }}>{msg.text}</div>}
      {n === 6 && html && <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 6 }}>Latest store page</div><StorePreview html={html} name={brand.name} /></div>}
    </div>
  );
}

/** Performance + alerts: the funnel from step 9 (filled by Analytics or
 *  by hand), where it breaks, and this brand's kill / double-down flags. */
function Performance({ brand }: { brand: Brand }) {
  const [alerts, setAlerts] = useState<{ id: string; severity: string; title: string; body: string | null; created_at: string }[]>([]);
  useEffect(() => {
    supabase.from('ai_alerts').select('id,severity,title,body,created_at').eq('entity_type', 'brand').eq('entity_id', brand.id).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => setAlerts((data ?? []) as typeof alerts));
  }, [brand.id]);
  const f = stepState(brand, 9).fields ?? {};
  const n = (k: string) => { const x = Number(f[k]); return f[k] === '' || f[k] == null || !Number.isFinite(x) ? null : x; };
  const funnel = { views: n('views'), clicks: n('clicks'), add_to_carts: n('add_to_carts'), purchases: n('purchases') };
  const has = Object.values(funnel).some((v) => v != null);
  const d = has ? diagnoseFunnel(funnel) : null;
  const rec = stepState(brand, 10).fields?.reason;
  const FLAG: Record<string, string> = { kill: E.red, double_down: E.green, fix: E.amber, wait: E.faint };
  return (
    <Section title="Performance">
      <div style={{ ...E.card, padding: 16 }}>
        {has ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 12 }}>
              <Metric label="Views" value={(funnel.views ?? 0).toLocaleString()} />
              <Metric label="Clicks" value={String(funnel.clicks ?? 0)} />
              <Metric label="Carts" value={String(funnel.add_to_carts ?? 0)} />
              <Metric label="Sales" value={String(funnel.purchases ?? 0)} />
            </div>
            {d && <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}><Badge color={FLAG[d.flag]}>{d.flag.replace('_', ' ')}</Badge><span style={{ fontSize: 'var(--text-body)', color: E.text }}>{d.diagnosis}</span><span style={{ fontSize: 'var(--text-caption)', color: E.muted, flexBasis: '100%' }}>{d.why}</span></div>}
            {rec && <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 8 }}><span style={label}>Recommendation</span> {rec}</div>}
          </>
        ) : <TeachingEmpty what="The funnel shows here once step 9 has numbers — run Analytics from step 9, or type them in." worker="Analytics" connection="Shopify (optional — hand-entered numbers work)" />}
        {alerts.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={label}>Alerts</div>
            {alerts.map((a) => <div key={a.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 'var(--text-caption)', color: E.muted }}><Badge color={a.severity === 'urgent' ? E.red : a.severity === 'warn' ? E.amber : E.blue}>{a.severity}</Badge><span style={{ color: E.text }}>{a.title}</span><span>{ago(a.created_at)}</span></div>)}
          </div>
        )}
      </div>
    </Section>
  );
}
