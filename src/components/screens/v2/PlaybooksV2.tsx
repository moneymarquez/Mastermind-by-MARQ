import { supabase } from '../../../lib/supabase';
import { useEffect, useState } from 'react';
import { usePlaybooks, STARTER_PLAYBOOKS } from '../../../data/useEngine';
import type { Playbook, PlaybookVersion } from '../../../data/useEngine';
import { PLAYBOOK_MAX_CHARS, PLAYBOOK_LOAD_BUDGET } from '../../../data/ecom';
import { askConfirm } from '../../../lib/confirm';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Page, Sheet, Field, field, useModule } from '../../mm/Page';

const DOMAIN_LABEL: Record<string, string> = { all: 'Every module', ecom: 'E-commerce', content: 'Content', marketing: 'Marketing' };
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Playbooks: what the orchestrator and every worker load on each run.
 *  Every save is a version with its reason; any version can be restored
 *  (as a new version, so history is never rewritten). */
export default function PlaybooksV2() {
  const { device } = useModule();
  const phone = device === 'phone';
  const pb = usePlaybooks();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const open = pb.playbooks.find((p) => p.id === openId) ?? (phone ? null : pb.playbooks[0] ?? null);

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {pb.playbooks.map((p, i) => {
        const on = open?.id === p.id && !phone;
        return (
          <button key={p.id} onClick={() => setOpenId(p.id)} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 0, borderTop: i ? '1px solid var(--grid)' : 'none', background: on ? 'var(--surface-3)' : 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minHeight: 56 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: p.body.trim() ? 'var(--success)' : 'transparent', border: p.body.trim() ? 'none' : '1.5px solid var(--text-tertiary)' }} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: 'var(--text)', fontSize: 14.5, fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{DOMAIN_LABEL[p.domain] ?? p.domain} · {p.body.trim() ? `${p.body.length.toLocaleString()} chars` : 'Not written yet'}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>v{p.version}</span>
          </button>
        );
      })}
    </div>
  );
  const sub = 'The rules your workers follow. Every run loads its module’s playbooks plus Psychology, and cites the principle it used';
  return (
    <Page title={phone && open ? open.name : 'Playbooks'} sub={phone && open ? `${DOMAIN_LABEL[open.domain] ?? open.domain} · v${open.version}` : sub} back="Settings" backTo="account-settings"
      onBack={phone && open ? () => setOpenId(null) : undefined} fab={phone && open ? undefined : { t: 'New playbook', onClick: () => setAdding(true) }}>
      {pb.error && <span style={{ color: 'var(--danger)', fontSize: 14 }}>{pb.error}</span>}
      {phone ? (
        open ? <Editor key={open.id} p={open} api={pb} /> : <Card flush style={{ padding: 0 }}>{list}</Card>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? '320px minmax(0,1fr)' : '280px minmax(0,1fr)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', minHeight: 560 }}>
          <div className="mm-scroll-y" style={{ borderRight: '1px solid var(--grid)' }}>{list}</div>
          <div style={{ padding: '20px 24px', minWidth: 0 }}>{open ? <Editor key={open.id} p={open} api={pb} /> : <span style={{ color: 'var(--text-tertiary)' }}>Pick a playbook.</span>}</div>
        </section>
      )}
      {adding && <NewPlaybook onClose={() => setAdding(false)} onAdd={async (n, d) => { await pb.create(n, d); setAdding(false); }} />}
      {!(phone && open) && <ScalingPlays />}
    </Page>
  );
}

function NewPlaybook({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, domain: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [domain, setDomain] = useState('all'); const [busy, setBusy] = useState(false);
  return (
    <Sheet title="New playbook" onClose={onClose}>
      <Field l="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Objection handling" style={field} /></Field>
      <Field l="Loaded by"><select value={domain} onChange={(e) => setDomain(e.target.value)} style={field}>{Object.entries(DOMAIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !name.trim()} onClick={async () => { setBusy(true); await onAdd(name.trim(), domain); setBusy(false); }}>Add playbook</button>
    </Sheet>
  );
}

function Editor({ p, api }: { p: Playbook; api: ReturnType<typeof usePlaybooks> }) {
  const [body, setBody] = useState(p.body);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<PlaybookVersion[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [saved, setSaved] = useState<'' | 'ok' | 'fail'>('');
  const [note, setNote] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [moveMode, setMoveMode] = useState<'replace' | 'append'>('replace');
  useEffect(() => { api.versions(p.id).then(setHistory); setBody(p.body); }, [p.id, p.version, p.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const hint = STARTER_PLAYBOOKS.find((s) => s.name === p.name)?.hint;
  const isStarter = STARTER_PLAYBOOKS.some((s) => s.name === p.name);
  const others = api.playbooks.filter((x) => x.id !== p.id);
  const dirty = body !== p.body;
  const save = async (text: string, why: string) => { setBusy(true); setSaved(''); const ok = await api.save(p, text, why || 'Edited in Playbooks'); setBusy(false); setSaved(ok ? 'ok' : 'fail'); if (ok) setReason(''); };
  const del = async () => { if (await askConfirm(`Delete the ${p.name} playbook and all its history? This can't be undone.`)) await api.remove(p); };
  const near = body.length >= PLAYBOOK_MAX_CHARS * 0.95;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em' }}>{p.name}</span>
        <Chip k="accent">{DOMAIN_LABEL[p.domain] ?? p.domain}</Chip>
        <Chip k="neutral">v{p.version}</Chip>
      </div>
      {p.change_reason && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Last change: {p.change_reason}</span>}
      {!p.body.trim() && hint && <div style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)', border: '1px dashed var(--border)', fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Not written yet. {hint} Paste your notes, rough is fine.</div>}
      <textarea aria-label={`${p.name} playbook`} maxLength={PLAYBOOK_MAX_CHARS} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Markdown. One rule per line works best: what to do, when, and why."
        style={{ ...field, height: 340, padding: 14, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6 }} />
      <span style={{ fontSize: 12.5, color: near ? 'var(--warning)' : 'var(--text-tertiary)' }}>{body.length.toLocaleString()} / {PLAYBOOK_MAX_CHARS.toLocaleString()} characters · each run loads up to {PLAYBOOK_LOAD_BUDGET.toLocaleString()} across a worker's playbooks.</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this change? (optional)" style={{ ...field, flex: '1 1 220px', width: 'auto' }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={busy || !dirty || body.length > PLAYBOOK_MAX_CHARS} onClick={() => save(body, reason.trim())}>{busy ? 'Saving…' : `Save as v${p.body.trim() || p.version > 1 ? p.version + 1 : 1}`}</button>
        {dirty && <button className="mm-btn" style={{ height: 44 }} onClick={() => setBody(p.body)}>Discard</button>}
      </div>
      {!dirty && saved === 'ok' && <Chip k="good">Saved as v{p.version}</Chip>}
      {saved === 'fail' && <span style={{ fontSize: 13, color: 'var(--danger)' }}>Not saved: {api.error || 'the database refused it'}</span>}
      {note && <Chip k="good">{note}</Chip>}
      {p.body.trim() && !dirty && (
        <Card title="Wrong tab?" style={{ background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} style={{ ...field, flex: '1 1 200px', width: 'auto' }}>
              <option value="">Move this text to…</option>
              {others.map((x) => <option key={x.id} value={x.id}>{x.name}{x.body.trim() ? ` (${x.body.length.toLocaleString()} chars)` : ' (empty)'}</option>)}
            </select>
            {moveTarget && others.find((x) => x.id === moveTarget)?.body.trim() && (
              <select value={moveMode} onChange={(e) => setMoveMode(e.target.value as 'replace' | 'append')} style={{ ...field, width: 'auto' }}>
                <option value="replace">Replace its text</option><option value="append">Add to the end</option>
              </select>
            )}
            <button className="mm-btn" style={{ height: 44 }} disabled={busy || !moveTarget} onClick={async () => {
              const target = others.find((x) => x.id === moveTarget); if (!target) return;
              if (!(await askConfirm(`Move this text out of ${p.name} and ${moveMode === 'replace' ? `replace what's in ${target.name}` : `add it to the end of ${target.name}`}?`))) return;
              setBusy(true); const ok = await api.moveTo(p, target, moveMode); setBusy(false); setNote(ok ? `Moved to ${target.name}` : ''); setMoveTarget('');
            }}>Move</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="mm-btn" style={{ height: 38, color: 'var(--danger)' }} disabled={busy} onClick={async () => { if (!(await askConfirm(`Clear everything in ${p.name}? The current text stays in History.`))) return; setBusy(true); const ok = await api.clear(p); setBusy(false); setNote(ok ? `${p.name} cleared` : ''); }}>Clear playbook</button>
            {!isStarter && <button className="mm-btn" style={{ height: 38, color: 'var(--danger)' }} disabled={busy} onClick={del}>Delete playbook</button>}
          </div>
        </Card>
      )}
      {!p.body.trim() && !isStarter && !dirty && <button className="mm-btn" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={del}>Delete playbook</button>}
      <div data-demo="playbook-history" style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, padding: '6px 0 4px' }}>History</span>
        {history.length === 0 && <span style={{ fontSize: 13.5, color: 'var(--text-tertiary)' }}>No saved versions yet.</span>}
        {history.map((v) => (
          <div key={v.id} style={{ borderTop: '1px solid var(--grid)', padding: '10px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip k={v.version === p.version ? 'good' : 'neutral'}>v{v.version}</Chip>
            <span style={{ flex: 1, minWidth: 140, fontSize: 13.5, color: 'var(--text-secondary)' }}>{v.change_reason ?? '—'}{v.thread_id && <span style={{ color: 'var(--accent)' }}> · from an orchestrator thread</span>}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{when(v.created_at)}</span>
            <button className="mm-btn" style={{ height: 30, fontSize: 12.5, padding: '0 10px' }} onClick={() => setViewing(viewing === v.id ? null : v.id)}>{viewing === v.id ? 'Hide' : 'View'}</button>
            {v.version !== p.version && <button className="mm-btn" style={{ height: 30, fontSize: 12.5, padding: '0 10px' }} disabled={busy} onClick={async () => { if (await askConfirm(`Restore v${v.version}? It's saved as a new version.`)) save(v.body, `Reverted to v${v.version}`); }}>Revert</button>}
            {v.version !== p.version && <button className="mm-btn" style={{ height: 30, fontSize: 12.5, padding: '0 10px', color: 'var(--danger)' }} disabled={busy} onClick={async () => { if (await askConfirm(`Delete v${v.version} from history for good?`)) { await api.deleteVersion(v); api.versions(p.id).then(setHistory); } }}>Delete</button>}
            {viewing === v.id && <pre style={{ width: '100%', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.55, background: 'var(--surface-2)', border: '1px solid var(--border)', padding: 12, borderRadius: 10, color: 'var(--text)' }}>{v.body || '(empty)'}</pre>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Scaling plays (brief §5.7): saved from a finished client phase ("Save as
 *  play" on the Delivery tab), offered to the next client of the same type,
 *  and read by the bots like any playbook. */
function ScalingPlays() {
  const [rows, setRows] = useState<{ id: string; title: string; business_kind: string | null; phase: number | null; steps: { title: string; owner?: string }[]; uses: number }[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => { void supabase.from('plays').select('id,title,business_kind,phase,steps,uses').order('uses', { ascending: false }).then(({ data, error }) => { if (!error) setRows((data ?? []) as typeof rows); }); }, []);
  const remove = async (id: string) => { if (!window.confirm('Delete this play?')) return; await supabase.from('plays').delete().eq('id', id); setRows((r) => r.filter((x) => x.id !== id)); };
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>Scaling plays</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Saved from a finished client phase. A new client of the same type entering that phase is offered the play.</div>
      {rows.length === 0 && <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No plays yet. Open a client → Delivery → "Save as play".</div>}
      {rows.map((r) => (
        <div key={r.id} style={{ borderTop: '1px solid var(--grid)', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setOpenId(openId === r.id ? null : r.id)} style={{ all: 'unset', cursor: 'pointer', flex: 1, fontSize: 14 }}><strong>{r.title}</strong> <span style={{ color: 'var(--text-tertiary)' }}>· {r.business_kind ?? 'any type'} · phase {r.phase ?? '—'} · {r.steps.length} steps · used {r.uses}×</span></button>
            <button className="mm-btn" style={{ height: 28, fontSize: 12 }} onClick={() => void remove(r.id)}>Delete</button>
          </div>
          {openId === r.id && <ol style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13.5 }}>{r.steps.map((s, i) => <li key={i}>{s.title}{s.owner ? ` (${s.owner})` : ''}</li>)}</ol>}
        </div>
      ))}
    </section>
  );
}
