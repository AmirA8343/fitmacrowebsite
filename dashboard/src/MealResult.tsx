import { useEffect, useRef, useState, type FormEvent } from 'react';
import { nutrients, type Nutrition } from './model';
import { analyzeMeal, scaleNutrition, type Estimate, type Food, type CorrectedIngredient } from './nutrition';
type Product = { brand?: string; barcode?: string; servingSize?: string; baseAmount?: number; baseUnit?: string; servingUnitHuman?: string };
type IngredientDraft = { name: string; amount: string; unit: string };
const toDraft = (food: Food): IngredientDraft => ({ name: food.name, amount: String(food.weight_g ?? food.quantity ?? ''), unit: food.weight_g ? 'gram' : food.unit ?? 'serving' });
const format = (n: number, decimals = 1) => n.toLocaleString(undefined, { maximumFractionDigits: decimals });
export default function MealResult({ initial, description, date, save, back, source = 'text', imageUrl, product }: { initial: Estimate; description: string; date: string; save: (event: FormEvent<HTMLFormElement>) => void; back: () => void; source?: 'text' | 'photo' | 'barcode'; imageUrl?: string; product?: Product }) {
  const [estimate, setEstimate] = useState(initial);
  const [currentDescription, setCurrentDescription] = useState(description);
  const [nutrition, setNutrition] = useState(initial.nutrition);
  const [ingredients, setIngredients] = useState(() => (initial.foods ?? []).map(toDraft));
  const [editingIngredients, setEditingIngredients] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [editNutrition, setEditNutrition] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [calculated, setCalculated] = useState(false);
  const [logDate, setLogDate] = useState(date);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { const dialog = heading.current?.closest('dialog'); if (dialog) dialog.scrollTop = 0; heading.current?.focus(); return () => controller.current?.abort(); }, []);
  const barcode = source === 'barcode';
  const canScale = barcode && Boolean(product?.baseAmount && product.baseAmount > 0 && product.baseUnit);
  const title = estimate.title || currentDescription || 'Meal result';
  const subtitle = estimate.subtitle || (estimate.foods ?? []).slice(0,2).map(f => f.name).join(' + ') || estimate.summary;
  function discard() { setIngredients((estimate.foods ?? []).map(toDraft)); setDirty(false); setEditingIngredients(false); setError(''); }
  function changeIngredient(index: number, field: keyof IngredientDraft, value: string) { setIngredients(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item)); setDirty(true); }
  async function reanalyze() {
    const corrected: CorrectedIngredient[] = ingredients.map(item => {
      const amount = Number(item.amount); const unit = item.unit.trim() || 'serving';
      return { name: item.name.trim(), quantity: item.amount ? amount : null, unit, weight_g: ['g','gram','grams'].includes(unit.toLowerCase()) && item.amount ? amount : null };
    });
    if (!corrected.length || corrected.some(item => !item.name || (item.quantity !== null && (!Number.isFinite(item.quantity) || item.quantity <= 0)))) { setError('Enter an ingredient name and a valid positive amount for each item.'); return; }
    const request = new AbortController(); controller.current = request; setBusy(true); setError('');
    const timer = window.setTimeout(() => request.abort(), 60000);
    try {
      const result = await analyzeMeal(currentDescription, request.signal, corrected);
      if (request.signal.aborted) return;
      setCurrentDescription((result.title || result.summary || currentDescription).slice(0, 500));
      setEstimate(result); setNutrition(result.nutrition); setIngredients((result.foods ?? []).map(toDraft)); setDirty(false); setEditingIngredients(false); setUpdated(true);
    } catch (err) { setError(request.signal.aborted ? 'Updating took too long. Try again or discard your changes.' : err instanceof Error ? err.message : 'Could not update nutrition.'); }
    finally { window.clearTimeout(timer); setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    if (busy) { event.preventDefault(); return; }
    if (dirty) { event.preventDefault(); void reanalyze(); return; }
    if (canScale && !calculated) { event.preventDefault(); setError('Enter how much you ate and calculate your portion before logging.'); return; }
    save(event);
  }
  function calculate() {
    try { setNutrition(scaleNutrition(estimate.nutrition, Number(amount.replace(',', '.')), product?.baseAmount ?? 0)); setCalculated(true); setError(''); } catch (err) { setError((err as Error).message); }
  }
  return <form className="meal-result" onSubmit={submit} aria-busy={busy}>
    <input type="hidden" name="name" value={currentDescription} />
    {!editNutrition && <><input type="hidden" name="date" value={logDate} />{nutrients.map(key => <input key={key} type="hidden" name={key} value={nutrition[key]} />)}</>}
    <div className="result-heading"><button type="button" aria-label="Back to meal entry" onClick={back}>‹</button><h2 ref={heading} tabIndex={-1}>{barcode ? 'Barcode Result' : 'Meal Result'}</h2></div>
    {(source === 'photo' || barcode) && <div className={`result-hero ${imageUrl ? '' : 'without-image'}`}>{imageUrl && <img src={imageUrl} alt={barcode ? 'Scanned product' : 'Analyzed meal'} />}<div className="result-hero-caption"><span>{barcode ? 'Scanned product' : 'Meal result'} · {barcode ? 'Barcode' : 'Photo'}</span><h3>{title}</h3><p>{barcode ? product?.barcode : subtitle}</p></div></div>}
    {source === 'text' && <section className="result-summary"><div><span>Meal result</span><span className="result-badge">Text</span></div><h3>{title}</h3><p>{subtitle}</p>{updated && <span className="result-updated">✧ Updated</span>}</section>}
    <section className="result-card result-macros"><div className="result-section-heading"><h3>Nutrition snapshot</h3><span>{barcode ? calculated ? 'Your portion' : 'Base serving' : 'Per meal estimate'}</span></div><div className="result-macro-row">{nutrients.map(key => <div className={`result-macro ${key}`} key={key}><span className="result-macro-accent" /><strong>{format(nutrition[key], key === 'calories' ? 0 : 1)}{key !== 'calories' && <small> g</small>}</strong><span>{key[0].toUpperCase() + key.slice(1)}</span></div>)}</div></section>
    {barcode && <section className="result-card"><h3>Details</h3>{product?.brand && <p className="result-detail">Brand: {product.brand}</p>}{product?.servingSize && <p className="result-detail">Base serving: {product.servingSize}</p>}{canScale && <div className="result-portion"><label>How much did you eat? ({product?.servingUnitHuman || product?.baseUnit})<input type="text" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setCalculated(false); setNutrition(estimate.nutrition); }} placeholder={`${product?.baseAmount} ${product?.baseUnit}`} /></label><button type="button" onClick={calculate}>Calculate</button>{calculated && <p role="status">Estimated nutrition for your portion is shown above.</p>}</div>}</section>}
    {!barcode && (ingredients.length > 0 || editingIngredients) && <section className="result-card"><div className="result-section-heading"><h3>Ingredients</h3><div><span>{ingredients.length} items</span><button type="button" className="result-edit" disabled={busy} onClick={() => editingIngredients ? discard() : setEditingIngredients(true)}>{editingIngredients ? dirty ? 'Cancel' : 'Done' : '✎ Edit'}</button></div></div><div className="result-ingredients">{ingredients.map((item, index) => <div className="result-ingredient" key={index}>{editingIngredients ? <div className="result-ingredient-fields"><input aria-label={`Ingredient ${index + 1} amount`} type="number" min="0.01" step="any" value={item.amount} onChange={e => changeIngredient(index, 'amount', e.target.value)} placeholder="Amount" disabled={busy} /><input aria-label={`Ingredient ${index + 1} unit`} value={item.unit} maxLength={40} onChange={e => changeIngredient(index, 'unit', e.target.value)} placeholder="Unit" disabled={busy} /><input aria-label={`Ingredient ${index + 1} name`} value={item.name} maxLength={150} onChange={e => changeIngredient(index, 'name', e.target.value)} placeholder="Ingredient" disabled={busy} /><button type="button" aria-label={`Remove ingredient ${index + 1}`} disabled={busy} onClick={() => { setIngredients(items => items.filter((_, i) => i !== index)); setDirty(true); }}>×</button></div> : <><span className="ingredient-dot" /><span>{estimate.foods?.[index]?.display || [item.amount, item.unit, item.name].filter(Boolean).join(' ')}</span><button type="button" aria-label={`Edit ${item.name}`} className="result-edit" onClick={() => setEditingIngredients(true)}>✎</button></>}</div>)}</div>{editingIngredients && <button type="button" className="result-edit result-add-ingredient" disabled={busy || ingredients.length >= 40} onClick={() => { setIngredients(items => [...items, { name: '', amount: '', unit: 'gram' }]); setDirty(true); }}>+ Add ingredient</button>}</section>}
    <section className="result-card result-nutrition-editor"><button type="button" className="result-edit-nutrition" aria-expanded={editNutrition} onClick={() => setEditNutrition(!editNutrition)} disabled={busy || dirty}>Edit nutrition & date <span>{editNutrition ? '−' : '+'}</span></button>{editNutrition && <div className="result-edit-fields"><label>Date<input name="date" type="date" required value={logDate} onChange={e => setLogDate(e.target.value)} /></label><div className="field-grid">{nutrients.map(key => <label key={key}>{key === 'calories' ? 'Calories (kcal)' : `${key[0].toUpperCase()}${key.slice(1)} (g)`}<input name={key} type="number" min="0" required step="any" value={nutrition[key]} onChange={e => { setNutrition({ ...nutrition, [key]: Number(e.target.value) }); setUpdated(true); }} /></label>)}</div></div>}</section>
    {error && <p className="capture-error" role="alert">{error}</p>}
    <div className="result-footer">{dirty && <button type="button" className="result-discard" disabled={busy} onClick={discard}>Discard changes</button>}<button className="result-log" type="submit" disabled={busy || Boolean(canScale && !calculated)}>{busy ? 'Updating nutrition…' : dirty ? 'Update nutrition' : 'Log Meal'}</button>{barcode && <button type="button" className="result-discard" onClick={back}>Scan again</button>}</div>
  </form>;
}
