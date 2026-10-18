import { useEffect, useState } from 'react';
import { S, LINKS } from './shared';

// The public site's launch switch and the waitlist form (Addendum 2 §1).
// launch_mode lives in the owner's site_settings and comes down through
// /api/site/config. Anything but a clear "open" means the waitlist, so a slow
// or failed request never shows a pay button early.
export interface SiteConfig {
  launch_mode: 'waitlist' | 'open';
  founding: { price_usd: number; limit: number; spots_left: number; headline: string; blurb: string };
  copy: { headline: string; sub: string };
}
export const FALLBACK_CONFIG: SiteConfig = {
  launch_mode: 'waitlist',
  founding: { price_usd: 19.99, limit: 100, spots_left: 100, headline: 'Founding Member', blurb: 'The first 100 members lock $19.99/mo for life, get first access, and their first month free.' },
  copy: { headline: 'Masterminds opens soon. Founding members get in first.', sub: 'Join the waitlist. The first 100 lock $19.99/mo for life, get first access, and their first month free.' },
};

let cached: SiteConfig | null = null;
let inflight: Promise<SiteConfig> | null = null;
function loadConfig(): Promise<SiteConfig> {
  if (cached) return Promise.resolve(cached);
  inflight ??= fetch('/api/site/config').then((r) => (r.ok ? r.json() : null)).then((j: SiteConfig | null) => {
    cached = j && (j.launch_mode === 'open' || j.launch_mode === 'waitlist') ? { ...FALLBACK_CONFIG, ...j, founding: { ...FALLBACK_CONFIG.founding, ...j.founding }, copy: { ...FALLBACK_CONFIG.copy, ...j.copy } } : FALLBACK_CONFIG;
    return cached;
  }).catch(() => FALLBACK_CONFIG);
  return inflight;
}
export function useSiteConfig(): SiteConfig {
  const [c, setC] = useState<SiteConfig>(cached ?? FALLBACK_CONFIG);
  useEffect(() => { let on = true; void loadConfig().then((x) => { if (on) setC(x); }); return () => { on = false; }; }, []);
  return c;
}

/** The primary call to action for the current mode. */
export function useCta(onHome: boolean) {
  const c = useSiteConfig();
  const waitlist = c.launch_mode === 'waitlist';
  return { waitlist, config: c, label: waitlist ? 'Join the waitlist' : 'Start 7-day free trial', navLabel: waitlist ? 'Join the waitlist' : 'Free trial', href: waitlist ? (onHome ? '#start' : '/home#start') : LINKS.signup, sub: waitlist ? 'Free to join. No card.' : '$19.99/mo after the trial · cancel any time' };
}

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
function fromUrl() {
  try {
    const q = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const k of UTM) { const v = q.get(k); if (v) utm[k] = v; }
    return { code: (q.get('code') ?? '').trim().toUpperCase().slice(0, 32), utm, source: q.get('ref') ?? q.get('utm_source') ?? '' };
  } catch { return { code: '', utm: {}, source: '' }; }
}

/** The waitlist card: headline, the live founding counter, and the form. Works inline, no page change. */
export function WaitlistCard({ dark = false, id }: { dark?: boolean; id?: string }) {
  const c = useSiteConfig();
  const init = fromUrl();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState(init.code);
  const [hp, setHp] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ spot: number; founding: boolean; already: boolean } | null>(null);
  const f = c.founding;
  const ink = dark ? '#fbf9f4' : '#1b1a17', mute = dark ? '#b8b3a8' : '#6b665c', line = dark ? '#3a3833' : '#ddd8cc', fieldBg = dark ? '#26241f' : '#fff';
  const field = `height:48px; padding:0 14px; font-size:16px; border-radius:10px; border:1px solid ${line}; background:${fieldBg}; color:${ink}; font-family:inherit; width:100%; box-sizing:border-box;`;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('busy'); setErr('');
    const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, name, code, website: hp, source: init.source, utm: init.utm }) }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { error?: string; spot?: number; founding?: boolean; already?: boolean }) : {};
    if (!r || !r.ok) { setState('error'); setErr(j.error ?? 'Something went wrong. Try again.'); return; }
    setRes({ spot: j.spot ?? 0, founding: !!j.founding, already: !!j.already }); setState('done');
    cached = null; inflight = null;
  };
  return (
    <div id={id} style={S(`background:${dark ? '#1b1a17' : '#fff'}; color:${ink}; border:1px solid ${dark ? '#1b1a17' : '#e2ddd2'}; border-radius:12px; padding:32px; display:flex; flex-direction:column; gap:16px; text-align:left;`)}>
      <span style={S(`font-size:11px; font-weight:500; letter-spacing:.14em; color:${mute};`)}>THE WAITLIST</span>
      <span style={S('font-size:26px; line-height:1.15; font-weight:480; letter-spacing:-0.02em;')}>{c.copy.headline}</span>
      <span style={S(`font-size:15px; line-height:1.5; color:${mute};`)}>{c.copy.sub}</span>
      <div style={S(`display:flex; flex-direction:column; gap:4px; padding:14px 16px; border-radius:10px; border:1px solid ${line};`)}>
        <span style={S("font-family:'IBM Plex Mono',monospace; font-size:13px;")}>{f.spots_left > 0 ? `${f.spots_left} of ${f.limit} founding spots left` : 'Founding spots are full'}</span>
        <span style={S(`font-size:13px; line-height:1.45; color:${mute};`)}>{f.spots_left > 0 ? `${f.headline}: $${f.price_usd}/mo locked for life, first access, first month free.` : 'Join the waitlist for launch access. We keep collecting.'}</span>
      </div>
      {state === 'done' && res ? (
        <div role="status" style={S('padding:16px; border-radius:10px; background:#e8f6ee; color:#14532d; font-size:15px; line-height:1.5;')}>
          {res.already ? `You're already on the list, spot #${res.spot}.` : `You're in, spot #${res.spot}.`}{' '}
          {res.founding ? 'You hold a founding spot: your price is locked and your first month is free.' : 'Founding spots are full, but you\'ll get launch access.'} Watch your email.
        </div>
      ) : (
        <form onSubmit={submit} style={S('display:flex; flex-direction:column; gap:10px;')}>
          <input className="wl-field" value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" required placeholder="Email" aria-label="Email" style={S(field)} />
          <input className="wl-field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="First name (optional)" aria-label="First name" style={S(field)} />
          <input className="wl-field" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" placeholder="Code (optional)" aria-label="Code" style={S(field)} />
          {/* Honeypot: hidden from people, irresistible to bots. */}
          <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" style={S('position:absolute; left:-9999px; width:1px; height:1px; opacity:0;')} />
          {err && <span role="alert" style={S('color:#b91c1c; font-size:14px;')}>{err}</span>}
          <button type="submit" disabled={state === 'busy' || !email.trim()} className="lp-h-primary" style={S('height:50px; border:0; border-radius:999px; background:#5266eb; color:#fff; font-size:16px; font-weight:500; cursor:pointer;')}>{state === 'busy' ? 'Joining…' : 'Join the waitlist'}</button>
          <span style={S(`font-size:12px; line-height:1.5; color:${mute};`)}>One email when the doors open. No spam, unsubscribe any time.</span>
        </form>
      )}
    </div>
  );
}
