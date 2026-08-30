import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Asset {
  id: string;
  kind: 'content' | 'proof';
  file_name: string;
  mime_type: string | null;
  status: string;
  caption: string | null;
  url: string | null;
}
interface Campaign {
  id: string;
  name: string;
  description: string | null;
  launched_on: string | null;
  result_notes: string | null;
}
interface Note {
  id: string;
  body: string;
  created_at: string;
}
interface Report {
  id: string;
  period_start: string;
  period_label: string;
  reach: number | null;
  engagement_count: number | null;
  engagement_summary: string | null;
  followers_start: number | null;
  followers_end: number | null;
  gbp_views: number | null;
  gbp_calls: number | null;
  gbp_directions: number | null;
  whats_included: string | null;
  roi_snapshot: string | null;
  upcoming_plan: string | null;
  client_report_assets: Asset[];
  client_report_campaigns: Campaign[];
  client_report_notes: Note[];
}
interface Invoice {
  description: string;
  amount: number;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  stripe_invoice_url: string | null;
}
interface PlanItem {
  label: string;
  amount: number;
  cadence: 'one_time' | 'monthly';
  repeat_count: number;
}
interface DashboardData {
  businessName: string;
  contactName: string | null;
  revealFullSchedule: boolean;
  reports: Report[];
  invoices: Invoice[];
  upcoming: PlanItem[];
}

const page: CSSProperties = {
  height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
  background: 'var(--bg)', color: 'var(--text)', padding: '40px 20px 80px',
  fontFamily: 'var(--font-sans)',
};
const wrap: CSSProperties = { width: '100%', maxWidth: 820, margin: '0 auto' };
const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 22 };
const sectionHead: CSSProperties = { fontSize: 17, fontWeight: 700, marginBottom: 14 };
const muted: CSSProperties = { fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)' };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 130px', background: 'var(--surface-4)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
      <div style={{ fontSize: 'var(--text-stat)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Blank metrics render as an em dash, never 0 — "not tracked" and "zero"
 *  are different claims to make to a paying client. */
const n = (v: number | null) => (v === null ? '—' : v.toLocaleString());

export default function PublicClientDashboard({ token }: { token: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [periodIdx, setPeriodIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/client-crm/public-dashboard?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.status === 404) { setState('notfound'); return; }
        if (!res.ok) { setState('error'); return; }
        setData(await res.json());
        setState('ok');
      })
      .catch(() => setState('error'));
  }, [token]);

  if (state === 'loading') return <div style={page}><div style={wrap}><div style={muted}>Loading…</div></div></div>;
  if (state === 'notfound') {
    return (
      <div style={page}><div style={wrap}>
        <div style={{ fontSize: 'var(--text-stat)', fontWeight: 700 }}>Dashboard not found</div>
        <div style={{ ...muted, marginTop: 10 }}>This link may have been changed. Reach out and we'll send you a fresh one.</div>
      </div></div>
    );
  }
  if (state === 'error' || !data) {
    return (
      <div style={page}><div style={wrap}>
        <div style={{ fontSize: 'var(--text-stat)', fontWeight: 700 }}>Something went wrong</div>
        <div style={{ ...muted, marginTop: 10 }}>Try refreshing in a moment.</div>
      </div></div>
    );
  }

  const report = data.reports[periodIdx] ?? null;
  const paid = data.invoices.filter((i) => i.status === 'paid');
  const outstanding = data.invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');

  // Follower history across every published period, oldest first — the
  // "auto-charts the delta" part of the report structure.
  const followerSeries = [...data.reports]
    .filter((r) => r.followers_end !== null)
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map((r) => ({ period: r.period_label.replace(/ \d{4}$/, ''), followers: r.followers_end as number }));

  const contentAssets = report?.client_report_assets.filter((a) => a.kind === 'content') ?? [];
  const proofAssets = report?.client_report_assets.filter((a) => a.kind === 'proof') ?? [];

  return (
    <div style={page}>
      <div style={wrap}>
        <div style={{ fontSize: 'var(--text-small)', letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>Made by Marq</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{data.businessName}</div>
        <div style={{ ...muted, marginTop: 6 }}>Your marketing progress and what's been delivered.</div>

        {data.reports.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            {data.reports.map((r, i) => (
              <div
                key={r.id}
                onClick={() => setPeriodIdx(i)}
                style={{
                  padding: '7px 15px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--text-body-sm)', fontWeight: 600,
                  border: `1px solid ${i === periodIdx ? 'var(--text)' : 'var(--border)'}`,
                  color: i === periodIdx ? 'var(--text)' : 'var(--text-tertiary)',
                }}
              >
                {r.period_label}
              </div>
            ))}
          </div>
        )}

        {!report ? (
          <div style={{ ...card, marginTop: 24 }}>
            <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 600 }}>Your first report is on the way</div>
            <div style={{ ...muted, marginTop: 8 }}>Once this month's numbers are in, they'll show up here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
            <div style={card}>
              <div style={sectionHead}>{report.period_label} — Performance</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Stat label="Reach / impressions" value={n(report.reach)} />
                <Stat label="Engagements" value={n(report.engagement_count)} />
                <Stat
                  label="Follower growth"
                  value={
                    report.followers_start !== null && report.followers_end !== null
                      ? `${report.followers_end - report.followers_start >= 0 ? '+' : ''}${(report.followers_end - report.followers_start).toLocaleString()}`
                      : '—'
                  }
                />
              </div>
              {report.engagement_summary && <div style={{ ...muted, marginTop: 14, lineHeight: 1.6 }}>{report.engagement_summary}</div>}

              {(report.gbp_views !== null || report.gbp_calls !== null || report.gbp_directions !== null) && (
                <>
                  <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '20px 0 10px' }}>
                    Google Business Profile
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Stat label="Profile views" value={n(report.gbp_views)} />
                    <Stat label="Calls" value={n(report.gbp_calls)} />
                    <Stat label="Direction requests" value={n(report.gbp_directions)} />
                  </div>
                </>
              )}
            </div>

            {followerSeries.length > 1 && (
              <div style={card}>
                <div style={sectionHead}>Audience growth</div>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <LineChart data={followerSeries} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="period" tick={{ fontSize: 'var(--text-tiny)', fill: 'var(--text-tertiary)' }} stroke="var(--border-2)" />
                      <YAxis tick={{ fontSize: 'var(--text-tiny)', fill: 'var(--text-tertiary)' }} stroke="var(--border-2)" />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-small)' }} />
                      <Line type="monotone" dataKey="followers" stroke="var(--text)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {contentAssets.length > 0 && (
              <div style={card}>
                <div style={sectionHead}>What we made for you</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {contentAssets.map((a) => (
                    <div key={a.id}>
                      <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(a.mime_type ?? '').startsWith('image/') && a.url
                          ? <img src={a.url} alt={a.caption ?? a.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : a.url
                            ? <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', padding: 10, textAlign: 'center' }}>{a.file_name}</a>
                            : <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)' }}>{a.file_name}</span>}
                      </div>
                      {a.caption && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 6 }}>{a.caption}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {proofAssets.length > 0 && (
              <div style={card}>
                <div style={sectionHead}>Design proofs</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {proofAssets.map((a) => (
                    <div key={a.id}>
                      <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--surface-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(a.mime_type ?? '').startsWith('image/') && a.url
                          ? <img src={a.url} alt={a.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', padding: 10, textAlign: 'center' }}>{a.file_name}</span>}
                      </div>
                      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 6, textTransform: 'capitalize' }}>{a.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.client_report_campaigns.length > 0 && (
              <div style={card}>
                <div style={sectionHead}>Campaigns this period</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {report.client_report_campaigns.map((c) => (
                    <div key={c.id} style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--surface-4)' }}>
                      <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 600 }}>{c.name}</div>
                      {c.launched_on && <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 3 }}>Launched {c.launched_on}</div>}
                      {c.description && <div style={{ ...muted, marginTop: 7, lineHeight: 1.6 }}>{c.description}</div>}
                      {c.result_notes && <div style={{ ...muted, marginTop: 7, lineHeight: 1.6 }}><strong>Result:</strong> {c.result_notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(report.whats_included || report.roi_snapshot) && (
              <div style={card}>
                <div style={sectionHead}>What's included</div>
                {report.whats_included && <div style={{ ...muted, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{report.whats_included}</div>}
                {report.roi_snapshot && (
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--surface-4)' }}>
                    <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>Return snapshot</div>
                    <div style={{ fontSize: 'var(--text-label)', lineHeight: 1.6 }}>{report.roi_snapshot}</div>
                  </div>
                )}
              </div>
            )}

            <div style={card}>
              <div style={sectionHead}>Billing</div>
              {paid.length === 0 && outstanding.length === 0 && <div style={muted}>No invoices yet.</div>}
              {[...outstanding, ...paid].map((inv, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: '1px solid var(--surface-3)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-body)' }}>{inv.description}</div>
                    <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {inv.status === 'paid'
                        ? `Paid${inv.paid_at ? ` ${new Date(inv.paid_at).toLocaleDateString()}` : ''}`
                        : inv.due_date ? `Due ${inv.due_date}` : 'Outstanding'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--text-body)', fontWeight: 600 }}>${inv.amount.toLocaleString()}</div>
                    {inv.status !== 'paid' && inv.stripe_invoice_url && (
                      <a href={inv.stripe_invoice_url} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--text-small)', fontWeight: 600, color: 'var(--text)', border: '1px solid var(--text)', borderRadius: 'var(--radius-pill)', padding: '5px 13px', textDecoration: 'none' }}>Pay</a>
                    )}
                  </div>
                </div>
              ))}

              {/* Forward-looking schedule only when this client's
                  reveal-full-schedule setting is on; TBD months are never
                  included, server-side. */}
              {data.revealFullSchedule && data.upcoming.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>Your full plan</div>
                  {data.upcoming.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', fontSize: 'var(--text-body-sm)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        ${p.amount.toLocaleString()}{p.cadence === 'monthly' ? `/mo × ${p.repeat_count}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(report.client_report_notes.length > 0 || report.upcoming_plan) && (
              <div style={card}>
                <div style={sectionHead}>Updates &amp; what's next</div>
                {report.client_report_notes.map((note) => (
                  <div key={note.id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--surface-3)' }}>
                    <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)' }}>{new Date(note.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize: 'var(--text-body)', marginTop: 5, whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{note.body}</div>
                  </div>
                ))}
                {report.upcoming_plan && (
                  <div>
                    <div style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>Coming up</div>
                    <div style={{ fontSize: 'var(--text-body)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{report.upcoming_plan}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 36, fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
          Made by Marq · Questions? Just reply to your last email.
        </div>
      </div>
    </div>
  );
}
