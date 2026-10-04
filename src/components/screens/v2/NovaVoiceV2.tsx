import { useEffect, useState } from 'react';
import { useNovaPreferences, DEFAULT_ASSISTANT_NAME } from '../../../data/useNovaPreferences';
import type { NovaTone } from '../../../data/useNovaPreferences';
import Card from '../../mm/Card';
import { Page, field } from '../../mm/Page';

const TONES: { value: NovaTone; label: string; desc: string }[] = [
  { value: 'direct', label: 'Direct', desc: 'Blunt and to the point, no cushioning.' },
  { value: 'encouraging', label: 'Encouraging', desc: 'Warm, leads with what is working, softer on hard truths.' },
  { value: 'neutral', label: 'Neutral', desc: 'Plain and matter-of-fact, no flourish.' },
];

/** Settings → Prompt & Voice: Nova's name and tone. */
export default function NovaVoiceV2() {
  const { tone, assistantName, loading, save, saveAssistantName } = useNovaPreferences();
  const [name, setName] = useState(assistantName);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (!loading) setName(assistantName); }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => { await saveAssistantName(name); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  return (
    <Page title="Prompt & Voice" sub={`How ${assistantName} talks to you`} back="Settings" backTo="account-settings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
        <Card title="Name" meta="Used everywhere in the app">
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder={DEFAULT_ASSISTANT_NAME} maxLength={40} aria-label="Assistant name" style={field} />
            <button className="mm-btn mm-btn--primary" style={{ height: 44, flex: 'none' }} onClick={submit}>{saved ? 'Saved' : 'Save'}</button>
          </div>
        </Card>
        <Card title="Tone" meta="Every reply, check-in and plan note">
          <div role="radiogroup" aria-label="Tone" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TONES.map((t) => {
              const on = tone === t.value;
              return (
                <button key={t.value} role="radio" aria-checked={on} disabled={loading} onClick={() => save(t.value)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'transparent' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', flex: 'none', boxSizing: 'border-box', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--text-tertiary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>{t.label}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13.5 }}>{t.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card title="Voice">
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Tap the mic next to {assistantName}'s message box to talk instead of type.</p>
        </Card>
      </div>
    </Page>
  );
}
