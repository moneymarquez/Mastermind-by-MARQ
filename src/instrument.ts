// Imported first in main.tsx: ES imports run in order, so Sentry is set up
// before any other app module is evaluated and can report their errors too.
import { initSentry } from './lib/sentry';

initSentry();
