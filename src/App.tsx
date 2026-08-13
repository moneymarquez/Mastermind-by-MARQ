import AuthedGate from './AuthedGate';
import { useAuth } from './auth/useAuth';
import LoginScreen from './auth/LoginScreen';

export default function App() {
  const { session, loading, signIn, signOut } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0A0B0D' }} />;
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} />;
  }

  // Keyed on the user id so a sign-out/sign-in as a different account (not
  // a real scenario for this app today, but cheap insurance) forces a
  // fresh mount — and a fresh mount is what makes AuthedGate's data hooks
  // fetch for the right account instead of carrying over stale state.
  return <AuthedGate key={session.user.id} onSignOut={signOut} />;
}
