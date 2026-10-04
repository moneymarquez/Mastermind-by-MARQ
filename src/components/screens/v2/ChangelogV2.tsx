import { CHANGELOG, APP_VERSION } from '../../../data/changelog';
import Card from '../../mm/Card';
import Chip from '../../mm/Chip';
import { Page } from '../../mm/Page';

declare const __APP_BUILD__: string;

/** Settings → What's new: the version you're on and what changed. */
export default function ChangelogV2() {
  const build = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';
  return (
    <Page title="What's new" sub={`Version ${APP_VERSION} · build ${build}`} back="Settings" backTo="account-settings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
        {CHANGELOG.map((r, i) => (
          <Card key={r.version} title={<><span>{r.title}</span>{i === 0 && <Chip k="accent">Current</Chip>}</>} meta={`v${r.version} · ${r.date}`}>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>
              {r.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </Page>
  );
}
