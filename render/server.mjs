// Clip render service (brief Phase 3.3). Runs in a Cloudflare Container
// (or any box with ffmpeg). One job at a time:
//   POST /render  { clip_id, user_id, input_url, upload_url, output_path, args, callback }
//   header x-render-signature = HMAC-SHA256(RENDER_SECRET, body) hex
// Downloads the raw clip, runs ffmpeg with the Worker-built args ("in" and
// "out.mp4" are swapped for temp paths), uploads to the signed URL, and
// calls back with the same signature scheme. GET /health for the probe.
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SECRET = process.env.RENDER_SECRET ?? '';
const PORT = Number(process.env.PORT ?? 8080);
const sign = (body) => createHmac('sha256', SECRET).update(body).digest('hex');
const valid = (body, sig) => { if (!SECRET || !sig) return false; const a = Buffer.from(sign(body)), b = Buffer.from(sig); return a.length === b.length && timingSafeEqual(a, b); };
let busy = false;

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-600)}`))));
  });
}

async function run(job) {
  const dir = await mkdtemp(join(tmpdir(), 'clip-'));
  const input = join(dir, 'in'), output = join(dir, 'out.mp4');
  let result;
  try {
    const src = await fetch(job.input_url);
    if (!src.ok) throw new Error(`download ${src.status}`);
    await writeFile(input, Buffer.from(await src.arrayBuffer()));
    await ffmpeg(job.args.map((a) => (a === 'in' ? input : a === 'out.mp4' ? output : a)));
    const up = await fetch(job.upload_url, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'x-upsert': 'true' }, body: await readFile(output) });
    if (!up.ok) throw new Error(`upload ${up.status} ${(await up.text()).slice(0, 200)}`);
    result = { clip_id: job.clip_id, user_id: job.user_id, ok: true, output_path: job.output_path };
  } catch (e) {
    result = { clip_id: job.clip_id, user_id: job.user_id, ok: false, error: String(e?.message ?? e) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  const body = JSON.stringify(result);
  await fetch(job.callback, { method: 'POST', headers: { 'content-type': 'application/json', 'x-render-signature': sign(body) }, body }).catch(() => {});
}

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') { res.end('ok'); return; }
  if (req.method !== 'POST' || req.url !== '/render') { res.statusCode = 404; res.end(); return; }
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!valid(body, req.headers['x-render-signature'])) { res.statusCode = 401; res.end('bad signature'); return; }
  if (busy) { res.statusCode = 429; res.end('busy'); return; }
  let job;
  try { job = JSON.parse(body); } catch { res.statusCode = 400; res.end('bad json'); return; }
  if (!Array.isArray(job.args) || !job.input_url || !job.upload_url || !job.callback) { res.statusCode = 400; res.end('missing fields'); return; }
  const id = randomUUID();
  busy = true;
  run(job).finally(() => { busy = false; });
  res.setHeader('content-type', 'application/json');
  res.statusCode = 202;
  res.end(JSON.stringify({ job_id: id }));
}).listen(PORT, () => console.log(`render service on :${PORT}`));
