import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Brand, BrandSteps, StepState } from './ecom';
import { nextStep } from './ecom';
import type { Product, Snapshot, ImportRow } from './ecomProducts';

/** Brands: the e-commerce home screen's rows. Own rows via RLS; every
 *  write stamps last_activity_at because health is derived from it. */
export function useEcomBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [orders30d, setOrders30d] = useState<Record<string, { count: number; total: number; last: string | null }>>({});
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [b, o, bp] = await Promise.all([
      supabase.from('ecom_brands').select('*').order('last_activity_at', { ascending: false }),
      supabase.from('ecom_orders').select('brand_id, total, placed_at').gte('placed_at', since),
      supabase.from('ecom_brand_products').select('brand_id, stage'),
    ]);
    if (b.error) setError(b.error.message); else setError('');
    setBrands((b.data ?? []) as Brand[]);
    const agg: Record<string, { count: number; total: number; last: string | null }> = {};
    for (const r of (o.data ?? []) as { brand_id: string; total: number; placed_at: string }[]) {
      const a = agg[r.brand_id] ?? { count: 0, total: 0, last: null };
      a.count += 1; a.total += Number(r.total);
      if (!a.last || r.placed_at > a.last) a.last = r.placed_at;
      agg[r.brand_id] = a;
    }
    setOrders30d(agg);
    const pc: Record<string, number> = {};
    for (const r of (bp.data ?? []) as { brand_id: string; stage: string }[]) if (r.stage !== 'killed') pc[r.brand_id] = (pc[r.brand_id] ?? 0) + 1;
    setProductCounts(pc);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const touch = () => ({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() });

  const createBrand = async (input: { name: string; owner_type: 'mine' | 'client'; client_id: string | null; positioning: string | null; steps?: BrandSteps; current_step?: number }): Promise<Brand | null> => {
    const { data, error: err } = await supabase
      .from('ecom_brands')
      .insert({ name: input.name, owner_type: input.owner_type, client_id: input.client_id, positioning: input.positioning, steps: input.steps ?? {}, current_step: input.current_step ?? 1 })
      .select('*')
      .single();
    if (err) { setError(err.message); return null; }
    await load();
    return data as Brand;
  };

  const updateBrand = async (id: string, patch: Partial<Brand>) => {
    const { error: err } = await supabase.from('ecom_brands').update({ ...patch, ...touch() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };

  /** Saves one step's state and moves current_step to the first gap. */
  const saveStep = async (brand: Brand, n: number, state: StepState) => {
    const steps: BrandSteps = { ...(brand.steps ?? {}), [String(n)]: { ...(brand.steps?.[String(n)] ?? {}), ...state } };
    const current = Math.min(10, nextStep({ steps }));
    await updateBrand(brand.id, { steps, current_step: current });
  };

  const removeBrand = async (id: string) => {
    await supabase.from('ecom_brands').delete().eq('id', id);
    await load();
  };

  return { brands, orders30d, productCounts, loading, error, reload: load, createBrand, updateBrand, saveStep, removeBrand };
}

/** The top bar's counters: approvals waiting, unread alerts, spend. */
export function useEcomCounters() {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [spentToday, setSpentToday] = useState(0);
  const [spentMonth, setSpentMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date();
    const dayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const [a, al, c] = await Promise.all([
      supabase.from('ai_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('ai_alerts').select('id', { count: 'exact', head: true }).is('read_at', null),
      supabase.from('ai_cost_ledger').select('date, cost_usd').gte('date', monthStart),
    ]);
    setPendingApprovals(a.count ?? 0);
    setUnreadAlerts(al.count ?? 0);
    const rows = (c.data ?? []) as { date: string; cost_usd: number }[];
    setSpentMonth(rows.reduce((s, r) => s + Number(r.cost_usd), 0));
    setSpentToday(rows.filter((r) => r.date === dayStr).reduce((s, r) => s + Number(r.cost_usd), 0));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { pendingApprovals, unreadAlerts, spentToday, spentMonth, loading, reload: load };
}

export interface Approval {
  id: string; domain: string; type: string; entity_type: string | null; entity_id: string | null; title: string;
  payload: Record<string, unknown>; principle: string | null; source_url: string | null; confidence: 'hard' | 'estimate' | 'ai' | null;
  is_money: boolean; amount_usd: number | null; status: 'pending' | 'approved' | 'sent_back' | 'killed'; my_note: string | null; created_at: string;
}
export interface Alert { id: string; domain: string; severity: 'info' | 'warn' | 'urgent'; kind: string | null; title: string; body: string | null; read_at: string | null; created_at: string }

/** One inbox across brands and domains (§7). Empty until workers exist;
 *  the decide path is what Phase 3 plugs into. */
export function useApprovals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [a, al] = await Promise.all([
      supabase.from('ai_approvals').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('ai_alerts').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setApprovals((a.data ?? []) as Approval[]);
    setAlerts((al.data ?? []) as Alert[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, status: 'approved' | 'sent_back' | 'killed', note: string | null) => {
    await supabase.from('ai_approvals').update({ status, my_note: note, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    await load();
  };
  const markAlertRead = async (id: string) => {
    await supabase.from('ai_alerts').update({ read_at: new Date().toISOString() }).eq('id', id);
    await load();
  };
  return { approvals, alerts, loading, reload: load, decide, markAlertRead };
}

// ── Product Sheets (Phase 2) ───────────────────────────────────────────

/** Products across every channel plus their rank snapshots. Imports
 *  upsert by (channel, name) so re-importing the same sheet grows the
 *  rank history instead of duplicating rows. */
export function useEcomProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      supabase.from('ecom_products').select('*').order('rank', { ascending: true, nullsFirst: false }),
      supabase.from('ecom_product_snapshots').select('*').order('captured_at', { ascending: true }).limit(5000),
    ]);
    if (p.error) setError(p.error.message); else setError('');
    setProducts((p.data ?? []) as Product[]);
    const by: Record<string, Snapshot[]> = {};
    for (const row of (s.data ?? []) as Snapshot[]) (by[row.product_id] ??= []).push(row);
    setSnapshots(by);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const importRows = async (rows: ImportRow[], source: string): Promise<{ inserted: number; updated: number }> => {
    let inserted = 0, updated = 0;
    for (const r of rows) {
      const existing = products.find((p) => p.channel === r.channel && p.name.trim().toLowerCase() === r.name.trim().toLowerCase());
      const base = {
        name: r.name, category: r.category, images: r.images, channel: r.channel, rank: r.rank, sell_price: r.sell_price, supplier_cost: r.supplier_cost,
        landed_cost: r.landed_cost, margin_pct: r.margin_pct, days_trending: r.days_trending, velocity: r.velocity, score: r.score,
        content_difficulty: r.content_difficulty, source, source_url: r.source_url, as_of: r.as_of, confidence: r.confidence, updated_at: new Date().toISOString(),
      };
      let id = existing?.id ?? null;
      if (existing) {
        const detail = { ...existing.detail, ...r.detail };
        const { error: err } = await supabase.from('ecom_products').update({ ...base, detail }).eq('id', existing.id);
        if (err) { setError(err.message); continue; }
        updated++;
      } else {
        const { data, error: err } = await supabase.from('ecom_products').insert({ ...base, detail: r.detail }).select('id').single();
        if (err) { setError(err.message); continue; }
        id = (data as { id: string }).id; inserted++;
      }
      if (id) await supabase.from('ecom_product_snapshots').insert({ product_id: id, channel: r.channel, rank: r.rank, price: r.sell_price, captured_at: r.as_of });
    }
    await load();
    return { inserted, updated };
  };

  const updateProduct = async (id: string, patch: Partial<Product>) => {
    const { error: err } = await supabase.from('ecom_products').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(err.message);
    await load();
  };
  const toggleWatch = async (p: Product) => updateProduct(p.id, { watched: !p.watched });
  const removeProduct = async (id: string) => { await supabase.from('ecom_products').delete().eq('id', id); await load(); };

  return { products, snapshots, loading, error, reload: load, importRows, updateProduct, toggleWatch, removeProduct };
}

/** "Build a brand from this": the brand ↔ product link the stepper reads. */
export async function linkProductToBrand(brandId: string, productId: string): Promise<void> {
  await supabase.from('ecom_brand_products').upsert({ brand_id: brandId, product_id: productId, stage: 'testing' }, { onConflict: 'brand_id,product_id' });
}
