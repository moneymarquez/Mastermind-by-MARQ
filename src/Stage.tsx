import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Logo from './components/Logo';
import NavDrawer from './components/NavDrawer';
import NovaTrigger from './components/NovaTrigger';
import NovaPanel from './components/NovaPanel';
import RemindersBox from './components/RemindersBox';
import { useBender } from './data/useBender';
import HomeScreen from './components/screens/HomeScreen';
import DailyPlanScreen from './components/screens/DailyPlanScreen';
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
import ScheduleScreen from './components/screens/ScheduleScreen';
import ContactsScreen from './components/screens/ContactsScreen';
import OpeningClosingScreen from './components/screens/OpeningClosingScreen';
import NotificationSettingsScreen from './components/screens/NotificationSettingsScreen';
import PlaceholderScreen from './components/screens/PlaceholderScreen';
import { buildViewModel } from './viewModel';
import type { AppState, MastermindActions } from './state';

const BUILT_SCREENS = [
  'home', 'daily-plan', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental',
  'scaling-planner', 'audits', 'brand-lab', 'idea-maker', 'schedule', 'contacts', 'opening-closing',
  'notification-settings',
];

interface Props {
  state: AppState;
  actions: MastermindActions;
  onSignOut: () => void;
}

export default function Stage({ state, actions, onSignOut }: Props) {
  const vm = buildViewModel(state, actions.navigateTo, onSignOut);
  const { isMobile } = vm;
  const bender = useBender();

  // Measures RemindersBox (which is position:absolute inside this same
  // position:relative Stage, so offsetLeft/offsetHeight are already in the
  // right coordinate space) so Nova can stack directly above it on mobile —
  // same left edge, bottom offset = Reminders' height + spacing — instead
  // of the two competing for horizontal room side by side.
  const remindersRef = useRef<HTMLDivElement>(null);
  const [remindersBox, setRemindersBox] = useState({ left: 20, height: 0 });
  useEffect(() => {
    const el = remindersRef.current;
    if (!el) return;
    const measure = () => setRemindersBox({ left: el.offsetLeft, height: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile]);
  const novaStackLeft = isMobile ? remindersBox.left : null;
  const novaStackBottomOffset = isMobile ? remindersBox.height + 16 : 0;

  // Fills the real viewport edge-to-edge — no more fixed-size device-mockup
  // box (border/rounded corners/shadow) floating on a page background.
  const stageStyle: CSSProperties = {
    width: vm.stageWidth, height: vm.stageHeight, background: '#0A0B0D', position: 'relative', overflow: 'hidden',
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

        {state.screen === 'daily-plan' && (
          <DailyPlanScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'dialing' && (
          <DialingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
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
          <SobrietyScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} bender={bender} />
        )}

        {state.screen === 'fitness' && (
          <FitnessScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'macros' && (
          <MacrosScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} activeBender={bender.activeBender} />
        )}

        {state.screen === 'goals' && (
          <GoalsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'mental' && (
          <MentalHealthScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} activeBender={bender.activeBender} />
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

        {state.screen === 'schedule' && (
          <ScheduleScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'contacts' && (
          <ContactsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'opening-closing' && (
          <OpeningClosingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'notification-settings' && (
          <NotificationSettingsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {(state.screen === 'placeholder' || !BUILT_SCREENS.includes(state.screen)) && (
          <PlaceholderScreen isMobile={isMobile} label={state.placeholderLabel} note={state.placeholderNote} />
        )}
      </div>

      {state.novaOpen && (
        <NovaPanel
          isMobile={isMobile}
          stackBottomOffset={novaStackBottomOffset}
          stackLeft={novaStackLeft}
          messages={state.novaMessages}
          input={state.novaInput}
          thinking={state.novaThinking}
          onClose={actions.closeNova}
          onInputChange={actions.onNovaInputChange}
          onKeyDown={actions.onNovaKeyDown}
          onSend={actions.sendNova}
        />
      )}

      <RemindersBox ref={remindersRef} isMobile={isMobile} />
    </div>
  );
}
