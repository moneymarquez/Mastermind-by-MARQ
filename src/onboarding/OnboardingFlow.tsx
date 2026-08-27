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

export default function OnboardingFlow({ onComplete }: Props) {
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
      {step === 'questions' && <CurationQuestions initial={answers} onComplete={submitQuestions} />}
      {step === 'ai-name' && <AiNamingStep initialName={assistantName} onComplete={submitName} />}
      {step === 'modules' && <OnboardingScreen onComplete={submitModules} />}
      {step === 'demo' && <PersonalizedDemo assistantName={assistantName} selectedKeys={draftModuleKeys} onContinue={finish} submitting={finishing} />}
    </>
  );
}
