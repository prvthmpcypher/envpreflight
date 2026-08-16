import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { checkDocker } from '../src/checks/docker.js';

describe('Docker checks', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envpreflight-docker-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('skips Docker check when no Dockerfile or compose file exists', async () => {
    const results = await checkDocker(tempDir);
    expect(results).toEqual([]);
  });

  it('passes when Docker daemon is running and compose services are up', async () => {
    await fs.writeFile(
      path.join(tempDir, 'docker-compose.yml'),
      `services:
  web:
    image: nginx
`
    );

    const results = await checkDocker(tempDir, {
      dockerExecutor: async (args) => {
        if (args[0] === 'info') return 'Server Version: 24.0.5';
        if (args[0] === 'compose' && args[1] === 'ps') {
          return JSON.stringify([{ Service: 'web', State: 'running' }]);
        }
        return '';
      },
    });

    const daemon = results.find((r) => r.id === 'docker.daemon');
    const compose = results.find((r) => r.id === 'docker.compose');

    expect(daemon?.severity).toBe('pass');
    expect(compose?.severity).toBe('pass');
  });

  it('fails when Docker daemon is not running', async () => {
    await fs.writeFile(path.join(tempDir, 'docker-compose.yml'), 'services:\n  app:\n    image: node\n');

    const results = await checkDocker(tempDir, {
      dockerExecutor: async (args) => {
        if (args[0] === 'info') {
          throw new Error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock');
        }
        return '';
      },
    });

    const daemon = results.find((r) => r.id === 'docker.daemon');
    expect(daemon?.severity).toBe('fail');
    expect(daemon?.message).toContain('Docker daemon is stopped');
    expect(daemon?.fix).toBeDefined();
  });

  it('fails when Docker CLI is not installed at all', async () => {
    await fs.writeFile(path.join(tempDir, 'docker-compose.yml'), 'services:\n  app:\n    image: node\n');

    const results = await checkDocker(tempDir, {
      dockerExecutor: async () => {
        throw new Error('docker: command not found');
      },
    });

    const daemon = results.find((r) => r.id === 'docker.daemon');
    expect(daemon?.severity).toBe('fail');
    expect(daemon?.actual).toBe('not installed');
    expect(daemon?.fix).toContain('https://docs.docker.com/get-docker/');
  });
});
