import { t, getLanguage } from './i18n';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { nutrients, type Meal } from './model';
import { analyzeMeal, type Estimate } from './nutrition';
import MealResult from './MealResult';
import Capture, { preparePhoto } from './Capture';
import { authorizedFetch } from './subscriptions';
function CaptureIcon({ kind }: { kind: 'text' | 'scan' | 'camera' | 'photos' }) {
  const paths: Record<typeof kind, ReactNode> = {
    text: <><path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3" /></>,
    scan: <><path d="M8 3H4v4m12-4h4v4M4 17v4h4m12-4v4h-4M3 12h18M8 8v8m4-8v8m4-8v8" /></>,
    camera: <><path d="m8 5 2-2h4l2 2h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /><circle cx="12" cy="12" r="4" /></>,
    photos: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
export default function MealEntry({ editing, date, save, close, initialDescription = '' }: { editing: Meal | null; date: string; save: (event: FormEvent<HTMLFormElement>) => void; close: () => void; initialDescription?: string }) {
  const [mode, setMode] = useState<'ai' | 'manual' | 'review'>(editing ? 'manual' : 'ai');
  const [description, setDescription] = useState(editing?.name ?? initialDescription);
  const [fields, setFields] = useState(() => Object.fromEntries(nutrients.map(key => [key, editing ? String(editing[key]) : ''])));
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState<'text' | 'camera' | 'photos' | 'scan'>('text');
  const [image, setImage] = useState('');
  const [camera, setCamera] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [product, setProduct] = useState<{ barcode?: string; brand?: string; servingSize?: string; baseAmount?: number; baseUnit?: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  async function selectPhoto(file?: File) { if (!file) return; setBusy(true); setError(''); try { setImage(await preparePhoto(file)); setCamera(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function lookup(code: string) {
    if (busy) return; setBusy(true); setCamera(false); setError('');
    const controller = new AbortController(); request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try { const response = await authorizedFetch('/api/barcode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barcode: code }), signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error || t("Product not found.")); setEstimate(data.estimate); setProduct(data.product); setDescription(data.estimate.title); setMode('review'); }
    catch (e) { if (!controller.signal.aborted) setError((e as Error).message); else setError(t("Product lookup stopped or timed out.")); } finally { window.clearTimeout(timer); setBusy(false); }
  }
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (mode === 'ai' && input === 'scan') { await lookup(barcode.trim()); return; }
    if (!description.trim() && !(mode === 'ai' && image && input !== 'text')) { setError(t("Please describe your meal.")); return; }
    if (mode !== 'ai') { save(event); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setCamera(false); setError('');
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const estimate = await analyzeMeal(description.trim(), controller.signal, undefined, input !== 'text' ? image : undefined);
      if (controller.signal.aborted) return;
      setFields(Object.fromEntries(nutrients.map(key => [key, String(estimate.nutrition[key])])));
      setEstimate(estimate); setProduct(undefined); if (!description.trim()) setDescription(estimate.title || t("Meal photo")); setMode('review');
    } catch (err) {
      if (controller.signal.aborted) setError(t("Analysis stopped or timed out. Try again or enter the nutrition manually."));
      else setError(err instanceof Error ? err.message : t("Analysis failed. Please try again."));
    } finally { window.clearTimeout(timeout); if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  const descriptionField = <div className="capture-input-shell"><label htmlFor="meal-description">{mode === 'manual' || input === 'text' ? t("Describe your meal") : t("Add details (optional)")}</label><p>{t("Include portions and preparation for a better estimate.")}</p><textarea id="meal-description" name="name" required={mode === 'manual' || input === 'text'} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} disabled={busy} placeholder={t("Describe your meal...")} rows={4} autoFocus={mode === 'manual' || input === 'text'} /><p className="capture-example">{t("Example: “150g grilled chicken with 1 cup cooked rice”")}</p></div>;
  if (mode === 'review' && estimate) return <MealResult initial={estimate} description={description} date={date} save={save} source={product ? 'barcode' : input !== 'text' && image ? 'photo' : 'text'} imageUrl={!product && input !== 'text' ? image : undefined} product={product} back={() => { setMode('ai'); setError(''); }} />;
  return <form className="capture-form" onSubmit={submit} aria-busy={busy}>
    <div className="capture-heading"><p>{t("Quick Capture")}</p><h2 id="capture-title">{editing ? t("Edit Meal") : t("Log Meal")}</h2><span>{t("Describe your meal to estimate its calories and macros")}</span></div>
    <div className="capture-modes" role="group" aria-label={t("Meal input method")} aria-describedby="capture-availability">
      {(['text', 'scan', 'camera', 'photos'] as const).map(kind => <button key={kind} type="button" className={`capture-mode ${kind === input ? 'active' : ''}`} disabled={busy || Boolean(editing)} aria-pressed={kind === input} onClick={() => { setMode('ai'); setInput(kind); setError(''); setCamera(kind === 'camera' || kind === 'scan'); if (kind === 'photos') fileInput.current?.click(); }}><CaptureIcon kind={kind} />{t(kind[0].toUpperCase() + kind.slice(1))}</button>)}
    </div>
    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={e => { void selectPhoto(e.target.files?.[0]); e.target.value = ''; }} />
    {mode === 'ai' && camera && <Capture mode={input === 'scan' ? 'scan' : 'camera'} photo={data => { setImage(data); setCamera(false); }} barcode={code => { setBarcode(code); void lookup(code); }} cancel={() => setCamera(false)} />}
    {mode === 'ai' && input !== 'text' && input !== 'scan' && <div className="photo-preview">{image && <img src={image} alt={t("Selected meal")} />}<button type="button" className="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>{image ? t("Choose another photo") : t("Choose meal photo")}</button></div>}
    {mode === 'ai' && input === 'scan' ? <div className="capture-input-shell"><label htmlFor="barcode">{t("Product barcode")}</label><input id="barcode" inputMode="numeric" value={barcode} maxLength={14} onChange={e => setBarcode(e.target.value.replace(/[^0-9]/g, ''))} placeholder={t("Enter barcode numbers")} required /><p>{t("Lookups use Open Food Facts. Verify the result against your package label.")}</p><a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">{t("Open Food Facts · ODbL")}</a></div> : (mode === 'ai' && (input === 'camera' || input === 'photos') ? <details className="capture-optional-details"><summary>{t("＋ Add portion or preparation details")}</summary>{descriptionField}</details> : descriptionField)}
    {busy && <div className="capture-loading" role="status"><span className="capture-spinner" aria-hidden="true" />{t("Analyzing your meal…")}</div>}
    {mode !== 'ai' && <div className="capture-details"><h3>{t("Nutrition & date")}</h3><div className="capture-nutrition-fields"><label>{t("Date")}<input name="date" type="date" required defaultValue={editing?.date ?? date} /></label><div className="field-grid">{nutrients.map(key => <label key={key}>{key === 'calories' ? t("Calories (kcal)") : `${t(key[0].toUpperCase() + key.slice(1))} (g)`}<input name={key} type="number" min="0" step="any" required value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></label>)}</div></div></div>}
    {error && <p className="capture-error" role="alert">{t(error)}</p>}
    {!editing && <button type="button" className="capture-manual-toggle" disabled={busy} onClick={() => { setMode(mode === 'manual' ? 'ai' : 'manual'); setError(''); }}>{mode === 'manual' ? t("Use AI analysis instead") : t("Enter nutrition manually instead")}</button>}
    <p className="capture-availability" id="capture-availability">{t("Photos are sent for analysis, not saved on our servers. Saved photos stay in this browser.")}</p>
    <div className="capture-actions"><button type="button" className="capture-cancel" onClick={() => { request.current?.abort(); close(); }}>{t("Cancel")}</button><button type="submit" className="capture-add" disabled={busy || (mode === 'ai' && (input === 'camera' || input === 'photos') && !image)}>{busy ? t("Analyzing…") : editing ? t("Save changes") : mode === 'ai' ? t("Analyze Meal") : t("+ Add Meal")}</button></div>
  </form>;
}
