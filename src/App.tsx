import { Suspense } from 'react';
import { lazyScreen } from './lib/lazyScreen';
import AuthedGate from './AuthedGate';
import { useDemo, stopDemo } from './demo/state';
import { DEMO_USER } from './demo/seed';
import { useAuth } from './auth/useAuth';
import AuthScreen from './auth/AuthScreen';
import SetNewPasswordScreen from './auth/SetNewPasswordScreen';
import { isOwnerIdentity } from './auth/ownerIdentity';
import { useUserRole } from './data/useUserRole';
const ClientPortal = lazyScreen(() => import('./client-portal/ClientPortal'));
;

interface GatedProps {
  userId: string;
  userEmail: string | null | undefined;
  userDisplayName: string | null;
  onSignOut: () => void;
}

/** Resolves role BEFORE AuthedGate ever mounts, so a client-login account
 *  (schema_045_client_login.sql) never touches AuthedGate's hooks at all —
 *  no useMastermindState, no module/subscription queries, none of it.
 *  Only the owner path needs to stay perfectly synchronous (see
 *  ownerIdentity.ts); everyone else pays one profiles lookup here. */
function Gated({ userId, userEmail, userDisplayName, onSignOut }: GatedProps) {
  const isOwner = isOwnerIdentity({ id: userId, email: userEmail });
  const { role, loading } = useUserRole(isOwner);

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }
  if (role === 'client') {
    return <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}><ClientPortal onSignOut={onSignOut} /></Suspense>;
  }
  return <AuthedGate userId={userId} userEmail={userEmail} userDisplayName={userDisplayName} onSignOut={onSignOut} />;
}

export default function App() {
  const { session, loading, signIn, signUp, signOut, passwordRecovery, resetPassword, completePasswordReset } = useAuth();
  const demo = useDemo();

  // Demo Mode: a separate tree on the demo identity, keyed by run so every
  // data hook mounts fresh against the in-memory copy — and again against
  // the real client on exit. Works logged out too ("See a 2-minute demo").
  if (demo.active) {
    return <Gated key={`demo-${demo.run}`} userId={DEMO_USER.id} userEmail={DEMO_USER.email} userDisplayName={DEMO_USER.name} onSignOut={stopDemo} />;
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }

  // Takes priority over the session check below — clicking a reset-
  // password email link hands Supabase a real session, but one that's
  // only good for setting a new password, not for using the app.
  if (passwordRecovery) {
    return <SetNewPasswordScreen onComplete={completePasswordReset} />;
  }

  if (!session) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} onResetPassword={resetPassword} />;
  }

  // Keyed on the user id so a sign-out/sign-in as a different account
  // forces a fresh mount — and a fresh mount is what makes the data hooks
  // below fetch for the right account instead of carrying over stale
  // state. userId/userEmail are passed down (not re-fetched inside) so
  // the owner check stays synchronous and zero-network — see
  // src/auth/ownerIdentity.ts for why that matters.
  return (
    <Gated
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email}
      userDisplayName={(session.user.user_metadata?.full_name as string | undefined)?.trim() || null}
      onSignOut={signOut}
    />
  );
}
