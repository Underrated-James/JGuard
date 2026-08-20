import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileChange, ChangeSet, Checkpoint, CheckpointSession, FileDecision, FileViewState } from '../core/types';
import { DiffProvider } from './DiffProvider';
import { CheckpointService } from '../application/CheckpointService';
import { RestoreService } from '../application/RestoreService';
import { ChangeDetector } from '../core/ChangeDetector';
import { ConflictDetector } from '../core/ConflictDetector';
import { RestorePlanner } from '../core/RestorePlanner';
import { SelectiveRestorePlanner } from '../core/SelectiveRestorePlanner';
import { SidebarProvider } from './Sidebar';
import { StatusBar } from './StatusBar';
import { WorkspaceScanner } from './WorkspaceScanner';
import { ObjectStore } from '../storage/ObjectStore';
import { BatchedWatcherQueue } from './BatchedWatcherQueue';
import { BranchWatcher } from './BranchWatcher';
import { IgnoreManager } from '../core/IgnoreManager';

export class Commands {
  // L1: Session-based state (multi-root)
  private activeSession: CheckpointSession | null = null;
  private forwardSession: CheckpointSession | null = null;

  // Per-folder changesets (L1: one per workspace folder)
  private changeSets: Map<string, ChangeSet> = new Map(); // wsRoot → ChangeSet

  // L2: AI snapshot hashes for rejected files (so they can be toggled back)
  private aiSnapshotHashes: Map<string, string> = new Map(); // relPath → hash in ObjectStore

  // L3: Per-file view state
  private fileViewStates: Map<string, FileViewState> = new Map(); // relPath → 'ai' | 'original'

  // L7: Last finalized session ID for undo
  private lastFinalizedSessionId: string | null = null;
  private lastFinalizedAt: number = 0;

  // Bulk view state for backward-compat bulk toggle
  private viewState: 'ai' | 'original' = 'ai';

  private _onDidFinalizeSession = new vscode.EventEmitter<void>();
  public readonly onDidFinalizeSession = this._onDidFinalizeSession.event;

  public getActiveSessionId(): string | undefined {
    return this.activeSession?.id;
  }

  private branchWatcher: BranchWatcher;

  constructor(
    private context: vscode.ExtensionContext,
    private checkpointService: CheckpointService,
    private restoreService: RestoreService,
    private scanner: WorkspaceScanner,
    private sidebar: SidebarProvider,
    private statusBar: StatusBar,
    private objectStore: ObjectStore,
    private ignoreManager: IgnoreManager
  ) {
    this.branchWatcher = new BranchWatcher();
    this.context.subscriptions.push(this.branchWatcher);
    
    this.context.subscriptions.push(
      this.branchWatcher.onBranchChanged(async (wsRoot) => {
        if (this.activeSession && this.activeSession.folderCheckpoints[wsRoot]) {
          vscode.window.showWarningMessage('Git branch switch detected. Finalizing JGuard session to prevent conflicts.');
          await this.acceptAll(); // Auto-accept to avoid reverting the branch checkout
        }
      })
    );
  }

  register() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand('jguard.toggleProtection', this.toggleProtection.bind(this)),
      vscode.commands.registerCommand('jguard.toggleChanges', this.toggleChanges.bind(this)),
      vscode.commands.registerCommand('jguard.openDiff', this.openDiff.bind(this)),
      vscode.commands.registerCommand('jguard.acceptAll', this.acceptAll.bind(this)),
      vscode.commands.registerCommand('jguard.rejectAll', this.rejectAll.bind(this)),
      vscode.commands.registerCommand('jguard.refresh', this.refresh.bind(this)),
      // L2: Per-file accept/reject
      vscode.commands.registerCommand('jguard.acceptFile', this.acceptFile.bind(this)),
      vscode.commands.registerCommand('jguard.rejectFile', this.rejectFile.bind(this)),
      vscode.commands.registerCommand('jguard.finalize', this.finalize.bind(this)),
      // L3: Per-file toggle
      vscode.commands.registerCommand('jguard.toggleFile', this.toggleFile.bind(this))
    );

    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const watcherQueue = new BatchedWatcherQueue(200, 50, async (uris) => {
      if (this.activeSession) {
        await this.deltaRefresh(uris);
      }
    });

    const onDidChange = (uri: vscode.Uri) => {
      if (this.ignoreManager.isIgnored(uri.fsPath)) return;
      watcherQueue.enqueue(uri);
    };
    
    this.context.subscriptions.push(
      watcher.onDidChange(onDidChange),
      watcher.onDidCreate(onDidChange),
      watcher.onDidDelete(onDidChange),
      watcher,
      { dispose: () => watcherQueue.dispose() }
    );
  }

  /**
   * Provides a way to restore session state (used for crash recovery).
   */
  restoreSessionState(session: CheckpointSession) {
    this.activeSession = session;
    if (session.uiState) {
      this.fileViewStates = new Map(Object.entries(session.uiState.fileViewStates || {}));
      this.aiSnapshotHashes = new Map(Object.entries(session.uiState.aiSnapshotHashes || {}));
    }
  }

  private async toggleProtection() {
    if (this.activeSession) {
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

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('JGuard requires an open workspace.');
      return;
    }

    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'AI Guard: Creating Checkpoint...',
      cancellable: false
    }, async (progress) => {
      try {
        // L1: Create a session spanning all workspace folders
        // L4: Progress reporter passed through for large workspaces
        const folderPaths = workspaceFolders.map(f => f.uri.fsPath);
        this.activeSession = await this.checkpointService.createSession(
          'ws-id',
          folderPaths,
          (processed, total) => {
            const pct = Math.round((processed / total) * 100);
            progress.report({
              message: `(${processed.toLocaleString()} / ${total.toLocaleString()} files)`,
              increment: pct,
            });
          }
        );
        
        this.statusBar.setState('protecting');
        this.sidebar.refresh(null, true);
        
        const folderCount = Object.keys(this.activeSession.folderCheckpoints).length;
        const msg = folderCount > 1
          ? `AI Guard: Checkpoint created across ${folderCount} workspace folders. You are now protected.`
          : 'AI Guard: Workspace checkpoint created. You are now protected.';
        vscode.window.showInformationMessage(msg);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to create checkpoint: ${err.message}`);
      }
    });
  }

  async refresh() {
    if (!this.activeSession) return;
    
    // Save previous decisions in memory before clearing
    const previousChangeSets = new Map(this.changeSets);
    this.changeSets.clear();
    let totalCount = 0;

    for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
      const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
      
      // Preserve existing decisions for files across refreshes
      const existingCs = previousChangeSets.get(wsRoot);
      const savedDecisions = this.activeSession.uiState?.decisions?.[wsRoot];
      
      for (const change of changeSet.changes) {
        if (existingCs && existingCs.decisions[change.relativePath] && existingCs.decisions[change.relativePath] !== 'pending') {
          changeSet.decisions[change.relativePath] = existingCs.decisions[change.relativePath];
        } else if (savedDecisions && savedDecisions[change.relativePath] && savedDecisions[change.relativePath] !== 'pending') {
          changeSet.decisions[change.relativePath] = savedDecisions[change.relativePath];
        }
      }

      // Retain files that were toggled or rejected (they match checkpoint on disk, so they were dropped by ChangeDetector)
      if (existingCs) {
        for (const change of existingCs.changes) {
          if (!changeSet.changes.find(c => c.relativePath === change.relativePath)) {
            const viewState = this.fileViewStates.get(change.relativePath);
            const decision = existingCs.decisions[change.relativePath];
            if (viewState === 'original' || decision === 'rejected') {
              changeSet.changes.push(change);
              if (existingCs.aiStateHashes[change.relativePath]) {
                changeSet.aiStateHashes[change.relativePath] = existingCs.aiStateHashes[change.relativePath];
              }
              changeSet.decisions[change.relativePath] = decision;
            }
          }
        }
      } else if (savedDecisions && this.activeSession.uiState?.aiSnapshotHashes) {
        for (const [relPath, decision] of Object.entries(savedDecisions)) {
          const viewState = this.fileViewStates.get(relPath);
          if (viewState === 'original' || decision === 'rejected') {
            if (!changeSet.changes.find(c => c.relativePath === relPath)) {
              const snapshot = checkpoint.files[relPath];
              const aiHash = this.activeSession.uiState.aiSnapshotHashes[relPath];
              const changeType = snapshot ? (aiHash ? 'modified' : 'deleted') : 'created';
              
              changeSet.changes.push({
                type: changeType,
                relativePath: relPath,
                checkpointHash: snapshot?.hash,
                currentHash: aiHash
              });
              if (aiHash) {
                changeSet.aiStateHashes[relPath] = aiHash;
              }
              changeSet.decisions[relPath] = decision;
            }
          }
        }
      }
      
      this.changeSets.set(wsRoot, changeSet);
      totalCount += changeSet.changes.length;
    }

    if (totalCount > 0) {
      this.statusBar.setState('changes', totalCount);
    } else {
      this.statusBar.setState('protecting');
    }
    
    // L1: Pass all changesets to sidebar for grouped display
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    
    // Save state after refresh detects new changes
    await this.saveUIState();
  }

  /**
   * L4: Incremental refresh based on specific changed URIs.
   */
  private async deltaRefresh(uris: vscode.Uri[]) {
    if (!this.activeSession) return;

    const changesByRoot = new Map<string, string[]>();

    for (const uri of uris) {
      if (uri.scheme !== 'file') continue;
      
      const wsRoot = this.findWorkspaceRootForFileAbsolute(uri.fsPath);
      if (wsRoot) {
        // Convert to relative path without OS separators leaking into keys if possible,
        // but Node's path.relative handles separators on the platform side.
        const relPath = path.relative(wsRoot, uri.fsPath).replace(/\\/g, '/');
        let list = changesByRoot.get(wsRoot);
        if (!list) {
          list = [];
          changesByRoot.set(wsRoot, list);
        }
        list.push(relPath);
      }
    }

    let totalCount = 0;

    for (const [wsRoot, dirtyPaths] of changesByRoot.entries()) {
      const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
      const existingCs = this.changeSets.get(wsRoot);

      if (checkpoint && existingCs) {
        const newChangeSet = await ChangeDetector.detectDelta(checkpoint, wsRoot, dirtyPaths, existingCs);
        
        // Retain toggled/rejected files that were dropped because they now match the checkpoint
        for (const change of existingCs.changes) {
          if (!newChangeSet.changes.find(c => c.relativePath === change.relativePath)) {
            const viewState = this.fileViewStates.get(change.relativePath);
            const decision = existingCs.decisions[change.relativePath];
            if (viewState === 'original' || decision === 'rejected') {
              newChangeSet.changes.push(change);
              if (existingCs.aiStateHashes[change.relativePath]) {
                newChangeSet.aiStateHashes[change.relativePath] = existingCs.aiStateHashes[change.relativePath];
              }
              newChangeSet.decisions[change.relativePath] = decision;
            }
          }
        }
        
        this.changeSets.set(wsRoot, newChangeSet);
      } else if (checkpoint && !existingCs) {
        // Fallback to full refresh if no existing changeset
        const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
        this.changeSets.set(wsRoot, changeSet);
      }
    }

    for (const cs of this.changeSets.values()) {
      totalCount += cs.changes.length;
    }

    if (totalCount > 0) {
      this.statusBar.setState('changes', totalCount);
    } else {
      this.statusBar.setState('protecting');
    }
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    
    // Save state after delta refresh detects new changes
    await this.saveUIState();
  }

  private async openDiff(change: FileChange) {
    if (!this.activeSession) return;

    // L1: Find the workspace root that owns this file
    const wsFolder = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsFolder) return;

    const currentUri = vscode.Uri.file(path.join(wsFolder, change.relativePath));
    
    let originalUri: vscode.Uri;
    
    if (change.type === 'created') {
      originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`);
    } else {
      const hash = change.type === 'modified' ? change.checkpointHash : (change as any).checkpointHash;
      originalUri = vscode.Uri.parse(`${DiffProvider.scheme}://${hash}/${change.relativePath}`);
    }

    // L6: Check if file is binary
    const checkpoint = this.activeSession.folderCheckpoints[wsFolder];
    const snapshot = checkpoint?.files[change.relativePath];
    
    if (snapshot?.isBinary) {
      if (this.isImageFile(change.relativePath)) {
        await this.openBinaryComparison(change, wsFolder);
      } else {
        vscode.window.showInformationMessage(
          `Binary file changed: ${change.relativePath}\n` +
          `Original: ${snapshot.size} bytes (${snapshot.hash.slice(0, 8)}…)\n` +
          `Current state differs`
        );
      }
      return;
    }

    const title = `${change.relativePath} (Checkpoint ↔ Current)`;
    
    if (change.type === 'deleted') {
      await vscode.commands.executeCommand('vscode.diff', originalUri, vscode.Uri.parse(`${DiffProvider.scheme}://empty/${change.relativePath}`), title);
    } else {
      await vscode.commands.executeCommand('vscode.diff', originalUri, currentUri, title);
    }
  }

  private async toggleChanges() {
    if (!this.activeSession) {
      vscode.window.showInformationMessage('AI Guard is not active.');
      return;
    }

    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: this.viewState === 'ai' ? 'AI Guard: Hiding Changes...' : 'AI Guard: Applying Changes...',
      cancellable: false
    }, async () => {
      try {
        if (this.viewState === 'ai') {
          // Snapshot the current (AI) state so we can come back to it
          this.forwardSession = await this.createForwardSession();
          
          // Put the lockfile back to the original session
          const lockFile = path.join((this.checkpointService as any).metadataStore.storageBaseDir, 'jguard.lock');
          await fs.writeFile(lockFile, this.activeSession!.id, 'utf-8');

          // L1: Restore each folder to its original state
          for (const [wsRoot, checkpoint] of Object.entries(this.activeSession!.folderCheckpoints)) {
            const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
            const plan = RestorePlanner.buildPlan(checkpoint, changeSet, [], wsRoot);
            await this.restoreService.execute(plan);
          }
          
          this.viewState = 'original';
          // Set all file view states to original
          this.fileViewStates.clear();
          for (const cs of this.changeSets.values()) {
            for (const change of cs.changes) {
              this.fileViewStates.set(change.relativePath, 'original');
            }
          }
          
          this.statusBar.setState('changes', this.getTotalChangeCount());
          this.sidebar.refresh(this.changeSets, true, true, this.fileViewStates);
          vscode.window.showInformationMessage('AI Guard: Changes hidden (showing Original).');

        } else {
          // Restore to AI state
          if (!this.forwardSession) return;

          for (const [wsRoot, checkpoint] of Object.entries(this.forwardSession.folderCheckpoints)) {
            const forwardChangeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
            const plan = RestorePlanner.buildPlan(checkpoint, forwardChangeSet, [], wsRoot);
            await this.restoreService.execute(plan);
          }

          this.viewState = 'ai';
          this.fileViewStates.clear();
          await this.refresh();
          vscode.window.showInformationMessage('AI Guard: Changes applied (showing AI).');
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Toggle failed: ${err.message}`);
      }
    });
  }

  // ─── L2: Per-File Accept ─────────────────────────────────────────────

  private async acceptFile(arg: any) {
    if (!this.activeSession) return;
    const change: FileChange = arg.change ? arg.change : arg;

    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot) return;

    const cs = this.changeSets.get(wsRoot);
    if (!cs) return;

    cs.decisions[change.relativePath] = 'accepted';
    this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
    vscode.window.showInformationMessage(`✓ Accepted: ${change.relativePath}`);
    
    await this.saveUIState();
  }

  // ─── L2: Per-File Reject (Immediate + Auto-Snapshot) ─────────────────

  private async rejectFile(arg: any) {
    if (!this.activeSession) return;
    const change: FileChange = arg.change ? arg.change : arg;

    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot) return;

    const cs = this.changeSets.get(wsRoot);
    const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
    if (!cs || !checkpoint) return;

    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    try {
      // 1. Auto-snapshot: save the current AI version to ObjectStore BEFORE restoring
      const absPath = path.join(wsRoot, change.relativePath);
      if (change.type !== 'deleted') {
        const aiContent: Uint8Array = await fs.readFile(absPath);
        const aiHash = await this.objectStore.write(aiContent, absPath);
        this.aiSnapshotHashes.set(change.relativePath, aiHash);
      }

      // 2. Restore the checkpoint (original) version to disk immediately
      if (change.type === 'modified' || change.type === 'deleted') {
        const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, change.checkpointHash, wsRoot);
        await this.restoreService.execute(plan);
      } else if (change.type === 'created') {
        // Delete the created file
        const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
        await this.restoreService.execute(plan);
      }

      // 3. Mark decision
      cs.decisions[change.relativePath] = 'rejected';
      this.fileViewStates.set(change.relativePath, 'original');

      this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
      vscode.window.showInformationMessage(`✗ Rejected: ${change.relativePath} (AI version saved — toggle back anytime)`);
      
      await this.saveUIState();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to reject ${change.relativePath}: ${err.message}`);
    }
  }

  // ─── L3: Per-File Toggle ─────────────────────────────────────────────

  private async toggleFile(arg: any) {
    if (!this.activeSession) return;
    const change: FileChange = arg.change ? arg.change : arg;

    const wsRoot = this.findWorkspaceRootForFile(change.relativePath);
    if (!wsRoot) return;

    const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
    if (!checkpoint) return;

    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    const currentState = this.fileViewStates.get(change.relativePath) || 'ai';

    try {
      if (currentState === 'ai') {
        // Save AI version before restoring original
        const absPath = path.join(wsRoot, change.relativePath);
        if (change.type !== 'deleted') {
          const aiContent: Uint8Array = await fs.readFile(absPath);
          const aiHash = await this.objectStore.write(aiContent, absPath);
          this.aiSnapshotHashes.set(change.relativePath, aiHash);
        }

        // Restore to checkpoint version
        if (change.type === 'modified' || change.type === 'deleted') {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, change.checkpointHash, wsRoot);
          await this.restoreService.execute(plan);
        } else if (change.type === 'created') {
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
          await this.restoreService.execute(plan);
        }

        this.fileViewStates.set(change.relativePath, 'original');
      } else {
        // Restore to AI version from snapshot
        const aiHash = this.aiSnapshotHashes.get(change.relativePath);
        if (!aiHash && change.type !== 'deleted') {
          vscode.window.showWarningMessage(`No AI snapshot found for ${change.relativePath}.`);
          return;
        }

        if (change.type === 'created' || change.type === 'modified') {
          // Write the AI version back
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, aiHash!, wsRoot);
          await this.restoreService.execute(plan);
        } else if (change.type === 'deleted') {
          // The AI deleted this file — delete it again
          const plan = SelectiveRestorePlanner.buildSingleFilePlan(change, null, wsRoot);
          await this.restoreService.execute(plan);
        }

        this.fileViewStates.set(change.relativePath, 'ai');
      }

      this.sidebar.refresh(this.changeSets, true, false, this.fileViewStates);
      await this.saveUIState();
    } catch (err: any) {
      vscode.window.showErrorMessage(`Toggle failed for ${change.relativePath}: ${err.message}`);
    }
  }

  // ─── L2: Finalize Session ────────────────────────────────────────────

  private async finalize() {
    if (!this.activeSession) return;

    const pendingCount = this.countPendingDecisions();

    if (pendingCount > 0) {
      const action = await vscode.window.showInformationMessage(
        `${pendingCount} file(s) have no decision yet. What should happen to them?`,
        'Accept Remaining',
        'Reject Remaining',
        'Cancel'
      );
      if (action === 'Accept Remaining') {
        this.markAllPending('accepted');
      } else if (action === 'Reject Remaining') {
        this.markAllPending('rejected');
        // Execute restore for all newly rejected files
        await this.executeSelectiveRestore();
      } else {
        return;
      }
    }

    // Save final decisions to session
    await this.saveUIState();

    const session = this.activeSession;
    session.status = 'accepted';
    session.finalizedAt = Date.now();
    for (const cp of Object.values(session.folderCheckpoints)) {
      cp.status = 'accepted';
      cp.finalizedAt = session.finalizedAt;
      await this.checkpointService.updateCheckpoint(cp);
    }
    await this.checkpointService.updateSession(session);

    await this.cleanupSession();
    vscode.window.showInformationMessage('AI Guard: Session finalized.');
  }

  // ─── Accept / Reject All ─────────────────────────────────────────────

  private async acceptAll() {
    if (!this.activeSession) return;
    
    if (this.viewState === 'original') {
      const choice = await vscode.window.showWarningMessage(
        'You are currently viewing the Original state. Finalizing now will permanently discard the hidden AI changes. Continue?',
        'Discard AI Changes',
        'Cancel'
      );
      if (choice !== 'Discard AI Changes') return;
    }

    // Mark all as accepted
    this.markAllPending('accepted');
    await this.saveUIState();

    // L7: Soft-delete with grace period
    const session = this.activeSession;
    this.lastFinalizedSessionId = session.id;
    this.lastFinalizedAt = Date.now();

    // Update session status
    session.status = 'accepted';
    session.finalizedAt = this.lastFinalizedAt;
    for (const cp of Object.values(session.folderCheckpoints)) {
      cp.status = 'accepted';
      cp.finalizedAt = this.lastFinalizedAt;
      await this.checkpointService.updateCheckpoint(cp);
    }
    await this.checkpointService.updateSession(session);

    await this.cleanupSession();

    // L7: Show undo notification
    const gracePeriodMin = vscode.workspace.getConfiguration('jguard').get<number>('undoGracePeriodMinutes', 5);
    vscode.window.showInformationMessage(
      `AI Guard: Changes accepted. You can undo within ${gracePeriodMin} minutes.`,
      'Undo Accept'
    ).then(async (choice) => {
      if (choice === 'Undo Accept' && this.lastFinalizedSessionId) {
        const elapsed = Date.now() - this.lastFinalizedAt;
        if (elapsed < gracePeriodMin * 60 * 1000) {
          await this.undoAccept();
        } else {
          vscode.window.showWarningMessage('Grace period expired. Cannot undo.');
        }
      }
    });
  }

  private async rejectAll() {
    if (!this.activeSession) return;
    
    if (this.viewState === 'original') {
      await this.cleanupSession();
      vscode.window.showInformationMessage('AI Guard: Protection discarded. Original state kept.');
      return;
    }
    
    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    // L1: Reject across all folders
    for (const [wsRoot, checkpoint] of Object.entries(this.activeSession.folderCheckpoints)) {
      const changeSet = await ChangeDetector.detectChanges(checkpoint, this.scanner, wsRoot);
      const conflicts = await ConflictDetector.detect(changeSet, this.scanner, wsRoot);
      
      if (conflicts.length > 0) {
        this.statusBar.setState('conflict');
        const msg = `AI Guard: ${conflicts.length} conflict(s) detected in ${path.basename(wsRoot)}. Conflicted files will be skipped.`;
        const choice = await vscode.window.showWarningMessage(msg, 'Proceed Anyway', 'Cancel');
        if (choice !== 'Proceed Anyway') return;
        
        await this.executeRestore(checkpoint, changeSet, conflicts, wsRoot);
      } else {
        await this.executeRestore(checkpoint, changeSet, [], wsRoot);
      }
    }

    this.markAllPending('rejected');
    await this.saveUIState();

    this.activeSession.status = 'rejected';
    this.activeSession.finalizedAt = Date.now();
    await this.checkpointService.updateSession(this.activeSession);

    await this.cleanupSession();
    vscode.window.showInformationMessage('AI Guard: Checkpoint discarded and safely reverted.');
  }

  // ─── L7: Undo Accept ────────────────────────────────────────────────

  private async undoAccept() {
    if (!this.lastFinalizedSessionId) return;

    try {
      const session = await (this.checkpointService as any).metadataStore.readSession(this.lastFinalizedSessionId);
      
      // Reactivate
      session.status = 'active';
      for (const cp of Object.values(session.folderCheckpoints) as Checkpoint[]) {
        cp.status = 'active';
        cp.finalizedAt = undefined;
      }

      this.activeSession = session;
      this.lastFinalizedSessionId = null;
      this.lastFinalizedAt = 0;

      // Recreate lockfile
      const lockFile = path.join((this.checkpointService as any).metadataStore.storageBaseDir, 'jguard.lock');
      await fs.writeFile(lockFile, session.id, 'utf-8');

      this.statusBar.setState('protecting');
      await this.refresh();
      vscode.window.showInformationMessage('AI Guard: Accept undone. Protection resumed.');
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to undo accept: ${err.message}`);
    }
  }

  // ─── Internal Helpers ────────────────────────────────────────────────

  private async saveUIState() {
    if (!this.activeSession) return;
    
    const decisions: Record<string, Record<string, FileDecision>> = {};
    for (const [wsRoot, cs] of this.changeSets.entries()) {
      decisions[wsRoot] = { ...cs.decisions };
    }

    this.activeSession.uiState = {
      decisions,
      fileViewStates: Object.fromEntries(this.fileViewStates),
      aiSnapshotHashes: Object.fromEntries(this.aiSnapshotHashes)
    };

    await this.checkpointService.updateSession(this.activeSession);
  }

  private async executeRestore(cp: Checkpoint, cs: ChangeSet, conflicts: any[], wsFolder: string) {
    this.statusBar.setState('restoring');
    const plan = RestorePlanner.buildPlan(cp, cs, conflicts, wsFolder);
    await this.restoreService.execute(plan);
  }

  private async executeSelectiveRestore() {
    if (!this.activeSession) return;

    for (const [wsRoot, cs] of this.changeSets.entries()) {
      const checkpoint = this.activeSession.folderCheckpoints[wsRoot];
      if (!checkpoint) continue;

      const plan = SelectiveRestorePlanner.buildPlan(checkpoint, cs, [], wsRoot);
      if (plan.operations.length > 0) {
        this.statusBar.setState('restoring');
        await this.restoreService.execute(plan);
      }
    }
  }

  private async cleanupSession() {
    this.activeSession = null;
    this.forwardSession = null;
    this.changeSets.clear();
    this.fileViewStates.clear();
    this.aiSnapshotHashes.clear();
    this.viewState = 'ai';
    this.statusBar.setState('off');
    this.sidebar.refresh(null, false);
    await this.clearLockFile();
    
    // Notify history provider to refresh
    this._onDidFinalizeSession.fire();
  }

  private async clearLockFile() {
    const lockFile = path.join((this.checkpointService as any).metadataStore.storageBaseDir, 'jguard.lock');
    await fs.unlink(lockFile).catch(() => {});
  }

  private async createForwardSession(): Promise<CheckpointSession> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) throw new Error('No workspace folders');

    const folderCheckpoints: Record<string, Checkpoint> = {};
    for (const folder of folders) {
      const wsRoot = folder.uri.fsPath;
      const cp = await this.checkpointService.createCheckpoint(wsRoot);
      folderCheckpoints[wsRoot] = cp;
    }

    return {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      createdAt: Date.now(),
      folderCheckpoints,
      status: 'active',
    };
  }

  /**
   * L1: Finds which workspace root owns a given relative path.
   */
  private findWorkspaceRootForFile(relativePath: string): string | null {
    // Check each changeset for this file
    for (const [wsRoot, cs] of this.changeSets.entries()) {
      if (cs.changes.some(c => c.relativePath === relativePath)) {
        return wsRoot;
      }
    }
    // Fallback to first folder
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }

  private findWorkspaceRootForFileAbsolute(absolutePath: string): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return null;

    let bestMatch: string | null = null;
    for (const folder of folders) {
      const root = folder.uri.fsPath;
      if (absolutePath.startsWith(root) && (!bestMatch || root.length > bestMatch.length)) {
        bestMatch = root;
      }
    }
    return bestMatch;
  }

  private getTotalChangeCount(): number {
    let total = 0;
    for (const cs of this.changeSets.values()) {
      total += cs.changes.length;
    }
    return total;
  }

  private countPendingDecisions(): number {
    let count = 0;
    for (const cs of this.changeSets.values()) {
      for (const decision of Object.values(cs.decisions)) {
        if (decision === 'pending') count++;
      }
    }
    return count;
  }

  private markAllPending(decision: FileDecision) {
    for (const cs of this.changeSets.values()) {
      for (const relPath of Object.keys(cs.decisions)) {
        if (cs.decisions[relPath] === 'pending') {
          cs.decisions[relPath] = decision;
        }
      }
    }
  }

  // L6: Image file detection
  private isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'].includes(ext);
  }

  // L6: Open binary image comparison
  private async openBinaryComparison(change: FileChange, wsRoot: string) {
    try {
      const checkpoint = this.activeSession?.folderCheckpoints[wsRoot];
      if (!checkpoint) return;

      const snapshot = checkpoint.files[change.relativePath];
      if (!snapshot) return;

      // Write checkpoint version to a temp file
      const content = await this.objectStore.read(snapshot.hash);
      const tmpDir = path.join((this.checkpointService as any).metadataStore.storageBaseDir, 'tmp');
      await fs.mkdir(tmpDir, { recursive: true });
      const tmpFile = path.join(tmpDir, `checkpoint-${path.basename(change.relativePath)}`);
      await fs.writeFile(tmpFile, content);

      // Open both side by side
      const originalUri = vscode.Uri.file(tmpFile);
      const currentUri = vscode.Uri.file(path.join(wsRoot, change.relativePath));

      await vscode.commands.executeCommand('vscode.open', originalUri, { viewColumn: vscode.ViewColumn.One });
      await vscode.commands.executeCommand('vscode.open', currentUri, { viewColumn: vscode.ViewColumn.Two });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to compare binary file: ${err.message}`);
    }
  }
}
