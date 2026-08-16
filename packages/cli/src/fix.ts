import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { spawn } from 'node:child_process';
import pc from 'picocolors';
import type { CheckResult } from '@envpreflight/core';

async function executeInteractive(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
    child.on('error', (err) => {
      reject(err);
    });
  });
}

export async function runInteractiveFixes(results: CheckResult[]): Promise<void> {
  const fixable = results.filter((r) => r.fix && (r.severity === 'fail' || r.severity === 'warn'));

  if (fixable.length === 0) {
    console.log(pc.green('\nNo automated fixes available.'));
    return;
  }

  console.log(pc.bold(`\nFound ${fixable.length} suggested fix${fixable.length === 1 ? '' : 'es'}:\n`));

  const rl = readline.createInterface({ input, output });

  try {
    for (const item of fixable) {
      console.log(`Fix for ${pc.bold(item.label)} (${item.id}):`);
      console.log(`  ${pc.cyan(item.fix!)}`);

      const answer = await rl.question(pc.yellow('Run this fix? (y/N): '));
      if (answer.trim().toLowerCase() === 'y') {
        console.log(pc.dim(`\nRunning: ${item.fix}...\n`));
        try {
          await executeInteractive(item.fix!);
          console.log(pc.green(`✓ Successfully executed fix for ${item.label}\n`));
        } catch (err: any) {
          console.error(pc.red(`✗ Fix execution failed: ${err.message}\n`));
        }
      } else {
        console.log(pc.dim('Skipped.\n'));
      }
    }
  } finally {
    rl.close();
  }
}
