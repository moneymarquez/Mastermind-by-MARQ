import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useOnboardingProgress } from '../data/useOnboardingProgress';
import { useNovaPreferences } from '../data/useNovaPreferences';
import { supabase } from '../lib/supabase';
import CurationQuestions from './CurationQuestions';
import AiNamingStep from './AiNamingStep';
import OnboardingScreen from './OnboardingScreen';
import PersonalizedDemo from './PersonalizedDemo';
import type { OnboardingAnswers, OnboardingStep } from '../data/useOnboardingProgress';

interface Props {
  /** Only called once, from the demo's final arrow — this is what actually
   *  saves module selections and flips hasOnboarded, handing control back
   *  to AuthedGate (which then shows the billing gate). Everything before
   *  this point is draft state in onboarding_progress, not the real
   *  user_modules rows. */
  onComplete: (selectedKeys: string[]) => Promise<void>;
  /** A comped invite code (schema_044_comp_codes.sql) — redeeming one
   *  skips the rest of this flow entirely, same as onComplete does, just
   *  via a code instead of picking modules and hitting a paywall. */
  onRedeemCode: (code: string) => Promise<void>;
}

function InviteCodeEntry({ onRedeem }: { onRedeem: (code: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onRedeem(code.trim());
      // On success this component unmounts (hasOnboarded flips in
      // AuthedGate) — no need to reset state here.
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "That code didn't work.");
    }
  };

  return (
    <div style={{ position: 'fixed', top: 14, right: 20, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      {!open ? (
        <span
          style={{ fontSize: 13, color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          onClick={() => setOpen(true)}
        >
          Have an invite code?
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="XXXX-XXXX"
              style={{ width: 120, background: 'var(--surface-4)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 9px', color: 'var(--text)', fontSize: 13.5, outline: 'none' }}
            />
            <button
              onClick={submit}
              disabled={busy || !code.trim()}
              className="ap-btn ap-btn-primary"
              style={{ padding: '7px 12px', fontSize: 13, opacity: busy || !code.trim() ? 0.6 : 1 }}
            >
              {busy ? '…' : 'Redeem'}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

const STEPS: OnboardingStep[] = ['questions', 'ai-name', 'modules', 'demo'];
const STEP_LABEL: Record<OnboardingStep, string> = { questions: 'About you', 'ai-name': 'Name your AI', modules: 'Modules', demo: 'Preview' };

function ProgressBar({ step }: { step: OnboardingStep }) {
  const idx = STEPS.indexOf(step);
  const barStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', gap: 4, padding: '16px 24px', zIndex: 50 };
  return (
    <div style={barStyle}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ flex: 1, height: 3, borderRadius: 'var(--radius-pill)', background: i <= idx ? 'var(--text)' : 'var(--border)' }} title={STEP_LABEL[s]} />
      ))}
    </div>
  );
}

export default function OnboardingFlow({ onComplete, onRedeemCode }: Props) {
  const { step, answers, draftModuleKeys, loading, save } = useOnboardingProgress();
  const { assistantName, saveAssistantName } = useNovaPreferences();
  const [finishing, setFinishing] = useState(false);

  if (loading) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;

  const submitQuestions = async (a: OnboardingAnswers) => {
    // Seeds Nova's long-term memory (see schema_032 / worker/handlers/nova-chat.ts)
    // with real onboarding answers, not just held in this table — the AI
    // genuinely starts from what this person told it, not a cold start.
    await supabase.from('nova_memory').insert([
      { fact: `Onboarding: wants ${a.goal?.toLowerCase()} out of Mastermind.` },
      { fact: `Onboarding: describes how they operate as "${a.style}."` },
      { fact: `Onboarding: looking for this now because — ${a.why}` },
    ]);
    await save({ step: 'ai-name', answers: a });
  };

  const submitName = async (name: string) => {
    await saveAssistantName(name);
    await save({ step: 'modules' });
  };

  const submitModules = async (keys: string[]) => {
    await save({ step: 'demo', draft_module_keys: keys });
  };

  const finish = async () => {
    setFinishing(true);
    await onComplete(draftModuleKeys);
    // No setFinishing(false) on success — onComplete flips hasOnboarded,
    // which unmounts this component entirely (AuthedGate re-renders past
    // it). Leaving the spinner state is correct, not a bug.
  };

  return (
    <>
      <ProgressBar step={step} />
      <InviteCodeEntry onRedeem={onRedeemCode} />
      {step === 'questions' && <CurationQuestions initial={answers} onComplete={submitQuestions} />}
      {step === 'ai-name' && <AiNamingStep initialName={assistantName} onComplete={submitName} />}
      {step === 'modules' && <OnboardingScreen onComplete={submitModules} />}
      {step === 'demo' && <PersonalizedDemo assistantName={assistantName} selectedKeys={draftModuleKeys} onContinue={finish} submitting={finishing} />}
    </>
  );
}
