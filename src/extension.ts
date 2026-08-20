import * as vscode from 'vscode';
import { MetadataStore } from './storage/MetadataStore';
import { ObjectStore } from './storage/ObjectStore';
import { CheckpointService } from './application/CheckpointService';
import { RestoreService } from './application/RestoreService';
import { WorkspaceScanner } from './vscode/WorkspaceScanner';
import { StatusBar } from './vscode/StatusBar';
import { SidebarProvider } from './vscode/Sidebar';
import { DiffProvider } from './vscode/DiffProvider';
import { Commands } from './vscode/Commands';
import { HistoryTreeProvider, HistorySessionTreeItem } from './vscode/HistoryTreeProvider';
import { CheckpointDetailWebview } from './vscode/CheckpointDetailWebview';
import { JGuardCodeLensProvider } from './vscode/CodeLensProvider';
import { StashStore } from './storage/StashStore';
import { StashService } from './application/StashService';
import { StashTreeProvider, StashedChangeTreeItem } from './vscode/StashTreeProvider';
import { AttributionEngine } from './core/AttributionEngine';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IgnoreManager } from './core/IgnoreManager';

let statusBar: StatusBar;
let commands: Commands;

export async function activate(context: vscode.ExtensionContext) {
  console.log('JGuard is now active.');

  // Storage setup
  const storageBaseDir = context.globalStorageUri.fsPath;
  const metadataStore = new MetadataStore(storageBaseDir);
  const objectStore = new ObjectStore(storageBaseDir);
  const stashStore = new StashStore(storageBaseDir);

  await metadataStore.initialize();
  await objectStore.initialize();
  await stashStore.initialize();

  let wsRoot = '';
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    wsRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  
  const ignoreManager = new IgnoreManager(wsRoot);
  await ignoreManager.initialize();

  // L1: CheckpointService handles multi-root, but still takes a fallback wsRoot
  const scanner = new WorkspaceScanner(ignoreManager);
  const checkpointService = new CheckpointService(metadataStore, objectStore, scanner, wsRoot);
  const restoreService = new RestoreService(objectStore);
  const stashService = new StashService(stashStore, objectStore, restoreService);

  // Read GC config
  const gcEnabled = vscode.workspace.getConfiguration('jguard').get<boolean>('enableGarbageCollection', true);
  checkpointService.setGCEnabled(gcEnabled);

  // Listen for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('jguard.enableGarbageCollection')) {
        const enabled = vscode.workspace.getConfiguration('jguard').get<boolean>('enableGarbageCollection', true);
        checkpointService.setGCEnabled(enabled);
      }
    })
  );

  // UI Setup
  statusBar = new StatusBar();
  const sidebarProvider = new SidebarProvider();
  const historyProvider = new HistoryTreeProvider(metadataStore);
  const stashProvider = new StashTreeProvider(stashService);
  const diffProvider = new DiffProvider(objectStore);
  const attributionEngine = new AttributionEngine();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('jguardSidebar', sidebarProvider),
    vscode.window.registerTreeDataProvider('jguardHistory', historyProvider),
    vscode.window.registerTreeDataProvider('jguardStash', stashProvider),
    vscode.workspace.onDidChangeTextDocument(e => attributionEngine.trackEditorChange(e))
  );
  vscode.workspace.registerTextDocumentContentProvider(DiffProvider.scheme, diffProvider);

  // Register commands
  commands = new Commands(context, checkpointService, restoreService, scanner, sidebarProvider, statusBar, objectStore, ignoreManager, attributionEngine);
  commands.register();

  // Register CodeLensProvider
  const codeLensProvider = new JGuardCodeLensProvider(commands, objectStore);
  vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider);

  // Register History Command
  context.subscriptions.push(
    vscode.commands.registerCommand('jguard.showHistoryDetails', (item: HistorySessionTreeItem) => {
      if (item && item.session) {
        CheckpointDetailWebview.show(context, item.session);
      }
    }),
    vscode.commands.registerCommand('jguard.clearHistory', async () => {
      const choice = await vscode.window.showWarningMessage(
        'Are you sure you want to bulk clear old sessions? (This will keep your 3 most recent sessions)',
        'Clear Old History', 'Cancel'
      );
      if (choice === 'Clear Old History') {
        try {
          await checkpointService.clearOldHistory(3);
          historyProvider.refresh();
          vscode.window.showInformationMessage('JGuard: Old session history cleared successfully.');
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to clear history: ${e.message}`);
        }
      }
    }),
    vscode.commands.registerCommand('jguard.deleteHistorySession', async (item: HistorySessionTreeItem) => {
      if (item && item.session) {
        if (commands.getActiveSessionId() === item.session.id) {
          vscode.window.showErrorMessage('You cannot delete the active session that you are currently protecting in your editor.');
          return;
        }

        const choice = await vscode.window.showWarningMessage(
          'Are you sure you want to delete this specific session? This will permanently delete its checkpoint data.',
          'Delete Session', 'Cancel'
        );
        if (choice === 'Delete Session') {
          try {
            await checkpointService.deleteHistorySession(item.session.id);
            historyProvider.refresh();
            vscode.window.showInformationMessage('JGuard: Session deleted successfully.');
          } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to delete session: ${e.message}`);
          }
        }
      }
    }),
    vscode.commands.registerCommand('jguard.refreshHistory', () => {
      historyProvider.refresh();
    }),
    vscode.commands.registerCommand('jguard.stashFile', async (item: any) => {
      // The item is a GuardTreeItem representing a file change
      if (item && item.change) {
        const change = item.change;
        // Fetch current and original hashes
        const activeId = commands.getActiveSessionId();
        if (!activeId) return;

        // Pass to stashService
        try {
          await stashService.stashChange(
            item.wsRoot || vscode.workspace.workspaceFolders![0].uri.fsPath, 
            change.relativePath, 
            change.type === 'created' ? null : change.checkpointHash, 
            change.type === 'deleted' ? null : change.currentHash
          );
          
          // Note: The active session tracks the file as pending, but now it matches original. 
          // We can optionally refresh the active session change detector so the file disappears from the AI changes list
          vscode.commands.executeCommand('jguard.refresh');
          stashProvider.refresh();
          vscode.window.showInformationMessage(`JGuard: Stashed ${change.relativePath}`);
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to stash: ${e.message}`);
        }
      }
    }),
    vscode.commands.registerCommand('jguard.popStash', async (item: StashedChangeTreeItem) => {
      if (item && item.stash) {
        try {
          await stashService.popStash(item.stash.id);
          vscode.commands.executeCommand('jguard.refresh');
          stashProvider.refresh();
          vscode.window.showInformationMessage(`JGuard: Popped stash for ${item.stash.relativePath}`);
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to pop stash: ${e.message}`);
        }
      }
    }),
    vscode.commands.registerCommand('jguard.applyStash', async (item: StashedChangeTreeItem) => {
      if (item && item.stash) {
        try {
          await stashService.applyStash(item.stash.id);
          vscode.commands.executeCommand('jguard.refresh');
          vscode.window.showInformationMessage(`JGuard: Applied stash for ${item.stash.relativePath}`);
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to apply stash: ${e.message}`);
        }
      }
    }),
    vscode.commands.registerCommand('jguard.dropStash', async (item: StashedChangeTreeItem) => {
      if (item && item.stash) {
        try {
          await stashService.dropStash(item.stash.id);
          stashProvider.refresh();
          vscode.window.showInformationMessage(`JGuard: Dropped stash for ${item.stash.relativePath}`);
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to drop stash: ${e.message}`);
        }
      }
    })
  );


  // Refresh history when a session is finalized
  context.subscriptions.push(
    commands.onDidFinalizeSession(() => {
      historyProvider.refresh();
    })
  );

  // Crash Recovery — L1: lockfile now stores session IDs
  const lockFile = path.join(storageBaseDir, 'jguard.lock');
  try {
    const activeId = await fs.readFile(lockFile, 'utf-8');
    if (activeId) {
      vscode.window.showWarningMessage(
        'AI Guard: Found an active checkpoint from a previous session. Do you want to resume protecting?',
        'Resume', 'Discard'
      ).then(async (choice) => {
        if (choice === 'Resume') {
          try {
            // Try to read as a session first (V2), fallback to checkpoint (V1 compat)
            let session;
            try {
              session = await metadataStore.readSession(activeId.trim());
            } catch {
              // V1 fallback: read as a checkpoint and wrap in a session
              const cp = await metadataStore.read(activeId.trim());
              const wsRoot = cp.workspaceRoot || (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
              session = {
                id: activeId.trim(),
                createdAt: cp.createdAt,
                folderCheckpoints: { [wsRoot]: cp },
                status: 'active' as const,
              };
            }

            commands.restoreSessionState(session);
            statusBar.setState('protecting');
            await (commands as any).refresh();
          } catch (e) {
            vscode.window.showErrorMessage('Failed to resume checkpoint. It may be corrupted.');
            await fs.unlink(lockFile).catch(() => {});
          }
        } else if (choice === 'Discard') {
          await fs.unlink(lockFile).catch(() => {});
        }
      });
    }
  } catch (e) {
    // No lockfile, normal startup
  }
}

export function deactivate() {
  if (statusBar) statusBar.dispose();
}
