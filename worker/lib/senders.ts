// Which address each kind of email comes from. Two brands, each on its own
// verified Resend domain:
//   Masterminds by MARQ (the app)  → RESEND_FROM_EMAIL's domain, e.g. mastermindsbymarq.com
//   Made by Marq (the agency)      → MADEBYMARQUEZ_FROM_EMAIL's domain, e.g. madebymarquez.com
// Only the domains come from those two settings; the mailbox is picked per
// purpose below, so invoices go out from invoice@, account mail from hello@,
// and so on. Every address here also receives mail (Email Routing sends it
// to the Worker's inbox), so replies land in the app.
// Until MADEBYMARQUEZ_FROM_EMAIL is set (= the agency domain is verified in
// Resend), agency mail falls back to the app's hello@ so nothing fails.

export type SendPurpose =
  | 'app' | 'account' | 'dispatch'                              // Masterminds
  | 'invoice' | 'receipt' | 'contract' | 'comms' | 'delivery' | 'proposal'; // Made by Marq

export interface SenderEnv { RESEND_FROM_EMAIL?: string; MADEBYMARQUEZ_FROM_EMAIL?: string }

const ROUTES: Record<SendPurpose, { brand: 'masterminds' | 'madeby'; local: string }> = {
  app: { brand: 'masterminds', local: 'hello' },
  account: { brand: 'masterminds', local: 'hello' },
  dispatch: { brand: 'masterminds', local: 'hello' },
  invoice: { brand: 'madeby', local: 'invoice' },
  receipt: { brand: 'madeby', local: 'invoice' },
  contract: { brand: 'madeby', local: 'hello' },
  comms: { brand: 'madeby', local: 'hello' },
  delivery: { brand: 'madeby', local: 'hello' },
  proposal: { brand: 'madeby', local: 'hello' },
};
const NAMES = { masterminds: 'Masterminds by MARQ', madeby: 'Made by Marq' } as const;

const bare = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase();
const domainOf = (s: string) => bare(s).split('@')[1] ?? '';

/** The From header for a purpose, or null when email isn't set up at all. Pure. */
export function senderFor(env: SenderEnv, purpose: SendPurpose): string | null {
  const route = ROUTES[purpose];
  const appDomain = env.RESEND_FROM_EMAIL ? domainOf(env.RESEND_FROM_EMAIL) : '';
  const agencyDomain = env.MADEBYMARQUEZ_FROM_EMAIL ? domainOf(env.MADEBYMARQUEZ_FROM_EMAIL) : '';
  if (route.brand === 'madeby' && agencyDomain) return `${NAMES.madeby} <${route.local}@${agencyDomain}>`;
  if (!appDomain) return null;
  return route.brand === 'madeby' ? `${NAMES.masterminds} <hello@${appDomain}>` : `${NAMES.masterminds} <${route.local}@${appDomain}>`;
}
