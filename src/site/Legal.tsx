import { useEffect, useRef, useState } from 'react';
import { S, LINKS, Nav, Footer, useViewport, updateNavInk } from './shared';

// Public legal + SMS opt-in pages. The SMS page is the verifiable Call to
// Action for the Twilio A2P 10DLC campaign: a public form, an unchecked
// consent box with the full disclosure, and links to Terms and Privacy that
// each carry the required SMS language.

export const BRAND = 'Masterminds by MARQ';
export const SENDER = 'Cristopher Marquez (doing business as Made by Marq and Masterminds by MARQ)';
export const CONTACT_EMAIL = 'hello@mastermindsbymarq.com';
export const UPDATED = 'October 9, 2026';
/** The exact consent text shown next to the checkbox. Kept in one place so
 *  the page, the stored consent record and the Twilio form all match. */
export const SMS_CONSENT = `By checking this box, I agree to receive recurring automated text messages from ${BRAND} at the phone number provided, including my daily planning summary, reminders and replies to my texts. Consent is not a condition of purchase. Message frequency varies (about 1–3 messages per day). Message and data rates may apply. Reply STOP to opt out at any time, HELP for help.`;
const MONO = "font-family:'IBM Plex Mono',monospace;";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { mob: m } = useViewport();
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = `${title} · Masterminds`;
    const on = () => updateNavInk(navRef.current);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [title]);
  return (
    <div style={S('color:#100f12; background:#fbfbfd;')}>
      <Nav mob={m} navRef={navRef} />
      <main data-nav="ink" style={S(`padding:${m ? '112px 20px 72px' : '160px 64px 112px'};`)}>
        <article style={S('max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:20px; font-size:16px; line-height:1.65; color:#2e3240;')}>{children}</article>
      </main>
      <Footer mob={m} />
    </div>
  );
}
const H1 = ({ children }: { children: React.ReactNode }) => <h1 style={S('margin:0; font-size:44px; line-height:1.05; font-weight:480; letter-spacing:-0.03em; color:#100f12;')}>{children}</h1>;
const H2 = ({ children }: { children: React.ReactNode }) => <h2 style={S('margin:16px 0 0; font-size:22px; font-weight:560; letter-spacing:-0.015em; color:#100f12;')}>{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p style={S('margin:0;')}>{children}</p>;
const Updated = () => <span style={S(`${MONO} font-size:12px; color:#6e6e7a;`)}>Last updated {UPDATED}</span>;

export function SmsOptIn() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) { setErr('Check the box to agree to receive texts.'); return; }
    setState('busy'); setErr('');
    const r = await fetch('/api/sms/optin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, name, consent: SMS_CONSENT, page: location.href }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setState('error'); setErr((j as { error?: string }).error ?? 'Something went wrong. Try again.'); return; }
    setState('done');
  };
  const field = 'height:48px; padding:0 14px; font-size:16px; border-radius:10px; border:1px solid #c9c9d3; background:#fff; color:#100f12; font-family:inherit;';
  return (
    <Shell title="Text updates">
      <span style={S('font-size:11px; font-weight:500; letter-spacing:.14em; color:#6e6e7a;')}>SMS</span>
      <H1>Get your day by text.</H1>
      <P>{BRAND} can text you a short planning summary each morning — your schedule, yesterday's numbers and today's top priority — and reply to quick commands like “dials 30” to log your activity. Sign up below. You can stop any time by replying STOP.</P>
      {state === 'done' ? (
        <div style={S('padding:20px; border-radius:12px; background:#e8f6ee; color:#14532d;')}>You're signed up. You'll get a confirmation text shortly. Reply STOP at any time to opt out, or HELP for help.</div>
      ) : (
        <form onSubmit={submit} style={S('display:flex; flex-direction:column; gap:14px; padding:24px; border:1px solid #e3e3ea; border-radius:16px; background:#fff;')}>
          <label style={S('display:flex; flex-direction:column; gap:6px; font-size:14px; font-weight:500;')}>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" style={S(field)} /></label>
          <label style={S('display:flex; flex-direction:column; gap:6px; font-size:14px; font-weight:500;')}>Mobile phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="(801) 555-0123" required style={S(field)} /></label>
          <label style={S('display:flex; gap:10px; align-items:flex-start; font-size:14px; line-height:1.55; color:#2e3240;')}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={S('width:20px; height:20px; margin-top:2px; flex:none;')} />
            <span>{SMS_CONSENT} See our <a href={LINKS.terms} style={S('color:#5266eb;')}>Terms</a> and <a href={LINKS.privacy} style={S('color:#5266eb;')}>Privacy Policy</a>.</span>
          </label>
          {err && <span style={S('color:#b91c1c; font-size:14px;')}>{err}</span>}
          <button type="submit" disabled={state === 'busy' || !phone.trim()} style={S('height:50px; border:0; border-radius:999px; background:#100f12; color:#fff; font-size:16px; font-weight:600; cursor:pointer;')}>{state === 'busy' ? 'Signing up…' : 'Sign up for texts'}</button>
        </form>
      )}
      <H2>What you'll get</H2>
      <P>A morning planning summary (about one message a day), reminders you set, and replies when you text a command. Example: “Mastermind by MARQ: Good morning. Today: 6:00–2:30 Work, 4:00–5:00 35 dials. #1: reply to the IG lead. Reply STOP to opt out.”</P>
      <H2>Opting out and help</H2>
      <P>Reply <strong>STOP</strong> to any message to stop all texts; you'll get one confirmation and nothing after that. Reply <strong>HELP</strong> for help, or email {CONTACT_EMAIL}. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages.</P>
      <P>We never sell or share your phone number or SMS consent with third parties or affiliates for marketing.</P>
    </Shell>
  );
}

export function Privacy() {
  return (
    <Shell title="Privacy Policy">
      <H1>Privacy Policy</H1><Updated />
      <P>This policy explains how {SENDER} (“we”) handles information in {BRAND} (the app at mastermindsbymarq.com) and Made by Marq services.</P>
      <H2>What we collect</H2>
      <P>Account details (name, email, phone if you add it); what you enter in the app (goals, tasks, schedule, notes and other module data); billing status from our payment processor (we never see full card numbers); and basic usage and device information to keep the service working and secure.</P>
      <H2>How we use it</H2>
      <P>To run the app and the features you turn on, send the messages you asked for, provide support, process payments, keep accounts secure, and improve the product. AI features process your own data to produce your plans and summaries; we don't use it to advertise to you.</P>
      <H2>Text messages (SMS)</H2>
      <P>If you opt in to texts, we use your mobile number to send the messages you signed up for (such as your daily planning summary and replies to your commands). Message frequency varies; message and data rates may apply. Reply STOP to opt out or HELP for help.</P>
      <P><strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent will not be shared with any third parties.</strong> We share your number only with the messaging provider that delivers our texts (Twilio), solely to send them.</P>
      <H2>Who we share with</H2>
      <P>Service providers that run the app for us (hosting, database, payments, email and SMS delivery, AI processing), under agreements that limit their use of your data to providing that service. We don't sell personal information. We may disclose information if the law requires it.</P>
      <H2>Your choices</H2>
      <P>You can view and edit your data in the app, turn notifications and texts off at any time, and ask us to delete your account by emailing {CONTACT_EMAIL}.</P>
      <H2>Security and retention</H2>
      <P>Data is encrypted in transit and access is limited to your account. We keep data while your account is active and delete it on request, except where we must keep records for legal or billing reasons.</P>
      <H2>Contact</H2>
      <P>Questions: {CONTACT_EMAIL}.</P>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms">
      <H1>Terms of Service</H1><Updated />
      <P>These terms are between you and {SENDER}. By using {BRAND} you agree to them.</P>
      <H2>The service</H2>
      <P>{BRAND} is a personal operating system app: planning, goals, tasks, tracking and AI summaries. Nothing in the app is medical, legal, tax or financial advice. Earnings estimates (such as Money Move) are estimates, not promises.</P>
      <H2>Accounts and billing</H2>
      <P>You're responsible for your account. Paid plans renew monthly until you cancel in Settings; see our <a href={LINKS.refund} style={S('color:#5266eb;')}>Refund policy</a>.</P>
      <H2>SMS terms</H2>
      <P><strong>Program:</strong> {BRAND} text updates — a daily planning summary, reminders and replies to commands you text, sent to people who opt in at <a href="/sms" style={S('color:#5266eb;')}>mastermindsbymarq.com/sms</a> or in the app's settings.</P>
      <P><strong>Frequency:</strong> varies, about 1–3 messages per day. <strong>Cost:</strong> message and data rates may apply. <strong>Opt out:</strong> reply STOP at any time; you'll receive one confirmation and no further messages. <strong>Help:</strong> reply HELP or email {CONTACT_EMAIL}. Carriers are not liable for delayed or undelivered messages. Consent to receive texts is not a condition of purchase.</P>
      <H2>Acceptable use</H2>
      <P>Don't misuse the service, try to break it, or use it to send spam or unlawful content. We may suspend accounts that do.</P>
      <H2>Liability</H2>
      <P>The service is provided as is. To the extent the law allows, our liability is limited to what you paid us in the last three months.</P>
      <H2>Changes and contact</H2>
      <P>We may update these terms and will note the date above. Questions: {CONTACT_EMAIL}.</P>
    </Shell>
  );
}
