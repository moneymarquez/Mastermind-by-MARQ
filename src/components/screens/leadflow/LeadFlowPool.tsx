import { useEffect, useMemo, useState } from 'react';
import { useLeadflowPool, leadMediaUrl } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { GREEN } from './shared';
import NotConnectedBanner from './NotConnectedBanner';
import { mapsUrl, streetViewUrl, websiteUrl, registryUrl, peopleSearchUrl, bestOwnerGuess, staleLabel, leadImagePaths } from './leadLinks';

/** Signed thumbnails of the storefront, menu and food.
 *
 *  Signed on expand rather than for the whole pool: the URLs expire in an
 *  hour and most leads are never opened, so signing 353 leads' worth up
 *  front would be wasted round-trips against a TTL that outlives nothing. */
function LeadGallery({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const signed = await Promise.all(paths.map((p) => leadMediaUrl(p)));
      if (!cancelled) setUrls(signed.filter((u): u is string => !!u));
    })();
    return () => { cancelled = true; };
  }, [paths]);

  if (paths.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>Photos</div>
      {urls.length === 0 ? (
        <div style={{ fontSize: 'var(--text-body)', color: '#9ca3af' }}>Loading photos…</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ flex: '0 0 auto' }}>
              <img src={u} alt="" loading="lazy" style={{ height: 120, borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', display: 'block' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const TIER_COLOR: Record<string, string> = { A: '#16a34a', B: '#ca8a04', C: '#9ca3af' };

/** Copies text, with visible confirmation.
 *
 *  Exists because the Utah registry search is a form POST behind a Cloudflare
 *  bot check — there's no query parameter to prefill a business name into, so
 *  the name has to travel by clipboard and get pasted. Reports failure rather
 *  than silently doing nothing: clipboard writes can be refused outright
 *  (permissions, a non-secure context), and a button that looks like it
 *  worked but didn't is worse than one that admits it. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('ok');
    } catch {
      setState('fail');
    }
  };

  const face = state === 'ok' ? '✓ Copied' : state === 'fail' ? '✕ Copy blocked' : `📋 ${label}`;
  return (
    <button
      onClick={copy}
      disabled={!text}
      style={{
        padding: '7px 12px', borderRadius: 'var(--radius-sm)', cursor: text ? 'pointer' : 'default',
        border: `1px solid ${state === 'ok' ? '#16a34a' : '#e5e7eb'}`,
        background: state === 'ok' ? '#f0fdf4' : '#fff',
        color: state === 'ok' ? '#16a34a' : state === 'fail' ? '#ef4444' : '#374151',
        fontSize: 'var(--text-body)', fontWeight: 600,
      }}
    >
      {face}
    </button>
  );
}

const linkBtn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb',
  background: '#fff', color: '#374151', fontSize: 'var(--text-body)', fontWeight: 600,
  textDecoration: 'none', display: 'inline-block',
};
const label: React.CSSProperties = { fontSize: 'var(--text-caption)', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 };

function Detail({ lead }: { lead: LeadflowLead }) {
  const owner = bestOwnerGuess(lead);
  // Prefilled with whatever the scraper found, but editable — the registry
  // lookup is currently returning nothing, so in practice this starts empty
  // and gets typed in after reading the name off the state registry.
  const [person, setPerson] = useState(owner);
  // Memoised because LeadGallery's effect keys off this array's identity:
  // rebuilt inline it would be a new array on every render, so every
  // keystroke in the name field below would re-sign every image.
  const imagePaths = useMemo(() => leadImagePaths(lead), [lead]);

  const sv = streetViewUrl(lead);
  const site = websiteUrl(lead.website);
  const reg = registryUrl(lead);
  const people = peopleSearchUrl(person, lead);
  const stale = staleLabel(lead.days_since_last_review);

  return (
    <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <LeadGallery paths={imagePaths} />
      {lead.summary && <div style={{ fontSize: 'var(--text-body)', color: '#4b5563', lineHeight: 1.5 }}>{lead.summary}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', fontSize: 'var(--text-body)' }}>
        {lead.address && <div><div style={label}>Address</div>{lead.address}</div>}
        {lead.category && <div><div style={label}>Category</div>{lead.category}</div>}
        {lead.fizzle_score != null && <div><div style={label}>Fizzle score</div>{lead.fizzle_score}{lead.tier ? ` · tier ${lead.tier}` : ''}</div>}
        {stale && <div><div style={label}>Last review</div>{stale} ago</div>}
        {lead.rating != null && <div><div style={label}>Rating</div>⭐ {lead.rating}{lead.review_count ? ` (${lead.review_count})` : ''}</div>}
      </div>

      {/* Why the scraper flagged this one — the actual talking points for the call. */}
      {lead.fizzle_reasons && lead.fizzle_reasons.length > 0 && (
        <div>
          <div style={{ ...label, marginBottom: 4 }}>Why this lead</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-body)', color: '#4b5563', lineHeight: 1.6 }}>
            {lead.fizzle_reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <div>
        <div style={{ ...label, marginBottom: 6 }}>Owner</div>
        {owner ? (
          <div style={{ fontSize: 'var(--text-body)' }}>
            {owner}
            {lead.owner_is_agent_only && <span style={{ color: '#9ca3af' }}> — registered agent only, may not be the owner</span>}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--text-body)', color: '#9ca3af' }}>
            {lead.registry_note || 'No owner on file — open the registry below, then search the name.'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <a href={mapsUrl(lead)} target="_blank" rel="noopener noreferrer" style={linkBtn}>📍 Maps</a>
        {sv && <a href={sv} target="_blank" rel="noopener noreferrer" style={linkBtn}>👁 Street View</a>}
        {site && <a href={site} target="_blank" rel="noopener noreferrer" style={linkBtn}>🌐 Website</a>}
        <CopyButton text={lead.business_name} label="Copy name" />
        {reg && (
          // Copies on the way out too, so the single tap that opens the
          // registry also leaves the name ready to paste into its form.
          <a
            href={reg}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { navigator.clipboard?.writeText(lead.business_name).catch(() => {}); }}
            style={linkBtn}
          >
            🏛 State registry
          </a>
        )}
      </div>
      {reg && (
        <div style={{ fontSize: 'var(--text-caption)', color: '#9ca3af', marginTop: -6 }}>
          Opening the registry copies “{lead.business_name}” — paste it into Name, or use Principal Name to search an owner directly.
        </div>
      )}

      {/* Name → TruePeopleSearch. A link, not a scrape: the site runs bot
          protection, so scraping would be brittle and against its terms. */}
      <div>
        <div style={{ ...label, marginBottom: 6 }}>Find the person</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="Owner name from the registry"
            style={{ flex: '1 1 220px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', fontSize: 'var(--text-body)' }}
          />
          <a
            href={people ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!people}
            style={{ ...linkBtn, background: people ? GREEN : '#f3f4f6', color: people ? '#fff' : '#9ca3af', borderColor: people ? GREEN : '#e5e7eb', pointerEvents: people ? 'auto' : 'none' }}
          >
            🔎 TruePeopleSearch
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LeadFlowPool() {
  const { pool, loading, notConnected, removeFromPool } = useLeadflowPool();
  const [sortBy, setSortBy] = useState<'industry' | 'reviews' | 'score'>('score');
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = [...pool].sort((a, b) => {
    if (sortBy === 'industry') return (a.industry || '').localeCompare(b.industry || '');
    if (sortBy === 'score') return (b.fizzle_score || 0) - (a.fizzle_score || 0);
    return (b.review_count || 0) - (a.review_count || 0);
  });

  const sortBtn = (key: typeof sortBy, text: string) => (
    <button onClick={() => setSortBy(key)} style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', background: sortBy === key ? GREEN : '#fff', color: sortBy === key ? '#fff' : '#374151', cursor: 'pointer', fontWeight: 500 }}>{text}</button>
  );

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 4 }}>Lead Pool</h1>
          <p style={{ color: '#9ca3af', fontSize: 'var(--text-subhead)' }}>{pool.length} leads ready to call</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sortBtn('score', 'By Score')}
          {sortBtn('industry', 'By Industry')}
          {sortBtn('reviews', 'By Reviews')}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Loading pool...</p>
      ) : pool.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-2xl)', padding: '3rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎯</div>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Your pool is empty</h3>
          <p style={{ color: '#9ca3af' }}>Go to Lead Finder and click "+ Pool" on any lead to add them here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((lead) => {
            const open = openId === lead.id;
            const stale = staleLabel(lead.days_since_last_review);
            return (
              <div key={lead.id} style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: '1 1 240px', cursor: 'pointer' }} onClick={() => setOpenId(open ? null : lead.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {lead.tier && (
                        <span style={{ fontSize: 'var(--text-caption)', fontWeight: 800, color: '#fff', background: TIER_COLOR[lead.tier] || '#9ca3af', borderRadius: 4, padding: '1px 6px' }}>{lead.tier}</span>
                      )}
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-subhead)' }}>{lead.business_name}</span>
                      {lead.fizzle_score != null && <span style={{ fontSize: 'var(--text-caption)', color: '#9ca3af' }}>{lead.fizzle_score}</span>}
                    </div>
                    <div style={{ fontSize: 'var(--text-body)', color: '#9ca3af', marginTop: 2 }}>
                      {[lead.category || lead.industry, lead.city || lead.state].filter(Boolean).join(' · ')}
                      {lead.review_count ? ` · ⭐ ${lead.review_count}` : ''}
                      {stale ? ` · last review ${stale} ago` : ''}
                    </div>
                    {lead.phone && <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} style={{ fontSize: 'var(--text-body)', color: GREEN, fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>📞 {lead.phone}</a>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setOpenId(open ? null : lead.id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}>{open ? 'Less' : 'Details'}</button>
                    <button onClick={() => removeFromPool(lead.id)} style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 500 }}>Remove</button>
                  </div>
                </div>
                {open && <Detail lead={lead} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
