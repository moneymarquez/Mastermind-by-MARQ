/** In-app replacement for window.confirm().
 *
 *  Safari suppresses confirm()/alert() in some contexts — notably web apps
 *  added to the Dock / Home Screen — where it returns false without showing
 *  anything, so every "Are you sure?" silently cancelled (Playbooks → Move
 *  never sent a request). This draws its own dialog with the app's tokens,
 *  so it works everywhere and follows the active skin. */
export function askConfirm(message: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const scrim = document.createElement('div');
    scrim.setAttribute('role', 'dialog');
    scrim.setAttribute('aria-modal', 'true');
    Object.assign(scrim.style, { position: 'fixed', inset: '0', zIndex: '200', background: 'var(--mm-scrim, rgba(0,0,0,.6))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' });
    const box = document.createElement('div');
    Object.assign(box.style, { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '18px', maxWidth: '420px', width: '100%', boxShadow: 'var(--mm-shadow, 0 20px 60px rgba(0,0,0,.5))', fontFamily: 'inherit' });
    const text = document.createElement('div');
    text.textContent = message;
    Object.assign(text.style, { fontSize: 'var(--text-body-lg, 14px)', lineHeight: '1.5', whiteSpace: 'pre-wrap' });
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px', flexWrap: 'wrap' });
    const mk = (label: string, primary: boolean) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      Object.assign(b.style, {
        padding: '9px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body, 13px)', fontWeight: '600', fontFamily: 'inherit',
        border: primary ? 'none' : '1px solid var(--border)',
        background: primary ? (opts.danger ? 'var(--danger)' : 'var(--accent)') : 'transparent',
        color: primary ? 'var(--bg)' : 'var(--text)',
      });
      return b;
    };
    const cancel = mk(opts.cancel ?? 'Cancel', false);
    const ok = mk(opts.ok ?? 'OK', true);
    row.append(cancel, ok);
    box.append(text, row);
    scrim.append(box);
    const done = (v: boolean) => { document.removeEventListener('keydown', onKey, true); scrim.remove(); prevFocus?.focus?.(); resolve(v); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } if (e.key === 'Enter') { e.stopPropagation(); done(true); } };
    cancel.onclick = () => done(false);
    ok.onclick = () => done(true);
    scrim.onclick = (e) => { if (e.target === scrim) done(false); };
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(scrim);
    ok.focus();
  });
}
