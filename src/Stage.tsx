import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Sidebar, { SIDEBAR_COLLAPSED_WIDTH } from './components/Sidebar';
import TopHeader from './components/TopHeader';
import MobileHeader from './components/MobileHeader';
import MobileMenuSheet from './components/MobileMenuSheet';
import MobileTabBar from './components/MobileTabBar';
import NovaTrigger from './components/NovaTrigger';
import NovaPanel from './components/NovaPanel';
import RemindersBox from './components/RemindersBox';
import { useBender } from './data/useBender';
import { useNavModulePrefs } from './data/useNavModulePrefs';
import { useOwnerInbox } from './data/useOwnerInbox';
import type { InboxItem } from './data/useOwnerInbox';
import ClientModulesScreen from './components/screens/ClientModulesScreen';
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
import SupportInboxScreen from './components/screens/SupportInboxScreen';
import LegalScreen from './components/screens/LegalScreen';
import ScalingPlannerScreen from './components/screens/ScalingPlannerScreen';
import BusinessAuditsScreen from './components/screens/BusinessAuditsScreen';
import ClientCRMScreen from './components/screens/ClientCRMScreen';
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
import GrantAccessScreen from './components/screens/GrantAccessScreen';
import PlaceholderScreen from './components/screens/PlaceholderScreen';
import ProductTour, { filterTourSteps } from './components/ProductTour';
import { buildViewModel } from './viewModel';
import { moduleKeyForRoute, MODULE_REGISTRY } from './modules.config';
import type { AppState, MastermindActions } from './state';
import type { Theme } from './data/useTheme';

const BUILT_SCREENS = [
  'home', 'daily-plan', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental',
  'scaling-start', 'delivery', 'support-inbox', 'legal', 'scaling-planner', 'audits', 'client-crm', 'client-modules', 'brand-lab', 'idea-maker', 'schedule', 'contacts', 'opening-closing',
  'notification-settings', 'streaming', 'stocks', 'leadflow', 'account-settings', 'prompt-voice-settings',
  'call-recordings', 'website', 'invoicing', 'budgeting', 'marketing', 'decisions', 'weekly-review', 'cashflow', 'patterns', 'voice-capture', 'manage-modules', 'grant-access',
];

interface Props {
  state: AppState;
  actions: MastermindActions;
  assistantName: string;
  canAccess: (moduleKey: string) => boolean;
  onSignOut: () => void;
  currentUserId: string;
  userEmail: string | null | undefined;
  isOwner: boolean;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
}

export default function Stage({ state, actions, assistantName, canAccess, onSignOut, currentUserId, userEmail, isOwner, theme, onThemeChange }: Props) {
  // Desktop-only: the persistent Sidebar's own Menu toggle collapses it to
  // a slim icon-only rail and back — previously a dead button (no onClick
  // at all). Mobile is unaffected; it keeps MobileMenuSheet's overlay.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // This account's own nav preferences (schema_056) — which modules are
  // hidden, and their custom order within each category. Both are a pure
  // display layer on top of real access rather than touching it: navAccess
  // is what actually builds the nav rows below; canAccess itself stays
  // untouched everywhere else in this file (screenBlocked, activeModuleCount,
  // tourSteps) so a hidden/reordered module's screen, data, and reachability
  // from a stat card or Nova action are completely unaffected.
  const navPrefs = useNavModulePrefs();
  // Owner-only data (support_inbox's RLS already scopes it), so this is a
  // harmless empty read for a non-owner account — called unconditionally
  // rather than guarded, same as useModuleAccess elsewhere in this file.
  const ownerInbox = useOwnerInbox();
  // A ticket or client message tapped in the Inbox widget lands on THAT
  // client in Client Modules, not on a list; mail goes to the Support
  // Inbox. Cleared once the screen has consumed it.
  const [clientFocus, setClientFocus] = useState<string | null>(null);
  const openInbox = (item?: InboxItem) => {
    if (item && item.kind !== 'mail' && item.clientId) {
      setClientFocus(item.clientId);
      actions.navigateTo('client-modules');
      return;
    }
    actions.navigateTo('support-inbox');
  };
  const navAccess = (moduleKey: string) => canAccess(moduleKey) && !navPrefs.hidden.has(moduleKey);
  const vm = buildViewModel(state, actions.navigateTo, onSignOut, navAccess, isOwner, navPrefs.order);
  const { isMobile } = vm;
  const bender = useBender();

  // Real counts/labels for the desktop header — no invented "11 streams
  // live" copy. isOwner sees every module as active (Stage always passes
  // canAccess={() => true} for the owner, same as AuthedGate does).
  const activeModuleCount = MODULE_REGISTRY.filter((m) => canAccess(m.key)).length;
  const activeNavLabel = vm.navRows.find((r) => r.kind === 'item' && r.active)?.label ?? 'Overview';
  const ownerDisplayName = isOwner ? 'Cristopher' : userEmail ?? 'Account';

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
  // box (border/rounded corners/shadow) floating on a page background. The
  // diagonal shine (app-shine-bg, defined in index.css) supplies the
  // background instead of a flat color — no inline `background` here, or
  // it'd win specificity over the class and flatten the gradient.
  const stageStyle: CSSProperties = {
    width: vm.stageWidth, height: vm.stageHeight, position: 'relative', overflow: 'hidden',
  };

  return (
    <div className="app-shine-bg" style={stageStyle}>
      {isMobile ? (
        <>
          <MobileHeader onOpenMenu={actions.toggleDrawer} />

          <MobileMenuSheet
            open={state.navDrawerOpen}
            rows={vm.navRows}
            ownerName={ownerDisplayName}
            isOwner={isOwner}
            theme={theme}
            onThemeChange={onThemeChange}
            onClose={actions.closeDrawer}
            onOpenSettings={() => actions.navigateTo('account-settings')}
            onOpenTour={startTour}
            inboxItems={ownerInbox.items}
            inboxLoading={ownerInbox.loading}
            onOpenInbox={openInbox}
          />

          <MobileTabBar
            screen={state.screen}
            novaOpen={state.novaOpen}
            onNavigate={actions.navigateTo}
            onToggleNova={state.novaOpen ? actions.closeNova : actions.openNova}
          />
        </>
      ) : (
        <>
          <Sidebar
            rows={vm.navRows}
            ownerName={ownerDisplayName}
            isOwner={isOwner}
            onOpenSettings={() => actions.navigateTo('account-settings')}
            inboxItems={ownerInbox.items}
            inboxLoading={ownerInbox.loading}
            onOpenInbox={openInbox}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
          />
          <TopHeader
            left={sidebarOpen ? vm.sidebarWidth : SIDEBAR_COLLAPSED_WIDTH}
            screenLabel={activeNavLabel}
            activeModuleCount={activeModuleCount}
            onOpenTour={startTour}
            onOpenNotifications={() => actions.navigateTo('notification-settings')}
          />

          {/* The floating draggable Nova trigger is desktop-only now —
              mobile's entry point is the tab bar's centre FAB, matching the
              reference's "bottom bar with Nova as the centre action". */}
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
        </>
      )}

      {/* vm.contentStyle's own bottom padding only clears the chrome fixed
          beneath the content pane on each platform (MobileTabBar on
          mobile; nothing baked in for desktop). RemindersBox is a
          SEPARATE floating overlay on top of that, at bottom-right of the
          whole Stage regardless of scroll position — so long-scrolling
          screens (Schedule's month grid, a client's audit tab with many
          questions, etc.) could still end up running underneath it even
          after clearing the tab bar. Pad the extra measured height in
          here on BOTH platforms so content always clears the actual box,
          not just whatever's fixed beneath it — this used to be
          mobile-only, which is exactly why a desktop screen's last
          element (e.g. ClientDetailView's "Delete client") could render
          right where RemindersBox sits and become unreachable by
          scrolling any further. */}
      <div
        id="tour-content-panel"
        style={{
          ...vm.contentStyle,
          left: isMobile ? 0 : (sidebarOpen ? vm.sidebarWidth : SIDEBAR_COLLAPSED_WIDTH),
          transition: isMobile ? undefined : 'left 0.18s ease',
          paddingBottom: isMobile
            ? `calc(${vm.tabBarHeight + 20 + remindersBox.height + 20}px + env(safe-area-inset-bottom))`
            : `${48 + remindersBox.height + 20}px`,
        }}
      >
        {screenBlocked ? (
          <PlaceholderScreen isMobile={isMobile} label="Not available" note="This section isn't available on your account." />
        ) : (
          <>
        {state.screen === 'home' && (
          <HomeScreen isMobile={isMobile} homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} statGridStyle={vm.statGridStyle} statCards={vm.statCards} onOpenNova={actions.openNova} assistantName={assistantName} onNavigate={actions.navigateTo} />
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

        {state.screen === 'support-inbox' && (
          <SupportInboxScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'legal' && (
          <LegalScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'scaling-planner' && (
          <ScalingPlannerScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'client-crm' && (
          <ClientCRMScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'client-modules' && (
          <ClientModulesScreen
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            focusClientId={clientFocus}
            onClearFocus={() => setClientFocus(null)}
            onChanged={ownerInbox.reload}
          />
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
          <AccountSettingsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onSignOut={onSignOut} onStartTour={startTour} theme={theme} onThemeChange={onThemeChange} />
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
          <ManageModulesScreen
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            currentUserId={currentUserId}
            isOwner={isOwner}
            canAccess={canAccess}
            hiddenModules={navPrefs.hidden}
            order={navPrefs.order}
            onToggleHidden={navPrefs.setModuleHidden}
            onReorderCategory={navPrefs.reorderCategory}
          />
        )}

        {state.screen === 'grant-access' && isOwner && (
          <GrantAccessScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
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

      <RemindersBox ref={remindersRef} isMobile={isMobile} bottomOffset={isMobile ? `calc(${vm.tabBarHeight + 20}px + env(safe-area-inset-bottom))` : '20px'} />

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
