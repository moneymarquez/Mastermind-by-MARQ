import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientDocuments } from '../../data/useClientDocuments';
import type { ClientDocument } from '../../data/useClientDocuments';
import { useBusinessProfile } from '../../data/useBusinessProfile';
import { useContacts } from '../../data/useContacts';
import { DOC_TYPE_LABELS, QUICK_START_FIELDS } from '../../data/documentSchemas';
import type { DocType } from '../../data/documentSchemas';
import DocumentEditForm from './DocumentEditForm';
import DocumentPreview from './DocumentPreview';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const ALL_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 18 };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)',
  background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 'var(--text-body)', cursor: 'pointer',
};
const chip = (active: boolean): CSSProperties => ({
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600, whiteSpace: 'nowrap',
  border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`, color: active ? 'var(--text)' : 'var(--text-tertiary)',
  background: active ? '#F5F6F71a' : 'transparent',
});
const fieldLabel: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5 };

function BusinessProfilePanel() {
  const { profile, save, error } = useBusinessProfile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const openPanel = () => {
    setDraft(profile);
    setOpen(true);
  };

  const doSave = async () => {
    setSaving(true);
    const ok = await save(draft);
    setSaving(false);
    setSaved(ok);
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => (open ? setOpen(false) : openPanel())}>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Business profile</div>
        <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>{open ? 'Hide' : 'Edit'}</div>
      </div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>Shows up in every document's header/footer — set once here.</div>
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
          <input style={inputStyle} placeholder="Business address" value={draft.business_address} onChange={(e) => { setDraft({ ...draft, business_address: e.target.value }); setSaved(false); }} />
          <input style={inputStyle} placeholder="Business email" value={draft.business_email} onChange={(e) => { setDraft({ ...draft, business_email: e.target.value }); setSaved(false); }} />
          <input style={inputStyle} placeholder="Business phone" value={draft.business_phone} onChange={(e) => { setDraft({ ...draft, business_phone: e.target.value }); setSaved(false); }} />
          <input style={inputStyle} placeholder="Website" value={draft.website} onChange={(e) => { setDraft({ ...draft, website: e.target.value }); setSaved(false); }} />
          {error && <div style={{ fontSize: 'var(--text-caption)', color: '#c47a7a' }}>Couldn't save: {error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }} onClick={() => !saving && doSave()}>{saving ? 'Saving…' : 'Save'}</div>
            {saved && !error && <span style={{ fontSize: 'var(--text-caption)', color: '#4CAF7D' }}>Saved.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function NewDocumentPanel({ onCreated }: { onCreated: (id: string) => void }) {
  const { create, error } = useClientDocuments();
  const { contacts } = useContacts();
  const [docType, setDocType] = useState<DocType>('invoice');
  const [mode, setMode] = useState<'contact' | 'manual'>('manual');
  const [contactId, setContactId] = useState('');
  const [manual, setManual] = useState({ clientName: '', clientCompany: '', clientEmail: '', projectName: '' });
  const [creating, setCreating] = useState(false);

  const mapping = QUICK_START_FIELDS[docType];
  const selectedContact = contacts.find((c) => c.id === contactId);

  const create1 = async () => {
    setCreating(true);
    const initialData: Record<string, unknown> = {};
    let label = DOC_TYPE_LABELS[docType];

    if (mapping) {
      const name = mode === 'contact' ? selectedContact?.name ?? '' : manual.clientName;
      const company = mode === 'contact' ? selectedContact?.business_name ?? '' : manual.clientCompany;
      const email = mode === 'contact' ? selectedContact?.email ?? '' : manual.clientEmail;
      const projectName = manual.projectName;

      if (mapping.clientNameKey && name) initialData[mapping.clientNameKey] = name;
      if (mapping.clientCompanyKey && company) initialData[mapping.clientCompanyKey] = company;
      if (mapping.clientEmailKey && email) initialData[mapping.clientEmailKey] = email;
      if (mapping.projectNameKey && projectName) initialData[mapping.projectNameKey] = projectName;

      if (name) label = `${name} — ${DOC_TYPE_LABELS[docType]}`;
      else if (projectName) label = `${projectName} — ${DOC_TYPE_LABELS[docType]}`;
    }

    const doc = await create(docType, label, mode === 'contact' ? contactId || null : null, initialData);
    setCreating(false);
    if (doc) {
      setContactId('');
      setManual({ clientName: '', clientCompany: '', clientEmail: '', projectName: '' });
      onCreated(doc.id);
    }
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>New document</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14 }}>Pick a type, then link a contact or type the client info in — it's created already filled in, not blank.</div>

      <div style={fieldLabel}>Document type</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {ALL_TYPES.map((t) => <div key={t} style={chip(docType === t)} onClick={() => setDocType(t)}>{DOC_TYPE_LABELS[t]}</div>)}
      </div>

      {mapping && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={chip(mode === 'contact')} onClick={() => setMode('contact')}>Link a contact</div>
            <div style={chip(mode === 'manual')} onClick={() => setMode('manual')}>Enter manually</div>
          </div>

          {mode === 'contact' ? (
            <div style={{ maxWidth: 420 }}>
              <div style={fieldLabel}>Contact</div>
              <select style={inputStyle} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">Select a contact…</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.business_name ? ` — ${c.business_name}` : ''}</option>)}
              </select>
              {mapping.projectNameKey && (
                <div style={{ marginTop: 10 }}>
                  <div style={fieldLabel}>{mapping.projectNameLabel}</div>
                  <input style={inputStyle} value={manual.projectName} onChange={(e) => setManual({ ...manual, projectName: e.target.value })} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
              {mapping.clientNameKey && (
                <div>
                  <div style={fieldLabel}>Client name</div>
                  <input style={inputStyle} value={manual.clientName} onChange={(e) => setManual({ ...manual, clientName: e.target.value })} />
                </div>
              )}
              {mapping.clientCompanyKey && (
                <div>
                  <div style={fieldLabel}>Client company</div>
                  <input style={inputStyle} value={manual.clientCompany} onChange={(e) => setManual({ ...manual, clientCompany: e.target.value })} />
                </div>
              )}
              {mapping.clientEmailKey && (
                <div>
                  <div style={fieldLabel}>Client email</div>
                  <input style={inputStyle} value={manual.clientEmail} onChange={(e) => setManual({ ...manual, clientEmail: e.target.value })} />
                </div>
              )}
              {mapping.projectNameKey && (
                <div>
                  <div style={fieldLabel}>{mapping.projectNameLabel}</div>
                  <input style={inputStyle} value={manual.projectName} onChange={(e) => setManual({ ...manual, projectName: e.target.value })} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {error && <div style={{ fontSize: 'var(--text-small)', color: '#c47a7a', marginTop: 12 }}>Couldn't create it: {error}</div>}
      <div style={{ ...primaryBtn, marginTop: 12, opacity: creating ? 0.6 : 1 }} onClick={() => !creating && create1()}>
        {creating ? 'Creating…' : 'Create document'}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<ClientDocument['status'], string> = { draft: 'Draft', sent: 'Sent', paid: 'Paid' };
const STATUS_COLOR: Record<ClientDocument['status'], string> = { draft: 'var(--text-tertiary)', sent: '#C9A24B', paid: '#7fae7f' };

function DocumentDetail({ doc, onBack, startTab }: { doc: ClientDocument; onBack: () => void; startTab: 'edit' | 'preview' }) {
  const { update, duplicate, remove, setStatus, error } = useClientDocuments();
  const { profile } = useBusinessProfile();
  const [label, setLabel] = useState(doc.label);
  const [draftData, setDraftData] = useState(doc.data);
  // Local + optimistic, same reason label/draftData are: this component's
  // own useClientDocuments() call is a separate hook instance from the
  // parent's (which is what `doc` was read from), so a refetch here
  // doesn't flow back into the `doc` prop — mirroring an existing pattern
  // in this file rather than a new inconsistency.
  const [status, setLocalStatus] = useState(doc.status);
  const [tab, setTab] = useState<'edit' | 'preview'>(startTab);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  const onDataChange = (next: Record<string, unknown>) => {
    setDraftData(next);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const ok = await update(doc.id, { label: label.trim() || doc.label, data: draftData });
    setSaving(false);
    setSaved(ok);
  };

  return (
    <div>
      <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', cursor: 'pointer', marginBottom: 14 }} onClick={onBack}>&larr; All documents</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input style={{ ...inputStyle, fontSize: 'var(--text-subhead)', fontWeight: 600, flex: 1, minWidth: 200 }} value={label} onChange={(e) => { setLabel(e.target.value); setSaved(false); }} />
        <div style={{ ...primaryBtn, opacity: saving ? 0.6 : saved ? 0.5 : 1 }} onClick={() => !saving && save()}>{saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</div>
        <div style={ghostBtn} onClick={() => duplicate(doc)}>Duplicate</div>
        <div style={{ ...ghostBtn, color: '#c47a7a' }} onClick={() => remove(doc.id).then((ok) => ok && onBack())}>Delete</div>
      </div>
      {error && <div style={{ fontSize: 'var(--text-small)', color: '#c47a7a', marginBottom: 10 }}>Couldn't save: {error}</div>}

      <div style={{ display: 'inline-flex', padding: '9px 16px', borderRadius: 'var(--radius-pill)', border: '1px solid #C9A24B55', background: '#C9A24B15', color: '#C9A24B', fontSize: 'var(--text-small)', fontWeight: 600, marginBottom: 16 }}>
        Send to client — coming soon
      </div>

      {doc.doc_type === 'invoice' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)' }}>Status:</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['draft', 'sent', 'paid'] as const).map((s) => (
              <div
                key={s}
                onClick={() => { setLocalStatus(s); setStatus(doc.id, s); }}
                style={{
                  padding: '5px 14px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-caption)', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${status === s ? STATUS_COLOR[s] : 'var(--border)'}`,
                  color: status === s ? STATUS_COLOR[s] : 'var(--text-tertiary)',
                  background: status === s ? `${STATUS_COLOR[s]}15` : 'transparent',
                }}
              >
                {STATUS_LABEL[s]}
              </div>
            ))}
          </div>
          {status === 'paid' && (
            <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>Counted as income in Budgeting.</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div style={chip(tab === 'preview')} onClick={() => setTab('preview')}>Preview</div>
        <div style={chip(tab === 'edit')} onClick={() => setTab('edit')}>Edit</div>
      </div>

      {tab === 'edit' && <DocumentEditForm docType={doc.doc_type} data={draftData} onChange={onDataChange} />}
      {tab === 'preview' && (
        <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border)', maxWidth: 860 }}>
          <DocumentPreview docType={doc.doc_type} data={draftData} profile={profile} />
        </div>
      )}
    </div>
  );
}

export default function InvoicingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { documents, loading } = useClientDocuments();
  const { contacts } = useContacts();
  const [filter, setFilter] = useState<DocType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedFromCreate, setOpenedFromCreate] = useState(false);

  const selected = documents.find((d) => d.id === selectedId) ?? null;
  const filtered = filter ? documents.filter((d) => d.doc_type === filter) : documents;
  const contactName = (id: string | null) => (id ? contacts.find((c) => c.id === id)?.name ?? null : null);

  if (selected) {
    return <DocumentDetail doc={selected} onBack={() => setSelectedId(null)} startTab={openedFromCreate ? 'edit' : 'preview'} />;
  }

  return (
    <div>
      <div style={homeHeadStyle}>Invoicing</div>
      <div style={homeSubStyle}>The real Made by Marq client document set — create, edit, and preview.</div>

      <div style={{ marginTop: 20 }}>
        <NewDocumentPanel onCreated={(id) => { setOpenedFromCreate(true); setSelectedId(id); }} />
        <BusinessProfilePanel />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={chip(filter === null)} onClick={() => setFilter(null)}>All</div>
        {ALL_TYPES.map((t) => <div key={t} style={chip(filter === t)} onClick={() => setFilter(t)}>{DOC_TYPE_LABELS[t]}</div>)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {filtered.map((doc) => {
          const dataClientName = typeof doc.data.client_name === 'string' && doc.data.client_name ? doc.data.client_name : null;
          const subtitle = dataClientName ?? contactName(doc.contact_id);
          return (
            <div
              key={doc.id}
              onClick={() => { setOpenedFromCreate(false); setSelectedId(doc.id); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)', cursor: 'pointer' }}
            >
              <div>
                <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{doc.label}</div>
                <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {DOC_TYPE_LABELS[doc.doc_type]}{subtitle ? ` · ${subtitle}` : ''} · {new Date(doc.updated_at).toLocaleDateString()}
                </div>
              </div>
              {doc.doc_type === 'invoice' && (
                <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, color: STATUS_COLOR[doc.status], border: `1px solid ${STATUS_COLOR[doc.status]}`, borderRadius: 'var(--radius-pill)', padding: '3px 10px', flexShrink: 0 }}>
                  {STATUS_LABEL[doc.status]}
                </span>
              )}
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 18, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', background: 'var(--surface-2)' }}>No documents yet — start one above.</div>
        )}
      </div>
    </div>
  );
}
