import { test } from 'vitest';
import assert from 'node:assert/strict';
import { isMember, memberIds, assistantBudget } from '../worker/lib/member';
import { OWNER_USER_ID } from '../worker/lib/auth';

test('B-02 member guard and assistant cap', async () => {
  const db: Record<string, Record<string, unknown>[]> = {
    profiles: [{ id: 'client1', role: 'client' }, { id: 'paid', role: null }],
    comped_users: [{ user_id: 'comped' }, { user_id: 'client1' }],
    subscriptions: [{ user_id: 'paid', status: 'active' }, { user_id: 'lapsed', status: 'canceled' }, { user_id: 'trial', status: 'trialing' }],
    ai_cost_ledger: [{ user_id: 'paid', domain: 'assistant', date: '2026-09-27', cost_usd: 1.2 }], ai_domain_caps: [],
  };
  const sb = { async get(path: string) {
    const [t, q = ''] = path.split('?'); const f = q.split('&').filter((p) => !p.startsWith('select=') && p);
    return (db[t] ?? []).filter((r) => f.every((p) => { const [k, v] = p.split('='); if (v.startsWith('eq.')) return String(r[k]) === v.slice(3); if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(r[k])); return true; }));
  }, async insert() { return []; } } as never;
  assert.equal(await isMember(sb, OWNER_USER_ID), true);
  assert.equal(await isMember(sb, 'comped'), true);
  assert.equal(await isMember(sb, 'paid'), true);
  assert.equal(await isMember(sb, 'trial'), true);
  assert.equal(await isMember(sb, 'lapsed'), false, 'canceled subscription is not a member');
  assert.equal(await isMember(sb, 'stranger'), false, 'a free signup is not a member');
  assert.equal(await isMember(sb, 'client1'), false, 'a client-portal login is never a member, even if comped');
  const ids = await memberIds(sb);
  assert.deepEqual([...ids].sort(), [OWNER_USER_ID, 'comped', 'paid', 'trial'].sort());
  assert.equal((await assistantBudget(sb, 'paid', false, '2026-09-27'))?.status, 429, 'over the $1 default cap');
  assert.equal(await assistantBudget(sb, 'trial', false, '2026-09-27'), null);
  assert.equal(await assistantBudget(sb, OWNER_USER_ID, true, '2026-09-27'), null, 'owner never blocked');

});
