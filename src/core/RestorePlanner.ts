import { Checkpoint, ChangeSet, RestorePlan, Conflict } from './types';
import * as path from 'path';

export class RestorePlanner {
  /**
   * Generates a deterministic plan of restore operations to rollback the workspace.
   * 
   * @param checkpoint The checkpoint to restore to.
   * @param changeSet The computed changeset.
   * @param conflicts A list of unresolvable conflicts (files to SKIP).
   * @param workspaceRoot Absolute path to the workspace root.
   */
  static buildPlan(
    checkpoint: Checkpoint,
    changeSet: ChangeSet,
    conflicts: Conflict[],
    workspaceRoot: string
  ): RestorePlan {
    const plan: RestorePlan = { operations: [] };
    const conflictPaths = new Set(conflicts.map(c => c.relativePath));

    for (const change of changeSet.changes) {
      if (conflictPaths.has(change.relativePath)) {
        // Skip conflicted files entirely. The user elected to Keep Current Version 
        // or the system refused to overwrite them.
        continue;
      }

      const absPath = path.join(workspaceRoot, change.relativePath);

      if (change.type === 'modified') {
        plan.operations.push({
          type: 'write',
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash,
        });
      } else if (change.type === 'created') {
        plan.operations.push({
          type: 'delete',
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: null,
        });
      } else if (change.type === 'deleted') {
        plan.operations.push({
          type: 'write',
          relativePath: change.relativePath,
          absolutePath: absPath,
          objectHash: change.checkpointHash,
        });
      }
    }

    // Sort operations for deterministic execution (deletes first, then writes)
    plan.operations.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'delete' ? -1 : 1;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });

    return plan;
  }
}
