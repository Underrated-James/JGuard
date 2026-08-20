import * as vscode from 'vscode';
import { IFileScanner, FileMeta } from '../core/types';
import * as fs from 'fs/promises';

export class WorkspaceScanner implements IFileScanner {
  constructor(private excludePatterns: string[] = ['**/node_modules/**', '**/.git/**', '**/dist/**']) {}

  /**
   * Scans workspace files. 
   * L1: When folderUri is provided, scans only that folder and returns folder-relative paths.
   *     When omitted, scans all workspace folders — if multiple roots exist, prefixes paths
   *     with the folder name to avoid collisions.
   * L4: No hard file cap. Shows a non-blocking warning if > 100K files are found.
   *
   * @param folderUri Optional URI to scope scanning to a single workspace folder.
   */
  async scan(folderUri?: vscode.Uri): Promise<Map<string, FileMeta>> {
    const map = new Map<string, FileMeta>();
    const excludeGlob = `{${this.excludePatterns.join(',')}}`;

    if (folderUri) {
      // Scoped scan: scan a single workspace folder
      const pattern = new vscode.RelativePattern(folderUri, '**/*');
      const uris = await vscode.workspace.findFiles(pattern, excludeGlob);

      // L4: Soft warning instead of hard cap
      this.warnIfLarge(uris.length);

      for (const uri of uris) {
        if (uri.scheme === 'file') {
          const stat = await fs.stat(uri.fsPath);
          // relativePath is relative to the given folderUri
          const relativePath = vscode.workspace.asRelativePath(uri, false);
          
          map.set(relativePath, {
            relativePath,
            size: stat.size,
            mtime: stat.mtimeMs,
          });
        }
      }
    } else {
      // Full scan: scan all workspace folders
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        return map;
      }

      const isMultiRoot = folders.length > 1;

      for (const folder of folders) {
        const pattern = new vscode.RelativePattern(folder.uri, '**/*');
        const uris = await vscode.workspace.findFiles(pattern, excludeGlob);

        for (const uri of uris) {
          if (uri.scheme === 'file') {
            const stat = await fs.stat(uri.fsPath);
            // In multi-root workspaces, prefix with folder name to avoid path collisions
            const folderRelPath = vscode.workspace.asRelativePath(uri, isMultiRoot);
            
            map.set(folderRelPath, {
              relativePath: folderRelPath,
              size: stat.size,
              mtime: stat.mtimeMs,
            });
          }
        }
      }

      // L4: Soft warning on total file count
      this.warnIfLarge(map.size);
    }

    return map;
  }

  /**
   * L4: Non-blocking warning when file count is very high.
   */
  private warnIfLarge(count: number): void {
    if (count > 100000) {
      vscode.window.showInformationMessage(
        `JGuard: Scanning ${count.toLocaleString()} files. This may take a while. ` +
        `Consider adding exclusions to .gitignore or workspace settings.`
      );
    }
  }
}
