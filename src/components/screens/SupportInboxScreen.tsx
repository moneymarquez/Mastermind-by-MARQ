import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useSupportInbox } from '../../data/useSupportInbox';
import type { SupportInboxEntry } from '../../data/useSupportInbox';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 18 };
const ghostBtn: CSSProperties = {
  padding: '7px 13px', borderRadius: 999, border: '1px solid #2b2f36', background: 'transparent',
  color: '#C7CAD1', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const CATEGORY_COLOR: Record<string, string> = {
  billing: '#C9A24B', support: '#8fae8f', bug: '#c47a7a', general: '#8A8F98', spam: '#565b64',
};

function StatusPill({ status }: { status: SupportInboxEntry['status'] }) {
  const colors: Record<SupportInboxEntry['status'], string> = { new: '#C9A24B', reviewed: '#8A8F98', replied: '#8fae8f', ignored: '#565b64' };
  const c = colors[status];
  return (
    <span style={{ padding: '3px 9px', borderRadius: 999, background: `${c}22`, border: `1px solid ${c}55`, color: c, fontSize: 10, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
}

export default function SupportInboxScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { entries, loading, setStatus } = useSupportInbox();
  const [filter, setFilter] = useState<'all' | SupportInboxEntry['status']>('new');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);

  const copyDraft = async (entry: SupportInboxEntry) => {
    if (!entry.ai_draft_reply) return;
    try {
      await navigator.clipboard.writeText(entry.ai_draft_reply);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard access can fail silently on some browsers/contexts — the
      // draft is still visible on screen to select and copy by hand.
    }
  };

  return (
    <div>
      <div style={homeHeadStyle}>Support Inbox</div>
      <div style={homeSubStyle}>
        Mail sent to any @mastermindsbymarq.com address, auto-categorized with a drafted reply — nothing here is
        ever sent without you reviewing and sending it yourself.
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
        {(['new', 'reviewed', 'replied', 'ignored', 'all'] as const).map((f) => (
          <div
            key={f}
            style={{ ...ghostBtn, ...(filter === f ? { background: '#F5F6F7', color: '#0A0B0D', border: 'none' } : {}) }}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)} ({f === 'all' ? entries.length : entries.filter((e) => e.status === f).length})
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, maxWidth: 680 }}>
        {!loading && filtered.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#565b64' }}>Nothing here.</div>
        )}
        {filtered.map((e) => (
          <div key={e.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{e.subject || '(no subject)'}</div>
                <div style={{ fontSize: 11.5, color: '#8A8F98', marginTop: 3 }}>{e.from_email} → {e.to_email}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {e.category && (
                  <span style={{ fontSize: 10.5, color: CATEGORY_COLOR[e.category] ?? '#8A8F98', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {e.category}
                  </span>
                )}
                <StatusPill status={e.status} />
              </div>
            </div>

            {e.body_text && (
              <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 12, lineHeight: 1.5, maxHeight: 100, overflow: 'auto' }}>
                {e.body_text}
              </div>
            )}

            {e.ai_draft_reply && (
              <div style={{ marginTop: 14, padding: 14, background: '#101114', border: '1px solid #1c1e23', borderRadius: 10 }}>
                <div style={{ fontSize: 10.5, color: '#565b64', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 }}>Drafted reply</div>
                <div style={{ fontSize: 12.5, color: '#C7CAD1', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{e.ai_draft_reply}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {e.ai_draft_reply && <div style={ghostBtn} onClick={() => copyDraft(e)}>{copiedId === e.id ? 'Copied ✓' : 'Copy draft'}</div>}
              {e.status !== 'reviewed' && <div style={ghostBtn} onClick={() => setStatus(e.id, 'reviewed')}>Mark reviewed</div>}
              {e.status !== 'replied' && <div style={ghostBtn} onClick={() => setStatus(e.id, 'replied')}>Mark replied</div>}
              {e.status !== 'ignored' && <div style={ghostBtn} onClick={() => setStatus(e.id, 'ignored')}>Ignore</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
