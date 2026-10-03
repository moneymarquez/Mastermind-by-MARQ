import { useEffect, useRef, useState } from 'react';
import { useVoiceCapture, CAPTURE_TYPE_LABEL, CAPTURE_TYPE_MODULE } from '../../../data/useVoiceCapture';
import type { CaptureType, FiledRecord } from '../../../data/useVoiceCapture';
import { isSpeechRecognitionSupported } from '../../../lib/speech';
import Card from '../../mm/Card';
import Row from '../../mm/Row';
import Stat from '../../mm/Stat';
import { Donut } from '../../mm/charts';
import { Page, useModule, useAi, AiOffCard, field } from '../../mm/Page';
import { usd } from './util';

const TYPES: CaptureType[] = ['task', 'expense', 'income', 'contact', 'decision', 'note', 'followup'];
type Entry = FiledRecord & { at: Date; undone?: boolean };

function amountOf(e: Entry): string {
  const f = e.fields;
  if ((e.type === 'expense' || e.type === 'income') && f.amount != null && Number(f.amount)) return `${e.type === 'expense' ? '' : '+'}${usd(Number(f.amount), 2)}`;
  if ((e.type === 'task' || e.type === 'followup') && typeof f.due_date === 'string') return new Date(`${f.due_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
  return e.type === 'contact' ? 'New' : e.type === 'decision' ? 'Logged' : 'Saved';
}

function Wave({ live }: { live: boolean }) {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 3, height: 36 }}>
      {Array.from({ length: 28 }, (_, i) => {
        const h = 6 + Math.round(Math.abs(Math.sin(i * 1.7)) * 24);
        return <div key={i} style={{ width: 3, height: live ? h : 4, borderRadius: 2, background: live && i < 20 ? 'var(--accent)' : 'var(--surface-3)', transition: 'height .2s ease', animation: live ? `mmWave 0.9s ${(i % 7) * 0.08}s ease-in-out infinite alternate` : undefined }} />;
      })}
      <style>{'@keyframes mmWave { from { transform: scaleY(.45) } to { transform: scaleY(1) } }'}</style>
    </div>
  );
}

export default function VoiceCaptureV2() {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone', three = device === 'desktop' && !novaOpen;
  const ai = useAi();
  const V = useVoiceCapture();
  const supported = isSpeechRecognitionSupported();
  const [log, setLog] = useState<Entry[]>([]);
  const [text, setText] = useState('');
  const [manualType, setManualType] = useState<CaptureType>('note');
  const holding = useRef(false);

  // Each new filing joins this session's list; a refile replaces the last one.
  const last = useRef<FiledRecord | null>(null);
  useEffect(() => {
    const f = V.filed;
    if (f && f !== last.current) {
      setLog((l) => (last.current && l[0]?.id === last.current.id && f.summary.startsWith('Refiled') ? [{ ...f, at: new Date() }, ...l.slice(1)] : [{ ...f, at: new Date() }, ...l]));
    }
    last.current = f;
  }, [V.filed]);

  const down = () => { if (!supported || V.listening || V.processing) return; holding.current = true; V.start(); };
  const up = () => { if (!holding.current) return; holding.current = false; V.stop(); };
  const undo = async (e: Entry) => { if (V.filed?.id === e.id) { await V.discard(); setLog((l) => l.map((x) => (x.id === e.id ? { ...x, undone: true } : x))); } };
  const latest = log[0];

  const capture = ai === false ? (
    <Card title="Quick note" meta="Pick where it goes" wide={!phone}>
      <AiOffCard text="Filing by voice needs AI. You can still type a quick note and choose where it goes." />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Lunch at Chipotle, $23.40" style={{ ...field, height: 72, padding: '10px 12px' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <select value={manualType} onChange={(e) => setManualType(e.target.value as CaptureType)} style={{ ...field, flex: 1 }}>{TYPES.map((t) => <option key={t} value={t}>{CAPTURE_TYPE_LABEL[t]} → {CAPTURE_TYPE_MODULE[t]}</option>)}</select>
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!text.trim() || V.processing} onClick={async () => { await V.fileAs(manualType, text); setText(''); }}>File it</button>
      </div>
    </Card>
  ) : (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 18px', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: 0 }}>
      <Wave live={V.listening} />
      <span style={{ fontSize: 17, lineHeight: 1.45, color: V.transcript ? 'var(--text)' : 'var(--text-tertiary)', textAlign: 'center', letterSpacing: '-0.015em', minHeight: 25 }}>
        {V.transcript ? `"${V.transcript}"` : supported ? 'Say a task, an expense, a contact, or a decision.' : 'Voice input isn’t supported in this browser. Type it below.'}
      </span>
      {supported && (
        <button aria-label={V.listening ? 'Release to file' : 'Hold to talk'} onPointerDown={down} onPointerUp={up} onPointerLeave={up} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!V.listening) down(); } }} onKeyUp={up}
          style={{ width: 112, height: 112, borderRadius: '50%', border: 0, background: V.listening ? 'var(--accent)' : 'var(--text)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 10px var(--surface-3)', cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
        </button>
      )}
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{V.processing ? 'Filing…' : V.listening ? 'Listening · release to file' : supported ? 'Hold to talk' : ''}</span>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && text.trim() && !V.processing) { void V.fileText(text.trim()); setText(''); } }} placeholder="Or type it" style={{ ...field, flex: 1 }} />
        <button className="mm-btn" style={{ height: 44 }} disabled={!text.trim() || V.processing} onClick={() => { void V.fileText(text.trim()); setText(''); }}>File</button>
      </div>
      {V.error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{V.error}</span>}
    </section>
  );

  const refile = latest && !latest.undone && V.filed?.id === latest.id && (
    <Card title="Wrong place?" meta={`Filed as ${CAPTURE_TYPE_LABEL[latest.type].toLowerCase()}`} wide={!phone}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TYPES.filter((t) => t !== latest.type).map((t) => <button key={t} className="mm-btn" style={{ height: 34, fontSize: 13, borderRadius: 999 }} disabled={V.processing} onClick={() => void V.refileAs(t)}>{CAPTURE_TYPE_LABEL[t]}</button>)}
      </div>
    </Card>
  );
  const filed = (
    <Card title="Just filed" meta="This session" flush wide={!phone}>
      {log.length ? <div>{log.map((e, i) => (
        <Row key={`${e.id}-${i}`} first={i === 0} name={e.summary} meta={e.at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} chip={e.undone ? 'Undone' : CAPTURE_TYPE_MODULE[e.type]} k={e.undone ? 'neutral' : 'accent'} amt={e.undone ? '' : amountOf(e)} dim={e.undone}
          sub={!e.undone && V.filed?.id === e.id ? <button onClick={() => void undo(e)} style={{ border: 0, background: 'transparent', padding: 0, color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Undo</button> : undefined} />
      ))}</div> : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>Nothing captured yet. Hold the button and say a task, expense, contact, or decision.</div>}
    </Card>
  );
  const counts = TYPES.map((t) => ({ name: CAPTURE_TYPE_MODULE[t], value: log.filter((e) => !e.undone && e.type === t).length })).reduce<{ name: string; value: number }[]>((a, x) => { const f = a.find((y) => y.name === x.name); if (f) f.value += x.value; else if (x.value) a.push({ ...x }); return a; }, []).sort((a, b) => b.value - a.value);
  const kept = log.filter((e) => !e.undone);

  return (
    <Page title="Voice Capture" sub="Say it once. It files itself.">
      {phone ? (
        <>{capture}{refile}{filed}</>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Filed this session" value={String(kept.length)} pill={kept.length ? 'All filed' : 'Nothing yet'} k={kept.length ? 'good' : 'neutral'} />
            <Stat label="Undone" value={String(log.length - kept.length)} pill="Removed again" />
            <Stat label="Most filed to" value={counts[0]?.name ?? '—'} pill={counts[0] ? `${counts[0].value} this session` : 'Nothing yet'} />
            <Stat label="Last filed" value={kept[0] ? kept[0].at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'} pill={kept[0] ? CAPTURE_TYPE_MODULE[kept[0].type] : 'Nothing yet'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: three ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap: 16, alignItems: 'start' }}>
            {capture}
            <div style={{ gridColumn: three ? 'span 2' : 'auto', display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{filed}{refile}</div>
            {counts.length > 0 && <Card title="Where captures went" meta={`This session · ${kept.length}`} wide><Donut rows={counts} pre="" center="Filed" /></Card>}
          </div>
        </>
      )}
    </Page>
  );
}
