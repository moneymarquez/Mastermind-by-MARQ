import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { supabase } from '../lib/supabase';

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
      {error && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 14 }}>{error}</div>}
      <button
        onClick={submit}
        disabled={submitting || !stripe}
        style={{
          width: '100%', marginTop: 20, padding: '12px 18px', borderRadius: 999, border: 'none',
          background: '#F5F6F7', color: '#0A0B0D', fontSize: 13.5, fontWeight: 600,
          cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? 'Processing…' : 'Subscribe — $19.97/month'}
      </button>
    </div>
  );
}

export default function BillingGateScreen({ onSubscribed, onSignOut }: Props) {
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
    <div style={{ minHeight: '100vh', background: '#0A0B0D', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', top: 24, left: 24, lineHeight: 1.1 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#F5F6F7', letterSpacing: '-0.01em' }}>Masterminds</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#F5F6F7', letterSpacing: '0.04em', marginTop: 2 }}>by MARQ</div>
      </div>
      <div style={{ position: 'absolute', top: 24, right: 24 }}>
        <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={onSignOut}>Sign out</span>
      </div>

      <div style={{ width: 380, maxWidth: '90vw', background: '#14161A', border: '1px solid #22262B', borderRadius: 16, padding: '32px 28px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#F5F6F7', marginBottom: 6 }}>Subscribe to continue</div>
        <div style={{ fontSize: 12.5, color: '#8A8F98', marginBottom: 24, lineHeight: 1.6 }}>
          $19.97/month, cancel anytime. Your modules and data are already set up — this just unlocks them.
        </div>

        {loading && <div style={{ fontSize: 12.5, color: '#565b64' }}>Loading…</div>}
        {!loading && error && <div style={{ fontSize: 12.5, color: '#c47a7a', lineHeight: 1.6 }}>{error}</div>}
        {!loading && !error && clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorBackground: '#1a1c21', colorText: '#F5F6F7', colorPrimary: '#F5F6F7', borderRadius: '8px' } } }}>
            <PaymentForm onSubscribed={onSubscribed} />
          </Elements>
        )}
      </div>
    </div>
  );
}
