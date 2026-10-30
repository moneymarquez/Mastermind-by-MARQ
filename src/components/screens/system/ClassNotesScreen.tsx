import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Page, Tabs, useModule } from '../../mm/Page';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Empty } from '../../mm/States';
import { decideApproval, runWorkerNow } from '../../../data/useEngine';
import { CLASS_BOTS, classBotByWorker } from '../../../data/classroom';
import type { ClassBot, Lesson, Proposal } from '../../../data/classroom';

// Class notes (Oct 2026): what each bot learned in last night's class, with
// sources, and the playbook changes it proposes. Approve / Reject use the
// same approvals flow as every other card (POST /api/engine/decide):
// approving adds the change to that bot's "Class: …" playbook; nothing
// changes before that.

interface ClassRun { id: string; worker_id: string | null; status: string; summary: string | null; error: string | null; created_at: string; output: { bot?: ClassBot; date?: string; lessons?: Lesson[]; proposals?: Proposal[]; outcomes?: string[]; via?: string } }
interface ProposalCard { id: string; title: string; status: string; my_note: string | null; created_at: string; decided_at: string | null; payload: Proposal & { bot: ClassBot; date?: string; target_label?: string; outcomes?: string[]; playbook?: string } }
type Tab = 'today' | ClassBot;

const denverDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' MT';

function useClassNotes() {
  const [runs, setRuns] = useState<ClassRun[]>([]);
  const [cards, setCards] = useState<ProposalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const w = await supabase.from('ai_workers').select('id,key').in('key', CLASS_BOTS.map((b) => b.worker));
    const ids = ((w.data ?? []) as { id: string; key: string }[]);
    const [r, a] = await Promise.all([
      ids.length ? supabase.from('ai_worker_runs').select('id,worker_id,status,summary,error,created_at,output').in('worker_id', ids.map((x) => x.id)).order('created_at', { ascending: false }).limit(60) : Promise.resolve({ data: [], error: null }),
      supabase.from('ai_approvals').select('id,title,status,my_note,created_at,decided_at,payload').eq('type', 'class_proposal').order('created_at', { ascending: false }).limit(80),
    ]);
    if (w.error || a.error) setErr((w.error ?? a.error)?.message ?? 'Could not load class notes.');
    const key = new Map(ids.map((x) => [x.id, x.key]));
    setRuns(((r.data ?? []) as ClassRun[]).map((x) => ({ ...x, output: { ...(x.output ?? {}), bot: x.output?.bot ?? classBotByWorker(key.get(x.worker_id ?? '') ?? '')?.bot } })));
    setCards((a.data ?? []) as ProposalCard[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { runs, cards, loading, err, load };
}

export default function ClassNotesScreen() {
  const { device } = useModule();
  const phone = device === 'phone';
  const { runs, cards, loading, err, load } = useClassNotes();
  const [tab, setTab] = useState<Tab>('today');
  const pending = cards.filter((c) => c.status === 'pending');
  const latest = (b: ClassBot) => runs.find((r) => r.output.bot === b && r.status === 'done') ?? runs.find((r) => r.output.bot === b) ?? null;
  const shown = tab === 'today' ? CLASS_BOTS : CLASS_BOTS.filter((b) => b.bot === tab);
  return (
    <Page title="Class notes" sub="Every night 3:30–7:00 AM Denver, each bot studies what's new in its field. Its proposals change nothing until you approve them." back="HQ" backTo="hq">
      {err && <div style={{ padding: '12px 14px', borderRadius: 'var(--g-r-lg)', border: '1px solid color-mix(in srgb, var(--warning) 40%, var(--border))', background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))', fontSize: 14 }}>{err}</div>}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: 'today', label: 'Today', badge: pending.length || undefined }, ...CLASS_BOTS.map((b) => ({ id: b.bot as Tab, label: b.name, badge: pending.filter((c) => c.payload.bot === b.bot).length || undefined }))]} />
      {loading && <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading class notes…</div>}
      {!loading && (
        <>
          <Card title="Waiting on you" meta={`${pending.length} proposed change${pending.length === 1 ? '' : 's'}`}>
            {(tab === 'today' ? pending : pending.filter((c) => c.payload.bot === tab)).length === 0
              ? <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No playbook changes waiting. Approved changes go into that bot's "Class" playbook; rejected ones teach it what not to propose.</div>
              : (tab === 'today' ? pending : pending.filter((c) => c.payload.bot === tab)).map((c) => <ProposalRow key={c.id} c={c} phone={phone} onDone={load} />)}
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: phone || tab !== 'today' ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: phone ? 12 : 16 }}>
            {shown.map((b) => <BotCard key={b.bot} bot={b.bot} run={latest(b.bot)} history={runs.filter((r) => r.output.bot === b.bot)} full={tab !== 'today'} onRan={load} />)}
          </div>
          {tab !== 'today' && <Decided cards={cards.filter((c) => c.payload.bot === tab && c.status !== 'pending')} />}
        </>
      )}
    </Page>
  );
}

function ProposalRow({ c, phone, onDone }: { c: ProposalCard; phone: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState<'' | 'approved' | 'killed'>('');
  const [msg, setMsg] = useState('');
  const bot = CLASS_BOTS.find((b) => b.bot === c.payload.bot);
  const go = async (status: 'approved' | 'killed') => {
    setBusy(status); setMsg('');
    const r = await decideApproval(c.id, status, status === 'killed' ? 'Rejected in Class notes.' : null);
    setBusy('');
    if (r.error || r.ok === false) { setMsg(r.error ?? 'Could not save.'); return; }
    onDone();
  };
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip k="accent">{bot?.name ?? c.payload.bot}</Chip>
        <Chip>{c.payload.target_label ?? c.payload.target}</Chip>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{when(c.created_at)}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{c.payload.change}</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}><b style={{ fontWeight: 500, color: 'var(--text)' }}>Why:</b> {c.payload.why}</div>
      {c.payload.evidence && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}><b style={{ fontWeight: 500, color: 'var(--text)' }}>How we'll know:</b> {c.payload.evidence}</div>}
      {c.payload.source_url && <a href={c.payload.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{c.payload.source_url}</a>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <button className="mm-btn mm-btn--primary" disabled={!!busy} onClick={() => void go('approved')} style={{ minWidth: phone ? 0 : 120, flex: phone ? 1 : 'none' }}>{busy === 'approved' ? 'Approving…' : 'Approve'}</button>
        <button className="mm-btn" disabled={!!busy} onClick={() => void go('killed')} style={{ minWidth: phone ? 0 : 120, flex: phone ? 1 : 'none' }}>{busy === 'killed' ? 'Rejecting…' : 'Reject'}</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Approve adds it to the "{c.payload.playbook ?? bot?.playbook}" playbook, which {bot?.name ?? 'this bot'}'s workers read from their next run. Numbers that live in code (like the margin thresholds or call-kit profiles) change in a code update after you approve.</div>
      {msg && <div style={{ fontSize: 13, color: 'var(--danger)' }}>{msg}</div>}
    </div>
  );
}

function BotCard({ bot, run, history, full, onRan }: { bot: ClassBot; run: ClassRun | null; history: ClassRun[]; full: boolean; onRan: () => void }) {
  const def = CLASS_BOTS.find((b) => b.bot === bot)!;
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const today = denverDate(new Date().toISOString());
  const lessons = run?.output.lessons ?? [];
  const isToday = run ? denverDate(run.created_at) === today : false;
  const runNow = async () => {
    setRunning(true); setMsg('');
    const r = await runWorkerNow(def.worker, {});
    setRunning(false);
    setMsg(r.ok ? (r.summary ?? 'Class finished.') : (r.error ?? 'Class did not run.'));
    onRan();
  };
  return (
    <Card title={def.name} meta={run ? `${isToday ? 'Today' : 'Last class'} · ${when(run.created_at)}` : 'No class yet'}>
      {!run && <Empty text={`${def.name} hasn't been to class yet. It goes every night after HQ's report.`} />}
      {run?.status === 'failed' && <div style={{ fontSize: 14, color: 'var(--danger)' }}>Class failed: {run.error}</div>}
      {run?.summary && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{run.summary}</div>}
      {lessons.map((l, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: i ? '1px solid var(--border)' : 'none', paddingTop: i ? 10 : 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{l.title}</span>
            {l.tag && <Chip>{l.tag}</Chip>}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{l.detail}</div>
          <a href={l.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--accent)', wordBreak: 'break-all' }}>{l.source_title || l.source_url}{l.published ? ` · ${l.published}` : ''}</a>
        </div>
      ))}
      {run && run.status === 'done' && !lessons.length && <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Nothing genuinely new with a source this time.</div>}
      {full && !!run?.output.outcomes?.length && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>What it learned from (your real results)</div>
          {run.output.outcomes.map((o, i) => <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>• {o}</div>)}
        </div>
      )}
      {full && history.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Earlier classes</div>
          {history.slice(1, 8).map((h) => <div key={h.id} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{when(h.created_at)}: {h.summary ?? h.error ?? h.status}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="mm-btn" disabled={running} onClick={() => void runNow()}>{running ? 'In class…' : 'Run class now'}</button>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Uses the {def.domain === 'ecom' ? 'e-commerce' : def.domain} AI cap.</span>
      </div>
      {msg && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{msg}</div>}
    </Card>
  );
}

function Decided({ cards }: { cards: ProposalCard[] }) {
  if (!cards.length) return null;
  return (
    <Card title="Decided" meta={`${cards.length}`}>
      {cards.slice(0, 20).map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14, color: 'var(--text-secondary)' }}>
          <Chip k={c.status === 'approved' ? 'good' : 'bad'}>{c.status === 'approved' ? 'Approved' : 'Rejected'}</Chip>
          <span>{c.payload.change}</span>
        </div>
      ))}
    </Card>
  );
}
