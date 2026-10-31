import { useEffect, useState } from 'react';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => { const req = indexedDB.open('fitmacro-local-photos',1); req.onupgradeneeded = () => req.result.createObjectStore('photos'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
export async function localPhoto(id: string, value?: string | null): Promise<string | undefined> {
  const db = await database();
  try { return await new Promise((resolve,reject) => { const tx = db.transaction('photos', value === undefined ? 'readonly' : 'readwrite'); const store = tx.objectStore('photos'); const req = value === undefined ? store.get(id) : value === null ? store.delete(id) : store.put(value,id); tx.oncomplete = () => resolve(value === undefined ? req.result : undefined); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
  finally { db.close(); }
}
export default function LocalPhoto({ id }: { id?: string }) {
  const [src,setSrc] = useState<string>();
  useEffect(() => { let active = true; setSrc(undefined); if (id) void localPhoto(id).then(value => { if (active) setSrc(value); }).catch(() => {}); return () => { active = false; }; },[id]);
  return src ? <img className="local-meal-photo" src={src} alt="Meal saved in this browser" /> : null;
}
