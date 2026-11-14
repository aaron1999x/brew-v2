// One-off generator for the PLACEHOLDER icons in public/brand/ (no image library needed).
//   node scripts/make-icons.mjs
// A filled circle in the accent colour with a white letter "A". Replace public/brand/ when the
// real logo exists; nothing else depends on how these files were made.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ACCENT = [0x00, 0x7a, 0x87]; // --color-brand-600
const LETTER = [0xff, 0xff, 0xff]; // --color-neutral-0
const OUT = 'public/brand';

// ---- Letter "A" as three thick line segments, in a 0..1 unit square ----
const STROKE = 0.095; // half-width of the stroke is STROKE / 2
const SEGMENTS = [
  [0.5, 0.2, 0.28, 0.8], // left leg
  [0.5, 0.2, 0.72, 0.8], // right leg
  [0.36, 0.6, 0.64, 0.6], // crossbar
];

function distToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

const inLetter = (u, v) => SEGMENTS.some((s) => distToSegment(u, v, s) <= STROKE / 2);

/**
 * Renders size x size RGBA pixels with 4x4 supersampling.
 * shape: 'circle' = circle on transparent; 'square' = full-bleed background.
 * letterScale shrinks the letter toward the centre (maskable icons need a safe zone).
 */
function render(size, { shape, letterScale }) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const inBg = shape === 'square' || Math.hypot(u - 0.5, v - 0.5) <= 0.5;
          if (!inBg) continue;
          const lu = (u - 0.5) / letterScale + 0.5;
          const lv = (v - 0.5) / letterScale + 0.5;
          const colour = inLetter(lu, lv) ? LETTER : ACCENT;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          a += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const covered = a / 255;
      px[i] = covered ? Math.round(r / covered) : 0;
      px[i + 1] = covered ? Math.round(g / covered) : 0;
      px[i + 2] = covered ? Math.round(b / covered) : 0;
      px[i + 3] = Math.round(a / n);
    }
  }
  return px;
}

// ---- Minimal PNG encoder ----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, { shape: 'circle', letterScale: 1 }],
  ['icon-512.png', 512, { shape: 'circle', letterScale: 1 }],
  // Maskable: full-bleed so the OS can crop any shape; letter inside the central 80% safe zone.
  ['icon-maskable-512.png', 512, { shape: 'square', letterScale: 0.7 }],
  // iOS applies its own rounded mask and fills transparency with black, so keep it opaque.
  ['apple-touch-icon.png', 180, { shape: 'square', letterScale: 0.8 }],
];
for (const [name, size, opts] of files) {
  writeFileSync(`${OUT}/${name}`, png(size, render(size, opts)));
  console.log(`wrote ${OUT}/${name}`);
}

const hex = (c) => `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
const path = SEGMENTS.map(
  ([x1, y1, x2, y2]) => `M${x1 * 100} ${y1 * 100}L${x2 * 100} ${y2 * 100}`,
).join('');
writeFileSync(
  `${OUT}/favicon.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${hex(ACCENT)}"/><path d="${path}" fill="none" stroke="${hex(LETTER)}" stroke-width="${STROKE * 100}" stroke-linecap="round"/></svg>\n`,
);
console.log(`wrote ${OUT}/favicon.svg`);
