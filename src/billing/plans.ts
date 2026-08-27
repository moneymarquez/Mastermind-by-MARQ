/** The plan lineup, in one place. Prices used to be typed inline in the
 *  billing copy, which is how a price drifts out of sync with what Stripe
 *  actually charges — the number a customer reads and the number they're
 *  billed now come from the same constant.
 *
 *  The Stripe Price ID itself is NOT here: it lives in the Worker's
 *  STRIPE_PRICE_ID env var and is never sent to the client. Only the
 *  live tier is purchasable; everything else is display-only until it has
 *  a real Price behind it. */
export interface Plan {
  key: string;
  name: string;
  /** Display price. The billed amount comes from the Stripe Price the
   *  Worker holds — keep these in step when either changes. */
  price: string;
  cadence: string;
  tagline: string;
  /** What the tier actually includes. Only ever list things that exist —
   *  this copy is shown to people immediately before they pay. */
  includes: string[];
  /** Purchasable right now. A tier is only live once there's a real
   *  Stripe Price behind it; until then it renders as an unrevealed slot
   *  with no checkout path, so there's no way to take money for something
   *  that isn't built. */
  live: boolean;
  featured?: boolean;
}

export const PLANS: Plan[] = [
  {
    key: 'mastermind',
    name: 'Mastermind',
    price: '$19.99',
    cadence: '/mo',
    tagline: 'The whole system — everything you run on yourself and your business, on one record.',
    includes: [
      'Every module you turn on',
      'Nova across all of it',
      'Cancel anytime, self-serve',
    ],
    live: true,
    featured: true,
  },
  {
    // Deliberately unnamed and undescribed. Cristopher is building toward
    // a second tier at this price but hasn't decided what's in it, and
    // inventing placeholder features here would put claims in front of
    // paying customers that nothing backs. The slot is visible so the
    // lineup reads as two tiers; the contents get filled in when they're
    // real.
    key: 'tier-2',
    name: 'Coming soon',
    price: '$49.99',
    cadence: '/mo',
    tagline: 'A second tier is on the way. Details when it lands.',
    includes: [],
    live: false,
  },
];

export const LIVE_PLAN = PLANS.find((p) => p.live)!;
