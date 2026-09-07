import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ClientListItem } from '../data/useClients';
import type { ClientType } from '../data/types';

interface Props {
  clients: ClientListItem[];
  loading: boolean;
  error: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (businessName: string, clientType: ClientType) => Promise<ClientListItem | null>;
  /** Shown under the control when nothing's selected — each module says
   *  what picking a client actually does for it. */
  emptyHint?: string;
}

const NEW_CLIENT_VALUE = '__new__';

const wrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxWidth: 420 };
const selectStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 12px', color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none', boxSizing: 'border-box',
};
const inputStyle: CSSProperties = { ...selectStyle };
const primaryBtn: CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const ghostBtn: CSSProperties = {
  padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-body-sm)', cursor: 'pointer', whiteSpace: 'nowrap',
};
const badge: CSSProperties = {
  fontSize: 'var(--text-micro)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-tertiary)',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 8px',
};

/** The persistent control every client-facing module (Marketing, Content
 *  Creation, Brand Lab, Invoicing, Show Your Work, Client Modules, and —
 *  via its own existing browse list — Client CRM) puts at the top.
 *  Selecting a client here is what "loads that client's context into
 *  this module" means; the actual filtering is up to each module (some
 *  don't have client-scoped data yet — that arrives as their own
 *  sections get built). The one thing this component owns everywhere:
 *  which client is selected, and creating a new one without leaving the
 *  page. */
export default function ClientSelector({ clients, loading, error, selectedId, onSelect, onCreate, emptyHint }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ClientType>('client');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const handleChange = (value: string) => {
    if (value === NEW_CLIENT_VALUE) {
      setCreating(true);
      return;
    }
    onSelect(value || null);
  };

  const submitCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setCreateError('');
    const created = await onCreate(newName.trim(), newType);
    setSaving(false);
    if (!created) {
      setCreateError('Could not create that client — try again.');
      return;
    }
    onSelect(created.id);
    setCreating(false);
    setNewName('');
    setNewType('client');
  };

  if (creating) {
    return (
      <div style={wrapStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            style={{ ...inputStyle, flex: '1 1 200px' }}
            placeholder="Business name (e.g. Tacos El Compita)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); }}
          />
          <select style={{ ...selectStyle, width: 140 }} value={newType} onChange={(e) => setNewType(e.target.value as ClientType)}>
            <option value="client">Client</option>
            <option value="self">My own business</option>
            <option value="internal">Internal</option>
          </select>
        </div>
        {createError && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)' }}>{createError}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ ...primaryBtn, opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }} onClick={submitCreate}>
            {saving ? 'Creating…' : 'Create client'}
          </div>
          <div style={ghostBtn} onClick={() => { setCreating(false); setCreateError(''); }}>Cancel</div>
        </div>
      </div>
    );
  }

  if (!loading && clients.length === 0) {
    return (
      <div style={wrapStyle}>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No clients yet.</div>
        <div style={primaryBtn} onClick={() => setCreating(true)}>+ New client</div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select
          style={{ ...selectStyle, flex: '1 1 260px' }}
          value={selectedId ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={loading}
        >
          <option value="">{loading ? 'Loading clients…' : 'Select a client…'}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.business_name}{c.client_type !== 'client' ? ` (${c.client_type})` : ''}</option>
          ))}
          <option value={NEW_CLIENT_VALUE}>+ New client…</option>
        </select>
        {selected && selected.client_type !== 'client' && <span style={badge}>{selected.client_type}</span>}
      </div>
      {error && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)' }}>{error}</div>}
      {!selected && emptyHint && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>{emptyHint}</div>}
    </div>
  );
}
