import * as vscode from 'vscode';
import * as path from 'path';
import { FileChange, ChangeSet, Checkpoint } from '../core/types';
import { DiffProvider } from './DiffProvider';
import { CheckpointService } from '../application/CheckpointService';
import { RestoreService } from '../application/RestoreService';
import { ChangeDetector } from '../core/ChangeDetector';
import { ConflictDetector } from '../core/ConflictDetector';
import { RestorePlanner } from '../core/RestorePlanner';
import { SidebarProvider } from './Sidebar';
import { StatusBar } from './StatusBar';
import { WorkspaceScanner } from './WorkspaceScanner';

export class Commands {
  private activeCheckpoint: Checkpoint | null = null;
  private currentChangeSet: ChangeSet | null = null;
  private forwardCheckpoint: Checkpoint | null = null;
  private viewState: 'ai' | 'original' = 'ai';

  constructor(
    private context: vscode.ExtensionContext,
    private checkpointService: CheckpointService,
    private restoreService: RestoreService,
    private scanner: WorkspaceScanner,
    private sidebar: SidebarProvider,
    private statusBar: StatusBar
  ) {}

  register() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('jguard.toggleProtection', this.toggleProtection.bind(this)),
      vscode.commands.registerCommand('jguard.toggleChanges', this.toggleChanges.bind(this)),
      vscode.commands.registerCommand('jguard.openDiff', this.openDiff.bind(this)),
      vscode.commands.registerCommand('jguard.acceptAll', this.acceptAll.bind(this)),
      vscode.commands.registerCommand('jguard.rejectAll', this.rejectAll.bind(this)),
      vscode.commands.registerCommand('jguard.refresh', this.refresh.bind(this))
    );

    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const onDidChange = async () => {
      if (this.activeCheckpoint) {
        await this.refresh();
      }
    };
    
    this.context.subscriptions.push(
      watcher.onDidChange(onDidChange),
      watcher.onDidCreate(onDidChange),
      watcher.onDidDelete(onDidChange),
      watcher
    );
  }

  private async toggleProtection() {
    if (this.activeCheckpoint) {
      // It's on, let's ask if they want to turn it off (accepting current state)
      const action = await vscode.window.showInformationMessage(
        'AI Guard is currently active. Do you want to Accept all changes or Reject all changes?',
        'Accept All',
        'Reject All',
        'Cancel'
      );
      if (action === 'Accept All') {
        await this.acceptAll();
      } else if (action === 'Reject All') {
        await this.rejectAll();
      }
      return;
    }

    // It's off, let's turn it on
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('JGuard requires an open workspace.');
      return;
    }

    // Force save all
    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'AI Guard: Creating Checkpoint...',
      cancellable: false
    }, async () => {
      try {
        const workspaceId = 'ws-id'; // simplified for MVP
        this.activeCheckpoint = await this.checkpointService.createCheckpoint(workspaceId);
        
        this.statusBar.setState('protecting');
        this.sidebar.refresh(null, true);
        vscode.window.showInformationMessage('AI Guard: Workspace checkpoint created. You are now protected.');
        
        // Start watching for changes is handled by the global watcher
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to create checkpoint: ${err.message}`);
      }
    });
  }



  private async refresh() {
    if (!this.activeCheckpoint) return;
    
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    this.currentChangeSet = await ChangeDetector.detectChanges(this.activeCheckpoint, this.scanner, root);
    
    const count = this.currentChangeSet.changes.length;
    if (count > 0) {
      this.statusBar.setState('changes', count);
    } else {
      this.statusBar.setState('protecting');
    }
    
    this.sidebar.refresh(this.currentChangeSet, true);
  }

  private async openDiff(change: FileChange) {
    if (!this.activeCheckpoint) return;

    const wsFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const currentUri = vscode.Uri.file(path.join(wsFolder, change.relativePath));
    
    let originalUri: vscode.Uri;
    
    if (change.type === 'created') {
      // Comparing empty to new
      originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`);
    } else {
      const hash = change.type === 'modified' ? change.checkpointHash : (change as any).checkpointHash;
      originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://${hash}/${change.relativePath}`);
    }

    const title = `${change.relativePath} (Checkpoint ↔ Current)`;
    
    if (change.type === 'deleted') {
      await vscode.commands.executeCommand('vscode.diff', originalUri, vscode.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`), title);
    } else {
      await vscode.commands.executeCommand('vscode.diff', originalUri, currentUri, title);
    }
  }

  private async toggleChanges() {
    if (!this.activeCheckpoint) {
      vscode.window.showInformationMessage('AI Guard is not active.');
      return;
    }

    const wsFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: this.viewState === 'ai' ? 'AI Guard: Hiding Changes...' : 'AI Guard: Applying Changes...',
      cancellable: false
    }, async () => {
      try {
        if (this.viewState === 'ai') {
          // We are currently looking at AI changes. We want to see Original.
          // 1. Snapshot the current (AI) state so we can come back to it.
          this.forwardCheckpoint = await this.checkpointService.createCheckpoint('ws-id');
          
          // 2. Put the lockfile back to the original checkpoint so crash recovery works correctly.
          const fs = require('fs/promises');
          const lockFile = path.join((this.checkpointService as any).metadataStore.storageBaseDir, 'jguard.lock');
          await fs.writeFile(lockFile, this.activeCheckpoint!.id, 'utf-8');

          // 3. Re-evaluate changes to build a restore plan back to original
          this.currentChangeSet = await ChangeDetector.detectChanges(this.activeCheckpoint!, this.scanner, wsFolder);
          
          // 4. Restore to Original
          const plan = RestorePlanner.buildPlan(this.activeCheckpoint!, this.currentChangeSet, [], wsFolder);
          this.statusBar.setState('restoring');
          await this.restoreService.execute(plan);
          
          this.viewState = 'original';
          this.statusBar.setState('changes', this.currentChangeSet.changes.length); // Keep the count, but UI knows it's hidden
          this.sidebar.refresh(this.currentChangeSet, true, true); // true = isHidden
          vscode.window.showInformationMessage('AI Guard: Changes hidden (showing Original).');

        } else {
          // We are currently looking at Original. We want to see AI changes again.
          if (!this.forwardCheckpoint) return;

          // 1. Re-evaluate changes against the forward checkpoint to build a plan to go forward
          const forwardChangeSet = await ChangeDetector.detectChanges(this.forwardCheckpoint, this.scanner, wsFolder);
          
          // 2. Restore to AI State
          const plan = RestorePlanner.buildPlan(this.forwardCheckpoint, forwardChangeSet, [], wsFolder);
          this.statusBar.setState('restoring');
          await this.restoreService.execute(plan);

          this.viewState = 'ai';
          await this.refresh(); // This will recalculate changes against the original checkpoint
          vscode.window.showInformationMessage('AI Guard: Changes applied (showing AI).');
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Toggle failed: ${err.message}`);
      }
    });
  }

  private async acceptAll() {
    if (!this.activeCheckpoint) return;
    
    // If they accept while viewing the original state, warn them they are losing the AI changes!
    if (this.viewState === 'original') {
      const choice = await vscode.window.showWarningMessage('You are currently viewing the Original state. Finalizing now will permanently discard the hidden AI changes. Continue?', 'Discard AI Changes', 'Cancel');
      if (choice !== 'Discard AI Changes') return;
    }

    this.activeCheckpoint = null;
    this.currentChangeSet = null;
    this.forwardCheckpoint = null;
    this.viewState = 'ai';
    this.statusBar.setState('off');
    this.sidebar.refresh(null, false);
    await this.clearLockFile();
    vscode.window.showInformationMessage('AI Guard: Protection finalized. Changes kept.');
  }

  private async rejectAll() {
    if (!this.activeCheckpoint) return;
    
    const wsFolder = vscode.workspace.workspaceFolders![0].uri.fsPath;
    
    if (this.viewState === 'original') {
      // Already reverted! Just finalize and close.
      this.activeCheckpoint = null;
      this.currentChangeSet = null;
      this.forwardCheckpoint = null;
      this.viewState = 'ai';
      this.statusBar.setState('off');
      this.sidebar.refresh(null, false);
      await this.clearLockFile();
      vscode.window.showInformationMessage('AI Guard: Protection discarded. Original state kept.');
      return;
    }
    
    // Force save all before reject
    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    // Re-evaluate changeset to get exact current state
    this.currentChangeSet = await ChangeDetector.detectChanges(this.activeCheckpoint, this.scanner, wsFolder);

    const conflicts = await ConflictDetector.detect(this.currentChangeSet, this.scanner, wsFolder);
    
    if (conflicts.length > 0) {
      this.statusBar.setState('conflict');
      const msg = `AI Guard: ${conflicts.length} conflict(s) detected. Some files were modified by you AFTER the AI edited them. They will NOT be restored to prevent data loss.`;
      vscode.window.showWarningMessage(msg, 'Proceed Anyway', 'Cancel').then(async choice => {
        if (choice === 'Proceed Anyway') {
          await this.executeRestore(this.activeCheckpoint!, this.currentChangeSet!, conflicts, wsFolder);
        }
      });
      return;
    }

    await this.executeRestore(this.activeCheckpoint, this.currentChangeSet, [], wsFolder);
  }

  private async executeRestore(cp: Checkpoint, cs: ChangeSet, conflicts: any[], wsFolder: string) {
    this.statusBar.setState('restoring');
    
    try {
      const plan = RestorePlanner.buildPlan(cp, cs, conflicts, wsFolder);
      await this.restoreService.execute(plan);
      
      this.activeCheckpoint = null;
      this.currentChangeSet = null;
      this.forwardCheckpoint = null;
      this.viewState = 'ai';
      this.statusBar.setState('off');
      this.sidebar.refresh(null, false);
      await this.clearLockFile();
      
      vscode.window.showInformationMessage('AI Guard: Checkpoint discarded and safely reverted.');
    } catch (err: any) {
      vscode.window.showErrorMessage(`Restore failed: ${err.message}`);
      this.statusBar.setState('changes', cs.changes.length); // Revert status
    }
  }

  private async clearLockFile() {
    const fs = require('fs/promises');
    const lockFile = path.join((this.checkpointService as any).metadataStore.storageBaseDir, 'jguard.lock');
    await fs.unlink(lockFile).catch(() => {});
  }
}

