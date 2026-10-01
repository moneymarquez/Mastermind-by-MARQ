import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useApprovals } from '../../../data/useEcom';
import { assignTask } from '../../../data/useOffice';
import { money } from '../../../data/ecom';
import ApprovalsTab from './ApprovalsTab';
import { E, Badge, Drawer, TeachingEmpty, btn, field } from './ecomShared';

/** The shared right-hand side of every engine module's top bar (Appendix
 *  2 §2, Appendix 3 §2): 🔔 alerts · 💲 cost · approvals · ＋ Command —
 *  scoped to one domain, same engine tables as E-commerce. */
export default function EngineBar({ domain, onDecided }: { domain: 'content' | 'marketing'; onDecided?: () => void }) {
  const ap = useApprovals();
  const [open, setOpen] = useState<'alerts' | 'cost' | 'approvals' | 'command' | null>(null);
  const [spend, setSpend] = useState<{ today: number; month: number; cap: number }>({ today: 0, month: 0, cap: 1 });
  const [cmd, setCmd] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const alerts = ap.alerts.filter((a) => a.domain === domain);
  const unread = alerts.filter((a) => !a.read_at).length;
  const pending = ap.approvals.filter((a) => a.domain === domain && a.status === 'pending').length;
  const scoped = { ...ap, approvals: ap.approvals.filter((a) => a.domain === domain) };

  useEffect(() => {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    Promise.all([
      supabase.from('ai_cost_ledger').select('date,cost_usd').eq('domain', domain).gte('date', day.slice(0, 8) + '01'),
      supabase.from('ai_domain_caps').select('daily_cap_usd').eq('domain', domain).maybeSingle(),
    ]).then(([l, c]) => {
      const rows = (l.data ?? []) as { date: string; cost_usd: number }[];
      setSpend({ today: rows.filter((r) => r.date === day).reduce((s, r) => s + Number(r.cost_usd), 0), month: rows.reduce((s, r) => s + Number(r.cost_usd), 0), cap: Number((c.data as { daily_cap_usd?: number } | null)?.daily_cap_usd ?? 1) });
    });
  }, [domain, open]);

  const dot = (n: number, color: string) => n > 0 ? <span style={{ marginLeft: 4, minWidth: 16, height: 16, borderRadius: 8, background: color, color: E.onAccent, fontSize: 10.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{n}</span> : null;
  const send = async () => { setBusy(true); setReply(''); const r = await assignTask(domain, cmd.trim()); setBusy(false); setReply(r.error ?? r.reply ?? 'Sent.'); if (!r.error) setCmd(''); };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={() => { void ap.reload(); setOpen('alerts'); }} title="Alerts">🔔{dot(unread, E.red)}</button>
        <button style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={() => setOpen('cost')} title="Cost"><span>💲</span><span style={{ fontFamily: 'var(--font-mono)' }}>{money(spend.today)}</span></button>
        <button style={{ ...btn('ghost'), padding: '6px 10px' }} onClick={() => { void ap.reload(); setOpen('approvals'); }}>Approvals{dot(pending, E.amber)}</button>
        <button style={{ ...btn('primary'), padding: '6px 12px' }} onClick={() => setOpen('command')}>＋ Command</button>
      </div>
      <Drawer open={open === 'alerts'} onClose={() => setOpen(null)} title="Alerts" subtitle="Only things that need a human." width={440}>
        {alerts.length === 0 ? <TeachingEmpty what="No alerts." worker="the orchestrator and workers — failures, cost cap hits, breakouts and flops" /> : alerts.map((a) => (
          <div key={a.id} style={{ ...E.card, padding: 12, marginBottom: 8, opacity: a.read_at ? 0.6 : 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge color={a.severity === 'urgent' ? E.red : a.severity === 'warn' ? E.amber : E.blue}>{a.severity}</Badge>
              <span style={{ fontWeight: 600, color: E.text, flex: 1 }}>{a.title}</span>
              {!a.read_at && <button style={{ ...btn('ghost'), padding: '4px 8px', fontSize: 12 }} onClick={() => ap.markAlertRead(a.id)}>Read</button>}
            </div>
            {a.body && <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4 }}>{a.body}</div>}
          </div>
        ))}
      </Drawer>
      <Drawer open={open === 'cost'} onClose={() => setOpen(null)} title="Cost" subtitle={`${domain} · cap ${money(spend.cap)} a day — workers stop when it's hit`} width={420}>
        <div style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: E.muted }}>Today</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{money(spend.today)} / {money(spend.cap)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: E.muted }}>Month to date</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{money(spend.month)}</span></div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Change the cap in Setup → Start the company.</div>
        </div>
      </Drawer>
      <Drawer open={open === 'approvals'} onClose={() => setOpen(null)} title="Approvals" subtitle={`Waiting on you in ${domain}`} width={620}>
        <ApprovalsTab api={scoped} onDecided={onDecided} />
      </Drawer>
      <Drawer open={open === 'command'} onClose={() => setOpen(null)} title="＋ Command" subtitle="Type anything; the orchestrator turns it into a task for the right worker." width={520}>
        <textarea style={{ ...field, minHeight: 90, resize: 'vertical' }} value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={domain === 'content' ? '"make 5 Reels for Mastermind this week about the morning text"' : '"plan next week\'s calls for single-location food trucks"'} />
        <button style={{ ...btn('primary'), marginTop: 8 }} disabled={busy || !cmd.trim()} onClick={send}>{busy ? 'Routing…' : 'Send'}</button>
        {reply && <div style={{ fontSize: 'var(--text-body)', color: E.text, marginTop: 10 }}>{reply}</div>}
        <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 10, lineHeight: 1.5 }}>Workers that aren't built yet keep the task waiting until they are; it shows in View Office under the orchestrator's delegations.</div>
      </Drawer>
    </>
  );
}
