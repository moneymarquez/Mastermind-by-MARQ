import { Suspense, useEffect, useState } from 'react';
import { useMyTeams } from './data/useDispatch';
import { hasPendingJoin, redeemPendingJoin } from './dispatch/join';
import { lazyScreen } from './lib/lazyScreen';
import Stage from './Stage';
import { useMastermindState } from './state';
import { useModuleAccess } from './data/useModuleAccess';
import { useSubscription } from './data/useSubscription';
import { useTheme } from './data/useTheme';
import { isOwnerIdentity } from './auth/ownerIdentity';
;
import { setPromptUser } from './lib/promptUser';
;
import { supabase } from './lib/supabase';
const OnboardingFlow = lazyScreen(() => import('./onboarding/OnboardingFlow'));
const BillingGateScreen = lazyScreen(() => import('./billing/BillingGateScreen'));
const MemberApp = lazyScreen(() => import('./dispatch/MemberApp'));

interface Props {
  userId: string;
  userEmail: string | null | undefined;
  userDisplayName: string | null;
  onSignOut: () => void;
}

// Only ever mounted once App.tsx has confirmed a real session exists — that
// mount timing IS the fix for the two data hooks below not re-fetching
// after login (they each fetch once on mount; mounting this component
// exactly when a session first exists means that "once" always happens
// post-auth, never before).
//
// isOwner is computed synchronously, first, before either data hook's
// result is looked at — it is derived directly from props that were
// already resolved by App.tsx's useAuth() before this component mounted,
// not from a network call made here. That's the deliberate fix for the
// live incident where the owner's account got stuck behind onboarding:
// the old check called supabase.auth.getUser() + an is_owner() RPC on
// mount, and when either raced or failed, it silently resolved to "not
// owner." Nothing here can do that — there's no request in flight for it
// to race or fail. The owner branch below never even reads
// moduleAccess.loading or subscription.loading; it can't get stuck behind
// either.
export default function AuthedGate({ userId, userEmail, userDisplayName, onSignOut }: Props) {
  const { state, actions, assistantName } = useMastermindState(userDisplayName);
  setPromptUser(isOwnerIdentity({ id: userId, email: userEmail }), userDisplayName);
  const isOwner = isOwnerIdentity({ id: userId, email: userEmail });
  const moduleAccess = useModuleAccess(userId, isOwner);
  const subscription = useSubscription(isOwner);
  const theme = useTheme();
  // Dispatch teams (spec 15 §2.4): an invite link redeems here, and someone
  // who's on a team without their own subscription gets the slim member app
  // instead of onboarding and the paywall.
  const myTeams = useMyTeams(!isOwner);
  const [joining, setJoining] = useState(hasPendingJoin());
  const [joinNote, setJoinNote] = useState<string | null>(null);
  useEffect(() => {
    if (!joining) return;
    void redeemPendingJoin().then(async (r) => {
      if (r?.joined) setJoinNote(`You're on ${r.owner_name}'s team. Their tasks for you show up here.`);
      else if (r?.error) setJoinNote(r.error);
      await myTeams.refresh();
      setJoining(false);
    });
  }, [joining]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOwner) {
    if (joining || myTeams.loading) {
      return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
    }
    const teamOnly = myTeams.teams.length > 0 && !subscription.loading && !subscription.isActive;
    if (teamOnly) {
      return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}><MemberApp teams={myTeams.teams} userId={userId} onSignOut={onSignOut} banner={joinNote} /></Suspense>;
    }
    if (myTeams.teams.length > 0 && subscription.loading) {
      return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
    }
    if (moduleAccess.loading) {
      return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
    }
    if (!moduleAccess.hasOnboarded) {
      return (
        <OnboardingFlow
          onComplete={async (keys) => {
            await moduleAccess.saveModuleSelections(keys);
          }}
          onRedeemCode={async (code) => {
            const { error } = await supabase.rpc('redeem_comp_code', { input_code: code });
            if (error) throw error;
            // Flips hasOnboarded + comped in one shot — both hooks re-fetch
            // is_comped(), and this whole gate re-renders straight to Stage
            // (see schema_044_comp_codes.sql / useModuleAccess.ts).
            await Promise.all([moduleAccess.refresh(), subscription.refresh()]);
          }}
        />
      );
    }
    if (subscription.loading) {
      return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
    }
    if (!subscription.isActive) {
      return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}><BillingGateScreen onSubscribed={subscription.refresh} onSignOut={onSignOut} theme={theme.theme} /></Suspense>;
    }
  }

  return (
    <div style={{ background: 'var(--bg)' }}>
      <Stage
        state={state}
        actions={actions}
        assistantName={assistantName}
        canAccess={isOwner ? () => true : moduleAccess.canAccess}
        onSignOut={onSignOut}
        currentUserId={userId}
        userEmail={userEmail}
        userDisplayName={userDisplayName}
        isOwner={isOwner}
        theme={theme.theme}
        onThemeChange={theme.save}
        soundFx={theme.soundFx}
        onSoundFxChange={theme.saveSoundFx}
      />
    </div>
  );
}
