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
});
