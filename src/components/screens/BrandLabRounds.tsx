import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { BrandLabBrief, BrandLabRound, FunctionalSpec, Niche } from '../../data/types';
import { ROUND_CRITERIA } from '../../data/types';
import { scoreRound, scoreDelta } from '../../data/brandLabScoring';
import { fileToJpegDataUrl } from '../../lib/image';
import { AiError } from '../../lib/ai';
import PromptBox from '../PromptBox';

interface Props {
  brief: BrandLabBrief;
  spec: FunctionalSpec;
  niche: Niche | null;
  rounds: BrandLabRound[];
  onAdd: (input: { pasted_html: string | null; screenshot_data: string | null; notes: string | null }) => Promise<BrandLabRound | null>;
  onUpdate: (id: string, patch: Partial<Omit<BrandLabRound, 'id' | 'brief_id' | 'created_at'>>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  /** Approve a round: lock the design onto the brief. */
  onLock: (round: BrandLabRound) => Promise<void>;
  onUnlock: () => Promise<void>;
}

const card: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 16 };
const textarea: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '10px 12px', color: 'var(--text)', fontSize: 16, lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
};
const primaryBtn: CSSProperties = {
  padding: '11px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-body)',
  fontWeight: 600, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center',
};
const ghostBtn: CSSProperties = {
  padding: '8px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
};
const h: CSSProperties = { fontSize: 'var(--text-caption)', letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, margin: '12px 0 6px' };

function scoreColor(n: number): string {
  if (n >= 4) return 'var(--success)';
  if (n === 3) return 'var(--warning)';
  return 'var(--danger)';
}

function ScoreCell({ score, delta }: { score: number | null; delta: number | null }) {
  if (score === null) return <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-tertiary)' }}>—</td>;
  return (
    <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 700, color: scoreColor(score) }}>{score}</span>
      {delta !== null && delta !== 0 && (
        <span style={{ fontSize: 'var(--text-tiny)', marginLeft: 4, color: delta > 0 ? 'var(--success)' : 'var(--danger)' }}>
          {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
        </span>
      )}
    </td>
  );
}

/** Round-over-round movement: criteria down the side, rounds across, so
 *  drift is visible as a column that got worse, not a paragraph. */
function MovementGrid({ rounds }: { rounds: BrandLabRound[] }) {
  const scored = rounds.filter((r) => r.score);
  if (scored.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 8 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 'var(--text-body-sm)', minWidth: 280 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Criterion</th>
            {scored.map((r) => (
              <th key={r.id} style={{ padding: '6px 8px', color: r.approved_at ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                R{r.round_number}{r.approved_at ? ' ✓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROUND_CRITERIA.map((c) => (
            <tr key={c.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '6px 8px', color: 'var(--text)', whiteSpace: 'nowrap' }}>{c.label}</td>
              {scored.map((r, i) => (
                <ScoreCell
                  key={r.id}
                  score={r.score?.criteria.find((x) => x.key === c.key)?.score ?? null}
                  delta={scoreDelta(r.score, i > 0 ? scored[i - 1].score : null, c.key)}
                />
              ))}
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--border-2)' }}>
            <td style={{ padding: '6px 8px', color: 'var(--text)', fontWeight: 700 }}>Overall</td>
            {scored.map((r, i) => {
              const prev = i > 0 ? scored[i - 1].score?.overall ?? null : null;
              const cur = r.score?.overall ?? null;
              const d = cur !== null && prev !== null ? Math.round((cur - prev) * 10) / 10 : null;
              return (
                <td key={r.id} style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 700, color: cur !== null ? scoreColor(Math.round(cur)) : 'var(--text-tertiary)' }}>{cur ?? '—'}</span>
                  {d !== null && d !== 0 && <span style={{ fontSize: 'var(--text-tiny)', marginLeft: 4, color: d > 0 ? 'var(--success)' : 'var(--danger)' }}>{d > 0 ? `▲${d}` : `▼${Math.abs(d)}`}</span>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ ...h, color }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', lineHeight: 1.5 }}>{it}</li>)}
      </ul>
    </div>
  );
}

export default function BrandLabRounds({ brief, spec, niche, rounds, onAdd, onUpdate, onRemove, onLock, onUnlock }: Props) {
  const [html, setHtml] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busyId, setBusyId] = useState<string | 'new' | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const locked = !!brief.design_locked_at;
  const lockedRound = rounds.find((r) => r.id === brief.design_locked_round_id) ?? null;
  const latest = rounds.length ? rounds[rounds.length - 1] : null;
  const expandedId = openId ?? latest?.id ?? null;

  const score = async (round: BrandLabRound) => {
    setBusyId(round.id);
    setError('');
    try {
      const previous = [...rounds].filter((r) => r.round_number < round.round_number && r.score).pop() ?? null;
      const result = await scoreRound(brief, spec, niche, round, previous);
      await onUpdate(round.id, { score: result });
      setOpenId(round.id);
    } catch (err) {
      setError(err instanceof AiError || err instanceof Error ? err.message : 'Scoring failed — try again.');
    } finally {
      setBusyId(null);
    }
  };

  const addAndScore = async () => {
    if (!html.trim() && !shot) {
      setError('Paste the HTML export or add a screenshot first.');
      return;
    }
    setBusyId('new');
    setError('');
    try {
      const round = await onAdd({ pasted_html: html.trim() || null, screenshot_data: shot, notes: notes.trim() || null });
      setHtml('');
      setShot(null);
      setNotes('');
      if (round) await score(round);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the round.');
      setBusyId(null);
    }
  };

  const pickShot = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      setShot(await fileToJpegDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
      <div>
        <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Rounds</div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.5 }}>
          Run the Design prompt, paste what came back, Nova scores it against the spec on the same eight criteria every time and writes the next revision prompt. Approve a round to lock the design into Fable's slot 6.
        </div>
      </div>

      {locked && (
        <div style={{ ...card, border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)', background: 'color-mix(in srgb, var(--success) 8%, transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--success)' }}>Design locked{lockedRound ? ` — round ${lockedRound.round_number}` : ''}</div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>
              {brief.design_locked_at ? `Approved ${new Date(brief.design_locked_at).toLocaleString()}. ` : ''}
              {lockedRound?.pasted_html ? 'Its HTML is in the Fable prompt above.' : 'Screenshot-only round — paste the HTML into Fable\'s slot 6 yourself.'}
            </div>
          </div>
          <span style={ghostBtn} onClick={onUnlock}>Unlock</span>
        </div>
      )}

      <MovementGrid rounds={rounds} />

      {error && <div style={{ fontSize: 'var(--text-small)', color: 'var(--danger)' }}>{error}</div>}

      {rounds.map((r) => {
        const open = expandedId === r.id;
        const busy = busyId === r.id;
        return (
          <div key={r.id} style={{ ...card, borderColor: r.approved_at ? 'color-mix(in srgb, var(--success) 45%, transparent)' : 'var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpenId(open ? '' : r.id)}>
              <div>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>
                  Round {r.round_number}
                  {r.score && <span style={{ marginLeft: 8, color: scoreColor(Math.round(r.score.overall)) }}>{r.score.overall}/5</span>}
                  {r.approved_at && <span style={{ marginLeft: 8, fontSize: 'var(--text-tiny)', color: 'var(--success)', fontWeight: 700 }}>APPROVED</span>}
                </div>
                <div style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {new Date(r.created_at).toLocaleString()} · {r.pasted_html ? `${r.pasted_html.length.toLocaleString()} chars HTML` : 'no HTML'}{r.screenshot_data ? ' · screenshot' : ''}
                </div>
              </div>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>{open ? '▴' : '▾'}</span>
            </div>

            {open && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {r.screenshot_data && (
                  <img src={r.screenshot_data} alt={`Round ${r.round_number} screenshot`} style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', objectPosition: 'left top', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                )}
                {r.notes && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Notes: {r.notes}</div>}

                {r.score ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {r.score.criteria.map((c) => (
                        <div key={c.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ width: 22, textAlign: 'center', fontWeight: 700, color: scoreColor(c.score), flexShrink: 0 }}>{c.score}</span>
                          <div style={{ fontSize: 'var(--text-body-sm)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{ROUND_CRITERIA.find((x) => x.key === c.key)?.label ?? c.key}</span>
                            <span style={{ color: 'var(--text-secondary)' }}> — {c.note}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <List title="Matches" items={r.score.matches} color="var(--success)" />
                    <List title="Drifted" items={r.score.drifted} color="var(--warning)" />
                    <List title="Missing" items={r.score.missing} color="var(--danger)" />
                    {!r.approved_at && !locked && (
                      <PromptBox title={`Revision prompt → round ${r.round_number + 1}`} hint="Paste into the same Claude Design session." text={r.score.revision_prompt} />
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>Not scored yet.</div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!locked && (
                    <span style={{ ...ghostBtn, opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }} onClick={() => score(r)}>
                      {busy ? 'Scoring…' : r.score ? 'Re-score' : 'Score this round'}
                    </span>
                  )}
                  {!locked && r.score && (
                    <span style={primaryBtn} onClick={() => onLock(r)}>Approve — lock this design</span>
                  )}
                  {!r.approved_at && (
                    <span style={{ ...ghostBtn, color: 'var(--text-tertiary)' }} onClick={() => onRemove(r.id)}>Delete</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!locked && (
        <div style={card}>
          <div style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)' }}>Round {(latest?.round_number ?? 0) + 1}</div>
          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>Paste the HTML export, add a screenshot, or both. Screenshot alone works from a phone.</div>
          <textarea
            style={{ ...textarea, minHeight: 120, marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 16 }}
            placeholder="Paste the Claude Design HTML export here…"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
          />
          <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickShot(e.target.files?.[0])} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <span style={ghostBtn} onClick={() => fileInput.current?.click()}>{shot ? 'Replace screenshot' : 'Add screenshot'}</span>
            {shot && <img src={shot} alt="Screenshot to score" style={{ height: 44, borderRadius: 6, border: '1px solid var(--border)' }} />}
            {shot && <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setShot(null)}>remove</span>}
          </div>
          <input
            style={{ ...textarea, minHeight: 0, marginTop: 10, resize: 'none' }}
            placeholder="Notes for Nova (optional) — e.g. “ignore the hero photo, it's a placeholder”"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div style={{ ...primaryBtn, marginTop: 12, opacity: busyId === 'new' ? 0.6 : 1, pointerEvents: busyId === 'new' ? 'none' : 'auto' }} onClick={addAndScore}>
            {busyId === 'new' ? 'Saving & scoring…' : 'Add round & score'}
          </div>
        </div>
      )}
    </div>
  );
}
