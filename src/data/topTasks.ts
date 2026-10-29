// Marq's most important tasks across all of Masterminds, ranked. Pure: the
// Worker gathers the rows, this decides the order. Closest-to-money first.

export type TopKind = 'outreach' | 'lead' | 'client' | 'approval' | 'invoice' | 'bill' | 'task' | 'reminder' | 'flag';
export interface TopTask { id: string; kind: TopKind; title: string; reason: string; score: number; rank: number; area: string; screen: string; sub?: string; is_money?: boolean; type?: string; table?: string; phone?: string | null }

export interface TopInputs {
  outreach?: { id: string; business_name: string; status: string; call_due_at?: string | null; bump_due_at?: string | null; bumped_at?: string | null; phone?: string | null }[];
  clientTasks?: { client_id: string; business_name: string; title: string; due: string | null }[];
  approvals?: { id: string; title: string; domain: string; type: string; is_money?: boolean; amount_usd?: number | null; created_at: string }[];
  invoices?: { id: string; table: 'client_invoices' | 'biz_invoices'; who: string; amount: number; due_date: string | null }[];
  bills?: { id: string; name: string; amount: number; next_occurrence: string }[];
  tasks?: { id: string; title: string; due: string | null; priority: string | null; project?: string | null }[];
  reminders?: { id: string; title: string; due_date: string }[];
  flags?: { id: string; message: string; rule: string; link?: string | null }[];
  leads?: { id: string; business_name: string; city?: string | null; phone?: string | null }[];
}

const AREA: Record<string, string> = { ecom: 'E-commerce', ecommerce: 'E-commerce', marketing: 'Made by', madeby: 'Made by', content: 'Content', master: 'HQ', all: 'HQ', digest: 'HQ' };
const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** Rank everything that wants Marq's attention; keep the top `n`. Pure. */
export function rankAllTasks(c: TopInputs, today: string, n = 5): TopTask[] {
  const out: Omit<TopTask, 'rank'>[] = [];
  const late = (d: string | null | undefined) => (d ? Math.max(0, Math.round((Date.parse(today) - Date.parse(d.slice(0, 10))) / 86400000)) : 0);
  const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
  const in3 = new Date(Date.parse(today) + 3 * 86400000).toISOString().slice(0, 10);

  for (const o of c.outreach ?? []) {
    const base = { id: o.id, kind: 'outreach' as const, area: 'Made by', screen: 'lead-engines', phone: o.phone ?? null };
    if (o.status === 'replied') out.push({ ...base, title: `Reply to ${o.business_name}`, reason: 'They replied: closest to money', score: 100 });
    else if (o.status === 'booked') out.push({ ...base, title: `Prep for your call with ${o.business_name}`, reason: 'Call is booked', score: 92 });
    else if ((o.status === 'sent' || o.status === 'call_list') && o.call_due_at && o.call_due_at.slice(0, 10) <= today) out.push({ ...base, title: `Call ${o.business_name}`, reason: late(o.call_due_at) ? `Call was due ${late(o.call_due_at)}d ago` : 'Call due today', score: 70 + Math.min(10, late(o.call_due_at)) });
    else if (o.status === 'sent' && !o.bumped_at && o.bump_due_at && o.bump_due_at.slice(0, 10) <= today) out.push({ ...base, title: `Follow up with ${o.business_name}`, reason: 'Follow-up email due', score: 50 });
  }
  for (const i of c.invoices ?? []) if (i.due_date && i.due_date <= today) out.push({ id: i.id, kind: 'invoice', table: i.table, area: 'Money', screen: i.table === 'biz_invoices' ? 'ledger' : 'invoicing', title: `Chase ${money(i.amount)} from ${i.who}`, reason: late(i.due_date) ? `Invoice ${late(i.due_date)}d overdue` : 'Invoice due today', score: 86 + Math.min(8, late(i.due_date)) });
  for (const b of c.bills ?? []) if (b.next_occurrence <= in3) out.push({ id: b.id, kind: 'bill', area: 'Money', screen: 'budgeting', title: `Pay ${b.name} (${money(b.amount)})`, reason: b.next_occurrence < today ? `${late(b.next_occurrence)}d overdue` : b.next_occurrence === today ? 'Due today' : `Due ${b.next_occurrence}`, score: b.next_occurrence <= today ? 84 + Math.min(8, late(b.next_occurrence)) : 66 });
  for (const t of c.clientTasks ?? []) if (t.due && t.due <= today) out.push({ id: t.client_id, kind: 'client', area: 'Made by', screen: 'client-crm', title: `${t.business_name}: ${t.title}`, reason: late(t.due) ? `Client task ${late(t.due)}d late` : 'Client task due today', score: 80 + Math.min(10, late(t.due)) });
  for (const a of c.approvals ?? []) out.push({ id: a.id, kind: 'approval', type: a.type, is_money: !!a.is_money, area: AREA[a.domain] ?? 'HQ', screen: a.domain === 'ecom' || a.domain === 'ecommerce' ? 'ecom-approvals' : 'today', title: a.title, reason: a.is_money ? `Spends ${a.amount_usd ? `~${money(Number(a.amount_usd))}` : 'money'}: your call` : 'Waiting on your OK', score: (a.is_money ? 82 : 58) + Math.min(8, late(a.created_at)) });
  for (const t of c.tasks ?? []) {
    const hi = t.priority === 'high';
    if (t.due && t.due <= today) out.push({ id: t.id, kind: 'task', area: t.project ?? 'Tasks', screen: 'tasks', title: t.title, reason: late(t.due) ? `${late(t.due)}d overdue` : 'Due today', score: 78 + (hi ? 6 : 0) + Math.min(8, late(t.due)) });
    else if (t.due === tomorrow || (hi && !t.due)) out.push({ id: t.id, kind: 'task', area: t.project ?? 'Tasks', screen: 'tasks', title: t.title, reason: hi ? 'High priority' : 'Due tomorrow', score: hi ? 64 : 56 });
  }
  for (const r of c.reminders ?? []) if (r.due_date <= tomorrow) out.push({ id: r.id, kind: 'reminder', area: 'Personal', screen: 'home', title: r.title, reason: r.due_date < today ? `${late(r.due_date)}d overdue` : r.due_date === today ? 'Today' : 'Tomorrow', score: r.due_date <= today ? 76 + Math.min(6, late(r.due_date)) : 54 });
  for (const f of c.flags ?? []) out.push({ id: f.id, kind: 'flag', area: 'HQ', screen: f.link || 'hq', title: f.message.split('\n')[0].slice(0, 90), reason: 'Something is broken', score: 66 });
  for (const l of c.leads ?? []) out.push({ id: l.id, kind: 'lead', area: 'Made by', screen: 'leadflow', title: `Call ${l.business_name}`, reason: `New lead${l.city ? ` in ${l.city}` : ''}`, score: 20, phone: l.phone ?? null });

  const seen = new Set<string>();
  return out.sort((a, b) => b.score - a.score)
    .filter((x) => { const k = `${x.kind}:${x.id}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, n).map((x, i) => ({ ...x, sub: x.reason, rank: i + 1 }));
}
