import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { IdeaMessage, IdeaSession } from './types';

// NOTE: these are template stand-ins, not real reasoning — see IdeaMakerScreen
// for the full flag. Swap this out once Nova is backed by a real LLM call.
const FOLLOWUPS = [
  'What would make someone choose this over just doing nothing?',
  "If you had to charge for this starting tomorrow, what's the price — and why that number?",
  "What's the fastest, cheapest way you could test if anyone actually wants this?",
  'Who do you worry is already doing this better than you could?',
  "What's the one resource you're missing to start this week instead of someday?",
];

function firstNovaReply(idea: string): string {
  return `Here's my first take on "${idea}" — three angles worth exploring:

1. Who's already almost solving this, and what are they missing?
2. Is this something people pay once for, or does it have recurring value?
3. What's the smallest version of this you could put in front of real people this week?

Before I go further — who's the very first person you picture actually paying for this?`;
}

function followUpReply(priorNovaCount: number): string {
  const idx = Math.max(0, priorNovaCount - 1) % FOLLOWUPS.length;
  return FOLLOWUPS[idx];
}

export function useIdeaMaker() {
  const [sessions, setSessions] = useState<IdeaSession[]>([]);
  const [messages, setMessages] = useState<IdeaMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase.from('idea_sessions').select('*').order('created_at', { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadMessages = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from('idea_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }, []);

  useEffect(() => {
    if (activeSessionId) loadMessages(activeSessionId);
    else setMessages([]);
  }, [activeSessionId, loadMessages]);

  const startSession = async (ideaText: string) => {
    const { data } = await supabase.from('idea_sessions').insert({ idea_text: ideaText }).select().single();
    if (!data) return;
    await supabase.from('idea_messages').insert([
      { session_id: data.id, from_role: 'user', text: ideaText },
      { session_id: data.id, from_role: 'nova', text: firstNovaReply(ideaText) },
    ]);
    await loadSessions();
    setActiveSessionId(data.id);
    await loadMessages(data.id);
  };

  const sendMessage = async (text: string) => {
    if (!activeSessionId) return;
    await supabase.from('idea_messages').insert({ session_id: activeSessionId, from_role: 'user', text });
    const priorNovaCount = messages.filter((m) => m.from_role === 'nova').length;
    await supabase
      .from('idea_messages')
      .insert({ session_id: activeSessionId, from_role: 'nova', text: followUpReply(priorNovaCount) });
    await loadMessages(activeSessionId);
  };

  return { sessions, messages, activeSessionId, setActiveSessionId, loading, startSession, sendMessage };
}
