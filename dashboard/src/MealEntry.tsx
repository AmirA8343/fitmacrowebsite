import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { nutrients, type Meal } from './model';
import { analyzeMeal, type Estimate } from './nutrition';
import MealResult from './MealResult';
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
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!description.trim()) { setError('Please describe your meal.'); return; }
    if (mode !== 'ai') { save(event); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    const timeout = window.setTimeout(() => controller.abort(), 60_000);
    try {
      const estimate = await analyzeMeal(description.trim(), controller.signal);
      if (controller.signal.aborted) return;
      setFields(Object.fromEntries(nutrients.map(key => [key, String(estimate.nutrition[key])])));
      setEstimate(estimate); setMode('review');
    } catch (err) {
      if (controller.signal.aborted) setError('Analysis stopped or timed out. Try again or enter the nutrition manually.');
      else setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally { window.clearTimeout(timeout); if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  if (mode === 'review' && estimate) return <MealResult initial={estimate} description={description} date={date} save={save} back={() => { setMode('ai'); setError(''); }} />;
  return <form className="capture-form" onSubmit={submit} aria-busy={busy}>
    <div className="capture-heading"><p>Quick Capture</p><h2 id="capture-title">{editing ? 'Edit Meal' : 'Log Meal'}</h2><span>Describe your meal to estimate its calories and macros</span></div>
    <div className="capture-modes" role="group" aria-label="Meal input method" aria-describedby="capture-availability">
      <button type="button" className="capture-mode active" aria-pressed="true"><CaptureIcon kind="text" />Text</button>
      <button type="button" className="capture-mode" disabled title="Barcode scanning is not connected yet"><CaptureIcon kind="scan" />Scan</button>
      <button type="button" className="capture-mode compact" disabled title="Camera analysis is not connected yet"><CaptureIcon kind="camera" />Camera</button>
      <button type="button" className="capture-mode compact" disabled title="Photo analysis is not connected yet"><CaptureIcon kind="photos" />Photos</button>
    </div>
    <div className="capture-input-shell"><label htmlFor="meal-description">Describe your meal</label><p>Include portions and preparation for a better estimate.</p><textarea id="meal-description" name="name" required maxLength={500} value={description} onChange={e => { setDescription(e.target.value) }} disabled={busy} placeholder="Describe your meal..." rows={4} autoFocus /><p className="capture-example">Example: “150g grilled chicken with 1 cup cooked rice”</p></div>
    {busy && <div className="capture-loading" role="status"><span className="capture-spinner" aria-hidden="true" />Analyzing your meal…</div>}
    {mode !== 'ai' && <div className="capture-details"><h3>Nutrition & date</h3><div className="capture-nutrition-fields"><label>Date<input name="date" type="date" required defaultValue={editing?.date ?? date} /></label><div className="field-grid">{nutrients.map(key => <label key={key}>{key === 'calories' ? 'Calories (kcal)' : `${key[0].toUpperCase()}${key.slice(1)} (g)`}<input name={key} type="number" min="0" step="any" required value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></label>)}</div></div></div>}
    {error && <p className="capture-error" role="alert">{error}</p>}
    {!editing && <button type="button" className="capture-manual-toggle" disabled={busy} onClick={() => { setMode(mode === 'manual' ? 'ai' : 'manual'); setError(''); }}>{mode === 'manual' ? 'Use AI analysis instead' : 'Enter nutrition manually instead'}</button>}
    <p className="capture-availability" id="capture-availability">Text analysis only. Photos and scanning aren’t connected.</p>
    <div className="capture-actions"><button type="button" className="capture-cancel" onClick={() => { request.current?.abort(); close(); }}>Cancel</button><button type="submit" className="capture-add" disabled={busy}>{busy ? 'Analyzing…' : editing ? 'Save changes' : mode === 'ai' ? 'Analyze Meal' : '+ Add Meal'}</button></div>
  </form>;
}
