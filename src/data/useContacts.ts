import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Contact, ContactSource, DialingContactDetails, ScalingContactDetails } from './types';

export interface ContactInput {
  name: string;
  phone: string | null;
  email: string | null;
  business_name: string | null;
  source: ContactSource;
  status: string | null;
  notes: string | null;
  details?: Partial<DialingContactDetails> | Partial<ScalingContactDetails>;
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('contacts').select('*').order('name');
    setContacts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Matches an existing contact on phone OR email (case-insensitive) and updates it
   *  instead of creating a duplicate — the dedupe logic DIALING/SCALEZ both rely on. */
  const upsertContact = useCallback(
    async (input: ContactInput): Promise<Contact> => {
      const phone = input.phone?.trim() || null;
      const email = input.email?.trim().toLowerCase() || null;

      let existing: Contact | undefined;
      if (phone) existing = contacts.find((c) => c.phone?.trim() === phone);
      if (!existing && email) existing = contacts.find((c) => c.email?.trim().toLowerCase() === email);

      if (existing) {
        const patch = {
          name: input.name.trim() || existing.name,
          phone: phone || existing.phone,
          email: email || existing.email,
          business_name: input.business_name?.trim() || existing.business_name,
          status: input.status ?? existing.status,
          notes: input.notes?.trim() || existing.notes,
          details: input.details ? { ...existing.details, ...input.details } : existing.details,
          updated_at: new Date().toISOString(),
        };
        const { data } = await supabase.from('contacts').update(patch).eq('id', existing.id).select().single();
        await load();
        return (data as Contact) ?? { ...existing, ...patch };
      }

      const { data } = await supabase
        .from('contacts')
        .insert({
          name: input.name.trim(),
          phone,
          email,
          business_name: input.business_name?.trim() || null,
          source: input.source,
          status: input.status,
          notes: input.notes?.trim() || null,
          details: input.details ?? {},
        })
        .select()
        .single();
      await load();
      return data as Contact;
    },
    [contacts, load]
  );

  const updateContact = async (id: string, patch: Partial<ContactInput>) => {
    await supabase.from('contacts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const deleteContact = async (id: string) => {
    await supabase.from('contacts').delete().eq('id', id);
    await load();
  };

  /** Client-side match for the DIALING/SCALEZ autocomplete — the contact list is
   *  small enough for a personal tracker that a server round-trip isn't worth it. */
  const search = (query: string): Contact[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return contacts
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  };

  return { contacts, loading, upsertContact, updateContact, deleteContact, search };
}
