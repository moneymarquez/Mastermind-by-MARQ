import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Page, field, useModule } from '../../mm/Page';
import { askConfirm } from '../../../lib/confirm';

interface CompedUser {
  user_id: string;
  email: string;
  note: string | null;
  created_at: string;
}

interface CompCode {
  code: string;
  note: string | null;
  redeemed_by_email: string | null;
  redeemed_at: string | null;
  created_at: string;
}

interface ClientLogin {
  user_id: string;
  email: string;
  client_id: string | null;
  business_name: string | null;
  created_at: string;
}

const sub = { fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 } as const;
const ini = (e: string) => e.split(/[@.\s]/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
function Person({ email, line, tone, action, first }: { email: string; line: string; tone?: 'good'; action: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: first ? 'none' : '1px solid var(--grid)' }}>
      <span style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none', background: 'var(--surface-3)', color: 'var(--text)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ini(email)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        <div style={{ fontSize: 12.5, color: tone === 'good' ? 'var(--success)' : 'var(--text-tertiary)', marginTop: 2 }}>{line}</div>
      </div>
      {action}
    </div>
  );
}

/** Owner-only: comp a real login with the whole app, hand out single-use
 *  codes, and manage client portal logins. */
export default function GrantAccessV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', two = !phone && !(device === 'ipad' && novaOpen);

  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [users, setUsers] = useState<CompedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [codeNote, setCodeNote] = useState('');
  const [codes, setCodes] = useState<CompCode[]>([]);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [clientLogins, setClientLogins] = useState<ClientLogin[]>([]);
  const [loginsLoading, setLoginsLoading] = useState(true);
  const [revokingLogin, setRevokingLogin] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('list_comped_users');
    if (!err) setUsers((data ?? []) as CompedUser[]);
    setLoading(false);
  }, []);

  const loadCodes = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('list_comp_codes');
    if (!err) setCodes((data ?? []) as CompCode[]);
  }, []);

  const loadClientLogins = useCallback(async () => {
    setLoginsLoading(true);
    const { data, error: err } = await supabase.rpc('list_client_logins');
    if (!err) setClientLogins((data ?? []) as ClientLogin[]);
    setLoginsLoading(false);
  }, []);

  useEffect(() => {
    load();
    loadCodes();
    loadClientLogins();
  }, [load, loadCodes, loadClientLogins]);

  const revokeClientLogin = async (userId: string) => {
    setRevokingLogin(userId);
    await supabase.rpc('revoke_client_login', { target_user_id: userId });
    setRevokingLogin(null);
    await loadClientLogins();
  };

  const generateCode = async () => {
    setCodeBusy(true);
    setCodeError(null);
    const { error: err } = await supabase.rpc('generate_comp_code', { target_note: codeNote.trim() || null });
    setCodeBusy(false);
    if (err) {
      setCodeError(err.message);
      return;
    }
    setCodeNote('');
    await loadCodes();
  };

  const cancelCode = async (code: string) => {
    setCodeBusy(true);
    await supabase.rpc('cancel_comp_code', { target_code: code });
    setCodeBusy(false);
    await loadCodes();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500);
    } catch {
      // Clipboard access can be blocked — the code is still shown on screen either way.
    }
  };

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } = await supabase.rpc('grant_comped_access', { target_email: email.trim(), target_note: note.trim() || null });
    setBusy(false);
    if (err) {
      setError(err.message.includes('No account found') ? 'No account with that email yet — they need to sign up first.' : err.message);
      return;
    }
    setNotice(`${email.trim()} now has full free access.`);
    setEmail('');
    setNote('');
    await load();
  };

  const revoke = async (targetEmail: string) => {
    setBusy(true);
    await supabase.rpc('revoke_comped_access', { target_email: targetEmail });
    setBusy(false);
    await load();
  };

  const teamsCard = <TeamsCard />;
  const comp = (
    <Card title="Give someone the whole app, free">
      <p style={sub}>Their own login and data, every module except Scaling, no subscription. They need to have signed up already; this finds their account by email.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" aria-label="Their email" style={{ ...field, flex: '1 1 200px', width: 'auto' }} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" style={{ ...field, flex: '1 1 140px', width: 'auto' }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={busy || !email.trim()} onClick={grant}>Grant access</button>
      </div>
      {error && <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</span>}
      {notice && <Chip k="good">{notice}</Chip>}
      {!loading && (users.length ? <div>{users.map((u, i) => <Person key={u.user_id} first={i === 0} email={u.email} tone="good" line={u.note ? `Full access · ${u.note}` : 'Full access, every module except Scaling'} action={<button className="mm-btn" style={{ height: 32, fontSize: 13, color: 'var(--danger)' }} disabled={busy} onClick={async () => { if (await askConfirm(`Revoke ${u.email}'s free access?`)) revoke(u.email); }}>Revoke</button>} />)}</div>
        : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nobody is comped right now.</span>)}
    </Card>
  );
  const codeCard = (
    <Card title="Or generate a code" meta="Single use, no expiry">
      <p style={sub}>Text them a short code; they enter it on the first onboarding screen after signing up and get the same free access.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={codeNote} onChange={(e) => setCodeNote(e.target.value)} placeholder="Note (optional)" aria-label="Code note" style={{ ...field, flex: '1 1 200px', width: 'auto' }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={codeBusy} onClick={generateCode}>Generate a code</button>
      </div>
      {codeError && <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>{codeError}</span>}
      {codes.length > 0 && <div>{codes.map((c, i) => (
        <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i ? '1px solid var(--grid)' : 'none', flexWrap: 'wrap' }}>
          <button onClick={() => copyCode(c.code)} title="Copy" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>{c.code}</button>
          <span style={{ flex: 1, minWidth: 80, fontSize: 13, color: copiedCode === c.code ? 'var(--success)' : 'var(--text-tertiary)' }}>{copiedCode === c.code ? 'Copied' : c.note ?? ''}</span>
          {c.redeemed_by_email ? <Chip k="good">Redeemed by {c.redeemed_by_email}</Chip> : <button className="mm-btn" style={{ height: 32, fontSize: 13 }} disabled={codeBusy} onClick={() => cancelCode(c.code)}>Cancel</button>}
        </div>
      ))}</div>}
    </Card>
  );
  const clients = (
    <Card title="Client logins" meta="Scoped to one business">
      <p style={sub}>A client login sees only their own audit, portal and invoices. Create one from the client's page in Client CRM; manage and revoke here.</p>
      {!loginsLoading && (clientLogins.length ? <div>{clientLogins.map((l, i) => <Person key={l.user_id} first={i === 0} email={l.email} line={l.business_name ? `Scoped to ${l.business_name}` : 'Linked client not found'} action={<button className="mm-btn" style={{ height: 32, fontSize: 13, color: 'var(--danger)' }} disabled={revokingLogin === l.user_id} onClick={async () => { if (await askConfirm(`Revoke ${l.email}'s client login?`)) revokeClientLogin(l.user_id); }}>{revokingLogin === l.user_id ? 'Revoking…' : 'Revoke'}</button>} />)}</div>
        : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No client logins yet.</span>)}
    </Card>
  );
  return (
    <Page title="Grant access" sub="Everyone with a login besides you, and what each can see. Only you see this page" back="Settings" backTo="account-settings">
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(3,minmax(0,1fr))', gap: phone ? 10 : 16 }}>
        <Stat label="Comped logins" value={String(users.length)} />
        <Stat label="Open codes" value={String(codes.filter((c) => !c.redeemed_by_email).length)} pill={`${codes.filter((c) => c.redeemed_by_email).length} redeemed`} />
        {!phone && <Stat label="Client logins" value={String(clientLogins.length)} />}
      </div>
      {two ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{comp}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{codeCard}{teamsCard}{clients}</div>
        </div>
      ) : <>{comp}{codeCard}{teamsCard}{clients}</>}
    </Page>
  );
}

/** Teams entitlement (brief §4.1): Dispatch and Call Recordings. Turning it
 *  off hides those modules; their data stays. */
function TeamsCard() {
  const [rows, setRows] = useState<{ user_id: string; email: string; teams: boolean; note: string | null }[]>([]);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const { data, error: e } = await supabase.rpc('list_entitlements'); if (e) { setErr(e.message.includes('function') ? 'Needs the October migration (schema_124).' : e.message); return; } setRows((data ?? []) as typeof rows); }, []);
  useEffect(() => { void load(); }, [load]);
  const set = async (target: string, on: boolean) => { setBusy(true); setErr(null); const { error: e } = await supabase.rpc('set_teams', { target_email: target, on_off: on }); setBusy(false); if (e) setErr(e.message.includes('No account') ? 'No account with that email yet.' : e.message); else { setEmail(''); await load(); } };
  const on = rows.filter((r) => r.teams);
  return (
    <Card title="Teams" meta="Dispatch + Call Recordings">
      <p style={sub}>Team features aren't in solo Masterminds. Turn Teams on for an account (James King at APHS has it) and they get Dispatch and Call Recordings. Turning it off hides them; nothing is deleted.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" aria-label="Teams email" style={{ ...field, flex: '1 1 200px', width: 'auto' }} />
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={busy || !email.trim()} onClick={() => void set(email.trim(), true)}>Turn on Teams</button>
      </div>
      {err && <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>{err}</span>}
      {on.length ? <div>{on.map((r, i) => <Person key={r.user_id} first={i === 0} email={r.email} tone="good" line={r.note ?? 'Teams'} action={<button className="mm-btn" style={{ height: 32, fontSize: 13 }} disabled={busy} onClick={async () => { if (await askConfirm(`Turn Teams off for ${r.email}? Dispatch and Call Recordings hide; their data stays.`)) void set(r.email, false); }}>Turn off</button>} />)}</div>
        : !err && <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No Teams accounts yet.</span>}
    </Card>
  );
}
