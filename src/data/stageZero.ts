/** Marketing Stage Zero (Appendix 5, Part 4) — the free foundation each
 *  venture needs before any campaign sends people anywhere. Campaigns for
 *  a venture stay locked until its list is done. Progress lives in
 *  mkt_foundation; the items live here. */

export type M0Venture = 'madebymarq' | 'mastermind';
export interface M0Item { key: string; title: string; why: string; how: { text: string; link?: string }[] }

export const M0_ITEMS: Record<M0Venture, M0Item[]> = {
  madebymarq: [
    { key: 'gbp', title: 'Google Business Profile (service-area business)', why: 'The biggest free local lead source. People searching "website for food truck Sandy" see you before any ad.', how: [
      { text: 'Go to Google Business Profile and add your business.', link: 'https://business.google.com/create' },
      { text: 'When asked for a location, choose "I deliver goods and services to my customers" and hide your address — no storefront needed.' },
      { text: 'Service area: Sandy, Salt Lake County. Category: Website designer. Add phone and site link.' },
      { text: 'Verify (postcard, phone or video), then paste your profile link as proof.' },
    ] },
    { key: 'website', title: 'Website: packages with prices, your story, a tracked form, booking link', why: 'Every call and post points somewhere. Prices on the page pre-qualify; the form feeds Inbound so you can prove marketing works.', how: [
      { text: 'Packages section: Single location $1,500–2,000 + $500–600/mo; Multi-location $5,000–6,000 + $1,000–2,000/mo.' },
      { text: 'About page: your story — why you build this and who for.' },
      { text: 'Contact form that posts to Mastermind\'s Inbound (source = website).' },
      { text: 'A free booking link (Cal.com or Calendly) on every page.', link: 'https://cal.com/signup' },
    ] },
    { key: 'legal', title: 'Privacy policy + terms pages', why: 'Required by Meta and TikTok before they approve the Instagram and TikTok developer apps, and it signals you\'re a real business.', how: [
      { text: 'Add /privacy and /terms pages to the site (a generator like Termly works for a first version).', link: 'https://termly.io/products/privacy-policy-generator/' },
      { text: 'Link both in the site footer. Paste the privacy URL as proof.' },
    ] },
    { key: 'socials', title: 'Instagram + TikTok on Business, Facebook Page, Nextdoor business — same name, bio, link, phone', why: 'Consistent profiles build trust and let the Content engine pull insights; Nextdoor is free local reach.', how: [
      { text: 'Instagram: Settings → Account type and tools → Switch to professional → Business.' },
      { text: 'TikTok: Settings → Account → Switch to Business Account.' },
      { text: 'Create a Facebook Page for Made by Marq and link Instagram to it.', link: 'https://www.facebook.com/pages/create' },
      { text: 'Claim a Nextdoor business page.', link: 'https://business.nextdoor.com/' },
      { text: 'Use the identical name, bio, link and phone on all four.' },
    ] },
    { key: 'email', title: 'Professional email on your domain', why: 'hello@yourdomain reads as a business; a gmail address reads as a side project.', how: [
      { text: 'Free: Cloudflare Email Routing forwards you@yourdomain to your inbox (you already use it for support).', link: 'https://dash.cloudflare.com/?to=/:account/:zone/email/routing' },
      { text: 'To send as that address, add it as a "Send mail as" alias in Gmail or iCloud.' },
    ] },
    { key: 'search_console', title: 'Google Search Console + sitemap submitted', why: 'So Google indexes the site and you can see which searches find you.', how: [
      { text: 'Add the domain property in Search Console and verify via DNS.', link: 'https://search.google.com/search-console' },
      { text: 'Submit /sitemap.xml under Sitemaps.' },
    ] },
    { key: 'analytics', title: 'Cloudflare Web Analytics on the site', why: 'Free, privacy-friendly, and Mastermind reads it: site visits show below in Marketing.', how: [
      { text: 'Cloudflare → Web Analytics → Add a site → copy the site tag (or enable it on the proxied zone).', link: 'https://dash.cloudflare.com/?to=/:account/web-analytics' },
      { text: 'Paste the hostname and site tag in "Site visits" below. The Cloudflare token in Setup needs Account Analytics → Read.' },
    ] },
    { key: 'case_study', title: 'One case study slot on the site', why: 'Meetings without closes usually mean missing proof. The slot says "first client coming soon" until it\'s a real before/after.', how: [
      { text: 'Add a Work section with one card: before screenshot, after screenshot, one number (orders, calls, bookings).' },
      { text: 'Until the first client, use your own e-comm store or Mastermind as the proof.' },
    ] },
  ],
  mastermind: [
    { key: 'landing', title: 'Landing page: pitch line, 30-second demo, pricing, waitlist form', why: 'The page every Mastermind post and DM points to. The waitlist form is tracked as Inbound.', how: [
      { text: 'One-line pitch at the top.' },
      { text: '30-second demo video: the morning text + the e-comm office.' },
      { text: 'Pricing, then a waitlist form that posts to Inbound (source = website).' },
    ] },
    { key: 'founder', title: 'Founder story on the About page', why: 'People buy the person first — why you built it and how you run your businesses off it.', how: [{ text: 'Three short paragraphs: the problem you had, what you built, how you use it every day.' }] },
    { key: 'legal', title: 'Privacy policy + terms', why: 'Required for the Instagram and TikTok developer apps and for app store listings.', how: [
      { text: 'Add /privacy and /terms to the Mastermind site, linked in the footer.', link: 'https://termly.io/products/privacy-policy-generator/' },
      { text: 'Paste the privacy URL as proof — Setup uses it for the developer apps.' },
    ] },
    { key: 'socials', title: 'Instagram, TikTok, Threads/X on Business', why: 'Business accounts unlock insights the Content engine reads.', how: [
      { text: 'Switch each to a Business/professional account with the same name, bio and link.' },
    ] },
    { key: 'search_analytics', title: 'Search Console + Cloudflare Web Analytics', why: 'See who finds the site and from where; Mastermind shows visits below.', how: [
      { text: 'Verify the domain in Search Console and submit the sitemap.', link: 'https://search.google.com/search-console' },
      { text: 'Add the site in Cloudflare Web Analytics and paste its site tag below.', link: 'https://dash.cloudflare.com/?to=/:account/web-analytics' },
    ] },
    { key: 'app_store', title: 'App store listing draft', why: 'Screenshots and a description ready for when the app ships to the stores.', how: [
      { text: 'Six phone screenshots (Overview, Daily Plan, Dialing, E-comm office, Digest, Brain).' },
      { text: 'A 170-character subtitle and a four-paragraph description. Paste a link to the draft as proof.' },
    ] },
  ],
};

export const M0_LABEL: Record<M0Venture, string> = { madebymarq: 'Made by Marq', mastermind: 'Mastermind' };

export interface M0Row { venture: M0Venture; item_key: string; done: boolean; proof_url: string | null; note: string | null; done_at: string | null }

/** What's left for a venture, in checklist order. Empty = unlocked. */
export function m0Remaining(venture: M0Venture, rows: Pick<M0Row, 'venture' | 'item_key' | 'done'>[]): M0Item[] {
  const done = new Set(rows.filter((r) => r.venture === venture && r.done).map((r) => r.item_key));
  return M0_ITEMS[venture].filter((i) => !done.has(i.key));
}
export function m0Progress(venture: M0Venture, rows: Pick<M0Row, 'venture' | 'item_key' | 'done'>[]): { done: number; total: number; complete: boolean } {
  const total = M0_ITEMS[venture].length;
  const done = total - m0Remaining(venture, rows).length;
  return { done, total, complete: done === total };
}
/** The lock message: what's left, named. */
export function m0LockMessage(venture: M0Venture, rows: Pick<M0Row, 'venture' | 'item_key' | 'done'>[]): string | null {
  const left = m0Remaining(venture, rows);
  if (!left.length) return null;
  return `${M0_LABEL[venture]} campaigns unlock after Stage Zero. Still to do (${left.length}): ${left.map((i) => i.title.split(':')[0].split(' (')[0]).join('; ')}.`;
}
