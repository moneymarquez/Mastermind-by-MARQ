// Field definitions for the 9 "Made by Marq" client document types,
// transcribed from the user's own reference file (screenshots of the
// actual designed system) — every [BRACKETED] placeholder in that
// reference becomes one field here. Drives DocumentEditForm.tsx (generic
// renderer) directly; DocumentPreview.tsx reads the same `data` keys but
// is hand-written per type since the visual layout (column groupings,
// tables, the Packages tier grid) is bespoke per document, not generic.
export type DocType =
  | 'client_agreement' | 'welcome' | 'invoice' | 'project_brief' | 'delivery_guide'
  | 'monthly_report' | 'thank_you' | 'feedback' | 'packages';

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  client_agreement: 'Client Agreement',
  welcome: 'Welcome',
  invoice: 'Invoice',
  project_brief: 'Project Brief',
  delivery_guide: 'Delivery Guide',
  monthly_report: 'Monthly Report',
  thank_you: 'Thank You',
  feedback: 'Feedback',
  packages: 'Packages',
};

export interface SimpleField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea';
  group?: string; // cosmetic section heading in the edit form
}

export interface TableColumn {
  key: string;
  label: string;
}

export interface TableFieldDef {
  key: string;
  label: string;
  columns: TableColumn[];
  defaultRow: Record<string, string>;
}

export interface DocumentSchema {
  fields: SimpleField[];
  tables: TableFieldDef[];
  /** Packages is the one type with a fixed nested tier structure instead of a flat table. */
  hasTiers?: boolean;
}

export const DOCUMENT_SCHEMAS: Record<DocType, DocumentSchema> = {
  client_agreement: {
    fields: [
      { key: 'project_ref', label: 'Project ref #', type: 'text', group: 'Agreement' },
      { key: 'client_name', label: 'Client name', type: 'text', group: 'Client' },
      { key: 'client_company', label: 'Client company', type: 'text', group: 'Client' },
      { key: 'client_email', label: 'Client email', type: 'text', group: 'Client' },
    ],
    tables: [
      {
        key: 'deliverables', label: 'Deliverables',
        columns: [
          { key: 'type', label: 'Type' }, { key: 'platform', label: 'Platform' }, { key: 'qty', label: 'Qty' },
          { key: 'format_specs', label: 'Format / specs' }, { key: 'revisions', label: '# rounds' },
        ],
        defaultRow: { type: '', platform: '', qty: '', format_specs: '', revisions: '' },
      },
    ],
  },
  welcome: {
    fields: [
      { key: 'client_name', label: 'Client name', type: 'text', group: 'Client' },
      { key: 'project_name', label: 'Project name', type: 'text', group: 'Project at a glance' },
      { key: 'start_date', label: 'Start date', type: 'date', group: 'Project at a glance' },
      { key: 'platforms', label: 'Platforms', type: 'text', group: 'Project at a glance' },
      { key: 'final_delivery_date', label: 'Final delivery date', type: 'date', group: 'Project at a glance' },
    ],
    tables: [
      {
        key: 'steps', label: "What happens next",
        columns: [{ key: 'title', label: 'Step' }, { key: 'description', label: 'Description' }],
        defaultRow: { title: '', description: '' },
      },
    ],
  },
  invoice: {
    fields: [
      { key: 'invoice_number', label: 'Invoice number', type: 'text', group: 'Invoice' },
      { key: 'project_ref', label: 'Project ref #', type: 'text', group: 'Invoice' },
      { key: 'client_name', label: 'Client name', type: 'text', group: 'Bill to' },
      { key: 'client_company', label: 'Client company', type: 'text', group: 'Bill to' },
      { key: 'client_email', label: 'Client email', type: 'text', group: 'Bill to' },
      { key: 'issue_date', label: 'Issue date', type: 'date', group: 'Terms' },
      { key: 'due_date', label: 'Due date', type: 'date', group: 'Terms' },
      { key: 'payment_terms', label: 'Payment terms', type: 'text', group: 'Terms' },
      { key: 'tax_percent', label: 'Tax %', type: 'text', group: 'Terms' },
      { key: 'payment_method', label: 'Payment via', type: 'text', group: 'Payment' },
      { key: 'late_fee', label: 'Late fee', type: 'text', group: 'Payment' },
    ],
    tables: [
      {
        key: 'line_items', label: 'Line items',
        columns: [
          { key: 'type', label: 'Type' }, { key: 'description', label: 'Description' },
          { key: 'qty', label: 'Qty' }, { key: 'rate', label: 'Rate' },
        ],
        defaultRow: { type: '', description: '', qty: '', rate: '' },
      },
    ],
  },
  project_brief: {
    fields: [
      { key: 'project_ref', label: 'Project ref #', type: 'text', group: 'Project brief' },
      { key: 'project_title', label: 'Project title', type: 'text', group: 'Project brief' },
      { key: 'client_name', label: 'Client', type: 'text', group: 'Details' },
      { key: 'deliverable_format', label: 'Deliverable format', type: 'text', group: 'Details' },
      { key: 'channel', label: 'Channel', type: 'text', group: 'Details' },
      { key: 'start_date', label: 'Start date', type: 'date', group: 'Details' },
      { key: 'deadline', label: 'Deadline', type: 'date', group: 'Details' },
      { key: 'objective', label: 'Objective', type: 'textarea', group: 'Objective' },
      { key: 'audience_who', label: 'Who they are', type: 'text', group: 'Target audience' },
      { key: 'audience_pain_point', label: 'Their pain point', type: 'text', group: 'Target audience' },
      { key: 'audience_values', label: 'What they care about', type: 'text', group: 'Target audience' },
      { key: 'key_message', label: 'Key message', type: 'textarea', group: 'Key message' },
    ],
    tables: [],
  },
  delivery_guide: {
    fields: [
      { key: 'project_name', label: 'Project name', type: 'text', group: 'Delivery' },
      { key: 'download_link', label: 'Download link', type: 'text', group: 'Access your files' },
      { key: 'password', label: 'Password', type: 'text', group: 'Access your files' },
      { key: 'expires', label: 'Expires', type: 'date', group: 'Access your files' },
    ],
    tables: [
      {
        key: 'files', label: 'Files',
        columns: [
          { key: 'file_name', label: 'File name' }, { key: 'format', label: 'Format' },
          { key: 'scope_size', label: 'Scope / size' }, { key: 'platform', label: 'Platform' }, { key: 'notes', label: 'Notes' },
        ],
        defaultRow: { file_name: '', format: '', scope_size: '', platform: '', notes: '' },
      },
    ],
  },
  monthly_report: {
    fields: [
      { key: 'report_month', label: 'Report month (e.g. August 2026)', type: 'text', group: 'Report' },
      { key: 'client_name', label: 'Client', type: 'text', group: 'Report' },
      { key: 'reporting_period', label: 'Reporting period', type: 'text', group: 'Report' },
      { key: 'prepared_by', label: 'Prepared by', type: 'text', group: 'Report' },
      { key: 'executive_summary', label: 'Executive summary', type: 'textarea', group: 'Executive summary' },
      { key: 'impressions', label: 'Impressions', type: 'text', group: 'Metrics' },
      { key: 'engagements', label: 'Engagements', type: 'text', group: 'Metrics' },
      { key: 'new_followers', label: 'New followers', type: 'text', group: 'Metrics' },
      { key: 'deliverables_published', label: 'Deliverables published', type: 'text', group: 'Metrics' },
      { key: 'engagement_rate', label: 'Engagement rate %', type: 'text', group: 'Metrics' },
      { key: 'top_performer', label: 'Top performer', type: 'text', group: 'Metrics' },
    ],
    tables: [
      {
        key: 'content_published', label: 'Content published',
        columns: [
          { key: 'date', label: 'Date' }, { key: 'platform', label: 'Platform' },
          { key: 'title', label: 'Title' }, { key: 'views', label: 'Views' }, { key: 'likes', label: 'Likes' },
        ],
        defaultRow: { date: '', platform: '', title: '', views: '', likes: '' },
      },
    ],
  },
  thank_you: {
    fields: [
      { key: 'client_name', label: 'Client name', type: 'text', group: 'Thank you' },
      { key: 'project_name', label: 'Project name', type: 'text', group: 'Project recap' },
      { key: 'start_date', label: 'Start date', type: 'date', group: 'Project recap' },
      { key: 'deliverables_completed', label: 'Deliverables completed (e.g. 8 of 8)', type: 'text', group: 'Project recap' },
      { key: 'final_delivery_date', label: 'Final delivery date', type: 'date', group: 'Project recap' },
      { key: 'whats_next', label: "What's next", type: 'textarea', group: "What's next" },
      { key: 'book_call_link', label: 'Book a call link', type: 'text', group: "What's next" },
    ],
    tables: [],
  },
  feedback: {
    fields: [],
    tables: [],
  },
  packages: {
    fields: [
      { key: 'intro', label: 'Intro paragraph', type: 'textarea', group: 'Packages' },
    ],
    tables: [],
    hasTiers: true,
  },
};

export interface PackageTier {
  badge: string;
  tier_label: string;
  price: string;
  description: string;
  features: string[];
}

export const DEFAULT_TIERS: PackageTier[] = [
  { badge: '', tier_label: 'Starter', price: '', description: '', features: ['', '', '', ''] },
  { badge: 'Most popular', tier_label: 'Growth', price: '', description: '', features: ['', '', '', '', '', ''] },
  { badge: '', tier_label: 'Premium', price: '', description: '', features: ['', '', '', '', '', ''] },
];

const WELCOME_DEFAULT_STEPS = [
  { title: 'Discovery Call', description: '' },
  { title: 'Project Brief', description: '' },
  { title: 'Production', description: '' },
  { title: 'First Deliverable', description: '' },
  { title: 'Final Delivery', description: '' },
];

export function defaultDataFor(docType: DocType): Record<string, unknown> {
  const schema = DOCUMENT_SCHEMAS[docType];
  const data: Record<string, unknown> = {};
  for (const f of schema.fields) data[f.key] = '';
  for (const t of schema.tables) {
    data[t.key] = docType === 'welcome' ? WELCOME_DEFAULT_STEPS : [{ ...t.defaultRow }, { ...t.defaultRow }];
  }
  if (schema.hasTiers) data.tiers = DEFAULT_TIERS.map((t) => ({ ...t, features: [...t.features] }));
  return data;
}
