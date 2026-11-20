import { chromium } from 'playwright-core';
import fs from 'node:fs';
const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12], ['apple-touch-icon.png', 180, 0]]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = pad ? svg.replace('rx="14"', 'rx="0"') : svg;
  await page.setContent(`<html><body style="margin:0;background:${pad ? '#111827' : 'transparent'}"><div style="padding:${size * pad}px">${inner.replace('<svg ', `<svg width="${size * (1 - 2 * pad)}" height="${size * (1 - 2 * pad)}" `)}</div></body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: !pad });
}
await browser.close();
console.log('icons done');
