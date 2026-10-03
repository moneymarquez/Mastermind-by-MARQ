import { useEffect, useMemo, useState } from 'react';
import { useContacts } from '../../../data/useContacts';
import { useCallOutcomes } from '../../../data/useCallOutcomes';
import { useDailyCallGoal } from '../../../data/useDailyCallGoal';
import { usePitch } from '../../../data/usePitch';
import { useDialingQueue } from '../../../data/useLeadflow';
import { dialStreak } from '../../../data/dialStreak';
import { dateStr } from '../../../data/time';
import type { CallOutcomeType, Contact, DialingContactDetails } from '../../../data/types';
import { CALL_OUTCOME_LABEL } from '../../../data/types';
import ContactFormModal from '../ContactFormModal';
import LeadCard from '../leadflow/LeadCard';
import { countCalledToday, sortDialingQueue } from '../leadflow/leadFilters';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import type { ChipKind } from '../../mm/Chip';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Bars, Donut } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, useModule, area } from '../../mm/Page';
import { dialStats } from './math';
import { addDays, initials, parseYmd, WD3 } from './util';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const OUTCOME_BTNS: { o: CallOutcomeType; t: string; primary?: boolean }[] = [
  { o: 'appointment_set', t: 'Booked meeting', primary: true }, { o: 'call_back_later', t: 'Call back' },
  { o: 'not_interested', t: 'Not interested' }, { o: 'voicemail', t: 'Voicemail' },
  { o: 'no_answer', t: 'No answer' }, { o: 'not_qualified', t: 'Not qualified' },
];

export default function DialingV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const { contacts, upsertContact } = useContacts();
  const dialing = useMemo(() => contacts.filter((c) => c.source === 'dialing'), [contacts]);
  const O = useCallOutcomes(dialing);
  const goal = useDailyCallGoal();
  const { pitchText, loading: pitchLoading, savePitch } = usePitch();
  const leadQueue = useDialingQueue();
  const [adding, setAdding] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [view, setView] = useState<'pitch' | 'history' | 'leads' | null>(null);
  const [openLead, setOpenLead] = useState<string | null>(null);
  const today = dateStr(new Date());

  const queued = sortDialingQueue(leadQueue.queue);
  const leadsLeft = queued.filter((l) => !l.status || l.status === 'new').length;
  const leadCalls = countCalledToday(leadQueue.queue);
  const calls = O.todayCount + leadCalls;
  const streak = dialStreak(O.history, goal, today, calls);
  const st = dialStats(O.completedToday.map((c) => c.outcome));
  const pct = goal ? Math.min(100, (calls / goal) * 100) : 0;
  // Pace by the clock: where you should be if the goal is spread 9 AM to 6 PM.
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
  const dayFrac = Math.max(0, Math.min(1, (h - 9) / 9));
  const expected = Math.round(goal * dayFrac);
  const paceChip: { c: string; k: ChipKind } = calls >= goal ? { c: 'Goal hit', k: 'good' } : calls >= expected ? { c: 'On pace', k: 'good' } : { c: `Behind by ${expected - calls}`, k: 'warn' };
  const callbacks = O.activeQueue.filter((c) => O.latestByContact.get(c.id)?.outcome === 'call_back_later');
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const perDay = week.map((d) => (d === today ? calls : O.history.find((x) => x.date === d)?.total ?? 0));

  const chipFor = (c: Contact): { c: string; k: ChipKind } => {
    const l = O.latestByContact.get(c.id);
    const appt = (c.details as Partial<DialingContactDetails>).appointment_at;
    if (l?.outcome === 'call_back_later') return { c: 'Callback due', k: 'warn' };
    if (appt) return { c: `Appt ${new Date(appt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, k: 'accent' };
    if (!l) return { c: 'New', k: 'accent' };
    return { c: `Last: ${CALL_OUTCOME_LABEL[l.outcome]}`, k: 'neutral' };
  };
  const calling = O.activeQueue.find((c) => c.id === callId) ?? dialing.find((c) => c.id === callId) ?? null;
  const log = async (c: Contact, o: CallOutcomeType) => {
    const idx = O.activeQueue.findIndex((x) => x.id === c.id);
    await O.logOutcome(c.id, o);
    const next = O.activeQueue.filter((x) => x.id !== c.id)[Math.max(0, idx)];
    setCallId(next?.id ?? null);
  };
  const menu = [
    { t: 'Add contact', onClick: () => setAdding(true) },
    { t: 'Your pitch', onClick: () => setView('pitch') },
    { t: 'Call history', onClick: () => setView('history') },
  ];

  const hero = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Calls today</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: 'var(--text)', fontSize: 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{calls}<span style={{ fontSize: 20, color: 'var(--text-tertiary)', letterSpacing: '-0.02em' }}>of {goal} goal</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip k={paceChip.k}>{paceChip.c}</Chip>
        <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>{leadCalls ? `${leadCalls} from the lead queue` : ''}{leadCalls && streak >= 3 ? ' · ' : ''}{streak >= 3 ? `${streak}-day streak` : ''}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', marginTop: 'auto' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} /></div>
      {O.activeQueue.length > 0 && <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} onClick={() => setCallId(O.activeQueue[0].id)}>Start dialing</button>}
    </section>
  );
  const stats = [
    <Stat key="ph" label="Calls per hour" value={st.perHour != null ? String(st.perHour) : '—'} pill={st.perHour != null ? 'Today' : 'After 2 calls'} />,
    <Stat key="cr" label="Connect rate" value={st.n ? `${st.connectPct}%` : '—'} pill={`${st.reached} of ${st.n}`} />,
    <Stat key="bk" label="Booked" value={String(st.booked)} pill="Meetings today" k={st.booked ? 'good' : 'neutral'} />,
    <Stat key="cb" label="Callbacks due" value={String(callbacks.length)} pill={callbacks.length ? 'In your queue' : 'None'} k={callbacks.length ? 'warn' : 'neutral'} />,
  ];
  const outcomes = st.n > 0 && <Card title="Outcomes" meta="Today" wide={!phone}><Donut rows={st.donut} pre="" center={`${st.n} calls`} /></Card>;
  const bars = perDay.some(Boolean) && <Card title="Calls per day" meta="Last 7 days" wide={!phone}><Bars vals={perDay} labels={week.map((d, i) => (i === 6 ? 'Today' : WD3[parseYmd(d).getDay()]))} pre="" /></Card>;
  const upNext = (
    <Card title="Up next" meta={`${O.activeQueue.length} in queue`} flush wide={!phone}>
      {O.activeQueue.length ? <div>{O.activeQueue.slice(0, phone ? 6 : 8).map((c, i) => { const ch = chipFor(c); return <Row key={c.id} first={i === 0} av={initials(c.business_name || c.name)} square name={c.business_name || c.name} meta={c.business_name ? c.name : undefined} chip={ch.c} k={ch.k} amt={phone ? undefined : <span style={{ fontSize: 13, fontWeight: 500 }}>{c.phone ?? ''}</span>} onClick={() => setCallId(c.id)} />; })}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Queue's clear for today. Add contacts to keep going toward {goal}.</div>}
    </Card>
  );
  const done = O.completedToday.length > 0 && (
    <Card title="Logged today" meta={`${O.completedToday.length}`} flush wide={!phone}>
      <div>{O.completedToday.slice(0, 6).map(({ outcome, contact }, i) => (
        <Row key={outcome.id} first={i === 0} name={contact?.business_name || contact?.name || 'Contact'} meta={clock(outcome.logged_at)} chip={CALL_OUTCOME_LABEL[outcome.outcome]} k={outcome.outcome === 'appointment_set' ? 'good' : 'neutral'}
          sub={<button onClick={() => void O.undoOutcome(outcome.id)} style={{ border: 0, background: 'transparent', padding: 0, color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Undo</button>} />
      ))}</div>
    </Card>
  );
  const leads = queued.length > 0 && (
    <Card title="Lead queue" meta={`${leadsLeft} to call`} wide={!phone}>
      <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Leads sent over from LeadFlow. Calls here count toward today's goal.</span>
      <button className="mm-btn" onClick={() => setView('leads')}>Open lead queue</button>
    </Card>
  );

  const empty = !O.loading && dialing.length === 0 && queued.length === 0;
  return (
    <Page title="Dialing" sub={`Today · goal ${goal}`} menu={menu} fab={{ t: 'Contact', onClick: () => setAdding(true) }}>
      {empty ? <Empty text="Your call queue is empty. Add contacts or pull new leads in to start a session." cta="Add a contact" onCta={() => setAdding(true)} /> : phone ? (
        <>{hero}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{stats[0]}{stats[1]}</div>{upNext}{leads}{outcomes}{bars}{done}</>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? 'minmax(0,1.35fr) minmax(0,1fr)' : 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16 }}>
            {hero}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ gridColumn: three ? 'span 2' : 'auto', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{upNext}{done}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{leads}{outcomes}{bars}</div>
          </div>
        </>
      )}
      {calling && <CallSheet c={calling} chip={chipFor(calling)} onClose={() => setCallId(null)} onLog={(o) => void log(calling, o)} left={O.activeQueue.length} pitch={pitchText} />}
      {adding && <ContactFormModal onSave={upsertContact} onClose={() => setAdding(false)} />}
      {view === 'pitch' && <PitchSheet text={pitchText} loading={pitchLoading} save={savePitch} onClose={() => setView(null)} />}
      {view === 'history' && (
        <Sheet title="Call history" onClose={() => setView(null)} full>
          {O.history.length ? O.history.map((d, i) => <Row key={d.date} first={i === 0} name={parseYmd(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} meta={Object.entries(d.breakdown).map(([o, n]) => `${CALL_OUTCOME_LABEL[o as CallOutcomeType]} ${n}`).join(' · ')} amt={`${d.total}`} sub="calls" />)
            : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>No calls logged yet.</span>}
        </Sheet>
      )}
      {view === 'leads' && (
        <Sheet title={`Lead queue · ${leadsLeft} to call`} onClose={() => setView(null)} full>
          {queued.map((lead) => (
            <LeadCard key={lead.id} lead={lead} skin="mastermind" open={openLead === lead.id} onToggle={() => setOpenLead(openLead === lead.id ? null : lead.id)} onPatch={leadQueue.patchLead} onLogCall={leadQueue.logCall}
              actions={<button className="mm-btn" style={{ height: 34 }} title="Take off today's list. The lead stays in the pool." onClick={() => leadQueue.removeFromQueue(lead.id)}>Skip</button>} />
          ))}
          {queued.some((l) => l.status && l.status !== 'new') && <button className="mm-btn" onClick={() => void leadQueue.clearQueue(queued.filter((l) => l.status && l.status !== 'new'))}>Clear finished</button>}
        </Sheet>
      )}
    </Page>
  );
}

function CallSheet({ c, chip, onClose, onLog, left, pitch }: { c: Contact; chip: { c: string; k: ChipKind }; onClose: () => void; onLog: (o: CallOutcomeType) => void; left: number; pitch: string }) {
  const [start, setStart] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setStart(Date.now()); }, [c.id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const appt = (c.details as Partial<DialingContactDetails>).appointment_at;
  return (
    <Sheet title={`${left} left in queue`} onClose={onClose} full>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0 4px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontSize: 22, fontWeight: 600 }}>{initials(c.name)}</div>
        <span style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.035em' }}>{c.name}</span>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{[c.business_name, c.phone].filter(Boolean).join(' · ')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}><Chip k={chip.k}>{chip.c}</Chip><span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{mmss((now - start) / 1000)}</span></div>
      </div>
      {c.phone && <a className="mm-btn mm-btn--primary" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} style={{ height: 52, fontSize: 16, textDecoration: 'none' }}>Call {c.phone}</a>}
      {(c.notes || appt) && <Card title="Notes for this call" meta="From Contacts">{appt && <span style={{ fontSize: 14, color: 'var(--text)' }}>Appointment: {new Date(appt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}{c.notes && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{c.notes}</p>}</Card>}
      {pitch.trim() && <details style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}><summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Your pitch</summary><p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{pitch}</p></details>}
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Log outcome</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {OUTCOME_BTNS.map((b) => <button key={b.o} className={b.primary ? 'mm-btn mm-btn--primary' : 'mm-btn'} style={{ height: 52, fontSize: 15, fontWeight: b.primary ? 600 : 500 }} onClick={() => onLog(b.o)}>{b.t}</button>)}
      </div>
      <button className="mm-btn" style={{ height: 44, color: 'var(--danger)' }} onClick={() => { if (window.confirm(`Remove ${c.name} from calling for good (do not call)?`)) onLog('dnc_remove'); }}>Remove / do not call</button>
    </Sheet>
  );
}

function PitchSheet({ text, loading, save, onClose }: { text: string; loading: boolean; save: (t: string) => Promise<void> | void; onClose: () => void }) {
  const [v, setV] = useState(text);
  useEffect(() => { if (!loading) setV(text); }, [loading, text]);
  return (
    <Sheet title="Your pitch" onClose={() => { if (v !== text) void save(v); onClose(); }}>
      <textarea value={v} onChange={(e) => setV(e.target.value)} style={{ ...area, height: 220, fontSize: 15 }} placeholder="Paste or write the script you're using…" />
      <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Saves when you close this.</span>
    </Sheet>
  );
}
