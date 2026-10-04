import { useEffect, useMemo, useState } from 'react';
import { useBrain } from '../../../data/useBrain';
import { TYPE_NAME, breakdown, tendency, types } from '../../../data/brain';
import type { Trait } from '../../../data/brain';
import { useCallsToday } from '../../../data/useCallsToday';
import { supabase } from '../../../lib/supabase';
import BrainScreen from '../brain/BrainScreen';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Stat from '../../mm/Stat';
import { Bars, Ring } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, useModule, useAi, AiOffCard, NovaCard } from '../../mm/Page';
import { lastDays, shortDate, ymd } from './util';

const pct = (t: Trait, s: Parameters<typeof tendency>[1]) => Math.round(((tendency(t, s) - 1) / 4) * 100);
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const h12 = (h: number) => String(((h + 11) % 12) + 1);

export default function BrainV2() {
  const { device, novaOpen, nav } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const b = useBrain();
  const { callsToday } = useCallsToday();
  const [moreKey, setMoreKey] = useState(0);
  const [hours, setHours] = useState<{ h: number; calls: number; conn: number }[]>([]);
  const today = ymd(new Date());
  useEffect(() => {
    supabase.from('call_outcomes').select('outcome, logged_at').gte('call_date', lastDays(30, today)[0]).then(({ data }) => {
      const rows = (data ?? []) as { outcome: string; logged_at: string }[];
      setHours(HOURS.map((h) => {
        const at = rows.filter((r) => new Date(r.logged_at).getHours() === h);
        return { h, calls: at.length, conn: at.filter((r) => r.outcome !== 'no_answer' && r.outcome !== 'voicemail').length };
      }));
    });
  }, [today]);
  const a = b.assessment, s = a?.scores ?? null;
  const t = s ? types(s) : null;
  const bd = s && t ? breakdown(t.primary, t.secondary, s) : null;
  const score = s ? Math.round((pct('CON', s) + pct('STAB', s)) / 2) : 0;
  const traits: [string, number][] = s ? [['Drive', pct('D', s)], ['Connection', pct('I', s)], ['Steadiness', pct('S', s)], ['Detail', pct('C', s)], ['Follow-through', pct('CON', s)], ['Under pressure', pct('STAB', s)]] : [];
  const todayC = b.checkins.find((c) => c.date === today);
  const last14 = lastDays(14, today);
  const made14 = b.checkins.filter((c) => last14.includes(c.date) && c.hour_happened).length;
  const rate = hours.map((x) => (x.calls ? Math.round((x.conn / x.calls) * 100) : 0));
  const withCalls = hours.filter((x) => x.calls >= 3);
  const best = withCalls.length ? withCalls.reduce((m, x) => (x.conn / x.calls > m.conn / m.calls ? x : m)) : null;
  const worst = withCalls.length ? withCalls.reduce((m, x) => (x.conn / x.calls < m.conn / m.calls ? x : m)) : null;
  const answer = useMemo(() => (todayC ? (todayC.score >= 5 ? 'Yes' : todayC.score >= 3 ? 'Partly' : 'No') : null), [todayC]);
  const more = { label: a ? 'Full profile and assessment' : 'Take the assessment', render: () => <BrainScreen homeHeadStyle={{ display: 'none' }} homeSubStyle={{ display: 'none' }} onNavigate={nav} /> };

  if (!b.loading && !a) {
    return (
      <Page title="Brain" sub="Sales and follow-through" more={more} openMore={moreKey}>
        <Empty text="Take the 4-minute assessment to get your profile." cta="Start assessment" onCta={() => setMoreKey((k) => k + 1)} />
        {ai === false && <AiOffCard text="Profile scoring needs AI. Your daily check-ins and calling patterns still record." />}
      </Page>
    );
  }
  const profile = s && t && bd && (
    <Card title="Your profile" meta={a ? `Assessed ${shortDate(a.created_at.slice(0, 10))}` : ''} wide={!phone}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Ring pcts={[score / 100]} center={String(score)} sub="of 100" size={96} sw={8} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.025em' }}>{TYPE_NAME[t.primary]}, then {TYPE_NAME[t.secondary]}</span>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{bd.what.split('. ')[0]}.</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {traits.map(([n, v], i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 108, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{n}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${v}%`, height: '100%', background: i >= 4 ? 'var(--accent)' : 'var(--accent-soft)', borderRadius: 999 }} /></div>
            <span style={{ width: 24, textAlign: 'right', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
      <button className="mm-btn" style={{ height: 40 }} onClick={() => setMoreKey((k) => k + 1)}>Retake the 4-minute assessment</button>
    </Card>
  );
  const checkin = (
    <Card title="Calling hour check-in" meta="Today" wide={!phone}>
      <span style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Did you make your calling hour?</span>
      <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        {['Yes', 'Partly', 'No'].map((o) => (
          <button key={o} role="radio" aria-checked={answer === o} onClick={() => void b.saveCheckin({ date: today, score: o === 'Yes' ? 5 : o === 'Partly' ? 3 : 1, note: todayC?.note ?? null, hour_happened: o !== 'No', dials: callsToday })} style={{ padding: '8px 0', borderRadius: 999, fontSize: 13, fontWeight: 500, border: 0, cursor: 'pointer', fontFamily: 'inherit', background: answer === o ? 'var(--text)' : 'transparent', color: answer === o ? 'var(--bg)' : 'var(--text-secondary)' }}>{o}</button>
        ))}
      </div>
      <div><Chip k={made14 >= 10 ? 'good' : 'neutral'}>{made14} of the last 14 days</Chip></div>
    </Card>
  );
  const bars = (
    <Card title="Connect rate by hour" meta="Last 30 days" wide={!phone}>
      {hours.some((x) => x.calls) ? <Bars vals={rate} labels={HOURS.map(h12)} cur={best ? HOURS.indexOf(best.h) : undefined} pre="" suf="%" h={130} /> : <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Log calls in Dialing and your best hours show up here.</span>}
    </Card>
  );
  return (
    <Page title="Brain" sub="Sales and follow-through" more={more} openMore={moreKey}>
      {phone ? <>{profile}{checkin}{bars}</> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Best hour" value={best ? `${h12(best.h)} ${best.h < 12 ? 'AM' : 'PM'}` : '—'} pill={best ? `${Math.round((best.conn / best.calls) * 100)}% connect` : 'Not enough calls'} k={best ? 'good' : 'neutral'} />
            <Stat label="Worst hour" value={worst ? `${h12(worst.h)} ${worst.h < 12 ? 'AM' : 'PM'}` : '—'} pill={worst ? `${Math.round((worst.conn / worst.calls) * 100)}% connect` : undefined} />
            <Stat label="Calling hour" value={`${made14} of 14`} pill="Last 2 weeks" k={made14 >= 10 ? 'good' : 'neutral'} />
            <Stat label="Calls today" value={String(callsToday)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            {profile}{bars}{checkin}
            {bd && <NovaCard title="Pattern" paras={[bd.costs[0] ?? ''].filter(Boolean)} aiOff="Profile scoring needs AI. Your daily check-ins and calling patterns still record." />}
          </div>
        </>
      )}
    </Page>
  );
}
