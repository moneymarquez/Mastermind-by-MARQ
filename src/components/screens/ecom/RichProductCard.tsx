import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { cardView, principleWords, REJECT_REASONS } from '../../../data/ecomCard';
import type { CardProduct, Verdict } from '../../../data/ecomCard';
import { FEES } from '../../../data/ecomFees';
import { money } from '../../../data/ecom';
import { E, Badge, ConfidenceBadge, btn, field, label, tint } from './ecomShared';

// One product card for Approvals, Products and Tonight's pitch (Addendum 3).
// Collapsed it's one decision-ready row; "More" opens sections A–K. It renders
// from cardView(), so a missing number reads "Not found: reason", never "?".

const VERDICT_COLOR: Record<Verdict, string> = { GO: E.green, MAYBE: E.amber, SKIP: E.red, BLOCKED: E.red };
const SELLER_FALLBACK = 'No sellers found with a source yet.';

export interface RichCardProps {
  p: CardProduct;
  /** Start opened (Tonight's pitch). */
  expanded?: boolean;
  /** Hide the decision row; the host has its own buttons (the pitch's Approve / Send back / Kill). */
  embedded?: boolean;
  statusChip?: { label: string; color: string } | null;
  busy?: string;
  message?: string;
  notes?: string;
  onNotes?: (v: string) => void;
  onApprove?: () => void;
  onWatch?: () => void;
  onReject?: (reason: string) => void;
  onEnrich?: () => void;
}

const num: CSSProperties = { fontFamily: 'var(--font-mono)', fontWeight: 600, color: E.text };
const box: CSSProperties = { background: tint(E.border, 18), borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 };
const Sec = ({ t, children }: { t: string; children: ReactNode }) => <div style={box}><span style={label}>{t}</span>{children}</div>;
const nf = (s: string) => s.startsWith('Not found');
const Link = ({ href, children }: { href: string | null | undefined; children: ReactNode }) => (href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: E.blue, fontSize: 13 }}>{children}</a> : null);

export default function RichProductCard(props: RichCardProps) {
  const { p, embedded, statusChip, busy, message, onApprove, onWatch, onReject, onEnrich } = props;
  const [open, setOpen] = useState(!!props.expanded);
  const [rejecting, setRejecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const v = cardView(p);
  const d = p.detail ?? {};
  const c = v.card;
  const pickSup = c.suppliers.find((s) => s.ship_days_max != null && (s.ship_days_max ?? 99) <= 14) ?? c.suppliers[0];
  const photos = [...new Set([...(p.images ?? []), ...c.image_urls])].slice(0, 5);
  const shipTxt = v.shipMax != null ? `${v.shipMin ?? v.shipMax}–${v.shipMax} days` : null;
  const q = encodeURIComponent(p.name);
  const profitLine = v.bd
    ? [`Sell ${money(v.bd.customer)}`, `Profit ${money(v.bd.profit)}/order`, `Margin ${v.bd.marginPct.toFixed(0)}%`].join(' · ')
    : 'Sell, profit and margin: ' + (v.missing[0]?.text ?? 'Not found');
  const trendTxt = p.velocity ? (p.velocity === 'rising' ? 'Trend rising' : p.velocity === 'fading' ? 'Trend fading' : 'Trend flat') : 'Trend: not found';
  const needsNumbers = !v.canApprove && !v.blocked;
  const conf = p.confidence === 'ai' ? 'AI read' : p.confidence === 'estimate' ? 'Estimate' : 'Verified';

  return (
    <div style={{ ...E.card, padding: 0, overflow: 'hidden', borderColor: v.verdict === 'BLOCKED' ? tint(E.red, 45) : undefined }}>
      {/* Collapsed row */}
      <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0,1fr)', gap: 12, padding: 14 }}>
        {photos[0] ? <img src={photos[0]} alt="" loading="lazy" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, border: `1px solid ${E.border}` }} /> : <div style={{ width: 72, height: 72, borderRadius: 10, background: tint(E.accent, 10), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: E.faint, textAlign: 'center' }}>No photo yet</div>}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.rank != null && <Badge color={E.text}>#{p.rank}</Badge>}
            <span style={{ fontWeight: 700, color: E.text, fontSize: 'var(--text-subhead)', minWidth: 0, overflowWrap: 'anywhere' }}>{p.name}</span>
            <Badge color={VERDICT_COLOR[v.verdict]} title={v.verdictWhy}>{v.verdict}</Badge>
            {p.score != null && <Badge color={p.score >= 7 ? E.green : p.score >= 5 ? E.amber : E.faint}>{p.score}/10</Badge>}
            {p.score == null && <Badge color={E.faint} title={v.missing.find((m) => m.field === 'score')?.text}>No score</Badge>}
            <Badge color={E.faint}>{conf}</Badge>
            {v.anyRed && <Badge color={E.red}>⚑ risk</Badge>}
            {statusChip && <Badge color={statusChip.color}>{statusChip.label}</Badge>}
            {typeof d.rejected === 'string' && <Badge color={E.red}>Rejected: {d.rejected}</Badge>}
          </div>
          <div style={{ fontSize: 14, color: nf(profitLine.replace(/^Sell, profit and margin: /, '')) ? E.amber : E.text, marginTop: 6, lineHeight: 1.45 }}>
            {profitLine}{v.bd ? ` · Ships ${shipTxt ?? 'Not found'} · ${trendTxt} · ${p.content_difficulty ? `${p.content_difficulty[0].toUpperCase()}${p.content_difficulty.slice(1)} to film` : 'Film difficulty: not found'}` : ''}
          </div>
          <div style={{ fontSize: 13.5, color: E.muted, marginTop: 4, lineHeight: 1.45 }}>{v.why}</div>
          {v.blocked && <div role="alert" style={{ fontSize: 13.5, color: E.red, marginTop: 6 }}>Blocked: {v.blocked}. This can't be approved.</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 14px 14px' }}>
        <button style={btn('ghost')} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Less' : 'More'}</button>
        {!embedded && !v.blocked && !needsNumbers && onApprove && <button style={btn('primary')} disabled={!!busy} onClick={onApprove}>{busy === 'approve' ? 'Starting…' : 'Approve to test'}</button>}
        {!embedded && needsNumbers && onEnrich && <button style={btn('primary')} disabled={!!busy} onClick={onEnrich}>{busy === 'enrich' ? 'Looking… (1–2 min)' : 'Find the missing numbers'}</button>}
        {!embedded && onReject && <button style={btn('danger')} disabled={!!busy} onClick={() => setRejecting((r) => !r)}>{v.blocked ? 'Dismiss' : 'Reject'}</button>}
      </div>
      {rejecting && onReject && (
        <div style={{ padding: '0 14px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: E.muted }}>Why? (Scout learns from this)</span>
          {REJECT_REASONS.map((r) => <button key={r} style={{ ...btn('ghost'), minHeight: 32, padding: '0 10px', fontSize: 13 }} disabled={!!busy} onClick={() => { setRejecting(false); onReject(r); }}>{r}</button>)}
        </div>
      )}
      {message && <div role="status" style={{ padding: '0 14px 14px', fontSize: 13.5, color: E.muted }}>{message}</div>}

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px 14px' }}>
          {/* A. Photos */}
          {photos.length > 0 && <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory' }}>{photos.map((u) => <img key={u} src={u} alt="" loading="lazy" style={{ height: 150, borderRadius: 10, border: `1px solid ${E.border}`, scrollSnapAlign: 'start', flex: 'none' }} />)}</div>}

          {/* B. Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
            {v.stats.map((s) => (
              <div key={s.label} style={{ ...box, padding: 10, gap: 2 }}>
                <span style={{ fontSize: 12, color: E.faint }}>{s.label}</span>
                <span style={{ ...num, fontSize: nf(s.value) ? 12.5 : 15, color: nf(s.value) ? E.amber : E.text, fontWeight: nf(s.value) ? 500 : 600, overflowWrap: 'anywhere' }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* C. Middleman cost breakdown */}
          <Sec t="Where every dollar goes">
            {v.bd ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 14px', fontSize: 14, color: E.text }}>
                <span>Customer pays</span><span style={num}>{money(v.bd.customer)}</span>
                <span style={{ color: E.muted }}>− Supplier cost</span><span style={num}>−{money(v.bd.supplier)}</span>
                <span style={{ color: E.muted }}>− Shipping to customer</span><span style={num}>−{money(v.bd.ship)}</span>
                <span style={{ color: E.muted }}>− Shopify payment processing ({FEES.processingPct}% + {money(FEES.processingFixedUsd)})</span><span style={num}>−{money(v.bd.processing)}</span>
                <span style={{ color: E.muted }}>− Packaging / extras</span><span style={num}>−{money(v.bd.packaging)}</span>
                <span style={{ color: E.muted }}>− Refund/chargeback allowance ({FEES.refundPct}% of price)</span><span style={num}>−{money(v.bd.refund)}</span>
                <strong style={{ borderTop: `1px solid ${E.border}`, paddingTop: 6 }}>= Profit per order</strong>
                <strong style={{ ...num, borderTop: `1px solid ${E.border}`, paddingTop: 6, color: v.floorOk ? E.green : E.red }}>{money(v.bd.profit)} ({v.bd.marginPct.toFixed(0)}%)</strong>
              </div>
            ) : <span style={{ fontSize: 14, color: E.amber }}>{v.missing.find((m) => m.field === 'supplier_cost')?.text ?? v.missing[0]?.text ?? 'Not found: needs a sell price and supplier cost'}</span>}
            <span style={{ fontSize: 12, color: E.faint }}>Rates: src/data/ecomFees.ts (Shopify Basic online card rate by default). Floor: $10 profit and 35% margin.</span>
          </Sec>

          {/* D. Why sell this */}
          <Sec t="Why sell this">
            {c.demand.length > 0 ? c.demand.map((x, i) => <div key={i} style={{ fontSize: 14, color: E.text }}>📈 {x.text} <Link href={x.url}>source ↗</Link></div>) : <div style={{ fontSize: 14, color: E.amber }}>Demand evidence: Not found{c.tried.length ? ` (tried: ${c.tried.slice(0, 2).join('; ')})` : ''}</div>}
            {d.evidence && <div style={{ fontSize: 14, color: E.text }}>{d.evidence}</div>}
            <Line k="Problem it solves" v={d.problem} />
            <Line k="Why now" v={d.trigger} />
            <Line k="Who buys it" v={d.buyer} />
            <Line k="Why it sells" v={[d.why_emotional, d.why_practical].filter(Boolean).join(' · ')} />
            <Line k="Psychology" v={principleWords(d.principle)} />
            <Line k="The angle" v={d.angle} />
          </Sec>

          {/* E. Who's selling it */}
          <Sec t="Who's selling it now">
            {c.sellers.length === 0 && <div style={{ fontSize: 14, color: E.amber }}>Not found: {SELLER_FALLBACK}</div>}
            {c.sellers.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: s.screenshot_url ? '72px minmax(0,1fr)' : 'minmax(0,1fr)', gap: 10, paddingTop: i ? 8 : 0, borderTop: i ? `1px solid ${E.border}` : 'none' }}>
                {s.screenshot_url && <img src={s.screenshot_url} alt="" loading="lazy" style={{ width: 72, borderRadius: 8, border: `1px solid ${E.border}` }} />}
                <div style={{ fontSize: 14, color: E.text }}>
                  <strong>{s.name}</strong> {s.price != null && <>· {money(s.price)}</>} <Link href={s.shop_url}>shop ↗</Link>
                  <div style={{ fontSize: 13, color: E.muted }}>
                    {s.est_monthly_orders != null ? `~${s.est_monthly_orders}/mo orders` : 'Orders: not found'}{s.est_monthly_revenue != null ? ` · ~${money(s.est_monthly_revenue)}/mo` : ''} <Badge color={E.faint}>Estimate</Badge>
                    {s.months_selling != null ? ` · selling ${s.months_selling} mo` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: E.muted }}>{s.look || 'Store look: not found'}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 14, color: c.gap ? E.text : E.amber }}><strong>Gap we can take:</strong> {c.gap || 'Not found: no gap identified yet'}</div>
          </Sec>

          {/* F. Supplier options */}
          <Sec t="Supplier options">
            {c.suppliers.length === 0 && <div style={{ fontSize: 14, color: E.amber }}>{v.missing.find((m) => m.field === 'supplier_cost')?.text ?? 'Not found: no suppliers in the research'}</div>}
            {c.suppliers.map((s, i) => {
              const pick = s === pickSup;
              return (
                <div key={i} style={{ padding: 8, borderRadius: 10, border: `1px solid ${pick ? E.green : E.border}`, background: pick ? tint(E.green, 8) : 'transparent', fontSize: 14, color: E.text }}>
                  <strong>{s.name}</strong> {pick && <Badge color={E.green}>The pick</Badge>} <Link href={s.url}>listing ↗</Link>
                  <div style={{ fontSize: 13, color: E.muted }}>
                    Unit {s.unit_cost != null ? money(s.unit_cost) : 'not found'} · Ship {s.ship_cost != null ? money(s.ship_cost) : 'not found'} · {s.ship_days_max != null ? `${s.ship_days_min ?? s.ship_days_max}–${s.ship_days_max} days to US` : 'ship time not found'} · {s.warehouse ?? 'warehouse not found'} · rating {s.rating ?? 'not found'} · sample {s.sample_cost != null ? money(s.sample_cost) : 'not found'}
                  </div>
                </div>
              );
            })}
          </Sec>

          {/* G. Outcome range + confidence */}
          <Sec t="What to expect (organic content only)">
            {c.outcome ? (
              <div style={{ fontSize: 14, color: E.text }}>
                Conservative: <span style={num}>{c.outcome.conservative.orders} orders/mo · {money(c.outcome.conservative.profit)}/mo</span><br />
                Base: <span style={num}>{c.outcome.base.orders} orders/mo · {money(c.outcome.base.profit)}/mo</span>
              </div>
            ) : <span style={{ fontSize: 14, color: E.amber }}>Not found: needs seller sales estimates and a profit per order</span>}
            <div style={{ fontSize: 14, color: E.text }}>Confidence: <span style={num}>{c.confidence_pct != null ? `${c.confidence_pct}%` : 'Not found'}</span></div>
            {c.confidence_reasons.map((r, i) => <div key={i} style={{ fontSize: 13.5, color: E.muted }}>✓ {r}</div>)}
            {c.risks.map((r, i) => <div key={i} style={{ fontSize: 13.5, color: E.muted }}>⚠ {r}</div>)}
          </Sec>

          {/* H. Content preview */}
          <Sec t="Content preview">
            {c.hooks.length ? c.hooks.map((h, i) => <div key={i} style={{ fontSize: 14, color: E.text }}>🎣 {h}</div>) : <span style={{ fontSize: 14, color: E.amber }}>Hooks: Not found</span>}
            <Line k="Film it" v={c.film || 'Not found: no filming idea yet'} />
            <Line k="First post" v={c.first_post || 'Not found: no first post yet'} />
          </Sec>

          {/* I. Risk checks */}
          <Sec t="Risk checks">
            {v.risks.map((r) => <div key={r.key} style={{ fontSize: 14, color: E.text }}>{r.state === 'ok' ? '✅' : r.state === 'bad' ? '❌' : '⚠️'} <strong>{r.label}</strong> <span style={{ color: E.muted }}>· {r.why}</span></div>)}
          </Sec>

          {/* J. Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.source_url && <a style={{ ...btn('ghost'), textDecoration: 'none' }} href={p.source_url} target="_blank" rel="noopener noreferrer">Source ↗</a>}
            {c.sellers[0]?.shop_url && <a style={{ ...btn('ghost'), textDecoration: 'none' }} href={c.sellers[0].shop_url} target="_blank" rel="noopener noreferrer">Top seller's shop ↗</a>}
            {pickSup?.url && <a style={{ ...btn('ghost'), textDecoration: 'none' }} href={pickSup.url} target="_blank" rel="noopener noreferrer">Supplier listing ↗</a>}
            <a style={{ ...btn('ghost'), textDecoration: 'none' }} href={`https://www.tiktok.com/search?q=${q}`} target="_blank" rel="noopener noreferrer">Search TikTok ↗</a>
            <a style={{ ...btn('ghost'), textDecoration: 'none' }} href={`https://www.amazon.com/s?k=${q}`} target="_blank" rel="noopener noreferrer">Search Amazon ↗</a>
            <button style={btn('ghost')} onClick={() => { void navigator.clipboard?.writeText(p.name).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>{copied ? 'Copied ✓' : 'Copy name'}</button>
          </div>

          {/* K. Decision row */}
          {!embedded && (
            <Sec t="Your call">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!v.blocked && !needsNumbers && onApprove && <button style={btn('primary')} disabled={!!busy} onClick={onApprove}>Approve to test</button>}
                {onWatch && !v.blocked && <button style={btn('ghost')} disabled={!!busy} onClick={onWatch}>Watch (re-check in 7 days)</button>}
                {onReject && <button style={btn('danger')} disabled={!!busy} onClick={() => setRejecting(true)}>{v.blocked ? 'Dismiss' : 'Reject'}</button>}
                {onEnrich && (needsNumbers || v.missing.length > 0) && <button style={btn('ghost')} disabled={!!busy} onClick={onEnrich}>{busy === 'enrich' ? 'Looking…' : 'Find the missing numbers'}</button>}
              </div>
              {needsNumbers && <span style={{ fontSize: 13, color: E.amber }}>Can't approve until there's a sell price and a supplier cost.</span>}
              {props.onNotes && <textarea style={{ ...field, minHeight: 64, fontFamily: 'inherit' }} placeholder="Notes (saved on the product)" defaultValue={props.notes ?? ''} onBlur={(e) => { if (e.target.value !== (props.notes ?? '')) props.onNotes?.(e.target.value); }} />}
            </Sec>
          )}
          {v.missing.length > 0 && <div style={{ fontSize: 12.5, color: E.faint }}>{v.missing.length} number{v.missing.length === 1 ? '' : 's'} not found. <ConfidenceBadge c={p.confidence} /></div>}
        </div>
      )}
    </div>
  );
}

function Line({ k, v }: { k: string; v?: string | null }) {
  if (!v) return <div style={{ fontSize: 14, color: E.amber }}><span style={{ color: E.faint }}>{k}:</span> Not found</div>;
  return <div style={{ fontSize: 14, color: nf(v) ? E.amber : E.text }}><span style={{ color: E.faint }}>{k}:</span> {v}</div>;
}
