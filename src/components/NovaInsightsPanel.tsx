import { useState } from 'react';
import type { CSSProperties } from 'react';
import { generateGroceryList, generateWeeklyInsights, suggestNextMeal } from '../lib/macroIntelligence';
import { AiError } from '../lib/ai';
import { todayStr } from '../data/date';
import type { GroceryList, MacroInsight, Meal, NutritionTarget, SavedMeal, SymptomLog } from '../data/types';
import Icon from '../Icon';

interface Props {
  todayMeals: Meal[];
  meals: Meal[];
  symptomLogs: SymptomLog[];
  savedMeals: SavedMeal[];
  nutritionTarget: NutritionTarget | null;
  latestInsight: MacroInsight | null;
  latestGroceryList: GroceryList | null;
  addSymptomLog: (s: { symptom: string; severity: number | null; note: string | null }) => Promise<void>;
  setNutritionTarget: (t: { goal_id: string | null; daily_calories: number; daily_protein_g: number; daily_carbs_g: number; daily_fat_g: number; rationale: string | null }) => Promise<void>;
  saveMacroInsight: (i: { window_start: string; window_end: string; nutrient_gaps: string | null; timing_pattern: string | null; symptom_correlations: string | null }) => Promise<void>;
  saveGroceryList: (text: string) => Promise<void>;
}

const inputStyle: CSSProperties = {
  background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const cardStyle: CSSProperties = { background: '#101114', border: '1px solid #22262B', borderRadius: 14, padding: '18px 20px', maxWidth: 720 };
const buttonStyle = (disabled: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 999,
  border: '1px solid #F5F6F7', color: disabled ? '#565b64' : '#F5F6F7', borderColor: disabled ? '#22262B' : '#F5F6F7',
  fontSize: 12.5, fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
});
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function NovaInsightsPanel({
  todayMeals, meals, symptomLogs, savedMeals, nutritionTarget, latestInsight, latestGroceryList,
  addSymptomLog, setNutritionTarget, saveMacroInsight, saveGroceryList,
}: Props) {
  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] = useState(3);
  const [symptomNote, setSymptomNote] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [insightError, setInsightError] = useState('');

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [suggestError, setSuggestError] = useState('');

  const [showTargetForm, setShowTargetForm] = useState(false);
  const [tCal, setTCal] = useState('');
  const [tProtein, setTProtein] = useState('');
  const [tCarbs, setTCarbs] = useState('');
  const [tFat, setTFat] = useState('');

  const [generatingList, setGeneratingList] = useState(false);
  const [listError, setListError] = useState('');

  const logSymptom = async () => {
    if (!symptom.trim()) return;
    await addSymptomLog({ symptom: symptom.trim(), severity, note: symptomNote.trim() || null });
    setSymptom(''); setSymptomNote(''); setSeverity(3);
  };

  const runWeeklyAnalysis = async () => {
    setAnalyzing(true);
    setInsightError('');
    try {
      const windowStart = daysAgo(7);
      const windowMeals = meals.filter((m) => m.meal_date >= windowStart);
      const windowSymptoms = symptomLogs.filter((s) => s.log_date >= windowStart);
      const result = await generateWeeklyInsights(windowMeals, windowSymptoms);
      await saveMacroInsight({
        window_start: windowStart,
        window_end: todayStr(),
        nutrient_gaps: result.nutrient_gaps,
        timing_pattern: result.timing_pattern,
        symptom_correlations: result.symptom_correlations,
      });
    } catch (err) {
      setInsightError(err instanceof AiError ? err.message : 'Could not run the analysis — try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const runSuggestion = async () => {
    setSuggesting(true);
    setSuggestError('');
    setSuggestion('');
    try {
      const text = await suggestNextMeal(todayMeals, nutritionTarget, savedMeals);
      setSuggestion(text);
    } catch (err) {
      setSuggestError(err instanceof AiError ? err.message : 'Could not get a suggestion — try again.');
    } finally {
      setSuggesting(false);
    }
  };

  const saveTarget = async () => {
    if (!tCal || !tProtein || !tCarbs || !tFat) return;
    await setNutritionTarget({
      goal_id: null,
      daily_calories: Number(tCal),
      daily_protein_g: Number(tProtein),
      daily_carbs_g: Number(tCarbs),
      daily_fat_g: Number(tFat),
      rationale: 'Set manually from Macros & Meals.',
    });
    setTCal(''); setTProtein(''); setTCarbs(''); setTFat('');
    setShowTargetForm(false);
  };

  const runGroceryList = async () => {
    setGeneratingList(true);
    setListError('');
    try {
      const text = await generateGroceryList(nutritionTarget, savedMeals);
      await saveGroceryList(text);
    } catch (err) {
      setListError(err instanceof AiError ? err.message : 'Could not generate a list — try again.');
    } finally {
      setGeneratingList(false);
    }
  };

  return (
    <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={15} color="#F5F6F7" /> Nova — intelligence layer
      </div>

      {/* Daily target */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>Daily macro target</div>
          <span style={{ fontSize: 12, color: '#8A8F98', cursor: 'pointer' }} onClick={() => setShowTargetForm((v) => !v)}>
            {nutritionTarget ? 'Change' : 'Set target'}
          </span>
        </div>
        {nutritionTarget && !showTargetForm && (
          <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 8 }}>
            {nutritionTarget.daily_calories} cal · {nutritionTarget.daily_protein_g}p / {nutritionTarget.daily_carbs_g}c / {nutritionTarget.daily_fat_g}f
          </div>
        )}
        {!nutritionTarget && !showTargetForm && (
          <div style={{ fontSize: 12.5, color: '#565b64', marginTop: 8 }}>No target set — meal suggestions will use general judgment instead of hitting specific numbers.</div>
        )}
        {showTargetForm && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...inputStyle, width: 90 }} placeholder="Cal" value={tCal} onChange={(e) => setTCal(e.target.value)} />
            <input style={{ ...inputStyle, width: 90 }} placeholder="Protein" value={tProtein} onChange={(e) => setTProtein(e.target.value)} />
            <input style={{ ...inputStyle, width: 90 }} placeholder="Carbs" value={tCarbs} onChange={(e) => setTCarbs(e.target.value)} />
            <input style={{ ...inputStyle, width: 90 }} placeholder="Fat" value={tFat} onChange={(e) => setTFat(e.target.value)} />
            <div style={buttonStyle(false)} onClick={saveTarget}>Save</div>
          </div>
        )}
      </div>

      {/* Meal suggestion */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>What should I eat next?</div>
          <div style={buttonStyle(suggesting)} onClick={() => !suggesting && runSuggestion()}>{suggesting ? 'Thinking…' : 'Ask Nova'}</div>
        </div>
        {suggestion && <div style={{ fontSize: 13, color: '#C7CAD1', marginTop: 10, lineHeight: 1.5 }}>{suggestion}</div>}
        {suggestError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 8 }}>{suggestError}</div>}
      </div>

      {/* Weekly analysis */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>Weekly analysis</div>
          <div style={buttonStyle(analyzing)} onClick={() => !analyzing && runWeeklyAnalysis()}>{analyzing ? 'Analyzing…' : 'Analyze this week'}</div>
        </div>
        {insightError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 8 }}>{insightError}</div>}
        {latestInsight && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11.5, color: '#565b64', textTransform: 'uppercase', letterSpacing: 0.4 }}>Nutrient gaps</div>
              <div style={{ fontSize: 13, color: '#C7CAD1', marginTop: 3, lineHeight: 1.5 }}>{latestInsight.nutrient_gaps}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: '#565b64', textTransform: 'uppercase', letterSpacing: 0.4 }}>Meal timing</div>
              <div style={{ fontSize: 13, color: '#C7CAD1', marginTop: 3, lineHeight: 1.5 }}>{latestInsight.timing_pattern}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: '#565b64', textTransform: 'uppercase', letterSpacing: 0.4 }}>Symptom patterns</div>
              <div style={{ fontSize: 13, color: '#C7CAD1', marginTop: 3, lineHeight: 1.5 }}>{latestInsight.symptom_correlations}</div>
            </div>
            <div style={{ fontSize: 11, color: '#565b64' }}>{latestInsight.window_start} → {latestInsight.window_end}</div>
          </div>
        )}
      </div>

      {/* Symptom logging */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>Log a symptom</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...inputStyle, flex: '1 1 140px' }} placeholder="Headache, bloated, sluggish…" value={symptom} onChange={(e) => setSymptom(e.target.value)} />
          <select style={inputStyle} value={severity} onChange={(e) => setSeverity(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Severity {n}</option>)}
          </select>
          <input style={{ ...inputStyle, flex: '1 1 140px' }} placeholder="Note (opt.)" value={symptomNote} onChange={(e) => setSymptomNote(e.target.value)} />
          <div style={buttonStyle(!symptom.trim())} onClick={logSymptom}>Log</div>
        </div>
        {symptomLogs.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {symptomLogs.slice(0, 5).map((s) => (
              <div key={s.id} style={{ fontSize: 12, color: '#8A8F98' }}>
                {s.log_date} — {s.symptom}{s.severity ? ` (${s.severity}/5)` : ''}{s.note ? ` · ${s.note}` : ''}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grocery list */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#F5F6F7' }}>Weekly grocery list</div>
          <div style={buttonStyle(generatingList)} onClick={() => !generatingList && runGroceryList()}>{generatingList ? 'Generating…' : latestGroceryList ? 'Regenerate' : 'Generate'}</div>
        </div>
        {listError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 8 }}>{listError}</div>}
        {latestGroceryList && (
          <pre style={{ fontSize: 12.5, color: '#C7CAD1', marginTop: 10, whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{latestGroceryList.list_text}</pre>
        )}
      </div>
    </div>
  );
}
