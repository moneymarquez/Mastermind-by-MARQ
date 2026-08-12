import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DocType } from './documentSchemas';
import { defaultDataFor, DOC_TYPE_LABELS } from './documentSchemas';

export interface ClientDocument {
  id: string;
  doc_type: DocType;
  contact_id: string | null;
  label: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useClientDocuments() {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('client_documents').select('*').order('updated_at', { ascending: false });
    setDocuments((data ?? []) as ClientDocument[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (docType: DocType, label?: string, contactId?: string | null): Promise<ClientDocument | null> => {
    const { data, error } = await supabase
      .from('client_documents')
      .insert({ doc_type: docType, label: label?.trim() || `New ${DOC_TYPE_LABELS[docType]}`, contact_id: contactId ?? null, data: defaultDataFor(docType) })
      .select('*')
      .single();
    if (error) return null;
    await load();
    return data as ClientDocument;
  };

  const update = async (id: string, patch: Partial<Pick<ClientDocument, 'label' | 'data' | 'contact_id'>>) => {
    await supabase.from('client_documents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const duplicate = async (doc: ClientDocument): Promise<ClientDocument | null> => {
    const { data, error } = await supabase
      .from('client_documents')
      .insert({ doc_type: doc.doc_type, label: `${doc.label} (copy)`, contact_id: doc.contact_id, data: doc.data })
      .select('*')
      .single();
    if (error) return null;
    await load();
    return data as ClientDocument;
  };

  const remove = async (id: string) => {
    await supabase.from('client_documents').delete().eq('id', id);
    await load();
  };

  return { documents, loading, create, update, duplicate, remove };
}
