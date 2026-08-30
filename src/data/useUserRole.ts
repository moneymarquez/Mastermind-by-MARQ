import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'owner' | 'client' | null;

/** Owner is decided synchronously by the caller (see ownerIdentity.ts) —
 *  this hook does no network work at all for that account, same reasoning
 *  as useModuleAccess/useSubscription. Everyone else gets one profiles
 *  lookup (schema_045_client_login.sql); no row there — the case for
 *  every existing subscriber and comped account — resolves to role: null
 *  and is completely unaffected by any of this. */
export function useUserRole(isOwner: boolean) {
  const [role, setRole] = useState<UserRole>(isOwner ? 'owner' : null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isOwner);

  const load = useCallback(async () => {
    if (isOwner) {
      setRole('owner');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from('profiles').select('role, client_id').maybeSingle();
    if (data?.role === 'client') {
      setRole('client');
      setClientId(data.client_id);
    } else {
      setRole(null);
      setClientId(null);
    }
    setLoading(false);
  }, [isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  return { role, clientId, loading };
}
