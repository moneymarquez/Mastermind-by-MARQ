import { useState } from 'react';
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
            <TeachingEmpty what="Revenue, orders and conversion show here once Shopify is connected." worker="Analytics" connection="Shopify custom app token" phase={7} />
          </div>
        )}
      </div>

      <Section title="30-day revenue + views">
        <div style={{ ...E.card, padding: 16 }}>
          <TeachingEmpty what="The chart fills from Shopify orders and post metrics." worker="Analytics" connection="Shopify + Instagram / TikTok" phase={7} />
        </div>
      </Section>

      <Section title={`The 10 steps · ${done} done`} aside={<ProgressRing done={done} total={10} size={34} />}>
        <div data-demo="brand-steps" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STEPS.map((s) => (
            <StepCard key={s.n} brand={brand} def={s} open={current === s.n} onToggle={() => setOpenStep(current === s.n ? -1 : s.n)} onSave={(state) => onSaveStep(brand, s.n, state)} />
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
