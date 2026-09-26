import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Script } from '../../../data/mktEngine';
import { TONES, AUDIENCES, fillScript, setActiveScript } from '../../../data/mktEngine';
import { useDialingQueue } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { LEAD_CALL_OUTCOMES, LEAD_OUTCOME_LABEL } from '../leadflow/leadOutcomes';
import { E, btn, useIsMobile } from '../ecom/ecomShared';

interface Props {
  script: Script;
  /** Sibling scripts (same venture/audience/channel) so the tone can be
   *  switched mid-session without leaving the big-text view. */
  siblings: Script[];
  onClose: () => void;
  onLogged?: () => void;
}

/** §2.2 "Dialer mode" — the script in big text for whoever is calling,
 *  today's lead queue across the top, the six outcomes across the bottom.
 *  Tap a lead, tap what happened: two taps, and the touch carries this
 *  script's id (spec 08 M1 "done when"). */
export default function DialerMode({ script, siblings, onClose, onLogged }: Props) {
  const mobile = useIsMobile();
  const queue = useDialingQueue();
  const [current, setCurrent] = useState<Script>(script);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [saving, setSaving] = useState('');
  const [toast, setToast] = useState('');
  const [size, setSize] = useState<number>(() => { try { return Number(localStorage.getItem('mkt_dialer_size')) || 24; } catch { return 24; } });

  // The active script is what LeadFlow's own outcome buttons stamp onto
  // touches, anywhere in the app, while this view is open.
  useEffect(() => { setActiveScript(current.id); return () => setActiveScript(null); }, [current.id]);
  useEffect(() => { try { localStorage.setItem('mkt_dialer_size', String(size)); } catch { /* fine */ } }, [size]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const uncalled = useMemo(() => queue.queue.filter((l) => !l.status || l.status === 'new'), [queue.queue]);
  const lead: LeadflowLead | null = queue.queue.find((l) => l.id === leadId) ?? uncalled[0] ?? null;
  const phone = lead?.owner_phone || lead?.phone || null;
  const text = fillScript(current.body, lead);
  const audience = AUDIENCES.find((a) => a.id === current.audience)?.label ?? 'Any audience';

  const log = async (status: string) => {
    if (!lead || saving) return;
    setSaving(status);
    const ok = await queue.logCall(lead, status);
    setSaving('');
    if (ok) {
      setToast(`Logged · ${LEAD_OUTCOME_LABEL[status] ?? status} · ${lead.business_name}`);
      onLogged?.();
      // Advance to the next uncalled lead so the next call is one tap away.
      const next = queue.queue.find((l) => l.id !== lead.id && (!l.status || l.status === 'new'));
      setLeadId(next?.id ?? null);
      setTimeout(() => setToast(''), 2200);
    } else {
      setToast('Could not log that — check LeadFlow is connected.');
    }
  };

  const pill = (active: boolean): CSSProperties => ({ ...btn('ghost'), padding: '6px 12px', fontSize: 13, background: active ? E.green : '#fff', color: active ? '#fff' : E.text, border: active ? 'none' : `1px solid ${E.border}` });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: '#fff', color: E.text, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: mobile ? 'calc(10px + env(safe-area-inset-top)) 14px 8px' : '12px 20px 8px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.title} <span style={{ color: E.faint, fontWeight: 500 }}>v{current.version}</span></div>
          <div style={{ fontSize: 12, color: E.faint }}>{audience}{current.principle ? ` · ${current.principle}` : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TONES.map((t) => {
            const s = siblings.find((x) => x.tone === t.id) ?? (current.tone === t.id ? current : null);
            return <button key={t.id} disabled={!s} style={{ ...pill(current.tone === t.id), opacity: s ? 1 : 0.4 }} onClick={() => s && setCurrent(s)}>{t.label}</button>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ ...btn('ghost'), padding: '6px 10px' }} aria-label="Smaller text" onClick={() => setSize((s) => Math.max(16, s - 2))}>A−</button>
          <button style={{ ...btn('ghost'), padding: '6px 10px' }} aria-label="Bigger text" onClick={() => setSize((s) => Math.min(40, s + 2))}>A+</button>
          <button style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>

      {/* Tap 1: who you're calling. Today's queue from Dialing, uncalled first. */}
      <div style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 14px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0, alignItems: 'center' }}>
        {queue.loading && <span style={{ fontSize: 12, color: E.faint }}>Loading today's queue…</span>}
        {!queue.loading && queue.queue.length === 0 && (
          <span style={{ fontSize: 12, color: E.faint }}>{queue.notConnected ? 'LeadFlow isn\'t connected — the script still works, outcomes log in Dialing.' : 'No leads queued. Send some from Lead Pool → Dialing and they show up here.'}</span>
        )}
        {[...uncalled, ...queue.queue.filter((l) => l.status && l.status !== 'new')].map((l) => {
          const active = lead?.id === l.id;
          const done = !!l.status && l.status !== 'new';
          return (
            <button key={l.id} onClick={() => setLeadId(l.id)} style={{ ...btn('ghost'), flexShrink: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 0, padding: '6px 10px', background: active ? '#ecfdf5' : '#fff', borderColor: active ? E.green : E.border, opacity: done ? 0.55 : 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.business_name}</span>
              <span style={{ fontSize: 11, color: E.faint, fontWeight: 500 }}>{done ? LEAD_OUTCOME_LABEL[l.status!] ?? l.status : (l.owner_name || l.city || 'uncalled')}</span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: mobile ? '18px 18px 24px' : '28px 10%' }}>
        {lead && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, fontSize: 14 }}>
            <span style={{ fontWeight: 700 }}>{lead.business_name}</span>
            {lead.owner_name && <span style={{ color: E.muted }}>{lead.owner_name}</span>}
            {lead.city && <span style={{ color: E.faint }}>{lead.city}{lead.state ? `, ${lead.state}` : ''}</span>}
            {phone && <a href={`tel:${phone}`} style={{ ...btn('primary'), textDecoration: 'none', padding: '6px 12px', fontSize: 13 }}>📞 {phone}</a>}
          </div>
        )}
        <div style={{ fontSize: size, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#111', maxWidth: 860 }}>{text}</div>
      </div>

      {/* Tap 2: what happened. Same vocabulary as LeadFlow so the lead's
          status and the marketing touch never disagree. */}
      <div style={{ borderTop: '1px solid #f0f0f0', padding: mobile ? '10px 12px calc(12px + env(safe-area-inset-bottom))' : '12px 20px', background: '#fafafa', flexShrink: 0 }}>
        {toast && <div style={{ fontSize: 13, color: E.green, fontWeight: 600, marginBottom: 8 }}>{toast}</div>}
        {!lead && <div style={{ fontSize: 12, color: E.faint, marginBottom: 8 }}>Pick a lead above to log an outcome against it.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 8 }}>
          {LEAD_CALL_OUTCOMES.map((o) => (
            <button key={o.value} disabled={!lead || !!saving} onClick={() => log(o.value)} style={{ padding: mobile ? '12px 6px' : '12px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${o.color}`, background: '#fff', color: o.color, fontWeight: 700, fontSize: 13, cursor: lead ? 'pointer' : 'default', opacity: !lead || (saving && saving !== o.value) ? 0.5 : 1, fontFamily: 'inherit' }}>
              {saving === o.value ? '…' : o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
