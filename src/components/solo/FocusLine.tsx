import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/** "Focus for next week", pinned from the Weekly Check-in (brief §4.6). */
export default function FocusLine() {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from('user_setup').select('focus_line,focus_week').maybeSingle().then(({ data, error }) => {
      const r = data as { focus_line?: string | null; focus_week?: string | null } | null;
      // Shown for the week after the check-in it came from (two weeks max).
      if (error || !r?.focus_line || !r.focus_week || Date.now() - Date.parse(`${r.focus_week}T12:00:00`) > 14 * 86400000) return;
      setLine(r.focus_line);
    });
  }, []);
  if (!line) return null;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>This week</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{line}</span>
    </div>
  );
}
