import * as vscode from 'vscode';
import { StashService } from '../application/StashService';
import { StashedChange } from '../core/types';

export class StashedChangeTreeItem extends vscode.TreeItem {
  constructor(public readonly stash: StashedChange) {
    super(stash.relativePath, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'jguard.stashedChangeItem';
    
    const date = new Date(stash.timestamp);
    this.description = date.toLocaleTimeString();
    
    this.tooltip = new vscode.MarkdownString(
      `**${stash.relativePath}**\n\nStashed at: ${date.toLocaleString()}`
    );
    this.tooltip.isTrusted = true;

    this.iconPath = new vscode.ThemeIcon('archive');
  }
}

export class StashTreeProvider implements vscode.TreeDataProvider<StashedChangeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StashedChangeTreeItem | undefined | void> = new vscode.EventEmitter<StashedChangeTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StashedChangeTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private stashService: StashService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StashedChangeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StashedChangeTreeItem): Promise<StashedChangeTreeItem[]> {
    if (element) {
      return [];
    }

    const stashes = await this.stashService.getStashes();
    // Sort newest first
    stashes.sort((a, b) => b.timestamp - a.timestamp);

    return stashes.map(stash => new StashedChangeTreeItem(stash));
  }
}
