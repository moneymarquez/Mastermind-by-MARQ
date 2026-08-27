export default function NotConnectedBanner() {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '1.5rem' }}>
      <strong style={{ color: '#b45309' }}>LeadFlow isn't connected yet</strong>
      <p style={{ fontSize: 'var(--text-body)', color: '#6b7280', margin: '2px 0 0' }}>
        Ask Marq to set the LEADFLOW_SUPABASE_SERVICE_ROLE_KEY secret on the Worker — once that's in, this screen goes live.
      </p>
    </div>
  );
}
