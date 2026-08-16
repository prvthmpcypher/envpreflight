import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import semver from 'semver';
import { parse as parseToml } from 'smol-toml';
import { execa } from 'execa';
import type { CheckResult } from '../types.js';

export interface RuntimeExecutors {
  node?: () => Promise<string>;
  python?: () => Promise<string>;
  go?: () => Promise<string>;
  rust?: () => Promise<string>;
}

export interface RuntimeCheckOptions {
  runtimeExecutors?: RuntimeExecutors;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2000;

async function executeCommand(cmd: string, args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const result = await execa(cmd, args, { timeout: timeoutMs });
  return (result.stdout || result.stderr || '').trim();
}

async function readFileQuiet(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function cleanVersion(ver: string): string {
  const match = ver.match(/(\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?)/);
  return match ? match[1] : ver.trim();
}

function toSemverRange(req: string): string {
  const trimmed = req.trim();
  if (semver.validRange(trimmed)) {
    return trimmed;
  }
  const clean = cleanVersion(trimmed);
  const coerced = semver.coerce(clean);
  if (coerced) {
    if (trimmed.startsWith('^') || trimmed.startsWith('~') || trimmed.startsWith('>=') || trimmed.startsWith('<=')) {
      const op = trimmed.match(/^(\^|~|>=|<=|>|<)/)?.[0] || '>=';
      return `${op}${coerced.version}`;
    }
    return `>=${coerced.version}`;
  }
  return trimmed;
}

export async function checkRuntime(
  targetDir: string,
  options: RuntimeCheckOptions = {}
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const nodeExecutor =
    options.runtimeExecutors?.node ??
    (async () => {
      try {
        return process.version;
      } catch {
        return await executeCommand('node', ['-v'], timeoutMs);
      }
    });

  const pythonExecutor =
    options.runtimeExecutors?.python ??
    (async () => {
      try {
        return await executeCommand('python3', ['--version'], timeoutMs);
      } catch {
        return await executeCommand('python', ['--version'], timeoutMs);
      }
    });

  const goExecutor =
    options.runtimeExecutors?.go ??
    (async () => {
      return await executeCommand('go', ['version'], timeoutMs);
    });

  const rustExecutor =
    options.runtimeExecutors?.rust ??
    (async () => {
      return await executeCommand('rustc', ['--version'], timeoutMs);
    });

  // 1. Node.js check
  const nvmrcPath = path.join(targetDir, '.nvmrc');
  const pkgJsonPath = path.join(targetDir, 'package.json');
  const nvmrcContent = await readFileQuiet(nvmrcPath);
  const pkgJsonContent = await readFileQuiet(pkgJsonPath);

  if (nvmrcContent !== null || pkgJsonContent !== null) {
    let expectedNode: string | undefined;
    let manifestSource = '';
    let malformedReason: string | undefined;

    if (nvmrcContent !== null) {
      expectedNode = nvmrcContent.trim();
      manifestSource = '.nvmrc';
    }

    if (pkgJsonContent !== null) {
      try {
        const pkg = JSON.parse(pkgJsonContent);
        if (pkg.engines?.node) {
          if (!expectedNode) {
            expectedNode = pkg.engines.node.trim();
            manifestSource = 'package.json engines.node';
          }
        }
      } catch (err: any) {
        malformedReason = `Invalid JSON in package.json: ${err.message}`;
      }
    }

    if (malformedReason && !expectedNode) {
      results.push({
        id: 'runtime.node',
        label: 'Node.js version',
        category: 'Runtime',
        severity: 'skipped',
        message: malformedReason,
        skipReason: malformedReason,
      });
    } else if (expectedNode) {
      let actualRaw: string | undefined;
      let actualInstalled = true;

      try {
        actualRaw = await nodeExecutor();
      } catch {
        actualInstalled = false;
      }

      if (!actualInstalled || !actualRaw) {
        results.push({
          id: 'runtime.node',
          label: 'Node.js version',
          category: 'Runtime',
          severity: 'fail',
          expected: expectedNode,
          actual: 'not installed',
          message: `Node.js is not installed (${manifestSource} wants ${expectedNode})`,
          fix: `nvm install ${cleanVersion(expectedNode)} && nvm use ${cleanVersion(expectedNode)}`,
        });
      } else {
        const actualClean = cleanVersion(actualRaw);
        const actualCoerced = semver.coerce(actualClean)?.version || actualClean;
        const validRange = toSemverRange(expectedNode);
        const satisfies =
          semver.satisfies(actualCoerced, validRange) ||
          actualClean.startsWith(cleanVersion(expectedNode));

        if (satisfies) {
          results.push({
            id: 'runtime.node',
            label: 'Node.js',
            category: 'Runtime',
            severity: 'pass',
            expected: expectedNode,
            actual: actualClean,
            message: `${actualClean} (${manifestSource} wants ${expectedNode})`,
          });
        } else {
          results.push({
            id: 'runtime.node',
            label: 'Node.js',
            category: 'Runtime',
            severity: 'fail',
            expected: expectedNode,
            actual: actualClean,
            message: `${actualClean} (${manifestSource} wants ${expectedNode})`,
            fix: `nvm install ${cleanVersion(expectedNode)} && nvm use ${cleanVersion(expectedNode)}`,
          });
        }
      }
    }
  }

  // 2. Python check
  const pyprojectPath = path.join(targetDir, 'pyproject.toml');
  const pyversionPath = path.join(targetDir, '.python-version');
  const pyprojectContent = await readFileQuiet(pyprojectPath);
  const pyversionContent = await readFileQuiet(pyversionPath);

  if (pyprojectContent !== null || pyversionContent !== null) {
    let expectedPython: string | undefined;
    let manifestSource = '';
    let malformedReason: string | undefined;

    if (pyversionContent !== null) {
      expectedPython = pyversionContent.trim();
      manifestSource = '.python-version';
    }

    if (pyprojectContent !== null) {
      try {
        const parsed: any = parseToml(pyprojectContent);
        const reqPy =
          parsed.project?.['requires-python'] ||
          parsed.tool?.poetry?.dependencies?.python;
        if (reqPy && !expectedPython) {
          expectedPython = String(reqPy).trim();
          manifestSource = 'pyproject.toml';
        }
      } catch (err: any) {
        malformedReason = `Invalid TOML in pyproject.toml: ${err.message}`;
      }
    }

    if (malformedReason && !expectedPython) {
      results.push({
        id: 'runtime.python',
        label: 'Python version',
        category: 'Runtime',
        severity: 'skipped',
        message: malformedReason,
        skipReason: malformedReason,
      });
    } else if (expectedPython) {
      let actualRaw: string | undefined;
      let actualInstalled = true;

      try {
        actualRaw = await pythonExecutor();
      } catch {
        actualInstalled = false;
      }

      if (!actualInstalled || !actualRaw) {
        results.push({
          id: 'runtime.python',
          label: 'Python',
          category: 'Runtime',
          severity: 'fail',
          expected: expectedPython,
          actual: 'not installed',
          message: `Python is not installed (${manifestSource} wants ${expectedPython})`,
          fix: `pyenv install ${cleanVersion(expectedPython)} && pyenv local ${cleanVersion(expectedPython)}`,
        });
      } else {
        const actualClean = cleanVersion(actualRaw);
        const actualCoerced = semver.coerce(actualClean)?.version || actualClean;
        const targetClean = cleanVersion(expectedPython);
        const targetCoerced = semver.coerce(targetClean)?.version || targetClean;
        const validRange = toSemverRange(expectedPython);

        const satisfies =
          semver.satisfies(actualCoerced, validRange) ||
          actualClean.startsWith(targetClean) ||
          (semver.valid(actualCoerced) && semver.valid(targetCoerced) && semver.gte(actualCoerced, targetCoerced));

        if (satisfies) {
          results.push({
            id: 'runtime.python',
            label: 'Python',
            category: 'Runtime',
            severity: 'pass',
            expected: expectedPython,
            actual: actualClean,
            message: `${actualClean} (${manifestSource} wants ${expectedPython})`,
          });
        } else {
          results.push({
            id: 'runtime.python',
            label: 'Python',
            category: 'Runtime',
            severity: 'fail',
            expected: expectedPython,
            actual: actualClean,
            message: `${actualClean} (${manifestSource} wants ${expectedPython})`,
            fix: `pyenv install ${targetClean} && pyenv local ${targetClean}`,
          });
        }
      }
    }
  }

  // 3. Go check
  const goModPath = path.join(targetDir, 'go.mod');
  const goModContent = await readFileQuiet(goModPath);

  if (goModContent !== null) {
    const match = goModContent.match(/^go\s+([0-9.]+)/m);
    if (match) {
      const expectedGo = match[1].trim();
      let actualRaw: string | undefined;
      let actualInstalled = true;

      try {
        actualRaw = await goExecutor();
      } catch {
        actualInstalled = false;
      }

      if (!actualInstalled || !actualRaw) {
        results.push({
          id: 'runtime.go',
          label: 'Go',
          category: 'Runtime',
          severity: 'fail',
          expected: `>=${expectedGo}`,
          actual: 'not installed',
          message: `Go is not installed (go.mod wants ${expectedGo})`,
          fix: `brew install go@${expectedGo} || gvm install go${expectedGo}`,
        });
      } else {
        const actualClean = cleanVersion(actualRaw);
        const expectedCoerced = semver.coerce(expectedGo)?.version || expectedGo;
        const actualCoerced = semver.coerce(actualClean)?.version || actualClean;

        const satisfies =
          semver.valid(actualCoerced) &&
          semver.valid(expectedCoerced) &&
          semver.gte(actualCoerced, expectedCoerced);

        if (satisfies) {
          results.push({
            id: 'runtime.go',
            label: 'Go',
            category: 'Runtime',
            severity: 'pass',
            expected: expectedGo,
            actual: actualClean,
            message: `${actualClean} (go.mod wants ${expectedGo})`,
          });
        } else {
          results.push({
            id: 'runtime.go',
            label: 'Go',
            category: 'Runtime',
            severity: 'fail',
            expected: expectedGo,
            actual: actualClean,
            message: `${actualClean} (go.mod wants >= ${expectedGo})`,
            fix: `brew install go@${expectedGo} || gvm install go${expectedGo}`,
          });
        }
      }
    }
  }

  // 4. Rust check
  const rustTomlPath = path.join(targetDir, 'rust-toolchain.toml');
  const rustPlainPath = path.join(targetDir, 'rust-toolchain');
  const rustTomlContent = await readFileQuiet(rustTomlPath);
  const rustPlainContent = await readFileQuiet(rustPlainPath);

  if (rustTomlContent !== null || rustPlainContent !== null) {
    let expectedRust: string | undefined;
    let malformedReason: string | undefined;

    if (rustPlainContent !== null) {
      expectedRust = rustPlainContent.trim();
    }

    if (rustTomlContent !== null) {
      try {
        const parsed: any = parseToml(rustTomlContent);
        if (parsed.toolchain?.channel) {
          expectedRust = String(parsed.toolchain.channel).trim();
        }
      } catch (err: any) {
        malformedReason = `Invalid TOML in rust-toolchain.toml: ${err.message}`;
      }
    }

    if (malformedReason && !expectedRust) {
      results.push({
        id: 'runtime.rust',
        label: 'Rust',
        category: 'Runtime',
        severity: 'skipped',
        message: malformedReason,
        skipReason: malformedReason,
      });
    } else if (expectedRust) {
      let actualRaw: string | undefined;
      let actualInstalled = true;

      try {
        actualRaw = await rustExecutor();
      } catch {
        actualInstalled = false;
      }

      if (!actualInstalled || !actualRaw) {
        results.push({
          id: 'runtime.rust',
          label: 'Rust',
          category: 'Runtime',
          severity: 'fail',
          expected: expectedRust,
          actual: 'not installed',
          message: `Rust is not installed (rust-toolchain wants ${expectedRust})`,
          fix: `rustup toolchain install ${expectedRust}`,
        });
      } else {
        const actualClean = cleanVersion(actualRaw);
        const matches = actualClean.includes(expectedRust) || expectedRust.includes(actualClean);

        if (matches) {
          results.push({
            id: 'runtime.rust',
            label: 'Rust',
            category: 'Runtime',
            severity: 'pass',
            expected: expectedRust,
            actual: actualClean,
            message: `${actualClean} (channel ${expectedRust})`,
          });
        } else {
          results.push({
            id: 'runtime.rust',
            label: 'Rust',
            category: 'Runtime',
            severity: 'fail',
            expected: expectedRust,
            actual: actualClean,
            message: `${actualClean} (rust-toolchain wants ${expectedRust})`,
            fix: `rustup toolchain install ${expectedRust}`,
          });
        }
      }
    }
  }

  return results;
}
