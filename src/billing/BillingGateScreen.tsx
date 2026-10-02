import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { supabase } from '../lib/supabase';
import type { Theme } from '../data/useTheme';
import { resolveTheme } from '../data/useTheme';
import { PLANS, LIVE_PLAN } from './plans';

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

async function authedFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  return fetch(path, { ...opts, headers: { ...opts.headers, authorization: `Bearer ${token}` } });
}

interface Props {
  onSubscribed: () => void;
  onSignOut: () => void;
  theme: Theme;
}

function PaymentForm({ onSubscribed }: { onSubscribed: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');
    const { error: confirmError } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    setSubmitting(false);
    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed — try again.');
      return;
    }
    onSubscribed();
  };

  return (
    <div>
      <PaymentElement />
      {error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', marginTop: 14 }}>{error}</div>}
      <button
        className="ap-btn ap-btn-primary ap-btn-block"
        onClick={submit}
        disabled={submitting || !stripe}
        style={{ marginTop: 20, padding: '12px 18px' }}
      >
        {submitting ? 'Processing…' : `Subscribe — ${LIVE_PLAN.price}${LIVE_PLAN.cadence}`}
      </button>
    </div>
  );
}

export default function BillingGateScreen({ onSubscribed, onSignOut, theme }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authedFetch('/api/billing/create-subscription', { method: 'POST' });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? `Could not start checkout (${res.status}).`);
        } else {
          setClientSecret(body.clientSecret);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start checkout.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    // Bug inventory B-12: the header used to be absolutely positioned over
    // vertically centred content, so on a phone the two overlapped. It's a
    // normal row now and the content flows under it.
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'calc(16px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))' } as CSSProperties}>
      <div style={{ width: '100%', maxWidth: 780, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>Masterminds</div>
          <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em', marginTop: 2 }}>by MARQ</div>
        </div>
        <button type="button" onClick={onSignOut} style={{ minHeight: 44, padding: '0 8px', background: 'none', border: 'none', fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer', font: 'inherit' }}>Sign out</button>
      </div>

      <div style={{ width: '100%', maxWidth: 780, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* The lineup. Prices come from plans.ts so the number read here
            and the number Stripe charges can't drift apart. */}
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.015em' }}>Pricing</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Your modules and data are already set up — this just unlocks them.
          </div>

          {/* Only plans you can buy today — a greyed-out "coming soon" tier
              is placeholder content App Review rejects. */}
          {PLANS.filter((p) => p.live).map((plan) => (
            <div
              key={plan.key}
              className={`ap-card ${plan.featured ? 'ap-elev-md' : ''}`}
              style={{ padding: 18, gap: 8, opacity: plan.live ? 1 : 0.55 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="ap-card-title" style={{ color: 'var(--text)' }}>{plan.name}</div>
                {plan.featured && <span className="ap-tag ap-tag-accent">Current</span>}
                {!plan.live && <span className="ap-tag ap-tag-neutral">Not yet available</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 'clamp(28px, 9vw, 44px)', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{plan.price}</span>
                <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>{plan.cadence}</span>
              </div>
              <p className="ap-card-body" style={{ color: 'var(--text-secondary)' }}>{plan.tagline}</p>
              {plan.includes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
                  {plan.includes.map((f) => (
                    <div key={f} style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>· {f}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: '1 1 340px', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px 20px' }}>
          <div style={{ fontSize: 'var(--text-title)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Subscribe to continue</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
            {LIVE_PLAN.price}{LIVE_PLAN.cadence}, cancel anytime.
          </div>

        {loading && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!loading && error && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--danger)', lineHeight: 1.6 }}>{error}</div>}
        {!loading && !error && clientSecret && stripePromise && (
          // Stripe Elements renders in its own iframe, which can't resolve
          // this page's CSS custom properties — literal hex values matching
          // the current theme are required here, not var() references.
          // These are the Aperture values, kept in step with index.css by
          // hand: --surface-4, --text, and --accent for each ground. If the
          // palette moves again, this block has to move with it or the
          // payment form silently strands itself on the old theme.
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: resolveTheme(theme) === 'light'
                ? { theme: 'stripe', variables: { colorBackground: '#e9ecf7', colorText: '#292b31', colorPrimary: '#5d5294', borderRadius: '8px' } }
                : { theme: 'night', variables: { colorBackground: '#202230', colorText: '#e9e9ed', colorPrimary: '#9184d9', borderRadius: '8px' } },
            }}
          >
            <PaymentForm onSubscribed={onSubscribed} />
          </Elements>
        )}
        </div>
      </div>
    </div>
  );
}
