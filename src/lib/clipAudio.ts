/** Studio's audio step: pull the soundtrack out of a raw phone clip in the
 *  browser, as 16 kHz mono 16-bit WAV — what Whisper wants, and ~32 KB a
 *  second, so a 200 MB video sends a few MB to the Worker instead of
 *  the whole file. */
export const WAV_RATE = 16000;
export const MAX_TRANSCRIBE_S = 240;

/** PCM float samples → a WAV file. Pure; tested. */
export function encodeWav(samples: Float32Array, rate = WAV_RATE): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Decode the clip's audio and resample it to 16 kHz mono. Only the first
 *  four minutes are kept — the Worker's limit for one transcription. */
export async function extractWav(file: Blob): Promise<{ wav: Blob; duration: number; truncated: boolean }> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try { decoded = await ctx.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error("This clip's audio couldn't be read in the browser. Try an .mp4 or .mov from your phone's camera."); }
  finally { void ctx.close(); }
  const keep = Math.min(decoded.duration, MAX_TRANSCRIBE_S);
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(keep * WAV_RATE)), WAV_RATE);
  const src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return { wav: encodeWav(out.getChannelData(0)), duration: decoded.duration, truncated: decoded.duration > MAX_TRANSCRIBE_S };
}
