import * as Sentry from '@sentry/react';

declare const __APP_BUILD__: string;

/** Production error monitoring (Sentry, Free plan).
 *  Reads VITE_SENTRY_DSN at build time. When it's empty (local dev, tests,
 *  preview builds without the variable) nothing is initialised and every
 *  Sentry call in the app is a silent no-op. Tracing is sampled at 10%;
 *  session replay is deliberately off to stay inside the free quota. */
export function initSentry(): void {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: typeof __APP_BUILD__ === 'string' && __APP_BUILD__ !== 'dev' ? `masterminds@${__APP_BUILD__}` : undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
