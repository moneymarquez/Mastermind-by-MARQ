import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { askClaude, extractJson, AiError } from '../lib/ai';
import { startListening } from '../lib/speech';
import type { SpeechRecognizerHandle } from '../lib/speech';
import { dateStr } from './time';

export type CaptureType = 'task' | 'expense' | 'income' | 'contact' | 'decision' | 'note' | 'followup';

export const CAPTURE_TYPE_LABEL: Record<CaptureType, string> = {
  task: 'Task', expense: 'Expense', income: 'Income', contact: 'Contact',
  decision: 'Decision', note: 'Note', followup: 'Follow-up',
};
export const CAPTURE_TYPE_MODULE: Record<CaptureType, string> = {
  task: 'Reminders', expense: 'Budgeting', income: 'Budgeting', contact: 'Contacts',
  decision: 'Decision Log', note: 'Notes', followup: 'Reminders',
};

interface Classification {
  type: CaptureType;
  filed_summary: string;
  fields: Record<string, unknown>;
}

export interface FiledRecord {
  type: CaptureType;
  table: string;
  id: string;
  summary: string;
  fields: Record<string, unknown>;
}

const TABLE_FOR: Record<CaptureType, string> = {
  task: 'reminders', followup: 'reminders', expense: 'budget_transactions', income: 'budget_transactions',
  contact: 'contacts', decision: 'decisions', note: 'voice_notes',
};

async function fileByType(type: CaptureType, fields: Record<string, unknown>, transcript: string): Promise<{ id: string; table: string }> {
  const today = dateStr(new Date());
  const table = TABLE_FOR[type];
  const s = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
  const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

  let insertPayload: Record<string, unknown>;
  if (type === 'task') {
    insertPayload = { title: s(fields.title, transcript.slice(0, 80)), due_date: s(fields.due_date, today), due_time: null };
  } else if (type === 'followup') {
    insertPayload = { title: `Follow up: ${s(fields.title, transcript.slice(0, 70))}`, due_date: s(fields.due_date, today) };
  } else if (type === 'expense' || type === 'income') {
    insertPayload = { type, amount: n(fields.amount), description: s(fields.description, transcript.slice(0, 80)), occurred_on: today };
  } else if (type === 'contact') {
    insertPayload = { name: s(fields.name, transcript.slice(0, 60)), phone: s(fields.phone) || null, email: s(fields.email) || null, business_name: s(fields.business_name) || null, notes: s(fields.notes) || null, source: 'manual' };
  } else if (type === 'decision') {
    const reviewDefault = new Date(); reviewDefault.setDate(reviewDefault.getDate() + 7);
    insertPayload = { title: s(fields.title, transcript.slice(0, 60)), reasoning: s(fields.reasoning, transcript), expected_outcome: s(fields.expected_outcome, 'Not specified'), review_date: s(fields.review_date, dateStr(reviewDefault)) };
  } else {
    insertPayload = { content: s(fields.content, transcript) };
  }

  const { data, error } = await supabase.from(table).insert(insertPayload).select('id').single();
  if (error) throw error;
  return { id: data.id as string, table };
}

export function useVoiceCapture() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filed, setFiled] = useState<FiledRecord | null>(null);
  const [error, setError] = useState('');
  const handleRef = useRef<SpeechRecognizerHandle | null>(null);

  const process = async (text: string) => {
    if (!text.trim()) return;
    setProcessing(true);
    setError('');
    setFiled(null);
    try {
      const raw = await askClaude({
        system:
          'You are Nova, filing a spoken note into the correct place inside Mastermind by MARQ. ' +
          'Classify it as exactly one of: task, expense, income, contact, decision, note, followup. Extract only fields explicitly present or clearly implied — don\'t invent specifics. ' +
          'Respond with ONLY a JSON object: {"type": one of the above, "filed_summary": string (one plain sentence describing what got filed), "fields": object with whatever of these apply to the type — title, due_date (YYYY-MM-DD), amount (number), description, name, phone, email, business_name, notes, reasoning, expected_outcome, review_date (YYYY-MM-DD), content}.',
        messages: [{ role: 'user', content: `Spoken: "${text}"\n\nToday's date: ${dateStr(new Date())}` }],
        maxTokens: 400,
      });
      const parsed = extractJson<Classification>(raw);
      const { id, table } = await fileByType(parsed.type, parsed.fields, text);
      setFiled({ type: parsed.type, table, id, summary: parsed.filed_summary, fields: parsed.fields });
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Could not file that.');
    } finally {
      setProcessing(false);
    }
  };

  const start = () => {
    setTranscript('');
    setFiled(null);
    setError('');
    const handle = startListening({
      onTranscript: (text, isFinal) => {
        setTranscript(text);
        if (isFinal) process(text);
      },
      onEnd: () => setListening(false),
      onError: (msg) => setError(msg),
    });
    if (!handle) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    handleRef.current = handle;
    setListening(true);
  };

  const stop = () => {
    handleRef.current?.stop();
    setListening(false);
  };

  // Deletes whatever got filed and re-files the same raw transcript under
  // a different type — a real correction (the record actually moves),
  // not a cosmetic label change.
  const refileAs = async (newType: CaptureType) => {
    if (!filed || !transcript) return;
    setProcessing(true);
    setError('');
    try {
      await supabase.from(filed.table).delete().eq('id', filed.id);
      const { id, table } = await fileByType(newType, {}, transcript);
      setFiled({ type: newType, table, id, summary: `Refiled as ${CAPTURE_TYPE_LABEL[newType].toLowerCase()}.`, fields: {} });
    } catch {
      setError('Could not refile — the original record may still be there.');
    } finally {
      setProcessing(false);
    }
  };

  const discard = async () => {
    if (!filed) return;
    await supabase.from(filed.table).delete().eq('id', filed.id);
    setFiled(null);
  };

  return { listening, transcript, processing, filed, error, start, stop, refileAs, discard };
}
