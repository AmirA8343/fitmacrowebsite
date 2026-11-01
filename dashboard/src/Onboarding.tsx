import { t, getLanguage } from './i18n';
import { useState, type FormEvent } from 'react';
import { calculateTargets, type Profile } from './profile';
import type { Nutrition } from './model';
export default function Onboarding({ profile, complete, skip }: { profile?: Profile; complete: (profile: Profile, targets: Nutrition) => void; skip: () => void }) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState({ age: profile ? String(profile.age) : '', weight: profile ? String(profile.weight) : '', height: profile ? String(profile.height) : '', gender: profile?.gender ?? '', goal: profile?.goal ?? 'maintenance' });
  const [error, setError] = useState('');
  const values: Profile = { age: Number(draft.age), weight: Number(draft.weight), height: Number(draft.height), gender: draft.gender as Profile['gender'], goal: draft.goal };
  let estimate: Nutrition | null = null;
  if (step === 2) { try { estimate = calculateTargets(values); } catch { /* Show validation on submission. */ } }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (step < 2) { setStep(step + 1); return; }
    try { complete(values, calculateTargets(values)); } catch (err) { setError((err as Error).message); }
  }
  return <div className="setup-flow"><div className="entry-symbol" aria-hidden="true">♡</div><p className="eyebrow">{t("Setup Flow")}</p><h2>{t("Make FitMacro yours")}</h2><p className="entry-subtitle">{t("Answer a few questions to estimate your daily calorie and macro targets.")}</p><div className="setup-progress" aria-label={t('Step {step} of 2', { step })}>{[1,2].map(n => <span key={n} className={n <= step ? 'active' : ''} />)}</div><form onSubmit={submit}>
    <div key={step} className="setup-step">
    {step === 1 && <><h3>{t("About you")}</h3><p className="muted">{t("We use these details to estimate your daily energy needs.")}</p><div className="field-grid"><label>{t("Age (years)")}<input autoFocus type="number" min="18" max="100" step="1" required placeholder="25" value={draft.age} onChange={e => setDraft({ ...draft, age: e.target.value })} /></label><label>{t("Weight (kg)")}<input type="number" min="30" max="350" step="0.1" required placeholder="70" value={draft.weight} onChange={e => setDraft({ ...draft, weight: e.target.value })} /></label></div><label>{t("Height (cm)")}<input type="number" min="120" max="230" step="0.1" required placeholder="170" value={draft.height} onChange={e => setDraft({ ...draft, height: e.target.value })} /></label><label>{t("Gender used for the calorie calculation")}<select required value={draft.gender} onChange={e => setDraft({ ...draft, gender: e.target.value })}><option value="" disabled>{t("Select an option")}</option><option value="male">{t("Male")}</option><option value="female">{t("Female")}</option></select></label></>}
    {step === 2 && <><h3>{t("What’s your goal?")}</h3><p className="muted">{t("Choose the goal you want your daily targets to support.")}</p><fieldset className="goal-options"><legend className="sr-only">{t("Weight goal")}</legend>{([{ value: 'maintenance', title: t("Maintain weight"), description: t("Keep your current weight steady") }, { value: 'lose', title: t("Lose weight"), description: t("A lower daily calorie target") }, { value: 'gain', title: t("Gain weight"), description: t("A higher daily calorie target") }] as const).map(option => <label className={draft.goal === option.value ? 'selected' : ''} key={option.value}><input type="radio" name="goal" value={option.value} checked={draft.goal === option.value} onChange={() => setDraft({ ...draft, goal: option.value })} /><span><strong>{option.title}</strong><small>{option.description}</small></span></label>)}</fieldset>{estimate && <div className="setup-estimate"><small>{t("Your estimated daily target")}</small><strong>{estimate.calories.toLocaleString(getLanguage())} <span>kcal</span></strong><p>{estimate.protein}{t("g protein ·")} {estimate.carbs}{t("g carbs ·")} {estimate.fat}{t("g fat")}</p></div>}<p className="muted small">{t("Uses the same calculation as the mobile app. This is an estimate; you can adjust your targets in Settings.")}</p></>}
    </div>
    {error && <p className="entry-error" role="alert">{t(error)}</p>}
    <div className="form-actions">{step > 1 ? <button className="secondary" type="button" onClick={() => { setStep(step - 1); setError(''); }}>{t("Back")}</button> : <button className="secondary" type="button" onClick={skip}>{t("Skip for now")}</button>}<button className="primary" type="submit">{step === 2 ? t("Use these targets") : t("Continue")}</button></div>
  </form></div>;
}
