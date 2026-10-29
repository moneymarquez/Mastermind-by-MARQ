// Fresh start (spec Part 1): which rows a fresh start archives, and how each
// one is stamped and restored. Pure description here; worker/handlers/archive.ts
// runs it. Nothing is ever deleted: archiving sets archived_at + archive_batch
// (and parks pending approvals / unsent drafts in status 'archived' so every
// existing "pending" or "drafted" query drops them untouched); restoring
// clears both and puts the status back.

export type ArchiveTable = 'leads' | 'lead_findings' | 'lead_outreach' | 'ecom_products' | 'ai_approvals' | 'complaint_clusters';

export interface ArchiveRule {
  table: ArchiveTable;
  label: string;
  /** PostgREST filter for the rows a fresh start takes (before user scoping). */
  active: string;
  /** Extra fields set on archive, and what restore puts back. */
  onArchive?: Record<string, unknown>;
  onRestore?: Record<string, unknown>;
  /** leads has no user_id: it is the owner's own lead database. */
  userScoped: boolean;
  /** Column shown in the Archive list, and searched. */
  nameCol: string;
  subCols: string;
}

export const ARCHIVE_RULES: ArchiveRule[] = [
  { table: 'leads', label: 'Leads', active: 'archived_at=is.null', userScoped: false, nameCol: 'business_name', subCols: 'city,state,industry,phone,place_id' },
  { table: 'lead_findings', label: 'Website findings', active: 'archived_at=is.null&kind=neq.checked', userScoped: true, nameCol: 'summary', subCols: 'kind,place_id' },
  { table: 'lead_outreach', label: 'Email drafts', active: 'archived_at=is.null&status=eq.drafted', onArchive: { status: 'archived' }, onRestore: { status: 'drafted' }, userScoped: true, nameCol: 'business_name', subCols: 'subject' },
  // Products already linked to a brand stay: they are mid-build.
  { table: 'ecom_products', label: 'Products', active: 'archived_at=is.null', userScoped: true, nameCol: 'name', subCols: 'channel,sell_price,score' },
  // Pending approvals, except the ones driving a brand you are building.
  { table: 'ai_approvals', label: 'Pending approvals', active: 'archived_at=is.null&status=eq.pending&or=(entity_type.is.null,entity_type.not.in.(brand,invoice))', onArchive: { status: 'archived' }, onRestore: { status: 'pending' }, userScoped: true, nameCol: 'title', subCols: 'type,domain' },
  { table: 'complaint_clusters', label: 'Complaint clusters', active: 'archived_at=is.null', userScoped: true, nameCol: 'title', subCols: 'industry' },
];

export const ruleFor = (t: string) => ARCHIVE_RULES.find((r) => r.table === t) ?? null;

/** "2026-11-fresh-start", or "-2", "-3"… when that month already has one. Pure. */
export function batchId(now: Date, taken: string[]): string {
  const base = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-fresh-start`;
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}-${i}`)) return `${base}-${i}`;
}

/** Filter for a rule's rows, scoped to the owner where the table has user_id. Pure. */
export const scoped = (r: ArchiveRule, userId: string, filter: string) => (r.userScoped ? `user_id=eq.${userId}&${filter}` : filter);

/** The patch that archives a row, and the one that restores it. Pure. */
export const archivePatch = (r: ArchiveRule, batch: string, at: string) => ({ archived_at: at, archive_batch: batch, ...(r.onArchive ?? {}) });
export const restorePatch = (r: ArchiveRule) => ({ archived_at: null, archive_batch: null, ...(r.onRestore ?? {}) });

/** Product ids that must not be archived (linked to a brand). PostgREST "not in" clause, or '' for none. Pure. */
export const notIn = (ids: string[]) => (ids.length ? `&id=not.in.(${ids.join(',')})` : '');
