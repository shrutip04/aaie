#!/usr/bin/env node
// generate-icons.js
// Generates PNG icons for the extension using Canvas (Node.js)
// Run: node generate-icons.js

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZES = [16, 48, 128];
const OUT_DIR = join(__dirname, 'extension', 'icons');

try { mkdirSync(OUT_DIR, { recursive: true }); } catch (e) {}

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#6366f1');
  grad.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = grad;
  roundRect(ctx, 0, 0, size, size, size * 0.22);
  ctx.fill();

  // Brain emoji text
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.floor(size * 0.58)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧠', size / 2, size / 2 + size * 0.04);

  const buffer = canvas.toBuffer('image/png');
  const outPath = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(outPath, buffer);
  console.log(`✓ icon${size}.png`);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
