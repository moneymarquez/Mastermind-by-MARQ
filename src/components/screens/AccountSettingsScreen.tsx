import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Theme } from '../../data/useTheme';
import { useAvatar } from '../../data/useAvatar';
import { startDemo } from '../../demo/state';
import type { DemoSpeed } from '../../demo/state';
import type { ReactNode } from 'react';
import { Page, Sheet, Field, field, useModule } from '../mm/Page';
import Card from '../mm/Card';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  onSignOut: () => void;
  onStartTour: () => void;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
  soundFx: boolean;
  onSoundFxChange: (on: boolean) => void;
}


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

export default function AccountSettingsScreen({ onSignOut, onStartTour, theme, onThemeChange, soundFx, onSoundFxChange }: Props) {
  const { avatarUrl, uploading, error: avatarError, upload: uploadAvatar, remove: removeAvatar } = useAvatar();
  const [user, setUser] = useState<User | null>(null);
  const [demoSpeed, setDemoSpeed] = useState<DemoSpeed>('normal');
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'working'>('idle');
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  // Bug inventory B-08: real export + real deletion (worker/handlers/account.ts).
  const exportData = async () => {
    setExporting(true); setExportError('');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/account/export', { headers: { authorization: `Bearer ${data.session?.access_token ?? ''}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `mastermind-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { setExportError(e instanceof Error ? e.message : 'Export failed.'); }
    setExporting(false);
  };
  const deleteAccount = async () => {
    setDeleteStep('working'); setDeleteError('');
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token ?? ''}`, 'content-type': 'application/json' }, body: JSON.stringify({ confirm: deleteText.trim() }) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : { error: 'Could not reach the server — check your connection and try again.' };
    if (!res || !res.ok) { setDeleteError(body.error ?? `Delete failed (${res?.status})`); setDeleteStep('confirm'); return; }
    try { localStorage.clear(); } catch { /* fine */ }
    onSignOut();
  };
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

  const { device, nav, isOwner } = useModule();
  const phone = device === 'phone';
  const [sheet, setSheet] = useState<'profile' | 'password' | 'demo' | 'delete' | null>(null);
  const chev = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>;
  type R = { l: string; v?: string; on: () => void; danger?: boolean; hide?: boolean };
  const group = (title: string, rows: R[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', paddingLeft: 2 }}>{title}</span>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {rows.filter((r) => !r.hide).map((r, i) => (
          <button key={r.l} onClick={r.on} className="mm-dash-tr" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 50, padding: '0 14px', border: 0, borderTop: i ? '1px solid var(--grid)' : 'none', background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ flex: 1, color: r.danger ? 'var(--danger)' : 'var(--text)', fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>{r.l}</span>
            {r.v && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500 }}>{r.v}</span>}
            {chev}
          </button>
        ))}
      </div>
    </div>
  );
  const seg = (
    <div role="radiogroup" aria-label="Theme" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {(['dark', 'light', 'system'] as Theme[]).map((t) => <button key={t} role="radio" aria-checked={theme === t} onClick={() => onThemeChange(t)} style={{ padding: '8px 0', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', textTransform: 'capitalize', background: theme === t ? 'var(--text)' : 'transparent', color: theme === t ? 'var(--bg)' : 'var(--text-secondary)' }}>{t}</button>)}
    </div>
  );
  const appearance = (
    <Card title="Appearance" wide={!phone}>
      {seg}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500 }}>Sound effects</span>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.45 }}>A short blip on a closed client or a finished goal. Haptics follow the same moments where the device allows it.</span>
        </div>
        <button role="switch" aria-checked={soundFx} aria-label="Sound effects" onClick={() => onSoundFxChange(!soundFx)} style={{ width: 44, height: 26, borderRadius: 999, flex: 'none', border: 0, padding: 0, cursor: 'pointer', position: 'relative', background: soundFx ? 'var(--accent)' : 'var(--surface-3)' }}>
          <span style={{ position: 'absolute', top: 3, left: soundFx ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: soundFx ? '#fff' : 'var(--text-tertiary)', transition: 'left 150ms ease' }} />
        </button>
      </div>
    </Card>
  );
  const name = displayName || (user?.email ?? '').split('@')[0];
  const left = (
    <>
      {appearance}
      {group('Modules', [
        { l: 'Manage modules', on: () => nav('manage-modules') },
        { l: 'Pinned to Home', on: () => nav('manage-modules') },
        { l: 'Playbooks', on: () => nav('playbooks') },
        { l: 'Notifications', on: () => nav('notification-settings') },
        { l: 'Nova voice and prompts', on: () => nav('prompt-voice-settings') },
        { l: 'Connections', v: 'Setup', on: () => nav('setup') },
      ])}
      {group('Account', [
        { l: 'Profile', v: name, on: () => setSheet('profile') },
        { l: 'Password', on: () => setSheet('password') },
        { l: 'Grant access', v: 'Owner', on: () => nav('grant-access'), hide: !isOwner },
        { l: 'Product tour', on: onStartTour },
        { l: 'Demo mode', v: 'Sample data', on: () => setSheet('demo') },
      ])}
    </>
  );
  const right = (
    <>
      {group('Billing', [{ l: openingPortal ? 'Opening…' : 'Plan and invoices', v: 'Stripe', on: () => { if (!openingPortal) void manageBilling(); } }])}
      {portalError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{portalError}</span>}
      {group('Data', [
        { l: exporting ? 'Preparing…' : 'Export everything', v: 'JSON', on: () => { if (!exporting) void exportData(); } },
        { l: 'Delete account', danger: true, on: () => setSheet('delete') },
      ])}
      {exportError && <span role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>{exportError}</span>}
      {group('About', [{ l: "What's new", on: () => nav('changelog') }, { l: 'Privacy and terms', on: () => nav('legal') }])}
      <button className="mm-btn" style={{ height: 46, fontSize: 15, fontWeight: 500, color: 'var(--danger)' }} onClick={onSignOut}>Sign out</button>
    </>
  );
  const sheetEl: ReactNode = sheet === 'profile' ? (
    <Sheet title="Profile" onClose={() => setSheet(null)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-3)' }} />}
        <label className="mm-btn" style={{ opacity: uploading ? 0.6 : 1 }}>{uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadAvatar(f); }} /></label>
        {avatarUrl && <button className="mm-btn" onClick={() => void removeAvatar()}>Remove</button>}
      </div>
      {avatarError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{avatarError}</span>}
      <Field l="Email"><input value={user?.email ?? ''} readOnly style={{ ...field, color: 'var(--text-secondary)' }} /></Field>
      <Field l="Display name"><input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setNameSaved(false); }} style={field} placeholder="Your first name" /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} onClick={() => void saveDisplayName()}>{savingName ? 'Saving…' : nameSaved ? 'Saved' : 'Save'}</button>
    </Sheet>
  ) : sheet === 'password' ? (
    <Sheet title="Change password" onClose={() => setSheet(null)}>
      <Field l="New password"><input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordSaved(false); }} style={field} /></Field>
      <Field l="Confirm it"><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordSaved(false); }} style={field} /></Field>
      {passwordError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{passwordError}</span>}
      {passwordSaved && <span style={{ fontSize: 13, color: 'var(--success)' }}>Password updated.</span>}
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={savingPassword} onClick={() => void changePassword()}>{savingPassword ? 'Updating…' : 'Update password'}</button>
    </Sheet>
  ) : sheet === 'demo' ? (
    <Sheet title="Demo mode" onClose={() => setSheet(null)}>
      <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>A 2-minute guided run through the app on sample data. Nothing in it touches your account. Record hides the controls for a screen capture.</span>
      <div role="radiogroup" aria-label="Demo speed" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {(['slow', 'normal', 'fast'] as const).map((sp) => <button key={sp} role="radio" aria-checked={demoSpeed === sp} className="mm-btn" onClick={() => setDemoSpeed(sp)} style={{ textTransform: 'capitalize', ...(demoSpeed === sp ? { background: 'var(--surface-3)', borderColor: 'var(--text-tertiary)' } : {}) }}>{sp}</button>)}
      </div>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} onClick={() => startDemo({ speed: demoSpeed, returnTo: 'account-settings' })}>Start demo</button>
      <button className="mm-btn" style={{ height: 44 }} onClick={() => startDemo({ speed: demoSpeed, record: true, returnTo: 'account-settings' })}>Record</button>
    </Sheet>
  ) : sheet === 'delete' ? (
    <Sheet title="Delete account" onClose={() => { if (deleteStep !== 'working') { setSheet(null); setDeleteStep('idle'); setDeleteText(''); } }}>
      <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Permanently deletes your account, everything in it and your uploaded files, and cancels your subscription. This can't be undone. Export your data first if you want a copy.</span>
      <Field l="Type DELETE to confirm"><input autoCapitalize="characters" autoComplete="off" value={deleteText} onChange={(e) => { setDeleteText(e.target.value); setDeleteError(''); setDeleteStep('confirm'); }} style={field} /></Field>
      {deleteError && <span role="alert" style={{ fontSize: 13, color: 'var(--danger)' }}>{deleteError}</span>}
      <button className="mm-btn" style={{ height: 48, color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, var(--border))' }} disabled={deleteText.trim() !== 'DELETE' || deleteStep === 'working'} onClick={() => void deleteAccount()}>{deleteStep === 'working' ? 'Deleting…' : 'Delete everything'}</button>
    </Sheet>
  ) : null;

  return (
    <Page title="Settings" sub={user?.email ?? ''} back="Home" backTo="home">
      {phone ? <>{left}{right}</> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 20, alignItems: 'start', maxWidth: 980 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>{left}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>{right}</div>
        </div>
      )}
      {sheetEl}
    </Page>
  );
}
