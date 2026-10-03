import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useIdeaMaker } from '../../data/useIdeaMaker';
import { useNovaPreferences } from '../../data/useNovaPreferences';
import Card from '../mm/Card';
import Row from '../mm/Row';
import Stat from '../mm/Stat';
import { Empty } from '../mm/States';
import { Page, useModule, useAi, AiOffCard, NovaMark, field } from '../mm/Page';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Idea Maker (design handoff: MM 5 Scaling): drop a raw idea, Nova takes a
 *  first pass, then you dig in together. Threads are saved as you go. */
export default function IdeaMakerScreen(_: Props) {
  const { device, novaOpen } = useModule();
  const phone = device === 'phone';
  const ai = useAi();
  const I = useIdeaMaker();
  const { assistantName } = useNovaPreferences();
  const [idea, setIdea] = useState('');
  const [reply, setReply] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [I.messages.length, I.thinking]);

  const cur = I.sessions.find((s) => s.id === I.activeSessionId) ?? null;
  const start = () => { if (!idea.trim()) return; void I.startSession(idea.trim()); setIdea(''); };
  const send = () => { if (!reply.trim() || I.thinking) return; void I.sendMessage(reply.trim()); setReply(''); };
  const weekAgo = Date.now() - 7 * 86400000;

  const newIdea = (
    <Card title="A new idea" meta={`${assistantName} takes a first pass`} wide={!phone}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={idea} onChange={(e) => setIdea(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') start(); }} placeholder="A cheap entry offer for dentists?" style={{ ...field, flex: 1 }} disabled={ai === false} />
        <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!idea.trim() || ai === false} onClick={start}>Start</button>
      </div>
    </Card>
  );
  const saved = (
    <Card title="Your ideas" meta={`${I.sessions.length}`} flush wide={!phone}>
      {I.sessions.length ? <div>{I.sessions.map((s, i) => <Row key={s.id} first={i === 0} name={s.idea_text} meta={day(s.created_at)} dim={s.id !== I.activeSessionId && !!I.activeSessionId} onClick={() => I.setActiveSessionId(s.id)} />)}</div>
        : <div style={{ padding: '10px 0 14px', fontSize: 14, color: 'var(--text-tertiary)' }}>No ideas explored yet.</div>}
    </Card>
  );
  const thread = cur && (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: phone ? 18 : 20, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
        <span style={{ color: 'var(--text)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{cur.idea_text}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Thread · {day(cur.created_at)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {I.messages.map((m) => m.from_role === 'user'
          ? <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: 'var(--text)', color: 'var(--bg)', fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
          : <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '92%', padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}><NovaMark title={assistantName} /><span style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{m.text}</span></div>)}
        {I.thinking && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-tertiary)' }}>{assistantName} is thinking…</div>}
        <div ref={end} />
      </div>
      {ai === false ? <AiOffCard text="Idea Maker talks with Nova, so it's paused until AI is connected. Your saved threads are all here." /> : (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder={`Reply to ${assistantName}…`} style={{ ...field, flex: 1 }} />
          <button className="mm-btn mm-btn--primary" style={{ height: 44 }} disabled={!reply.trim() || I.thinking} onClick={send}>Send</button>
        </div>
      )}
      {phone && <button className="mm-btn" onClick={() => I.setActiveSessionId(null)}>All ideas</button>}
    </section>
  );

  if (!I.loading && I.sessions.length === 0) {
    return (
      <Page title="Idea Maker" sub={`Drop a raw idea. ${assistantName} pressure-tests it with you.`}>
        {ai === false ? <AiOffCard text="Idea Maker talks with Nova, so it needs AI connected to start." /> : newIdea}
        <Empty text="No ideas explored yet. Type one above and hit Start." />
      </Page>
    );
  }

  return (
    <Page title="Idea Maker" sub={`Drop a raw idea. ${assistantName} pressure-tests it with you.`}>
      {phone ? (cur ? thread : <>{newIdea}{saved}</>) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
            <Stat label="Ideas saved" value={String(I.sessions.length)} pill="Threads" />
            <Stat label="This week" value={String(I.sessions.filter((s) => Date.parse(s.created_at) > weekAgo).length)} pill="New ideas" />
            <Stat label="Open thread" value={cur ? String(I.messages.length) : '—'} pill={cur ? 'Messages' : 'Pick an idea'} />
            <Stat label="Nova" value={ai === false ? 'Off' : 'On'} pill={ai === false ? 'Connect AI' : 'Ready'} k={ai === false ? 'warn' : 'good'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: device === 'desktop' && !novaOpen ? 'minmax(0,2fr) minmax(0,1fr)' : 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{thread ?? newIdea}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{cur && newIdea}{saved}</div>
          </div>
        </>
      )}
    </Page>
  );
}
