import { useState } from 'react';
import { useLeadflowIndustryPool, useLeadflowLeads } from '../../../data/useLeadflow';
import type { LeadflowLead } from '../../../data/useLeadflow';
import { GREEN as G, US_STATES } from './shared';
import NotConnectedBanner from './NotConnectedBanner';

const MINDSET = [
  "Every no gets you closer to a yes. Your job today is to collect nos as fast as possible.",
  "You're not interrupting them — you're finding the ones who need you. Most just don't know it yet.",
  "Confidence isn't feeling ready. It's deciding to go anyway. Dial.",
  "The rep who makes the most calls wins. It's math, not magic.",
  "You have a solution to a real problem. Act like it.",
  "One conversation can change a business forever. Be that conversation.",
  "Rejection is information. Every objection tells you exactly what to say next.",
];

const OPENERS: Record<string, string> = {
  restaurant: "Hey, is this [Business Name]? Hey perfect — I was actually trying to place an order through your website and couldn't find one. Do you guys have a site up right now?",
  salon: "Hi, is this [Business Name]? Hey I was trying to book an appointment online but couldn't find your booking page — do you have a website or is it all by phone?",
  barbershop: "Hey is this [Business Name]? I was trying to find your hours online but couldn't pull up a website — are you guys on Google yet?",
  gym: "Hey, is this [Business Name]? I was looking up membership info online but couldn't find a site — do you have one up?",
  plumber: "Hi, is this [Business Name]? I was searching for a plumber in the area and found your number but no website — are you guys online anywhere?",
  electrician: "Hey is this [Business Name]? Found your number but couldn't find a website — are you taking new customers right now?",
  default: "Hey, is this [Business Name]? I was trying to find you online but couldn't pull up a website — do you have one up right now?",
};

const DRILLS = [
  { title: "Objection: 'I'm not interested'", response: "Totally fair — I'm not trying to sell you anything right now. I just noticed you didn't have a site and wanted to show you what other [industry] owners in your area are doing. Can I send you a quick link?" },
  { title: "Objection: 'We already have a website'", response: "Oh perfect! Can I ask — is it showing up when people search [industry] near [city]? A lot of sites exist but aren't actually pulling traffic. Takes 30 seconds to check." },
  { title: "Objection: 'We're too busy'", response: "That's actually exactly why I called — the businesses that are too busy for marketing are usually the ones losing customers to competitors who aren't. I'll keep it under 2 minutes." },
  { title: "Objection: 'Send me an email'", response: "I can do that — what's the best email? And just so I know what to send, is the main thing you're missing more walk-ins, more calls, or just showing up on Google?" },
  { title: "Objection: 'How much does it cost?'", response: "Depends on what you need — we've got options starting under $200/month. But before I quote anything, can I ask what's your biggest thing right now — website, Google listing, or getting more calls?" },
];

const NICHES = ['restaurant', 'salon', 'barbershop', 'gym', 'plumber', 'electrician', 'HVAC contractor', 'solar', 'real estate'];

export default function LeadFlowWarRoom() {
  const [configured, setConfigured] = useState(false);
  const [niche, setNiche] = useState('restaurant');
  const [states, setStates] = useState<string[]>([]);
  const [count, setCount] = useState(20);
  const [queue, setQueue] = useState<LeadflowLead[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, 'hot' | 'warm' | 'cold'>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { notConnected, reload } = useLeadflowIndustryPool(niche);
  const { updateLead } = useLeadflowLeads();

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const mindset = MINDSET[new Date().getDay() % MINDSET.length];
  const drill = DRILLS[new Date().getDay() % DRILLS.length];
  const opener = OPENERS[niche] || OPENERS.default;

  const buildQueue = async () => {
    const freshPool = await reload();
    let filtered = freshPool;
    if (states.length > 0) filtered = filtered.filter((l) => l.state && states.includes(l.state));
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    setQueue(shuffled.slice(0, count));
    setIndex(0);
    setResults({});
    setNotes({});
    setConfigured(true);
  };

  const toggleState = (s: string) => setStates((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const logResult = (id: number, result: 'hot' | 'warm' | 'cold') => {
    setResults((r) => ({ ...r, [id]: result }));
    updateLead(id, { tag: result === 'hot' ? 'Hot' : result === 'warm' ? 'Warm' : 'Not Ready' });
  };

  const current = queue[index];
  const done = index >= queue.length && queue.length > 0;

  if (!configured) {
    return (
      <div>
        {notConnected && <NotConnectedBanner />}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>⚔️ War Room</h1>
          <p style={{ color: '#6b7280' }}>{today} — Let's set up your day.</p>
        </div>

        <div style={{ background: '#111827', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ color: G, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>TODAY'S MINDSET</div>
          <p style={{ color: '#fff', fontSize: 16, lineHeight: 1.7, fontStyle: 'italic' }}>"{mindset}"</p>
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ color: G, fontWeight: 700, fontSize: 12, letterSpacing: 1, marginBottom: 8 }}>TODAY'S DRILL — {drill.title}</div>
          <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.7 }}>"{drill.response}"</p>
          <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>Practice this out loud 3 times before you dial.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: '1rem' }}>Configure Today's Lead Queue</div>

          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Niche / Industry</label>
          <select value={niche} onChange={(e) => setNiche(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: '1rem', fontSize: 14 }}>
            {NICHES.map((i) => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
          </select>

          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Number of Leads</label>
          <input type="number" min={5} max={100} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 5)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: '1rem', fontSize: 14, boxSizing: 'border-box' }} />

          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Target States (leave empty for all)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1rem' }}>
            {US_STATES.map((s) => (
              <button key={s} onClick={() => toggleState(s)} style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${states.includes(s) ? G : '#e5e7eb'}`, background: states.includes(s) ? G : '#fff', color: states.includes(s) ? '#fff' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: states.includes(s) ? 600 : 400 }}>
                {s}
              </button>
            ))}
          </div>

          <button onClick={buildQueue} style={{ width: '100%', background: G, color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            🚀 Build My Day ({count} leads)
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <div style={{ background: '#111827', borderRadius: 20, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: '1rem' }}>🏆</div>
          <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>Session Complete</h2>
          <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>You worked through {queue.length} leads today.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#ef444422', borderRadius: 12, padding: '1rem 1.5rem' }}>
              <div style={{ color: '#ef4444', fontWeight: 800, fontSize: 24 }}>{Object.values(results).filter((r) => r === 'hot').length}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Hot 🔥</div>
            </div>
            <div style={{ background: '#f59e0b22', borderRadius: 12, padding: '1rem 1.5rem' }}>
              <div style={{ color: '#f59e0b', fontWeight: 800, fontSize: 24 }}>{Object.values(results).filter((r) => r === 'warm').length}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Warm ⚡</div>
            </div>
            <div style={{ background: '#6b728022', borderRadius: 12, padding: '1rem 1.5rem' }}>
              <div style={{ color: '#6b7280', fontWeight: 800, fontSize: 24 }}>{Object.values(results).filter((r) => r === 'cold').length}</div>
              <div style={{ color: '#9ca3af', fontSize: 13 }}>Not Ready ❄️</div>
            </div>
          </div>
          <button onClick={() => setConfigured(false)} style={{ background: G, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Start New Session</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 4 }}>⚔️ War Room</h1>
          <p style={{ color: '#6b7280', fontSize: 13 }}>Lead {index + 1} of {queue.length} · {niche} · {states.length > 0 ? states.join(', ') : 'All states'}</p>
        </div>
        <button onClick={() => setConfigured(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>⚙️ Reconfigure</button>
      </div>

      <div style={{ background: '#f3f4f6', borderRadius: 99, height: 6, marginBottom: '1.5rem' }}>
        <div style={{ background: G, height: 6, borderRadius: 99, width: `${(index / queue.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', marginBottom: '1.5rem', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
        <strong style={{ color: G }}>Today's Opener:</strong> {opener}
      </div>

      {current && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: '2rem', marginBottom: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>{current.business_name}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {current.state && <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{current.state}</span>}
                {current.industry && <span style={{ background: '#f0fdf4', color: G, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{current.industry}</span>}
                {current.website_status && <span style={{ background: current.website_status === 'no_website' ? '#fef2f2' : '#f0fdf4', color: current.website_status === 'no_website' ? '#ef4444' : G, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{current.website_status === 'no_website' ? '🚫 No Website' : '✅ Has Website'}</span>}
              </div>
            </div>
            {current.phone && (
              <a href={`tel:${current.phone}`} style={{ background: G, color: '#fff', borderRadius: 12, padding: '12px 20px', fontWeight: 700, textDecoration: 'none', fontSize: 15, whiteSpace: 'nowrap' }}>📲 Call Now</a>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>PHONE</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{current.phone || '–'}</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>INDUSTRY</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{current.industry || '–'}</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>FULL BUSINESS NAME (LLC)</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{current.business_name || '–'}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Use on TruePeopleSearch →</div>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '1rem' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>WEBSITE STATUS</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{current.website_status || '–'}</div>
            </div>
          </div>

          <textarea
            placeholder="Call notes — what happened? Callback time? Decision maker name?"
            value={notes[current.id] || ''}
            onChange={(e) => setNotes((n) => ({ ...n, [current.id]: e.target.value }))}
            rows={3}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', resize: 'vertical', marginBottom: '1rem' }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
            {([['hot', '🔥 Hot', '#ef4444'], ['warm', '⚡ Warm', '#f59e0b'], ['cold', '❄️ Not Ready', '#6b7280']] as const).map(([val, label, color]) => (
              <button key={val} onClick={() => logResult(current.id, val)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `2px solid ${results[current.id] === val ? color : '#e5e7eb'}`, background: results[current.id] === val ? color + '18' : '#fff', color: results[current.id] === val ? color : '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', background: index === 0 ? '#f9fafb' : '#fff', cursor: index === 0 ? 'default' : 'pointer', fontWeight: 600, color: '#374151' }}>← Prev</button>
            <button onClick={() => setIndex(index + 1)} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: G, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {index < queue.length - 1 ? 'Next Lead →' : 'Finish Session ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
