import type { ReactNode } from 'react';
import { money } from '../../../data/ecom';
import { E, Badge, label, tint } from './ecomShared';

/** The readable body of each non-Scout approval card: what you're
 *  approving, laid out the way you'd check it — never raw JSON. Payload
 *  shapes come from worker/lib/workers.ts. */
type P = Record<string, unknown>;
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const Box = ({ children }: { children: ReactNode }) => <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: E.sunk, border: `1px solid ${E.border}`, minWidth: 0 }}>{children}</div>;
const Line = ({ k, v }: { k: string; v: unknown }) => (v == null || v === '' ? null : <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 2, overflowWrap: 'anywhere' }}><span style={label}>{k}</span> {String(v)}</div>);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pct = (v: unknown) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '—');

export const APPROVE_LABEL: Record<string, (p: P) => string> = {
  analysis: () => 'Approve · fill the product',
  teardown: (p) => `Approve · save ${plural(arr(p.competitors).length, 'dossier')} + ${plural(arr(p.angles).length, 'angle')}`,
  lead_tags: (p) => `Approve · tag ${arr(p.rows).length} leads`,
  scripts: (p) => `Approve · save ${arr(p.scripts).length} scripts`,
  campaign_plan: () => 'Approve · add to Campaigns',
  grades: (p) => `Approve · grade ${arr(p.items).length}`,
};

export function ApprovalBody({ type, payload: p }: { type: string; payload: P }) {
  if (type === 'analysis') {
    const d = (p.detail ?? {}) as Record<string, string>;
    const n = (p.numbers ?? {}) as Record<string, number | string | null>;
    const v = p.validate as { rules: { name: string; pass: boolean; detail: string }[]; landed: number } | null;
    const verdict = String(p.verdict);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <Box>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={label}>Validate</span>
            <Badge color={verdict === 'pass' ? E.green : verdict === 'fail' ? E.red : E.amber}>{verdict === 'pass' ? 'Pass' : verdict === 'fail' ? 'Fail' : 'Needs numbers'}</Badge>
          </div>
          {v ? v.rules.map((r) => <div key={r.name} style={{ fontSize: 'var(--text-caption)', color: r.pass ? E.green : E.red, marginTop: 3 }}>{r.pass ? '✓' : '✕'} {r.name} — <span style={{ color: E.muted }}>{r.detail}</span></div>)
            : <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 3 }}>Missing: {['sell_price', 'supplier_cost', 'ship_cost', 'ship_days', 'trend'].filter((k) => n[k] == null).join(', ')}</div>}
          <Line k="Numbers" v={n.note} />
        </Box>
        <Box>
          <Line k="Buyer" v={d.buyer} />
          <Line k="Problem" v={d.problem} />
          <Line k="Why they buy" v={[d.why_emotional, d.why_practical].filter(Boolean).join(' · ')} />
          <Line k="Angle" v={d.angle} />
          <Line k="Could fail" v={d.fail_risks} />
          <Line k="Working if" v={d.success_metrics} />
        </Box>
      </div>
    );
  }
  if (type === 'teardown') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {arr<Record<string, unknown>>(p.competitors).map((c, i) => (
          <Box key={i}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: E.text }}>{String(c.name)}</span>
              {c.price != null && <Badge color={E.faint}>{money(Number(c.price))}</Badge>}
              {typeof c.url === 'string' && c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-caption)', color: E.blue }}>open ↗</a>}
            </div>
            <Line k="Hero" v={c.hero_product} /><Line k="Their angle" v={c.angle} /><Line k="Weak spot" v={c.weaknesses} /><Line k="Reviews say" v={c.reviews} />
          </Box>
        ))}
        {arr<Record<string, unknown>>(p.angles).map((a, i) => (
          <div key={i} style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: tint(E.accent, 8), border: `1px solid ${tint(E.accent, 30)}` }}>
            <div style={{ fontWeight: 700, color: E.text }}>Open angle {i + 1}: {String(a.angle)}</div>
            <Line k="Buyer" v={a.buyer} /><Line k="Principle" v={a.principle} /><Line k="Why unclaimed" v={a.why_unclaimed} /><Line k="Film it" v={a.how_to_film} />
          </div>
        ))}
        {arr<string>(p.dropped).length > 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.amber }}>Dropped: {arr<string>(p.dropped).join('; ')}</div>}
      </div>
    );
  }
  if (type === 'lead_tags') {
    const c = (p.counts ?? {}) as Record<string, number>;
    const rows = arr<{ id: string; name: string; is_chain: boolean; chain_name: string | null; business_size: string; duplicate_of: string | null; note: string; by: string }>(p.rows);
    const flagged = rows.filter((r) => r.is_chain || r.duplicate_of);
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge color={E.red}>{c.chains ?? 0} chains</Badge><Badge color={E.amber}>{c.duplicates ?? 0} duplicates</Badge>
          <Badge color={E.green}>{c.single ?? 0} single</Badge><Badge color={E.blue}>{c.multi ?? 0} multi</Badge>
        </div>
        <div style={{ ...label, marginTop: 10, marginBottom: 4 }}>Coming off the call list ({flagged.length})</div>
        <div style={{ maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {flagged.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 'var(--text-caption)', color: E.muted, flexWrap: 'wrap' }}>
              <Badge color={r.is_chain ? E.red : E.amber}>{r.is_chain ? 'chain' : 'dup'}</Badge>
              <span style={{ color: E.text }}>{r.name}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{r.note}{r.by === 'ai' ? ' · Haiku' : ''}</span>
            </div>
          ))}
          {flagged.length === 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>None — every lead in this batch is an independent.</div>}
        </div>
      </div>
    );
  }
  if (type === 'scripts') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {arr<{ audience: string; tone: string; title: string; body: string; principle: string; replaces: { version: number } | null }>(p.scripts).map((s, i) => (
          <Box key={i}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: E.text }}>{s.title}</span>
              <Badge color={E.faint}>{s.audience === 'multi' ? 'Multi-location' : 'Single'}</Badge><Badge color={E.violet}>{s.tone}</Badge>
              <Badge color={s.replaces ? E.amber : E.green}>{s.replaces ? `new v${s.replaces.version + 1}` : 'new'}</Badge>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: E.text, whiteSpace: 'pre-wrap', marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>
            <Line k="Principle" v={s.principle} />
          </Box>
        ))}
      </div>
    );
  }
  if (type === 'campaign_plan') {
    const x = (p.plan ?? {}) as Record<string, unknown>;
    const t = (x.targets ?? {}) as Record<string, number>;
    return (
      <div style={{ marginTop: 10 }}>
        <Box>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge color={E.blue}>{String(x.channel)}</Badge><Badge color={E.faint}>{x.audience === 'multi' ? 'Multi-location' : 'Single location'}</Badge></div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: E.text, marginTop: 6 }}>{t.calls ?? 0} calls → {t.conversations ?? 0} conversations → {t.meetings ?? 0} meetings → {t.closes ?? 0} closes</div>
          <Line k="Dates" v={`${x.start_date} → ${x.end_date}`} />
          <Line k="Script" v={p.script_title ?? 'none picked'} />
          <Line k="List" v={p.list_name ?? 'LeadFlow pool'} />
          <Line k="Why" v={x.why} />
        </Box>
      </div>
    );
  }
  if (type === 'grades') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {arr<{ name: string; grade: number; weak: string | null; fix: string; attempts: number; stages: { label: string; value: number | null; avg: number | null; pass: boolean }[] }>(p.items).map((g, i) => (
          <Box key={i}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: E.text }}>{g.name}</span>
              <Badge color={g.grade >= 3 ? E.green : g.grade === 2 ? E.amber : E.red}>{g.grade}/4</Badge>
              <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{g.attempts} touches</span>
            </div>
            {g.stages.map((s) => <div key={s.label} style={{ fontSize: 'var(--text-caption)', color: s.pass ? E.green : E.red }}>{s.pass ? '✓' : '✕'} {s.label} {pct(s.value)} <span style={{ color: E.faint }}>vs your {pct(s.avg)}</span></div>)}
            <Line k="Fix" v={g.fix} />
          </Box>
        ))}
        {arr<string>(p.skipped).length > 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Not graded yet: {arr<string>(p.skipped).join('; ')}</div>}
      </div>
    );
  }
  return null;
}
