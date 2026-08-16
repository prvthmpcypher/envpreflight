import { Command } from 'commander';
import { runAllChecks, detectManifests, type Report } from '@envpreflight/core';
import { renderReport } from './render.js';
import { runInteractiveFixes } from './fix.js';

export * from './render.js';
export * from './fix.js';

export interface CliOptions {
  json?: boolean;
  only?: string;
  skip?: string;
  fix?: boolean;
  quiet?: boolean;
  cwd?: string;
}

export function createCli(): Command {
  const program = new Command('envpreflight');

  program
    .version('0.1.0')
    .description('Check your machine can actually run this project — before you waste a day finding out it can\'t.')
    .option('--json', 'Output full Report as machine-readable JSON')
    .option('--only <ids>', 'Run only specified check IDs or categories (comma-separated)')
    .option('--skip <ids>', 'Skip specified check IDs or categories (comma-separated)')
    .option('--fix', 'Interactively review and run suggested fixes')
    .option('-q, --quiet', 'Display failures and warnings only')
    .option('--cwd <path>', 'Target directory to check', process.cwd())
    .action(async (opts: CliOptions) => {
      const targetDir = opts.cwd || process.cwd();

      // Check if any recognized manifests exist
      const manifests = await detectManifests(targetDir);
      if (manifests.manifestFiles.length === 0) {
        if (opts.json) {
          const emptyReport: Report = {
            results: [],
            exitCode: 0,
            durationMs: 0,
            projectName: 'unknown',
          };
          console.log(JSON.stringify(emptyReport, null, 2));
        } else {
          console.log(
            `No recognized project manifests found in ${targetDir}. envpreflight works from the project root.`
          );
        }
        process.exitCode = 0;
        return;
      }

      const onlyList = opts.only ? opts.only.split(',').map((s) => s.trim()) : undefined;
      const skipList = opts.skip ? opts.skip.split(',').map((s) => s.trim()) : undefined;

      const report = await runAllChecks(targetDir, {
        only: onlyList,
        skip: skipList,
      });

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        const rendered = renderReport(report, {
          quiet: opts.quiet,
        });
        console.log(rendered);

        if (opts.fix) {
          await runInteractiveFixes(report.results);
        }
      }

      process.exitCode = report.exitCode;
    });

  return program;
}
