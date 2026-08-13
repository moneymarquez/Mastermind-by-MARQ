import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type SubscriptionStatus = 'none' | 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus>('none');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('subscriptions').select('status').maybeSingle();
    setStatus((data?.status as SubscriptionStatus) ?? 'none');
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isActive = status === 'active' || status === 'trialing';

  return { status, isActive, loading, refresh: load };
}
