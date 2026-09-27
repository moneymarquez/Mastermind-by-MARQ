import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePlaybooks, STARTER_PLAYBOOKS } from '../../data/useEngine';
import type { Playbook, PlaybookVersion } from '../../data/useEngine';
import { E, Badge, Pill, TeachingEmpty, btn, field, label, panel, tint } from './ecom/ecomShared';
import { PLAYBOOK_MAX_CHARS, PLAYBOOK_LOAD_BUDGET } from '../../data/ecom';
import { askConfirm } from '../../lib/confirm';

interface Props { homeHeadStyle: CSSProperties; homeSubStyle: CSSProperties }
const DOMAIN_LABEL: Record<string, string> = { all: 'Every module', ecom: 'E-commerce', content: 'Content', marketing: 'Marketing' };

/** Playbooks — what the orchestrator and every worker load on each run.
 *  Paste, edit, and every save is a version with its reason; any version
 *  can be restored (as a new version, so history is never rewritten). */
export default function PlaybooksScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const pb = usePlaybooks();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('all');
  const open = pb.playbooks.find((p) => p.id === openId) ?? pb.playbooks[0] ?? null;

  return (
    <div>
      <div style={homeHeadStyle}>Playbooks</div>
      <div style={homeSubStyle}>The rules your workers follow. Every run loads its module's playbooks plus Psychology, and cites the principle it used.</div>
      <div style={{ ...panel, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pb.error && <div style={{ color: E.red }}>{pb.error}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pb.playbooks.map((p) => (
            <Pill key={p.id} active={open?.id === p.id} onClick={() => setOpenId(p.id)}>
              {p.body.trim() ? '●' : '○'} {p.name} <span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>v{p.version}</span>
            </Pill>
          ))}
        </div>
        {open && <Editor key={open.id} p={open} api={pb} />}
        <div style={{ ...E.card, padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={label}>New playbook</span>
          <input style={{ ...field, flex: '1 1 160px', width: 'auto' }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Objection handling" />
          <select style={{ ...field, width: 'auto' }} value={newDomain} onChange={(e) => setNewDomain(e.target.value)}>{Object.entries(DOMAIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button style={btn('primary')} disabled={!newName.trim()} onClick={async () => { await pb.create(newName.trim(), newDomain); setNewName(''); }}>Add</button>
        </div>
      </div>
    </div>
  );
}

function Editor({ p, api }: { p: Playbook; api: ReturnType<typeof usePlaybooks> }) {
  const [body, setBody] = useState(p.body);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<PlaybookVersion[]>([]);
  const [viewing, setViewing] = useState<PlaybookVersion | null>(null);
  useEffect(() => { api.versions(p.id).then(setHistory); setBody(p.body); }, [p.id, p.version, p.body]); // eslint-disable-line react-hooks/exhaustive-deps
  const hint = STARTER_PLAYBOOKS.find((s) => s.name === p.name)?.hint;
  const dirty = body !== p.body;
  const [saved, setSaved] = useState<'' | 'ok' | 'fail'>('');
  const [note, setNote] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [moveMode, setMoveMode] = useState<'replace' | 'append'>('replace');
  const others = api.playbooks.filter((x) => x.id !== p.id);
  const isStarter = STARTER_PLAYBOOKS.some((s) => s.name === p.name);
  const reloadHistory = () => api.versions(p.id).then(setHistory);
  const doClear = async () => {
    if (!(await askConfirm(`Clear everything in ${p.name}? The current text stays in History until you delete that version.`))) return;
    setBusy(true); const ok = await api.clear(p); setBusy(false); setNote(ok ? `${p.name} cleared.` : '');
  };
  const doMove = async () => {
    const target = others.find((x) => x.id === moveTarget);
    if (!target) return;
    const verb = moveMode === 'replace' ? `replace what's in ${target.name}` : `add it to the end of ${target.name}`;
    if (!(await askConfirm(`Move this text out of ${p.name} and ${verb}?${moveMode === 'replace' && target.body.trim() ? ` ${target.name}'s current text stays in its History.` : ''}`))) return;
    setBusy(true); const ok = await api.moveTo(p, target, moveMode); setBusy(false);
    setNote(ok ? `Moved to ${target.name}. ${p.name} is now empty.` : ''); setMoveTarget('');
  };
  // The reason is optional — a missing one no longer silently disables Save.
  const save = async (text: string, why: string) => {
    setBusy(true); setSaved('');
    const ok = await api.save(p, text, why || 'Edited in Playbooks');
    setBusy(false); setSaved(ok ? 'ok' : 'fail'); if (ok) setReason('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-subhead)' }}>{p.name}</span>
        <Badge color={E.violet}>{DOMAIN_LABEL[p.domain] ?? p.domain}</Badge>
        <Badge color={E.faint}>v{p.version}</Badge>
        {p.change_reason && <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>last change: {p.change_reason}</span>}
      </div>
      {!p.body.trim() && hint && <TeachingEmpty what={`Not written yet. ${hint}`} worker="you — paste your notes; rough is fine" />}
      <textarea maxLength={PLAYBOOK_MAX_CHARS} style={{ ...field, minHeight: 320, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Markdown. One rule per line works best: what to do, when, and why." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...field, flex: '1 1 220px', width: 'auto' }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this change? (optional — saved with the version)" />
        <button style={btn('primary')} disabled={busy || !dirty || body.length > PLAYBOOK_MAX_CHARS} onClick={() => save(body, reason.trim())}>{busy ? 'Saving…' : `Save as v${p.body.trim() || p.version > 1 ? p.version + 1 : 1}`}</button>
        {dirty && <button style={btn('ghost')} onClick={() => setBody(p.body)}>Discard</button>}
        {!dirty && saved === 'ok' && <span style={{ fontSize: 'var(--text-caption)', color: E.green, fontWeight: 600 }}>✓ Saved as v{p.version}</span>}
        {saved === 'fail' && <span style={{ fontSize: 'var(--text-caption)', color: E.red }}>Not saved: {api.error || 'the database refused it'}</span>}
      </div>
      {p.body.trim() && !dirty && (
        <div style={{ ...E.card, padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={label}>Wrong tab?</span>
          <select style={{ ...field, width: 'auto' }} value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
            <option value="">Move this text to…</option>
            {others.map((x) => <option key={x.id} value={x.id}>{x.name}{x.body.trim() ? ` (has ${x.body.length.toLocaleString()} chars)` : ' (empty)'}</option>)}
          </select>
          {moveTarget && others.find((x) => x.id === moveTarget)?.body.trim() && (
            <select style={{ ...field, width: 'auto' }} value={moveMode} onChange={(e) => setMoveMode(e.target.value as 'replace' | 'append')}>
              <option value="replace">Replace its text</option>
              <option value="append">Add to the end</option>
            </select>
          )}
          <button style={btn('primary')} disabled={busy || !moveTarget} onClick={doMove}>Move</button>
          <span style={{ flex: 1 }} />
          <button style={btn('danger')} disabled={busy} onClick={doClear}>Clear playbook</button>
          {!isStarter && <button style={btn('danger')} disabled={busy} onClick={async () => { if (await askConfirm(`Delete the ${p.name} playbook and all its history? This can't be undone.`)) await api.remove(p); }}>Delete playbook</button>}
        </div>
      )}
      {!p.body.trim() && !isStarter && !dirty && (
        <button style={{ ...btn('danger'), alignSelf: 'flex-start' }} disabled={busy} onClick={async () => { if (await askConfirm(`Delete the ${p.name} playbook and all its history? This can't be undone.`)) await api.remove(p); }}>Delete playbook</button>
      )}
      {note && <div style={{ fontSize: 'var(--text-caption)', color: E.green, fontWeight: 600 }}>✓ {note}</div>}
      <div style={{ fontSize: 'var(--text-caption)', color: body.length >= PLAYBOOK_MAX_CHARS * 0.95 ? E.amber : E.faint }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{body.length.toLocaleString()} / {PLAYBOOK_MAX_CHARS.toLocaleString()}</span> characters · each run loads up to {PLAYBOOK_LOAD_BUDGET.toLocaleString()} characters across the worker's playbooks (about three full ones). Longer playbooks cost more per run.
      </div>

      <div style={{ ...label, marginTop: 6 }}>History</div>
      {history.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>No saved versions yet.</div>}
      {history.map((v) => (
        <div key={v.id} style={{ borderTop: `1px solid ${E.border}`, padding: '6px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 'var(--text-caption)', color: E.muted }}>
          <Badge color={v.version === p.version ? E.green : E.faint}>v{v.version}</Badge>
          <span style={{ flex: 1, minWidth: 140 }}>{v.change_reason ?? '—'}{v.thread_id && <span style={{ color: E.violet }}> · from an orchestrator thread</span>}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>{new Date(v.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          <button style={{ ...btn('ghost'), padding: '3px 8px', fontSize: 11 }} onClick={() => setViewing(viewing?.id === v.id ? null : v)}>{viewing?.id === v.id ? 'Hide' : 'View'}</button>
          {v.version !== p.version && <button style={{ ...btn('ghost'), padding: '3px 8px', fontSize: 11 }} disabled={busy} onClick={async () => { if (await askConfirm(`Restore v${v.version}? It's saved as a new version.`)) save(v.body, `Reverted to v${v.version}`); }}>Revert</button>}
          {v.version !== p.version && <button style={{ ...btn('danger'), padding: '3px 8px', fontSize: 11 }} disabled={busy} onClick={async () => { if (await askConfirm(`Delete v${v.version} from history for good? This can't be undone.`)) { await api.deleteVersion(v); reloadHistory(); } }}>Delete</button>}
          {viewing?.id === v.id && <pre style={{ width: '100%', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12, background: tint(E.faint, 8), padding: 10, borderRadius: 'var(--radius-sm)', color: E.text, margin: 0 }}>{v.body || '(empty)'}</pre>}
        </div>
      ))}
    </div>
  );
}
