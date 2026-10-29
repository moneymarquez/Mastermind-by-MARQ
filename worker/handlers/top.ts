// GET /api/orchestrator/top — Marq's five most important tasks across the
// whole app (Today's "Your line", the Classroom office). ~11 reads. Owner only.
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json, zonedNow } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { rankAllTasks } from '../../src/data/topTasks';
import type { TopTask } from '../../src/data/topTasks';

export async function topRoute(request: Request, env: SbEnv & { VITE_SUPABASE_ANON_KEY: string }): Promise<Response> {
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
  return json({ top: await buildTop(new Sb(env), user.id) });
}

export async function buildTop(sb: Sb, u: string, n = 5): Promise<TopTask[]> {
  const today = zonedNow('America/Denver').date;
  const soon = new Date(Date.parse(today) + 3 * 86400000).toISOString().slice(0, 10);
  const skip = () => [] as never[];
  const [outreach, checklist, clients, approvals, ci, bi, bills, tasks, reminders, flags, leads] = await Promise.all([
    sb.get<{ id: string; business_name: string; status: string; call_due_at: string | null; bump_due_at: string | null; bumped_at: string | null; phone: string | null }>(`lead_outreach?user_id=eq.${u}&archived_at=is.null&status=in.(replied,booked,sent,call_list)&select=id,business_name,status,call_due_at,bump_due_at,bumped_at,phone&limit=200`).catch(skip),
    sb.get<{ client_id: string; title: string; due: string | null }>(`client_checklist?user_id=eq.${u}&done=eq.false&owner=eq.marq&due=lte.${today}&select=client_id,title,due&order=due.asc&limit=30`).catch(skip),
    sb.get<{ id: string; business_name: string }>(`crm_clients?user_id=eq.${u}&select=id,business_name&limit=200`).catch(skip),
    sb.get<{ id: string; title: string; domain: string; type: string; is_money: boolean; amount_usd: number | null; created_at: string }>(`ai_approvals?user_id=eq.${u}&status=eq.pending&select=id,title,domain,type,is_money,amount_usd,created_at&order=created_at.asc&limit=100`).catch(skip),
    sb.get<{ id: string; amount: number; due_date: string | null; crm_clients: { business_name: string } | null }>(`client_invoices?user_id=eq.${u}&status=in.(sent,overdue)&due_date=lte.${today}&select=id,amount,due_date,crm_clients(business_name)&limit=20`).catch(skip),
    sb.get<{ id: string; to_name: string; amount_usd: number; due_date: string | null }>(`biz_invoices?user_id=eq.${u}&status=eq.sent&due_date=lte.${today}&select=id,to_name,amount_usd,due_date&limit=20`).catch(skip),
    sb.get<{ id: string; name: string; amount: number; next_occurrence: string }>(`budget_recurring?user_id=eq.${u}&active=eq.true&type=neq.income&next_occurrence=lte.${soon}&select=id,name,amount,next_occurrence&limit=20`).catch(skip),
    sb.get<{ id: string; title: string; due: string | null; priority: string | null; project: string | null }>(`tasks?user_id=eq.${u}&done=eq.false&or=(due.lte.${soon},priority.eq.high)&select=id,title,due,priority,project&limit=50`).catch(skip),
    sb.get<{ id: string; title: string; due_date: string }>(`reminders?user_id=eq.${u}&done=eq.false&due_date=lte.${soon}&select=id,title,due_date&limit=30`).catch(skip),
    // Approval flags just repeat approvals; everything else red is a real problem.
    sb.get<{ id: string; message: string; rule: string; link: string | null }>(`ai_flags?user_id=eq.${u}&resolved_at=is.null&severity=eq.red&rule=neq.approval_waiting&select=id,message,rule,link&limit=10`).catch(skip),
    sb.get<{ id: string; business_name: string; city: string | null; phone: string | null }>(`leads?archived_at=is.null&or=(status.is.null,status.eq.new)&phone=not.is.null&select=id,business_name,city,phone&order=fizzle_score.desc.nullslast&limit=${n}`).catch(skip),
  ]);
  const nameOf = new Map(clients.map((c) => [c.id, c.business_name]));
  return rankAllTasks({
    outreach,
    clientTasks: checklist.map((t) => ({ ...t, business_name: nameOf.get(t.client_id) ?? 'Client' })),
    approvals,
    invoices: [...ci.map((i) => ({ id: i.id, table: 'client_invoices' as const, who: i.crm_clients?.business_name ?? 'a client', amount: Number(i.amount), due_date: i.due_date })),
      ...bi.map((i) => ({ id: i.id, table: 'biz_invoices' as const, who: i.to_name, amount: Number(i.amount_usd), due_date: i.due_date }))],
    bills, tasks, reminders, flags, leads,
  }, today, n);
}
