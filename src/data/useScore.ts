import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { ScoreRow } from './aiScores';

// Scores are read for many cards at once: one shared cache, reads batched per
// tick, and missing scores computed one at a time on the server so a screen of
// 40 cards never fires 40 parallel model calls.

type Key = string; // `${type}:${id}`
const cache = new Map<Key, ScoreRow | null>();
const subs = new Map<Key, Set<(r: ScoreRow | null) => void>>();
let pendingRead = new Set<Key>();
let readTimer: ReturnType<typeof setTimeout> | null = null;
const scoreQueue: Key[] = [];
let scoring = false;
const asked = new Set<Key>();

const emit = (k: Key) => { for (const f of subs.get(k) ?? []) f(cache.get(k) ?? null); };

async function flushReads() {
  readTimer = null;
  const keys = [...pendingRead]; pendingRead = new Set();
  const byType = new Map<string, string[]>();
  for (const k of keys) { const [t, id] = k.split(':'); byType.set(t, [...(byType.get(t) ?? []), id]); }
  for (const [t, ids] of byType) {
    const { data } = await supabase.from('ai_output_scores').select('*').eq('output_type', t).in('output_id', ids);
    const got = new Map(((data ?? []) as ScoreRow[]).map((r) => [r.output_id, r]));
    for (const id of ids) {
      const k = `${t}:${id}`;
      cache.set(k, got.get(id) ?? null);
      emit(k);
      if (!got.has(id) && !asked.has(k)) { asked.add(k); scoreQueue.push(k); }
    }
  }
  void drain();
}

async function drain() {
  if (scoring) return;
  scoring = true;
  while (scoreQueue.length) {
    const k = scoreQueue.shift()!;
    const [type, id] = k.split(':');
    const r = await api<{ score?: ScoreRow; error?: string }>('/api/scores/score', { body: { type, id } });
    if (r.score) { cache.set(k, r.score); emit(k); }
  }
  scoring = false;
}

/** The score row for one AI output (null while it's being scored or if it can't be). */
export function useScore(type: string, id: string | null | undefined): ScoreRow | null {
  const k = id ? `${type}:${id}` : '';
  const [row, setRow] = useState<ScoreRow | null>(k ? cache.get(k) ?? null : null);
  useEffect(() => {
    if (!k) return;
    const set = subs.get(k) ?? new Set(); set.add(setRow); subs.set(k, set);
    if (!cache.has(k)) { pendingRead.add(k); if (!readTimer) readTimer = setTimeout(() => void flushReads(), 30); }
    else setRow(cache.get(k) ?? null);
    return () => { set.delete(setRow); };
  }, [k]);
  return row;
}

/** Re-score after an output changed (e.g. a card's numbers came in). */
export function rescore(type: string, id: string) {
  const k = `${type}:${id}`;
  asked.add(k); scoreQueue.push(k); void drain();
}
