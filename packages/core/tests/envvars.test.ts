import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { checkEnvVars } from '../src/checks/envvars.js';

describe('Environment variable checks', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envpreflight-env-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('silently returns empty list when no .env.example exists', async () => {
    const results = await checkEnvVars(tempDir);
    expect(results).toEqual([]);
  });

  it('fails with cp command fix when .env.example exists but .env is missing entirely', async () => {
    await fs.writeFile(path.join(tempDir, '.env.example'), 'PORT=3000\nDATABASE_URL=\n');

    const results = await checkEnvVars(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('fail');
    expect(results[0].id).toBe('env.missing_file');
    expect(results[0].fix).toBe('cp .env.example .env');
  });

  it('passes when all keys in .env.example are present in .env', async () => {
    await fs.writeFile(path.join(tempDir, '.env.example'), 'PORT=3000\nAPI_KEY=\n');
    await fs.writeFile(path.join(tempDir, '.env'), 'PORT=8080\nAPI_KEY=xyz123\nEXTRA_KEY=value\n');

    const results = await checkEnvVars(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('pass');
    expect(results[0].id).toBe('env.diff');
    expect(results[0].message).toContain('all 2 keys from .env.example are set in .env');
  });

  it('warns with missing key names when .env is missing some keys', async () => {
    await fs.writeFile(
      path.join(tempDir, '.env.example'),
      'PORT=3000\nSTRIPE_SECRET_KEY=\nRESEND_API_KEY=\nDATABASE_URL=\n'
    );
    await fs.writeFile(
      path.join(tempDir, '.env'),
      'PORT=3000\nDATABASE_URL=postgres://localhost:5432/db\n'
    );

    const results = await checkEnvVars(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('warn');
    expect(results[0].id).toBe('env.diff');
    expect(results[0].message).toContain('2 keys in .env.example are missing: STRIPE_SECRET_KEY, RESEND_API_KEY');
  });

  it('ignores comments, export keywords, and whitespace in .env files', async () => {
    await fs.writeFile(
      path.join(tempDir, '.env.example'),
      '# Database configuration\nexport DB_HOST=localhost\n\n# Stripe\nSTRIPE_KEY=\n'
    );
    await fs.writeFile(
      path.join(tempDir, '.env'),
      '# Live env\nDB_HOST=127.0.0.1\nSTRIPE_KEY=live_123\n'
    );

    const results = await checkEnvVars(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('pass');
  });
});
