import { RestorePlan } from '../core/types';
import { ObjectStore } from '../storage/ObjectStore';
import { Hasher } from '../core/Hasher';
import * as fs from 'fs/promises';
import * as path from 'path';

export class RestoreService {
  constructor(private objectStore: ObjectStore) {}

  /**
   * Executes a restore plan safely.
   * @param plan The restore plan to execute.
   * @throws If a safety check fails during execution.
   */
  async execute(plan: RestorePlan): Promise<void> {
    for (const op of plan.operations) {
      if (op.type === 'write') {
        if (!op.objectHash) throw new Error('Write operation missing objectHash');
        
        const content = await this.objectStore.read(op.objectHash);

        // Verify the hash before writing it to the real location
        const verifiedHash = Hasher.hashBuffer(content);
        if (verifiedHash !== op.objectHash) {
          throw new Error(`Hash mismatch during restore of ${op.relativePath}`);
        }

        // Use vscode.workspace.fs.writeFile for smooth editor updates and to avoid breaking file watchers
        // instead of atomic rename.
        try {
          const vscode = require('vscode');
          await vscode.workspace.fs.writeFile(vscode.Uri.file(op.absolutePath), content);
        } catch (e) {
          // Fallback for unit tests outside VSCode environment
          await fs.writeFile(op.absolutePath, content);
        }
      } else if (op.type === 'delete') {
        try {
          try {
            const vscode = require('vscode');
            await vscode.workspace.fs.delete(vscode.Uri.file(op.absolutePath), { useTrash: false });
          } catch (e) {
             // Fallback for unit tests outside VSCode environment
             await fs.unlink(op.absolutePath);
          }
        } catch (err: any) {
          if (err.code !== 'ENOENT' && err.name !== 'EntryNotFound (FileSystemError)') {
            throw err;
          }
        }
      }
    }
  }
}
