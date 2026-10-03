import type { CSSProperties } from 'react';
import type { ClientStage } from '../../data/types';

/** Shared look for the client screens (Client CRM and everything it opens).
 *  Lives on its own so those screens can import it without importing
 *  ClientCRMScreen, which imports them back: that cycle left inputStyle
 *  uninitialized when Client Modules loaded first, and the screen crashed. */

export const STAGES: { key: ClientStage; label: string }[] = [
  { key: 'new_lead', label: 'New Lead' },
  { key: 'discovery_complete', label: 'Discovery Complete' },
  { key: 'analysis_sent', label: 'Analysis Sent' },
  { key: 'invoice_sent', label: 'Invoice Sent' },
  { key: 'active', label: 'Active (Paid)' },
  { key: 'retainer', label: 'Retainer' },
];

export const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
export const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 13px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
export const selectStyle: CSSProperties = { ...inputStyle, cursor: 'pointer' };
// display:'inline-flex' (not the <span>/<div> default of 'inline') matters
// beyond alignment: margin-top/bottom has NO EFFECT on plain inline
// elements per spec, so a caller doing `{...ghostBtn, marginBottom: 14}`
// outside a flex container was silently a no-op — that's what let "Marq"
// crowd right up against the "← All clients" button above it. inline-flex
// keeps these sitting inline like text (unchanged everywhere they're used
// today) while making their own margin actually apply.
export const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer',
};
// A visible fill (not fully transparent) so this reads as a real button
// sitting on a card or the bare page background, not as clickable text —
// var(--surface-3) is a deliberate step away from cardStyle's
// var(--surface) so a ghost button on a card doesn't blend into it.
export const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'var(--surface-3)',
  color: 'var(--text-secondary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
export const tabStyle = (active: boolean): CSSProperties => ({
  padding: '8px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600,
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, color: active ? 'var(--text)' : 'var(--text-tertiary)',
});

