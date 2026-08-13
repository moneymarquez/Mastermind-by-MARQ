import Stage from './Stage';
import { useMastermindState } from './state';
import { useModuleAccess } from './data/useModuleAccess';
import { useSubscription } from './data/useSubscription';
import OnboardingScreen from './onboarding/OnboardingScreen';
import BillingGateScreen from './billing/BillingGateScreen';

interface Props {
  onSignOut: () => void;
}

// Only ever mounted once App.tsx has confirmed a real session exists — that
// mount timing IS the fix for the two data hooks below not re-fetching
// after login (they each fetch once on mount; mounting this component
// exactly when a session first exists means that "once" always happens
// post-auth, never before).
//
// Gating order matters and is deliberate: isOwner is checked before
// hasOnboarded, which is checked before the subscription's isActive — the
// owner account (schema_023's app_owner bootstrap, the account this app
// has always run as) short-circuits straight to Stage regardless of what
// user_modules/subscriptions says for it, per the explicit requirement
// that it must never see onboarding or a billing gate.
export default function AuthedGate({ onSignOut }: Props) {
  const { state, actions, assistantName } = useMastermindState();
  const moduleAccess = useModuleAccess();
  const subscription = useSubscription();

  if (moduleAccess.loading) {
    return <div style={{ minHeight: '100vh', background: '#0A0B0D' }} />;
  }

  if (!moduleAccess.isOwner) {
    if (!moduleAccess.hasOnboarded) {
      return (
        <OnboardingScreen
          onComplete={async (keys) => {
            await moduleAccess.saveModuleSelections(keys);
          }}
        />
      );
    }
    if (subscription.loading) {
      return <div style={{ minHeight: '100vh', background: '#0A0B0D' }} />;
    }
    if (!subscription.isActive) {
      return <BillingGateScreen onSubscribed={subscription.refresh} onSignOut={onSignOut} />;
    }
  }

  return (
    <div style={{ background: '#0A0B0D' }}>
      <Stage state={state} actions={actions} assistantName={assistantName} canAccess={moduleAccess.canAccess} onSignOut={onSignOut} />
    </div>
  );
}
