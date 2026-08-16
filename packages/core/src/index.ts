import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CheckResult, Report, RunOptions } from './types.js';
import { detectManifests } from './detect/index.js';
import { checkRuntime, type RuntimeCheckOptions } from './checks/runtime.js';
import { checkServices, type ServicesCheckOptions } from './checks/services.js';
import { checkDocker, type DockerCheckOptions } from './checks/docker.js';
import { checkEnvVars } from './checks/envvars.js';
import { checkPorts, type PortsCheckOptions } from './checks/ports.js';

export * from './types.js';
export * from './detect/index.js';
export * from './checks/runtime.js';
export * from './checks/services.js';
export * from './checks/docker.js';
export * from './checks/envvars.js';
export * from './checks/ports.js';

export interface FullCheckOptions
  extends RunOptions,
    RuntimeCheckOptions,
    ServicesCheckOptions,
    DockerCheckOptions,
    PortsCheckOptions {}

async function getProjectName(targetDir: string): Promise<string> {
  try {
    const pkgRaw = await fs.readFile(path.join(targetDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    if (pkg.name) return pkg.name;
  } catch {
    // ignore
  }

  return path.basename(path.resolve(targetDir));
}

export async function runAllChecks(
  targetDir = process.cwd(),
  options: FullCheckOptions = {}
): Promise<Report> {
  const startTime = Date.now();
  const projectName = await getProjectName(targetDir);
  const manifests = await detectManifests(targetDir);

  // If no manifests detected at all, return empty report immediately
  if (manifests.manifestFiles.length === 0) {
    return {
      results: [],
      exitCode: 0,
      durationMs: Date.now() - startTime,
      projectName,
    };
  }

  // Run all check modules concurrently
  const [runtimeResults, serviceResults, dockerResults, envResults, portResults] = await Promise.all([
    checkRuntime(targetDir, options),
    checkServices(targetDir, options),
    checkDocker(targetDir, options),
    checkEnvVars(targetDir),
    checkPorts(targetDir, options),
  ]);

  let allResults: CheckResult[] = [
    ...runtimeResults,
    ...serviceResults,
    ...dockerResults,
    ...envResults,
    ...portResults,
  ];

  // Apply --only filter
  if (options.only && options.only.length > 0) {
    const allowed = new Set(options.only.flatMap((o) => o.split(',')).map((s) => s.trim().toLowerCase()));
    allResults = allResults.filter((r) =>
      allowed.has(r.id.toLowerCase()) || (r.category && allowed.has(r.category.toLowerCase()))
    );
  }

  // Apply --skip filter
  if (options.skip && options.skip.length > 0) {
    const skipped = new Set(options.skip.flatMap((s) => s.split(',')).map((s) => s.trim().toLowerCase()));
    allResults = allResults.filter(
      (r) => !skipped.has(r.id.toLowerCase()) && (!r.category || !skipped.has(r.category.toLowerCase()))
    );
  }

  // Determine exitCode: 0 all pass, 1 blocking failure, 2 warnings only
  let exitCode: 0 | 1 | 2 = 0;
  const hasFail = allResults.some((r) => r.severity === 'fail');
  const hasWarn = allResults.some((r) => r.severity === 'warn');

  if (hasFail) {
    exitCode = 1;
  } else if (hasWarn) {
    exitCode = 2;
  } else {
    exitCode = 0;
  }

  return {
    results: allResults,
    exitCode,
    durationMs: Date.now() - startTime,
    projectName,
  };
}
