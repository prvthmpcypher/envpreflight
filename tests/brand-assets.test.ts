import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('envpreflight product identity', () => {
  it('uses the approved scan-layer mark in the docs shell and metadata', async () => {
    const [page, layout] = await Promise.all([
      readFile(new URL('../docs/src/app/page.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../docs/src/app/layout.tsx', import.meta.url), 'utf8'),
    ]);

    expect(page).toContain('src="/logo-mark.svg"');
    expect(layout).toContain("icon: '/favicon.svg'");
    expect(layout).toContain("url: '/og.png'");
  });

  it('ships the approved preflight identity at required sizes', async () => {
    const [logo, cover, favicon, apple, og] = await Promise.all([
      readFile(new URL('../docs/public/logo-mark.svg', import.meta.url), 'utf8'),
      readFile(new URL('../docs/public/cover.svg', import.meta.url), 'utf8'),
      readFile(new URL('../docs/public/favicon.png', import.meta.url)),
      readFile(new URL('../docs/public/apple-touch-icon.png', import.meta.url)),
      readFile(new URL('../docs/public/og.png', import.meta.url)),
    ]);
    const pngSize = (source: Buffer) => ({ width: source.readUInt32BE(16), height: source.readUInt32BE(20) });
    expect(logo).toMatch(/<title[^>]*>envpreflight logo<\/title>/);
    expect(cover).toContain('Check whether a repository can run before debugging.');
    expect(pngSize(favicon)).toEqual({ width: 32, height: 32 });
    expect(pngSize(apple)).toEqual({ width: 180, height: 180 });
    expect(pngSize(og)).toEqual({ width: 1200, height: 630 });
  });
});
