import { useEffect, useState } from 'react';
import type { DemoStep, SceneKey } from './script';
import { REEL_CARDS } from './script';
import { DEMO_DIGEST_TEXT } from './seed';

/** The few beats that aren't a real screen: the opening, the digest phone,
 *  the clip pair and grade stamps (their screens aren't built yet — shown
 *  as a labelled preview over the real one), the "what's next" reel and
 *  the end card. Everything else in the tour is the live app. */
export function DemoScene({ scene, step, factor, record, onReplay, onExit }: { scene: SceneKey; step: DemoStep; factor: number; record: boolean; onReplay: () => void; onExit: () => void }) {
  if (scene === 'intro') return <Intro factor={factor} tagline={step.body} />;
  if (scene === 'phone') return <Phone />;
  if (scene === 'clips') return <Clips />;
  if (scene === 'grades') return <Grades />;
  if (scene === 'reel') return <Reel factor={factor} />;
  return <End record={record} onReplay={onReplay} onExit={onExit} headline={step.headline} url={step.body} />;
}

function useTyped(text: string, cps: number, delay = 0) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0; let t: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => { t = setInterval(() => { i += 1; setN(i); if (i >= text.length && t) clearInterval(t); }, 1000 / cps); }, delay);
    return () => { clearTimeout(start); if (t) clearInterval(t); };
  }, [text, cps, delay]);
  return text.slice(0, n);
}

function Intro({ factor, tagline }: { factor: number; tagline: string }) {
  const typed = useTyped(tagline, 34 / factor, 1300 * factor);
  return (
    <div className="demo-full demo-intro" aria-label="Mastermind by MARQ">
      <svg viewBox="0 0 600 120" className="demo-logo" role="img" aria-label="Mastermind by MARQ">
        <text x="300" y="70" textAnchor="middle" className="demo-logo-text">Mastermind</text>
        <text x="300" y="108" textAnchor="middle" className="demo-logo-sub">BY MARQ</text>
      </svg>
      <div className="demo-tagline">{typed}<span className="demo-caret" /></div>
    </div>
  );
}

function Phone() {
  const lines = DEMO_DIGEST_TEXT.split('\n');
  return (
    <div className="demo-float demo-phone-wrap" aria-hidden="true">
      <div className="demo-phone">
        <div className="demo-phone-notch" />
        <div className="demo-phone-top"><span>Mastermind</span><span>5:30</span></div>
        <div className="demo-bubble">
          {lines.map((l, i) => <div key={i} style={{ animationDelay: `${300 + i * 140}ms` }} className="demo-line">{l}</div>)}
        </div>
        <div className="demo-reply" style={{ animationDelay: '1900ms' }}>36</div>
        <div className="demo-bubble demo-bubble-small" style={{ animationDelay: '2500ms' }}>Logged ✓ 36/35 — streak 24d</div>
      </div>
    </div>
  );
}

function Clips() {
  return (
    <div className="demo-float demo-clips" aria-hidden="true">
      <div className="demo-preview-tag">Studio preview</div>
      <div className="demo-clip-row">
        <figure><img src="/demo/clip-raw.svg" alt="" /><figcaption>Raw · 58s</figcaption></figure>
        <div className="demo-arrow">→</div>
        <figure><img src="/demo/clip-edited.svg" alt="" /><figcaption>Edited · 14s · captions</figcaption></figure>
      </div>
      <div className="demo-stamp" style={{ animationDelay: '900ms' }}>4/4</div>
      <div className="demo-clip-why">Hook held 71% — repeat this format.</div>
    </div>
  );
}

function Grades() {
  const rows = [{ name: 'Sandy food trucks', grade: 3, why: 'Weak: meeting → close. Add the case study.' }, { name: 'Operators, early calls', grade: 1, why: 'Weak: answer rate. Call before 10am.' }];
  return (
    <div className="demo-float demo-grades" aria-hidden="true">
      {rows.map((r, i) => (
        <div key={r.name} className="demo-grade-card" style={{ animationDelay: `${200 + i * 260}ms` }}>
          <div><div className="demo-grade-name">{r.name}</div><div className="demo-grade-why">{r.why}</div></div>
          <div className={`demo-stamp demo-stamp-sm g${r.grade}`} style={{ animationDelay: `${700 + i * 260}ms` }}>{r.grade}/4</div>
        </div>
      ))}
    </div>
  );
}

function Reel({ factor }: { factor: number }) {
  return (
    <div className="demo-full demo-reel">
      <div className="demo-reel-cards">
        {REEL_CARDS.map((c, i) => (
          <div key={c.line} className="demo-reel-card" style={{ animationDelay: `${(250 + i * 700) * factor}ms` }}>
            <span className="demo-reel-icon" aria-hidden="true">{c.icon}</span><span>{c.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function End({ record, onReplay, onExit, headline, url }: { record: boolean; onReplay: () => void; onExit: () => void; headline: string; url: string }) {
  return (
    <div className="demo-full demo-end">
      <div className="demo-end-title">{headline}</div>
      <a className="demo-end-url" href={`https://${url}`} target="_blank" rel="noopener noreferrer">{url}</a>
      <a className="demo-end-cta" href={`https://${url}/?waitlist=1`} target="_blank" rel="noopener noreferrer">Join the waitlist</a>
      {!record && (
        <div className="demo-end-actions">
          <button type="button" onClick={onReplay}>↺ Replay</button>
          <button type="button" onClick={onExit}>Exit demo</button>
        </div>
      )}
    </div>
  );
}
