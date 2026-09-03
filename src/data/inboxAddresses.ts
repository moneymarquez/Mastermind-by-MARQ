// The addresses mail can arrive on, per domain, and what each one is for.
// This is the one place the inbox's "which address did this come in on"
// categorization is defined — the Support Inbox screen's filter chips,
// the Inbox widget's tag, and the counts all read from here. Add an
// address here and it shows up everywhere; an address that isn't listed
// still lands (under "other") rather than getting lost.
//
// Where mail actually comes from: Cloudflare Email Routing rules on each
// domain, with the action set to "Send to a Worker" → this app's Worker,
// whose email() handler (worker/handlers/support-inbox.ts) stores +
// triages the message and then forwards it on to the personal inbox it
// was going to anyway. Resend's inbound webhook is the other door and
// stores the same shape.

export interface InboxAddress {
  /** Local part, before the @. */
  local: string;
  label: string;
  /** What this address is for — shown as the chip's hint. */
  purpose: string;
}

export interface InboxDomain {
  key: string;
  domain: string;
  label: string;
  short: string;
  addresses: InboxAddress[];
}

export const INBOX_DOMAINS: InboxDomain[] = [
  {
    key: 'masterminds',
    domain: 'mastermindsbymarq.com',
    label: 'Masterminds by MARQ',
    short: 'MM',
    addresses: [
      { local: 'hello', label: 'Hello', purpose: 'General / first contact' },
      { local: 'contact', label: 'Contact', purpose: 'Contact form + inquiries' },
      { local: 'support', label: 'Support', purpose: 'Product help, bugs, account issues' },
      { local: 'billing', label: 'Billing', purpose: 'Subscription + payment questions' },
      { local: 'invoice', label: 'Invoice', purpose: 'Invoice replies + receipts' },
      { local: 'privacy', label: 'Privacy', purpose: 'Privacy / data requests' },
    ],
  },
  {
    // The Made by Marquez agency-side addresses get listed here once they
    // exist in Cloudflare Email Routing for that domain. Until then, any
    // mail arriving on this domain still lands, tagged as its local part.
    key: 'madeby',
    domain: 'madebymarquez.com',
    label: 'Made by Marquez',
    short: 'MB',
    addresses: [],
  },
];

export interface InboxBucket {
  domainKey: string;
  domainShort: string;
  domainLabel: string;
  local: string;
  label: string;
  /** False when the address isn't in the list above (still shown, under
   *  its raw local part) or the domain isn't one of ours. */
  known: boolean;
}

/** Which door a message came in on. Case-insensitive; tolerates
 *  "Name <addr>" and the +tag convention (support+urgent@ → support). */
export function inboxBucket(toEmail: string | null | undefined): InboxBucket {
  const raw = (toEmail ?? '').trim().toLowerCase();
  const addr = raw.includes('<') ? raw.slice(raw.indexOf('<') + 1, raw.indexOf('>')) : raw;
  const at = addr.lastIndexOf('@');
  const local = (at >= 0 ? addr.slice(0, at) : addr).split('+')[0];
  const domain = at >= 0 ? addr.slice(at + 1) : '';
  const d = INBOX_DOMAINS.find((x) => x.domain === domain);
  if (!d) return { domainKey: 'other', domainShort: '?', domainLabel: domain || 'unknown', local: local || '?', label: local || '?', known: false };
  const a = d.addresses.find((x) => x.local === local);
  return { domainKey: d.key, domainShort: d.short, domainLabel: d.label, local: local || '?', label: a?.label ?? (local || '?'), known: !!a };
}
