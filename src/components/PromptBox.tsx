import { useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  title: string;
  hint?: string;
  text: string;
  /** When given, the textarea is editable and this fires on blur with
   *  the new text (only if it changed). Every generated value stays
   *  editable — the prompt is a fast first draft, not a lock. */
  onChange?: (next: string) => void;
  /** Optional extra actions rendered next to Copy (e.g. "Redraft"). */
  actions?: React.ReactNode;
}

/** One generated prompt, one copy button. The operator's workflow is
 *  literally "copy, switch app, paste" from a phone — so the button is
 *  big, the state change is obvious, and the fallback path (select-all
 *  in the textarea) works where the Clipboard API is blocked (older
 *  iOS in-app browsers). */
export default function PromptBox({ title, hint, text, onChange, actions }: Props) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? text;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    setTimeout(() => setCopied('idle'), 1800);
  };

  const btn: CSSProperties = {
    padding: '11px 18px', borderRadius: 'var(--radius-pill)', border: 'none', cursor: 'pointer', fontSize: 'var(--text-body)', fontWeight: 600,
    background: copied === 'ok' ? 'var(--success)' : 'var(--text)', color: 'var(--bg)', flexShrink: 0, minWidth: 96, textAlign: 'center',
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>{title}</div>
          {hint && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {actions}
          <div style={btn} onClick={copy}>{copied === 'ok' ? 'Copied ✓' : copied === 'fail' ? 'Select & copy' : 'Copy'}</div>
        </div>
      </div>
      <textarea
        readOnly={!onChange}
        value={shown}
        onChange={onChange ? (e) => setDraft(e.target.value) : undefined}
        onBlur={() => {
          if (onChange && draft !== null && draft !== text) onChange(draft);
          setDraft(null);
        }}
        onFocus={(e) => { if (copied === 'fail') e.currentTarget.select(); }}
        style={{
          width: '100%', minHeight: 220, maxHeight: 420, resize: 'vertical', boxSizing: 'border-box', padding: '12px 13px',
          background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)',
          fontFamily: 'var(--font-mono)', fontSize: 16, lineHeight: 1.5, outline: 'none', WebkitOverflowScrolling: 'touch',
        } as CSSProperties}
      />
      <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>
        {shown.length.toLocaleString()} characters{onChange ? ' · editable — changes save when you tap away' : ''}
      </div>
    </div>
  );
}
