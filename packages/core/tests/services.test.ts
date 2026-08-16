import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { checkServices, detectReferencedServices } from '../src/checks/services.js';

describe('Services checks', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envpreflight-services-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('detects no services when repo has no database or service references', async () => {
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'pure-frontend' }));
    const detected = await detectReferencedServices(tempDir);
    expect(detected).toEqual([]);

    const results = await checkServices(tempDir);
    expect(results).toEqual([]);
  });

  it('detects Postgres from .env.example DATABASE_URL', async () => {
    await fs.writeFile(path.join(tempDir, '.env.example'), 'DATABASE_URL=postgres://user:pass@localhost:5432/app\n');
    const detected = await detectReferencedServices(tempDir);
    expect(detected.map((s) => s.name)).toContain('PostgreSQL');
  });

  it('detects Redis and MySQL from docker-compose.yml', async () => {
    await fs.writeFile(
      path.join(tempDir, 'docker-compose.yml'),
      `services:
  cache:
    image: redis:alpine
    ports:
      - "6379:6379"
  db:
    image: mysql:8.0
    ports:
      - "3306:3306"
`
    );
    const detected = await detectReferencedServices(tempDir);
    const names = detected.map((s) => s.name);
    expect(names).toContain('Redis');
    expect(names).toContain('MySQL');
  });

  it('passes when socket probe connects successfully', async () => {
    await fs.writeFile(path.join(tempDir, '.env.example'), 'REDIS_URL=redis://localhost:6379\n');

    const results = await checkServices(tempDir, {
      socketProber: async (host, port) => true,
    });

    const redisResult = results.find((r) => r.id === 'service.redis');
    expect(redisResult).toBeDefined();
    expect(redisResult?.severity).toBe('pass');
    expect(redisResult?.actual).toContain('reachable on 6379');
  });

  it('fails with actionable docker-compose fix when service is unreachable', async () => {
    await fs.writeFile(
      path.join(tempDir, 'docker-compose.yml'),
      `services:
  redis:
    image: redis
`
    );

    const results = await checkServices(tempDir, {
      socketProber: async (host, port) => false,
    });

    const redisResult = results.find((r) => r.id === 'service.redis');
    expect(redisResult).toBeDefined();
    expect(redisResult?.severity).toBe('fail');
    expect(redisResult?.message).toContain('nothing listening on 6379');
    expect(redisResult?.fix).toContain('docker compose up -d redis');
  });
});
