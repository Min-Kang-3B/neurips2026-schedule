// Embed paper title+abstract with Xenova/bge-small-en-v1.5 (q8), the same model the
// browser loads for queries. Run from work/:  node ../scripts/embed.mjs
// Input emb_input.json [[id, text]] -> emb.bin (int8, n x 384, L2-normalized * 127) + emb_ids.json
// Rows whose [id, text] matches the previous run (emb_prev.json + old emb.bin) are reused, not re-embedded.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mod = await import(require.resolve('@huggingface/transformers', { paths: [process.cwd() + '/node'] }));
const pipeline = mod.pipeline || mod.default.pipeline;
const input = JSON.parse(fs.readFileSync('emb_input.json', 'utf8'));
const extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8' });
const DIM = 384, B = 32;
const out = new Int8Array(input.length * DIM);
const prevRow = new Map();
let prevBin = null;
if (fs.existsSync('emb_prev.json') && fs.existsSync('emb.bin')) {
  prevBin = new Int8Array(fs.readFileSync('emb.bin').buffer.slice(0));
  JSON.parse(fs.readFileSync('emb_prev.json', 'utf8')).forEach((r, i) => prevRow.set(r[0] + '\u0000' + r[1], i));
}
const todo = [];
input.forEach((r, i) => {
  const pi = prevRow.get(r[0] + '\u0000' + r[1]);
  if (pi != null && prevBin) out.set(prevBin.subarray(pi * DIM, (pi + 1) * DIM), i * DIM);
  else todo.push(i);
});
console.log(`reused ${input.length - todo.length}, embedding ${todo.length}`);
const t0 = Date.now();
for (let i = 0; i < todo.length; i += B) {
  const idx = todo.slice(i, i + B);
  const res = await extractor(idx.map(n => input[n][1].slice(0, 2000)), { pooling: 'cls', normalize: true });
  const data = res.data;
  idx.forEach((n, j) => {
    for (let k = 0; k < DIM; k++)
      out[n * DIM + k] = Math.max(-127, Math.min(127, Math.round(data[j * DIM + k] * 127)));
  });
  if ((i / B) % 20 === 0) console.log(`${i + idx.length}/${todo.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
fs.writeFileSync('emb.bin', Buffer.from(out.buffer));
fs.writeFileSync('emb_prev.json', JSON.stringify(input));
fs.writeFileSync('emb_ids.json', JSON.stringify(input.map(r => r[0])));
console.log('done', input.length);
