import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { api } from '../../../lib/api';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Page, field, useModule } from '../../mm/Page';
import { Empty } from '../../mm/States';
import { dateStr } from '../../../data/time';

/** GovCon: learn to read government contracts the way money moves.
 *  One button pulls three fresh public contracts (USAspending.gov). For each:
 *  read it (tap any word you don't know to flag it), take the 3-question quiz
 *  (who's affected, how, the play), then see the full breakdown, write your
 *  prediction (checked at 30 and 90 days), and send the winner to LeadFlow. */

interface QuizQ { q: string; options: string[]; answer: number; why: string }
interface Brief { what: string; who: string; how: string; play: string; why_it_matters: string; terms: { term: string; meaning: string }[] }
interface Contract {
  id: string; briefing_date: string; award_id: string; recipient: string | null; amount: number | null; agency: string | null; sub_agency: string | null;
  description: string | null; state: string | null; naics: string | null; start_date: string | null; end_date: string | null; url: string | null;
  brief: Brief; quiz: QuizQ[]; answers: Record<string, number>; score: number | null;
  prediction: string | null; predicted_at: string | null; check_30: string | null; check_90: string | null; result_30: string | null; result_90: string | null; lead_id: string | null;
}
interface Word { id: string; word: string; meaning: string | null; context: string | null; contract_id: string | null; learned: boolean; created_at: string }
interface Settings { states: string[]; keywords: string[]; per_day: number }

const TABS = ['Today', 'Journal', 'Glossary', 'Watch list'] as const;
type Tab = typeof TABS[number];
const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
const usd = (n: number | null) => (n == null ? '—' : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`);
const cleanWord = (w: string) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
const muted: CSSProperties = { fontSize: 13, color: 'var(--text-tertiary)' };
const body: CSSProperties = { fontSize: 15, lineHeight: 1.6, color: 'var(--text)' };
const addDays = (d: Date, n: number) => dateStr(new Date(d.getTime() + n * 86400000));

export default function GovConScreen() {
  const { device } = useModule();
  const phone = device === 'phone';
  const [tab, setTab] = useState<Tab>('Today');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [settings, setSettings] = useState<Settings>({ states: ['UT'], keywords: [], per_day: 3 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [c, w, s] = await Promise.all([
      supabase.from('gov_contracts').select('*').order('briefing_date', { ascending: false }).order('created_at', { ascending: true }).limit(300),
      supabase.from('gov_words').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('gov_settings').select('states,keywords,per_day').maybeSingle(),
    ]);
    setContracts((c.data ?? []) as Contract[]);
    setWords((w.data ?? []) as Word[]);
    if (s.data) setSettings(s.data as Settings);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const today = dateStr(new Date());
  const latestDay = contracts[0]?.briefing_date ?? null;
  const shown = contracts.filter((c) => c.briefing_date === latestDay);
  const flagged = useMemo(() => new Set(words.map((w) => w.word.toLowerCase())), [words]);
  const dueChecks = contracts.filter((c) => c.prediction && ((c.check_30 && c.check_30 <= today && !c.result_30) || (c.check_90 && c.check_90 <= today && !c.result_90)));
  const unexplained = words.filter((w) => !w.meaning).length;

  const getBriefing = async () => {
    setBusy(true); setMsg('');
    const r = await api<{ ok?: boolean; count?: number; costUsd?: number; error?: string }>('/api/govcon/briefing', { body: {} });
    setBusy(false);
    if (r.error) setMsg(r.error); else { setMsg(`${r.count} new contract${r.count === 1 ? '' : 's'} ready. About $${(r.costUsd ?? 0).toFixed(2)}.`); await load(); }
  };
  const saveContract = async (id: string, patch: Partial<Contract>) => {
    setContracts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from('gov_contracts').update(patch).eq('id', id);
  };
  const toggleWord = async (raw: string, context: string, contractId: string | null) => {
    const word = cleanWord(raw).toLowerCase();
    if (word.length < 2) return;
    const have = words.find((w) => w.word === word);
    if (have) { setWords((ws) => ws.filter((w) => w.id !== have.id)); await supabase.from('gov_words').delete().eq('id', have.id); return; }
    const { data } = await supabase.from('gov_words').insert({ word, context: context.slice(0, 300), contract_id: contractId }).select('*').single();
    if (data) setWords((ws) => [data as Word, ...ws]);
  };
  const saveTerm = async (term: string, meaning: string, contractId: string) => {
    const word = term.trim().toLowerCase();
    if (words.some((w) => w.word === word)) return;
    const { data } = await supabase.from('gov_words').insert({ word, meaning, contract_id: contractId }).select('*').single();
    if (data) setWords((ws) => [data as Word, ...ws]);
  };

  return (
    <Page title="GovCon" sub="Read contracts, know who they hit and how, and find the play before everyone else." back="Orchestrator" backTo="orchestrator">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'mm-btn mm-btn--primary' : 'mm-btn'} style={{ height: 36 }} onClick={() => setTab(t)}>
            {t}{t === 'Journal' && dueChecks.length ? ` · ${dueChecks.length} due` : ''}{t === 'Glossary' && words.length ? ` · ${words.length}` : ''}
          </button>
        ))}
      </div>

      {tab === 'Today' && (
        <>
          <Card title={latestDay === today ? "Today's briefing" : 'Daily briefing'} meta={latestDay ? (latestDay === today ? `${shown.length} contracts` : `Last one: ${latestDay}`) : 'Not started'}
            action={<button className="mm-btn mm-btn--primary" style={{ height: 36 }} disabled={busy} onClick={() => void getBriefing()}>{busy ? 'Reading contracts… (≈1 min)' : latestDay === today ? `Get ${settings.per_day} more` : `Get today's ${settings.per_day}`}</button>}>
            <span style={muted}>Pulls the biggest new federal contracts from the last 30 days on USAspending.gov, at least one from your watch states ({settings.states.join(', ') || 'none'}). Tap any word you don't know to flag it for your glossary. About 5–10 cents a press.</span>
            {msg && <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</span>}
          </Card>
          {loading ? null : shown.length === 0 ? <Empty text="No contracts yet. Press the button to get your first three." /> : shown.map((c, i) => (
            <ContractCard key={c.id} n={i + 1} c={c} phone={phone} flagged={flagged} onFlag={toggleWord} onSave={saveContract} onSaveTerm={saveTerm} onLead={async () => {
              const r = await api<{ ok?: boolean; leadId?: string; error?: string; already?: boolean }>('/api/govcon/lead', { body: { contractId: c.id } });
              if (r.leadId) setContracts((cs) => cs.map((x) => (x.id === c.id ? { ...x, lead_id: r.leadId! } : x)));
              return r.error ?? (r.already ? 'Already in LeadFlow.' : 'Added to LeadFlow (tag: govcon).');
            }} />
          ))}
        </>
      )}

      {tab === 'Journal' && <Journal contracts={contracts} today={today} onSave={saveContract} />}
      {tab === 'Glossary' && <Glossary words={words} unexplained={unexplained} onReload={load} onLearned={async (w) => { setWords((ws) => ws.map((x) => (x.id === w.id ? { ...x, learned: !x.learned } : x))); await supabase.from('gov_words').update({ learned: !w.learned }).eq('id', w.id); }} onRemove={async (w) => { setWords((ws) => ws.filter((x) => x.id !== w.id)); await supabase.from('gov_words').delete().eq('id', w.id); }} />}
      {tab === 'Watch list' && <WatchList settings={settings} onSave={async (s) => { setSettings(s); await supabase.from('gov_settings').upsert({ ...s, updated_at: new Date().toISOString() }); }} />}
    </Page>
  );
}

/** Text where every word is a button: tap to flag it, tap again to unflag. */
function TapText({ text, flagged, onFlag, style }: { text: string; flagged: Set<string>; onFlag: (word: string, context: string) => void; style?: CSSProperties }) {
  const parts = text.split(/(\s+)/);
  return (
    <p style={{ ...body, margin: 0, ...style }}>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p) || !cleanWord(p)) return <span key={i}>{p}</span>;
        const on = flagged.has(cleanWord(p).toLowerCase());
        return (
          <span key={i} role="button" tabIndex={0} onClick={() => onFlag(p, text)} onKeyDown={(e) => { if (e.key === 'Enter') onFlag(p, text); }}
            style={{ cursor: 'pointer', borderRadius: 4, padding: '0 1px', background: on ? 'color-mix(in srgb, var(--warning, #f5a524) 30%, transparent)' : undefined, textDecoration: on ? 'underline dotted' : undefined }}>
            {p}
          </span>
        );
      })}
    </p>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{label}</span>{children}</div>;
}

function ContractCard({ n, c, phone, flagged, onFlag, onSave, onSaveTerm, onLead }: {
  n: number; c: Contract; phone: boolean; flagged: Set<string>;
  onFlag: (w: string, ctx: string, id: string | null) => void; onSave: (id: string, p: Partial<Contract>) => Promise<void>;
  onSaveTerm: (term: string, meaning: string, id: string) => Promise<void>; onLead: () => Promise<string>;
}) {
  const quiz = Array.isArray(c.quiz) ? c.quiz : [];
  const answers = c.answers ?? {};
  const done = quiz.length > 0 && quiz.every((_, i) => answers[String(i)] != null);
  const [reveal, setReveal] = useState(done);
  const [pred, setPred] = useState(c.prediction ?? '');
  const [leadMsg, setLeadMsg] = useState('');
  const flag = (w: string, ctx: string) => onFlag(w, ctx, c.id);
  const answer = async (qi: number, oi: number) => {
    if (answers[String(qi)] != null) return;
    const next = { ...answers, [String(qi)]: oi };
    const finished = quiz.every((_, i) => next[String(i)] != null);
    const score = finished ? quiz.filter((q, i) => next[String(i)] === q.answer).length : null;
    await onSave(c.id, { answers: next, ...(finished ? { score } : {}) });
    if (finished) setReveal(true);
  };
  const b = c.brief ?? ({} as Brief);

  return (
    <Card title={<span>{n}. {c.recipient ?? 'Unknown winner'}</span>} meta={usd(c.amount)}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {c.agency && <Chip>{c.agency}</Chip>}
        {c.state && <Chip k="accent">{c.state}</Chip>}
        {c.score != null && <Chip k={c.score === quiz.length ? 'good' : c.score > 0 ? 'warn' : 'bad'}>Quiz {c.score}/{quiz.length}</Chip>}
        {c.prediction && <Chip k="good">Prediction saved</Chip>}
      </div>
      <span style={muted}>{[c.sub_agency, c.naics ? `Industry ${c.naics}` : null, c.start_date ? `${c.start_date} → ${c.end_date ?? '?'}` : null].filter(Boolean).join(' · ')}{c.url && <> · <a href={c.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Full record</a></>}</span>

      <Section label="1 · Read the contract"><TapText text={c.description ?? ''} flagged={flagged} onFlag={flag} style={{ fontFamily: 'var(--font-mono, ui-monospace)', fontSize: 14 }} /></Section>
      {b.what && <Section label="In plain words"><TapText text={b.what} flagged={flagged} onFlag={flag} /></Section>}
      {b.terms?.length > 0 && (
        <Section label="Words to know">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {b.terms.map((t) => (
              <div key={t.term} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, flex: 1, minWidth: 0 }}><strong>{t.term}</strong>: <span style={{ color: 'var(--text-secondary)' }}>{t.meaning}</span></span>
                <button className="mm-btn" style={{ height: 28, fontSize: 12.5, flexShrink: 0 }} disabled={flagged.has(t.term.toLowerCase())} onClick={() => void onSaveTerm(t.term, t.meaning, c.id)}>{flagged.has(t.term.toLowerCase()) ? 'Saved' : 'Save'}</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {quiz.length > 0 && (
        <Section label={`2 · Quiz${done ? ` · ${c.score ?? 0}/${quiz.length}` : ''}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {quiz.map((q, qi) => {
              const picked = answers[String(qi)];
              return (
                <div key={qi} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{q.q}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1fr 1fr', gap: 6 }}>
                    {q.options.map((o, oi) => {
                      const shown = picked != null;
                      const right = oi === q.answer, mine = oi === picked;
                      return (
                        <button key={oi} type="button" disabled={shown} onClick={() => void answer(qi, oi)}
                          style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, fontSize: 14, lineHeight: 1.4, cursor: shown ? 'default' : 'pointer', color: 'var(--text)',
                            border: `1px solid ${shown && right ? 'var(--success)' : shown && mine ? 'var(--danger)' : 'var(--border)'}`,
                            background: shown && right ? 'color-mix(in srgb, var(--success) 14%, transparent)' : shown && mine ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'var(--surface-2)' }}>
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  {picked != null && <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{picked === q.answer ? 'Right. ' : 'Not quite. '}{q.why}</span>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {!reveal ? (
        <button className="mm-btn" style={{ height: 36, alignSelf: 'flex-start' }} onClick={() => setReveal(true)}>Show the breakdown now</button>
      ) : (
        <>
          <Section label="3 · Who it affects"><TapText text={b.who ?? ''} flagged={flagged} onFlag={flag} /></Section>
          <Section label="How it affects them"><TapText text={b.how ?? ''} flagged={flagged} onFlag={flag} /></Section>
          <Section label="The play"><TapText text={b.play ?? ''} flagged={flagged} onFlag={flag} /></Section>
          {b.why_it_matters && <Section label="The pattern"><TapText text={b.why_it_matters} flagged={flagged} onFlag={flag} style={{ color: 'var(--text-secondary)' }} /></Section>}
        </>
      )}

      <Section label="4 · Your prediction">
        <span style={muted}>What do you think happens because of this contract in the next 1–3 months, and how would you position for it? You'll check yourself at 30 and 90 days.</span>
        <textarea value={pred} onChange={(e) => setPred(e.target.value)} rows={3} style={{ ...field, height: 'auto', padding: 10, lineHeight: 1.5 }} placeholder="e.g. They'll hire 40 people in Ogden, so local staffing and housing near the base pick up…" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="mm-btn mm-btn--primary" style={{ height: 36 }} disabled={!pred.trim() || pred === c.prediction} onClick={() => {
            const now = new Date();
            void onSave(c.id, { prediction: pred.trim(), predicted_at: now.toISOString(), check_30: c.check_30 ?? addDays(now, 30), check_90: c.check_90 ?? addDays(now, 90) });
          }}>{c.prediction ? 'Update prediction' : 'Save prediction'}</button>
          {c.check_30 && <span style={muted}>Checks on {c.check_30} and {c.check_90}</span>}
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <button className="mm-btn" style={{ height: 36 }} disabled={!!c.lead_id} onClick={async () => setLeadMsg(await onLead())}>{c.lead_id ? 'Winner is in LeadFlow' : 'Add the winner as a Made by lead'}</button>
        <span style={muted}>{leadMsg || 'Companies that just won a contract often need hiring pages, a better site, or marketing.'}</span>
      </div>
    </Card>
  );
}

function Journal({ contracts, today, onSave }: { contracts: Contract[]; today: string; onSave: (id: string, p: Partial<Contract>) => Promise<void> }) {
  const withPred = contracts.filter((c) => c.prediction);
  const results = withPred.flatMap((c) => [c.result_30, c.result_90]).filter(Boolean) as string[];
  const right = results.filter((r) => r.startsWith('right')).length, partly = results.filter((r) => r.startsWith('partly')).length;
  const quizzed = contracts.filter((c) => c.score != null);
  const qRight = quizzed.reduce((s, c) => s + (c.score ?? 0), 0), qTotal = quizzed.reduce((s, c) => s + (Array.isArray(c.quiz) ? c.quiz.length : 0), 0);
  if (!withPred.length) return <Empty text="No predictions yet. After each contract, write what you think happens. They come back here at 30 and 90 days so you can see if you were right." />;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <Card title="Predictions" meta={String(withPred.length)}><span style={muted}>{results.length ? `${right} right, ${partly} partly, ${results.length - right - partly} wrong so far` : 'None checked yet'}</span></Card>
        <Card title="Quiz score" meta={qTotal ? `${Math.round((qRight / qTotal) * 100)}%` : '—'}><span style={muted}>{qRight} of {qTotal} across {quizzed.length} contracts</span></Card>
        <Card title="Contracts read" meta={String(contracts.length)}><span style={muted}>{new Set(contracts.map((c) => c.briefing_date)).size} briefings</span></Card>
      </div>
      {withPred.map((c) => <JournalRow key={c.id} c={c} today={today} onSave={onSave} />)}
    </>
  );
}

function JournalRow({ c, today, onSave }: { c: Contract; today: string; onSave: (id: string, p: Partial<Contract>) => Promise<void> }) {
  const due30 = !!c.check_30 && c.check_30 <= today && !c.result_30;
  const due90 = !!c.check_90 && c.check_90 <= today && !c.result_90;
  const [note, setNote] = useState('');
  const mark = (verdict: 'right' | 'partly' | 'wrong') => {
    const text = `${verdict}${note.trim() ? `: ${note.trim()}` : ''}`;
    void onSave(c.id, due30 ? { result_30: text } : { result_90: text });
    setNote('');
  };
  return (
    <Card title={c.recipient ?? 'Contract'} meta={due30 || due90 ? <Chip k="warn">{due30 ? '30-day check due' : '90-day check due'}</Chip> : `${usd(c.amount)} · ${c.briefing_date}`}>
      <span style={muted}>{c.brief?.what}</span>
      <Section label="You predicted"><span style={body}>{c.prediction}</span></Section>
      {c.result_30 && <Section label="At 30 days"><span style={{ fontSize: 14 }}>{c.result_30}</span></Section>}
      {c.result_90 && <Section label="At 90 days"><span style={{ fontSize: 14 }}>{c.result_90}</span></Section>}
      {(due30 || due90) && (
        <Section label="What actually happened?">
          <span style={muted}>Look up the winner, the agency and the area{c.url ? <> (<a href={c.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>contract record</a>)</> : null}: news, hiring, follow-on contracts, prices. Then grade yourself.</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...field, height: 'auto', padding: 10 }} placeholder="What you found" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mm-btn mm-btn--primary" style={{ height: 34 }} onClick={() => mark('right')}>I was right</button>
            <button className="mm-btn" style={{ height: 34 }} onClick={() => mark('partly')}>Partly</button>
            <button className="mm-btn" style={{ height: 34 }} onClick={() => mark('wrong')}>Wrong</button>
          </div>
        </Section>
      )}
    </Card>
  );
}

function Glossary({ words, unexplained, onReload, onLearned, onRemove }: { words: Word[]; unexplained: number; onReload: () => Promise<void>; onLearned: (w: Word) => Promise<void>; onRemove: (w: Word) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showLearned, setShowLearned] = useState(false);
  const list = words.filter((w) => showLearned || !w.learned);
  const explain = async () => {
    setBusy(true); setMsg('');
    const r = await api<{ explained?: number; error?: string }>('/api/govcon/explain', { body: {} });
    setBusy(false);
    setMsg(r.error ?? `${r.explained ?? 0} explained.`);
    await onReload();
  };
  return (
    <>
      <Card title="Your words" meta={`${words.filter((w) => !w.learned).length} to learn · ${words.filter((w) => w.learned).length} learned`}
        action={unexplained > 0 ? <button className="mm-btn mm-btn--primary" style={{ height: 34 }} disabled={busy} onClick={() => void explain()}>{busy ? 'Explaining…' : `Explain ${unexplained} new`}</button> : undefined}>
        <span style={muted}>Every word you tapped while reading lands here. Explain them, read them, and mark them learned once you'd use them in a sentence.</span>
        {msg && <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</span>}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: 'var(--text-secondary)' }}><input type="checkbox" checked={showLearned} onChange={(e) => setShowLearned(e.target.checked)} />Show learned words</label>
      </Card>
      {list.length === 0 ? <Empty text={words.length ? 'All learned. Read today’s contracts and tap anything new.' : 'No words yet. While you read a contract, tap any word you don’t know.'} /> : (
        <Card flush>
          {list.map((w) => (
            <div key={w.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 15, textDecoration: w.learned ? 'line-through' : undefined }}>{w.word}</strong>
                <span style={{ fontSize: 14, color: w.meaning ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{w.meaning ?? 'Not explained yet. Tap "Explain" above.'}</span>
                {w.context && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontStyle: 'italic', overflowWrap: 'anywhere' }}>“{w.context.slice(0, 160)}{w.context.length > 160 ? '…' : ''}”</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button className="mm-btn" style={{ height: 30, fontSize: 12.5 }} onClick={() => void onLearned(w)}>{w.learned ? 'Unlearn' : 'Learned'}</button>
                <button className="mm-btn" style={{ height: 30, fontSize: 12.5 }} onClick={() => void onRemove(w)}>Remove</button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function WatchList({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => Promise<void> }) {
  const [states, setStates] = useState(settings.states);
  const [kw, setKw] = useState(settings.keywords.join(', '));
  const [perDay, setPerDay] = useState(settings.per_day);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setStates(settings.states); setKw(settings.keywords.join(', ')); setPerDay(settings.per_day); }, [settings]);
  const toggle = (s: string) => { setSaved(false); setStates((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s])); };
  return (
    <Card title="Watch list" meta="What the briefing looks for">
      <span style={muted}>At least one contract each day comes from your watch states. Keywords narrow every pull (leave empty for the biggest contracts of any kind).</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>States</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATES.map((s) => <button key={s} type="button" className={states.includes(s) ? 'mm-btn mm-btn--primary' : 'mm-btn'} style={{ height: 32, minWidth: 44, fontSize: 13 }} onClick={() => toggle(s)}>{s}</button>)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Keywords (comma separated)</span>
        <input value={kw} onChange={(e) => { setKw(e.target.value); setSaved(false); }} style={field} placeholder="construction, fuel, software, housing" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Contracts per press</span>
        <select value={perDay} onChange={(e) => { setPerDay(Number(e.target.value)); setSaved(false); }} style={{ ...field, width: 120 }}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="mm-btn mm-btn--primary" style={{ height: 38 }} onClick={async () => { await onSave({ states, keywords: kw.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 10), per_day: perDay }); setSaved(true); }}>Save watch list</button>
        {saved && <span style={muted}>Saved.</span>}
      </div>
    </Card>
  );
}
