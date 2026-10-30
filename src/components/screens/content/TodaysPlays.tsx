import { useMemo, useState } from 'react';
import type { useSocialAccounts, useContentItems, useInspiration } from '../../../data/useContentEngine';
import { buildPlays, withPlayState, PLAY_FORMATS } from '../../../data/contentPlays';
import type { Play, PlayState } from '../../../data/contentPlays';
import { E, Badge, btn, label, tint } from '../ecom/ecomShared';
import { useModule } from '../../mm/Page';

const localToday = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Content bot, trend-first: today's to-do cards built from the Trend
 *  Researcher's saved finds. Nothing here posts. "Open in Studio" puts a
 *  prefilled idea on the Plan (hook, script, shots, Higgsfield prompt),
 *  copies the prompt, and opens Studio. */
export default function TodaysPlays({ inspiration, accounts, items }: { inspiration: ReturnType<typeof useInspiration>; accounts: ReturnType<typeof useSocialAccounts>; items: ReturnType<typeof useContentItems> }) {
  const { nav } = useModule();
  const today = localToday();
  const [showHandled, setShowHandled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const plays = useMemo(() => buildPlays({ inspiration: inspiration.rows, accounts: accounts.accounts, posts: accounts.posts, today, includeHandled: showHandled }), [inspiration.rows, accounts.accounts, accounts.posts, today, showHandled]);

  const mark = async (p: Play, state: PlayState) => {
    const row = inspiration.rows.find((r) => r.id === p.inspirationId);
    setBusy(p.id);
    const ok = await inspiration.setTags(p.inspirationId, withPlayState(row?.tags, state, today));
    setBusy(null);
    setMsg(ok ? (state === 'done' ? 'Marked done.' : state === 'skip' ? 'Skipped.' : state === 'later' ? 'Back tomorrow.' : 'Reopened.') : 'Could not save that. Try again.');
  };

  const openInStudio = async (p: Play) => {
    setBusy(p.id);
    const created = await items.create({ concept: p.whatToPost.slice(0, 300), account_id: p.accountId, status: 'idea', format: p.itemFormat, hooks: [p.hook], script: p.script, shot_list: p.shots, visual_prompt: p.studioPrompt });
    try { await navigator.clipboard?.writeText(p.studioPrompt); } catch { /* clipboard blocked: prompt is still on the Plan item */ }
    setBusy(null);
    if (!created) { setMsg('Could not create the idea. Try again.'); return; }
    nav('content-studio');
  };

  const stateColor: Record<PlayState, string> = { open: E.accent, done: E.green, skip: E.faint, later: E.amber };

  return (
    <div style={{ ...E.card, padding: 14, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 'var(--text-subhead)', color: E.text }}>Today's plays</strong>
        <Badge color={E.faint}>{plays.filter((p) => p.state === 'open').length} open</Badge>
        <button style={{ ...btn('ghost'), marginLeft: 'auto', minHeight: 32, padding: '0 10px', fontSize: 13 }} onClick={() => setShowHandled((s) => !s)}>{showHandled ? 'Hide done/skipped' : 'Show done/skipped'}</button>
      </div>
      <div style={{ fontSize: 12.5, color: E.faint, marginTop: 4, lineHeight: 1.45 }}>
        Built from the Trend Researcher's finds (Trends tab). Nothing here posts. Label AI-made content when you publish it: TikTok requires the "AI-generated" label on realistic AI images, video or audio, and Meta (Instagram, Facebook) requires the "Made with AI" / AI info disclosure for photorealistic AI video or audio.
      </div>
      {msg && <div role="status" style={{ fontSize: 13.5, color: E.muted, marginTop: 8 }}>{msg}</div>}
      {inspiration.loading && <div style={{ fontSize: 14, color: E.faint, marginTop: 10 }}>Loading trends…</div>}
      {!inspiration.loading && plays.length === 0 && (
        <div style={{ fontSize: 14, color: E.muted, marginTop: 10 }}>No plays today. Run "Find what's working" on the Trends tab (or let the nightly Trend Researcher run) and approve what it finds. <button style={{ ...btn('ghost'), minHeight: 32, padding: '0 10px', fontSize: 13 }} onClick={() => nav('content-inspiration')}>Open Trends</button></div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {plays.map((p) => {
          const expanded = open === p.id;
          return (
            <div key={p.id} style={{ border: `1px solid ${E.border}`, borderRadius: 'var(--g-r-lg)', padding: 12, opacity: p.state === 'open' || p.state === 'later' ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge color={E.text}>{PLAY_FORMATS[p.format]}</Badge>
                <Badge color={E.faint}>{p.platformLabel}</Badge>
                {p.state !== 'open' && <Badge color={stateColor[p.state]}>{p.state === 'later' ? 'Later' : p.state === 'done' ? 'Done' : 'Skipped'}</Badge>}
                <span style={{ fontWeight: 700, color: E.text, fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{p.trend}</span>
              </div>
              <div style={{ fontSize: 13.5, color: E.muted, marginTop: 6, lineHeight: 1.45 }}><span style={label}>Why now</span> {p.whyNow} <a href={p.source.url} target="_blank" rel="noreferrer" style={{ color: E.accent }}>{p.source.label} ↗</a></div>
              <div style={{ fontSize: 12.5, color: E.faint, marginTop: 2 }}>{p.signal}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8, marginTop: 8, fontSize: 14, color: E.text }}>
                <div><div style={label}>What to post</div>{p.whatToPost}</div>
                <div><div style={label}>Hook (first 2 seconds)</div>"{p.hook}"</div>
                <div><div style={label}>Best time</div>{p.bestTime.text}</div>
              </div>
              {expanded && (
                <div style={{ marginTop: 8, padding: 10, borderRadius: 'var(--g-r-md)', background: tint(E.accent, 6), fontSize: 13.5, color: E.text }}>
                  <div style={label}>Shot list</div>
                  <ol style={{ margin: '4px 0 8px 18px', padding: 0 }}>{p.shots.map((s, i) => <li key={i}>{s}</li>)}</ol>
                  <div style={label}>Script</div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '4px 0 8px' }}>{p.script}</pre>
                  <div style={label}>Studio / Higgsfield prompt</div>
                  <div style={{ marginTop: 4 }}>{p.studioPrompt}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button style={btn('primary')} disabled={busy === p.id} onClick={() => openInStudio(p)}>{busy === p.id ? 'Opening…' : 'Open in Studio'}</button>
                <button style={btn('ghost')} onClick={() => setOpen(expanded ? null : p.id)} aria-expanded={expanded}>{expanded ? 'Hide shots' : 'Shots & script'}</button>
                {p.state === 'open' || p.state === 'later' ? (<>
                  <button style={btn('ghost')} disabled={busy === p.id} onClick={() => mark(p, 'done')}>Done</button>
                  <button style={btn('ghost')} disabled={busy === p.id} onClick={() => mark(p, 'later')}>Later</button>
                  <button style={btn('ghost')} disabled={busy === p.id} onClick={() => mark(p, 'skip')}>Skip</button>
                </>) : <button style={btn('ghost')} disabled={busy === p.id} onClick={() => mark(p, 'open')}>Reopen</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
