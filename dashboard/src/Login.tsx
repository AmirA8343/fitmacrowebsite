import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';
export function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'The email or password is incorrect. Try again or reset your password.';
    case 'auth/email-already-in-use': return 'This email already has an account. Sign in instead.';
    case 'auth/weak-password': case 'auth/password-does-not-meet-requirements': return 'Choose a stronger password that meets your account’s password requirements.';
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/unauthorized-domain': return 'Sign-in isn’t enabled for this web address yet. You can continue as a guest.';
    case 'auth/operation-not-allowed': return 'This sign-in method isn’t enabled for the web yet. Try another method or continue as a guest.';
    case 'auth/popup-blocked': return 'Your browser blocked the sign-in window. Allow popups and try again.';
    case 'auth/popup-closed-by-user': case 'auth/cancelled-popup-request': return 'Sign-in was cancelled. You can try again or continue as a guest.';
    case 'auth/account-exists-with-different-credential': return 'Use the sign-in method you originally used for this email.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later or continue as a guest.';
    case 'auth/network-request-failed': return 'Couldn’t connect. Check your connection or continue as a guest.';
    default: return 'Sign-in couldn’t be completed. Please try again or continue as a guest.';
  }
}
export default function Login({ guest }: { guest: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (err) { setError(authMessage(err)); } finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const email = String(fields.get('email')).trim(); const password = String(fields.get('password') ?? '');
    void run(async () => {
      if (mode === 'reset') { await sendPasswordResetEmail(auth, email); setMessage('If an account exists for this email, you’ll receive a reset link.'); }
      else if (mode === 'signup') await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    });
  }
  function changeMode(next: typeof mode) { setMode(next); setError(''); setMessage(''); }
  return <main className="entry-page"><a className="brand" href="./">FitMacro<span>WEB</span></a><section className="entry-card"><div className="entry-symbol" aria-hidden="true">♡</div><p className="eyebrow">Your nutrition, your way</p><h1>{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome to FitMacro'}</h1><p className="entry-subtitle">{mode === 'reset' ? 'Enter your account email to request a password reset.' : 'Sign in with your FitMacro account, or start tracking as a guest.'}</p>
    <form onSubmit={submit}><fieldset disabled={busy}><label>Email<input type="email" name="email" required autoComplete="email" placeholder="you@example.com" /></label>{mode !== 'reset' && <label>Password<input type="password" name="password" required minLength={mode === 'signup' ? 6 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'} /></label>}<button className="primary full" type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button></fieldset></form>
    {error && <p className="entry-error" role="alert">{error}</p>}{message && <p className="entry-message" role="status">{message}</p>}
    {mode === 'login' && <><button className="text-button" disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button><div className="entry-divider">or</div><div className="social-logins"><button className="secondary" disabled={busy} onClick={() => void run(() => signInWithPopup(auth, new GoogleAuthProvider()))}>Continue with Google</button><button className="secondary" disabled={busy} onClick={() => { const provider = new OAuthProvider('apple.com'); provider.addScope('email'); provider.addScope('name'); void run(() => signInWithPopup(auth, provider)); }}>Continue with Apple</button></div></>}
    <div className="entry-switch">{mode === 'login' ? <>New to FitMacro? <button className="text-button" disabled={busy} onClick={() => changeMode('signup')}>Create an account</button></> : <button className="text-button" disabled={busy} onClick={() => changeMode('login')}>Back to sign in</button>}</div>
    <button type="button" className="guest-button" onClick={guest}>Continue as guest →</button><p className="entry-footnote">No account needed. Your web logs and setup stay in this browser, including when signed in.</p></section></main>;
}
