import Stage from './Stage';
import { useMastermindState } from './state';
import { useAuth } from './auth/useAuth';
import LoginScreen from './auth/LoginScreen';

export default function App() {
  const { state, actions } = useMastermindState();
  const { session, loading, signIn, signOut } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0A0B0D' }} />;
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} />;
  }

  return (
    <div style={{ background: '#0A0B0D' }}>
      <Stage state={state} actions={actions} onSignOut={signOut} />
    </div>
  );
}
