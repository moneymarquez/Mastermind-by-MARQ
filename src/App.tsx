import TopBar from './components/TopBar';
import Stage from './Stage';
import { useMastermindState } from './state';
import { useAuth } from './auth/useAuth';
import LoginScreen from './auth/LoginScreen';

const DIR_CAPTIONS: Record<number, string> = {
  1: 'Direction 1 — compact core: smaller circle.',
  2: 'Direction 2 — bold core: larger circle.',
  3: 'Direction 3 — balanced core: medium circle.',
};

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
    <div style={{ minHeight: '100vh', background: '#EDEEF0' }}>
      <TopBar
        direction={state.direction}
        device={state.device}
        screen={state.screen}
        onDirection={actions.setDirection}
        onDevice={actions.setDevice}
        onScreen={actions.goScreen}
        caption={DIR_CAPTIONS[state.direction]}
      />
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 20px 60px' }}>
        <Stage state={state} actions={actions} onSignOut={signOut} />
      </div>
    </div>
  );
}
