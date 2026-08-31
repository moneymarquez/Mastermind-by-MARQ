import Icon from '../Icon';

/** Blocks the app with a "rotate back to portrait" message whenever a
 *  phone/small-tablet-sized viewport goes into landscape. Visibility is
 *  pure CSS (`.orientation-guard` in index.css, gated on `(orientation:
 *  landscape) and (max-height: 768px)`) rather than a JS matchMedia
 *  listener — it needs to appear the instant the OS rotates the device,
 *  before React would even re-render, and it works identically whether
 *  this mounts in App.tsx, PublicAuditScreen, or PublicClientDashboard.
 *
 *  This is the practical equivalent of an orientation lock, not a real
 *  one: the Screen Orientation Lock API (screen.orientation.lock, also
 *  attempted in main.tsx for standalone/installed Android) has no iOS
 *  Safari support at all, in-browser tab or installed-to-home-screen —
 *  Apple has never implemented it. A blocking overlay is the only thing
 *  that reliably works on the platform this app actually ships to. */
export default function OrientationGuard() {
  return (
    <div className="orientation-guard">
      <Icon name="device-rotate" size={40} color="var(--text-secondary)" />
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginTop: 16 }}>Rotate back to portrait</div>
      <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 6, maxWidth: 280, lineHeight: 1.5 }}>
        Masterminds is built for portrait use on phones — landscape isn't supported yet.
      </div>
    </div>
  );
}
