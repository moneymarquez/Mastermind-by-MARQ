import ErrorBoundary from './components/ErrorBoundary';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lazyScreen } from './lib/lazyScreen';
import type { CSSProperties } from 'react';
import NovaPanel from './components/NovaPanel';
import { useNavModulePrefs } from './data/useNavModulePrefs';
import { useOwnerInbox } from './data/useOwnerInbox';
import { HomeExtras } from './components/screens/home/HomeExtras';
import PlaceholderScreen from './components/screens/PlaceholderScreen';
import ProductTour, { filterTourSteps } from './components/ProductTour';
import { buildViewModel } from './viewModel';
import { moduleKeyForRoute } from './modules.config';
import type { AppState, MastermindActions } from './state';
import type { Theme } from './data/useTheme';
import Celebration from './components/fx/Celebration';
import { useDemo, stopDemo } from './demo/state';
import { DispatchProvider } from './dispatch/DispatchContext';
import { ModuleProvider } from './components/mm/Page';
import type { ModuleCtxValue } from './components/mm/Page';
import { PhoneHeader, PhoneTabBar, AppSidebar, AppTopBar, NotificationsPanel, SearchPalette, ModulesGrid, deviceFor, sidebarW, PHONE_HEADER_H, PHONE_TAB_H, TOP_BAR_H, NOVA_DOCK_W } from './components/shell/Shell';
import { shellGroups, crumbFor } from './components/shell/nav';
import { useLeadFeed } from './data/useLeadFeed';
import { useNotifications } from './data/useNotifications';
import { useResolvedTheme } from './data/useTheme';

// Screens load on demand; Overview ships in the main bundle.
const DemoTour = lazyScreen(() => import('./demo/DemoTour'));
const ChangelogScreen = lazyScreen(() => import('./components/screens/ChangelogScreen'));
const DispatchScreen = lazyScreen(() => import('./dispatch/DispatchScreen'));
const DispatchLayer = lazyScreen(() => import('./dispatch/DispatchLayer'));
const ClientModulesScreen = lazyScreen(() => import('./components/screens/ClientModulesScreen'));
const DialingScreen = lazyScreen(() => import('./components/screens/DialingScreen'));
const StickySpotScreen = lazyScreen(() => import('./components/screens/StickySpotScreen'));
const SobrietyV2 = lazyScreen(() => import('./components/screens/v2/SobrietyV2'));
const FitnessScreen = lazyScreen(() => import('./components/screens/FitnessScreen'));
const GoalsV2 = lazyScreen(() => import('./components/screens/v2/GoalsV2'));
const MentalHealthV2 = lazyScreen(() => import('./components/screens/v2/MentalHealthV2'));
const BrainScreen = lazyScreen(() => import('./components/screens/brain/BrainScreen'));
const EcomScreen = lazyScreen(() => import('./components/screens/ecom/EcomScreen'));
const ScalingStartScreen = lazyScreen(() => import('./components/screens/ScalingStartScreen'));
const ClientDeliveryScreen = lazyScreen(() => import('./components/screens/ClientDeliveryScreen'));
const SupportInboxScreen = lazyScreen(() => import('./components/screens/SupportInboxScreen'));
const LegalScreen = lazyScreen(() => import('./components/screens/LegalScreen'));
const ScalingPlannerScreen = lazyScreen(() => import('./components/screens/ScalingPlannerScreen'));
const BusinessAuditsScreen = lazyScreen(() => import('./components/screens/BusinessAuditsScreen'));
const ClientCRMScreen = lazyScreen(() => import('./components/screens/ClientCRMScreen'));
const IdeaMakerScreen = lazyScreen(() => import('./components/screens/IdeaMakerScreen'));
const BrandLabScreen = lazyScreen(() => import('./components/screens/BrandLabScreen'));
const ScheduleScreen = lazyScreen(() => import('./components/screens/ScheduleScreen'));
const ContactsScreen = lazyScreen(() => import('./components/screens/ContactsScreen'));
const OpeningClosingScreen = lazyScreen(() => import('./components/screens/OpeningClosingScreen'));
const NotificationSettingsScreen = lazyScreen(() => import('./components/screens/NotificationSettingsScreen'));
const MorningDigestScreen = lazyScreen(() => import('./components/screens/MorningDigestScreen'));
const SetupScreen = lazyScreen(() => import('./components/screens/SetupScreen'));
const PlaybooksScreen = lazyScreen(() => import('./components/screens/PlaybooksScreen'));
const StreamingScreen = lazyScreen(() => import('./components/screens/StreamingScreen'));
const StocksScreen = lazyScreen(() => import('./components/screens/StocksScreen'));
const LeadFlowScreen = lazyScreen(() => import('./components/screens/LeadFlowScreen'));
const AccountSettingsScreen = lazyScreen(() => import('./components/screens/AccountSettingsScreen'));
const PromptVoiceSettingsScreen = lazyScreen(() => import('./components/screens/PromptVoiceSettingsScreen'));
const CallRecordingsScreen = lazyScreen(() => import('./components/screens/CallRecordingsScreen'));
const WebsiteBuilderRoadmapScreen = lazyScreen(() => import('./components/screens/WebsiteBuilderRoadmapScreen'));
const InvoicingScreen = lazyScreen(() => import('./components/screens/InvoicingScreen'));
const DailyPlanV2 = lazyScreen(() => import('./components/screens/v2/DailyPlanV2'));
const MacrosV2 = lazyScreen(() => import('./components/screens/v2/MacrosV2'));
const BudgetingScreen = lazyScreen(() => import('./components/screens/BudgetingScreen'));
const MarketingScreen = lazyScreen(() => import('./components/screens/MarketingScreen'));
const ContentCreationScreen = lazyScreen(() => import('./components/screens/ContentCreationScreen'));
const SwipeFileScreen = lazyScreen(() => import('./components/screens/SwipeFileScreen'));
const DecisionLogScreen = lazyScreen(() => import('./components/screens/DecisionLogScreen'));
const WeeklyReviewScreen = lazyScreen(() => import('./components/screens/WeeklyReviewScreen'));
const CashFlowScreen = lazyScreen(() => import('./components/screens/CashFlowScreen'));
const PatternDetectionScreen = lazyScreen(() => import('./components/screens/PatternDetectionScreen'));
const VoiceCaptureScreen = lazyScreen(() => import('./components/screens/VoiceCaptureScreen'));
const ManageModulesScreen = lazyScreen(() => import('./components/screens/ManageModulesScreen'));
const EditHomeWidgetsScreen = lazyScreen(() => import('./components/screens/EditHomeWidgetsScreen'));
const GrantAccessScreen = lazyScreen(() => import('./components/screens/GrantAccessScreen'));
const InboxScreen = lazyScreen(() => import('./components/screens/inbox/InboxScreen'));
const HomeV2 = lazyScreen(() => import('./components/screens/home/HomeV2'));

const BUILT_SCREENS = [
  'home', 'daily-plan', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental', 'brain',
  'scaling-start', 'delivery', 'support-inbox', 'leads', 'legal', 'scaling-planner', 'audits', 'client-crm', 'client-modules', 'brand-lab', 'idea-maker', 'schedule', 'contacts', 'opening-closing',
  'notification-settings', 'morning-digest', 'setup', 'playbooks', 'streaming', 'stocks', 'leadflow', 'ecommerce', 'account-settings', 'prompt-voice-settings',
  'call-recordings', 'website', 'invoicing', 'budgeting', 'marketing', 'content', 'swipe-file', 'decisions', 'weekly-review', 'cashflow', 'patterns', 'voice-capture', 'manage-modules', 'edit-home-widgets', 'grant-access', 'changelog', 'dispatch', 'inbox', 'modules',
];

interface Props {
  state: AppState;
  actions: MastermindActions;
  assistantName: string;
  canAccess: (moduleKey: string) => boolean;
  onSignOut: () => void;
  currentUserId: string;
  userEmail: string | null | undefined;
  userDisplayName: string | null;
  isOwner: boolean;
  theme: Theme;
  onThemeChange: (next: Theme) => void;
  soundFx: boolean;
  onSoundFxChange: (on: boolean) => void;
}

export default function Stage({ state, actions, assistantName, canAccess, onSignOut, currentUserId, userEmail, userDisplayName, isOwner, theme, onThemeChange, soundFx, onSoundFxChange }: Props) {
  const demo = useDemo();
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
  // ── Redesign shell (design handoff: MM App) ─────────────────────────
  const leadFeed = useLeadFeed(isOwner);
  const notifs = useNotifications(ownerInbox.items, leadFeed.leads, leadFeed.now, true);
  const resolvedTheme = useResolvedTheme();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // One-shot hand-off into Inbox / Leads from a notification or Home card.
  const [inboxFocus, setInboxFocus] = useState<{ tab: 'inbox' | 'leads'; ref?: string } | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((v) => !v); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // A client message or ticket tapped in the Inbox widget, or a
  // transferred lead, all land on THAT client — in Client Modules for
  // the first two, in Client CRM for a lead (since that's where its
  // freshly-generated analysis lives). Mail goes to the Support Inbox
  // instead. clientFocus is shared across both target screens (only one
  // is ever mounted at a time) and cleared once whichever one consumed it.
  const [clientFocus, setClientFocus] = useState<string | null>(null);
  // The client-selector's own sticky pick — distinct from clientFocus
  // above (that's a one-shot "jump to and consume" transfer, cleared the
  // moment a screen reads it; this persists across navigation between
  // every client-facing module until something explicitly changes or
  // clears it). Lives here, not in a per-screen hook, since surviving an
  // unmount/remount as the user switches modules is the entire point.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  // Entry point 2 of the brief (schema_069) — Client CRM's "Push to
  // Marketing" button. One-shot like clientFocus: MarketingScreen creates
  // the brief and clears this the moment it reads it.
  const [pendingBriefClientId, setPendingBriefClientId] = useState<string | null>(null);
  // Campaign hand-offs from a client's CRM page into Marketing.
  const [campaignFocus, setCampaignFocus] = useState<{ campaignId: string | null; newForClientId: string | null } | null>(null);
  const openCampaign = (campaignId: string) => { setCampaignFocus({ campaignId, newForClientId: null }); actions.navigateTo('marketing'); };
  const startCampaignFor = (clientId: string) => { setCampaignFocus({ campaignId: null, newForClientId: clientId }); actions.navigateTo('marketing'); };
  const pushToMarketing = (clientId: string) => {
    setSelectedClientId(clientId);
    setPendingBriefClientId(clientId);
    actions.navigateTo('marketing');
  };
  // "Build this with Nova" (Marketing) / "Ask Nova for next steps"
  // (Content Creation) — opens the panel and sends the pre-composed
  // prompt as if the user typed it, same real send path sendNova always
  // uses, so Nova's tool access and Marketing/Content 101 grounding
  // (state.ts's onMarketingScreen/onContentScreen) apply exactly as normal.
  const askNovaWithPrompt = (promptText: string) => {
    actions.openNova();
    actions.sendNova(promptText);
  };
  const navAccess = (moduleKey: string) => canAccess(moduleKey) && !navPrefs.hidden.has(moduleKey);
  const vm = buildViewModel(state, actions.navigateTo, onSignOut, navAccess, isOwner, navPrefs.order);
  const { isMobile } = vm;
  const device = deviceFor(vm.stageWidth);
  const groups = useMemo(() => shellGroups(navAccess, isOwner, navPrefs.order), [navAccess, isOwner, navPrefs.order]);
  const moduleTiles = useMemo(() => shellGroups(navAccess, isOwner, navPrefs.order, { lockedPreview: true }), [navAccess, isOwner, navPrefs.order]);
  const badges = { inbox: ownerInbox.items.filter((i) => i.unread).length, leads: leadFeed.waiting, urgent: leadFeed.urgent > 0 };
  const toggleTheme = () => onThemeChange(resolvedTheme === 'dark' ? 'light' : 'dark');
  const toggleNova = () => (state.novaOpen ? actions.closeNova() : actions.openNova());
  // Desktop: Nova is a 360px column that pushes content. iPad: it slides
  // over. Phone: a full screen above the tab bar.
  const novaDock = device === 'desktop' && state.novaOpen ? NOVA_DOCK_W : 0;
  const shellNav = (id: string) => { setNotifOpen(false); if (state.novaOpen && device !== 'desktop') actions.closeNova(); actions.navigateTo(id); };
  const moduleCtx: ModuleCtxValue = { device, novaOpen: state.novaOpen, isOwner, nav: shellNav, askNova: (p?: string) => { if (p) askNovaWithPrompt(p); else if (!state.novaOpen) actions.openNova(); } };

  // A real set name always wins, regardless of owner status — per-account
  // display, not a hardcoded "Cristopher" for one account and everyone
  // else's raw email as a fallback.
  const ownerDisplayName = userDisplayName || (isOwner ? 'Cristopher' : userEmail ?? 'Account');

  // Second, screen-level access check — buildNavData only ever filters
  // which rows the nav *drawer* shows; it doesn't stop state.screen from
  // being set to something un-navigated-to (nothing currently prevents
  // that). Without this, a gated screen's UI shell (though never its
  // actual data — every table backing these screens has its own RLS) was
  // still reachable. moduleKeyForRoute returns undefined for system-level
  // screens (home, settings, codelab, manage-modules, placeholder), which
  // always pass through unblocked.
  const routeModuleKey = moduleKeyForRoute(state.screen);
  // Grant Access has no module key but is owner-only; now that ?screen= deep
  // links work it must say so instead of rendering an empty page.
  const screenBlocked = routeModuleKey ? !canAccess(routeModuleKey) : state.screen === 'grant-access' && !isOwner;

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

  // Fills the real viewport edge-to-edge — no more fixed-size device-mockup
  // box (border/rounded corners/shadow) floating on a page background. The
  // diagonal shine (app-shine-bg, defined in index.css) supplies the
  // background instead of a flat color — no inline `background` here, or
  // it'd win specificity over the class and flatten the gradient.
  const stageStyle: CSSProperties = {
    width: vm.stageWidth, height: vm.stageHeight, position: 'relative', overflow: 'hidden',
  };

  const dispatchOn = canAccess('dispatch');
  const navigateToRef = useRef(actions.navigateTo); navigateToRef.current = actions.navigateTo;
  const openDispatch = useCallback(() => navigateToRef.current('dispatch'), []);
  const leadFirst = (userDisplayName ?? '').split(' ')[0] || (isOwner ? 'Marq' : 'You');
  return (
    <DispatchProvider userId={currentUserId} ownerId={dispatchOn ? currentUserId : null} leadName={leadFirst} onOpen={openDispatch}>
    <div className="app-shine-bg" style={stageStyle}>
      {device === 'phone' ? (
        <>
          <PhoneHeader dark={resolvedTheme === 'dark'} onToggleTheme={toggleTheme} onSearch={() => setSearchOpen(true)} onBell={() => setNotifOpen((v) => !v)} bellDot={notifs.unread > 0} bellOpen={notifOpen} />
          <PhoneTabBar screen={state.screen} novaOpen={state.novaOpen} badges={badges} onNav={shellNav} onNova={toggleNova} />
        </>
      ) : (
        <>
          <AppSidebar device={device} screen={state.screen} novaOpen={state.novaOpen} groups={groups} badges={badges} ownerName={ownerDisplayName} isOwner={isOwner} onNav={shellNav} onNova={toggleNova} onSearch={() => setSearchOpen(true)} />
          <AppTopBar device={device} left={sidebarW(device)} right={novaDock} crumb={crumbFor(state.screen, groups)} dark={resolvedTheme === 'dark'} novaOpen={state.novaOpen} bellDot={notifs.unread > 0} bellOpen={notifOpen} onToggleTheme={toggleTheme} onSearch={() => setSearchOpen(true)} onBell={() => setNotifOpen((v) => !v)} onNova={toggleNova} />
        </>
      )}

      <div
        id="tour-content-panel"
        style={{
          ...vm.contentStyle,
          left: device === 'phone' ? 0 : sidebarW(device), right: novaDock, transition: 'right .18s ease',
          padding: device === 'phone' ? `calc(${PHONE_HEADER_H + 12}px + env(safe-area-inset-top)) 16px 0` : `${TOP_BAR_H + 28}px 32px 0`,
          paddingBottom: device === 'phone' ? `calc(${PHONE_TAB_H + 28}px + max(env(safe-area-inset-bottom), 20px))` : '48px',
        }}
      >
        {screenBlocked ? (
          <PlaceholderScreen isMobile={isMobile} label="Not available" note="This section isn't available on your account." />
        ) : (
          <ErrorBoundary scope="screen" resetKey={state.screen} label={state.screen === 'home' ? 'Overview' : undefined}>
          <Suspense fallback={<ScreenLoading />}>
          <ModuleProvider value={moduleCtx}>
          <div data-demo-content="">
        {state.screen === 'home' && (
          <HomeV2 device={device} isOwner={isOwner} novaOpen={state.novaOpen} leads={leadFeed.leads} leadsNow={leadFeed.now} inboxItems={ownerInbox.items}
            canOpen={(id) => groups.some((g) => g.items.some((i) => i.id === id))} labelFor={(id) => groups.flatMap((g) => g.items).find((i) => i.id === id)?.label ?? id}
            onNavigate={shellNav} onOpenLead={(ref) => { setInboxFocus({ tab: 'leads', ref }); shellNav(device === 'phone' ? 'inbox' : 'leads'); }}
            top={<HomeExtras currentUserId={currentUserId} onNavigate={shellNav} />} />
        )}
                
        {state.screen === 'daily-plan' && <DailyPlanV2 />}

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

        {state.screen === 'sobriety' && <SobrietyV2 />}

        {state.screen === 'fitness' && (
          <FitnessScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'macros' && <MacrosV2 />}

        {state.screen === 'goals' && <GoalsV2 />}

        {state.screen === 'mental' && <MentalHealthV2 />}

        {state.screen === 'brain' && (
          <BrainScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onNavigate={actions.navigateTo} />
        )}

        {state.screen === 'scaling-start' && (
          <ScalingStartScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onNavigate={actions.navigateTo} />
        )}

        {state.screen === 'delivery' && (
          <ClientDeliveryScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onNavigate={actions.navigateTo} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
        )}

        {state.screen === 'support-inbox' && (
          <SupportInboxScreen
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            onOpenClient={(clientId) => {
              setClientFocus(clientId);
              actions.navigateTo('client-modules');
            }}
          />
        )}

        {state.screen === 'leads' && (
          <InboxScreen device={device} isOwner={isOwner} initialTab="leads" inbox={ownerInbox} feed={leadFeed} focus={inboxFocus} onFocusConsumed={() => setInboxFocus(null)}
            onOpenClient={(id: string) => { setClientFocus(id); actions.navigateTo('client-crm'); }} onOpenLeadFlow={() => actions.navigateTo('leadflow')} onNavigate={shellNav} />
        )}
                
        {state.screen === 'legal' && (
          <LegalScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'scaling-planner' && (
          <ScalingPlannerScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'client-crm' && (
          <ClientCRMScreen
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            focusClientId={clientFocus}
            onClearFocus={() => setClientFocus(null)}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
            onPushToMarketing={pushToMarketing}
            onOpenCampaign={openCampaign}
            onStartCampaign={startCampaignFor}
          />
        )}

        {state.screen === 'client-modules' && (
          <ClientModulesScreen
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            focusClientId={clientFocus}
            onClearFocus={() => setClientFocus(null)}
            onChanged={ownerInbox.reload}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
          />
        )}

        {state.screen === 'audits' && (
          <BusinessAuditsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'brand-lab' && (
          <BrandLabScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
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

        {state.screen === 'setup' && (
          <SetupScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onNavigate={actions.navigateTo} />
        )}

        {state.screen === 'playbooks' && (
          <PlaybooksScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'morning-digest' && (
          <MorningDigestScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
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

        {state.screen === 'ecommerce' && (
          <EcomScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'account-settings' && (
          <AccountSettingsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} onSignOut={onSignOut} onStartTour={startTour} theme={theme} onThemeChange={onThemeChange} soundFx={soundFx} onSoundFxChange={onSoundFxChange} />
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
          <InvoicingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
        )}

        {state.screen === 'budgeting' && (
          <BudgetingScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} device={device} />
        )}

        {state.screen === 'marketing' && (
          <MarketingScreen
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
            pendingBriefClientId={pendingBriefClientId}
            onConsumePendingBrief={() => setPendingBriefClientId(null)}
            onAskNova={askNovaWithPrompt}
            focusCampaignId={campaignFocus?.campaignId ?? null}
            newCampaignForClientId={campaignFocus?.newForClientId ?? null}
            onConsumeCampaignFocus={() => setCampaignFocus(null)}
            onNavigate={actions.navigateTo}
          />
        )}

        {state.screen === 'content' && (
          <ContentCreationScreen
            homeHeadStyle={vm.homeHeadStyle}
            homeSubStyle={vm.homeSubStyle}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
            onAskNova={askNovaWithPrompt}
          />
        )}

        {state.screen === 'changelog' && (
          <ChangelogScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {state.screen === 'swipe-file' && (
          <SwipeFileScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
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

        {state.screen === 'dispatch' && (
          <DispatchScreen isMobile={isMobile} onBack={() => actions.navigateTo('home')} dockBottom={`calc(${PHONE_TAB_H + 10}px + max(env(safe-area-inset-bottom), 20px))`} />
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

        {state.screen === 'edit-home-widgets' && (
          <EditHomeWidgetsScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} isOwner={isOwner} />
        )}

        {state.screen === 'modules' && <ModulesGrid groups={moduleTiles} onOpen={shellNav} />}
        {state.screen === 'inbox' && (
          <InboxScreen device={device} isOwner={isOwner} inbox={ownerInbox} feed={leadFeed} focus={inboxFocus} onFocusConsumed={() => setInboxFocus(null)}
            onOpenClient={(id: string) => { setClientFocus(id); actions.navigateTo('client-modules'); }} onOpenLeadFlow={() => actions.navigateTo('leadflow')} onNavigate={shellNav} />
        )}

        {state.screen === 'grant-access' && isOwner && (
          <GrantAccessScreen homeHeadStyle={vm.homeHeadStyle} homeSubStyle={vm.homeSubStyle} />
        )}

        {(state.screen === 'placeholder' || !BUILT_SCREENS.includes(state.screen)) && (
          <PlaceholderScreen isMobile={isMobile} label={state.placeholderLabel} note={state.placeholderNote} />
        )}
          </div>
          </ModuleProvider>
          </Suspense>
          </ErrorBoundary>
        )}
      </div>

      {notifOpen && (
        <NotificationsPanel device={device} items={notifs.items} isRead={notifs.isRead} now={leadFeed.now} onMarkAll={notifs.markAll} onClose={() => setNotifOpen(false)}
          onOpen={(n) => { notifs.markRead(n.id); setNotifOpen(false); if (n.target.screen === 'leads' || n.target.screen === 'inbox') { setInboxFocus({ tab: n.target.screen === 'leads' ? 'leads' : 'inbox', ref: n.target.ref }); shellNav(device !== 'phone' && n.target.screen === 'leads' ? 'leads' : 'inbox'); } else shellNav(n.target.screen); }} />
      )}
      {searchOpen && <SearchPalette groups={groups} onOpen={shellNav} onClose={() => setSearchOpen(false)} />}

      {state.novaOpen && (
        <NovaPanel
          layout={device === 'phone' ? 'screen' : device === 'desktop' ? 'dock' : 'overlay'}
          isMobile={isMobile}
          anchor={isMobile ? null : { cx: vm.cx, cy: vm.cy, circleSize: vm.circleSize, stageWidth: vm.stageWidth, stageHeight: vm.stageHeight }}
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

      <Celebration />

      {demo.active && demo.tour && <Suspense fallback={null}><DemoTour navigate={actions.navigateTo} /></Suspense>}
      {demo.active && !demo.tour && (
        <button type="button" onClick={stopDemo} style={{ position: 'fixed', top: 'calc(2px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', zIndex: 120, minHeight: 22, padding: '0 10px', opacity: 0.85, borderRadius: 999, border: '1px solid var(--mm-line)', background: 'var(--mm-panel-solid)', color: 'var(--mm-dim)', font: 'inherit', fontSize: 11, cursor: 'pointer' }}>
          Sample data · Exit
        </button>
      )}

      <ProductTour
        active={tourActive}
        steps={tourSteps}
        stepIndex={tourStep}
        onNext={() => (tourStep >= tourSteps.length - 1 ? stopTour() : setTourStep((i) => i + 1))}
        onBack={() => setTourStep((i) => Math.max(0, i - 1))}
        onSkip={stopTour}
      />
      {dispatchOn && <Suspense fallback={null}><DispatchLayer /></Suspense>}
    </div>
    </DispatchProvider>
  );
}

/** Shown for the moment a screen's code is loading. */
function ScreenLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
      {[180, 90, 90].map((h, i) => <div key={i} style={{ height: h, borderRadius: 'var(--radius-lg)', background: 'var(--surface)', border: '1px solid var(--border)', opacity: 0.6 }} />)}
    </div>
  );
}
