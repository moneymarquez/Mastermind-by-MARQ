import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Theme } from '../../data/useTheme';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onSignOut: () => void;
  onStartTour: () => void;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20, maxWidth: 480 };
const inputStyle: CSSProperties = {
  background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body-lg)', outline: 'none',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)',
  background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start',
};
const ghostBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 'var(--text-body)', cursor: 'pointer', alignSelf: 'flex-start',
};
const dangerBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: 'var(--radius-pill)',
  border: '1px solid color-mix(in srgb, var(--danger) 33%, transparent)', color: 'var(--danger)', fontSize: 'var(--text-body)', cursor: 'pointer', alignSelf: 'flex-start',
};

async function openBillingPortal(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return 'Not signed in.';
  try {
    const res = await fetch('/api/billing/portal', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    const body = await res.json();
    if (!res.ok) return body.error ?? `Could not open the billing portal (${res.status}).`;
    window.location.href = body.url;
    return null;
  } catch {
    return 'Could not reach billing right now — try again in a bit.';
  }
}

export default function AccountSettingsScreen({ homeHeadStyle, homeSubStyle, onSignOut, onStartTour, theme, onThemeChange }: Props) {
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
  const [portalError, setPortalError] = useState('');
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setDisplayName((data.user?.user_metadata?.full_name as string) ?? '');
    });
  }, []);

  const manageBilling = async () => {
    setOpeningPortal(true);
    setPortalError('');
    const err = await openBillingPortal();
    if (err) setPortalError(err);
    setOpeningPortal(false);
  };

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
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Appearance</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Switches instantly, everywhere in the app — synced to your account, so it carries over to any device you sign in on.
          </div>
          <div style={{ display: 'inline-flex', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-pill)', padding: 3 }}>
            {(['dark', 'light'] as Theme[]).map((option) => (
              <div
                key={option}
                onClick={() => onThemeChange(option)}
                style={{
                  padding: '7px 18px', borderRadius: 'var(--radius-pill)', fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize', transition: 'background 150ms ease, color 150ms ease',
                  background: theme === option ? 'var(--text)' : 'transparent',
                  color: theme === option ? 'var(--bg)' : 'var(--text-secondary)',
                }}
              >
                {option}
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Product tour</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            A guided walkthrough of the app — handy for getting reoriented, or for showing someone else around live.
          </div>
          <div style={ghostBtn} onClick={onStartTour}>Take the product tour</div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Profile</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary-2)' }}>{user?.email ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 4 }}>Display name</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Cristopher" value={displayName} onChange={(e) => { setDisplayName(e.target.value); setNameSaved(false); }} />
                <div style={primaryBtn} onClick={saveDisplayName}>{savingName ? 'Saving…' : 'Save'}</div>
              </div>
              {nameSaved && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--success)', marginTop: 6 }}>Saved.</div>}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Change password</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input style={inputStyle} type="password" placeholder="New password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordSaved(false); }} />
            <input style={inputStyle} type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSaved(false); }} />
            {passwordError && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>{passwordError}</div>}
            {passwordSaved && <div style={{ fontSize: 'var(--text-small)', color: 'var(--success)' }}>Password updated.</div>}
            <div style={{ ...primaryBtn, opacity: savingPassword ? 0.6 : 1 }} onClick={() => !savingPassword && changePassword()}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Billing</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Update your payment method, view invoices, or cancel your subscription — handled directly through Stripe.
          </div>
          <div style={{ ...ghostBtn, opacity: openingPortal ? 0.6 : 1 }} onClick={() => !openingPortal && manageBilling()}>
            {openingPortal ? 'Opening…' : 'Manage subscription'}
          </div>
          {portalError && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', marginTop: 10 }}>{portalError}</div>}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Session</div>
          <div style={ghostBtn} onClick={onSignOut}>Sign out</div>
        </div>

        <div style={{ ...cardStyle, borderColor: 'color-mix(in srgb, var(--danger) 20%, transparent)' }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>Delete account</div>
          {deleteStep === 'idle' && (
            <>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>Permanently removes your account and data. This can't be undone.</div>
              <div style={dangerBtn} onClick={() => setDeleteStep('confirm')}>Delete my account</div>
            </>
          )}
          {deleteStep === 'confirm' && (
            <>
              <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary-2)', marginBottom: 12 }}>Are you sure? This permanently deletes your account and all data in it.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={dangerBtn} onClick={() => setDeleteStep('contact')}>Yes, delete it</div>
                <div style={ghostBtn} onClick={() => setDeleteStep('idle')}>Cancel</div>
              </div>
            </>
          )}
          {deleteStep === 'contact' && (
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Full self-serve deletion isn't wired up yet — email support to have your account and data removed. Nothing has been deleted.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
