import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type SubscriptionStatus = 'none' | 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

/** isOwner is decided synchronously by the caller (see AuthedGate.tsx /
 *  src/auth/ownerIdentity.ts) — the owner is never billed and this hook
 *  does no network work at all for that account. */
export function useSubscription(isOwner: boolean) {
  const [status, setStatus] = useState<SubscriptionStatus>(isOwner ? 'active' : 'none');
  const [comped, setComped] = useState(false);
  const [loading, setLoading] = useState(!isOwner);

  const load = useCallback(async () => {
    if (isOwner) {
      setStatus('active');
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data }, { data: isComped }] = await Promise.all([
      supabase.from('subscriptions').select('status').maybeSingle(),
      supabase.rpc('is_comped'),
    ]);
    setStatus((data?.status as SubscriptionStatus) ?? 'none');
    setComped(!!isComped);
    setLoading(false);
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  // Comped: an owner-granted free account (see schema_043_comped_users.sql)
  // — a real subscription is never created for it, so this is the only
  // thing standing between it and the billing gate.
  const isActive = isOwner || comped || status === 'active' || status === 'trialing';

  return { status, isActive, loading, refresh: load };
}
