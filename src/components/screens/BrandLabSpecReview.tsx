import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { FunctionalSpec, SpecFunctionalityKind } from '../../data/types';

interface Props {
  spec: FunctionalSpec | null;
  approvedAt: string | null;
  busy: boolean;
  error: string;
  onGenerate: () => void;
  onChange: (next: FunctionalSpec) => void;
  onApprove: () => void;
  onUnlock: () => void;
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16, maxWidth: 680 };
const input: CSSProperties = {
  background: 'transparent', border: 'none', borderBottom: '1px solid transparent', padding: '4px 0', color: 'var(--text)',
  fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};
const primaryBtn: CSSProperties = {
  padding: '11px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center',
};
const ghostBtn: CSSProperties = {
  padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
};
const h: CSSProperties = { fontSize: 'var(--text-caption)', letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, margin: '14px 0 8px' };
const KIND_COLOR: Record<SpecFunctionalityKind, string> = { static: 'var(--text-tertiary)', form: 'var(--warning)', integration: '#6a8fc9', dynamic: 'var(--danger)' };
const KINDS: SpecFunctionalityKind[] = ['static', 'form', 'integration', 'dynamic'];

function Check({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${on ? 'var(--text)' : 'var(--border-2)'}`, background: on ? 'var(--text)' : 'transparent', color: 'var(--bg)', fontSize: 13, fontWeight: 700,
      }}
    >
      {on ? '✓' : ''}
    </div>
  );
}

/** The functional spec as a checklist the operator approves or edits
 *  BEFORE any prompt exists. Uncheck to drop an item, tap a label to edit
 *  it, retag functionality by tapping its kind, add a row at the bottom
 *  of any list. Approve locks it (read-only, inputs disabled); Unlock
 *  reopens it and — by design — invalidates any prompts generated from
 *  the previous version (the caller clears them). */
export default function BrandLabSpecReview({ spec, approvedAt, busy, error, onGenerate, onChange, onApprove, onUnlock }: Props) {
  const [adding, setAdding] = useState<Record<string, string>>({});
  const locked = !!approvedAt;

  if (!spec) {
    return (
      <div style={card}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Functional spec</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
          What the site <em>does</em>, decided before what it looks like — every page, every section, every interactive thing tagged by what it costs to build. You approve or edit it; both prompts inherit from it. Scope gets settled here, once.
        </div>
        {error && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
        <div style={{ ...primaryBtn, marginTop: 14, opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }} onClick={onGenerate}>
          {busy ? 'Drafting the spec…' : 'Draft the spec'}
        </div>
      </div>
    );
  }

  const patch = (next: Partial<FunctionalSpec>) => onChange({ ...spec, ...next });
  const setList = (key: 'data_model' | 'admin_needs' | 'out_of_scope', items: string[]) => patch({ [key]: items });
  const addTo = (key: 'data_model' | 'admin_needs' | 'out_of_scope') => {
    const v = (adding[key] ?? '').trim();
    if (!v) return;
    setList(key, [...spec[key], v]);
    setAdding((a) => ({ ...a, [key]: '' }));
  };
  const addFunctionality = () => {
    const v = (adding.functionality ?? '').trim();
    if (!v) return;
    patch({ functionality: [...spec.functionality, { id: `custom-${Date.now().toString(36)}`, label: v, kind: 'static', page_id: null, enabled: true }] });
    setAdding((a) => ({ ...a, functionality: '' }));
  };
  const cycleKind = (id: string) => {
    if (locked) return;
    patch({ functionality: spec.functionality.map((f) => (f.id === id ? { ...f, kind: KINDS[(KINDS.indexOf(f.kind) + 1) % KINDS.length] } : f)) });
  };

  const enabledCount = spec.functionality.filter((f) => f.enabled).length;
  const kindCounts = KINDS.map((k) => [k, spec.functionality.filter((f) => f.enabled && f.kind === k).length] as const).filter(([, n]) => n > 0);

  return (
    <div style={{ ...card, borderColor: locked ? 'color-mix(in srgb, var(--success) 45%, var(--border))' : 'var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Functional spec {locked ? '· approved' : '· review'}</div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 3 }}>
            {spec.pages.filter((p) => p.enabled).length} page{spec.pages.filter((p) => p.enabled).length === 1 ? '' : 's'} · {enabledCount} interactive · {kindCounts.map(([k, n]) => `${n} ${k}`).join(', ')}
          </div>
        </div>
        {locked ? (
          <span style={ghostBtn} onClick={onUnlock}>Unlock to edit</span>
        ) : (
          <span style={ghostBtn} onClick={onGenerate}>{busy ? 'Redrafting…' : 'Redraft'}</span>
        )}
      </div>

      {error && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)', marginTop: 10 }}>{error}</div>}

      <div style={h}>Summary</div>
      <textarea
        disabled={locked}
        style={{ ...input, minHeight: 70, resize: 'vertical', lineHeight: 1.5, background: 'var(--surface-4)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', border: '1px solid var(--border-2)' }}
        value={spec.summary}
        onChange={(e) => patch({ summary: e.target.value })}
      />

      <div style={h}>Pages & sections</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {spec.pages.map((p) => (
          <div key={p.id} style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)', opacity: p.enabled ? 1 : 0.45 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Check on={p.enabled} disabled={locked} onToggle={() => patch({ pages: spec.pages.map((x) => (x.id === p.id ? { ...x, enabled: !x.enabled } : x)) })} />
              <input disabled={locked} style={{ ...input, fontWeight: 600 }} value={p.name} onChange={(e) => patch({ pages: spec.pages.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) })} />
            </div>
            <input disabled={locked} style={{ ...input, fontSize: 14, color: 'var(--text-secondary)', paddingLeft: 32 }} value={p.purpose} placeholder="Purpose" onChange={(e) => patch({ pages: spec.pages.map((x) => (x.id === p.id ? { ...x, purpose: e.target.value } : x)) })} />
            <div style={{ paddingLeft: 32, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {p.sections.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', width: 16, flexShrink: 0 }}>{i + 1}.</span>
                  <input disabled={locked} style={{ ...input, fontSize: 14 }} value={s} onChange={(e) => patch({ pages: spec.pages.map((x) => (x.id === p.id ? { ...x, sections: x.sections.map((y, j) => (j === i ? e.target.value : y)) } : x)) })} />
                  {!locked && <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => patch({ pages: spec.pages.map((x) => (x.id === p.id ? { ...x, sections: x.sections.filter((_, j) => j !== i) } : x)) })}>✕</span>}
                </div>
              ))}
              {!locked && (
                <input
                  style={{ ...input, fontSize: 14, color: 'var(--text-tertiary)' }}
                  placeholder="+ add section"
                  value={adding[`sec-${p.id}`] ?? ''}
                  onChange={(e) => setAdding((a) => ({ ...a, [`sec-${p.id}`]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    const v = (adding[`sec-${p.id}`] ?? '').trim();
                    if (!v) return;
                    patch({ pages: spec.pages.map((x) => (x.id === p.id ? { ...x, sections: [...x.sections, v] } : x)) });
                    setAdding((a) => ({ ...a, [`sec-${p.id}`]: '' }));
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={h}>Functionality — tap the tag to retag</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {spec.functionality.map((f) => (
          <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-4)', opacity: f.enabled ? 1 : 0.45 }}>
            <Check on={f.enabled} disabled={locked} onToggle={() => patch({ functionality: spec.functionality.map((x) => (x.id === f.id ? { ...x, enabled: !x.enabled } : x)) })} />
            <input disabled={locked} style={{ ...input, fontSize: 14 }} value={f.label} onChange={(e) => patch({ functionality: spec.functionality.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) })} />
            <span
              onClick={() => cycleKind(f.id)}
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--radius-pill)', border: `1px solid ${KIND_COLOR[f.kind]}`, color: KIND_COLOR[f.kind], cursor: locked ? 'default' : 'pointer', flexShrink: 0 }}
            >
              {f.kind}
            </span>
          </div>
        ))}
        {!locked && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...input, fontSize: 14, color: 'var(--text-tertiary)', padding: '8px 10px', background: 'var(--surface-4)', borderRadius: 'var(--radius-sm)' }} placeholder="+ add functionality (tagged static — retag after)" value={adding.functionality ?? ''} onChange={(e) => setAdding((a) => ({ ...a, functionality: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addFunctionality(); }} />
          </div>
        )}
      </div>

      {([['data_model', 'Data model — what gets stored'], ['admin_needs', 'Owner must be able to change'], ['out_of_scope', 'Out of scope — explicit']] as const).map(([key, title]) => (
        <div key={key}>
          <div style={h}>{title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {spec[key].length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>{key === 'data_model' ? 'Nothing stored — static site.' : 'None listed.'}</div>}
            {spec[key].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: key === 'out_of_scope' ? 'var(--danger)' : 'var(--text-tertiary)', flexShrink: 0 }}>{key === 'out_of_scope' ? '✕' : '•'}</span>
                <input disabled={locked} style={{ ...input, fontSize: 14 }} value={item} onChange={(e) => setList(key, spec[key].map((x, j) => (j === i ? e.target.value : x)))} />
                {!locked && <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setList(key, spec[key].filter((_, j) => j !== i))}>✕</span>}
              </div>
            ))}
            {!locked && (
              <input style={{ ...input, fontSize: 14, color: 'var(--text-tertiary)' }} placeholder="+ add" value={adding[key] ?? ''} onChange={(e) => setAdding((a) => ({ ...a, [key]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addTo(key); }} />
            )}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
        {locked ? (
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--success)' }}>Approved {new Date(approvedAt as string).toLocaleString()} — prompts below are generated from this exact spec.</div>
        ) : (
          <>
            <div style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }} onClick={onApprove}>Approve spec</div>
            <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>Locks it. Prompts only generate from an approved spec.</span>
          </>
        )}
      </div>
    </div>
  );
}
