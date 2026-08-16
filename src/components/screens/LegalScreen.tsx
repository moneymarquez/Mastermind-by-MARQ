import type { CSSProperties } from 'react';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

const cardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: 20, marginBottom: 14 };
const heading: CSSProperties = { fontSize: 14, fontWeight: 700, color: '#F5F6F7', marginBottom: 8 };
const body: CSSProperties = { fontSize: 12.5, color: '#8A8F98', lineHeight: 1.6 };

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
    a: "Your data (schedule, macros, budgeting, business info, everything) is stored per-account and access-controlled at the database level, so no other user's account can read it — including other non-owner accounts on this app. It's used to power the features you're using (e.g. Nova reading your data to answer a question) and isn't sold or shared with third parties. This is a plain-English summary, not a substitute for a lawyer-reviewed privacy policy — see the note at the bottom of this page.",
  },
  {
    q: 'How do I cancel my subscription?',
    a: 'Email billing@mastermindsbymarq.com and it\'ll be handled directly. A self-serve cancel button isn\'t built yet — until it is, this is the reliable way to cancel.',
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
          <div style={heading}>Frequently asked</div>
          {FAQS.map((f) => (
            <div key={f.q} style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7', marginBottom: 6 }}>{f.q}</div>
              <div style={body}>{f.a}</div>
            </div>
          ))}
        </div>

        <div style={{ ...cardStyle, borderColor: '#3a3520' }}>
          <div style={{ ...heading, color: '#C9A24B' }}>A note on this page itself</div>
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
