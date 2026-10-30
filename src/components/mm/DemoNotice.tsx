import { useEffect, useState } from 'react';

/** Sample-data feedback (Approve / Reject on demo cards): a short notice
 *  under the "Sample data" pill. Listens for 'mm-demo-notice'. */
export default function DemoNotice() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const on = (e: Event) => { setMsg(String((e as CustomEvent).detail ?? '')); if (t) clearTimeout(t); t = setTimeout(() => setMsg(null), 5000); };
    window.addEventListener('mm-demo-notice', on);
    return () => { window.removeEventListener('mm-demo-notice', on); if (t) clearTimeout(t); };
  }, []);
  if (!msg) return null;
  return (
    <div role="status" data-testid="demo-notice" onClick={() => setMsg(null)} style={{ position: 'fixed', top: 'calc(30px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', zIndex: 121, maxWidth: 'min(92vw, 520px)', padding: '8px 14px', borderRadius: 'var(--g-r-lg)', border: '1px solid var(--g-line-2)', background: 'var(--g-s2)', color: 'var(--g-text)', fontSize: 13, boxShadow: 'var(--g-shadow-3)', cursor: 'pointer' }}>
      {msg}
    </div>
  );
}
