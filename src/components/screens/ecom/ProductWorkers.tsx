import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { runWorkerNow } from '../../../data/useEngine';
import type { RunRes } from '../../../data/useEngine';
import { money, ago } from '../../../data/ecom';
import { E, Badge, Section, btn, label, tint } from './ecomShared';

interface Analysis { verdict: 'pass' | 'fail' | 'incomplete'; rules: { name: string; pass: boolean; detail: string }[]; ship_days: number | null; trend: string | null; note: string; at: string }
interface Competitor { id: string; name: string; url: string | null; dossier: { hero_product?: string; price?: number | null; angle?: string; weaknesses?: string; reviews?: string }; created_at: string }
interface Angle { id: string; angle: string; buyer: string | null; principle: string | null; why_unclaimed: string | null; how_to_film: string | null; chosen: boolean }

/** The product's workers: Audience Analyst (buyer + Validate verdict) and
 *  Competitor Teardown (dossiers + 3 open angles). Both runs go to
 *  Approvals first; what's approved shows here and in the fields below. */
export default function ProductWorkers({ productId, analysis, onRan }: { productId: string; analysis: Analysis | undefined; onRan: () => void }) {
  const [busy, setBusy] = useState<'' | 'analyst' | 'teardown'>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [angles, setAngles] = useState<Angle[]>([]);
  const load = async () => {
    const [c, a] = await Promise.all([
      supabase.from('ecom_competitors').select('id,name,url,dossier,created_at').eq('product_id', productId).order('created_at', { ascending: false }).limit(10),
      supabase.from('ecom_angles').select('id,angle,buyer,principle,why_unclaimed,how_to_film,chosen').eq('product_id', productId).order('created_at', { ascending: false }).limit(9),
    ]);
    setCompetitors((c.data ?? []) as Competitor[]); setAngles((a.data ?? []) as Angle[]);
  };
  useEffect(() => { load(); }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (worker: 'analyst' | 'teardown') => {
    setBusy(worker); setMsg(null);
    const r: RunRes = await runWorkerNow(worker, { product_id: productId });
    setBusy('');
    setMsg(r.ok ? { ok: true, text: `Done → waiting in Approvals. ${r.summary ?? ''} (${money(r.costUsd ?? 0)})` } : { ok: false, text: r.error ?? 'Run failed.' });
    onRan();
  };
  const choose = async (a: Angle) => {
    await supabase.from('ecom_angles').update({ chosen: !a.chosen, updated_at: new Date().toISOString() }).eq('id', a.id);
    await load();
  };

  return (
    <Section title="Workers" aside={analysis ? <Badge color={analysis.verdict === 'pass' ? E.green : analysis.verdict === 'fail' ? E.red : E.amber}>Validate: {analysis.verdict === 'pass' ? 'pass' : analysis.verdict === 'fail' ? 'fail' : 'needs numbers'}</Badge> : undefined}>
      <div style={{ ...E.card, padding: 14 }}>
        {analysis && (
          <div style={{ marginBottom: 10 }}>
            {analysis.rules.map((r) => <div key={r.name} style={{ fontSize: 'var(--text-caption)', color: r.pass ? E.green : E.red }}>{r.pass ? '✓' : '✕'} {r.name} — <span style={{ color: E.muted }}>{r.detail}</span></div>)}
            <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 2 }}>Analysed {ago(analysis.at)}{analysis.note ? ` · ${analysis.note}` : ''}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn(analysis ? 'ghost' : 'primary')} disabled={!!busy} onClick={() => run('analyst')}>{busy === 'analyst' ? 'Analysing… (20–40s)' : analysis ? 'Re-run Audience Analyst' : 'Research buyer + Validate'}</button>
          <button style={btn(competitors.length ? 'ghost' : 'primary')} disabled={!!busy} onClick={() => run('teardown')}>{busy === 'teardown' ? 'Tearing down… (1–2 min)' : competitors.length ? 'Re-run Teardown' : 'Tear down top sellers'}</button>
        </div>
        {msg && <div style={{ marginTop: 8, padding: 8, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-caption)', color: E.text, background: tint(msg.ok ? E.green : E.red, 10), border: `1px solid ${tint(msg.ok ? E.green : E.red, 35)}` }}>{msg.text}</div>}

        {angles.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...label, marginBottom: 4 }}>Open angles · tap one to pick it</div>
            {angles.map((a) => (
              <div key={a.id} onClick={() => choose(a)} style={{ padding: 8, marginTop: 6, borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: `1px solid ${a.chosen ? E.green : E.border}`, background: a.chosen ? tint(E.green, 8) : E.sunk }}>
                <div style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-body)' }}>{a.chosen ? '✓ ' : ''}{a.angle}</div>
                {a.principle && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Principle</span> {a.principle}</div>}
                {a.why_unclaimed && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Unclaimed</span> {a.why_unclaimed}</div>}
                {a.how_to_film && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Film it</span> {a.how_to_film}</div>}
              </div>
            ))}
          </div>
        )}
        {competitors.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...label, marginBottom: 4 }}>Competitor dossiers</div>
            {competitors.map((c) => (
              <div key={c.id} style={{ padding: '6px 0', borderTop: `1px solid ${E.border}`, fontSize: 'var(--text-caption)', color: E.muted, overflowWrap: 'anywhere' }}>
                <span style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-body)' }}>{c.name}</span>
                {c.dossier.price != null && <span> · {money(Number(c.dossier.price))}</span>}
                {c.url && <> · <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: E.blue }}>open ↗</a></>}
                {c.dossier.angle && <div><span style={label}>Angle</span> {c.dossier.angle}</div>}
                {c.dossier.weaknesses && <div><span style={label}>Weak spot</span> {c.dossier.weaknesses}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
