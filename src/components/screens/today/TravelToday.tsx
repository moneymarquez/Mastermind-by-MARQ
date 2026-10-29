import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import Chip from '../../mm/Chip';
import { useModule } from '../../mm/Page';
import { useCallsToday } from '../../../data/useCallsToday';
import { dateStr } from '../../../data/time';

/** Today in travel mode (spec Part 2): only production and health.
 *  Today's call list (target 10), products waiting on you, unpaid invoices,
 *  today's workout and macros. */
const CALL_TARGET = 10;
interface Lead { id: string; business_name: string; phone: string | null; owner_phone: string | null; city: string | null; industry: string | null; fizzle_score: number | null }
interface Invoice { id: string; description: string | null; amount: number | null; due_date: string | null; status: string; invoice_number: string | null }
const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function TravelToday() {
  const { device, nav } = useModule();
  const phone = device === 'phone';
  const { callsToday } = useCallsToday();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<{ id: string; title: string }[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workouts, setWorkouts] = useState<{ today: number; last: string | null }>({ today: 0, last: null });
  const [macros, setMacros] = useState<{ cal: number; protein: number; tCal: number | null; tProtein: number | null }>({ cal: 0, protein: 0, tCal: null, tProtein: null });

  useEffect(() => {
    const today = dateStr(new Date());
    void (async () => {
      const [l, p, inv, w, m, t] = await Promise.all([
        supabase.from('leads').select('id,business_name,phone,owner_phone,city,industry,fizzle_score').is('archived_at', null).or('status.is.null,status.eq.new').not('phone', 'is', null).order('fizzle_score', { ascending: false, nullsFirst: false }).limit(CALL_TARGET),
        supabase.from('ai_approvals').select('id,title').eq('status', 'pending').eq('domain', 'ecom').order('created_at', { ascending: true }).limit(20),
        supabase.from('client_invoices').select('id,description,amount,due_date,status,invoice_number').not('status', 'in', '(paid,void,draft)').order('due_date', { ascending: true }).limit(20),
        supabase.from('fitness_workouts').select('workout_date').order('workout_date', { ascending: false }).limit(30),
        supabase.from('meals').select('calories,protein_g').eq('meal_date', today),
        supabase.from('nutrition_targets').select('daily_calories,daily_protein_g').eq('active', true).limit(1).maybeSingle(),
      ]);
      setLeads((l.data ?? []) as Lead[]);
      setProducts((p.data ?? []) as { id: string; title: string }[]);
      setInvoices((inv.data ?? []) as Invoice[]);
      const wd = ((w.data ?? []) as { workout_date: string }[]).map((x) => x.workout_date);
      setWorkouts({ today: wd.filter((d) => d === today).length, last: wd[0] ?? null });
      const meals = (m.data ?? []) as { calories: number | null; protein_g: number | null }[];
      const tt = t.data as { daily_calories: number | null; daily_protein_g: number | null } | null;
      setMacros({ cal: meals.reduce((s, x) => s + Number(x.calories ?? 0), 0), protein: meals.reduce((s, x) => s + Number(x.protein_g ?? 0), 0), tCal: tt?.daily_calories ?? null, tProtein: tt?.daily_protein_g ?? null });
    })();
  }, []);

  const today = dateStr(new Date());
  const overdue = invoices.filter((i) => i.due_date && i.due_date < today);
  const owed = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const callsLeft = Math.max(0, CALL_TARGET - callsToday);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr 1fr' : 'repeat(4,minmax(0,1fr))', gap: 12 }}>
        <Stat hero label="Calls today" value={`${callsToday} / ${CALL_TARGET}`} pill={callsLeft ? `${callsLeft} to go` : 'Goal hit'} onClick={() => nav('leadflow')} />
        <Stat label="Products waiting" value={String(products.length)} pill="Approve" k={products.length ? 'warn' : 'neutral'} onClick={() => nav('ecom-products')} />
        <Stat label="Unpaid invoices" value={usd(owed)} pill={overdue.length ? `${overdue.length} overdue` : `${invoices.length} open`} k={overdue.length ? 'bad' : 'neutral'} onClick={() => nav('invoicing')} />
        <Stat label="Workout" value={workouts.today ? 'Done' : 'Not yet'} pill={workouts.last ? `last ${workouts.last}` : 'none logged'} k={workouts.today ? 'good' : 'warn'} onClick={() => nav('fitness')} />
      </div>

      <Card title="Call list" meta={`${leads.length} ready`} action={<button className="mm-btn mm-btn--primary" style={{ height: 34 }} onClick={() => nav('leadflow')}>Open LeadFlow</button>}>
        {leads.length === 0 ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No uncalled leads with a phone. Run Find leads in LeadFlow (Kansas City is the default).</span> : leads.map((l) => {
          const tel = l.owner_phone || l.phone;
          return (
            <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.business_name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{[l.industry, l.city, l.owner_phone ? 'owner line' : null].filter(Boolean).join(' · ')}</div>
              </div>
              {tel && <a className="mm-btn" style={{ height: 34, textDecoration: 'none' }} href={`tel:${tel.replace(/[^\d+]/g, '')}`}>Call</a>}
            </div>
          );
        })}
      </Card>

      {products.length > 0 && (
        <Card title="Products waiting on you" meta={String(products.length)} action={<button className="mm-btn" style={{ height: 32 }} onClick={() => nav('ecom-products')}>Review</button>}>
          {products.slice(0, 5).map((p) => <div key={p.id} style={{ fontSize: 14, padding: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>)}
        </Card>
      )}

      <Card title="Invoices" meta={invoices.length ? `${usd(owed)} open` : 'All paid'} action={<button className="mm-btn" style={{ height: 32 }} onClick={() => nav('invoicing')}>Invoicing</button>}>
        {invoices.length === 0 ? <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing unpaid.</span> : invoices.slice(0, 6).map((i) => (
          <div key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.invoice_number ? `#${i.invoice_number} ` : ''}{i.description ?? 'Invoice'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{usd(Number(i.amount ?? 0))}</span>
            {i.due_date && <Chip k={i.due_date < today ? 'bad' : 'neutral'}>{i.due_date < today ? 'overdue' : `due ${i.due_date}`}</Chip>}
          </div>
        ))}
      </Card>

      <Card title="Macros today" action={<button className="mm-btn" style={{ height: 32 }} onClick={() => nav('macros')}>Log a meal</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div><div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(macros.cal)}</div><div style={{ color: 'var(--text-tertiary)' }}>calories{macros.tCal ? ` of ${macros.tCal}` : ''}</div></div>
          <div><div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(macros.protein)}g</div><div style={{ color: 'var(--text-tertiary)' }}>protein{macros.tProtein ? ` of ${macros.tProtein}g` : ''}</div></div>
        </div>
      </Card>
    </>
  );
}
