import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useClientDocuments } from '../../data/useClientDocuments';
import type { ClientDocument } from '../../data/useClientDocuments';
import { useBusinessProfile } from '../../data/useBusinessProfile';
import { DOC_TYPE_LABELS } from '../../data/documentSchemas';
import type { DocType } from '../../data/documentSchemas';
import DocumentEditForm from './DocumentEditForm';
import DocumentPreview from './DocumentPreview';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const ALL_TYPES = Object.keys(DOC_TYPE_LABELS) as DocType[];

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 18 };
const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999,
  background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999,
  border: '1px solid #22262B', color: '#8A8F98', fontSize: 13, cursor: 'pointer',
};
const chip = (active: boolean): CSSProperties => ({
  padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
  border: `1px solid ${active ? '#F5F6F7' : '#22262B'}`, color: active ? '#F5F6F7' : '#565b64',
  background: active ? '#F5F6F71a' : 'transparent',
});

function BusinessProfilePanel() {
  const { profile, save } = useBusinessProfile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);

  const openPanel = () => {
    setDraft(profile);
    setOpen(true);
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => (open ? setOpen(false) : openPanel())}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>Business profile</div>
        <div style={{ fontSize: 12, color: '#565b64' }}>{open ? 'Hide' : 'Edit'}</div>
      </div>
      <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 4 }}>Shows up in every document's header/footer — set once here.</div>
      {open && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
          <input style={inputStyle} placeholder="Business address" value={draft.business_address} onChange={(e) => { setDraft({ ...draft, business_address: e.target.value }); setSaved(false); }} />
          <input style={inputStyle} placeholder="Business email" value={draft.business_email} onChange={(e) => { setDraft({ ...draft, business_email: e.target.value }); setSaved(false); }} />
          <input style={inputStyle} placeholder="Business phone" value={draft.business_phone} onChange={(e) => { setDraft({ ...draft, business_phone: e.target.value }); setSaved(false); }} />
          <input style={inputStyle} placeholder="Website" value={draft.website} onChange={(e) => { setDraft({ ...draft, website: e.target.value }); setSaved(false); }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={primaryBtn} onClick={() => { save(draft); setSaved(true); }}>Save</div>
            {saved && <span style={{ fontSize: 11.5, color: '#4CAF7D' }}>Saved.</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentDetail({ doc, onBack }: { doc: ClientDocument; onBack: () => void }) {
  const { update, duplicate, remove } = useClientDocuments();
  const { profile } = useBusinessProfile();
  const [label, setLabel] = useState(doc.label);
  const [draftData, setDraftData] = useState(doc.data);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saved, setSaved] = useState(true);

  const onDataChange = (next: Record<string, unknown>) => {
    setDraftData(next);
    setSaved(false);
  };

  const save = async () => {
    await update(doc.id, { label: label.trim() || doc.label, data: draftData });
    setSaved(true);
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: '#565b64', cursor: 'pointer', marginBottom: 14 }} onClick={onBack}>&larr; All documents</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <input style={{ ...inputStyle, fontSize: 15, fontWeight: 600, flex: 1, minWidth: 200 }} value={label} onChange={(e) => { setLabel(e.target.value); setSaved(false); }} />
        <div style={{ ...primaryBtn, opacity: saved ? 0.5 : 1 }} onClick={save}>{saved ? 'Saved' : 'Save changes'}</div>
        <div style={ghostBtn} onClick={() => duplicate(doc)}>Duplicate</div>
        <div style={{ ...ghostBtn, color: '#c47a7a' }} onClick={() => remove(doc.id).then(onBack)}>Delete</div>
      </div>

      <div style={{ display: 'inline-flex', padding: '9px 16px', borderRadius: 999, border: '1px solid #C9A24B55', background: '#C9A24B15', color: '#C9A24B', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
        Send to client — coming soon
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <div style={chip(tab === 'edit')} onClick={() => setTab('edit')}>Edit</div>
        <div style={chip(tab === 'preview')} onClick={() => setTab('preview')}>Preview</div>
      </div>

      {tab === 'edit' && <DocumentEditForm docType={doc.doc_type} data={draftData} onChange={onDataChange} />}
      {tab === 'preview' && (
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #22262B', maxWidth: 860 }}>
          <DocumentPreview docType={doc.doc_type} data={draftData} profile={profile} />
        </div>
      )}
    </div>
  );
}

export default function InvoicingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { documents, loading, create } = useClientDocuments();
  const [filter, setFilter] = useState<DocType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const selected = documents.find((d) => d.id === selectedId) ?? null;
  const filtered = filter ? documents.filter((d) => d.doc_type === filter) : documents;

  const startNew = async (docType: DocType) => {
    const doc = await create(docType);
    setShowTypePicker(false);
    if (doc) setSelectedId(doc.id);
  };

  if (selected) {
    return <DocumentDetail doc={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Invoicing</div>
          <div style={homeSubStyle}>The real Made by Marq client document set — create, edit, and preview.</div>
        </div>
        <div style={primaryBtn} onClick={() => setShowTypePicker((v) => !v)}>{showTypePicker ? 'Cancel' : '+ New document'}</div>
      </div>

      {showTypePicker && (
        <div style={{ ...cardStyle, marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ALL_TYPES.map((t) => (
            <div key={t} style={ghostBtn} onClick={() => startNew(t)}>{DOC_TYPE_LABELS[t]}</div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <BusinessProfilePanel />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={chip(filter === null)} onClick={() => setFilter(null)}>All</div>
        {ALL_TYPES.map((t) => <div key={t} style={chip(filter === t)} onClick={() => setFilter(t)}>{DOC_TYPE_LABELS[t]}</div>)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
        {filtered.map((doc) => (
          <div
            key={doc.id}
            onClick={() => setSelectedId(doc.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{doc.label}</div>
              <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 2 }}>{DOC_TYPE_LABELS[doc.doc_type]} · {new Date(doc.updated_at).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>No documents yet — start one above.</div>
        )}
      </div>
    </div>
  );
}
