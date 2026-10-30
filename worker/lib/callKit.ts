// The cold-call kit's Worker side (Growth Blueprint phase 1): loads callable
// leads, their website-gap findings and the Complaint Scanner's clusters,
// ranks them with the pure src/data/callKit.ts, and keeps one snapshot per
// Denver day so the list is ready by 8 AM and doesn't reshuffle while Marq
// dials.
//
// Reads and one internal cache row only. Nothing here sends an email, a
// text or a call, or touches any outside service, so DRY_RUN has nothing to
// gate; the snapshot records whether test mode was on so the app can say so.
// The snapshot lives in harvest_cache (source 'call_kit', key = the Denver
// date), an existing owner-scoped cache table, so no migration is needed.
import type { Sb } from './sb';
import { zonedNow } from './sb';
import { OWNER_USER_ID } from './auth';
import { buildCallList, CALL_KIT_COLUMNS, CALL_LIST_EXCLUDED } from '../../src/data/callKit';
import type { CallKit, CallKitCluster, CallKitGap, CallKitLead } from '../../src/data/callKit';

export const CALL_KIT_TZ = 'America/Denver';
/** The morning snapshot is built on the first 5-minute tick at or after 7:50 AM Denver, so it's ready by 8. */
export const CALL_KIT_READY_MIN = 7 * 60 + 50;
const SOURCE = 'call_kit';

export interface CallKitSnapshot { date: string; generated_at: string; test_mode: boolean; items: CallKit[] }

const base = 'archived_at=is.null&is_chain=not.is.true&duplicate_of=is.null&dnc_at=is.null&phone=not.is.null';
const statusOk = `or(status.is.null,status.not.in.(${[...CALL_LIST_EXCLUDED].join(',')}))`;
const callable = `${base}&and=(${statusOk})`;

/** Builds today's ranked list from the database. */
export async function generateCallKit(sb: Sb, userId: string, opts: { testMode: boolean; at?: Date } = { testMode: true }): Promise<CallKitSnapshot> {
  const at = opts.at ?? new Date();
  const today = zonedNow(CALL_KIT_TZ, at).date;
  const [byFizzle, findings, clusters] = await Promise.all([
    sb.get<CallKitLead>(`leads?select=${CALL_KIT_COLUMNS}&${callable}&order=fizzle_score.desc.nullslast&limit=250`),
    sb.get<{ lead_id: string | null; place_id: string | null; kind: string; summary: string; score: number }>(`lead_findings?user_id=eq.${userId}&archived_at=is.null&kind=neq.checked&order=score.desc&limit=300&select=lead_id,place_id,kind,summary,score`).catch(() => []),
    sb.get<CallKitCluster>(`complaint_clusters?user_id=eq.${userId}&archived_at=is.null&status=neq.dismissed&order=rank_score.desc&limit=30&select=industry,title`).catch(() => []),
  ]);
  // Leads the gap checker ranked but the fizzle sort didn't reach, and anything queued or due back.
  const have = new Set(byFizzle.map((l) => l.id));
  const gapIds = [...new Set(findings.map((f) => f.lead_id).filter((x): x is string => !!x && !have.has(x)))].slice(0, 100);
  const [byGap, queued] = await Promise.all([
    gapIds.length ? sb.get<CallKitLead>(`leads?select=${CALL_KIT_COLUMNS}&${callable}&id=in.(${gapIds.join(',')})`) : Promise.resolve([] as CallKitLead[]),
    sb.get<CallKitLead>(`leads?select=${CALL_KIT_COLUMNS}&${base}&and=(${statusOk},or(dialing_queued.is.true,next_followup_at.lte.${today}T23:59:59))&limit=100`).catch(() => [] as CallKitLead[]),
  ]);
  const leads = [...queued, ...byFizzle, ...byGap];
  const pidToId = new Map(leads.filter((l) => l.place_id).map((l) => [l.place_id as string, l.id]));
  const gaps = new Map<string, CallKitGap[]>(), gapScore = new Map<string, number>();
  for (const f of findings) {
    const id = f.lead_id ?? (f.place_id ? pidToId.get(f.place_id) : undefined);
    if (!id) continue;
    gaps.set(id, [...(gaps.get(id) ?? []), { kind: f.kind, text: f.summary }]);
    gapScore.set(id, Math.max(gapScore.get(id) ?? 0, Number(f.score) || 0));
  }
  const items = buildCallList(leads, gaps, clusters, { today, now: at.getTime(), gapScoreByLead: gapScore });
  return { date: today, generated_at: at.toISOString(), test_mode: opts.testMode, items };
}

export async function readSnapshot(sb: Sb, userId: string, date: string): Promise<CallKitSnapshot | null> {
  const [row] = await sb.get<{ payload: CallKitSnapshot }>(`harvest_cache?user_id=eq.${userId}&source=eq.${SOURCE}&key=eq.${date}&select=payload&limit=1`).catch(() => []);
  return row?.payload ?? null;
}
export async function saveSnapshot(sb: Sb, userId: string, snap: CallKitSnapshot): Promise<void> {
  await sb.insert('harvest_cache', { user_id: userId, source: SOURCE, key: snap.date, payload: snap, fetched_at: snap.generated_at }, { upsert: 'user_id,source,key' });
}

/** Today's list with each lead's latest status, so a lead called this morning shows as called. */
export async function withLatestStatus(sb: Sb, snap: CallKitSnapshot): Promise<CallKitSnapshot> {
  if (!snap.items.length) return snap;
  const rows = await sb.get<{ id: string; status: string | null; last_called_at: string | null; call_count: number | null }>(`leads?id=in.(${snap.items.map((i) => i.leadId).join(',')})&select=id,status,last_called_at,call_count`).catch(() => []);
  const m = new Map(rows.map((r) => [r.id, r]));
  return { ...snap, items: snap.items.map((i) => { const r = m.get(i.leadId); return r ? { ...i, status: r.status, lastCalledAt: r.last_called_at, callCount: r.call_count ?? 0 } : i; }) };
}

/** 5-minute tick: build the owner's snapshot once a day, from 7:50 AM Denver. Returns whether it built one. */
export async function runCallKitTick(sb: Sb, opts: { testMode: boolean; at?: Date; userId?: string }): Promise<boolean> {
  const at = opts.at ?? new Date();
  const z = zonedNow(CALL_KIT_TZ, at);
  if (z.minutes < CALL_KIT_READY_MIN) return false;
  const userId = opts.userId ?? OWNER_USER_ID;
  if (await readSnapshot(sb, userId, z.date)) return false;
  await saveSnapshot(sb, userId, await generateCallKit(sb, userId, { testMode: opts.testMode, at }));
  return true;
}
