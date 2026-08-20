import * as vscode from 'vscode';
import { ChangeSet, FileChange, FileDecision, FileViewState } from '../core/types';
import * as path from 'path';

export class GuardTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly change?: FileChange,
    public readonly decision?: FileDecision,
    public readonly fileViewState?: FileViewState,
    public readonly isBinary?: boolean
  ) {
    super(label, collapsibleState);
    if (change) {
      this.tooltip = this.buildTooltip(change);
      
      let attrLabel = '';
      if (change.attribution === 'human') attrLabel = ' (Human)';
      else if (change.attribution === 'ai') attrLabel = ' (AI)';
      else if (change.attribution === 'git') attrLabel = ' (Git)';

      // L2: Show decision state in description
      if (decision === 'accepted') {
        this.description = `${change.type}${attrLabel} ✓ accepted`;
      } else if (decision === 'rejected') {
        this.description = `${change.type}${attrLabel} ✗ rejected`;
      } else {
        // L3: Show view state
        if (fileViewState === 'original') {
          this.description = `${change.type}${attrLabel} (showing original)`;
        } else {
          this.description = `${change.type}${attrLabel}`;
        }
      }
      
      // Set icon based on change type and decision
      if (decision === 'accepted') {
        this.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      } else if (decision === 'rejected') {
        this.iconPath = new vscode.ThemeIcon('close', new vscode.ThemeColor('charts.red'));
      } else if (isBinary) {
        // L6: Distinct icon for binary files
        this.iconPath = new vscode.ThemeIcon('file-binary');
      } else if (change.type === 'modified') {
        this.iconPath = new vscode.ThemeIcon('edit');
      } else if (change.type === 'created') {
        this.iconPath = new vscode.ThemeIcon('add');
      } else if (change.type === 'deleted') {
        this.iconPath = new vscode.ThemeIcon('trash');
      }
      
      // L2: Set contextValue to enable inline actions
      if (decision === 'accepted') {
        this.contextValue = 'jguard.changeItem.accepted';
      } else if (decision === 'rejected') {
        this.contextValue = 'jguard.changeItem.rejected';
      } else {
        this.contextValue = 'jguard.changeItem';
      }
      
      // Open diff on click
      this.command = {
        command: 'jguard.openDiff',
        title: 'Open Diff',
        arguments: [change],
      };
    }
  }

  private buildTooltip(change: FileChange): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**${change.relativePath}**\n\n`);
    md.appendMarkdown(`Type: \`${change.type}\`\n`);
    if (change.attribution) {
      const attrLabel = change.attribution === 'ai' ? 'AI' : change.attribution === 'human' ? 'Human' : 'Git / External';
      md.appendMarkdown(`Attribution: \`${attrLabel}\`\n\n`);
    } else {
      md.appendMarkdown(`\n`);
    }
    md.appendMarkdown(`Click to view diff • Use inline buttons to Accept ✓, Reject ✗, or Toggle 👁`);
    return md;
  }
}

export class SidebarProvider implements vscode.TreeDataProvider<GuardTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<GuardTreeItem | undefined | void> = new vscode.EventEmitter<GuardTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<GuardTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  // L1: Multi-root changesets
  private changeSets: Map<string, ChangeSet> | null = null;
  private isProtecting: boolean = false;
  private isHidden: boolean = false;
  // L3: Per-file view states
  private fileViewStates: Map<string, FileViewState> = new Map();

  /**
   * L1: Accepts either a Map of changesets (multi-root) or null.
   */
  refresh(
    changeSets: Map<string, ChangeSet> | null,
    isProtecting: boolean,
    isHidden: boolean = false,
    fileViewStates?: Map<string, FileViewState>
  ): void {
    this.changeSets = changeSets;
    this.isProtecting = isProtecting;
    this.isHidden = isHidden;
    this.fileViewStates = fileViewStates || new Map();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GuardTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GuardTreeItem): Thenable<GuardTreeItem[]> {
    if (!this.isProtecting) {
      const item = new GuardTreeItem('Protection is OFF (Click to Enable)', vscode.TreeItemCollapsibleState.None);
      item.command = {
        command: 'jguard.toggleProtection',
        title: 'Enable Protection',
      };
      item.iconPath = new vscode.ThemeIcon('shield');
      item.tooltip = 'Click to create a checkpoint and enable AI Guard protection';
      return Promise.resolve([item]);
    }

    if (!element) {
      // Root elements
      const children: GuardTreeItem[] = [
        new GuardTreeItem('Status: PROTECTING', vscode.TreeItemCollapsibleState.None),
      ];

      if (!this.changeSets || this.changeSets.size === 0) {
        children.push(
          new GuardTreeItem('No changes detected yet', vscode.TreeItemCollapsibleState.None)
        );
        return Promise.resolve(children);
      }

      // L1: Multi-root — group by workspace folder
      const isMultiRoot = this.changeSets.size > 1;

      if (isMultiRoot) {
        // Show one collapsible node per workspace folder
        for (const [wsRoot, cs] of this.changeSets.entries()) {
          const folderName = path.basename(wsRoot);
          const count = cs.changes.length;
          if (count > 0) {
            const title = this.isHidden
              ? `📁 ${folderName} — Hidden (${count})`
              : `📁 ${folderName} — Changes (${count})`;
            const item = new GuardTreeItem(title, vscode.TreeItemCollapsibleState.Expanded);
            (item as any)._wsRoot = wsRoot; // Tag for child lookup
            children.push(item);
          }
        }
      } else {
        // Single root — flat list like before
        const [, cs] = [...this.changeSets.entries()][0];
        if (cs.changes.length > 0) {
          const title = this.isHidden ? `Changes Hidden (Showing Original)` : `Changes (${cs.changes.length})`;
          const item = new GuardTreeItem(title, vscode.TreeItemCollapsibleState.Expanded);
          (item as any)._wsRoot = [...this.changeSets.keys()][0];
          children.push(item);
        } else {
          children.push(
            new GuardTreeItem('No changes detected yet', vscode.TreeItemCollapsibleState.None)
          );
        }
      }
      
      return Promise.resolve(children);
    }

    // Child elements — file list for a folder
    const wsRoot = (element as any)._wsRoot as string | undefined;
    if (wsRoot && this.changeSets?.has(wsRoot)) {
      const cs = this.changeSets.get(wsRoot)!;
      return Promise.resolve(
        cs.changes.map(c => {
          const decision = cs.decisions[c.relativePath] || 'pending';
          const viewState = this.fileViewStates.get(c.relativePath) || 'ai';
          const isBinary = false; // Could be enhanced with checkpoint data
          return new GuardTreeItem(
            c.relativePath,
            vscode.TreeItemCollapsibleState.None,
            c,
            decision,
            viewState,
            isBinary
          );
        })
      );
    }

    return Promise.resolve([]);
  }
}
