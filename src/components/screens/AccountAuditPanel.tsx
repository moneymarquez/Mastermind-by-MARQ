import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ContentGrowthPlan } from '../../data/useContentGrowth';
import type { AccountAudit } from '../../data/useAccountAudits';
import { generateAccountAudit } from '../../lib/accountAuditAi';
import type { AuditPost } from '../../lib/accountAuditAi';
import { AiError } from '../../lib/ai';

interface Props {
  plan: ContentGrowthPlan;
  /** Newest first — [0] is current, [1] (if present) is what it's
   *  compared against on a re-audit. */
  audits: AccountAudit[];
  loading: boolean;
  onSave: (handle: string, postsReviewed: number, statedViewer: string, result: Awaited<ReturnType<typeof generateAccountAudit>>) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.4 };
const fieldWrap: CSSProperties = { marginBottom: 14 };
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer',
};
const listCol: CSSProperties = { flex: '1 1 200px' };

export const GAP_LABEL: Record<string, string> = {
  no_clear_viewer: 'No clear viewer',
  too_many_pillars: 'Too many pillars',
  weak_hooks: 'Weak hooks',
  inconsistent_posting: 'Inconsistent posting',
};

/** Parses the bulk-paste box — one post per line, "caption | note".
 *  Deliberately simple/tolerant: a line with no "|" is treated as a
 *  caption with no performance note rather than rejected, since forcing
 *  strict formatting on ~20 pasted lines is exactly the friction "make
 *  manual entry fast" is warning against. */
function parsePostsInput(raw: string): AuditPost[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('|');
      return idx === -1
        ? { caption: line, performance_note: '' }
        : { caption: line.slice(0, idx).trim(), performance_note: line.slice(idx + 1).trim() };
    });
}

function AuditForm({ plan, onSave }: { plan: ContentGrowthPlan; onSave: Props['onSave'] }) {
  const [handle, setHandle] = useState(plan.account_handle ?? '');
  const [statedViewer, setStatedViewer] = useState(plan.niche_viewer ?? '');
  const [postsRaw, setPostsRaw] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const posts = parsePostsInput(postsRaw);

  const submit = async () => {
    if (!handle.trim() || posts.length === 0) return;
    setGenerating(true);
    setError('');
    try {
      const result = await generateAccountAudit({ handle: handle.trim(), statedViewer, posts }, plan);
      onSave(handle, posts.length, statedViewer, result);
    } catch (e) {
      setError(e instanceof AiError ? e.message : e instanceof Error ? e.message : 'Could not run the audit — try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Account diagnosis</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
        Metrics can't be pulled automatically here — paste the real thing in. Compares what you say you're posting for against what you're actually posting, and names the one gap that's actually blocking growth.
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Handle</div>
        <input style={inputStyle} placeholder="@handle" value={handle} onChange={(e) => setHandle(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Who do you SAY you're trying to reach?</div>
        <input style={inputStyle} value={statedViewer} onChange={(e) => setStatedViewer(e.target.value)} />
      </div>

      <div style={fieldWrap}>
        <div style={labelStyle}>Last ~20 posts — one per line: caption, then "|", then your own note on how it did (e.g. "hit 40k", "flopped")</div>
        <textarea
          style={{ ...inputStyle, minHeight: 160, resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--text-caption)' }}
          placeholder={'Behind the scenes making tacos | hit 40k views\nAnnouncing new hours | barely any views\n...'}
          value={postsRaw}
          onChange={(e) => setPostsRaw(e.target.value)}
        />
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>{posts.length} post{posts.length === 1 ? '' : 's'} parsed</div>
      </div>

      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginBottom: 10 }}>{error}</div>}

      <div style={{ ...primaryBtn, display: 'inline-block', opacity: handle.trim() && posts.length > 0 && !generating ? 1 : 0.5, pointerEvents: handle.trim() && posts.length > 0 && !generating ? 'auto' : 'none' }} onClick={submit}>
        {generating ? 'Diagnosing…' : 'Run the diagnosis'}
      </div>
    </div>
  );
}

function AuditSummary({ current, previous, onRerun }: { current: AccountAudit; previous: AccountAudit | undefined; onRerun: () => void }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 700, color: 'var(--text)' }}>
            Primary gap: {current.primary_gap ? GAP_LABEL[current.primary_gap] : 'not set'}
          </div>
          {previous?.primary_gap && current.primary_gap && (
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 4 }}>
              Previous audit: {GAP_LABEL[previous.primary_gap]} — {previous.primary_gap === current.primary_gap ? 'still open' : 'closed, new gap surfaced'}
            </div>
          )}
        </div>
        <span style={ghostBtn} onClick={onRerun}>Re-run audit</span>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <div style={listCol}>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Keep</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {current.keep.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
        <div style={listCol}>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Kill</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {current.kill.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
        <div style={listCol}>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Test</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {current.test.map((k, i) => <li key={i}>{k}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Screen 0 of the Content Creation addendum — appears before anything
 *  else when account_state is 'existing', same position Marketing's
 *  diagnosis header holds ("before anything gets slated"). Re-runnable:
 *  a new audit doesn't replace the old one, it's a new row, so the
 *  comparison ("did the gap close") has something real to read from. */
export default function AccountAuditPanel({ plan, audits, loading, onSave }: Props) {
  const [rerunning, setRerunning] = useState(false);
  if (loading) return null;

  const current = audits[0];
  if (!current || rerunning) {
    return <AuditForm plan={plan} onSave={(...args) => { onSave(...args); setRerunning(false); }} />;
  }
  return <AuditSummary current={current} previous={audits[1]} onRerun={() => setRerunning(true)} />;
}
