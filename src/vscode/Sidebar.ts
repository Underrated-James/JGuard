import * as vscode from 'vscode';
import { ChangeSet, FileChange } from '../core/types';

export class GuardTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly change?: FileChange
  ) {
    super(label, collapsibleState);
    if (change) {
      this.tooltip = change.relativePath;
      this.description = change.type;
      
      // Set icon based on change type
      if (change.type === 'modified') {
        this.iconPath = new vscode.ThemeIcon('edit');
      } else if (change.type === 'created') {
        this.iconPath = new vscode.ThemeIcon('add');
      } else if (change.type === 'deleted') {
        this.iconPath = new vscode.ThemeIcon('trash');
      }
      
      // We'll set a command to open the diff view
      this.command = {
        command: 'jguard.openDiff',
        title: 'Open Diff',
        arguments: [change],
      };
    }
  }
}

export class SidebarProvider implements vscode.TreeDataProvider<GuardTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<GuardTreeItem | undefined | void> = new vscode.EventEmitter<GuardTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<GuardTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private currentChangeSet: ChangeSet | null = null;
  private isProtecting: boolean = false;
  private isHidden: boolean = false;

  refresh(changeSet: ChangeSet | null, isProtecting: boolean, isHidden: boolean = false): void {
    this.currentChangeSet = changeSet;
    this.isProtecting = isProtecting;
    this.isHidden = isHidden;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GuardTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GuardTreeItem): Thenable<GuardTreeItem[]> {
    if (!this.isProtecting) {
      return Promise.resolve([
        new GuardTreeItem('Protection is OFF', vscode.TreeItemCollapsibleState.None)
      ]);
    }

    if (!element) {
      // Root elements
      const children = [
        new GuardTreeItem('Status: PROTECTING', vscode.TreeItemCollapsibleState.None),
      ];

      if (this.currentChangeSet && this.currentChangeSet.changes.length > 0) {
        const title = this.isHidden ? `Changes Hidden (Showing Original)` : `Changes (${this.currentChangeSet.changes.length})`;
        children.push(
          new GuardTreeItem(
            title, 
            vscode.TreeItemCollapsibleState.Expanded
          )
        );
      } else {
        children.push(
          new GuardTreeItem('No changes detected yet', vscode.TreeItemCollapsibleState.None)
        );
      }
      
      return Promise.resolve(children);
    } else if (element.label.startsWith('Changes')) {
      // List the actual changes
      if (this.currentChangeSet) {
        return Promise.resolve(
          this.currentChangeSet.changes.map(c => 
            new GuardTreeItem(c.relativePath, vscode.TreeItemCollapsibleState.None, c)
          )
        );
      }
    }

    return Promise.resolve([]);
  }
}
