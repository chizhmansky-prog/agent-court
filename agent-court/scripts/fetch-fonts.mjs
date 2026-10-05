import fs from 'node:fs/promises';
import path from 'node:path';

// Each checkout obtains its own unmodified copy directly from Fontshare.
// Satoshi binaries are excluded from Git; see public/fonts/Satoshi-FFL.txt.
const weights = [400, 500, 700, 900];
const root = process.cwd();
const directory = path.join(root, 'public/fonts');
await fs.mkdir(directory, { recursive: true });
const missing = [];
for (const weight of weights) {
  try {
    const existing = await fs.readFile(path.join(directory, `satoshi-${weight}.woff2`));
    if (existing.subarray(0, 4).toString() !== 'wOF2') throw new Error('Invalid font file');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    missing.push(weight);
  }
}
if (!missing.length) {
  console.log('Satoshi: four local WOFF2 weights present.');
  process.exit(0);
}
const response = await fetch('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap', { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`Official font CSS request failed (${response.status})`);
const css = await response.text();
const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(match => match[1]);
for (const weight of missing) {
  const face = faces.find(body => /font-family:\s*['"]Satoshi['"]/.test(body) && new RegExp(`font-weight:\\s*${weight}\\s*;`).test(body));
  const source = face?.match(/url\(['"]?([^)'"\s]+\.woff2)['"]?\)/)?.[1];
  if (!source) throw new Error(`Official WOFF2 source missing for weight ${weight}`);
  const url = new URL(source.startsWith('//') ? `https:${source}` : source);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.fontshare.com') throw new Error('Unexpected official font source');
  const download = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!download.ok) throw new Error(`Official font download failed (${download.status})`);
  const bytes = Buffer.from(await download.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== 'wOF2' || bytes.length > 1000000) throw new Error('Invalid downloaded WOFF2');
  // wx prevents an accidental overwrite if another build downloaded this font.
  try { await fs.writeFile(path.join(directory, `satoshi-${weight}.woff2`), bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  console.log(`Satoshi ${weight}: downloaded directly from official Fontshare.`);
}
