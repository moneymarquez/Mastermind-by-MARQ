import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from '../../Icon';
import { useContacts } from '../../data/useContacts';
import { useCallOutcomes, DAILY_CALL_GOAL } from '../../data/useCallOutcomes';
import { usePitch } from '../../data/usePitch';
import type { CallOutcomeType, Contact, DialingContactDetails } from '../../data/types';
import { CALL_OUTCOMES, CALL_OUTCOME_LABEL } from '../../data/types';
import { formatDateLabel } from '../../data/time';
import ContactFormModal from './ContactFormModal';

function loggedAtLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 22 };
const outcomeBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '7px 12px', borderRadius: 999,
  border: '1px solid #22262B', color: '#C7CAD1', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
};
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999,
  background: '#F5F6F7', color: '#0A0B0D', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

function appointmentLabel(c: Contact): string | null {
  const d = c.details as Partial<DialingContactDetails>;
  if (!d.appointment_at) return null;
  const dt = new Date(d.appointment_at);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function DialingScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { contacts, upsertContact } = useContacts();
  const dialingContacts = contacts.filter((c) => c.source === 'dialing');
  const { activeQueue, completedToday, todayCount, logOutcome, undoOutcome, history } = useCallOutcomes(dialingContacts);
  const { pitchText, loading: pitchLoading, savePitch } = usePitch();

  const [pitchDraft, setPitchDraft] = useState('');
  const [pitchDirty, setPitchDirty] = useState(false);
  useEffect(() => {
    if (!pitchLoading && !pitchDirty) setPitchDraft(pitchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchLoading]);

  const [showAdd, setShowAdd] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const pct = Math.min(100, (todayCount / DAILY_CALL_GOAL) * 100);

  return (
    <div>
      <div style={homeHeadStyle}>Dialing</div>
      <div style={homeSubStyle}>Today's session</div>

      <div style={{ ...cardStyle, marginTop: 24, maxWidth: 640 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A8F98', textTransform: 'uppercase' }}>Current Pitch</div>
        <textarea
          style={{
            width: '100%', minHeight: 110, marginTop: 12, background: '#1a1c21', border: '1px solid #2b2f36', borderRadius: 8,
            padding: '12px 14px', color: '#F5F6F7', fontSize: 13.5, lineHeight: 1.6, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
          }}
          placeholder="Paste or write the script you're actively using…"
          value={pitchDraft}
          onChange={(e) => { setPitchDraft(e.target.value); setPitchDirty(true); }}
          onBlur={() => { if (pitchDirty) { savePitch(pitchDraft); setPitchDirty(false); } }}
        />
        <div style={{ fontSize: 11, color: '#565b64', marginTop: 6 }}>Saves automatically when you click away.</div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ ...cardStyle, flex: '1 1 260px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 600, color: '#F5F6F7' }}>
            {todayCount} <span style={{ fontSize: 20, color: '#565b64' }}>/ {DAILY_CALL_GOAL}</span>
          </div>
          <div style={{ height: 8, background: '#22262B', borderRadius: 999, marginTop: 14, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#F5F6F7', borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 8 }}>Calls completed today</div>
        </div>
        <div style={primaryBtn} onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={15} style={{ marginRight: 6 }} color="#0A0B0D" />
          Add Contact
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 12 }}>Today's Calls ({activeQueue.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
          {activeQueue.map((c) => {
            const appt = appointmentLabel(c);
            return (
              <div key={c.id} style={{ background: '#101114', border: '1px solid #22262B', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 2 }}>{c.phone}{appt ? ` · ${appt}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {CALL_OUTCOMES.map((o) => (
                    <div key={o} style={outcomeBtn} onClick={() => logOutcome(c.id, o as CallOutcomeType)}>
                      {CALL_OUTCOME_LABEL[o]}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {activeQueue.length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114', border: '1px solid #22262B', borderRadius: 12 }}>
              Nothing left in today's queue — add more contacts to keep pushing toward {DAILY_CALL_GOAL}.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, maxWidth: 680 }}>
        <div style={{ fontSize: 13, color: '#8A8F98', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setShowCompleted((v) => !v)}>
          {showCompleted ? 'Hide' : 'Show'} completed today ({completedToday.length})
        </div>
        {showCompleted && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
            {completedToday.map(({ outcome, contact }) => (
              <div key={outcome.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
                <div>
                  <span style={{ fontSize: 13, color: '#C7CAD1' }}>{contact?.name ?? 'Unknown contact'}</span>
                  <span style={{ fontSize: 12, color: '#8A8F98', marginLeft: 8 }}>{CALL_OUTCOME_LABEL[outcome.outcome]} · {loggedAtLabel(outcome.logged_at)}</span>
                </div>
                <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => undoOutcome(outcome.id)}>Undo</span>
              </div>
            ))}
            {completedToday.length === 0 && (
              <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>Nothing logged yet today.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18, maxWidth: 680 }}>
        <div style={{ fontSize: 13, color: '#8A8F98', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? 'Hide' : 'Show'} history
        </div>
        {showHistory && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
            {history.map((day) => (
              <div key={day.date} style={{ padding: '12px 18px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>{formatDateLabel(day.date)}</span>
                  <span style={{ fontSize: 12, color: '#8A8F98' }}>{day.total} calls</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#565b64', marginTop: 4 }}>
                  {Object.entries(day.breakdown).map(([o, n]) => `${CALL_OUTCOME_LABEL[o as CallOutcomeType]}: ${n}`).join(' · ')}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div style={{ padding: 18, fontSize: 13, color: '#565b64', background: '#101114' }}>No calls logged yet.</div>
            )}
          </div>
        )}
      </div>

      {showAdd && <ContactFormModal onSave={upsertContact} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
