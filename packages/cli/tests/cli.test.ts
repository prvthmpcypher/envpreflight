import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createCli } from '../src/index.js';

describe('CLI Integration', () => {
  let tempDir: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envpreflight-cli-test-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('prints friendly message and exits 0 when no manifests exist', async () => {
    const cli = createCli();
    await cli.parseAsync(['node', 'envpreflight', '--cwd', tempDir]);

    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls.flat().join('\n');
    expect(output).toContain('No recognized project manifests found');
    expect(process.exitCode).toBe(0);
  });

  it('outputs valid JSON Report when --json flag is passed', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'my-json-test', engines: { node: '>=18.0.0' } })
    );

    const cli = createCli();
    await cli.parseAsync(['node', 'envpreflight', '--json', '--cwd', tempDir]);

    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls.flat().join('\n');
    const parsed = JSON.parse(output);

    expect(parsed).toBeDefined();
    expect(parsed.projectName).toBe('my-json-test');
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(typeof parsed.exitCode).toBe('number');
  });

  it('filters results when --only flag is passed', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-filter', engines: { node: '>=18.0.0' } })
    );
    await fs.writeFile(path.join(tempDir, '.env.example'), 'PORT=3000\n');

    const cli = createCli();
    await cli.parseAsync(['node', 'envpreflight', '--json', '--only', 'runtime.node', '--cwd', tempDir]);

    const output = logSpy.mock.calls.flat().join('\n');
    const parsed = JSON.parse(output);

    expect(parsed.results.every((r: any) => r.id === 'runtime.node')).toBe(true);
  });
});
