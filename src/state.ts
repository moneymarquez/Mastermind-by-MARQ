import { useEffect, useRef, useState } from 'react';
import { NAV_DATA, INITIAL_STICKY_IDEAS, PLACEHOLDER_NOTES } from './data';
import type { NovaMessage, Point, Screen, StickyIdea } from './types';
import { askClaude, AiError } from './lib/ai';
import { useNovaPreferences } from './data/useNovaPreferences';

const TONE_INSTRUCTIONS: Record<string, string> = {
  direct: 'Be blunt and to the point — skip the cushioning, say the real thing.',
  encouraging: 'Be warm and encouraging — lead with what\'s working, soften hard truths without dodging them.',
  neutral: 'Be plain and matter-of-fact — no extra flourish, no forced positivity.',
};

const MOBILE_BREAKPOINT = 768;

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
  newIdeaText: string;
  newIdeaEst: string;
  stickyIdeas: StickyIdea[];
}

const initialState: AppState = {
  isMobile: typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1440,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 900,
  screen: 'home',
  placeholderLabel: '',
  placeholderNote: '',
  settingsExpanded: false,
  navDrawerOpen: false,
  circlePos: { x: 320, y: 280 },
  dragging: false,
  novaOpen: false,
  novaMessages: [{ from: 'nova', text: "Hey Cristopher — what do you need?" }],
  novaInput: '',
  novaThinking: false,
  newIdeaText: '',
  newIdeaEst: '',
  stickyIdeas: INITIAL_STICKY_IDEAS,
};

export function useMastermindState() {
  const [state, setState] = useState<AppState>(initialState);
  const { tone } = useNovaPreferences();
  const patch = (update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
    setState((s) => ({ ...s, ...(typeof update === 'function' ? update(s) : update) }));

  const dragStart = useRef<{ x: number; y: number; pos: Point } | null>(null);
  const moved = useRef(false);
  const circleRAF = useRef<number | null>(null);
  const pendingCirclePos = useRef<Point | null>(null);

  // Real responsive detection — this used to be a manual toggle in the
  // now-removed prototype TopBar; the app should just look right on
  // whatever screen it's actually running on. Stage now fills the actual
  // viewport (no fixed-size device-mockup box), so its dimensions need to
  // track the real window size, not a hardcoded 390x844/1440x900.
  useEffect(() => {
    const onResize = () =>
      patch({
        isMobile: window.innerWidth < MOBILE_BREAKPOINT,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const goScreen = (id: Screen) => patch({ screen: id });

  const toggleDrawer = () => patch((s) => ({ navDrawerOpen: !s.navDrawerOpen }));
  const closeDrawer = () => patch({ navDrawerOpen: false });

  const directScreens: Screen[] = ['home', 'daily-plan', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental', 'scaling-planner', 'audits', 'brand-lab', 'idea-maker', 'schedule', 'contacts', 'opening-closing', 'notification-settings', 'streaming', 'stocks', 'account-settings', 'prompt-voice-settings', 'call-recordings', 'website', 'invoicing'];

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
  const sendNova = async () => {
    const text = state.novaInput.trim();
    if (!text || state.novaThinking) return;
    const lower = text.toLowerCase();

    const history = state.novaMessages.map((m) => ({
      role: (m.from === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    }));
    const firstUserIdx = history.findIndex((m) => m.role === 'user');
    const trimmedHistory = firstUserIdx === -1 ? [] : history.slice(firstUserIdx);

    patch((s) => ({ novaMessages: [...s.novaMessages, { from: 'user', text }], novaInput: '', novaThinking: true }));

    let reply: string;
    try {
      reply = await askClaude({
        system:
          "You are Nova, Cristopher's personal AI inside Mastermind by MARQ — his personal operating system app " +
          '(sobriety, fitness, macros, goals, mental health, and his business-scaling tools). Concise — a few ' +
          "sentences, not an essay. You're a companion embedded in his day, not a generic chatbot. " +
          (TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.direct),
        messages: [...trimmedHistory, { role: 'user', content: text }],
        maxTokens: 500,
      });
    } catch (err) {
      reply = err instanceof AiError ? err.message : 'Something went wrong reaching Nova — try again in a bit.';
    }

    patch((s) => ({ novaMessages: [...s.novaMessages, { from: 'nova', text: reply }], novaThinking: false }));
    if (lower.includes('dial')) patch({ screen: 'dialing' });
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
      onNewIdeaText,
      onNewIdeaEst,
      addStickyIdea,
      removeStickyIdea,
    },
  };
}

export type MastermindActions = ReturnType<typeof useMastermindState>['actions'];
