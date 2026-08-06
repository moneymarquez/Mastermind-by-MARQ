import type { CSSProperties } from 'react';
import Logo from './components/Logo';
import NavDrawer from './components/NavDrawer';
import NovaTrigger from './components/NovaTrigger';
import NovaPanel from './components/NovaPanel';
import RemindersBox from './components/RemindersBox';
import HomeScreen from './components/screens/HomeScreen';
import DialingScreen from './components/screens/DialingScreen';
import StickySpotScreen from './components/screens/StickySpotScreen';
import SobrietyScreen from './components/screens/SobrietyScreen';
import FitnessScreen from './components/screens/FitnessScreen';
import MacrosScreen from './components/screens/MacrosScreen';
import GoalsScreen from './components/screens/GoalsScreen';
import MentalHealthScreen from './components/screens/MentalHealthScreen';
import ScalingPlannerScreen from './components/screens/ScalingPlannerScreen';
import BusinessAuditsScreen from './components/screens/BusinessAuditsScreen';
import IdeaMakerScreen from './components/screens/IdeaMakerScreen';
import BrandLabScreen from './components/screens/BrandLabScreen';
import PlaceholderScreen from './components/screens/PlaceholderScreen';
import { buildViewModel } from './viewModel';
import type { AppState, MastermindActions } from './state';

const BUILT_SCREENS = [
  'home', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental',
  'scaling-planner', 'audits', 'brand-lab', 'idea-maker',
];

interface Props {
  state: AppState;
  actions: MastermindActions;
  onSignOut: () => void;
}

export default function Stage({ state, actions, onSignOut }: Props) {
  const vm = buildViewModel(state, actions.navigateTo, onSignOut);
  const { isMobile } = vm;

  const stageStyle: CSSProperties = {
    width: vm.stageWidth, height: vm.stageHeight, background: '#0A0B0D', position: 'relative',
    overflow: 'hidden', borderRadius: isMobile ? 40 : 4, border: isMobile ? '8px solid #1a1a1a' : '1px solid #22262B',
    boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
  };

  return (
    <div style={stageStyle}>
      <Logo isMobile={isMobile} onClick={() => actions.goScreen('home')} />

      <NavDrawer
        open={state.navDrawerOpen}
        rows={vm.navRows}
        onToggle={actions.toggleDrawer}
        onClose={actions.closeDrawer}
      />

      <NovaTrigger
        cx={vm.cx}
        cy={vm.cy}
        circleSize={vm.circleSize}
        dragging={state.dragging}
        novaOpen={state.novaOpen}
        onPointerDown={actions.onCirclePointerDown}
        onPointerMove={actions.onCirclePointerMove}
        onPointerUp={actions.onCirclePointerUp}
      />

      <div style={vm.contentStyle}>
        {state.screen === 'home' && (
          <HomeScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} statGridStyle={vm.statGridStyle} statCards={vm.statCards} />
        )}

        {state.screen === 'dialing' && (
          <DialingScreen dialCount={state.dialCount} dialGoal={state.dialGoal} onLogCall={actions.logCall} />
        )}

        {state.screen === 'sticky-spot' && (
          <StickySpotScreen
            newIdeaText={state.newIdeaText}
            newIdeaEst={state.newIdeaEst}
            onNewIdeaText={actions.onNewIdeaText}
            onNewIdeaEst={actions.onNewIdeaEst}
            onAdd={actions.addStickyIdea}
            stickyIdeas={state.stickyIdeas}
            onRemove={actions.removeStickyIdea}
          />
        )}

        {state.screen === 'sobriety' && (
          <SobrietyScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'fitness' && (
          <FitnessScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'macros' && (
          <MacrosScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'goals' && (
          <GoalsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'mental' && (
          <MentalHealthScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'scaling-planner' && (
          <ScalingPlannerScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'audits' && (
          <BusinessAuditsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'brand-lab' && (
          <BrandLabScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'idea-maker' && (
          <IdeaMakerScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {(state.screen === 'placeholder' || !BUILT_SCREENS.includes(state.screen)) && (
          <PlaceholderScreen isMobile={isMobile} label={state.placeholderLabel} note={state.placeholderNote} />
        )}
      </div>

      {state.novaOpen && (
        <NovaPanel
          isMobile={isMobile}
          pos={state.novaPos || { x: vm.cx, y: vm.cy + 80 }}
          messages={state.novaMessages}
          input={state.novaInput}
          onClose={actions.closeNova}
          onDragPointerDown={actions.onNovaPointerDown}
          onDragPointerMove={actions.onNovaPointerMove}
          onDragPointerUp={actions.onNovaPointerUp}
          onInputChange={actions.onNovaInputChange}
          onKeyDown={actions.onNovaKeyDown}
          onSend={actions.sendNova}
        />
      )}

      <RemindersBox isMobile={isMobile} />
    </div>
  );
}
