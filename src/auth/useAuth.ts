import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface SignUpResult {
  error?: string;
  /** True when the account was created but Supabase requires email
   *  confirmation before a session is issued — the caller has no session
   *  yet in that case, so it can't fall through to onboarding. */
  needsConfirmation?: boolean;
}

// Supabase's own client can re-notify subscribers with a plain SIGNED_IN
// shortly after the initial PASSWORD_RECOVERY (observed on a visibility-
// change resync) — reading React state alone isn't durable against that,
// or against anything else that happens to remount this hook mid-flow.
// sessionStorage survives either case, so the "we're mid password-reset"
// fact isn't lost the moment something other than completePasswordReset
// tries to move on from it.
const RECOVERY_FLAG_KEY = 'mm-password-recovery';

function readRecoveryFlag(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function writeRecoveryFlag(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    else sessionStorage.removeItem(RECOVERY_FLAG_KEY);
  } catch {
    // Storage can be unavailable (private browsing, etc.) — the in-memory
    // state below still works for the common case, just not across a
    // remount in that situation.
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Supabase's reset-password link lands back on this app with a real,
  // temporary session and fires this event — that session is only good
  // for setting a new password, not for using the app, so App.tsx must
  // route to a "set new password" screen instead of falling through to
  // the normal authed app just because `session` is now non-null.
  const [passwordRecovery, setPasswordRecoveryState] = useState(readRecoveryFlag);
  const setPasswordRecovery = (on: boolean) => {
    writeRecoveryFlag(on);
    setPasswordRecoveryState(on);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // Supabase's anti-enumeration behavior: signing up with an email that
    // already belongs to a CONFIRMED user returns a 200 with no error and
    // no session, identical on the surface to a real new signup — except
    // `identities` comes back empty, and (silently, by design) no email
    // is ever sent. Treating that the same as needsConfirmation told
    // people to "check your email" for a confirmation that was never
    // going out, leaving them stuck. Detect it and say what's actually
    // true instead.
    if (data.user && data.user.identities?.length === 0) {
      return { error: 'That email already has an account — log in instead.' };
    }
    if (!data.session) return { needsConfirmation: true };
    return {};
  };

  const signOut = () => supabase.auth.signOut();

  /** Always reports success regardless of whether the email is actually
   *  registered — same anti-enumeration reasoning as signUp above, except
   *  here it's correct to mirror: a reset request should never reveal
   *  whether an account exists. Supabase only actually sends the email
   *  when it does. */
  const resetPassword = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    return error ? error.message : null;
  };

  const completePasswordReset = async (newPassword: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return error.message;
    setPasswordRecovery(false);
    return null;
  };

  return { session, loading, signIn, signUp, signOut, passwordRecovery, resetPassword, completePasswordReset };
}
