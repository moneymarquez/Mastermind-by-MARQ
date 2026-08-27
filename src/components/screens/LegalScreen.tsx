import type { CSSProperties } from 'react';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 14 };
const heading: CSSProperties = { fontSize: 'var(--text-label)', fontWeight: 700, color: 'var(--text)', marginBottom: 8 };
const body: CSSProperties = { fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 };

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is Nova (or any AI feature) giving me financial, business, legal, or medical advice?',
    a: 'No. Everything Nova and the other AI features generate — scaling plans, budgeting insights, macro/fitness suggestions, brand direction, drafted client replies — is a starting point based on the data you\'ve given it, not professional advice. It can be wrong, outdated, or miss context only a licensed professional would catch. For anything with real financial, legal, tax, or medical consequences, verify independently or talk to a qualified professional before acting.',
  },
  {
    q: 'Is the Stocks module trading with real money?',
    a: "No — it's paper trading only, tracking a simulated portfolio against real market data so you can see how a strategy would have performed. No real brokerage funds are ever placed or at risk through this app.",
  },
  {
    q: 'What happens to my data?',
    a: "Your data (schedule, macros, budgeting, business info, everything) is stored per-account and access-controlled at the database level, so no other user's account can read it — including other non-owner accounts on this app. It's used to power the features you're using (e.g. Nova reading your data to answer a question). See the data-handling note above for what's collected and which third-party services are involved.",
  },
  {
    q: 'How do I get my data deleted?',
    a: 'Settings → Account → "Delete account" starts the request. Deletion is handled manually right now rather than an instant automated button — for a request this consequential and irreversible, a human double-checking it happens correctly is safer than an untested automated process. Expect it to be handled within a few days.',
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Settings → Account → "Manage subscription" opens Stripe\'s billing portal directly, where you can cancel, change payment method, or view invoices yourself — no need to email anyone. If that ever has trouble, billing@mastermindsbymarq.com is the fallback.',
  },
  {
    q: 'If I\'m in crisis, or thinking about harming myself, what should I do?',
    a: 'Call or text 988 (the Suicide & Crisis Lifeline), or text HOME to 741741 (Crisis Text Line) — both are free and available any time. This app is not equipped to handle a crisis; those resources are.',
  },
  {
    q: 'What if the AI gets something wrong — a bad plan, a miscalculated total, a wrong suggestion?',
    a: 'Treat AI output the way you\'d treat a first draft from a smart but fallible assistant: useful, often right, but worth a second look before it drives a real decision — especially anything touching money, health, or a client relationship.',
  },
  {
    q: 'Is my health/fitness/sobriety/mental-health data private?',
    a: "Yes, scoped to your account the same way every other module is — but this app is not a substitute for professional medical or mental-health care, and nothing here is a diagnosis or treatment plan. If you're in crisis, contact a professional or emergency services directly rather than relying on this app.",
  },
];

export default function LegalScreen({ homeHeadStyle, homeSubStyle }: Props) {
  return (
    <div>
      <div style={homeHeadStyle}>Legal & FAQ</div>
      <div style={homeSubStyle}>What this app is, what it isn't, and where to go if something's wrong.</div>

      <div style={{ marginTop: 24, maxWidth: 680 }}>
        <div style={cardStyle}>
          <div style={heading}>Not professional advice</div>
          <div style={body}>
            Mastermind by MARQ is a personal organization and productivity tool with AI features layered in. It is
            not a licensed financial advisor, accountant, attorney, doctor, therapist, or broker, and nothing it
            generates — plans, drafts, suggestions, projections — should be treated as professional advice. Use it
            to organize your thinking and save time, not as the final word on decisions with real financial, legal,
            or health consequences.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={heading}>AI can be wrong</div>
          <div style={body}>
            Every AI-generated piece of content in this app — Nova's answers, generated plans, drafted client
            emails, categorized support mail — is produced by a language model reasoning over the data available to
            it. It can misread context, miss something important, or simply be incorrect. Review before you act on
            anything that matters.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={heading}>What data we collect, and who else sees it</div>
          <div style={body}>
            We collect what you enter directly (schedule, finances, health/fitness logs, business/client info,
            uploaded photos and videos) and what the app generates from it (AI plans, drafted replies, categorized
            support mail). We use AI — specifically Anthropic's Claude models — to process this data in order to
            power features like Nova, meal-photo logging, and plan generation; your data is sent to Anthropic for
            that processing. Beyond that, the following third-party services handle parts of the system and may
            process data as a result: Stripe (payments), Supabase (database and file storage), Resend (email
            delivery), Cloudflare (hosting), Open Food Facts (nutrition lookups), and Alpaca (paper-trading market
            data — no real funds involved). Data is not sold. If you want your data deleted, see the FAQ below.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={heading}>Frequently asked</div>
          {FAQS.map((f) => (
            <div key={f.q} style={{ marginTop: 16 }}>
              <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{f.q}</div>
              <div style={body}>{f.a}</div>
            </div>
          ))}
        </div>

        <div style={{ ...cardStyle, borderColor: '#3a3520' }}>
          <div style={{ ...heading, color: 'var(--warning)' }}>A note on this page itself</div>
          <div style={body}>
            This page was written in good faith to be clear and honest about how the app works, but it is not a
            substitute for actual Terms of Service and a Privacy Policy reviewed by a lawyer — especially once real
            payments and real client data are involved. Treat this as a starting draft, not a finished legal
            document.
          </div>
        </div>
      </div>
    </div>
  );
}
