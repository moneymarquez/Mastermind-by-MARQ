import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { askClaude } from '../lib/ai';
import type { IdeaMessage, IdeaSession } from './types';

const NOVA_SYSTEM =
  "You are Nova, a sharp, skeptical business-idea sparring partner inside Cristopher's personal tracker's Idea " +
  'Maker. He drops raw ideas and you help him pressure-test them — ask the questions a smart investor or ' +
  'experienced operator would ask, push back on weak spots, and help him sharpen the idea into something real. ' +
  "Keep replies short (2-5 sentences), conversational, direct. Don't be a yes-man, and don't lecture — this is a " +
  'back-and-forth, so usually end with one pointed question that moves the idea forward.';

async function firstNovaReply(idea: string): Promise<string> {
  return askClaude({
    system: NOVA_SYSTEM,
    messages: [{ role: 'user', content: `Here's my idea: ${idea}` }],
    maxTokens: 400,
  });
}

async function followUpReply(idea: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  return askClaude({
    system: NOVA_SYSTEM,
    messages: [{ role: 'user', content: `Here's my idea: ${idea}` }, ...history],
    maxTokens: 400,
  });
}

export function useIdeaMaker() {
  const [sessions, setSessions] = useState<IdeaSession[]>([]);
  const [messages, setMessages] = useState<IdeaMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);

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
    await supabase.from('idea_messages').insert({ session_id: data.id, from_role: 'user', text: ideaText });
    await loadSessions();
    setActiveSessionId(data.id);
    await loadMessages(data.id);

    setThinking(true);
    try {
      const reply = await firstNovaReply(ideaText);
      await supabase.from('idea_messages').insert({ session_id: data.id, from_role: 'nova', text: reply });
    } catch {
      await supabase.from('idea_messages').insert({
        session_id: data.id,
        from_role: 'nova',
        text: "Couldn't reach Nova just now — try sending that again.",
      });
    } finally {
      setThinking(false);
      await loadMessages(data.id);
    }
  };

  const sendMessage = async (text: string) => {
    if (!activeSessionId) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    await supabase.from('idea_messages').insert({ session_id: activeSessionId, from_role: 'user', text });
    await loadMessages(activeSessionId);

    setThinking(true);
    try {
      const history = [...messages, { id: '', session_id: activeSessionId, from_role: 'user' as const, text, created_at: '' }].map((m) => ({
        role: (m.from_role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }));
      const reply = await followUpReply(session?.idea_text ?? '', history);
      await supabase.from('idea_messages').insert({ session_id: activeSessionId, from_role: 'nova', text: reply });
    } catch {
      await supabase.from('idea_messages').insert({
        session_id: activeSessionId,
        from_role: 'nova',
        text: "Couldn't reach Nova just now — try sending that again.",
      });
    } finally {
      setThinking(false);
      await loadMessages(activeSessionId);
    }
  };

  return { sessions, messages, activeSessionId, setActiveSessionId, loading, thinking, startSession, sendMessage };
}
