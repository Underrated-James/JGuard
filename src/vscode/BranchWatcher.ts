import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Monitors the .git/HEAD file to detect branch switches or rebases.
 * When a VCS operation occurs, it fires an event so JGuard can suspend protection
 * to avoid falsely flagging git branch changes as AI changes.
 */
export class BranchWatcher {
  private headWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private _onBranchChanged = new vscode.EventEmitter<string>();
  public readonly onBranchChanged = this._onBranchChanged.event;

  constructor() {
    this.setupWatchers();
    
    // Listen for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.setupWatchers();
    });
  }

  private async setupWatchers() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;

    // Dispose old watchers
    for (const watcher of this.headWatchers.values()) {
      watcher.dispose();
    }
    this.headWatchers.clear();

    for (const folder of folders) {
      const gitHeadPath = path.join(folder.uri.fsPath, '.git', 'HEAD');
      
      try {
        // Check if .git/HEAD exists
        await fs.stat(gitHeadPath);
        
        // Watch .git/HEAD for changes
        const pattern = new vscode.RelativePattern(folder, '.git/HEAD');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);
        
        watcher.onDidChange(() => this._onBranchChanged.fire(folder.uri.fsPath));
        watcher.onDidCreate(() => this._onBranchChanged.fire(folder.uri.fsPath));
        
        this.headWatchers.set(folder.uri.fsPath, watcher);
      } catch (e) {
        // Not a git repository or no access, skip
      }
    }
  }

  public dispose() {
    for (const watcher of this.headWatchers.values()) {
      watcher.dispose();
    }
    this.headWatchers.clear();
    this._onBranchChanged.dispose();
  }
}
