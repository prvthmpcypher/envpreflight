import { describe, it, expect } from 'vitest';
import { generateWebviewHtml } from '../src/panel.js';
import type { Report } from '@envpreflight/core';

describe('VS Code Extension Panel', () => {
  it('renders placeholder message when no report is available', () => {
    const html = generateWebviewHtml(null);
    expect(html).toContain('No active report');
  });

  it('renders webview HTML using native VS Code theme tokens and fix actions', () => {
    const report: Report = {
      projectName: 'my-app',
      exitCode: 1,
      durationMs: 700,
      results: [
        {
          id: 'runtime.node',
          label: 'Node.js',
          category: 'Runtime',
          severity: 'pass',
          actual: '20.11.0',
          message: '20.11.0',
        },
        {
          id: 'service.redis',
          label: 'Redis',
          category: 'Services',
          severity: 'fail',
          actual: 'not reachable',
          message: 'nothing listening on 6379',
          fix: 'docker compose up -d redis',
        },
      ],
    };

    const html = generateWebviewHtml(report);
    expect(html).toContain('envpreflight · my-app');
    expect(html).toContain('var(--vscode-charts-green');
    expect(html).toContain('var(--vscode-charts-red');
    expect(html).toContain('docker compose up -d redis');
    expect(html).toContain('Run in Terminal');
    expect(html).toContain('1 failed · 0 warnings · 1 passed');
  });
});
