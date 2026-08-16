import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as net from 'node:net';
import { execa } from 'execa';
import { parse as parseYaml } from 'yaml';
import type { CheckResult } from '../types.js';

export interface PortProbeResult {
  isOccupied: boolean;
  processName?: string;
  pid?: number;
}

export type PortProber = (port: number, timeoutMs?: number) => Promise<PortProbeResult>;

export interface PortsCheckOptions {
  portProber?: PortProber;
  timeoutMs?: number;
}

async function readFileQuiet(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export const defaultPortProber: PortProber = async (port: number, timeoutMs = 2000): Promise<PortProbeResult> => {
  // First, probe if port is occupied via net.createServer
  const isOccupied = await new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => {
        resolve(false);
      });
    });

    try {
      server.listen(port, '0.0.0.0');
    } catch {
      resolve(true);
    }
  });

  if (!isOccupied) {
    return { isOccupied: false };
  }

  // Try to find process name and PID
  let processName: string | undefined;
  let pid: number | undefined;

  try {
    if (process.platform === 'win32') {
      const netstat = await execa('netstat', ['-ano'], { timeout: timeoutMs });
      const lines = netstat.stdout.split('\n');
      for (const line of lines) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const foundPid = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(foundPid) && foundPid > 0) {
            pid = foundPid;
            try {
              const tasklist = await execa('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { timeout: 1000 });
              const nameMatch = tasklist.stdout.match(/^"([^"]+)"/);
              if (nameMatch) {
                processName = nameMatch[1];
              }
            } catch {
              processName = 'process';
            }
            break;
          }
        }
      }
    } else {
      const lsof = await execa('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-n', '-P'], { timeout: timeoutMs });
      const lines = lsof.stdout.split('\n').filter(Boolean);
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        processName = parts[0];
        pid = parseInt(parts[1], 10);
      }
    }
  } catch {
    // Process lookup failed or not permitted
  }

  return { isOccupied: true, processName, pid };
};

export async function detectRequiredPorts(targetDir: string): Promise<number[]> {
  const ports = new Set<number>();

  // 1. Check .env.example / .env
  const envCandidates = ['.env.example', '.env.sample', '.env.template', '.env'];
  for (const name of envCandidates) {
    const content = await readFileQuiet(path.join(targetDir, name));
    if (content) {
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/(?:PORT|VITE_PORT|APP_PORT|SERVER_PORT|CLIENT_PORT)\s*=\s*(\d{2,5})/i);
        if (match) {
          const p = parseInt(match[1], 10);
          if (p > 0 && p <= 65535) {
            ports.add(p);
          }
        }
      }
    }
  }

  // 2. Check docker-compose ports
  const composeCandidates = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  for (const name of composeCandidates) {
    const content = await readFileQuiet(path.join(targetDir, name));
    if (content) {
      try {
        const parsed: any = parseYaml(content);
        const services = parsed?.services || {};
        for (const service of Object.values<any>(services)) {
          if (Array.isArray(service.ports)) {
            for (const portEntry of service.ports) {
              const str = String(portEntry);
              const parts = str.split(':');
              const hostPort = parseInt(parts[0].replace(/[^0-9]/g, ''), 10);
              if (hostPort > 0 && hostPort <= 65535) {
                // Ignore standard database ports here as they are handled in services check
                if (![5432, 6379, 3306, 27017].includes(hostPort)) {
                  ports.add(hostPort);
                }
              }
            }
          }
        }
      } catch {
        // Ignored
      }
    }
  }

  return Array.from(ports);
}

export async function checkPorts(
  targetDir: string,
  options: PortsCheckOptions = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const prober = options.portProber ?? defaultPortProber;
  const timeoutMs = options.timeoutMs ?? 2000;

  const requiredPorts = await detectRequiredPorts(targetDir);

  for (const port of requiredPorts) {
    const probe = await prober(port, timeoutMs);

    if (!probe.isOccupied) {
      results.push({
        id: `port.${port}`,
        label: `Port ${port}`,
        category: 'Ports',
        severity: 'pass',
        actual: 'available',
        message: `port ${port} is available`,
      });
    } else {
      const procInfo = probe.processName
        ? `${probe.processName}${probe.pid ? ` (pid ${probe.pid})` : ''}`
        : probe.pid
        ? `pid ${probe.pid}`
        : 'another process';

      const fix = probe.pid ? `kill ${probe.pid}` : undefined;

      results.push({
        id: `port.${port}`,
        label: `Port ${port}`,
        category: 'Ports',
        severity: 'fail',
        actual: `occupied by ${procInfo}`,
        message: `${port} in use by ${procInfo}`,
        fix,
      });
    }
  }

  return results;
}
