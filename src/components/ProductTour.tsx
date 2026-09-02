import { useLayoutEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Screen } from '../types';
import { moduleKeyForRoute } from '../modules.config';
import Icon from '../Icon';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  screen?: Screen;
  target: 'content' | 'nova';
}

// The 10 stops called out in the product-tour spec. Steps gated by module
// access (canAccess) are filtered out per-account in Stage.tsx before this
// list is used, so a non-owner account (or one that never selected e.g.
// Fitness) simply skips those steps rather than showing a spotlight around
// a screen it can't actually open.
export const TOUR_STEPS: TourStep[] = [
  { id: 'overview', title: 'Overview', body: "This is home base — a live snapshot across everything you're tracking, updated in real time as the day moves.", screen: 'home', target: 'content' },
  { id: 'daily-plan', title: 'Daily Plan', body: 'Every morning this builds a real plan from your schedule, goals, and what actually needs attention — not a generic checklist.', screen: 'daily-plan', target: 'content' },
  { id: 'macros', title: 'Macros & Meals', body: 'Log meals by photo or barcode, track macros against real targets, and get flagged the moment a pattern shows up.', screen: 'macros', target: 'content' },
  { id: 'fitness', title: 'Fitness', body: 'A full workout library plus a custom plan generated from a short questionnaire, with live workout mode built in.', screen: 'fitness', target: 'content' },
  { id: 'budgeting', title: 'Budgeting', body: 'Real categories, subscriptions tracked automatically, and cash-flow forecasting instead of a static spreadsheet.', screen: 'budgeting', target: 'content' },
  { id: 'scaling-start', title: 'Scaling — Start', body: 'The guided entry point for a new client project — Idea Maker, Brand Lab, Website Builder, and Scaling Planner, chained together with a persistent trail.', screen: 'scaling-start', target: 'content' },
  { id: 'brand-lab', title: 'Brand Lab', body: 'Call transcript in, two ready-to-paste prompts out. Niche research, a functional spec you approve first, then the Claude Design and Claude Fable prompts with copy buttons.', screen: 'brand-lab', target: 'content' },
  { id: 'website', title: 'Website & App Builder', body: "Where a project's live build happens. Currently in active development — its roadmap is shown here.", screen: 'website', target: 'content' },
  { id: 'invoicing', title: 'Invoicing', body: 'A real nine-document client system — agreements, invoices, briefs, and more — generated and tracked in one place.', screen: 'invoicing', target: 'content' },
  { id: 'nova', title: 'Nova', body: "This is Nova — full read/write access across every module, and the thing that actually ties this whole system together.", target: 'nova' },
];

export function filterTourSteps(canAccess: (moduleKey: string) => boolean): TourStep[] {
  return TOUR_STEPS.filter((s) => {
    if (!s.screen) return true;
    const key = moduleKeyForRoute(s.screen);
    return !key || canAccess(key);
  });
}

interface Props {
  active: boolean;
  steps: TourStep[];
  stepIndex: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const SELECTOR_BY_TARGET: Record<TourStep['target'], string> = {
  content: '#tour-content-panel',
  nova: '[data-tour-target="nova-trigger"]',
};

export default function ProductTour({ active, steps, stepIndex, onNext, onBack, onSkip }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];

  useLayoutEffect(() => {
    if (!active || !step) return;
    setRect(null);
    let frame = 0;
    let tries = 0;
    const measure = () => {
      const el = document.querySelector(SELECTOR_BY_TARGET[step.target]);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else if (tries < 20) {
        tries += 1;
        frame = requestAnimationFrame(measure);
      }
    };
    frame = requestAnimationFrame(measure);
    const onResize = () => {
      const el = document.querySelector(SELECTOR_BY_TARGET[step.target]);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, [active, step, stepIndex]);

  if (!active || !step) return null;

  const pad = 8;
  const holeStyle: CSSProperties = rect
    ? {
        position: 'fixed',
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 'var(--radius-2xl)',
        boxShadow: '0 0 0 9999px rgba(6,7,9,0.8)',
        border: '1px solid #F5F6F755',
        pointerEvents: 'none',
        transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
        zIndex: 90,
      }
    : {
        position: 'fixed', inset: 0, background: 'rgba(6,7,9,0.8)', pointerEvents: 'none', zIndex: 90,
      };

  return (
    <>
      <div style={holeStyle} />
      <div
        style={{
          position: 'fixed', top: 'calc(88px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
          width: 340, maxWidth: 'calc(100vw - 32px)', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: '18px 20px', zIndex: 92, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {steps.map((s, i) => (
              <div key={s.id} style={{ width: 14, height: 3, borderRadius: 'var(--radius-pill)', background: i <= stepIndex ? 'var(--text)' : 'var(--border-2)' }} />
            ))}
          </div>
          <div style={{ cursor: 'pointer' }} onClick={onSkip} title="Skip tour">
            <Icon name="x" size={15} color="var(--text-tertiary)" />
          </div>
        </div>

        <div style={{ fontSize: 'var(--text-subhead)', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16 }}>{step.body}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-tiny)', color: 'var(--text-tertiary)' }}>{stepIndex + 1} / {steps.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button
                onClick={onBack}
                style={{ padding: '7px 13px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-2)', background: 'transparent', color: 'var(--text-quaternary)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer' }}
              >
                Back
              </button>
            )}
            <button
              onClick={onNext}
              style={{ padding: '7px 15px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 'var(--text-small)', fontWeight: 600, cursor: 'pointer' }}
            >
              {stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
