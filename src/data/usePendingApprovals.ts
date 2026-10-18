import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** How many approvals are waiting (the E-commerce Approvals badge). Owner only; refreshes every minute and on focus. */
export function usePendingApprovals(enabled: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) { setN(0); return; }
    let on = true;
    const load = () => { supabase.from('ai_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending').then(({ count }) => { if (on) setN(count ?? 0); }, () => {}); };
    load();
    const t = setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => { on = false; clearInterval(t); window.removeEventListener('focus', load); };
  }, [enabled]);
  return n;
}
