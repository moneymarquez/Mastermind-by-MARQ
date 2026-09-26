import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { useContentItems, useSocialAccounts } from '../../../data/useContentEngine';
import type { ContentItem, Format, ItemStatus, SocialAccount } from '../../../data/contentEngine';
import { STATUSES, STATUS, FORMATS, PLATFORM, weekDays, weekLabel, dayLabel, nextStatus, avgViews30, latestMetrics, gradePost, GRADE_COLOR } from '../../../data/contentEngine';
import { dateStr, addDaysStr } from '../../../data/time';
import { E, Badge, Drawer, TeachingEmpty, btn, field, label, useIsMobile } from '../ecom/ecomShared';

type ItemsApi = ReturnType<typeof useContentItems>;
type AccountsApi = ReturnType<typeof useSocialAccounts>;
interface Props { items: ItemsApi; accounts: AccountsApi; newOpen: boolean; onCloseNew: () => void }

const FORMAT_ICON: Record<Format, string> = { reel: '🎬', carousel: '🖼️', story: '⏱️', image: '📷', video: '📹', short: '📱', live: '🔴' };

/** §2.2 Plan — the weekly calendar. Each slot is a card; the status runs
 *  idea → script → filmed → edited → approved → posted. C1 plans by hand;
 *  C3 fills the week from the Idea & Script worker into the same cards. */
export default function PlanTab({ items, accounts, newOpen, onCloseNew }: Props) {
  const mobile = useIsMobile();
  const today = dateStr(new Date());
  const [anchor, setAnchor] = useState(today);
  const [accountId, setAccountId] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newFor, setNewFor] = useState<string | null>(null);
  const days = weekDays(anchor);
  const list = items.items.filter((i) => accountId === 'all' || i.account_id === accountId);
  const byDay = (d: string) => list.filter((i) => i.scheduled_for === d).sort((a, b) => (a.scheduled_time ?? '99').localeCompare(b.scheduled_time ?? '99'));
  const backlog = list.filter((i) => !i.scheduled_for && i.status !== 'posted');
  const open = items.items.find((i) => i.id === openId) ?? null;
  const weekCount = list.filter((i) => i.scheduled_for && i.scheduled_for >= days[0] && i.scheduled_for <= days[6]).length;
  const goal = accountId === 'all' ? accounts.accounts.reduce((s, a) => s + a.posts_per_week_goal, 0) : accounts.accounts.find((a) => a.id === accountId)?.posts_per_week_goal ?? 0;
  const acct = (id: string | null) => accounts.accounts.find((a) => a.id === id) ?? null;

  const dayCol: CSSProperties = { background: '#fff', border: '1px solid #f3f4f6', borderRadius: 'var(--radius-md)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <button style={btn('ghost')} onClick={() => setAnchor(addDaysStr(days[0], -7))} aria-label="Previous week">‹</button>
        <span style={{ fontWeight: 700, color: E.text }}>{weekLabel(days)}</span>
        <button style={btn('ghost')} onClick={() => setAnchor(addDaysStr(days[0], 7))} aria-label="Next week">›</button>
        {days[0] !== weekDays(today)[0] && <button style={{ ...btn('ghost'), fontSize: 12 }} onClick={() => setAnchor(today)}>This week</button>}
        <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{weekCount} planned{goal ? ` / ${goal} goal` : ''}</span>
        <div style={{ flex: 1 }} />
        <select style={{ ...field, width: 'auto' }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="all">All accounts</option>
          {accounts.accounts.map((a) => <option key={a.id} value={a.id}>{PLATFORM[a.platform].short} @{a.handle}</option>)}
        </select>
      </div>

      {items.error && <div style={{ color: E.red, marginBottom: 10 }}>{items.error}</div>}
      {!items.loading && items.items.length === 0 && (
        <div style={{ marginBottom: 12 }}>
          <TeachingEmpty what="An empty week. Tap a day's ＋ to add a post idea: concept, hook, format, which account." worker="you (C1) — from C3 the Idea & Script worker fills the week with hooks and shot lists for you to approve" />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
        {days.map((d) => {
          const { dow, day } = dayLabel(d);
          const isToday = d === today;
          const cards = byDay(d);
          return (
            <div key={d} style={{ ...dayCol, borderColor: isToday ? E.green : '#f3f4f6', background: d < today ? '#fafafa' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ ...label, color: isToday ? E.green : E.faint }}>{dow}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: isToday ? E.green : E.text }}>{day}</span>
                <div style={{ flex: 1 }} />
                <button style={{ ...btn('ghost'), padding: '2px 8px', fontSize: 12 }} onClick={() => setNewFor(d)} aria-label={`Add for ${d}`}>＋</button>
              </div>
              {cards.map((i) => <SlotCard key={i.id} i={i} a={acct(i.account_id)} onOpen={() => setOpenId(i.id)} />)}
              {cards.length === 0 && !mobile && <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', padding: '10px 0' }}>—</div>}
            </div>
          );
        })}
      </div>

      {backlog.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...label, marginBottom: 6 }}>Not scheduled yet ({backlog.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {backlog.map((i) => <SlotCard key={i.id} i={i} a={acct(i.account_id)} onOpen={() => setOpenId(i.id)} />)}
          </div>
        </div>
      )}

      {(newOpen || newFor) && <ItemDrawer items={items} accounts={accounts} defaultDate={newFor ?? today} defaultAccount={accountId === 'all' ? accounts.accounts[0]?.id ?? null : accountId} onClose={() => { setNewFor(null); onCloseNew(); }} />}
      {open && <ItemDrawer items={items} accounts={accounts} item={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function SlotCard({ i, a, onOpen }: { i: ContentItem; a: SocialAccount | null; onOpen: () => void }) {
  const st = STATUS[i.status];
  return (
    <div onClick={onOpen} style={{ border: '1px solid #f3f4f6', borderLeft: `3px solid ${st.color}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', background: '#fff', display: 'flex', gap: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      {i.thumbnail_url ? <img src={i.thumbnail_url} alt="" style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} /> : <div style={{ width: 34, height: 44, borderRadius: 4, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{FORMAT_ICON[i.format]}</div>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: E.text, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{i.concept}</div>
        {i.hooks[0] && <div style={{ fontSize: 11, color: E.muted, lineHeight: 1.25, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>“{i.hooks[0]}”</div>}
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: st.color }}>{st.label}</span>
          {a && <span style={{ fontSize: 10, color: E.faint }}>· {PLATFORM[a.platform].short} @{a.handle}</span>}
          {i.scheduled_time && <span style={{ fontSize: 10, color: E.faint, fontFamily: 'var(--font-mono)' }}>· {i.scheduled_time.slice(0, 5)}</span>}
          {i.grade && <Badge color={GRADE_COLOR[i.grade]}>{i.grade}/4</Badge>}
        </div>
      </div>
    </div>
  );
}

function ItemDrawer({ items, accounts, item, defaultDate, defaultAccount, onClose }: { items: ItemsApi; accounts: AccountsApi; item?: ContentItem; defaultDate?: string; defaultAccount?: string | null; onClose: () => void }) {
  const [concept, setConcept] = useState(item?.concept ?? '');
  const [accountId, setAccountId] = useState<string>(item?.account_id ?? defaultAccount ?? '');
  const [format, setFormat] = useState<Format>(item?.format ?? 'reel');
  const [date, setDate] = useState(item?.scheduled_for ?? defaultDate ?? '');
  const [time, setTime] = useState(item?.scheduled_time?.slice(0, 5) ?? '');
  const [hooks, setHooks] = useState((item?.hooks ?? []).join('\n'));
  const [script, setScript] = useState(item?.script ?? '');
  const [shots, setShots] = useState((item?.shot_list ?? []).join('\n'));
  const [caption, setCaption] = useState(item?.caption ?? '');
  const [hashtags, setHashtags] = useState(item?.hashtags ?? '');
  const [visual, setVisual] = useState(item?.visual_prompt ?? '');
  const [thumb, setThumb] = useState(item?.thumbnail_url ?? '');
  const [postUrl, setPostUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(false);
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const payload = () => ({ concept: concept.trim(), account_id: accountId || null, format, scheduled_for: date || null, scheduled_time: time ? `${time}:00` : null, hooks: lines(hooks), script: script.trim() || null, shot_list: lines(shots), caption: caption.trim() || null, hashtags: hashtags.trim() || null, visual_prompt: visual.trim() || null, thumbnail_url: thumb.trim() || null });

  const save = async () => {
    if (!concept.trim() || busy) return;
    setBusy(true);
    if (item) await items.update(item.id, payload()); else await items.create(payload());
    setBusy(false); onClose();
  };
  const advance = async () => {
    if (!item) return;
    const n = nextStatus(item.status);
    if (!n) return;
    if (n === 'posted') { setPosting(true); return; }
    await items.update(item.id, { ...payload(), status: n });
  };
  /** Posted = a real social_posts row (so metrics and the grade have a home), linked back. */
  const markPosted = async () => {
    if (!item || !accountId || busy) return;
    setBusy(true);
    const post = await accounts.addPost({ account_id: accountId, url: postUrl.trim() || null, type: format, hook: lines(hooks)[0] ?? null, caption: caption.trim() || null, posted_at: new Date().toISOString(), content_item_id: item.id, thumbnail_url: thumb.trim() || null });
    await items.update(item.id, { ...payload(), status: 'posted', posted_post_id: post?.id ?? null });
    setBusy(false); setPosting(false); onClose();
  };
  const post = item?.posted_post_id ? accounts.posts.find((p) => p.id === item.posted_post_id) ?? null : null;
  const grade = post ? gradePost(latestMetrics(accounts.metrics[post.id] ?? [])?.views, avgViews30(accounts.posts.filter((p) => p.account_id === post.account_id), accounts.metrics)) : null;
  const ta = (v: string, on: (x: string) => void, ph: string, h = 70) => <textarea style={{ ...field, minHeight: h, resize: 'vertical' }} value={v} onChange={(e) => on(e.target.value)} placeholder={ph} />;

  return (
    <Drawer open onClose={onClose} title={item ? item.concept : 'New post idea'} subtitle={item ? `${STATUS[item.status].label}${item.scheduled_for ? ` · ${item.scheduled_for}` : ''}` : 'Concept, hook, format, account. The rest can come later.'} width={600}>
      {item && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {STATUSES.map((s, idx) => {
            const cur = STATUSES.findIndex((x) => x.id === item.status);
            const done = idx <= cur;
            return <button key={s.id} onClick={() => items.update(item.id, { status: s.id as ItemStatus })} style={{ ...btn('ghost'), padding: '4px 10px', fontSize: 12, background: done ? s.color : '#fff', color: done ? '#fff' : E.muted, border: done ? 'none' : `1px solid ${E.border}` }}>{s.label}</button>;
          })}
          {nextStatus(item.status) && <button style={{ ...btn('primary'), padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={advance}>{nextStatus(item.status) === 'posted' ? 'Mark posted' : `→ ${STATUS[nextStatus(item.status)!].label}`}</button>}
        </div>
      )}
      {posting && (
        <div style={{ ...E.card, padding: 12, marginBottom: 12, borderColor: E.green }}>
          <div style={{ ...label, marginBottom: 4 }}>Link to the published post</div>
          <input style={field} value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://…" autoFocus />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={btn('primary')} disabled={busy || !accountId} onClick={markPosted}>{busy ? 'Saving…' : 'Posted — create the post record'}</button>
            <button style={btn('ghost')} onClick={() => setPosting(false)}>Cancel</button>
          </div>
          {!accountId && <div style={{ fontSize: 12, color: E.amber, marginTop: 6 }}>Pick an account first — the post's numbers live under it.</div>}
        </div>
      )}
      {post && (
        <div style={{ ...E.card, padding: 12, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: E.text }}>Published {new Date(post.posted_at).toLocaleDateString()}</span>
          {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: 13 }}>open</a>}
          {grade ? <Badge color={GRADE_COLOR[grade.grade]} title={grade.reason}>{grade.grade}/4 · {grade.reason}</Badge> : <span style={{ fontSize: 12, color: E.faint }}>Grade appears once the post has views and the account has a 30-day average — update numbers from the account.</span>}
        </div>
      )}
      <div style={{ ...label, marginBottom: 4 }}>Concept</div>
      <input style={field} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="The morning text that runs my whole day" autoFocus={!item} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <select style={{ ...field, width: 'auto', flex: '1 1 140px' }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">No account yet</option>
          {accounts.accounts.map((a) => <option key={a.id} value={a.id}>{PLATFORM[a.platform].short} @{a.handle}</option>)}
        </select>
        <select style={{ ...field, width: 'auto' }} value={format} onChange={(e) => setFormat(e.target.value as Format)}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
        <input style={{ ...field, width: 'auto' }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input style={{ ...field, width: 'auto' }} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Hooks (one per line — the first is the one on the card)</div>{ta(hooks, setHooks, 'I deleted every app but one.\nThis text at 6am runs my whole day.\nNobody told me the hard part of discipline is the reminder.', 64)}</div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Script</div>{ta(script, setScript, 'Beat by beat. On-screen text in [brackets].', 110)}</div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Shot list (one per line)</div>{ta(shots, setShots, 'Phone on the nightstand, 6:00 alarm\nWalking to the truck, over the shoulder\nScreen recording of the morning text', 64)}</div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Caption</div>{ta(caption, setCaption, '', 56)}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1 }}><div style={{ ...label, marginBottom: 4 }}>Hashtags</div><input style={field} value={hashtags} onChange={(e) => setHashtags(e.target.value)} /></div>
        <div style={{ flex: 1 }}><div style={{ ...label, marginBottom: 4 }}>Thumbnail URL</div><input style={field} value={thumb} onChange={(e) => setThumb(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 10 }}><div style={{ ...label, marginBottom: 4 }}>Visual prompt (for the Clip Editor / Higgsfield, C4)</div>{ta(visual, setVisual, '', 48)}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={btn('primary')} disabled={busy || !concept.trim()} onClick={save}>{busy ? 'Saving…' : item ? 'Save' : 'Add to plan'}</button>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        {item && <button style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={async () => { if (confirm('Delete this idea?')) { await items.remove(item.id); onClose(); } }}>Delete</button>}
      </div>
    </Drawer>
  );
}
