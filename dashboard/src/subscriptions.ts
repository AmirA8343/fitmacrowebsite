import { auth } from './firebase.js';
import type { Access } from '../../shared/plans.js';
export async function authorizedFetch(url: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
}
export async function getAccess(): Promise<Access> {
  const response = await authorizedFetch('/api/subscription');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not check subscription access.');
  return result;
}
export async function beginCheckout() {
  const response = await authorizedFetch('/api/subscription', { method: 'POST' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Checkout is unavailable.');
  const url = new URL(result.url);
  if (url.protocol !== 'https:' || url.hostname !== 'pay.rev.cat') throw new Error('Invalid checkout address.');
  window.location.assign(url.toString());
}
