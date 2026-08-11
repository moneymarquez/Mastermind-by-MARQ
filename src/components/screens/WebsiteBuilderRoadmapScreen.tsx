import type { CSSProperties } from 'react';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20 };

const PHASES: { title: string; desc: string }[] = [
  { title: 'Phase 1 — Embedded terminal', desc: 'A browser-based terminal (via something like WebContainers or a remote dev sandbox), scoped to a project directory inside Mastermind.' },
  { title: 'Phase 2 — Live preview pane', desc: 'A running preview alongside the terminal, so changes show up as they happen — no separate deploy just to look at something.' },
  { title: 'Phase 3 — One-click deploy', desc: 'Deploy straight from that preview to Cloudflare — a new project or a subdomain under the existing account, no manual steps.' },
  { title: 'Phase 4 — Domain attach/purchase', desc: 'Attach an existing domain or buy one, from inside the builder, so a finished site can go live on its real domain without leaving the app.' },
];

export default function WebsiteBuilderRoadmapScreen({ homeHeadStyle, homeSubStyle }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={homeHeadStyle}>Website / App Builder</div>
        <div style={{ padding: '3px 10px', borderRadius: 999, background: '#8A8F9822', border: '1px solid #8A8F9855', color: '#8A8F98', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          In planning
        </div>
      </div>
      <div style={homeSubStyle}>Build and preview sites/apps live, then deploy — real backend work, not a tonight feature.</div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 620 }}>
        {PHASES.map((p) => (
          <div key={p.title} style={cardStyle}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F5F6F7' }}>{p.title}</div>
            <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 6, lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
