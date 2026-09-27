import type { CSSProperties } from 'react';
import { CHANGELOG, APP_VERSION } from '../../data/changelog';

declare const __APP_BUILD__: string;

/** Settings → What's new: the version you're on and what changed. */
export default function ChangelogScreen({ homeHeadStyle, homeSubStyle }: { homeHeadStyle: CSSProperties; homeSubStyle: CSSProperties }) {
  const build = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={homeHeadStyle}>What's new</div>
      <div style={homeSubStyle}>Version {APP_VERSION} · build {build}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
        {CHANGELOG.map((r) => (
          <section key={r.version} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>v{r.version}</span>
              <span style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{r.date}</span>
            </div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--text-secondary)', fontSize: 'var(--text-body)', lineHeight: 1.6 }}>
              {r.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
