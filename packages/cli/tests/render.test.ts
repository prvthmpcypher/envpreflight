import { describe, it, expect } from 'vitest';
import { renderReport } from '../src/render.js';
import type { Report } from '@envpreflight/core';

describe('CLI Report Renderer', () => {
  it('renders a formatted report grouped by category with symbols and indented fix lines', () => {
    const report: Report = {
      projectName: 'my-project',
      exitCode: 1,
      durationMs: 800,
      results: [
        {
          id: 'runtime.node',
          label: 'Node.js',
          category: 'Runtime',
          severity: 'pass',
          actual: '20.11.0',
          message: '20.11.0 (.nvmrc wants 20)',
        },
        {
          id: 'runtime.python',
          label: 'Python',
          category: 'Runtime',
          severity: 'fail',
          actual: '3.9.6',
          message: '3.9.6 (pyproject.toml wants >=3.11)',
          fix: 'pyenv install 3.11.7 && pyenv local 3.11.7',
        },
        {
          id: 'service.postgres',
          label: 'PostgreSQL',
          category: 'Services',
          severity: 'pass',
          actual: 'reachable on 5432',
          message: 'reachable on 5432',
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
        {
          id: 'env.diff',
          label: '.env',
          category: 'Environment',
          severity: 'warn',
          message: '2 keys in .env.example are missing: STRIPE_SECRET_KEY, RESEND_API_KEY',
        },
      ],
    };

    const output = renderReport(report, { color: false });

    // Assert header
    expect(output).toContain('envpreflight · my-project');

    // Assert category groupings
    expect(output).toContain('Runtime');
    expect(output).toContain('Services');
    expect(output).toContain('Environment');

    // Assert symbols
    expect(output).toContain('✓ Node.js');
    expect(output).toContain('✗ Python');
    expect(output).toContain('! .env');

    // Assert fix lines
    expect(output).toContain('→ pyenv install 3.11.7 && pyenv local 3.11.7');
    expect(output).toContain('→ docker compose up -d redis');

    // Assert summary stats
    expect(output).toContain('2 failed');
    expect(output).toContain('1 warning');
    expect(output).toContain('2 passed');
    expect(output).toContain('0.8s');
  });

  it('filters to failures only when quiet mode is enabled', () => {
    const report: Report = {
      projectName: 'my-project',
      exitCode: 1,
      durationMs: 450,
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
          id: 'runtime.python',
          label: 'Python',
          category: 'Runtime',
          severity: 'fail',
          actual: '3.9.6',
          message: '3.9.6',
          fix: 'pyenv install 3.11.7',
        },
      ],
    };

    const output = renderReport(report, { color: false, quiet: true });
    expect(output).not.toContain('✓ Node.js');
    expect(output).toContain('✗ Python');
  });
});
