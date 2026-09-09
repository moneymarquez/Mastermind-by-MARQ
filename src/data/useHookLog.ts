import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type HookType = 'question' | 'bold_claim' | 'story_open' | 'controversy' | 'proof_receipt' | 'direct_callout' | 'how_to';
export type HookVerdict = 'worked' | 'didnt_work' | 'inconclusive';

export interface HookLogEntry {
  id: string;
  client_id: string;
  idea_id: string;
  hook_line: string;
  hook_type: HookType;
  format: string | null;
  pillar: string | null;
  posted_at: string | null;
  performance_note: string | null;
  retention_note: string | null;
  verdict: HookVerdict;
  created_at: string;
}

export interface LogHookInput {
  hook_type: HookType;
  verdict: HookVerdict;
  performance_note: string;
  retention_note: string;
  posted_at: string;
}

/** Loads every hook_log entry for this account — cross-client, like
 *  Marketing's play_outcomes. hook_type is a fixed, shared taxonomy
 *  (question/bold_claim/story_open/...) so ranking it across every
 *  client's account is meaningful; pillar is free text unique per plan,
 *  so pillar-based reshaping (contentIdeaEngine.ts) stays scoped to one
 *  plan's own entries instead. */
export function useHookLog() {
  const [entries, setEntries] = useState<HookLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('hook_log')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setError('');
    setEntries((data ?? []) as HookLogEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Logs one published post's outcome. Snapshots hook_line/format/
   *  pillar off the idea at logging time (the columns exist precisely so
   *  this doesn't have to join back to content_ideas later). */
  const logHook = async (idea: { id: string; client_id: string; hook_line: string; format: string | null; pillar: string | null }, input: LogHookInput) => {
    const { error: err } = await supabase.from('hook_log').insert({
      client_id: idea.client_id,
      idea_id: idea.id,
      hook_line: idea.hook_line,
      hook_type: input.hook_type,
      format: idea.format,
      pillar: idea.pillar,
      posted_at: input.posted_at,
      performance_note: input.performance_note.trim() || null,
      retention_note: input.retention_note.trim() || null,
      verdict: input.verdict,
    });
    if (err) setError(err.message);
    await load();
  };

  return { entries, loading, error, reload: load, logHook };
}

export interface HookTypeRankRow {
  hook_type: HookType;
  worked: number;
  didnt_work: number;
  inconclusive: number;
  total: number;
}

/** Cross-account ranking, same "raw win count first" logic as
 *  Marketing's rankTrackRecord — a hook_type with 8 real wins outranks
 *  one with a single untested win, not the other way around. */
export function rankHookTypes(entries: HookLogEntry[]): HookTypeRankRow[] {
  const byType = new Map<HookType, HookTypeRankRow>();
  for (const e of entries) {
    const row = byType.get(e.hook_type) ?? { hook_type: e.hook_type, worked: 0, didnt_work: 0, inconclusive: 0, total: 0 };
    row[e.verdict] += 1;
    row.total += 1;
    byType.set(e.hook_type, row);
  }
  return [...byType.values()].sort((a, b) => {
    if (b.worked !== a.worked) return b.worked - a.worked;
    return b.worked / b.total - a.worked / a.total;
  });
}

const MIN_SAMPLE_FOR_SLATE_SIGNAL = 30;

/** "Feeding it back into slate ranking" (build order item 7) — the
 *  pillar with the best logged track record for THIS plan, or null when
 *  there isn't enough signal yet. "Says nothing useful for the first
 *  ~30 posts" is the build prompt's own line — enforced here as a hard
 *  floor, not just a UI caption, so a 2-post sample can't silently skew
 *  the next slate. */
export function bestPillarFromHookLog(entries: HookLogEntry[], planIdeaIds: Set<string>): string | null {
  const planEntries = entries.filter((e) => planIdeaIds.has(e.idea_id));
  if (planEntries.length < MIN_SAMPLE_FOR_SLATE_SIGNAL) return null;
  const byPillar = new Map<string, { worked: number; total: number }>();
  for (const e of planEntries) {
    if (!e.pillar) continue;
    const row = byPillar.get(e.pillar) ?? { worked: 0, total: 0 };
    if (e.verdict === 'worked') row.worked++;
    row.total++;
    byPillar.set(e.pillar, row);
  }
  const ranked = [...byPillar.entries()].sort((a, b) => {
    if (b[1].worked !== a[1].worked) return b[1].worked - a[1].worked;
    return b[1].worked / b[1].total - a[1].worked / a[1].total;
  });
  return ranked[0]?.[0] ?? null;
}
