import AuthedGate from './AuthedGate';
import { useAuth } from './auth/useAuth';
import AuthScreen from './auth/AuthScreen';

export default function App() {
  const { session, loading, signIn, signUp, signOut } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0A0B0D' }} />;
  }

  if (!session) {
    return <AuthScreen onSignIn={signIn} onSignUp={signUp} />;
  }

  // Keyed on the user id so a sign-out/sign-in as a different account
  // forces a fresh mount — and a fresh mount is what makes AuthedGate's
  // data hooks fetch for the right account instead of carrying over stale
  // state. userId/userEmail are passed down (not re-fetched inside
  // AuthedGate) so the owner check there is synchronous and zero-network —
  // see src/auth/ownerIdentity.ts for why that matters.
  return (
    <AuthedGate
      key={session.user.id}
      userId={session.user.id}
      userEmail={session.user.email}
      onSignOut={signOut}
    />
  );
}
