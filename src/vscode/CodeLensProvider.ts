import * as vscode from 'vscode';
import { Commands } from './Commands';
import { ObjectStore } from '../storage/ObjectStore';
import { HunkDiffer, Hunk } from '../core/HunkDiffer';

/**
 * Provides CodeLens for partial (hunk-level) accept/reject of AI changes.
 */
export class JGuardCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    private commands: Commands,
    private objectStore: ObjectStore
  ) {}

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const activeSession = (this.commands as any).activeSession;
    if (!activeSession) return [];

    // Find if this document is in the current changeset
    const wsRoot = (this.commands as any).findWorkspaceRootForFileAbsolute(document.uri.fsPath);
    if (!wsRoot) return [];

    const cs = (this.commands as any).changeSets.get(wsRoot);
    if (!cs) return [];

    const relPath = vscode.workspace.asRelativePath(document.uri, false);
    const change = cs.changes.find((c: any) => c.relativePath === relPath);
    if (!change || change.type !== 'modified') return [];

    // We need the original content and the AI content
    try {
      const originalBuffer = await this.objectStore.read(change.checkpointHash);
      const originalText = Buffer.from(originalBuffer).toString('utf-8');
      const currentText = document.getText();

      const hunks = HunkDiffer.getHunks(originalText, currentText, document.uri.fsPath);
      
      const lenses: vscode.CodeLens[] = [];
      for (const hunk of hunks) {
        // Map hunk newStart to document line (0-indexed)
        const line = Math.max(0, hunk.newStart - 1);
        const range = new vscode.Range(line, 0, line, 0);

        lenses.push(new vscode.CodeLens(range, {
          title: "$(check) Accept Hunk",
          command: "jguard.acceptHunk",
          arguments: [document.uri, hunk]
        }));
        
        lenses.push(new vscode.CodeLens(range, {
          title: "$(close) Reject Hunk",
          command: "jguard.rejectHunk",
          arguments: [document.uri, hunk]
        }));
      }

      return lenses;
    } catch (e) {
      return [];
    }
  }
}
