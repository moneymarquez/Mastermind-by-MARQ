import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/** Bug inventory B-05: a render error used to turn the whole app into an
 *  empty page. Two uses: around the whole app (full-screen recovery) and
 *  around the current screen in Stage (the nav keeps working, and the
 *  boundary resets when you move to another screen via `resetKey`).
 *  The error is logged to the console and kept in localStorage
 *  ('mm:last-error') so it can be read back when you report it; Sentry
 *  replaces that in Phase 2. */
interface Props { children: ReactNode; scope: 'app' | 'screen'; resetKey?: string; label?: string }
interface State { error: Error | null; key?: string }

export function recordError(error: Error, where: string): void {
  console.error(`[${where}]`, error);
  try { localStorage.setItem('mm:last-error', JSON.stringify({ at: new Date().toISOString(), where, message: error.message, stack: (error.stack ?? '').slice(0, 2000) })); } catch { /* private mode */ }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };
  static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }
  // Moving to another screen clears a screen-level error.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }
  componentDidCatch(error: Error, info: ErrorInfo) { recordError(error, `${this.props.scope}${this.props.label ? `:${this.props.label}` : ''} ${info.componentStack?.split('\n')[1]?.trim() ?? ''}`); }

  render() {
    if (!this.state.error) return this.props.children;
    const app = this.props.scope === 'app';
    return (
      <div role="alert" style={{ minHeight: app ? '100dvh' : 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: app ? 'var(--bg)' : 'transparent', color: 'var(--text)' }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-title, 22px)', fontWeight: 700 }}>Something broke</div>
          <p style={{ fontSize: 'var(--text-body, 15px)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '10px 0 18px' }}>
            {app ? 'Nothing you saved is lost. Reload to pick up where you were.' : `${this.props.label ?? 'This screen'} hit an error. Everything else still works — reload, or open another screen from the menu.`}
          </p>
          <button type="button" onClick={() => window.location.reload()}
            style={{ minHeight: 44, padding: '0 22px', borderRadius: 'var(--radius-md, 10px)', border: 'none', background: 'var(--accent)', color: 'var(--on-accent, #000)', fontWeight: 700, fontSize: 'var(--text-body, 15px)', cursor: 'pointer' }}>
            Tap to reload
          </button>
          <div style={{ fontSize: 'var(--text-caption, 12px)', color: 'var(--text-tertiary)', marginTop: 14, overflowWrap: 'anywhere' }}>{this.state.error.message.slice(0, 160)}</div>
        </div>
      </div>
    );
  }
}
