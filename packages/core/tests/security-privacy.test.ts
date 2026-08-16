import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { checkEnvVars } from '../src/checks/envvars.js';
import { runAllChecks } from '../src/index.js';

describe('Security & Privacy: Strict Zero Value Leakage Guarantee', () => {
  let tempDir: string;
  const SECRET_VALUE_1 = 'sk_live_SUPER_SECRET_STRIPE_KEY_123456789';
  const SECRET_VALUE_2 = 'resend_live_SUPER_SECRET_RESEND_KEY_987654';
  const SECRET_VALUE_3 = 'postgres://admin:SUPER_SECRET_PASSWORD@localhost:5432/production_db';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envpreflight-security-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('MANDATORY: Never extracts, stores, or leaks any env variable values in checkEnvVars', async () => {
    await fs.writeFile(
      path.join(tempDir, '.env.example'),
      `STRIPE_SECRET_KEY=placeholder_stripe\nRESEND_API_KEY=\nDATABASE_URL=postgres://user:pass@localhost:5432/db\nAPI_SECRET=some_example_value\n`
    );

    await fs.writeFile(
      path.join(tempDir, '.env'),
      `STRIPE_SECRET_KEY=${SECRET_VALUE_1}\n# Missing RESEND_API_KEY and API_SECRET\nDATABASE_URL=${SECRET_VALUE_3}\n`
    );

    const results = await checkEnvVars(tempDir);
    const jsonString = JSON.stringify(results);

    // Assert that NONE of the secret values appear in the results object
    expect(jsonString).not.toContain(SECRET_VALUE_1);
    expect(jsonString).not.toContain(SECRET_VALUE_2);
    expect(jsonString).not.toContain(SECRET_VALUE_3);
    expect(jsonString).not.toContain('placeholder_stripe');
    expect(jsonString).not.toContain('some_example_value');
    expect(jsonString).not.toContain('SUPER_SECRET_PASSWORD');

    // Assert that only KEY names appear
    expect(jsonString).toContain('RESEND_API_KEY');
    expect(jsonString).toContain('API_SECRET');
  });

  it('MANDATORY: Never leaks secret values across full report execution', async () => {
    await fs.writeFile(
      path.join(tempDir, '.env.example'),
      `SECRET_TOKEN=example_token\nPRIVATE_KEY=example_private_key\n`
    );
    await fs.writeFile(
      path.join(tempDir, '.env'),
      `SECRET_TOKEN=${SECRET_VALUE_1}\n`
    );
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-secure-app' })
    );

    const report = await runAllChecks(tempDir);
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain(SECRET_VALUE_1);
    expect(serialized).not.toContain('example_token');
    expect(serialized).not.toContain('example_private_key');
    expect(serialized).toContain('PRIVATE_KEY');
  });
});
