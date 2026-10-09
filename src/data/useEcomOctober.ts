import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Data for the October E-commerce sections: pitches, orders, visuals,
// launched stores. Each read tolerates a missing table (schema_122 not yet
// applied) by returning empty.

export interface PitchRow { id: string; product_id: string | null; product_name: string; approval_id: string | null; status: 'pitched' | 'approved' | 'rejected' | 'replaced'; confidence_pct: number; profit_per_order: number | null; predicted_orders_base: number | null; predicted_profit_base: number | null; brand_id: string | null; actual_orders_30d: number | null; actual_profit_30d: number | null; reject_reason: string | null; payload: Record<string, unknown>; created_at: string }
export interface OrderRow { id: string; brand_id: string | null; external_id: string; order_number: string | null; customer_name: string | null; total: number; placed_at: string; status: string; fulfillment_status: string | null; supplier_status: string; supplier_cost: number | null; ship_cost: number | null; margin_usd: number | null; product_title: string | null; problem: string | null; site_id?: string | null }
export interface BuildRow { brand_id: string; status: string; live_url: string | null; launched_at: string | null; launch_error: string | null; shopify_product_id: string | null }

export { productStatus } from './ecomOctoberPure';

export function usePitches() {
  const [rows, setRows] = useState<PitchRow[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ecom_pitches').select('*').order('created_at', { ascending: false }).limit(60);
    setRows(error ? [] : ((data ?? []) as PitchRow[]));
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { rows, reload: load };
}

export function useOrders(days = 30) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const cols = 'id,brand_id,external_id,order_number,customer_name,total,placed_at,status,fulfillment_status,supplier_status,supplier_cost,ship_cost,margin_usd,product_title,problem';
    const first = await supabase.from('ecom_orders').select(`${cols},site_id`).gte('placed_at', since).order('placed_at', { ascending: false }).limit(500);
    // Before schema_127 there's no site_id column.
    const { data, error } = first.error ? await supabase.from('ecom_orders').select(cols).gte('placed_at', since).order('placed_at', { ascending: false }).limit(500) : first;
    if (error) {
      // Before schema_122 the new columns don't exist yet: fall back to the original ones.
      const r = await supabase.from('ecom_orders').select('id,brand_id,external_id,total,placed_at').gte('placed_at', since).order('placed_at', { ascending: false }).limit(500);
      setRows(((r.data ?? []) as Partial<OrderRow>[]).map((o) => ({ order_number: null, customer_name: null, status: 'paid', fulfillment_status: null, supplier_status: 'to_place', supplier_cost: null, ship_cost: null, margin_usd: null, product_title: null, problem: null, ...o }) as OrderRow));
    } else setRows((data ?? []) as OrderRow[]);
    setLoading(false);
  }, [days]);
  useEffect(() => { void load(); }, [load]);
  return { rows, loading, reload: load };
}

export function useBuilds() {
  const [rows, setRows] = useState<BuildRow[]>([]);
  useEffect(() => {
    supabase.from('ecom_store_builds').select('brand_id,status,live_url,launched_at,launch_error,shopify_product_id').order('updated_at', { ascending: false }).limit(200)
      .then(({ data, error }) => setRows(error ? [] : ((data ?? []) as BuildRow[])));
  }, []);
  return rows;
}

/** Pure: a product's place in the pipeline for its chip. */

export interface SiteRow { id: string; brand_id: string; slug: string; domain: string | null; domain_status: string; pages_project: string | null; deploy_url: string | null; status: string; checkout_url: string | null; last_error: string | null; launched_at: string | null }
export interface SiteDayRow { site_id: string; date: string; views: number; buy_clicks: number }

/** Every product site (addendum §2) and its last 30 days of views and Buy clicks. */
export function useSites() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [days, setDays] = useState<SiteDayRow[]>([]);
  const [missing, setMissing] = useState(false);
  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [s, d] = await Promise.all([
      supabase.from('ecom_sites').select('id,brand_id,slug,domain,domain_status,pages_project,deploy_url,status,checkout_url,last_error,launched_at').order('created_at', { ascending: false }),
      supabase.from('ecom_site_daily').select('site_id,date,views,buy_clicks').gte('date', since),
    ]);
    setMissing(!!s.error);
    setSites((s.data ?? []) as SiteRow[]);
    setDays((d.data ?? []) as SiteDayRow[]);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { sites, days, missing, reload: load };
}
