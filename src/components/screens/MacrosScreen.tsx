import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMacros } from '../../data/useMacros';
import type { MealType } from '../../data/types';
import { askClaude, extractJson, AiError } from '../../lib/ai';
import { fileToBase64 } from '../../lib/image';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
}

interface MealEstimate {
  meal_type: MealType;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'low' | 'medium' | 'high';
}

async function estimateMealFromPhoto(image: { mediaType: string; data: string }): Promise<MealEstimate> {
  const text = await askClaude({
    system:
      "You are Nova, a nutrition-estimation assistant inside Cristopher's personal tracker. " +
      'Look at the photo of a meal and estimate its nutrition. Be a reasonable, experienced-eye estimator — ' +
      "you won't be exact, so favor sensible round numbers over false precision. " +
      'Respond with ONLY a JSON object, no prose, matching exactly: ' +
      '{"meal_type": "breakfast"|"lunch"|"dinner"|"snack", "description": string (short, e.g. "Grilled chicken, rice, broccoli"), ' +
      '"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "confidence": "low"|"medium"|"high"}',
    messages: [{ role: 'user', content: 'Estimate the nutrition in this meal photo.' }],
    image,
    maxTokens: 400,
  });
  return extractJson<MealEstimate>(text);
}

const inputStyle: CSSProperties = {
  background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const statCardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: '16px 20px', minWidth: 120 };
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MacrosScreen({ homeHeadStyle, homeSubStyle }: Props) {
  const { todayMeals, totals, fastFood, loading, addMeal, removeMeal, addFastFoodOption, removeFastFoodOption } = useMacros();
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [source, setSource] = useState<'home' | 'restaurant'>('home');
  const [restaurant, setRestaurant] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');
  const [showFastFood, setShowFastFood] = useState(false);
  const [ffRestaurant, setFfRestaurant] = useState('');
  const [ffItem, setFfItem] = useState('');
  const [ffCalories, setFfCalories] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiConfidence, setAiConfidence] = useState<MealEstimate['confidence'] | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAnalyzing(true);
    setAiError('');
    setAiConfidence(null);
    try {
      const image = await fileToBase64(file);
      const estimate = await estimateMealFromPhoto(image);
      setMealType(estimate.meal_type);
      setCalories(String(Math.round(estimate.calories)));
      setProtein(String(Math.round(estimate.protein_g)));
      setCarbs(String(Math.round(estimate.carbs_g)));
      setFat(String(Math.round(estimate.fat_g)));
      setNote(estimate.description);
      setAiConfidence(estimate.confidence);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not analyze that photo — try again or enter values manually.');
    } finally {
      setAnalyzing(false);
    }
  };

  const submitMeal = async () => {
    await addMeal({
      meal_type: mealType,
      source,
      restaurant_name: source === 'restaurant' ? restaurant.trim() || null : null,
      calories: calories ? Number(calories) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
      note: note.trim() || null,
    });
    setRestaurant(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setNote('');
    setAiConfidence(null);
  };

  const submitFastFood = async () => {
    if (!ffRestaurant.trim() || !ffItem.trim()) return;
    await addFastFoodOption({
      restaurant_name: ffRestaurant.trim(),
      item_name: ffItem.trim(),
      calories: ffCalories ? Number(ffCalories) : null,
      protein_g: null, carbs_g: null, fat_g: null, notes: null,
    });
    setFfRestaurant(''); setFfItem(''); setFfCalories('');
  };

  return (
    <div>
      <div style={homeHeadStyle}>Macros & Meals</div>
      <div style={homeSubStyle}>Today's totals, meal-by-meal.</div>

      <div style={{ display: 'flex', gap: 14, marginTop: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Calories', value: totals.calories },
          { label: 'Protein (g)', value: totals.protein_g },
          { label: 'Carbs (g)', value: totals.carbs_g },
          { label: 'Fat (g)', value: totals.fat_g },
        ].map((s) => (
          <div key={s.label} style={statCardStyle}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, color: '#F5F6F7' }}>{loading ? '—' : s.value}</div>
            <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhotoSelected} />
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999,
            background: analyzing ? '#22262B' : '#F5F6F7', color: analyzing ? '#8A8F98' : '#0A0B0D',
            fontSize: 13, fontWeight: 600, cursor: analyzing ? 'default' : 'pointer',
          }}
          onClick={() => !analyzing && photoInputRef.current?.click()}
        >
          {analyzing ? 'Analyzing photo…' : '📷 Snap a meal — AI counts it'}
        </div>
        {aiConfidence && (
          <span style={{ fontSize: 12, color: '#8A8F98' }}>
            AI estimate ({aiConfidence} confidence) — review below before logging.
          </span>
        )}
      </div>
      {aiError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 8 }}>{aiError}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', maxWidth: 720, alignItems: 'center' }}>
        <select style={inputStyle} value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
          {MEAL_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select style={inputStyle} value={source} onChange={(e) => setSource(e.target.value as 'home' | 'restaurant')}>
          <option value="home">Home</option>
          <option value="restaurant">Restaurant</option>
        </select>
        {source === 'restaurant' && (
          <input style={{ ...inputStyle, flex: '1 1 140px' }} placeholder="Restaurant" value={restaurant} onChange={(e) => setRestaurant(e.target.value)} />
        )}
        <input style={{ ...inputStyle, width: 90 }} placeholder="Cal" value={calories} onChange={(e) => setCalories(e.target.value)} />
        <input style={{ ...inputStyle, width: 90 }} placeholder="Protein" value={protein} onChange={(e) => setProtein(e.target.value)} />
        <input style={{ ...inputStyle, width: 90 }} placeholder="Carbs" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        <input style={{ ...inputStyle, width: 90 }} placeholder="Fat" value={fat} onChange={(e) => setFat(e.target.value)} />
        <input style={{ ...inputStyle, flex: '1 1 140px' }} placeholder="Note (opt.)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div
          style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={submitMeal}
        >
          Log meal
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 720 }}>
        {todayMeals.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>
                {m.meal_type[0].toUpperCase() + m.meal_type.slice(1)}{m.restaurant_name ? ` · ${m.restaurant_name}` : ''}
              </div>
              <div style={{ fontSize: 12.5, color: '#8A8F98', marginTop: 2 }}>
                {[m.calories && `${m.calories} cal`, m.protein_g && `${m.protein_g}p`, m.carbs_g && `${m.carbs_g}c`, m.fat_g && `${m.fat_g}f`].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
            <span style={{ fontSize: 13, color: '#565b64', cursor: 'pointer' }} onClick={() => removeMeal(m.id)}>Remove</span>
          </div>
        ))}
        {!loading && todayMeals.length === 0 && (
          <div style={{ padding: '18px', fontSize: 13, color: '#565b64', background: '#101114' }}>No meals logged today.</div>
        )}
      </div>

      <div
        style={{ marginTop: 28, fontSize: 13, color: '#8A8F98', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        onClick={() => setShowFastFood((v) => !v)}
      >
        {showFastFood ? 'Hide' : 'Show'} fast-food reference list
      </div>

      {showFastFood && (
        <div style={{ marginTop: 14, maxWidth: 720 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, flex: '1 1 160px' }} placeholder="Restaurant" value={ffRestaurant} onChange={(e) => setFfRestaurant(e.target.value)} />
            <input style={{ ...inputStyle, flex: '1 1 200px' }} placeholder="Go-to order" value={ffItem} onChange={(e) => setFfItem(e.target.value)} />
            <input style={{ ...inputStyle, width: 100 }} placeholder="Cal (opt.)" value={ffCalories} onChange={(e) => setFfCalories(e.target.value)} />
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 12.5, cursor: 'pointer' }}
              onClick={submitFastFood}
            >
              Add
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
            {fastFood.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 18px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
                <span style={{ fontSize: 13, color: '#C7CAD1' }}>{f.restaurant_name} — {f.item_name}{f.calories ? ` (${f.calories} cal)` : ''}</span>
                <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => removeFastFoodOption(f.id)}>Remove</span>
              </div>
            ))}
            {fastFood.length === 0 && (
              <div style={{ padding: '14px 18px', fontSize: 12.5, color: '#565b64', background: '#101114' }}>Nothing here yet — add your go-to orders as you build the list.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
