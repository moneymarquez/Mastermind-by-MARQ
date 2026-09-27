// Turns the demo's plumbing on and off with the demo state: a fresh copy
// of the seed and the /api interceptor on start, both torn down on exit so
// the next real query goes to the real database.
import { subscribeDemo, getDemo, consumeDemoUrl } from './state';
import { resetDemoDb, stopDemoTicker } from './client';
import { installDemoApi, uninstallDemoApi } from './api';

let wasActive = false;
let lastRun = -1;
export function initDemo(): void {
  subscribeDemo(() => {
    const s = getDemo();
    if (s.active && (!wasActive || s.run !== lastRun)) { resetDemoDb(); installDemoApi(); lastRun = s.run; }
    if (!s.active && wasActive) { uninstallDemoApi(); stopDemoTicker(); }
    wasActive = s.active;
  });
  consumeDemoUrl();
}
