import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useLeadflowLeads } from '../../../data/useLeadflow';
import { card, GREEN, TAG_COLORS } from './shared';
import NotConnectedBanner from './NotConnectedBanner';

function StatCard({ icon, bg, num, label }: { icon: string; bg: string; num: number; label: string }) {
  return (
    <div style={{ ...card, padding: '1.5rem', flex: 1 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: '1rem' }}>{icon}</div>
      <div style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-1px', marginBottom: 4 }}>{num}</div>
      <div style={{ color: '#9ca3af', fontSize: 14, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function LeadFlowDashboard({ onOpenFinder }: { onOpenFinder: () => void }) {
  const { leads, counts, notConnected } = useLeadflowLeads();

  const industryData = useMemo(() => {
    const byInd: Record<string, number> = {};
    for (const l of leads) {
      if (l.industry) byInd[l.industry] = (byInd[l.industry] || 0) + 1;
    }
    return Object.entries(byInd).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [leads]);

  const tempData = [
    { name: 'Hot', value: counts.hot },
    { name: 'Warm', value: counts.warm },
    { name: 'Not Ready', value: counts.cold },
  ].filter((d) => d.value > 0);

  const recentLeads = leads.slice(0, 5);

  return (
    <div>
      {notConnected && <NotConnectedBanner />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>Good morning, Cristopher</h1>
          <p style={{ color: '#9ca3af', fontSize: 15 }}>Here's where your pipeline stands today.</p>
        </div>
        <button onClick={onOpenFinder} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>View Lead Finder ↗</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <StatCard icon="👥" bg="#f0fdf4" num={counts.total} label="Total Leads" />
        <StatCard icon="🔥" bg="#fff1f1" num={counts.hot} label="Hot Leads" />
        <StatCard icon="⚡" bg="#fffbeb" num={counts.warm} label="Warm Leads" />
        <StatCard icon="❄️" bg="#eff6ff" num={counts.cold} label="Cold Leads" />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: 2, minWidth: 300, padding: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Leads by industry</div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: '1.5rem' }}>Where your pipeline is concentrated</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={industryData}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="value" fill={GREEN} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...card, flex: 1, minWidth: 260, padding: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Pipeline temperature</div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: '1rem' }}>How leads are tagged</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={tempData} dataKey="value" innerRadius={55} outerRadius={85}>
                {tempData.map((entry) => <Cell key={entry.name} fill={TAG_COLORS[entry.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            {tempData.map((d) => (
              <span key={d.name} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, color: '#6b7280' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: TAG_COLORS[d.name], display: 'inline-block' }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: '1.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Recent activity</div>
        <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: '1.25rem' }}>Your latest lead touches</div>
        {recentLeads.map((l, i) => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < recentLeads.length - 1 ? '1px solid #f9fafb' : 'none' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{l.business_name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{l.industry}</div>
            </div>
            {l.tag && <span style={{ fontSize: 12, background: TAG_COLORS[l.tag] + '18', color: TAG_COLORS[l.tag], borderRadius: 20, padding: '4px 12px', fontWeight: 600 }}>{l.tag}</span>}
          </div>
        ))}
        {recentLeads.length === 0 && !notConnected && <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1.5rem' }}>No leads yet.</p>}
      </div>
    </div>
  );
}
