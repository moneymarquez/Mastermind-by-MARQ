import type { ClientDeliverable, ClientModuleAssignment, ClientPortalSettings, CrmClient, SpineState, SpineStationKey } from './types';

// The progress spine — the one thing the portal must get right: a client
// can look at it and know something is happening without sending a
// message. Every station's state AND its one-line copy are DERIVED from
// data the client's record already holds (audit, Brand Lab brief,
// deliverables, published reports, guides, handoff). Nothing here is
// typed a second time; the owner's only lever is spine_overrides on
// client_portal, for the cases the data can't see. Pure function — the
// client portal and the operator's Client Modules screen both call it
// with the same inputs, so they can't drift.

export interface SpineAuditInput {
  status: string;
  answers: Record<string, unknown> | null;
  updated_at: string;
}

export interface SpineBriefInput {
  business: string | null;
  bottleneck_verbatim: string | null;
  spec_approved_at: string | null;
  design_locked_at: string | null;
  created_at: string;
}

export interface SpineReportInput {
  period_label: string;
  published: boolean;
}

export interface SpineInput {
  client: Pick<CrmClient, 'business_name' | 'stage' | 'source' | 'created_at'> | null;
  audit: SpineAuditInput | null;
  brief: SpineBriefInput | null;
  deliverables: ClientDeliverable[];
  reports: SpineReportInput[];
  settings: Pick<ClientPortalSettings, 'handoff_mode' | 'handoff_started_at' | 'spine_overrides'> | null;
  assignments: ClientModuleAssignment[];
}

export interface SpineStation {
  key: SpineStationKey;
  label: string;
  state: SpineState;
  /** Plain-English, one line, from the record. Never invented. */
  detail: string;
  /** True when the state came from spine_overrides rather than data —
   *  the operator screen shows this so an override is never mistaken for
   *  something the data proved. */
  overridden: boolean;
}

export const SPINE_STATIONS: { key: SpineStationKey; label: string }[] = [
  { key: 'intake', label: 'Intake' },
  { key: 'call', label: 'Discovery call' },
  { key: 'brand_site', label: 'Brand & site' },
  { key: 'systems', label: 'Systems' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'teach_back', label: 'Teach-back' },
];

const STAGE_RANK: Record<string, number> = { new_lead: 0, discovery_complete: 1, analysis_sent: 2, invoice_sent: 3, active: 4, retainer: 5 };

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function list(titles: string[]): string {
  if (titles.length <= 2) return titles.join(' and ');
  return `${titles.slice(0, 2).join(', ')} +${titles.length - 2} more`;
}

type Raw = { state: SpineState; detail: string };

function kindsBucket(deliverables: ClientDeliverable[], kinds: ClientDeliverable['kind'][], emptyDetail: string): Raw {
  const mine = deliverables.filter((d) => kinds.includes(d.kind));
  if (mine.length === 0) return { state: 'next', detail: emptyDetail };
  const live = mine.filter((d) => d.status === 'live');
  const review = mine.filter((d) => d.status === 'review');
  if (live.length === mine.length) return { state: 'done', detail: `${list(live.map((d) => d.title))} — live` };
  if (review.length) return { state: 'active', detail: `${list(review.map((d) => d.title))} — waiting on your approval` };
  const working = mine.filter((d) => d.status !== 'live');
  return { state: 'active', detail: `${list(working.map((d) => d.title))} — in progress${live.length ? `, ${live.length} live` : ''}` };
}

export function buildSpine(input: SpineInput): SpineStation[] {
  const { client, audit, brief, deliverables, reports, settings, assignments } = input;
  const stageRank = client ? (STAGE_RANK[client.stage] ?? 0) : 0;

  const raw: Record<SpineStationKey, Raw> = {
    intake: client
      ? {
          state: 'done',
          detail: client.source === 'public'
            ? `${client.business_name} came in through the audit form on ${shortDate(client.created_at)}`
            : `${client.business_name} added on ${shortDate(client.created_at)}`,
        }
      : { state: 'next', detail: 'Nothing on file yet' },

    call: (() => {
      const answered = audit?.answers ? Object.keys(audit.answers).length : 0;
      if (audit?.status === 'complete' || stageRank >= 1) {
        return { state: 'done', detail: answered ? `Discovery done — ${answered} answers on file${audit ? ` (${shortDate(audit.updated_at)})` : ''}` : 'Discovery marked complete' };
      }
      if (audit) return { state: 'active', detail: `Discovery in progress — ${answered} answer${answered === 1 ? '' : 's'} so far` };
      return { state: 'next', detail: 'Discovery call not logged yet' };
    })(),

    brand_site: (() => {
      const bucket = kindsBucket(deliverables, ['website', 'brand'], brief ? 'Build not started' : 'Nothing started here yet');
      if (brief) {
        const stamp = brief.design_locked_at
          ? `design approved ${shortDate(brief.design_locked_at)}`
          : brief.spec_approved_at
            ? `spec approved ${shortDate(brief.spec_approved_at)}`
            : `brief started ${shortDate(brief.created_at)}`;
        if (bucket.state === 'next') return { state: 'active', detail: `${brief.business || 'Brand'} — ${stamp}` };
        return { state: bucket.state, detail: `${bucket.detail} · ${stamp}` };
      }
      return bucket;
    })(),

    systems: kindsBucket(deliverables, ['payments', 'gbp'], 'Not started — nothing built here yet'),

    marketing: (() => {
      const bucket = kindsBucket(deliverables, ['social', 'content'], 'Not started');
      const published = reports.filter((r) => r.published);
      if (published.length) {
        const first = published[0].period_label;
        return { state: bucket.state === 'next' ? 'active' : bucket.state, detail: `${bucket.state === 'next' ? 'Reporting live' : bucket.detail} · first report ${first}` };
      }
      return bucket;
    })(),

    teach_back: (() => {
      const done = assignments.filter((a) => a.completed_at).length;
      const total = assignments.length;
      if (settings?.handoff_mode) {
        if (total > 0 && done === total) return { state: 'done', detail: `You're running it — all ${total} guides done` };
        return { state: 'active', detail: `Handoff started ${shortDate(settings.handoff_started_at)} — ${done} of ${total} guides done` };
      }
      if (total > 0) return { state: 'next', detail: `${total} guide${total === 1 ? '' : 's'} assigned — handoff not started` };
      return { state: 'next', detail: 'Guides get assigned as each piece goes live' };
    })(),
  };

  const overrides = settings?.spine_overrides ?? {};
  const stations: SpineStation[] = SPINE_STATIONS.map((s) => {
    const o = overrides[s.key];
    return { key: s.key, label: s.label, state: o ?? raw[s.key].state, detail: raw[s.key].detail, overridden: !!o };
  });

  // Exactly one thing should read as "happening now". If the data left
  // nothing active, the first not-done station after the last done one
  // is what's next up, so it becomes active; anything after it is 'next'.
  if (!stations.some((s) => s.state === 'active')) {
    const lastDone = stations.map((s) => s.state).lastIndexOf('done');
    const firstOpen = stations.findIndex((s, i) => i > lastDone && s.state !== 'done');
    if (firstOpen >= 0) stations[firstOpen].state = 'active';
  }
  return stations;
}

/** For lists: which station is the client "at" right now. */
export function currentStation(stations: SpineStation[]): SpineStation | null {
  return stations.find((s) => s.state === 'active') ?? stations.filter((s) => s.state === 'done').pop() ?? null;
}
