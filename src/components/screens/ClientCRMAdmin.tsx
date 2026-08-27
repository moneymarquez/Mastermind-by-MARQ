import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { useClientCRM } from '../../data/useClientCRM';
import type { PricingCadence } from '../../data/types';
import { cardStyle, inputStyle, selectStyle, primaryBtn, ghostBtn } from './ClientCRMScreen';

interface AdminProps {
  crm: ReturnType<typeof useClientCRM>;
  onClose: () => void;
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

/** Part 1's "editable question bank ... not hardcoded" requirement —
 *  add/remove/reorder the shared question set both the internal form and
 *  the public /audit questionnaire read from. */
export function AuditQuestionsAdmin({ crm, onClose, homeHeadStyle, homeSubStyle }: AdminProps) {
  const [category, setCategory] = useState('');
  const [prompt, setPrompt] = useState('');
  const [helperText, setHelperText] = useState('');

  const sorted = [...crm.questions].sort((a, b) => a.sort_order - b.sort_order);

  const add = async () => {
    if (!category.trim() || !prompt.trim()) return;
    const key = category.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') + '_' + Date.now().toString(36);
    await crm.addQuestion({ category: category.trim(), key, prompt: prompt.trim(), helper_text: helperText.trim() || null });
    setCategory('');
    setPrompt('');
    setHelperText('');
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((q) => q.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const order = sorted.map((q) => q.id);
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    crm.reorderQuestions(order);
  };

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 14 }} onClick={onClose}>
        ← Back to Client CRM
      </div>
      <div style={homeHeadStyle}>Audit Questions</div>
      <div style={homeSubStyle}>The shared question bank both the internal form and the public questionnaire pull from. Add, retire, or reorder freely.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, maxWidth: 640 }}>
        {sorted.map((q, i) => (
          <div key={q.id} style={{ ...cardStyle, padding: 14, opacity: q.active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{q.category}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>{q.prompt}</div>
                {q.helper_text && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>{q.helper_text}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 12, color: i === 0 ? 'var(--text-quaternary)' : 'var(--text-tertiary)', cursor: i === 0 ? 'default' : 'pointer' }} onClick={() => i > 0 && move(q.id, -1)}>↑</span>
                  <span style={{ fontSize: 12, color: i === sorted.length - 1 ? 'var(--text-quaternary)' : 'var(--text-tertiary)', cursor: i === sorted.length - 1 ? 'default' : 'pointer' }} onClick={() => i < sorted.length - 1 && move(q.id, 1)}>↓</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => crm.updateQuestion(q.id, { active: !q.active })}>{q.active ? 'Retire' : 'Reactivate'}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => crm.removeQuestion(q.id)}>Delete</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, marginTop: 18, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Add a question</div>
        <input style={inputStyle} placeholder="Category (e.g. Rapport, Vision, Positioning/Niche)" value={category} onChange={(e) => setCategory(e.target.value)} />
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Question prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <input style={inputStyle} placeholder="Helper text (optional)" value={helperText} onChange={(e) => setHelperText(e.target.value)} />
        <div style={primaryBtn} onClick={add}>Add question</div>
      </div>
    </div>
  );
}

/** Part 3's default package template — pre-fills every new client's
 *  pricing plan, but editing it here never touches an already-finalized
 *  client plan (client_pricing_items is a one-time copy). */
export function PricingTemplateAdmin({ crm, onClose, homeHeadStyle, homeSubStyle }: AdminProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<PricingCadence>('one_time');
  const [repeat, setRepeat] = useState('1');

  const add = async () => {
    const amt = Number(amount);
    if (!label.trim() || !amt || amt <= 0) return;
    await crm.addTemplateItem({ label: label.trim(), amount: amt, cadence, repeat_count: cadence === 'monthly' ? Number(repeat) || 1 : 1 });
    setLabel('');
    setAmount('');
    setRepeat('1');
  };

  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 14 }} onClick={onClose}>
        ← Back to Client CRM
      </div>
      <div style={homeHeadStyle}>Default Pricing Template</div>
      <div style={homeSubStyle}>Pre-fills every new client's pricing plan. Editing this never changes a client's already-finalized plan.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20, maxWidth: 560 }}>
        {[...crm.template].sort((a, b) => a.sort_order - b.sort_order).map((item) => (
          <div key={item.id} style={{ ...cardStyle, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                ${item.amount.toLocaleString()} {item.cadence === 'monthly' ? `/mo × ${item.repeat_count}` : 'one-time'}
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => crm.removeTemplateItem(item.id)}>Remove</span>
          </div>
        ))}
        {crm.template.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>No template items — add one below.</div>}
      </div>

      <div style={{ ...cardStyle, marginTop: 18, maxWidth: 560, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inputStyle, flex: '2 1 160px' }} placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input style={{ ...inputStyle, flex: '1 1 90px' }} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select style={{ ...selectStyle, flex: '1 1 100px' }} value={cadence} onChange={(e) => setCadence(e.target.value as PricingCadence)}>
          <option value="one_time">One-time</option>
          <option value="monthly">Monthly</option>
        </select>
        {cadence === 'monthly' && (
          <input style={{ ...inputStyle, flex: '0 1 70px' }} placeholder="× months" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        )}
        <div style={primaryBtn} onClick={add}>Add</div>
      </div>
      <div style={{ marginTop: 10 }}>
        <span style={ghostBtn} onClick={onClose}>Done</span>
      </div>
    </div>
  );
}
