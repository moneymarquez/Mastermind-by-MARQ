import type { CSSProperties, ReactNode } from 'react';
import type { DocType } from '../../data/documentSchemas';
import type { PackageTier } from '../../data/documentSchemas';
import type { BusinessProfile } from '../../data/useBusinessProfile';
import { moneyValue } from '../../data/invoiceAmount';

interface Props {
  docType: DocType;
  data: Record<string, unknown>;
  profile: BusinessProfile;
}

// Colors/typography per the source reference: white bg, near-black text,
// mid-gray labels, light-gray hairlines — deliberately NOT the app's dark
// theme, since these are printable client-facing documents, not app UI.
const INK = '#111111';
const LABEL_GRAY = '#8C8C8C';
const HAIRLINE = '#ECECEC';

const page: CSSProperties = { background: '#ffffff', color: INK, padding: '48px 56px', maxWidth: 820, margin: '0 auto' };
const brandRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 16, borderBottom: `2px solid ${INK}` };
const brandName: CSSProperties = { fontSize: 17, fontWeight: 700, color: INK };
const docTypeLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: INK, letterSpacing: '0.08em', textTransform: 'uppercase' };
const sectionLabel: CSSProperties = { fontSize: 11, fontWeight: 600, color: LABEL_GRAY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 };
const title: CSSProperties = { fontSize: 30, fontWeight: 700, color: INK, marginBottom: 22, lineHeight: 1.25 };
const bodyText: CSSProperties = { fontSize: 13.5, color: '#333333', lineHeight: 1.6, marginBottom: 22 };
const gridLabel: CSSProperties = { fontSize: 10.5, fontWeight: 600, color: LABEL_GRAY, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 };
const gridValue: CSSProperties = { fontSize: 14, color: INK, fontWeight: 600 };
const section: CSSProperties = { paddingTop: 24, paddingBottom: 24, borderTop: `1px solid ${HAIRLINE}` };
const footer: CSSProperties = { marginTop: 8, paddingTop: 14, borderTop: `1px solid ${INK}`, fontSize: 11, color: LABEL_GRAY };

const DOC_LABEL_TEXT: Record<DocType, string> = {
  client_agreement: 'Client Agreement', welcome: 'Welcome', invoice: 'Invoice', project_brief: 'Project Brief',
  delivery_guide: 'Delivery Guide', monthly_report: 'Monthly Report', thank_you: 'Thank You', feedback: 'Feedback', packages: 'Packages',
};

function s(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v : '';
}
function bracket(v: unknown, placeholder: string): string {
  const val = s(v);
  return val || `[${placeholder}]`;
}

function Header({ docType }: { docType: DocType }) {
  return (
    <div style={brandRow}>
      <div style={brandName}>Made by Marq</div>
      <div style={docTypeLabel}>{DOC_LABEL_TEXT[docType]}</div>
    </div>
  );
}

function Footer({ profile }: { profile: BusinessProfile }) {
  const parts = [
    'Made by Marq',
    bracket(profile.website, 'www.madebymarq.com'),
    bracket(profile.business_email, 'hello@madebymarq.com'),
    bracket(profile.business_phone, '(555) 123-4567'),
  ];
  return <div style={footer}>{parts.join(' · ')}</div>;
}

function Grid({ columns, children }: { columns: number; children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 20 }}>{children}</div>;
}
function LV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={gridLabel}>{label}</div>
      <div style={gridValue}>{value}</div>
    </div>
  );
}
function BlackLabelGrayValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: LABEL_GRAY }}>{value}</div>
    </div>
  );
}
function Blockquote({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderLeft: `2px solid ${INK}`, paddingLeft: 16, fontSize: 14, fontWeight: 600, color: INK, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

interface Row {
  [k: string]: string;
}
function DataTable({ columns, rows }: { columns: { key: string; label: string }[]; rows: Row[] }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 10, paddingBottom: 8, borderBottom: `1px solid ${INK}` }}>
        {columns.map((c) => <div key={c.key} style={{ fontSize: 10.5, fontWeight: 600, color: LABEL_GRAY, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.label}</div>)}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 10, padding: '10px 0', background: i % 2 === 1 ? '#FAFAFA' : 'transparent', fontSize: 13, color: INK }}>
          {columns.map((c) => <div key={c.key}>{s(row[c.key]) || <span style={{ color: '#C4C4C4' }}>—</span>}</div>)}
        </div>
      ))}
    </div>
  );
}

function rowsOf(data: Record<string, unknown>, key: string): Row[] {
  const val = data[key];
  return Array.isArray(val) ? (val as Row[]) : [];
}

const money = moneyValue;

export default function DocumentPreview({ docType, data, profile }: Props) {
  return (
    <div style={page}>
      <Header docType={docType} />
      <div style={{ paddingTop: 28 }}>
        {docType === 'client_agreement' && <ClientAgreement data={data} profile={profile} />}
        {docType === 'welcome' && <Welcome data={data} />}
        {docType === 'invoice' && <Invoice data={data} profile={profile} />}
        {docType === 'project_brief' && <ProjectBrief data={data} />}
        {docType === 'delivery_guide' && <DeliveryGuide data={data} />}
        {docType === 'monthly_report' && <MonthlyReport data={data} />}
        {docType === 'thank_you' && <ThankYou data={data} />}
        {docType === 'feedback' && <Feedback data={data} />}
        {docType === 'packages' && <Packages data={data} />}
      </div>
      <Footer profile={profile} />
    </div>
  );
}

function ClientAgreement({ data, profile }: { data: Record<string, unknown>; profile: BusinessProfile }) {
  return (
    <>
      <div style={sectionLabel}>Agreement · Ref. {bracket(data.project_ref, 'Project ref #')}</div>
      <div style={title}>Client Service Agreement</div>
      <Grid columns={2}>
        <div>
          <div style={gridLabel}>Service provider</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Made by Marq</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY, marginTop: 2 }}>{bracket(profile.business_address, 'Business address')}</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY }}>{bracket(profile.business_email, 'Business email')}</div>
        </div>
        <div>
          <div style={gridLabel}>Client</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{bracket(data.client_name, 'Client name')}</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY, marginTop: 2 }}>{bracket(data.client_company, 'Client company')}</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY }}>{bracket(data.client_email, 'Client email')}</div>
        </div>
      </Grid>
      <div style={section}>
        <div style={sectionLabel}>Deliverables</div>
        <DataTable
          columns={[{ key: 'type', label: 'Type' }, { key: 'platform', label: 'Platform' }, { key: 'qty', label: 'Qty' }, { key: 'format_specs', label: 'Format / specs' }, { key: 'revisions', label: '# rounds' }]}
          rows={rowsOf(data, 'deliverables')}
        />
      </div>
      <div style={section}>
        <div style={sectionLabel}>Scope changes</div>
        <div style={{ ...bodyText, marginBottom: 0 }}>Any revisions or additions beyond what is listed in the Deliverables table above will be quoted and billed separately, and require written approval before work begins.</div>
      </div>
      <Grid columns={2}>
        <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 8, fontSize: 11, color: LABEL_GRAY }}>Signature — Service Provider · Date [DD/MM/YYYY]</div>
        <div style={{ borderTop: `1px solid ${INK}`, paddingTop: 8, fontSize: 11, color: LABEL_GRAY }}>Signature — Client · Date [DD/MM/YYYY]</div>
      </Grid>
    </>
  );
}

function Welcome({ data }: { data: Record<string, unknown> }) {
  const steps = rowsOf(data, 'steps');
  return (
    <>
      <div style={sectionLabel}>Welcome</div>
      <div style={title}>Welcome aboard, {bracket(data.client_name, 'CLIENT NAME')}</div>
      <div style={bodyText}>This document is your quick orientation to working with Made by Marq — what to expect, the key dates to know, and what happens next.</div>
      <div style={section}>
        <div style={sectionLabel}>Project at a glance</div>
        <Grid columns={2}>
          <LV label="Project name" value={bracket(data.project_name, 'Project name')} />
          <LV label="Start date" value={bracket(data.start_date, 'DD Month YYYY')} />
          <LV label="Platforms" value={bracket(data.platforms, 'Platforms')} />
          <LV label="Final delivery date" value={bracket(data.final_delivery_date, 'DD Month YYYY')} />
        </Grid>
      </div>
      <div style={section}>
        <div style={sectionLabel}>What happens next</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: LABEL_GRAY, minWidth: 22 }}>{String(i + 1).padStart(2, '0')}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{s(step.title) || 'Untitled step'}</div>
                <div style={{ fontSize: 12.5, color: LABEL_GRAY, marginTop: 2 }}>{bracket(step.description, 'Brief one-line description')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Invoice({ data, profile }: { data: Record<string, unknown>; profile: BusinessProfile }) {
  const items = rowsOf(data, 'line_items');
  const subtotal = items.reduce((sum, r) => sum + money(r.qty) * money(r.rate), 0);
  const taxPct = money(data.tax_percent);
  const tax = subtotal * (taxPct / 100);
  const total = subtotal + tax;
  return (
    <>
      <div style={sectionLabel}>Invoice · Ref. {bracket(data.project_ref, 'Project ref #')}</div>
      <div style={title}>Invoice {bracket(data.invoice_number, 'INV-0001')}</div>
      <Grid columns={2}>
        <div>
          <div style={gridLabel}>From</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Made by Marq</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY, marginTop: 2 }}>{bracket(profile.business_address, 'Business address')}</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY }}>{bracket(profile.business_email, 'Business email')}</div>
        </div>
        <div>
          <div style={gridLabel}>Bill to</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{bracket(data.client_name, 'Client name')}</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY, marginTop: 2 }}>{bracket(data.client_company, 'Client company')}</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY }}>{bracket(data.client_email, 'Client email')}</div>
        </div>
      </Grid>
      <div style={{ marginTop: 22 }}>
        <Grid columns={3}>
          <LV label="Issue date" value={bracket(data.issue_date, 'DD Month YYYY')} />
          <LV label="Due date" value={bracket(data.due_date, 'DD Month YYYY')} />
          <LV label="Payment terms" value={bracket(data.payment_terms, 'Net 15')} />
        </Grid>
      </div>
      <div style={section}>
        <DataTable
          columns={[{ key: 'type', label: 'Type' }, { key: 'description', label: 'Description' }, { key: 'qty', label: 'Qty' }, { key: 'rate', label: 'Rate' }, { key: 'amount', label: 'Amount' }]}
          rows={items.map((r) => ({ ...r, amount: r.qty && r.rate ? `$${(money(r.qty) * money(r.rate)).toFixed(2)}` : '' }))}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginTop: 16 }}>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY }}>Subtotal &nbsp;&nbsp; ${subtotal.toFixed(2)}</div>
          <div style={{ fontSize: 12.5, color: LABEL_GRAY }}>Tax ({taxPct || 0}%) &nbsp;&nbsp; ${tax.toFixed(2)}</div>
          <div style={{ fontSize: 15, fontWeight: 700, borderTop: `1px solid ${INK}`, paddingTop: 6 }}>Total due &nbsp;&nbsp; ${total.toFixed(2)}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: LABEL_GRAY, lineHeight: 1.6 }}>
        Payment via {bracket(data.payment_method, 'bank transfer / Stripe link / PayPal')}. A late fee of {bracket(data.late_fee, 'flat fee / percentage')} will be added to invoices unpaid past the due date.
      </div>
    </>
  );
}

function ProjectBrief({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div style={sectionLabel}>Project brief · Ref. {bracket(data.project_ref, 'Project ref #')}</div>
      <div style={title}>{bracket(data.project_title, 'PROJECT TITLE')}</div>
      <Grid columns={3}>
        <LV label="Client" value={bracket(data.client_name, 'Client name')} />
        <LV label="Deliverable format" value={bracket(data.deliverable_format, 'Format')} />
        <LV label="Channel" value={bracket(data.channel, 'Channel')} />
      </Grid>
      <div style={{ marginTop: 20 }}>
        <Grid columns={3}>
          <LV label="Start date" value={bracket(data.start_date, 'DD Month YYYY')} />
          <LV label="Deadline" value={bracket(data.deadline, 'DD Month YYYY')} />
          <LV label="Project title" value={bracket(data.project_title, 'Project title')} />
        </Grid>
      </div>
      <div style={section}>
        <div style={sectionLabel}>Objective</div>
        <div style={{ ...bodyText, marginBottom: 0 }}>{bracket(data.objective, 'One to two sentences describing the project\'s goal and why it matters to the client\'s business')}</div>
      </div>
      <div style={section}>
        <div style={sectionLabel}>Target audience</div>
        <Grid columns={3}>
          <BlackLabelGrayValue label="Who They Are" value={bracket(data.audience_who, 'Audience description')} />
          <BlackLabelGrayValue label="Their Pain Point" value={bracket(data.audience_pain_point, 'Pain point')} />
          <BlackLabelGrayValue label="What They Care About" value={bracket(data.audience_values, 'What they value')} />
        </Grid>
      </div>
      <div style={section}>
        <div style={sectionLabel}>Key message</div>
        <Blockquote>"{bracket(data.key_message, 'The one-line message this project must communicate')}"</Blockquote>
      </div>
    </>
  );
}

function DeliveryGuide({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div style={sectionLabel}>Delivery</div>
      <div style={title}>Your Files Are Ready</div>
      <div style={bodyText}>Your deliverables have been delivered. Everything for {bracket(data.project_name, 'PROJECT NAME')} is ready for download below.</div>
      <div style={section}>
        <div style={sectionLabel}>Files</div>
        <DataTable
          columns={[{ key: 'file_name', label: 'File name' }, { key: 'format', label: 'Format' }, { key: 'scope_size', label: 'Scope / size' }, { key: 'platform', label: 'Platform' }, { key: 'notes', label: 'Notes' }]}
          rows={rowsOf(data, 'files')}
        />
      </div>
      <div style={section}>
        <div style={sectionLabel}>Access your files</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[
            ['Download Link', bracket(data.download_link, 'URL')],
            ['Password', bracket(data.password, 'PASSWORD')],
            ['Expires', bracket(data.expires, 'DD Month YYYY')],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${HAIRLINE}`, fontSize: 13 }}>
              <span style={{ color: LABEL_GRAY }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MonthlyReport({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div style={sectionLabel}>Monthly report</div>
      <div style={title}>{bracket(data.report_month, 'Month YYYY')} Performance Report</div>
      <Grid columns={3}>
        <LV label="Client" value={bracket(data.client_name, 'Client name')} />
        <LV label="Reporting period" value={bracket(data.reporting_period, 'DD-DD Month YYYY')} />
        <LV label="Prepared by" value={bracket(data.prepared_by, 'Preparer name')} />
      </Grid>
      <div style={section}>
        <div style={sectionLabel}>Executive summary</div>
        <div style={{ ...bodyText, marginBottom: 0 }}>{bracket(data.executive_summary, 'Two to three sentences summarizing performance, wins, and focus for next month')}</div>
      </div>
      <div style={section}>
        <Grid columns={3}>
          <LV label="Impressions" value={bracket(data.impressions, 'X')} />
          <LV label="Engagements" value={bracket(data.engagements, 'X')} />
          <LV label="New followers" value={bracket(data.new_followers, 'X')} />
        </Grid>
        <div style={{ marginTop: 20 }}>
          <Grid columns={3}>
            <LV label="Deliverables published" value={bracket(data.deliverables_published, 'X')} />
            <LV label="Engagement rate" value={`${bracket(data.engagement_rate, 'X')}%`} />
            <LV label="Top performer" value={bracket(data.top_performer, 'Post / deliverable name')} />
          </Grid>
        </div>
      </div>
      <div style={section}>
        <div style={sectionLabel}>Content published</div>
        <DataTable
          columns={[{ key: 'date', label: 'Date' }, { key: 'platform', label: 'Platform' }, { key: 'title', label: 'Title' }, { key: 'views', label: 'Views' }, { key: 'likes', label: 'Likes' }]}
          rows={rowsOf(data, 'content_published')}
        />
      </div>
    </>
  );
}

function ThankYou({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      <div style={sectionLabel}>Thank you</div>
      <div style={title}>Thank you, {bracket(data.client_name, 'CLIENT NAME')}</div>
      <div style={bodyText}>It's been a pleasure working alongside you on {bracket(data.project_name, 'PROJECT NAME')}. Thank you for trusting Made by Marq with it — here's a quick recap of what we delivered.</div>
      <div style={section}>
        <div style={sectionLabel}>Project recap</div>
        <Grid columns={2}>
          <LV label="Project name" value={bracket(data.project_name, 'Project name')} />
          <LV label="Start date" value={bracket(data.start_date, 'DD Month YYYY')} />
          <LV label="Deliverables completed" value={bracket(data.deliverables_completed, 'X of X')} />
          <LV label="Final delivery date" value={bracket(data.final_delivery_date, 'DD Month YYYY')} />
        </Grid>
      </div>
      <div style={section}>
        <div style={sectionLabel}>What's next</div>
        <Blockquote>
          {bracket(data.whats_next, "A short recommendation for the client's next step or ongoing engagement")}. Ready to keep going? {bracket(data.book_call_link, 'Book a call link')}.
        </Blockquote>
      </div>
    </>
  );
}

function Feedback({ data: _data }: { data: Record<string, unknown> }) {
  const categories = ['Communication', 'Quality of Work', 'Turnaround Time', 'Creativity', 'Overall Experience'];
  return (
    <>
      <div style={sectionLabel}>Feedback</div>
      <div style={title}>Your Feedback Matters</div>
      <div style={bodyText}>A couple of minutes on this would mean a lot — it helps us keep improving how we work with you and clients like you.</div>
      <div style={section}>
        <div style={sectionLabel}>Rate your experience</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(5, 32px)', gap: 8, paddingBottom: 8, borderBottom: `1px solid ${INK}`, alignItems: 'center' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: LABEL_GRAY, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Category</div>
          {[1, 2, 3, 4, 5].map((n) => <div key={n} style={{ fontSize: 11, color: LABEL_GRAY, textAlign: 'center' }}>{n}</div>)}
        </div>
        {categories.map((cat, i) => (
          <div key={cat} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(5, 32px)', gap: 8, alignItems: 'center', padding: '10px 0', background: i % 2 === 1 ? '#FAFAFA' : 'transparent' }}>
            <div style={{ fontSize: 13 }}>{cat}</div>
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${LABEL_GRAY}` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 20 }}>What did you enjoy most about working with us?</div>
        <div style={{ borderBottom: `1px solid ${INK}`, height: 24 }} />
        <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 28, marginBottom: 20 }}>What could we improve?</div>
        <div style={{ borderBottom: `1px solid ${INK}`, height: 24 }} />
      </div>
    </>
  );
}

function Packages({ data }: { data: Record<string, unknown> }) {
  const tiers = (Array.isArray(data.tiers) ? data.tiers : []) as PackageTier[];
  return (
    <>
      <div style={sectionLabel}>Packages</div>
      <div style={title}>Made by Marq Packages</div>
      <div style={bodyText}>{bracket(data.intro, "We help brands create content that grows their audience and their revenue. Choose the package that fits where you are right now.")}</div>
      <div style={{ ...section, display: 'grid', gridTemplateColumns: `repeat(${tiers.length || 3}, 1fr)`, gap: 28 }}>
        {tiers.map((tier, i) => (
          <div key={i}>
            {s(tier.badge) ? <div style={{ fontSize: 10.5, fontWeight: 700, color: LABEL_GRAY, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{tier.badge}</div> : <div style={{ height: 17 }} />}
            <div style={{ fontSize: 11, fontWeight: 700, color: INK, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{s(tier.tier_label) || 'Tier'}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>
              ${bracket(tier.price, 'PRICE')}<span style={{ fontSize: 13, fontWeight: 400, color: LABEL_GRAY }}>/mo</span>
            </div>
            <div style={{ fontSize: 12, color: LABEL_GRAY, marginTop: 8, marginBottom: 16, lineHeight: 1.5 }}>{bracket(tier.description, 'One-line description of who this is for')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(tier.features ?? []).map((f, fi) => <div key={fi} style={{ fontSize: 12.5, color: '#333333' }}>{s(f) || <span style={{ color: '#C4C4C4' }}>[Feature]</span>}</div>)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
