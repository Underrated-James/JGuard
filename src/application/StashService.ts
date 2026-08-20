import { StashStore } from '../storage/StashStore';
import { ObjectStore } from '../storage/ObjectStore';
import { RestoreService } from './RestoreService';
import { StashedChange, RestorePlan } from '../core/types';
import * as path from 'path';

export class StashService {
  constructor(
    private stashStore: StashStore,
    private objectStore: ObjectStore,
    private restoreService: RestoreService
  ) {}

  /**
   * Stashes the current file content (AI) and restores the original file content.
   */
  async stashChange(wsRoot: string, relativePath: string, originalHash: string | null, stashedHash: string | null): Promise<void> {
    if (!stashedHash && !originalHash) {
      throw new Error("Cannot stash a file with no changes.");
    }

    const id = `stash_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const stash: StashedChange = {
      id,
      timestamp: Date.now(),
      relativePath,
      originalHash,
      stashedHash,
      workspaceRoot: wsRoot
    };

    await this.stashStore.saveStash(stash);

    const absolutePath = path.join(wsRoot, relativePath);

    // Revert the physical file to the originalHash
    const plan: RestorePlan = {
      operations: [
        originalHash 
          ? { type: 'write', relativePath, absolutePath, objectHash: originalHash }
          : { type: 'delete', relativePath, absolutePath, objectHash: null }
      ]
    };

    await this.restoreService.execute(plan);
  }

  /**
   * Restores the stashed hash (AI) back into the physical file, removing the stash.
   */
  async popStash(stashId: string): Promise<void> {
    await this.applyStash(stashId);
    await this.stashStore.removeStash(stashId);
  }

  /**
   * Restores the stashed hash (AI) back into the physical file, keeping the stash.
   */
  async applyStash(stashId: string): Promise<void> {
    const stash = await this.stashStore.getStash(stashId);
    if (!stash) {
      throw new Error("Stash not found.");
    }

    const absolutePath = path.join(stash.workspaceRoot, stash.relativePath);

    // Revert the physical file to the stashedHash
    const plan: RestorePlan = {
      operations: [
        stash.stashedHash 
          ? { type: 'write', relativePath: stash.relativePath, absolutePath, objectHash: stash.stashedHash }
          : { type: 'delete', relativePath: stash.relativePath, absolutePath, objectHash: null }
      ]
    };

    await this.restoreService.execute(plan);
  }

  /**
   * Deletes the stash without applying it.
   */
  async dropStash(stashId: string): Promise<void> {
    await this.stashStore.removeStash(stashId);
  }

  async getStashes(): Promise<StashedChange[]> {
    return this.stashStore.getStashes();
  }
}
