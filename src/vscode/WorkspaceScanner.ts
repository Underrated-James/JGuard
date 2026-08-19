import * as vscode from 'vscode';
import { IFileScanner, FileMeta } from '../core/types';
import * as fs from 'fs/promises';

export class WorkspaceScanner implements IFileScanner {
  constructor(private excludePatterns: string[] = ['**/node_modules/**', '**/.git/**', '**/dist/**']) {}

  async scan(): Promise<Map<string, FileMeta>> {
    const map = new Map<string, FileMeta>();
    
    // Find all files in the workspace, respecting exclusions
    const excludeGlob = `{${this.excludePatterns.join(',')}}`;
    const uris = await vscode.workspace.findFiles('**/*', excludeGlob);

    if (uris.length > 50000) {
      throw new Error(`Workspace is too large for JGuard MVP (${uris.length} files). Please add more specific exclusions to .vscodeignore or .gitignore.`);
    }

    for (const uri of uris) {
      if (uri.scheme === 'file') {
        const stat = await fs.stat(uri.fsPath);
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        
        map.set(relativePath, {
          relativePath,
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      }
    }

    return map;
  }
}
