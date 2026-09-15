import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { MarketingPlay } from './useMarketingPlays';

export type OutcomeVerdict = 'worked' | 'didnt_work' | 'inconclusive';
export type ReasonCode = 'wrong_channel' | 'weak_offer' | 'bad_creative' | 'too_early';

export interface PlayOutcome {
  id: string;
  play_id: string;
  client_id: string;
  verdict: OutcomeVerdict;
  days_to_first_result: number | null;
  actual_result: string | null;
  reason_code: ReasonCode | null;
  what_to_change: string | null;
  created_at: string;
  /** From the joined marketing_plays row — which channel this outcome
   *  was actually for. Null only if the play itself was since deleted
   *  (play_id cascades, so in practice this row would be gone too; kept
   *  nullable purely so a join miss can't crash the ranking). */
  play_key: string | null;
  play_title: string | null;
}

export interface LogOutcomeInput {
  verdict: OutcomeVerdict;
  days_to_first_result: number | null;
  actual_result: string;
  reason_code: ReasonCode | null;
  what_to_change: string;
}

interface OutcomeRow {
  id: string;
  play_id: string;
  client_id: string;
  verdict: OutcomeVerdict;
  days_to_first_result: number | null;
  actual_result: string | null;
  reason_code: ReasonCode | null;
  what_to_change: string | null;
  created_at: string;
}

/** Loads every outcome across every client for this account — the
 *  "ranked by what's actually worked for this operator's clients" track
 *  record is cross-client by design (build order item 7), not scoped to
 *  whichever client happens to be selected. Same per-account isolation
 *  as every other play/marketing table in this rebuild — RLS already
 *  limits this to the caller's own rows regardless of client. Two plain
 *  queries + a client-side map rather than a PostgREST embedded-resource
 *  select (`*, play:marketing_plays(...)`) — this codebase has no other
 *  use of that syntax to verify against, so a predictable pattern that's
 *  already proven everywhere else beats an unverified one here. */
export function usePlayOutcomes() {
  const [outcomes, setOutcomes] = useState<PlayOutcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('play_outcomes')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
      setOutcomes([]);
      setLoading(false);
      return;
    }
    setError('');
    const rows = (data ?? []) as OutcomeRow[];
    const playIds = [...new Set(rows.map((r) => r.play_id))];
    const plays = playIds.length > 0
      ? (await supabase.from('marketing_plays').select('id, play_key, title').in('id', playIds)).data ?? []
      : [];
    const playById = new Map(plays.map((p) => [p.id as string, p as { id: string; play_key: string; title: string }]));
    setOutcomes(rows.map((r) => ({ ...r, play_key: playById.get(r.play_id)?.play_key ?? null, play_title: playById.get(r.play_id)?.title ?? null })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Logs the retrospective outcome for a play and updates the play's own
   *  status to match the verdict — 'worked' closes it out as a winner,
   *  'didnt_work' closes it out as killed (a no-op if the checkpoint
   *  already killed it), 'inconclusive' leaves status exactly as it was,
   *  since nothing was actually decided. */
  const logOutcome = async (play: MarketingPlay, input: LogOutcomeInput) => {
    const { error: err } = await supabase.from('play_outcomes').insert({
      play_id: play.id,
      client_id: play.client_id,
      verdict: input.verdict,
      days_to_first_result: input.days_to_first_result,
      actual_result: input.actual_result.trim() || null,
      reason_code: input.reason_code,
      what_to_change: input.what_to_change.trim() || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    if (input.verdict === 'worked' && play.status !== 'won') {
      await supabase.from('marketing_plays').update({ status: 'won', updated_at: new Date().toISOString() }).eq('id', play.id);
    } else if (input.verdict === 'didnt_work' && play.status !== 'killed') {
      await supabase.from('marketing_plays').update({ status: 'killed', updated_at: new Date().toISOString() }).eq('id', play.id);
    }
    await load();
  };

  return { outcomes, loading, error, reload: load, logOutcome };
}

export interface TrackRecordRow {
  play_key: string;
  play_title: string;
  worked: number;
  didnt_work: number;
  inconclusive: number;
  total: number;
}

/** Ranks by raw win count first, win rate only as a tiebreak — NOT by
 *  win rate first. A pure rate sort lets one lucky untested win (1/1,
 *  100%) outrank a channel with 8 real wins alongside 2 losses (8/10,
 *  80%), which is exactly backwards for "proof content" and exactly the
 *  kind of small-sample overclaiming the "worthless for the first ~10
 *  entries" warning exists to guard against. Sorting by worked-count
 *  keeps a real track record ahead of a lucky first try; rate only
 *  breaks a tie between two channels with the same number of wins. */
export function rankTrackRecord(outcomes: PlayOutcome[]): TrackRecordRow[] {
  const byKey = new Map<string, TrackRecordRow>();
  for (const o of outcomes) {
    if (!o.play_key) continue;
    const row = byKey.get(o.play_key) ?? { play_key: o.play_key, play_title: o.play_title ?? o.play_key, worked: 0, didnt_work: 0, inconclusive: 0, total: 0 };
    row[o.verdict] += 1;
    row.total += 1;
    byKey.set(o.play_key, row);
  }
  return [...byKey.values()].sort((a, b) => {
    if (b.worked !== a.worked) return b.worked - a.worked;
    return b.worked / b.total - a.worked / a.total;
  });
}
