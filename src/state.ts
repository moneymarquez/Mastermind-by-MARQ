import { useRef, useState } from 'react';
import { NAV_DATA, INITIAL_STICKY_IDEAS, PLACEHOLDER_NOTES } from './data';
import type { Device, NovaMessage, Point, Screen, StickyIdea } from './types';
import { askClaude, AiError } from './lib/ai';

export interface AppState {
  direction: 1 | 2 | 3;
  device: Device;
  screen: Screen;
  placeholderLabel: string;
  placeholderNote: string;
  settingsExpanded: boolean;
  navDrawerOpen: boolean;
  circlePos: Point;
  dragging: boolean;
  novaOpen: boolean;
  novaPos: Point | null;
  novaDisconnected: boolean;
  novaMessages: NovaMessage[];
  novaInput: string;
  novaThinking: boolean;
  dialCount: number;
  dialGoal: number;
  newIdeaText: string;
  newIdeaEst: string;
  stickyIdeas: StickyIdea[];
}

const initialState: AppState = {
  direction: 1,
  device: 'desktop',
  screen: 'home',
  placeholderLabel: '',
  placeholderNote: '',
  settingsExpanded: false,
  navDrawerOpen: false,
  circlePos: { x: 320, y: 280 },
  dragging: false,
  novaOpen: false,
  novaPos: null,
  novaDisconnected: false,
  novaMessages: [{ from: 'nova', text: "Hey Cristopher — what do you need?" }],
  novaInput: '',
  novaThinking: false,
  dialCount: 12,
  dialGoal: 40,
  newIdeaText: '',
  newIdeaEst: '',
  stickyIdeas: INITIAL_STICKY_IDEAS,
};

export function useMastermindState() {
  const [state, setState] = useState<AppState>(initialState);
  const patch = (update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
    setState((s) => ({ ...s, ...(typeof update === 'function' ? update(s) : update) }));

  const dragStart = useRef<{ x: number; y: number; pos: Point } | null>(null);
  const moved = useRef(false);
  const circleRAF = useRef<number | null>(null);
  const pendingCirclePos = useRef<Point | null>(null);

  const novaDragStart = useRef<{ x: number; y: number; pos: Point } | null>(null);
  const novaRAF = useRef<number | null>(null);
  const pendingNovaPos = useRef<Point | null>(null);

  const setDirection = (d: 1 | 2 | 3) => patch({ direction: d });
  const setDevice = (d: Device) => patch({ device: d });
  const goScreen = (id: Screen) => patch({ screen: id });

  const toggleDrawer = () => patch((s) => ({ navDrawerOpen: !s.navDrawerOpen }));
  const closeDrawer = () => patch({ navDrawerOpen: false });

  const directScreens: Screen[] = ['home', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental', 'scaling-planner', 'audits', 'brand-lab', 'idea-maker'];

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
      patch((s) =>
        s.novaOpen
          ? { novaOpen: false, novaPos: null, novaDisconnected: false }
          : { novaOpen: true, novaPos: s.novaPos ?? { x: s.circlePos.x, y: s.circlePos.y + 80 } }
      );
    }
    dragStart.current = null;
  };

  const closeNova = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    patch({ novaOpen: false, novaPos: null, novaDisconnected: false });
  };
  const onNovaPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    novaDragStart.current = { x: e.clientX, y: e.clientY, pos: { ...(state.novaPos as Point) } };
  };
  const onNovaPointerMove = (e: React.PointerEvent) => {
    if (!novaDragStart.current) return;
    const dx = e.clientX - novaDragStart.current.x;
    const dy = e.clientY - novaDragStart.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4 && !state.novaDisconnected) patch({ novaDisconnected: true });
    pendingNovaPos.current = {
      x: Math.max(4, novaDragStart.current.pos.x + dx),
      y: Math.max(4, novaDragStart.current.pos.y + dy),
    };
    if (!novaRAF.current) {
      novaRAF.current = requestAnimationFrame(() => {
        novaRAF.current = null;
        if (pendingNovaPos.current) patch({ novaPos: pendingNovaPos.current });
      });
    }
  };
  const onNovaPointerUp = () => {
    novaDragStart.current = null;
  };

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
          '(sobriety, fitness, macros, goals, mental health, and his business-scaling tools). Be direct, warm, and ' +
          "concise — a few sentences, not an essay. You're a companion embedded in his day, not a generic chatbot.",
        messages: [...trimmedHistory, { role: 'user', content: text }],
        maxTokens: 500,
      });
    } catch (err) {
      reply = err instanceof AiError ? err.message : 'Something went wrong reaching Nova — try again in a bit.';
    }

    patch((s) => ({ novaMessages: [...s.novaMessages, { from: 'nova', text: reply }], novaThinking: false }));
    if (lower.includes('dial')) patch({ screen: 'dialing' });
  };

  const logCall = () => patch((s) => ({ dialCount: Math.min(s.dialGoal, s.dialCount + 1) }));

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
      setDirection,
      setDevice,
      goScreen,
      toggleDrawer,
      closeDrawer,
      navigateTo,
      onCirclePointerDown,
      onCirclePointerMove,
      onCirclePointerUp,
      closeNova,
      onNovaPointerDown,
      onNovaPointerMove,
      onNovaPointerUp,
      onNovaInputChange,
      onNovaKeyDown,
      sendNova,
      logCall,
      onNewIdeaText,
      onNewIdeaEst,
      addStickyIdea,
      removeStickyIdea,
    },
  };
}

export type MastermindActions = ReturnType<typeof useMastermindState>['actions'];
