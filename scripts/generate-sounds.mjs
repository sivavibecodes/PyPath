#!/usr/bin/env node
/**
 * Synthesises the small UI feedback sounds (16-bit mono PCM WAV) so the repo
 * ships no binary blobs. Replace with designer-made assets any time — just keep
 * the file names.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'sounds');
const RATE = 44100;

/** notes: [frequencyHz, startSec, durationSec] */
function synth(notes, totalSec) {
  const n = Math.ceil(totalSec * RATE);
  const pcm = new Float32Array(n);
  for (const [freq, start, dur] of notes) {
    const s0 = Math.floor(start * RATE);
    const len = Math.floor(dur * RATE);
    for (let i = 0; i < len && s0 + i < n; i++) {
      const t = i / RATE;
      const attack = Math.min(1, i / (0.005 * RATE));
      const decay = Math.exp((-4 * i) / len);
      // fundamental + soft 2nd harmonic for a "chime" timbre
      pcm[s0 + i] += 0.35 * attack * decay * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t));
    }
  }
  return pcm;
}

function toWav(pcm) {
  const buf = Buffer.alloc(44 + pcm.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + pcm.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits
  buf.write('data', 36);
  buf.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2);
  }
  return buf;
}

const SOUNDS = {
  'success.wav': synth([[784, 0, 0.18], [1047, 0.09, 0.3]], 0.42), // G5 → C6
  'fail.wav': synth([[330, 0, 0.16], [262, 0.12, 0.26]], 0.4), // E4 → C4
  'level-up.wav': synth([[523, 0, 0.16], [659, 0.1, 0.16], [784, 0.2, 0.16], [1047, 0.3, 0.45]], 0.8),
};

const ifMissing = process.argv.includes('--if-missing');
await mkdir(OUT, { recursive: true });
for (const [name, pcm] of Object.entries(SOUNDS)) {
  const file = path.join(OUT, name);
  if (ifMissing && existsSync(file)) continue;
  await writeFile(file, toWav(pcm));
  console.log(`[generate-sounds] ${path.relative(ROOT, file)}`);
}
