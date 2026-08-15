import type { CSSProperties } from 'react';
import { useVoiceCapture, CAPTURE_TYPE_LABEL, CAPTURE_TYPE_MODULE } from '../../data/useVoiceCapture';
import type { CaptureType } from '../../data/useVoiceCapture';
import { isSpeechRecognitionSupported } from '../../lib/speech';
import Icon from '../../Icon';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20 };
const ALL_TYPES: CaptureType[] = ['task', 'expense', 'income', 'contact', 'decision', 'note', 'followup'];

export default function VoiceCaptureScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { listening, transcript, processing, filed, error, start, stop, refileAs, discard } = useVoiceCapture();
  const supported = isSpeechRecognitionSupported();

  return (
    <div>
      <div style={homeHeadStyle}>Voice Capture</div>
      <div style={homeSubStyle}>Speak a task, expense, contact, decision, note, or follow-up — it files itself.</div>

      {!supported && (
        <div style={{ ...cardStyle, marginTop: 24, color: '#c47a7a', fontSize: 13 }}>Voice input isn't supported in this browser.</div>
      )}

      {supported && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
          <div
            onClick={() => (listening ? stop() : start())}
            style={{
              width: 84, height: 84, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', background: listening ? '#c47a7a' : '#F5F6F7',
              animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none',
            }}
          >
            <Icon name="microphone" size={30} color={listening ? '#F5F6F7' : '#0A0B0D'} />
          </div>
          <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 14 }}>
            {listening ? 'Listening — tap to stop' : processing ? 'Filing…' : 'Tap to speak'}
          </div>
        </div>
      )}

      {transcript && (
        <div style={{ ...cardStyle, marginTop: 28, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#8A8F98', textTransform: 'uppercase', marginBottom: 8 }}>You said</div>
          <div style={{ fontSize: 13.5, color: '#C7CAD1', lineHeight: 1.6 }}>{transcript}</div>
        </div>
      )}

      {error && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 16, textAlign: 'center' }}>{error}</div>}

      {filed && (
        <div style={{ ...cardStyle, marginTop: 16, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', borderColor: '#8fae8f55', background: '#8fae8f10' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8fae8f', border: '1px solid #8fae8f', borderRadius: 999, padding: '3px 10px' }}>
              Filed as {CAPTURE_TYPE_LABEL[filed.type]}
            </span>
            <span style={{ fontSize: 11.5, color: '#565b64' }}>in {CAPTURE_TYPE_MODULE[filed.type]}</span>
          </div>
          <div style={{ fontSize: 13, color: '#F5F6F7', marginTop: 10 }}>{filed.summary}</div>

          <div style={{ fontSize: 11, color: '#8A8F98', marginTop: 16 }}>Wrong? File as instead:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {ALL_TYPES.filter((t) => t !== filed.type).map((t) => (
              <span key={t} style={{ fontSize: 11, color: '#8A8F98', border: '1px solid #22262B', borderRadius: 999, padding: '4px 12px', cursor: 'pointer' }} onClick={() => refileAs(t)}>
                {CAPTURE_TYPE_LABEL[t]}
              </span>
            ))}
            <span style={{ fontSize: 11, color: '#c47a7a', cursor: 'pointer', padding: '4px 4px' }} onClick={discard}>Discard entirely</span>
          </div>
        </div>
      )}
    </div>
  );
}
