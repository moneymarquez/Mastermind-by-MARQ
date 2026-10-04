import { useState } from 'react';
import Card from '../../mm/Card';
import { Page } from '../../mm/Page';
import { GChevron } from '../../shell/glyphs';

/** Legal & FAQ: what this app is, what it isn't, and where to go if something's wrong. */
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
    a: 'Settings → Account → "Delete my account", then type DELETE. Your account, everything in it and your uploaded files are deleted straight away, any subscription is cancelled, and you get a confirmation email. Want a copy first? Settings → Account → "Export my data" downloads everything as a file.',
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

const SECTIONS: { t: string; b: string }[] = [
  { t: 'Not professional advice', b: 'Mastermind by MARQ is a personal organization and productivity tool with AI features layered in. It is not a licensed financial advisor, accountant, attorney, doctor, therapist, or broker, and nothing it generates — plans, drafts, suggestions, projections — should be treated as professional advice. Use it to organize your thinking and save time, not as the final word on decisions with real financial, legal, or health consequences.' },
  { t: 'AI can be wrong', b: "Every AI-generated piece of content in this app — Nova's answers, generated plans, drafted client emails, categorized support mail — is produced by a language model reasoning over the data available to it. It can misread context, miss something important, or simply be incorrect. Review before you act on anything that matters." },
  { t: 'What data we collect, and who else sees it', b: "We collect what you enter directly (schedule, finances, health/fitness logs, business/client info, uploaded photos and videos) and what the app generates from it (AI plans, drafted replies, categorized support mail). We use AI — specifically Anthropic's Claude models — to process this data in order to power features like Nova, meal-photo logging, and plan generation; your data is sent to Anthropic for that processing. Beyond that, the following third-party services handle parts of the system and may process data as a result: Stripe (payments), Supabase (database and file storage), Resend (email delivery), Cloudflare (hosting), Open Food Facts (nutrition lookups), and Alpaca (paper-trading market data — no real funds involved). Data is not sold. If you want your data deleted, see the FAQ below." },
];
const NOTE = 'This page was written in good faith to be clear and honest about how the app works, but it is not a substitute for actual Terms of Service and a Privacy Policy reviewed by a lawyer — especially once real payments and real client data are involved. Treat this as a starting draft, not a finished legal document.';

export default function LegalV2() {
  const [open, setOpen] = useState<number | null>(0);
  const link = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, color: 'var(--text)', fontSize: 15, fontWeight: 500, textDecoration: 'none' } as const;
  return (
    <Page title="Legal & FAQ" sub="What this app is, what it isn't, and where to go if something's wrong" back="Settings" backTo="account-settings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
        <Card title="Privacy Policy and Terms" flush>
          <div>
            <a href="/privacy" target="_blank" rel="noopener" style={link}>Privacy Policy<span style={{ color: 'var(--text-tertiary)' }}>↗</span></a>
            <a href="/terms" target="_blank" rel="noopener" style={{ ...link, borderTop: '1px solid var(--grid)' }}>Terms &amp; Conditions<span style={{ color: 'var(--text-tertiary)' }}>↗</span></a>
          </div>
        </Card>
        {SECTIONS.map((s) => (
          <Card key={s.t} title={s.t}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{s.b}</p>
          </Card>
        ))}
        <Card title="Frequently asked" meta={`${FAQS.length} questions`} flush>
          <div>
            {FAQS.map((f, i) => (
              <div key={f.q} style={{ borderTop: i ? '1px solid var(--grid)' : 'none' }}>
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '14px 0', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
                  <span style={{ flex: 1 }}>{f.q}</span>
                  <GChevron size={14} color="var(--text-tertiary)" style={{ transform: open === i ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {open === i && <p className="mm-rise" style={{ margin: '0 0 14px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{f.a}</p>}
              </div>
            ))}
          </div>
        </Card>
        <section style={{ background: 'color-mix(in srgb, var(--warning) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--warning) 40%, var(--border))', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ color: 'var(--warning)', fontSize: 15, fontWeight: 600 }}>A note on this page itself</span>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{NOTE}</p>
        </section>
      </div>
    </Page>
  );
}
