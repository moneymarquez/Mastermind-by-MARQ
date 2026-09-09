import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ClientType } from './types';

export interface ClientListItem {
  id: string;
  business_name: string;
  client_type: ClientType;
  stage: string;
}

/** The lightweight list this app's new client selector runs on — just
 *  enough to populate a dropdown and create a new row inline, not the
 *  full nested audit/pricing/invoices tree useClientCRM() loads. Any
 *  authenticated user's own crm_clients rows (schema_068 loosened that
 *  table from owner-only to per-user), so this works the same way for
 *  the owner and for a comped account managing their own clients. */
export function useClients() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('crm_clients')
      .select('id, business_name, client_type, stage')
      .order('business_name');
    if (err) {
      setError(err.message);
    } else {
      setError('');
      setClients((data ?? []) as ClientListItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createClient = async (businessName: string, clientType: ClientType = 'client'): Promise<ClientListItem | null> => {
    const { data, error: err } = await supabase
      .from('crm_clients')
      .insert({ business_name: businessName, client_type: clientType, source: 'internal' })
      .select('id, business_name, client_type, stage')
      .single();
    if (err) {
      setError(err.message);
      return null;
    }
    await load();
    return data as ClientListItem;
  };

  return { clients, loading, error, reload: load, createClient };
}
