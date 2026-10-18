import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../../lib/supabase';
import { money } from '../../../data/ecom';
import { E, Badge, label, tint } from './ecomShared';
import { DirectionVisuals } from './PitchCard';
import RichProductCard from './RichProductCard';
import { emptyCard } from '../../../data/ecomCard';
import type { CardProduct } from '../../../data/ecomCard';

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
  inspiration: (p) => `Approve · save ${arr(p.items).length} to Inspiration`,
  content_plan: (p) => `Approve · add ${plural(arr(p.posts).length, 'post')} to the Plan`,
  content_audit: () => 'Approve · save the audit',
  content_grades: (p) => `Approve · grade ${plural(arr(p.items).length, 'post')}`,
  post_plan: (p) => `Approve · schedule ${arr(p.slots).length}`,
  clip_edit: () => 'Approve · save the edit',
  inbound_tags: (p) => `Approve · tag ${arr(p.tags).length}`,
  supplier_pick: () => 'Approve · use this supplier',
  brand_options: () => 'Approve · use this brand',
  store_draft: () => 'Approve · save the page',
  brand_read: (p) => `Approve · save (${String(p.recommendation)})`,
  sample_purchase: () => '✓ I bought it',
  domain_purchase: () => '✓ I bought it',
  product_pitch: () => 'Approve · build the brand',
  supplier_order: () => 'Approve to ship',
  playbook_rule: () => 'Approve · make it a rule',
  content_kit: (p) => `Approve · add ${plural(arr(p.posts).length, 'post')} to the Plan`,
};
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const secs = (n: unknown) => (typeof n === 'number' ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '—');
const gradeColor = (g: number) => (g >= 4 ? E.green : g === 3 ? E.blue : g === 2 ? E.amber : E.red);

export function ApprovalBody({ type, payload: p, choice = 0, onChoice, approvalId }: { type: string; payload: P; choice?: number; onChoice?: (i: number) => void; approvalId?: string }) {
  if (type === 'product_pitch') return <RichPitch p={p} />;
  if (type === 'supplier_order') return <div style={{ marginTop: 10, fontSize: 'var(--text-body)', color: E.muted }}>{String(p.summary ?? '')} Approving marks it ready to place with the supplier; nothing is bought automatically.</div>;
  if (type === 'playbook_rule') return <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)', background: E.sunk, fontFamily: 'var(--font-mono)', fontSize: 13, color: E.text }}>{String(p.rule ?? '')}<div style={{ fontFamily: 'inherit', fontSize: 12, color: E.faint, marginTop: 6 }}>Goes into {String(p.playbook ?? '')}</div></div>;
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
  if (type === 'inspiration') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {arr<Record<string, unknown>>(p.items).map((x, i) => (
          <Box key={i}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: E.text }}>{String(x.title)}</span>
              {typeof x.format === 'string' && x.format && <Badge color={E.violet}>{x.format}</Badge>}
              <a href={String(x.url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-caption)', color: E.blue }}>open ↗</a>
            </div>
            <Line k="Hook" v={x.hook} /><Line k="Why it worked" v={x.why_it_worked} /><Line k="Principle" v={x.principle} />
            <div style={{ fontSize: 'var(--text-caption)', color: E.text, marginTop: 4, padding: 6, borderRadius: 6, background: tint(E.accent, 8) }}><span style={label}>Our version</span> {String(x.our_version)}</div>
          </Box>
        ))}
        {arr<string>(p.dropped).length > 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.amber }}>Dropped: {arr<string>(p.dropped).join('; ')}</div>}
      </div>
    );
  }
  if (type === 'content_plan') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {arr<{ concept: string; format: string; hooks: string[]; script: string; shot_list: string[]; on_screen_text: string; cta: string; caption: string; hashtags: string; day: number; principle: string; why: string }>(p.posts).map((x, i) => (
          <Box key={i}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge color={E.faint}>{DAY[x.day] ?? '—'}</Badge><Badge color={E.violet}>{x.format}</Badge>
              <span style={{ fontWeight: 700, color: E.text }}>{x.concept}</span>
            </div>
            <div style={{ marginTop: 4 }}>{x.hooks.map((h, k) => <div key={k} style={{ fontSize: 'var(--text-caption)', color: E.text }}><span style={label}>Hook {k + 1}</span> {h}</div>)}</div>
            <details style={{ marginTop: 4 }}>
              <summary style={{ fontSize: 'var(--text-caption)', color: E.blue, cursor: 'pointer' }}>Script and shot list</summary>
              <div style={{ fontSize: 'var(--text-caption)', color: E.text, whiteSpace: 'pre-wrap', marginTop: 4, lineHeight: 1.5 }}>{x.script}</div>
              {x.shot_list.length > 0 && <ol style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 'var(--text-caption)', color: E.muted }}>{x.shot_list.map((s, k) => <li key={k}>{s}</li>)}</ol>}
            </details>
            <Line k="On screen" v={x.on_screen_text} /><Line k="CTA" v={x.cta} /><Line k="Why" v={x.why} /><Line k="Principle" v={x.principle} />
          </Box>
        ))}
      </div>
    );
  }
  if (type === 'content_audit') {
    const list = (k: 'repeat' | 'stop', color: string, title: string) => (
      <Box>
        <div style={{ ...label, color }}>{title}</div>
        {arr<{ point: string; evidence: string }>(p[k]).map((x, i) => (
          <div key={i} style={{ marginTop: 6 }}>
            <div style={{ fontSize: 'var(--text-body)', color: E.text, fontWeight: 600 }}>{i + 1}. {x.point}</div>
            {x.evidence && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{x.evidence}</div>}
          </div>
        ))}
      </Box>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>@{String(p.handle)} · {String(p.period_start)} → {String(p.period_end)} · {String(p.posts_count)} posts</div>
        {list('repeat', E.green, 'Repeat')}
        {list('stop', E.red, 'Stop')}
      </div>
    );
  }
  if (type === 'content_grades') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {arr<{ post_id: string; hook: string; views: number; avg: number; grade: number; reason: string; change: string; flag: string | null }>(p.items).map((g) => (
          <Box key={g.post_id}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge color={gradeColor(g.grade)}>{g.grade}/4</Badge>
              {g.flag && <Badge color={g.flag === 'breakout' ? E.green : E.red}>{g.flag === 'breakout' ? '🚀 breakout' : '📉 flop'}</Badge>}
              <span style={{ color: E.text, fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{g.hook || 'Post'}</span>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: E.muted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{g.views.toLocaleString()} views vs {g.avg.toLocaleString()} avg · {g.reason}</div>
            <Line k="Change" v={g.change} />
          </Box>
        ))}
        {arr<string>(p.skipped).length > 0 && <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Not graded: {arr<string>(p.skipped).slice(0, 6).join('; ')}</div>}
      </div>
    );
  }
  if (type === 'content_kit') {
    const bio = (p.bio ?? {}) as { instagram?: string; tiktok?: string };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {typeof p.profile_image === 'string' && <img src={p.profile_image} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{arr<string>(p.handles).map((h) => <Badge key={h} color={E.blue}>@{h}</Badge>)}</div>
        </div>
        <Line k="Instagram bio" v={bio.instagram ?? ''} /><Line k="TikTok bio" v={bio.tiktok ?? ''} /><Line k="Look" v={String(p.look ?? '')} />
        {arr<{ concept: string; hooks: string[]; direction: string; day: number }>(p.posts).map((x, i) => (
          <Box key={i}><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><Badge color={x.direction === 'B' ? E.violet : E.blue}>{x.direction}</Badge><Badge color={E.faint}>day {x.day + 1}</Badge><span style={{ color: E.text, fontWeight: 600 }}>{x.concept}</span></div><div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 4 }}>“{x.hooks[0]}”</div></Box>
        ))}
        <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>Then by hand (no API can create accounts):</div>
        {arr<{ label: string }>(p.checklist).map((c, i) => <div key={i} style={{ fontSize: 'var(--text-caption)', color: E.text }}>☐ {c.label}</div>)}
      </div>
    );
  }
  if (type === 'post_plan') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {arr<{ account_id: string; handle: string; hours: { hour: number; posts: number; avg_views: number }[]; from_data: boolean }>(p.best).map((b) => (
          <div key={b.account_id} style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>@{b.handle}</span> best {b.hours.map((h) => `${String(h.hour).padStart(2, '0')}:00`).join(', ')} {b.from_data ? '(from your posts)' : '(defaults — not enough posts yet)'}</div>
        ))}
        {arr<{ item_id: string; concept: string; scheduled_for: string; scheduled_time: string; caption: string; hashtags: string; cross_post: string[]; why_time: string; had: { scheduled_for: string | null } }>(p.slots).map((x) => (
          <Box key={x.item_id}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge color={E.blue}>{new Date(`${x.scheduled_for}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {x.scheduled_time}</Badge>
              {!x.had.scheduled_for && <Badge color={E.amber}>new date</Badge>}
              <span style={{ color: E.text, fontWeight: 600 }}>{x.concept}</span>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: E.text, whiteSpace: 'pre-wrap', marginTop: 4 }}>{x.caption}</div>
            <Line k="Tags" v={x.hashtags} /><Line k="Cross-post" v={x.cross_post.join(' · ')} /><Line k="Why then" v={x.why_time} />
          </Box>
        ))}
      </div>
    );
  }
  if (type === 'inbound_tags') {
    const SRC: Record<string, string> = { website: 'Website', ig_dm: 'Instagram', tiktok: 'TikTok', referral: 'Referral', google: 'Google', other: 'Other' };
    const c = (p.counts ?? {}) as Record<string, number>;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{Object.entries(c).filter(([, n]) => n > 0).map(([k, n]) => <Badge key={k} color={E.blue}>{SRC[k] ?? k} · {n}</Badge>)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, maxHeight: 260, overflow: 'auto' }}>
          {arr<{ id: string; name: string | null; source: string; detail: string; by: string; was: string }>(p.tags).map((t) => (
            <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 'var(--text-caption)', color: E.muted }}>
              <span style={{ color: E.text, fontWeight: 600 }}>{t.name ?? 'Lead'}</span>
              {t.was !== t.source && <span style={{ color: E.faint, textDecoration: 'line-through' }}>{SRC[t.was] ?? t.was}</span>}
              <Badge color={t.was !== t.source ? E.amber : E.faint}>{SRC[t.source] ?? t.source}</Badge>
              <span>{t.detail}{t.by === 'ai' ? ' · Haiku' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (type === 'supplier_pick') {
    const sup = arr<{ name: string; url: string | null; unit_cost: number | null; ship_cost: number | null; ship_days: number | null; rating: number | null; moq: number | null; branded_packaging: boolean | null; notes: string }>(p.suppliers);
    const sample = (p.sample ?? {}) as { qty: number; variant: string; est_cost: number | null };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Tap the one to use — the worker's pick is preselected.</div>
        {sup.map((x, i) => (
          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 8, borderRadius: 'var(--radius-sm)', background: i === choice ? tint(E.accent, 10) : E.sunk, border: `1px solid ${i === choice ? E.accent : E.border}`, cursor: 'pointer', minWidth: 0 }}>
            <input type="radio" name="supplier" checked={i === choice} onChange={() => onChoice?.(i)} style={{ marginTop: 3 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: E.text }}>{x.name}</span>
                {i === p.pick && <Badge color={E.green}>worker's pick</Badge>}
                {x.url && <a href={x.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 'var(--text-caption)', color: E.blue }}>open ↗</a>}
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: E.muted, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{money(x.unit_cost)} + {money(x.ship_cost)} ship · {x.ship_days ?? '?'}d · ★{x.rating ?? '?'} · MOQ {x.moq ?? '?'}{x.branded_packaging ? ' · branded box' : ''}</div>
              {x.notes && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{x.notes}</div>}
            </div>
          </label>
        ))}
        <Box>
          <Line k="Sample" v={`${sample.qty}× ${sample.variant || ''}${sample.est_cost != null ? ` · ~${money(sample.est_cost)}` : ''} — queued as a money card for you to buy`} />
          {arr<string>(p.inspection).length > 0 && <Line k="Inspect" v={arr<string>(p.inspection).join(' · ')} />}
          {arr<string>(p.shot_list).length > 0 && <Line k="Shots" v={arr<string>(p.shot_list).join(' · ')} />}
        </Box>
      </div>
    );
  }
  if (type === 'brand_options') {
    const opts = arr<{ name: string; domain: string; domain_status?: string; handles: string; positioning: string; voice: string; palette: { hex: string; name: string; why: string }[]; type: { heading: string; body: string; why: string }; logo_direction: string; principle: string; why_this_buyer: string }>(p.options);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {opts.map((o, i) => (
          <label key={i} style={{ display: 'block', padding: 10, borderRadius: 'var(--radius-sm)', background: i === choice ? tint(E.accent, 10) : E.sunk, border: `1px solid ${i === choice ? E.accent : E.border}`, cursor: 'pointer', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="radio" name="brand" checked={i === choice} onChange={() => onChoice?.(i)} />
              <span style={{ fontWeight: 800, color: E.text, fontSize: 'var(--text-subhead)' }}>{o.name}</span>
              <Badge color={o.domain_status === 'available' ? E.green : o.domain_status === 'taken' ? E.red : E.faint}>{o.domain} · {o.domain_status ?? 'unchecked'}</Badge>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>{o.palette.map((c) => <span key={c.hex} title={`${c.name} — ${c.why}`} style={{ width: 28, height: 28, borderRadius: 6, background: c.hex, border: `1px solid ${E.border}` }} />)}</div>
            <Line k="Positioning" v={o.positioning} /><Line k="Voice" v={o.voice} /><Line k="Type" v={o.type.heading ? `${o.type.heading} / ${o.type.body} — ${o.type.why}` : ''} />
            <Line k="Logo" v={o.logo_direction} /><Line k="Why this buyer" v={o.why_this_buyer} /><Line k="Principle" v={o.principle} /><Line k="Handles" v={`${o.handles} (check by hand)`} />
            {approvalId && <DirectionVisuals approvalId={approvalId} direction={i} />}
          </label>
        ))}
      </div>
    );
  }
  if (type === 'store_draft') return <StoreDraftBody p={p} />;
  if (type === 'brand_read') {
    const f = (p.funnel ?? {}) as Record<string, number | null>;
    return (
      <div style={{ marginTop: 10 }}>
        <Box>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: E.text }}>{(f.views ?? 0).toLocaleString()} views → {f.clicks ?? 0} clicks → {f.add_to_carts ?? 0} carts → {f.purchases ?? 0} sales</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <Badge color={p.flag === 'kill' ? E.red : p.flag === 'double_down' ? E.green : p.flag === 'fix' ? E.amber : E.faint}>{String(p.flag).replace('_', ' ')}</Badge>
            <Badge color={E.blue}>{String(p.diagnosis)}</Badge>
            <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>from {String(p.source)}</span>
          </div>
          <Line k="Why" v={p.why} /><Line k="Evidence" v={p.evidence} /><Line k="Next" v={p.next} />
        </Box>
      </div>
    );
  }
  if (type === 'sample_purchase' || type === 'domain_purchase') {
    return (
      <div style={{ marginTop: 10 }}>
        <Box>
          <Line k={type === 'sample_purchase' ? 'From' : 'Domain'} v={type === 'sample_purchase' ? `${p.supplier} · ${p.qty}× ${p.variant ?? ''}` : p.domain} />
          <div style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 4 }}>Nothing is bought for you. Buy it yourself, then tap “I bought it”.</div>
        </Box>
      </div>
    );
  }
  if (type === 'clip_edit') {
    const x = (p.plan ?? {}) as { hook: { start: number; end: number; text: string; why: string }; cuts: { start: number; end: number; why: string }[]; captions: unknown[]; broll: { at: number; prompt: string }[]; higgsfield: string[]; on_screen_text: string; edited_length_s: number };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{String(p.file_name ?? 'Clip')} · {secs(p.duration_s)} raw → {secs(x.edited_length_s)} · 9:16 · {arr(x.captions).length} captions. Preview it side by side in Studio.</div>
        <Box>
          <div style={{ fontWeight: 700, color: E.text }}>Opens on {secs(x.hook.start)}–{secs(x.hook.end)}{x.hook.text ? `: “${x.hook.text}”` : ''}</div>
          <Line k="Why" v={x.hook.why} />
          {x.cuts.map((c, i) => <div key={i} style={{ fontSize: 'var(--text-caption)', color: E.muted, marginTop: 2 }}><span style={{ fontFamily: 'var(--font-mono)', color: E.text }}>{secs(c.start)}–{secs(c.end)}</span> {c.why}</div>)}
        </Box>
        {(x.broll.length > 0 || x.higgsfield.length > 0) && <Box>
          {x.broll.map((b, i) => <Line key={i} k={`B-roll @${secs(b.at)}`} v={b.prompt} />)}
          {x.higgsfield.map((h, i) => <Line key={`h${i}`} k="Higgsfield" v={h} />)}
        </Box>}
        <Line k="On screen" v={x.on_screen_text} />
      </div>
    );
  }
  return null;
}

/** The store page, rendered in a locked-down frame (no scripts), with
 *  the quality gate beside it and a download. Nothing is published. */
function StoreDraftBody({ p }: { p: P }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (typeof p.build_id !== 'string') return;
    supabase.from('ecom_store_builds').select('html').eq('id', p.build_id).maybeSingle().then(({ data }) => setHtml((data as { html?: string } | null)?.html ?? null));
  }, [p.build_id]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      <Box>
        {arr<{ name: string; pass: boolean; detail: string }>(p.checks).map((c) => <div key={c.name} style={{ fontSize: 'var(--text-caption)', color: c.pass ? E.green : E.red }}>{c.pass ? '✓' : '✕'} {c.name} <span style={{ color: E.muted }}>— {c.detail}</span></div>)}
      </Box>
      {html ? <StorePreview html={html} /> : <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Loading the preview…</div>}
    </div>
  );
}
export function StorePreview({ html, name = 'store' }: { html: string; name?: string }) {
  const download = () => { const u = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const a = document.createElement('a'); a.href = u; a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-index.html`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  return (
    <div>
      <div style={{ width: '100%', maxWidth: 390, margin: '0 auto', aspectRatio: '9 / 16', maxHeight: 640, border: `1px solid ${E.border}`, borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: '#fff' }}>
        <iframe title="Store preview" sandbox="" srcDoc={html} style={{ width: '100%', height: '100%', border: 0 }} />
      </div>
      <button onClick={download} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: `1px solid ${E.border}`, background: 'transparent', color: E.text, cursor: 'pointer', fontSize: 13 }}>Download HTML</button>
    </div>
  );
}

/** Tonight's pitch on the same rich card, opened by default: the pitch's own numbers (sellers, supplier, outcomes, risks) merged onto the product row. */
function RichPitch({ p }: { p: P }) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { let on = true; supabase.from('ecom_products').select('*').eq('id', String(p.product_id ?? '')).maybeSingle().then(({ data }) => { if (on) setRow(data as Record<string, unknown> | null); }); return () => { on = false; }; }, [p.product_id]);
  const m = (p.math ?? {}) as { sell?: number; supplier?: number; ship?: number };
  const sup = (p.supplier ?? {}) as { name?: string; url?: string | null; ship_days?: number | null; unit_cost?: number | null; us_warehouse?: boolean | null };
  const out = (p.outcomes ?? {}) as { conservative?: { orders: number; profit: number }; base?: { orders: number; profit: number } };
  const base = (row ?? {}) as Partial<CardProduct>;
  const detail = { ...(base.detail ?? {}), ship_cost: m.ship ?? base.detail?.ship_cost } as CardProduct['detail'];
  const card = {
    ...emptyCard(), ...(detail.card ?? {}),
    sellers: ((p.sellers ?? []) as { name: string; shop_url: string | null; price: number | null; est_monthly_orders: number | null; est_monthly_revenue: number | null; source_url: string | null; shop_look: string; screenshot_url: string | null }[]).map((s) => ({ name: s.name, shop_url: s.shop_url, price: s.price, est_monthly_orders: s.est_monthly_orders, est_monthly_revenue: s.est_monthly_revenue, months_selling: null, look: s.shop_look, screenshot_url: s.screenshot_url, source_url: s.source_url })),
    suppliers: sup.name && sup.name !== 'Not found yet' ? [{ name: sup.name, url: sup.url ?? null, unit_cost: sup.unit_cost ?? m.supplier ?? null, ship_cost: m.ship ?? null, ship_days_min: null, ship_days_max: sup.ship_days ?? null, warehouse: sup.us_warehouse ? 'US' : null, rating: null, sample_cost: null }] : (detail.card?.suppliers ?? []),
    demand: ((p.why_now ?? []) as { claim: string; url: string | null }[]).map((w) => ({ text: w.claim, url: w.url })),
    outcome: out.conservative && out.base ? { conservative: out.conservative, base: out.base } : null,
    confidence_pct: typeof p.confidence_pct === 'number' ? p.confidence_pct : null,
    confidence_reasons: ((p.reasons ?? []) as string[]).slice(0, 3), risks: ((p.risks ?? []) as string[]).slice(0, 2),
    gap: String(p.summary ?? ''),
  };
  const prod = { name: String(p.product_name ?? 'Product'), category: base.category ?? null, images: [...(p.image ? [String(p.image)] : []), ...(base.images ?? [])], sell_price: m.sell ?? base.sell_price ?? null, supplier_cost: m.supplier ?? base.supplier_cost ?? null, score: base.score ?? null, confidence: (base.confidence ?? 'estimate') as CardProduct['confidence'], days_trending: base.days_trending ?? null, velocity: base.velocity ?? null, content_difficulty: base.content_difficulty ?? null, detail: { ...detail, card }, source_url: base.source_url ?? null, channel: (base.channel ?? 'tiktok') as CardProduct['channel'] } as CardProduct;
  return <div style={{ marginTop: 10 }}><RichProductCard p={prod} expanded embedded /></div>;
}
