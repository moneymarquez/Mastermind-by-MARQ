import { useEffect, useState } from 'react';
import { M0_ITEMS, M0_LABEL, m0Progress, m0LockMessage } from '../../../data/stageZero';
import type { M0Venture, M0Item } from '../../../data/stageZero';
import { useStageZero } from '../../../data/useStageZero';
import { api } from '../../../lib/api';
import { E, Badge, Pill, ProgressRing, Metric, btn, field, label, panel, tint } from '../ecom/ecomShared';

interface Visits { hostname: string | null; days: { date: string; visits: number; pageviews: number }[]; visits: number; pageviews: number; as_of: string; error?: string; setup?: boolean }

/** Stage Zero (Appendix 5 Part 4): the free foundation per venture. Each
 *  item says why it matters and how to do it, with Mark done and an
 *  optional proof link. Campaigns for a venture unlock when its list is
 *  done; the first paid $20 only after that. */
export default function StageZeroTab({ api: m0 }: { api: ReturnType<typeof useStageZero> }) {
  const [venture, setVenture] = useState<M0Venture>('madebymarq');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const prog = m0Progress(venture, m0.rows);
  const lock = m0LockMessage(venture, m0.rows);
  return (
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['madebymarq', 'mastermind'] as M0Venture[]).map((v) => { const p = m0Progress(v, m0.rows); return <Pill key={v} active={venture === v} onClick={() => setVenture(v)}>{M0_LABEL[v]} <span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>{p.done}/{p.total}</span></Pill>; })}
      </div>
      <div style={{ ...E.card, padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <ProgressRing done={prog.done} total={prog.total} size={56} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: E.text }}>{prog.complete ? `${M0_LABEL[venture]} foundation is done — campaigns are unlocked.` : `${M0_LABEL[venture]}: ${prog.total - prog.done} to go before any campaign.`}</div>
          <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 4, lineHeight: 1.5 }}>{prog.complete ? 'Next: the first $20 (below).' : 'Don\'t send people to nothing. Everything here is free; the paid budget only unlocks after it.'}</div>
        </div>
        <Badge color={lock ? E.amber : E.green}>{lock ? '🔒 campaigns locked' : '🔓 campaigns unlocked'}</Badge>
      </div>
      {m0.error && <div style={{ color: E.red }}>{m0.error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {M0_ITEMS[venture].map((item, i) => {
          const row = m0.rows.find((r) => r.venture === venture && r.item_key === item.key);
          return <ItemCard key={item.key} n={i + 1} item={item} done={!!row?.done} proof={row?.proof_url ?? ''} doneAt={row?.done_at ?? null} open={openKey === item.key} onToggle={() => setOpenKey(openKey === item.key ? null : item.key)} onMark={(d, p) => m0.mark(venture, item.key, d, p)} onProof={(p) => m0.saveProof(venture, item.key, p)} />;
        })}
      </div>
      <SiteVisits venture={venture} site={m0.sites.find((s) => s.venture === venture)} onSave={(h, t) => m0.saveSite(venture, h, t)} />
      <div style={{ ...E.card, padding: 14, opacity: prog.complete ? 1 : 0.65 }}>
        <div style={{ fontWeight: 700, color: E.text }}>After Stage Zero: the first $20 {prog.complete ? '' : '🔒'}</div>
        <div style={{ fontSize: 'var(--text-body)', color: E.muted, marginTop: 4, lineHeight: 1.5 }}>Don't run cold ads to a brand-new page. Boost the <strong style={{ color: E.text }}>one organic post that already performed best</strong> — highest saves and shares — to a local audience. Proof first, then spend. The boost itself is a money approval: nothing spends without your tap.</div>
      </div>
    </div>
  );
}

function ItemCard({ n, item, done, proof, doneAt, open, onToggle, onMark, onProof }: { n: number; item: M0Item; done: boolean; proof: string; doneAt: string | null; open: boolean; onToggle: () => void; onMark: (done: boolean, proof?: string) => void; onProof: (p: string) => void }) {
  const [p, setP] = useState(proof);
  useEffect(() => setP(proof), [proof]);
  return (
    <div style={{ ...E.card, padding: 12, borderColor: done ? tint(E.green, 45) : (E.border as string) }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
        <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done ? E.green : 'transparent', color: done ? E.onAccent : E.faint, border: `1px solid ${done ? E.green : E.border}`, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{done ? '✓' : n}</span>
        <span style={{ fontWeight: 700, color: done ? E.muted : E.text, flex: 1, textDecoration: done ? 'line-through' : 'none' }}>{item.title}</span>
        <span style={{ color: E.faint }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10, paddingLeft: 34 }}>
          <div style={label}>Why this matters</div>
          <div style={{ fontSize: 'var(--text-body)', color: E.text, marginTop: 2, lineHeight: 1.5 }}>{item.why}</div>
          <div style={{ ...label, marginTop: 10 }}>How to do it</div>
          <ol style={{ margin: '4px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {item.how.map((h, i) => <li key={i} style={{ fontSize: 'var(--text-body)', color: E.text, lineHeight: 1.45 }}>{h.text} {h.link && <a href={h.link} target="_blank" rel="noopener noreferrer" style={{ color: E.blue, whiteSpace: 'nowrap' }}>Open ↗</a>}</li>)}
          </ol>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...field, flex: '1 1 220px', width: 'auto' }} value={p} onChange={(e) => setP(e.target.value)} onBlur={() => p !== proof && onProof(p.trim())} placeholder="Proof link (optional) — profile URL, page URL, screenshot" />
            <button style={btn(done ? 'ghost' : 'primary')} onClick={() => onMark(!done, p.trim())}>{done ? 'Mark not done' : 'Mark done'}</button>
          </div>
          {done && doneAt && <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 4 }}>Done {new Date(doneAt).toLocaleDateString()}{proof && <> · <a href={proof} target="_blank" rel="noopener noreferrer" style={{ color: E.blue }}>proof ↗</a></>}</div>}
        </div>
      )}
    </div>
  );
}

function SiteVisits({ venture, site, onSave }: { venture: M0Venture; site?: { hostname: string | null; site_tag: string | null }; onSave: (h: string, t: string) => void }) {
  const [host, setHost] = useState(site?.hostname ?? '');
  const [tag, setTag] = useState(site?.site_tag ?? '');
  const [v, setV] = useState<Visits | null>(null);
  useEffect(() => { setHost(site?.hostname ?? ''); setTag(site?.site_tag ?? ''); }, [site?.hostname, site?.site_tag]);
  useEffect(() => { if (site?.site_tag) api<Visits>(`/api/marketing/visits?venture=${venture}`).then(setV); else setV(null); }, [venture, site?.site_tag]);
  const max = Math.max(1, ...(v?.days ?? []).map((d) => d.visits));
  return (
    <div style={{ ...E.card, padding: 14 }}>
      <div style={{ fontWeight: 700, color: E.text }}>Site visits · Cloudflare Web Analytics</div>
      {v && !v.error ? (
        <>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            <Metric label="Visits · 14d" value={v.visits.toLocaleString()} asOf={v.as_of} confidence="hard" />
            <Metric label="Page views · 14d" value={v.pageviews.toLocaleString()} />
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 60, marginTop: 10 }} aria-label="Daily visits">
            {v.days.map((d) => <div key={d.date} title={`${d.date}: ${d.visits} visits`} style={{ flex: 1, height: `${Math.max(4, (d.visits / max) * 100)}%`, background: E.accent }} />)}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 'var(--text-caption)', color: v?.error ? E.amber : E.faint, marginTop: 6 }}>{v?.error ?? 'Add the site\'s hostname and Web Analytics site tag. Visits show here once the Cloudflare token in Setup has Account Analytics → Read.'}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <input style={{ ...field, flex: '1 1 160px', width: 'auto' }} value={host} onChange={(e) => setHost(e.target.value)} placeholder="madebymarquez.com" />
        <input style={{ ...field, flex: '1 1 200px', width: 'auto', fontFamily: 'var(--font-mono)' }} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Web Analytics site tag" />
        <button style={btn('ghost')} disabled={host === (site?.hostname ?? '') && tag === (site?.site_tag ?? '')} onClick={() => onSave(host.trim(), tag.trim())}>Save</button>
      </div>
    </div>
  );
}
