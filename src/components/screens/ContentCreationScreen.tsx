import type { CSSProperties } from 'react';
import { useClients } from '../../data/useClients';
import ClientSelector from '../ClientSelector';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  selectedClientId: string | null;
  onSelectClient: (id: string | null) => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 24 };

// Placeholder shell for Item 1 of the build order — the real per-platform
// social profile build (Section 6 of the rebuild spec) lands in a later
// item. This just proves the client selector works here and gives an
// honest empty state instead of a blank or fake-populated screen.
export default function ContentCreationScreen({ homeHeadStyle, homeSubStyle, selectedClientId, onSelectClient }: Props) {
  const { clients, loading, error, createClient } = useClients();
  const selected = clients.find((c) => c.id === selectedClientId) ?? null;

  return (
    <div>
      <div style={homeHeadStyle}>Content Creation</div>
      <div style={homeSubStyle}>Per-client social profile build and launch kits, congruent with the Marketing campaign driving them.</div>

      <div style={{ marginTop: 20 }}>
        <ClientSelector
          clients={clients}
          loading={loading}
          error={error}
          selectedId={selectedClientId}
          onSelect={onSelectClient}
          onCreate={createClient}
          emptyHint="Pick a client to start building their social profile."
        />
      </div>

      <div style={{ ...cardStyle, maxWidth: 560 }}>
        {selected ? (
          <>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Nothing built for {selected.business_name} yet
            </div>
            <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              The per-platform social profile build and launch kits land here next, tied to the campaign driving them in Marketing.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>
            Select a client above to start their content build.
          </div>
        )}
      </div>
    </div>
  );
}
