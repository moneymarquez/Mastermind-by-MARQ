import type { GraphData, GraphNode, NodeState } from '../components/office/OfficeGraph';

// Turns the roster, recent runs, open flags and handoffs into OfficeGraph's
// plain data shape. Pure; tested in tests/ecom-october.test.ts.

export interface GWorker { id: string; key: string; name: string; domain: string; enabled: boolean; status: string; model: string }
export interface GRun { worker_id: string | null; status: string; created_at: string; cost_usd?: number }
export interface GFlag { entity_type: string; entity_id: string; severity: 'red' | 'amber' }
export interface GHandoff { from_domain: string; to_domain: string; kind: string; status: string }

const ORCH_OF: Record<string, string> = { ecom: 'orchestrator', content: 'content_orchestrator', marketing: 'marketing_orchestrator' };
const ORCH_KEYS = new Set(Object.values(ORCH_OF));

export function buildGraphData(workers: GWorker[], runs: GRun[], flags: GFlag[], handoffs: GHandoff[]): GraphData {
  const byKey = new Map(workers.map((w) => [w.key, w]));
  const flagOf = (id: string) => flags.filter((f) => f.entity_type === 'worker' && f.entity_id === id).sort((a) => (a.severity === 'red' ? -1 : 1))[0];
  const stateOf = (w: GWorker): NodeState => {
    if (!w.enabled || w.status === 'disabled') return 'off';
    if (w.status === 'running') return 'active';
    const f = flagOf(w.id);
    if (f) return f.severity;
    if (w.status === 'failed') return 'amber';
    return 'idle';
  };
  const meta = (w: GWorker) => {
    const mine = runs.filter((r) => r.worker_id === w.id);
    const cost = mine.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    return `${mine.length} run${mine.length === 1 ? '' : 's'} today${cost ? ` · $${cost.toFixed(2)}` : ''}`;
  };
  const nodes: GraphNode[] = [];
  const hq = byKey.get('hq');
  if (hq) nodes.push({ id: hq.id, label: 'HQ', kind: 'hq', domain: 'all', state: stateOf(hq), meta: meta(hq) });
  for (const [domain, key] of Object.entries(ORCH_OF)) {
    const o = byKey.get(key);
    if (o) nodes.push({ id: o.id, label: o.name.replace(' Orchestrator', ''), kind: 'orchestrator', domain, state: stateOf(o), meta: meta(o) });
  }
  for (const w of workers) {
    if (w.key === 'hq' || ORCH_KEYS.has(w.key)) continue;
    const dom = w.domain === 'all' ? 'ecom' : w.domain;
    const parent = byKey.get(ORCH_OF[dom] ?? '')?.id ?? null;
    nodes.push({ id: w.id, label: w.name, kind: 'worker', domain: dom, state: stateOf(w), parent, meta: meta(w) });
  }
  const edges: GraphData['edges'] = [];
  for (const n of nodes) {
    if (n.kind === 'orchestrator' && hq) edges.push({ from: n.id, to: hq.id, kind: 'reports', active: n.state === 'active' });
    if (n.kind === 'worker' && n.parent) edges.push({ from: n.parent, to: n.id, kind: 'reports', active: n.state === 'active' });
  }
  for (const h of handoffs.filter((x) => x.status === 'open' || x.status === 'working')) {
    const a = byKey.get(ORCH_OF[h.from_domain] ?? ''), b = byKey.get(ORCH_OF[h.to_domain] ?? '');
    if (a && b) edges.push({ from: a.id, to: b.id, kind: 'handoff', active: true, label: h.kind.replace(/_/g, ' ') });
  }
  return { nodes, edges };
}
