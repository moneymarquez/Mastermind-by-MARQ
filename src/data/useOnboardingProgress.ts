import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type OnboardingStep = 'questions' | 'ai-name' | 'modules' | 'demo';

export interface OnboardingAnswers {
  goal?: string;
  style?: string;
  why?: string;
}

export function useOnboardingProgress() {
  const [step, setStep] = useState<OnboardingStep>('questions');
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [draftModuleKeys, setDraftModuleKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('onboarding_progress').select('*').maybeSingle();
    if (data) {
      setStep(data.step as OnboardingStep);
      setAnswers((data.answers as OnboardingAnswers) ?? {});
      setDraftModuleKeys((data.draft_module_keys as string[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: Partial<{ step: OnboardingStep; answers: OnboardingAnswers; draft_module_keys: string[] }>) => {
    if (patch.step) setStep(patch.step);
    if (patch.answers) setAnswers((prev) => ({ ...prev, ...patch.answers }));
    if (patch.draft_module_keys) setDraftModuleKeys(patch.draft_module_keys);
    await supabase.from('onboarding_progress').upsert(
      { step: patch.step ?? step, answers: patch.answers ? { ...answers, ...patch.answers } : answers, draft_module_keys: patch.draft_module_keys ?? draftModuleKeys, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  };

  return { step, answers, draftModuleKeys, loading, save };
}
