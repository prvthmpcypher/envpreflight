import type { Report, CheckResult } from '@envpreflight/core';

export function generateWebviewHtml(report: Report | null): string {
  if (!report) {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-descriptionForeground);
      padding: 24px;
      text-align: center;
    }
  </style>
</head>
<body>
  <p>No active report. Run <code>envpreflight: Run checks</code> from the command palette.</p>
</body>
</html>`;
  }

  const grouped = new Map<string, CheckResult[]>();
  for (const r of report.results) {
    const cat = r.category || 'General';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(r);
  }

  let sectionsHtml = '';
  for (const [cat, items] of grouped.entries()) {
    let itemsHtml = '';
    for (const item of items) {
      const sym =
        item.severity === 'pass'
          ? '✓'
          : item.severity === 'warn'
          ? '!'
          : item.severity === 'fail'
          ? '✗'
          : '-';

      const colorVar =
        item.severity === 'pass'
          ? 'var(--vscode-charts-green, #16a34a)'
          : item.severity === 'warn'
          ? 'var(--vscode-charts-yellow, #eab308)'
          : item.severity === 'fail'
          ? 'var(--vscode-charts-red, #ef4444)'
          : 'var(--vscode-descriptionForeground)';

      let fixButtonHtml = '';
      if (item.fix && (item.severity === 'fail' || item.severity === 'warn')) {
        const escapedFix = item.fix.replace(/"/g, '&quot;');
        fixButtonHtml = `
          <div class="fix-container">
            <span class="fix-text">→ ${escapedFix}</span>
            <button class="fix-btn" onclick="vscode.postMessage({ command: 'runFix', fix: '${escapedFix}' })">Run in Terminal</button>
          </div>
        `;
      }

      itemsHtml += `
        <div class="item-row">
          <div class="item-header">
            <span class="item-sym" style="color: ${colorVar}">${sym}</span>
            <span class="item-label">${item.label}</span>
            <span class="item-msg">${item.message || ''}</span>
          </div>
          ${fixButtonHtml}
        </div>
      `;
    }

    sectionsHtml += `
      <div class="category-section">
        <h3 class="category-title">${cat}</h3>
        <div class="category-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  const failedCount = report.results.filter((r) => r.severity === 'fail').length;
  const warnCount = report.results.filter((r) => r.severity === 'warn').length;
  const passCount = report.results.filter((r) => r.severity === 'pass').length;
  const durSec = (report.durationMs / 1000).toFixed(1);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
      margin: 0;
      line-height: 1.5;
    }
    h2 {
      margin-top: 0;
      font-size: 1.3rem;
      border-bottom: 1px solid var(--vscode-panel-border, #333);
      padding-bottom: 8px;
    }
    .summary-bar {
      font-size: 0.9rem;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 20px;
    }
    .category-section {
      margin-bottom: 24px;
    }
    .category-title {
      font-size: 1rem;
      margin: 0 0 10px 0;
      color: var(--vscode-foreground);
      font-weight: 600;
    }
    .item-row {
      padding: 8px 12px;
      border-radius: 4px;
      background: var(--vscode-textCodeBlock-background, rgba(255,255,255,0.03));
      margin-bottom: 6px;
    }
    .item-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .item-sym {
      font-weight: bold;
      width: 16px;
      text-align: center;
    }
    .item-label {
      font-weight: 600;
      min-width: 140px;
    }
    .item-msg {
      color: var(--vscode-descriptionForeground);
      flex: 1;
    }
    .fix-container {
      margin-top: 6px;
      padding-left: 26px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .fix-text {
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--vscode-textLink-foreground, #38bdf8);
      font-size: 0.85rem;
    }
    .fix-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.8rem;
    }
    .fix-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h2>envpreflight · ${report.projectName || 'project'}</h2>
  <div class="summary-bar">
    ${failedCount} failed · ${warnCount} warnings · ${passCount} passed · ${durSec}s
  </div>
  ${sectionsHtml}
  <script>
    const vscode = acquireVsCodeApi();
  </script>
</body>
</html>`;
}
