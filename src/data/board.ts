// Orchestrator board (spec Part 5). Pure: the Worker builds the board with
// these, the Office and Classroom draw it. Phase 1–5 per workstream plus a
// "Waiting on you" column that's always shown first.

export type StreamKey = 'madeby' | 'ecom' | 'mostfit' | 'side';
export type Phase = 1 | 2 | 3 | 4 | 5;
export interface BoardItem { id: string; title: string; sub?: string | null }
export interface BoardColumn { phase: Phase; name: string; count: number; items: BoardItem[] }
export interface BoardStream { key: StreamKey; name: string; labelsOnly: boolean; waiting: BoardItem[]; columns: BoardColumn[] }
export type WorkerState = 'running' | 'waiting' | 'error' | 'idle';
export interface BoardWorker { id: string; key: string; name: string; domain: string; state: WorkerState; job: string | null; lastOutput: string | null; lastAt: string | null; trust: number | null; trust7: number | null; waiting: number }
export interface Board { workers: BoardWorker[]; streams: BoardStream[]; at: string }
export interface Label { id: string; label: string; phase: Phase }

export const STREAMS: { key: StreamKey; name: string; labelsOnly: boolean; phases: [string, string, string, string, string] }[] = [
  { key: 'madeby', name: 'Made by leads', labelsOnly: false, phases: ['Found', 'Drafted', 'Contacted', 'Talking', 'Client'] },
  { key: 'ecom', name: 'E-commerce products', labelsOnly: false, phases: ['Scouted', 'Pitched', 'Validate', 'Build', 'Live'] },
  { key: 'mostfit', name: 'MostFit', labelsOnly: true, phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'] },
  { key: 'side', name: 'Side hustles', labelsOnly: true, phases: ['Idea', 'Testing', 'Building', 'Selling', 'Running'] },
];
export const PHASES: Phase[] = [1, 2, 3, 4, 5];

/** Lead outreach status → Made by phase. Pure. */
export function outreachPhase(status: string): Phase | null {
  if (status === 'drafted' || status === 'approved') return 2;
  if (status === 'sent' || status === 'call_list') return 3;
  if (status === 'replied' || status === 'booked') return 4;
  return null; // closed, dnc, archived: off the board
}
/** Brand step (1–10) → E-commerce phase: steps 1–4 validate, 5–7 build, 8–10 live. Pure. */
export function brandPhase(step: number | null | undefined): Phase {
  const s = Number(step) || 1;
  return s <= 4 ? 3 : s <= 7 ? 4 : 5;
}
/** Approval domain → which room's "Waiting on you" it sits in. MostFit never gets one. Pure. */
export function streamOfDomain(domain: string): StreamKey {
  if (domain === 'ecom' || domain === 'ecommerce') return 'ecom';
  if (domain === 'marketing' || domain === 'madeby') return 'madeby';
  return 'side';
}
/** What a worker is doing right now. Pure. */
export function workerState(o: { running: boolean; waiting: number; lastStatus: string | null }): WorkerState {
  if (o.running) return 'running';
  if (o.waiting > 0) return 'waiting';
  if (o.lastStatus === 'failed') return 'error';
  return 'idle';
}
/** Keep only well-formed labels (typed by Marq, nothing else). Pure. */
export function cleanLabels(v: unknown): Label[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Label => !!x && typeof x === 'object' && typeof (x as Label).label === 'string' && (x as Label).label.trim().length > 0 && PHASES.includes(Number((x as Label).phase) as Phase))
    .slice(0, 40).map((x) => ({ id: String(x.id || x.label).slice(0, 60), label: x.label.trim().slice(0, 80), phase: Number(x.phase) as Phase }));
}
/** Build one stream's columns from items already tagged with a phase. Pure. */
export function columnsFor(key: StreamKey, tagged: { phase: Phase; item: BoardItem }[], counts: Partial<Record<Phase, number>> = {}, perColumn = 6): BoardColumn[] {
  const def = STREAMS.find((s) => s.key === key)!;
  return PHASES.map((p) => {
    const items = tagged.filter((t) => t.phase === p).map((t) => t.item);
    return { phase: p, name: def.phases[p - 1], count: Math.max(counts[p] ?? 0, items.length), items: items.slice(0, perColumn) };
  });
}
