import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { api as callApi } from '../../../lib/api';
import { kitProgress } from '../../../data/contentOctober';
import type { KitStep } from '../../../data/contentOctober';
import { E, Badge, TeachingEmpty, btn, label } from '../ecom/ecomShared';

interface Kit { id: string; brand_id: string | null; status: string; checklist: KitStep[]; kit: { brand?: string; handles?: string[]; bio?: { instagram?: string; tiktok?: string }; look?: string; posts?: { concept: string; direction: string }[]; profile_image?: string | null }; created_at: string }
interface Handoff { id: string; status: string; note: string | null; payload: { name?: string }; created_at: string }

/** Brand kits (brief §3.5): what Content built for each store that went
 *  live, and the by-hand steps (creating the accounts has no API). */
export default function KitsTab() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [waiting, setWaiting] = useState<Handoff[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const [k, h] = await Promise.all([
      supabase.from('content_kits').select('id,brand_id,status,checklist,kit,created_at').order('created_at', { ascending: false }).limit(30),
      supabase.from('ai_handoffs').select('id,status,note,payload,created_at').eq('kind', 'ecom_brand_to_content').in('status', ['open', 'working']).order('created_at'),
    ]);
    setKits((k.data ?? []) as Kit[]); setWaiting((h.data ?? []) as Handoff[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const build = async (id?: string) => { setBusy(true); setMsg(''); const r = await callApi<{ summary?: string; error?: string }>('/api/content/kit-run', { body: id ? { handoff_id: id } : {} }); setBusy(false); setMsg(r.error ?? `${r.summary ?? 'Done'}. It's waiting in Approvals.`); await load(); };
  const tick = async (k: Kit, key: string) => {
    const checklist = k.checklist.map((c) => (c.key === key ? { ...c, done: !c.done } : c));
    const p = kitProgress(checklist);
    setKits((x) => x.map((y) => (y.id === k.id ? { ...y, checklist } : y)));
    await supabase.from('content_kits').update({ checklist, status: p.done === p.total && k.status === 'approved' ? 'done' : k.status, updated_at: new Date().toISOString() }).eq('id', k.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {waiting.map((h) => (
        <div key={h.id} style={{ ...E.card, padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge color={E.blue}>from E-commerce</Badge><span style={{ flex: 1, color: E.text }}>{h.note ?? `${h.payload.name ?? 'A brand'} is live`}</span>
          <button style={btn('primary')} disabled={busy || h.status === 'working'} onClick={() => void build(h.id)}>{h.status === 'working' ? 'Building…' : busy ? 'Building… (40–60s)' : 'Build the kit now'}</button>
        </div>
      ))}
      {msg && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{msg}</div>}
      {kits.length === 0 && waiting.length === 0 && <TeachingEmpty what="When a store goes live, Content gets its brand kit and builds the launch content: handles, bios, the first 9 posts and a 2-week plan." worker="Content orchestrator (nightly, or Build now)" />}
      {kits.map((k) => {
        const p = kitProgress(k.checklist);
        return (
          <div key={k.id} style={{ ...E.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {k.kit.profile_image && <img src={k.kit.profile_image} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />}
              <span style={{ fontWeight: 700, color: E.text, flex: 1 }}>{k.kit.brand ?? 'Brand'}</span>
              <Badge color={k.status === 'draft' ? E.amber : E.green}>{k.status === 'draft' ? 'waiting in Approvals' : k.status}</Badge>
              <Badge color={E.faint}>{p.done}/{p.total} steps</Badge>
            </div>
            {k.kit.handles?.length ? <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Handles</span> {k.kit.handles.map((h) => `@${h}`).join(' · ')}</div> : null}
            {k.kit.bio?.instagram && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Bio</span> {k.kit.bio.instagram}</div>}
            {k.kit.look && <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}><span style={label}>Look</span> {k.kit.look}</div>}
            <div style={{ fontSize: 'var(--text-caption)', color: E.muted }}>{k.kit.posts?.length ?? 0} posts across directions {[...new Set((k.kit.posts ?? []).map((x) => x.direction))].join(' + ') || 'A'}</div>
            {k.checklist.map((c) => (
              <label key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 'var(--text-caption)', color: E.text, cursor: 'pointer' }}>
                <input type="checkbox" checked={c.done} onChange={() => void tick(k, c.key)} style={{ marginTop: 2 }} />{c.label}
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
