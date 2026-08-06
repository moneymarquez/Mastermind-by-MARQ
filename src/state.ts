import { useRef, useState } from 'react';
import { NAV_DATA, INITIAL_LEADS, INITIAL_STICKY_IDEAS } from './data';
import type { Device, EditingLead, Lead, NovaMessage, Point, Screen, StickyIdea } from './types';

export interface AppState {
  direction: 1 | 2 | 3;
  device: Device;
  screen: Screen;
  placeholderLabel: string;
  selectedLeadId: number | null;
  leadFilter: string;
  showLeadModal: boolean;
  editingLead: EditingLead | null;
  settingsExpanded: boolean;
  navDrawerOpen: boolean;
  circlePos: Point;
  dragging: boolean;
  novaOpen: boolean;
  novaPos: Point | null;
  novaDisconnected: boolean;
  novaMessages: NovaMessage[];
  novaInput: string;
  dialCount: number;
  dialGoal: number;
  newIdeaText: string;
  newIdeaEst: string;
  stickyIdeas: StickyIdea[];
  leads: Lead[];
}

const initialState: AppState = {
  direction: 1,
  device: 'desktop',
  screen: 'home',
  placeholderLabel: '',
  selectedLeadId: null,
  leadFilter: 'All',
  showLeadModal: false,
  editingLead: null,
  settingsExpanded: false,
  navDrawerOpen: false,
  circlePos: { x: 320, y: 280 },
  dragging: false,
  novaOpen: false,
  novaPos: null,
  novaDisconnected: false,
  novaMessages: [{ from: 'nova', text: "Hey Cristopher — what do you need?" }],
  novaInput: '',
  dialCount: 12,
  dialGoal: 40,
  newIdeaText: '',
  newIdeaEst: '',
  stickyIdeas: INITIAL_STICKY_IDEAS,
  leads: INITIAL_LEADS,
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
  const setFilter = (f: string) => patch({ leadFilter: f });

  const toggleDrawer = () => patch((s) => ({ navDrawerOpen: !s.navDrawerOpen }));
  const closeDrawer = () => patch({ navDrawerOpen: false });

  const navigateTo = (id: string) => {
    if (id === 'settings') {
      patch((s) => ({ settingsExpanded: !s.settingsExpanded }));
      return;
    }
    const directScreens = ['home', 'crm-list', 'dialing', 'sticky-spot', 'sobriety', 'fitness', 'macros', 'goals', 'mental'];
    if (directScreens.includes(id)) {
      patch({ screen: id as Screen, navDrawerOpen: false });
      return;
    }
    let label = id;
    NAV_DATA.forEach((g) => g.items.forEach((it) => { if (it.id === id) label = it.label; }));
    patch({ screen: 'placeholder', placeholderLabel: label, navDrawerOpen: false });
  };

  const selectLead = (id: number) => patch({ screen: 'crm-detail', selectedLeadId: id });
  const backToList = () => patch({ screen: 'crm-list', selectedLeadId: null });
  const openAddModal = () =>
    patch({
      showLeadModal: true,
      editingLead: { id: null, name: '', company: '', phone: '', status: 'New', source: 'Website', value: '' },
    });
  const openEditModal = () => {
    setState((s) => {
      const lead = s.leads.find((l) => l.id === s.selectedLeadId);
      if (!lead) return s;
      return { ...s, showLeadModal: true, editingLead: { ...lead } };
    });
  };
  const closeModal = () => patch({ showLeadModal: false, editingLead: null });
  const stopProp = (e: React.SyntheticEvent) => e.stopPropagation();
  const editField = (field: keyof EditingLead, val: string) =>
    patch((s) => ({ editingLead: s.editingLead ? { ...s.editingLead, [field]: val } : s.editingLead }));
  const saveLead = () => {
    setState((s) => {
      if (!s.editingLead) return s;
      let leads = s.leads.slice();
      const val: Lead = { ...(s.editingLead as any), value: Number(s.editingLead.value) || 0 };
      if (val.id) leads = leads.map((l) => (l.id === val.id ? val : l));
      else {
        const newId = Math.max(0, ...leads.map((l) => l.id)) + 1;
        leads.push({ ...val, id: newId });
      }
      return { ...s, leads, showLeadModal: false, editingLead: null };
    });
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
  const sendNova = () => {
    const text = state.novaInput.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    let reply = "Noted — I'll keep that in mind.";
    let after: (() => void) | null = null;
    if (lower.includes('dial')) {
      reply = 'Got it — opening Dialing for you.';
      after = () => patch({ screen: 'dialing' });
    } else if (lower.includes('not feeling') || lower.includes('tired') || lower.includes('stressed') || lower.includes('lunch')) {
      reply = "Thanks for telling me — I've logged a check-in. Go easy on yourself today.";
    }
    patch((s) => ({
      novaMessages: [...s.novaMessages, { from: 'user', text }, { from: 'nova', text: reply }],
      novaInput: '',
    }));
    if (after) setTimeout(after, 500);
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
      setFilter,
      toggleDrawer,
      closeDrawer,
      navigateTo,
      selectLead,
      backToList,
      openAddModal,
      openEditModal,
      closeModal,
      stopProp,
      editField,
      saveLead,
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
