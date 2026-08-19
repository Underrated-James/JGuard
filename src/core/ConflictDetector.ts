import { ChangeSet, Conflict, IFileScanner } from './types';
import { Hasher } from './Hasher';
import * as path from 'path';

export class ConflictDetector {
  /**
   * Detects if any files modified by the AI were subsequently modified by the user
   * before the reject operation was triggered.
   * 
   * @param changeSet The computed changeset representing AI modifications.
   * @param scanner The file scanner to get current workspace state.
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static async detect(
    changeSet: ChangeSet,
    scanner: IFileScanner,
    workspaceRoot: string
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    const currentPaths = await scanner.scan();

    for (const change of changeSet.changes) {
      if (change.type === 'modified' || change.type === 'created') {
        const currentMeta = currentPaths.get(change.relativePath);
        
        if (!currentMeta) {
          // File was deleted manually after AI modified/created it
          // Technically a conflict, but in MVP we just let RestorePlanner handle it (it will restore from checkpoint)
          continue; 
        }

        const absPath = path.join(workspaceRoot, change.relativePath);
        const currentHash = await Hasher.hashFile(absPath);
        
        const aiHash = changeSet.aiStateHashes[change.relativePath];

        // If the hash on disk now is DIFFERENT than what the AI left behind,
        // it means the user manually edited the file after the AI.
        // AND it's different from the checkpoint (so it's not like they manually reverted it).
        if (currentHash !== aiHash && (change.type === 'modified' ? currentHash !== change.checkpointHash : true)) {
          conflicts.push({
            relativePath: change.relativePath,
            reason: 'user_modified_post_ai',
            currentHash,
            checkpointHash: change.type === 'modified' ? change.checkpointHash : '',
          });
        }
      }
    }

    return conflicts;
  }
}
