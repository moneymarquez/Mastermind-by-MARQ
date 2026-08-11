import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { StreamFormat, StreamStatus, StreamingIdea } from './types';
import type { StreamingIdeaSeedItem } from './streamingIdeasSeed';

export function useStreamingIdeas() {
  const [ideas, setIdeas] = useState<StreamingIdea[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('streaming_ideas').select('*').order('created_at', { ascending: false });
    setIdeas(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addIdea = async (idea: { title: string; format: StreamFormat; vibe: string | null; description: string | null }) => {
    await supabase.from('streaming_ideas').insert(idea);
    await load();
  };

  const updateIdea = async (id: string, patch: Partial<Pick<StreamingIdea, 'title' | 'format' | 'vibe' | 'description' | 'status'>>) => {
    await supabase.from('streaming_ideas').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const setStatus = (id: string, status: StreamStatus) => updateIdea(id, { status });

  const removeIdea = async (id: string) => {
    await supabase.from('streaming_ideas').delete().eq('id', id);
    await load();
  };

  const loadSeed = async (seed: StreamingIdeaSeedItem[]) => {
    const existing = new Set(ideas.map((i) => i.title));
    const toInsert = seed.filter((i) => !existing.has(i.title)).map((i) => ({ title: i.title, format: i.format, vibe: i.vibe, description: i.description }));
    if (toInsert.length === 0) return;
    await supabase.from('streaming_ideas').insert(toInsert);
    await load();
  };

  return { ideas, loading, addIdea, updateIdea, setStatus, removeIdea, loadSeed };
}
