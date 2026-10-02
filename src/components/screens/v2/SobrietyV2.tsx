import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useBender } from '../../../data/useBender';
import { useSobriety } from '../../../data/useSobriety';
import type { SobrietyCheckin } from '../../../data/types';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Heatmap } from '../../mm/charts';
import type { HeatCell } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, area, useModule, NovaMark, ChoiceRow, AiOffCard, useAi } from '../../mm/Page';
import { addDays, dayLabel, shortDate, utcYmd, WD, parseYmd } from './util';

const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 120, 180, 270, 365, 500, 730, 1000];
const clean = (c: SobrietyCheckin) => !c.drank && !c.weed && !c.nicotine;

/** Streaks over a set of daily check-ins. A day with no check-in ends a
 *  streak; today not logged yet doesn't (the streak runs to yesterday). Pure. */
export function sobrietyStreaks(rows: SobrietyCheckin[], today: string) {
  const by = new Map(rows.map((r) => [r.checkin_date, r]));
  let cur = 0;
  let d = by.has(today) ? today : addDays(today, -1);
  while (by.has(d) && clean(by.get(d)!)) { cur++; d = addDays(d, -1); }
  const since = cur ? addDays(d, 1) : null;
  let longest = 0, run = 0, prev: string | null = null;
  for (const r of [...rows].sort((a, b) => a.checkin_date.localeCompare(b.checkin_date))) {
    if (clean(r) && prev && addDays(prev, 1) === r.checkin_date) run++;
    else run = clean(r) ? 1 : 0;
    longest = Math.max(longest, run);
    prev = r.checkin_date;
  }
  return { cur, since, longest: Math.max(longest, cur) };
}

export default function SobrietyV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const sob = useSobriety();
  const bender = useBender();
  const [rows, setRows] = useState<SobrietyCheckin[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [benderOpen, setBenderOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [answered, setAnswered] = useState<string | null>(null);
  const today = utcYmd(new Date());

  const load = useCallback(async () => {
    const { data } = await supabase.from('sobriety_checkins').select('*').gte('checkin_date', addDays(today, -400)).order('checkin_date', { ascending: false });
    setRows((data ?? []) as SobrietyCheckin[]);
    setLoaded(true);
  }, [today]);
  useEffect(() => { void load(); }, [load, sob.checkins]);

  const st = useMemo(() => sobrietyStreaks(rows, today), [rows, today]);
  const next = MILESTONES.find((m) => m > st.cur) ?? st.cur + 100;
  const by = useMemo(() => new Map(rows.map((r) => [r.checkin_date, r])), [rows]);

  // 12 weeks, columns = weeks starting Sunday, rows = weekdays.
  const startSun = addDays(today, -(parseYmd(today).getDay()) - 77);
  const cells: HeatCell[] = Array.from({ length: 84 }, (_, i) => {
    const d = addDays(startSun, i);
    if (d > today) return { v: '_' };
    const r = by.get(d);
    return { v: r ? (clean(r) ? 3 : 'x') : 0, t: `${shortDate(d)} · ${r ? (clean(r) ? 'Clean' : 'Slip') : 'Not logged'}` };
  });
  const last90 = rows.filter((r) => r.checkin_date > addDays(today, -90));
  const slips90 = last90.filter((r) => !clean(r)).length;
  const benders = bender.sessions.filter((s) => s.started_at.slice(0, 10) > addDays(today, -90));

  // Tonight's prompt from the record: how this weekday has gone over 12 weeks.
  const wd = parseYmd(today).getDay();
  const sameDays = rows.filter((r) => parseYmd(r.checkin_date).getDay() === wd && r.checkin_date >= startSun && r.checkin_date < today);
  const sameSlips = sameDays.filter((r) => !clean(r)).length;
  const prompt = sameDays.length >= 3
    ? sameSlips === 0 ? `It's ${WD[wd]}, which has been an easy night for you: clean ${sameDays.length} of the last ${sameDays.length}. How's it looking?`
      : `${WD[wd]}s have been harder: ${sameSlips} of your last ${sameDays.length} had a slip. How's it looking tonight?`
    : `How's tonight looking?`;
  const answer = async (o: string) => {
    setAnswered(o);
    if (o === 'Need help') { setHelpOpen(true); return; }
    await bender.addJournalEntry(`Evening check-in: ${o.toLowerCase()}.`);
  };

  const benderLog = bender.journal.filter((j) => j.source_bender_id || j.entry_text.startsWith('Evening check-in')).slice(0, 4);

  if (loaded && rows.length === 0 && !bender.sessions.length) {
    return (
      <Page title="Sobriety" sub="Private to you">
        <Empty text="Set your start date to begin a streak. Nothing here is shared unless you choose to." cta="Set start date" onCta={() => setLogOpen(true)} />
        {ai === false && <AiOffCard text="AI check-ins are off. Your streak, heatmap, Bender Mode, and journal all still work." />}
        {logOpen && <LogSheet onClose={() => setLogOpen(false)} onSaved={load} firstRun />}
      </Page>
    );
  }

  const hero = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Clean streak</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: 'var(--text)', fontSize: 46, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }}>{st.cur}<span style={{ fontSize: 22, color: 'var(--text-tertiary)', letterSpacing: '-0.02em' }}>{st.cur === 1 ? 'day' : 'days'}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Chip k="neutral">{st.longest > st.cur ? `Longest yet: ${st.longest} days` : st.cur ? 'Your longest yet' : 'Starts with a clean day'}</Chip>
        {st.since && <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>Since {shortDate(st.since)}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6, marginTop: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}><span>Next milestone: {next} days</span><span style={{ color: 'var(--text)' }}>{next - st.cur} to go</span></div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (st.cur / next) * 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} /></div>
      </div>
    </section>
  );
  const stats = [
    <Stat key="a" label="Clean days · 90" value={String(last90.length - slips90)} pill={plural(slips90, 'slip')} />,
    <Stat key="b" label="Logged · 90" value={`${last90.length} of 90`} pill={`${90 - last90.length} not logged`} />,
    <Stat key="c" label="Bender Mode" value={plural(benders.length, 'use')} pill={bender.activeBender ? 'On now' : 'Last 90 days'} k={bender.activeBender ? 'warn' : 'neutral'} />,
    <Stat key="d" label="Today" value={by.has(today) ? (clean(by.get(today)!) ? 'Clean' : 'Slip') : 'Not logged'} pill={by.has(today) ? 'Logged' : 'Tap Log today'} k={by.has(today) && clean(by.get(today)!) ? 'good' : 'neutral'} onClick={() => setLogOpen(true)} />,
  ];
  const heat = (
    <Card title="Last 12 weeks" meta="Each square is a day" wide={!phone}>
      <Heatmap cells={cells} lo="" hi="Clean" slip="Slip" caption={`${shortDate(startSun)} – ${shortDate(today)}`} />
    </Card>
  );
  const benderCard = (
    <Card title="Bender Mode" meta="For the hard nights" wide={!phone}>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
        {bender.activeBender ? `On since ${shortDate(bender.activeBender.started_at.slice(0, 10))}. Macros and Mental Health read your days in that context until you end it.` : 'Marks a rough stretch so Macros and Mental Health read your days in that context, and logs it to your journal.'}
      </p>
      <button className="mm-btn" style={{ height: 44, fontSize: 15, fontWeight: 500 }} onClick={() => (bender.activeBender ? void bender.endBender() : setBenderOpen(true))}>{bender.activeBender ? 'End Bender Mode' : 'Turn on Bender Mode'}</button>
      {benderLog.length > 0 && (
        <div>{benderLog.map((j, i) => <Row key={j.id} first={i === 0} name={dayLabel(j.entry_date)} meta="Journal" amt={<span style={{ fontSize: 14, fontWeight: 600 }}>{j.entry_text.replace(/^Evening check-in: /, '').replace(/\.$/, '')}</span>} />)}</div>
      )}
    </Card>
  );
  const checkin = (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <NovaMark title="Evening check-in" />
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{answered && answered !== 'Need help' ? 'Saved to your journal. Thanks for checking in.' : prompt}</p>
      <ChoiceRow options={['Good', 'Tough', 'Need help']} value={answered} onPick={(o) => void answer(o)} />
    </section>
  );

  return (
    <Page title="Sobriety" sub="Private to you" right={{ t: by.has(today) ? 'Edit today' : 'Log today', onClick: () => setLogOpen(true) }}>
      {phone ? (
        <>{hero}{heat}{benderCard}{checkin}</>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' ? 'minmax(0,1.35fr) minmax(0,1fr)' : 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16 }}>
            {hero}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1' }}>{heat}</div>
            {checkin}
            {benderCard}
          </div>
        </>
      )}
      {logOpen && <LogSheet existing={by.get(today) ?? null} onClose={() => setLogOpen(false)} onSaved={async () => { await load(); }} save={sob.saveToday} />}
      {benderOpen && <BenderSheet onClose={() => setBenderOpen(false)} onStart={async (b) => { await bender.startBender(b); setBenderOpen(false); }} />}
      {helpOpen && (
        <Sheet title="You're not alone" onClose={() => setHelpOpen(false)}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>If you're in crisis or thinking about harming yourself, call or text <b style={{ color: 'var(--text)' }}>988</b> (Suicide &amp; Crisis Lifeline), or text <b style={{ color: 'var(--text)' }}>HOME</b> to <b style={{ color: 'var(--text)' }}>741741</b>. Available any time.</p>
          <a className="mm-btn mm-btn--primary" href="tel:988" style={{ height: 48, textDecoration: 'none' }}>Call 988</a>
          <a className="mm-btn" href="sms:988" style={{ height: 44, textDecoration: 'none' }}>Text 988</a>
        </Sheet>
      )}
    </Page>
  );
}

function plural(n: number, w: string) { return `${n} ${n === 1 ? w : `${w}s`}`; }

function LogSheet({ existing, onClose, onSaved, save, firstRun }: { existing?: SobrietyCheckin | null; onClose: () => void; onSaved: () => Promise<void> | void; save?: (p: Partial<Pick<SobrietyCheckin, 'drank' | 'weed' | 'nicotine' | 'note'>>) => Promise<void>; firstRun?: boolean }) {
  const [drank, setDrank] = useState(existing?.drank ?? false);
  const [weed, setWeed] = useState(existing?.weed ?? false);
  const [nic, setNic] = useState(existing?.nicotine ?? false);
  const [note, setNote] = useState(existing?.note ?? '');
  const [start, setStart] = useState(utcYmd(new Date()));
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    if (firstRun) {
      // A start date back-fills clean days from then to today, so the streak starts where you say it does.
      const today = utcYmd(new Date());
      const days: string[] = [];
      for (let d = start; d <= today && days.length < 400; d = addDays(d, 1)) days.push(d);
      await supabase.from('sobriety_checkins').upsert(days.map((d) => ({ checkin_date: d, drank: false, weed: false, nicotine: false, heavy: false, note: null })), { onConflict: 'user_id,checkin_date' });
    } else if (save) {
      await save({ drank, weed, nicotine: nic, note: note.trim() || null });
    }
    await onSaved();
    setBusy(false);
    onClose();
  };
  const toggle = (on: boolean, set: (v: boolean) => void, t: string) => (
    <button className="mm-btn" onClick={() => set(!on)} aria-pressed={on} style={{ flex: 1, height: 44, ...(on ? { background: 'color-mix(in srgb, var(--danger) 14%, transparent)', borderColor: 'var(--danger)', color: 'var(--danger)' } : {}) }}>{t}</button>
  );
  return (
    <Sheet title={firstRun ? 'Set start date' : 'Today'} onClose={onClose}>
      {firstRun ? (
        <Field l="Clean since"><input type="date" value={start} max={utcYmd(new Date())} onChange={(e) => setStart(e.target.value)} style={field} /></Field>
      ) : (
        <>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Tap anything you used today. Leave all off for a clean day.</span>
          <div style={{ display: 'flex', gap: 8 }}>{toggle(drank, setDrank, 'Drank')}{toggle(weed, setWeed, 'Weed')}{toggle(nic, setNic, 'Nicotine')}</div>
          <Field l="Note (optional)"><textarea value={note} onChange={(e) => setNote(e.target.value)} style={area} /></Field>
        </>
      )}
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy} onClick={submit}>{busy ? 'Saving…' : firstRun ? 'Start my streak' : drank || weed || nic ? 'Log today' : 'Log a clean day'}</button>
    </Sheet>
  );
}

function BenderSheet({ onClose, onStart }: { onClose: () => void; onStart: (b: { expected_days: number | null; description: string | null; traveling: boolean }) => Promise<void> }) {
  const [days, setDays] = useState('');
  const [desc, setDesc] = useState('');
  const [trav, setTrav] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Turn on Bender Mode" onClose={onClose}>
      <Field l="How many days, roughly?"><input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} style={field} placeholder="Optional" /></Field>
      <Field l="What's going on?"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} style={area} placeholder="Optional" /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: 'var(--text)' }}><input type="checkbox" checked={trav} onChange={(e) => setTrav(e.target.checked)} style={{ width: 20, height: 20 }} />I'm traveling</label>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy} onClick={async () => { setBusy(true); await onStart({ expected_days: days ? Number(days) : null, description: desc.trim() || null, traveling: trav }); setBusy(false); }}>{busy ? 'Starting…' : 'Turn on'}</button>
    </Sheet>
  );
}
