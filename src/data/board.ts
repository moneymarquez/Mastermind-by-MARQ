// Orchestrator board (spec Part 5). Pure: the Worker builds the board with
// these, the Office and Classroom draw it. Phase 1–5 per workstream plus a
// "Waiting on you" column that's always shown first.

export type StreamKey = 'madeby' | 'ecom' | 'mostfit' | 'side';
export type Phase = 1 | 2 | 3 | 4 | 5;
export interface BoardItem { id: string; title: string; sub?: string | null; kind?: 'lead' | 'outreach' | 'client' | 'approval' | 'product' | 'brand' | 'label' }
export interface BoardColumn { phase: Phase; name: string; count: number; items: BoardItem[] }
export interface BoardStream { key: StreamKey; name: string; labelsOnly: boolean; waiting: BoardItem[]; columns: BoardColumn[]; top?: TopTask[] }
/** One of Marq's most important tasks, ranked. */
export interface TopTask extends BoardItem { rank: number; reason: string; score: number }
export type WorkerState = 'running' | 'waiting' | 'error' | 'idle';
export interface BoardWorker { id: string; key: string; name: string; domain: string; state: WorkerState; job: string | null; lastOutput: string | null; lastAt: string | null; trust: number | null; trust7: number | null; waiting: number }
export interface QueueItem { id: string; title: string; type: string; created_at: string }
/** One person in the Classroom line: a worker (or kind of task) with things waiting on Marq. */
export interface QueueEntry { key: string; name: string; domain: string; workerId: string | null; since: string; items: QueueItem[] }
export interface Board { workers: BoardWorker[]; streams: BoardStream[]; queue: QueueEntry[]; at: string }
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

/** Cards with no worker behind them still need a face in line. */
const TYPE_NAME: Record<string, string> = { sample_purchase: 'Sourcing', domain_purchase: 'Store Builder', supplier_order: 'Orders', invoice_reminder: 'Billing', playbook_rule: 'Playbooks' };
/** The Classroom line: one person per worker with something waiting on Marq,
 *  longest-waiting first. Pure. */
export function queueFrom(approvals: { id: string; worker_id: string | null; domain: string; type: string; title: string; created_at: string }[], workers: { id: string; key: string; name: string; domain: string }[]): QueueEntry[] {
  const by = new Map<string, QueueEntry>();
  for (const a of approvals) {
    const w = a.worker_id ? workers.find((x) => x.id === a.worker_id) : undefined;
    const key = w ? w.key : `type:${a.type}`;
    const e = by.get(key) ?? { key, name: w?.name ?? TYPE_NAME[a.type] ?? a.type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), domain: w?.domain ?? (a.domain === 'ecommerce' ? 'ecom' : a.domain), workerId: w?.id ?? null, since: a.created_at, items: [] };
    e.items.push({ id: a.id, title: a.title, type: a.type, created_at: a.created_at });
    if (a.created_at < e.since) e.since = a.created_at;
    by.set(key, e);
  }
  return [...by.values()].sort((a, b) => a.since.localeCompare(b.since));
}

export interface Step { text: string; when?: string | null; done?: boolean; owner?: string | null }
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);
/** What's next for one Made by person, in plain words. Pure. */
export function nextSteps(kind: 'lead' | 'outreach', row: Record<string, unknown>, now = new Date()): Step[] {
  const s = String(row.status ?? 'new');
  const due = (v: unknown) => { const d = day(v as string | null); return d ? (d <= now.toISOString().slice(0, 10) ? `due ${d} (now)` : `due ${d}`) : null; };
  if (kind === 'lead') {
    const out: Step[] = [];
    if (row.phone || row.owner_phone) out.push({ text: `Call ${row.owner_name ? String(row.owner_name) : 'the owner'}`, when: due(row.next_followup_at) });
    else out.push({ text: 'Find a phone number or owner email' });
    out.push({ text: 'Check the website problems found and pick the one to lead with' });
    if (Number(row.call_count ?? 0) > 0) out.push({ text: `Called ${row.call_count}× already`, done: true });
    return out;
  }
  if (s === 'drafted' || s === 'approved') return [{ text: s === 'drafted' ? 'Read and approve the cold email' : 'Email approved, sending next' }, { text: 'Call after it lands' }];
  if (s === 'sent') return [{ text: 'Follow-up email', when: due(row.bump_due_at), done: !!row.bumped_at }, { text: 'Call them', when: due(row.call_due_at) }];
  if (s === 'call_list') return [{ text: 'Call them', when: due(row.call_due_at) }, { text: 'Check in', when: due(row.next_checkin_at) }];
  if (s === 'replied') return [{ text: 'They replied: answer and book a call' }];
  if (s === 'booked') return [{ text: 'Call is booked: prep the audit before it' }];
  return [];
}

export interface TaskCandidate { id: string; kind: BoardItem['kind']; title: string; reason: string; score: number }
/** Rank what matters most for Made by right now. Replies and booked calls beat
 *  everything (money is closest), then overdue client work, calls due, cards
 *  waiting on you, follow-ups, and fresh leads to fill the line. Pure. */
export function rankTopTasks(c: {
  outreach: { id: string; business_name: string; status: string; call_due_at?: string | null; bump_due_at?: string | null; bumped_at?: string | null }[];
  clientTasks: { client_id: string; business_name: string; title: string; due: string | null }[];
  approvals: { id: string; title: string; created_at: string }[];
  leads: { id: string; business_name: string; city?: string | null }[];
}, today: string, n = 5): TopTask[] {
  const out: TaskCandidate[] = [];
  const daysLate = (d: string | null | undefined) => (d ? Math.max(0, Math.round((Date.parse(today) - Date.parse(d.slice(0, 10))) / 86400000)) : 0);
  for (const o of c.outreach) {
    if (o.status === 'replied') out.push({ id: o.id, kind: 'outreach', title: `Reply to ${o.business_name}`, reason: 'They replied: closest to money', score: 100 });
    else if (o.status === 'booked') out.push({ id: o.id, kind: 'outreach', title: `Prep for ${o.business_name}`, reason: 'Call is booked', score: 92 });
    else if ((o.status === 'sent' || o.status === 'call_list') && o.call_due_at && o.call_due_at.slice(0, 10) <= today) out.push({ id: o.id, kind: 'outreach', title: `Call ${o.business_name}`, reason: daysLate(o.call_due_at) ? `Call was due ${daysLate(o.call_due_at)}d ago` : 'Call due today', score: 70 + Math.min(10, daysLate(o.call_due_at)) });
    else if (o.status === 'sent' && !o.bumped_at && o.bump_due_at && o.bump_due_at.slice(0, 10) <= today) out.push({ id: o.id, kind: 'outreach', title: `Follow up with ${o.business_name}`, reason: 'Follow-up email due', score: 50 });
  }
  for (const t of c.clientTasks) if (t.due && t.due <= today) out.push({ id: t.client_id, kind: 'client', title: `${t.business_name}: ${t.title}`, reason: daysLate(t.due) ? `Client task ${daysLate(t.due)}d late` : 'Client task due today', score: 80 + Math.min(10, daysLate(t.due)) });
  for (const a of c.approvals) out.push({ id: a.id, kind: 'approval', title: a.title, reason: 'Waiting on your OK', score: 60 + Math.min(8, daysLate(a.created_at)) });
  for (const l of c.leads) out.push({ id: l.id, kind: 'lead', title: `Call ${l.business_name}`, reason: `New lead${l.city ? ` in ${l.city}` : ''}`, score: 20 });
  const seen = new Set<string>();
  return out.sort((a, b) => b.score - a.score).filter((x) => { const k = `${x.kind}:${x.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n).map((x, i) => ({ id: x.id, kind: x.kind, title: x.title, sub: x.reason, reason: x.reason, score: x.score, rank: i + 1 }));
}
