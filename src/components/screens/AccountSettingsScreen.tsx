import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onSignOut: () => void;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, maxWidth: 480 };
const inputStyle: CSSProperties = {
  background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999,
  background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999,
  border: '1px solid #22262B', color: '#8A8F98', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start',
};
const dangerBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999,
  border: '1px solid #c47a7a55', color: '#c47a7a', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start',
};

export default function AccountSettingsScreen({ homeHeadStyle, homeSubStyle, onSignOut }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'contact'>('idle');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setDisplayName((data.user?.user_metadata?.full_name as string) ?? '');
    });
  }, []);

  const saveDisplayName = async () => {
    setSavingName(true);
    setNameSaved(false);
    await supabase.auth.updateUser({ data: { full_name: displayName.trim() } });
    setSavingName(false);
    setNameSaved(true);
  };

  const changePassword = async () => {
    setPasswordError('');
    setPasswordSaved(false);
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
      return;
    }
    setPasswordSaved(true);
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div>
      <div style={homeHeadStyle}>Account</div>
      <div style={homeSubStyle}>Your login, name, and account-level actions.</div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Profile</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11.5, color: '#565b64', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 13.5, color: '#c8cad0' }}>{user?.email ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: '#565b64', marginBottom: 4 }}>Display name</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Cristopher" value={displayName} onChange={(e) => { setDisplayName(e.target.value); setNameSaved(false); }} />
                <div style={primaryBtn} onClick={saveDisplayName}>{savingName ? 'Saving…' : 'Save'}</div>
              </div>
              {nameSaved && <div style={{ fontSize: 11.5, color: '#4CAF7D', marginTop: 6 }}>Saved.</div>}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Change password</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input style={inputStyle} type="password" placeholder="New password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordSaved(false); }} />
            <input style={inputStyle} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSaved(false); }} />
            {passwordError && <div style={{ fontSize: 12, color: '#c47a7a' }}>{passwordError}</div>}
            {passwordSaved && <div style={{ fontSize: 12, color: '#4CAF7D' }}>Password updated.</div>}
            <div style={{ ...primaryBtn, opacity: savingPassword ? 0.6 : 1 }} onClick={() => !savingPassword && changePassword()}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Session</div>
          <div style={ghostBtn} onClick={onSignOut}>Sign out</div>
        </div>

        <div style={{ ...cardStyle, borderColor: '#c47a7a33' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#c47a7a', marginBottom: 8 }}>Delete account</div>
          {deleteStep === 'idle' && (
            <>
              <div style={{ fontSize: 12.5, color: '#8A8F98', marginBottom: 12 }}>Permanently removes your account and data. This can't be undone.</div>
              <div style={dangerBtn} onClick={() => setDeleteStep('confirm')}>Delete my account</div>
            </>
          )}
          {deleteStep === 'confirm' && (
            <>
              <div style={{ fontSize: 12.5, color: '#c8cad0', marginBottom: 12 }}>Are you sure? This permanently deletes your account and all data in it.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={dangerBtn} onClick={() => setDeleteStep('contact')}>Yes, delete it</div>
                <div style={ghostBtn} onClick={() => setDeleteStep('idle')}>Cancel</div>
              </div>
            </>
          )}
          {deleteStep === 'contact' && (
            <div style={{ fontSize: 12.5, color: '#8A8F98', lineHeight: 1.6 }}>
              Full self-serve deletion isn't wired up yet — email support to have your account and data removed. Nothing has been deleted.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
