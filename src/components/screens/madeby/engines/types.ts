export interface EngineCard {
  engine: 'client_finder' | 'complaint_scanner'; label: string; enabled: boolean; phase: 'find' | 'act'; dailyTarget: number;
  dailyBudget: number; monthlyCeiling: number; spentToday: number; spentMonth: number; remainingToday: number; remainingMonth: number;
  paused: string | null; projectedMonthly: number; projection: string; foundToday: number; foundMonth: number; costPerLead: number | null;
  lastRunAt: string | null; lastSummary: string | null; config: Record<string, unknown>;
}
export interface Gap { kind: string; text: string; evidence: Record<string, unknown> }
export interface FindingGroup { lead: { id: string; place_id: string; business_name: string; phone: string | null; rating: number | null; review_count: number | null; website: string | null; category: string | null; city: string | null; owner_email: string | null }; score: number; gaps: Gap[] }
export interface Quote { text: string; url: string; date?: string | null }
export interface Cluster { id: string; industry: string | null; title: string; plain: string | null; repeat_count: number; rank_score: number; quotes: Quote[]; affected: string | null; existing_fixes: { name: string; price: string }[]; easy_way: string | null; smallest_test: string | null; tag: 'can_do_now' | 'new'; status: 'new' | 'saved' | 'dismissed' | 'acting'; plan: { text?: string } | null; found_on: string }
export interface EnginesState { cards: EngineCard[]; killed: boolean; findings: FindingGroup[]; clusters: Cluster[]; coverage: { industry: string; covered_on: string }[]; keys: { places: boolean; parallel: boolean; claude: boolean } }

export interface OutreachRow { id: string; lead_id: string | null; business_name: string; to_email: string | null; phone: string | null; finding_kind: string | null; finding_summary: string | null; subject: string | null; body: string | null; status: 'drafted' | 'approved' | 'sent' | 'replied' | 'call_list' | 'booked' | 'closed' | 'dnc'; is_test: boolean; sent_at: string | null; text_consent: boolean; next_checkin_at: string | null }
export interface ReplyRow { id: string; outreach_id: string | null; from_email: string | null; body: string; classification: string; confidence: number; action: string | null; action_state: 'pending' | 'done' | 'needs_read' | 'draft_ready'; draft_reply: string | null; referral: string | null; return_date: string | null; corrected_to: string | null; created_at: string }
export interface CallRow { id: string; business_name: string; phone: string | null; finding: string | null; script: string; text_consent: boolean }
export interface BookingRow { id: string; starts_at: string; name: string | null; business: string | null; phone: string | null; email: string | null; finding: string | null }
export interface DomainState { domain?: string | null; mailbox?: string | null; provider?: string | null; checks?: { spf?: { ok: boolean; detail: string }; dkim?: { ok: boolean; detail: string }; dmarc?: { ok: boolean; detail: string }; checked_at?: string }; warmup_start?: string | null; paused?: boolean; pause_reason?: string | null; sent_total?: number; bounced?: number; complaints?: number; warmup_day: number; daily_cap: number; sent_today: number; auto_pause: string | null; mailbox_connected: boolean; test_mode: boolean }
export interface BookingSettingsRow { windows: { dow: number; start: string; end: string }[]; days_off: string[]; slot_min: number; timezone: string; title: string; calendly_url: string | null; owner_email: string | null }
export interface OutreachState { emails: OutreachRow[]; replies: ReplyRow[]; calls: CallRow[]; bookings: BookingRow[]; settings: BookingSettingsRow; domain: DomainState }

export const money = (n: number, d = 2) => `$${n.toFixed(d)}`;
export const CLASS_LABEL: Record<string, string> = { interested: 'Interested', question: 'Question', not_now: 'Not now', not_interested: 'Not interested', stop: 'Stop / hostile', out_of_office: 'Out of office', wrong_person: 'Wrong person', unclear: 'Unclear' };
