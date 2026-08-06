import TopBar from './components/TopBar';
import Stage from './Stage';
import { useMastermindState } from './state';

const DIR_CAPTIONS: Record<number, string> = {
  1: 'Direction 1 — compact core: smaller circle.',
  2: 'Direction 2 — bold core: larger circle.',
  3: 'Direction 3 — balanced core: medium circle.',
};

export default function App() {
  const { state, actions } = useMastermindState();

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
        <Stage state={state} actions={actions} />
      </div>
    </div>
  );
}
