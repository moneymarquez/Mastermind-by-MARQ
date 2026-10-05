import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { CHANNELS, PLAYBOOK_MAX_CHARS, money, ago } from '../../../data/ecom';
import type { Channel } from '../../../data/ecom';
import { VENTURES, SCRIPT_CHANNELS } from '../../../data/mktEngine';
import { runWorkerNow, getDailyPlan, runDailyStep } from '../../../data/useEngine';
import type { RunRes, DailyPlan } from '../../../data/useEngine';
import { E, Badge, btn, field, label, tint } from './ecomShared';

/** What each live worker needs for a "Run now", and what it tells you
 *  about cost and where the output goes. */
const HELP: Record<string, { busy: string; note: string }> = {
  scout: { busy: 'Scouting… (30–90 seconds)', note: 'Web search on public pages only (never Instagram, Facebook or TikTok video pages). Results go to Approvals, not straight into the sheet.' },
  analyst: { busy: 'Analysing… (20–40 seconds)', note: 'Buyer, why they buy, the angle, why it could fail, and the Validate check (3× landed, ships ≤ 12 days, trend early/rising). Approve to fill the product drawer.' },
  teardown: { busy: 'Tearing down… (60–120 seconds)', note: 'Web-searches the top 3–5 sellers, writes a dossier on each and 3 angles nobody is using. Approve to save them on the product.' },
  lead_filter: { busy: 'Filtering… (10–40 seconds)', note: 'Rules first (known chains, same phone / place / address = duplicate, names that repeat = multi-location), then Haiku checks the names the rules can\'t settle. Approve to tag the leads in LeadFlow.' },
  script_copy: { busy: 'Writing… (30–60 seconds)', note: '3 tones × 2 audiences for one channel, quoting your packages and citing the principle. It reads how your current scripts are doing first. Approve to save them as new versions.' },
  campaign_planner: { busy: 'Planning… (20–40 seconds)', note: 'One campaign for the week: list, script, channel, and targets from your own numbers. Approve to add it to Campaigns as planned.' },
  trend_researcher: { busy: 'Researching… (30–90 seconds)', note: 'Web search on public trend pages (TikTok Creative Center, YouTube, trend reports) — never Instagram, Facebook or TikTok video pages. Each find comes with why it worked and "our version". Approve to add them to Inspiration.' },
  idea_script: { busy: 'Writing… (30–60 seconds)', note: 'Next week\'s posts for one account (the one furthest behind its weekly goal if you don\'t pick): 3 hooks each, script, shot list, on-screen text, CTA. It reads the account\'s best posts, its last audit and saved Inspiration first. Approve to add them to the Plan.' },
  account_auditor: { busy: 'Auditing… (20–40 seconds)', note: 'Reads the last 14 days of posts against their numbers: exactly 3 things to repeat and 3 to stop, each with its evidence. Needs 2+ posts with views logged.' },
  content_analytics: { busy: 'Grading… (10–30 seconds)', note: 'Grades each post out of 4 against the account\'s own 30-day average (no AI in the grade), then writes one change per post. Breakouts (3×) and flops (under ⅓) raise an alert right away. Approve to save the grades.' },
  post_planner: { busy: 'Planning… (15–30 seconds)', note: 'Best time from your own posts\' views by hour (defaults until an account has 5 measured posts), final caption, hashtags and a cross-post plan for each scripted post in the next 10 days. Approve to set them on the Plan.' },
  clip_editor: { busy: 'Cutting… (20–40 seconds)', note: 'Reads the clip\'s timed transcript and proposes the hook, the cuts, captions, b-roll and Higgsfield prompts for a 9:16 short. Upload and transcribe clips in Studio first.' },
  supplier: { busy: 'Searching… (40–90 seconds)', note: 'Web-searches 3–5 suppliers for the brand\'s product and compares cost, shipping, rating, MOQ and branded packaging; drafts the sample order, inspection checklist and shot list. Approve to fill step 4 — the sample becomes a red money card you buy yourself.' },
  brandlab: { busy: 'Designing… (30–60 seconds)', note: 'Three brand options reasoned from the buyer: name, positioning, voice, palette with a reason per colour, type, logo direction. Each .com is checked for real (RDAP). Pick one in Approvals; the domain becomes a money card.' },
  builder: { busy: 'Building… (60–120 seconds)', note: 'Writes a one-product landing page as a single HTML file, then runs the quality gate (mobile viewport, Buy button, no placeholder text, no AI tells, alt text, size). Preview and download it — nothing is published.' },
  content: { busy: 'Writing… (30–60 seconds)', note: 'Launch posts for the brand\'s product rotated across its angles: hooks, script, shot list and a Higgsfield prompt each. Approve to put them on the Content Plan and fill step 7.' },
  publisher: { busy: 'Posting… (10–60 seconds)', note: 'Posts every approved post that is due now to Instagram or TikTok with the account\'s own login, and finishes any the platform was still processing. Nothing goes out that you didn\'t approve. Failures show exactly what the platform said, on the post and in Alerts.' },
  launcher: { busy: 'Launching… (10–40 seconds)', note: 'Takes the brand\'s approved store page live: creates the product in Shopify, points the Buy button at its checkout, and deploys the page to Cloudflare Pages. Needs Shopify and Cloudflare Pages connected in Setup.' },
  analytics: { busy: 'Reading… (10–20 seconds)', note: 'Funnel from your logged funnel rows (or step 9\'s numbers), diagnosis of where it breaks, and a scale / iterate / kill recommendation. Kill and double-down raise an alert.' },
  inbound_tracker: { busy: 'Tagging… (5–20 seconds)', note: 'UTM tags, click ids and the referring site first, then what the lead wrote ("my friend told me"); Haiku only reads the ones the rules can\'t settle. Approve to set the sources on Inbound.' },
  campaign_scorer: { busy: 'Grading… (10–30 seconds)', note: `Grades each running campaign out of 4 against your own average (answer → conversation → meeting → close), names the weak stage and writes the fix. Needs 10+ touches per campaign.` },
};

export function RunPanel({ workerKey, workerName, enabled, onRan }: { workerKey: string; workerName: string; enabled: boolean; onRan: () => void }) {
  const [channel, setChannel] = useState<Channel>('tiktok');
  const [count, setCount] = useState(10);
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState<{ id: string; name: string; score: number | null; channel: string }[]>([]);
  const [venture, setVenture] = useState('madebymarq');
  const [scriptChannel, setScriptChannel] = useState('call');
  const [all, setAll] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunRes | null>(null);
  const needsProduct = workerKey === 'analyst' || workerKey === 'teardown';
  const byAccount = ['trend_researcher', 'idea_script', 'account_auditor', 'content_analytics', 'post_planner'].includes(workerKey);
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<{ id: string; platform: string; handle: string }[]>([]);
  const [clipId, setClipId] = useState('');
  const [clips, setClips] = useState<{ id: string; file_name: string | null; status: string }[]>([]);
  const [posts, setPosts] = useState(3);
  const byBrand = ['supplier', 'brandlab', 'builder', 'content', 'analytics', 'launcher'].includes(workerKey);
  const acts = workerKey === 'publisher' || workerKey === 'launcher';
  const [brandId, setBrandId] = useState('');
  const [brands, setBrands] = useState<{ id: string; name: string; current_step: number }[]>([]);
  useEffect(() => {
    if (byBrand) supabase.from('ecom_brands').select('id,name,current_step').order('last_activity_at', { ascending: false }).then(({ data }) => { const rows = (data ?? []) as typeof brands; setBrands(rows); setBrandId((cur) => cur || rows[0]?.id || ''); });
  }, [byBrand]);

  useEffect(() => {
    if (byAccount) supabase.from('social_accounts').select('id,platform,handle').order('created_at').then(({ data }) => setAccounts((data ?? []) as typeof accounts));
    if (workerKey === 'clip_editor') supabase.from('content_clips').select('id,file_name,status').not('transcript', 'is', null).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setClips((data ?? []) as typeof clips));
  }, [byAccount, workerKey]);

  useEffect(() => {
    if (!needsProduct) return;
    supabase.from('ecom_products').select('id,name,score,channel').order('score', { ascending: false, nullsFirst: false }).limit(200)
      .then(({ data }) => { const rows = (data ?? []) as typeof products; setProducts(rows); setProductId((cur) => cur || rows[0]?.id || ''); });
  }, [needsProduct]);

  const run = async () => {
    setBusy(true); setResult(null);
    const body: Record<string, unknown> = { instructions: instructions.trim() || undefined };
    if (workerKey === 'scout') Object.assign(body, { channel, count });
    if (needsProduct) body.product_id = productId;
    if (workerKey === 'script_copy') Object.assign(body, { venture, script_channel: scriptChannel });
    if (workerKey === 'campaign_planner') body.venture = venture;
    if (workerKey === 'lead_filter' || workerKey === 'content_analytics' || workerKey === 'inbound_tracker') body.all = all;
    if (byAccount && accountId) body.account_id = accountId;
    if (workerKey === 'idea_script') body.count = posts;
    if (workerKey === 'clip_editor' && clipId) body.clip_id = clipId;
    if (byBrand) body.brand_id = brandId;
    const r = await runWorkerNow(workerKey, body);
    setResult(r.error && r.ok === undefined ? { ok: false, error: r.error } : r); setBusy(false); onRan();
  };
  const h = HELP[workerKey] ?? { busy: 'Working…', note: '' };

  return (
    <div style={{ ...E.card, padding: 14, marginTop: 14 }}>
      <div style={{ ...label, marginBottom: 8 }}>Run now</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {workerKey === 'scout' && <>
          <select aria-label="Channel" style={{ ...field, width: 'auto' }} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <select aria-label="How many" style={{ ...field, width: 'auto' }} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 10, 15, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}</select>
        </>}
        {needsProduct && (products.length
          ? <select aria-label="Product" style={{ ...field, flex: 1, minWidth: 0 }} value={productId} onChange={(e) => setProductId(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.score != null ? ` · ${Number(p.score).toFixed(0)}/10` : ''} · {p.channel}</option>)}</select>
          : <div style={{ fontSize: 'var(--text-body)', color: E.muted }}>No products yet — run Product Scout or import a sheet first.</div>)}
        {(workerKey === 'script_copy' || workerKey === 'campaign_planner') && <select aria-label="Venture" style={{ ...field, width: 'auto' }} value={venture} onChange={(e) => setVenture(e.target.value)}>{VENTURES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>}
        {workerKey === 'script_copy' && <select aria-label="Script channel" style={{ ...field, width: 'auto' }} value={scriptChannel} onChange={(e) => setScriptChannel(e.target.value)}>{SCRIPT_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>}
        {byBrand && (brands.length ? <select aria-label="Brand" style={{ ...field, flex: 1, minWidth: 0 }} value={brandId} onChange={(e) => setBrandId(e.target.value)}>{brands.map((b) => <option key={b.id} value={b.id}>{b.name} · step {b.current_step}</option>)}</select> : <div style={{ fontSize: 'var(--text-body)', color: E.muted }}>No brands yet — start one in Brands.</div>)}
        {byAccount && <select aria-label="Account" style={{ ...field, width: 'auto', maxWidth: '100%' }} value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">{workerKey === 'idea_script' ? 'Furthest behind its goal' : 'All accounts'}</option>{accounts.map((a) => <option key={a.id} value={a.id}>@{a.handle} · {a.platform}</option>)}</select>}
        {workerKey === 'idea_script' && <select aria-label="How many posts" style={{ ...field, width: 'auto' }} value={posts} onChange={(e) => setPosts(Number(e.target.value))}>{[1, 2, 3, 4, 5, 7].map((n) => <option key={n} value={n}>{n} post{n === 1 ? '' : 's'}</option>)}</select>}
        {workerKey === 'clip_editor' && <select aria-label="Clip" style={{ ...field, flex: 1, minWidth: 0 }} value={clipId} onChange={(e) => setClipId(e.target.value)}><option value="">Oldest raw clip</option>{clips.map((c) => <option key={c.id} value={c.id}>{c.file_name ?? 'clip'} · {c.status}</option>)}</select>}
        {workerKey === 'inbound_tracker' && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-body)', color: E.muted }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Re-check leads already tagged</label>}
        {workerKey === 'content_analytics' && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-body)', color: E.muted }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Re-grade posts already graded</label>}
        {workerKey === 'lead_filter' && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 'var(--text-body)', color: E.muted }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Re-check leads already tagged</label>}
      </div>
      <textarea maxLength={PLAYBOOK_MAX_CHARS} style={{ ...field, marginTop: 8, minHeight: 64, resize: 'vertical' }} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Optional instructions for this run" />
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, fontFamily: 'var(--font-mono)' }}>{instructions.length.toLocaleString()} / {PLAYBOOK_MAX_CHARS.toLocaleString()}</div>
      <button style={{ ...btn('primary'), marginTop: 10 }} disabled={busy || !enabled || (needsProduct && !productId) || (byBrand && !brandId)} onClick={run}>{busy ? h.busy : `Run ${workerName}`}</button>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginTop: 6, lineHeight: 1.45 }}>{h.note}{acts ? '' : ' Counts against today\'s cap for this module.'}</div>
      {result && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)', background: tint(result.ok ? E.green : E.red, 10), border: `1px solid ${tint(result.ok ? E.green : E.red, 35)}`, fontSize: 'var(--text-body)', color: E.text }}>
          {result.ok
            ? <>{result.skipped || acts ? result.summary : <>Done → waiting in Approvals. {result.summary}</>} <span style={{ color: E.faint }}>({money(result.costUsd ?? 0)}{result.searches ? `, ${result.searches} searches` : ''})</span>{result.dropped?.length ? <div style={{ color: E.amber, marginTop: 4 }}>Dropped: {result.dropped.join('; ')}</div> : null}</>
            : <><strong>{result.capReached ? 'Cost cap hit.' : 'Run failed.'}</strong> {result.error}</>}
        </div>
      )}
    </div>
  );
}

const TASK_COLOR: Record<string, string> = { done: E.green, failed: E.red, running: E.accent, waiting: E.amber };

/** The Orchestrator's room: tonight's plan, each step's result, and the
 *  summary the morning digest reads. "Run tonight's plan now" walks the
 *  same steps the 03:30 cron does, one call per step. */
export function OrchestratorPanel({ onRan }: { onRan: () => void }) {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const load = async () => { const r = await getDailyPlan(); if (r.error) setErr(r.error); else { setPlan(r); setErr(''); } };
  useEffect(() => { load(); }, []);
  const runAll = async () => {
    setErr('');
    for (let i = 0; i < 12; i++) {
      setBusy(i === 0 ? 'Starting…' : `Step ${i + 1}…`);
      const r = await runDailyStep();
      if (r.error) { setErr(r.error); break; }
      await load(); onRan();
      if (r.done) break;
      setBusy(`${r.step?.step.label ?? 'Step'} — ${r.step?.status}`);
    }
    setBusy('');
  };
  const byKey = new Map((plan?.tasks ?? []).map((t) => [t.body.split(':').slice(2).join(':'), t]));
  const left = (plan?.plan ?? []).filter((s) => !byKey.has(s.key)).length;
  return (
    <div style={{ ...E.card, padding: 14, marginTop: 14 }}>
      <div style={{ ...label, marginBottom: 6 }}>Tonight's plan{plan ? ` · ${plan.date}` : ''}</div>
      <div style={{ fontSize: 'var(--text-caption)', color: E.faint, marginBottom: 8, lineHeight: 1.45 }}>Runs by itself from 3:30am Denver, one step every 5 minutes, and finishes before the 5:30 digest (the cron only starts it between 3:30 and 7am). Every output still lands in Approvals.</div>
      {(plan?.plan ?? []).map((s) => {
        const t = byKey.get(s.key);
        return (
          <div key={s.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: `1px solid ${E.border}`, fontSize: 'var(--text-body)' }}>
            <Badge color={t ? TASK_COLOR[t.status] ?? E.faint : E.faint}>{t ? t.status : 'next'}</Badge>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: E.text }}>{s.label}</div>
              {t?.note && <div style={{ fontSize: 'var(--text-caption)', color: t.status === 'failed' ? E.red : E.muted, overflowWrap: 'anywhere' }}>{t.note}</div>}
            </div>
            {t && <span style={{ fontSize: 'var(--text-caption)', color: E.faint, flexShrink: 0 }}>{ago(t.created_at)}</span>}
          </div>
        );
      })}
      <button style={{ ...btn('primary'), marginTop: 10 }} disabled={!!busy || left === 0} onClick={runAll}>{busy || (left === 0 ? 'Tonight\'s plan is done' : `Run tonight's plan now (${left} step${left === 1 ? '' : 's'})`)}</button>
      {err && <div style={{ fontSize: 'var(--text-caption)', color: E.red, marginTop: 6 }}>{err}</div>}
      {plan?.summary && (
        <div style={{ marginTop: 12 }}>
          <div style={label}>Summary · {plan.summary.date}</div>
          <div style={{ fontSize: 'var(--text-body)', color: E.text, lineHeight: 1.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{plan.summary.summary_text}</div>
        </div>
      )}
    </div>
  );
}
