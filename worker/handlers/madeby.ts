// Made by Marq routes (October build, Phase 5).
//   POST /api/comms/send              { channel, to, subject?, body, contact_id?, client_id?, scheduled_for?, attachments? }
//   POST /api/comms/start-sequence    { contact_id, list_name }   owner: people-list automation
//   POST /api/contracts/send          { id }
//   GET  /api/contracts/view?t=TOKEN  public: the contract to read
//   POST /api/contracts/sign          public: { t, name, agree, decline? }
//   POST /api/invoices/send           { id }   invoice anyone
//   POST /api/invoices/paid           { id }   mark paid → Ledger income
//   POST /api/marketing/plan          owner: the Marketing orchestrator's weekly plan
import { requireUser, isOwnerUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { CapReached } from '../lib/ai';
import { sendMessage, startSequencesFor, sendContract, viewContract, signContract, sendBizInvoice, invoicePaidToLedger, marketingPlan } from '../lib/madeby';
import type { MadebyEnv } from '../lib/madeby';

export type MadebyRouteEnv = SbEnv & MadebyEnv & { VITE_SUPABASE_ANON_KEY: string };
const UUID = /^[0-9a-f-]{36}$/i;

export async function madebyRoute(request: Request, env: MadebyRouteEnv, area: string, path: string): Promise<Response> {
  const sb = new Sb(env);
  try {
    if (area === 'contracts' && path === 'view') {
      const v = await viewContract(sb, new URL(request.url).searchParams.get('t') ?? '');
      return v ? json(v) : json({ error: 'This contract link isn\'t valid.' }, 404);
    }
    if (area === 'contracts' && path === 'sign') {
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
      const b = (await request.json().catch(() => ({}))) as { t?: string; name?: string; agree?: boolean; decline?: boolean };
      const r = await signContract(sb, String(b.t ?? ''), { name: String(b.name ?? ''), agree: b.agree === true, decline: b.decline === true, ip: request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown', agent: request.headers.get('user-agent') ?? '' });
      return json(r, r.ok ? 200 : 400);
    }
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    if (user instanceof Response) return user;
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof b.id === 'string' && UUID.test(b.id) ? b.id : null;
    const origin = new URL(request.url).origin;
    if (area === 'comms' && path === 'send') {
      const r = await sendMessage(env, sb, user.id, { channel: b.channel === 'sms' ? 'sms' : 'email', to: String(b.to ?? ''), subject: typeof b.subject === 'string' ? b.subject : null, body: String(b.body ?? ''), contact_id: typeof b.contact_id === 'string' && UUID.test(b.contact_id) ? b.contact_id : null, client_id: typeof b.client_id === 'string' && UUID.test(b.client_id) ? b.client_id : null, scheduled_for: typeof b.scheduled_for === 'string' ? b.scheduled_for : null, attachments: Array.isArray(b.attachments) ? (b.attachments as { doc_id?: string; name: string }[]).slice(0, 10) : [] });
      return json(r, r.ok ? 200 : 400);
    }
    if (area === 'comms' && path === 'start-sequence') {
      if (!isOwnerUser(user)) return json({ ok: true, started: 0 });
      const cid = typeof b.contact_id === 'string' && UUID.test(b.contact_id) ? b.contact_id : null;
      if (!cid || typeof b.list_name !== 'string') return json({ error: 'contact_id and list_name are required.' }, 400);
      return json({ ok: true, started: await startSequencesFor(sb, user.id, cid, b.list_name) });
    }
    if (area === 'marketing' && path === 'funnel') {
      if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
      // Every account's subscription state (service role; owner only).
      const subs = await sb.get<{ status: string; updated_at: string }>('subscriptions?select=status,updated_at&limit=10000').catch(() => []);
      const count = (st: string[]) => subs.filter((x) => st.includes(x.status)).length;
      return json({ trials: subs.filter((x) => x.status !== 'none').length, trialing: count(['trialing']), paid: count(['active', 'past_due']), churned: count(['canceled', 'unpaid']) });
    }
    if (!id && path !== 'plan') return json({ error: 'id is required.' }, 400);
    if (area === 'contracts' && path === 'send') { const r = await sendContract(env, sb, user.id, id!, origin); return json(r, r.ok ? 200 : 400); }
    if (area === 'invoices' && path === 'send') { const r = await sendBizInvoice(env, sb, user.id, id!); return json(r, r.ok ? 200 : 400); }
    if (area === 'invoices' && path === 'paid') {
      const [inv] = await sb.get<{ id: string; to_name: string; amount_usd: number }>(`biz_invoices?id=eq.${id}&user_id=eq.${user.id}&select=id,to_name,amount_usd`);
      if (!inv) return json({ error: 'That invoice is gone.' }, 404);
      await sb.patch('biz_invoices', `id=eq.${id}`, { status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      await invoicePaidToLedger(sb, user.id, { type: 'biz_invoice', id: inv.id, amount: Number(inv.amount_usd), party: inv.to_name, category: /aphs|james/i.test(inv.to_name) ? 'APHS / James' : 'client' });
      return json({ ok: true });
    }
    if (area === 'marketing' && path === 'plan') {
      if (!isOwnerUser(user)) return json({ error: 'Owner only.' }, 403);
      const f = b.facts as { accounts?: string[]; funnel?: string; budgetLeft?: number; nextTwenty?: string; ideas?: string[] } | undefined;
      return json(await marketingPlan(env.ANTHROPIC_API_KEY, sb, user.id, { accounts: f?.accounts ?? [], funnel: f?.funnel ?? 'unknown', budgetLeft: Number(f?.budgetLeft ?? 100), nextTwenty: f?.nextTwenty ?? '', ideas: f?.ideas ?? [] }));
    }
    return json({ error: `Unknown route ${area}/${path}` }, 404);
  } catch (e) {
    if (e instanceof CapReached) return json({ error: e.message, capReached: true }, 429);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
