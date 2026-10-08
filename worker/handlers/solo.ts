// Solo Masterminds routes (October build, Phase 4). All need a signed-in user.
//   POST /api/solo/import-parse     { text } | multipart file (.md .txt .json .pdf .docx) → ImportData + method
//   POST /api/solo/checkin-run      { week_start? }   build this week's check-in now
//   POST /api/solo/checkin-chat     { id, message }   push back; it adjusts
//   POST /api/solo/money-run        this week's Money Move now
//   POST /api/solo/peptide-summary  { question? }     summary of the user's own log (no dosing advice)
import { requireUser } from '../lib/auth';
import { Sb, json } from '../lib/sb';
import type { SbEnv } from '../lib/sb';
import { CapReached } from '../lib/ai';
import { parseImport, docxText, pdfText, runCheckin, checkinChat, runMoneyMove, peptideSummary } from '../lib/solo';

export type SoloEnv = SbEnv & { VITE_SUPABASE_ANON_KEY: string; ANTHROPIC_API_KEY?: string };
const MAX_FILE = 15 * 1024 * 1024;

export async function soloRoute(request: Request, env: SoloEnv, path: string): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const user = await requireUser(request, env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  if (user instanceof Response) return user;
  const sb = new Sb(env);
  try {
    if (path === 'import-parse') {
      let text = '';
      let fileName: string | null = null;
      if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
        const form = await request.formData();
        const f = form.get('file');
        if (f && typeof f !== 'string') {
          if (f.size > MAX_FILE) return json({ error: 'That file is over 15 MB.' }, 413);
          fileName = f.name;
          const bytes = new Uint8Array(await f.arrayBuffer());
          const name = f.name.toLowerCase();
          if (name.endsWith('.docx')) text = await docxText(bytes);
          else if (name.endsWith('.pdf')) text = await pdfText(env.ANTHROPIC_API_KEY, sb, user.id, bytes);
          else text = new TextDecoder().decode(bytes);
        }
        text = `${text}\n${String(form.get('text') ?? '')}`.trim();
      } else {
        const b = (await request.json().catch(() => ({}))) as { text?: string };
        text = String(b.text ?? '');
      }
      if (!text.trim()) return json({ error: 'Paste something or drop a file first.' }, 400);
      const r = await parseImport(env.ANTHROPIC_API_KEY, sb, user.id, text);
      return json({ ...r, text: text.slice(0, 200000), file_name: fileName });
    }
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (path === 'checkin-run') return json(await runCheckin(env.ANTHROPIC_API_KEY, sb, user.id, typeof b.week_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.week_start) ? b.week_start : undefined));
    if (path === 'checkin-chat') {
      if (typeof b.id !== 'string' || typeof b.message !== 'string' || !b.message.trim()) return json({ error: 'id and message are required.' }, 400);
      return json(await checkinChat(env.ANTHROPIC_API_KEY, sb, user.id, b.id, b.message));
    }
    if (path === 'money-run') { const r = await runMoneyMove(env.ANTHROPIC_API_KEY, sb, user.id); return json(r, r.ok ? 200 : 409); }
    if (path === 'peptide-summary') return json({ text: await peptideSummary(env.ANTHROPIC_API_KEY, sb, user.id, typeof b.question === 'string' ? b.question : undefined) });
    return json({ error: `Unknown route ${path}` }, 404);
  } catch (e) {
    if (e instanceof CapReached) return json({ error: e.message, capReached: true }, 429);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
