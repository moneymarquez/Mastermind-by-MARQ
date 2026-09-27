import { test } from 'vitest';
import assert from 'node:assert/strict';
import { personalizePrompt } from '../src/lib/promptUser';

test('B-07 prompt personalisation', async () => {
  const p = "You are Nova, a warm presence inside Cristopher's tracker. He just logged how he's feeling. If anything in his notes suggests he may be in crisis, tell him. Back if he wants.";
  assert.equal(personalizePrompt(p, { owner: true, name: 'Cristopher' }), p, 'owner: unchanged');
  const s = personalizePrompt(p, { owner: false, name: 'Sam' });
  assert.ok(!/Cristopher|\bhe\b|\bHe\b|\bhis\b|\bhim\b/.test(s), s);
  assert.ok(s.includes("inside Sam's tracker. Sam just logged how Sam's feeling. If anything in Sam's notes suggests Sam may be in crisis, tell Sam. Back if Sam wants."), s);
  const n = personalizePrompt(p, { owner: false, name: '' });
  assert.ok(n.includes("inside the user's tracker. The user just logged"), n);
  assert.ok(!/\bthe\b.*theuser/.test(n) && personalizePrompt('the theme', { owner: false, name: '' }) === 'the theme', 'no damage to words containing he');

});
