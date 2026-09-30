import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DispatchMember } from './model';
import { initials, localDate, memberColor, PRIORITY_LABEL, PRIORITY_WORD } from './model';

// Small shared pieces for the Dispatch screens: icons, avatar, priority
// pill, the assignee / date / priority pickers, and transcript highlighting.

export function WalkieIcon({ size = 20 }: { size?: number }) {
  // Walkie-talkie with a sound-wave arc (spec 15 §1).
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2.5v4.5" />
      <rect x="6" y="7" width="9" height="14.5" rx="2.2" />
      <path d="M8.6 11h3.8M8.6 13.6h3.8" />
      <circle cx="10.5" cy="17.6" r="1.1" />
      <path d="M17.6 8.2a4.6 4.6 0 0 1 0 6.1M19.8 6.2a7.6 7.6 0 0 1 0 10.1" />
    </svg>
  );
}
export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11.5" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  );
}
export function StopIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2.2" fill="currentColor" /></svg>; }
export function CheckMark({ size = 44 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
}
export function Grip() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="4" r="1.2" /><circle cx="10.5" cy="4" r="1.2" /><circle cx="5.5" cy="8" r="1.2" /><circle cx="10.5" cy="8" r="1.2" /><circle cx="5.5" cy="12" r="1.2" /><circle cx="10.5" cy="12" r="1.2" /></svg>; }
export function PeopleIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.7-3.4 3.2-5.3 6.2-5.3s5.5 1.9 6.2 5.3" /><path d="M15.5 4.8a3.3 3.3 0 0 1 0 6.4M17.6 14.9c2 .6 3.3 2.3 3.7 5.1" /></svg>; }
export function GearIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-.9-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z" /></svg>; }
export function BackIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>; }

export function Avatar({ member, name, lg }: { member: DispatchMember | null; name: string; lg?: boolean }) {
  return <span className={`dp-avatar${lg ? ' lg' : ''}`} style={{ background: memberColor(member), color: member ? '#fff' : 'var(--mm-bg)' }} aria-hidden="true">{member ? initials(name) : 'Me'}</span>;
}

/** Priority as label + colour. Long-press shows why (spec 15 §2.2). */
export function PriorityPill({ p, reason, overdue, onTap }: { p: number; reason?: string | null; overdue?: boolean; onTap?: () => void }) {
  const [show, setShow] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = useRef(false);
  const label = `${PRIORITY_LABEL[p] ?? `P${p}`}${overdue ? ' !' : ''}`;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className={`dp-pill p${p}`} style={{ cursor: onTap || reason ? 'pointer' : 'default' }}
        aria-label={`Priority ${p}, ${PRIORITY_WORD[p] ?? ''}${overdue ? ', overdue' : ''}${reason ? `. ${reason}` : ''}`}
        onPointerDown={() => { long.current = false; if (reason) t.current = setTimeout(() => { long.current = true; setShow(true); }, 450); }}
        onPointerUp={() => { if (t.current) clearTimeout(t.current); }}
        onPointerLeave={() => { if (t.current) clearTimeout(t.current); setShow(false); }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (long.current) { long.current = false; return; } onTap?.(); }}>
        {label.replace(' !', '')}{overdue && <span className="dp-overdue" aria-hidden="true">!</span>}
      </button>
      {show && reason && <span role="tooltip" style={{ position: 'absolute', top: 28, left: 0, zIndex: 5, width: 200, padding: '8px 10px', borderRadius: 10, background: 'var(--mm-ink)', color: 'var(--mm-bg)', fontSize: 12.5, lineHeight: 1.35 }}>{reason}</span>}
    </span>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="dp-pop" onClick={onClose}>
      <div ref={ref} className="dp-pop-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dp-pop-title">{title}</div>
        {children}
      </div>
    </div>
  );
}

export function AssigneePicker({ members, value, onPick, onClose, allowAdd, onAdd }: { members: DispatchMember[]; value: string | null; onPick: (m: DispatchMember | null) => void; onClose: () => void; allowAdd?: boolean; onAdd?: (name: string) => Promise<DispatchMember | null> }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  return (
    <Sheet title="Who's doing this?" onClose={onClose}>
      <div role="radiogroup" aria-label="Assignee">
        <button type="button" role="radio" aria-checked={value === null} className="dp-pick" onClick={() => onPick(null)}><Avatar member={null} name="You" lg /> Me</button>
        {members.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={value === m.id} className="dp-pick" onClick={() => onPick(m)}>
            <Avatar member={m} name={m.name} lg /> {m.name}{m.role === 'manager' && <span className="dp-tag">Manager</span>}
          </button>
        ))}
      </div>
      {allowAdd && onAdd && (adding ? (
        <form style={{ display: 'flex', gap: 8, marginTop: 10 }} onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; const m = await onAdd(name); if (m) onPick(m); }}>
          <input className="dp-field" autoFocus placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New person's name" />
          <button type="submit" className="dp-btn primary">Add</button>
        </form>
      ) : <button type="button" className="dp-btn" style={{ marginTop: 10, width: '100%', minHeight: 46, justifyContent: 'center' }} onClick={() => setAdding(true)}>+ Someone new</button>)}
    </Sheet>
  );
}

function addDays(n: number): string { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); }
function endOfWeek(): string { const d = new Date(); const add = (5 - d.getDay() + 7) % 7; d.setDate(d.getDate() + add); return localDate(d); }

export function DatePicker({ value, onPick, onClose }: { value: string | null; onPick: (iso: string | null) => void; onClose: () => void }) {
  const [custom, setCustom] = useState(value ?? '');
  return (
    <Sheet title="When's it due?" onClose={onClose}>
      <div className="dp-quick">
        <button type="button" className="dp-btn" onClick={() => onPick(addDays(0))}>Today</button>
        <button type="button" className="dp-btn" onClick={() => onPick(addDays(1))}>Tomorrow</button>
        <button type="button" className="dp-btn" onClick={() => onPick(endOfWeek())}>This week</button>
        <button type="button" className="dp-btn" onClick={() => onPick(null)}>No date</button>
      </div>
      <label style={{ display: 'block', marginTop: 12, fontSize: 13, color: 'var(--mm-dim)' }}>Pick a date
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input className="dp-field" type="date" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button type="button" className="dp-btn primary" disabled={!custom} onClick={() => onPick(custom || null)}>Set</button>
        </div>
      </label>
    </Sheet>
  );
}

export function PriorityPicker({ value, onPick, onClose }: { value: number; onPick: (p: number) => void; onClose: () => void }) {
  return (
    <Sheet title="Priority" onClose={onClose}>
      <div role="radiogroup" aria-label="Priority">
        {[1, 2, 3, 4, 5].map((p) => (
          <button key={p} type="button" role="radio" aria-checked={value === p} className="dp-pick" onClick={() => onPick(p)}>
            <span className={`dp-pill p${p}`}>{PRIORITY_LABEL[p]}</span> {PRIORITY_WORD[p]}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// ── transcript highlighting (spec 15 §2.1) ────────────────────────────
const DATE_RE = /\b(?:by\s+)?(?:today|tonight|tomorrow|this (?:week|weekend|morning|afternoon)|next (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|end of (?:the )?(?:day|week|month)|eod|(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2}(?:st|nd|rd|th)?)\b/gi;

export interface Piece { text: string; kind: 'word' | 'name' | 'date' }
export function highlight(text: string, names: string[]): Piece[] {
  if (!text) return [];
  const firsts = [...new Set(names.flatMap((n) => [n, n.split(/\s+/)[0]]).filter((n) => n.length > 1))].sort((a, b) => b.length - a.length);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nameRe = firsts.length ? new RegExp(`\\b(?:${firsts.map(esc).join('|')})\\b`, 'gi') : null;
  const marks: { start: number; end: number; kind: 'name' | 'date' }[] = [];
  if (nameRe) for (const m of text.matchAll(nameRe)) marks.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: 'name' });
  for (const m of text.matchAll(DATE_RE)) {
    const s = m.index ?? 0; const e = s + m[0].length;
    if (!marks.some((k) => s < k.end && e > k.start)) marks.push({ start: s, end: e, kind: 'date' });
  }
  marks.sort((a, b) => a.start - b.start);
  const out: Piece[] = []; let i = 0;
  for (const m of marks) { if (m.start > i) out.push({ text: text.slice(i, m.start), kind: 'word' }); out.push({ text: text.slice(m.start, m.end), kind: m.kind }); i = m.end; }
  if (i < text.length) out.push({ text: text.slice(i), kind: 'word' });
  return out;
}

export function Highlighted({ text, names, className }: { text: string; names: string[]; className?: string }) {
  return <span className={className}>{highlight(text, names).map((p, i) => p.kind === 'name' ? <span key={i} className="dp-name">{p.text}</span> : p.kind === 'date' ? <span key={i} className="dp-when">{p.text}</span> : <span key={i}>{p.text}</span>)}</span>;
}

export function timeLabel(iso: string): string {
  const d = new Date(iso); const today = localDate();
  const day = localDate(d);
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', ' ');
  if (day === today) return t;
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (day === localDate(y)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function haptic(ms = 12) { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } }
export function prefersReducedMotion(): boolean { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }
