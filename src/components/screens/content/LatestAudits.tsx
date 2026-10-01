import { useState } from 'react';
import type { ContentAudit, SocialAccount } from '../../../data/contentEngine';
import { PLATFORM } from '../../../data/contentEngine';
import { E, label, tint } from '../ecom/ecomShared';

/** The Account Auditor's latest approved audit per account, above the
 *  Accounts list: what to repeat, what to stop. Idea & Script reads the
 *  same rows into next week's posts. */
export default function LatestAudits({ audits, accounts }: { audits: Record<string, ContentAudit>; accounts: SocialAccount[] }) {
  const rows = accounts.filter((a) => audits[a.id]);
  // undefined = not chosen yet: show the first account once audits load.
  const [picked, setOpen] = useState<string | null | undefined>(undefined);
  const open = picked === undefined ? rows[0]?.id ?? null : picked;
  if (!rows.length) return null;
  return (
    <div style={{ ...E.card, padding: 14, marginTop: 16 }}>
      <div style={{ ...label, marginBottom: 8 }}>Latest audits</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {rows.map((a) => <button key={a.id} onClick={() => setOpen(open === a.id ? null : a.id)} style={{ all: 'unset', cursor: 'pointer', padding: '6px 10px', borderRadius: 'var(--radius-pill)', fontSize: 13, border: `1px solid ${open === a.id ? E.accent : E.border}`, background: open === a.id ? tint(E.accent, 10) : 'transparent', color: E.text }}>{PLATFORM[a.platform].short} @{a.handle}</button>)}
      </div>
      {open && audits[open] && (() => {
        const x = audits[open];
        const col = (title: string, color: string, pts: ContentAudit['repeat']) => (
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ ...label, color }}>{title}</div>
            {pts.map((p, i) => <div key={i} style={{ marginTop: 6 }}><div style={{ fontSize: 'var(--text-body)', color: E.text, fontWeight: 600 }}>{i + 1}. {p.point}</div>{p.evidence && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{p.evidence}</div>}</div>)}
          </div>
        );
        return (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 'var(--text-caption)', color: E.faint }}>{x.period_start} → {x.period_end} · {x.posts_count} posts{x.summary ? ` · ${x.summary}` : ''}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>{col('Repeat', E.green, x.repeat)}{col('Stop', E.red, x.stop)}</div>
          </div>
        );
      })()}
    </div>
  );
}
