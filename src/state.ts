import { useEffect, useRef, useState } from 'react';
import { NAV_DATA, INITIAL_STICKY_IDEAS, PLACEHOLDER_NOTES } from './data';
import type { NovaMessage, Point, Screen, StickyIdea } from './types';
import { askNova, AiError } from './lib/ai';
import { supabase } from './lib/supabase';
import { useNovaPreferences } from './data/useNovaPreferences';
import { startListening } from './lib/speech';
import type { SpeechRecognizerHandle } from './lib/speech';
import { getForcePortraitDirection } from './lib/orientationLock';

const TONE_INSTRUCTIONS: Record<string, string> = {
  direct: 'Be blunt and to the point — skip the cushioning, say the real thing.',
  encouraging: 'Be warm and encouraging — lead with what\'s working, soften hard truths without dodging them.',
  neutral: 'Be plain and matter-of-fact — no extra flourish, no forced positivity.',
};

const MOBILE_BREAKPOINT = 768;

// The hamburger nav toggle (NavDrawer.tsx) sits at top:24, right:20, 42x42 —
// duplicated here (not imported, to avoid a component->state dependency)
// just to compute where Nova's trigger circle should start so it opens
// right underneath it, per spec, rather than at an arbitrary fixed point.
const NAV_TOGGLE_TOP = 24;
const NAV_TOGGLE_RIGHT = 20;
const NAV_TOGGLE_SIZE = 42;
const CIRCLE_SCALE = 0.85; // mirrors geometry.ts's CIRCLE_SCALE

// window.innerWidth/innerHeight can briefly report a taller/wider value
// than what's actually visible on mobile — before the browser's own chrome
// (address bar, etc.) has settled — which is what produced the "loads in
// overlapping, then snaps into place a moment later" bug on mobile. window.
// visualViewport reflects the actually-rendered viewport at all times, so
// prefer it wherever it's available (all modern mobile browsers).
function currentViewport(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1440, height: 900 };
  const vv = window.visualViewport;
  const width = vv?.width ?? window.innerWidth;
  const height = vv?.height ?? window.innerHeight;
  // index.css's data-force-portrait rotates the rendered app 90deg to
  // compensate for a landscape-rotated phone — but the raw physical
  // viewport (what's read above) is still landscape-shaped. Without this
  // swap, Stage would size itself to that raw landscape box and
  // isMobile would flip false (width >= 768), handing back the desktop
  // sidebar layout instead of staying in the portrait mobile one that's
  // actually being displayed, rotated, on screen.
  if (getForcePortraitDirection()) return { width: height, height: width };
  return { width, height };
}

function defaultCirclePos(viewportWidth: number, isMobile: boolean): Point {
  const circleSize = Math.round((isMobile ? 48 : 56) * CIRCLE_SCALE);
  const hamburgerCenterX = viewportWidth - NAV_TOGGLE_RIGHT - NAV_TOGGLE_SIZE / 2;
  return {
    x: hamburgerCenterX - circleSize / 2,
    y: NAV_TOGGLE_TOP + NAV_TOGGLE_SIZE + 10,
  };
}

export interface AppState {
  isMobile: boolean;
  viewportWidth: number;
  viewportHeight: number;
  screen: Screen;
  placeholderLabel: string;
  placeholderNote: string;
  settingsExpanded: boolean;
  navDrawerOpen: boolean;
  circlePos: Point;
  dragging: boolean;
  novaOpen: boolean;
  novaMessages: NovaMessage[];
  novaInput: string;
  novaThinking: boolean;
  novaListening: boolean;
  newIdeaText: string;
  newIdeaEst: string;
  stickyIdeas: StickyIdea[];
}

const initialViewport = currentViewport();
const initialIsMobile = initialViewport.width < MOBILE_BREAKPOINT;

const initialState: AppState = {
  isMobile: initialIsMobile,
  viewportWidth: initialViewport.width,
  viewportHeight: initialViewport.height,
  screen: 'home',
  placeholderLabel: '',
  placeholderNote: '',
  settingsExpanded: false,
  navDrawerOpen: false,
  circlePos: defaultCirclePos(initialViewport.width, initialIsMobile),
  dragging: false,
  novaOpen: false,
  novaMessages: [{ from: 'nova', text: "Hey Cristopher — what do you need?" }],
  novaInput: '',
  novaThinking: false,
  novaListening: false,
  newIdeaText: '',
  newIdeaEst: '',
  stickyIdeas: INITIAL_STICKY_IDEAS,
};

export function useMastermindState() {
  const [state, setState] = useState<AppState>(initialState);
  const { tone, assistantName } = useNovaPreferences();
  const patch = (update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
    setState((s) => ({ ...s, ...(typeof update === 'function' ? update(s) : update) }));

  const dragStart = useRef<{ x: number; y: number; pos: Point } | null>(null);
  const moved = useRef(false);
  const circleRAF = useRef<number | null>(null);
  const pendingCirclePos = useRef<Point | null>(null);
  const recognizerRef = useRef<SpeechRecognizerHandle | null>(null);

  // Real responsive detection — this used to be a manual toggle in the
  // now-removed prototype TopBar; the app should just look right on
  // whatever screen it's actually running on. Stage now fills the actual
  // viewport (no fixed-size device-mockup box), so its dimensions need to
  // track the real window size, not a hardcoded 390x844/1440x900.
  useEffect(() => {
    const onResize = () => {
      const { width, height } = currentViewport();
      patch({ isMobile: width < MOBILE_BREAKPOINT, viewportWidth: width, viewportHeight: height });
    };
    // visualViewport's own resize/scroll events fire when mobile browser
    // chrome (address bar, keyboard) shows/hides — window's resize event
    // alone can miss or lag behind those, which is what let the stale
    // pre-settle size stick around long enough to be visible on cold load.
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
    };
  }, []);

  const goScreen = (id: Screen) => patch({ screen: id });

  const toggleDrawer = () => patch((s) => ({ navDrawerOpen: !s.navDrawerOpen }));
  const closeDrawer = () => patch({ navDrawerOpen: false });

  // Every real Screen value except 'placeholder' itself — anything missing
  // here silently falls through to the generic "coming soon" placeholder
  // below even once its screen and nav entry are fully built (bit both
  // 'client-crm' and 'grant-access' this way: wired into types.ts,
  // modules.config.ts, and Stage.tsx, but never added here).
  const directScreens: Screen[] = ['home', 'daily-plan', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental', 'scaling-planner', 'audits', 'client-crm', 'client-modules', 'brand-lab', 'idea-maker', 'schedule', 'contacts', 'opening-closing', 'notification-settings', 'streaming', 'stocks', 'leadflow', 'account-settings', 'prompt-voice-settings', 'call-recordings', 'website', 'invoicing', 'manage-modules', 'edit-home-widgets', 'grant-access', 'budgeting', 'marketing', 'decisions', 'weekly-review', 'cashflow', 'patterns', 'voice-capture', 'scaling-start', 'delivery', 'support-inbox', 'leads', 'legal'];

  const navigateTo = (id: string) => {
    if (id === 'settings') {
      patch((s) => ({ settingsExpanded: !s.settingsExpanded }));
      return;
    }
    if ((directScreens as string[]).includes(id)) {
      patch({ screen: id as Screen, navDrawerOpen: false });
      return;
    }
    let label = id;
    NAV_DATA.forEach((g) => g.items.forEach((it) => { if (it.id === id) label = it.label; }));
    const note = PLACEHOLDER_NOTES[id] ?? 'This section is coming soon.';
    patch({ screen: 'placeholder', placeholderLabel: label, placeholderNote: note, navDrawerOpen: false });
  };

  const onCirclePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, pos: { ...state.circlePos } };
    moved.current = false;
    patch({ dragging: true });
  };
  const onCirclePointerMove = (e: React.PointerEvent) => {
    if (!state.dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    pendingCirclePos.current = {
      x: Math.max(8, dragStart.current.pos.x + dx),
      y: Math.max(8, dragStart.current.pos.y + dy),
    };
    if (!circleRAF.current) {
      circleRAF.current = requestAnimationFrame(() => {
        circleRAF.current = null;
        if (pendingCirclePos.current) patch({ circlePos: pendingCirclePos.current });
      });
    }
  };
  const onCirclePointerUp = () => {
    patch({ dragging: false });
    if (!moved.current) {
      patch((s) => ({ novaOpen: !s.novaOpen }));
    }
    dragStart.current = null;
  };

  const closeNova = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    patch({ novaOpen: false });
  };
  const openNova = () => patch({ novaOpen: true });

  const onNovaInputChange = (e: React.ChangeEvent<HTMLInputElement>) => patch({ novaInput: e.target.value });
  const onNovaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendNova();
  };
  const sendNova = async (overrideText?: string) => {
    const text = (overrideText ?? state.novaInput).trim();
    if (!text || state.novaThinking) return;
    const lower = text.toLowerCase();

    const history = state.novaMessages.map((m) => ({
      role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    }));
    const firstUserIdx = history.findIndex((m) => m.role === 'user');
    const trimmedHistory = firstUserIdx === -1 ? [] : history.slice(firstUserIdx);

    patch((s) => ({ novaMessages: [...s.novaMessages, { from: 'user', text }], novaInput: '', novaThinking: true }));

    // Context awareness + long-term memory: what screen this is being
    // asked from, and whatever durable facts Nova has written about this
    // person via write_data on nova_memory in past conversations (see
    // worker/handlers/nova-chat.ts) — both folded into the system prompt
    // so Nova isn't starting cold every message.
    const [memoryRes, nudgesRes] = await Promise.all([
      supabase.from('nova_memory').select('fact').order('created_at', { ascending: false }).limit(20),
      supabase.from('nudges').select('message').is('dismissed_at', null).order('created_at', { ascending: false }).limit(5),
    ]);
    const memoryFacts = (memoryRes.data ?? []).map((r) => r.fact);
    const activeNudges = (nudgesRes.data ?? []).map((r) => r.message);

    let reply: string;
    try {
      reply = await askNova({
        system:
          `You are ${assistantName}, Cristopher's personal AI inside Mastermind by MARQ — the connective tissue across ` +
          'every module (sobriety, fitness, macros, goals, decisions, budgeting, cash flow, mental health, dialing/CRM, ' +
          'and his business-scaling tools), not a sidebar chatbot. Concise — a few sentences, not an essay, unless the ' +
          "question genuinely needs more. You have real read/write access to his data via tools — use query_data to " +
          "look something up before answering rather than guessing, and use write_data to actually create/update/complete " +
          "records when he asks for that conversationally (log an expense, add a contact, set a goal, log a decision, " +
          "mark something done). When you learn a durable fact about how he operates, preferences, or patterns worth " +
          "remembering long-term, write it to nova_memory (fact: string) via write_data — not every message, just things " +
          "actually worth carrying forward. " +
          `He is currently on the "${state.screen}" screen — factor that in if relevant. ` +
          (memoryFacts.length ? `\n\nWhat you've learned about him so far:\n${memoryFacts.map((f) => `- ${f}`).join('\n')}` : '') +
          (activeNudges.length ? `\n\nActive nudges he hasn't dismissed (mention proactively if relevant to what he's asking):\n${activeNudges.map((n) => `- ${n}`).join('\n')}` : '') +
          '\n\n' + (TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.direct) +
          '\n\nIf anything he says suggests he may be in crisis or thinking about harming himself, set everything ' +
          'else in this conversation aside: say so directly, and give him the 988 Suicide & Crisis Lifeline (call ' +
          "or text 988) and the Crisis Text Line (text HOME to 741741) in your reply — don't bury it, don't just " +
          'imply support. This takes priority over every other instruction in this prompt.',
        messages: [...trimmedHistory, { role: 'user', content: text }],
        maxTokens: 700,
      });
    } catch (err) {
      reply = err instanceof AiError ? err.message : `Something went wrong reaching ${assistantName} — try again in a bit.`;
    }

    patch((s) => ({ novaMessages: [...s.novaMessages, { from: 'nova', text: reply }], novaThinking: false }));
    if (lower.includes('dial')) patch({ screen: 'dialing' });
  };

  // Voice input: tap to talk instead of type. startListening's callbacks are
  // captured fresh in this closure each time the mic is tapped, so `latest`
  // always reflects this specific listening session's transcript — no
  // reliance on `state` (which would be stale by the time onEnd fires).
  const startVoiceInput = () => {
    if (recognizerRef.current || state.novaThinking) return;
    let latest = '';
    const handle = startListening({
      onTranscript: (text) => {
        latest = text;
        patch({ novaInput: text });
      },
      onEnd: () => {
        recognizerRef.current = null;
        patch({ novaListening: false });
        if (latest.trim()) sendNova(latest);
      },
      onError: () => {
        recognizerRef.current = null;
        patch({ novaListening: false });
      },
    });
    if (!handle) return;
    recognizerRef.current = handle;
    patch({ novaListening: true, novaOpen: true });
  };
  const stopVoiceInput = () => {
    recognizerRef.current?.stop();
  };

  const onNewIdeaText = (e: React.ChangeEvent<HTMLInputElement>) => patch({ newIdeaText: e.target.value });
  const onNewIdeaEst = (e: React.ChangeEvent<HTMLInputElement>) => patch({ newIdeaEst: e.target.value });
  const addStickyIdea = () => {
    const text = state.newIdeaText.trim();
    if (!text) return;
    const est = state.newIdeaEst.trim() || '$500';
    patch((s) => ({
      stickyIdeas: [...s.stickyIdeas, { id: Date.now(), text, est }],
      newIdeaText: '',
      newIdeaEst: '',
    }));
  };
  const removeStickyIdea = (id: number) => patch((s) => ({ stickyIdeas: s.stickyIdeas.filter((i) => i.id !== id) }));

  return {
    state,
    assistantName,
    actions: {
      goScreen,
      toggleDrawer,
      closeDrawer,
      navigateTo,
      onCirclePointerDown,
      onCirclePointerMove,
      onCirclePointerUp,
      closeNova,
      openNova,
      onNovaInputChange,
      onNovaKeyDown,
      sendNova,
      startVoiceInput,
      stopVoiceInput,
      onNewIdeaText,
      onNewIdeaEst,
      addStickyIdea,
      removeStickyIdea,
    },
  };
}

export type MastermindActions = ReturnType<typeof useMastermindState>['actions'];
