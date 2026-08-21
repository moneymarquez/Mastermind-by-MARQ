import type { CSSProperties } from 'react';

// Always-visible, not gated behind AI pattern-detection — the AI-side
// crisis instructions in MentalHealthScreen/SobrietyScreen/Nova's system
// prompt are a second layer, not the only one. A static resource that's
// just always there is the more reliable safety net.
const style: CSSProperties = {
  fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 18, lineHeight: 1.6,
};

export default function CrisisResourceBanner() {
  return (
    <div style={style}>
      If you're in crisis or thinking about harming yourself — 988 Suicide & Crisis Lifeline (call or text 988), or
      text HOME to 741741 for the Crisis Text Line. Available any time.
    </div>
  );
}
