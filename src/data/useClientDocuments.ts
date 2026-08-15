import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DocType } from './documentSchemas';
import { defaultDataFor, DOC_TYPE_LABELS } from './documentSchemas';

export type DocumentStatus = 'draft' | 'sent' | 'paid';

export interface ClientDocument {
  id: string;
  doc_type: DocType;
  contact_id: string | null;
  label: string;
  data: Record<string, unknown>;
  status: DocumentStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientDocuments() {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('client_documents').select('*').order('updated_at', { ascending: false });
    if (err) {
      console.error('load client_documents failed', err);
      setError(err.message);
    }
    setDocuments((data ?? []) as ClientDocument[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (
    docType: DocType,
    label?: string,
    contactId?: string | null,
    initialData?: Record<string, unknown>,
  ): Promise<ClientDocument | null> => {
    setError('');
    const { data, error: err } = await supabase
      .from('client_documents')
      .insert({
        doc_type: docType,
        label: label?.trim() || `New ${DOC_TYPE_LABELS[docType]}`,
        contact_id: contactId ?? null,
        data: { ...defaultDataFor(docType), ...(initialData ?? {}) },
      })
      .select('*')
      .single();
    if (err) {
      console.error('create client_documents failed', err);
      setError(err.message);
      return null;
    }
    await load();
    return data as ClientDocument;
  };

  const update = async (id: string, patch: Partial<Pick<ClientDocument, 'label' | 'data' | 'contact_id'>>): Promise<boolean> => {
    setError('');
    const { error: err } = await supabase.from('client_documents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) {
      console.error('update client_documents failed', err);
      setError(err.message);
      return false;
    }
    await load();
    return true;
  };

  const duplicate = async (doc: ClientDocument): Promise<ClientDocument | null> => {
    setError('');
    const { data, error: err } = await supabase
      .from('client_documents')
      .insert({ doc_type: doc.doc_type, label: `${doc.label} (copy)`, contact_id: doc.contact_id, data: doc.data })
      .select('*')
      .single();
    if (err) {
      console.error('duplicate client_documents failed', err);
      setError(err.message);
      return null;
    }
    await load();
    return data as ClientDocument;
  };

  // Marking an invoice 'paid' is what makes it show up as income in
  // Budgeting (see src/data/useBudgeting.ts, which reads paid_at directly
  // rather than a duplicated transaction row). Clearing back to draft/sent
  // clears paid_at too, so an accidental mark-paid can be undone cleanly.
  const setStatus = async (id: string, status: DocumentStatus): Promise<boolean> => {
    setError('');
    const { error: err } = await supabase
      .from('client_documents')
      .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) {
      console.error('setStatus client_documents failed', err);
      setError(err.message);
      return false;
    }
    await load();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    setError('');
    const { error: err } = await supabase.from('client_documents').delete().eq('id', id);
    if (err) {
      console.error('remove client_documents failed', err);
      setError(err.message);
      return false;
    }
    await load();
    return true;
  };

  return { documents, loading, error, create, update, duplicate, remove, setStatus };
}
