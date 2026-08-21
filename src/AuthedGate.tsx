import Stage from './Stage';
import { useMastermindState } from './state';
import { useModuleAccess } from './data/useModuleAccess';
import { useSubscription } from './data/useSubscription';
import { useTheme } from './data/useTheme';
import { isOwnerIdentity } from './auth/ownerIdentity';
import OnboardingFlow from './onboarding/OnboardingFlow';
import BillingGateScreen from './billing/BillingGateScreen';

interface Props {
  userId: string;
  userEmail: string | null | undefined;
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
export default function AuthedGate({ userId, userEmail, onSignOut }: Props) {
  const { state, actions, assistantName } = useMastermindState();
  const isOwner = isOwnerIdentity({ id: userId, email: userEmail });
  const moduleAccess = useModuleAccess(userId, isOwner);
  const subscription = useSubscription(isOwner);
  const theme = useTheme();

  if (!isOwner) {
    if (moduleAccess.loading) {
      return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
    }
    if (!moduleAccess.hasOnboarded) {
      return (
        <OnboardingFlow
          onComplete={async (keys) => {
            await moduleAccess.saveModuleSelections(keys);
          }}
        />
      );
    }
    if (subscription.loading) {
      return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
    }
    if (!subscription.isActive) {
      return <BillingGateScreen onSubscribed={subscription.refresh} onSignOut={onSignOut} theme={theme.theme} />;
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
        isOwner={isOwner}
        theme={theme.theme}
        onThemeChange={theme.save}
      />
    </div>
  );
}
