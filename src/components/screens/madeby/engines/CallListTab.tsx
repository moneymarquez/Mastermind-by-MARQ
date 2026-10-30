import { useState } from 'react';
import Card from '../../../mm/Card';
import Chip from '../../../mm/Chip';
import { Empty } from '../../../mm/States';
import { api } from '../../../../lib/api';
import type { OutreachState } from './types';

export default function CallListTab({ data, reload }: { data: OutreachState; reload: () => void }) {
  const [msg, setMsg] = useState('');
  const act = async (path: string, id: string, extra: Record<string, unknown> = {}) => { const r = await api<{ error?: string; dry_run?: boolean }>(`/api/outreach/${path}`, { body: { id, ...extra } }); setMsg(r.error ?? (r.dry_run ? 'Test mode: the text was simulated.' : 'Done.')); reload(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Leads who didn't answer an email within one business day. No cold texts: texting is only for people who replied or booked.</div>
      {msg && <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{msg}</div>}
      {data.bookings.length > 0 && (
        <Card title="Booked calls" meta={`${data.bookings.length}`}>
          {data.bookings.map((b) => (
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <strong style={{ fontSize: 14.5 }}>{new Date(b.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {b.business ?? b.name}</strong>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{[b.name, b.phone, b.email].filter(Boolean).join(' · ')}</span>
              {b.finding && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>{b.finding}</span>}
            </div>
          ))}
        </Card>
      )}
      {data.calls.length === 0 ? <Empty text="Nobody to call yet. When an email gets no reply for a business day, they show up here with a phone number and a script." /> : data.calls.map((c) => (
        <Card key={c.id} title={c.business_name} meta={c.phone ?? 'no phone'}>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{c.finding}</div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, background: 'var(--surface-2)', borderRadius: 'var(--g-r-md)', padding: 12 }}>{c.script}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {c.phone && <a className="mm-btn mm-btn--primary" style={{ height: 36, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`tel:${c.phone}`}>Call</a>}
            <button className="mm-btn" style={{ height: 36 }} onClick={() => void act('call-done', c.id, { outcome: 'interested' })}>Talked: interested</button>
            <button className="mm-btn" style={{ height: 36 }} onClick={() => void act('call-done', c.id, { outcome: 'no_answer' })}>No answer / close</button>
            <button className="mm-btn" style={{ height: 36 }} disabled={!c.text_consent} title={c.text_consent ? '' : 'They have not replied or booked'} onClick={() => void act('after-call-text', c.id)}>Send recap + booking link</button>
            {!c.text_consent && <Chip k="neutral">no text consent yet</Chip>}
          </div>
        </Card>
      ))}
    </div>
  );
}
