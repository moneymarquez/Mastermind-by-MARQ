// Client video helpers (spec Part 4). Pure, shared by the recorder and tests.

/** 5 minutes at ~1.2 Mbps stays under the 50 MB storage cap. */
export const MAX_SECONDS = 300;
export const MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_BITRATE = 1_200_000;

export type RecordMode = 'screen' | 'camera' | 'upload';

/** Which ways to make a video this device supports. iPad/iPhone Safari has no
 *  screen capture, so it gets camera-only or upload. Pure (pass navigator bits in). */
export function availableModes(o: { getDisplayMedia: boolean; getUserMedia: boolean; mediaRecorder: boolean }): RecordMode[] {
  const out: RecordMode[] = [];
  if (o.getDisplayMedia && o.getUserMedia && o.mediaRecorder) out.push('screen');
  if (o.getUserMedia && o.mediaRecorder) out.push('camera');
  out.push('upload');
  return out;
}

/** First container this browser can record. Pure (pass isTypeSupported in). */
export function pickMime(isSupported: (t: string) => boolean): string {
  for (const t of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a', 'video/mp4']) if (isSupported(t)) return t;
  return '';
}

/** Whether a file can go up as-is. Pure. */
export function uploadProblem(f: { size: number; type: string }): string | null {
  if (!/^video\//.test(f.type)) return 'That isn\'t a video file.';
  if (f.size > MAX_BYTES) return `That video is ${(f.size / 1048576).toFixed(0)} MB. The limit is 50 MB, so trim it or record a shorter one.`;
  return null;
}

/** The email that carries the link. Pure. */
export function videoEmail(o: { firstName: string; title: string; link: string; sender: string }): { subject: string; body: string } {
  return {
    subject: o.title,
    body: `Hi ${o.firstName},\n\nI recorded a quick video for you: ${o.link}\n\nIt's a couple of minutes. You can reply or book a call right under it.\n\n${o.sender}`,
  };
}

export const shareUrl = (origin: string, token: string) => `${origin.replace(/\/+$/, '')}/v/${token}`;
