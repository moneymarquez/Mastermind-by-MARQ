import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from '../data/useDispatch';

// One Dispatch data hook per app mount, shared by the screen, the home
// widget and the capture layer — one fetch, one realtime channel.

type DispatchApi = ReturnType<typeof useDispatch>;
export type DispatchView = 'talk' | 'board' | 'people';
interface Ctx {
  d: DispatchApi;
  /** First name of whoever leads this workspace ("From James"). */
  leadName: string;
  view: DispatchView;
  setView: (v: DispatchView) => void;
  boardPerson: string | 'me' | null;
  setBoardPerson: (p: string | 'me' | null) => void;
  boardFilter: 'week' | 'overdue' | 'all';
  setBoardFilter: (f: 'week' | 'overdue' | 'all') => void;
  /** Navigate the app to the Dispatch screen (from the widget / toast). */
  openDispatch: (v?: DispatchView) => void;
}
const C = createContext<Ctx | null>(null);

export function DispatchProvider({ userId, ownerId, leadName, onOpen, children }: { userId: string; ownerId: string | null; leadName: string; onOpen: () => void; children: ReactNode }) {
  const d = useDispatch({ userId, ownerId });
  const [view, setView] = useState<DispatchView>('talk');
  const [boardPerson, setBoardPerson] = useState<string | 'me' | null>(null);
  const [boardFilter, setBoardFilter] = useState<'week' | 'overdue' | 'all'>('week');
  const value = useMemo<Ctx>(() => ({
    d, leadName, view, setView, boardPerson, setBoardPerson, boardFilter, setBoardFilter,
    openDispatch: (v) => { if (v) setView(v); onOpen(); },
  }), [d, leadName, view, boardPerson, boardFilter, onOpen]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useDispatchCtx(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('useDispatchCtx outside DispatchProvider');
  return v;
}
export function useOptionalDispatchCtx(): Ctx | null { return useContext(C); }
