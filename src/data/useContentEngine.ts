import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SocialAccount, AccountSnapshot, SocialPost, PostMetrics, ContentItem, Platform, Owner, Format, ItemStatus } from './contentEngine';

/** Accounts, their follower snapshots, posts and post metrics — everything
 *  the Accounts home reads. C1 is hand-entered; C2 swaps the source. */
export function useSocialAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, AccountSnapshot[]>>({});
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [metrics, setMetrics] = useState<Record<string, PostMetrics[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [a, s, p, m] = await Promise.all([
      supabase.from('social_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('social_account_snapshots').select('*').order('captured_at', { ascending: true }).limit(5000),
      supabase.from('social_posts').select('*').order('posted_at', { ascending: false }).limit(2000),
      supabase.from('social_post_metrics').select('*').order('captured_at', { ascending: true }).limit(10000),
    ]);
    if (a.error) setError(a.error.message); else setError('');
    setAccounts((a.data ?? []) as SocialAccount[]);
    const by: Record<string, AccountSnapshot[]> = {};
    for (const r of (s.data ?? []) as AccountSnapshot[]) (by[r.account_id] ??= []).push(r);
    setSnapshots(by);
    setPosts((p.data ?? []) as SocialPost[]);
    const bm: Record<string, PostMetrics[]> = {};
    for (const r of (m.data ?? []) as PostMetrics[]) (bm[r.post_id] ??= []).push(r);
    setMetrics(bm);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const touch = () => ({ updated_at: new Date().toISOString() });

  const createAccount = async (input: { platform: Platform; handle: string; owner: Owner; display_name?: string | null; brand_id?: string | null; client_id?: string | null; followers?: number | null; voice?: string | null; posts_per_week_goal?: number }): Promise<SocialAccount | null> => {
    const { data, error: err } = await supabase.from('social_accounts').insert(input).select('*').single();
    if (err) { setError(err.message); return null; }
    if (input.followers != null) await supabase.from('social_account_snapshots').insert({ account_id: (data as SocialAccount).id, followers: input.followers });
    await load();
    return data as SocialAccount;
  };
  const updateAccount = async (id: string, patch: Partial<SocialAccount>) => {
    const { error: err } = await supabase.from('social_accounts').update({ ...patch, ...touch() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };
  const removeAccount = async (id: string) => { await supabase.from('social_accounts').delete().eq('id', id); await load(); };

  /** "Log today's numbers" — a snapshot, and followers on the account row. */
  const logAccountMetrics = async (accountId: string, followers: number | null, avgViews: number | null) => {
    await supabase.from('social_account_snapshots').insert({ account_id: accountId, followers, avg_views: avgViews });
    if (followers != null) await supabase.from('social_accounts').update({ followers, ...touch() }).eq('id', accountId);
    await load();
  };

  const addPost = async (input: { account_id: string; url?: string | null; type: Format; hook?: string | null; caption?: string | null; posted_at: string; content_item_id?: string | null; length_sec?: number | null; thumbnail_url?: string | null }, m?: Partial<Pick<PostMetrics, 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves' | 'follows'>>): Promise<SocialPost | null> => {
    const { data, error: err } = await supabase.from('social_posts').insert(input).select('*').single();
    if (err) { setError(err.message); return null; }
    const post = data as SocialPost;
    if (m && Object.values(m).some((v) => v != null)) await supabase.from('social_post_metrics').insert({ post_id: post.id, ...m });
    await load();
    return post;
  };
  const updatePost = async (id: string, patch: Partial<SocialPost>) => {
    await supabase.from('social_posts').update({ ...patch, ...touch() }).eq('id', id);
    await load();
  };
  const logPostMetrics = async (postId: string, m: Partial<Pick<PostMetrics, 'views' | 'reach' | 'likes' | 'comments' | 'shares' | 'saves' | 'follows'>>) => {
    await supabase.from('social_post_metrics').insert({ post_id: postId, ...m });
    await load();
  };
  const removePost = async (id: string) => { await supabase.from('social_posts').delete().eq('id', id); await load(); };

  return { accounts, snapshots, posts, metrics, loading, error, reload: load, createAccount, updateAccount, removeAccount, logAccountMetrics, addPost, updatePost, logPostMetrics, removePost };
}

export interface ItemInput {
  account_id?: string | null; brand_id?: string | null; status?: ItemStatus; concept: string; hooks?: string[]; script?: string | null; shot_list?: string[];
  caption?: string | null; hashtags?: string | null; visual_prompt?: string | null; format?: Format; scheduled_for?: string | null; scheduled_time?: string | null; thumbnail_url?: string | null;
}

/** The weekly plan's cards. */
export function useContentItems() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('content_items').select('*').order('scheduled_for', { ascending: true, nullsFirst: false }).limit(2000);
    if (err) setError(err.message); else setError('');
    setItems((data ?? []) as ContentItem[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (input: ItemInput): Promise<ContentItem | null> => {
    const { data, error: err } = await supabase.from('content_items').insert(input).select('*').single();
    if (err) { setError(err.message); return null; }
    await load();
    return data as ContentItem;
  };
  const update = async (id: string, patch: Partial<ContentItem>) => {
    const { error: err } = await supabase.from('content_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };
  const remove = async (id: string) => { await supabase.from('content_items').delete().eq('id', id); await load(); };
  return { items, loading, error, reload: load, create, update, remove };
}
