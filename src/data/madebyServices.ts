// What Made by Marq can sell and deliver today (Marq confirmed all 20).
// Leads get matched to these: a finding plus the kind of business says
// which 2–3 to open with. Pure, shared by the app and the Worker.

export const SERVICES = [
  { key: 'website', label: 'Website' },
  { key: 'booking', label: 'Online booking' },
  { key: 'ordering', label: 'Online ordering' },
  { key: 'delivery_apps', label: 'Uber Eats & DoorDash setup' },
  { key: 'gbp', label: 'Google Business Profile cleanup' },
  { key: 'local_seo', label: 'Local SEO (Maps ranking)' },
  { key: 'review_requests', label: 'Automated review requests' },
  { key: 'review_replies', label: 'Automated review replies' },
  { key: 'followups', label: 'Text & email follow-ups' },
  { key: 'missed_call', label: 'Missed-call text back' },
  { key: 'landing', label: 'Landing page + lead form' },
  { key: 'newsletter', label: 'Email newsletters' },
  { key: 'social', label: 'Social media posting' },
  { key: 'video', label: 'Short-form videos (Higgsfield)' },
  { key: 'ads', label: 'Paid ads (Meta / Google)' },
  { key: 'crm', label: 'CRM setup' },
  { key: 'ai_answering', label: 'AI phone / chat answering' },
  { key: 'loyalty', label: 'Loyalty / rewards program' },
  { key: 'dashboard', label: 'Sales & leads dashboard' },
  { key: 'store', label: 'Online store (Shopify)' },
] as const;
export type ServiceKey = typeof SERVICES[number]['key'];
const LABEL = Object.fromEntries(SERVICES.map((s) => [s.key, s.label])) as Record<ServiceKey, string>;

/** For prompts: everything Made by can deliver, one line. */
export const SERVICES_LINE = SERVICES.map((s) => s.label).join(', ');

type Kind = 'book' | 'order' | 'quote' | 'retail' | 'other';
export function businessKind(category: string | null | undefined): Kind {
  const c = (category ?? '').toLowerCase();
  if (/salon|barber|nail|lash|spa|massage|tattoo|dent|ortho|chiro|therap|optom|vet|gym|yoga|pilates|martial|dance|fitness|trainer|tutor|lesson|daycare|groom|photograph/.test(c)) return 'book';
  if (/restaurant|pizza|taco|food|truck|coffee|cafe|bakery|catering|dessert|grill|pub|diner|kitchen|burger|sushi|bbq|meal/.test(c)) return 'order';
  if (/plumb|hvac|heat|electric|roof|landscap|lawn|tree|clean|wash|handyman|paint|floor|remodel|contract|concrete|fenc|garage|pest|pool|junk|mov|appliance|locksmith|solar|auto|mechanic|tire|tow|detail|repair|law|attorney|real.?estate|insurance|account/.test(c)) return 'quote';
  if (/store|shop|boutique|florist|jewel|furniture|retail/.test(c)) return 'retail';
  return 'other';
}

/** What to pitch first: fix the problem we found, then the thing that makes this kind of business money. Up to 3. */
export function pitchFor(category: string | null | undefined, gapKinds: string[]): { key: ServiceKey; label: string }[] {
  const kind = businessKind(category);
  const out: ServiceKey[] = [];
  const add = (...k: ServiceKey[]) => { for (const x of k) if (!out.includes(x)) out.push(x); };
  if (gapKinds.some((g) => ['no_website', 'site_down', 'no_https', 'no_mobile', 'slow_mobile', 'stale_site'].includes(g))) add('website');
  if (gapKinds.includes('no_cta')) add(kind === 'book' ? 'booking' : kind === 'order' ? 'ordering' : 'landing');
  if (kind === 'book') add('booking', 'missed_call', 'review_requests');
  else if (kind === 'order') add('ordering', 'delivery_apps', 'gbp');
  else if (kind === 'quote') add('missed_call', 'landing', 'review_requests');
  else if (kind === 'retail') add('store', 'gbp', 'social');
  else add('gbp', 'review_requests');
  return out.slice(0, 3).map((k) => ({ key: k, label: LABEL[k] }));
}
