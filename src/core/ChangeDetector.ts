import { Checkpoint, ChangeSet, FileChange, FileMeta, IFileScanner } from './types';
import { Hasher } from './Hasher';
import * as path from 'path';

export class ChangeDetector {
  /**
   * Compares the current workspace state against a checkpoint.
   * @param checkpoint The active checkpoint.
   * @param scanner The scanner used to get the current file states.
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static async detectChanges(
    checkpoint: Checkpoint,
    scanner: IFileScanner,
    workspaceRoot: string
  ): Promise<ChangeSet> {
    const currentPaths = await scanner.scan();
    const changes: FileChange[] = [];
    const aiStateHashes: Record<string, string> = {};

    // 1. Check for modified and deleted files
    for (const [relPath, snapshot] of Object.entries(checkpoint.files)) {
      if (!currentPaths.has(relPath)) {
        // File was deleted
        changes.push({
          type: 'deleted',
          relativePath: relPath,
          checkpointHash: snapshot.hash,
        });
      } else {
        const current = currentPaths.get(relPath)!;
        
        // Fast path: if mtime and size are identical, assume unchanged
        if (current.mtime === snapshot.mtime && current.size === snapshot.size) {
          continue;
        }

        // Needs hash comparison
        const absPath = path.join(workspaceRoot, relPath);
        const currentHash = await Hasher.hashFile(absPath);
        
        if (currentHash !== snapshot.hash) {
          changes.push({
            type: 'modified',
            relativePath: relPath,
            checkpointHash: snapshot.hash,
            currentHash,
          });
          aiStateHashes[relPath] = currentHash;
        }
      }
    }

    // 2. Check for created files
    for (const [relPath, current] of currentPaths.entries()) {
      if (!checkpoint.files[relPath]) {
        // File was created
        const absPath = path.join(workspaceRoot, relPath);
        const currentHash = await Hasher.hashFile(absPath);
        
        changes.push({
          type: 'created',
          relativePath: relPath,
          currentHash,
        });
        aiStateHashes[relPath] = currentHash;
      }
    }

    return {
      checkpointId: checkpoint.id,
      computedAt: Date.now(),
      changes,
      aiStateHashes,
    };
  }
}
