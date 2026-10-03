import type { CSSProperties } from 'react';
import Card from '../mm/Card';
import Chip from '../mm/Chip';
import { Page, useModule } from '../mm/Page';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const PHASES: { title: string; desc: string }[] = [
  { title: 'Embedded terminal', desc: 'A browser terminal (WebContainers or a remote sandbox) scoped to a project folder inside Mastermind.' },
  { title: 'Live preview pane', desc: 'A running preview beside the terminal, so changes show as they happen. No deploy just to look at something.' },
  { title: 'One-click deploy', desc: 'Deploy from the preview to Cloudflare: a new project or a subdomain under the existing account, no manual steps.' },
  { title: 'Domain attach or purchase', desc: 'Attach a domain you own or buy one inside the builder, so a finished site goes live on its real domain.' },
];

/** Not built yet. The roadmap, honestly labelled, in the redesign's frame. */
export default function WebsiteBuilderRoadmapScreen(_: Props) {
  const { device } = useModule();
  return (
    <Page title="Website / App Builder" sub="Build, preview and deploy sites and apps">
      <div style={{ alignSelf: 'flex-start' }}><Chip k="neutral">In planning</Chip></div>
      <Card title="Roadmap" meta={`${PHASES.length} phases`} wide={device !== 'phone'} style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PHASES.map((p, i) => (
            <div key={p.title} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 22, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid var(--border)', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{i + 1}</div>
                <div style={{ flex: 1, width: 2, minHeight: 12, background: i === PHASES.length - 1 ? 'transparent' : 'var(--grid)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '1px 0 16px' }}>
                <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{p.title}</span>
                <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-secondary)' }}>{p.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}
