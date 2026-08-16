import * as vscode from 'vscode';
import { runAllChecks, detectManifests, type Report } from '@envpreflight/core';
import { generateWebviewHtml } from './panel.js';

let statusBarItem: vscode.StatusBarItem;
let currentPanel: vscode.WebviewPanel | undefined;
let latestReport: Report | null = null;

async function executeChecks(workspaceRoot: string): Promise<Report | null> {
  const manifests = await detectManifests(workspaceRoot);
  if (manifests.manifestFiles.length === 0) {
    if (statusBarItem) {
      statusBarItem.hide();
    }
    return null;
  }

  const report = await runAllChecks(workspaceRoot);
  latestReport = report;

  updateStatusBar(report);

  if (currentPanel) {
    currentPanel.webview.html = generateWebviewHtml(report);
  }

  return report;
}

function updateStatusBar(report: Report) {
  if (!statusBarItem) return;

  const failedCount = report.results.filter((r) => r.severity === 'fail').length;
  const warnCount = report.results.filter((r) => r.severity === 'warn').length;

  if (failedCount > 0) {
    statusBarItem.text = `$(error) ${failedCount} env fail`;
    statusBarItem.tooltip = `envpreflight: ${failedCount} blocking issue(s) detected. Click to view.`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  } else if (warnCount > 0) {
    statusBarItem.text = `$(warning) ${warnCount} env warn`;
    statusBarItem.tooltip = `envpreflight: ${warnCount} warning(s) detected. Click to view.`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = `$(check) env ok`;
    statusBarItem.tooltip = `envpreflight: all checks passed. Click to view.`;
    statusBarItem.backgroundColor = undefined;
  }

  statusBarItem.show();
}

function showReportPanel(context: vscode.ExtensionContext) {
  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.Beside);
    currentPanel.webview.html = generateWebviewHtml(latestReport);
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'envpreflightReport',
    'envpreflight Report',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  currentPanel.webview.html = generateWebviewHtml(latestReport);

  currentPanel.webview.onDidReceiveMessage((message) => {
    if (message.command === 'runFix' && message.fix) {
      const terminal = vscode.window.createTerminal('envpreflight fix');
      terminal.show();
      terminal.sendText(message.fix);
    }
  });

  currentPanel.onDidDispose(
    () => {
      currentPanel = undefined;
    },
    null,
    context.subscriptions
  );
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'envpreflight.showPanel';
  context.subscriptions.push(statusBarItem);

  const checkCommand = vscode.commands.registerCommand('envpreflight.check', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      await executeChecks(workspaceFolders[0].uri.fsPath);
    }
  });

  const showPanelCommand = vscode.commands.registerCommand('envpreflight.showPanel', () => {
    showReportPanel(context);
  });

  context.subscriptions.push(checkCommand, showPanelCommand);

  // Watch manifest files to re-run automatically on save
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/{.nvmrc,package.json,pyproject.toml,.python-version,go.mod,rust-toolchain.toml,rust-toolchain,docker-compose.yml,docker-compose.yaml,compose.yml,compose.yaml,.env.example,.env}'
  );

  const handleFileChange = () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      executeChecks(workspaceFolders[0].uri.fsPath).catch(() => {});
    }
  };

  watcher.onDidChange(handleFileChange);
  watcher.onDidCreate(handleFileChange);
  watcher.onDidDelete(handleFileChange);
  context.subscriptions.push(watcher);

  // Background execution on open (never blocks UI)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    executeChecks(workspaceFolders[0].uri.fsPath).catch(() => {});
  }
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
