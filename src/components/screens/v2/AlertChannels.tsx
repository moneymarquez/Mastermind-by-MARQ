import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import Card from '../../mm/Card';
import Switch from '../../mm/Switch';
import { Field, field } from '../../mm/Page';

/** Per-event channels, quiet hours and the SMS number for notify()
 *  (worker/lib/notify.ts). The in-app list always gets every alert. */
interface Prefs { channels: Record<string, string[]>; quiet_start: string; quiet_end: string; timezone: string; sms_to: string | null }
interface Ev { id: string; label: string; defaults: string[]; ignoresQuiet?: boolean }
export default function AlertChannels() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { api<{ prefs: Prefs; events: Ev[] }>('/api/hq/notify-prefs').then((r) => { if (r.error) setMsg(r.error); else { setPrefs(r.prefs); setEvents(r.events); } }); }, []);
  if (!prefs) return <Card title="Where alerts go">{msg ? <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{msg}</span> : <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Loading…</span>}</Card>;
  const on = (ev: Ev, ch: string) => (prefs.channels[ev.id] ?? ev.defaults).includes(ch);
  const toggle = (ev: Ev, ch: string, v: boolean) => {
    const cur = prefs.channels[ev.id] ?? ev.defaults.filter((c) => c !== 'inapp');
    setPrefs({ ...prefs, channels: { ...prefs.channels, [ev.id]: v ? [...new Set([...cur, ch])] : cur.filter((c) => c !== ch) } });
  };
  const save = async () => { const r = await api<{ prefs: Prefs }>('/api/hq/notify-prefs', { body: prefs }); setMsg(r.error ?? 'Saved.'); if (!r.error) setPrefs(r.prefs); };
  return (
    <Card title="Where alerts go" meta="every alert is also in the bell" flush>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 56px 56px', gap: '0 8px', alignItems: 'center', fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0 6px' }}><span /><span style={{ textAlign: 'center' }}>Push</span><span style={{ textAlign: 'center' }}>Text</span></div>
      {events.map((ev) => (
        <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 56px 56px', gap: '0 8px', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--grid)' }}>
          <span style={{ fontSize: 14, color: 'var(--text)' }}>{ev.label}{ev.ignoresQuiet && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)' }}>Comes through quiet hours</span>}</span>
          <span style={{ display: 'flex', justifyContent: 'center' }}><Switch label={`${ev.label} by push`} on={on(ev, 'push')} onChange={(v) => toggle(ev, 'push', v)} /></span>
          <span style={{ display: 'flex', justifyContent: 'center' }}><Switch label={`${ev.label} by text`} on={on(ev, 'sms')} onChange={(v) => toggle(ev, 'sms', v)} /></span>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, padding: '14px 0 4px' }}>
        <Field l="Quiet from"><input type="time" value={prefs.quiet_start} onChange={(e) => setPrefs({ ...prefs, quiet_start: e.target.value })} style={field} /></Field>
        <Field l="Quiet until"><input type="time" value={prefs.quiet_end} onChange={(e) => setPrefs({ ...prefs, quiet_end: e.target.value })} style={field} /></Field>
      </div>
      <Field l="Text alerts to (leave empty for the digest number)"><input inputMode="tel" value={prefs.sms_to ?? ''} onChange={(e) => setPrefs({ ...prefs, sms_to: e.target.value })} placeholder="+1801…" style={field} /></Field>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0 4px' }}><button className="mm-btn mm-btn--primary" style={{ height: 44, padding: '0 18px' }} onClick={() => void save()}>Save</button>{msg && <span style={{ fontSize: 13, color: msg === 'Saved.' ? 'var(--success)' : 'var(--text-secondary)' }}>{msg}</span>}</div>
    </Card>
  );
}
