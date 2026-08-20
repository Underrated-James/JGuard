import { Checkpoint, ChangeSet, FileChange, RestorePlan, Conflict } from './types';
import * as path from 'path';

/**
 * L2: A planner that respects per-file decisions (accept/reject/pending).
 * Only generates restore operations for files whose decision is 'rejected'.
 */
export class SelectiveRestorePlanner {
  /**
   * Generates a restore plan that only restores rejected files.
   * Accepted and pending files are left untouched.
   */
  static buildPlan(
    checkpoint: Checkpoint,
    changeSet: ChangeSet,
    conflicts: Conflict[],
    workspaceRoot: string
  ): RestorePlan {
    const plan: RestorePlan = { operations: [] };
    const conflictPaths = new Set(conflicts.map(c => c.relativePath));

    // Only process changes that have been explicitly rejected
    const rejectedChanges = changeSet.changes.filter(
      c => changeSet.decisions[c.relativePath] === 'rejected'
    );

    for (const change of rejectedChanges) {
      if (conflictPaths.has(change.relativePath)) {
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

  /**
   * L2/L3: Builds a single-file restore plan.
   * Used for per-file reject and per-file toggle.
   */
  static buildSingleFilePlan(
    change: FileChange,
    objectHash: string | null,
    workspaceRoot: string
  ): RestorePlan {
    const absPath = path.join(workspaceRoot, change.relativePath);
    const plan: RestorePlan = { operations: [] };

    if (change.type === 'modified' || change.type === 'deleted') {
      plan.operations.push({
        type: 'write',
        relativePath: change.relativePath,
        absolutePath: absPath,
        objectHash: objectHash,
      });
    } else if (change.type === 'created') {
      plan.operations.push({
        type: 'delete',
        relativePath: change.relativePath,
        absolutePath: absPath,
        objectHash: null,
      });
    }

    return plan;
  }
}
