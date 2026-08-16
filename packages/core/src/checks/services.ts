import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as net from 'node:net';
import { parse as parseYaml } from 'yaml';
import type { CheckResult } from '../types.js';

export interface ServiceDef {
  id: string;
  name: string;
  defaultPort: number;
  dockerServiceName?: string;
  fixFallback: string;
}

export type SocketProber = (host: string, port: number, timeoutMs?: number) => Promise<boolean>;

export interface ServicesCheckOptions {
  socketProber?: SocketProber;
  timeoutMs?: number;
}

const KNOWN_SERVICES: Record<string, { name: string; port: number; fix: string }> = {
  postgres: {
    name: 'PostgreSQL',
    port: 5432,
    fix: 'brew services start postgresql || sudo systemctl start postgresql',
  },
  postgresql: {
    name: 'PostgreSQL',
    port: 5432,
    fix: 'brew services start postgresql || sudo systemctl start postgresql',
  },
  redis: {
    name: 'Redis',
    port: 6379,
    fix: 'brew services start redis || sudo systemctl start redis',
  },
  mysql: {
    name: 'MySQL',
    port: 3306,
    fix: 'brew services start mysql || sudo systemctl start mysql',
  },
  mariadb: {
    name: 'MariaDB',
    port: 3306,
    fix: 'brew services start mariadb || sudo systemctl start mariadb',
  },
  mongo: {
    name: 'MongoDB',
    port: 27017,
    fix: 'brew services start mongodb-community || sudo systemctl start mongod',
  },
  mongodb: {
    name: 'MongoDB',
    port: 27017,
    fix: 'brew services start mongodb-community || sudo systemctl start mongod',
  },
};

async function readFileQuiet(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export const probeSocket: SocketProber = (host: string, port: number, timeoutMs = 2000): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      cleanup();
      resolve(true);
    });

    socket.on('timeout', () => {
      cleanup();
      resolve(false);
    });

    socket.on('error', () => {
      cleanup();
      resolve(false);
    });

    try {
      socket.connect(port, host);
    } catch {
      cleanup();
      resolve(false);
    }
  });
};

export async function detectReferencedServices(targetDir: string): Promise<ServiceDef[]> {
  const referenced = new Map<string, ServiceDef>();

  // 1. Check docker-compose files
  const composeCandidates = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  for (const name of composeCandidates) {
    const content = await readFileQuiet(path.join(targetDir, name));
    if (content) {
      try {
        const parsed: any = parseYaml(content);
        const services = parsed?.services || {};
        for (const [serviceKey, serviceConfig] of Object.entries<any>(services)) {
          const lowerKey = serviceKey.toLowerCase();
          const image = (serviceConfig?.image || '').toLowerCase();

          for (const [knownKey, meta] of Object.entries(KNOWN_SERVICES)) {
            if (lowerKey.includes(knownKey) || image.includes(knownKey)) {
              referenced.set(meta.name, {
                id: `service.${knownKey === 'postgresql' ? 'postgres' : knownKey === 'mongodb' ? 'mongo' : knownKey}`,
                name: meta.name,
                defaultPort: meta.port,
                dockerServiceName: serviceKey,
                fixFallback: `docker compose up -d ${serviceKey}`,
              });
            }
          }
        }
      } catch {
        // Compose malformed, will be handled in Docker checks
      }
    }
  }

  // 2. Check .env.example / .env
  const envCandidates = ['.env.example', '.env.sample', '.env.template', '.env'];
  for (const name of envCandidates) {
    const content = await readFileQuiet(path.join(targetDir, name));
    if (content) {
      const lower = content.toLowerCase();
      if (lower.includes('postgres') || lower.includes('psql') || lower.includes('5432')) {
        if (!referenced.has('PostgreSQL')) {
          referenced.set('PostgreSQL', {
            id: 'service.postgres',
            name: 'PostgreSQL',
            defaultPort: 5432,
            fixFallback: 'brew services start postgresql || sudo systemctl start postgresql',
          });
        }
      }
      if (lower.includes('redis') || lower.includes('6379')) {
        if (!referenced.has('Redis')) {
          referenced.set('Redis', {
            id: 'service.redis',
            name: 'Redis',
            defaultPort: 6379,
            fixFallback: 'brew services start redis || sudo systemctl start redis',
          });
        }
      }
      if (lower.includes('mysql') || lower.includes('3306')) {
        if (!referenced.has('MySQL')) {
          referenced.set('MySQL', {
            id: 'service.mysql',
            name: 'MySQL',
            defaultPort: 3306,
            fixFallback: 'brew services start mysql || sudo systemctl start mysql',
          });
        }
      }
      if (lower.includes('mongodb') || lower.includes('mongo') || lower.includes('27017')) {
        if (!referenced.has('MongoDB')) {
          referenced.set('MongoDB', {
            id: 'service.mongo',
            name: 'MongoDB',
            defaultPort: 27017,
            fixFallback: 'brew services start mongodb-community || sudo systemctl start mongod',
          });
        }
      }
    }
  }

  // 3. Check package.json dependencies
  const pkgContent = await readFileQuiet(path.join(targetDir, 'package.json'));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.pg || allDeps['@prisma/client'] || allDeps.typeorm || allDeps.sequelize) {
        if (!referenced.has('PostgreSQL') && (allDeps.pg || pkgContent.includes('postgres'))) {
          referenced.set('PostgreSQL', {
            id: 'service.postgres',
            name: 'PostgreSQL',
            defaultPort: 5432,
            fixFallback: 'brew services start postgresql || sudo systemctl start postgresql',
          });
        }
      }
      if (allDeps.redis || allDeps.ioredis) {
        if (!referenced.has('Redis')) {
          referenced.set('Redis', {
            id: 'service.redis',
            name: 'Redis',
            defaultPort: 6379,
            fixFallback: 'brew services start redis || sudo systemctl start redis',
          });
        }
      }
      if (allDeps.mysql || allDeps.mysql2) {
        if (!referenced.has('MySQL')) {
          referenced.set('MySQL', {
            id: 'service.mysql',
            name: 'MySQL',
            defaultPort: 3306,
            fixFallback: 'brew services start mysql || sudo systemctl start mysql',
          });
        }
      }
      if (allDeps.mongodb || allDeps.mongoose) {
        if (!referenced.has('MongoDB')) {
          referenced.set('MongoDB', {
            id: 'service.mongo',
            name: 'MongoDB',
            defaultPort: 27017,
            fixFallback: 'brew services start mongodb-community || sudo systemctl start mongod',
          });
        }
      }
    } catch {
      // Handled in other checks
    }
  }

  return Array.from(referenced.values());
}

export async function checkServices(
  targetDir: string,
  options: ServicesCheckOptions = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const prober = options.socketProber ?? probeSocket;
  const timeoutMs = options.timeoutMs ?? 2000;

  const services = await detectReferencedServices(targetDir);

  for (const service of services) {
    const isReachable = await prober('127.0.0.1', service.defaultPort, timeoutMs);

    if (isReachable) {
      results.push({
        id: service.id,
        label: service.name,
        category: 'Services',
        severity: 'pass',
        actual: `reachable on ${service.defaultPort}`,
        message: `reachable on ${service.defaultPort}`,
      });
    } else {
      const fix = service.dockerServiceName
        ? `docker compose up -d ${service.dockerServiceName}`
        : service.fixFallback;

      results.push({
        id: service.id,
        label: service.name,
        category: 'Services',
        severity: 'fail',
        actual: 'not reachable',
        message: `nothing listening on ${service.defaultPort}`,
        fix,
      });
    }
  }

  return results;
}
