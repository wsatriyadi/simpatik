import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const TEAL = [30, 85, 78];
const DARK = [10, 36, 33];
const PAPER = [247, 245, 240];
const GOLD = [209, 165, 69];

const SHIELD = [
  [0.22, 0.15],
  [0.5, 0.075],
  [0.78, 0.15],
  [0.78, 0.48],
  [0.68, 0.68],
  [0.5, 0.875],
  [0.32, 0.68],
  [0.22, 0.48],
];

const SHIRT = [
  [0.33, 0.35],
  [0.42, 0.41],
  [0.5, 0.33],
  [0.58, 0.41],
  [0.67, 0.35],
  [0.67, 0.65],
  [0.58, 0.65],
  [0.58, 0.56],
  [0.5, 0.66],
  [0.42, 0.56],
  [0.42, 0.65],
  [0.33, 0.65],
];

function scalePolygon(points, scale = 1) {
  return points.map(([x, y]) => [0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale]);
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function roundedRect(x, y, radius) {
  const r = radius;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
}

function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq ? ((px - x1) * dx + (py - y1) * dy) / lengthSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function drawIcon(size, { maskable = false } = {}) {
  const SS = 4;
  const big = new Uint8Array(size * SS * size * SS * 4);
  const shield = scalePolygon(SHIELD, maskable ? 0.78 : 0.88);
  const shirt = scalePolygon(SHIRT, maskable ? 0.78 : 0.88);
  const checkScale = maskable ? 0.78 : 0.88;
  const check = [
    [0.5 + (0.42 - 0.5) * checkScale, 0.5 + (0.55 - 0.5) * checkScale],
    [0.5 + (0.48 - 0.5) * checkScale, 0.5 + (0.61 - 0.5) * checkScale],
    [0.5 + (0.6 - 0.5) * checkScale, 0.5 + (0.44 - 0.5) * checkScale],
  ];
  const W = size * SS;

  for (let y = 0; y < W; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const px = (x + 0.5) / W;
      const py = (y + 0.5) / W;
      const index = (y * W + x) * 4;
      let r = DARK[0];
      let g = DARK[1];
      let b = DARK[2];
      let a = 255;
      if (!maskable && !roundedRect(px, py, 0.21)) {
        a = 0;
      }
      if (pointInPolygon(px, py, shield)) {
        r = PAPER[0];
        g = PAPER[1];
        b = PAPER[2];
        if (pointInPolygon(px, py, shirt)) {
          r = TEAL[0];
          g = TEAL[1];
          b = TEAL[2];
          const d = Math.min(
            segmentDistance(px, py, check[0][0], check[0][1], check[1][0], check[1][1]),
            segmentDistance(px, py, check[1][0], check[1][1], check[2][0], check[2][1]),
          );
          if (d < 0.022) {
            r = GOLD[0];
            g = GOLD[1];
            b = GOLD[2];
          }
        }
      }
      big[index] = r;
      big[index + 1] = g;
      big[index + 2] = b;
      big[index + 3] = a;
    }
  }

  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < SS; dy += 1) {
        for (let dx = 0; dx < SS; dx += 1) {
          const src = ((y * SS + dy) * W + (x * SS + dx)) * 4;
          const alpha = big[src + 3] / 255;
          r += big[src] * alpha;
          g += big[src + 1] * alpha;
          b += big[src + 2] * alpha;
          a += alpha;
        }
      }
      const idx = (y * size + x) * 4;
      const count = SS * SS;
      png.data[idx] = a ? Math.round(r / a) : 0;
      png.data[idx + 1] = a ? Math.round(g / a) : 0;
      png.data[idx + 2] = a ? Math.round(b / a) : 0;
      png.data[idx + 3] = Math.round((a / count) * 255);
    }
  }
  return PNG.sync.write(png);
}

const outputs = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];

for (const [name, size, maskable] of outputs) {
  fs.writeFileSync(path.join(outDir, name), drawIcon(size, { maskable }));
  console.log(`dibuat: public/icons/${name}`);
}

fs.copyFileSync(
  path.join(outDir, "apple-touch-icon.png"),
  path.join(root, "public", "icons", "apple-touch-icon.png"),
);
console.log("Selesai.");
