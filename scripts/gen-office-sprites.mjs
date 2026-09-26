// Generates the View Office PLACEHOLDER sprite sheets (public/office/sprites).
// Replace any sheet with real art (Higgsfield, or a CC0 pack like Kenney) by
// keeping the same layout — see public/office/README.md. Run: node scripts/gen-office-sprites.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const F = 32, COLS = 4, ROWS = 5; // rows: working, idle, waiting, error, asleep
const OUT = new URL('../public/office/sprites/', import.meta.url);
mkdirSync(OUT, { recursive: true });

// A deliberately limited palette so every sheet reads as one set.
const P = { skin: [241, 196, 160], skin2: [214, 160, 124], eye: [30, 30, 40], paper: [245, 245, 235], zz: [180, 200, 255], red: [235, 60, 90], smoke: [140, 140, 150], outline: [20, 20, 28] };
const WORKERS = {
  orchestrator: { shirt: [230, 180, 40], hair: [60, 40, 30], acc: 'crown' },
  scout: { shirt: [70, 170, 90], hair: [90, 60, 30], acc: 'cap' },
  analyst: { shirt: [70, 120, 220], hair: [30, 30, 40], acc: 'glasses' },
  teardown: { shirt: [200, 70, 70], hair: [40, 30, 30], acc: 'band' },
  supplier: { shirt: [150, 110, 70], hair: [80, 50, 30], acc: 'cap' },
  brandlab: { shirt: [150, 90, 200], hair: [200, 120, 60], acc: 'beret' },
  builder: { shirt: [240, 140, 40], hair: [50, 40, 30], acc: 'hardhat' },
  content: { shirt: [230, 100, 160], hair: [30, 20, 20], acc: 'headset' },
  analytics: { shirt: [40, 170, 170], hair: [60, 60, 70], acc: 'glasses' },
  lead_filter: { shirt: [110, 140, 90], hair: [40, 30, 20], acc: 'band' },
  campaign_planner: { shirt: [90, 100, 200], hair: [120, 80, 40], acc: 'glasses' },
  script_copy: { shirt: [220, 200, 80], hair: [30, 30, 30], acc: 'headset' },
  inbound_tracker: { shirt: [80, 180, 220], hair: [70, 40, 20], acc: 'headset' },
  campaign_scorer: { shirt: [200, 90, 120], hair: [20, 20, 20], acc: 'cap' },
  account_auditor: { shirt: [120, 120, 200], hair: [90, 60, 40], acc: 'glasses' },
  trend_researcher: { shirt: [100, 200, 130], hair: [150, 90, 50], acc: 'band' },
  idea_script: { shirt: [240, 170, 90], hair: [40, 30, 30], acc: 'beret' },
  clip_editor: { shirt: [170, 80, 200], hair: [30, 30, 40], acc: 'headset' },
  post_planner: { shirt: [90, 160, 200], hair: [60, 40, 30], acc: 'cap' },
  content_analytics: { shirt: [60, 150, 150], hair: [100, 70, 40], acc: 'glasses' },
};

function png(w, h, rgba) {
  const crc = (buf) => { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function sheet(spec) {
  const W = F * COLS, H = F * ROWS;
  const buf = Buffer.alloc(W * H * 4);
  const px = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  const dark = (c, k = 0.7) => c.map((v) => Math.round(v * k));
  for (let row = 0; row < ROWS; row++) for (let f = 0; f < COLS; f++) {
    const ox = f * F, oy = row * F;
    let bob = 0, dx = 0, eyesClosed = false, armUp = [false, false];
    if (row === 0) { armUp = f % 2 === 0 ? [true, false] : [false, true]; }          // working: typing
    if (row === 1) { bob = f === 1 || f === 2 ? -1 : 0; dx = f === 2 ? 1 : f === 3 ? -1 : 0; } // idle: bob + look
    if (row === 2) { bob = f % 2 ? -1 : 0; armUp = [true, true]; }                   // waiting: paper up
    if (row === 3) { dx = [0, -1, 1, 0][f]; }                                        // error: shake
    if (row === 4) { eyesClosed = true; bob = f < 2 ? 1 : 2; }                       // asleep
    const cx = ox + 16 + dx, top = oy + 6 + bob;
    // body
    rect(cx - 6, top + 11, 12, 10, spec.shirt); rect(cx - 6, top + 20, 12, 1, dark(spec.shirt));
    // arms
    rect(cx - 8, top + (armUp[0] ? 9 : 12), 2, 6, spec.shirt); rect(cx + 6, top + (armUp[1] ? 9 : 12), 2, 6, spec.shirt);
    rect(cx - 8, top + (armUp[0] ? 8 : 17), 2, 2, P.skin); rect(cx + 6, top + (armUp[1] ? 8 : 17), 2, 2, P.skin);
    // legs
    rect(cx - 4, top + 21, 3, 4, P.outline); rect(cx + 1, top + 21, 3, 4, P.outline);
    // head
    rect(cx - 5, top, 10, 10, P.skin); rect(cx - 5, top + 9, 10, 1, P.skin2);
    rect(cx - 5, top, 10, 3, spec.hair); rect(cx - 5, top + 3, 1, 3, spec.hair); rect(cx + 4, top + 3, 1, 3, spec.hair);
    if (eyesClosed) { rect(cx - 3, top + 6, 2, 1, P.eye); rect(cx + 1, top + 6, 2, 1, P.eye); }
    else { rect(cx - 3, top + 5, 1, 2, P.eye); rect(cx + 2, top + 5, 1, 2, P.eye); }
    // accessory
    if (spec.acc === 'crown') { rect(cx - 4, top - 3, 8, 3, [250, 210, 60]); px(cx - 4, top - 4, [250, 210, 60]); px(cx, top - 4, [250, 210, 60]); px(cx + 3, top - 4, [250, 210, 60]); }
    if (spec.acc === 'cap') { rect(cx - 5, top - 1, 10, 2, dark(spec.shirt, 0.8)); rect(cx + 3, top + 1, 4, 1, dark(spec.shirt, 0.8)); }
    if (spec.acc === 'hardhat') { rect(cx - 6, top - 2, 12, 3, [250, 200, 40]); }
    if (spec.acc === 'beret') { rect(cx - 6, top - 1, 9, 2, dark(spec.shirt, 0.6)); }
    if (spec.acc === 'band') { rect(cx - 5, top + 2, 10, 1, P.red); }
    if (spec.acc === 'glasses' && !eyesClosed) { rect(cx - 4, top + 4, 3, 1, P.outline); rect(cx + 1, top + 4, 3, 1, P.outline); }
    if (spec.acc === 'headset') { rect(cx - 6, top + 4, 1, 4, P.outline); rect(cx + 5, top + 4, 1, 4, P.outline); rect(cx - 6, top - 1, 12, 1, P.outline); }
    // state props
    if (row === 2) { rect(cx - 5, top + 4 - 8, 10, 7, P.paper); rect(cx - 3, top - 2, 6, 1, P.eye); }
    if (row === 3) { px(cx + 9, oy + 3 + (f % 2), P.smoke); px(cx + 10, oy + 2, P.smoke); px(cx + 8, oy + 1 + (f % 2), P.smoke); }
    if (row === 4) { const zx = cx + 7 + (f % 2), zy = oy + 2 + (f > 1 ? 0 : 1); rect(zx, zy, 3, 1, P.zz); px(zx + 1, zy + 1, P.zz); rect(zx, zy + 2, 3, 1, P.zz); }
  }
  return png(W, H, buf);
}

for (const [key, spec] of Object.entries(WORKERS)) writeFileSync(new URL(`${key}.png`, OUT), sheet(spec));
console.log(`wrote ${Object.keys(WORKERS).length} placeholder sheets (${F * COLS}×${F * ROWS})`);
