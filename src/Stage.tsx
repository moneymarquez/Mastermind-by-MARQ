import { useEffect, useMemo, useRef, useState } from 'react';
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
import ScalingStartScreen from './components/screens/ScalingStartScreen';
import ClientDeliveryScreen from './components/screens/ClientDeliveryScreen';
import ScalingPlannerScreen from './components/screens/ScalingPlannerScreen';
import BusinessAuditsScreen from './components/screens/BusinessAuditsScreen';
import IdeaMakerScreen from './components/screens/IdeaMakerScreen';
import BrandLabScreen from './components/screens/BrandLabScreen';
import ScheduleScreen from './components/screens/ScheduleScreen';
import ContactsScreen from './components/screens/ContactsScreen';
import OpeningClosingScreen from './components/screens/OpeningClosingScreen';
import NotificationSettingsScreen from './components/screens/NotificationSettingsScreen';
import StreamingScreen from './components/screens/StreamingScreen';
import StocksScreen from './components/screens/StocksScreen';
import LeadFlowScreen from './components/screens/LeadFlowScreen';
import AccountSettingsScreen from './components/screens/AccountSettingsScreen';
import PromptVoiceSettingsScreen from './components/screens/PromptVoiceSettingsScreen';
import CallRecordingsScreen from './components/screens/CallRecordingsScreen';
import WebsiteBuilderRoadmapScreen from './components/screens/WebsiteBuilderRoadmapScreen';
import InvoicingScreen from './components/screens/InvoicingScreen';
import BudgetingScreen from './components/screens/BudgetingScreen';
import MarketingScreen from './components/screens/MarketingScreen';
import DecisionLogScreen from './components/screens/DecisionLogScreen';
import WeeklyReviewScreen from './components/screens/WeeklyReviewScreen';
import CashFlowScreen from './components/screens/CashFlowScreen';
import PatternDetectionScreen from './components/screens/PatternDetectionScreen';
import VoiceCaptureScreen from './components/screens/VoiceCaptureScreen';
import ManageModulesScreen from './components/screens/ManageModulesScreen';
import PlaceholderScreen from './components/screens/PlaceholderScreen';
import ProductTour, { filterTourSteps } from './components/ProductTour';
import { buildViewModel } from './viewModel';
import { moduleKeyForRoute } from './modules.config';
import type { AppState, MastermindActions } from './state';

const BUILT_SCREENS = [
  'home', 'daily-plan', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental',
  'scaling-start', 'delivery', 'scaling-planner', 'audits', 'brand-lab', 'idea-maker', 'schedule', 'contacts', 'opening-closing',
  'notification-settings', 'streaming', 'stocks', 'leadflow', 'account-settings', 'prompt-voice-settings',
  'call-recordings', 'website', 'invoicing', 'budgeting', 'marketing', 'decisions', 'weekly-review', 'cashflow', 'patterns', 'voice-capture', 'manage-modules',
];

interface Props {
  state: AppState;
  actions: MastermindActions;
  assistantName: string;
  canAccess: (moduleKey: string) => boolean;
  onSignOut: () => void;
  currentUserId: string;
  isOwner: boolean;
}

export default function Stage({ state, actions, assistantName, canAccess, onSignOut, currentUserId, isOwner }: Props) {
  const vm = buildViewModel(state, actions.navigateTo, onSignOut, canAccess);
  const { isMobile } = vm;
  const bender = useBender();

  // Second, screen-level access check — buildNavData only ever filters
  // which rows the nav *drawer* shows; it doesn't stop state.screen from
  // being set to something un-navigated-to (nothing currently prevents
  // that). Without this, a gated screen's UI shell (though never its
  // actual data — every table backing these screens has its own RLS) was
  // still reachable. moduleKeyForRoute returns undefined for system-level
  // screens (home, settings, codelab, manage-modules, placeholder), which
  // always pass through unblocked.
  const routeModuleKey = moduleKeyForRoute(state.screen);
  const screenBlocked = routeModuleKey ? !canAccess(routeModuleKey) : false;

  // Product tour — on-demand only (help icon or Settings), never
  // auto-started. Steps are filtered by the same canAccess used for
  // screen-level gating above, so a non-owner account (or one that never
  // selected a given module) just skips that stop instead of landing on a
  // "not available" screen mid-tour.
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const tourSteps = useMemo(() => filterTourSteps(canAccess), [canAccess]);
  const startTour = () => { setTourStep(0); setTourActive(true); };
  const stopTour = () => setTourActive(false);

  useEffect(() => {
    if (!tourActive) return;
    const step = tourSteps[tourStep];
    if (step?.screen && step.screen !== state.screen) actions.goScreen(step.screen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, tourStep]);

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

      {!tourActive && (
        <div
          title="Take the product tour"
          onClick={startTour}
          style={{
            position: 'absolute', top: 'calc(24px + env(safe-area-inset-top))', right: 72, width: 42, height: 42, borderRadius: '50%',
            background: '#14161A', border: '1px solid #22262B', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', zIndex: 41, fontSize: 15, fontWeight: 700, color: '#8A8F98',
          }}
        >
          ?
        </div>
      )}

      {/* Hidden on mobile while Nova's open — the bottom sheet has its own
          close button, and leaving this visible put a floating "X" wherever
          circlePos happened to sit (e.g. under the hamburger) with no visual
          connection to the sheet at the bottom of the screen. Desktop keeps
          it, since desktop's panel is anchored near the trigger itself. */}
      {!(isMobile && state.novaOpen) && (
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
      )}

      <div id="tour-content-panel" style={vm.contentStyle}>
        {screenBlocked ? (
          <PlaceholderScreen isMobile={isMobile} label="Not available" note="This section isn't available on your account." />
        ) : (
          <>
        {state.screen === 'home' && (
          <HomeScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} statGridStyle={vm.statGridStyle} statCards={vm.statCards} onOpenNova={actions.openNova} assistantName={assistantName} onNavigate={actions.navigateTo} />
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

        {state.screen === 'scaling-start' && (
          <ScalingStartScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onNavigate={actions.navigateTo} />
        )}

        {state.screen === 'delivery' && (
          <ClientDeliveryScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onNavigate={actions.navigateTo} />
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

        {state.screen === 'streaming' && (
          <StreamingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} isOwner={isOwner} />
        )}

        {state.screen === 'stocks' && (
          <StocksScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'leadflow' && (
          <LeadFlowScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'account-settings' && (
          <AccountSettingsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onSignOut={onSignOut} onStartTour={startTour} />
        )}

        {state.screen === 'prompt-voice-settings' && (
          <PromptVoiceSettingsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'call-recordings' && (
          <CallRecordingsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'website' && (
          <WebsiteBuilderRoadmapScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'invoicing' && (
          <InvoicingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'budgeting' && (
          <BudgetingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'marketing' && (
          <MarketingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'decisions' && (
          <DecisionLogScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'weekly-review' && (
          <WeeklyReviewScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'cashflow' && (
          <CashFlowScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'patterns' && (
          <PatternDetectionScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'voice-capture' && (
          <VoiceCaptureScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'manage-modules' && (
          <ManageModulesScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} currentUserId={currentUserId} isOwner={isOwner} />
        )}

        {(state.screen === 'placeholder' || !BUILT_SCREENS.includes(state.screen)) && (
          <PlaceholderScreen isMobile={isMobile} label={state.placeholderLabel} note={state.placeholderNote} />
        )}
          </>
        )}
      </div>

      {state.novaOpen && (
        <NovaPanel
          isMobile={isMobile}
          stackBottomOffset={novaStackBottomOffset}
          stackLeft={novaStackLeft}
          assistantName={assistantName}
          messages={state.novaMessages}
          input={state.novaInput}
          thinking={state.novaThinking}
          listening={state.novaListening}
          onClose={actions.closeNova}
          onInputChange={actions.onNovaInputChange}
          onKeyDown={actions.onNovaKeyDown}
          onSend={actions.sendNova}
          onMicClick={state.novaListening ? actions.stopVoiceInput : actions.startVoiceInput}
        />
      )}

      <RemindersBox ref={remindersRef} isMobile={isMobile} />

      <ProductTour
        active={tourActive}
        steps={tourSteps}
        stepIndex={tourStep}
        onNext={() => (tourStep >= tourSteps.length - 1 ? stopTour() : setTourStep((i) => i + 1))}
        onBack={() => setTourStep((i) => Math.max(0, i - 1))}
        onSkip={stopTour}
      />
    </div>
  );
}
