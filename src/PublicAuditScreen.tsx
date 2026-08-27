import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

interface PublicQuestion {
  id: string;
  category: string;
  key: string;
  prompt: string;
  helper_text: string | null;
  sort_order: number;
}

const pageStyle: CSSProperties = {
  minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '48px 20px',
  fontFamily: "'Manrope', system-ui, sans-serif", display: 'flex', justifyContent: 'center',
};
const containerStyle: CSSProperties = { width: '100%', maxWidth: 640 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '12px 14px', color: 'var(--text)', fontSize: 'var(--text-label)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 90, resize: 'vertical' };
const primaryBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '12px 24px', borderRadius: 'var(--radius-pill)',
  background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-label)', fontWeight: 600, cursor: 'pointer', border: 'none',
};

/** Part 1b — the public-facing free lead-gen questionnaire, reachable at
 *  /audit with no login (see main.tsx's pathname check). Same question
 *  bank as the internal form (fetched from the worker's service-role-
 *  backed public-questions endpoint, since audit_questions is owner-only
 *  RLS and this page has no Mastermind session at all), posted to
 *  publicAuditSubmit which auto-creates the crm_clients + client_audits
 *  rows and notifies Cristopher. */
export default function PublicAuditScreen() {
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch('/api/client-crm/public-questions')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: PublicQuestion[]) => setQuestions(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!businessName.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/client-crm/public-audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          contactName: contactName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          answers,
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setSubmitError('Something went wrong submitting this — try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={{ fontSize: 'var(--text-display)', fontWeight: 700 }}>Thanks — got it.</div>
          <div style={{ fontSize: 'var(--text-subhead)', color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
            Cristopher will review your answers and follow up soon.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ fontSize: 'var(--text-display)', fontWeight: 700 }}>Free Business Audit</div>
        <div style={{ fontSize: 'var(--text-subhead)', color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.6 }}>
          A few honest questions about where your business stands today — Made by Marq reviews every submission personally.
        </div>

        {loading && <div style={{ marginTop: 30, color: 'var(--text-tertiary)' }}>Loading…</div>}
        {loadError && <div style={{ marginTop: 30, color: '#c47a7a' }}>Could not load the questionnaire right now — try refreshing.</div>}

        {!loading && !loadError && (
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input style={inputStyle} placeholder="Business name *" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <input style={inputStyle} placeholder="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <input style={inputStyle} placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <input style={inputStyle} placeholder="Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />

            {questions.map((q) => (
              <div key={q.id}>
                <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>{q.category}</div>
                <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 600, marginBottom: 8 }}>{q.prompt}</div>
                <textarea
                  style={textareaStyle}
                  value={answers[q.key] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                />
                {q.helper_text && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', marginTop: 6, fontStyle: 'italic' }}>{q.helper_text}</div>}
              </div>
            ))}

            <div>
              <button style={{ ...primaryBtn, pointerEvents: submitting || !businessName.trim() ? 'none' : 'auto', opacity: submitting || !businessName.trim() ? 0.6 : 1 }} onClick={submit}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              {submitError && <div style={{ fontSize: 'var(--text-body)', color: '#c47a7a', marginTop: 10 }}>{submitError}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
