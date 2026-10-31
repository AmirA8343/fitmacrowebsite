import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { initialData, isNutrition, localDate, nutrients, parseData, totals, validDate, type Data, type Meal, type Nutrition } from './model';
import './styles.css';
import MealEntry from './MealEntry';
import MealHistory from './MealHistory';
import { favoriteKey } from './history';
import Landing from './Landing';
import SubscriptionPanel from './SubscriptionPanel';
import { getAccess } from './subscriptions';
import type { Access } from '../../shared/plans';
import Onboarding from './Onboarding';
import Login, { authMessage } from './Login';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { storageKeyForUser } from './profile';
const labels = { calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
function load(storageKey: string): { data: Data; error: string } {
  try { const raw = localStorage.getItem(storageKey); return { data: raw ? parseData(raw) : initialData, error: '' }; }
  catch { return { data: initialData, error: 'Saved data could not be read. Storage is paused to protect it. Export any new entries before leaving.' }; }
}
function Modal({ title, close, children, variant = '' }: { title: string; close: () => void; children: ReactNode; variant?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); return () => { dialog.close(); previous?.focus(); }; }, []);
  return <dialog ref={ref} className={variant} aria-label={title} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="dialog-content"><div className="section-heading dialog-heading"><h2>{title}</h2><button className="icon" aria-label="Close dialog" onClick={close}>×</button></div>{children}</div></dialog>;
}
function NutritionFields({ values, blank = false }: { values: Nutrition; blank?: boolean }) {
  return <div className="field-grid">{nutrients.map(key => <label key={key}>{labels[key]} ({key === 'calories' ? 'kcal' : 'g'})<input name={key} type="number" min="0" step="0.1" required defaultValue={blank ? '' : values[key]} /></label>)}</div>;
}
function readNutrition(form: HTMLFormElement): Nutrition {
  const data = new FormData(form);
  return Object.fromEntries(nutrients.map(key => [key, Number(data.get(key))])) as Nutrition;
}
function Dashboard({ user, login, logout, boot, initialDescription }: { user: User | null; login: (resume?: 'plans') => void; logout: () => Promise<void>; boot: 'meal' | 'plans' | null; initialDescription: string }) {
  const storageKey = storageKeyForUser(user?.uid ?? null);
  const [loaded] = useState(() => load(storageKey));
  const [data, setData] = useState(loaded.data);
  const [error, setError] = useState(loaded.error);
  const [notice, setNotice] = useState('');
  const [today, setToday] = useState(localDate);
  const [selectedDate, setSelectedDate] = useState(today);
  const [modal, setModal] = useState<'meal' | 'settings' | 'history' | 'coach' | 'setup' | 'plans' | null>(boot);
  const [accessStatus, setAccessStatus] = useState<Access | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => { void getAccess().then(value => { if (active) setAccessStatus(value); }).catch(() => { if (active) setAccessStatus(null); }); };
    refresh(); window.addEventListener('fitmacro:usage', refresh); window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('fitmacro:usage', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  const [returnToHistory, setReturnToHistory] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const close = () => { if (modal === 'setup') setData(d => ({ ...d, setupCompleted: true })); setModal(modal === 'meal' && returnToHistory ? 'history' : null); setEditing(null); setReturnToHistory(false); };
  useEffect(() => { const timer = window.setInterval(() => setToday(localDate()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (loaded.error) return;
    try { localStorage.setItem(storageKey, JSON.stringify(data)); setError(''); }
    catch { setError('Your browser could not save these changes. Export your data before leaving.'); }
  }, [data, loaded.error, storageKey]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  const meals = data.meals.filter(m => m.date === today);
  const consumed = totals(meals);
  const remaining = (key: keyof Nutrition) => Math.max(0, data.targets[key] - consumed[key]);
  const percent = Math.min(100, consumed.calories / data.targets.calories * 100);
  function saveMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get('name')).trim();
    const date = String(fields.get('date'));
    const nutrition = readNutrition(form);
    if (!name || !validDate(date) || !isNutrition(nutrition)) return;
    const meal: Meal = { ...nutrition, id: editing?.id ?? crypto.randomUUID(), name, date, createdAt: editing?.createdAt ?? new Date().toISOString() };
    setData(d => ({ ...d, meals: editing ? d.meals.map(m => m.id === meal.id ? meal : m) : [...d.meals, meal] }));
    setNotice(editing ? 'Meal updated.' : 'Meal logged.');
    if (!data.setupCompleted && !returnToHistory) { setEditing(null); setModal('setup'); } else close();
  }
  function saveTargets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const targets = readNutrition(event.currentTarget);
    if (!isNutrition(targets, true)) { setNotice('Enter a target greater than zero for each nutrient.'); return; }
    setData(d => ({ ...d, targets })); setNotice('Nutrition targets updated.'); close();
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `fitmacro-${today}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function mealList(items: Meal[], date: string) {
    return items.length ? <div className="meal-list">{[...items].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(meal => <article className="meal" key={meal.id}><div className="meal-symbol" aria-hidden="true">◈</div><div className="meal-info"><h3>{meal.name}</h3><p>{fmt(meal.calories)} kcal <span>· P {fmt(meal.protein)} · C {fmt(meal.carbs)} · F {fmt(meal.fat)} g</span></p></div><button className="text-button" aria-label={`Edit ${meal.name}`} onClick={() => { setEditing(meal); setModal('meal'); }}>Edit</button><button className="icon delete" aria-label={`Delete ${meal.name}`} onClick={() => { if (window.confirm(`Delete “${meal.name}”?`)) { setData(d => ({ ...d, meals: d.meals.filter(m => m.id !== meal.id) })); setNotice('Meal deleted.'); } }}>×</button></article>)}</div> : <div className="empty"><p>No meals logged for this day.</p><button className="secondary" onClick={() => { setSelectedDate(date); setModal('meal'); }}>+ Log a meal</button></div>;
  }
  const hour = new Date().getHours();
  return <><header><div className="header-inner"><a className="brand" href="./">FitMacro<span>WEB</span></a><div className="account-actions"><button className="text-button" onClick={() => setModal('plans')}>{accessStatus && accessStatus.tier !== 'free' ? 'My subscription' : 'Get Pro'}</button>{user ? <><span className="account-name" title={user.email ?? undefined}>{user.displayName ?? user.email}</span><button className="text-button" onClick={() => { void logout().catch(err => setNotice(authMessage(err))); }}>Sign out</button></> : <button className="text-button" onClick={() => login()}>Sign in</button>}<button className="icon" aria-label="Nutrition settings" onClick={() => setModal('settings')}>⚙</button></div></div></header><main>
    <div className="date-heading"><span>{new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span><span className="pill">Overview</span></div>
    <div className="local-note">{user ? 'Signed in · Web logs are saved in this browser · Mobile sync isn’t connected yet' : 'Guest mode · Saved in this browser · No account needed'}</div>
    <div className="allowance-strip"><span>{accessStatus ? accessStatus.tier !== 'free' ? '✓ Pro access active · Web, iOS & Android' : `${accessStatus.remaining} / 3 free AI analyses left today${accessStatus.preview ? ' · Local preview' : ''}` : '3 free AI analyses daily · Manual logging is free'}</span><button onClick={() => setModal('plans')}>{accessStatus && accessStatus.tier !== 'free' ? 'Manage plan' : 'View plans →'}</button></div>
    {error && <p role="alert" className="error">{error} <button onClick={exportData}>Export data</button></p>}
    <div className="dashboard-grid"><section className="card nutrition"><p className="eyebrow">Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}</p><div className="hero"><div><h1>{fmt(consumed.calories)} <span>/ {fmt(data.targets.calories)} kcal</span></h1><p>Your daily nutrition, at a glance.</p></div><div className="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" /><circle className="ring-progress" cx="50" cy="50" r="43" pathLength="100" strokeDasharray={`${percent} 100`} /></svg><div><strong>{fmt(consumed.calories)}</strong><small>kcal</small></div></div></div>
    <div className="macro-bars">{(['protein','carbs','fat'] as const).map(key => <div className={`macro ${key}`} key={key}><div><strong>{labels[key]}</strong><span>{fmt(consumed[key])} / {fmt(data.targets[key])}g</span></div><progress aria-label={`${labels[key]} daily progress`} value={Math.min(consumed[key], data.targets[key])} max={data.targets[key]} /></div>)}</div>
    <div className="stats"><div><small>PROTEIN LEFT</small><strong>{fmt(remaining('protein'))}g</strong></div><div><small>CALORIES {consumed.calories > data.targets.calories ? 'OVER' : 'LEFT'}</small><strong>{fmt(Math.abs(data.targets.calories - consumed.calories))} kcal</strong></div></div></section>
    <section className="quick-section"><h2>Quick Access</h2><div className="quick-grid"><button className="quick primary" onClick={() => { setSelectedDate(today); setModal('meal'); }}><span className="quick-icon">＋</span><strong>Log Meal</strong><small>Track foods & macros</small></button><button className="quick" onClick={() => { setSelectedDate(today); setModal('history'); }}><span className="quick-icon">↶</span><strong>Meal History</strong><small>View and edit past logs</small></button></div><div className="card summary"><h2>Your daily targets</h2><p>Keep an eye on what’s left for today.</p><div className="summary-grid">{(['protein','carbs','fat'] as const).map(key => <div key={key}><small>{labels[key]} left</small><strong>{fmt(remaining(key))}g</strong></div>)}</div><button className="text-button" onClick={() => setModal('settings')}>Adjust nutrition targets →</button></div></section>
    <section className="today"><div className="section-heading"><h2>Meals Today</h2><span>{meals.length ? `${meals.length} meal${meals.length === 1 ? '' : 's'} logged` : 'Nothing logged yet'}</span></div><div className="card">{mealList(meals, today)}{meals.length > 0 && <button className="secondary full" onClick={() => { setSelectedDate(today); setModal('meal'); }}>+ Add another meal</button>}</div></section></div>
    </main><nav className="bottom-nav" aria-label="Dashboard actions"><div><button className="text-button" onClick={() => setModal('coach')}>✧ AI Coach</button><button className="add" aria-label="Log a meal" onClick={() => { setSelectedDate(today); setModal('meal'); }}>＋</button><button className="text-button" onClick={() => { setSelectedDate(today); setModal('history'); }}>↶ History</button></div></nav>
    {modal === 'plans' && <Modal title="Plans & subscription" close={close} variant="plans-dialog"><SubscriptionPanel signedIn={Boolean(user)} login={() => login('plans')} /></Modal>}
    {modal === 'setup' && <Modal title="Personalize your targets" close={close} variant="setup-dialog"><Onboarding profile={data.profile} skip={close} complete={(profile, targets) => { setData(d => ({ ...d, profile, targets, setupCompleted: true })); setModal(null); setNotice('Your personalized targets are ready.'); }} /></Modal>}
    {modal === 'meal' && <Modal key={editing?.id ?? 'new-meal'} title={editing ? 'Edit Meal' : 'Log Meal'} close={close} variant="capture-dialog"><MealEntry editing={editing} date={selectedDate} save={saveMeal} close={close} initialDescription={initialDescription} /></Modal>}
    {modal === 'settings' && <Modal title="Nutrition Targets" close={close}><button className="secondary full recalculate" onClick={() => setModal('setup')}>Recalculate from my profile</button><form onSubmit={saveTargets}><NutritionFields values={data.targets} /><button className="primary full" type="submit">Update Targets</button></form><div className="storage-settings"><h3>Your data</h3><p className="muted">Logs are stored on this device’s browser. Export a backup to keep a copy.</p><button className="secondary full" onClick={exportData}>Export meal data</button></div></Modal>}
    {modal === 'history' && <Modal title="Meal History" close={close} variant="history-dialog"><MealHistory meals={data.meals} favorites={data.favorites ?? []} date={selectedDate} today={today} selectDate={setSelectedDate} add={() => { setReturnToHistory(true); setModal('meal'); }} edit={meal => { setEditing(meal); setReturnToHistory(true); setModal('meal'); }} remove={meal => { if (window.confirm(`Delete “${meal.name}”?`)) setData(d => ({ ...d, meals: d.meals.filter(m => m.id !== meal.id) })); }} toggleFavorite={meal => setData(d => { const favorites = d.favorites ?? []; const exists = favorites.some(f => favoriteKey(f) === favoriteKey(meal)); return { ...d, favorites: exists ? favorites.filter(f => favoriteKey(f) !== favoriteKey(meal)) : [...favorites, { ...meal, id: crypto.randomUUID() }] }; })} logFavorite={meal => { setData(d => ({ ...d, meals: [...d.meals, { ...meal, id: crypto.randomUUID(), date: today, createdAt: new Date().toISOString() }] })); }} /></Modal>}
    {modal === 'coach' && <Modal title="FitMacro AI Coach" close={close}><p className="muted">The AI coach will be available once your FitMacro AI service is connected. You can log meals manually in the meantime.</p><button className="primary full" onClick={() => { setSelectedDate(today); setModal('meal'); }}>Log a meal</button></Modal>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </>;
}

function returningGuest() {
  try { return localStorage.getItem('fitmacro.web.guest') === 'true'; } catch { return false; }
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<'public' | 'login' | 'dashboard'>(() => returningGuest() ? 'dashboard' : 'public');
  const [boot, setBoot] = useState<'meal' | 'plans' | null>(null);
  const [initialDescription, setInitialDescription] = useState('');
  useEffect(() => onAuthStateChanged(auth, current => { setUser(current); if (current) setScreen('dashboard'); }, () => setUser(null)), []);
  function guest(action: 'meal' | 'plans' | null = null, description = '') {
    try { localStorage.setItem('fitmacro.web.guest', 'true'); } catch { /* Guest mode works without storage. */ }
    setInitialDescription(description); setBoot(action); setScreen('dashboard');
  }
  async function logout() {
    await signOut(auth);
    try { localStorage.removeItem('fitmacro.web.guest'); } catch { /* Optional preference. */ }
    setBoot(null); setInitialDescription(''); setScreen('public');
  }
  if (screen === 'public' && !user) return <Landing start={description => guest('meal', description)} login={() => setScreen('login')} dashboard={() => guest()} plans={() => guest('plans')} />;
  if (screen === 'login' && !user) return <Login guest={() => guest()} />;
  return <Dashboard key={user?.uid ?? 'guest'} user={user} login={resume => { setBoot(resume ?? null); setScreen('login'); }} logout={logout} boot={boot} initialDescription={initialDescription} />;
}
