import { useMemo, useRef, useState } from 'react';
import { useMacros } from '../../../data/useMacros';
import type { Meal, MealType } from '../../../data/types';
import { estimateMealFromPhoto } from '../../../lib/mealPhoto';
import { fileToBase64 } from '../../../lib/image';
import { AiError } from '../../../lib/ai';
import Card from '../../mm/Card';
import Stat from '../../mm/Stat';
import { Bars, Ring } from '../../mm/charts';
import { Empty } from '../../mm/States';
import { Page, Sheet, Field, field, useModule, useAi, AiOffCard } from '../../mm/Page';
import { lastDays, utcYmd, WD3, clock, num } from './util';

const GLASS_OZ = 8, GLASSES = 10;
const DEFAULT = { cal: 2300, p: 160, c: 250, f: 80 };
const mealName = (m: Meal) => m.note?.trim() || m.restaurant_name || m.meal_type[0].toUpperCase() + m.meal_type.slice(1);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function MacrosV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const mx = useMacros();
  const [logOpen, setLogOpen] = useState(false);
  const [symOpen, setSymOpen] = useState(false);
  const t = mx.nutritionTarget;
  const tg = { cal: t?.daily_calories ?? DEFAULT.cal, p: t?.daily_protein_g ?? DEFAULT.p, c: t?.daily_carbs_g ?? DEFAULT.c, f: t?.daily_fat_g ?? DEFAULT.f };
  const tot = mx.totals;
  const glasses = Math.floor(mx.todayWaterOz / GLASS_OZ);
  const today = utcYmd(new Date());
  const week = useMemo(() => lastDays(7, today).map((d) => ({ d, cal: mx.meals.filter((m) => m.meal_date === d).reduce((s, m) => s + (m.calories ?? 0), 0) })), [mx.meals, today]);
  const symptoms = mx.symptomLogs.filter((s) => s.log_date === today);
  const types: MealType[] = ['breakfast', 'lunch', 'dinner'];
  const missing = types.filter((ty) => !mx.todayMeals.some((m) => m.meal_type === ty));
  const sub = 'Today';

  if (!mx.loading && mx.meals.length === 0) {
    return (
      <Page title="Macros & Meals" sub={sub} fab={{ t: 'Log meal', onClick: () => setLogOpen(true) }}>
        <Empty text="No meals logged today. Snap a photo and the macros fill in." cta="Log first meal" onCta={() => setLogOpen(true)} />
        {ai === false && <AiOffCard text="Photo recognition needs AI. You can still log meals by typing them, and the rings still fill." />}
        {logOpen && <LogMeal mx={mx} ai={ai} onClose={() => setLogOpen(false)} />}
      </Page>
    );
  }

  const legend = [
    { n: 'Protein', v: tot.protein_g, t: tg.p, c: 'var(--cat-1)' },
    { n: 'Carbs', v: tot.carbs_g, t: tg.c, c: 'var(--cat-2)' },
    { n: 'Fat', v: tot.fat_g, t: tg.f, c: 'var(--cat-3)' },
  ];
  const calories = (
    <Card title="Calories" meta={`Target ${num(tg.cal)}`} wide={!phone}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring pcts={legend.map((l) => (l.t ? l.v / l.t : 0))} center={num(Math.round(tot.calories))} sub={tot.calories <= tg.cal ? `${num(Math.round(tg.cal - tot.calories))} left` : `${num(Math.round(tot.calories - tg.cal))} over`} size={132} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {legend.map((m) => (
            <div key={m.n} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: m.c }} /><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{m.n}</span></div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', paddingLeft: 14 }}><span style={{ color: 'var(--text)', fontWeight: 600 }}>{Math.round(m.v)} g</span> / {m.t} g</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
  const water = (
    <Card title="Water" meta={`${glasses} of ${GLASSES} glasses`} wide={!phone}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GLASSES},1fr)`, gap: 5 }}>
        {Array.from({ length: GLASSES }, (_, i) => (
          <button key={i} aria-label={i < glasses ? `Glass ${i + 1} logged` : 'Log a glass'} onClick={() => { if (i >= glasses) void mx.addWaterLog(GLASS_OZ * (i + 1 - glasses)); }} style={{ height: 28, borderRadius: 6, border: 0, padding: 0, cursor: i >= glasses ? 'pointer' : 'default', background: i < glasses ? 'var(--accent)' : 'var(--surface-3)' }} />
        ))}
      </div>
    </Card>
  );
  const meals = (
    <Card title="Meals" meta={`${mx.todayMeals.length} logged`} wide={!phone}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {mx.todayMeals.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? '1px solid var(--grid)' : 'none' }}>
            <div style={{ width: 48, height: 48, flex: 'none', borderRadius: 10, background: 'repeating-linear-gradient(135deg, var(--surface-3) 0 6px, var(--surface-2) 6px 12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, color: 'var(--text-tertiary)' }}>{m.log_method === 'photo' ? 'photo' : m.log_method}</div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mealName(m)}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{cap(m.meal_type)} · {clock(new Date(m.created_at))} · P {Math.round(m.protein_g ?? 0)} C {Math.round(m.carbs_g ?? 0)} F {Math.round(m.fat_g ?? 0)}</span>
            </div>
            <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>{m.calories != null ? num(m.calories) : '—'}</span>
          </div>
        ))}
        {missing.map((ty, i) => (
          <button key={ty} onClick={() => setLogOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: mx.todayMeals.length || i ? '1px solid var(--grid)' : 'none', background: 'transparent', border: 0, borderTopStyle: 'solid', borderTopWidth: mx.todayMeals.length || i ? 1 : 0, borderTopColor: 'var(--grid)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ width: 48, height: 48, flex: 'none', borderRadius: 10, background: 'repeating-linear-gradient(135deg, var(--surface-3) 0 6px, var(--surface-2) 6px 12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>+</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ color: 'var(--text-tertiary)', fontSize: 15, fontWeight: 500 }}>{cap(ty)}</span><span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>Not logged yet</span></div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 15, fontWeight: 600 }}>—</span>
          </button>
        ))}
      </div>
    </Card>
  );
  const weekCard = (
    <Card title="This week" meta="Calories per day" wide={!phone}>
      <Bars vals={week.map((w) => w.cal)} labels={week.map((w, i) => (i === 6 ? 'Today' : WD3[new Date(`${w.d}T00:00:00`).getDay()]))} pre="" h={120} />
    </Card>
  );
  const note = mx.latestInsight?.symptom_correlations;
  const sym = (
    <Card title="Symptoms" meta="Today" wide={!phone}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {symptoms.map((s) => <span key={s.id} style={{ padding: '7px 12px', borderRadius: 999, background: 'var(--surface-3)', color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{s.symptom}{s.note ? ` · ${s.note}` : ''}</span>)}
        <button onClick={() => setSymOpen(true)} style={{ padding: '7px 12px', borderRadius: 999, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
      </div>
      {ai !== false && note && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text)' }}>Nova:</span> {note}</p>}
    </Card>
  );
  const stats = [
    <Stat key="c" label="Calories" value={num(Math.round(tot.calories))} pill={`${num(Math.max(0, Math.round(tg.cal - tot.calories)))} left`} />,
    <Stat key="p" label="Protein" value={`${Math.round(tot.protein_g)} g`} pill={`of ${tg.p} g`} />,
    <Stat key="w" label="Water" value={`${glasses} of ${GLASSES}`} pill="glasses" />,
    <Stat key="l" label="Logged" value={`${mx.todayMeals.length} meal${mx.todayMeals.length === 1 ? '' : 's'}`} pill={missing.length ? `${cap(missing[0])} not yet` : 'All meals in'} />,
  ];
  return (
    <Page title="Macros & Meals" sub={sub} fab={{ t: 'Log meal', onClick: () => setLogOpen(true) }} menu={[{ t: 'Log a glass of water', onClick: () => void mx.addWaterLog(GLASS_OZ) }, { t: 'Add a symptom', onClick: () => setSymOpen(true) }]}>
      {phone ? <>{calories}{water}{meals}{weekCard}{sym}</> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>{stats}</div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            {calories}{weekCard}{sym}
            <div style={{ gridColumn: three ? 'span 2' : '1 / -1' }}>{meals}</div>
            {water}
          </div>
        </>
      )}
      {logOpen && <LogMeal mx={mx} ai={ai} onClose={() => setLogOpen(false)} />}
      {symOpen && <SymptomSheet onClose={() => setSymOpen(false)} onAdd={mx.addSymptomLog} />}
    </Page>
  );
}

function guessType(): MealType { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }

function LogMeal({ mx, ai, onClose }: { mx: ReturnType<typeof useMacros>; ai: boolean | null; onClose: () => void }) {
  const [type, setType] = useState<MealType>(guessType());
  const [name, setName] = useState('');
  const [cal, setCal] = useState(''); const [p, setP] = useState(''); const [c, setC] = useState(''); const [f, setF] = useState('');
  const [method, setMethod] = useState<'manual' | 'photo'>('manual');
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const n = (s: string) => (s.trim() === '' ? null : Number(s));
  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setAnalyzing(true); setErr('');
    try {
      const image = await fileToBase64(file);
      const est = await estimateMealFromPhoto(image, await mx.fetchRecentCorrections());
      setType(est.meal_type); setName(est.description); setCal(String(Math.round(est.calories))); setP(String(Math.round(est.protein_g))); setC(String(Math.round(est.carbs_g))); setF(String(Math.round(est.fat_g))); setMethod('photo');
    } catch (e) { setErr(e instanceof AiError ? e.message : 'Could not read that photo. Type it in instead.'); }
    setAnalyzing(false);
  };
  const save = async () => {
    setBusy(true);
    await mx.addMeal({ meal_type: type, source: 'home', restaurant_name: null, calories: n(cal), protein_g: n(p), carbs_g: n(c), fat_g: n(f), note: name.trim() || null, log_method: method });
    setBusy(false); onClose();
  };
  const small = { ...field, textAlign: 'center' as const };
  return (
    <Sheet title="Log meal" onClose={onClose}>
      {ai !== false && (
        <>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => void onPhoto(e.target.files?.[0])} />
          <button className="mm-btn" style={{ height: 48, fontSize: 15 }} disabled={analyzing} onClick={() => fileRef.current?.click()}>{analyzing ? 'Reading your photo…' : 'Snap a photo'}</button>
        </>
      )}
      {err && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{err}</span>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((ty) => <button key={ty} className="mm-btn" onClick={() => setType(ty)} style={{ height: 38, fontSize: 13, padding: 0, ...(type === ty ? { background: 'var(--surface-3)', borderColor: 'var(--text-tertiary)' } : {}) }}>{cap(ty)}</button>)}
      </div>
      <Field l="What did you eat?"><input value={name} onChange={(e) => setName(e.target.value)} style={field} placeholder="Chicken burrito bowl" /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        <Field l="Calories"><input inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} style={small} /></Field>
        <Field l="Protein g"><input inputMode="numeric" value={p} onChange={(e) => setP(e.target.value)} style={small} /></Field>
        <Field l="Carbs g"><input inputMode="numeric" value={c} onChange={(e) => setC(e.target.value)} style={small} /></Field>
        <Field l="Fat g"><input inputMode="numeric" value={f} onChange={(e) => setF(e.target.value)} style={small} /></Field>
      </div>
      <button className="mm-btn mm-btn--primary" style={{ height: 48, fontSize: 15 }} disabled={busy || (!name.trim() && !cal)} onClick={save}>{busy ? 'Saving…' : 'Log meal'}</button>
    </Sheet>
  );
}

function SymptomSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (s: { symptom: string; severity: number | null; note: string | null }) => Promise<void> }) {
  const [s, setS] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const quick = ['Low energy', 'Bloated', 'Headache', 'Cravings', 'Nausea'];
  return (
    <Sheet title="Add a symptom" onClose={onClose}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{quick.map((q) => <button key={q} className="mm-btn" onClick={() => setS(q)} style={{ height: 34, borderRadius: 999, fontSize: 13, ...(s === q ? { background: 'var(--surface-3)' } : {}) }}>{q}</button>)}</div>
      <Field l="Symptom"><input value={s} onChange={(e) => setS(e.target.value)} style={field} /></Field>
      <Field l="When / note"><input value={note} onChange={(e) => setNote(e.target.value)} style={field} placeholder="3 PM, after lunch" /></Field>
      <button className="mm-btn mm-btn--primary" style={{ height: 48 }} disabled={busy || !s.trim()} onClick={async () => { setBusy(true); await onAdd({ symptom: s.trim(), severity: null, note: note.trim() || null }); setBusy(false); onClose(); }}>Add</button>
    </Sheet>
  );
}
