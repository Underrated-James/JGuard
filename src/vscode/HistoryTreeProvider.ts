import * as vscode from 'vscode';
import * as path from 'path';
import { MetadataStore } from '../storage/MetadataStore';
import { CheckpointSession, FileDecision } from '../core/types';
import { DiffProvider } from './DiffProvider';

export class HistorySessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly session: CheckpointSession,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `Session: ${session.id}\nStatus: ${session.status}`;
    
    if (session.status === 'active') {
      this.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.blue'));
    } else if (session.status === 'accepted') {
      this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
    } else if (session.status === 'rejected') {
      this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    } else {
      this.iconPath = new vscode.ThemeIcon('history');
    }

    this.contextValue = 'jguard.historyItem';
  }
}

export class HistoryFileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly decision: FileDecision,
    public readonly wsRoot: string,
    public readonly origHash: string,
    public readonly aiHash?: string
  ) {
    super(filePath, vscode.TreeItemCollapsibleState.None);
    this.description = decision;
    
    if (decision === 'accepted') {
      this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    } else if (decision === 'rejected') {
      this.iconPath = new vscode.ThemeIcon('close', new vscode.ThemeColor('charts.red'));
    } else {
      this.iconPath = new vscode.ThemeIcon('file');
    }

    this.tooltip = `${filePath} (${decision})\nClick to view diff`;

    // Direct diff command on click
    let originalUri: vscode.Uri;
    if (origHash) {
      originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://${origHash}/${path.basename(filePath)}`);
    } else {
      originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://empty/${path.basename(filePath)}`);
    }

    let rightUri: vscode.Uri;
    if (aiHash) {
      rightUri = vscode.Uri.parse(`${DiffProvider.scheme}://${aiHash}/${path.basename(filePath)}`);
    } else {
      rightUri = vscode.Uri.file(path.join(wsRoot, filePath));
    }

    this.command = {
      command: 'vscode.diff',
      title: 'Open History Diff',
      arguments: [originalUri, rightUri, `${path.basename(filePath)} (Checkpoint ↔ ${decision.toUpperCase()})`]
    };

    this.contextValue = 'jguard.historyFileItem';
  }
}

export type HistoryItem = HistorySessionTreeItem | HistoryFileTreeItem;

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<HistoryItem | undefined | void> = new vscode.EventEmitter<HistoryItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<HistoryItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private metadataStore: MetadataStore) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HistoryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HistoryItem): Promise<HistoryItem[]> {
    if (element instanceof HistorySessionTreeItem) {
      // Return file items for this session
      const session = element.session;
      const fileItems: HistoryFileTreeItem[] = [];

      if (session.uiState?.decisions) {
        for (const [wsRoot, rootDecisions] of Object.entries(session.uiState.decisions)) {
          const cp = session.folderCheckpoints[wsRoot];
          for (const [filePath, decision] of Object.entries(rootDecisions)) {
            const origHash = cp?.files[filePath]?.hash || '';
            const aiHash = session.uiState.aiSnapshotHashes?.[filePath];
            fileItems.push(new HistoryFileTreeItem(filePath, decision, wsRoot, origHash, aiHash));
          }
        }
      }
      return fileItems;
    }

    if (element instanceof HistoryFileTreeItem) {
      return [];
    }

    // Root level: Return all sessions
    try {
      const sessionIds = await this.metadataStore.listSessions();
      
      const sessions: CheckpointSession[] = [];
      for (const id of sessionIds) {
        try {
          const session = await this.metadataStore.readSession(id);
          sessions.push(session);
        } catch (e) {
          console.error(`Failed to read session ${id}`, e);
        }
      }

      // Sort newest first
      sessions.sort((a, b) => b.createdAt - a.createdAt);

      return sessions.map(session => {
        const date = new Date(session.createdAt);
        
        let decisionCount = 0;
        if (session.uiState?.decisions) {
          for (const rd of Object.values(session.uiState.decisions)) {
            decisionCount += Object.keys(rd).length;
          }
        }

        const countSuffix = decisionCount > 0 ? ` (${decisionCount} files)` : '';
        const label = `${date.toLocaleDateString()} ${date.toLocaleTimeString()} - ${session.status}${countSuffix}`;
        
        const hasChildren = decisionCount > 0;
        return new HistorySessionTreeItem(
          label,
          session,
          hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        );
      });
    } catch (e) {
      console.error('Failed to load history', e);
      return [];
    }
  }
}
