import { test } from 'vitest';
import assert from 'node:assert/strict';

test('B-06 deep links beat the remembered screen', async () => {

  const { pickInitialScreen, deepLinkScreen } = await import('../src/screenRestore');
  const now = Date.now();
  const fresh = JSON.stringify({ screen: 'budgeting', at: now - 60_000 });
  assert.equal(pickInitialScreen('?screen=leadflow', fresh, now), 'leadflow', 'deep link beats the remembered screen');
  assert.equal(pickInitialScreen('?screen=setup&connected=etsy', null, now), 'setup');
  assert.equal(pickInitialScreen('', fresh, now), 'budgeting', 'no link: remembered screen');
  assert.equal(pickInitialScreen('?screen=nonsense', fresh, now), 'budgeting', 'unknown screen ignored');
  assert.equal(pickInitialScreen('', null, now), 'home');
  assert.equal(deepLinkScreen('?screen=placeholder'), null);

});
