import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDailyPlan } from '../../data/useDailyPlan';
import { useEvents } from '../../data/useEvents';
import { todayStr } from '../../data/date';
import { formatTimeLabel, timeToMinutes } from '../../data/time';
import type { DailyPlanBlock, DailyPlanBlockType, DailyPlanModule } from '../../data/types';

interface Props {
  isMobile: boolean;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

// 6:00 AM through 12:00 AM (midnight) — 18 hourly rows. The last row
// (23:00) covers up to midnight; there's no separate 24:00 row.
const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i);

const TYPE_COLOR: Record<DailyPlanBlockType, string> = {
  fixed: 'var(--text-secondary)', goal: '#5B8DEF', fitness: 'var(--success)',
  macros: 'var(--warning)', dialing: '#5cc0e0', ai_suggested: '#c47ad1',
};
const TYPE_LABEL: Record<DailyPlanBlockType, string> = {
  fixed: 'Fixed', goal: 'Goal', fitness: 'Fitness', macros: 'Macros', dialing: 'Dialing', ai_suggested: 'Nova suggested',
};
const MODULE_LABEL: Record<DailyPlanModule, string> = {
  dialing: 'Dialing', fitness: 'Fitness', 'work-shift': 'Work shift', 'client-work': 'Client work', goal: 'Goal', manual: 'Manual',
};
const MODULE_TO_TYPE: Record<DailyPlanModule, DailyPlanBlockType> = {
  dialing: 'dialing', fitness: 'fitness', 'work-shift': 'fixed', 'client-work': 'fixed', goal: 'goal', manual: 'fixed',
};

const inputStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '9px 12px',
  color: 'var(--text)', fontSize: 'var(--text-body)', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const labelStyle: CSSProperties = { fontSize: 'var(--text-small)', color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };

function eventTitle(e: { type: string; notes: string | null; details: Record<string, unknown> }): string {
  if (e.type === 'holiday') return e.notes || 'Shift';
  if (e.type === 'dialing') return `${(e.details.first_name as string) ?? ''} ${(e.details.last_name as string) ?? ''}`.trim() || 'Dialing appt';
  return (e.details.business_name as string) || (e.details.contact_name as string) || e.notes || 'Scheduled';
}

export default function DailyPlanScreen({ isMobile, homeHeadStyle, homeSubStyle }: Props) {
  const { plan, loading, removeBlock, addBlock, confirm, skip } = useDailyPlan();
  const { events, loading: eventsLoading } = useEvents();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDetail, setFormDetail] = useState('');
  const [formModule, setFormModule] = useState<DailyPlanModule>('manual');
  const [formDuration, setFormDuration] = useState(30);

  const today = todayStr();
  const todaysEvents = useMemo(() => events.filter((e) => e.event_date === today), [events, today]);

  // Keyed by hour (6-23). A plan block always wins its hour over a raw
  // Schedule event — Nova's generation already folds calendar events into
  // blocks, so once a plan exists for today, showing the raw event too
  // would just double-list the same thing. Only hours a plan block doesn't
  // already claim fall back to a live Schedule event, which covers days
  // with no plan yet (or an event added after generation ran).
  const byHour = useMemo(() => {
    const map = new Map<number, { block: DailyPlanBlock; index: number } | { event: (typeof todaysEvents)[number] }>();
    (plan?.blocks ?? []).forEach((block, index) => {
      const hour = Math.floor(timeToMinutes(block.time) / 60);
      if (!map.has(hour)) map.set(hour, { block, index });
    });
    for (const e of todaysEvents) {
      const hour = Math.floor(timeToMinutes(e.start_time) / 60);
      if (!map.has(hour)) map.set(hour, { event: e });
    }
    return map;
  }, [plan, todaysEvents]);

  const selected = selectedHour !== null ? byHour.get(selectedHour) : undefined;

  const openHour = (hour: number) => {
    setSelectedHour(hour);
    setAdding(false);
  };

  const startAdd = () => {
    setFormTitle('');
    setFormDetail('');
    setFormModule('manual');
    setFormDuration(30);
    setAdding(true);
  };

  const submitAdd = async () => {
    if (selectedHour === null || !formTitle.trim()) return;
    const block: DailyPlanBlock = {
      time: `${String(selectedHour).padStart(2, '0')}:00`,
      duration: formDuration,
      title: formTitle.trim(),
      detail: formDetail.trim(),
      type: MODULE_TO_TYPE[formModule],
      module: formModule,
      source: null,
    };
    await addBlock(block);
    setAdding(false);
  };

  const detailPane = () => {
    if (selectedHour === null) {
      return <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', padding: 24 }}>Pick an hour to see what's planned, or add something.</div>;
    }
    if (!selected) {
      if (adding) {
        return (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{formatTimeLabel(`${String(selectedHour).padStart(2, '0')}:00`)}</div>
            <div>
              <span style={labelStyle}>Title</span>
              <input style={inputStyle} value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="What's this block for?" autoFocus />
            </div>
            <div>
              <span style={labelStyle}>Description</span>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={formDetail} onChange={(e) => setFormDetail(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <span style={labelStyle}>Module</span>
                <select style={inputStyle} value={formModule} onChange={(e) => setFormModule(e.target.value as DailyPlanModule)}>
                  {(Object.keys(MODULE_LABEL) as DailyPlanModule[]).map((m) => (
                    <option key={m} value={m}>{MODULE_LABEL[m]}</option>
                  ))}
                </select>
              </div>
              <div style={{ width: 110 }}>
                <span style={labelStyle}>Minutes</span>
                <input type="number" min={5} step={5} style={inputStyle} value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value) || 0)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="ap-btn ap-btn-primary" onClick={submitAdd} disabled={!formTitle.trim()}>Add block</button>
              <button className="ap-btn ap-btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        );
      }
      return (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{formatTimeLabel(`${String(selectedHour).padStart(2, '0')}:00`)}</div>
          <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-tertiary)', marginTop: 6 }}>Nothing planned for this hour.</div>
          <button className="ap-btn ap-btn-primary" style={{ marginTop: 14 }} onClick={startAdd}>Add a block</button>
        </div>
      );
    }
    if ('event' in selected) {
      const e = selected.event;
      return (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{eventTitle(e)}</div>
          <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>{formatTimeLabel(e.start_time)} – {formatTimeLabel(e.end_time)}</div>
          <div style={{ marginTop: 10, fontSize: 9.5, fontWeight: 700, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 9px', display: 'inline-block' }}>
            From Schedule
          </div>
          {e.notes && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>{e.notes}</div>}
        </div>
      );
    }
    const { block, index } = selected;
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'var(--text-label)', fontWeight: 600, color: 'var(--text)' }}>{block.title}</div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: TYPE_COLOR[block.type], border: `1px solid ${TYPE_COLOR[block.type]}`, borderRadius: 'var(--radius-pill)', padding: '1px 8px' }}>
            {TYPE_LABEL[block.type]}
          </span>
        </div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
          {formatTimeLabel(block.time)} · {block.duration} min · {MODULE_LABEL[block.module]}
        </div>
        {block.detail && <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.5 }}>{block.detail}</div>}
        {plan?.status === 'draft' && (
          <div
            style={{ marginTop: 16, fontSize: 'var(--text-small)', color: 'var(--text-tertiary)', cursor: 'pointer' }}
            onClick={async () => { await removeBlock(index); setSelectedHour(null); }}
          >
            Remove block
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={homeHeadStyle}>Daily Plan</div>
          <div style={homeSubStyle}>Generated overnight from your goals, schedule, and shifts — confirm as-is or adjust first.</div>
        </div>
        {plan?.status === 'draft' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="ap-btn ap-btn-primary" onClick={confirm}>Confirm plan</button>
            <button className="ap-btn ap-btn-secondary" onClick={skip}>Skip today</button>
          </div>
        )}
        {plan?.status === 'confirmed' && <div style={{ fontSize: 'var(--text-small)', color: 'var(--success)' }}>Confirmed — this is your day.</div>}
        {plan?.status === 'skipped' && <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-tertiary)' }}>Skipped for today.</div>}
      </div>

      {(loading || eventsLoading) && <div style={{ marginTop: 24, fontSize: 'var(--text-body)', color: 'var(--text-tertiary)' }}>Loading…</div>}

      {!loading && !eventsLoading && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: isMobile ? undefined : '0 0 300px', width: isMobile ? '100%' : undefined, maxHeight: isMobile ? undefined : 640, overflowY: isMobile ? undefined : 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
            {HOURS.map((hour) => {
              const entry = byHour.get(hour);
              const isSelected = selectedHour === hour;
              const filled = !!entry;
              const title = entry ? ('event' in entry ? eventTitle(entry.event) : entry.block.title) : null;
              return (
                <div
                  key={hour}
                  onClick={() => openHour(hour)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', cursor: 'pointer',
                    borderBottom: '1px solid var(--surface-3)',
                    background: isSelected ? 'var(--surface-4)' : filled ? 'var(--surface-2)' : 'var(--surface)',
                    borderLeft: isSelected ? '3px solid var(--text)' : '3px solid transparent',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-tiny)', fontWeight: 700, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', width: 62, flexShrink: 0 }}>
                    {formatTimeLabel(`${String(hour).padStart(2, '0')}:00`)}
                  </span>
                  {title ? (
                    <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                  ) : (
                    <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-quaternary)' }}>—</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ flex: 1, width: isMobile ? '100%' : undefined, minHeight: isMobile ? undefined : 300, border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', background: 'var(--surface-2)' }}>
            {detailPane()}
          </div>
        </div>
      )}
    </div>
  );
}
