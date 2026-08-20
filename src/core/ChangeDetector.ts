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

    // L2: Initialize all decisions as pending
    const decisions: Record<string, import('./types').FileDecision> = {};
    for (const change of changes) {
      decisions[change.relativePath] = 'pending';
    }

    return {
      checkpointId: checkpoint.id,
      computedAt: Date.now(),
      changes,
      aiStateHashes,
      decisions,
    };
  }

  /**
   * L4: Computes incremental O(k) updates to a ChangeSet for specific dirty paths.
   * @param checkpoint The active checkpoint.
   * @param workspaceRoot Absolute path to the workspace root.
   * @param dirtyPaths Array of relative paths that were modified.
   * @param existingChangeSet The previous ChangeSet to update.
   */
  static async detectDelta(
    checkpoint: Checkpoint,
    workspaceRoot: string,
    dirtyPaths: string[],
    existingChangeSet: ChangeSet
  ): Promise<ChangeSet> {
    const newChangeSet: ChangeSet = {
      checkpointId: existingChangeSet.checkpointId,
      computedAt: Date.now(),
      changes: [...existingChangeSet.changes],
      aiStateHashes: { ...existingChangeSet.aiStateHashes },
      decisions: { ...existingChangeSet.decisions },
    };

    for (const relPath of dirtyPaths) {
      const absPath = path.join(workspaceRoot, relPath);
      
      // Remove any existing change for this path
      newChangeSet.changes = newChangeSet.changes.filter(c => c.relativePath !== relPath);
      delete newChangeSet.aiStateHashes[relPath];

      let currentHash: string | null = null;
      let exists = false;
      
      try {
        currentHash = await Hasher.hashFile(absPath);
        exists = true;
      } catch (e: any) {
        if (e.code === 'ENOENT') {
          exists = false;
        } else {
          throw e; // Unexpected error
        }
      }

      const snapshot = checkpoint.files[relPath];

      if (snapshot) {
        if (!exists) {
          // File was in checkpoint but deleted now
          newChangeSet.changes.push({
            type: 'deleted',
            relativePath: relPath,
            checkpointHash: snapshot.hash,
          });
          newChangeSet.decisions[relPath] = newChangeSet.decisions[relPath] ?? 'pending';
        } else if (currentHash !== snapshot.hash) {
          // File was in checkpoint and modified
          newChangeSet.changes.push({
            type: 'modified',
            relativePath: relPath,
            checkpointHash: snapshot.hash,
            currentHash: currentHash!,
          });
          newChangeSet.aiStateHashes[relPath] = currentHash!;
          newChangeSet.decisions[relPath] = newChangeSet.decisions[relPath] ?? 'pending';
        }
      } else {
        if (exists) {
          // File was not in checkpoint and was created
          newChangeSet.changes.push({
            type: 'created',
            relativePath: relPath,
            currentHash: currentHash!,
          });
          newChangeSet.aiStateHashes[relPath] = currentHash!;
          newChangeSet.decisions[relPath] = newChangeSet.decisions[relPath] ?? 'pending';
        }
      }
    }

    // Clean up decisions for files that no longer have changes
    const currentChangePaths = new Set(newChangeSet.changes.map(c => c.relativePath));
    for (const p of Object.keys(newChangeSet.decisions)) {
      if (!currentChangePaths.has(p)) {
        delete newChangeSet.decisions[p];
      }
    }

    return newChangeSet;
  }
}
