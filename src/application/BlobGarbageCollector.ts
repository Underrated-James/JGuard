import * as fs from 'fs/promises';
import * as path from 'path';
import { MetadataStore } from '../storage/MetadataStore';
import { ObjectStore } from '../storage/ObjectStore';

export class BlobGarbageCollector {
  constructor(
    private metadataStore: MetadataStore,
    private objectStore: ObjectStore,
    private storageBaseDir: string
  ) {}

  /**
   * Performs Mark-and-Sweep garbage collection on the ObjectStore.
   * Scans all CheckpointSessions to find reachable object hashes,
   * then deletes any objects in the ObjectStore that are not reachable.
   * L4: Prevents disk leak by removing orphaned blobs from rejected or deleted sessions.
   */
  async run(): Promise<{ deletedCount: number; bytesFreed: number }> {
    const reachableHashes = new Set<string>();

    // 1. Mark phase: Collect all reachable hashes
    const sessionIds = await this.metadataStore.listSessions();
    for (const sessionId of sessionIds) {
      try {
        const session = await this.metadataStore.readSession(sessionId);
        
        // Mark hashes from folder checkpoints
        for (const checkpoint of Object.values(session.folderCheckpoints)) {
          for (const snapshot of Object.values(checkpoint.files)) {
            reachableHashes.add(snapshot.hash);
          }
        }

        // Mark hashes from AI snapshots in UI state
        if (session.uiState?.aiSnapshotHashes) {
          for (const hash of Object.values(session.uiState.aiSnapshotHashes)) {
            reachableHashes.add(hash);
          }
        }
      } catch (err) {
        console.error(`GC: Failed to read session ${sessionId}`, err);
        // If a session is corrupt, we might lose hashes. In a robust system we might want to fail safe.
      }
    }

    // Also mark hashes from standalone checkpoints
    const checkpointIds = await this.metadataStore.listCheckpoints();
    for (const cpId of checkpointIds) {
      try {
        const cp = await this.metadataStore.read(cpId);
        for (const snapshot of Object.values(cp.files)) {
          reachableHashes.add(snapshot.hash);
        }
      } catch (err) {
        // ignore
      }
    }

    // 2. Sweep phase: Find and delete unreachable blobs
    let deletedCount = 0;
    let bytesFreed = 0;

    const objectsDir = path.join(this.storageBaseDir, 'objects');
    try {
      const prefixDirs = await fs.readdir(objectsDir);
      
      for (const prefix of prefixDirs) {
        const prefixDirPath = path.join(objectsDir, prefix);
        const stat = await fs.stat(prefixDirPath);
        
        if (!stat.isDirectory()) continue;

        const objectHashes = await fs.readdir(prefixDirPath);
        for (const hash of objectHashes) {
          if (!reachableHashes.has(hash)) {
            // Unreachable, delete it
            const objPath = path.join(prefixDirPath, hash);
            try {
              const objStat = await fs.stat(objPath);
              await fs.unlink(objPath);
              deletedCount++;
              bytesFreed += objStat.size;
            } catch (err) {
              console.error(`GC: Failed to delete object ${hash}`, err);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    return { deletedCount, bytesFreed };
  }
}
