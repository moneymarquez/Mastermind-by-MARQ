import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Page, Tabs, Sheet, Field, field, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import CommsThread from '../../madeby/CommsThread';
import type { Who } from '../../madeby/CommsThread';
import { DEFAULT_SEQUENCES } from '../../../data/madeby';
import type { SeqStep } from '../../../data/madeby';

interface Person { key: string; who: Who; last: string | null; unread: number }
interface Seq { id: string; name: string; list_name: string | null; steps: SeqStep[]; active: boolean }
interface Tpl { id: string; name: string; channel: 'sms' | 'email'; subject: string | null; body: string }
type Tab = 'threads' | 'templates' | 'sequences';

/** Comms hub (brief §5.6): one thread per person, every SMS and email in
 *  and out, saved forever; templates; people-list sequences. */
export default function CommsScreen() {
  const { device } = useModule();
  const phone = device === 'phone';
  const [tab, setTab] = useState<Tab>('threads');
  const [people, setPeople] = useState<Person[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [seqs, setSeqs] = useState<Seq[]>([]);
  const [editTpl, setEditTpl] = useState<Partial<Tpl> | null>(null);
  const [editSeq, setEditSeq] = useState<Partial<Seq> | null>(null);
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const [c, cl, m, t, s] = await Promise.all([
      supabase.from('contacts').select('id,name,email,phone').order('name').limit(1000),
      supabase.from('crm_clients').select('id,business_name,contact_name,contact_email,contact_phone').order('business_name'),
      supabase.from('comm_messages').select('contact_id,client_id,direction,created_at').order('created_at', { ascending: false }).limit(2000),
      supabase.from('comm_templates').select('*').order('name'),
      supabase.from('comm_sequences').select('*').order('created_at'),
    ]);
    if (m.error) { setMissing(true); return; }
    const msgs = (m.data ?? []) as { contact_id: string | null; client_id: string | null; direction: string; created_at: string }[];
    const lastOf = (k: 'contact_id' | 'client_id', id: string) => msgs.find((x) => x[k] === id)?.created_at ?? null;
    const list: Person[] = [
      ...((cl.data ?? []) as { id: string; business_name: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null }[]).map((x) => ({ key: `cl:${x.id}`, who: { clientId: x.id, name: x.contact_name ? `${x.contact_name} · ${x.business_name}` : x.business_name, email: x.contact_email, phone: x.contact_phone }, last: lastOf('client_id', x.id), unread: 0 })),
      ...((c.data ?? []) as { id: string; name: string; email: string | null; phone: string | null }[]).filter((x) => x.email || x.phone).map((x) => ({ key: `co:${x.id}`, who: { contactId: x.id, name: x.name, email: x.email, phone: x.phone }, last: lastOf('contact_id', x.id), unread: 0 })),
    ].sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || a.who.name.localeCompare(b.who.name));
    setPeople(list); setTpls((t.data ?? []) as Tpl[]);
    let sq = (s.data ?? []) as Seq[];
    if (!s.error && !sq.length) { const ins = await supabase.from('comm_sequences').insert(DEFAULT_SEQUENCES).select('*'); sq = (ins.data ?? []) as Seq[]; }
    setSeqs(sq);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => people.filter((p) => !q || `${p.who.name} ${p.who.email ?? ''} ${p.who.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())), [people, q]);
  const cur = people.find((p) => p.key === sel) ?? null;
  useEffect(() => { if (!phone && !sel && shown[0]) setSel(shown[0].key); }, [phone, sel, shown]);

  const saveTpl = async () => { if (!editTpl?.name?.trim() || !editTpl.body?.trim()) return; const row = { name: editTpl.name.trim(), channel: editTpl.channel ?? 'email', subject: editTpl.subject || null, body: editTpl.body }; if (editTpl.id) await supabase.from('comm_templates').update(row).eq('id', editTpl.id); else await supabase.from('comm_templates').insert(row); setEditTpl(null); await load(); };
  const saveSeq = async () => { if (!editSeq?.name?.trim()) return; const row = { name: editSeq.name.trim(), list_name: editSeq.list_name || null, steps: editSeq.steps ?? [], active: editSeq.active ?? true, updated_at: new Date().toISOString() }; if (editSeq.id) await supabase.from('comm_sequences').update(row).eq('id', editSeq.id); else await supabase.from('comm_sequences').insert(row); setEditSeq(null); await load(); };

  if (missing) return <Page title="Comms"><Empty text="The Comms hub needs the October migration (schema_125) applied." /></Page>;
  const listPane = (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, borderRight: phone ? 'none' : '1px solid var(--grid)' }}>
      <div style={{ padding: 12 }}><input style={{ ...field, height: 36 }} placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="mm-scroll-y" style={{ flex: 1, minHeight: 0 }}>
        {shown.map((p) => (
          <button key={p.key} onClick={() => setSel(p.key)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', width: '100%', boxSizing: 'border-box', borderTop: '1px solid var(--grid)', background: sel === p.key && !phone ? 'var(--surface-3)' : 'transparent' }}>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.who.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.last ? `last ${new Date(p.last).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'no messages'}{p.key.startsWith('cl:') ? ' · client' : ''}</span>
          </button>
        ))}
        {!shown.length && <div style={{ padding: 14, fontSize: 14, color: 'var(--text-tertiary)' }}>No one with an email or phone yet.</div>}
      </div>
    </div>
  );
  return (
    <Page title="Comms" sub="Every text and email with anyone, sent from here and kept forever." fab={tab === 'templates' ? { t: 'Template', onClick: () => setEditTpl({ channel: 'email' }) } : tab === 'sequences' ? { t: 'Sequence', onClick: () => setEditSeq({ steps: [{ delay_days: 0, channel: 'email', subject: '', body: '' }], active: true }) } : undefined}>
      <Tabs tabs={[{ id: 'threads', label: 'Threads' }, { id: 'templates', label: 'Templates' }, { id: 'sequences', label: 'Sequences' }]} value={tab} onChange={setTab} />
      {tab === 'threads' && (phone ? (
        <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>{cur ? <div style={{ padding: 14 }}><button className="mm-btn" style={{ height: 32, marginBottom: 10 }} onClick={() => setSel(null)}>‹ Everyone</button><CommsThread key={cur.key} who={cur.who} /></div> : listPane}</section>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: '320px minmax(0,1fr)', height: 'calc(100vh - 260px)', minHeight: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {listPane}
          <div className="mm-scroll-y" style={{ padding: 18, minWidth: 0 }}>{cur ? <><div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{cur.who.name}</div><CommsThread key={cur.key} who={cur.who} /></> : <div style={{ color: 'var(--text-tertiary)' }}>Pick someone on the left.</div>}</div>
        </section>
      ))}
      {tab === 'templates' && (
        <Card title="Templates" meta="{{first_name}} and {{name}} fill in">
          {tpls.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No templates yet.</div>}
          {tpls.map((t, i) => <button key={t.id} onClick={() => setEditTpl(t)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1 }}>{t.name}</span><Chip k="neutral">{t.channel}</Chip></button>)}
        </Card>
      )}
      {tab === 'sequences' && (
        <Card title="Sequences" meta="adding someone to the list starts it (owner only)">
          {seqs.map((s, i) => <button key={s.id} onClick={() => setEditSeq(s)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', fontSize: 14 }}><span style={{ flex: 1 }}>{s.name}{s.list_name ? ` · list "${s.list_name}"` : ''}</span><Chip k={s.active ? 'good' : 'neutral'}>{s.steps.length} steps{s.active ? '' : ' · off'}</Chip></button>)}
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>With DRY_RUN on, every step is logged to the thread and nothing is actually sent.</div>
        </Card>
      )}
      {editTpl && (
        <Sheet title={editTpl.id ? 'Edit template' : 'New template'} onClose={() => setEditTpl(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Name"><input style={field} value={editTpl.name ?? ''} onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>{(['email', 'sms'] as const).map((c) => <button key={c} className={`mm-btn ${editTpl.channel === c ? 'mm-btn--primary' : ''}`} style={{ flex: 1, height: 36 }} onClick={() => setEditTpl({ ...editTpl, channel: c })}>{c}</button>)}</div>
            {editTpl.channel !== 'sms' && <Field l="Subject"><input style={field} value={editTpl.subject ?? ''} onChange={(e) => setEditTpl({ ...editTpl, subject: e.target.value })} /></Field>}
            <Field l="Body"><textarea style={{ ...field, height: 160, padding: 10 }} value={editTpl.body ?? ''} onChange={(e) => setEditTpl({ ...editTpl, body: e.target.value })} /></Field>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void saveTpl()}>Save</button>
          </div>
        </Sheet>
      )}
      {editSeq && (
        <Sheet title={editSeq.id ? 'Edit sequence' : 'New sequence'} onClose={() => setEditSeq(null)} width={620}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Name"><input style={field} value={editSeq.name ?? ''} onChange={(e) => setEditSeq({ ...editSeq, name: e.target.value })} /></Field>
            <Field l="Starts when someone is added to the list"><input style={field} value={editSeq.list_name ?? ''} placeholder="Masterminds lead" onChange={(e) => setEditSeq({ ...editSeq, list_name: e.target.value })} /></Field>
            {(editSeq.steps ?? []).map((st, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>Step {i + 1} · after <input style={{ ...field, width: 64, height: 32 }} inputMode="numeric" value={st.delay_days} onChange={(e) => setEditSeq({ ...editSeq, steps: (editSeq.steps ?? []).map((x, j) => (j === i ? { ...x, delay_days: Number(e.target.value) || 0 } : x)) })} /> days by <select style={{ ...field, width: 'auto', height: 32 }} value={st.channel} onChange={(e) => setEditSeq({ ...editSeq, steps: (editSeq.steps ?? []).map((x, j) => (j === i ? { ...x, channel: e.target.value as 'email' | 'sms' } : x)) })}><option>email</option><option>sms</option></select><button className="mm-btn" style={{ height: 30, marginLeft: 'auto' }} onClick={() => setEditSeq({ ...editSeq, steps: (editSeq.steps ?? []).filter((_, j) => j !== i) })}>Remove</button></div>
                {st.channel === 'email' && <input style={field} placeholder="Subject" value={st.subject ?? ''} onChange={(e) => setEditSeq({ ...editSeq, steps: (editSeq.steps ?? []).map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)) })} />}
                <textarea style={{ ...field, height: 100, padding: 10 }} value={st.body} onChange={(e) => setEditSeq({ ...editSeq, steps: (editSeq.steps ?? []).map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
              </div>
            ))}
            <button className="mm-btn" style={{ alignSelf: 'flex-start', height: 32 }} onClick={() => setEditSeq({ ...editSeq, steps: [...(editSeq.steps ?? []), { delay_days: 3, channel: 'email', subject: '', body: '' }] })}>+ Step</button>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={editSeq.active ?? true} onChange={(e) => setEditSeq({ ...editSeq, active: e.target.checked })} /> On</label>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void saveSeq()}>Save</button>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
