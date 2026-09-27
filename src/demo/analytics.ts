// Demo activation events (spec §4): started / completed / exited-at-step.
// Sent with the un-wrapped fetch so they reach the Worker even while the
// demo's /api interceptor is on; fire-and-forget, never blocks the tour.
import { realFetch } from './api';

export function logDemo(name: 'demo_started' | 'demo_completed' | 'demo_exited', props: Record<string, unknown> = {}): void {
  try {
    void realFetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, props: { ...props, path: location.pathname }, at: new Date().toISOString() }), keepalive: true }).catch(() => {});
  } catch { /* offline — fine */ }
}
