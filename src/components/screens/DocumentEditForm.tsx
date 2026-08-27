import type { CSSProperties } from 'react';
import type { DocType, PackageTier } from '../../data/documentSchemas';
import { DOCUMENT_SCHEMAS } from '../../data/documentSchemas';

interface Props {
  docType: DocType;
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none', width: '100%',
};
const groupLabel: CSSProperties = { fontSize: 'var(--text-tiny)', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 22, marginBottom: 10 };
const fieldLabel: CSSProperties = { fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginBottom: 5 };
const ghostBtn: CSSProperties = { fontSize: 'var(--text-small)', color: 'var(--text-secondary)', cursor: 'pointer' };
const addBtn: CSSProperties = { display: 'inline-block', marginTop: 10, padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 'var(--text-small)', cursor: 'pointer' };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export default function DocumentEditForm({ docType, data, onChange }: Props) {
  const schema = DOCUMENT_SCHEMAS[docType];
  const setField = (key: string, value: string) => onChange({ ...data, [key]: value });

  const groups: string[] = [];
  for (const f of schema.fields) {
    const g = f.group ?? '';
    if (!groups.includes(g)) groups.push(g);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 480 }}>
      {groups.map((g) => (
        <div key={g}>
          {g && <div style={groupLabel}>{g}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {schema.fields.filter((f) => (f.group ?? '') === g).map((f) => (
              <div key={f.key}>
                <div style={fieldLabel}>{f.label}</div>
                {f.type === 'textarea' ? (
                  <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} value={s(data[f.key])} onChange={(e) => setField(f.key, e.target.value)} />
                ) : (
                  <input style={inputStyle} type={f.type === 'date' ? 'text' : 'text'} placeholder={f.type === 'date' ? 'e.g. 12 August 2026' : ''} value={s(data[f.key])} onChange={(e) => setField(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {schema.tables.map((t) => {
        const rows = Array.isArray(data[t.key]) ? (data[t.key] as Record<string, string>[]) : [];
        const setRows = (next: Record<string, string>[]) => onChange({ ...data, [t.key]: next });
        return (
          <div key={t.key}>
            <div style={groupLabel}>{t.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((row, i) => (
                <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {t.columns.map((c) => (
                    <input
                      key={c.key} style={inputStyle} placeholder={c.label}
                      value={s(row[c.key])}
                      onChange={(e) => setRows(rows.map((r, ri) => (ri === i ? { ...r, [c.key]: e.target.value } : r)))}
                    />
                  ))}
                  <div style={ghostBtn} onClick={() => setRows(rows.filter((_, ri) => ri !== i))}>Remove row</div>
                </div>
              ))}
            </div>
            <div style={addBtn} onClick={() => setRows([...rows, { ...t.defaultRow }])}>+ Add row</div>
          </div>
        );
      })}

      {schema.hasTiers && <TiersEditor data={data} onChange={onChange} />}
    </div>
  );
}

function TiersEditor({ data, onChange }: { data: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  const tiers = (Array.isArray(data.tiers) ? data.tiers : []) as PackageTier[];
  const setTiers = (next: PackageTier[]) => onChange({ ...data, tiers: next });
  const setTier = (i: number, patch: Partial<PackageTier>) => setTiers(tiers.map((t, ti) => (ti === i ? { ...t, ...patch } : t)));

  return (
    <div>
      <div style={groupLabel}>Pricing tiers</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {tiers.map((tier, i) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={fieldLabel}>Badge (optional, e.g. "Most popular")</div>
            <input style={inputStyle} value={s(tier.badge)} onChange={(e) => setTier(i, { badge: e.target.value })} />
            <div style={fieldLabel}>Tier name</div>
            <input style={inputStyle} value={s(tier.tier_label)} onChange={(e) => setTier(i, { tier_label: e.target.value })} />
            <div style={fieldLabel}>Price / mo</div>
            <input style={inputStyle} value={s(tier.price)} onChange={(e) => setTier(i, { price: e.target.value })} />
            <div style={fieldLabel}>Description</div>
            <input style={inputStyle} value={s(tier.description)} onChange={(e) => setTier(i, { description: e.target.value })} />
            <div style={fieldLabel}>Features</div>
            {(tier.features ?? []).map((f, fi) => (
              <div key={fi} style={{ display: 'flex', gap: 8 }}>
                <input style={inputStyle} value={f} onChange={(e) => setTier(i, { features: tier.features.map((ft, fti) => (fti === fi ? e.target.value : ft)) })} />
                <div style={ghostBtn} onClick={() => setTier(i, { features: tier.features.filter((_, fti) => fti !== fi) })}>✕</div>
              </div>
            ))}
            <div style={addBtn} onClick={() => setTier(i, { features: [...(tier.features ?? []), ''] })}>+ Add feature</div>
          </div>
        ))}
      </div>
    </div>
  );
}
