import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMacros } from '../../data/useMacros';
import { FAST_FOOD_SEED } from '../../data/fastFoodSeed';
import type { MealCorrection, MealType } from '../../data/types';
import { askClaude, extractJson, AiError } from '../../lib/ai';
import { fileToBase64 } from '../../lib/image';
import { lookupBarcode, BarcodeLookupError } from '../../lib/barcode';
import BarcodeScanner from '../BarcodeScanner';
import NovaInsightsPanel from '../NovaInsightsPanel';
import Icon from '../../Icon';
import type { BenderSession } from '../../data/types';

interface Props {
  homeHeadStyle: CSSProperties;
  homeSubStyle: CSSProperties;
  activeBender?: BenderSession | null;
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

// Recent corrections are folded in as few-shot examples so a photo of the
// same repeat meal (the usual bagel order, etc) gets logged correctly
// without the user re-editing it every time — see meal_corrections'
// comment in supabase/schema_009_macros_v2.sql for the fuller rationale.
function correctionsToPromptContext(corrections: MealCorrection[]): string {
  if (corrections.length === 0) return '';
  const lines = corrections
    .slice(0, 8)
    .map(
      (c) =>
        `- When it looked like "${c.ai_description}" (estimated ${c.ai_calories ?? '?'} cal), it was actually "${c.corrected_description}" (${c.corrected_calories ?? '?'} cal, ${c.corrected_protein_g ?? '?'}p/${c.corrected_carbs_g ?? '?'}c/${c.corrected_fat_g ?? '?'}f). If this new photo looks similar, prefer the corrected version.`
    )
    .join('\n');
  return `\n\nKnown corrections from past estimates for this person:\n${lines}`;
}

async function estimateMealFromPhoto(image: { mediaType: string; data: string }, corrections: MealCorrection[]): Promise<MealEstimate> {
  const text = await askClaude({
    system:
      "You are Nova, a nutrition-estimation assistant inside Cristopher's personal tracker. " +
      'Look at the photo of a meal and estimate its nutrition. Be a reasonable, experienced-eye estimator — ' +
      "you won't be exact, so favor sensible round numbers over false precision. " +
      'Respond with ONLY a JSON object, no prose, matching exactly: ' +
      '{"meal_type": "breakfast"|"lunch"|"dinner"|"snack", "description": string (short, e.g. "Grilled chicken, rice, broccoli"), ' +
      '"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "confidence": "low"|"medium"|"high"}' +
      correctionsToPromptContext(corrections),
    messages: [{ role: 'user', content: 'Estimate the nutrition in this meal photo.' }],
    image,
    maxTokens: 500,
  });
  return extractJson<MealEstimate>(text);
}

const inputStyle: CSSProperties = {
  background: '#14161A', border: '1px solid #22262B', borderRadius: 8, padding: '9px 12px',
  color: '#F5F6F7', fontSize: 13.5, outline: 'none',
};
const statCardStyle: CSSProperties = { background: '#14161A', border: '1px solid #22262B', borderRadius: 14, padding: '16px 20px', minWidth: 120 };
const actionPillStyle = (active: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 999,
  background: active ? '#22262B' : '#F5F6F7', color: active ? '#8A8F98' : '#0A0B0D',
  fontSize: 13, fontWeight: 600, cursor: active ? 'default' : 'pointer',
});
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const GOAL_TAG_LABELS: Record<string, string> = {
  'high-protein-low-cal': 'High protein, low cal',
  'best-value': 'Best value',
  'low-carb': 'Low carb',
};

export default function MacrosScreen({ homeHeadStyle, homeSubStyle, activeBender = null }: Props) {
  const {
    meals, todayMeals, totals, todayWaterOz, fastFood, savedMeals, symptomLogs,
    nutritionTarget, latestInsight, latestGroceryList, loading,
    addMeal, removeMeal, addFastFoodOption, removeFastFoodOption,
    saveMealAsFavorite, logFromSavedMeal, removeSavedMeal,
    addMealCorrection, fetchRecentCorrections, addWaterLog, addSymptomLog,
    setNutritionTarget, saveMacroInsight, saveGroceryList,
  } = useMacros();

  const [mealType, setMealType] = useState<MealType>('lunch');
  const [source, setSource] = useState<'home' | 'restaurant'>('home');
  const [restaurant, setRestaurant] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [note, setNote] = useState('');
  const [showFastFood, setShowFastFood] = useState(false);
  const [ffFilter, setFfFilter] = useState<string | null>(null);
  const [ffRestaurant, setFfRestaurant] = useState('');
  const [ffItem, setFfItem] = useState('');
  const [ffCalories, setFfCalories] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiConfidence, setAiConfidence] = useState<MealEstimate['confidence'] | null>(null);
  const [aiEstimate, setAiEstimate] = useState<MealEstimate | null>(null);
  const [logMethod, setLogMethod] = useState<'manual' | 'photo' | 'barcode'>('manual');
  const [barcodeValue, setBarcodeValue] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const [seedingFastFood, setSeedingFastFood] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setRestaurant(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setNote('');
    setAiConfidence(null); setAiEstimate(null); setLogMethod('manual'); setBarcodeValue(null);
  };

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAnalyzing(true);
    setAiError('');
    setAiConfidence(null);
    try {
      const image = await fileToBase64(file);
      const corrections = await fetchRecentCorrections();
      const estimate = await estimateMealFromPhoto(image, corrections);
      setMealType(estimate.meal_type);
      setCalories(String(Math.round(estimate.calories)));
      setProtein(String(Math.round(estimate.protein_g)));
      setCarbs(String(Math.round(estimate.carbs_g)));
      setFat(String(Math.round(estimate.fat_g)));
      setNote(estimate.description);
      setAiConfidence(estimate.confidence);
      setAiEstimate(estimate);
      setLogMethod('photo');
      setBarcodeValue(null);
    } catch (err) {
      setAiError(err instanceof AiError ? err.message : 'Could not analyze that photo — try again or enter values manually.');
    } finally {
      setAnalyzing(false);
    }
  };

  const onBarcodeScanned = async (code: string) => {
    setScannerOpen(false);
    setBarcodeError('');
    try {
      const product = await lookupBarcode(code);
      setCalories(product.calories != null ? String(product.calories) : '');
      setProtein(product.protein_g != null ? String(product.protein_g) : '');
      setCarbs(product.carbs_g != null ? String(product.carbs_g) : '');
      setFat(product.fat_g != null ? String(product.fat_g) : '');
      setNote(product.name);
      setSource('home');
      setLogMethod('barcode');
      setBarcodeValue(code);
      setAiEstimate(null);
      setAiConfidence(null);
    } catch (err) {
      setBarcodeError(err instanceof BarcodeLookupError ? err.message : 'Lookup failed — try again or log manually.');
    }
  };

  const submitMeal = async () => {
    // If this came from a photo estimate and the numbers were edited before
    // logging, capture the correction for next time.
    if (aiEstimate) {
      const edited =
        Number(calories) !== Math.round(aiEstimate.calories) ||
        Number(protein) !== Math.round(aiEstimate.protein_g) ||
        Number(carbs) !== Math.round(aiEstimate.carbs_g) ||
        Number(fat) !== Math.round(aiEstimate.fat_g) ||
        note.trim() !== aiEstimate.description;
      if (edited) {
        await addMealCorrection({
          ai_description: aiEstimate.description,
          ai_calories: Math.round(aiEstimate.calories),
          ai_protein_g: Math.round(aiEstimate.protein_g),
          ai_carbs_g: Math.round(aiEstimate.carbs_g),
          ai_fat_g: Math.round(aiEstimate.fat_g),
          corrected_description: note.trim() || aiEstimate.description,
          corrected_calories: calories ? Number(calories) : null,
          corrected_protein_g: protein ? Number(protein) : null,
          corrected_carbs_g: carbs ? Number(carbs) : null,
          corrected_fat_g: fat ? Number(fat) : null,
        });
      }
    }
    await addMeal({
      meal_type: mealType,
      source,
      restaurant_name: source === 'restaurant' ? restaurant.trim() || null : null,
      calories: calories ? Number(calories) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
      note: note.trim() || null,
      log_method: logMethod,
      barcode: barcodeValue,
    });
    resetForm();
  };

  const saveCurrentAsFavorite = async () => {
    const name = note.trim() || (source === 'restaurant' && restaurant.trim()) || `${mealType[0].toUpperCase()}${mealType.slice(1)}`;
    await saveMealAsFavorite(name, {
      meal_type: mealType,
      source,
      restaurant_name: source === 'restaurant' ? restaurant.trim() || null : null,
      calories: calories ? Number(calories) : null,
      protein_g: protein ? Number(protein) : null,
      carbs_g: carbs ? Number(carbs) : null,
      fat_g: fat ? Number(fat) : null,
      note: note.trim() || null,
    });
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

  const loadStarterFastFood = async () => {
    setSeedingFastFood(true);
    try {
      const existing = new Set(fastFood.map((f) => `${f.restaurant_name}|${f.item_name}`));
      for (const item of FAST_FOOD_SEED) {
        if (existing.has(`${item.restaurant_name}|${item.item_name}`)) continue;
        await addFastFoodOption({
          restaurant_name: item.restaurant_name,
          item_name: item.item_name,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          notes: null,
          goal_tags: item.goal_tags,
        });
      }
    } finally {
      setSeedingFastFood(false);
    }
  };

  const visibleFastFood = ffFilter ? fastFood.filter((f) => f.goal_tags?.includes(ffFilter)) : fastFood;

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
        <div style={statCardStyle}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 600, color: '#F5F6F7' }}>{loading ? '—' : todayWaterOz}</span>
            <span style={{ fontSize: 11, color: '#565b64' }}>oz</span>
          </div>
          <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="drop" size={12} color="#8A8F98" /> Water
            <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#F5F6F7', fontWeight: 600 }} onClick={() => addWaterLog(8)}>+8oz</span>
          </div>
        </div>
      </div>

      {/* Favorites strip */}
      {savedMeals.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 12, color: '#8A8F98', marginBottom: 8 }}>Favorites — tap to log</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {savedMeals.map((sm) => (
              <div
                key={sm.id}
                style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, border: '1px solid #22262B', background: '#14161A', cursor: 'pointer', whiteSpace: 'nowrap' }}
                onClick={() => logFromSavedMeal(sm)}
              >
                <Icon name="star" size={13} color="#8A8F98" />
                <span style={{ fontSize: 12.5, color: '#F5F6F7' }}>{sm.name}</span>
                {sm.calories != null && <span style={{ fontSize: 11.5, color: '#565b64' }}>{sm.calories} cal</span>}
                <span style={{ fontSize: 12, color: '#565b64', marginLeft: 4 }} onClick={(e) => { e.stopPropagation(); removeSavedMeal(sm.id); }}>✕</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhotoSelected} />
        <div style={actionPillStyle(analyzing)} onClick={() => !analyzing && photoInputRef.current?.click()}>
          {analyzing ? 'Analyzing photo…' : '📷 Snap a meal — AI counts it'}
        </div>
        <div style={actionPillStyle(false)} onClick={() => { setBarcodeError(''); setScannerOpen(true); }}>
          <Icon name="barcode" size={15} color="#0A0B0D" /> Scan barcode
        </div>
        {aiConfidence && (
          <span style={{ fontSize: 12, color: '#8A8F98' }}>
            AI estimate ({aiConfidence} confidence) — review below before logging.
          </span>
        )}
      </div>
      {aiError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 8 }}>{aiError}</div>}
      {barcodeError && <div style={{ fontSize: 12.5, color: '#c47a7a', marginTop: 8 }}>{barcodeError}</div>}
      {logMethod === 'barcode' && barcodeValue && (
        <div style={{ fontSize: 12, color: '#8A8F98', marginTop: 8 }}>From barcode {barcodeValue} — exact product data, not an estimate.</div>
      )}

      {scannerOpen && <BarcodeScanner onScan={onBarcodeScanned} onClose={() => setScannerOpen(false)} />}

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
        <span style={{ fontSize: 12, color: '#8A8F98', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={saveCurrentAsFavorite}>
          <Icon name="star" size={13} color="#8A8F98" /> Save as favorite
        </span>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden', maxWidth: 720 }}>
        {todayMeals.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F6F7' }}>
                {m.meal_type[0].toUpperCase() + m.meal_type.slice(1)}{m.restaurant_name ? ` · ${m.restaurant_name}` : ''}
                {m.log_method !== 'manual' && (
                  <span style={{ fontSize: 10.5, color: '#565b64', fontWeight: 500, marginLeft: 8, textTransform: 'uppercase' }}>{m.log_method}</span>
                )}
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
          {fastFood.length === 0 && (
            <div
              style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 16px', borderRadius: 999, border: '1px solid #F5F6F7', color: '#F5F6F7', fontSize: 12.5, cursor: seedingFastFood ? 'default' : 'pointer', marginBottom: 12, opacity: seedingFastFood ? 0.6 : 1 }}
              onClick={() => !seedingFastFood && loadStarterFastFood()}
            >
              {seedingFastFood ? 'Loading…' : 'Load starter list (~20 chains)'}
            </div>
          )}
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

          {fastFood.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {(['high-protein-low-cal', 'best-value', 'low-carb'] as const).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11.5, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                    background: ffFilter === tag ? '#F5F6F7' : '#14161A', color: ffFilter === tag ? '#0A0B0D' : '#8A8F98', border: '1px solid #22262B',
                  }}
                  onClick={() => setFfFilter(ffFilter === tag ? null : tag)}
                >
                  {GOAL_TAG_LABELS[tag]}
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', border: '1px solid #22262B', borderRadius: 14, overflow: 'hidden' }}>
            {visibleFastFood.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 18px', borderBottom: '1px solid #1c1e23', background: '#101114' }}>
                <div>
                  <span style={{ fontSize: 13, color: '#C7CAD1' }}>{f.restaurant_name} — {f.item_name}{f.calories ? ` (${f.calories} cal)` : ''}</span>
                  {f.goal_tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {f.goal_tags.map((t) => (
                        <span key={t} style={{ fontSize: 10.5, color: '#565b64' }}>{GOAL_TAG_LABELS[t] ?? t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#565b64', cursor: 'pointer' }} onClick={() => removeFastFoodOption(f.id)}>Remove</span>
              </div>
            ))}
            {visibleFastFood.length === 0 && (
              <div style={{ padding: '14px 18px', fontSize: 12.5, color: '#565b64', background: '#101114' }}>Nothing here yet — add your go-to orders, or load the starter list above.</div>
            )}
          </div>
        </div>
      )}

      <NovaInsightsPanel
        todayMeals={todayMeals}
        meals={meals}
        symptomLogs={symptomLogs}
        savedMeals={savedMeals}
        nutritionTarget={nutritionTarget}
        latestInsight={latestInsight}
        latestGroceryList={latestGroceryList}
        activeBender={activeBender}
        addSymptomLog={addSymptomLog}
        setNutritionTarget={setNutritionTarget}
        saveMacroInsight={saveMacroInsight}
        saveGroceryList={saveGroceryList}
      />
    </div>
  );
}
