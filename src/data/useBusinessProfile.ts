import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface BusinessProfile {
  business_address: string;
  business_email: string;
  business_phone: string;
  website: string;
  /** How the owner works while teaching the client to eventually run it
   *  themselves — the Product Sheet's closing statement. Written once
   *  here, reused (and editable per-send) on every client's sheet. */
  teaching_philosophy: string;
}

const DEFAULTS: BusinessProfile = { business_address: '', business_email: '', business_phone: '', website: '', teaching_philosophy: '' };

export function useBusinessProfile() {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('business_profile')
      .select('business_address, business_email, business_phone, website, teaching_philosophy')
      .maybeSingle();
    if (err) {
      console.error('load business_profile failed', err);
      setError(err.message);
    }
    // teaching_philosophy is a nullable column added after the others (an
    // untouched existing row has it as null, not '') — coalesce so a null
    // never reaches a controlled <textarea>'s value.
    if (data) setProfile({ ...DEFAULTS, ...data, teaching_philosophy: data.teaching_philosophy ?? '' } as BusinessProfile);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: Partial<BusinessProfile>): Promise<boolean> => {
    setError('');
    const next = { ...profile, ...patch };
    setProfile(next);
    const { error: err } = await supabase.from('business_profile').upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (err) {
      console.error('save business_profile failed', err);
      setError(err.message);
      return false;
    }
    return true;
  };

  return { profile, loading, error, save };
}
