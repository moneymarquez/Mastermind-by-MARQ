import { Suspense, useState } from 'react';
import './dispatch.css';
import { DispatchProvider } from './DispatchContext';
import type { Team } from './model';
import DispatchScreen from './DispatchScreen';
import DispatchLayer from './DispatchLayer';
import { FromOwnerList } from './FromOwner';
import { WalkieIcon } from './bits';

// The slimmer app for someone who's on a team but doesn't have their own
// Mastermind subscription (spec 15 §2.4): what the lead sent them, the mic
// to talk their own tasks, and nothing else.
export default function MemberApp({ teams, userId, onSignOut, banner }: { teams: Team[]; userId: string; onSignOut: () => void; banner?: string | null }) {
  const [idx, setIdx] = useState(0);
  const team = teams[Math.min(idx, teams.length - 1)];
  const [showBanner, setShowBanner] = useState(!!banner);
  return (
    <DispatchProvider key={team.owner_id} userId={userId} ownerId={team.owner_id} leadName={team.owner_name} onOpen={() => {}}>
      <div style={{ minHeight: '100dvh', background: 'var(--mm-bg)', color: 'var(--mm-text)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(12px + env(safe-area-inset-top)) 16px 8px', maxWidth: 760, margin: '0 auto' }}>
          <span style={{ display: 'inline-flex' }}><WalkieIcon size={22} /></span>
          <div style={{ flex: 1, fontWeight: 700, letterSpacing: '-0.01em' }}>Mastermind</div>
          {teams.length > 1 && (
            <select className="dp-select" aria-label="Team" value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
              {teams.map((t, i) => <option key={t.owner_id} value={i}>{t.owner_name}'s team</option>)}
            </select>
          )}
          <button type="button" className="dp-iconbtn" onClick={onSignOut}>Sign out</button>
        </header>
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '0 16px calc(24px + env(safe-area-inset-bottom))' }}>
          {showBanner && banner && <button type="button" className="dp-card" style={{ width: '100%', textAlign: 'left', marginBottom: 14, cursor: 'pointer', fontSize: 14.5 }} onClick={() => setShowBanner(false)}>🎉 {banner} <span className="dp-sub">· dismiss</span></button>}
          <FromOwnerList />
          <DispatchScreen isMobile />
        </main>
        <Suspense fallback={null}><DispatchLayer /></Suspense>
      </div>
    </DispatchProvider>
  );
}
