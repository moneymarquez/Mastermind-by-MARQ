import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { moneyBoard, sortApprovals, weekStart } from './todayMath';
import type { Board } from './todayMath';
import { dateStr } from './time';

export interface TodayApproval { id: string; domain: string; type: string; title: string; status: string; is_money: boolean | null; amount_usd: number | null; created_at: string }
export interface TodayFlag { id: string; domain: string; severity: 'red' | 'amber'; rule: string; message: string; link: string | null; opened_at: string }
export interface TodayPost { id: string; concept: string | null; caption: string | null; format: string | null; scheduled_time: string | null; status: string }

/** Everything the Today screen shows, loaded in one round of parallel reads.
 *  Each read fails soft (an empty list), so one missing table never blanks the page. */
export function useToday() {
  const [approvals, setApprovals] = useState<TodayApproval[]>([]);
  const [flags, setFlags] = useState<TodayFlag[]>([]);
  const [posts, setPosts] = useState<TodayPost[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  // Client Finder's overnight work: businesses with a website problem, last 14 hours.
  const [overnight, setOvernight] = useState<{ places: number; noSite: number }>({ places: 0, noSite: 0 });

  const load = useCallback(async () => {
    const today = dateStr(new Date());
    const week = weekStart(new Date());
    const weekIso = new Date(`${week}T00:00:00`).toISOString();
    const [a, f, p, o, i, l, s] = await Promise.all([
      supabase.from('ai_approvals').select('id,domain,type,title,status,is_money,amount_usd,created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
      supabase.from('ai_flags').select('id,domain,severity,rule,message,link,opened_at').is('resolved_at', null).eq('severity', 'red').order('opened_at', { ascending: false }).limit(5),
      supabase.from('content_items').select('id,concept,caption,format,scheduled_time,status').eq('scheduled_for', today).neq('status', 'posted').order('scheduled_time', { ascending: true }).limit(10),
      supabase.from('ecom_orders').select('total').gte('placed_at', weekIso),
      supabase.from('client_invoices').select('amount').eq('status', 'paid').gte('paid_at', weekIso),
      supabase.from('biz_ledger').select('amount_usd,auto').eq('kind', 'income').gte('date', week),
      supabase.from('ai_cost_ledger').select('domain,cost_usd').gte('date', week),
    ]);
    setApprovals(sortApprovals((a.data ?? []) as TodayApproval[]));
    setFlags((f.data ?? []) as TodayFlag[]);
    setPosts((p.data ?? []) as TodayPost[]);
    setBoard(moneyBoard({ orders: (o.data ?? []) as never[], invoices: (i.data ?? []) as never[], ledgerIncome: (l.data ?? []) as never[], spend: (s.data ?? []) as never[] }));
    const since = new Date(Date.now() - 14 * 3600000).toISOString();
    const gf = await supabase.from('lead_findings').select('place_id,kind').neq('kind', 'checked').gte('created_at', since).limit(5000);
    const rows = (gf.data ?? []) as { place_id: string; kind: string }[];
    setOvernight({ places: new Set(rows.map((r) => r.place_id)).size, noSite: new Set(rows.filter((r) => r.kind === 'no_website').map((r) => r.place_id)).size });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { approvals, flags, posts, board, overnight, loading, reload: load };
}
