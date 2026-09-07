import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { ContentCheckin, ContentGrowthPlan, GrowthPhase } from '../../data/useContentGrowth';

interface Props {
  plan: ContentGrowthPlan;
  checkins: ContentCheckin[];
  clientName: string;
  onUpdate: (patch: Partial<Pick<ContentGrowthPlan, 'account_handle' | 'target_followers' | 'niche_viewer' | 'pillars' | 'phase' | 'notes'>>) => void;
  onDelete: () => void;
  onClose: () => void;
  onAddCheckin: (input: { follower_count: number; posts_count?: number | null; what_worked?: string | null; what_to_change?: string | null }) => void;
  onRemoveCheckin: (id: string) => void;
  onAskNova: () => void;
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 20 };
const inputStyle: CSSProperties = {
  width: '100%', background: 'var(--surface-4)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-sm)',
  padding: '9px 12px', color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginBottom: 5, lineHeight: 1.4 };
const fieldWrap: CSSProperties = { marginBottom: 14 };
const ghostBtn: CSSProperties = {
  padding: '7px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
  fontSize: 'var(--text-small)', cursor: 'pointer',
};
const primaryBtn: CSSProperties = {
  padding: '9px 18px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)',
  fontSize: 'var(--text-body-sm)', fontWeight: 600, cursor: 'pointer',
};
const subhead: CSSProperties = { fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text)', marginTop: 24, marginBottom: 4 };

const PLATFORM_LABEL: Record<ContentGrowthPlan['platform'], string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube_shorts: 'YouTube Shorts', youtube_long: 'YouTube (long form)',
  linkedin: 'LinkedIn', facebook: 'Facebook', twitter: 'Twitter/X',
};

// Day ranges are Content 101's own First 90 Days shape — shown as a hint,
// not auto-applied, since real progress should move the phase, not the
// calendar (see the doc's own "what normal looks like: flat for 4-8 weeks"
// warning against judging by elapsed time alone).
const PHASES: { key: GrowthPhase; label: string; days: string }[] = [
  { key: 'setup', label: 'Setup', days: 'Days 1–7' },
  { key: 'volume', label: 'Volume', days: 'Days 8–30' },
  { key: 'pattern_finding', label: 'Pattern finding', days: 'Days 31–60' },
  { key: 'concentration', label: 'Concentration', days: 'Days 61–90' },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={fieldWrap}>
      <div style={labelStyle}>{label}{hint && <span style={{ color: 'var(--text-tertiary)' }}> — {hint}</span>}</div>
      {children}
    </div>
  );
}

function CheckinForm({ onAdd }: { onAdd: Props['onAddCheckin'] }) {
  const [followers, setFollowers] = useState('');
  const [posts, setPosts] = useState('');
  const [worked, setWorked] = useState('');
  const [change, setChange] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!followers.trim()) return;
    setSaving(true);
    await onAdd({
      follower_count: Number(followers),
      posts_count: posts.trim() ? Number(posts) : null,
      what_worked: worked.trim() || null,
      what_to_change: change.trim() || null,
    });
    setSaving(false);
    setFollowers('');
    setPosts('');
    setWorked('');
    setChange('');
  };

  return (
    <div style={{ ...cardStyle, marginBottom: 14 }}>
      <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Log this week's real numbers</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <Field label="Follower count">
            <input style={inputStyle} type="number" value={followers} onChange={(e) => setFollowers(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <Field label="Posts this week">
            <input style={inputStyle} type="number" value={posts} onChange={(e) => setPosts(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="What worked" hint="top posts, what they shared">
        <input style={inputStyle} value={worked} onChange={(e) => setWorked(e.target.value)} />
      </Field>
      <Field label="What to change" hint="where retention broke, what to cut">
        <input style={inputStyle} value={change} onChange={(e) => setChange(e.target.value)} />
      </Field>
      <div
        style={{ ...primaryBtn, opacity: saving || !followers.trim() ? 0.6 : 1, pointerEvents: saving || !followers.trim() ? 'none' : 'auto', display: 'inline-block' }}
        onClick={submit}
      >
        {saving ? 'Logging…' : 'Log check-in'}
      </div>
    </div>
  );
}

export default function ContentGrowthPlanView({ plan, checkins, clientName, onUpdate, onDelete, onClose, onAddCheckin, onRemoveCheckin, onAskNova }: Props) {
  const [handleDraft, setHandleDraft] = useState(plan.account_handle ?? '');
  const [targetDraft, setTargetDraft] = useState(plan.target_followers?.toString() ?? '');
  const [nicheDraft, setNicheDraft] = useState(plan.niche_viewer ?? '');
  const [pillarsDraft, setPillarsDraft] = useState(plan.pillars.join(', '));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const planCheckins = checkins.filter((c) => c.plan_id === plan.id);
  const current = planCheckins[0]?.follower_count ?? plan.starting_followers ?? 0;
  const growth = plan.starting_followers != null ? current - plan.starting_followers : null;
  const pct = plan.target_followers ? Math.min(100, Math.round((current / plan.target_followers) * 100)) : null;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--text-body-lg)', fontWeight: 700, color: 'var(--text)' }}>
            {clientName} — {PLATFORM_LABEL[plan.platform]}{plan.account_handle ? ` (${plan.account_handle})` : ''}
          </div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
            {current.toLocaleString()} followers
            {plan.target_followers ? ` of ${plan.target_followers.toLocaleString()} target${pct !== null ? ` (${pct}%)` : ''}` : ''}
            {growth !== null && growth !== 0 ? ` · ${growth > 0 ? '+' : ''}${growth.toLocaleString()} since start` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={ghostBtn} onClick={onClose}>Close</span>
          {confirmingDelete ? (
            <>
              <span style={{ ...ghostBtn, borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={onDelete}>Confirm delete</span>
              <span style={ghostBtn} onClick={() => setConfirmingDelete(false)}>Cancel</span>
            </>
          ) : (
            <span style={ghostBtn} onClick={() => setConfirmingDelete(true)}>Delete plan</span>
          )}
        </div>
      </div>

      <div style={{ ...primaryBtn, marginTop: 16, display: 'inline-block' }} onClick={onAskNova}>Ask Nova for next steps</div>

      <div style={subhead}>Phase</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {PHASES.map((p) => (
          <div
            key={p.key}
            onClick={() => onUpdate({ phase: p.key })}
            style={{
              padding: '8px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: `1px solid ${plan.phase === p.key ? 'var(--text)' : 'var(--border)'}`,
              background: plan.phase === p.key ? '#F5F6F71a' : 'transparent',
            }}
          >
            <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: plan.phase === p.key ? 'var(--text)' : 'var(--text-secondary)' }}>{p.label}</div>
            <div style={{ fontSize: 'var(--text-nano)', color: 'var(--text-tertiary)' }}>{p.days}</div>
          </div>
        ))}
      </div>

      <div style={subhead}>The niche</div>
      <Field label="Viewer, in one sentence" hint="the person, not the topic">
        <input
          style={inputStyle} value={nicheDraft}
          onChange={(e) => setNicheDraft(e.target.value)}
          onBlur={() => onUpdate({ niche_viewer: nicheDraft.trim() || null })}
        />
      </Field>
      <Field label="Pillars" hint="3-5, comma separated">
        <input
          style={inputStyle} value={pillarsDraft}
          onChange={(e) => setPillarsDraft(e.target.value)}
          onBlur={() => onUpdate({ pillars: pillarsDraft.split(',').map((p) => p.trim()).filter(Boolean) })}
        />
      </Field>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <Field label="Handle">
            <input
              style={inputStyle} value={handleDraft}
              onChange={(e) => setHandleDraft(e.target.value)}
              onBlur={() => onUpdate({ account_handle: handleDraft.trim() || null })}
            />
          </Field>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <Field label="Target followers">
            <input
              style={inputStyle} type="number" value={targetDraft}
              onChange={(e) => setTargetDraft(e.target.value)}
              onBlur={() => onUpdate({ target_followers: targetDraft.trim() ? Number(targetDraft) : null })}
            />
          </Field>
        </div>
      </div>

      <div style={subhead}>Weekly check-ins</div>
      <CheckinForm onAdd={onAddCheckin} />
      {planCheckins.length === 0 && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-tertiary)' }}>No check-ins logged yet.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {planCheckins.map((c, i) => {
          const prev = planCheckins[i + 1];
          const delta = prev ? c.follower_count - prev.follower_count : null;
          return (
            <div key={c.id} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 'var(--text-body-sm)', fontWeight: 600, color: 'var(--text)' }}>
                  {new Date(c.checkin_date).toLocaleDateString()} — {c.follower_count.toLocaleString()} followers
                  {delta !== null && <span style={{ color: delta >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}> ({delta >= 0 ? '+' : ''}{delta})</span>}
                  {c.posts_count != null && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> · {c.posts_count} posts</span>}
                </div>
                {c.what_worked && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 4 }}>Worked: {c.what_worked}</div>}
                {c.what_to_change && <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', marginTop: 2 }}>Change: {c.what_to_change}</div>}
              </div>
              <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }} onClick={() => onRemoveCheckin(c.id)}>Delete</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
