import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { availableModes, pickMime, uploadProblem, MAX_SECONDS, VIDEO_BITRATE } from '../../data/clientVideo';
import type { RecordMode } from '../../data/clientVideo';

const LABEL: Record<RecordMode, string> = { screen: 'Screen + camera', camera: 'Camera only', upload: 'Upload a recording' };

/** Loom-style recorder. Screen + camera (camera bubble drawn over the screen),
 *  camera only, or upload an existing recording (the iPad path). Saves to the
 *  private client-videos bucket and returns the new client_videos row. */
export default function VideoRecorder({ clientId, defaultTitle, onSaved, onCancel }: { clientId: string | null; defaultTitle: string; onSaved: (row: { id: string; share_token: string; title: string }) => void; onCancel: () => void }) {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  const modes = availableModes({ getDisplayMedia: !!md?.getDisplayMedia, getUserMedia: !!md?.getUserMedia, mediaRecorder: typeof MediaRecorder !== 'undefined' });
  const [mode, setMode] = useState<RecordMode>(modes[0]);
  const [state, setState] = useState<'idle' | 'recording' | 'review' | 'saving'>('idle');
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [err, setErr] = useState('');
  const live = useRef<HTMLVideoElement>(null);
  const cleanup = useRef<() => void>(() => {});
  const rec = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const preview = useMemo(() => (blob ? URL.createObjectURL(blob) : ''), [blob]);
  useEffect(() => () => { cleanup.current(); }, []);
  useEffect(() => { if (state === 'recording' && live.current && streamRef.current) { live.current.srcObject = streamRef.current; live.current.muted = true; void live.current.play().catch(() => {}); } }, [state]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const start = async () => {
    setErr('');
    try {
      const cam = await md!.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true } });
      let stream: MediaStream = cam;
      const stops: (() => void)[] = [() => cam.getTracks().forEach((t) => t.stop())];
      if (mode === 'screen') {
        const screen = await md!.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
        stops.push(() => screen.getTracks().forEach((t) => t.stop()));
        const sv = document.createElement('video'); sv.srcObject = screen; sv.muted = true; await sv.play();
        const cv = document.createElement('video'); cv.srcObject = cam; cv.muted = true; await cv.play();
        const canvas = document.createElement('canvas');
        const s = screen.getVideoTracks()[0].getSettings();
        canvas.width = Math.min(1920, s.width ?? 1280); canvas.height = Math.round(canvas.width * ((s.height ?? 720) / (s.width ?? 1280)));
        const ctx = canvas.getContext('2d')!;
        let raf = 0;
        const draw = () => {
          ctx.drawImage(sv, 0, 0, canvas.width, canvas.height);
          const r = Math.round(canvas.height * 0.13), x = r + 24, y = canvas.height - r - 24;
          ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
          const side = Math.min(cv.videoWidth, cv.videoHeight) || 1;
          ctx.drawImage(cv, (cv.videoWidth - side) / 2, (cv.videoHeight - side) / 2, side, side, x - r, y - r, r * 2, r * 2);
          ctx.restore();
          raf = requestAnimationFrame(draw);
        };
        draw();
        stops.push(() => cancelAnimationFrame(raf));
        stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...cam.getAudioTracks()]);
        // The person ends sharing from the browser bar: stop the recording too.
        screen.getVideoTracks()[0].addEventListener('ended', () => rec.current?.state === 'recording' && rec.current.stop());
      }
      streamRef.current = stream;
      const mime = pickMime((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: VIDEO_BITRATE });
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      let timer = 0;
      r.onstop = () => { clearInterval(timer); cleanup.current(); setBlob(new Blob(chunks, { type: (r.mimeType || mime || 'video/webm').split(';')[0] })); setState('review'); };
      cleanup.current = () => stops.forEach((f) => f());
      rec.current = r;
      r.start(1000);
      setSecs(0); setState('recording');
      const t0 = Date.now();
      timer = window.setInterval(() => { const n = Math.floor((Date.now() - t0) / 1000); setSecs(n); if (n >= MAX_SECONDS && r.state === 'recording') r.stop(); }, 250);
    } catch (e) {
      cleanup.current();
      setErr(e instanceof Error && e.name === 'NotAllowedError' ? 'Camera or screen permission was blocked. Allow it in the browser and try again.' : `Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const p = uploadProblem(f);
    if (p) { setErr(p); return; }
    setErr(''); setBlob(f); setState('review');
  };

  const save = async () => {
    if (!blob) return;
    setState('saving'); setErr('');
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { setErr('Sign in again, then save.'); setState('review'); return; }
    const type = blob.type || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : type.includes('quicktime') ? 'mov' : 'webm';
    const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await supabase.storage.from('client-videos').upload(path, blob, { contentType: type, upsert: false });
    if (up.error) { setErr(`Upload failed: ${up.error.message}`); setState('review'); return; }
    const { data, error } = await supabase.from('client_videos').insert({ client_id: clientId, title: title.trim() || defaultTitle, storage_path: path, mime: type, duration_s: secs || null, size_bytes: blob.size }).select('id,share_token,title').single();
    if (error || !data) { setErr(`Saved the file but not the link: ${error?.message ?? 'unknown'}`); setState('review'); return; }
    onSaved(data as { id: string; share_token: string; title: string });
  };

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {state === 'idle' && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {modes.map((m) => <button key={m} className={`mm-btn${mode === m ? ' mm-btn--primary' : ''}`} style={{ height: 36 }} onClick={() => setMode(m)}>{LABEL[m]}</button>)}
          </div>
          {!modes.includes('screen') && <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>This device can't record its screen from the browser. Record yourself on camera, or record the screen with the iPad's Screen Recording and upload it.</span>}
          {mode === 'upload'
            ? <input type="file" accept="video/*" onChange={(e) => pickFile(e.target.files?.[0])} />
            : <button className="mm-btn mm-btn--primary" style={{ height: 44 }} onClick={() => void start()}>Start recording</button>}
          <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Up to {MAX_SECONDS / 60} minutes. Nothing is sent until you send the email.</span>
        </>
      )}
      {state === 'recording' && (
        <>
          <video ref={live} playsInline style={{ width: '100%', borderRadius: 'var(--g-r-md)', background: '#000' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--danger)', fontWeight: 700 }}>● {mmss}</span>
            <button className="mm-btn mm-btn--primary" style={{ height: 40, marginLeft: 'auto' }} onClick={() => rec.current?.stop()}>Stop</button>
          </div>
        </>
      )}
      {(state === 'review' || state === 'saving') && blob && (
        <>
          <video src={preview} controls playsInline style={{ width: '100%', borderRadius: 'var(--g-r-md)', background: '#000' }} />
          <input className="mm-input" style={{ height: 40, padding: '0 10px', borderRadius: 'var(--g-r-md)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 15 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title the client sees" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="mm-btn mm-btn--primary" style={{ height: 40 }} disabled={state === 'saving'} onClick={() => void save()}>{state === 'saving' ? 'Uploading…' : 'Save and get the link'}</button>
            <button className="mm-btn" style={{ height: 40 }} disabled={state === 'saving'} onClick={() => { setBlob(null); setState('idle'); }}>Redo</button>
          </div>
        </>
      )}
      {err && <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>{err}</span>}
      {state === 'idle' && <button className="mm-btn" style={{ height: 34, alignSelf: 'flex-start' }} onClick={onCancel}>Cancel</button>}
    </div>
  );
}
