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
import * as path from 'path';
import * as fs from 'fs/promises';

let statusBar: StatusBar;
let commands: Commands;

export async function activate(context: vscode.ExtensionContext) {
  console.log('JGuard is now active.');

  // Storage setup
  const storageBaseDir = context.globalStorageUri.fsPath;
  const metadataStore = new MetadataStore(storageBaseDir);
  const objectStore = new ObjectStore(storageBaseDir);

  await metadataStore.initialize();
  await objectStore.initialize();

  let wsRoot = '';
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    wsRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  
  // L1: CheckpointService handles multi-root, but still takes a fallback wsRoot
  const scanner = new WorkspaceScanner();
  const checkpointService = new CheckpointService(metadataStore, objectStore, scanner, wsRoot);
  const restoreService = new RestoreService(objectStore);

  // UI Setup
  statusBar = new StatusBar();
  const sidebar = new SidebarProvider();
  const diffProvider = new DiffProvider(objectStore);

  // Register providers
  vscode.window.registerTreeDataProvider('jguardSidebar', sidebar);
  vscode.workspace.registerTextDocumentContentProvider(DiffProvider.scheme, diffProvider);

  // Register commands — L2/L6: now receives objectStore for per-file snapshots and binary diffs
  commands = new Commands(context, checkpointService, restoreService, scanner, sidebar, statusBar, objectStore);
  commands.register();

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
