import { useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api as callApi } from '../../../lib/api';
import { PLATFORM, compact } from '../../../data/contentEngine';
import type { SocialAccount, SocialPost } from '../../../data/contentEngine';
import type { useSocialAccounts } from '../../../data/useContentEngine';
import { profileView, draftHasChanges, BIO_LIMIT, NAME_LIMIT } from '../../../data/profileMock';
import type { ProfileDraft, PublicProfile } from '../../../data/profileMock';
import { E, Badge, btn, field, label } from '../ecom/ecomShared';

type Api = ReturnType<typeof useSocialAccounts>;
const PROFILE_URL: Record<string, (h: string) => string> = { instagram: (h) => `https://www.instagram.com/${h}/`, tiktok: (h) => `https://www.tiktok.com/@${h}` };
const EDIT_URL: Record<string, string> = { instagram: 'https://www.instagram.com/accounts/edit/', tiktok: 'https://www.tiktok.com/setting' };
const ACCT_TYPE: Record<string, string> = { BUSINESS: 'Business account', MEDIA_CREATOR: 'Creator account', CREATOR: 'Creator account', PERSONAL: 'Personal account' };

/** Profiles: every account's public page in one place, drawn like a profile page, with AI help editing it. */
export default function ProfilesTab({ accounts }: { accounts: Api }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = accounts.accounts.find((a) => a.id === openId) ?? null;
  if (open) return <ProfileEditor a={open} api={accounts} onBack={() => setOpenId(null)} />;
  return (
    <div>
      {accounts.accounts.length === 0 && <div style={{ ...E.card, padding: 16, color: E.muted, fontSize: 'var(--text-body)' }}>No accounts yet. Add or connect one on Accounts, then press Sync.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {accounts.accounts.map((a) => {
          const v = profileView(a.platform, a.handle, a.profile as PublicProfile, a.profile_draft as ProfileDraft | null, { avatar: a.avatar_url, followers: a.followers, display: a.display_name });
          return (
            <button key={a.id} onClick={() => setOpenId(a.id)} style={{ ...E.card, padding: 16, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, font: 'inherit', color: E.text }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Pic src={v.avatar} name={a.handle} size={56} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name || a.handle}</div>
                  <div style={{ fontSize: 13, color: E.faint }}>@{a.handle} · {PLATFORM[a.platform].label}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, fontSize: 13, color: E.muted }}>
                <span><strong style={{ color: E.text }}>{compact(v.posts)}</strong> posts</span><span><strong style={{ color: E.text }}>{compact(v.followers)}</strong> followers</span><span><strong style={{ color: E.text }}>{compact(v.following)}</strong> following</span>
              </div>
              <div style={{ fontSize: 13.5, color: E.muted, lineHeight: 1.4, minHeight: 38, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{v.bio || 'No bio yet. Sync to read it, or write one.'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {a.profile_synced_at ? <Badge color={E.green}>Synced</Badge> : <Badge color={E.faint}>Not synced</Badge>}
                {draftHasChanges(v) && <Badge color={E.amber}>Draft changes</Badge>}
                {a.live_posting && <Badge color={E.red}>LIVE</Badge>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pic({ src, name, size }: { src: string | null; name: string; size: number }) {
  const [bad, setBad] = useState(false);
  return (
    <div style={{ padding: 2, borderRadius: '50%', background: 'conic-gradient(from 200deg, var(--accent), var(--success), var(--accent))', flexShrink: 0 }}>
      <div style={{ padding: 2, borderRadius: '50%', background: 'var(--surface)' }}>
        {src && !bad ? <img src={src} alt="" onError={() => setBad(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} /> : <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--surface-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: E.muted, fontSize: size / 2.6 }}>{name.slice(0, 2).toUpperCase()}</div>}
      </div>
    </div>
  );
}

function ProfileEditor({ a, api, onBack }: { a: SocialAccount; api: Api; onBack: () => void }) {
  const live = (a.profile ?? {}) as PublicProfile;
  const saved = (a.profile_draft ?? {}) as ProfileDraft;
  const [d, setD] = useState<ProfileDraft>(saved);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [ask, setAsk] = useState('');
  const [sug, setSug] = useState<{ bios: string[]; names: string[]; links: string[]; notes: string } | null>(null);
  const [tab, setTab] = useState<'posts' | 'reels'>('posts');
  const posts = useMemo(() => api.posts.filter((p) => p.account_id === a.id).sort((x, y) => +new Date(y.posted_at) - +new Date(x.posted_at)), [api.posts, a.id]);
  const v = profileView(a.platform, a.handle, live, d, { avatar: a.avatar_url, followers: a.followers, display: a.display_name });
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = (k: keyof ProfileDraft, val: string | string[]) => setD((x) => ({ ...x, [k]: val }));
  const shown: SocialPost[] = tab === 'reels' ? posts.filter((p) => p.type === 'reel' || p.type === 'video' || p.type === 'short') : posts;

  const save = async (next: ProfileDraft | null) => {
    setBusy('save'); setMsg('');
    const { error } = await supabase.from('social_accounts').update({ profile_draft: next && Object.keys(next).length ? next : null, updated_at: new Date().toISOString() }).eq('id', a.id);
    setBusy(''); setMsg(error ? error.message : next ? 'Draft saved.' : 'Draft cleared.'); if (!error && !next) setD({});
    await api.reload();
  };
  const sync = async () => { setBusy('sync'); setMsg(''); const r = await callApi<{ results?: { handle: string; ok: boolean; detail: string }[]; error?: string }>('/api/content/sync-accounts', { body: {} }); setBusy(''); setMsg(r.error ?? (r.results ?? []).filter((x) => x.handle.toLowerCase() === a.handle.toLowerCase()).map((x) => `${x.ok ? '✓' : '✕'} ${x.detail}`).join(' ') ?? ''); await api.reload(); };
  const suggest = async (instruction: string) => {
    setBusy('ai'); setMsg(''); setSug(null);
    const r = await callApi<{ bios?: string[]; names?: string[]; links?: string[]; notes?: string; error?: string }>('/api/content/profile-ai', { body: { account_id: a.id, instruction, current: { name: v.name, bio: v.bio, website: v.website, category: v.category } } });
    setBusy('');
    if (r.error) { setMsg(r.error); return; }
    setSug({ bios: r.bios ?? [], names: r.names ?? [], links: r.links ?? [], notes: r.notes ?? '' });
  };
  const copy = (t: string) => { void navigator.clipboard?.writeText(t).then(() => setMsg('Copied. Paste it into the platform.')).catch(() => setMsg('Copy failed. Select the text and copy it by hand.')); };
  const changes = [v.changed.name && `Name: ${v.name}`, v.changed.bio && `Bio: ${v.bio}`, v.changed.website && `Link: ${v.website}`].filter(Boolean).join('\n');
  const platformUrl = (PROFILE_URL[a.platform] ?? (() => ''))(a.handle);
  const rows: [string, string, string][] = [
    ['Username', `@${v.username}`, 'platform'], ['Name', v.name || '', 'platform'], ['Account type', ACCT_TYPE[v.accountType] ?? v.accountType, 'platform'], ['Verified', v.verified ? 'Yes' : a.profile_synced_at ? 'No' : '', 'platform'],
    ['Bio', v.bio, 'platform'], ['Link', v.website, 'platform'], ['Profile picture', v.avatar ? 'Set' : '', 'platform'],
    ['Posts', v.posts != null ? String(v.posts) : '', 'platform'], ['Followers', v.followers != null ? String(v.followers) : '', 'platform'], ['Following', v.following != null ? String(v.following) : '', 'platform'], ['Total likes', v.likes != null ? String(v.likes) : '', 'platform'],
    ['Category label', v.category, 'you'], ['Contact email', v.email, 'you'], ['Contact phone', v.phone, 'you'], ['Address', v.address, 'you'], ['Highlights', v.highlights.join(', '), 'you'], ['Page address', platformUrl, 'platform'],
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button style={btn('ghost')} onClick={onBack}>← All profiles</button>
        <strong style={{ color: E.text }}>@{a.handle}</strong><span style={{ color: E.faint, fontSize: 13 }}>{PLATFORM[a.platform].label}{a.profile_synced_at ? ` · synced ${new Date(a.profile_synced_at).toLocaleDateString()}` : ' · not synced'}</span>
        <button style={{ ...btn('ghost'), marginLeft: 'auto' }} disabled={!!busy} onClick={() => void sync()}>{busy === 'sync' ? 'Syncing…' : 'Sync from platform'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'start' }}>
        {/* The page, as it would look */}
        <div style={{ ...E.card, padding: 16, maxWidth: 460 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontWeight: 700, color: E.text }}>@{v.username}{v.verified && <span title="Verified" style={{ color: E.blue }}>✔</span>}{draftHasChanges(v) && <Badge color={E.amber}>Draft preview</Badge>}</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Pic src={v.avatar} name={a.handle} size={76} />
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', gap: 4 }}>
              {[['posts', v.posts], ['followers', v.followers], [a.platform === 'tiktok' ? 'likes' : 'following', a.platform === 'tiktok' ? v.likes : v.following]].map(([k, n]) => <div key={String(k)}><div style={{ fontSize: 18, fontWeight: 700, color: E.text }}>{n == null ? '—' : compact(n as number)}</div><div style={{ fontSize: 12, color: E.faint }}>{String(k)}</div></div>)}
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: v.changed.name ? E.amber : E.text }}>{v.name || <span style={{ color: E.faint, fontWeight: 400 }}>No name</span>}</div>
            {(v.category || v.accountType) && <div style={{ fontSize: 13, color: E.faint }}>{v.category || ACCT_TYPE[v.accountType] || v.accountType}</div>}
            <div style={{ fontSize: 14, color: v.changed.bio ? E.amber : E.text, whiteSpace: 'pre-wrap', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{v.bio || <span style={{ color: E.faint }}>No bio</span>}</div>
            {v.website && <div style={{ fontSize: 14, color: E.blue, overflowWrap: 'anywhere' }}>🔗 {v.website.replace(/^https?:\/\//, '')}</div>}
            {(v.email || v.phone || v.address) && <div style={{ fontSize: 13, color: E.muted, marginTop: 4 }}>{[v.email, v.phone, v.address].filter(Boolean).join(' · ')}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, margin: '12px 0' }}>
            {['Follow', 'Message', ...(v.email || v.phone ? ['Contact'] : [])].map((t) => <div key={t} style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8, background: t === 'Follow' ? E.blue : 'var(--surface-4)', color: t === 'Follow' ? 'var(--bg)' : E.text, fontSize: 13, fontWeight: 600, opacity: 0.85 }}>{t}</div>)}
          </div>
          {v.highlights.length > 0 && <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>{v.highlights.map((h) => <div key={h} style={{ textAlign: 'center', flex: 'none', width: 64 }}><div style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${E.border}`, margin: '0 auto', background: 'var(--surface-4)' }} /><div style={{ fontSize: 11.5, color: E.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</div></div>)}</div>}
          <div style={{ display: 'flex', borderTop: `1px solid ${E.border}` }}>
            {(['posts', 'reels'] as const).map((t) => <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', border: 0, borderTop: tab === t ? `2px solid ${E.text}` : '2px solid transparent', background: 'none', color: tab === t ? E.text : E.faint, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>{t === 'posts' ? '▦ Posts' : '▶ Reels'}</button>)}
          </div>
          {shown.length === 0 ? <div style={{ fontSize: 13, color: E.faint, padding: '14px 0' }}>Nothing here yet. Sync to pull in the latest posts.</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {shown.slice(0, 30).map((p) => <div key={p.id} style={{ aspectRatio: '1 / 1', background: 'var(--surface-4)', overflow: 'hidden', position: 'relative' }}>{p.thumbnail_url ? <img src={p.thumbnail_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ padding: 6, fontSize: 11, color: E.muted, overflow: 'hidden' }}>{(p.hook || p.caption || '').slice(0, 50)}</div>}</div>)}
            </div>
          )}
        </div>

        {/* Edit with AI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ ...E.card, padding: 14 }}>
            <div style={{ ...label, marginBottom: 8 }}>Ask AI to improve it</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {['Write 3 bio options in my voice', 'Make my bio punchier', 'Add a clear call to action', 'Suggest a name people will search for', 'Suggest what to put in the link'].map((c) => <button key={c} style={{ ...btn('ghost'), minHeight: 32, fontSize: 12.5, padding: '0 10px' }} disabled={!!busy} onClick={() => void suggest(c)}>{c}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...field, flex: 1, minWidth: 0 }} placeholder="Or tell it what you want…" value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ask.trim()) void suggest(ask.trim()); }} />
              <button style={btn('primary')} disabled={!!busy || !ask.trim()} onClick={() => void suggest(ask.trim())}>{busy === 'ai' ? 'Thinking…' : 'Ask'}</button>
            </div>
            {sug && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sug.notes && <div style={{ fontSize: 13, color: E.muted }}>{sug.notes}</div>}
                {([['bios', 'bio', 'bio'], ['names', 'name', 'name'], ['links', 'link', 'website']] as const).map(([k, l, field_]) => sug[k].map((t, i) => (
                  <div key={`${k}${i}`} style={{ border: `1px solid ${E.border}`, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, color: E.faint }}>{l} option {i + 1}{k === 'bios' ? ` · ${t.length}/${BIO_LIMIT[a.platform] ?? 150}` : ''}</div>
                    <div style={{ fontSize: 14, color: E.text, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{t}</div>
                    <button style={{ ...btn('ghost'), minHeight: 30, fontSize: 12.5, marginTop: 6 }} onClick={() => set(field_ as keyof ProfileDraft, t)}>Use this in the draft</button>
                  </div>
                )))}
                {!sug.bios.length && !sug.names.length && !sug.links.length && <div style={{ fontSize: 13, color: E.faint }}>No options came back. Try asking differently.</div>}
              </div>
            )}
          </div>

          <div style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>Draft changes</div>
            <Fld l="Name" max={NAME_LIMIT[a.platform] ?? 64} v={d.name ?? v.name} on={(x) => set('name', x)} />
            <Fld l="Bio" max={BIO_LIMIT[a.platform] ?? 150} v={d.bio ?? v.bio} on={(x) => set('bio', x)} area />
            <Fld l="Link" v={d.website ?? v.website} on={(x) => set('website', x)} />
            <Fld l="Category label" v={d.category ?? ''} on={(x) => set('category', x)} ph="e.g. Digital creator" />
            <Fld l="Contact email" v={d.email ?? ''} on={(x) => set('email', x)} />
            <Fld l="Contact phone" v={d.phone ?? ''} on={(x) => set('phone', x)} />
            <Fld l="Address" v={d.address ?? ''} on={(x) => set('address', x)} />
            <Fld l="Highlights (one per line)" v={(d.highlights ?? []).join('\n')} on={(x) => set('highlights', x.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 12))} area />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btn('primary')} disabled={!!busy || !dirty} onClick={() => void save(d)}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
              <button style={btn('ghost')} disabled={!!busy || !(a.profile_draft || dirty)} onClick={() => void save(null)}>Discard draft</button>
            </div>
            <div style={{ fontSize: 12.5, color: E.faint, lineHeight: 1.5 }}>
              <strong>{PLATFORM[a.platform].label} doesn't let apps change a profile</strong>, so edits here are drafts. To apply them: copy a field, open the platform's edit page, paste, save, then press <em>Sync from platform</em>.
            </div>
            {changes && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={btn('ghost')} onClick={() => copy(changes)}>Copy all changes</button>
                {EDIT_URL[a.platform] && <a href={EDIT_URL[a.platform]} target="_blank" rel="noopener noreferrer" style={{ ...btn('ghost'), textDecoration: 'none' }}>Open {PLATFORM[a.platform].label} edit page ↗</a>}
              </div>
            )}
            {msg && <div role="status" style={{ fontSize: 13, color: E.muted, overflowWrap: 'anywhere' }}>{msg}</div>}
          </div>

          <div style={{ ...E.card, padding: 14 }}>
            <div style={{ ...label, marginBottom: 6 }}>Everything public on this page</div>
            {rows.map(([k, val, src]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gap: 10, padding: '6px 0', borderTop: `1px solid ${E.border}`, fontSize: 13.5 }}>
                <span style={{ color: E.faint }}>{k}</span>
                <span style={{ color: val ? E.text : E.faint, overflowWrap: 'anywhere' }}>{val || (src === 'platform' ? (a.profile_synced_at ? 'Not provided by the platform' : 'Sync to read it') : 'Not set. Add it above.')}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: E.faint, marginTop: 6 }}>Category, contact details, address and highlights aren't available from {PLATFORM[a.platform].label}'s API, so they're ones you type in above.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fld({ l, v, on, max, area, ph }: { l: string; v: string; on: (x: string) => void; max?: number; area?: boolean; ph?: string }) {
  const over = max != null && v.length > max;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: E.faint, marginBottom: 3 }}><span>{l}</span>{max != null && <span style={{ color: over ? E.red : E.faint }}>{v.length}/{max}</span>}</div>
      {area ? <textarea style={{ ...field, minHeight: 74, fontFamily: 'inherit' }} value={v} placeholder={ph} onChange={(e) => on(e.target.value)} /> : <input style={field} value={v} placeholder={ph} onChange={(e) => on(e.target.value)} />}
    </div>
  );
}
