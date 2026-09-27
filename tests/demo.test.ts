import { describe, it, expect, beforeEach } from 'vitest';
import { demoClient, resetDemoDb } from '../src/demo/client';
import { DEMO_USER } from '../src/demo/seed';

describe('demo client', () => {
  beforeEach(() => resetDemoDb());

  it('serves seeded rows with filters, order and limit', async () => {
    const { data, error } = await demoClient.from('ecom_products').select('*').eq('channel', 'tiktok').order('rank').limit(2);
    expect(error).toBeNull();
    expect(data.map((p: { name: string }) => p.name)).toEqual(['Cloud Neck Pillow', 'Magnetic Desk Lamp']);
  });

  it('keeps writes in memory and a reset puts the seed back', async () => {
    await demoClient.from('goals').insert({ user_id: DEMO_USER.id, title: 'Written during the demo' });
    const after = await demoClient.from('goals').select('*').eq('title', 'Written during the demo');
    expect(after.data).toHaveLength(1);
    resetDemoDb();
    const reset = await demoClient.from('goals').select('*').eq('title', 'Written during the demo');
    expect(reset.data).toHaveLength(0);
  });

  it('the hero product clears the 3× landed rule it claims to pass', async () => {
    const { data } = await demoClient.from('ecom_products').select('*').eq('name', 'Cloud Neck Pillow').single();
    expect(data.sell_price / data.landed_cost).toBeGreaterThanOrEqual(3);
  });
});
