import type { CSSProperties } from 'react';
import { useVoiceCapture, CAPTURE_TYPE_LABEL, CAPTURE_TYPE_MODULE } from '../../data/useVoiceCapture';
import type { CaptureType } from '../../data/useVoiceCapture';
import { isSpeechRecognitionSupported } from '../../lib/speech';
import Icon from '../../Icon';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const ALL_TYPES: CaptureType[] = ['task', 'expense', 'income', 'contact', 'decision', 'note', 'followup'];

export default function VoiceCaptureScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { listening, transcript, processing, filed, error, start, stop, refileAs, discard } = useVoiceCapture();
  const supported = isSpeechRecognitionSupported();

  return (
    <div>
      <div style={homeHeadStyle}>Voice Capture</div>
      <div style={homeSubStyle}>Speak a task, expense, contact, decision, note, or follow-up — it files itself.</div>

      {!supported && (
        <div style={{ ...cardStyle, marginTop: 24, color: '#c47a7a', fontSize: 'var(--text-body)' }}>Voice input isn't supported in this browser.</div>
      )}

      {supported && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
          <div
            onClick={() => (listening ? stop() : start())}
            style={{
              width: 84, height: 84, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', background: listening ? '#c47a7a' : 'var(--text)',
              animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            <Icon name="microphone" size={30} color={listening ? 'var(--text)' : 'var(--bg)'} />
          </div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 14 }}>
            {listening ? 'Listening — tap to stop' : processing ? 'Filing…' : 'Tap to speak'}
          </div>
        </div>
      )}

      {transcript && (
        <div style={{ ...cardStyle, marginTop: 28, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>You said</div>
          <div style={{ fontSize: 'var(--text-body-lg)', color: 'var(--text-quaternary)', lineHeight: 1.6 }}>{transcript}</div>
        </div>
      )}

      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: '#c47a7a', marginTop: 16, textAlign: 'center' }}>{error}</div>}

      {filed && (
        <div style={{ ...cardStyle, marginTop: 16, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', borderColor: '#8fae8f55', background: '#8fae8f10' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--text-micro)', fontWeight: 700, color: '#8fae8f', border: '1px solid #8fae8f', borderRadius: 'var(--radius-pill)', padding: '3px 10px' }}>
              Filed as {CAPTURE_TYPE_LABEL[filed.type]}
            </span>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>in {CAPTURE_TYPE_MODULE[filed.type]}</span>
          </div>
          <div style={{ fontSize: 'var(--text-body)', color: 'var(--text)', marginTop: 10 }}>{filed.summary}</div>

          <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-secondary)', marginTop: 16 }}>Wrong? File as instead:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {ALL_TYPES.filter((t) => t !== filed.type).map((t) => (
              <span key={t} style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', cursor: 'pointer' }} onClick={() => refileAs(t)}>
                {CAPTURE_TYPE_LABEL[t]}
              </span>
            ))}
            <span style={{ fontSize: 'var(--text-tiny)', color: '#c47a7a', cursor: 'pointer', padding: '4px 4px' }} onClick={discard}>Discard entirely</span>
          </div>
        </div>
      )}
    </div>
  );
}
