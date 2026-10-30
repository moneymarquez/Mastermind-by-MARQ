// Optional Worker-side error monitoring (Sentry). Off unless the Worker has a
// SENTRY_DSN secret (`wrangler secret put SENTRY_DSN`, or the dashboard's
// Secrets list). Without it, every invocation goes straight to the plain
// handler: no SDK init, no instrumentation, nothing sent.
//
// With it, uncaught errors from fetch / scheduled / email are reported.
// Tracing stays off (tracesSampleRate 0) to keep inside the Free plan, and
// request bodies, cookies and IPs are not sent (the SDK default).
//
// This wraps the WHOLE exported handler from the outside, so any
// per-response wrappers inside fetch (security headers, static-asset
// handling, asset caching) keep working unchanged and simply run inside it.
import { withSentry } from '@sentry/cloudflare';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fn = (...args: any[]) => any;
type Handler = { fetch: Fn; scheduled: Fn; email: Fn };
type SentryEnv = { SENTRY_DSN?: string; SENTRY_ENVIRONMENT?: string };

export function withOptionalSentry<H extends Handler>(handler: H): H {
  // A copy: withSentry instruments the object it's given, and the
  // unmonitored path must stay the untouched original.
  const monitored = withSentry(
    (env: SentryEnv) => ({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT || 'production',
      tracesSampleRate: 0,
    }),
    { ...handler } as any,
  ) as unknown as H;
  const pick = (env: SentryEnv | undefined): H => (env?.SENTRY_DSN ? monitored : handler);
  return {
    ...handler,
    fetch: (request: unknown, env: SentryEnv, ctx: unknown) => pick(env).fetch(request, env, ctx),
    scheduled: (event: unknown, env: SentryEnv, ctx: unknown) => pick(env).scheduled(event, env, ctx),
    email: (message: unknown, env: SentryEnv, ctx: unknown) => pick(env).email(message, env, ctx),
  };
}
