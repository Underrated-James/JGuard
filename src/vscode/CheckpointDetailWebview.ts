import * as vscode from 'vscode';
import * as path from 'path';
import { CheckpointSession } from '../core/types';
import { DiffProvider } from './DiffProvider';

export class CheckpointDetailWebview {
  public static readonly viewType = 'jguard.checkpointDetail';

  public static show(context: vscode.ExtensionContext, session: CheckpointSession) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      CheckpointDetailWebview.viewType,
      `Session: ${new Date(session.createdAt).toLocaleTimeString()}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );

    panel.webview.html = CheckpointDetailWebview.getHtmlForWebview(panel.webview, session);

    // Handle clicks from the Webview
    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'openDiff') {
        const { wsRoot, filePath, originalHash, aiHash, decision } = message;
        try {
          let originalUri: vscode.Uri;
          if (originalHash && originalHash !== 'undefined' && originalHash !== '') {
            originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://${originalHash}/${path.basename(filePath)}`);
          } else {
            originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://empty/${path.basename(filePath)}`);
          }

          let rightUri: vscode.Uri;
          if (aiHash && aiHash !== 'undefined' && aiHash !== '') {
            rightUri = vscode.Uri.parse(`${DiffProvider.scheme}://${aiHash}/${path.basename(filePath)}`);
          } else {
            rightUri = vscode.Uri.file(path.join(wsRoot, filePath));
          }

          const title = `${path.basename(filePath)} (Checkpoint ↔ ${decision.toUpperCase()})`;
          await vscode.commands.executeCommand('vscode.diff', originalUri, rightUri, title);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to open diff for ${filePath}: ${err.message}`);
        }
      }
    });
  }

  private static getHtmlForWebview(webview: vscode.Webview, session: CheckpointSession): string {
    const date = new Date(session.createdAt);
    
    // Count stats
    let totalFiles = 0;
    let accepted = 0;
    let rejected = 0;
    let pending = 0;
    
    for (const cp of Object.values(session.folderCheckpoints)) {
      totalFiles += Object.keys(cp.files).length;
    }
    
    if (session.uiState?.decisions) {
      for (const rootDecisions of Object.values(session.uiState.decisions)) {
        for (const decision of Object.values(rootDecisions)) {
          if (decision === 'accepted') accepted++;
          else if (decision === 'rejected') rejected++;
          else if (decision === 'pending') pending++;
        }
      }
    }

    const duration = session.finalizedAt 
      ? Math.round((session.finalizedAt - session.createdAt) / 1000 / 60) + ' minutes' 
      : 'Ongoing';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Session Details</title>
          <style>
              body { 
                font-family: var(--vscode-font-family); 
                padding: 24px; 
                color: var(--vscode-foreground); 
                line-height: 1.5;
              }
              h1 { 
                border-bottom: 1px solid var(--vscode-panel-border); 
                padding-bottom: 12px; 
                margin-top: 0;
                display: flex;
                align-items: center;
                gap: 8px;
              }
              .session-meta {
                display: flex;
                gap: 24px;
                background-color: var(--vscode-editor-background);
                padding: 12px 16px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                margin-bottom: 20px;
                font-size: 13px;
              }
              .meta-item {
                display: flex;
                flex-direction: column;
              }
              .meta-item strong {
                color: var(--vscode-descriptionForeground);
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              .stat-container {
                display: flex;
                gap: 12px;
                margin-bottom: 24px;
              }
              .stat-box { 
                  flex: 1;
                  padding: 16px; 
                  background-color: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-panel-border);
                  border-radius: 6px;
              }
              .stat-value { font-size: 28px; font-weight: bold; margin-bottom: 4px; }
              .stat-label { font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; font-weight: 600; }
              
              .decisions-section { margin-top: 24px; }
              .decisions-section h2 { font-size: 16px; margin-bottom: 12px; }
              .decisions-list { display: flex; flex-direction: column; gap: 8px; }
              
              .decision-item { 
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 10px 14px; 
                  background-color: var(--vscode-editor-background);
                  border: 1px solid var(--vscode-panel-border); 
                  border-radius: 6px;
                  cursor: pointer;
                  transition: background-color 0.15s ease, border-color 0.15s ease;
              }
              .decision-item:hover {
                  background-color: var(--vscode-list-hoverBackground);
                  border-color: var(--vscode-focusBorder);
              }
              .decision-left {
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: var(--vscode-editor-font-family);
                font-size: 13px;
              }
              .decision-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 12px;
                text-transform: uppercase;
              }
              .badge-accept { 
                color: var(--vscode-testing-iconPassed); 
                background-color: rgba(78, 201, 176, 0.15);
              }
              .badge-reject { 
                color: var(--vscode-testing-iconFailed); 
                background-color: rgba(241, 76, 76, 0.15);
              }
              .badge-pending { 
                color: var(--vscode-testing-iconQueued); 
                background-color: rgba(204, 204, 204, 0.15);
              }
              .diff-btn {
                font-size: 12px;
                color: var(--vscode-textLink-foreground);
                display: flex;
                align-items: center;
                gap: 4px;
              }
              .hint-text {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: 6px;
              }
          </style>
      </head>
      <body>
          <h1>🛡️ Session Details</h1>
          
          <div class="session-meta">
            <div class="meta-item">
              <strong>Session ID</strong>
              <span>${session.id}</span>
            </div>
            <div class="meta-item">
              <strong>Status</strong>
              <span style="font-weight: bold;">${session.status.toUpperCase()}</span>
            </div>
            <div class="meta-item">
              <strong>Started</strong>
              <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
            </div>
            <div class="meta-item">
              <strong>Duration</strong>
              <span>${duration}</span>
            </div>
          </div>
          
          <div class="stat-container">
              <div class="stat-box">
                  <div class="stat-value">${totalFiles}</div>
                  <div class="stat-label">Tracked Files</div>
              </div>
              <div class="stat-box">
                  <div class="stat-value" style="color: var(--vscode-testing-iconPassed);">${accepted}</div>
                  <div class="stat-label">Accepted Changes</div>
              </div>
              <div class="stat-box">
                  <div class="stat-value" style="color: var(--vscode-testing-iconFailed);">${rejected}</div>
                  <div class="stat-label">Rejected Changes</div>
              </div>
              <div class="stat-box">
                  <div class="stat-value" style="color: var(--vscode-testing-iconQueued);">${pending}</div>
                  <div class="stat-label">Pending Changes</div>
              </div>
          </div>
          
          <div class="decisions-section">
              <h2>File Decisions</h2>
              <div class="hint-text">Click any file below to inspect the diff comparison.</div>
              <div class="decisions-list" style="margin-top: 12px;">
                ${this.renderDecisions(session)}
              </div>
          </div>

          <script>
            const vscode = acquireVsCodeApi();
            function viewFileDiff(wsRoot, filePath, originalHash, aiHash, decision) {
              vscode.postMessage({
                command: 'openDiff',
                wsRoot: wsRoot,
                filePath: filePath,
                originalHash: originalHash,
                aiHash: aiHash,
                decision: decision
              });
            }
          </script>
      </body>
      </html>
    `;
  }

  private static renderDecisions(session: CheckpointSession): string {
    if (!session.uiState?.decisions || Object.keys(session.uiState.decisions).length === 0) {
      return '<p style="color: var(--vscode-descriptionForeground);">No file changes or decisions were recorded in this session.</p>';
    }

    let html = '';
    for (const [wsRoot, rootDecisions] of Object.entries(session.uiState.decisions)) {
      const checkpoint = session.folderCheckpoints[wsRoot];
      for (const [filePath, decision] of Object.entries(rootDecisions)) {
        let badgeClass = '';
        let icon = '';
        if (decision === 'accepted') {
          badgeClass = 'badge-accept';
          icon = '✓';
        } else if (decision === 'rejected') {
          badgeClass = 'badge-reject';
          icon = '✗';
        } else {
          badgeClass = 'badge-pending';
          icon = '○';
        }
        const origHash = checkpoint?.files[filePath]?.hash || '';
        const aiHash = session.uiState?.aiSnapshotHashes?.[filePath] || '';

        html += `
          <div class="decision-item" onclick="viewFileDiff('${wsRoot.replace(/'/g, "\\'")}', '${filePath.replace(/'/g, "\\'")}', '${origHash}', '${aiHash}', '${decision}')">
            <div class="decision-left">
              <span class="decision-badge ${badgeClass}">${icon} ${decision}</span>
              <span><strong>${filePath}</strong></span>
            </div>
            <div class="diff-btn">
              <span>View Diff ↗</span>
            </div>
          </div>
        `;
      }
    }
    return html;
  }
}
