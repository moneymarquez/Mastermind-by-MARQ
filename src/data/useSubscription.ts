import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type SubscriptionStatus = 'none' | 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

/** isOwner is decided synchronously by the caller (see AuthedGate.tsx /
 *  src/auth/ownerIdentity.ts) — the owner is never billed and this hook
 *  does no network work at all for that account. */
export function useSubscription(isOwner: boolean) {
  const [status, setStatus] = useState<SubscriptionStatus>(isOwner ? 'active' : 'none');
  const [loading, setLoading] = useState(!isOwner);

  const load = useCallback(async () => {
    if (isOwner) {
      setStatus('active');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from('subscriptions').select('status').maybeSingle();
    setStatus((data?.status as SubscriptionStatus) ?? 'none');
    setLoading(false);
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  const isActive = isOwner || status === 'active' || status === 'trialing';

  return { status, isActive, loading, refresh: load };
}
