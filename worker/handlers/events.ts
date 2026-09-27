// POST /api/events — first-party product events (Demo Mode spec §4). Public
// on purpose: the landing page's demo runs logged out. So it only accepts a
// fixed set of event names, a small props object, and one event per call;
// the service-role write goes to app_events, which no client can read.
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';

const NAMES = new Set(['demo_started', 'demo_completed', 'demo_exited']);
const MAX_BODY = 2048;

export async function logEvent(request: Request, env: SbEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'Too large' }, 413);
  let body: { name?: unknown; props?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Bad JSON' }, 400); }
  const name = typeof body.name === 'string' ? body.name : '';
  if (!NAMES.has(name)) return json({ error: 'Unknown event' }, 400);
  const props: Record<string, string | number | boolean> = {};
  if (body.props && typeof body.props === 'object' && !Array.isArray(body.props)) {
    for (const [k, v] of Object.entries(body.props as Record<string, unknown>).slice(0, 12)) {
      if (typeof v === 'number' || typeof v === 'boolean') props[k.slice(0, 32)] = v;
      else if (typeof v === 'string') props[k.slice(0, 32)] = v.slice(0, 120);
    }
  }
  try {
    await new Sb(env).insert('app_events', { name, props });
  } catch (e) {
    console.error('app_events', e);
    return json({ ok: false }, 202); // analytics never fails the caller
  }
  return json({ ok: true });
}
