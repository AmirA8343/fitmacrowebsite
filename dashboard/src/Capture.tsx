import { t, getLanguage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
export async function preparePhoto(file: Blob): Promise<string> {
  if (file.size > 20000000) throw new Error("Choose a photo smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error("Photo processing is unavailable in this browser.");
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const photo = canvas.toDataURL('image/jpeg', 0.8);
    if (photo.length > 2800000) throw new Error("This photo is too large. Choose a smaller image.");
    return photo;
  } catch (e) { throw new Error(e instanceof Error && e.message.includes('large') ? e.message : "Could not read that photo. Try a JPEG, PNG, or WebP image."); }
  finally { URL.revokeObjectURL(url); }
}
export default function Capture({ mode, photo, barcode, cancel }: { mode: 'camera' | 'scan'; photo: (data: string) => void; barcode: (code: string) => void; cancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null); const [error,setError] = useState(''); const [ready,setReady] = useState(false);
  const onBarcode = useRef(barcode); onBarcode.current = barcode;
  useEffect(() => {
    setReady(false); setError('');
    let disposed = false; let stream: MediaStream | undefined; let controls: IScannerControls | undefined; let found = false;
    const stop = () => { controls?.stop(); stream?.getTracks().forEach(t => t.stop()); };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (disposed) { stop(); return; }
        if (mode === 'scan') {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (disposed) { stop(); return; }
          controls = await new BrowserMultiFormatReader().decodeFromStream(stream, video.current!, result => {
            if (!disposed && !found && result && /^(?:\d{8}|\d{12,14})$/.test(result.getText())) { found = true; stop(); onBarcode.current(result.getText()); }
          });
          if (disposed || found) stop();
        } else { video.current!.srcObject = stream; await video.current!.play(); }
        if (!disposed) setReady(true);
      } catch { stop(); if (!disposed) setError(t("Camera unavailable. Allow camera access, choose a photo, or type the barcode below.")); }
    })();
    return () => { disposed = true; stop(); };
  }, [mode]);
  async function snap() {
    const v = video.current; if (!v?.videoWidth) return;
    const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight; canvas.getContext('2d')!.drawImage(v,0,0);
    canvas.toBlob(async blob => { if (blob) try { photo(await preparePhoto(blob)); } catch (e) { setError((e as Error).message); } }, 'image/jpeg',0.9);
  }
  return <div className="browser-capture"><video ref={video} muted playsInline autoPlay aria-label={mode === 'scan' ? t("Barcode scanner camera") : t("Meal camera")} />{error && <p role="alert">{t(error)}</p>}{mode === 'scan' && !error && <p role="status">{t("Point the camera at the product barcode.")}</p>}<div>{mode === 'camera' && <button type="button" className="primary" disabled={!ready} onClick={() => void snap()}>{t("Take photo")}</button>}<button type="button" className="secondary" onClick={cancel}>{t("Stop camera")}</button></div></div>;
}
