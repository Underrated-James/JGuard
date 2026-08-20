import * as vscode from 'vscode';

type GuardState = 'off' | 'protecting' | 'changes' | 'conflict' | 'restoring';

export class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'jguard.toggleProtection';
    this.setState('off');
    this.item.show();
  }

  setState(state: GuardState, changeCount: number = 0) {
    switch (state) {
      case 'off':
        this.item.text = '$(shield) AI Guard: OFF';
        this.item.tooltip = 'Click to enable AI Guard checkpoint';
        this.item.backgroundColor = undefined;
        this.item.command = 'jguard.toggleProtection';
        break;
      case 'protecting':
        this.item.text = '$(shield-check) AI Guard: PROTECTING';
        this.item.tooltip = 'Workspace protected. Click to disable.';
        this.item.backgroundColor = undefined;
        this.item.command = 'jguard.toggleProtection';
        break;
      case 'changes':
        this.item.text = `$(repo-sync) AI Guard: ${changeCount} CHANGES`;
        this.item.tooltip = 'AI changes detected. Click to review.';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.item.command = 'jguardSidebar.focus';
        break;
      case 'conflict':
        this.item.text = '$(alert) AI Guard: CONFLICT';
        this.item.tooltip = 'Manual edits detected after AI changes. Review required.';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.item.command = 'jguardSidebar.focus';
        break;
      case 'restoring':
        this.item.text = '$(sync~spin) AI Guard: RESTORING...';
        this.item.tooltip = 'Restoring checkpoint...';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        this.item.command = undefined;
        break;
    }
  }

  dispose() {
    this.item.dispose();
  }
}
