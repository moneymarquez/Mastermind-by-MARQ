import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import { Page, Sheet, Field, field } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import MiniMarkdown from '../../MiniMarkdown';
import { CONTRACT_TEMPLATES, CONTRACTS_FOOTER, DEFAULT_SENDER, fillTemplate, templateVars, missingVars } from '../../../data/madeby';

interface Tpl { id: string; key: string | null; name: string; kind: string; body: string }
interface Contract { id: string; title: string; to_name: string; to_email: string | null; status: string; body: string; variables: Record<string, string>; template_id: string | null; client_id: string | null; contact_id: string | null; project: string | null; sent_at: string | null; viewed_at: string | null; signed_at: string | null; signer_name: string | null; signer_ip: string | null; signed_html: string | null; created_at: string }
const STATUS_K: Record<string, 'neutral' | 'warn' | 'good' | 'bad' | 'accent'> = { draft: 'neutral', sent: 'warn', viewed: 'accent', signed: 'good', declined: 'bad' };
const PROJECTS = ['Made by Marq', 'APHS', 'Masterminds', 'E-commerce', 'Personal'];

/** Contracts (brief §5.5): a template library, fill-in variables, a
 *  signing link by email, and a signed record with name, time and IP. */
export default function ContractsScreen() {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [rows, setRows] = useState<Contract[]>([]);
  const [sender, setSender] = useState(DEFAULT_SENDER);
  const [draft, setDraft] = useState<{ tpl: Tpl | null; to_name: string; to_email: string; client_id: string | null; contact_id: string | null; title: string; vars: Record<string, string>; body: string; project: string } | null>(null);
  const [editTpl, setEditTpl] = useState<Partial<Tpl> | null>(null);
  const [open, setOpen] = useState<Contract | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string; email: string | null; kind: 'client' | 'contact' }[]>([]);
  const [msg, setMsg] = useState('');
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const [t, c, bp, cl, co] = await Promise.all([
      supabase.from('contract_templates').select('id,key,name,kind,body').order('created_at'),
      supabase.from('contracts').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('business_profile').select('sender_entity').maybeSingle(),
      supabase.from('crm_clients').select('id,business_name,contact_name,contact_email').order('business_name'),
      supabase.from('contacts').select('id,name,email').not('email', 'is', null).order('name').limit(300),
    ]);
    if (t.error || c.error) { setMissing(true); return; }
    let list = (t.data ?? []) as Tpl[];
    if (!list.length) { const ins = await supabase.from('contract_templates').insert(CONTRACT_TEMPLATES.map((x) => ({ ...x, variables: templateVars(x.body) }))).select('id,key,name,kind,body'); list = (ins.data ?? []) as Tpl[]; }
    setTpls(list); setRows((c.data ?? []) as Contract[]);
    setSender((bp.data as { sender_entity?: string | null } | null)?.sender_entity || DEFAULT_SENDER);
    setPeople([...((cl.data ?? []) as { id: string; business_name: string; contact_name: string | null; contact_email: string | null }[]).map((x) => ({ id: x.id, name: x.contact_name ? `${x.contact_name} (${x.business_name})` : x.business_name, email: x.contact_email, kind: 'client' as const })), ...((co.data ?? []) as { id: string; name: string; email: string | null }[]).map((x) => ({ ...x, kind: 'contact' as const }))]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  // Arriving from a client's Docs tab: start a contract for them.
  useEffect(() => {
    let cid: string | null = null; try { cid = sessionStorage.getItem('contract_for_client'); sessionStorage.removeItem('contract_for_client'); } catch { /* fine */ }
    if (cid && tpls.length) { const p = people.find((x) => x.id === cid); start(tpls[0], p ?? null); }
  }, [tpls.length, people.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (tpl: Tpl, p: { id: string; name: string; email: string | null; kind: 'client' | 'contact' } | null = null) => setDraft({ tpl, to_name: p?.name.replace(/ \(.*\)$/, '') ?? '', to_email: p?.email ?? '', client_id: p?.kind === 'client' ? p.id : null, contact_id: p?.kind === 'contact' ? p.id : null, title: tpl.name, vars: { sender_entity: sender, start_date: new Date().toISOString().slice(0, 10), client_name: p?.name.replace(/ \(.*\)$/, '') ?? '', payment_terms: '15', notice_days: '30' }, body: tpl.body, project: tpl.key === 'contractor_aphs' ? 'APHS' : 'Made by Marq' });
  const vars = draft ? templateVars(draft.body) : [];
  const preview = draft ? fillTemplate(draft.body, { ...draft.vars, client_name: draft.vars.client_name || draft.to_name }) : '';
  const missingNow = draft ? missingVars(draft.body, { ...draft.vars, client_name: draft.vars.client_name || draft.to_name }) : [];
  const save = async (send: boolean) => {
    if (!draft || !draft.to_name.trim()) return;
    const row = { template_id: draft.tpl?.id ?? null, client_id: draft.client_id, contact_id: draft.contact_id, to_name: draft.to_name.trim(), to_email: draft.to_email.trim() || null, title: draft.title.trim() || 'Agreement', body: preview, variables: draft.vars, sender_entity: draft.vars.sender_entity || sender, project: draft.project };
    const { data, error } = await supabase.from('contracts').insert(row).select('id').single();
    if (error) { setMsg(error.message); return; }
    if (send) { const r = await api<{ status?: string; error?: string; link?: string }>('/api/contracts/send', { body: { id: (data as { id: string }).id } }); setMsg(r.error ?? (r.status === 'dry_run' ? `DRY_RUN: email logged, not sent. Signing link: ${r.link}` : 'Sent with a signing link.')); }
    else setMsg('Saved as a draft.');
    setDraft(null); await load();
  };
  const saveTpl = async () => {
    if (!editTpl?.name?.trim() || !editTpl.body?.trim()) return;
    const row = { name: editTpl.name.trim(), kind: editTpl.kind ?? 'other', body: editTpl.body, variables: templateVars(editTpl.body), updated_at: new Date().toISOString() };
    if (editTpl.id) await supabase.from('contract_templates').update(row).eq('id', editTpl.id); else await supabase.from('contract_templates').insert(row);
    setEditTpl(null); await load();
  };
  const tailor = async () => {
    if (!draft) return;
    const ask = window.prompt('What should change? (e.g. "add a 50% deposit clause", "make termination 14 days")'); if (!ask) return;
    setMsg('Tailoring…');
    const r = await api<{ text?: string; error?: string }>('/api/claude', { body: { messages: [{ role: 'user', content: `Rewrite this contract in the same markdown format, keeping every {{variable}}, and change only this: ${ask}\n\n${draft.body}` }], system: 'You edit small-business contracts. Keep plain English. Return ONLY the full revised contract markdown. You are not a lawyer; never add legal advice.' } });
    if (r.text) { setDraft({ ...draft, body: r.text }); setMsg('Tailored. Check the preview.'); } else setMsg(r.error ?? 'The Writer is not available right now.');
  };
  const sendExisting = async (c: Contract) => { const r = await api<{ status?: string; error?: string; link?: string }>('/api/contracts/send', { body: { id: c.id } }); setMsg(r.error ?? (r.status === 'dry_run' ? `DRY_RUN: email logged. Link: ${r.link}` : 'Sent.')); await load(); };
  const printSigned = (c: Contract) => { const w = window.open('', '_blank'); if (!w || !c.signed_html) return; w.document.write(c.signed_html); w.document.close(); setTimeout(() => w.print(), 300); };
  const counts = useMemo(() => Object.fromEntries(['draft', 'sent', 'viewed', 'signed', 'declined'].map((s) => [s, rows.filter((r) => r.status === s).length])), [rows]);

  if (missing) return <Page title="Contracts"><Empty text="Contracts needs the October migration (schema_125) applied." /></Page>;
  return (
    <Page title="Contracts" sub={`Pick a template, fill it in, send a signing link. Sending as ${sender}.`} fab={{ t: 'Contract', onClick: () => tpls[0] && start(tpls[0]) }} menu={[{ t: 'New template', onClick: () => setEditTpl({ kind: 'other', body: '# Title\n\nBetween **{{sender_entity}}** and **{{client_name}}**, starting {{start_date}}.' }) }]}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.entries(counts).map(([k, n]) => <Chip key={k} k={STATUS_K[k]}>{n} {k}</Chip>)}</div>
      {msg && <div style={{ fontSize: 14, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{msg}</div>}
      <Card title="Templates" meta="your contracts playbook">
        {tpls.map((t, i) => <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}><span style={{ flex: 1, fontSize: 14 }}>{t.name}</span><button className="mm-btn" style={{ height: 32 }} onClick={() => setEditTpl(t)}>Edit</button><button className="mm-btn mm-btn--primary" style={{ height: 32 }} onClick={() => start(t)}>Use</button></div>)}
      </Card>
      <Card title="Contracts">
        {rows.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>None yet.</div>}
        {rows.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--grid)' : 'none', flexWrap: 'wrap' }}>
            <button onClick={() => setOpen(c)} style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 180, fontSize: 14 }}><strong>{c.title}</strong> · {c.to_name}</button>
            <Chip k={STATUS_K[c.status] ?? 'neutral'}>{c.status}</Chip>
            {c.status === 'draft' && <button className="mm-btn" style={{ height: 32 }} disabled={!c.to_email} onClick={() => void sendExisting(c)}>Send</button>}
            {c.status === 'signed' && <button className="mm-btn" style={{ height: 32 }} onClick={() => printSigned(c)}>Signed PDF</button>}
          </div>
        ))}
      </Card>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', textAlign: 'center' }}>{CONTRACTS_FOOTER}</div>

      {draft && (
        <Sheet title="New contract" onClose={() => setDraft(null)} width={820}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Template"><select style={field} value={draft.tpl?.id ?? ''} onChange={(e) => { const t = tpls.find((x) => x.id === e.target.value); if (t) setDraft({ ...draft, tpl: t, body: t.body, title: t.name }); }}>{tpls.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            <Field l="Send to (pick or type)"><select style={field} value="" onChange={(e) => { const p = people.find((x) => x.id === e.target.value); if (p) setDraft({ ...draft, to_name: p.name.replace(/ \(.*\)$/, ''), to_email: p.email ?? '', client_id: p.kind === 'client' ? p.id : null, contact_id: p.kind === 'contact' ? p.id : null, vars: { ...draft.vars, client_name: p.name.replace(/ \(.*\)$/, '') } }); }}><option value="">Pick a client or contact…</option>{people.map((p) => <option key={`${p.kind}${p.id}`} value={p.id}>{p.name}</option>)}</select></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Name"><input style={field} value={draft.to_name} onChange={(e) => setDraft({ ...draft, to_name: e.target.value })} /></Field>
              <Field l="Email"><input type="email" style={field} value={draft.to_email} onChange={(e) => setDraft({ ...draft, to_email: e.target.value })} /></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field l="Title"><input style={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
              <Field l="File under"><select style={field} value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })}>{PROJECTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
              {vars.map((v) => <Field key={v} l={v.replace(/_/g, ' ')}><input style={field} value={draft.vars[v] ?? ''} onChange={(e) => setDraft({ ...draft, vars: { ...draft.vars, [v]: e.target.value } })} /></Field>)}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><strong style={{ flex: 1 }}>Preview</strong><button className="mm-btn" style={{ height: 32 }} onClick={() => void tailor()}>Ask the Writer to tailor it</button></div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, maxHeight: 360, overflowY: 'auto', fontSize: 14 }}><MiniMarkdown text={preview} /></div>
            {missingNow.length > 0 && <div style={{ fontSize: 13, color: 'var(--warning)' }}>Still blank: {missingNow.join(', ')}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="mm-btn" style={{ flex: 1, height: 44 }} disabled={!draft.to_name.trim()} onClick={() => void save(false)}>Save draft</button>
              <button className="mm-btn mm-btn--primary" style={{ flex: 1, height: 44 }} disabled={!draft.to_name.trim() || !draft.to_email.trim() || missingNow.length > 0} onClick={() => void save(true)}>Send for signature</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{CONTRACTS_FOOTER}</div>
          </div>
        </Sheet>
      )}
      {editTpl && (
        <Sheet title={editTpl.id ? 'Edit template' : 'New template'} onClose={() => setEditTpl(null)} width={760}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Name"><input style={field} value={editTpl.name ?? ''} onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })} /></Field>
            <Field l="Body (markdown; use {{variables}})"><textarea style={{ ...field, height: 380, padding: 12, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} value={editTpl.body ?? ''} onChange={(e) => setEditTpl({ ...editTpl, body: e.target.value })} /></Field>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Variables: {templateVars(editTpl.body ?? '').join(', ') || 'none'}</div>
            <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void saveTpl()}>Save template</button>
          </div>
        </Sheet>
      )}
      {open && (
        <Sheet title={open.title} onClose={() => setOpen(null)} width={760}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <Chip k={STATUS_K[open.status] ?? 'neutral'}>{open.status}</Chip>
            {open.sent_at && <Chip k="neutral">sent {new Date(open.sent_at).toLocaleDateString()}</Chip>}
            {open.viewed_at && <Chip k="neutral">viewed {new Date(open.viewed_at).toLocaleDateString()}</Chip>}
            {open.signed_at && <Chip k="good">signed by {open.signer_name} · {new Date(open.signed_at).toLocaleString()} · IP {open.signer_ip}</Chip>}
          </div>
          <div style={{ fontSize: 14 }}><MiniMarkdown text={open.body} /></div>
        </Sheet>
      )}
    </Page>
  );
}
