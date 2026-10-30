// Embed paper title+abstract with Xenova/bge-small-en-v1.5 (q8), the same model the
// browser loads for queries. Run from work/:  node ../scripts/embed.mjs
// Input emb_input.json [[id, text]] -> emb.bin (int8, n x 384, L2-normalized * 127) + emb_ids.json
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mod = await import(require.resolve('@huggingface/transformers', { paths: [process.cwd() + '/node'] }));
const pipeline = mod.pipeline || mod.default.pipeline;
const input = JSON.parse(fs.readFileSync('emb_input.json', 'utf8'));
const extractor = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8' });
const DIM = 384, B = 32;
const out = new Int8Array(input.length * DIM);
const t0 = Date.now();
for (let i = 0; i < input.length; i += B) {
  const batch = input.slice(i, i + B).map(r => r[1].slice(0, 2000));
  const res = await extractor(batch, { pooling: 'cls', normalize: true });
  const data = res.data;
  for (let j = 0; j < batch.length; j++)
    for (let k = 0; k < DIM; k++)
      out[(i + j) * DIM + k] = Math.max(-127, Math.min(127, Math.round(data[j * DIM + k] * 127)));
  if ((i / B) % 20 === 0) console.log(`${i + batch.length}/${input.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
fs.writeFileSync('emb.bin', Buffer.from(out.buffer));
fs.writeFileSync('emb_ids.json', JSON.stringify(input.map(r => r[0])));
console.log('done', input.length);
