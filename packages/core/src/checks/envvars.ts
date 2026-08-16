import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CheckResult } from '../types.js';

async function readFileQuiet(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Extracts ONLY variable key names from an env file.
 * Guaranteed to NEVER extract, return, or log variable values.
 */
export function extractEnvKeys(content: string): Set<string> {
  const keys = new Set<string>();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Strip leading 'export ' if present
    const cleaned = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const equalIdx = cleaned.indexOf('=');

    if (equalIdx > 0) {
      const key = cleaned.slice(0, equalIdx).trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        keys.add(key);
      }
    } else {
      // Key with no value specified (e.g. KEY_NAME)
      const key = cleaned.trim();
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        keys.add(key);
      }
    }
  }

  return keys;
}

export async function checkEnvVars(targetDir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Look for .env.example, .env.sample, or .env.template
  const candidateNames = ['.env.example', '.env.sample', '.env.template'];
  let examplePath: string | null = null;
  let exampleFilename = '';
  let exampleContent: string | null = null;

  for (const name of candidateNames) {
    const p = path.join(targetDir, name);
    const content = await readFileQuiet(p);
    if (content !== null) {
      examplePath = p;
      exampleFilename = name;
      exampleContent = content;
      break;
    }
  }

  // If no example file exists, skip silently (nothing to compare against)
  if (!examplePath || exampleContent === null) {
    return results;
  }

  const envPath = path.join(targetDir, '.env');
  const envContent = await readFileQuiet(envPath);

  if (envContent === null) {
    results.push({
      id: 'env.missing_file',
      label: '.env',
      category: 'Environment',
      severity: 'fail',
      message: `.env is missing (.env.example exists)`,
      fix: `cp ${exampleFilename} .env`,
    });
    return results;
  }

  const exampleKeys = extractEnvKeys(exampleContent);
  const actualKeys = extractEnvKeys(envContent);

  const missingKeys: string[] = [];
  for (const key of exampleKeys) {
    if (!actualKeys.has(key)) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length === 0) {
    results.push({
      id: 'env.diff',
      label: '.env',
      category: 'Environment',
      severity: 'pass',
      message: `all ${exampleKeys.size} keys from ${exampleFilename} are set in .env`,
    });
  } else {
    results.push({
      id: 'env.diff',
      label: '.env',
      category: 'Environment',
      severity: 'warn',
      message: `${missingKeys.length} ${
        missingKeys.length === 1 ? 'key' : 'keys'
      } in ${exampleFilename} are missing: ${missingKeys.join(', ')}`,
      fix: `Add ${missingKeys.join(', ')} to .env`,
    });
  }

  return results;
}
