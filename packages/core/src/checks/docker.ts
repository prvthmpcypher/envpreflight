import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { execa } from 'execa';
import type { CheckResult } from '../types.js';

export type DockerExecutor = (args: string[], timeoutMs?: number) => Promise<string>;

export interface DockerCheckOptions {
  dockerExecutor?: DockerExecutor;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2000;

async function readFileQuiet(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

const defaultDockerExecutor: DockerExecutor = async (args, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const result = await execa('docker', args, { timeout: timeoutMs });
  return (result.stdout || result.stderr || '').trim();
};

export async function checkDocker(
  targetDir: string,
  options: DockerCheckOptions = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const execDocker = options.dockerExecutor ?? defaultDockerExecutor;

  // Check if repo uses Docker (Dockerfile or compose files)
  const composeCandidates = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  let composeFile: string | null = null;
  let composeContent: string | null = null;

  for (const name of composeCandidates) {
    const p = path.join(targetDir, name);
    const content = await readFileQuiet(p);
    if (content !== null) {
      composeFile = name;
      composeContent = content;
      break;
    }
  }

  const dockerfilePath = path.join(targetDir, 'Dockerfile');
  const hasDockerfile = (await readFileQuiet(dockerfilePath)) !== null;

  // If no docker artifacts, skip silently
  if (!composeFile && !hasDockerfile) {
    return results;
  }

  // 1. Check Docker daemon
  let daemonRunning = false;
  let dockerInstalled = true;
  let daemonErrorMsg = '';

  try {
    const infoOut = await execDocker(['info'], timeoutMs);
    daemonRunning = true;
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('ENOENT') || msg.includes('not found') || msg.includes('is not recognized')) {
      dockerInstalled = false;
    } else {
      daemonErrorMsg = msg;
    }
  }

  if (!dockerInstalled) {
    results.push({
      id: 'docker.daemon',
      label: 'Docker Daemon',
      category: 'Services',
      severity: 'fail',
      actual: 'not installed',
      message: 'Docker is not installed on this machine',
      fix: 'Install Docker: https://docs.docker.com/get-docker/',
    });
    return results;
  }

  if (!daemonRunning) {
    results.push({
      id: 'docker.daemon',
      label: 'Docker Daemon',
      category: 'Services',
      severity: 'fail',
      actual: 'stopped',
      message: 'Docker daemon is stopped / not reachable',
      fix: 'open -a Docker || sudo systemctl start docker',
    });
    return results;
  }

  results.push({
    id: 'docker.daemon',
    label: 'Docker Daemon',
    category: 'Services',
    severity: 'pass',
    actual: 'running',
    message: 'Docker daemon is running',
  });

  // 2. Check docker compose services if compose file exists
  if (composeFile && composeContent) {
    try {
      parseYaml(composeContent);
    } catch (err: any) {
      results.push({
        id: 'docker.compose',
        label: 'Docker Compose',
        category: 'Services',
        severity: 'skipped',
        message: `Invalid YAML in ${composeFile}: ${err.message}`,
        skipReason: `Invalid YAML in ${composeFile}`,
      });
      return results;
    }

    try {
      const psOutput = await execDocker(['compose', 'ps', '--format', 'json'], timeoutMs);
      let runningCount = 0;
      if (psOutput) {
        // Output can be a JSON array or newline-delimited JSON objects
        try {
          const parsed = JSON.parse(psOutput);
          if (Array.isArray(parsed)) {
            runningCount = parsed.filter((s: any) => s.State === 'running' || s.Status?.toLowerCase().includes('up')).length;
          } else if (parsed && typeof parsed === 'object') {
            runningCount = parsed.State === 'running' ? 1 : 0;
          }
        } catch {
          // Newline-delimited json
          const lines = psOutput.split('\n').map((l) => l.trim()).filter(Boolean);
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (obj.State === 'running' || obj.Status?.toLowerCase().includes('up')) {
                runningCount++;
              }
            } catch {
              // fallback
            }
          }
        }
      }

      if (runningCount > 0) {
        results.push({
          id: 'docker.compose',
          label: 'Docker Compose',
          category: 'Services',
          severity: 'pass',
          actual: `${runningCount} running`,
          message: `${composeFile} services are up and running`,
        });
      } else {
        results.push({
          id: 'docker.compose',
          label: 'Docker Compose',
          category: 'Services',
          severity: 'fail',
          actual: 'stopped',
          message: `${composeFile} services are not running`,
          fix: 'docker compose up -d',
        });
      }
    } catch {
      // Failed to run compose ps
      results.push({
        id: 'docker.compose',
        label: 'Docker Compose',
        category: 'Services',
        severity: 'warn',
        message: `Could not verify ${composeFile} service status`,
        fix: 'docker compose up -d',
      });
    }
  }

  return results;
}
