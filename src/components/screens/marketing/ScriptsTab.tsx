import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Audience, Script, ScriptChannel, Tone, Venture } from '../../../data/mktEngine';
import { AUDIENCES, PACKAGES, SCRIPT_CHANNELS, TONES, VENTURES, funnelStats, diagnoseCalls, OUTCOME_LABEL } from '../../../data/mktEngine';
import { useScripts, useTouches } from '../../../data/useMktEngine';
import { E, Badge, Drawer, Metric, Pill, TeachingEmpty, btn, field, label } from '../ecom/ecomShared';
import DialerMode from './DialerMode';

const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`);

/** §2.2 Scripts — every script with tone tabs and audience tabs, a win
 *  rate per script from logged outcomes, and dialer mode. */
export default function ScriptsTab() {
  const api = useScripts();
  const touchesApi = useTouches(90);
  const [venture, setVenture] = useState<Venture>('madebymarq');
  const [audience, setAudience] = useState<Audience>('single');
  const [tone, setTone] = useState<Tone | 'all'>('all');
  const [channel, setChannel] = useState<ScriptChannel | 'all'>('all');
  const [showRetired, setShowRetired] = useState(false);
  const [editing, setEditing] = useState<Script | 'new' | null>(null);
  const [dialer, setDialer] = useState<Script | null>(null);

  const byScript = useMemo(() => {
    const m: Record<string, typeof touchesApi.touches> = {};
    for (const t of touchesApi.touches) if (t.script_id) (m[t.script_id] ??= []).push(t);
    return m;
  }, [touchesApi.touches]);
  const last30 = useMemo(() => { const since = Date.now() - 30 * 86400000; return touchesApi.touches.filter((t) => new Date(t.at).getTime() >= since && (t.channel === 'call' || t.channel === 'voicemail')); }, [touchesApi.touches]);
  const stats = funnelStats(last30);
  const diagnosis = diagnoseCalls(stats);

  const visible = api.scripts.filter((s) =>
    s.venture === venture && (s.audience === audience || s.audience === 'any')
    && (tone === 'all' || s.tone === tone) && (channel === 'all' || s.channel === channel) && (showRetired || s.active));
  const siblingsOf = (s: Script) => api.scripts.filter((x) => x.active && x.id !== s.id && x.venture === s.venture && x.audience === s.audience && x.channel === s.channel);

  const panel: CSSProperties = { background: E.bg, borderRadius: 'var(--radius-3xl)', border: '1px solid var(--border)', fontFamily: 'Inter, sans-serif', color: '#111', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 14 };
  const pkg = PACKAGES.find((p) => p.audience === audience);

  return (
    <div style={panel}>
      {/* The raw funnel, so the "why" behind a win rate is visible before the Scorer exists (M4). */}
      <div style={{ ...E.card, padding: 14 }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Metric label="Calls · 30d" value={String(stats.attempts)} />
          <Metric label="Reached" value={String(stats.reached)} unit={pct(stats.answerRate)} />
          <Metric label="Conversations" value={String(stats.conversations)} />
          <Metric label="Meetings" value={String(stats.meetings)} />
          <Metric label="Closed" value={String(stats.closes)} />
          <Metric label="Win rate" value={pct(stats.winRate)} big />
        </div>
        <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 8, lineHeight: 1.5 }}>
          {diagnosis
            ? <><strong style={{ color: E.amber }}>{diagnosis.symptom}</strong> → likely problem: <strong style={{ color: E.text }}>{diagnosis.problem}</strong>. The Campaign Scorer turns this into a grade out of 4 in M4.</>
            : <>Win rate = conversations or better ÷ people reached. Every outcome you tap in LeadFlow, Dialing or dialer mode lands here. Campaign grades out of 4 arrive in M4.</>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {VENTURES.map((v) => <Pill key={v.id} active={venture === v.id} onClick={() => setVenture(v.id)}>{v.label}</Pill>)}
        <div style={{ flex: 1 }} />
        <button style={btn('primary')} onClick={() => setEditing('new')}>＋ New script</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={label}>Audience</span>
        {AUDIENCES.map((a) => <Pill key={a.id} active={audience === a.id} onClick={() => setAudience(a.id)}>{a.label}</Pill>)}
        {pkg && <span style={{ fontSize: 'var(--text-caption)', color: E.faint }}>Package: {pkg.build} build · {pkg.retainer}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={label}>Tone</span>
        <Pill active={tone === 'all'} onClick={() => setTone('all')}>All</Pill>
        {TONES.map((t) => <Pill key={t.id} active={tone === t.id} onClick={() => setTone(t.id)}>{t.label}</Pill>)}
        <span style={{ ...label, marginLeft: 8 }}>Channel</span>
        <select style={{ ...field, width: 'auto' }} value={channel} onChange={(e) => setChannel(e.target.value as ScriptChannel | 'all')}>
          <option value="all">All channels</option>
          {SCRIPT_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label style={{ fontSize: 'var(--text-caption)', color: E.faint, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} /> old versions</label>
      </div>

      {api.error && <div style={{ color: E.red, fontSize: 'var(--text-body)' }}>{api.error}</div>}
      {!api.loading && api.scripts.length === 0 && (
        <TeachingEmpty what="No scripts yet." worker="you, and the Script & Copy worker in M4 (3 tones × 2 audiences, principle cited)"
          action={<button style={btn('primary')} onClick={api.seedStarters}>Load the 11 starter scripts (Made by Marq openers, voicemails, emails; one Mastermind DM)</button>} />
      )}
      {!api.loading && api.scripts.length > 0 && visible.length === 0 && (
        <div style={{ fontSize: 'var(--text-body)', color: E.faint }}>Nothing for this venture / audience / tone yet. Write one, or switch the filters.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {visible.map((s) => {
          const st = funnelStats(byScript[s.id] ?? []);
          const ch = SCRIPT_CHANNELS.find((c) => c.id === s.channel);
          const tn = TONES.find((t) => t.id === s.tone);
          return (
            <div key={s.id} style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, opacity: s.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{ch?.icon}</span>
                <span style={{ fontWeight: 700, color: E.text, flex: 1, minWidth: 0 }}>{s.title}</span>
                <Badge color="#6b7280">v{s.version}</Badge>
                {!s.active && <Badge color={E.amber}>retired</Badge>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge color="#2563eb">{tn?.label}</Badge>
                <Badge color="#7c3aed">{s.audience === 'any' ? 'Any audience' : AUDIENCES.find((a) => a.id === s.audience)?.label}</Badge>
                {s.principle && <Badge color="#0f766e" title="Psychology principle">{s.principle}</Badge>}
              </div>
              <div style={{ fontSize: 'var(--text-body)', color: E.muted, lineHeight: 1.45, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.body}</div>
              <div style={{ display: 'flex', gap: 14, borderTop: '1px solid #f3f4f6', paddingTop: 8, flexWrap: 'wrap' }}>
                <Metric label="Used" value={String(st.attempts)} />
                <Metric label="Reached" value={String(st.reached)} />
                <Metric label="Win rate" value={pct(st.winRate)} />
                {st.meetings + st.closes > 0 && <Metric label="Meetings+" value={String(st.meetings + st.closes)} />}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(s.channel === 'call' || s.channel === 'voicemail') && <button style={btn('primary')} onClick={() => setDialer(s)}>🎧 Dialer mode</button>}
                <button style={btn('ghost')} onClick={() => setEditing(s)}>Edit</button>
                {(s.channel === 'email' || s.channel === 'dm' || s.channel === 'landing') && <button style={btn('ghost')} onClick={() => navigator.clipboard?.writeText(s.body)}>Copy</button>}
              </div>
            </div>
          );
        })}
      </div>

      {touchesApi.touches.length > 0 && (
        <div style={{ ...E.card, padding: 14 }}>
          <div style={{ ...label, marginBottom: 6 }}>Last touches</div>
          {touchesApi.touches.slice(0, 8).map((t) => (
            <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: 'var(--text-caption)', color: E.muted, padding: '3px 0', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: E.faint }}>{new Date(t.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              <span style={{ color: E.text, fontWeight: 600 }}>{t.contact_name ?? '—'}</span>
              <span>{OUTCOME_LABEL[t.outcome]}{t.source_status && t.source_status !== t.outcome ? ` (${t.source_status})` : ''}</span>
              {t.script_id && <span style={{ color: E.faint }}>· {api.scripts.find((s) => s.id === t.script_id)?.title ?? 'script'}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, lineHeight: 1.5 }}>
        Calling rules (not legal advice): hand-dialing businesses is the normal path. Autodialers, prerecorded messages or mass texts to cell phones need prior consent (TCPA). Emails carry your business address and an unsubscribe line (CAN-SPAM) — the starter emails already do.
      </div>

      {editing && <ScriptDrawer script={editing === 'new' ? null : editing} defaults={{ venture, audience, tone: tone === 'all' ? 'straight' : tone, channel: channel === 'all' ? 'call' : channel }} api={api} onClose={() => setEditing(null)} />}
      {dialer && <DialerMode script={dialer} siblings={siblingsOf(dialer)} onClose={() => setDialer(null)} onLogged={touchesApi.reload} />}
    </div>
  );
}

function ScriptDrawer({ script, defaults, api, onClose }: { script: Script | null; defaults: { venture: Venture; audience: Audience; tone: Tone; channel: ScriptChannel }; api: ReturnType<typeof useScripts>; onClose: () => void }) {
  const [venture, setVenture] = useState<Venture>(script?.venture ?? defaults.venture);
  const [audience, setAudience] = useState<Audience>(script?.audience ?? defaults.audience);
  const [tone, setTone] = useState<Tone>(script?.tone ?? defaults.tone);
  const [channel, setChannel] = useState<ScriptChannel>(script?.channel ?? defaults.channel);
  const [title, setTitle] = useState(script?.title ?? '');
  const [principle, setPrinciple] = useState(script?.principle ?? '');
  const [body, setBody] = useState(script?.body ?? '');
  const [busy, setBusy] = useState(false);
  const bodyChanged = !!script && body !== script.body;

  const save = async () => {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    const meta = { venture, audience, tone, channel, title: title.trim(), principle: principle.trim() || null };
    if (!script) await api.create({ ...meta, body });
    else if (bodyChanged) await api.newVersion(script, body, meta);
    else await api.update(script.id, meta);
    setBusy(false);
    onClose();
  };
  const sel = (v: string, on: (x: string) => void, opts: { id: string; label: string }[]) => (
    <select style={{ ...field, width: 'auto' }} value={v} onChange={(e) => on(e.target.value)}>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
  );

  return (
    <Drawer open onClose={onClose} title={script ? `Edit · ${script.title}` : 'New script'} subtitle={script ? `v${script.version} — changing the words saves a new version and keeps this one's win rate.` : 'Use {business}, {owner}, {first}, {city} — dialer mode fills them from the lead.'} width={620}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sel(venture, (x) => setVenture(x as Venture), VENTURES)}
        {sel(audience, (x) => setAudience(x as Audience), [...AUDIENCES, { id: 'any', label: 'Any audience' }])}
        {sel(tone, (x) => setTone(x as Tone), TONES)}
        {sel(channel, (x) => setChannel(x as ScriptChannel), SCRIPT_CHANNELS)}
      </div>
      <div style={{ marginTop: 12 }}><div style={{ ...label, marginBottom: 4 }}>Title</div><input style={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Opener — straight" /></div>
      <div style={{ marginTop: 12 }}><div style={{ ...label, marginBottom: 4 }}>Principle it leans on</div><input style={field} value={principle} onChange={(e) => setPrinciple(e.target.value)} placeholder="Social proof · Loss aversion · Reciprocity…" /></div>
      <div style={{ marginTop: 12 }}><div style={{ ...label, marginBottom: 4 }}>Script</div><textarea style={{ ...field, minHeight: 260, resize: 'vertical', lineHeight: 1.5 }} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6 }}>Quote the package, not a custom number: {PACKAGES.map((p) => `${p.name} ${p.build} + ${p.retainer}`).join(' · ')}.</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button style={btn('primary')} disabled={busy} onClick={save}>{busy ? 'Saving…' : script ? (bodyChanged ? `Save as v${script.version + 1}` : 'Save') : 'Create'}</button>
        <button style={btn('ghost')} onClick={onClose}>Cancel</button>
        {script && <button style={{ ...btn('danger'), marginLeft: 'auto' }} onClick={async () => { if (confirm('Delete this script? Touches logged against it keep their outcome but lose the link.')) { await api.remove(script.id); onClose(); } }}>Delete</button>}
      </div>
    </Drawer>
  );
}
