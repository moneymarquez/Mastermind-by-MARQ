import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseOrchestratorReply, applyPlaybookEdit, parseRoute } from '../worker/lib/office';

test('office: orchestrator replies, playbook edits, routing', async () => {
  const t = JSON.stringify({ reply: 'Scout ignored price.', proposals: [
    { kind: 'rerun', instructions: 'Only products over $15 with 4+ stars', why: 'fix now' },
    { kind: 'rerun', instructions: 'dup' },
    { kind: 'playbook', playbook: 'Made up', before: '', after: '- Skip anything under $15.', why: 'sticks' },
    { kind: 'settings', model: 'gpt-9', autonomy_level: 5, why: 'x' },
    { kind: 'settings', model: 'claude-sonnet-5', why: 'better judgment' },
  ] });
  const r = parseOrchestratorReply(t, ['E-commerce', 'Psychology'], 'worker:scout');
  assert.equal(r.reply, 'Scout ignored price.');
  assert.equal(r.proposals.length, 3); assert.deepEqual(r.proposals[2], { kind: 'settings', why: 'better judgment', model: 'claude-sonnet-5' });
  assert.equal(r.proposals[0].kind, 'rerun');
  assert.equal((r.proposals[1] as any).playbook, 'worker:scout');
  const r2 = parseOrchestratorReply(JSON.stringify({ reply: 'x', proposals: [{ kind: 'settings', model: 'claude-sonnet-5', autonomy_level: 1, why: 'y' }] }), [], 'worker:scout');
  assert.deepEqual(r2.proposals[0], { kind: 'settings', why: 'y', model: 'claude-sonnet-5', autonomy_level: 1 });
  assert.equal(parseOrchestratorReply('plain words', [], 'w').reply, 'plain words');
  assert.deepEqual(applyPlaybookEdit('- a\n- b', '- b', '- c'), { body: '- a\n- c', mode: 'replaced' });
  assert.deepEqual(applyPlaybookEdit('- a\n', '- zz', '- c'), { body: '- a\n- c', mode: 'appended' });
  assert.deepEqual(applyPlaybookEdit('', '', '- c'), { body: '- c', mode: 'appended' });
  assert.deepEqual(parseRoute('{"worker_key":"scout","channel":"amazon","instructions":"over $30","reply":"Scout is on it"}', ['scout']), { workerKey: 'scout', instructions: 'over $30', channel: 'amazon', reply: 'Scout is on it', productId: null, scriptChannel: null });
  assert.equal(parseRoute('{"worker_key":"analyst","product_id":"0f8fad5b-d9cb-469f-a165-70867728950e","script_channel":"email"}', ['analyst']).productId, '0f8fad5b-d9cb-469f-a165-70867728950e');
  assert.equal(parseRoute('{"worker_key":"script_copy","product_id":"x","script_channel":"email"}', ['script_copy']).productId, null);
  assert.equal(parseRoute('{"worker_key":"nobody","channel":"mars"}', ['scout']).workerKey, null);

});
