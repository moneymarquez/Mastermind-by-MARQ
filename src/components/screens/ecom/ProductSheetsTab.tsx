import { TeachingEmpty } from './ecomShared';

/** Phase 2 lands here: channel selector, ranked cards, drawer, filters,
 *  CSV import, snapshots. Phase 1 ships the shell with the empty state. */
export default function ProductSheetsTab(_props: { search: string; onBuildBrand: (input: { name: string; owner_type: 'mine' | 'client'; client_id: string | null; positioning: string | null }) => Promise<void> }) {
  return <TeachingEmpty what="Product Sheets — top 20–30 products per channel, ranked, with a full drawer per product." worker="Product Scout (or a CSV import from any tool)" phase={2} />;
}
