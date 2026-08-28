import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import ModulePicker from '../../onboarding/ModulePicker';
import { useModuleAccess } from '../../data/useModuleAccess';
import { supabase } from '../../lib/supabase';
import Icon from '../../Icon';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  currentUserId: string;
  isOwner: boolean;
}

interface CompedUser {
  user_id: string;
  email: string;
  note: string | null;
  created_at: string;
}

const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: '10px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none',
};

/** Owner-only "give this account the whole app for free" admin — grants
 *  full non-owner module access and bypasses the Stripe billing gate for
 *  a real, separate login (see schema_043_comped_users.sql). The person
 *  still needs to have signed up first — this resolves their email to a
 *  user_id server-side, it can't create the account for them. */
function CompedUsersAdmin() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [users, setUsers] = useState<CompedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc('list_comped_users');
    if (!err) setUsers((data ?? []) as CompedUser[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div style={{ marginTop: 40, maxWidth: 560 }}>
      <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>Give someone the whole app, free</div>
      <p style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>
        For a real, separate login you want to comp — their own account, their own data, every module you can select
        pre-enabled, no Stripe subscription. They still aren't the owner: Scaling tools (Client CRM, LeadFlow,
        Marketing, etc.) stay yours only. They need to have signed up already — this looks their account up by email,
        it doesn't create one.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <input style={{ ...inputStyle, flex: '1 1 220px' }} placeholder="Their email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={{ ...inputStyle, flex: '1 1 160px' }} placeholder="Note (optional, e.g. a name)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          onClick={grant}
          disabled={busy || !email.trim()}
          className="ap-btn ap-btn-primary"
          style={{ opacity: busy || !email.trim() ? 0.6 : 1 }}
        >
          Grant access
        </button>
      </div>
      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
      {notice && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--success)', marginTop: 8 }}>{notice}</div>}

      {!loading && users.length > 0 && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          {users.map((u) => (
            <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--surface-3)', background: 'var(--surface-2)' }}>
              <Icon name="users" size={16} color="var(--text-tertiary)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-quaternary)' }}>{u.email}</div>
                {u.note && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 1 }}>{u.note}</div>}
              </div>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: busy ? 'default' : 'pointer' }} onClick={() => !busy && revoke(u.email)}>
                Revoke
              </span>
            </div>
          ))}
        </div>
      )}
      {!loading && users.length === 0 && (
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', marginTop: 16 }}>Nobody's comped in right now.</div>
      )}
    </div>
  );
}

export default function ManageModulesScreen({ homeHeadStyle, homeSubStyle, currentUserId, isOwner }: Props) {
  const { loading, enabledKeys, saveModuleSelections } = useModuleAccess(currentUserId, isOwner);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading) setSelected(new Set(enabledKeys));
    // Only sync from the loaded value once — don't clobber in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await saveModuleSelections([...selected]);
    setSaving(false);
    setSaved(true);
  };

  if (isOwner) {
    return (
      <div>
        <div style={homeHeadStyle}>Manage modules</div>
        <div style={homeSubStyle}>Your account always has everything on — this screen doesn't apply to you.</div>
        <CompedUsersAdmin />
      </div>
    );
  }

  return (
    <div>
      <div style={homeHeadStyle}>Manage modules</div>
      <div style={homeSubStyle}>Turn sections on or off — this only changes what shows up in your nav, your data is never touched.</div>

      <div style={{ marginTop: 24, maxWidth: 760 }}>
        {!loading && <ModulePicker selected={selected} onToggle={toggle} />}
      </div>

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: '11px 22px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
            fontSize: 'var(--text-body)', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>Saved.</span>}
      </div>
    </div>
  );
}
